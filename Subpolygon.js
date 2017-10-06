const Vec2 = require('vec2');
const segseg = require('segseg');
const Line2 = require('line2');
const polygonBoolean = require('2d-polygon-boolean');
const selfIntersections = require('2d-polygon-self-intersections');
const Polygon = require('./polygon.js');
const POLY_SPLIT_EPS = 1E-6;

Polygon.prototype.createSubPoly = function(poly, line1, line2, poly1, poly2) {
	if (! poly instanceof Polygon) {
		throw new Error("poly was not a Polygon")
	}
	poly1 = new Polygon();
	poly2 = new Polygon();
	var pc1 = line2 - line1;
	console.log(pc1);
	for (var i = 1; i <= pc1; i++) {
		poly1.insert(poly.point(i+line1), poly1.length+1);
	}
	console.log(poly1);
	var polySize = poly.length;
    var pc2 = polySize - pc1;
    for(var i = 1; i<= pc2; i++){
        poly2.insert(poly.point((i + line2) % polySize), poly2.length+1);
    }
    return {"poly1":poly1, "poly2": poly2};
};

Polygon.prototype.split = function(square, cutLine) { //square is area
	if (typeof square !== 'number') {
		throw new Error("param square was not defined")
	}
	var polygonSize = this.length;
	var polygon = this;
	if (!polygon.winding()) {
		polygon.rewind(true)
	}
	var poly1 = new Polygon(), poly2 = new Polygon();
	if (polygon.area() - square <= POLY_SPLIT_EPS) {
		poly1 = polygon.clone;
		return {"value":0, "poly1":poly1, "poly2":poly2, "cutLine":cutLine};
	}
	var minCutLine_exists = 0;
    var minSqLength = Number.MAX_VALUE;
    // Loops
    for (var i = 0; i < polygonSize; i++) {
    	for (var j = i+1; j < polygonSize; j++) {
    		var p1 = new Polygon(),
    		p2 = new Polygon();
    		var subPoly = Polygon.createSubPoly(polygon, i, j, p1, p2);
    		p1 = subPoly.poly1;
            p2 = subPoly.poly2;
            var l1 = new Line2(...Object.values(polygon.point(i)), ...Object.values(polygon.point(i + 1)));
            var l2 = new Line2(...Object.values(polygon.point(j)), ...Object.values(polygon.point((j + 1) <polygonSize ? (j + 1) : 0)));
            var cut = new Line2();
            var tempCut =Polygon.getCut(l1, l2, square , p1, p2, cut);
    	}
    }

};
var p = new Polygon([
  Vec2(450, 100),
  Vec2(900, 100),
  Vec2(900, 400),
  Vec2(4500, 400),
]);
console.log(...Object.values(p.point(0)));
// console.log(JSON.stringify(p.createSubPoly(p, 0,3), null, 4));