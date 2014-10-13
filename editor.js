/**
 * @author smg
 */
/**
 * @module editor
 */
var editor = (function() {
  var b2Vec2 = Box2D.Common.Math.b2Vec2, b2AABB = Box2D.Collision.b2AABB, b2BodyDef = Box2D.Dynamics.b2BodyDef, b2Body = Box2D.Dynamics.b2Body, b2FixtureDef = Box2D.Dynamics.b2FixtureDef, b2World = Box2D.Dynamics.b2World, b2ContactFilter = Box2D.Dynamics.b2ContactFilter, b2MassData = Box2D.Collision.Shapes.b2MassData, b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape, b2CircleShape = Box2D.Collision.Shapes.b2CircleShape, b2DebugDraw = Box2D.Dynamics.b2DebugDraw, b2MouseJointDef = Box2D.Dynamics.Joints.b2MouseJointDef, b2RevoluteJointDef = Box2D.Dynamics.Joints.b2RevoluteJointDef;
  
  window.requestAnimFrame = (function() {
    return window.requestAnimationFrame || window.webkitRequestAnimationFrame
        || window.mozRequestAnimationFrame || window.oRequestAnimationFrame
        || window.msRequestAnimationFrame || function(callback, element) {
          window.setTimeout(callback, 1000 / 60);
        };
  })();
  
  var scale, canvas, ctx;
  
  /**
   * Кнопки управления симуляцией.
   * 
   * @memberOf editor
   */
  var controls = {
    play : 0,
    pause : 0,
    stop : 0,
    load : 0,
    scale : 0,
    labels : 0
  };
  /**
   * Панель редактирования параметров элемента.
   * 
   * @memberOf editor
   */
  var dashboard = {
    /**
     * @memberOf dashboard
     */
    elementId : 0,
    elementName : 0,
    pointType : 0,
    pointX : 0,
    pointY : 0,
    edgePoints : 0,
    edgeLength : 0,
    currentState : 0
  };
  /**
   * Цветовая схема.
   * 
   * @memberOf editor
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
   * Состояние мыши.
   * 
   * @memberOf editor
   */
  var mouse = {
    /**
     * @memberOf mouse
     */
    x : 0,
    y : 0,
    isDown : false,
    isCtrl : false
  };
  
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
  };
  /**
   * Инициализатор редактора.
   * 
   * @memberOf editor
   */
  var init = {
    /**
     * @memberOf init
     */
    start : function() {
      canvas = document.getElementById("canvas");
      controls.play = document.getElementById("play");
      controls.pause = document.getElementById("pause");
      controls.stop = document.getElementById("stop");
      controls.load = document.getElementById("load");
      controls.scale = document.getElementById("scale");
      controls.labels = document.getElementById("labels");
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
    callbacks : function() {
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
      
      controls.labels.addEventListener('click', function(e) {
        mechanism.setLabels(e.target.checked);
      }, false);
      
      dashboard.elementId.addEventListener('input', function(e) {
        var element = mechanism.selectElement(+e.target.value);
        showInfo(element);
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
        var newPoint = mechanism.onClick();
        showInfo(newPoint);
      }, false);
      
      canvas.addEventListener('mousemove', function(e) {
        mouse.x = (e.clientX - canvasPosition.x) / scale;
        mouse.y = (e.clientY - canvasPosition.y) / scale;
        var element = mechanism.onMove();
        showInfo(element);
      }, false);
      
      canvas.addEventListener('mousedown', function(e) {
        mouse.isDown = true;
        mouse.isCtrl = e.ctrlKey;
        var element = mechanism.onDown();
        showInfo(element);
      }, false);
      
      canvas.addEventListener('mouseup', function(e) {
        mouse.isDown = false;
        mouse.isCtrl = false;
        var element = mechanism.onUp();
        showInfo(element);
      }, false);
      
      var keyCodes = {
        DEL : 46,
        A : 65
      };
      
      document.onkeyup = function key(e) {
        switch (e.keyCode) {
          case keyCodes.DEL:
            mechanism.onDelete();
            break;
          case keyCodes.A:
            mechanism.onAKeyUp();
            break;
        }
      };
    }
  };
  
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
      process : function() {
        loop.step();
        loop.update();
        loop.draw();
        requestAnimFrame(loop.process);
      },
      step : function() {
        box2d.get.world().Step(stepRate, 10, 10);
        box2d.get.world().ClearForces();
      },
      /**
       * Обновляет положения элементов.
       */
      update : function() {
        canvas.height = area.clientHeight;
        canvas.width = area.clientWidth;
        for (var b = box2d.get.world().GetBodyList(); b; b = b.m_next) {
          var id = b.GetUserData();
          if (b.IsActive() && typeof id !== 'undefined' && id != null
              && id > -1) {
            mechanism.getElement(id).update(box2d.get.bodySpec(b));
          }
        }
        if (mechanism.isNew()) {
          dashboard.currentState.value = mechanism.save();
        }
      },
      draw : function() {
        if (debug) {
          box2d.get.world().DrawDebugData();
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        mechanism.draw();
      },
      setSimulate : function(go) {
        if (go) {
          stepRate = 1 / 60;
        } else {
          stepRate = 0;
        }
      }
    };
  })();
  
  init.start();
})();
