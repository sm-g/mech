/**
 * @module editor
 */
var editor = (function() {
  // box2d aliases
  var b2Vec2 = Box2D.Common.Math.b2Vec2, b2AABB = Box2D.Collision.b2AABB, b2BodyDef = Box2D.Dynamics.b2BodyDef, b2Body = Box2D.Dynamics.b2Body, b2FixtureDef = Box2D.Dynamics.b2FixtureDef, b2Fixture = Box2D.Dynamics.b2Fixture, b2World = Box2D.Dynamics.b2World, b2MassData = Box2D.Collision.Shapes.b2MassData, b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape, b2CircleShape = Box2D.Collision.Shapes.b2CircleShape, b2DebugDraw = Box2D.Dynamics.b2DebugDraw, b2MouseJointDef = Box2D.Dynamics.Joints.b2MouseJointDef, b2RevoluteJointDef = Box2D.Dynamics.Joints.b2RevoluteJointDef;

  window.requestAnimFrame = (function() {
    return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame
        || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function(callback, element) {
          window.setTimeout(callback, 1000 / 60);
        };
  })();

  // режим отладки
  var debug = true;
  
  var scale, canvas, ctx, world, fixDef, selectedBody;
  /**
   * Кнопки управления симуляцией.
   * @memberOf editor
   */  
  var controls = {
    play: 0,
    pause: 0,
    stop: 0,
    load: 0,
    scale: 0
  };
  /**
   * Панель редактирований параметров элемента.
   * @memberOf editor
   */
  var dashboard = {
    /**
     * @memberOf dashboard
     */
    elementId: 0,
    elementName: 0,
    pointType: 0,
    pointX: 0,
    pointY: 0,
    edgePoints: 0,
    edgeLength: 0,
    currentState: 0
  }
  /**
   * Цветовая схема.
   * @memberOf editor
   */
  var colors = {
    /**
     * @memberOf colors
     */
    active: '#BBB',
    defaults: '#555'
  }
  /**
   * Состояние мыши.
   * @memberOf editor
   */
  var mouse = {
    /**
     * @memberOf mouse
     */
    x: 0,
    y: 0,
    isDown: false,
    isCtrl: false
  }

  /**
   * Инициализатор редактора.
   * @memberOf editor
   */
  var init = {
    /**
     * @memberOf init
     */
    start: function(id, _scale) {
      canvas = document.getElementById(id);
      controls.play = document.getElementById("play");
      controls.pause = document.getElementById("pause");
      controls.stop = document.getElementById("stop");
      controls.load = document.getElementById("load");
      controls.scale = document.getElementById("scale");
      dashboard.pointType = document.getElementById("point-type");
      dashboard.pointX = document.getElementById("point-x");
      dashboard.pointY = document.getElementById("point-y");
      dashboard.edgePoints = document.getElementById("edge-points");
      dashboard.edgeLength = document.getElementById("edge-length");
      dashboard.elementId = document.getElementById("element-id");
      dashboard.elementName = document.getElementById("element-name");
      dashboard.currentState = document.getElementById("current-state");      

      ctx = canvas.getContext("2d");
      scale = _scale || 20;

      box2d.create.world();
      box2d.create.defaultFixture();

      this.callbacks();

      loop.process();
    },
    callbacks: function() {
      var canvasPosition = helpers.getElementPosition(canvas);

      controls.play.addEventListener('click', function(e) {
        mechanism.start();
      }, false);

      controls.pause.addEventListener('click', function(e) {
        mechanism.pause();
      }, false);
      
      controls.load.addEventListener('click', function(e) {
        mechanism.load(dashboard.currentState.value);
      }, false);

      dashboard.pointX.addEventListener('input', function(e) {
        mechanism.setPoint('x', +e.target.value);
      }, false);

      dashboard.pointY.addEventListener('input', function(e) {
        mechanism.setPoint('y', +e.target.value);
      }, false);

      dashboard.pointType.addEventListener('change', function(e) {
        mechanism.setPoint('type', e.target.selectedIndex);
      }, false);
      
      controls.scale.addEventListener('change', function(e) {
        var val = +e.target.value;
        if (val > 0 && val < 50) {
          scale = val;
        }
      }, false);
      
      canvas.addEventListener('click', function(e) {
        mechanism.onClick();
      }, false);

      canvas.addEventListener('mousemove', function(e) {
        mouse.x = (e.clientX - canvasPosition.x) / scale;
        mouse.y = (e.clientY - canvasPosition.y) / scale;
        mechanism.onMove();
      }, false);

      canvas.addEventListener('mousedown', function(e) {
        mouse.isDown = true;
        mouse.isCtrl = e.ctrlKey;
        mechanism.onDown();
      }, false);

      canvas.addEventListener('mouseup', function(e) {
        mouse.isDown = false;
        mouse.isCtrl = false;
        mechanism.onUp();
      }, false);

      var keyCodes = {
        DEL: 46,
        SHIFT: 16
      }

      document.onkeyup = function key(e) {
        switch (e.keyCode) {
          case keyCodes.DEL:
            mechanism.onDelete();
            break;
        }
      }
    }
  };

  /** 
   * @memberOf editor
   */
  var box2d = {
    /**
     * Добавляет в мир тело для соответствующей фигуры.
     * @memberOf box2d
     * @param shape 
     * @returns Созданное тело.
     */
    addToWorld: function(shape) {
      var bodyDef = this.create.bodyDef(shape);

      if (shape instanceof Circle || shape instanceof mechanism.Point) {
        fixDef.shape = new b2CircleShape(shape.radius);
      } else if (shape instanceof Box) {
        fixDef.shape = new b2PolygonShape;
        fixDef.shape.SetAsBox(shape.width / 2, shape.height / 2);
      } else if (shape instanceof Edge) {
        fixDef.shape = new b2PolygonShape;
        fixDef.shape.SetAsEdge(new b2Vec2(0, 0), new b2Vec2(shape.long, 0));
      } else if (shape instanceof mechanism.Edge) {
        fixDef.shape = new b2PolygonShape;
        var middleP = new paper.Point((shape.p1.x + shape.p2.x) / 2, (shape.p1.y + shape.p2.y) / 2);
        var paperPoint = new paper.Point(shape.p1.x - shape.p2.x, shape.p1.y - shape.p2.y).normalize(shape.width);
        var pp1 = paperPoint.rotate(90);
        var pp2 = paperPoint.rotate(-90);
        fixDef.shape.SetAsArray([new b2Vec2(shape.p1.x - middleP.x, shape.p1.y - middleP.y), new b2Vec2(pp1.x, pp1.y),
            new b2Vec2(shape.p2.x - middleP.x, shape.p2.y - middleP.y), new b2Vec2(pp2.x, pp2.y)]);

        bodyDef.position.x = middleP.x;
        bodyDef.position.y = middleP.y;
      }

      var body = world.CreateBody(bodyDef);
      body.CreateFixture(fixDef);
      return body;
    },
    create: {
      /**
       * Создает мир.
       * @memberOf create
       */
      world: function() {
        world = new b2World(new b2Vec2(0, 0), false);

        if (debug) {
          var debugDraw = new b2DebugDraw();
          debugDraw.SetSprite(ctx);
          debugDraw.SetDrawScale(scale);
          debugDraw.SetFillAlpha(0.5);
          debugDraw.SetLineThickness(1.0);
          debugDraw.SetFlags(b2DebugDraw.e_shapeBit | b2DebugDraw.e_jointBit);
          world.SetDebugDraw(debugDraw);
        }
      },
      /**
       * Настраивает общий fixture definition.
       */
      defaultFixture: function() {
        fixDef = new b2FixtureDef;
        fixDef.density = 10.0; // плотность
        fixDef.friction = 1; // трение
        fixDef.restitution = 0.0; // упругость
      },
      /**
       * Создает body definition для фигуры.
       * @param shape
       * @returns body definition
       */
      bodyDef: function(shape) {
        var bodyDef = new b2BodyDef;
        if (shape.isStatic) {
          bodyDef.type = b2Body.b2_staticBody;
        } else {
          bodyDef.type = b2Body.b2_dynamicBody;
        }
        bodyDef.position.x = shape.x;
        bodyDef.position.y = shape.y;
        bodyDef.userData = shape.id;
        bodyDef.angle = shape.angle;

        return bodyDef;
      }
    },
    get: {
      /**
       * @memberof get
       * @param b
       * @returns Параметры тела: координаты, угол, центр, id-элемента
       */
      bodySpec: function(b) {
        return {
          x: b.GetPosition().x,
          y: b.GetPosition().y,
          angle: b.GetAngle(),
          center: {
            x: b.GetWorldCenter().x,
            y: b.GetWorldCenter().y
          },
          elementId: b.GetUserData()
        };
      },
      /**
       * @param dynamicOnly Флаг поиска только нестатических тел.
       * @returns Тело, на которое указывает мышь.
       */
      bodyAtMouse: function(dynamicOnly) {
        var getBodyCB = function(fixture) {
          if (!dynamicOnly || fixture.GetBody().GetType() != b2Body.b2_staticBody) {
            if (fixture.GetShape().TestPoint(fixture.GetBody().GetTransform(), mousePVec)) {
              selectedBody = fixture.GetBody();
              return false;
            }
          }
          return true;
        }

        var mousePVec = new b2Vec2(mouse.x, mouse.y);
        var aabb = new b2AABB();
        aabb.lowerBound.Set(mouse.x - 0.001, mouse.y - 0.001);
        aabb.upperBound.Set(mouse.x + 0.001, mouse.y + 0.001);
        selectedBody = null;
        world.QueryAABB(getBodyCB, aabb);
        return selectedBody;
      }

    },
    refresh: {
      /**
       * Обновляет тип тела для элемента.
       * @param element
       */
      bodyType: function(element) {
        var body = element.body;
        if (element.isStatic) {
          body.SetType(b2Body.b2_staticBody)
        } else {
          body.SetType(b2Body.b2_dynamicBody);
        }
      },
      scale: function(newScale) {
        
      }
      
    },
    isValid: {
      /**
       * @param val
       * @returns Допустимость x координаты в мире.
       */
      x: function(val) {
        return val >= 0 && val <= canvas.width / scale;
      },
      /**
       * @param val
       * @returns Допустимость y координаты в мире.
       */
      y: function(val) {
        return val >= 0 && val <= canvas.height / scale;
      }
    }
  };

  /**
   * @memberOf editor
   */
  var loop = {
    /**
     * Цикл симуляции.
     * @memberOf loop
     */
    process: function() {
      loop.step();
      loop.update();
      loop.draw();
      requestAnimFrame(loop.process);
    },
    step: function() {
      var stepRate = 1 / 60;
      world.Step(stepRate, 10, 10);
      world.ClearForces();
    },
    /**
     * Обновляет положения элементов. 
     */
    update: function() {
      for ( var b = world.GetBodyList(); b; b = b.m_next) {
        if (b.IsActive() && typeof b.GetUserData() !== 'undefined' && b.GetUserData() != null) {
          mechanism.shapeAt(b.GetUserData()).update(box2d.get.bodySpec(b));
        }
      }
      dashboard.currentState.value = mechanism.save();
    },
    draw: function() {
      if (debug) {
        world.DrawDebugData();
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      mechanism.draw();
    }
  };

  /**
   * @memberOf editor
   */
  var helpers = {
    /**
     * @memberOf helpers
     * @returns При каждом вызове число на 1 больше, начиная с нуля.
     */
    counter: (function() {
      var currentCount = 0;
      return function() {
        return currentCount++;
      };
    })(),
    randomColor: function() {
      var letters = '0123456789ABCDEF'.split(''), color = '#';
      for ( var i = 0; i < 6; i++) {
        color += letters[Math.round(Math.random() * 15)];
      }
      return color;
    },
    /**
     * @see http://js-tut.aardon.de/js-tut/tutorial/position.html
     * @param e
     * @returns Координаты html-элмента.
     */
    getElementPosition: function(e) {
      var element = e, tagname = "", x = 0, y = 0;

      while ((typeof (element) == "object") && (typeof (element.tagName) != "undefined")) {
        y += element.offsetTop;
        x += element.offsetLeft;
        tagname = element.tagName.toUpperCase();

        if (tagname == "BODY")
          element = 0;

        if (typeof (element) == "object") {
          if (typeof (element.offsetParent) == "object")
            element = element.offsetParent;
        }
      }

      return {
        x: x,
        y: y
      };
    }
  };
  /**
   * Создает новый Shape. Основа для всех фигур.
   * @memberOf editor
   * @constructor 
   */
  var Shape = function(options) {
    // автоинкремент
    this.id = helpers.counter();
    this.x = options.x || 0;
    this.y = options.y || 0;
    this.angle = options.angle || 0;
    this.color = helpers.randomColor();
    this.center = {
      x: null,
      y: null
    };
    this.isStatic = options.isStatic || false;

    /**
     * Обновляет положение фигуры.
     */
    this.update = function(options) {
      this.angle = options.angle;
      this.center = options.center;
      this.x = options.x;
      this.y = options.y;
    };

  };
  /**
   * Создаёт новый Edge.
   * @memberOf editor
   * @constructor
   */
  var Edge = function(options) {
    Shape.call(this, options);

    this.long = options.long || 1;
    this.draw = function() {
      ctx.save();
      ctx.translate(this.x * scale, this.y * scale);
      ctx.rotate(this.angle);
      ctx.translate(-(this.x) * scale, -(this.y) * scale);

      ctx.strokeStyle = this.color;

      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(this.x * scale, this.y * scale);
      ctx.lineTo(this.long * scale, this.y * scale);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    };
  };
  Edge.prototype = Object.create(Shape.prototype);
  /**
   * Создаёт новый Circle.
   * @memberOf editor
   * @constructor
   */
  var Circle = function(options) {
    Shape.call(this, options);
    this.radius = options.radius || 1;

    this.draw = function() {
      ctx.save();
      ctx.translate(this.x * scale, this.y * scale);
      ctx.rotate(this.angle);
      ctx.translate(-(this.x) * scale, -(this.y) * scale);

      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x * scale, this.y * scale, this.radius * scale, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
  };
  Circle.prototype = Object.create(Shape.prototype);
  /**
   * Создаёт новый Box.
   * @memberOf editor
   * @constructor
   */
  var Box = function(options) {
    Shape.call(this, options);
    this.width = options.width || 1;
    this.height = options.height || 1;

    this.draw = function() {
      ctx.save();
      ctx.translate(this.x * scale, this.y * scale);
      ctx.rotate(this.angle);
      ctx.translate(-(this.x) * scale, -(this.y) * scale);
      ctx.fillStyle = this.color;
      ctx.fillRect((this.x - (this.width / 2)) * scale, (this.y - (this.height / 2)) * scale, this.width * scale,
          this.height * scale);
      ctx.restore();
    };
  };
  Box.prototype = Object.create(Shape.prototype);

  /**
   * @memberOf editor
   */
  var mechanism = (function() {
    /**
     * @memberOf mechanism
     */
    var pointTypes = {
      fixed: 0,
      clockwiseFixed: 1,
      joint: 2
    };
    var edgeWidth = 0.5;
    var elements = [], selectedElements = [];
    var frozen = true;
    /**
     * Создаёт новый Element.
     * @memberOf mechanism
     * @constructor
     */
    var Element = function(options) {
      Shape.apply(this, arguments);
      this.body = options.body || null;
      this.isActive = options.isActive || false;
      elements.push(this);
    }

    Element.prototype = Object.create(Shape.prototype);

    Element.prototype.select = function() {
      if (selectedElements.indexOf(this) == -1) {
        selectedElements.push(this);
      }
    };
    Element.prototype.unselect = function() {
      var index = selectedElements.indexOf(this);
      selectedElements.splice(index, 1);
    };
    Element.prototype.isSelected = function() {
      return selectedElements.indexOf(this) != -1;
    };

    /**
     * @memberOf mechanism
     */
    var Point = function(options) {
      Element.apply(this, arguments);
      this.type = options.type || pointTypes.joint;
      this.radius = options.radius || 1;
      this.edges = [];
      // точка перемещается, потеряв все связи
      // с другими точками
      this.isFlying = false;
    };
    Point.prototype = Object.create(Element.prototype);
    Point.prototype.radius = 1;
    Point.prototype.setPosition = function(x, y) {
      this.x = x;
      this.y = y;
      this.body.SetPosition(new b2Vec2(x, y));
    };
    /**
     * Меняет тип точки
     */
    Point.prototype.setType = function(type) {
      if (type != this.type) {
        if (type == pointTypes.clockwiseFixed) {
          // добавляем вращение
         // var joint = new b2RevoluteJointDef();
         // joint.Initialize(this.body, this.body.GetWorldCenter());
         // world.CreateJoint(joint);
        } else if (this.type == pointTypes.clockwiseFixed) {
          // убираем вращение
          
        }
        
        this.type = type;
        this.isStatic = (type == pointTypes.fixed || type == pointTypes.clockwiseFixed);
        box2d.refresh.bodyType(this);
      }
    };

    var connectedPoints = [];

    /**
     * Удаляет рёбра, сохраняя точки, с которыми они соединены.
     */
    Point.prototype.beginFlying = function() {
      this.isFlying = true;
      connectedPoints = [];
      var edgesCopy = this.edges.slice();
      for ( var i in edgesCopy) {
        if (edgesCopy[i].p1 == this) {
          connectedPoints.push(edgesCopy[i].p2);
        } else {
          connectedPoints.push(edgesCopy[i].p1);
        }
        edgesCopy[i].destroy();
      }
      this.edges = [];
    };
    /**
     * Восстанавливает убранные рёбра.
     */
    Point.prototype.endFlying = function() {
      this.isFlying = false;
      for ( var i in connectedPoints) {
        createEdge(this, connectedPoints[i]);
      }
    }

    Point.prototype.destroy = function() {
      world.DestroyBody(this.body);
      var index = elements.indexOf(this);
      elements.splice(index, 1);
      var edgesCopy = this.edges.slice();
      for ( var i in edgesCopy) {
        edgesCopy[i].destroy();
      }
    };
    Point.prototype.draw = function() {
      ctx.save();
      ctx.translate(this.x * scale, this.y * scale);
      ctx.rotate(this.angle);
      ctx.translate(-(this.x) * scale, -(this.y) * scale);

      if (this.isSelected()) {
        ctx.fillStyle = colors.active;
      } else {
        ctx.fillStyle = colors.defaults;
      }

      ctx.beginPath();
      ctx.arc(this.x * scale, this.y * scale, this.radius * scale, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.fill();

      // опорная точка - рисуем треугольник
      if (this.type == pointTypes.fixed || this.type == pointTypes.clockwiseFixed) {
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(this.x * scale, this.y * scale);
        ctx.lineTo((this.x + this.radius) * scale, (this.y + this.radius) * scale);
        ctx.lineTo((this.x - this.radius) * scale, (this.y + this.radius) * scale);
        ctx.closePath();
        ctx.stroke();
      }      
      
      // точка вращается - рисуем дугу
      if (this.type == pointTypes.clockwiseFixed) {
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.x * scale, this.y * scale, this.radius * scale + 3, 0, Math.PI * 1.5, false);
        ctx.stroke();
      }     
      ctx.restore();
    };

    /**
     * @memberOf mechanism
     */
    var Edge = function(options) {
      Element.apply(this, arguments);
      this.p1 = options.p1;
      this.p2 = options.p2;
      this.p1.edges.push(this);
      this.p2.edges.push(this);
    };
    Edge.prototype = Object.create(Element.prototype);
    Edge.prototype.width = 0.2;
    /**
     * Удаляет себя из концевых точек. 
     */
    Edge.prototype.removeFromPoints = function() {
      var index = this.p1.edges.indexOf(this);
      this.p1.edges.splice(index, 1);
      index = this.p2.edges.indexOf(this);
      this.p2.edges.splice(index, 1);
    };
    Edge.prototype.getLength = function() {
      var pp = new paper.Point(this.p1.x + this.p2.x, this.p1.y + this.p2.y);
      return pp.length;
    };
    /**
     * Соединяет ребро с точкой.
     */
    Edge.prototype.joinToPoint = function(point) {
      var joint = new b2RevoluteJointDef();
      joint.Initialize(point.body, this.body, point.body.GetWorldCenter());
      world.CreateJoint(joint);
    };
    Edge.prototype.destroy = function() {
      world.DestroyBody(this.body);
      var index = elements.indexOf(this);
      elements.splice(index, 1);
      this.removeFromPoints();
    };
    Edge.prototype.draw = function() {
      ctx.save();
      ctx.translate(this.x * scale, this.y * scale);
      //ctx.rotate(this.angle);
      ctx.translate(-(this.x) * scale, -(this.y) * scale);

      if (this.isSelected()) {
        ctx.strokeStyle = colors.active;
      } else {
        ctx.strokeStyle = colors.defaults;
      }

      ctx.lineWidth = scale / 10 | 0; // целая часть
      ctx.beginPath();
      ctx.moveTo(this.p1.x * scale, this.p1.y * scale);
      ctx.lineTo(this.p2.x * scale, this.p2.y * scale);
      ctx.stroke();
      ctx.restore();
    };

    /**
     * Создаёт точку с заданными параметрами.
     * @memberOf mechanism
     */
    var createPoint = function(options) {
      options.radius = 1;
      var point = new Point(options);
      var body = box2d.addToWorld(point);
      point.body = body;
    };
    /**
     * Создает ребро между двумя точками.
     * @memberOf mechanism
     */
    var createEdge = function(p1, p2) {
      if (getEdgeBetweenPoints(p1, p2) || p1 == p2)
        return;

      var edge = new Edge({
        p1: p1,
        p2: p2
      });
      var body = box2d.addToWorld(edge);
      edge.body = body;

      edge.joinToPoint(p1);
      edge.joinToPoint(p2);
    };
    /**
     * Соединяет все точки рёбрами.
     * @memberOf mechanism
     */
    var connectPoints = function(points) {
      for (var i in points) {
        for (var j in points) {
          if (j > i) {
            createEdge(points[i],  points[j]);
          }
        }
      }
    }
    /**
     * @memberOf mechanism
     * @returns Элемент, связанный с телом.
     */
    var getElementOfBody = function(body) {
      if (body) {
        var element;
        for ( var i in elements) {
          if (elements[i].body == body) {
            element = elements[i];
            break;
          }
        }
        return element;
      }
    };
    /**
     * @memberOf mechanism
     * @returns Ребро между двумя точками.
     */
    var getEdgeBetweenPoints = function(p1, p2) {
      for ( var i in p1.edges) {
        if (p1.edges[i].p1 == p2 || p1.edges[i].p2 == p2)
          return p1.edges[i];
      }
    };
    /**
     * Показывает данные элемента на панели
     * @memberOf mechanism
     */
    var showInfo = function(element) {
      if (element instanceof Point) {
        dashboard.elementName.innerHTML = 'Точка';
        dashboard.edgeLength.style.display = "none";
        dashboard.edgePoints.style.display = "none";
        dashboard.pointType.style.display = "block";
        dashboard.pointX.style.display = "block";
        dashboard.pointY.style.display = "block";
        dashboard.pointX.value = element.x;
        dashboard.pointY.value = element.y;
        dashboard.pointType.selectedIndex = element.type;
      } else {
        dashboard.elementName.innerHTML = 'Ребро';
        dashboard.edgeLength.style.display = "block";
        dashboard.edgePoints.style.display = "block";
        dashboard.pointType.style.display = "none";
        dashboard.pointX.style.display = "none";
        dashboard.pointY.style.display = "none";
        dashboard.edgeLength.value = element.getLength();
        dashboard.edgePoints.value = element.p1.id + '   ' + element.p2.id;
      }
      dashboard.elementId.value = element.id;
    }

    var currentBody;

    return {
      /**
       * @memberOf mechanismReturn
       */
      /**
       * Обрабатывает событие mousedown.
       */
      onDown: function() {
        currentBody = box2d.get.bodyAtMouse();
        if (frozen && currentBody) {
          var element = getElementOfBody(currentBody);
          if (element) {
            if (element instanceof Point || element instanceof Edge) {
              if (!element.isSelected()) {
                if (!mouse.isCtrl) {
                  // убираем выделение со всех элементовэ
                  selectedElements = [];
                }
                
                element.select();

                if (selectedElements.length == 2 && selectedElements[0] instanceof Point
                && selectedElements[1] instanceof Point) {
                  connectPoints(selectedElements);      
                }                

                element.isActive = true;
              }
              showInfo(element);
            }
          }
        }
      },
      /**
       * Обрабатывает событие mouseup.
       */
      onUp: function() {
        if (frozen && currentBody) {
          var element = getElementOfBody(currentBody);
          if (element) {
            if (element instanceof Point) {
              if (element.isSelected() && !element.isActive) {
                // снимаем выделение
                element.unselect();
              }
              element.isActive = false;
              if (element.isFlying) {
                // восстанавливаем ребра
                element.endFlying();
              }
            }
          }
        }
      },
      /**
       * Обрабатывает событие click.
       */
      onClick: function() {
        if (frozen && !currentBody) {
          // клик по пустому месту - добавляем точку
          createPoint({
            x: mouse.x,
            y: mouse.y
          });
          selectedElements = [];
        }
      },
      /**
       * Обрабатывает событие mousemove.
       */
      onMove: function() {
        if (frozen && mouse.isDown) {
          if (currentBody) {
            var element = getElementOfBody(currentBody);
            if (element) {
              if (element instanceof Point) {
                if (!mouse.isCtrl && !element.isFlying) {
                  // убираем рёбра
                  element.beginFlying();
                }

                // двигаем точку
                element.setPosition(mouse.x, mouse.y);
              }
              element.isActive = true;
              showInfo(element);
            }
          }
        }
      },
      /**
       * Обрабатывает нажатие delete.
       */
      onDelete: function() {
        if (frozen && selectedElements[0]) {
          // удаляем все выбранные элементы
          for ( var i in selectedElements) {
            selectedElements[i].destroy();
          }
          selectedElements = [];
        }
      },
      /**
       * Устанавливает значение параметра точки для последнего выбранного тела.
       * @param what Какой параметр менять.
       * @param value Значение параметра.
       */
      setPoint: function(what, value) {
        var element = getElementOfBody(currentBody);
        if (element) {
          if (element instanceof Point) {
            if (what == 'type') {
              element.setType(value);
            } else {
              var newX = element.x, newY = element.y;
              if (what == 'x' && box2d.isValid.x(value)) {
                newX = value
              } else if (what == 'y' && box2d.isValid.y(value)) {
                newY = value;
              }
              
              element.setPosition(newX, newY);
            }
          }
        }
      },
      /**
       * Отрисовывает все элементы.
       */
      draw: function() {
        for ( var i in elements) {
          elements[i].draw();
        }
      },
      Point: Point,
      Edge: Edge,
      /**
       * @param id
       * @returns элемент с указанным id.
       */
      shapeAt: function(id) {
        for ( var i in elements) {
          if (elements[i].id == id) {
            return elements[i];
          }
        }
      },
      /**
       * Запускает симуляцию.
       */
      start: function() {
        frozen = false;
        world.SetGravity(new b2Vec2(0, 2));
      },
      /**
       * Останавливает симуляцию.
       */
      pause: function() {
        frozen = true;
        world.SetGravity(new b2Vec2(0, 0));
        for ( var i in elements) {
          elements[i].body.SetLinearVelocity(new b2Vec2(0, 0));
        }
      },
      /**
       * Загружает механизм из строки.
       */ 
      load: function(newState) {
        
      },
      save: function() {
        var json = "";
        return json;
      }

    };
  })();

  init.start('canvas');
})();
