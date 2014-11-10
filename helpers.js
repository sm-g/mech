/**
 * @author smg
 */

var helpers = (function () {
  "use strict";
  var currentCount = 1;

  function sqr(x) {
    return x * x;
  }

  /**
   * Squared distance between points
   * @param   {Object}   v point1
   * @param   {Object} w point2
   * @returns {Number}   distance
   */
  function dist2(v, w) {
    return sqr(v.x - w.x) + sqr(v.y - w.y);
  }
  /**
   * @returns {Number} minimum distance between line segment vw and point p
   */
  function distToSegmentSquared(p, v, w) {
    var l2 = dist2(v, w);
    if (l2 === 0)
      return dist2(p, v);
    var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    if (t < 0)
      return dist2(p, v); // Beyond the 'v' end of the segment
    if (t > 1)
      return dist2(p, w); // Beyond the 'w' end of the segment
    return dist2(p, { // Projection falls on the segment
      x: v.x + t * (w.x - v.x),
      y: v.y + t * (w.y - v.y)
    });
  }

  return {
    /**
     * @memberOf helpers
     * @returns При каждом вызове число на 1 больше, начиная с 1.
     */
    counter: (function () {
      return function () {
        return currentCount++;
      };
    })(),
    /**
     * Устанавливает значение счётчика, выдаемое при следующем вызове counter().
     */
    setCounter: function (val) {
      currentCount = val;
    },
    randomColor: function () {
      var letters = '0123456789ABCDEF'.split(''),
        color = '#';
      for (var i = 0; i < 6; i++) {
        color += letters[Math.round(Math.random() * 15)];
      }
      return color;
    },
    logP: function (p, label) {
      return (label !== undefined ? label + ': ' : '') + p.x.toFixed(2) + ',' + p.y.toFixed(2);
    },
    /**
     * @see http://js-tut.aardon.de/js-tut/tutorial/position.html
     * @returns Координаты html-элмента.
     */
    getElementPosition: function (e) {
      var element = e,
        tagname = "",
        x = 0,
        y = 0;

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
    },
    middle: function (a, b) {
      return {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2
      };
    },
    /**
     * @see http://stackoverflow.com/a/1501725/3009578
     * @returns Расстояние от w до отрезка (a,b) (не прямой)
     */
    distToSegment: function (a, b, w) {
      return Math.sqrt(distToSegmentSquared(w, a, b));
    },
    /**
     *
     * @param a Первая точка отрезка
     * @param b Вторая точка отрезка
     * @param s Точка наклонной на отрезке
     * @param e Конечная точка наклонной
     * @returns {Number} Расстояние между s и высотой, опущенной из e.
     */
    distToHeight: function (a, b, s, e) {
      var distStartEnd = dist2(s, e);
      var distEndSegm = distToSegmentSquared(e, a, b);
      console.info(['start-end:' + distStartEnd.toFixed(4), 'end-segm:' + distEndSegm.toFixed(4)].join());
      if (distEndSegm > distStartEnd) {
        console.warn('!');
        return 0;
      }
      return Math.sqrt(distStartEnd - distEndSegm);
    },
    /**
     * @returns Точка c слева от отрезка (a,b)
     */
    isLeft: function (a, b, c) {
      return ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) > 0;
    },
    /**
     * @returns Точка нормали к ab, проходящей
     *          через c на этой прямой (не равна c)
     */
    normalFrom: function (a, b, c) {
      // уравнение прямой Ax + By + C = 0
      var A = a.y - b.y;
      var B = b.x - a.x;
      // уравнение нормали через точку x0,y0
      // (x - x0)/A = (y - y0)/B
      var y = 0;
      if (B === 0) y = 1; // B == 0 вертикаль
      if (c.y == y) y = y + 1; // не совпадает с c
      return {
        x: A * (y - c.y) / B + c.x,
        y: y
      };
    },

    /**
     *
     * @returns {Boolean} Точки w и v с одной стороны от прямой ab
     */
    onOneSide: function (a, b, w, v) {
      var wOnLeft = helpers.isLeft(a, b, w);
      var vOnLeft = helpers.isLeft(a, b, v);
      return wOnLeft == vOnLeft;
    },
    /**
     * @see http://math.stackexchange.com/questions/436767/move-point-a-along-a-line
     * @returns Точка на расстоянии d от точки a на прямой ab
     */
    movePointAlongLine: function (a, b, d) {
      var k = d / Math.sqrt(dist2(a, b));
      return {
        x: k * b.x + (1 - k) * a.x,
        y: k * b.y + (1 - k) * a.y
      };
    }
  };
})();