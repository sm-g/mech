/**
 * @author smg
 */
/**
 * @module mechanism
 */
var mechanism = (function() {
  var b2Vec2 = Box2D.Common.Math.b2Vec2, b2AABB = Box2D.Collision.b2AABB, b2BodyDef = Box2D.Dynamics.b2BodyDef, b2Body = Box2D.Dynamics.b2Body, b2FixtureDef = Box2D.Dynamics.b2FixtureDef, b2World = Box2D.Dynamics.b2World, b2ContactFilter = Box2D.Dynamics.b2ContactFilter, b2MassData = Box2D.Collision.Shapes.b2MassData, b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape, b2CircleShape = Box2D.Collision.Shapes.b2CircleShape, b2DebugDraw = Box2D.Dynamics.b2DebugDraw, b2MouseJointDef = Box2D.Dynamics.Joints.b2MouseJointDef, b2RevoluteJointDef = Box2D.Dynamics.Joints.b2RevoluteJointDef;
  var ctx;
  
  /**
   * @memberOf mechanism
   */
  var pointTypes = {
    fixed : 0,
    clockwiseFixed : 1,
    joint : 2
  };
  var hasNewElements = false, drawLabels = false;
  var elements = [], selectedElements = [];
  var currentBody;
  
  /**
   * Цветовая схема.
   * 
   * @memberOf mechanism
   */
  var colors = {
    /**
     * @memberOf colors
     */
    active : '#fc6e06',
    defaults : '#555',
    back : '#fff',
    labels : '#05f',
    shadow : 'fff'
  };
  
  /**
   * Создает новый Shape. Основа для всех фигур.
   * 
   * @memberOf mechanism
   * @constructor
   */
  var Shape = function(options) {
    // автоинкремент
    this.id = options.id || helpers.counter();
    this.x = options.x || 0;
    this.y = options.y || 0;
    this.angle = options.angle || 0;
    this.color = helpers.randomColor();
    this.center = {
      x : null,
      y : null
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
   * Создаёт новый Element.
   * 
   * @memberOf mechanism
   * @constructor
   */
  var Element = function(options) {
    Shape.apply(this, arguments);
    this.body = options.body || null;
    this.isActive = options.isActive || false; // mouse down and move
    elements.push(this);
  };
  
  Element.prototype = Object.create(Shape.prototype);
  
  Element.prototype.getColorBySelection = function() {
    if (this.isSelected()) {
      return colors.active;
    } else {
      return colors.defaults;
    }
  };
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
  
  Element.prototype.isPoint = function() {
    return isPoint(this);
  };
  Element.prototype.isEdge = function() {
    return isEdge(this);
  };
  /**
   * Соединяет два элемента шарнирной связью.
   */
  Element.prototype.join = function(element, makeMotor) {
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
  Element.prototype.removeJoints = function() {
    var bodiesToJoin = [];
    for (var j = this.body.GetJointList(); j; j = this.body.GetJointList()) {
      bodiesToJoin.push({
        a : getElementOfBody(j.joint.m_bodyA),
        b : getElementOfBody(j.joint.m_bodyB)
      });
      
      box2d.get.world().DestroyJoint(j.joint);
    }
    return bodiesToJoin;
  };
  /**
   * @memberOf mechanism
   */
  var Point = function(options) {
    Element.apply(this, arguments);
    this.type = options.type || pointTypes.joint;
    this.isStatic = (this.type != pointTypes.joint);
    this.radius = options.radius || 1;
    this.edges = [];
    // точка перемещается, потеряв связи с другими точками
    this.isFlying = false;
    hasNewElements = true;
  };
  Point.prototype = Object.create(Element.prototype);
  Point.prototype.toString = function() {
    var edgesStr = this.edges.map(function(edge) {
      return edge.id;
    }).join();
    return [ this.id, 'p', this.x.toFixed(3), this.y.toFixed(3), this.type,
        edgesStr ].join();
  };
  Point.prototype.setPosition = function(x, y) {
    this.x = x;
    this.y = y;
    this.body.SetPosition(new b2Vec2(x, y));
    hasNewElements = true;
  };
  /**
   * Меняет тип точки
   */
  Point.prototype.setType = function(type) {
    if (type != this.type) {
      if (type == pointTypes.clockwiseFixed) {
        var toJoin = this.removeJoints();
        for ( var i in toJoin) {
          toJoin[i].a.join(toJoin[i].b, true);
        }
      } else if (this.type == pointTypes.clockwiseFixed) {
        var toJoin = this.removeJoints();
        this.body.SetAngle(0);
        for ( var i in toJoin) {
          toJoin[i].a.join(toJoin[i].b, false);
        }
      }
      
      this.type = type;
      this.isStatic = (type != pointTypes.joint);
      box2d.refresh.bodyType(this);
      hasNewElements = true;
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
  };
  
  Point.prototype.destroy = function() {
    box2d.get.world().DestroyBody(this.body);
    var index = elements.indexOf(this);
    elements.splice(index, 1);
    var edgesCopy = this.edges.slice();
    for ( var i in edgesCopy) {
      edgesCopy[i].destroy();
    }
    hasNewElements = true;
  };
  Point.prototype.draw = function() {
    var x = this.x * scale;
    var y = this.y * scale;
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.angle);
    ctx.translate(-x, -y);
    
    // опорная точка - рисуем треугольник
    if (this.type == pointTypes.fixed || this.type == pointTypes.clockwiseFixed) {
      ctx.strokeStyle = this.getColorBySelection();
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx
          .lineTo((this.x + this.radius) * scale, (this.y + this.radius)
              * scale);
      ctx
          .lineTo((this.x - this.radius) * scale, (this.y + this.radius)
              * scale);
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
    if (this.type == pointTypes.clockwiseFixed) {
      ctx.strokeStyle = this.getColorBySelection();
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, this.radius * scale + 3, 0, Math.PI * 1.5, false);
      ctx.stroke();
    }
    
    if (drawLabels) {
      ctx.fillStyle = colors.labels;
      ctx.font = "10pt Arial";
      ctx.fillText(this.id, (this.x - this.radius) * scale,
          (this.y - this.radius) * scale);
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
    hasNewElements = true;
  };
  Edge.prototype = Object.create(Element.prototype);
  Edge.prototype.toString = function() {
    return [ this.id, 'e', this.p1.id, this.p2.id ].join();
  };
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
    var pp = new paper.Point(this.p1.x - this.p2.x, this.p1.y - this.p2.y);
    return pp.length;
  };
  Edge.prototype.destroy = function() {
    box2d.get.world().DestroyBody(this.body);
    var index = elements.indexOf(this);
    elements.splice(index, 1);
    this.removeFromPoints();
    hasNewElements = true;
  };
  Edge.prototype.draw = function() {
    var x = this.x * scale;
    var y = this.y * scale;
    ctx.save();
    
    if (this.isSelected()) {
      ctx.strokeStyle = colors.active;
    } else {
      ctx.strokeStyle = colors.defaults;
    }
    
    ctx.lineWidth = scale / 2 | 0;
    // целая часть
    ctx.beginPath();
    ctx.moveTo(this.p1.x * scale, this.p1.y * scale);
    ctx.lineTo(this.p2.x * scale, this.p2.y * scale);
    ctx.stroke();
    ctx.restore();
    
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
   * @memberOf mechanism
   */
  var isPoint = function(element) {
    return element instanceof Point;
  };
  /**
   * @memberOf mechanism
   */
  var isEdge = function(element) {
    return element instanceof Edge;
  };
  /**
   * @memberOf mechanism
   */
  var getPoints = function() {
    return elements.filter(isPoint);
  };
  /**
   * @memberOf mechanism
   */
  var getEdges = function() {
    return elements.filter(isEdge);
  };
  /**
   * Создаёт точку с заданными параметрами.
   * 
   * @memberOf mechanism
   * @returns Новая точка
   */
  var createPoint = function(options) {
    options.radius = 1;
    var point = new Point(options);
    var body = box2d.addToWorld(point);
    point.body = body;
    return point;
  };
  /**
   * Создает ребро между двумя точками.
   * 
   * @memberOf mechanism
   * @returns Новое ребро между точками (если создано)
   */
  var createEdge = function(p1, p2, id) {
    if (getEdgeBetweenPoints(p1, p2) || p1 == p2)
      return;
    
    var edge = new Edge({
      p1 : p1,
      p2 : p2,
      id : id || 0
    });
    var body = box2d.addToWorld(edge);
    edge.body = body;
    
    edge.join(p1, p1.type == pointTypes.clockwiseFixed);
    edge.join(p2, p2.type == pointTypes.clockwiseFixed);
    return edge;
  };
  /**
   * Соединяет точки рёбрами в контур.
   * 
   * @memberOf mechanism
   */
  var connectPoints = function(points) {
    points.reduce(function(prevP, curP) {
      createEdge(prevP, curP);
      return curP;
    });
    createEdge(points[0], points[points.length - 1]);
  };
  /**
   * @memberOf mechanism
   * @returns Элемент, связанный с телом.
   */
  var getElementOfBody = function(body) {
    if (body) {
      var id = body.GetUserData();
      return mechanism.getElement(id);
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
   * Убирает выделение со всех элементов.
   * 
   * @memberOf mechanism
   */
  var unselectAll = function() {
    selectedElements = [];
  };
  
  var ret = {
    /**
     * @memberOf mechanismReturn
     */
    handlers : {
      /**
       * Обрабатывает событие mousedown.
       * 
       * @return element to show info
       * @memberOf handlers
       */
      onDown : function(mouse) {
        currentBody = box2d.get.bodyAtMouse(mouse);
        if (box2d.get.world().paused && currentBody) {
          var element = getElementOfBody(currentBody);
          if (element && !element.isSelected()) {
            if (!mouse.isCtrl) {
              unselectAll();
            }
            
            element.select();
            // соединяем две выделенные точки
            if (selectedElements.length == 2 && selectedElements[0].isPoint()
                && selectedElements[1].isPoint()) {
              connectPoints(selectedElements);
            }
            
            element.isActive = true;
          }
          return element;
        }
      },
      /**
       * Обрабатывает событие mouseup.
       * 
       * @return element to show info
       */
      onUp : function(mouse) {
        if (box2d.get.world().paused && currentBody) {
          var point = getElementOfBody(currentBody);
          if (point && point.isPoint()) {
            if (point.isSelected() && !point.isActive) {
              // снимаем выделение
              point.unselect();
              // show last sel
              return selectedElements[selectedElements.length - 1];
            } else {
              point.isActive = false;
              if (point.isFlying) {
                // восстанавливаем ребра
                point.endFlying();
              }
              return point;
            }
          }
        }
      },
      /**
       * Обрабатывает событие click.
       * 
       * @return newPoint or null
       */
      onClick : function(mouse) {
        if (box2d.get.world().paused && !currentBody) {
          if (selectedElements.length < 2) {
            unselectAll();
            var newPoint = createPoint({
              x : mouse.x,
              y : mouse.y
            })
            newPoint.select();
            return newPoint;
          } else {
            // просто снимаем выделение, если было выделено более 1
            // элемента
            unselectAll();
          }
        }
      },
      /**
       * Обрабатывает событие mousemove.
       */
      onMove : function(mouse) {
        if (box2d.get.world().paused && mouse.isDown) {
          if (currentBody) {
            var element = getElementOfBody(currentBody);
            if (element.isPoint()) {
              if (!mouse.isCtrl && !element.isFlying) {
                // убираем рёбра
                element.beginFlying();
              }
              
              // двигаем точку
              element.setPosition(mouse.x, mouse.y);
            }
            element.isActive = true;
            return element;
          }
        }
      },
      /**
       * Обрабатывает нажатие delete.
       */
      onDelete : function() {
        if (box2d.get.world().paused && selectedElements[0]) {
          // удаляем все выбранные элементы
          for ( var i in selectedElements) {
            selectedElements[i].destroy();
          }
          unselectAll();
        }
      },
      onAKeyUp : function() {
        if (box2d.get.world().paused) {
          mechanism.connectPoints(selectedElements.filter(isPoint));
        }
      }
    },
    /**
     * Устанавливает значение параметра точки для последнего выбранного тела.
     * 
     * @param what
     *          Какой параметр менять.
     * @param value
     *          Значение параметра.
     * @memberOf mechanismReturn
     */
    setPoint : function(what, value) {
      var element = selectedElements.pop();
      if (element) {
        selectedElements.push(element);
        if (element.isPoint()) {
          if (what == 'type') {
            element.setType(value);
          } else {
            var newX = element.x, newY = element.y;
            if (what == 'x' && box2d.isValid.x(value)) {
              newX = value;
            } else if (what == 'y' && box2d.isValid.y(value)) {
              newY = value;
            }
            
            element.beginFlying();
            element.setPosition(newX, newY);
            element.endFlying();
          }
        }
      }
    },
    /**
     * Отрисовывает все элементы.
     */
    draw : function() {
      var edges = getEdges();
      for ( var i in edges) {
        edges[i].draw();
      }
      for ( var i in getPoints()) {
        getPoints()[i].draw();
      }
    },
    /**
     * Устанавливает показ надписей к элементам.
     */
    setLabels : function(value) {
      drawLabels = value;
    },
    /**
     * Устанавливает контекст рисования.
     */
    setContext : function(context) {
      ctx = context;
    },
    Point : Point,
    Edge : Edge,
    /**
     * @param id
     * @returns элемент с указанным id.
     */
    getElement : function(id) {
      for ( var i in elements) {
        if (elements[i].id == id) {
          return elements[i];
        }
      }
    },
    selectElement : function(id) {
      var element = mechanism.getElement(id);
      unselectAll();
      if (element) {
        element.select();
      }
      return element;
    },
    /**
     * Запускает симуляцию.
     */
    start : function() {

    },
    /**
     * Приостанавливает симуляцию.
     */
    pause : function() {

    },
    /**
     * Останавливает симуляцию, сбрасывает позиции элементов.
     */
    stop : function() {
      for ( var i in elements) {
        elements[i].body.SetLinearVelocity(new b2Vec2(0, 0));
      }      
    },
    /**
     * @returns Требуется ли обновить текущее состояние.
     */
    isNew : function() {
      if (hasNewElements) {
        hasNewElements = false;
        return true;
      }
    },
    /**
     * Удаляет все элементы.
     */
    clear : function() {
      unselectAll();
      var points = getPoints();
      for ( var i in points) {
        points[i].destroy();
      }
    },
    /**
     * Загружает механизм из строки.
     */
    load : function(newState) {
      mechanism.clear();
      
      try {
        var elementsStr = newState.split('\n');
        var elementsDefs = [];
        var lastId = -1;
        for ( var i in elementsStr) {
          elementsDefs.push(elementsStr[i].split(','));
        }
        
        for (i in elementsDefs) {
          if (elementsDefs[i][0] == '') {
            // пропускаем пустые строки
            continue;
          }
          if (lastId < +elementsDefs[i][0]) {
            lastId = +elementsDefs[i][0];
          }
          if (elementsDefs[i][1] == 'p') {
            // сначала добавляем точки
            // [this.id, 'p', this.x.toFixed(3), this.y.toFixed(3),
            // this.type,
            // edgesStr]
            createPoint({
              id : +elementsDefs[i][0],
              x : +elementsDefs[i][2],
              y : +elementsDefs[i][3]
            }).setType(elementsDefs[i][4]);
          }
        }
        for (i in elementsDefs) {
          if (elementsDefs[i][1] == 'e') {
            // добавляем рёбра между точками
            // [this.id, 'e', this.p1.id, this.p2.id]
            createEdge(mechanism.getElement(+elementsDefs[i][2]), mechanism
                .getElement(+elementsDefs[i][3]), +elementsDefs[i][0]);
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
    save : function() {
      var str = '';
      for ( var i in elements) {
        str += elements[i].toString() + '\n';
      }
      
      return str;
    }
  };
  
  return ret;
})();
