const Vec2 = require('vec2');
const segseg = require('segseg');
const Line2 = require('line2');
const LineSegment = require('./LineSegment.js');
const polygonBoolean = require('2d-polygon-boolean');
const selfIntersections = require('2d-polygon-self-intersections');
const POLY_SPLIT_EPS = 1E-6;
const PI = Math.PI;
const TAU = PI * 2;
const toTAU = (rads) => {
  if (rads < 0) {
    rads += TAU;
  }
  return rads;
};

const isArray = (a) => {
  return Object.prototype.toString.call(a) === "[object Array]";
}

const isFunction = (a) => {
  return typeof a === 'function';
}

const defined = (a) => {
  return typeof a !== 'undefined';
}


class Polygon {
  constructor(points) {
    if (points instanceof Polygon) {
      return points;
    }
    if (!(this instanceof Polygon)) {
      return new Polygon(points);
    }
    if (!Array.isArray(points)) {
      points = (points) ? [points] : [];
    }
    this.points = points.map(point => {
      if (Array.isArray(point)) {
        return Vec2.fromArray(point);
      } else if (!(point instanceof Vec2)) {
        if (typeof point.x !== 'undefined' &&
          typeof point.y !== 'undefined') {
          return Vec2(point.x, point.y);
        }
      } else {
        return point;
      }
    })
  }
  each(fn) {
    for (var i = 0; i < this.points.length; i++) {
      if (fn.call(this, this.point(i - 1), this.point(i), this.point(i + 1), i) === false) {
        break;
      }
    }
    return this;
  }
  insert(vec, index) {
    return this.points.splice(index, 0, vec)
  }

  point(index) {
    var el = index % (this.points.length);
    if (el < 0) {
      el = this.points.length + el;
    }

    return this.points[el];
  }
  dedupe(returnNew) {
    var seen = {};
    // TODO: make this a tree
    var points = this.points.filter(function(a) {
      var key = a.x + ':' + a.y;
      if (!seen[key]) {
        seen[key] = true;
        return true;
      }
    });

    if (returnNew) {
      return new Polygon(points);
    } else {
      this.points = points;
      return this;
    }
  }
  remove(vec) {
    if (typeof vec === 'number') {
      this.points.splice(vec, 1);
    } else {
      this.points = this.points.filter(function(point) {
        return point !== vec;
      });
    }
    return this;
  }
  clean(returnNew) {
    var last = this.point(-1);

    var points = this.points.filter(function(a) {
      var ret = false;
      if (!last.equal(a)) {
        ret = true;
      }

      last = a;
      return ret;
    });

    if (returnNew) {
      return new Polygon(points);
    } else {
      this.points = points
      return this;
    }
  }
  simplify() {
    var clean = function(v) {
      return Math.round(v * 10000) / 10000;
    }

    var collinear = function(a, b, c) {
      var r = a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y);
      return clean(r) === 0;
    };

    this.points = this.points.filter(Boolean);

    var newPoly = [];
    for (var i = 0; i < this.points.length; i++) {
      var p = this.point(i - 1);
      var n = this.point(i + 1);
      var c = this.point(i);

      var angle = c.subtract(p, true).angleTo(c.subtract(n, true));

      if (!collinear(p, c, n) && clean(angle)) {
        newPoly.push(c);
      }
    }

