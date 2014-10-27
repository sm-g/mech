/**
 * @author smg
 */

var helpers = (function() {
  var currentCount = 1;
  
  function sqr(x) {
    return x * x;
  }
  function dist2(v, w) {
    return sqr(v.x - w.x) + sqr(v.y - w.y);
  }
  function distToSegmentSquared(p, v, w) {
    var l2 = dist2(v, w);
    if (l2 == 0)
      return dist2(p, v);
    var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    if (t < 0)
      return dist2(p, v);
    if (t > 1)
      return dist2(p, w);
    return dist2(p, {
      x : v.x + t * (w.x - v.x),
      y : v.y + t * (w.y - v.y)
    });
  }
  
  return {
    /**
     * @memberOf helpers
     * @returns При каждом вызове число на 1 больше, начиная с 1.
     */
    counter : (function() {
      return function() {
        return currentCount++;
      };
    })(),
    /**
     * Устанавливает значение счётчика, выдаемое при следующем вызове counter().
     */
    setCounter : function(val) {
      currentCount = val;
    },
    randomColor : function() {
      var letters = '0123456789ABCDEF'.split(''), color = '#';
      for (var i = 0; i < 6; i++) {
        color += letters[Math.round(Math.random() * 15)];
      }
      return color;
    },
    /**
     * @see http://js-tut.aardon.de/js-tut/tutorial/position.html
     * @returns Координаты html-элмента.
     */
    getElementPosition : function(e) {
      var element = e, tagname = "", x = 0, y = 0;
      
      while ((typeof (element) == "object")
          && (typeof (element.tagName) != "undefined")) {
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
        x : x,
        y : y
      };
    },
    /**
     * @see http://stackoverflow.com/a/1501725/3009578
     * @returns Расстояние от точки w до отрезка, заданного точками p1 и p2
     */
    distToSegment : function(p1, p2, w) {
      return Math.sqrt(distToSegmentSquared(w, p1, p2));
    },
    /**
     * @returns Длина между наклонной и высотой, опущенной к отрезку. Отрезок
     *          задан точками p1 и p2. Наклонная задана точками s (на отрезке) и
     *          e.
     */
    distToHeight : function(p1, p2, s, e) {
      var dx = e.x - s.x;
      var dy = e.y - s.y;
      var dist = helpers.distToSegment(p1, p2, e);
      return Math.sqrt(sqr(dy) + sqr(dx) - sqr(dist));
    },
    /**
     * @returns Точка c слева от отрезка, заданного точками a и b.
     */
    isLeft : function(a, b, c) {
      return ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) > 0;
    },
    /**
     * @returns Точка нормали к прямой, заданной точками p1 и p2, проходящей
     *          через точку w на этой прямой (не равна w, конечно)
     */
    normalFrom : function(p1, p2, w) {
      var norm = {
        x : -p1.x + p2.x,
        y : p1.y - p2.y
      };
      return {
        x : norm.x - p1.x + w.x,
        y : norm.y - p1.y + w.y
      };
    }
  };
})();