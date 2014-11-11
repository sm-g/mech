/* global box2d, helpers */
/**
 * @author smg
 */

/**
 * @module mechanism
 */
var mechanism = (function () {
  "use strict";
  var ctx, scale, canvas, loop;
  var isNewState = false,
    drawLabels = false,
    canSelect = true,
    canAdd = true,
    canMove = true,
    paused = false;
  var adorners = [];
  var elements = [],
    selectedElements = [],
    grs = [];
  var currentBody, mouseOnDown;
  var origEdgePoints = [],
    connectedPoints = [],
    grRestoreInfo = [];

  /**
   * @memberOf mechanism
   */
  var pointTypes = {
    fixed: 0,
    clockwise: 1,
    joint: 2
  };

  /**
   * Цветовая схема.
   *
   * @memberOf mechanism
   */
  var colors = {
    /**
     * @memberOf colors
     */
    active: '#fc6e06',
    defaults: '#555',
    back: '#fff',
    labels: '#05f',
    shadow: '#fff',
    group: '#bbb',
    invisible: '#bbb'
  };

  /**
   * Создает новый Shape. Основа для всех фигур.
   *
   * @memberOf mechanism
   * @constructor
   */
  var Shape = function (options) {
    this.id = options.id || helpers.counter(); // автоинкремент
    this.x = options.x || 0;
    this.y = options.y || 0;
    this.angle = options.angle || 0;
    this.color = helpers.randomColor();
    this.center = { // центр масс, для симметричных тел совпадает с x,y
      x: null,
      y: null
    };
    this.isStatic = options.isStatic || false;
  };
  /**
   * Обновляет положение фигуры.
   */
  Shape.prototype.update = function (options) {
    this.angle = options.angle;
    this.center = options.center;
    this.x = options.x;
    this.y = options.y;
  };
  /**
   * Создаёт новый Element.
   *
   * @memberOf mechanism
   * @constructor
   */
  var Element = function (options) {
    Shape.apply(this, arguments);
    this.body = options.body;
    this.isActive = false; // mouse down and move

    elements.push(this);
    isNewState = true;
  };

  Element.prototype = Object.create(Shape.prototype);

  Element.prototype.stop = function () {
    if (this.body) {
      this.body.SetLinearVelocity(new b2Vec2(0, 0));
    }
  };
  Element.prototype.getColorBySelection = function () {
    if (this.isSelected()) {
      return colors.active;
    } else {
      return colors.defaults;
    }
  };
  Element.prototype.select = function () {
    if (selectedElements.indexOf(this) == -1) {
      selectedElements.push(this);
    }
  };
  Element.prototype.unselect = function () {
    selectedElements = _.without(selectedElements, this);
  };
  Element.prototype.isSelected = function () {
    return selectedElements.indexOf(this) != -1;
  };

  Element.prototype.isPoint = function () {
    return this instanceof Point;
  };
  Element.prototype.isEdge = function () {
    return this instanceof Edge;
  };
  /**
   * Соединяет два элемента шарнирной связью.
   */
  Element.prototype.join = function (element, makeMotor) {
    var joint = new b2RevoluteJointDef();
    if (makeMotor) {
      joint.maxMotorTorque = box2d.get.maxMotorTorque();
      joint.motorSpeed = box2d.get.motorSpeed();
      joint.enableMotor = true;
    }
    if (this.isEdge()) {
      joint.Initialize(element.body, this.body, element.body.GetWorldCenter());
    } else {
      joint.Initialize(element.body, this.body, this.body.GetWorldCenter());
    }
    box2d.get.world().CreateJoint(joint);
  };
  /**
   * Удаляет все соединения с другими элементами.
   *
   * @returns {Array} Пары тел, которые были соединены
   */
  Element.prototype.removeJoints = function () {
    var bodiesToJoin = [];
    for (var j = this.body.GetJointList(); j; j = this.body.GetJointList()) {
      bodiesToJoin.push({
        a: getElementOfBody(j.joint.m_bodyA),
        b: getElementOfBody(j.joint.m_bodyB)
      });

      box2d.get.world().DestroyJoint(j.joint);
    }
    return bodiesToJoin;
  };

  Element.prototype.destroy = function () {
    console.info("destroy " + this);

    box2d.get.world().DestroyBody(this.body);

    this.unselect();
    elements = _.without(elements, this);
    isNewState = true;
  };

  /**
   * @memberOf mechanism
   */
  var Point = function (options) {
    Element.apply(this, arguments);
    this.type = options.type || pointTypes.joint;
    this.isStatic = (this.type != pointTypes.joint);
    this.radius = options.radius || 1;
    this.edges = [];
    // точка перемещается, потеряв связи с другими точками
    this.isFlying = false;
  };

  Point.prototype = Object.create(Element.prototype);
  Point.prototype.toString = function () {
    var edgesStr = idsOf(this.edges.filter(function (edge) {
      return !edge.invisible;
    })).join();
    return [this.id, 'p', this.x.toFixed(3), this.y.toFixed(3), this.type,
        edgesStr].join();
  };
  Point.prototype.setPosition = function (x, y) {
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x > canvas.width / scale) x = canvas.width / scale;
    if (y > canvas.height / scale) y = canvas.height / scale;

    this.x = x;
    this.y = y;
    this.body.SetPosition(new b2Vec2(x, y));
    isNewState = true;
  };
  /**
   * Соединяет тела с мотором или без
   * @param {Boolean} motor
   */
  Point.prototype.rejoin = function (motor) {
    var toJoin = this.removeJoints();
    for (var i in toJoin) {
      toJoin[i].a.join(toJoin[i].b, motor);
    }
  };
  /**
   * Меняет тип точки
   */
  Point.prototype.setType = function (type) {
    if (type != this.type) {
      if (type == pointTypes.clockwise) {
        this.rejoin(!paused); // на паузе без моторов
      } else if (!paused && this.type == pointTypes.clockwise) {
        this.rejoin(false);
      }

      this.type = type;
      this.isStatic = (type != pointTypes.joint);
      box2d.refresh.bodyType(this);
      isNewState = true;
    }
  };
  /**
   * Меняет моторы при смене режима паузы
   * @param {Boolean} paused
   */
  Point.prototype.onPaused = function (paused) {
    if (this.type == pointTypes.clockwise) {
      if (paused) {
        this.rejoin(false);
      } else {
        this.rejoin(true);
      }
    }
  };
  /**
   * Начинает полет точки.
   */
  Point.prototype.beginFlying = function () {
    this.isFlying = true;
    var i, k;

    connectedPoints = [];
    grRestoreInfo = [];
    var edgesGrouped = _.groupBy(this.edges, "gr");

    for (i in edgesGrouped) {
      var realEdgesOfGr = edgesGrouped[i].filter(Edge.prototype.isRealFilter);

      console.log('begin flying \nrealEdgesOfGr ' + idsOf(realEdgesOfGr));

      if (realEdgesOfGr.length > 1) {
        // если два ребра с одной группой - это звено с несколькими ребрами, надо сохранить группу
        var group = realEdgesOfGr[0].gr;

        // точки соединенных ребер, которые входят в группу
        var points = [];
        for (k in realEdgesOfGr) {
          points.push(realEdgesOfGr[k].getPointOtherThan(this));
        }
        console.log('points ' + idsOf(points));

        // реальные ребра группы кроме тех,
        // которые соединены с полетевшей точкой
        var edges = [];
        var grRealEdges = group.getRealEdges();
        for (k in grRealEdges) {
          if (!_.contains(realEdgesOfGr, grRealEdges[k]))
            edges.push(grRealEdges[k]);
        }
        console.log('edges ' + idsOf(edges));

        // сохраняем ребра и точки для восстановления группы
        grRestoreInfo.push({
          edges: edges,
          points: points
        });
      }
      for (k in realEdgesOfGr) {
        // сохраняем точки реальных ребер
        connectedPoints.push(realEdgesOfGr[k].getPointOtherThan(this));
        // удаляем ребро
        realEdgesOfGr[k].destroy();
      }
    }
  };
  /**
   * Завершает полет точки.
   */
  Point.prototype.endFlying = function () {
    this.isFlying = false;
    var i, newEdge;

    // восстанавливаем группы
    // добавляем созданные ребра в группы
    for (i in grRestoreInfo) {
      var gr = new Group(grRestoreInfo[i].edges);
      console.info('/add from endFlying');
      for (var k in grRestoreInfo[i].points) {
        newEdge = createEdge({
          p1: this,
          p2: grRestoreInfo[i].points[k],
          gr: gr
        });
      }
      console.info('\\add from endFlying');

      triangulate(gr.getPoints(), gr);
    }
    grRestoreInfo = [];

    // восстанавливаем одиночные ребра
    for (i in connectedPoints) {
      newEdge = createEdge({ // может быть создано выше
        p1: this,
        p2: connectedPoints[i]
      });
    }
    connectedPoints = [];
  };
  /**
   * Уничтожаем точку и все её ребра.
   */
  Point.prototype.destroy = function () {
    Element.prototype.destroy.call(this);
    var l = this.edges.length;
    while (l--) {
      this.edges[l].destroy();
    }
  };
  Point.prototype.draw = function () {
    var x = this.x * scale;
    var y = this.y * scale;

    ctx.save();
    // ctx.translate(x, y);
    // ctx.rotate(this.angle);
    // ctx.translate(-x, -y);

    // опорная точка - рисуем треугольник
    if (this.isStatic) {
      ctx.strokeStyle = this.getColorBySelection();
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx
        .lineTo((this.x + this.radius) * scale, (this.y + this.radius) * scale);
      ctx
        .lineTo((this.x - this.radius) * scale, (this.y + this.radius) * scale);
      ctx.closePath();
      ctx.stroke();
    }

    // окружность
    ctx.fillStyle = this.getColorBySelection();
    ctx.beginPath();
    ctx.arc(x, y, this.radius * scale, 0, Math.PI * 2, false);
    ctx.closePath();
    ctx.fill();

    // фон
    ctx.fillStyle = colors.back;
    ctx.beginPath();
    ctx.arc(x, y, this.radius * scale * 0.5, 0, Math.PI * 2, false);
    ctx.closePath();
    ctx.fill();

    // точка вращается - рисуем дугу
    if (this.type == pointTypes.clockwise) {
      ctx.strokeStyle = this.getColorBySelection();
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, this.radius * scale + 3, 0, Math.PI * 1.5, false);
      ctx.stroke();
    }

    if (drawLabels) {
      ctx.fillStyle = colors.labels;
      ctx.font = "10pt Arial";
      ctx.fillText(this.id, (this.x - this.radius) * scale, (this.y - this.radius) * scale);
    }

    ctx.restore();
  };

  /**
   * @memberOf mechanism
   */
  var Edge = function (options) {
    Element.apply(this, arguments);
    this.p1 = options.p1;
    this.p2 = options.p2;
    this.p1.edges.push(this);
    this.p2.edges.push(this);
    this.invisible = options.invisible || false;

    var middle = helpers.middle(this.p1, this.p2);
    this.x = middle.x;
    this.y = middle.y;

    var gr = options.gr || new Group();
    console.info('add from ctor e ' + this.id + ' to gr ' + gr.id);
    gr.add(this);
    console.info('created ' + this);
  };
  Edge.prototype = Object.create(Element.prototype);
  Edge.prototype.toString = function () {
    return [this.id, 'e', this.p1.id, this.p2.id, this.gr.id].join();
  };
  Edge.prototype.getMiddle = function () {
    return {
      x: this.x,
      y: this.y
    };
  };
  Edge.prototype.width = 0.2;
  Edge.prototype.select = function () {
    if (!this.invisible)
      Element.prototype.select.call(this);
  };
  Edge.prototype.isRealFilter = function (e) {
    return !e.invisible;
  };
  /**
   * Удаляет себя из концевых точек.
   */
  Edge.prototype.removeFromPoints = function () {
    this.p1.edges = _.without(this.p1.edges, this);
    this.p2.edges = _.without(this.p2.edges, this);
  };

  Edge.prototype.getPointOtherThan = function (p) {
    if (this.p1 == p)
      return this.p2;
    else
      return this.p1;
  };

  Edge.prototype.getLength = function () {
    var pp = new paper.Point(this.p1.x - this.p2.x, this.p1.y - this.p2.y);
    return pp.length;
  };
  Edge.prototype.getPointsCopy = function () {
    return [{
      x: this.p1.x,
      y: this.p1.y
    }, {
      x: this.p2.x,
      y: this.p2.y
    }];
  };
  /**
   * Меняет длину ребра, двигая точки вдоль оси.
   */
  Edge.prototype.correctLenght = function (originalPoints, dL) {
    if (this.invisible)
      return;
    //    grRestoreInfo = [{
    var grEdges = _.without(this.gr.getRealEdges(), this);
    console.log('edges ' + idsOf(grEdges));
    //    }];
    var p2 = this.p2;
    var p1 = this.p1;
    var newp1 = helpers.movePointAlongLine(originalPoints[0], originalPoints[1], -dL);
    var newp2 = helpers.movePointAlongLine(originalPoints[1], originalPoints[0], -dL);
    console.log(helpers.logP(this.p1, 'p1') + helpers.logP(newp1, ' -> '));
    console.log(helpers.logP(this.p2, 'p2') + helpers.logP(newp2, ' -> '));
    this.destroy();
    p1.setPosition(newp1.x, newp1.y);
    p2.setPosition(newp2.x, newp2.y);

    var gr = new Group(grEdges);
    console.info('/add from correct');
    var newEdge = createEdge({
      p1: p1,
      p2: p2,
      gr: gr
    });
    newEdge.select();
    console.info('\\add from correct');
    currentBody = newEdge.body;

    if (paused) {
      p1.stop();
      p2.stop();
    }
  };

  Edge.prototype.setLenght = function (l) {
    if (this.invisible)
      return;

    var dL = (-this.getLength() + l) / 2;
    var points = this.getPointsCopy();
    this.correctLenght(points, dL);
  };
  /**
   * Уничтожает ребро.
   */
  Edge.prototype.destroy = function () {
    Element.prototype.destroy.call(this);
    this.removeFromPoints();

    // уничтожаем группу ребра
    var gr = this.gr;
    gr.remove(this);
    gr.destroy();
  };
  Edge.prototype.draw = function () {
    var x = this.x * scale;
    var y = this.y * scale;
    ctx.save();

    // ctx.translate(x, y);
    // ctx.rotate(this.angle);
    // ctx.translate(-x, -y);
    if (this.invisible) {
      ctx.strokeStyle = colors.invisible;
    } else {
      ctx.strokeStyle = this.getColorBySelection();
    }

    ctx.lineWidth = scale / 2 | 0;
    // целая часть
    ctx.beginPath();
    ctx.moveTo(this.p1.x * scale, this.p1.y * scale);
    ctx.lineTo(this.p2.x * scale, this.p2.y * scale);
    ctx.stroke();

    if (drawLabels) {
      ctx.fillStyle = colors.labels;
      ctx.font = "10pt Arial";
      ctx.shadowColor = colors.shadow;
      ctx.shadowBlur = 3;
      ctx.fillText(this.id + ': ' + this.getLength().toFixed(3), x, y);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  };
  /**
   * Рисует линию между точками
   * @param {Object} p1 Первая точка или массив в двух точек
   * @param {Object} p2 Вторая точка
   */
  var drawLine = function (p1, p2) {
    if (p1 instanceof Array) {
      p2 = p1[1];
      p1 = p1[0];
    }
    var x1 = p1.x * scale;
    var y1 = p1.y * scale;
    var x2 = p2.x * scale;
    var y2 = p2.y * scale;

    ctx.save();
    ctx.strokeStyle = colors.active;

    ctx.lineWidth = scale / 5 | 0;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.restore();
  };
  /**
   * Группа ребер — звено.
   *
   * @memberOf mechanism
   */
  var Group = function (options) {
    this.id = (options && options.id) || helpers.counter();
    this.edges = [];
    grs.push(this);
    if (options instanceof Array) {
      console.info('/adds from Group ctor');

      for (var i in options) {
        this.add(options[i]);
      }
      console.info('\\adds from Group ctor');

    }
    console.info('create ' + this);
  };
  /**
   * Возвращает ребра жесткости звена.
   *
   * @returns
   */
  Group.prototype.getStiffEdges = function () {
    return _.filter(this.edges, function (e) {
      return e.invisible;
    });
  };
  /**
   * Возвращает реальные ребра звена.
   *
   * @returns
   */
  Group.prototype.getRealEdges = function () {
    return _.filter(this.edges, Edge.prototype.isRealFilter);
  };
  /**
   * Добавляет ребро к группе.
   *
   * @param edge
   */
  Group.prototype.add = function (edge) {
    console.log('add e ' + edge.id + ' to gr ' + this.id);

    if (edge.gr == this) {
      console.log('edge.gr == this');
      return;
    }
    // ребро было в группе — меняем группу
    if (edge.gr) {
      // console.log(edge.id, 'gr = ', this.id);
      edge.gr.remove(edge);
    }
    edge.gr = this;

    if (!_.contains(this.edges, edge))
      this.edges.push(edge);
  };
  /**
   * Убирает ребро из группы.
   *
   * @param edge
   */
  Group.prototype.remove = function (edge) {
    console.log('remove e ' + edge.id + ' from gr ' + this.id);

    this.edges = _.without(this.edges, edge);
    edge.gr = null;

    if (this.edges.length === 0)
      this.destroy();
  };

  Group.prototype.toString = function () {
    var edgesStr = idsOf(this.getRealEdges()).join();
    return [this.id, 'g', edgesStr].join();
  };

  /**
   * Звено выделено, когда выбраны все его пары.
   *
   * @returns
   */
  Group.prototype.isSelected = function () {
    return _.every(this.getPoints(), function (p) {
      return p.isSelected();
    });
  };

  Group.prototype.getPoints = function () {
    var res = [];
    _.each(this.edges, function (e) {
      res.push(e.p1);
      res.push(e.p2);
    });
    return _.sortBy(_.unique(res), "id");
  };

  /**
   *
   */
  Group.prototype.destroy = function () {
    if (this.inDestroy)
      return;

    console.info("destroy " + this);

    this.inDestroy = true;

    // Удаляем спец-ребра
    var stiffs = this.getStiffEdges();
    console.info('invis ' + stiffs);
    for (var i in stiffs) {
      stiffs[i].destroy();
    }
    // каждое реальное ребро в новую группу
    var l = this.edges.length;
    while (l--) {
      var e = this.edges[l];
      console.assert(!e.invisible);
      var g = new Group([e]);
    }

    grs = _.without(grs, this);
  };

  Group.prototype.draw = function () {
    ctx.save();

    if (this.isSelected()) {
      ctx.fillStyle = colors.active;
    } else {
      ctx.fillStyle = colors.group;
    }

    ctx.lineWidth = scale / 2 | 0;
    ctx.beginPath();
    var points = this.getPoints();
    points.map(function (p) {
      ctx.lineTo(p.x * scale, p.y * scale);
    });
    ctx.fill();
    ctx.restore();
  };
  /**
   * @memberOf mechanism
   */
  var idsOf = function (entities) {
    return entities.map(function (e) {
      return e.id;
    });
  };

  /**
   * @memberOf mechanism
   */
  var getPoints = function () {
    return elements.filter(function (e) {
      return e.isPoint();
    });
  };
  /**
   * @memberOf mechanism
   */
  var getEdges = function () {
    return elements.filter(function (e) {
      return e.isEdge();
    });
  };
  /**
   * @memberOf mechanism
   */
  var getEntities = function () {
    return _.union(elements, grs);
  };
  /**
   * Создаёт точку с заданными параметрами.
   *
   * @memberOf mechanism
   * @returns Новая точка
   */
  var createPoint = function (options) {
    options.radius = 1;
    var point = new Point(options);
    var body = box2d.addToWorld(point, 1);
    point.body = body;
    return point;
  };
  /**
   * Создает ребро между двумя точками.
   *
   * @memberOf mechanism
   * @returns Новое ребро между точками (если создано)
   */
  var createEdge = function (options) {
    // не создавать ребро
    if (options.p1 == options.p2)
      return;
    // только одно ребро между точками
    var exist = getEdgeBetweenPoints(options.p1, options.p2);
    if (exist) {
      return;
    }

    var edge = new Edge(options);
    var body = box2d.addToWorld(edge, 2);
    edge.body = body;

    edge.join(options.p1, options.p1.type == pointTypes.clockwise);
    edge.join(options.p2, options.p2.type == pointTypes.clockwise);
    return edge;
  };
  /**
   * Соединяет точки рёбрами (в звено).
   *
   * @memberOf mechanism
   */
  var connectPoints = function (points) {
    if (points.length < 2)
      return;

    var i;

    // Удаляем все существующие ребра между точками. Группы тоже удалятся.
    for (i = 0; i < points.length; i++) {
      var p = points[i];
      var l = p.edges.length;
      while (l--) {
        if (_.contains(points, p.edges[l].p1) && _.contains(points, p.edges[l].p2))
          p.edges[l].destroy();
      }
    }

    // Создаем группу
    var gr0 = new Group();
    points = _.sortBy(points, "id");
    // соединяем точки в контур
    for (i = 1; i < points.length; i++) {
      createEdge({
        p1: points[i],
        p2: points[i - 1],
        gr: gr0
      });
    }
    createEdge({
      p1: points[0],
      p2: points[points.length - 1],
      gr: gr0
    });

    // Добавляем ребра жесткости
    triangulate(points, gr0);
  };
  /**
   * Разбивает выпуклый многоугольник на треугольники спец-ребрами.
   *
   * @param points
   * @memberOf mechanism
   */
  var triangulate = function (points, gr) {
    if (points.length > 3) {
      for (var i = 2; i < points.length - 1; i++) {
        createEdge({
          p1: points[0],
          p2: points[i],
          invisible: true,
          gr: gr
        });
      }
    }
  };

  /**
   * @memberOf mechanism
   * @returns Элемент, связанный с телом.
   */
  var getElementOfBody = function (body) {
    if (body) {
      var id = body.GetUserData();
      return mechanism.elements.get(id);
    }
  };
  /**
   * @memberOf mechanism
   * @returns Ребро между двумя точками.
   */
  var getEdgeBetweenPoints = function (p1, p2) {
    for (var i in p1.edges) {
      if (p1.edges[i].p1 == p2 || p1.edges[i].p2 == p2)
        return p1.edges[i];
    }
  };

  return {
    handlers: {
      /**
       * Обрабатывает событие mousedown.
       *
       * @return element to show info
       * @memberOf handlers
       */
      onDown: function (mouse) {
        currentBody = box2d.get.bodyAtMouse(mouse);
        if (canSelect && currentBody) {
          var element = getElementOfBody(currentBody);
          if (element && !element.isSelected()) {
            if (!mouse.isCtrl) {
              selectedElements = [];
            }
            if (element.isEdge()) {
              origEdgePoints = element.getPointsCopy();
              console.info("saved " + origEdgePoints);
            }

            element.select();
            element.isActive = true;
          }
          mouseOnDown = _.clone(mouse);
          return element;
        }
      },
      /**
       * Обрабатывает событие mouseup.
       *
       * @return element to show info
       */
      onUp: function (mouse) {
        if (canSelect && currentBody) {
          var element = getElementOfBody(currentBody);
          if (element && element.isPoint()) {
            var point = element;
            if (point.isSelected() && !point.isActive) {
              // снимаем выделение
              point.unselect();
              // show last selected
              return _.last(selectedElements);
            } else {
              point.isActive = false;
              if (point.isFlying) {
                // восстанавливаем ребра
                point.endFlying();
              }
            }
          }
          origEdgePoints = [];
          return element;
        }
      },
      /**
       * Обрабатывает событие click.
       *
       * @return newPoint or undefined
       */
      onClick: function (mouse) {
        if (canAdd && !currentBody) { // не нашлось тела
          var selectedLength = selectedElements.length;
          selectedElements = [];

          // была выделена 0 или 1 точка - добавляем точку
          if (selectedLength < 2) {
            var newPoint = createPoint({
              x: mouse.x,
              y: mouse.y
            });
            newPoint.select();
            return newPoint;
          }
        }
      },
      /**
       * Обрабатывает событие mousemove.
       */
      onMove: function (mouse) {
        if (canMove && mouse.isDown && currentBody) {
          var element = getElementOfBody(currentBody);
          if (element) {
            if (element.isPoint()) {
              if (!mouse.isCtrl && !element.isFlying) {
                element.beginFlying();
              }
              element.setPosition(mouse.x, mouse.y);
            } else if (element.isEdge()) {
              var edge = element;
              if (mouse.x != mouseOnDown.x || mouse.y != mouseOnDown.y) {
                // изменение длины ребра - расстоние между наклонной и высотой,
                // опущенной к ребру
                if (origEdgePoints == [])
                  console.warn("empty origEdgePoints");
                else {
                  var diff = helpers.distToHeight(origEdgePoints[0], origEdgePoints[1],
                    mouseOnDown, mouse);

                  var normalFromDown = helpers.normalFrom(edge.p1, edge.p2,
                    mouseOnDown);
                  adorners = [];
                  adorners.push([mouseOnDown, normalFromDown]); // рисуем нормаль

                  var middle = edge.getMiddle();
                  var goesInner = helpers.onOneSide(mouseOnDown, normalFromDown, mouse, middle);
                  console.log('diff: ' + diff.toFixed(3));
                  console.log('goesInner: ' + goesInner);
                  edge.correctLenght(origEdgePoints, goesInner ? -diff : diff);
                }
              }
            }

            element.isActive = true;
            return element;
          }
        }
      },
      /**
       * Обрабатывает нажатие delete.
       */
      onDelete: function () {
        // удаляем все выбранные элементы
        if (selectedElements[0]) {
          var copy = _.clone(selectedElements);
          for (var i in copy) {
            if (copy[i])
              copy[i].destroy();
          }
          selectedElements = [];
        }
      },
      onAKeyUp: function () {
        if (canAdd) {
          connectPoints(selectedElements.filter(function (e) {
            return e.isPoint();
          }));
        }
      }
    },
    get: {
      /**
       * @returns Должны ли сталкиваться два элемента. Сталкиваются соединённые
       *          ребро и точка.
       */
      collideFilter: function (id1, id2) {
        var e1 = mechanism.elements.get(id1);
        var e2 = mechanism.elements.get(id2);
        var edge, point;
        if (e1 instanceof mechanism.elements.Edge) {
          edge = e1;
          if (e2 instanceof mechanism.elements.Point) {
            point = e2;
          }
        } else if (e2 instanceof mechanism.elements.Edge) {
          edge = e2;
          if (e1 instanceof mechanism.elements.Point) {
            point = e1;
          }
        }
        if (point && edge) {
          return point.edges.indexOf(edge) != -1;
        }

        return false;
      }
    },
    set: {
      /**
       * Устанавливает значение параметров для последнего выбранного тела.
       *
       * @param what
       *          Какой параметр менять.
       * @param value
       *          Значение параметра.
       * @memberOf set
       */
      point: function (what, value) {
        var element = selectedElements.pop();
        if (element) {
          selectedElements.push(element);
          if (element.isPoint()) {
            if (what == 'type') {
              element.setType(value);
            } else {
              var newX = element.x,
                newY = element.y;
              if (what == 'x') {
                newX = value;
              } else if (what == 'y') {
                newY = value;
              }

              element.beginFlying();
              element.setPosition(newX, newY);
              element.endFlying();
            }
          }
        }
      },
      edge: function (what, value) {
        var element = selectedElements.pop();
        if (element) {
          selectedElements.push(element);
          if (element.isEdge()) {
            if (what == 'length') {
              if (value > 0) {
                element.setLenght(value);
              }
            }
          }
        }
      },
      /**
       * Устанавливает показ надписей к элементам.
       */
      labels: function (value) {
        drawLabels = value;
      },
      /**
       * Устанавливает контекст рисования.
       */
      context: function (context) {
        ctx = context;
      },
      /**
       * Устанавливает масштаб рисования.
       */
      scale: function (newScale) {
        scale = newScale;
      },
      canvas: function (newCanvas) {
        canvas = newCanvas;
      },
      loop: function (l) {
        loop = l;
      }
    },
    elements: {
      /**
       * Отрисовывает все элементы.
       *
       * @memberOf elements
       */
      draw: function () {
        var i;
        if (debug)
          ctx.globalAlpha = 0.5;

        for (i in grs) {
          grs[i].draw();
        }
        var edges = getEdges();
        for (i in edges) {
          edges[i].draw();
        }
        var points = getPoints();
        for (i in points) {
          points[i].draw();
        }
        for (i in adorners) {
          drawLine(adorners[i]);
        }
      },

      Point: Point,
      Edge: Edge,
      /**
       * @param id
       * @returns элемент с указанным id.
       */
      get: function (id) {
        return _.findWhere(elements, {
          id: id
        });
      },
      select: function (id) {
        var element = mechanism.elements.get(id);
        selectedElements = [];
        if (element) {
          element.select();
        }
        return element;
      }
    },
    simulation: {
      /**
       * Запускает симуляцию.
       *
       * @memberOf simulation
       */
      start: function () {
        canSelect = true;
        canAdd = false;
        canMove = false;
        paused = false;
        var points = getPoints();
        for (var i in points) {
          points[i].onPaused(paused);
        }
      },
      /**
       * Приостанавливает симуляцию.
       */
      pause: function () {
        canSelect = true;
        canAdd = true;
        canMove = true;
        paused = true;

        var i, points = getPoints();
        for (i in points) {
          points[i].onPaused(paused);
        }
        for (i in elements) {
          elements[i].stop();
        }
      },
      /**
       * Останавливает симуляцию.
       */
      stop: function () {
        mechanism.simulation.pause();
      }
    },
    state: {
      /**
       * @returns Требуется ли обновить текущее состояние.
       * @memberOf state
       */
      isNew: function () {
        if (isNewState) {
          isNewState = false;
          return true;
        }
      },
      /**
       * Удаляет все элементы.
       */
      clear: function () {
        var points = getPoints();
        for (var i in points) {
          points[i].destroy();
        }
      },
      /**
       * Загружает механизм из строки.
       */
      load: function (newState) {
        mechanism.state.clear();

        try {
          var elementsStr = newState.split('\n');
          var elementsDefs = [];
          var lastId = -1;
          for (var i in elementsStr) {
            elementsDefs.push(elementsStr[i].split(','));
          }

          for (i in elementsDefs) {
            if (lastId < +elementsDefs[i][0]) {
              lastId = +elementsDefs[i][0];
            }
            // сначала добавляем точки и группы
            if (elementsDefs[i][1] == 'p') {
              // [this.id, 'p', this.x.toFixed(3), this.y.toFixed(3),
              // this.type,
              // edgesStr]
              var pDef = elementsDefs[i];
              createPoint({
                id: +pDef[0],
                x: +pDef[2],
                y: +pDef[3]
              }).setType(pDef[4]);
            } else if (elementsDefs[i][1] == 'g') {
              // добавляем группы
              // [this.id, 'g', edgesStr]
              new Group({
                id: +elementsDefs[i][0]
              });
            }
          }
          for (i in elementsDefs) {
            if (elementsDefs[i][1] == 'e') {
              // добавляем рёбра между точками
              // [this.id, 'e', this.p1.id, this.p2.id, this.gr.id]
              var eDef = elementsDefs[i];
              createEdge({
                p1: mechanism.elements.get(+eDef[2]),
                p2: mechanism.elements.get(+eDef[3]),
                id: +eDef[0],
                gr: _.findWhere(grs, {
                  id: +eDef[4]
                })
              });
            }
          }
          helpers.setCounter(lastId + 1);
        } catch (e) {
          alert('Ошибка при загрузке механизма. ' + e.name);
        }
      },
      /**
       * @returns Механизм в виде строки.
       */
      save: function () {
        var str = '';
        var sorted = _.sortBy(getEntities().filter(Edge.prototype.isRealFilter), "id");
        for (var i in sorted) {
          str += sorted[i].toString() + '\n';
        }

        return str;
      },
      reload: function () {
        mechanism.state.load(mechanism.state.save());
      }
    }
  };
})();