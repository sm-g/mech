/**
 * @module editor
 */
var editor = (function() {
  // box2d aliases
  var b2Vec2 = Box2D.Common.Math.b2Vec2, b2AABB = Box2D.Collision.b2AABB, b2BodyDef = Box2D.Dynamics.b2BodyDef, b2Body = Box2D.Dynamics.b2Body, b2FixtureDef = Box2D.Dynamics.b2FixtureDef, b2Fixture = Box2D.Dynamics.b2Fixture, b2World = Box2D.Dynamics.b2World, b2ContactFilter = Box2D.Dynamics.b2ContactFilter, b2MassData = Box2D.Collision.Shapes.b2MassData, b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape, b2CircleShape = Box2D.Collision.Shapes.b2CircleShape, b2DebugDraw = Box2D.Dynamics.b2DebugDraw, b2MouseJointDef = Box2D.Dynamics.Joints.b2MouseJointDef, b2RevoluteJointDef = Box2D.Dynamics.Joints.b2RevoluteJointDef;

  window.requestAnimFrame = (function() {
    return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame
        || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function(callback, element) {
          window.setTimeout(callback, 1000 / 60);
        };
  })();

  // режим отладки
  var debug = false;

  var scale, canvas, ctx, world;
  /**
   * Кнопки управления симуляцией.
   * 
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
   * 
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
   * 
   * @memberOf editor
   */
  var colors = {
    /**
     * @memberOf colors
     */
    active: '#fc6e06',
    defaults: '#555',
    back: '#fff'
  }
  /**
   * Состояние мыши.
   * 
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
   * Показывает данные элемента на панели
   * 
   * @memberOf editor
   */
  var showInfo = function(element) {
    if (!element) {
      dashboard.elementId.value = '';
      dashboard.pointX.value = '';
      dashboard.pointY.value = '';
      dashboard.edgeLength.value = '';
      dashboard.edgePoints.value = '';
      return;
    }
    if (element instanceof mechanism.Point) {
      dashboard.elementName.innerHTML = 'Пара';
      dashboard.edgeLength.style.display = "none";
      dashboard.edgePoints.style.display = "none";
      dashboard.pointType.style.display = "block";
      dashboard.pointX.style.display = "block";
      dashboard.pointY.style.display = "block";
      dashboard.pointX.value = element.x.toFixed(3);
      dashboard.pointY.value = element.y.toFixed(3);
      dashboard.pointType.selectedIndex = element.type;
    } else if (element instanceof mechanism.Edge) {
      dashboard.elementName.innerHTML = 'Звено';
      dashboard.edgeLength.style.display = "block";
      dashboard.edgePoints.style.display = "block";
      dashboard.pointType.style.display = "none";
      dashboard.pointX.style.display = "none";
      dashboard.pointY.style.display = "none";
      dashboard.edgeLength.value = element.getLength().toFixed(3);
      dashboard.edgePoints.value = element.p1.id + '   ' + element.p2.id;
    }
    dashboard.elementId.value = element.id;
  }

  /**
   * Инициализатор редактора.
   * 
   * @memberOf editor
   */
  var init = {
    /**
     * @memberOf init
     */
    start: function() {
      canvas = document.getElementById("canvas");
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
      scale = controls.scale.value || 20;

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

      controls.stop.addEventListener('click', function(e) {
        mechanism.stop();
      }, false);

      controls.load.addEventListener('click', function(e) {
        mechanism.load(dashboard.currentState.value);
      }, false);

      dashboard.elementId.addEventListener('input', function(e) {
        mechanism.selectElement(+e.target.value);
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
        A: 65
      }

      document.onkeyup = function key(e) {
        switch (e.keyCode) {
          case keyCodes.DEL:
            mechanism.onDelete();
            break;
          case keyCodes.A:
            mechanism.onAKeyUp();
            break;
        }
      }
    }
  };

  /**
   * @memberOf editor
   */
  var box2d = (function() {
    var fixDef;

    return {
      /**
       * Добавляет в мир тело для соответствующей фигуры.
       * 
       * @memberOf box2d
       * @param shape
       * @returns Созданное тело.
       */
      addToWorld: function(shape) {
        var bodyDef = this.create.bodyDef(shape);

        if (shape instanceof mechanism.Point) {
          fixDef.shape = new b2CircleShape(shape.radius);
        } else if (shape instanceof mechanism.Edge) {
          fixDef.shape = new b2PolygonShape;
          // ребро в виде узкого ромба
          var middleP = new paper.Point((shape.p1.x + shape.p2.x) / 2, (shape.p1.y + shape.p2.y) / 2);
          var paperPoint = new paper.Point(shape.p1.x - shape.p2.x, shape.p1.y - shape.p2.y).normalize(shape.width);
          var pp1 = paperPoint.rotate(90);
          var pp2 = paperPoint.rotate(-90);
          fixDef.shape.SetAsArray([new b2Vec2(shape.p1.x - middleP.x, shape.p1.y - middleP.y),
              new b2Vec2(pp1.x, pp1.y), new b2Vec2(shape.p2.x - middleP.x, shape.p2.y - middleP.y),
              new b2Vec2(pp2.x, pp2.y)]);

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
         * 
         * @memberOf create
         */
        world: function() {
          world = new b2World(new b2Vec2(0, 0), false);
          world.paused = true;
          var filter = new b2ContactFilter();
          /**
           * @returns Должны ли сталкиваться два fixture. Сталкиваются
           *          соединённые ребро и точка.
           */
          filter.ShouldCollide = function(fixtureA, fixtureB) {
            var e1 = mechanism.getElement(fixtureA.GetBody().GetUserData());
            var e2 = mechanism.getElement(fixtureB.GetBody().GetUserData());

            if (e1 instanceof mechanism.Edge) {
              var edge = e1;
              if (e2 instanceof mechanism.Point) {
                var point = e2;
              }
            } else if (e2 instanceof mechanism.Edge) {
              var edge = e2;
              if (e1 instanceof mechanism.Point) {
                var point = e1;
              }
            }
            if (point && edge) {
              return point.edges.indexOf(edge) != -1;
            }

            return false;
          }

          world.SetContactFilter(filter);

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
         * Настраивает физику тел по умолчанию.
         */
        defaultFixture: function() {
          fixDef = new b2FixtureDef;
          fixDef.density = 5.0; // плотность
          fixDef.friction = 0; // трение
          fixDef.restitution = 0; // упругость
        },
        /**
         * Создает body definition для фигуры.
         * 
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
         * @param dynamicOnly
         *          Флаг поиска только нестатических тел.
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
          var selectedBody = null;
          world.QueryAABB(getBodyCB, aabb);
          return selectedBody;
        }

      },
      refresh: {
        /**
         * Обновляет тип тела для элемента.
         * 
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
    }
  })();

  /**
   * @memberOf editor
   */
  var loop = (function() {
    var stepRate = 0;
    var area = document.getElementById("area");
    return {
      /**
       * Цикл симуляции.
       * 
       * @memberOf loop
       */
      process: function() {
        loop.step();
        loop.update();
        loop.draw();
        requestAnimFrame(loop.process);
      },
      step: function() {
        world.Step(stepRate, 10, 10);
        world.ClearForces();
      },
      /**
       * Обновляет положения элементов.
       */
      update: function() {
        canvas.height = area.clientHeight;
        canvas.width = area.clientWidth;
        for ( var b = world.GetBodyList(); b; b = b.m_next) {
          var id = b.GetUserData();
          if (b.IsActive() && typeof id !== 'undefined' && id != null && id > -1) {
            mechanism.getElement(id).update(box2d.get.bodySpec(b));
          }
        }
        if (mechanism.isNew()) {
          dashboard.currentState.value = mechanism.save();
        }
      },
      draw: function() {
        if (debug) {
          world.DrawDebugData();
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        mechanism.draw();
      },
      setSimulate: function(go) {
        if (go) {
          stepRate = 1 / 60;
        } else {
          stepRate = 0;
        }
      }
    }
  })();

  /**
   * @memberOf editor
   */
  var helpers = (function() {
    var currentCount = 1;
    return {
      /**
       * @memberOf helpers
       * @returns При каждом вызове число на 1 больше, начиная с 1.
       */
      counter: (function() {
        return function() {
          return currentCount++;
        };
      })(),
      /**
       * Устанавливает значение счётчика, выдаемое при следующем вызове
       * counter().
       */
      setCounter: function(val) {
        currentCount = val;
      },
      randomColor: function() {
        var letters = '0123456789ABCDEF'.split(''), color = '#';
        for ( var i = 0; i < 6; i++) {
          color += letters[Math.round(Math.random() * 15)];
        }
        return color;
      },
      /**
       * @see http://js-tut.aardon.de/js-tut/tutorial/position.html
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
    }
  })();
  /**
   * Создает новый Shape. Основа для всех фигур.
   * 
   * @memberOf editor
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
    var hasNewElements = false;
    var elements = [], selectedElements = [];

    /**
     * Создаёт новый Element.
     * 
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
        showInfo(this);
      }
    };
    Element.prototype.unselect = function() {
      var index = selectedElements.indexOf(this);
      selectedElements.splice(index, 1);
      showLastSelectedInfo();
    };
    Element.prototype.isSelected = function() {
      return selectedElements.indexOf(this) != -1;
    };

    Element.prototype.isPoint = function() {
      return isPoint(this);
    }
    Element.prototype.isEdge = function() {
      return isEdge(this);
    }
    /**
     * Соединяет два элемента шарнирной связью.
     */
    Element.prototype.join = function(element, makeMotor) {
      var joint = new b2RevoluteJointDef();
      if (makeMotor) {
        joint.maxMotorTorque = 2000;
        joint.motorSpeed = 2000;
        joint.enableMotor = true;
      }
      if (this.isEdge()) {
        joint.Initialize(element.body, this.body, element.body.GetWorldCenter());
      } else {
        joint.Initialize(element.body, this.body, this.body.GetWorldCenter());
      }
      world.CreateJoint(joint);
    };
    /**
     * Удаляет все соединения с другими элементами.
     * 
     * @returns {Array} Пары тел, которые были соединены
     */
    Element.prototype.removeJoints = function() {
      var bodiesToJoin = [];
      for ( var j = this.body.GetJointList(); j; j = this.body.GetJointList()) {
        bodiesToJoin.push({
          a: getElementOfBody(j.joint.m_bodyA),
          b: getElementOfBody(j.joint.m_bodyB)
        });

        world.DestroyJoint(j.joint);
      }
      return bodiesToJoin;
    }

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
        return edge.id
      }).join();
      return [this.id, 'p', this.x.toFixed(3), this.y.toFixed(3), this.type, edgesStr].join();
    }
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
    }

    Point.prototype.destroy = function() {
      world.DestroyBody(this.body);
      var index = elements.indexOf(this);
      elements.splice(index, 1);
      var edgesCopy = this.edges.slice();
      for ( var i in edgesCopy) {
        edgesCopy[i].destroy();
      }
      hasNewElements = true;
    };
    Point.prototype.draw = function() {
      ctx.save();
      ctx.translate(this.x * scale, this.y * scale);
      ctx.rotate(this.angle);
      ctx.translate(-(this.x) * scale, -(this.y) * scale);

      // опорная точка - рисуем треугольник
      if (this.type == pointTypes.fixed || this.type == pointTypes.clockwiseFixed) {
        ctx.strokeStyle = this.getColorBySelection();
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(this.x * scale, this.y * scale);
        ctx.lineTo((this.x + this.radius) * scale, (this.y + this.radius) * scale);
        ctx.lineTo((this.x - this.radius) * scale, (this.y + this.radius) * scale);
        ctx.closePath();
        ctx.stroke();
      }

      // окружность
      ctx.fillStyle = this.getColorBySelection();
      ctx.beginPath();
      ctx.arc(this.x * scale, this.y * scale, this.radius * scale, 0, Math.PI * 2, false);
      ctx.closePath();
      ctx.fill();

      // фон
      ctx.fillStyle = colors.back;
      ctx.beginPath();
      ctx.arc(this.x * scale, this.y * scale, this.radius * scale * 0.5, 0, Math.PI * 2, false);
      ctx.closePath();
      ctx.fill();

      // точка вращается - рисуем дугу
      if (this.type == pointTypes.clockwiseFixed) {
        ctx.strokeStyle = this.getColorBySelection();
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
      hasNewElements = true;
    };
    Edge.prototype = Object.create(Element.prototype);
    Edge.prototype.toString = function() {
      return [this.id, 'e', this.p1.id, this.p2.id].join();
    }
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
    Edge.prototype.destroy = function() {
      world.DestroyBody(this.body);
      var index = elements.indexOf(this);
      elements.splice(index, 1);
      this.removeFromPoints();
      hasNewElements = true;
    };
    Edge.prototype.draw = function() {
      ctx.save();
      ctx.translate(this.x * scale, this.y * scale);
      ctx.translate(-(this.x) * scale, -(this.y) * scale);

      if (this.isSelected()) {
        ctx.strokeStyle = colors.active;
      } else {
        ctx.strokeStyle = colors.defaults;
      }

      ctx.lineWidth = scale / 2 | 0; // целая часть
      ctx.beginPath();
      ctx.moveTo(this.p1.x * scale, this.p1.y * scale);
      ctx.lineTo(this.p2.x * scale, this.p2.y * scale);
      ctx.stroke();
      ctx.restore();
    };

    /**
     * @memberOf mechanism
     */
    var isPoint = function(element) {
      return element instanceof Point;
    }
    /**
     * @memberOf mechanism
     */
    var isEdge = function(element) {
      return element instanceof Edge;
    }
    /**
     * @memberOf mechanism
     */
    var getPoints = function() {
      return elements.filter(isPoint);
    }
    /**
     * @memberOf mechanism
     */
    var getEdges = function() {
      return elements.filter(isEdge);
    }
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
        p1: p1,
        p2: p2,
        id: id || 0
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
    }
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
     * Показывает данные для последнего элемента в списке выделенных.
     * 
     * @memberOf mechanism
     */
    var showLastSelectedInfo = function() {
      var element = selectedElements.pop();
      showInfo(element);
      if (element) {
        selectedElements.push(element);
      }
    };
    /**
     * Убирает выделение со всех элементов.
     * 
     * @memberOf mechanism
     */
    var unselectAll = function() {
      selectedElements = [];
      showInfo();
    };

    var currentBody;

    return {
      /**
       * Обрабатывает событие mousedown.
       * 
       * @memberOf mechanismReturn
       */
      onDown: function() {
        currentBody = box2d.get.bodyAtMouse();
        if (world.paused && currentBody) {
          var element = getElementOfBody(currentBody);
          if (element && !element.isSelected()) {
            if (!mouse.isCtrl) {
              unselectAll();
            }

            element.select();

            // соединяем две выделенные точки
            if (selectedElements.length == 2 && selectedElements[0].isPoint() && selectedElements[1].isPoint()) {
              connectPoints(selectedElements);
            }

            element.isActive = true;
          }
        }
      },
      /**
       * Обрабатывает событие mouseup.
       */
      onUp: function() {
        if (world.paused && currentBody) {
          var element = getElementOfBody(currentBody);
          if (element && element.isPoint()) {
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
      },
      /**
       * Обрабатывает событие click.
       */
      onClick: function() {
        if (world.paused && !currentBody) {
          if (selectedElements.length < 2) {
            unselectAll();
            createPoint({
              x: mouse.x,
              y: mouse.y
            }).select();
          } else {
            // просто снимаем выделение, если было выделено более 1 элемента
            unselectAll();
          }
        }
      },
      /**
       * Обрабатывает событие mousemove.
       */
      onMove: function() {
        if (world.paused && mouse.isDown) {
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
            showInfo(element);
          }
        }
      },
      /**
       * Обрабатывает нажатие delete.
       */
      onDelete: function() {
        if (world.paused && selectedElements[0]) {
          // удаляем все выбранные элементы
          for ( var i in selectedElements) {
            selectedElements[i].destroy();
          }
          unselectAll();
        }
      },
      onAKeyUp: function() {
        if (world.paused) {
          connectPoints(selectedElements.filter(isPoint));
        }
      },
      /**
       * Устанавливает значение параметра точки для последнего выбранного тела.
       * 
       * @param what
       *          Какой параметр менять.
       * @param value
       *          Значение параметра.
       */
      setPoint: function(what, value) {
        var element = selectedElements.pop();
        if (element) {
          selectedElements.push(element);
          if (element.isPoint()) {
            if (what == 'type') {
              element.setType(value);
            } else {
              var newX = element.x, newY = element.y;
              if (what == 'x' && box2d.isValid.x(value)) {
                newX = value
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
      draw: function() {
        var edges = getEdges();
        for ( var i in edges) {
          edges[i].draw();
        }
        for ( var i in getPoints()) {
          getPoints()[i].draw();
        }
      },
      Point: Point,
      Edge: Edge,
      /**
       * @param id
       * @returns элемент с указанным id.
       */
      getElement: function(id) {
        for ( var i in elements) {
          if (elements[i].id == id) {
            return elements[i];
          }
        }
      },
      selectElement: function(id) {
        var element = getElement(id);
        if (element) {
          unselectAll();
          element.select();
        }
      },
      /**
       * Запускает симуляцию.
       */
      start: function() {
        world.paused = false;
        loop.setSimulate(true);
      },
      /**
       * Приостанавливает симуляцию.
       */
      pause: function() {
        world.paused = true;
        loop.setSimulate(false);
      },
      /**
       * Останавливает симуляцию, сбрасывает позиции элементов.
       */
      stop: function() {
        world.paused = true;
        loop.setSimulate(false);
        for ( var i in elements) {
          elements[i].body.SetLinearVelocity(new b2Vec2(0, 0));
        }
        mechanism.load(dashboard.currentState.value);
      },
      /**
       * @returns Требуется ли обновить текущее состояние.
       */
      isNew: function() {
        if (hasNewElements) {
          hasNewElements = false;
          return true;
        }
      },
      /**
       * Удаляет все элементы.
       */
      clear: function() {
        unselectAll();
        var points = getPoints();
        for ( var i in points) {
          points[i].destroy();
        }
      },
      /**
       * Загружает механизм из строки.
       */
      load: function(newState) {
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
              // [this.id, 'p', this.x.toFixed(3), this.y.toFixed(3), this.type,
              // edgesStr]
              createPoint({
                id: +elementsDefs[i][0],
                x: +elementsDefs[i][2],
                y: +elementsDefs[i][3]
              }).setType(elementsDefs[i][4]);
            }
          }
          for (i in elementsDefs) {
            if (elementsDefs[i][1] == 'e') {
              // добавляем рёбра между точками
              // [this.id, 'e', this.p1.id, this.p2.id]
              createEdge(mechanism.getElement(+elementsDefs[i][2]), mechanism.getElement(+elementsDefs[i][3]),
                  +elementsDefs[i][0]);
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
      save: function() {
        var str = '';
        for ( var i in elements) {
          str += elements[i].toString() + '\n';
        }

        return str;
      }

    };
  })();

  init.start();
})();
