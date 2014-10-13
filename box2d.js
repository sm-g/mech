/**
 * @author smg
 */
var b2Vec2 = Box2D.Common.Math.b2Vec2, b2AABB = Box2D.Collision.b2AABB, b2BodyDef = Box2D.Dynamics.b2BodyDef, b2Body = Box2D.Dynamics.b2Body, b2FixtureDef = Box2D.Dynamics.b2FixtureDef, b2World = Box2D.Dynamics.b2World, b2ContactFilter = Box2D.Dynamics.b2ContactFilter, b2MassData = Box2D.Collision.Shapes.b2MassData, b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape, b2CircleShape = Box2D.Collision.Shapes.b2CircleShape, b2DebugDraw = Box2D.Dynamics.b2DebugDraw, b2MouseJointDef = Box2D.Dynamics.Joints.b2MouseJointDef, b2RevoluteJointDef = Box2D.Dynamics.Joints.b2RevoluteJointDef;

var box2d = (function() {
  var fixDef, world, scale, ctx;
  
  return {
    /**
     * Добавляет в мир тело для соответствующей фигуры.
     * 
     * @memberOf box2d
     * @param shape
     * @returns Созданное тело.
     */
    addToWorld : function(shape) {
      var bodyDef = this.create.bodyDef(shape);
      
      if (shape instanceof mechanism.Point) {
        fixDef.shape = new b2CircleShape(shape.radius);
      } else if (shape instanceof mechanism.Edge) {
        fixDef.shape = new b2PolygonShape;
        // ребро в виде узкого ромба
        var middleP = new paper.Point((shape.p1.x + shape.p2.x) / 2,
            (shape.p1.y + shape.p2.y) / 2);
        var paperPoint = new paper.Point(shape.p1.x - shape.p2.x, shape.p1.y
            - shape.p2.y).normalize(shape.width);
        var pp1 = paperPoint.rotate(90);
        var pp2 = paperPoint.rotate(-90);
        fixDef.shape.SetAsArray([
            new b2Vec2(shape.p1.x - middleP.x, shape.p1.y - middleP.y),
            new b2Vec2(pp1.x, pp1.y),
            new b2Vec2(shape.p2.x - middleP.x, shape.p2.y - middleP.y),
            new b2Vec2(pp2.x, pp2.y) ]);
        
        bodyDef.position.x = middleP.x;
        bodyDef.position.y = middleP.y;
      }
      ;
      
      var body = world.CreateBody(bodyDef);
      body.CreateFixture(fixDef);
      return body;
    },
    create : {
      /**
       * Создает мир.
       * 
       * @memberOf create
       */
      world : function(ctx, scale) {
        world = new b2World(new b2Vec2(0, 0), false);
        world.paused = true;
        var filter = new b2ContactFilter();
        /**
         * @returns Должны ли сталкиваться два fixture. Сталкиваются соединённые
         *          ребро и точка.
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
        };
        
        world.SetContactFilter(filter);
        
        if (debug) {
          var debugDraw = new b2DebugDraw();
          debugDraw.SetSprite(ctx);
          debugDraw.SetDrawScale(scale || 1);
          debugDraw.SetFillAlpha(0.5);
          debugDraw.SetLineThickness(1.0);
          debugDraw.SetFlags(b2DebugDraw.e_shapeBit | b2DebugDraw.e_jointBit);
          world.SetDebugDraw(debugDraw);
        }
      },
      /**
       * Настраивает физику тел по умолчанию.
       */
      defaultFixture : function() {
        fixDef = new b2FixtureDef;
        fixDef.density = 5.0;
        // плотность
        fixDef.friction = 0;
        // трение
        fixDef.restitution = 0;
        // упругость
      },
      /**
       * Создает body definition для фигуры.
       * 
       * @param shape
       * @returns body definition
       */
      bodyDef : function(shape) {
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
    get : {
      /**
       * @param b
       * @returns Параметры тела: координаты, угол, центр, id-элемента
       * @memberOf get
       */
      bodySpec : function(b) {
        return {
          x : b.GetPosition().x,
          y : b.GetPosition().y,
          angle : b.GetAngle(),
          center : {
            x : b.GetWorldCenter().x,
            y : b.GetWorldCenter().y
          },
          elementId : b.GetUserData()
        };
      },
      /**
       * @param dynamicOnly
       *          Флаг поиска только нестатических тел.
       * @returns Тело, на которое указывает мышь.
       */
      bodyAtMouse : function(mouse, dynamicOnly) {
        var getBodyCB = function(fixture) {
          if (!dynamicOnly
              || fixture.GetBody().GetType() != b2Body.b2_staticBody) {
            if (fixture.GetShape().TestPoint(fixture.GetBody().GetTransform(),
                mousePVec)) {
              selectedBody = fixture.GetBody();
              return false;
            }
          }
          return true;
        };
        var mousePVec = new b2Vec2(mouse.x, mouse.y);
        var aabb = new b2AABB();
        aabb.lowerBound.Set(mouse.x - 0.001, mouse.y - 0.001);
        aabb.upperBound.Set(mouse.x + 0.001, mouse.y + 0.001);
        var selectedBody = null;
        world.QueryAABB(getBodyCB, aabb);
        return selectedBody;
      },
      motorSpeed : function() {
        return 2000;
      },
      maxMotorTorque : function() {
        return 2000;
      },
      world : function() {
        return world;
      }
    },
    refresh : {
      /**
       * Обновляет тип тела для элемента.
       * 
       * @param element
       * @memberOf refresh
       */
      bodyType : function(element) {
        var body = element.body;
        if (element.isStatic) {
          body.SetType(b2Body.b2_staticBody);
        } else {
          body.SetType(b2Body.b2_dynamicBody);
        }
      },
    
    },
    set : {
      /**
       * 
       * @memberOf set
       */
      scale : function(newScale) {
        scale = newScale;
      }
    },
    isValid : {
      /**
       * @param val
       * @returns Допустимость x координаты в мире.
       * 
       * @memberOf isValid
       */
      x : function(val) {
        return val >= 0 && val <= canvas.width / scale;
      },
      /**
       * @param val
       * @returns Допустимость y координаты в мире.
       */
      y : function(val) {
        return val >= 0 && val <= canvas.height / scale;
      }
    }
  };
})();