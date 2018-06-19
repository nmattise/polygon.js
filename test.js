const Polygon = require("./Polygon.js");
const Vec2 = require("Vec2");
var p = new Polygon([
	Vec2(450, 100),
	Vec2(900, 100),
	Vec2(900, 400),
	Vec2(450, 400)
]);
console.log(p);
console.log(p.area(true));
let desiredArea = p.area(true) / 2;
console.log(desiredArea);
let split = p.splitPolygon(desiredArea);
console.log(split);
split.forEach(p => console.log(p.area(true)));
// console.log(p.centroid);
// console.log(p.center);
// console.log(p.closestPointTo(Vec2(800, 105)));
// console.log(p.findDistance(Vec2(800, 105)));
// console.log(JSON.stringify(Polygon.createSubPoly(p, 0, 2, new Polygon(), new Polygon()), null, 3));
