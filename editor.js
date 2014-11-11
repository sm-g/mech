/*global box2d, helpers, mechanism */
/**
 * @author smg
 */

/**
 * @module editor
 */
var editor = (function () {
  "use strict";
  window.requestAnimFrame = (function () {
    return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function (callback, element) {
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
    play: 0,
    pause: 0,
    stop: 0,
    load: 0,
    scale: 0,
    labels: 0,
    debug: 0
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
    elementId: 0,
    elementName: 0,
    pointType: 0,
    pointX: 0,
    pointY: 0,
    edgePoints: 0,
    edgeLength: 0,
    edgeGroup: 0,
    currentState: 0
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
    x: 0,
    y: 0,
    isDown: false,
    isCtrl: false
  };

  /**
   * Показывает данные элемента на панели
   *
   * @memberOf editor
   */
  var showInfo = function (element) {
    if (!element) {
      hide(dashboard.edgeLength);
      hide(dashboard.edgePoints);
      hide(dashboard.edgeGroup);
      hide(dashboard.pointType);
      hide(dashboard.pointX);
      hide(dashboard.pointY);
      return;
    }
    if (element instanceof mechanism.elements.Point) {
      dashboard.elementName.innerHTML = 'Пара';
      hide(dashboard.edgeLength);
      hide(dashboard.edgePoints);
      hide(dashboard.edgeGroup);
      show(dashboard.pointType);
      show(dashboard.pointX);
      show(dashboard.pointY);
      dashboard.pointX.value = element.x.toFixed(3);
      dashboard.pointY.value = element.y.toFixed(3);
      dashboard.pointType.selectedIndex = element.type;
    } else if (element instanceof mechanism.elements.Edge) {
      dashboard.elementName.innerHTML = 'Ребро';
      show(dashboard.edgeLength);
      show(dashboard.edgePoints);
      show(dashboard.edgeGroup);
      hide(dashboard.pointType);
      hide(dashboard.pointX);
      hide(dashboard.pointY);
      dashboard.edgeLength.value = element.getLength().toFixed(3);
      dashboard.edgePoints.value = element.p1.id + ', ' + element.p2.id;
      dashboard.edgeGroup.value = element.gr.id;
    }
    dashboard.elementId.value = element.id;
  };

  var show = function (element) {
    element.style.display = "block";
  };
  var hide = function (element) {
    element.style.display = "none";
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
    start: function () {
      canvas = document.getElementById("canvas");
      controls.play = document.getElementById("play");
      controls.pause = document.getElementById("pause");
      controls.stop = document.getElementById("stop");
      controls.load = document.getElementById("load");
      controls.scale = document.getElementById("scale");
      controls.labels = document.getElementById("labels");
      controls.debug = document.getElementById("debug");
      dashboard.pointType = document.getElementById("point-type");
      dashboard.pointX = document.getElementById("point-x");
      dashboard.pointY = document.getElementById("point-y");
      dashboard.edgePoints = document.getElementById("edge-points");
      dashboard.edgeLength = document.getElementById("edge-length");
      dashboard.edgeGroup = document.getElementById("edge-group");
      dashboard.elementId = document.getElementById("element-id");
      dashboard.elementName = document.getElementById("element-name");
      dashboard.currentState = document.getElementById("current-state");

      ctx = canvas.getContext("2d");
      scale = controls.scale.value || 20;

      mechanism.set.context(ctx);
      mechanism.set.scale(scale);
      mechanism.set.canvas(canvas);
      mechanism.set.loop(loop);

      box2d.create.world(ctx, scale);
      box2d.create.defaultFixture();
      box2d.set.collideFilter(mechanism.get.collideFilter);

      this.callbacks();

      controls.labels.click();
      controls.debug.click();

      controls.stop.disabled = true;
      controls.pause.disabled = true;

      box2d.get.world().paused = false;
      loop.setSimulate(true);
      controls.stop.parentNode.removeChild(controls.stop);

      loop.process();
      var save = "1,p,22.667,7.467,2,9,12\n2,p,28.733,7.000,2,6,12\n3,p,21.933,3.600,2,9\n4,p,29.600,2.400,2,6\n5,g,6\n6,e,4,2,5\n9,e,1,3,10\n10,g,9\n11,g,12\n12,e,2,1,11";
      mechanism.state.load(save);
    },
    callbacks: function () {
      var canvasPosition = helpers.getElementPosition(canvas);

      // simulator

      controls.play.addEventListener('click', function (e) {
        controls.play.disabled = true;
        controls.pause.disabled = false;
        controls.stop.disabled = false;

        mechanism.simulation.start();
      }, false);

      controls.pause.addEventListener('click', function (e) {
        controls.pause.disabled = true;
        controls.play.disabled = false;
        controls.stop.disabled = false;

        mechanism.simulation.pause();
      }, false);

      controls.stop.addEventListener('click', function (e) {
        controls.stop.disabled = true;
        controls.pause.disabled = true;
        controls.play.disabled = false;

        mechanism.simulation.stop();
        mechanism.state.reload();
      }, false);

      // other controls

      controls.load.addEventListener('click', function (e) {
        mechanism.state.load(dashboard.currentState.value);
      }, false);

      controls.labels.addEventListener('click', function () {
        mechanism.set.labels(controls.labels.checked);
      }, false);

      controls.debug.addEventListener('click', function () {
        debug = controls.debug.checked;
        box2d.set.debug(debug);
      }, false);

      controls.scale.addEventListener('change', function (e) {
        var val = +e.target.value;
        if (val > 0 && val < 50) {
          scale = val;
          box2d.set.scale(val);
          mechanism.set.scale(val);
        }
      }, false);

      // dashboard

      dashboard.elementId.addEventListener('input', function (e) {

        var element = mechanism.elements.get(+e.target.value);
        if (element) // можно вводить длинный id
        {
          mechanism.elements.select(element.id);
          showInfo(element);
        }
      }, false);

      dashboard.pointX.addEventListener('input', function (e) {
        mechanism.set.point('x', +e.target.value);
      }, false);

      dashboard.pointY.addEventListener('input', function (e) {
        mechanism.set.point('y', +e.target.value);
      }, false);

      dashboard.pointType.addEventListener('change', function (e) {
        mechanism.set.point('type', e.target.selectedIndex);
      }, false);

      dashboard.edgeLength.addEventListener('change', function (e) {
        mechanism.set.edge('length', +e.target.value);
      }, false);

      // mouse

      canvas.addEventListener('click', function (e) {
        var newPoint = mechanism.handlers.onClick(mouse);
        if (newPoint)
          showInfo(newPoint);
      }, false);

      canvas.addEventListener('mousemove', function (e) {
        mouse.x = (e.clientX - canvasPosition.x) / scale;
        mouse.y = (e.clientY - canvasPosition.y) / scale;
        if (mouse.isDown) {
          var element = mechanism.handlers.onMove(mouse);
          showInfo(element);
        }
      }, false);

      canvas.addEventListener('mousedown', function (e) {
        mouse.isDown = true;
        mouse.isCtrl = e.ctrlKey;
        var element = mechanism.handlers.onDown(mouse);
        showInfo(element);
      }, false);

      canvas.addEventListener('mouseup', function (e) {
        mouse.isDown = false;
        mouse.isCtrl = false;
        var element = mechanism.handlers.onUp(mouse);
      }, false);

      // keyboard

      var keyCodes = {
        DEL: 46,
        A: 65
      };

      document.onkeyup = function key(e) {
        if (document.activeElement == document.getElementsByTagName('body')[0]) // otherwise serve input
          switch (e.keyCode) {
        case keyCodes.DEL:
          mechanism.handlers.onDelete();
          break;
        case keyCodes.A:
          mechanism.handlers.onAKeyUp();
          break;
        }
      };
    }
  };

  /**
   * @memberOf editor
   */
  var loop = (function () {
    var stepRate = 0;
    var area = document.getElementById("area");
    return {
      /**
       * Цикл симуляции.
       *
       * @memberOf loop
       */
      process: function () {
        loop.step();
        loop.update();
        loop.draw();
        requestAnimFrame(loop.process);
      },
      step: function () {
        box2d.get.world().Step(stepRate, 10, 10);
        box2d.get.world().ClearForces();
      },
      /**
       * Обновляет положения элементов.
       */
      update: function () {
        canvas.height = area.clientHeight;
        canvas.width = area.clientWidth;
        for (var b = box2d.get.world().GetBodyList(); b; b = b.m_next) {
          var id = b.GetUserData();
          if (b.IsActive() && typeof id !== 'undefined' && id !== null && id > -1) {
            var e = mechanism.elements.get(id);
            if (e)
              e.update(box2d.get.bodySpec(b));
          }
        }
        if (mechanism.state.isNew()) {
          dashboard.currentState.value = mechanism.state.save();
        }
      },
      draw: function () {
        if (debug) {
          box2d.get.world().DrawDebugData();
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        mechanism.elements.draw();
      },
      setSimulate: function (go) {
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