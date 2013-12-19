/**
 * @type editor
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

  var SCALE, canvas, ctx, world, fixDef, selectedBody;
  var buttons = {};
  var dashboard = {
    pointType: 0,
    pointX: 0,
    pointY: 0,
  }

  var debug = true;

  /**
   * @memberOf editor
   */
  var mouse = {
    x: 0,
    y: 0,
    isDown: false,
    isCtrl: false,
    joint: null,
    pVec: null
  }

  /**
   * @memberOf editor
   */
  var init = {
    /**
     * @memberOf init
     */
    start: function(id, scale) {
      canvas = document.getElementById(id);
      buttons.play = document.getElementById("play");
      buttons.pause = document.getElementById("pause");
      buttons.stop = document.getElementById("stop");
      dashboard.pointType = document.getElementById("point-type");
      dashboard.pointX = document.getElementById("point-x");
      dashboard.pointY = document.getElementById("point-y");
      dashboard.elementId = document.getElementById("element-id");
      
      ctx = canvas.getContext("2d");
      SCALE = scale || 20;

      box2d.create.world();
      box2d.create.defaultFixture();

      this.callbacks();

      loop.process();
    },
    callbacks: function() {
      var canvasPosition = helpers.getElementPosition(canvas);

      buttons.play.addEventListener('click', function(e) {
        mechanism.start();
      }, false);
      
      buttons.pause.addEventListener('click', function(e) {
        mechanism.pause();
      }, false);
      
      canvas.addEventListener('click', function(e) {
        mechanism.onClick();
      }, false);

      canvas.addEventListener('mousemove', function(e) {
        mouse.x = (e.clientX - canvasPosition.x) / SCALE;
        mouse.y = (e.clientY - canvasPosition.y) / SCALE;
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
     * @memberOf box2d
     */
    addToWorld: function(shape) {
      var bodyDef = this.create.bodyDef(shape);
      var body = world.CreateBody(bodyDef);
      if (shape instanceof Circle || shape instanceof mechanism.point) {
        fixDef.shape = new b2CircleShape(shape.radius);
      } else if (shape instanceof Box) {
        fixDef.shape = new b2PolygonShape;
        fixDef.shape.SetAsBox(shape.width / 2, shape.height / 2);
      } else if (shape instanceof Edge) {
        fixDef.shape = new b2PolygonShape;
        fixDef.shape.SetAsEdge(new b2Vec2(0, 0), new b2Vec2(shape.long, 0));
      } else if (shape instanceof mechanism.edge) {
        fixDef.shape = new b2PolygonShape;
        var middleP = new paper.Point((shape.p1.x + shape.p2.x) / 2, (shape.p1.y + shape.p2.y) / 2);
        var paperPoint = new paper.Point(shape.p1.x - shape.p2.x, shape.p1.y - shape.p2.y).normalize(shape.width);
        var pp1 = paperPoint.rotate(90);
        var pp2 = paperPoint.rotate(-90);
        fixDef.shape.SetAsArray([new b2Vec2(shape.p1.x - middleP.x, shape.p1.y - middleP.y), new b2Vec2(pp1.x, pp1.y),
            new b2Vec2(shape.p2.x - middleP.x, shape.p2.y - middleP.y), new b2Vec2(pp2.x, pp2.y)]);
      }

      body.CreateFixture(fixDef);
      return body;
    },
    create: {
      /**
       * @memberOf create
       */
      world: function() {
        world = new b2World(new b2Vec2(0, 0), false);

        if (debug) {
          var debugDraw = new b2DebugDraw();
          debugDraw.SetSprite(ctx);
          debugDraw.SetDrawScale(SCALE);
          debugDraw.SetFillAlpha(0.5);
          debugDraw.SetLineThickness(1.0);
          debugDraw.SetFlags(b2DebugDraw.e_shapeBit | b2DebugDraw.e_jointBit);
          world.SetDebugDraw(debugDraw);
        }
      },
      defaultFixture: function() {
        fixDef = new b2FixtureDef;
        fixDef.density = 10.0; // плотность
        fixDef.friction = 1; // трение
        fixDef.restitution = 0.0; // упругость
      },
      bodyDef: function(shape) {
        var bodyDef = new b2BodyDef;
        if (shape.isStatic == true) {
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
       * @memberOf get
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
          element: b.GetUserData()
        };
      },
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

    }
  };

  /**
   * @memberOf editor
   */
  var loop = {
    /**
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
    update: function() {
      for ( var b = world.GetBodyList(); b; b = b.m_next) {
        if (b.IsActive() && typeof b.GetUserData() !== 'undefined' && b.GetUserData() != null) {
          mechanism.shapeAt(b.GetUserData()).update(box2d.get.bodySpec(b));
        }
      }

    },
    draw: function() {
      if (debug){
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
    // http://js-tut.aardon.de/js-tut/tutorial/position.html
    getElementPosition: function(element) {
      var elem = element, tagname = "", x = 0, y = 0;

      while ((typeof (elem) == "object") && (typeof (elem.tagName) != "undefined")) {
        y += elem.offsetTop;
        x += elem.offsetLeft;
        tagname = elem.tagName.toUpperCase();

        if (tagname == "BODY")
          elem = 0;

        if (typeof (elem) == "object") {
          if (typeof (elem.offsetParent) == "object")
            elem = elem.offsetParent;
        }
      }

      return {
        x: x,
        y: y
      };
    }
  };
  /**
   * @memberOf editor
   */
  var Shape = function(v) {
    this.id = helpers.counter();
    this.x = v.x || 0;
    this.y = v.y || 0;
    this.angle = v.angle || 0;
    this.color = helpers.randomColor();
    this.center = {
      x: null,
      y: null
    };
    this.isStatic = v.isStatic || false;

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
  var Edge = function(options) {
    Shape.call(this, options);

    this.long = options.long || 1;
    this.draw = function() {
      ctx.save();
      ctx.translate(this.x * SCALE, this.y * SCALE);
      ctx.rotate(this.angle);
      ctx.translate(-(this.x) * SCALE, -(this.y) * SCALE);

      ctx.strokeStyle = this.color;
   
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(this.x * SCALE, this.y * SCALE);
      ctx.lineTo(this.long * SCALE, this.y * SCALE);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    };
  };
  Edge.prototype = Object.create(Shape.prototype);
  /**
   * @memberOf editor
   */
  var Circle = function(options) {
    Shape.call(this, options);
    this.radius = options.radius || 1;

    this.draw = function() {
      ctx.save();
      ctx.translate(this.x * SCALE, this.y * SCALE);
      ctx.rotate(this.angle);
      ctx.translate(-(this.x) * SCALE, -(this.y) * SCALE);

      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x * SCALE, this.y * SCALE, this.radius * SCALE, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
  };
  Circle.prototype = Object.create(Shape.prototype);
  /**
   * @memberOf editor
   */
  var Box = function(options) {
    Shape.call(this, options);
    this.width = options.width || 1;
    this.height = options.height || 1;

    this.draw = function() {
      ctx.save();
      ctx.translate(this.x * SCALE, this.y * SCALE);
      ctx.rotate(this.angle);
      ctx.translate(-(this.x) * SCALE, -(this.y) * SCALE);
      ctx.fillStyle = this.color;
      ctx.fillRect((this.x - (this.width / 2)) * SCALE, (this.y - (this.height / 2)) * SCALE, this.width * SCALE,
          this.height * SCALE);
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
     * @memberOf mechanism
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
    //  this.x = options.x;
    //  this.y = options.y;
      this.type = options.type || pointTypes.joint;
      this.radius = options.radius || 1;
      this.edges = [];      
    };
    Point.prototype = Object.create(Element.prototype);
    Point.prototype.radius = 1;
    Point.prototype.setPosition = function(x, y) {
      this.x = x;
      this.y = y;
      this.body.SetPosition(new b2Vec2(x, y));
    };    
    Point.prototype.refreshPosition = function() {
      var pos = this.body.GetPosition();
      this.x = pos.x;
      this.y = pos.y;
    };
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
      ctx.translate(this.x * SCALE, this.y * SCALE);
      ctx.rotate(this.angle);
      ctx.translate(-(this.x) * SCALE, -(this.y) * SCALE);
      
      ctx.fillStyle = '#555';
      if (this.isSelected()) {
        ctx.fillStyle = '#BBB';
      }
      ctx.beginPath();
      ctx.arc(this.x * SCALE, this.y * SCALE, this.radius * SCALE, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    /**
     * @memberOf mechanism
     */
    var Edge = function(options) {
      Element.apply(this, arguments);
      this.p1 = options.p1;
      this.p2 = options.p2;
    };
    Edge.prototype = Object.create(Element.prototype);
    Edge.prototype.width = 0.5;
    Edge.prototype.removeFromPoints = function() {
      var index = this.p1.edges.indexOf(this);
      this.p1.edges.splice(index, 1);
      index = this.p2.edges.indexOf(this);
      this.p2.edges.splice(index, 1);
    };
    Edge.prototype.destroy = function() {
      world.DestroyBody(this.body);
      var index = elements.indexOf(this);
      elements.splice(index, 1);
      this.removeFromPoints;
    };
    Edge.prototype.draw = function() {
      ctx.save();
      ctx.translate(this.x * SCALE, this.y * SCALE);
      ctx.rotate(this.angle);
      ctx.translate(-(this.x) * SCALE, -(this.y) * SCALE);
      
      ctx.fillStyle = '#555';
      if (this.isSelected()) {
        ctx.fillStyle = '#BBB';
      }
      ctx.beginPath();
      ctx.arc(this.x * SCALE, this.y * SCALE, this.radius * SCALE, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    
    var createPoint = function(options) {
      options.radius = 1;
      var point = new Point(options);
      var body = box2d.addToWorld(point);
      point.body = body;
    };
    var createEdge = function(p1, p2) {
      if (getEdgeBetweenPoints(p1, p2))
        return;

      p1.refreshPosition();
      p2.refreshPosition();

      var edge = new Edge({
        p1: p1,
        p2: p2
      });
      var body = box2d.addToWorld(edge);
      edge.body = body;
    };
    var getEdgeBetweenPoints = function(p1, p2) {
      for ( var i in p1.edges) {
        if (edges[i].point1 == p2 || edges[i].point2 == p2)
          return edges[i];
      }
    };
    var getElementOfBody = function(body) {
      if (body) {
        var element;
        for (var i in elements) {
          if (elements[i].body == body) {
            element = elements[i];
            break;
          }
        }
        return element;
      }
    };
    getEdgeBetweenPoints = function(p1, p2) {
      for ( var i in p1.edges) {
        if (elements[i].point1 == p2 || elements[i].point2 == p2)
          return elements[i];
      }
    };
    join = function(point, edge) {
      var joint = new b2RevoluteJointDef();
      joint.Initialize(point.body, edge.body, point.body.GetWorldCenter());
      world.CreateJoint(joint);
    };

    var showInfo = function(element) {
      // показываем инфо на панели
      dashboard.pointX.value = element.x;
      dashboard.pointY.value = element.y;
      dashboard.pointType.selectedIndex = element.type;
      dashboard.elementId.value = element.id;
    }
    
    var currentBody;
    return {
      onDown: function() {
        currentBody = box2d.get.bodyAtMouse();
        if (frozen && currentBody) {
          var element = getElementOfBody(currentBody);
          if (element) {
            if (element instanceof Point) {
              if (!element.isSelected()) {
                // выделяем точку               
                element.select();
                // if (selectedElements.length == 2 && selectedElements[0] instanceof Point
                // && selectedElements[1] instanceof Point) {
                  // два точки выделены - добавляем между ними ребро
                  // createEdge(selectedElements[0], selectedElements[1]);
                  // selectedElements = [];
                // }
                element.isActive = true;
              }         
             showInfo(element);
            }
          }
        }
      },      
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
            }
          }
        }
      },
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
      onMove: function() {
        if (frozen && mouse.isDown) {         
          if (currentBody) {
            var element = getElementOfBody(currentBody);
            if (element) {
              if (element instanceof Point) {
                // двигаем точку
                element.setPosition(
                  mouse.x,
                  mouse.y
                );
              }
              element.isActive = true;
              showInfo(element);
            }
          }
        }
      },
      onDelete: function() {
        if (frozen && selectedElements[0]) {
          // удаляем все выбранные элементы
          for (var i in selectedElements) {
            selectedElements[i].destroy();
          }
          selectedElements = [];
        }
      },
      draw: function() {
        for(var i in elements) {
          elements[i].draw();
        }
      },
      point: Point,
      edge: Edge,
      shapeAt: function(id) {
        for(var i in elements) {
          if (elements[i].id == id) {
            return elements[i];
          }
        }
      },
      start: function() {
        frozen = false;
        world.SetGravity(new b2Vec2(0, 2));
      },
      pause: function() {
        frozen = true;
        world.SetGravity(new b2Vec2(0, 0));
        for(var i in elements) {          
          elements[i].body.SetLinearVelocity(new b2Vec2(0, 0));
        }
      }

    };
  })();

  init.start('canvas');
})();