    this.points = newPoly;
    return this;
  }
  winding() {
    return this.area() > 0
  }
  rewind(cw) {
    cw = !!cw;
    var winding = this.winding();
    if (winding !== cw) {
      this.points.reverse();
    }
    return this;
  }
  area(abs = false) {
    var area = 0;
    var first = this.point(0);
    this.each(function(prev, current, next, idx) {
      if (idx < 2) {
        return;
      }
      var edge1 = first.subtract(current, true);
      var edge2 = first.subtract(prev, true);
      area += ((edge1.x * edge2.y) - (edge1.y * edge2.x));
    });
    return abs ? Math.abs(area / 2) : area / 2;
  }
  closestPointTo(vec) {
    var points = [],
      l = this.points.length,
      dist = Infinity,
      found = null,
      foundIndex = 0,
      foundOnPoint = false,
      i;
    for (i = 0; i < l; i++) {
      var a = this.point(i - 1);
      var b = this.point(i);
      // handle closed loops
      if (a.equal(b)) {
        continue;
      }
      var ab = b.subtract(a, true);
      var veca = vec.subtract(a, true);
      var vecadot = veca.dot(ab);
      var abdot = ab.dot(ab);
      var t = Math.min(Math.max(vecadot / abdot, 0), 1);
      var point = ab.multiply(t).add(a);
      var length = vec.subtract(point, true).lengthSquared();
      if (length < dist) {
        found = point;
        foundIndex = i;
        foundOnPoint = t === 0 || t === 1;
        dist = length;
      }
    }
    found.prev = this.point(foundIndex - 1);
    found.next = this.point(foundIndex + 1);
    if (foundOnPoint) {
      found.current = this.point(foundIndex);
    }
    return found;
  }
  get aabb() {
    if (this.points.length < 2) {
      return {
        x: 0,
        y: 0,
        w: 0,
        h: 0
      };
    }
    var xmin,
      xmax,
      ymax,
      ymin,
      point1 = this.point(1);
    xmax = xmin = point1.x;
    ymax = ymin = point1.y;
    this.each((p, c) => {
      if (c.x > xmax) {
        xmax = c.x;
      }

      if (c.x < xmin) {
        xmin = c.x;
      }

      if (c.y > ymax) {
        ymax = c.y;
      }

      if (c.y < ymin) {
        ymin = c.y;
      }
    });
    return {
      x: xmin,
      y: ymin,
      w: xmax - xmin,
      h: ymax - ymin
    };
  }
  get length() {
    return this.points.length;
  }
  get size() {
    return this.points.length;
  }
  get center() {
    var aabb = this.aabb;
    return Vec2(aabb.x + aabb.w / 2, aabb.y + aabb.h / 2);
  }
  get centroid() {
    var n = this.length;
    var result = new Vec2(0, 0)
    this.each((pv, c, next, i) => {
      // console.log(c);
      result.add(c.x, c.y)
    })
    console.log(result, n);
    result = result.divide(n);
    return result;
  }
  scale(amount, origin, returnNew) {
    var obj = this;
    if (returnNew) {
      obj = this.clone();
    }

    if (!origin) {
      origin = obj.center;
    }

    obj.each(function(p, c) {
      c.multiply(amount);
    });

    var originDiff = origin.multiply(amount, true).subtract(origin);

    obj.each(function(p, c) {
      c.subtract(originDiff);
    });

    return obj;
  }
  containsPoint(point) {
    var c = false;

    this.each(function(prev, current, next) {
      ((prev.y <= point.y && point.y < current.y) || (current.y <= point.y && point.y < prev.y)) &&
      (point.x < (current.x - prev.x) * (point.y - prev.y) / (current.y - prev.y) + prev.x) &&
      (c = !c);
    });

    return c;
  }
  containsPolygon(subject) {
    if (isArray(subject)) {
      subject = new Polygon(subject);
    }

    for (var i = 0; i < subject.points.length; i++) {
      if (!this.containsPoint(subject.points[i])) {
        return false;
      }
    }

    for (var i = 0; i < this.points.length; i++) {
      var outer = this.line(i);
      for (var j = 0; j < subject.points.length; j++) {
        var inner = subject.line(j);

        var isect = segseg(outer[0], outer[1], inner[0], inner[1]);
        if (isect && isect !== true) {
          return false;
        }
      }
    }
    return true;
  }
  offset(delta, prune) {

    var res = [];
    this.rewind(false).simplify().each(function(p, c, n, i) {
      var e1 = c.subtract(p, true).normalize();
      var e2 = c.subtract(n, true).normalize();

      var r = delta / Math.sin(Math.acos(e1.dot(e2)) / 2);
      var d = e1.add(e2, true).normalize().multiply(r, true);

      var angle = toTAU(e1.angleTo(e2));
      var o = e1.perpDot(e2) < 0 ? c.add(d, true) : c.subtract(d, true);

      if (angle > TAU * .75 || angle < TAU * .25) {

        o.computeSegments = angle;
        c.color = "white"
        c.radius = 3;
      }

      o.point = c;
      res.push(o);
    });


    var parline = function(a, b) {
      var normal = a.subtract(b, true);

      var angle = Vec2(1, 0).angleTo(normal);
      var bisector = Vec2(delta, 0).rotate(angle + Math.PI / 2);

      bisector.add(b);

      var cperp = bisector.add(normal, true);

      var l = new Line2(bisector.x, bisector.y, cperp.x, cperp.y);
      var n = a.add(normal, true);
      var l2 = new Line2(a.x, a.y, n.x, n.y);
      return l;
    }

    var offsetPolygon = new Polygon(res);
    var ret = [];


    offsetPolygon.each(function(p, c, n, i) {

      var isect = segseg(c, c.point, n, n.point);
      if (isect) {

        var pp = offsetPolygon.point(i - 2);
        var nn = offsetPolygon.point(i + 2);

        var ppline = parline(pp.point, p.point);
        var pline = parline(p.point, c.point);
        var nline = parline(c.point, n.point);
        var nnline = parline(n.point, nn.point);
        var computed = pline.intersect(nnline);
        computed.color = "yellow";
        computed.point = c.point;

        ret.push(computed);

      } else {
        ret.push(c);
      }
    });

    return ret.length ? new Polygon(ret) : offsetPolygon;
  }
  line(idx) {
    return [this.point(idx), this.point(idx + 1)];
  }
  lines(fn) {
    var idx = 0;
    this.each(function(p, start, end) {
      fn(start, end, idx++);
    });
    return this;
  }
  selfIntersections() {
    var points = [];
    selfIntersections(this.points, function(isect, i, s, e, i2, s2, e2, unique) {
      if (!unique) return;
      var v = Vec2.fromArray(isect);
      points.push(v);
      v.s = i + (s.subtract(v, true).length() / s.subtract(e, true).length())
      v.b = i2 + (s2.subtract(v, true).length() / s2.subtract(e2, true).length())
      v.si = i;
      v.bi = i2;
      return false;
    });

    return new Polygon(points);
  }
  pruneSelfIntersections() {
    var selfIntersections = this.selfIntersections();

    let belongTo = (s1, b1, s2, b2) => {
      return s1 > s2 && b1 < b2
    }

    let contain = (s1, b1, s2, b2) => {
      return s1 < s2 && b1 > b2;
    }

    let interfere = (s1, b1, s2, b2) => {
      return (s1 < s2 && s2 < b1 && b2 > b1) || (s2 < b1 && b1 < b2 && s1 < s2);
    }

    function Node(value, depth) {
      this.value = value;
      this.depth = this.depth;
      this.children = [];
    }

    // TODO: create tree based on relationship operations
    // TODO: ensure the root node is valid
    var rootVec = this.point(0).clone();
    rootVec.s = 0;
    rootVec.b = (this.points.length - 1) + 0.99;
    var root = new Node(rootVec);
    var last = root;
    var tree = [rootVec];
    selfIntersections.each(function(p, c, n) {
      console.log(
        'belongTo:', belongTo(last.s, last.b, c.s, c.b),
        'contain:', contain(last.s, last.b, c.s, c.b),
        'interfere:', interfere(last.s, last.b, c.s, c.b)
      );

      //if (!contain(1-last.s, 1-last.b, 1-c.s, 1-c.b)) {
      tree.push(c);
      last = c;
    //}
    });

    var ret = [];
    if (tree.length < 2) {
      return [this];
    }

    tree.sort(function(a, b) {
      return a.s - b.s;
    });

    for (var i = 0; i < tree.length; i += 2) {
      var poly = [];
      var next = (i < tree.length - 1) ? tree[i + 1] : null;

      if (next) {

        // collect up to the next isect
        for (var j = Math.floor(tree[i].s); j <= Math.floor(next.s); j++) {
          poly.push(this.point(j));
        }

        poly.push(next);

        // collect up to the next isect
        for (var j = Math.floor(next.b + 1); j <= Math.floor(tree[i].b); j++) {
          poly.push(this.point(j));
        }
      } else {
        poly.push(tree[i])
        for (var k = Math.floor(tree[i].s + 1); k <= Math.floor(tree[i].b); k++) {
          poly.push(this.point(k));
        }
      }
      ret.push(new Polygon(poly));
    }
    return ret;
  }
  clone() {
    var points = [];
    this.each(function(p, c) {
      points.push(c.clone());
    });
    return new Polygon(points);
  }

  rotate(rads, origin, returnNew) {
    origin = origin || this.center;
    var obj = (returnNew) ? this.clone() : this;
    return obj.each(function(p, c) {
      c.subtract(origin).rotate(rads).add(origin);
    });
  }
  translate(vec2, returnNew) {
    var obj = (returnNew) ? this.clone() : this;
    obj.each(function(p, c) {
      c.add(vec2);
    });
    return obj;
  }
  equal(poly) {
    var current = poly.length;
    while (current--) {
      if (!this.point(current).equal(poly.point(current))) {
        return false;
      }
    }
    return true;
  }
  containsCircle(x, y, radius) {
    var position = new Vec2(x, y);
    // Confirm that the x,y is inside of our bounds
    if (!this.containsPoint(position)) {
      return false;
    }
    var closestPoint = this.closestPointTo(position);
    if (closestPoint.distance(position) >= radius) {
      return true;
    }
  }
  contains(thing) {
    if (!thing) {
      return false;
    }
    // Other circles
    if (defined(thing.radius) && thing.position) {
      var radius;
      if (isFunction(thing.radius)) {
        radius = thing.radius();
      } else {
        radius = thing.radius;
      }

      return this.containsCircle(thing.position.x, thing.position.y, radius);

    } else if (typeof thing.points !== 'undefined') {

      var points,
        l;
      if (isFunction(thing.containsPolygon)) {
        points = thing.points;
      } else if (isArray(thing.points)) {
        points = thing.points;
      }

      return this.containsPolygon(points);

    } else if (
      defined(thing.x1) &&
      defined(thing.x2) &&
      defined(thing.y1) &&
      defined(thing.y2)
    ) {
      return this.containsPolygon([
        new Vec2(thing.x1, thing.y1),
        new Vec2(thing.x2, thing.y1),
        new Vec2(thing.x2, thing.y2),
        new Vec2(thing.x1, thing.y2)
      ]);

    } else if (defined(thing.x) && defined(thing.y)) {

      var x2,
        y2;

      if (defined(thing.w) && defined(thing.h)) {
        x2 = thing.x + thing.w;
        y2 = thing.y + thing.h;
      }

      if (defined(thing.width) && defined(thing.height)) {
        x2 = thing.x + thing.width;
        y2 = thing.y + thing.height;
      }

      return this.containsPolygon([
        new Vec2(thing.x, thing.y),
        new Vec2(x2, thing.y),
        new Vec2(x2, y2),
        new Vec2(thing.x, y2)
      ]);
    }
    return false;
  }
  union(other) {
    return new Polygon(
      polygonBoolean(
        this.toArray(),
        other.toArray(),
        'or'
      )[0]
    );
  }

  cut(other) {
    return polygonBoolean(
      this.toArray(),
      other.toArray(),
      'not'
    ).map(r => new Polygon(r));
  }

  intersect(other) {
    return polygonBoolean(
      this.toArray(),
      other.toArray(),
      'and'
    ).map(r => new Polygon(r));
  }
  toArray() {
    var l = this.length;
    var ret = Array(l);
    for (var i = 0; i < l; i++) {
      ret[i] = this.points[i].toArray();
    }
    return ret;
  }
  toString() {
    return this.points.join(',');
  }
  // From https://github.com/kladess/poly-split-js
  findDistance(point) {
    if (!(point instanceof Vec2))
      point = Vec2(point)
    let nearestPoint = this.closestPointTo(point);
    let distance = point.distance(nearestPoint)
    return distance;
  }
  get clear() {
    this.points = [];
  }
  empty() {
    return this.length === 0 ? true : false;
  }
  split(square, cutLine) {
    if (typeof square !== 'number') {
      throw new Error("param square was not defined");
    }
    let polygonSize = this.length;
    let polygon = this;
    if (!polygon.winding) {
      polygon.rewind(true);
    }
    var poly1 = new Polygon();
    var poly2 = new Polygon();
    if (this.area(true) - square <= POLY_SPLIT_EPS) {
      poly1 = this;
      return {
        "value": 0,
        "poly1": poly1,
        "poly2": poly2,
        "cutLine": cutLine
      };
    }
    var minCutLine_exists = 0;
    var minSqLength = Number.MAX_VALUE;
    for (var i = 0; i < polygonSize - 1; i++) {
      for (var j = i + 1; j < polygonSize; j++) {
        let p1 = new Polygon();
        let p2 = new Polygon();
        let subPoly = Polygon.createSubPoly(polygon, i, j, p1, p2);
        p1 = subPoly.poly1;
        p2 = subPoly.poly2;
        let l1 = new LineSegment(polygon.point(i), polygon.point(i + 1));
        let l2 = new LineSegment(polygon.point(j), polygon.point((j + 1) < polygonSize ? (j + 1) : 0));
        let cut = new LineSegment();
        var tempCut = Polygon.cutPolygon(l1, l2, square, p1, p2, cut);
        cut = tempCut.cut;
      }
    }
  }
  static createPolygons(l1, l2, res = new Polygons()) {
    if (!l1 instanceof LineSegment)
      throw new Error("param l1 was not LineSegment type");
    if (!l2 instanceof LineSegment)
      throw new Error("param l2 was not LineSegment type");
    res.bisector = LineSegment.getBisector(l1, l2).result;
    var v1 = l1.getStart(),
      v2 = l1.getEnd(),
      v3 = l2.getStart(),
      v4 = l2.getEnd();
    res.p1_exist = false;
    res.p4_exist = false;
    if (v1 != v4) {
      var l1s = new LineSegment(v1, res.bisector.getLineNearestPoint(v1)),
        p1 = new Vec2(),
        cls_l1sl2 = l1s.crossLineSegment(l2, p1);

      p1 = cls_l1sl2.result;
      res.p1_exist = (cls_l1sl2.value && p1 != v4);
      if (res.p1_exist) {
        res.leftTriangle.insert(v1, res.leftTriangle.length);
        res.leftTriangle.insert(v4, res.leftTriangle.length);
        res.leftTriangle.insert(p1, res.leftTriangle.length);

        res.trapezoid.insert(p1, res.trapezoid.length);
      } else {
        res.trapezoid.insert(v4, res.trapezoid.length);
      }

      var l2e = new LineSegment(v4, res.bisector.getLineNearestPoint(v4)),
        p4 = new Vec2(),
        cls_l2el1 = l2e.crossLineSegment(l1, p4);
      p4 = cls_l2el1.result;
      res.p4_exist = (cls_l2el1.value && p4 != v1);
      if (res.p4_exist) {
        res.leftTriangle.insert(v4, res.leftTriangle.length);
        res.leftTriangle.insert(v1, res.leftTriangle.length);
        res.leftTriangle.insert(p4, res.leftTriangle.length);
        res.trapezoid.insert(p4, res.trapezoid.length);
      } else {
        res.trapezoid.insert(v1, res.trapezoid.length);
      }
    } else {
      res.trapezoid.insert(v4, res.trapezoid.length);
      res.trapezoid.insert(v1, res.trapezoid.length);
    }
    res.p2_exist = false;
    res.p3_exist = false;
    if (v2 != v3) {
      var l2s = new LineSegment(v3, res.bisector.getLineNearestPoint(v3)),
        p3 = new Vec2(),
        cls_l2sl1 = l2s.crossLineSegment(l1, p3);
      p3 = cls_l2sl1.result;
      res.p3_exist = (cls_l2sl1.value && p3 != v2);
      if (res.p3_exist) {
        res.rightTriangle.insert(v3, res.rightTriangle.length);
        res.rightTriangle.insert(v2, res.rightTriangle.length);
        res.rightTriangle.insert(p3, res.rightTriangle.length);

        res.trapezoid.insert(p3, res.trapezoid.length);
      } else {
        res.trapezoid.insert(v2, res.trapezoid.length);
      }

      var l1e = new LineSegment(v2, res.bisector.getLineNearestPoint(v2)),
        p2 = new Vec2(),
        cls_l1el2 = l1e.crossLineSegment(l2, p2);
      p2 = cls_l1el2.result;
      res.p2_exist = (cls_l1el2.value && p2 != v3);
      if (res.p2_exist) {
        res.rightTriangle.insert(v2, res.rightTriangle.length);
        res.rightTriangle.insert(v3, res.rightTriangle.length);
        res.rightTriangle.insert(p2, res.rightTriangle.length);

        res.trapezoid.insert(p2, res.trapezoid.length);
      } else {
        res.trapezoid.insert(v3, res.trapezoid.length);
      }
    } else {
      res.trapezoid.insert(v2, res.trapezoid.length);
      res.trapezoid.insert(v3, res.trapezoid.length);
    }
    res.leftTriangleSquare = res.leftTriangle.area(true);
    res.trapezoidSquare = res.trapezoid.area(true);
    res.rightTriangleSquare = res.rightTriangle.area(true);
    res.totalSquare = res.leftTriangleSquare + res.trapezoidSquare + res.rightTriangleSquare;
    return res;
  }
  static cutPolygon(l1, l2, s, poly1, poly2, cut) {
    if (!l1 instanceof Line2)
      throw new Error("param l1 was not Line2 type");
    if (!l2 instanceof Line2)
      throw new Error("param l2 was not Line2 type");
    if (!poly1 instanceof Polygon)
      throw new Error("param poly1 was not Polygon type");
    if (!poly2 instanceof Polygon)
      throw new Error("param poly2 was not Polygon type");
    if (typeof s !== "number")
      throw new Error("param s was not number type");
    var sn1 = s + poly2.area();
    var sn2 = s + poly1.area();
    if (sn1 > 0) {
      var res = new Polygons();
      res = Polygon.createPolygons(l1, l2, res);
      var findCutLineRes = Polygon.findCutLine(sn1, res, cut),
        cut = findCutLineRes.cutLine;
      if (findCutLineRes.value) {
        return {
          "value": true,
          "cut": cut
        };
      }
    } else if (sn2 > 0) {
        var res = new Polygons();
        res =  Polygon.createPolygons(l2, l1, res);
        var findCutLineRes = Polygon.findCutLine(sn2, res, cut),
            cut= findCutLineRes.cutLine;
        if(findCutLineRes.value)
        {
            cut = cut.reverse();
            return {"value":true, "cut":cut};
        }
    }
  }
  static createSubPoly(poly, line1, line2, poly1, poly2) {
    if (!poly instanceof Polygon) {
      throw new Error("param poly was not Polygon Type");
    }
    poly1 = new Polygon(),
    poly2 = new Polygon();
    var pc1 = line2 - line1;
    for (var i = 1; i <= pc1; i++) {
      poly1.insert(poly.point(i + line1), poly1.size);
    }
    var polySize = poly.size;
    var pc2 = polySize - pc1;
    for (var i = 1; i <= pc2; i++) {
      poly2.insert(poly.point((i + line2) % polySize), poly2.size);
    }
    return {
      "poly1": poly1,
      "poly2": poly2
    };
  }
  // splitNearestEdge(point) {}
  static findCutLine(square, res, cutLine) {
    if (square > res.totalSquare) {
      return {
        "value": false
      };
    }
    console.log(square, res, cutLine);
    if (!res.leftTriangle.empty() && square < res.leftTriangleSquare) {
      var m = square / res.leftTriangleSquare;
      var p = res.leftTriangle.point(1).add(res.leftTriangle.point(2).subtract(res.leftTriangle.point(1)).multiply(m));
      if (res.p1_exist) {
        cutLine = new LineSegment(p, res.leftTriangle.point(0));
        return {
          "value": true,
          "res": res,
          "cutLine": cutLine
        };
      } else if (res.p4_exist) {
        cutLine = new LineSegment(res.leftTriangle.point(0), p);
        return {
          "value": true,
          "res": res,
          "cutLine": cutLine
        };
      }
    } else if (res.leftTriangleSquare < square && square < (res.leftTriangleSquare + res.trapezoidSquare)) {
      var t = new LineSegment(res.trapezoid.point(0), res.trapezoid.point(3));
      var tgA = LineSegment.getTanAngle(t, res.bisector);
      var S = square - res.leftTriangleSquare;
      var m;
      if (Math.abs(tgA) > POLY_SPLIT_EPS) {
        var a = new LineSegment(res.trapezoid.point(0), res.trapezoid.point(1)).length();
        var b = new LineSegment(res.trapezoid.point(2), res.trapezoid.point(3)).length();
        var hh = 2.0 * res.trapezoidSquare / (a + b);
        console.log(res.trapezoid);
        console.log(a,b);
        var d = a * a - 4.0 * tgA * S;
        console.log(a, d, tgA);
        var h = -(-a + Math.sqrt(d)) / (2.0 * tgA);
        console.log(h, hh);
        m = h / hh;
        console.log(m);
      } else {
        m = S / res.trapezoidSquare;
      }
      // console.log(m, res.trapezoidSquare, S, square, tgA);
      // console.log(res.trapezoid.point(0));
      // console.log(res.trapezoid.point(3));
      // console.log(res.trapezoid.point(3).subtract(res.trapezoid.point(0)));
      var p = res.trapezoid.point(0).add(res.trapezoid.point(3).subtract(res.trapezoid.point(0)).multiply(m));
      var pp = res.trapezoid.point(1).add(res.trapezoid.point(2).subtract(res.trapezoid.point(1)).multiply(m));

      cutLine = new LineSegment(p, pp);
      return {
        "value": true,
        "res": res,
        "cutLine": cutLine
      };
    } else if (!res.rightTriangle.empty() && square > res.leftTriangleSquare + res.trapezoidSquare) {
      var S = square - res.leftTriangleSquare - res.trapezoidSquare;
      var m = S / res.rightTriangleSquare;
      var p = res.rightTriangle.point(2).add(res.rightTriangle.point(1).subtract(res.rightTriangle.point(2)).multiply(m));
      if (res.p3_exist) {
        cutLine = new LineSegment(res.rightTriangle.point(0), p);
        return {
          "value": true,
          "res": res,
          "cutLine": cutLine
        };
      } else if (res.p2_exist) {
        cutLine = new LineSegment(p, res.rightTriangle.point(0));
        return {
          "value": true,
          "res": res,
          "cutLine": cutLine
        };
      }
    }
    return {
      "value": false,
      "res": res,
      "cutLine": cutLine
    };
  }
}
const Polygons = class Polygons {
  constructor() {
    this.bisector = new Line2();
    this.leftTriangle = new Polygon();
    this.trapezoid = new Polygon();
    this.rightTriangle = new Polygon();
    this.p1_exist = false;
    this.p2_exist = false;
    this.p3_exist = false;
    this.p4_exist = false;
    this.leftTriangleSquare = 0;
    this.trapezoidSquare = 0;
    this.rightTriangleSquare = 0;
    this.totalSquare = 0;
  }
}
// Export
module.exports = Polygon;
