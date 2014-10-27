/**
 * @author smg
 */
/**
 * @module mechanism
 */
var mechanism = (function() {
  var ctx, scale;
  var hasNewElements = false, drawLabels = false;
  var elements = [], selectedElements = [], grs = [];
  var currentBody;
  
  /**
   * @memberOf mechanism
   */
  var pointTypes = {
    fixed : 0,
    clockwiseFixed : 1,
    joint : 2
  };
  
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
  Shape = function(options) {
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
  };
  /**
   * Обновляет положение фигуры.
   */
  Shape.prototype.update = function(options) {
    this.angle = options.angle;
    this.center = options.center;
    this.x = options.x;
    this.y = options.y;
  };
  /**
   * Создаёт новый Element.
   * 
   * @memberOf mechanism
   * @constructor
   */
  Element = function(options) {
    Shape.apply(this, arguments);
    this.body = options.body || null;
    this.isActive = options.isActive || false; // mouse down and move
    
    elements.push(this);
    hasNewElements = true;
  };
  
  Element.prototype = Object.create(Shape.prototype);
  Element.prototype.destroy = function() {
    box2d.get.world().DestroyBody(this.body);
    
    var index = elements.indexOf(this);
    elements.splice(index, 1);
    
    hasNewElements = true;
  };
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
  Point = function(options) {
    Element.apply(this, arguments);
    this.type = options.type || pointTypes.joint;
    this.isStatic = (this.type != pointTypes.joint);
    this.radius = options.radius || 1;
    this.edges = [];
    // точка перемещается, потеряв связи с другими точками
    this.isFlying = false;
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
  
  var connectedPoints = [], edgesCopy = [];
  
  /**
   * Убирает ребра точки. Удаляет рёбра, сохраняя точки, с которыми они
   * соединены.
   */
  Point.prototype.beginFlying = function() {
    this.isFlying = true;
    connectedPoints = [];
    edgesCopy = this.edges.slice();
    // for ( var i in edgesCopy) {
    // if (edgesCopy[i].p1 == this) {
    // connectedPoints.push(edgesCopy[i].p2);
    // } else {
    // connectedPoints.push(edgesCopy[i].p1);
    // }
    // edgesCopy[i].destroy();
    // }
    this.edges = [];
  };
  /**
   * Восстанавливает убранные рёбра.
   */
  Point.prototype.endFlying = function() {
    this.isFlying = false;
    this.edges = edgesCopy;
    // for ( var i in connectedPoints) {
    // createEdge({
    // p1 : this,
    // p2 : connectedPoints[i]
    // });
    // }
  };
  /**
   * Уничтожаем точку и все её ребра.
   */
  Point.prototype.destroy = function() {
    Element.prototype.destroy.call(this);
    var l = this.edges.length;
    while (l--) {
      this.edges[l].destroy();
    }
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
    
    options.gr.add(this);
    this.invisible = options.invisible || false;
  };
  Edge.prototype = Object.create(Element.prototype);
  Edge.prototype.toString = function() {
    return [ this.id, 'e', this.p1.id, this.p2.id, this.gr.id ].join();
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
  /**
   * Уничтожает ребро.
   */
  Edge.prototype.destroy = function() {
    Element.prototype.destroy.call(this);
    
    this.removeFromPoints();
    // remove from gr
    index = this.gr.edges.indexOf(this);
    this.gr.edges.splice(index, 1);
    
    this.gr.destroy();
  };
  Edge.prototype.draw = function() {
    // if (this.invisible)
    // return;
    
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
   * Группа ребер — звено.
   * 
   * @memberOf mechanism
   */
  Group = function(options) {
    this.id = options.id || helpers.counter();
    this.edges = [];
    grs.push(this);
  }
  /**
   * Возвращает ребра жесткости звена.
   * 
   * @returns
   */
  Group.prototype.getStiffEdges = function() {
    return _.filter(this.edges, function(e) {
      return e.invisible
    });
  };
  
  /**
   * Удаляем спец-ребра, каждое ребро группы помещаем в новую группу.
   */
  Group.prototype.destroy = function() {
    for ( var i in this.getStiffEdges()) {
      this.edges[i].destroy();
    }
    var l = this.edges.length;
    while (l--) {
      var e = this.edges[l];
      if (!e.invisible) {
        var g = new Group({});
        g.add(e);
      }
    }
    
    grs = _.without(grs, this);
  }
  /**
   * Добавляет ребро к группе.
   * 
   * @param edge
   */
  Group.prototype.add = function(edge) {
    if (edge.gr == this)
      return;
    // ребро было в группе — меняем группу
    if (edge.gr)
      edge.gr.remove(edge);
    edge.gr = this;
    
    if (!_.contains(this.edges, edge))
      this.edges.push(edge);
  }
  /**
   * Убирает ребро из группы.
   * 
   * @param edge
   */
  Group.prototype.remove = function(edge) {
    this.edges = _.without(this.edges, edge);
    edge.gr = null;
    
    if (this.edges.length == 0)
      this.destroy();
  }

  Group.prototype.toString = function() {
    var edgesStr = this.edges.map(function(edge) {
      return edge.id;
    }).join();
    return [ this.id, 'g', edgesStr ].join();
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
  
  var getWithId = function() {
    return _.union(elements, grs);
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
  var createEdge = function(options) {
    // не создавать ребро
    if (options.p1 == options.p2)
      return;
    // только одно ребро между точками
    var exist = getEdgeBetweenPoints(options.p1, options.p2);
    if (exist) {
      return;
    }
    
    var edge = new Edge(options);
    var body = box2d.addToWorld(edge);
    edge.body = body;
    
    edge.join(options.p1, options.p1.type == pointTypes.clockwiseFixed);
    edge.join(options.p2, options.p2.type == pointTypes.clockwiseFixed);
    return edge;
  };
  /**
   * Соединяет точки рёбрами (в звено).
   * 
   * @memberOf mechanism
   */
  var connectPoints = function(points) {
    if (points.length < 2)
      return;
    
    // Удаляем все существующие ребра между точками. Группы тоже удалятся.
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      var l = p.edges.length;
      while (l--) {
        if (_.contains(points, p.edges[l].p1)
            && _.contains(points, p.edges[l].p2))
          p.edges[l].destroy();
      }
    }
    
    // Создаем группу
    var gr0 = new Group({});
    
    // соединяем точки в контур
    for (var i = 1; i < points.length; i++) {
      createEdge({
        p1 : points[i],
        p2 : points[i - 1],
        gr : gr0
      });
    }
    createEdge({
      p1 : points[0],
      p2 : points[points.length - 1],
      gr : gr0
    });
    
    // Добавляем ребра жесткости
    triangulate(points, gr0);
  };
  /**
   * Разбивает выпуклый многоугольник на треугольники спец-ребрами.
   * 
   * @memberOf mechanism
   */
  var triangulate = function(points, gr) {
    if (points.length > 3) {
      for (var i = 2; i < points.length - 1; i++) {
        createEdge({
          p1 : points[0],
          p2 : points[i],
          invisible : true,
          gr : gr
        });
      }
    }
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
            // if (selectedElements.length == 2 && selectedElements[0].isPoint()
            // && selectedElements[1].isPoint()) {
            // connectPoints(selectedElements);
            // }
            
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
          connectPoints(selectedElements.filter(isPoint));
        }
      }
    },
    set : {
      /**
       * Устанавливает значение параметра точки для последнего выбранного тела.
       * 
       * @param what
       *          Какой параметр менять.
       * @param value
       *          Значение параметра.
       * @memberOf set
       */
      point : function(what, value) {
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
       * Устанавливает показ надписей к элементам.
       */
      labels : function(value) {
        drawLabels = value;
      },
      /**
       * Устанавливает контекст рисования.
       */
      context : function(context) {
        ctx = context;
      },
      /**
       * Устанавливает масштаб рисования.
       */
      scale : function(scl) {
        scale = scl;
      },
    },
    /**
     * Отрисовывает все элементы.
     * 
     * @memberOf mechanismReturn
     */
    draw : function() {
      var edges = getEdges();
      for ( var i in edges) {
        edges[i].draw();
      }
      var points = getPoints();
      for ( var i in points) {
        points[i].draw();
      }
    },
    
    Point : Point,
    Edge : Edge,
    /**
     * @param id
     * @returns элемент с указанным id.
     */
    getElement : function(id) {
      return _.findWhere(elements, {
        id : id
      });
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
            var pDef = elementsDefs[i];
            createPoint({
              id : +pDef[0],
              x : +pDef[2],
              y : +pDef[3]
            }).setType(pDef[4]);
          }
        }
        for (i in elementsDefs) {
          if (elementsDefs[i][1] == 'g') {
            // добавляем группы
            // [this.id, 'g', edgesStr]
            new Group({
              id : +elementsDefs[i][0]
            });
          }
        }
        for (i in elementsDefs) {
          if (elementsDefs[i][1] == 'e') {
            // добавляем рёбра между точками
            // [this.id, 'e', this.p1.id, this.p2.id, this.gr.id]
            var eDef = elementsDefs[i];
            createEdge({
              p1 : mechanism.getElement(+eDef[2]),
              p2 : mechanism.getElement(+eDef[3]),
              id : +eDef[0],
              gr : _.findWhere(grs, {
                id : +eDef[4]
              })
            });
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
      var sorted = _.sortBy(getWithId(), "id");
      for ( var i in sorted) {
        str += sorted[i].toString() + '\n';
      }
      
      return str;
    }
  };
  
  return ret;
})();
