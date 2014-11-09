/*global helpers, Box2D */
/**
 * @author smg
 */

var box2d = (function () {
  "use strict";
  var fixDef, world, scale, ctx;

  return {
    /**
     * Добавляет в мир тело для соответствующей фигуры.
     *
     * @memberOf box2d
     * @param shape
     * @param type Точка (1) или ребро (2)
     * @returns Созданное тело.
     */
    addToWorld: function (shape, type) {
      var bodyDef = this.create.bodyDef(shape);
      switch (type) {
      case 1:
        fixDef.shape = new b2CircleShape(shape.radius);
        break;
      case 2:
      default:
        fixDef.shape = new b2PolygonShape();
        // ребро в виде узкого ромба
        var middleP = new paper.Point((shape.p1.x + shape.p2.x) / 2, (shape.p1.y + shape.p2.y) / 2);
        var paperPoint = new paper.Point(shape.p1.x - shape.p2.x, shape.p1.y - shape.p2.y).normalize(shape.width);
        var pp1 = paperPoint.rotate(90);
        var pp2 = paperPoint.rotate(-90);
        fixDef.shape.SetAsArray([
              new b2Vec2(shape.p1.x - middleP.x, shape.p1.y - middleP.y),
              new b2Vec2(pp1.x, pp1.y),
              new b2Vec2(shape.p2.x - middleP.x, shape.p2.y - middleP.y),
              new b2Vec2(pp2.x, pp2.y)
          ]);

        bodyDef.position.x = middleP.x;
        bodyDef.position.y = middleP.y;
        break;
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
      world: function (ctx_, scale_) {
        world = new b2World(new b2Vec2(0, 0), false);
        world.paused = true;
        ctx = ctx_;
        scale = scale_;
      },
      /**
       * Настраивает физику тел по умолчанию.
       */
      defaultFixture: function () {
        fixDef = new b2FixtureDef();
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
      bodyDef: function (shape) {
        var bodyDef = new b2BodyDef();
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
       * @param b
       * @returns Параметры тела: координаты, угол, центр, id-элемента
       * @memberOf get
       */
      bodySpec: function (b) {
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
      bodyAtMouse: function (mouse, dynamicOnly) {
        var getBodyCB = function (fixture) {
          if (!dynamicOnly || fixture.GetBody().GetType() != b2Body.b2_staticBody) {
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
      motorSpeed: function () {
        return 2000;
      },
      maxMotorTorque: function () {
        return 2000;
      },
      world: function () {
        return world;
      }
    },
    refresh: {
      /**
       * Обновляет тип тела для элемента.
       *
       * @param element
       * @memberOf refresh
       */
      bodyType: function (element) {
        var body = element.body;
        if (element.isStatic) {
          body.SetType(b2Body.b2_staticBody);
        } else {
          body.SetType(b2Body.b2_dynamicBody);
        }
      },

    },
    set: {
      /**
       *
       * @memberOf set
       */
      scale: function (newScale) {
        scale = newScale;
      },
      collideFilter: function (filterFunction) {
        var filter = new b2ContactFilter();
        filter.ShouldCollide = function (fixtureA, fixtureB) {
          var id1 = fixtureA.GetBody().GetUserData();
          var id2 = fixtureB.GetBody().GetUserData();
          return filterFunction(id1, id2);
        };

        world.SetContactFilter(filter);
      },
      debug: function (debug) {
        if (debug) {
          var debugDraw = new b2DebugDraw();
          var diffScale = scale - 5 > 0 ? scale - 5 : scale + 5;
          debugDraw.SetSprite(ctx);
          debugDraw.SetDrawScale(diffScale);
          debugDraw.SetFillAlpha(0.5);
          debugDraw.SetLineThickness(1.0);
          debugDraw.SetFlags(b2DebugDraw.e_shapeBit | b2DebugDraw.e_jointBit);
          world.SetDebugDraw(debugDraw);
        } else {
          world.SetDebugDraw(null);
        }
      }
    }
  };
})();