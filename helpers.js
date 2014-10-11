/**
 * @author smg
 */


var helpers = (function() {
  var currentCount = 1;
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
     * Устанавливает значение счётчика, выдаемое при следующем вызове
     * counter().
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

      while (( typeof (element) == "object") && ( typeof (element.tagName) != "undefined")) {
        y += element.offsetTop;
        x += element.offsetLeft;
        tagname = element.tagName.toUpperCase();

        if (tagname == "BODY")
          element = 0;

        if ( typeof (element) == "object") {
          if ( typeof (element.offsetParent) == "object")
            element = element.offsetParent;
        }
      }

      return {
        x : x,
        y : y
      };
    }
  };
})();