const Vec2 = require('vec2');
/**
 * Created by jyp on 2016-05-16.
 */

const POLY_SPLIT_EPS = 1E-6;
class LineSegment {
  constructor(a, b, c) {
    this.A = null;
    this.B = null;
    this.C = null;
    this.start = null;
    this.end = null;
    if (typeof a === 'number' && typeof b === 'number' && typeof c === 'number') {
      this.initFromNumbers(a, b, c);
    } else if (a instanceof Vec2 && b instanceof Vec2) {
      this.initFromVec2(a, b);
    }
  }

  initFromVec2(start, end) {
    if (!start instanceof Vec2)
      throw new Error("param start was not Vec2 Type");
    if (!end instanceof Vec2)
      throw new Error("param end was not Vec2 Type");

    this.A = start.y - end.y;
    this.B = end.x - start.x;
    this.C = start.x * end.y - end.x * start.y;
    this.start = start;
    this.end = end;

  }

  initFromNumbers(A, B, C) {
    if (typeof A === "number" && typeof B === "number" && typeof C === "number") {
      this.start = new Vec2();
      this.end = new Vec2();

      if (Math.abs(A) <= POLY_SPLIT_EPS && Math.abs(B) >= POLY_SPLIT_EPS) {
        this.start.x = -1000;
        this.start.y = -(C / B);

        this.end.x = 1000;
        this.end.y = this.start.y;
      } else if (Math.abs(B) <= POLY_SPLIT_EPS && Math.abs(A) >= POLY_SPLIT_EPS) {
        this.start.x = -(C / A);
        this.start.y = -1000;
        this.end.x = this.start.x;
        this.end.y = 1000;
      } else {
        this.start.x = -1000;
        this.start.y = -((A * this.start.x + C) / B);

        this.end.x = 1000;
        this.end.y = -((A * this.end.x + C) / B);
      }
    }
    this.A = A;
    this.B = B;
    this.C = C;
  }
  getStart() {
    return this.start;
  }
  getEnd() {
    return this.end;
  }

  length() {
    var x = this.end.x - this.start.x;
    var y = this.end.y - this.start.y;
    return Math.sqrt(x *x + y *y);
  }

  squareLength() {
    var x = this.end.x - this.start.x;
    var y = this.end.y - this.start.y;
    return (x *x + y *y);
  }
  reverse() {
    return new LineSegment(this.end, this.start);
  }
  getPointAlong(t) {
    var tempVec = this.end.subtract(this.start).normalize().multiply(t);
    var result = this.start.add(tempVec);
    return result;
  }
  getDistance(point) {
    if (typeof point !== 'undefined' && point instanceof Vec2) {
      var n = this.A * point.x + this.B * point.y + this.C;
      var m = Math.sqrt(this.A * this.A + this.B * this.B);
      return Math.abs(n / m);
    }
  }

  getLineNearestPoint(point) {
    if (typeof point !== 'undefined' && point instanceof Vec2) {
      var dir = new Vec2(this.B, -this.A);
      var u = (point.subtract(this.start)).dot(dir) / dir.lengthSquared();
      return this.start.add(dir.multiply(u));
    }
  }
  getSegmentNearestPoint(point) {
    if (typeof point === 'undefined') {
      throw new Error("param point was undefined");
    }
    if (!point instanceof Vec2) {
      throw new Error("param point was not Vec2 Type");
    }
    var dir = new Vec2(this.B, -this.A, 0);
    var u = (point.subtract(this.start)).dot(dir) / dir.lengthSquared();

    if (u < 0)
      return this.start;
    else if (u > 1)
      return this.end;
    else
      return this.start.add(dir.multiply(u));

  }

  pointSide(point) {
    var s = this.A.multiply(point.x - this.start.x).add(B.multiply(point.x - this.start.y));
    return (s > 0 ? 1 : (s < 0 ? -1 : 0));
  }
  crossLineSegment(line) {
    var d = LineSegment.det(this.A, this.B, line.A, line.B);
    var result = new Vec2();
    if (d == 0) return 0;

    result.x = -(LineSegment.det(this.C, this.B, line.C, line.B) / d);
    result.y = -(LineSegment.det(this.A, this.C, line.A, line.C) / d);

    return {
      "result": result,
      "value": LineSegment.inside(result.x, LineSegment.minimum(line.start.x, line.end.x), LineSegment.maximum(line.start.x, line.end.x)) &&
        LineSegment.inside(result.y, LineSegment.minimum(line.start.y, line.end.y), LineSegment.maximum(line.start.y, line.end.y))
    };
  }

  crossSegmentSegment(line) {
    var d = LineSegment.det(this.A, this.B, line.A, line.B);
    var result = new Vec2();
    if (d == 0) return 0;


    result.x = -LineSegment.det(this.C, this.B, line.C, line.B) / d;
    result.y = -LineSegment.det(this.A, this.C, line.A, line.C) / d;

    return {
      "result": result,
      "value": LineSegment.inside(result.x, LineSegment.minimum(this.start.x, this.end.x), LineSegment.maximum(this.start.x, this.end.x)) &&
        LineSegment.inside(result.y, LineSegment.minimum(this.start.y, this.end.y), LineSegment.maximum(this.start.y, this.end.y)) &&
        LineSegment.inside(result.x, LineSegment.minimum(line.start.x, line.end.x), LineSegment.maximum(line.start.x, line.end.x)) &&
        LineSegment.inside(result.y, LineSegment.minimum(line.start.y, line.end.y), LineSegment.maximum(line.start.y, line.end.y))
    };
  }

  crossLineLine(line) {
    var d = LineSegment.det(this.A, this.B, line.A, line.B);
    var result = new Vec2();
    if (d == 0) return 0;

    result.x = -LineSegment.det(this.C, this.B, line.C, line.B) / d;
    result.y = -LineSegment.det(this.A, this.C, line.A, line.C) / d;

    return {
      "result": result,
      "value": 1
    };
  }
  static getBisector(l1, l2) {
    var q1 = Math.sqrt(l1.A * l1.A + l1.B * l1.B);
    var q2 = Math.sqrt(l2.A * l2.A + l2.B * l2.B);

    var A = l1.A / q1 - l2.A / q2;
    var B = l1.B / q1 - l2.B / q2;
    var C = l1.C / q1 - l2.C / q2;

    return {
      "result": new LineSegment(A, B, C),
      "l1": l1,
      "l2": l2
    };
  }
  static directedLine(p, d) {
    if (!p instanceof Vec2)
      throw new Error("param p was not Vec2 Type");
    if (!d instanceof Vec2)
      throw new Error("param d was not Vec2 Type");
    var l = new LineSegment(p, p.add(d));
    return l;
  }
  toString() {
    return "[" + this.A + ", " + this.B + ", " + this.C + "]-{" + this.getStart() + ", " + this.getEnd() + "}"
  }
  static getTanAngle(l1, l2) {
    return (l1.A * l2.B - l2.A * l1.B) / (l1.A * l2.A + l1.B * l2.B);
  }
  static inside(v, min, max) {
    return (((min) <= (v) + (POLY_SPLIT_EPS)) && ((v) <= (max) + (POLY_SPLIT_EPS)));
  }
  static det(a, b, c, d) {
    return (((a) * (d)) - ((b) * (c)));
  }
  static maximum(a, b) {
    return (((a) < (b)) ? (b) : (a))
  }
  static minimum(a, b) {
    return (((a) > (b)) ? (b) : (a))
  }
}

module.exports = LineSegment