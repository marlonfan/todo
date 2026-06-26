import { i as e, r as t, t as n } from "./src-q1mJODQi.mjs";
import { A as r, B as i, M as a, T as o, b as s, g as c, x as l, z as u } from "./chunk-CSCIHK7Q-Bm1gw87X.mjs";
import { a as d, r as f, u as p } from "./chunk-5ZQYHXKU-cRTMH84-.mjs";
import { n as m, r as h } from "./chunk-O5CBEL6O-CALp6o7A.mjs";
import { n as g, t as _ } from "./chunk-L5ZTLDWV-KdfSpm4k.mjs";
import { a as v, i as y, r as b, t as x } from "./chunk-NZK2D7GU-CsuOrk0Z.mjs";
import { t as S } from "./rough.esm-CU08Ovhz.mjs";
//#region ../../node_modules/.pnpm/mermaid@11.15.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-3OPIFGDE.mjs
var C = /* @__PURE__ */ t(async (e, t, r) => {
	var i, a, o;
	let s, f = t.useHtmlLabels || c((i = l()) == null ? void 0 : i.htmlLabels);
	s = r || "node default";
	let h = e.insert("g").attr("class", s).attr("id", t.domId || t.id), g = h.insert("g").attr("class", "label").attr("style", p(t.labelStyle)), v;
	v = t.label === void 0 ? "" : typeof t.label == "string" ? t.label : t.label[0];
	let y = !!t.icon || !!t.img, b = t.labelType === "markdown", x = await m(g, u(d(v), l()), {
		useHtmlLabels: f,
		width: t.width || ((a = l().flowchart) == null ? void 0 : a.wrappingWidth),
		classes: b ? "markdown-node-label" : "",
		style: t.labelStyle,
		addSvgBackground: y,
		markdown: b
	}, l()), S = x.getBBox(), C = ((o = t == null ? void 0 : t.padding) == null ? 0 : o) / 2;
	if (f) {
		let e = x.children[0], t = n(x);
		await _(e, v), S = e.getBoundingClientRect(), t.attr("width", S.width), t.attr("height", S.height);
	}
	return f ? g.attr("transform", "translate(" + -S.width / 2 + ", " + -S.height / 2 + ")") : g.attr("transform", "translate(0, " + -S.height / 2 + ")"), t.centerLabel && g.attr("transform", "translate(" + -S.width / 2 + ", " + -S.height / 2 + ")"), g.insert("rect", ":first-child"), {
		shapeSvg: h,
		bbox: S,
		halfPadding: C,
		label: g
	};
}, "labelHelper"), w = /* @__PURE__ */ t(async (e, t, r) => {
	var i, a;
	let s = (i = r.useHtmlLabels) == null ? o(l()) : i, c = e.insert("g").attr("class", "label").attr("style", r.labelStyle || ""), f = await m(c, u(d(t), l()), {
		useHtmlLabels: s,
		width: r.width || ((a = l()) == null || (a = a.flowchart) == null ? void 0 : a.wrappingWidth),
		style: r.labelStyle,
		addSvgBackground: !!r.icon || !!r.img
	}), p = f.getBBox(), h = r.padding / 2;
	if (o(l())) {
		let e = f.children[0], t = n(f);
		p = e.getBoundingClientRect(), t.attr("width", p.width), t.attr("height", p.height);
	}
	return s ? c.attr("transform", "translate(" + -p.width / 2 + ", " + -p.height / 2 + ")") : c.attr("transform", "translate(0, " + -p.height / 2 + ")"), r.centerLabel && c.attr("transform", "translate(" + -p.width / 2 + ", " + -p.height / 2 + ")"), c.insert("rect", ":first-child"), {
		shapeSvg: e,
		bbox: p,
		halfPadding: h,
		label: c
	};
}, "insertLabel"), T = /* @__PURE__ */ t((e, t) => {
	let n = t.node().getBBox();
	e.width = n.width, e.height = n.height;
}, "updateNodeBounds"), E = /* @__PURE__ */ t((e, t) => (e.look === "handDrawn" ? "rough-node" : "node") + " " + e.cssClasses + " " + (t || ""), "getNodeClasses");
function D(e) {
	let t = e.map((e, t) => `${t === 0 ? "M" : "L"}${e.x},${e.y}`);
	return t.push("Z"), t.join(" ");
}
t(D, "createPathFromPoints");
function O(e, t, n, r, i, a) {
	let o = [], s = n - e, c = r - t, l = s / a, u = 2 * Math.PI / l, d = t + c / 2;
	for (let t = 0; t <= 50; t++) {
		let n = e + t / 50 * s, r = d + i * Math.sin(u * (n - e));
		o.push({
			x: n,
			y: r
		});
	}
	return o;
}
t(O, "generateFullSineWavePoints");
function k(e, t, n, r, i, a) {
	let o = [], s = i * Math.PI / 180, c = (a * Math.PI / 180 - s) / (r - 1);
	for (let i = 0; i < r; i++) {
		let r = s + i * c, a = e + n * Math.cos(r), l = t + n * Math.sin(r);
		o.push({
			x: -a,
			y: -l
		});
	}
	return o;
}
t(k, "generateCirclePoints");
function A(e) {
	let n = Array.from(e.childNodes).filter((e) => e.tagName === "path"), r = document.createElementNS("http://www.w3.org/2000/svg", "path"), i = n.map((e) => e.getAttribute("d")).filter((e) => e !== null).join(" ");
	r.setAttribute("d", i);
	let a = n.find((e) => e.getAttribute("fill") !== "none"), o = n.find((e) => e.getAttribute("stroke") !== "none"), s = /* @__PURE__ */ t((e, t) => {
		var n;
		return (n = e == null ? void 0 : e.getAttribute(t)) == null ? void 0 : n;
	}, "getAttr");
	if (a) {
		var c;
		let e = {
			fill: s(a, "fill"),
			"fill-opacity": (c = s(a, "fill-opacity")) == null ? "1" : c
		};
		Object.entries(e).forEach(([e, t]) => {
			t && r.setAttribute(e, t);
		});
	}
	if (o) {
		var l, u;
		let e = {
			stroke: s(o, "stroke"),
			"stroke-width": (l = s(o, "stroke-width")) == null ? "1" : l,
			"stroke-opacity": (u = s(o, "stroke-opacity")) == null ? "1" : u
		};
		Object.entries(e).forEach(([e, t]) => {
			t && r.setAttribute(e, t);
		});
	}
	let d = document.createElementNS("http://www.w3.org/2000/svg", "g");
	return d.appendChild(r), d;
}
t(A, "mergePaths");
var j = /* @__PURE__ */ t((e, t) => {
	var n = e.x, r = e.y, i = t.x - n, a = t.y - r, o = e.width / 2, s = e.height / 2, c, l;
	return Math.abs(a) * o > Math.abs(i) * s ? (a < 0 && (s = -s), c = a === 0 ? 0 : s * i / a, l = s) : (i < 0 && (o = -o), c = o, l = i === 0 ? 0 : o * a / i), {
		x: n + c,
		y: r + l
	};
}, "intersectRect"), M = /* @__PURE__ */ t(async (e, t, n, r = !1, i = !1) => {
	let a = t || "";
	typeof a == "object" && (a = a[0]);
	let s = l(), c = o(s);
	return await m(e, a, {
		style: n,
		isTitle: r,
		useHtmlLabels: c,
		markdown: !1,
		isNode: i,
		width: Infinity
	}, s);
}, "createLabel"), N = /* @__PURE__ */ t((e, t, n, r, i) => [
	"M",
	e + i,
	t,
	"H",
	e + n - i,
	"A",
	i,
	i,
	0,
	0,
	1,
	e + n,
	t + i,
	"V",
	t + r - i,
	"A",
	i,
	i,
	0,
	0,
	1,
	e + n - i,
	t + r,
	"H",
	e + i,
	"A",
	i,
	i,
	0,
	0,
	1,
	e,
	t + r - i,
	"V",
	t + i,
	"A",
	i,
	i,
	0,
	0,
	1,
	e + i,
	t,
	"Z"
].join(" "), "createRoundedRectPathD"), P = /* @__PURE__ */ t(async (t, r) => {
	e.info("Creating subgraph rect for ", r.id, r);
	let i = l(), { themeVariables: a, handDrawnSeed: s } = i, { clusterBkg: c, clusterBorder: u } = a, { labelStyles: d, nodeStyles: f, borderStyles: p, backgroundStyles: h } = y(r), _ = t.insert("g").attr("class", "cluster " + r.cssClasses).attr("id", r.domId).attr("data-look", r.look), b = o(i), x = _.insert("g").attr("class", "cluster-label "), C;
	C = r.labelType === "markdown" ? await m(x, r.label, {
		style: r.labelStyle,
		useHtmlLabels: b,
		isNode: !0,
		width: r.width
	}) : await M(x, r.label, r.labelStyle || "", !1, !0);
	let w = C.getBBox();
	if (o(i)) {
		let e = C.children[0], t = n(C);
		w = e.getBoundingClientRect(), t.attr("width", w.width), t.attr("height", w.height);
	}
	let T = r.width <= w.width + r.padding ? w.width + r.padding : r.width;
	r.width <= w.width + r.padding ? r.diff = (T - r.width) / 2 - r.padding : r.diff = -r.padding;
	let E = r.height, D = r.x - T / 2, O = r.y - E / 2;
	e.trace("Data ", r, JSON.stringify(r));
	let k;
	if (r.look === "handDrawn") {
		let t = S.svg(_), n = v(r, {
			roughness: .7,
			fill: c,
			stroke: u,
			fillWeight: 3,
			seed: s
		}), i = t.path(N(D, O, T, E, 0), n);
		k = _.insert(() => (e.debug("Rough node insert CXC", i), i), ":first-child"), k.select("path:nth-child(2)").attr("style", p.join(";")), k.select("path").attr("style", h.join(";").replace("fill", "stroke"));
	} else k = _.insert("rect", ":first-child"), k.attr("style", f).attr("rx", r.rx).attr("ry", r.ry).attr("x", D).attr("y", O).attr("width", T).attr("height", E);
	let { subGraphTitleTopMargin: A } = g(i);
	if (x.attr("transform", `translate(${r.x - w.width / 2}, ${r.y - r.height / 2 + A})`), d) {
		let e = x.select("span");
		e && e.attr("style", d);
	}
	let P = k.node().getBBox();
	return r.offsetX = 0, r.width = P.width, r.height = P.height, r.offsetY = w.height - r.padding / 2, r.intersect = function(e) {
		return j(r, e);
	}, {
		cluster: _,
		labelBBox: w
	};
}, "rect"), F = {
	rect: P,
	squareRect: P,
	roundedWithTitle: /* @__PURE__ */ t(async (e, t) => {
		let r = l(), { themeVariables: i, handDrawnSeed: a } = r, { altBackground: s, compositeBackground: c, compositeTitleBackground: u, nodeBorder: d } = i, f = e.insert("g").attr("class", t.cssClasses).attr("id", t.domId).attr("data-id", t.id).attr("data-look", t.look), p = f.insert("g", ":first-child"), m = f.insert("g").attr("class", "cluster-label"), h = f.append("rect"), g = await M(m, t.label, t.labelStyle, void 0, !0), _ = g.getBBox();
		if (o(r)) {
			let e = g.children[0], t = n(g);
			_ = e.getBoundingClientRect(), t.attr("width", _.width), t.attr("height", _.height);
		}
		let v = 0 * t.padding, y = v / 2, b = (t.width <= _.width + t.padding ? _.width + t.padding : t.width) + v;
		t.width <= _.width + t.padding ? t.diff = (b - t.width) / 2 - t.padding : t.diff = -t.padding;
		let x = t.height + v, C = t.height + v - _.height - 6, w = t.x - b / 2, T = t.y - x / 2;
		t.width = b;
		let E = t.y - t.height / 2 - y + _.height + 2, D;
		if (t.look === "handDrawn") {
			let e = t.cssClasses.includes("statediagram-cluster-alt"), n = S.svg(f), r = t.rx || t.ry ? n.path(N(w, T, b, x, 10), {
				roughness: .7,
				fill: u,
				fillStyle: "solid",
				stroke: d,
				seed: a
			}) : n.rectangle(w, T, b, x, { seed: a });
			D = f.insert(() => r, ":first-child");
			let i = n.rectangle(w, E, b, C, {
				fill: e ? s : c,
				fillStyle: e ? "hachure" : "solid",
				stroke: d,
				seed: a
			});
			D = f.insert(() => r, ":first-child"), h = f.insert(() => i);
		} else D = p.insert("rect", ":first-child"), D.attr("class", "outer").attr("x", w).attr("y", T).attr("width", b).attr("height", x).attr("data-look", t.look), h.attr("class", "inner").attr("x", w).attr("y", E).attr("width", b).attr("height", C);
		return m.attr("transform", `translate(${t.x - _.width / 2}, ${T + 1 - (o(r) ? 0 : 3)})`), t.height = D.node().getBBox().height, t.offsetX = 0, t.offsetY = _.height - t.padding / 2, t.labelBBox = _, t.intersect = function(e) {
			return j(t, e);
		}, {
			cluster: f,
			labelBBox: _
		};
	}, "roundedWithTitle"),
	noteGroup: /* @__PURE__ */ t((e, t) => {
		let n = e.insert("g").attr("class", "note-cluster").attr("id", t.domId), r = n.insert("rect", ":first-child"), i = 0 * t.padding, a = i / 2;
		r.attr("rx", t.rx).attr("ry", t.ry).attr("x", t.x - t.width / 2 - a).attr("y", t.y - t.height / 2 - a).attr("width", t.width + i).attr("height", t.height + i).attr("fill", "none");
		let o = r.node().getBBox();
		return t.width = o.width, t.height = o.height, t.intersect = function(e) {
			return j(t, e);
		}, {
			cluster: n,
			labelBBox: {
				width: 0,
				height: 0
			}
		};
	}, "noteGroup"),
	divider: /* @__PURE__ */ t((e, t) => {
		let { themeVariables: n, handDrawnSeed: r } = l(), { nodeBorder: i } = n, a = e.insert("g").attr("class", t.cssClasses).attr("id", t.domId).attr("data-look", t.look), o = a.insert("g", ":first-child"), s = 0 * t.padding, c = t.width + s;
		t.diff = -t.padding;
		let u = t.height + s, d = t.x - c / 2, f = t.y - u / 2;
		t.width = c;
		let p;
		if (t.look === "handDrawn") {
			let e = S.svg(a).rectangle(d, f, c, u, {
				fill: "lightgrey",
				roughness: .5,
				strokeLineDash: [5],
				stroke: i,
				seed: r
			});
			p = a.insert(() => e, ":first-child");
		} else {
			p = o.insert("rect", ":first-child");
			let e = "outer";
			e = (t.look, "divider"), p.attr("class", e).attr("x", d).attr("y", f).attr("width", c).attr("height", u).attr("data-look", t.look);
		}
		return t.height = p.node().getBBox().height, t.offsetX = 0, t.offsetY = 0, t.intersect = function(e) {
			return j(t, e);
		}, {
			cluster: a,
			labelBBox: {}
		};
	}, "divider"),
	kanbanSection: /* @__PURE__ */ t(async (t, r) => {
		e.info("Creating subgraph rect for ", r.id, r);
		let i = l(), { themeVariables: a, handDrawnSeed: s } = i, { clusterBkg: c, clusterBorder: u } = a, { labelStyles: d, nodeStyles: f, borderStyles: p, backgroundStyles: h } = y(r), _ = t.insert("g").attr("class", "cluster " + r.cssClasses).attr("id", r.domId).attr("data-look", r.look), b = o(i), x = _.insert("g").attr("class", "cluster-label "), C = await m(x, r.label, {
			style: r.labelStyle,
			useHtmlLabels: b,
			isNode: !0,
			width: r.width
		}), w = C.getBBox();
		if (o(i)) {
			let e = C.children[0], t = n(C);
			w = e.getBoundingClientRect(), t.attr("width", w.width), t.attr("height", w.height);
		}
		let T = r.width <= w.width + r.padding ? w.width + r.padding : r.width;
		r.width <= w.width + r.padding ? r.diff = (T - r.width) / 2 - r.padding : r.diff = -r.padding;
		let E = r.height, D = r.x - T / 2, O = r.y - E / 2;
		e.trace("Data ", r, JSON.stringify(r));
		let k;
		if (r.look === "handDrawn") {
			let t = S.svg(_), n = v(r, {
				roughness: .7,
				fill: c,
				stroke: u,
				fillWeight: 4,
				seed: s
			}), i = t.path(N(D, O, T, E, r.rx), n);
			k = _.insert(() => (e.debug("Rough node insert CXC", i), i), ":first-child"), k.select("path:nth-child(2)").attr("style", p.join(";")), k.select("path").attr("style", h.join(";").replace("fill", "stroke"));
		} else k = _.insert("rect", ":first-child"), k.attr("style", f).attr("rx", r.rx).attr("ry", r.ry).attr("x", D).attr("y", O).attr("width", T).attr("height", E);
		let { subGraphTitleTopMargin: A } = g(i);
		if (x.attr("transform", `translate(${r.x - w.width / 2}, ${r.y - r.height / 2 + A})`), d) {
			let e = x.select("span");
			e && e.attr("style", d);
		}
		let M = k.node().getBBox();
		return r.offsetX = 0, r.width = M.width, r.height = M.height, r.offsetY = w.height - r.padding / 2, r.intersect = function(e) {
			return j(r, e);
		}, {
			cluster: _,
			labelBBox: w
		};
	}, "kanbanSection")
}, I = /* @__PURE__ */ new Map(), L = /* @__PURE__ */ t(async (e, t) => {
	let n = await F[t.shape || "rect"](e, t);
	return I.set(t.id, n), n;
}, "insertCluster"), R = /* @__PURE__ */ t(() => {
	I = /* @__PURE__ */ new Map();
}, "clear");
function z(e, t) {
	return e.intersect(t);
}
t(z, "intersectNode");
var B = z;
function V(e, t, n, r) {
	var i = e.x, a = e.y, o = i - r.x, s = a - r.y, c = Math.sqrt(t * t * s * s + n * n * o * o), l = Math.abs(t * n * o / c);
	r.x < i && (l = -l);
	var u = Math.abs(t * n * s / c);
	return r.y < a && (u = -u), {
		x: i + l,
		y: a + u
	};
}
t(V, "intersectEllipse");
var H = V;
function U(e, t, n) {
	return H(e, t, t, n);
}
t(U, "intersectCircle");
var W = U;
function ee(e, t, n, r) {
	{
		let i = t.y - e.y, a = e.x - t.x, o = t.x * e.y - e.x * t.y, s = i * n.x + a * n.y + o, c = i * r.x + a * r.y + o, l = 1e-6;
		if (s !== 0 && c !== 0 && te(s, c)) return;
		let u = r.y - n.y, d = n.x - r.x, f = r.x * n.y - n.x * r.y, p = u * e.x + d * e.y + f, m = u * t.x + d * t.y + f;
		if (Math.abs(p) < l && Math.abs(m) < l && te(p, m)) return;
		let h = i * d - u * a;
		if (h === 0) return;
		let g = Math.abs(h / 2), _ = a * f - d * o, v = _ < 0 ? (_ - g) / h : (_ + g) / h;
		return _ = u * o - i * f, {
			x: v,
			y: _ < 0 ? (_ - g) / h : (_ + g) / h
		};
	}
}
t(ee, "intersectLine");
function te(e, t) {
	return e * t > 0;
}
t(te, "sameSign");
var G = ee;
function K(e, t, n) {
	let r = e.x, i = e.y, a = [], o = Infinity, s = Infinity;
	typeof t.forEach == "function" ? t.forEach(function(e) {
		o = Math.min(o, e.x), s = Math.min(s, e.y);
	}) : (o = Math.min(o, t.x), s = Math.min(s, t.y));
	let c = r - e.width / 2 - o, l = i - e.height / 2 - s;
	for (let r = 0; r < t.length; r++) {
		let i = t[r], o = t[r < t.length - 1 ? r + 1 : 0], s = G(e, n, {
			x: c + i.x,
			y: l + i.y
		}, {
			x: c + o.x,
			y: l + o.y
		});
		s && a.push(s);
	}
	return a.length ? (a.length > 1 && a.sort(function(e, t) {
		let r = e.x - n.x, i = e.y - n.y, a = Math.sqrt(r * r + i * i), o = t.x - n.x, s = t.y - n.y, c = Math.sqrt(o * o + s * s);
		return a < c ? -1 : a === c ? 0 : 1;
	}), a[0]) : e;
}
t(K, "intersectPolygon");
var q = {
	node: B,
	circle: W,
	ellipse: H,
	polygon: K,
	rect: j
};
function ne(t, n) {
	let { labelStyles: r } = y(n);
	n.labelStyle = r;
	let i = E(n), a = i;
	i || (a = "anchor");
	let o = t.insert("g").attr("class", a).attr("id", n.domId || n.id), { cssStyles: s } = n, c = S.svg(o), l = v(n, {
		fill: "black",
		stroke: "none",
		fillStyle: "solid"
	});
	n.look !== "handDrawn" && (l.roughness = 0);
	let u = c.circle(0, 0, 2, l), d = o.insert(() => u, ":first-child");
	return d.attr("class", "anchor").attr("style", p(s)), T(n, d), n.intersect = function(t) {
		return e.info("Circle intersect", n, 1, t), q.circle(n, 1, t);
	}, o;
}
t(ne, "anchor");
function re(e, t, n, r, i, a, o) {
	let s = (e + n) / 2, c = (t + r) / 2, l = Math.atan2(r - t, n - e), u = (n - e) / 2, d = (r - t) / 2, f = u / i, p = d / a, m = Math.sqrt(f ** 2 + p ** 2);
	if (m > 1) throw Error("The given radii are too small to create an arc between the points.");
	let h = Math.sqrt(1 - m ** 2), g = s + h * a * Math.sin(l) * (o ? -1 : 1), _ = c - h * i * Math.cos(l) * (o ? -1 : 1), v = Math.atan2((t - _) / a, (e - g) / i), y = Math.atan2((r - _) / a, (n - g) / i) - v;
	o && y < 0 && (y += 2 * Math.PI), !o && y > 0 && (y -= 2 * Math.PI);
	let b = [];
	for (let e = 0; e < 20; e++) {
		let t = v + e / 19 * y, n = g + i * Math.cos(t), r = _ + a * Math.sin(t);
		b.push({
			x: n,
			y: r
		});
	}
	return b;
}
t(re, "generateArcPoints");
function ie(e, t, n) {
	let [r, i] = [t, n].sort((e, t) => t - e);
	return i * (1 - Math.sqrt(1 - (e / r / 2) ** 2));
}
t(ie, "calculateArcSagitta");
async function J(e, n) {
	var r;
	let { labelStyles: i, nodeStyles: a } = y(n);
	n.labelStyle = i;
	let o = (r = n.padding) == null ? 0 : r, s = n.look === "neo" ? 16 : o, c = n.look === "neo" ? 12 : o, l = /* @__PURE__ */ t((e) => e + c, "calcTotalHeight"), u = /* @__PURE__ */ t((e) => {
		let t = e / 2;
		return [t / (2.5 + e / 50), t];
	}, "calcEllipseRadius"), { shapeSvg: d, bbox: f } = await C(e, n, E(n)), p = l(n != null && n.height ? n == null ? void 0 : n.height : f.height), [m, h] = u(p), g = ie(p, m, h), _ = (n != null && n.width ? n == null ? void 0 : n.width : f.width) + s * 2 + g - g, b = p, { cssStyles: x } = n, w = [
		{
			x: _ / 2,
			y: -b / 2
		},
		{
			x: -_ / 2,
			y: -b / 2
		},
		...re(-_ / 2, -b / 2, -_ / 2, b / 2, m, h, !1),
		{
			x: _ / 2,
			y: b / 2
		},
		...re(_ / 2, b / 2, _ / 2, -b / 2, m, h, !0)
	], O = S.svg(d), k = v(n, {});
	n.look !== "handDrawn" && (k.roughness = 0, k.fillStyle = "solid");
	let A = D(w), j = O.path(A, k), M = d.insert(() => j, ":first-child");
	return M.attr("class", "basic label-container outer-path"), x && n.look !== "handDrawn" && M.selectAll("path").attr("style", x), a && n.look !== "handDrawn" && M.selectAll("path").attr("style", a), M.attr("transform", `translate(${m / 2}, 0)`), T(n, M), n.intersect = function(e) {
		return q.polygon(n, w, e);
	}, d;
}
t(J, "bowTieRect");
function Y(e, t, n, r) {
	return e.insert("polygon", ":first-child").attr("points", r.map(function(e) {
		return e.x + "," + e.y;
	}).join(" ")).attr("class", "label-container").attr("transform", "translate(" + -t / 2 + "," + n / 2 + ")");
}
t(Y, "insertPolygonShape");
var ae = 12;
async function oe(e, t) {
	var n, r, i;
	let { labelStyles: a, nodeStyles: o } = y(t);
	t.labelStyle = a;
	let s = (n = t.padding) == null ? 0 : n, c = t.look === "neo" ? 28 : s, l = t.look === "neo" ? 24 : s, { shapeSvg: u, bbox: d } = await C(e, t, E(t)), f = ((r = t == null ? void 0 : t.width) == null ? d.width : r) + (t.look === "neo" ? c * 2 : c + ae), p = ((i = t == null ? void 0 : t.height) == null ? d.height : i) + (t.look === "neo" ? l * 2 : l), m = f, h = -p, g = [
		{
			x: 0 + ae,
			y: h
		},
		{
			x: m,
			y: h
		},
		{
			x: m,
			y: 0
		},
		{
			x: 0,
			y: 0
		},
		{
			x: 0,
			y: h + ae
		},
		{
			x: 0 + ae,
			y: h
		}
	], _, { cssStyles: b } = t;
	if (t.look === "handDrawn") {
		let e = S.svg(u), n = v(t, {}), r = D(g), i = e.path(r, n);
		_ = u.insert(() => i, ":first-child").attr("transform", `translate(${-f / 2}, ${p / 2})`), b && _.attr("style", b);
	} else _ = Y(u, f, p, g);
	return o && _.attr("style", o), T(t, _), t.intersect = function(e) {
		return q.polygon(t, g, e);
	}, u;
}
t(oe, "card");
function se(e, t) {
	var n, r;
	let { nodeStyles: i } = y(t);
	t.label = "";
	let a = e.insert("g").attr("class", E(t)).attr("id", (n = t.domId) == null ? t.id : n), { cssStyles: o } = t, s = Math.max(28, (r = t.width) == null ? 0 : r), c = [
		{
			x: 0,
			y: s / 2
		},
		{
			x: s / 2,
			y: 0
		},
		{
			x: 0,
			y: -s / 2
		},
		{
			x: -s / 2,
			y: 0
		}
	], l = S.svg(a), u = v(t, {});
	t.look !== "handDrawn" && (u.roughness = 0, u.fillStyle = "solid");
	let d = D(c), f = l.path(d, u), p = a.insert(() => f, ":first-child");
	return o && t.look !== "handDrawn" && p.selectAll("path").attr("style", o), i && t.look !== "handDrawn" && p.selectAll("path").attr("style", i), t.width = 28, t.height = 28, t.intersect = function(e) {
		return q.polygon(t, c, e);
	}, a;
}
t(se, "choice");
async function ce(t, n, r) {
	var i;
	let { labelStyles: a, nodeStyles: o } = y(n);
	n.labelStyle = a;
	let { shapeSvg: s, bbox: c, halfPadding: l } = await C(t, n, E(n)), u = (i = r == null ? void 0 : r.padding) == null ? l : i, d = n.look === "neo" ? c.width / 2 + 32 : c.width / 2 + u, f, { cssStyles: m } = n;
	if (n.look === "handDrawn") {
		let e = S.svg(s), t = v(n, {}), r = e.circle(0, 0, d * 2, t);
		f = s.insert(() => r, ":first-child"), f.attr("class", "basic label-container").attr("style", p(m));
	} else f = s.insert("circle", ":first-child").attr("class", "basic label-container").attr("style", o).attr("r", d).attr("cx", 0).attr("cy", 0);
	return T(n, f), n.calcIntersect = function(e, t) {
		let n = e.width / 2;
		return q.circle(e, n, t);
	}, n.intersect = function(t) {
		return e.info("Circle intersect", n, d, t), q.circle(n, d, t);
	}, s;
}
t(ce, "circle");
function X(e) {
	let t = Math.cos(Math.PI / 4), n = Math.sin(Math.PI / 4), r = e * 2, i = {
		x: r / 2 * t,
		y: r / 2 * n
	}, a = {
		x: -(r / 2) * t,
		y: r / 2 * n
	}, o = {
		x: -(r / 2) * t,
		y: -(r / 2) * n
	}, s = {
		x: r / 2 * t,
		y: -(r / 2) * n
	};
	return `M ${a.x},${a.y} L ${s.x},${s.y}
                   M ${i.x},${i.y} L ${o.x},${o.y}`;
}
t(X, "createLine");
function Z(t, n) {
	var r, i;
	let { labelStyles: a, nodeStyles: o } = y(n);
	n.labelStyle = a, n.label = "";
	let s = t.insert("g").attr("class", E(n)).attr("id", (r = n.domId) == null ? n.id : r), c = Math.max(30, (i = n == null ? void 0 : n.width) == null ? 0 : i), { cssStyles: l } = n, u = S.svg(s), d = v(n, {});
	n.look !== "handDrawn" && (d.roughness = 0, d.fillStyle = "solid");
	let f = u.circle(0, 0, c * 2, d), p = X(c), m = u.path(p, d), h = s.insert(() => f, ":first-child");
	return h.insert(() => m), h.attr("class", "outer-path"), l && n.look !== "handDrawn" && h.selectAll("path").attr("style", l), o && n.look !== "handDrawn" && h.selectAll("path").attr("style", o), T(n, h), n.intersect = function(t) {
		return e.info("crossedCircle intersect", n, {
			radius: c,
			point: t
		}), q.circle(n, c, t);
	}, s;
}
t(Z, "crossedCircle");
function le(e, t, n, r = 100, i = 0, a = 180) {
	let o = [], s = i * Math.PI / 180, c = (a * Math.PI / 180 - s) / (r - 1);
	for (let i = 0; i < r; i++) {
		let r = s + i * c, a = e + n * Math.cos(r), l = t + n * Math.sin(r);
		o.push({
			x: -a,
			y: -l
		});
	}
	return o;
}
t(le, "generateCirclePoints");
async function ue(e, t) {
	var n, r, i, a, o;
	let { labelStyles: s, nodeStyles: c } = y(t);
	t.labelStyle = s;
	let { shapeSvg: l, bbox: u, label: d } = await C(e, t, E(t)), f = t.look === "neo" ? 18 : (n = t.padding) == null ? 0 : n, p = t.look === "neo" ? 12 : (r = t.padding) == null ? 0 : r, m = u.width + f, h = u.height + p, g = Math.max(5, h * .1), { cssStyles: _ } = t, b = [
		...le(m / 2, -h / 2, g, 30, -90, 0),
		{
			x: -m / 2 - g,
			y: g
		},
		...le(m / 2 + g * 2, -g, g, 20, -180, -270),
		...le(m / 2 + g * 2, g, g, 20, -90, -180),
		{
			x: -m / 2 - g,
			y: -h / 2
		},
		...le(m / 2, h / 2, g, 20, 0, 90)
	], x = [
		{
			x: m / 2,
			y: -h / 2 - g
		},
		{
			x: -m / 2,
			y: -h / 2 - g
		},
		...le(m / 2, -h / 2, g, 20, -90, 0),
		{
			x: -m / 2 - g,
			y: -g
		},
		...le(m / 2 + m * .1, -g, g, 20, -180, -270),
		...le(m / 2 + m * .1, g, g, 20, -90, -180),
		{
			x: -m / 2 - g,
			y: h / 2
		},
		...le(m / 2, h / 2, g, 20, 0, 90),
		{
			x: -m / 2,
			y: h / 2 + g
		},
		{
			x: m / 2,
			y: h / 2 + g
		}
	], w = S.svg(l), O = v(t, { fill: "none" });
	t.look !== "handDrawn" && (O.roughness = 0, O.fillStyle = "solid");
	let k = D(b).replace("Z", ""), A = w.path(k, O), j = D(x), M = w.path(j, { ...O }), N = l.insert("g", ":first-child");
	return N.insert(() => M, ":first-child").attr("stroke-opacity", 0), N.insert(() => A, ":first-child"), N.attr("class", "text"), _ && t.look !== "handDrawn" && N.selectAll("path").attr("style", _), c && t.look !== "handDrawn" && N.selectAll("path").attr("style", c), N.attr("transform", `translate(${g}, 0)`), d.attr("transform", `translate(${-m / 2 + g - (u.x - ((i = u.left) == null ? 0 : i))},${-h / 2 + ((a = t.padding) == null ? 0 : a) / 2 - (u.y - ((o = u.top) == null ? 0 : o))})`), T(t, N), t.intersect = function(e) {
		return q.polygon(t, x, e);
	}, l;
}
t(ue, "curlyBraceLeft");
function de(e, t, n, r = 100, i = 0, a = 180) {
	let o = [], s = i * Math.PI / 180, c = (a * Math.PI / 180 - s) / (r - 1);
	for (let i = 0; i < r; i++) {
		let r = s + i * c, a = e + n * Math.cos(r), l = t + n * Math.sin(r);
		o.push({
			x: a,
			y: l
		});
	}
	return o;
}
t(de, "generateCirclePoints");
async function fe(e, t) {
	var n, r, i, a, o, s;
	let { labelStyles: c, nodeStyles: l } = y(t);
	t.labelStyle = c;
	let { shapeSvg: u, bbox: d, label: f } = await C(e, t, E(t)), p = t.look === "neo" ? 18 : (n = t.padding) == null ? 0 : n, m = t.look === "neo" ? 12 : (r = t.padding) == null ? 0 : r, h = d.width + (t.look === "neo" ? p * 2 : p), g = d.height + (t.look === "neo" ? m * 2 : m), _ = Math.max(5, g * .1), { cssStyles: b } = t, x = [
		...de(h / 2, -g / 2, _, 20, -90, 0),
		{
			x: h / 2 + _,
			y: -_
		},
		...de(h / 2 + _ * 2, -_, _, 20, -180, -270),
		...de(h / 2 + _ * 2, _, _, 20, -90, -180),
		{
			x: h / 2 + _,
			y: g / 2
		},
		...de(h / 2, g / 2, _, 20, 0, 90)
	], w = [
		{
			x: -h / 2,
			y: -g / 2 - _
		},
		{
			x: h / 2,
			y: -g / 2 - _
		},
		...de(h / 2, -g / 2, _, 20, -90, 0),
		{
			x: h / 2 + _,
			y: -_
		},
		...de(h / 2 + _ * 2, -_, _, 20, -180, -270),
		...de(h / 2 + _ * 2, _, _, 20, -90, -180),
		{
			x: h / 2 + _,
			y: g / 2
		},
		...de(h / 2, g / 2, _, 20, 0, 90),
		{
			x: h / 2,
			y: g / 2 + _
		},
		{
			x: -h / 2,
			y: g / 2 + _
		}
	], O = S.svg(u), k = v(t, { fill: "none" });
	t.look !== "handDrawn" && (k.roughness = 0, k.fillStyle = "solid");
	let A = D(x).replace("Z", ""), j = O.path(A, k), M = D(w), N = O.path(M, { ...k }), P = u.insert("g", ":first-child");
	return P.insert(() => N, ":first-child").attr("stroke-opacity", 0), P.insert(() => j, ":first-child"), P.attr("class", "text"), b && t.look !== "handDrawn" && P.selectAll("path").attr("style", b), l && t.look !== "handDrawn" && P.selectAll("path").attr("style", l), P.attr("transform", `translate(${-_}, 0)`), f.attr("transform", `translate(${-h / 2 + ((i = t.padding) == null ? 0 : i) / 2 - (d.x - ((a = d.left) == null ? 0 : a))},${-g / 2 + ((o = t.padding) == null ? 0 : o) / 2 - (d.y - ((s = d.top) == null ? 0 : s))})`), T(t, P), t.intersect = function(e) {
		return q.polygon(t, w, e);
	}, u;
}
t(fe, "curlyBraceRight");
function Q(e, t, n, r = 100, i = 0, a = 180) {
	let o = [], s = i * Math.PI / 180, c = (a * Math.PI / 180 - s) / (r - 1);
	for (let i = 0; i < r; i++) {
		let r = s + i * c, a = e + n * Math.cos(r), l = t + n * Math.sin(r);
		o.push({
			x: -a,
			y: -l
		});
	}
	return o;
}
t(Q, "generateCirclePoints");
async function pe(e, t) {
	var n, r, i, a, o, s;
	let { labelStyles: c, nodeStyles: l } = y(t);
	t.labelStyle = c;
	let { shapeSvg: u, bbox: d, label: f } = await C(e, t, E(t)), p = t.look === "neo" ? 18 : (n = t.padding) == null ? 0 : n, m = t.look === "neo" ? 12 : (r = t.padding) == null ? 0 : r, h = d.width + (t.look === "neo" ? p * 2 : p), g = d.height + (t.look === "neo" ? m * 2 : m), _ = Math.max(5, g * .1), { cssStyles: b } = t, x = [
		...Q(h / 2, -g / 2, _, 30, -90, 0),
		{
			x: -h / 2 - _,
			y: _
		},
		...Q(h / 2 + _ * 2, -_, _, 20, -180, -270),
		...Q(h / 2 + _ * 2, _, _, 20, -90, -180),
		{
			x: -h / 2 - _,
			y: -g / 2
		},
		...Q(h / 2, g / 2, _, 20, 0, 90)
	], w = [
		...Q(-h / 2 + _ + _ / 2, -g / 2, _, 20, -90, -180),
		{
			x: h / 2 - _ / 2,
			y: _
		},
		...Q(-h / 2 - _ / 2, -_, _, 20, 0, 90),
		...Q(-h / 2 - _ / 2, _, _, 20, -90, 0),
		{
			x: h / 2 - _ / 2,
			y: -_
		},
		...Q(-h / 2 + _ + _ / 2, g / 2, _, 30, -180, -270)
	], O = [
		{
			x: h / 2,
			y: -g / 2 - _
		},
		{
			x: -h / 2,
			y: -g / 2 - _
		},
		...Q(h / 2, -g / 2, _, 20, -90, 0),
		{
			x: -h / 2 - _,
			y: -_
		},
		...Q(h / 2 + _ * 2, -_, _, 20, -180, -270),
		...Q(h / 2 + _ * 2, _, _, 20, -90, -180),
		{
			x: -h / 2 - _,
			y: g / 2
		},
		...Q(h / 2, g / 2, _, 20, 0, 90),
		{
			x: -h / 2,
			y: g / 2 + _
		},
		{
			x: h / 2 - _ - _ / 2,
			y: g / 2 + _
		},
		...Q(-h / 2 + _ + _ / 2, -g / 2, _, 20, -90, -180),
		{
			x: h / 2 - _ / 2,
			y: _
		},
		...Q(-h / 2 - _ / 2, -_, _, 20, 0, 90),
		...Q(-h / 2 - _ / 2, _, _, 20, -90, 0),
		{
			x: h / 2 - _ / 2,
			y: -_
		},
		...Q(-h / 2 + _ + _ / 2, g / 2, _, 30, -180, -270)
	], k = S.svg(u), A = v(t, { fill: "none" });
	t.look !== "handDrawn" && (A.roughness = 0, A.fillStyle = "solid");
	let j = D(x).replace("Z", ""), M = k.path(j, A), N = D(w).replace("Z", ""), P = k.path(N, A), F = D(O), I = k.path(F, { ...A }), L = u.insert("g", ":first-child");
	return L.insert(() => I, ":first-child").attr("stroke-opacity", 0), L.insert(() => M, ":first-child"), L.insert(() => P, ":first-child"), L.attr("class", "text"), b && t.look !== "handDrawn" && L.selectAll("path").attr("style", b), l && t.look !== "handDrawn" && L.selectAll("path").attr("style", l), L.attr("transform", `translate(${_ - _ / 4}, 0)`), f.attr("transform", `translate(${-h / 2 + ((i = t.padding) == null ? 0 : i) / 2 - (d.x - ((a = d.left) == null ? 0 : a))},${-g / 2 + ((o = t.padding) == null ? 0 : o) / 2 - (d.y - ((s = d.top) == null ? 0 : s))})`), T(t, L), t.intersect = function(e) {
		return q.polygon(t, O, e);
	}, u;
}
t(pe, "curlyBraces");
async function me(e, t) {
	var n, r, i;
	let { labelStyles: a, nodeStyles: o } = y(t);
	t.labelStyle = a;
	let s = (n = t.padding) == null ? 0 : n, c = t.look === "neo" ? 16 : s, l = t.look === "neo" ? 12 : s, { shapeSvg: u, bbox: d } = await C(e, t, E(t)), f = Math.max(20, (d.width + c * 2) * 1.25, (r = t == null ? void 0 : t.width) == null ? 0 : r), p = Math.max(5, d.height + l * 2, (i = t == null ? void 0 : t.height) == null ? 0 : i), m = p / 2, { cssStyles: h } = t, g = S.svg(u), _ = v(t, {});
	t.look !== "handDrawn" && (_.roughness = 0, _.fillStyle = "solid");
	let b = f, x = p, w = b - m, O = x / 4, A = [
		{
			x: w,
			y: 0
		},
		{
			x: O,
			y: 0
		},
		{
			x: 0,
			y: x / 2
		},
		{
			x: O,
			y: x
		},
		{
			x: w,
			y: x
		},
		...k(-w, -x / 2, m, 50, 270, 90)
	], j = D(A), M = g.path(j, _), N = u.insert(() => M, ":first-child");
	return N.attr("class", "basic label-container outer-path"), h && t.look !== "handDrawn" && N.selectChildren("path").attr("style", h), o && t.look !== "handDrawn" && N.selectChildren("path").attr("style", o), N.attr("transform", `translate(${-f / 2}, ${-p / 2})`), T(t, N), t.intersect = function(e) {
		return q.polygon(t, A, e);
	}, u;
}
t(me, "curvedTrapezoid");
var he = /* @__PURE__ */ t((e, t, n, r, i, a) => [
	`M${e},${t + a}`,
	`a${i},${a} 0,0,0 ${n},0`,
	`a${i},${a} 0,0,0 ${-n},0`,
	`l0,${r}`,
	`a${i},${a} 0,0,0 ${n},0`,
	`l0,${-r}`
].join(" "), "createCylinderPathD"), ge = /* @__PURE__ */ t((e, t, n, r, i, a) => [
	`M${e},${t + a}`,
	`M${e + n},${t + a}`,
	`a${i},${a} 0,0,0 ${-n},0`,
	`l0,${r}`,
	`a${i},${a} 0,0,0 ${n},0`,
	`l0,${-r}`
].join(" "), "createOuterCylinderPathD"), _e = /* @__PURE__ */ t((e, t, n, r, i, a) => [`M${e - n / 2},${-r / 2}`, `a${i},${a} 0,0,0 ${n},0`].join(" "), "createInnerCylinderPathD"), ve = 8, ye = 8;
async function be(e, t) {
	var n, r, i, a;
	let { labelStyles: o, nodeStyles: s } = y(t);
	t.labelStyle = o;
	let c = (n = t.padding) == null ? 0 : n, l = t.look === "neo" ? 24 : c, u = t.look === "neo" ? 24 : c;
	if (t.width || t.height) {
		var d, f, m;
		let e = (d = t.width) == null ? 0 : d;
		t.width = ((f = t.width) == null ? 0 : f) - u, t.width < ye && (t.width = ye);
		let n = e / 2 / (2.5 + e / 50);
		t.height = ((m = t.height) == null ? 0 : m) - l - n * 3, t.height < ve && (t.height = ve);
	}
	let { shapeSvg: h, bbox: g, label: _ } = await C(e, t, E(t)), b = (t.width ? t.width : g.width) + u, x = b / 2, w = x / (2.5 + b / 50), D = (t.height ? t.height : g.height) + l + w, O, { cssStyles: k } = t;
	if (t.look === "handDrawn") {
		let e = S.svg(h), n = ge(0, 0, b, D, x, w), r = _e(0, w, b, D, x, w), i = v(t, {}), a = e.path(n, i), o = e.path(r, v(t, { fill: "none" }));
		O = h.insert(() => o, ":first-child"), O = h.insert(() => a, ":first-child"), O.attr("class", "basic label-container"), k && O.attr("style", k);
	} else {
		let e = he(0, 0, b, D, x, w);
		O = h.insert("path", ":first-child").attr("d", e).attr("class", "basic label-container outer-path").attr("style", p(k)).attr("style", s);
	}
	return O.attr("label-offset-y", w), O.attr("transform", `translate(${-b / 2}, ${-(D / 2 + w)})`), T(t, O), _.attr("transform", `translate(${-(g.width / 2) - (g.x - ((r = g.left) == null ? 0 : r))}, ${-(g.height / 2) + ((i = t.padding) == null ? 0 : i) / 1.5 - (g.y - ((a = g.top) == null ? 0 : a))})`), t.intersect = function(e) {
		var n, r, i, a, o;
		let s = q.rect(t, e), c = s.x - ((n = t.x) == null ? 0 : n);
		if (x != 0 && (Math.abs(c) < ((r = t.width) == null ? 0 : r) / 2 || Math.abs(c) == ((i = t.width) == null ? 0 : i) / 2 && Math.abs(s.y - ((a = t.y) == null ? 0 : a)) > ((o = t.height) == null ? 0 : o) / 2 - w)) {
			var l;
			let n = w * w * (1 - c * c / (x * x));
			n > 0 && (n = Math.sqrt(n)), n = w - n, e.y - ((l = t.y) == null ? 0 : l) > 0 && (n = -n), s.y += n;
		}
		return s;
	}, h;
}
t(be, "cylinder");
async function xe(e, t, n) {
	let { labelStyles: r, nodeStyles: i } = y(t);
	t.labelStyle = r;
	let { shapeSvg: a, bbox: o } = await C(e, t, E(t)), s = Math.max(o.width + n.labelPaddingX * 2, (t == null ? void 0 : t.width) || 0), c = Math.max(o.height + n.labelPaddingY * 2, (t == null ? void 0 : t.height) || 0), l = -s / 2, u = -c / 2, d, { rx: f, ry: m } = t, { cssStyles: h } = t;
	if (n != null && n.rx && n.ry && (f = n.rx, m = n.ry), t.look === "handDrawn") {
		let e = S.svg(a), n = v(t, {}), r = f || m ? e.path(N(l, u, s, c, f || 0), n) : e.rectangle(l, u, s, c, n);
		d = a.insert(() => r, ":first-child"), d.attr("class", "basic label-container").attr("style", p(h));
	} else d = a.insert("rect", ":first-child"), d.attr("class", "basic label-container").attr("style", i).attr("rx", p(f)).attr("ry", p(m)).attr("x", l).attr("y", u).attr("width", s).attr("height", c);
	return T(t, d), t.calcIntersect = function(e, t) {
		return q.rect(e, t);
	}, t.intersect = function(e) {
		return q.rect(t, e);
	}, a;
}
t(xe, "drawRect");
async function Se(e, t) {
	var n, r, i;
	let { cssClasses: a, labelPaddingX: o, labelPaddingY: s, padding: c, width: l, height: u } = t, d = await xe(e, t, {
		rx: 0,
		ry: 0,
		classes: a == null ? "" : a,
		labelPaddingX: o == null ? (c == null ? 0 : c) * 2 : o,
		labelPaddingY: (n = s == null ? c : s) == null ? 0 : n
	});
	if (t.look === "handDrawn") {
		let e = S.svg(d), n = v(t, {}), r = d.select(".basic.label-container > path:nth-child(2)"), i = r.node();
		if (!i) return d;
		let a = null;
		if (i instanceof SVGGraphicsElement) a = i.getBBox();
		else return d;
		return d.insert(() => e.line(a.x, a.y, a.x + a.width, a.y, n), ".basic.label-container g.label"), d.insert(() => e.line(a.x, a.y + a.height, a.x + a.width, a.y + a.height, n), ".basic.label-container g.label"), r.remove(), d;
	}
	let f = d.select(".basic.label-container"), p = (r = Number(f.attr("width")) || l) == null ? 0 : r, m = (i = Number(f.attr("height")) || u) == null ? 0 : i;
	return p > 0 && m > 0 && f.attr("stroke-dasharray", `${p} ${m}`), d;
}
t(Se, "datastore");
async function Ce(e, t) {
	var n, r, i, a, o, s;
	let { labelStyles: c, nodeStyles: l } = y(t);
	t.labelStyle = c;
	let u = t.look === "neo" ? 16 : (n = t.padding) == null ? 0 : n, d = t.look === "neo" ? 16 : (r = t.padding) == null ? 0 : r, { shapeSvg: f, bbox: p, label: m } = await C(e, t, E(t)), h = p.width + u, g = p.height + d, _ = g * .2, b = -h / 2, x = -g / 2 - _ / 2, { cssStyles: w } = t, D = S.svg(f), O = v(t, {});
	t.look !== "handDrawn" && (O.roughness = 0, O.fillStyle = "solid");
	let k = [
		{
			x: b,
			y: x + _
		},
		{
			x: -b,
			y: x + _
		},
		{
			x: -b,
			y: -x
		},
		{
			x: b,
			y: -x
		},
		{
			x: b,
			y: x
		},
		{
			x: -b,
			y: x
		},
		{
			x: -b,
			y: x + _
		}
	], A = D.polygon(k.map((e) => [e.x, e.y]), O), j = f.insert(() => A, ":first-child");
	return j.attr("class", "basic label-container outer-path"), w && t.look !== "handDrawn" && j.selectAll("path").attr("style", w), l && t.look !== "handDrawn" && j.selectAll("path").attr("style", l), m.attr("transform", `translate(${b + ((i = t.padding) == null ? 0 : i) / 2 - (p.x - ((a = p.left) == null ? 0 : a))}, ${x + _ + ((o = t.padding) == null ? 0 : o) / 2 - (p.y - ((s = p.top) == null ? 0 : s))})`), T(t, j), t.intersect = function(e) {
		return q.rect(t, e);
	}, f;
}
t(Ce, "dividedRectangle");
async function we(t, n) {
	var r;
	let { labelStyles: i, nodeStyles: a } = y(n), o = n.look === "neo" ? 12 : 5;
	n.labelStyle = i;
	let s = (r = n.padding) == null ? 0 : r, c = n.look === "neo" ? 16 : s, { shapeSvg: l, bbox: u } = await C(t, n, E(n)), d = (n != null && n.width ? (n == null ? void 0 : n.width) / 2 : u.width / 2) + (c == null ? 0 : c), f = d - o, m, { cssStyles: h } = n;
	if (n.look === "handDrawn") {
		var g, _;
		let e = S.svg(l), t = v(n, {
			roughness: .2,
			strokeWidth: 2.5
		}), r = v(n, {
			roughness: .2,
			strokeWidth: 1.5
		}), i = e.circle(0, 0, d * 2, t), a = e.circle(0, 0, f * 2, r);
		m = l.insert("g", ":first-child"), m.attr("class", p(n.cssClasses)).attr("style", p(h)), (g = m.node()) == null || g.appendChild(i), (_ = m.node()) == null || _.appendChild(a);
	} else {
		m = l.insert("g", ":first-child");
		let e = m.insert("circle", ":first-child"), t = m.insert("circle");
		m.attr("class", "basic label-container").attr("style", a), e.attr("class", "outer-circle").attr("style", a).attr("r", d).attr("cx", 0).attr("cy", 0), t.attr("class", "inner-circle").attr("style", a).attr("r", f).attr("cx", 0).attr("cy", 0);
	}
	return T(n, m), n.intersect = function(t) {
		return e.info("DoubleCircle intersect", n, d, t), q.circle(n, d, t);
	}, l;
}
t(we, "doublecircle");
function Te(t, n, { config: { themeVariables: r } }) {
	var i;
	let { labelStyles: a, nodeStyles: o } = y(n);
	n.label = "", n.labelStyle = a;
	let s = t.insert("g").attr("class", E(n)).attr("id", (i = n.domId) == null ? n.id : i), { cssStyles: c } = n, l = S.svg(s), { nodeBorder: u } = r, d = v(n, { fillStyle: "solid" });
	n.look !== "handDrawn" && (d.roughness = 0);
	let f = l.circle(0, 0, 14, d), p = s.insert(() => f, ":first-child");
	return p.selectAll("path").attr("style", `fill: ${u} !important;`), c && c.length > 0 && n.look !== "handDrawn" && p.selectAll("path").attr("style", c), o && n.look !== "handDrawn" && p.selectAll("path").attr("style", o), T(n, p), n.intersect = function(t) {
		return e.info("filledCircle intersect", n, {
			radius: 7,
			point: t
		}), q.circle(n, 7, t);
	}, s;
}
t(Te, "filledCircle");
var Ee = 10, De = 10;
async function Oe(t, n) {
	var r, i, a, o;
	let { labelStyles: s, nodeStyles: c } = y(n);
	n.labelStyle = s;
	let l = (r = n.padding) == null ? 0 : r, u = n.look === "neo" ? l * 2 : l;
	if (n.width || n.height) {
		var d, f;
		n.height = (d = n == null ? void 0 : n.height) == null ? 0 : d, n.height < Ee && (n.height = Ee), n.width = ((f = n == null ? void 0 : n.width) == null ? 0 : f) - u - u / 2, n.width < De && (n.width = De);
	}
	let { shapeSvg: p, bbox: m, label: h } = await C(t, n, E(n)), g = (n != null && n.width ? n == null ? void 0 : n.width : m.width) + (u == null ? 0 : u), _ = n != null && n.height ? n == null ? void 0 : n.height : g + m.height, b = _, x = [
		{
			x: 0,
			y: -_
		},
		{
			x: b,
			y: -_
		},
		{
			x: b / 2,
			y: 0
		}
	], { cssStyles: w } = n, O = S.svg(p), k = v(n, {});
	n.look !== "handDrawn" && (k.roughness = 0, k.fillStyle = "solid");
	let A = D(x), j = O.path(A, k), M = p.insert(() => j, ":first-child").attr("transform", `translate(${-_ / 2}, ${_ / 2})`).attr("class", "outer-path");
	return w && n.look !== "handDrawn" && M.selectChildren("path").attr("style", w), c && n.look !== "handDrawn" && M.selectChildren("path").attr("style", c), n.width = g, n.height = _, T(n, M), h.attr("transform", `translate(${-m.width / 2 - (m.x - ((i = m.left) == null ? 0 : i))}, ${-_ / 2 + ((a = n.padding) == null ? 0 : a) / 2 + (m.y - ((o = m.top) == null ? 0 : o))})`), n.intersect = function(t) {
		return e.info("Triangle intersect", n, x, t), q.polygon(n, x, t);
	}, p;
}
t(Oe, "flippedTriangle");
function ke(e, t, { dir: n, config: { state: r, themeVariables: i } }) {
	var a, o, s, c;
	let { nodeStyles: l } = y(t);
	t.label = "";
	let u = e.insert("g").attr("class", E(t)).attr("id", (a = t.domId) == null ? t.id : a), { cssStyles: d } = t, f = Math.max(70, (o = t == null ? void 0 : t.width) == null ? 0 : o), p = Math.max(10, (s = t == null ? void 0 : t.height) == null ? 0 : s);
	if (n === "LR") {
		var m, h;
		f = Math.max(10, (m = t == null ? void 0 : t.width) == null ? 0 : m), p = Math.max(70, (h = t == null ? void 0 : t.height) == null ? 0 : h);
	}
	let g = -1 * f / 2, _ = -1 * p / 2, b = S.svg(u), x = v(t, {
		stroke: i.lineColor,
		fill: i.lineColor
	});
	t.look !== "handDrawn" && (x.roughness = 0, x.fillStyle = "solid");
	let C = b.rectangle(g, _, f, p, x), w = u.insert(() => C, ":first-child");
	d && t.look !== "handDrawn" && w.selectAll("path").attr("style", d), l && t.look !== "handDrawn" && w.selectAll("path").attr("style", l), T(t, w);
	let D = (c = r == null ? void 0 : r.padding) == null ? 0 : c;
	return t.width && t.height && (t.width += D / 2 || 0, t.height += D / 2 || 0), t.intersect = function(e) {
		return q.rect(t, e);
	}, u;
}
t(ke, "forkJoin");
async function Ae(t, n) {
	var r, i;
	let { labelStyles: a, nodeStyles: o } = y(n);
	n.labelStyle = a;
	let s = n.look === "neo" ? 16 : (r = n.padding) == null ? 0 : r, c = n.look === "neo" ? 12 : (i = n.padding) == null ? 0 : i;
	if (n.width || n.height) {
		var l, u;
		n.height = ((l = n == null ? void 0 : n.height) == null ? 0 : l) - c * 2, n.height < 10 && (n.height = 10), n.width = ((u = n == null ? void 0 : n.width) == null ? 0 : u) - s * 2, n.width < 15 && (n.width = 15);
	}
	let { shapeSvg: d, bbox: f } = await C(t, n, E(n)), p = (n != null && n.width ? n == null ? void 0 : n.width : Math.max(15, f.width)) + s * 2, m = (n != null && n.height ? n == null ? void 0 : n.height : Math.max(10, f.height)) + c * 2, h = m / 2, { cssStyles: g } = n, _ = S.svg(d), b = v(n, {});
	n.look !== "handDrawn" && (b.roughness = 0, b.fillStyle = "solid");
	let x = [
		{
			x: -p / 2,
			y: -m / 2
		},
		{
			x: p / 2 - h,
			y: -m / 2
		},
		...k(-p / 2 + h, 0, h, 50, 90, 270),
		{
			x: p / 2 - h,
			y: m / 2
		},
		{
			x: -p / 2,
			y: m / 2
		}
	], w = D(x), O = _.path(w, b), A = d.insert(() => O, ":first-child");
	return A.attr("class", "basic label-container outer-path"), g && n.look !== "handDrawn" && A.selectChildren("path").attr("style", g), o && n.look !== "handDrawn" && A.selectChildren("path").attr("style", o), T(n, A), n.intersect = function(t) {
		return e.info("Pill intersect", n, {
			radius: h,
			point: t
		}), q.polygon(n, x, t);
	}, d;
}
t(Ae, "halfRoundedRectangle");
var je = /* @__PURE__ */ t((e, t, n, r, i) => [
	`M${e + i},${t}`,
	`L${e + n - i},${t}`,
	`L${e + n},${t - r / 2}`,
	`L${e + n - i},${t - r}`,
	`L${e + i},${t - r}`,
	`L${e},${t - r / 2}`,
	"Z"
].join(" "), "createHexagonPathD");
async function Me(e, t) {
	var n;
	let { labelStyles: r, nodeStyles: i } = y(t), a = t.look === "neo" ? 3.5 : 4;
	t.labelStyle = r;
	let o = (n = t.padding) == null ? 0 : n, s = t.look === "neo" ? 70 : o, c = t.look === "neo" ? 32 : o;
	if (t.width || t.height) {
		var l, u, d;
		let e = ((l = t.height) == null ? 0 : l) / a;
		t.width = ((u = t == null ? void 0 : t.width) == null ? 0 : u) - 2 * e - c, t.height = ((d = t.height) == null ? 0 : d) - s;
	}
	let { shapeSvg: f, bbox: p } = await C(e, t, E(t)), m = (t != null && t.height ? t == null ? void 0 : t.height : p.height) + s, h = m / a, g = (t != null && t.width ? t == null ? void 0 : t.width : p.width) + 2 * h + c, _ = [
		{
			x: h,
			y: 0
		},
		{
			x: g - h,
			y: 0
		},
		{
			x: g,
			y: -m / 2
		},
		{
			x: g - h,
			y: -m
		},
		{
			x: h,
			y: -m
		},
		{
			x: 0,
			y: -m / 2
		}
	], b, { cssStyles: x } = t;
	if (t.look === "handDrawn") {
		let e = S.svg(f), n = v(t, {}), r = je(0, 0, g, m, h), i = e.path(r, n);
		b = f.insert(() => i, ":first-child").attr("transform", `translate(${-g / 2}, ${m / 2})`), x && b.attr("style", x);
	} else b = Y(f, g, m, _);
	return i && b.attr("style", i), t.width = g, t.height = m, T(t, b), t.intersect = function(e) {
		return q.polygon(t, _, e);
	}, f;
}
t(Me, "hexagon");
async function Ne(t, n) {
	var r, i;
	let { labelStyles: a, nodeStyles: o } = y(n);
	n.label = "", n.labelStyle = a;
	let { shapeSvg: s } = await C(t, n, E(n)), c = Math.max(30, (r = n == null ? void 0 : n.width) == null ? 0 : r), l = Math.max(30, (i = n == null ? void 0 : n.height) == null ? 0 : i), { cssStyles: u } = n, d = S.svg(s), f = v(n, {});
	n.look !== "handDrawn" && (f.roughness = 0, f.fillStyle = "solid");
	let p = [
		{
			x: 0,
			y: 0
		},
		{
			x: c,
			y: 0
		},
		{
			x: 0,
			y: l
		},
		{
			x: c,
			y: l
		}
	], m = D(p), h = d.path(m, f), g = s.insert(() => h, ":first-child");
	return g.attr("class", "basic label-container outer-path"), u && n.look !== "handDrawn" && g.selectChildren("path").attr("style", u), o && n.look !== "handDrawn" && g.selectChildren("path").attr("style", o), g.attr("transform", `translate(${-c / 2}, ${-l / 2})`), T(n, g), n.intersect = function(t) {
		return e.info("Pill intersect", n, { points: p }), q.polygon(n, p, t);
	}, s;
}
t(Ne, "hourglass");
async function Pe(t, n, { config: { themeVariables: r, flowchart: i } }) {
	var a, o, s;
	let { labelStyles: c } = y(n);
	n.labelStyle = c;
	let l = (a = n.assetHeight) == null ? 48 : a, u = (o = n.assetWidth) == null ? 48 : o, d = Math.max(l, u), f = i == null ? void 0 : i.wrappingWidth;
	n.width = Math.max(d, f == null ? 0 : f);
	let { shapeSvg: p, bbox: m, label: g } = await C(t, n, "icon-shape default"), _ = n.pos === "t", b = d, w = d, { nodeBorder: E } = r, { stylesMap: D } = x(n), O = -w / 2, k = -b / 2, A = n.label ? 8 : 0, j = S.svg(p), M = v(n, {
		stroke: "none",
		fill: "none"
	});
	n.look !== "handDrawn" && (M.roughness = 0, M.fillStyle = "solid");
	let N = j.rectangle(O, k, w, b, M), P = Math.max(w, m.width), F = b + m.height + A, I = j.rectangle(-P / 2, -F / 2, P, F, {
		...M,
		fill: "transparent",
		stroke: "none"
	}), L = p.insert(() => N, ":first-child"), R = p.insert(() => I);
	if (n.icon) {
		var z;
		let e = p.append("g");
		e.html(`<g>${await h(n.icon, {
			height: d,
			width: d,
			fallbackPrefix: ""
		})}</g>`);
		let t = e.node().getBBox(), r = t.width, i = t.height, a = t.x, o = t.y;
		e.attr("transform", `translate(${-r / 2 - a},${_ ? m.height / 2 + A / 2 - i / 2 - o : -m.height / 2 - A / 2 - i / 2 - o})`), e.attr("style", `color: ${(z = D.get("stroke")) == null ? E : z};`);
	}
	return g.attr("transform", `translate(${-m.width / 2 - (m.x - ((s = m.left) == null ? 0 : s))},${_ ? -F / 2 : F / 2 - m.height})`), L.attr("transform", `translate(0,${_ ? m.height / 2 + A / 2 : -m.height / 2 - A / 2})`), T(n, R), n.intersect = function(t) {
		var r, i, a;
		if (e.info("iconSquare intersect", n, t), !n.label) return q.rect(n, t);
		let o = (r = n.x) == null ? 0 : r, s = (i = n.y) == null ? 0 : i, c = (a = n.height) == null ? 0 : a, l = [];
		return l = _ ? [
			{
				x: o - m.width / 2,
				y: s - c / 2
			},
			{
				x: o + m.width / 2,
				y: s - c / 2
			},
			{
				x: o + m.width / 2,
				y: s - c / 2 + m.height + A
			},
			{
				x: o + w / 2,
				y: s - c / 2 + m.height + A
			},
			{
				x: o + w / 2,
				y: s + c / 2
			},
			{
				x: o - w / 2,
				y: s + c / 2
			},
			{
				x: o - w / 2,
				y: s - c / 2 + m.height + A
			},
			{
				x: o - m.width / 2,
				y: s - c / 2 + m.height + A
			}
		] : [
			{
				x: o - w / 2,
				y: s - c / 2
			},
			{
				x: o + w / 2,
				y: s - c / 2
			},
			{
				x: o + w / 2,
				y: s - c / 2 + b
			},
			{
				x: o + m.width / 2,
				y: s - c / 2 + b
			},
			{
				x: o + m.width / 2 / 2,
				y: s + c / 2
			},
			{
				x: o - m.width / 2,
				y: s + c / 2
			},
			{
				x: o - m.width / 2,
				y: s - c / 2 + b
			},
			{
				x: o - w / 2,
				y: s - c / 2 + b
			}
		], q.polygon(n, l, t);
	}, p;
}
t(Pe, "icon");
async function Fe(t, n, { config: { themeVariables: r, flowchart: i } }) {
	var a, o, s, c;
	let { labelStyles: l } = y(n);
	n.labelStyle = l;
	let u = (a = n.assetHeight) == null ? 48 : a, d = (o = n.assetWidth) == null ? 48 : o, f = Math.max(u, d), p = i == null ? void 0 : i.wrappingWidth;
	n.width = Math.max(f, p == null ? 0 : p);
	let { shapeSvg: m, bbox: g, label: _ } = await C(t, n, "icon-shape default"), b = n.label ? 8 : 0, w = n.pos === "t", { nodeBorder: E, mainBkg: D } = r, { stylesMap: O } = x(n), k = S.svg(m), A = v(n, {});
	n.look !== "handDrawn" && (A.roughness = 0, A.fillStyle = "solid");
	let j = O.get("fill");
	A.stroke = j == null ? D : j;
	let M = m.append("g");
	n.icon && M.html(`<g>${await h(n.icon, {
		height: f,
		width: f,
		fallbackPrefix: ""
	})}</g>`);
	let N = M.node().getBBox(), P = N.width, F = N.height, I = N.x, L = N.y, R = Math.max(P, F) * Math.SQRT2 + 40, z = k.circle(0, 0, R, A), B = Math.max(R, g.width), V = R + g.height + b, H = k.rectangle(-B / 2, -V / 2, B, V, {
		...A,
		fill: "transparent",
		stroke: "none"
	}), U = m.insert(() => z, ":first-child"), W = m.insert(() => H);
	return M.attr("transform", `translate(${-P / 2 - I},${w ? g.height / 2 + b / 2 - F / 2 - L : -g.height / 2 - b / 2 - F / 2 - L})`), M.attr("style", `color: ${(s = O.get("stroke")) == null ? E : s};`), _.attr("transform", `translate(${-g.width / 2 - (g.x - ((c = g.left) == null ? 0 : c))},${w ? -V / 2 : V / 2 - g.height})`), U.attr("transform", `translate(0,${w ? g.height / 2 + b / 2 : -g.height / 2 - b / 2})`), T(n, W), n.intersect = function(t) {
		return e.info("iconSquare intersect", n, t), q.rect(n, t);
	}, m;
}
t(Fe, "iconCircle");
async function Ie(t, n, { config: { themeVariables: r, flowchart: i } }) {
	var a, o, s;
	let { labelStyles: c } = y(n);
	n.labelStyle = c;
	let l = (a = n.assetHeight) == null ? 48 : a, u = (o = n.assetWidth) == null ? 48 : o, d = Math.max(l, u), f = i == null ? void 0 : i.wrappingWidth;
	n.width = Math.max(d, f == null ? 0 : f);
	let { shapeSvg: p, bbox: m, halfPadding: g, label: _ } = await C(t, n, "icon-shape default"), b = n.pos === "t", w = d + g * 2, E = d + g * 2, { nodeBorder: D, mainBkg: O } = r, { stylesMap: k } = x(n), A = -E / 2, j = -w / 2, M = n.label ? 8 : 0, P = S.svg(p), F = v(n, {});
	n.look !== "handDrawn" && (F.roughness = 0, F.fillStyle = "solid");
	let I = k.get("fill");
	F.stroke = I == null ? O : I;
	let L = P.path(N(A, j, E, w, 5), F), R = Math.max(E, m.width), z = w + m.height + M, B = P.rectangle(-R / 2, -z / 2, R, z, {
		...F,
		fill: "transparent",
		stroke: "none"
	}), V = p.insert(() => L, ":first-child").attr("class", "icon-shape2"), H = p.insert(() => B);
	if (n.icon) {
		var U;
		let e = p.append("g");
		e.html(`<g>${await h(n.icon, {
			height: d,
			width: d,
			fallbackPrefix: ""
		})}</g>`);
		let t = e.node().getBBox(), r = t.width, i = t.height, a = t.x, o = t.y;
		e.attr("transform", `translate(${-r / 2 - a},${b ? m.height / 2 + M / 2 - i / 2 - o : -m.height / 2 - M / 2 - i / 2 - o})`), e.attr("style", `color: ${(U = k.get("stroke")) == null ? D : U};`);
	}
	return _.attr("transform", `translate(${-m.width / 2 - (m.x - ((s = m.left) == null ? 0 : s))},${b ? -z / 2 : z / 2 - m.height})`), V.attr("transform", `translate(0,${b ? m.height / 2 + M / 2 : -m.height / 2 - M / 2})`), T(n, H), n.intersect = function(t) {
		var r, i, a;
		if (e.info("iconSquare intersect", n, t), !n.label) return q.rect(n, t);
		let o = (r = n.x) == null ? 0 : r, s = (i = n.y) == null ? 0 : i, c = (a = n.height) == null ? 0 : a, l = [];
		return l = b ? [
			{
				x: o - m.width / 2,
				y: s - c / 2
			},
			{
				x: o + m.width / 2,
				y: s - c / 2
			},
			{
				x: o + m.width / 2,
				y: s - c / 2 + m.height + M
			},
			{
				x: o + E / 2,
				y: s - c / 2 + m.height + M
			},
			{
				x: o + E / 2,
				y: s + c / 2
			},
			{
				x: o - E / 2,
				y: s + c / 2
			},
			{
				x: o - E / 2,
				y: s - c / 2 + m.height + M
			},
			{
				x: o - m.width / 2,
				y: s - c / 2 + m.height + M
			}
		] : [
			{
				x: o - E / 2,
				y: s - c / 2
			},
			{
				x: o + E / 2,
				y: s - c / 2
			},
			{
				x: o + E / 2,
				y: s - c / 2 + w
			},
			{
				x: o + m.width / 2,
				y: s - c / 2 + w
			},
			{
				x: o + m.width / 2 / 2,
				y: s + c / 2
			},
			{
				x: o - m.width / 2,
				y: s + c / 2
			},
			{
				x: o - m.width / 2,
				y: s - c / 2 + w
			},
			{
				x: o - E / 2,
				y: s - c / 2 + w
			}
		], q.polygon(n, l, t);
	}, p;
}
t(Ie, "iconRounded");
async function Le(t, n, { config: { themeVariables: r, flowchart: i } }) {
	var a, o, s;
	let { labelStyles: c } = y(n);
	n.labelStyle = c;
	let l = (a = n.assetHeight) == null ? 48 : a, u = (o = n.assetWidth) == null ? 48 : o, d = Math.max(l, u), f = i == null ? void 0 : i.wrappingWidth;
	n.width = Math.max(d, f == null ? 0 : f);
	let { shapeSvg: p, bbox: m, halfPadding: g, label: _ } = await C(t, n, "icon-shape default"), b = n.pos === "t", w = d + g * 2, E = d + g * 2, { nodeBorder: D, mainBkg: O } = r, { stylesMap: k } = x(n), A = -E / 2, j = -w / 2, M = n.label ? 8 : 0, P = S.svg(p), F = v(n, {});
	n.look !== "handDrawn" && (F.roughness = 0, F.fillStyle = "solid");
	let I = k.get("fill");
	F.stroke = I == null ? O : I;
	let L = P.path(N(A, j, E, w, .1), F), R = Math.max(E, m.width), z = w + m.height + M, B = P.rectangle(-R / 2, -z / 2, R, z, {
		...F,
		fill: "transparent",
		stroke: "none"
	}), V = p.insert(() => L, ":first-child"), H = p.insert(() => B);
	if (n.icon) {
		var U;
		let e = p.append("g");
		e.html(`<g>${await h(n.icon, {
			height: d,
			width: d,
			fallbackPrefix: ""
		})}</g>`);
		let t = e.node().getBBox(), r = t.width, i = t.height, a = t.x, o = t.y;
		e.attr("transform", `translate(${-r / 2 - a},${b ? m.height / 2 + M / 2 - i / 2 - o : -m.height / 2 - M / 2 - i / 2 - o})`), e.attr("style", `color: ${(U = k.get("stroke")) == null ? D : U};`);
	}
	return _.attr("transform", `translate(${-m.width / 2 - (m.x - ((s = m.left) == null ? 0 : s))},${b ? -z / 2 : z / 2 - m.height})`), V.attr("transform", `translate(0,${b ? m.height / 2 + M / 2 : -m.height / 2 - M / 2})`), T(n, H), n.intersect = function(t) {
		var r, i, a;
		if (e.info("iconSquare intersect", n, t), !n.label) return q.rect(n, t);
		let o = (r = n.x) == null ? 0 : r, s = (i = n.y) == null ? 0 : i, c = (a = n.height) == null ? 0 : a, l = [];
		return l = b ? [
			{
				x: o - m.width / 2,
				y: s - c / 2
			},
			{
				x: o + m.width / 2,
				y: s - c / 2
			},
			{
				x: o + m.width / 2,
				y: s - c / 2 + m.height + M
			},
			{
				x: o + E / 2,
				y: s - c / 2 + m.height + M
			},
			{
				x: o + E / 2,
				y: s + c / 2
			},
			{
				x: o - E / 2,
				y: s + c / 2
			},
			{
				x: o - E / 2,
				y: s - c / 2 + m.height + M
			},
			{
				x: o - m.width / 2,
				y: s - c / 2 + m.height + M
			}
		] : [
			{
				x: o - E / 2,
				y: s - c / 2
			},
			{
				x: o + E / 2,
				y: s - c / 2
			},
			{
				x: o + E / 2,
				y: s - c / 2 + w
			},
			{
				x: o + m.width / 2,
				y: s - c / 2 + w
			},
			{
				x: o + m.width / 2 / 2,
				y: s + c / 2
			},
			{
				x: o - m.width / 2,
				y: s + c / 2
			},
			{
				x: o - m.width / 2,
				y: s - c / 2 + w
			},
			{
				x: o - E / 2,
				y: s - c / 2 + w
			}
		], q.polygon(n, l, t);
	}, p;
}
t(Le, "iconSquare");
async function Re(t, n, { config: { flowchart: r } }) {
	var i, a, o, s;
	let c = new Image();
	c.src = (i = n == null ? void 0 : n.img) == null ? "" : i, await c.decode();
	let l = Number(c.naturalWidth.toString().replace("px", "")), u = Number(c.naturalHeight.toString().replace("px", ""));
	n.imageAspectRatio = l / u;
	let { labelStyles: d } = y(n);
	n.labelStyle = d;
	let f = r == null ? void 0 : r.wrappingWidth;
	n.defaultWidth = r == null ? void 0 : r.wrappingWidth;
	let p = Math.max(n.label ? f == null ? 0 : f : 0, (a = n == null ? void 0 : n.assetWidth) == null ? l : a), m = n.constraint === "on" && n != null && n.assetHeight ? n.assetHeight * n.imageAspectRatio : p, h = n.constraint === "on" ? m / n.imageAspectRatio : (o = n == null ? void 0 : n.assetHeight) == null ? u : o;
	n.width = Math.max(m, f == null ? 0 : f);
	let { shapeSvg: g, bbox: _, label: b } = await C(t, n, "image-shape default"), x = n.pos === "t", w = -m / 2, E = -h / 2, D = n.label ? 8 : 0, O = S.svg(g), k = v(n, {});
	n.look !== "handDrawn" && (k.roughness = 0, k.fillStyle = "solid");
	let A = O.rectangle(w, E, m, h, k), j = Math.max(m, _.width), M = h + _.height + D, N = O.rectangle(-j / 2, -M / 2, j, M, {
		...k,
		fill: "none",
		stroke: "none"
	}), P = g.insert(() => A, ":first-child"), F = g.insert(() => N);
	if (n.img) {
		let e = g.append("image");
		e.attr("href", n.img), e.attr("width", m), e.attr("height", h), e.attr("preserveAspectRatio", "none"), e.attr("transform", `translate(${-m / 2},${x ? M / 2 - h : -M / 2})`);
	}
	return b.attr("transform", `translate(${-_.width / 2 - (_.x - ((s = _.left) == null ? 0 : s))},${x ? -h / 2 - _.height / 2 - D / 2 : h / 2 - _.height / 2 + D / 2})`), P.attr("transform", `translate(0,${x ? _.height / 2 + D / 2 : -_.height / 2 - D / 2})`), T(n, F), n.intersect = function(t) {
		var r, i, a;
		if (e.info("iconSquare intersect", n, t), !n.label) return q.rect(n, t);
		let o = (r = n.x) == null ? 0 : r, s = (i = n.y) == null ? 0 : i, c = (a = n.height) == null ? 0 : a, l = [];
		return l = x ? [
			{
				x: o - _.width / 2,
				y: s - c / 2
			},
			{
				x: o + _.width / 2,
				y: s - c / 2
			},
			{
				x: o + _.width / 2,
				y: s - c / 2 + _.height + D
			},
			{
				x: o + m / 2,
				y: s - c / 2 + _.height + D
			},
			{
				x: o + m / 2,
				y: s + c / 2
			},
			{
				x: o - m / 2,
				y: s + c / 2
			},
			{
				x: o - m / 2,
				y: s - c / 2 + _.height + D
			},
			{
				x: o - _.width / 2,
				y: s - c / 2 + _.height + D
			}
		] : [
			{
				x: o - m / 2,
				y: s - c / 2
			},
			{
				x: o + m / 2,
				y: s - c / 2
			},
			{
				x: o + m / 2,
				y: s - c / 2 + h
			},
			{
				x: o + _.width / 2,
				y: s - c / 2 + h
			},
			{
				x: o + _.width / 2 / 2,
				y: s + c / 2
			},
			{
				x: o - _.width / 2,
				y: s + c / 2
			},
			{
				x: o - _.width / 2,
				y: s - c / 2 + h
			},
			{
				x: o - m / 2,
				y: s - c / 2 + h
			}
		], q.polygon(n, l, t);
	}, g;
}
t(Re, "imageSquare");
async function ze(e, t) {
	var n, r, i;
	let { labelStyles: a, nodeStyles: o } = y(t);
	t.labelStyle = a;
	let s = (n = t.padding) == null ? 0 : n, c = s, l = t.look === "neo" ? s * 2 : s, { shapeSvg: u, bbox: d } = await C(e, t, E(t)), f = Math.max(d.width + (l == null ? 0 : l) * 2, (r = t == null ? void 0 : t.width) == null ? 0 : r), p = Math.max(d.height + (c == null ? 0 : c) * 2, (i = t == null ? void 0 : t.height) == null ? 0 : i), m = [
		{
			x: 0,
			y: 0
		},
		{
			x: f,
			y: 0
		},
		{
			x: f + 3 * p / 6,
			y: -p
		},
		{
			x: -3 * p / 6,
			y: -p
		}
	], h, { cssStyles: g } = t;
	if (t.look === "handDrawn") {
		let e = S.svg(u), n = v(t, {}), r = D(m), i = e.path(r, n);
		h = u.insert(() => i, ":first-child").attr("transform", `translate(${-f / 2}, ${p / 2})`), g && h.attr("style", g);
	} else h = Y(u, f, p, m);
	return o && h.attr("style", o), t.width = f, t.height = p, T(t, h), t.intersect = function(e) {
		return q.polygon(t, m, e);
	}, u;
}
t(ze, "inv_trapezoid");
async function Be(e, t) {
	var n, r;
	let { shapeSvg: i, bbox: a, label: o } = await C(e, t, "label"), s = i.insert("rect", ":first-child");
	return s.attr("width", .1).attr("height", .1), i.attr("class", "label edgeLabel"), o.attr("transform", `translate(${-(a.width / 2) - (a.x - ((n = a.left) == null ? 0 : n))}, ${-(a.height / 2) - (a.y - ((r = a.top) == null ? 0 : r))})`), T(t, s), t.intersect = function(e) {
		return q.rect(t, e);
	}, i;
}
t(Be, "labelRect");
async function Ve(e, t) {
	var n, r, i;
	let { labelStyles: a, nodeStyles: o } = y(t);
	t.labelStyle = a;
	let s = (n = t.padding) == null ? 0 : n, c = s, l = t.look === "neo" ? s * 2 : s, { shapeSvg: u, bbox: d } = await C(e, t, E(t)), f = ((r = t == null ? void 0 : t.height) == null ? d.height : r) + c, p = ((i = t == null ? void 0 : t.width) == null ? d.width : i) + l, m = [
		{
			x: 0,
			y: 0
		},
		{
			x: p + 3 * f / 6,
			y: 0
		},
		{
			x: p,
			y: -f
		},
		{
			x: -(3 * f) / 6,
			y: -f
		}
	], h, { cssStyles: g } = t;
	if (t.look === "handDrawn") {
		let e = S.svg(u), n = v(t, {}), r = D(m), i = e.path(r, n);
		h = u.insert(() => i, ":first-child").attr("transform", `translate(${-p / 2}, ${f / 2})`), g && h.attr("style", g);
	} else h = Y(u, p, f, m);
	return o && h.attr("style", o), t.width = p, t.height = f, T(t, h), t.intersect = function(e) {
		return q.polygon(t, m, e);
	}, u;
}
t(Ve, "lean_left");
async function He(e, t) {
	var n, r, i;
	let { labelStyles: a, nodeStyles: o } = y(t);
	t.labelStyle = a;
	let s = (n = t.padding) == null ? 0 : n, c = s, l = t.look === "neo" ? s * 2 : s, { shapeSvg: u, bbox: d } = await C(e, t, E(t)), f = ((r = t == null ? void 0 : t.height) == null ? d.height : r) + c, p = ((i = t == null ? void 0 : t.width) == null ? d.width : i) + l, m = [
		{
			x: -3 * f / 6,
			y: 0
		},
		{
			x: p,
			y: 0
		},
		{
			x: p + 3 * f / 6,
			y: -f
		},
		{
			x: 0,
			y: -f
		}
	], h, { cssStyles: g } = t;
	if (t.look === "handDrawn") {
		let e = S.svg(u), n = v(t, {}), r = D(m), i = e.path(r, n);
		h = u.insert(() => i, ":first-child").attr("transform", `translate(${-p / 2}, ${f / 2})`), g && h.attr("style", g);
	} else h = Y(u, p, f, m);
	return o && h.attr("style", o), t.width = p, t.height = f, T(t, h), t.intersect = function(e) {
		return q.polygon(t, m, e);
	}, u;
}
t(He, "lean_right");
function Ue(t, n) {
	var r, i, a;
	let { labelStyles: o, nodeStyles: s } = y(n);
	n.label = "", n.labelStyle = o;
	let c = t.insert("g").attr("class", E(n)).attr("id", (r = n.domId) == null ? n.id : r), { cssStyles: l } = n, u = Math.max(35, (i = n == null ? void 0 : n.width) == null ? 0 : i), d = Math.max(35, (a = n == null ? void 0 : n.height) == null ? 0 : a), f = [
		{
			x: u,
			y: 0
		},
		{
			x: 0,
			y: d + 7 / 2
		},
		{
			x: u - 14,
			y: d + 7 / 2
		},
		{
			x: 0,
			y: 2 * d
		},
		{
			x: u,
			y: d - 7 / 2
		},
		{
			x: 14,
			y: d - 7 / 2
		}
	], p = S.svg(c), m = v(n, {});
	n.look !== "handDrawn" && (m.roughness = 0, m.fillStyle = "solid");
	let h = D(f), g = p.path(h, m), _ = c.insert(() => g, ":first-child");
	return _.attr("class", "outer-path"), l && n.look !== "handDrawn" && _.selectAll("path").attr("style", l), s && n.look !== "handDrawn" && _.selectAll("path").attr("style", s), _.attr("transform", `translate(-${u / 2},${-d})`), T(n, _), n.intersect = function(t) {
		return e.info("lightningBolt intersect", n, t), q.polygon(n, f, t);
	}, c;
}
t(Ue, "lightningBolt");
var We = /* @__PURE__ */ t((e, t, n, r, i, a, o) => [
	`M${e},${t + a}`,
	`a${i},${a} 0,0,0 ${n},0`,
	`a${i},${a} 0,0,0 ${-n},0`,
	`l0,${r}`,
	`a${i},${a} 0,0,0 ${n},0`,
	`l0,${-r}`,
	`M${e},${t + a + o}`,
	`a${i},${a} 0,0,0 ${n},0`
].join(" "), "createCylinderPathD"), Ge = /* @__PURE__ */ t((e, t, n, r, i, a, o) => [
	`M${e},${t + a}`,
	`M${e + n},${t + a}`,
	`a${i},${a} 0,0,0 ${-n},0`,
	`l0,${r}`,
	`a${i},${a} 0,0,0 ${n},0`,
	`l0,${-r}`,
	`M${e},${t + a + o}`,
	`a${i},${a} 0,0,0 ${n},0`
].join(" "), "createOuterCylinderPathD"), Ke = /* @__PURE__ */ t((e, t, n, r, i, a) => [`M${e - n / 2},${-r / 2}`, `a${i},${a} 0,0,0 ${n},0`].join(" "), "createInnerCylinderPathD"), qe = 10, Je = 10;
async function Ye(e, t) {
	var n, r, i;
	let { labelStyles: a, nodeStyles: o } = y(t);
	t.labelStyle = a;
	let s = (n = t.padding) == null ? 0 : n, c = t.look === "neo" ? 16 : s, l = t.look === "neo" ? 24 : s;
	if (t.width || t.height) {
		var u, d, f;
		let e = (u = t.width) == null ? 0 : u;
		t.width = ((d = t.width) == null ? 0 : d) - c, t.width < Je && (t.width = Je);
		let n = e / 2 / (2.5 + e / 50);
		t.height = ((f = t.height) == null ? 0 : f) - l - n * 3, t.height < qe && (t.height = qe);
	}
	let { shapeSvg: m, bbox: h, label: g } = await C(e, t, E(t)), _ = (t != null && t.width ? t == null ? void 0 : t.width : h.width) + c * 2, b = _ / 2, x = b / (2.5 + _ / 50), w = (t != null && t.height ? t == null ? void 0 : t.height : h.height) + x + l * 2, D = w * .1, O, { cssStyles: k } = t;
	if (t.look === "handDrawn") {
		let e = S.svg(m), n = Ge(0, 0, _, w, b, x, D), r = Ke(0, x, _, w, b, x), i = v(t, {}), a = e.path(n, i), o = e.path(r, i);
		m.insert(() => o, ":first-child").attr("class", "line"), O = m.insert(() => a, ":first-child"), O.attr("class", "basic label-container"), k && O.attr("style", k);
	} else {
		let e = We(0, 0, _, w, b, x, D);
		O = m.insert("path", ":first-child").attr("d", e).attr("class", "basic label-container outer-path").attr("style", p(k)).attr("style", o);
	}
	return O.attr("label-offset-y", x), O.attr("transform", `translate(${-_ / 2}, ${-(w / 2 + x)})`), T(t, O), g.attr("transform", `translate(${-(h.width / 2) - (h.x - ((r = h.left) == null ? 0 : r))}, ${-(h.height / 2) + x - (h.y - ((i = h.top) == null ? 0 : i))})`), t.intersect = function(e) {
		var n, r, i, a, o;
		let s = q.rect(t, e), c = s.x - ((n = t.x) == null ? 0 : n);
		if (b != 0 && (Math.abs(c) < ((r = t.width) == null ? 0 : r) / 2 || Math.abs(c) == ((i = t.width) == null ? 0 : i) / 2 && Math.abs(s.y - ((a = t.y) == null ? 0 : a)) > ((o = t.height) == null ? 0 : o) / 2 - x)) {
			var l;
			let n = x * x * (1 - c * c / (b * b));
			n > 0 && (n = Math.sqrt(n)), n = x - n, e.y - ((l = t.y) == null ? 0 : l) > 0 && (n = -n), s.y += n;
		}
		return s;
	}, m;
}
t(Ye, "linedCylinder");
async function Xe(e, t) {
	var n, r, i, a, o;
	let { labelStyles: s, nodeStyles: c } = y(t);
	t.labelStyle = s;
	let l = (n = t.padding) == null ? 0 : n, u = t.look === "neo" ? 16 : l, d = t.look === "neo" ? 12 : l;
	if (t.width || t.height) {
		var f;
		let e = t.width;
		t.width = (e == null ? 0 : e) * 10 / 11 - u * 2, t.width < 10 && (t.width = 10), t.height = ((f = t == null ? void 0 : t.height) == null ? 0 : f) - d * 2, t.height < 10 && (t.height = 10);
	}
	let { shapeSvg: p, bbox: m, label: h } = await C(e, t, E(t)), g = (t != null && t.width ? t == null ? void 0 : t.width : m.width) + (u == null ? 0 : u) * 2, _ = (t != null && t.height ? t == null ? void 0 : t.height : m.height) + (d == null ? 0 : d) * 2, b = t.look === "neo" ? _ / 4 : _ / 8, x = _ + b, { cssStyles: w } = t, D = S.svg(p), k = v(t, {});
	t.look !== "handDrawn" && (k.roughness = 0, k.fillStyle = "solid");
	let A = [
		{
			x: -g / 2 - g / 2 * .1,
			y: -x / 2
		},
		{
			x: -g / 2 - g / 2 * .1,
			y: x / 2
		},
		...O(-g / 2 - g / 2 * .1, x / 2, g / 2 + g / 2 * .1, x / 2, b, .8),
		{
			x: g / 2 + g / 2 * .1,
			y: -x / 2
		},
		{
			x: -g / 2 - g / 2 * .1,
			y: -x / 2
		},
		{
			x: -g / 2,
			y: -x / 2
		},
		{
			x: -g / 2,
			y: x / 2 * 1.1
		},
		{
			x: -g / 2,
			y: -x / 2
		}
	], j = D.polygon(A.map((e) => [e.x, e.y]), k), M = p.insert(() => j, ":first-child");
	return M.attr("class", "basic label-container outer-path"), w && t.look !== "handDrawn" && M.selectAll("path").attr("style", w), c && t.look !== "handDrawn" && M.selectAll("path").attr("style", c), M.attr("transform", `translate(0,${-b / 2})`), h.attr("transform", `translate(${-g / 2 + ((r = t.padding) == null ? 0 : r) + g / 2 * .1 / 2 - (m.x - ((i = m.left) == null ? 0 : i))},${-_ / 2 + ((a = t.padding) == null ? 0 : a) - b / 2 - (m.y - ((o = m.top) == null ? 0 : o))})`), T(t, M), t.intersect = function(e) {
		return q.polygon(t, A, e);
	}, p;
}
t(Xe, "linedWaveEdgedRect");
async function Ze(e, t) {
	var n, r, i;
	let { labelStyles: a, nodeStyles: o } = y(t);
	t.labelStyle = a;
	let s = (n = t.padding) == null ? 0 : n, c = t.look === "neo" ? 16 : s, l = t.look === "neo" ? 12 : s, u = t.look === "neo" ? 10 : 5;
	if (t.width || t.height) {
		var d, f;
		t.width = Math.max(((d = t == null ? void 0 : t.width) == null ? 0 : d) - c * 2 - 2 * u, 10), t.height = Math.max(((f = t == null ? void 0 : t.height) == null ? 0 : f) - l * 2 - 2 * u, 10);
	}
	let { shapeSvg: p, bbox: m, label: h } = await C(e, t, E(t)), g = (t != null && t.width ? t == null ? void 0 : t.width : m.width) + c * 2 + 2 * u, _ = (t != null && t.height ? t == null ? void 0 : t.height : m.height) + l * 2 + 2 * u, b = g - 2 * u, x = _ - 2 * u, w = -b / 2, O = -x / 2, { cssStyles: k } = t, j = S.svg(p), M = v(t, {}), N = [
		{
			x: w - u,
			y: O + u
		},
		{
			x: w - u,
			y: O + x + u
		},
		{
			x: w + b - u,
			y: O + x + u
		},
		{
			x: w + b - u,
			y: O + x
		},
		{
			x: w + b,
			y: O + x
		},
		{
			x: w + b,
			y: O + x - u
		},
		{
			x: w + b + u,
			y: O + x - u
		},
		{
			x: w + b + u,
			y: O - u
		},
		{
			x: w + u,
			y: O - u
		},
		{
			x: w + u,
			y: O
		},
		{
			x: w,
			y: O
		},
		{
			x: w,
			y: O + u
		}
	], P = [
		{
			x: w,
			y: O + u
		},
		{
			x: w + b - u,
			y: O + u
		},
		{
			x: w + b - u,
			y: O + x
		},
		{
			x: w + b,
			y: O + x
		},
		{
			x: w + b,
			y: O
		},
		{
			x: w,
			y: O
		}
	];
	t.look !== "handDrawn" && (M.roughness = 0, M.fillStyle = "solid");
	let F = D(N), I = j.path(F, M), L = D(P), R = j.path(L, M);
	t.look !== "handDrawn" && (I = A(I), R = A(R));
	let z = p.insert("g", ":first-child");
	return z.insert(() => I), z.insert(() => R), z.attr("class", "basic label-container outer-path"), k && t.look !== "handDrawn" && z.selectAll("path").attr("style", k), o && t.look !== "handDrawn" && z.selectAll("path").attr("style", o), h.attr("transform", `translate(${-(m.width / 2) - u - (m.x - ((r = m.left) == null ? 0 : r))}, ${-(m.height / 2) + u - (m.y - ((i = m.top) == null ? 0 : i))})`), T(t, z), t.intersect = function(e) {
		return q.polygon(t, N, e);
	}, p;
}
t(Ze, "multiRect");
async function Qe(e, t) {
	var n, r, i, a, o;
	let { labelStyles: s, nodeStyles: c } = y(t);
	t.labelStyle = s;
	let { shapeSvg: l, bbox: u, label: d } = await C(e, t, E(t)), f = (n = t.padding) == null ? 0 : n, p = t.look === "neo" ? 16 : f, m = t.look === "neo" ? 12 : f, h = !0;
	if (t.width || t.height) {
		var g, _;
		h = !1, t.width = ((g = t == null ? void 0 : t.width) == null ? 0 : g) - p * 2, t.height = ((_ = t == null ? void 0 : t.height) == null ? 0 : _) - m * 3;
	}
	let b = Math.max(u.width, (r = t == null ? void 0 : t.width) == null ? 0 : r) + p * 2, x = Math.max(u.height, (i = t == null ? void 0 : t.height) == null ? 0 : i) + m * 3, w = t.look === "neo" ? x / 4 : x / 8, k = x + (h ? w / 2 : -w / 2), A = -b / 2, j = -k / 2, { cssStyles: M } = t, N = O(A - 10, j + k + 10, A + b - 10, j + k + 10, w, .8), P = N == null ? void 0 : N[N.length - 1], F = [
		{
			x: A - 10,
			y: j + 10
		},
		{
			x: A - 10,
			y: j + k + 10
		},
		...N,
		{
			x: A + b - 10,
			y: P.y - 10
		},
		{
			x: A + b,
			y: P.y - 10
		},
		{
			x: A + b,
			y: P.y - 20
		},
		{
			x: A + b + 10,
			y: P.y - 20
		},
		{
			x: A + b + 10,
			y: j - 10
		},
		{
			x: A + 10,
			y: j - 10
		},
		{
			x: A + 10,
			y: j
		},
		{
			x: A,
			y: j
		},
		{
			x: A,
			y: j + 10
		}
	], I = [
		{
			x: A,
			y: j + 10
		},
		{
			x: A + b - 10,
			y: j + 10
		},
		{
			x: A + b - 10,
			y: P.y - 10
		},
		{
			x: A + b,
			y: P.y - 10
		},
		{
			x: A + b,
			y: j
		},
		{
			x: A,
			y: j
		}
	], L = S.svg(l), R = v(t, {});
	t.look !== "handDrawn" && (R.roughness = 0, R.fillStyle = "solid");
	let z = D(F), B = L.path(z, R), V = D(I), H = L.path(V, R), U = l.insert(() => B, ":first-child");
	return U.insert(() => H), U.attr("class", "basic label-container outer-path"), M && t.look !== "handDrawn" && U.selectAll("path").attr("style", M), c && t.look !== "handDrawn" && U.selectAll("path").attr("style", c), U.attr("transform", `translate(0,${-w / 2})`), d.attr("transform", `translate(${-(u.width / 2) - 10 - (u.x - ((a = u.left) == null ? 0 : a))}, ${-(u.height / 2) + 10 - w / 2 - (u.y - ((o = u.top) == null ? 0 : o))})`), T(t, U), t.intersect = function(e) {
		return q.polygon(t, F, e);
	}, l;
}
t(Qe, "multiWaveEdgedRectangle");
async function $e(e, t, { config: { themeVariables: n } }) {
	var r, i, a, c, l, u;
	let { labelStyles: d, nodeStyles: f } = y(t);
	t.labelStyle = d, t.useHtmlLabels || o(s()) || (t.centerLabel = !0);
	let { shapeSvg: p, bbox: m, label: h } = await C(e, t, E(t)), g = Math.max(m.width + ((r = t.padding) == null ? 0 : r) * 2, (i = t == null ? void 0 : t.width) == null ? 0 : i), _ = Math.max(m.height + ((a = t.padding) == null ? 0 : a) * 2, (c = t == null ? void 0 : t.height) == null ? 0 : c), b = -g / 2, x = -_ / 2, { cssStyles: w } = t, D = S.svg(p), O = v(t, {
		fill: n.noteBkgColor,
		stroke: n.noteBorderColor
	});
	t.look !== "handDrawn" && (O.roughness = 0, O.fillStyle = "solid");
	let k = D.rectangle(b, x, g, _, O), A = p.insert(() => k, ":first-child");
	return A.attr("class", "basic label-container outer-path"), h.attr("class", "label noteLabel"), w && t.look !== "handDrawn" && A.selectAll("path").attr("style", w), f && t.look !== "handDrawn" && A.selectAll("path").attr("style", f), h.attr("transform", `translate(${-m.width / 2 - (m.x - ((l = m.left) == null ? 0 : l))}, ${-(m.height / 2) - (m.y - ((u = m.top) == null ? 0 : u))})`), T(t, A), t.intersect = function(e) {
		return q.rect(t, e);
	}, p;
}
t($e, "note");
var et = /* @__PURE__ */ t((e, t, n) => [
	`M${e + n / 2},${t}`,
	`L${e + n},${t - n / 2}`,
	`L${e + n / 2},${t - n}`,
	`L${e},${t - n / 2}`,
	"Z"
].join(" "), "createDecisionBoxPathD");
async function tt(e, t) {
	var n, r;
	let { labelStyles: i, nodeStyles: a } = y(t);
	t.labelStyle = i;
	let { shapeSvg: o, bbox: s } = await C(e, t, E(t)), c = s.width + ((n = t.padding) == null ? 0 : n) + (s.height + ((r = t.padding) == null ? 0 : r)), l = .5, u = [
		{
			x: c / 2,
			y: 0
		},
		{
			x: c,
			y: -c / 2
		},
		{
			x: c / 2,
			y: -c
		},
		{
			x: 0,
			y: -c / 2
		}
	], d, { cssStyles: f } = t;
	if (t.look === "handDrawn") {
		let e = S.svg(o), n = v(t, {}), r = et(0, 0, c), i = e.path(r, n);
		d = o.insert(() => i, ":first-child").attr("transform", `translate(${-c / 2 + l}, ${c / 2})`), f && d.attr("style", f);
	} else d = Y(o, c, c, u), d.attr("transform", `translate(${-c / 2 + l}, ${c / 2})`);
	return a && d.attr("style", a), T(t, d), t.calcIntersect = function(e, t) {
		let n = e.width, r = [
			{
				x: n / 2,
				y: 0
			},
			{
				x: n,
				y: -n / 2
			},
			{
				x: n / 2,
				y: -n
			},
			{
				x: 0,
				y: -n / 2
			}
		], i = q.polygon(e, r, t);
		return {
			x: i.x - .5,
			y: i.y - .5
		};
	}, t.intersect = function(e) {
		return this.calcIntersect(t, e);
	}, o;
}
t(tt, "question");
async function nt(e, t) {
	var n, r, i, a, o;
	let { labelStyles: s, nodeStyles: c } = y(t);
	t.labelStyle = s;
	let l = (n = t.padding) == null ? 0 : n, u = t.look === "neo" ? 21 : l == null ? 0 : l, d = t.look === "neo" ? 12 : l == null ? 0 : l, { shapeSvg: f, bbox: p, label: m } = await C(e, t, E(t)), h = ((r = t == null ? void 0 : t.width) == null ? p.width : r) + (t.look === "neo" ? u * 2 : u), g = ((i = t == null ? void 0 : t.height) == null ? p.height : i) + (t.look === "neo" ? d * 2 : d), _ = -h / 2, b = -g / 2, x = b / 2, w = [
		{
			x: _ + x,
			y: b
		},
		{
			x: _,
			y: 0
		},
		{
			x: _ + x,
			y: -b
		},
		{
			x: -_,
			y: -b
		},
		{
			x: -_,
			y: b
		}
	], { cssStyles: O } = t, k = S.svg(f), A = v(t, {});
	t.look !== "handDrawn" && (A.roughness = 0, A.fillStyle = "solid");
	let j = D(w), M = k.path(j, A), N = f.insert(() => M, ":first-child");
	return N.attr("class", "basic label-container outer-path"), O && t.look !== "handDrawn" && N.selectAll("path").attr("style", O), c && t.look !== "handDrawn" && N.selectAll("path").attr("style", c), N.attr("transform", `translate(${-x / 2},0)`), m.attr("transform", `translate(${-x / 2 - p.width / 2 - (p.x - ((a = p.left) == null ? 0 : a))}, ${-(p.height / 2) - (p.y - ((o = p.top) == null ? 0 : o))})`), T(t, N), t.intersect = function(e) {
		return q.polygon(t, w, e);
	}, f;
}
t(nt, "rect_left_inv_arrow");
async function rt(t, r) {
	let { labelStyles: i, nodeStyles: a } = y(r);
	r.labelStyle = i;
	let s;
	s = r.cssClasses ? "node " + r.cssClasses : "node default";
	let c = t.insert("g").attr("class", s).attr("id", r.domId || r.id), u = c.insert("g"), d = c.insert("g").attr("class", "label").attr("style", a), f = r.description, p = r.label, m = await M(d, p, r.labelStyle, !0, !0), h = {
		width: 0,
		height: 0
	};
	if (o(l())) {
		let e = m.children[0], t = n(m);
		h = e.getBoundingClientRect(), t.attr("width", h.width), t.attr("height", h.height);
	}
	e.info("Text 2", f);
	let g = f || [], _ = m.getBBox(), b = await M(d, Array.isArray(g) ? g.join("<br/>") : g, r.labelStyle, !0, !0), x = b.children[0], C = n(b);
	h = x.getBoundingClientRect(), C.attr("width", h.width), C.attr("height", h.height);
	let w = (r.padding || 0) / 2;
	n(b).attr("transform", "translate( " + (h.width > _.width ? 0 : (_.width - h.width) / 2) + ", " + (_.height + w + 5) + ")"), n(m).attr("transform", "translate( " + (h.width < _.width ? 0 : -(_.width - h.width) / 2) + ", 0)"), h = d.node().getBBox(), d.attr("transform", "translate(" + -h.width / 2 + ", " + (-h.height / 2 - w + 3) + ")");
	let E = h.width + (r.padding || 0), D = h.height + (r.padding || 0), O = -h.width / 2 - w, k = -h.height / 2 - w, A, j;
	if (r.look === "handDrawn") {
		let t = S.svg(c), n = v(r, {}), i = t.path(N(O, k, E, D, r.rx || 0), n), a = t.line(-h.width / 2 - w, -h.height / 2 - w + _.height + w, h.width / 2 + w, -h.height / 2 - w + _.height + w, n);
		j = c.insert(() => (e.debug("Rough node insert CXC", i), a), ":first-child"), A = c.insert(() => (e.debug("Rough node insert CXC", i), i), ":first-child");
	} else A = u.insert("rect", ":first-child"), j = u.insert("line"), A.attr("class", "outer title-state").attr("style", a).attr("x", -h.width / 2 - w).attr("y", -h.height / 2 - w).attr("width", h.width + (r.padding || 0)).attr("height", h.height + (r.padding || 0)), j.attr("class", "divider").attr("x1", -h.width / 2 - w).attr("x2", h.width / 2 + w).attr("y1", -h.height / 2 - w + _.height + w).attr("y2", -h.height / 2 - w + _.height + w);
	return T(r, A), r.intersect = function(e) {
		return q.rect(r, e);
	}, c;
}
t(rt, "rectWithTitle");
async function it(e, t, { config: { themeVariables: n } }) {
	var r, i, a;
	let o = (r = n == null ? void 0 : n.radius) == null ? 5 : r;
	return xe(e, t, {
		rx: o,
		ry: o,
		classes: "",
		labelPaddingX: ((i = t == null ? void 0 : t.padding) == null ? 0 : i) * 1,
		labelPaddingY: ((a = t == null ? void 0 : t.padding) == null ? 0 : a) * 1
	});
}
t(it, "roundedRect");
var at = 8;
async function ot(e, t) {
	var n, r, i, a, o, s;
	let { labelStyles: c, nodeStyles: l } = y(t);
	t.labelStyle = c;
	let u = t.look === "neo" ? 16 : (n = t.padding) == null ? 0 : n, d = t.look === "neo" ? 12 : (r = t.padding) == null ? 0 : r, { shapeSvg: f, bbox: m, label: h } = await C(e, t, E(t)), g = ((i = t == null ? void 0 : t.width) == null ? m.width : i) + u * 2 + (t.look === "neo" ? at : at * 2), _ = ((a = t == null ? void 0 : t.height) == null ? m.height : a) + d * 2, b = g - at, x = _, w = at - g / 2, D = -_ / 2, { cssStyles: O } = t, k = S.svg(f), A = v(t, {});
	t.look !== "handDrawn" && (A.roughness = 0, A.fillStyle = "solid");
	let j = [
		{
			x: w,
			y: D
		},
		{
			x: w + b,
			y: D
		},
		{
			x: w + b,
			y: D + x
		},
		{
			x: w - at,
			y: D + x
		},
		{
			x: w - at,
			y: D
		},
		{
			x: w,
			y: D
		},
		{
			x: w,
			y: D + x
		}
	], M = k.polygon(j.map((e) => [e.x, e.y]), A), N = f.insert(() => M, ":first-child");
	return N.attr("class", "basic label-container outer-path").attr("style", p(O)), l && t.look !== "handDrawn" && N.selectAll("path").attr("style", l), O && t.look !== "handDrawn" && N.selectAll("path").attr("style", l), h.attr("transform", `translate(${at / 2 - m.width / 2 - (m.x - ((o = m.left) == null ? 0 : o))}, ${-(m.height / 2) - (m.y - ((s = m.top) == null ? 0 : s))})`), T(t, N), t.intersect = function(e) {
		return q.rect(t, e);
	}, f;
}
t(ot, "shadedProcess");
async function st(e, t) {
	var n, r, i, a, o;
	let { labelStyles: s, nodeStyles: c } = y(t);
	t.labelStyle = s;
	let l = (n = t.padding) == null ? 0 : n, u = t.look === "neo" ? 16 : l, d = t.look === "neo" ? 12 : l;
	if (t.width || t.height) {
		var f, p;
		t.width = Math.max(((f = t == null ? void 0 : t.width) == null ? 0 : f) - u * 2, 10), t.height = Math.max(((p = t == null ? void 0 : t.height) == null ? 0 : p) / 1.5 - d * 2, 10);
	}
	let { shapeSvg: m, bbox: h, label: g } = await C(e, t, E(t)), _ = (t != null && t.width ? t == null ? void 0 : t.width : h.width) + u * 2, b = ((t != null && t.height ? t == null ? void 0 : t.height : h.height) + d * 2) * 1.5, x = _, w = b / 1.5, O = -x / 2, k = -w / 2, { cssStyles: A } = t, j = S.svg(m), M = v(t, {});
	t.look !== "handDrawn" && (M.roughness = 0, M.fillStyle = "solid");
	let N = [
		{
			x: O,
			y: k
		},
		{
			x: O,
			y: k + w
		},
		{
			x: O + x,
			y: k + w
		},
		{
			x: O + x,
			y: k - w / 2
		}
	], P = D(N), F = j.path(P, M), I = m.insert(() => F, ":first-child");
	return I.attr("class", "basic label-container  outer-path"), A && t.look !== "handDrawn" && I.selectChildren("path").attr("style", A), c && t.look !== "handDrawn" && I.selectChildren("path").attr("style", c), I.attr("transform", `translate(0, ${w / 4})`), g.attr("transform", `translate(${-x / 2 + ((r = t.padding) == null ? 0 : r) - (h.x - ((i = h.left) == null ? 0 : i))}, ${-w / 4 + ((a = t.padding) == null ? 0 : a) - (h.y - ((o = h.top) == null ? 0 : o))})`), T(t, I), t.intersect = function(e) {
		return q.polygon(t, N, e);
	}, m;
}
t(st, "slopedRect");
async function ct(e, t) {
	var n, r;
	let i = (n = t.padding) == null ? 0 : n, a = t.look === "neo" ? 16 : i * 2, o = t.look === "neo" ? 12 : i;
	return xe(e, t, {
		rx: 0,
		ry: 0,
		classes: "",
		labelPaddingX: (r = t.labelPaddingX) == null ? a : r,
		labelPaddingY: o
	});
}
t(ct, "squareRect");
async function lt(e, t) {
	var n;
	let { labelStyles: r, nodeStyles: i } = y(t);
	t.labelStyle = r;
	let a = (n = t.padding) == null ? 0 : n, o = t.look === "neo" ? 20 : a, s = t.look === "neo" ? 12 : a, { shapeSvg: c, bbox: l } = await C(e, t, E(t)), u = l.height + (t.look === "neo" ? s * 2 : s), d = l.width + u / 4 + (t.look === "neo" ? o * 2 : o), f = u / 2, { cssStyles: p } = t, m = S.svg(c), h = v(t, {});
	t.look !== "handDrawn" && (h.roughness = 0, h.fillStyle = "solid");
	let g = [
		{
			x: -d / 2 + f,
			y: -u / 2
		},
		{
			x: d / 2 - f,
			y: -u / 2
		},
		...k(-d / 2 + f, 0, f, 50, 90, 270),
		{
			x: d / 2 - f,
			y: u / 2
		},
		...k(d / 2 - f, 0, f, 50, 270, 450)
	], _ = D(g), b = m.path(_, h), x = c.insert(() => b, ":first-child");
	return x.attr("class", "basic label-container outer-path"), p && t.look !== "handDrawn" && x.selectChildren("path").attr("style", p), i && t.look !== "handDrawn" && x.selectChildren("path").attr("style", i), T(t, x), t.intersect = function(e) {
		return q.polygon(t, g, e);
	}, c;
}
t(lt, "stadium");
async function ut(e, t) {
	return xe(e, t, {
		rx: t.look === "neo" ? 3 : 5,
		ry: t.look === "neo" ? 3 : 5,
		classes: "flowchart-node"
	});
}
t(ut, "state");
function dt(e, t, { config: { themeVariables: n } }) {
	var r, i;
	let { labelStyles: a, nodeStyles: o } = y(t);
	t.labelStyle = a;
	let { cssStyles: s } = t, { lineColor: c, stateBorder: l, nodeBorder: u, nodeShadow: d } = n;
	if (t.width || t.height) {
		var f, p;
		((f = t.width) == null ? 0 : f) < 14 && (t.width = 14), ((p = t.height) == null ? 0 : p) < 14 && (t.height = 14);
	}
	t.width || (t.width = 14), t.height || (t.height = 14);
	let m = e.insert("g").attr("class", "node default").attr("id", (r = t.domId) == null ? t.id : r), h = S.svg(m), g = v(t, {});
	t.look !== "handDrawn" && (g.roughness = 0, g.fillStyle = "solid");
	let _ = h.circle(0, 0, t.width, {
		...g,
		stroke: c,
		strokeWidth: 2
	}), b = l == null ? u : l, x = ((i = t.width) == null ? 0 : i) * 5 / 14, C = h.circle(0, 0, x, {
		...g,
		fill: b,
		stroke: b,
		strokeWidth: 2,
		fillStyle: "solid"
	}), w = m.insert(() => _, ":first-child");
	if (w.insert(() => C), t.look !== "handDrawn" && w.attr("class", "outer-path"), s && w.selectAll("path").attr("style", s), o && w.selectAll("path").attr("style", o), t.width < 25 && d && t.look !== "handDrawn") {
		var E, D;
		let t = (E = (D = e.node()) == null || (D = D.ownerSVGElement) == null ? void 0 : D.id) == null ? "" : E, n = t ? `${t}-drop-shadow-small` : "drop-shadow-small";
		w.attr("style", `filter:url(#${n})`);
	}
	return T(t, w), t.intersect = function(e) {
		var n;
		return q.circle(t, ((n = t.width) == null ? 0 : n) / 2, e);
	}, m;
}
t(dt, "stateEnd");
function ft(e, t, { config: { themeVariables: n } }) {
	let { lineColor: r, nodeShadow: i } = n;
	if (t.width || t.height) {
		var a, o;
		((a = t.width) == null ? 0 : a) < 14 && (t.width = 14), ((o = t.height) == null ? 0 : o) < 14 && (t.height = 14);
	}
	t.width || (t.width = 14), t.height || (t.height = 14);
	let s = e.insert("g").attr("class", "node default").attr("id", t.domId || t.id), c;
	if (t.look === "handDrawn") {
		var l, u, d;
		let e = S.svg(s).circle(0, 0, t.width, b(r));
		c = s.insert(() => e), c.attr("class", "state-start").attr("r", ((l = t.width) == null ? 7 : l) / 2).attr("width", (u = t.width) == null ? 14 : u).attr("height", (d = t.height) == null ? 14 : d);
	} else {
		var f, p, m;
		c = s.insert("circle", ":first-child"), c.attr("class", "state-start").attr("r", ((f = t.width) == null ? 7 : f) / 2).attr("width", (p = t.width) == null ? 14 : p).attr("height", (m = t.height) == null ? 14 : m);
	}
	if (t.width < 25 && i && t.look !== "handDrawn") {
		var h, g;
		let t = (h = (g = e.node()) == null || (g = g.ownerSVGElement) == null ? void 0 : g.id) == null ? "" : h, n = t ? `${t}-drop-shadow-small` : "drop-shadow-small";
		c.attr("style", `filter:url(#${n})`);
	}
	return T(t, c), t.intersect = function(e) {
		var n;
		return q.circle(t, ((n = t.width) == null ? 7 : n) / 2, e);
	}, s;
}
t(ft, "stateStart");
var pt = 8;
async function mt(e, t) {
	var n, r, i;
	let { labelStyles: a, nodeStyles: o } = y(t);
	t.labelStyle = a;
	let s = (n = t == null ? void 0 : t.padding) == null ? 8 : n, c = t.look === "neo" ? 28 : s, l = t.look === "neo" ? 12 : s, { shapeSvg: u, bbox: d } = await C(e, t, E(t)), f = ((r = t == null ? void 0 : t.width) == null ? d.width : r) + 2 * pt + c, m = ((i = t == null ? void 0 : t.height) == null ? d.height : i) + l, h = f - 2 * pt, g = m, _ = -f / 2, b = -m / 2, x = [
		{
			x: 0,
			y: 0
		},
		{
			x: h,
			y: 0
		},
		{
			x: h,
			y: -g
		},
		{
			x: 0,
			y: -g
		},
		{
			x: 0,
			y: 0
		},
		{
			x: -8,
			y: 0
		},
		{
			x: h + 8,
			y: 0
		},
		{
			x: h + 8,
			y: -g
		},
		{
			x: -8,
			y: -g
		},
		{
			x: -8,
			y: 0
		}
	];
	if (t.look === "handDrawn") {
		let e = S.svg(u), n = v(t, {}), r = e.rectangle(_, b, h + 16, g, n), i = e.line(_ + pt, b, _ + pt, b + g, n), a = e.line(_ + pt + h, b, _ + pt + h, b + g, n);
		u.insert(() => i, ":first-child"), u.insert(() => a, ":first-child");
		let o = u.insert(() => r, ":first-child"), { cssStyles: s } = t;
		o.attr("class", "basic label-container").attr("style", p(s)), T(t, o);
	} else {
		let e = Y(u, h, g, x);
		o && e.attr("style", o), T(t, e);
	}
	return t.intersect = function(e) {
		return q.polygon(t, x, e);
	}, u;
}
t(mt, "subroutine");
var ht = .2;
async function gt(e, t) {
	var n;
	let { labelStyles: r, nodeStyles: i } = y(t);
	t.labelStyle = r;
	let a = (n = t.padding) == null ? 0 : n, o = t.look === "neo" ? 16 : a, s = t.look === "neo" ? 12 : a;
	if (t.width || t.height) {
		var c, l;
		t.height = Math.max(((c = t == null ? void 0 : t.height) == null ? 0 : c) - s * 2, 10), t.width = Math.max(((l = t == null ? void 0 : t.width) == null ? 0 : l) - o * 2 - ht * (t.height + s * 2), 10);
	}
	let { shapeSvg: u, bbox: d } = await C(e, t, E(t)), f = (t != null && t.height ? t == null ? void 0 : t.height : d.height) + s * 2, p = ht * f, m = ht * f, h = (t != null && t.width ? t == null ? void 0 : t.width : d.width) + o * 2 + p - p, g = f, _ = -h / 2, b = -g / 2, { cssStyles: x } = t, w = S.svg(u), O = v(t, {}), k = [
		{
			x: _ - p / 2,
			y: b
		},
		{
			x: _ + h + p / 2,
			y: b
		},
		{
			x: _ + h + p / 2,
			y: b + g
		},
		{
			x: _ - p / 2,
			y: b + g
		}
	], A = [
		{
			x: _ + h - p / 2,
			y: b + g
		},
		{
			x: _ + h + p / 2,
			y: b + g
		},
		{
			x: _ + h + p / 2,
			y: b + g - m
		}
	];
	t.look !== "handDrawn" && (O.roughness = 0, O.fillStyle = "solid");
	let j = D(k), M = w.path(j, O), N = D(A), P = w.path(N, {
		...O,
		fillStyle: "solid"
	}), F = u.insert(() => P, ":first-child");
	return F.insert(() => M, ":first-child"), F.attr("class", "basic label-container outer-path"), x && t.look !== "handDrawn" && F.selectAll("path").attr("style", x), i && t.look !== "handDrawn" && F.selectAll("path").attr("style", i), T(t, F), t.intersect = function(e) {
		return q.polygon(t, k, e);
	}, u;
}
t(gt, "taggedRect");
async function _t(e, t) {
	var n, r, i, a, o, s, c, l;
	let { labelStyles: u, nodeStyles: d } = y(t);
	t.labelStyle = u;
	let { shapeSvg: f, bbox: p, label: m } = await C(e, t, E(t)), h = Math.max(p.width + ((n = t.padding) == null ? 0 : n) * 2, (r = t == null ? void 0 : t.width) == null ? 0 : r), g = Math.max(p.height + ((i = t.padding) == null ? 0 : i) * 2, (a = t == null ? void 0 : t.height) == null ? 0 : a), _ = g / 8, b = .2 * h, x = .2 * g, w = g + _, { cssStyles: k } = t, A = S.svg(f), j = v(t, {});
	t.look !== "handDrawn" && (j.roughness = 0, j.fillStyle = "solid");
	let M = [
		{
			x: -h / 2 - h / 2 * .1,
			y: w / 2
		},
		...O(-h / 2 - h / 2 * .1, w / 2, h / 2 + h / 2 * .1, w / 2, _, .8),
		{
			x: h / 2 + h / 2 * .1,
			y: -w / 2
		},
		{
			x: -h / 2 - h / 2 * .1,
			y: -w / 2
		}
	], N = -h / 2 + h / 2 * .1, P = -w / 2 - x * .4, F = [
		{
			x: N + h - b,
			y: (P + g) * 1.3
		},
		{
			x: N + h,
			y: P + g - x
		},
		{
			x: N + h,
			y: (P + g) * .9
		},
		...O(N + h, (P + g) * 1.25, N + h - b, (P + g) * 1.3, -g * .02, .5)
	], I = D(M), L = A.path(I, j), R = D(F), z = A.path(R, {
		...j,
		fillStyle: "solid"
	}), B = f.insert(() => z, ":first-child");
	return B.insert(() => L, ":first-child"), B.attr("class", "basic label-container outer-path"), k && t.look !== "handDrawn" && B.selectAll("path").attr("style", k), d && t.look !== "handDrawn" && B.selectAll("path").attr("style", d), B.attr("transform", `translate(0,${-_ / 2})`), m.attr("transform", `translate(${-h / 2 + ((o = t.padding) == null ? 0 : o) - (p.x - ((s = p.left) == null ? 0 : s))},${-g / 2 + ((c = t.padding) == null ? 0 : c) - _ / 2 - (p.y - ((l = p.top) == null ? 0 : l))})`), T(t, B), t.intersect = function(e) {
		return q.polygon(t, M, e);
	}, f;
}
t(_t, "taggedWaveEdgedRectangle");
async function vt(e, t) {
	var n, r;
	let { labelStyles: i, nodeStyles: a } = y(t);
	t.labelStyle = i;
	let { shapeSvg: o, bbox: s } = await C(e, t, E(t)), c = Math.max(s.width + ((n = t.padding) == null ? 0 : n), (t == null ? void 0 : t.width) || 0), l = Math.max(s.height + ((r = t.padding) == null ? 0 : r), (t == null ? void 0 : t.height) || 0), u = -c / 2, d = -l / 2, f = o.insert("rect", ":first-child");
	return f.attr("class", "text").attr("style", a).attr("rx", 0).attr("ry", 0).attr("x", u).attr("y", d).attr("width", c).attr("height", l), T(t, f), t.intersect = function(e) {
		return q.rect(t, e);
	}, o;
}
t(vt, "text");
var yt = /* @__PURE__ */ t((e, t, n, r, i, a) => `M${e},${t}
    a${i},${a} 0,0,1 0,${-r}
    l${n},0
    a${i},${a} 0,0,1 0,${r}
    M${n},${-r}
    a${i},${a} 0,0,0 0,${r}
    l${-n},0`, "createCylinderPathD"), bt = /* @__PURE__ */ t((e, t, n, r, i, a) => [
	`M${e},${t}`,
	`M${e + n},${t}`,
	`a${i},${a} 0,0,0 0,${-r}`,
	`l${-n},0`,
	`a${i},${a} 0,0,0 0,${r}`,
	`l${n},0`
].join(" "), "createOuterCylinderPathD"), xt = /* @__PURE__ */ t((e, t, n, r, i, a) => [`M${e + n / 2},${-r / 2}`, `a${i},${a} 0,0,0 0,${r}`].join(" "), "createInnerCylinderPathD"), St = 5, Ct = 10;
async function wt(e, t) {
	var n, r, i;
	let { labelStyles: a, nodeStyles: o } = y(t);
	t.labelStyle = a;
	let s = (n = t.padding) == null ? 0 : n, c = t.look === "neo" ? 12 : s / 2;
	if (t.width || t.height) {
		var l, u, d;
		let e = (l = t.height) == null ? 0 : l;
		t.height = ((u = t.height) == null ? 0 : u) - c, t.height < St && (t.height = St);
		let n = e / 2 / (2.5 + e / 50);
		t.width = ((d = t.width) == null ? 0 : d) - c - n * 3, t.width < Ct && (t.width = Ct);
	}
	let { shapeSvg: f, bbox: m, label: h } = await C(e, t, E(t)), g = (t.height ? t.height : m.height) + c, _ = g / 2, b = _ / (2.5 + g / 50), x = (t.width ? t.width : m.width) + b + c, { cssStyles: w } = t, D;
	if (t.look === "handDrawn") {
		let e = S.svg(f), n = bt(0, 0, x, g, b, _), r = xt(0, 0, x, g, b, _), i = e.path(n, v(t, {})), a = e.path(r, v(t, { fill: "none" }));
		D = f.insert(() => a, ":first-child"), D = f.insert(() => i, ":first-child"), D.attr("class", "basic label-container"), w && D.attr("style", w);
	} else {
		let e = yt(0, 0, x, g, b, _);
		D = f.insert("path", ":first-child").attr("d", e).attr("class", "basic label-container").attr("style", p(w)).attr("style", o), D.attr("class", "basic label-container outer-path"), w && D.selectAll("path").attr("style", w), o && D.selectAll("path").attr("style", o);
	}
	return D.attr("label-offset-x", b), D.attr("transform", `translate(${-x / 2}, ${g / 2} )`), h.attr("transform", `translate(${-(m.width / 2) - b - (m.x - ((r = m.left) == null ? 0 : r))}, ${-(m.height / 2) - (m.y - ((i = m.top) == null ? 0 : i))})`), T(t, D), t.intersect = function(e) {
		var n, r, i, a, o;
		let s = q.rect(t, e), c = s.y - ((n = t.y) == null ? 0 : n);
		if (_ != 0 && (Math.abs(c) < ((r = t.height) == null ? 0 : r) / 2 || Math.abs(c) == ((i = t.height) == null ? 0 : i) / 2 && Math.abs(s.x - ((a = t.x) == null ? 0 : a)) > ((o = t.width) == null ? 0 : o) / 2 - b)) {
			var l;
			let n = b * b * (1 - c * c / (_ * _));
			n != 0 && (n = Math.sqrt(Math.abs(n))), n = b - n, e.x - ((l = t.x) == null ? 0 : l) > 0 && (n = -n), s.x += n;
		}
		return s;
	}, f;
}
t(wt, "tiltedCylinder");
async function Tt(e, t) {
	var n, r, i;
	let { labelStyles: a, nodeStyles: o } = y(t);
	t.labelStyle = a;
	let s = (n = t.padding) == null ? 0 : n, c = (t.look, s), l = t.look === "neo" ? s * 2 : s, { shapeSvg: u, bbox: d } = await C(e, t, E(t)), f = ((r = t == null ? void 0 : t.height) == null ? d.height : r) + c, p = ((i = t == null ? void 0 : t.width) == null ? d.width : i) + l, m = [
		{
			x: -3 * f / 6,
			y: 0
		},
		{
			x: p + 3 * f / 6,
			y: 0
		},
		{
			x: p,
			y: -f
		},
		{
			x: 0,
			y: -f
		}
	], h, { cssStyles: g } = t;
	if (t.look === "handDrawn") {
		let e = S.svg(u), n = v(t, {}), r = D(m), i = e.path(r, n);
		h = u.insert(() => i, ":first-child").attr("transform", `translate(${-p / 2}, ${f / 2})`), g && h.attr("style", g);
	} else h = Y(u, p, f, m);
	return o && h.attr("style", o), t.width = p, t.height = f, T(t, h), t.intersect = function(e) {
		return q.polygon(t, m, e);
	}, u;
}
t(Tt, "trapezoid");
async function Et(e, t) {
	var n;
	let { labelStyles: r, nodeStyles: i } = y(t);
	t.labelStyle = r;
	let a = (n = t.padding) == null ? 0 : n, o = t.look === "neo" ? 16 : a, s = t.look === "neo" ? 12 : a;
	if (t.width || t.height) {
		var c, l;
		t.height = ((c = t.height) == null ? 0 : c) - s * 2, t.height < 5 && (t.height = 5), t.width = ((l = t.width) == null ? 0 : l) - o * 2, t.width < 15 && (t.width = 15);
	}
	let { shapeSvg: u, bbox: d } = await C(e, t, E(t)), f = (t != null && t.width ? t == null ? void 0 : t.width : d.width) + o * 2, p = (t != null && t.height ? t == null ? void 0 : t.height : d.height) + s * 2, { cssStyles: m } = t, h = S.svg(u), g = v(t, {});
	t.look !== "handDrawn" && (g.roughness = 0, g.fillStyle = "solid");
	let _ = [
		{
			x: -f / 2 * .8,
			y: -p / 2
		},
		{
			x: f / 2 * .8,
			y: -p / 2
		},
		{
			x: f / 2,
			y: -p / 2 * .6
		},
		{
			x: f / 2,
			y: p / 2
		},
		{
			x: -f / 2,
			y: p / 2
		},
		{
			x: -f / 2,
			y: -p / 2 * .6
		}
	], b = D(_), x = h.path(b, g), w = u.insert(() => x, ":first-child");
	return w.attr("class", "basic label-container outer-path"), m && t.look !== "handDrawn" && w.selectChildren("path").attr("style", m), i && t.look !== "handDrawn" && w.selectChildren("path").attr("style", i), T(t, w), t.intersect = function(e) {
		return q.polygon(t, _, e);
	}, u;
}
t(Et, "trapezoidalPentagon");
var Dt = 10, Ot = 10;
async function kt(t, n) {
	var r, i, a, o, s;
	let { labelStyles: u, nodeStyles: d } = y(n);
	n.labelStyle = u;
	let f = (r = n.padding) == null ? 0 : r, p = n.look === "neo" ? f * 2 : f;
	if (n.width || n.height) {
		var m, h;
		n.width = (((m = n == null ? void 0 : n.width) == null ? 0 : m) - p) / 2, n.width < Ot && (n.width = Ot), n.height = (h = n == null ? void 0 : n.height) == null ? 0 : h, n.height < Dt && (n.height = Dt);
	}
	let { shapeSvg: g, bbox: _, label: b } = await C(t, n, E(n)), x = c((i = l().flowchart) == null ? void 0 : i.htmlLabels), w = (n != null && n.width ? n == null ? void 0 : n.width : _.width) + p, O = n != null && n.height ? n == null ? void 0 : n.height : w + _.height, k = O, A = [
		{
			x: 0,
			y: 0
		},
		{
			x: k,
			y: 0
		},
		{
			x: k / 2,
			y: -O
		}
	], { cssStyles: j } = n, M = S.svg(g), N = v(n, {});
	n.look !== "handDrawn" && (N.roughness = 0, N.fillStyle = "solid");
	let P = D(A), F = M.path(P, N), I = g.insert(() => F, ":first-child").attr("transform", `translate(${-O / 2}, ${O / 2})`).attr("class", "outer-path");
	return j && n.look !== "handDrawn" && I.selectChildren("path").attr("style", j), d && n.look !== "handDrawn" && I.selectChildren("path").attr("style", d), n.width = w, n.height = O, T(n, I), b.attr("transform", `translate(${-_.width / 2 - (_.x - ((a = _.left) == null ? 0 : a))}, ${O / 2 - (_.height + ((o = n.padding) == null ? 0 : o) / (x ? 2 : 1) - (_.y - ((s = _.top) == null ? 0 : s)))})`), n.intersect = function(t) {
		return e.info("Triangle intersect", n, A, t), q.polygon(n, A, t);
	}, g;
}
t(kt, "triangle");
async function At(e, t) {
	var n, r, i, a, o;
	let { labelStyles: s, nodeStyles: c } = y(t);
	t.labelStyle = s;
	let l = (n = t.padding) == null ? 0 : n, u = t.look === "neo" ? 16 : l, d = t.look === "neo" ? 12 : l, f = !0;
	if (t.width || t.height) {
		var p, m;
		f = !1, t.width = ((p = t == null ? void 0 : t.width) == null ? 0 : p) - u * 2, t.width < 10 && (t.width = 10), t.height = ((m = t == null ? void 0 : t.height) == null ? 0 : m) - d * 2, t.height < 10 && (t.height = 10);
	}
	let { shapeSvg: h, bbox: g, label: _ } = await C(e, t, E(t)), b = (t != null && t.width ? t == null ? void 0 : t.width : g.width) + (u == null ? 0 : u) * 2, x = (t != null && t.height ? t == null ? void 0 : t.height : g.height) + (d == null ? 0 : d) * 2, w = t.look === "neo" ? x / 4 : x / 8, k = x + (f ? w : -w), { cssStyles: A } = t, j = 14 - b, M = j > 0 ? j / 2 : 0, N = S.svg(h), P = v(t, {});
	t.look !== "handDrawn" && (P.roughness = 0, P.fillStyle = "solid");
	let F = [
		{
			x: -b / 2 - M,
			y: k / 2
		},
		...O(-b / 2 - M, k / 2, b / 2 + M, k / 2, w, .8),
		{
			x: b / 2 + M,
			y: -k / 2
		},
		{
			x: -b / 2 - M,
			y: -k / 2
		}
	], I = D(F), L = N.path(I, P), R = h.insert(() => L, ":first-child");
	return R.attr("class", "basic label-container outer-path"), A && t.look !== "handDrawn" && R.selectAll("path").attr("style", A), c && t.look !== "handDrawn" && R.selectAll("path").attr("style", c), R.attr("transform", `translate(0,${-w / 2})`), _.attr("transform", `translate(${-b / 2 + ((r = t.padding) == null ? 0 : r) - (g.x - ((i = g.left) == null ? 0 : i))},${-x / 2 + ((a = t.padding) == null ? 0 : a) - w - (g.y - ((o = g.top) == null ? 0 : o))})`), T(t, R), t.intersect = function(e) {
		return q.polygon(t, F, e);
	}, h;
}
t(At, "waveEdgedRectangle");
async function jt(e, t) {
	var n;
	let { labelStyles: r, nodeStyles: i } = y(t);
	t.labelStyle = r;
	let a = (n = t.padding) == null ? 0 : n, o = t.look === "neo" ? 16 : a, s = t.look === "neo" ? 20 : a;
	if (t.width || t.height) {
		var c, l;
		t.width = (c = t == null ? void 0 : t.width) == null ? 0 : c, t.width < 20 && (t.width = 20), t.height = (l = t == null ? void 0 : t.height) == null ? 0 : l, t.height < 10 && (t.height = 10);
		let e = Math.min(t.height * .2, t.height / 4);
		t.height = Math.ceil(t.height - s - 20 / 9 * e), t.width -= o * 2;
	}
	let { shapeSvg: u, bbox: d } = await C(e, t, E(t)), f = (t != null && t.width ? t == null ? void 0 : t.width : d.width) + o * 2, p = (t != null && t.height ? t == null ? void 0 : t.height : d.height) + s, m = p / 8, h = p + m * 2, { cssStyles: g } = t, _ = S.svg(u), b = v(t, {});
	t.look !== "handDrawn" && (b.roughness = 0, b.fillStyle = "solid");
	let x = [
		{
			x: -f / 2,
			y: h / 2
		},
		...O(-f / 2, h / 2, f / 2, h / 2, m, 1),
		{
			x: f / 2,
			y: -h / 2
		},
		...O(f / 2, -h / 2, -f / 2, -h / 2, m, -1)
	], w = D(x), k = _.path(w, b), A = u.insert(() => k, ":first-child");
	return A.attr("class", "basic label-container"), g && t.look !== "handDrawn" && A.selectAll("path").attr("style", g), i && t.look !== "handDrawn" && A.selectAll("path").attr("style", i), T(t, A), t.intersect = function(e) {
		return q.polygon(t, x, e);
	}, u;
}
t(jt, "waveRectangle");
var $ = 10;
async function Mt(e, t) {
	var n, r, i, a;
	let { labelStyles: o, nodeStyles: s } = y(t);
	t.labelStyle = o;
	let c = t.look === "neo" ? 16 : (n = t.padding) == null ? 0 : n, l = t.look === "neo" ? 12 : (r = t.padding) == null ? 0 : r;
	if (t.width || t.height) {
		var u, d;
		t.width = Math.max(((u = t == null ? void 0 : t.width) == null ? 0 : u) - c * 2 - $, 10), t.height = Math.max(((d = t == null ? void 0 : t.height) == null ? 0 : d) - l * 2 - $, 10);
	}
	let { shapeSvg: f, bbox: p, label: m } = await C(e, t, E(t)), h = (t != null && t.width ? t == null ? void 0 : t.width : p.width) + c * 2 + $, g = (t != null && t.height ? t == null ? void 0 : t.height : p.height) + l * 2 + $, _ = h - $, b = g - $, x = -_ / 2, w = -b / 2, { cssStyles: D } = t, O = S.svg(f), k = v(t, {}), A = [
		{
			x: x - $,
			y: w - $
		},
		{
			x: x - $,
			y: w + b
		},
		{
			x: x + _,
			y: w + b
		},
		{
			x: x + _,
			y: w - $
		}
	], j = `M${x - $},${w - $} L${x + _},${w - $} L${x + _},${w + b} L${x - $},${w + b} L${x - $},${w - $}
                M${x - $},${w} L${x + _},${w}
                M${x},${w - $} L${x},${w + b}`;
	t.look !== "handDrawn" && (k.roughness = 0, k.fillStyle = "solid");
	let M = O.path(j, k), N = f.insert(() => M, ":first-child");
	return N.attr("transform", `translate(${$ / 2}, ${$ / 2})`), N.attr("class", "basic label-container outer-path"), D && t.look !== "handDrawn" && N.selectAll("path").attr("style", D), s && t.look !== "handDrawn" && N.selectAll("path").attr("style", s), m.attr("transform", `translate(${-(p.width / 2) + $ / 2 - (p.x - ((i = p.left) == null ? 0 : i))}, ${-(p.height / 2) + $ / 2 - (p.y - ((a = p.top) == null ? 0 : a))})`), T(t, N), t.intersect = function(e) {
		return q.polygon(t, A, e);
	}, f;
}
t(Mt, "windowPane");
var Nt = /* @__PURE__ */ new Set(["redux-color", "redux-dark-color"]), Pt = /* @__PURE__ */ new Set([
	"redux",
	"redux-dark",
	"redux-color",
	"redux-dark-color"
]);
async function Ft(e, t) {
	var r, i, a, o, l, u;
	let d = t;
	d.alias && (t.label = d.alias);
	let { theme: p, themeVariables: m } = s(), { rowEven: h, rowOdd: g, nodeBorder: _, borderColorArray: b } = m;
	if (t.look === "handDrawn") {
		let { themeVariables: n } = s(), { background: r } = n;
		await Ft(e, {
			...t,
			id: t.id + "-background",
			domId: (t.domId || t.id) + "-background",
			look: "default",
			cssStyles: ["stroke: none", `fill: ${r}`]
		});
	}
	let x = s();
	t.useHtmlLabels = x.htmlLabels;
	let C = (r = (i = x.er) == null ? void 0 : i.diagramPadding) == null ? 10 : r, w = (a = (o = x.er) == null ? void 0 : o.entityPadding) == null ? 6 : a, { cssStyles: D } = t, { labelStyles: O, nodeStyles: k } = y(t);
	if (d.attributes.length === 0 && t.label) {
		let n = {
			rx: 0,
			ry: 0,
			labelPaddingX: C,
			labelPaddingY: C * 1.5,
			classes: ""
		};
		f(t.label, x) + n.labelPaddingX * 2 < x.er.minEntityWidth && (t.width = x.er.minEntityWidth);
		let r = await xe(e, t, n);
		if (p != null && Nt.has(p)) {
			var A;
			let e = (A = d.colorIndex) == null ? 0 : A;
			r.attr("data-color-id", `color-${e % b.length}`);
		}
		if (!c(x.htmlLabels)) {
			var j;
			let e = r.select("text"), t = (j = e.node()) == null ? void 0 : j.getBBox();
			e.attr("transform", `translate(${-t.width / 2}, 0)`);
		}
		return r;
	}
	x.htmlLabels || (C *= 1.25, w *= 1.25);
	let M = E(t);
	M || (M = "node default");
	let N = e.insert("g").attr("class", M).attr("id", t.domId || t.id), P = await It(N, (l = t.label) == null ? "" : l, x, 0, 0, ["name"], O);
	P.height += w;
	let F = 0, I = [], L = [], R = 0, z = 0, B = 0, V = 0, H = !0, U = !0;
	for (let e of d.attributes) {
		let t = await It(N, e.type, x, 0, F, ["attribute-type"], O);
		R = Math.max(R, t.width + C);
		let n = await It(N, e.name, x, 0, F, ["attribute-name"], O);
		z = Math.max(z, n.width + C);
		let r = await It(N, e.keys.join(), x, 0, F, ["attribute-keys"], O);
		B = Math.max(B, r.width + C);
		let i = await It(N, e.comment, x, 0, F, ["attribute-comment"], O);
		V = Math.max(V, i.width + C);
		let a = Math.max(t.height, n.height, r.height, i.height) + w;
		L.push({
			yOffset: F,
			rowHeight: a
		}), F += a;
	}
	let W = 4;
	B <= C && (H = !1, B = 0, W--), V <= C && (U = !1, V = 0, W--);
	let ee = N.node().getBBox();
	if (P.width + C * 2 - (R + z + B + V) > 0) {
		let e = P.width + C * 2 - (R + z + B + V);
		R += e / W, z += e / W, B > 0 && (B += e / W), V > 0 && (V += e / W);
	}
	let te = R + z + B + V, G = S.svg(N), K = v(t, {});
	t.look !== "handDrawn" && (K.roughness = 0, K.fillStyle = "solid");
	let ne = 0;
	L.length > 0 && (ne = L.reduce((e, t) => {
		var n;
		return e + ((n = t == null ? void 0 : t.rowHeight) == null ? 0 : n);
	}, 0));
	let re = Math.max(ee.width + C * 2, (t == null ? void 0 : t.width) || 0, te), ie = Math.max(((u = ne) == null ? 0 : u) + P.height, (t == null ? void 0 : t.height) || 0), J = -re / 2, Y = -ie / 2;
	if (N.selectAll("g:not(:first-child)").each((e, t, r) => {
		let i = n(r[t]), a = i.attr("transform"), o = 0, s = 0;
		if (a) {
			let e = RegExp(/translate\(([^,]+),([^)]+)\)/).exec(a);
			e && (o = parseFloat(e[1]), s = parseFloat(e[2]), i.attr("class").includes("attribute-name") ? o += R : i.attr("class").includes("attribute-keys") ? o += R + z : i.attr("class").includes("attribute-comment") && (o += R + z + B));
		}
		i.attr("transform", `translate(${J + C / 2 + o}, ${s + Y + P.height + w / 2})`);
	}), N.select(".name").attr("transform", "translate(" + -P.width / 2 + ", " + (Y + w / 2) + ")"), p != null && Nt.has(p)) {
		var ae;
		let e = (ae = d.colorIndex) == null ? 0 : ae;
		N.attr("data-color-id", `color-${e % b.length}`);
	}
	let oe = G.rectangle(J, Y, re, ie, K), se = N.insert(() => oe, ":first-child").attr("class", "outer-path").attr("style", D.join(""));
	I.push(0);
	for (let [e, t] of L.entries()) {
		let n = (e + 1) % 2 == 0 && t.yOffset !== 0, r = G.rectangle(J, P.height + Y + (t == null ? void 0 : t.yOffset), re, t == null ? void 0 : t.rowHeight, {
			...K,
			fill: n ? h : g,
			stroke: _
		});
		N.insert(() => r, "g.label").attr("style", D.join("")).attr("class", `row-rect-${n ? "even" : "odd"}`);
	}
	let ce = 1e-4, X = Lt(J, P.height + Y, re + J, P.height + Y, ce), Z = G.polygon(X.map((e) => [e.x, e.y]), K);
	if (N.insert(() => Z).attr("class", "divider"), X = Lt(R + J, P.height + Y, R + J, ie + Y, ce), Z = G.polygon(X.map((e) => [e.x, e.y]), K), N.insert(() => Z).attr("class", "divider"), H) {
		let e = R + z + J;
		X = Lt(e, P.height + Y, e, ie + Y, ce), Z = G.polygon(X.map((e) => [e.x, e.y]), K), N.insert(() => Z).attr("class", "divider");
	}
	if (U) {
		let e = R + z + B + J;
		X = Lt(e, P.height + Y, e, ie + Y, ce), Z = G.polygon(X.map((e) => [e.x, e.y]), K), N.insert(() => Z).attr("class", "divider");
	}
	for (let e of I) {
		let t = P.height + Y + e;
		X = Lt(J, t, re + J, t, ce), Z = G.polygon(X.map((e) => [e.x, e.y]), K), N.insert(() => Z).attr("class", "divider");
	}
	if (T(t, se), k && t.look !== "handDrawn") if (p != null && Pt.has(p)) N.selectAll("path").attr("style", k);
	else {
		var le;
		let e = k.split(";"), t = e == null || (le = e.filter((e) => e.includes("stroke"))) == null ? void 0 : le.map((e) => `${e}`).join("; ");
		N.selectAll("path").attr("style", t == null ? "" : t), N.selectAll(".row-rect-even path").attr("style", k);
	}
	return t.intersect = function(e) {
		return q.rect(t, e);
	}, N;
}
t(Ft, "erBox");
async function It(e, t, r, i = 0, o = 0, s = [], l = "") {
	let u = e.insert("g").attr("class", `label ${s.join(" ")}`).attr("transform", `translate(${i}, ${o})`).attr("style", l);
	t !== a(t) && (t = a(t), t = t.replaceAll("<", "&lt;").replaceAll(">", "&gt;"));
	let d = u.node().appendChild(await m(u, t, {
		width: f(t, r) + 100,
		style: l,
		useHtmlLabels: r.htmlLabels
	}, r));
	if (t.includes("&lt;") || t.includes("&gt;")) {
		let e = d.children[0];
		for (e.textContent = e.textContent.replaceAll("&lt;", "<").replaceAll("&gt;", ">"); e.childNodes[0];) e = e.childNodes[0], e.textContent = e.textContent.replaceAll("&lt;", "<").replaceAll("&gt;", ">");
	}
	let p = d.getBBox();
	if (c(r.htmlLabels)) {
		let e = d.children[0];
		e.style.textAlign = "start";
		let t = n(d);
		p = e.getBoundingClientRect(), t.attr("width", p.width), t.attr("height", p.height);
	}
	return p;
}
t(It, "addText");
function Lt(e, t, n, r, i) {
	return e === n ? [
		{
			x: e - i / 2,
			y: t
		},
		{
			x: e + i / 2,
			y: t
		},
		{
			x: n + i / 2,
			y: r
		},
		{
			x: n - i / 2,
			y: r
		}
	] : [
		{
			x: e,
			y: t - i / 2
		},
		{
			x: e,
			y: t + i / 2
		},
		{
			x: n,
			y: r + i / 2
		},
		{
			x: n,
			y: r - i / 2
		}
	];
}
t(Lt, "lineToPolygon");
async function Rt(e, t, n, r, i = ((e) => (e = n.class.padding) == null ? 12 : e)()) {
	let a = r ? 0 : 3, o = e.insert("g").attr("class", E(t)).attr("id", t.domId || t.id), s = null, c = null, l = null, u = null, d = 0, f = 0, p = 0;
	if (s = o.insert("g").attr("class", "annotation-group text"), t.annotations.length > 0) {
		let e = t.annotations[0];
		await zt(s, { text: `\xAB${e}\xBB` }, 0), d = s.node().getBBox().height;
	}
	c = o.insert("g").attr("class", "label-group text"), await zt(c, t, 0, ["font-weight: bolder"]);
	let m = c.node().getBBox();
	f = m.height, l = o.insert("g").attr("class", "members-group text");
	let h = 0;
	for (let e of t.members) {
		let t = await zt(l, e, h, [e.parseClassifier()]);
		h += t + a;
	}
	p = l.node().getBBox().height, p <= 0 && (p = i / 2), u = o.insert("g").attr("class", "methods-group text");
	let g = 0;
	for (let e of t.methods) {
		let t = await zt(u, e, g, [e.parseClassifier()]);
		g += t + a;
	}
	let _ = o.node().getBBox();
	if (s !== null) {
		let e = s.node().getBBox();
		s.attr("transform", `translate(${-e.width / 2})`);
	}
	return c.attr("transform", `translate(${-m.width / 2}, ${d})`), _ = o.node().getBBox(), l.attr("transform", `translate(0, ${d + f + i * 2})`), _ = o.node().getBBox(), u.attr("transform", `translate(0, ${d + f + (p ? p + i * 4 : i * 2)})`), _ = o.node().getBBox(), {
		shapeSvg: o,
		bbox: _
	};
}
t(Rt, "textHelper");
async function zt(e, a, o, l = []) {
	var u;
	let p = e.insert("g").attr("class", "label").attr("style", l.join("; ")), h = s(), g = "useHtmlLabels" in a ? a.useHtmlLabels : (u = c(h.htmlLabels)) == null ? !0 : u, _ = "";
	_ = "text" in a ? a.text : a.label, !g && _.startsWith("\\") && (_ = _.substring(1)), r(_) && (g = !0);
	let v = await m(p, i(d(_)), {
		width: f(_, h) + 50,
		classes: "markdown-node-label",
		useHtmlLabels: g
	}, h), y, b = 1;
	if (g) {
		let e = v.children[0], r = n(v);
		b = e.innerHTML.split("<br>").length, e.innerHTML.includes("</math>") && (b += e.innerHTML.split("<mrow>").length - 1);
		let i = e.getElementsByTagName("img");
		if (i) {
			let e = _.replace(/<img[^>]*>/g, "").trim() === "";
			await Promise.all([...i].map((n) => new Promise((r) => {
				function i() {
					if (n.style.display = "flex", n.style.flexDirection = "column", e) {
						var t, i;
						let e = (t = (i = h.fontSize) == null ? void 0 : i.toString()) == null ? window.getComputedStyle(document.body).fontSize : t, r = parseInt(e, 10) * 5 + "px";
						n.style.minWidth = r, n.style.maxWidth = r;
					} else n.style.width = "100%";
					r(n);
				}
				t(i, "setupImage"), setTimeout(() => {
					n.complete && i();
				}), n.addEventListener("error", i), n.addEventListener("load", i);
			})));
		}
		y = e.getBoundingClientRect(), r.attr("width", y.width), r.attr("height", y.height);
	} else {
		l.includes("font-weight: bolder") && n(v).selectAll("tspan").attr("font-weight", ""), b = v.children.length;
		let e = v.children[0];
		(v.textContent === "" || v.textContent.includes("&gt")) && (e.textContent = _[0] + _.substring(1).replaceAll("&gt;", ">").replaceAll("&lt;", "<").trim(), _[1] === " " && (e.textContent = e.textContent[0] + " " + e.textContent.substring(1))), e.textContent === "undefined" && (e.textContent = ""), y = v.getBBox();
	}
	return p.attr("transform", "translate(0," + (-y.height / (2 * b) + o) + ")"), y.height;
}
t(zt, "addText");
async function Bt(e, t) {
	var r, i, a, o, s, u, d, f, p, m, h;
	let g = l(), { themeVariables: _ } = g, { useGradient: b } = _, x = (r = g.class.padding) == null ? 12 : r, C = x, w = (i = (a = t.useHtmlLabels) == null ? c(g.htmlLabels) : a) == null ? !0 : i, E = t;
	E.annotations = (o = E.annotations) == null ? [] : o, E.members = (s = E.members) == null ? [] : s, E.methods = (u = E.methods) == null ? [] : u;
	let { shapeSvg: D, bbox: O } = await Rt(e, t, g, w, C), { labelStyles: k, nodeStyles: A } = y(t);
	t.labelStyle = k, t.cssStyles = E.styles || "";
	let j = ((d = E.styles) == null ? void 0 : d.join(";")) || A || "";
	t.cssStyles || (t.cssStyles = j.replaceAll("!important", "").split(";"));
	let M = E.members.length === 0 && E.methods.length === 0 && !((f = g.class) != null && f.hideEmptyMembersBox), N = S.svg(D), P = v(t, {});
	t.look !== "handDrawn" && (P.roughness = 0, P.fillStyle = "solid");
	let F = Math.max((p = t.width) == null ? 0 : p, O.width), I = Math.max((m = t.height) == null ? 0 : m, O.height), L = ((h = t.height) == null ? 0 : h) > O.height;
	E.members.length === 0 && E.methods.length === 0 ? I += C : E.members.length > 0 && E.methods.length === 0 && (I += C * 2);
	let R = -F / 2, z = -I / 2, B = M ? x * 2 : E.members.length === 0 && E.methods.length === 0 ? -x : 0;
	L && (B = x * 2);
	let V = N.rectangle(R - x, z - x - (M ? x : E.members.length === 0 && E.methods.length === 0 ? -x / 2 : 0), F + 2 * x, I + 2 * x + B, P), H = D.insert(() => V, ":first-child");
	H.attr("class", "basic label-container outer-path");
	let U = H.node().getBBox(), W = D.select(".annotation-group").node().getBBox().height - (M ? x / 2 : 0) || 0, ee = D.select(".label-group").node().getBBox().height - (M ? x / 2 : 0) || 0, te = D.select(".members-group").node().getBBox().height - (M ? x / 2 : 0) || 0, G = (W + ee + z + x - (z - x - (M ? x : E.members.length === 0 && E.methods.length === 0 ? -x / 2 : 0))) / 2;
	if (D.selectAll(".text").each((e, t, r) => {
		var i;
		let a = n(r[t]), o = a.attr("transform"), s = 0;
		if (o) {
			let e = RegExp(/translate\(([^,]+),([^)]+)\)/).exec(o);
			e && (s = parseFloat(e[2]));
		}
		let c = s + z + x - (M ? x : E.members.length === 0 && E.methods.length === 0 ? -x / 2 : 0);
		if (a.attr("class").includes("methods-group")) {
			let e = Math.max(te, C / 2);
			c = L ? Math.max(G, W + ee + e + z + C * 2 + x) + C * 2 : W + ee + e + z + C * 4 + x;
		}
		E.members.length === 0 && E.methods.length === 0 && (i = g.class) != null && i.hideEmptyMembersBox && (c = E.annotations.length > 0 ? s - C : s), w || (c -= 4);
		let l = R;
		if (a.attr("class").includes("label-group") || a.attr("class").includes("annotation-group")) {
			var u;
			l = -((u = a.node()) == null ? void 0 : u.getBBox().width) / 2 || 0, D.selectAll("text").each(function(e, t, n) {
				window.getComputedStyle(n[t]).textAnchor === "middle" && (l = 0);
			});
		}
		a.attr("transform", `translate(${l}, ${c})`);
	}), E.members.length > 0 || E.methods.length > 0 || M) {
		let e = W + ee + z + x, n = N.line(U.x, e, U.x + U.width, e + .001, P);
		D.insert(() => n).attr("class", `divider${t.look === "neo" && !b ? " neo-line" : ""}`).attr("style", j);
	}
	if (M || E.members.length > 0 || E.methods.length > 0) {
		let e = W + ee + te + z + C * 2 + x, n = N.line(U.x, L ? Math.max(G, e) : e, U.x + U.width, (L ? Math.max(G, e) : e) + .001, P);
		D.insert(() => n).attr("class", `divider${t.look === "neo" && !b ? " neo-line" : ""}`).attr("style", j);
	}
	if (E.look !== "handDrawn" && D.selectAll("path").attr("style", j), H.select(":nth-child(2)").attr("style", j), D.selectAll(".divider").select("path").attr("style", j), t.labelStyle ? D.selectAll("span").attr("style", t.labelStyle) : D.selectAll("span").attr("style", j), !w) {
		let e = RegExp(/color\s*:\s*([^;]*)/), t = e.exec(j);
		if (t) {
			let e = t[0].replace("color", "fill");
			D.selectAll("tspan").attr("style", e);
		} else if (k) {
			let t = e.exec(k);
			if (t) {
				let e = t[0].replace("color", "fill");
				D.selectAll("tspan").attr("style", e);
			}
		}
	}
	return T(t, H), t.intersect = function(e) {
		return q.rect(t, e);
	}, D;
}
t(Bt, "classBox");
async function Vt(e, t) {
	var r, i, a, o, s;
	let { labelStyles: c, nodeStyles: u } = y(t);
	t.labelStyle = c;
	let d = t, f = t, p = "verifyMethod" in t, m = E(t), { themeVariables: h } = l(), { borderColorArray: g, requirementEdgeLabelBackground: _ } = h, b = e.insert("g").attr("class", m).attr("id", (r = t.domId) == null ? t.id : r), x;
	x = p ? await Ht(b, `&lt;&lt;${d.type}&gt;&gt;`, 0, t.labelStyle) : await Ht(b, "&lt;&lt;Element&gt;&gt;", 0, t.labelStyle);
	let C = x, w = await Ht(b, d.name, C, t.labelStyle + "; font-weight: bold;");
	if (C += w + 20, p) {
		let e = await Ht(b, `${d.requirementId ? `ID: ${d.requirementId}` : ""}`, C, t.labelStyle);
		C += e;
		let n = await Ht(b, `${d.text ? `Text: ${d.text}` : ""}`, C, t.labelStyle);
		C += n;
		let r = await Ht(b, `${d.risk ? `Risk: ${d.risk}` : ""}`, C, t.labelStyle);
		C += r, await Ht(b, `${d.verifyMethod ? `Verification: ${d.verifyMethod}` : ""}`, C, t.labelStyle);
	} else {
		let e = await Ht(b, `${f.type ? `Type: ${f.type}` : ""}`, C, t.labelStyle);
		C += e, await Ht(b, `${f.docRef ? `Doc Ref: ${f.docRef}` : ""}`, C, t.labelStyle);
	}
	let D = ((i = (a = b.node()) == null ? void 0 : a.getBBox().width) == null ? 200 : i) + 20, O = ((o = (s = b.node()) == null ? void 0 : s.getBBox().height) == null ? 200 : o) + 20, k = -D / 2, A = -O / 2, j = S.svg(b), M = v(t, {});
	t.look !== "handDrawn" && (M.roughness = 0, M.fillStyle = "solid");
	let N = j.rectangle(k, A, D, O, M), P = b.insert(() => N, ":first-child");
	if (P.attr("class", "basic label-container outer-path").attr("style", u), g != null && g.length) {
		var F;
		let e = (F = t.colorIndex) == null ? 0 : F;
		b.attr("data-color-id", `color-${e % g.length}`);
	}
	if (b.selectAll(".label").each((e, t, r) => {
		let i = n(r[t]), a = i.attr("transform"), o = 0, s = 0;
		if (a) {
			let e = RegExp(/translate\(([^,]+),([^)]+)\)/).exec(a);
			e && (o = parseFloat(e[1]), s = parseFloat(e[2]));
		}
		let c = s - O / 2, l = k + 20 / 2;
		(t === 0 || t === 1) && (l = o), i.attr("transform", `translate(${l}, ${c + 20})`);
	}), C > x + w + 20) {
		let e = A + x + w + 20, n;
		if (t.look === "neo") {
			let t = .001, r = [
				[k, e],
				[k + D, e],
				[k + D, e + t],
				[k, e + t]
			];
			n = j.polygon(r, M);
		} else n = j.line(k, e, k + D, e, M);
		b.insert(() => n).attr("class", "divider");
	}
	return T(t, P), t.intersect = function(e) {
		return q.rect(t, e);
	}, u && t.look !== "handDrawn" && (_ || g != null && g.length) && b.selectAll("path").attr("style", u), b;
}
t(Vt, "requirementBox");
async function Ht(e, t, r, a = "") {
	var o;
	if (t === "") return 0;
	let s = e.insert("g").attr("class", "label").attr("style", a), c = l(), u = (o = c.htmlLabels) == null ? !0 : o, p = await m(s, i(d(t)), {
		width: f(t, c) + 50,
		classes: "markdown-node-label",
		useHtmlLabels: u,
		style: a
	}, c), h;
	if (u) {
		let e = p.children[0], t = n(p);
		h = e.getBoundingClientRect(), t.attr("width", h.width), t.attr("height", h.height);
	} else {
		let e = p.children[0];
		for (let t of e.children) a && t.setAttribute("style", a);
		h = p.getBBox(), h.height += 6;
	}
	return s.attr("transform", `translate(${-h.width / 2},${-h.height / 2 + r})`), h.height;
}
t(Ht, "addText");
var Ut = /* @__PURE__ */ t((e) => {
	switch (e) {
		case "Very High": return "red";
		case "High": return "orange";
		case "Medium": return null;
		case "Low": return "blue";
		case "Very Low": return "lightblue";
	}
}, "colorFromPriority");
async function Wt(e, t, { config: n }) {
	var r, i;
	let { labelStyles: a, nodeStyles: o } = y(t);
	t.labelStyle = a || "";
	let s = t.width;
	t.width = ((r = t.width) == null ? 200 : r) - 10;
	let { shapeSvg: c, bbox: l, label: u } = await C(e, t, E(t)), d = t.padding || 10, f = "", p;
	if ("ticket" in t && t.ticket && !(n == null || (i = n.kanban) == null) && i.ticketBaseUrl) {
		var m;
		f = n == null || (m = n.kanban) == null ? void 0 : m.ticketBaseUrl.replace("#TICKET#", t.ticket), p = c.insert("svg:a", ":first-child").attr("class", "kanban-ticket-link").attr("xlink:href", f).attr("target", "_blank");
	}
	let h = {
		useHtmlLabels: t.useHtmlLabels,
		labelStyle: t.labelStyle || "",
		width: t.width,
		img: t.img,
		padding: t.padding || 8,
		centerLabel: !1
	}, g, _;
	p ? {label: g, bbox: _} = await w(p, "ticket" in t && t.ticket || "", h) : {label: g, bbox: _} = await w(c, "ticket" in t && t.ticket || "", h);
	let { label: b, bbox: x } = await w(c, "assigned" in t && t.assigned || "", h);
	t.width = s;
	let D = (t == null ? void 0 : t.width) || 0, O = Math.max(_.height, x.height) / 2, k = Math.max(l.height + 20, (t == null ? void 0 : t.height) || 0) + O, A = -D / 2, j = -k / 2;
	u.attr("transform", "translate(" + (d - D / 2) + ", " + (-O - l.height / 2) + ")"), g.attr("transform", "translate(" + (d - D / 2) + ", " + (-O + l.height / 2) + ")"), b.attr("transform", "translate(" + (d + D / 2 - x.width - 20) + ", " + (-O + l.height / 2) + ")");
	let M, { rx: P, ry: F } = t, { cssStyles: I } = t;
	if (t.look === "handDrawn") {
		let e = S.svg(c), n = v(t, {}), r = P || F ? e.path(N(A, j, D, k, P || 0), n) : e.rectangle(A, j, D, k, n);
		M = c.insert(() => r, ":first-child"), M.attr("class", "basic label-container").attr("style", I || null);
	} else {
		M = c.insert("rect", ":first-child"), M.attr("class", "basic label-container __APA__").attr("style", o).attr("rx", P == null ? 5 : P).attr("ry", F == null ? 5 : F).attr("x", A).attr("y", j).attr("width", D).attr("height", k);
		let e = "priority" in t && t.priority;
		if (e) {
			let t = c.append("line"), n = A + 2, r = j + Math.floor((P == null ? 0 : P) / 2), i = j + k - Math.floor((P == null ? 0 : P) / 2);
			t.attr("x1", n).attr("y1", r).attr("x2", n).attr("y2", i).attr("stroke-width", "4").attr("stroke", Ut(e));
		}
	}
	return T(t, M), t.height = k, t.intersect = function(e) {
		return q.rect(t, e);
	}, c;
}
t(Wt, "kanbanItem");
async function Gt(t, n) {
	let { labelStyles: r, nodeStyles: i } = y(n);
	n.labelStyle = r;
	let { shapeSvg: a, bbox: o, halfPadding: s, label: c } = await C(t, n, E(n)), l = o.width + 10 * s, u = o.height + 8 * s, d = .15 * l, { cssStyles: f } = n, m = o.width + 20, h = o.height + 20, g = Math.max(l, m), _ = Math.max(u, h);
	c.attr("transform", `translate(${-o.width / 2}, ${-o.height / 2})`);
	let b, x = `M0 0 
    a${d},${d} 1 0,0 ${g * .25},${-1 * _ * .1}
    a${d},${d} 1 0,0 ${g * .25},0
    a${d},${d} 1 0,0 ${g * .25},0
    a${d},${d} 1 0,0 ${g * .25},${_ * .1}

    a${d},${d} 1 0,0 ${g * .15},${_ * .33}
    a${d * .8},${d * .8} 1 0,0 0,${_ * .34}
    a${d},${d} 1 0,0 ${-1 * g * .15},${_ * .33}

    a${d},${d} 1 0,0 ${-1 * g * .25},${_ * .15}
    a${d},${d} 1 0,0 ${-1 * g * .25},0
    a${d},${d} 1 0,0 ${-1 * g * .25},0
    a${d},${d} 1 0,0 ${-1 * g * .25},${-1 * _ * .15}

    a${d},${d} 1 0,0 ${-1 * g * .1},${-1 * _ * .33}
    a${d * .8},${d * .8} 1 0,0 0,${-1 * _ * .34}
    a${d},${d} 1 0,0 ${g * .1},${-1 * _ * .33}
  H0 V0 Z`;
	if (n.look === "handDrawn") {
		let e = S.svg(a), t = v(n, {}), r = e.path(x, t);
		b = a.insert(() => r, ":first-child"), b.attr("class", "basic label-container").attr("style", p(f));
	} else b = a.insert("path", ":first-child").attr("class", "basic label-container").attr("style", i).attr("d", x);
	return b.attr("transform", `translate(${-g / 2}, ${-_ / 2})`), T(n, b), n.calcIntersect = function(e, t) {
		return q.rect(e, t);
	}, n.intersect = function(t) {
		return e.info("Bang intersect", n, t), q.rect(n, t);
	}, a;
}
t(Gt, "bang");
async function Kt(t, n) {
	let { labelStyles: r, nodeStyles: i } = y(n);
	n.labelStyle = r;
	let { shapeSvg: a, bbox: o, halfPadding: s, label: c } = await C(t, n, E(n)), l = o.width + 2 * s, u = o.height + 2 * s, d = .15 * l, f = .25 * l, m = .35 * l, h = .2 * l, { cssStyles: g } = n, _, b = `M0 0 
    a${d},${d} 0 0,1 ${l * .25},${-1 * l * .1}
    a${m},${m} 1 0,1 ${l * .4},${-1 * l * .1}
    a${f},${f} 1 0,1 ${l * .35},${l * .2}

    a${d},${d} 1 0,1 ${l * .15},${u * .35}
    a${h},${h} 1 0,1 ${-1 * l * .15},${u * .65}

    a${f},${d} 1 0,1 ${-1 * l * .25},${l * .15}
    a${m},${m} 1 0,1 ${-1 * l * .5},0
    a${d},${d} 1 0,1 ${-1 * l * .25},${-1 * l * .15}

    a${d},${d} 1 0,1 ${-1 * l * .1},${-1 * u * .35}
    a${h},${h} 1 0,1 ${l * .1},${-1 * u * .65}
  H0 V0 Z`;
	if (n.look === "handDrawn") {
		let e = S.svg(a), t = v(n, {}), r = e.path(b, t);
		_ = a.insert(() => r, ":first-child"), _.attr("class", "basic label-container").attr("style", p(g));
	} else _ = a.insert("path", ":first-child").attr("class", "basic label-container").attr("style", i).attr("d", b);
	return c.attr("transform", `translate(${-o.width / 2}, ${-o.height / 2})`), _.attr("transform", `translate(${-l / 2}, ${-u / 2})`), T(n, _), n.calcIntersect = function(e, t) {
		return q.rect(e, t);
	}, n.intersect = function(t) {
		return e.info("Cloud intersect", n, t), q.rect(n, t);
	}, a;
}
t(Kt, "cloud");
async function qt(e, t) {
	let { labelStyles: n, nodeStyles: r } = y(t);
	t.labelStyle = n;
	let { shapeSvg: i, bbox: a, halfPadding: o, label: s } = await C(e, t, E(t)), c = a.width + 8 * o, l = a.height + 2 * o, u = t.look === "neo" ? `
    M${-c / 2} ${l / 2 - 5}
    v${-l + 10}
    q0,-5 5,-5
    h${c - 10}
    q5,0 5,5
    v${l - 5}
    H${-c / 2}
    Z
  ` : `
    M${-c / 2} ${l / 2 - 5}
    v${-l + 10}
    q0,-5 5,-5
    h${c - 10}
    q5,0 5,5
    v${l - 10}
    q0,5 -5,5
    h${-(c - 10)}
    q-5,0 -5,-5
    Z
  `;
	if (!t.domId) throw Error(`defaultMindmapNode: node "${t.id}" is missing a domId \u2014 was render.ts domId prefixing skipped?`);
	let d = i.append("path").attr("id", t.domId).attr("class", "node-bkg node-" + t.type).attr("style", r).attr("d", u);
	return i.append("line").attr("class", "node-line-").attr("x1", -c / 2).attr("y1", l / 2).attr("x2", c / 2).attr("y2", l / 2), s.attr("transform", `translate(${-a.width / 2}, ${-a.height / 2})`), i.append(() => s.node()), T(t, d), t.calcIntersect = function(e, t) {
		return q.rect(e, t);
	}, t.intersect = function(e) {
		return q.rect(t, e);
	}, i;
}
t(qt, "defaultMindmapNode");
async function Jt(e, t) {
	var n;
	return ce(e, t, { padding: (n = t.padding) == null ? 0 : n });
}
t(Jt, "mindmapCircle");
var Yt = [
	{
		semanticName: "Process",
		name: "Rectangle",
		shortName: "rect",
		description: "Standard process shape",
		aliases: [
			"proc",
			"process",
			"rectangle"
		],
		internalAliases: ["squareRect"],
		handler: ct
	},
	{
		semanticName: "Event",
		name: "Rounded Rectangle",
		shortName: "rounded",
		description: "Represents an event",
		aliases: ["event"],
		internalAliases: ["roundedRect"],
		handler: it
	},
	{
		semanticName: "Terminal Point",
		name: "Stadium",
		shortName: "stadium",
		description: "Terminal point",
		aliases: ["terminal", "pill"],
		handler: lt
	},
	{
		semanticName: "Subprocess",
		name: "Framed Rectangle",
		shortName: "fr-rect",
		description: "Subprocess",
		aliases: [
			"subprocess",
			"subproc",
			"framed-rectangle",
			"subroutine"
		],
		handler: mt
	},
	{
		semanticName: "Database",
		name: "Cylinder",
		shortName: "cyl",
		description: "Database storage",
		aliases: [
			"db",
			"database",
			"cylinder"
		],
		handler: be
	},
	{
		semanticName: "Data Store",
		name: "Data Store",
		shortName: "datastore",
		description: "Data flow diagram data store",
		aliases: ["data-store"],
		handler: Se
	},
	{
		semanticName: "Start",
		name: "Circle",
		shortName: "circle",
		description: "Starting point",
		aliases: ["circ"],
		handler: ce
	},
	{
		semanticName: "Bang",
		name: "Bang",
		shortName: "bang",
		description: "Bang",
		aliases: ["bang"],
		handler: Gt
	},
	{
		semanticName: "Cloud",
		name: "Cloud",
		shortName: "cloud",
		description: "cloud",
		aliases: ["cloud"],
		handler: Kt
	},
	{
		semanticName: "Decision",
		name: "Diamond",
		shortName: "diam",
		description: "Decision-making step",
		aliases: [
			"decision",
			"diamond",
			"question"
		],
		handler: tt
	},
	{
		semanticName: "Prepare Conditional",
		name: "Hexagon",
		shortName: "hex",
		description: "Preparation or condition step",
		aliases: ["hexagon", "prepare"],
		handler: Me
	},
	{
		semanticName: "Data Input/Output",
		name: "Lean Right",
		shortName: "lean-r",
		description: "Represents input or output",
		aliases: ["lean-right", "in-out"],
		internalAliases: ["lean_right"],
		handler: He
	},
	{
		semanticName: "Data Input/Output",
		name: "Lean Left",
		shortName: "lean-l",
		description: "Represents output or input",
		aliases: ["lean-left", "out-in"],
		internalAliases: ["lean_left"],
		handler: Ve
	},
	{
		semanticName: "Priority Action",
		name: "Trapezoid Base Bottom",
		shortName: "trap-b",
		description: "Priority action",
		aliases: [
			"priority",
			"trapezoid-bottom",
			"trapezoid"
		],
		handler: Tt
	},
	{
		semanticName: "Manual Operation",
		name: "Trapezoid Base Top",
		shortName: "trap-t",
		description: "Represents a manual task",
		aliases: [
			"manual",
			"trapezoid-top",
			"inv-trapezoid"
		],
		internalAliases: ["inv_trapezoid"],
		handler: ze
	},
	{
		semanticName: "Stop",
		name: "Double Circle",
		shortName: "dbl-circ",
		description: "Represents a stop point",
		aliases: ["double-circle"],
		internalAliases: ["doublecircle"],
		handler: we
	},
	{
		semanticName: "Text Block",
		name: "Text Block",
		shortName: "text",
		description: "Text block",
		handler: vt
	},
	{
		semanticName: "Card",
		name: "Notched Rectangle",
		shortName: "notch-rect",
		description: "Represents a card",
		aliases: ["card", "notched-rectangle"],
		handler: oe
	},
	{
		semanticName: "Lined/Shaded Process",
		name: "Lined Rectangle",
		shortName: "lin-rect",
		description: "Lined process shape",
		aliases: [
			"lined-rectangle",
			"lined-process",
			"lin-proc",
			"shaded-process"
		],
		handler: ot
	},
	{
		semanticName: "Start",
		name: "Small Circle",
		shortName: "sm-circ",
		description: "Small starting point",
		aliases: ["start", "small-circle"],
		internalAliases: ["stateStart"],
		handler: ft
	},
	{
		semanticName: "Stop",
		name: "Framed Circle",
		shortName: "fr-circ",
		description: "Stop point",
		aliases: ["stop", "framed-circle"],
		internalAliases: ["stateEnd"],
		handler: dt
	},
	{
		semanticName: "Fork/Join",
		name: "Filled Rectangle",
		shortName: "fork",
		description: "Fork or join in process flow",
		aliases: ["join"],
		internalAliases: ["forkJoin"],
		handler: ke
	},
	{
		semanticName: "Collate",
		name: "Hourglass",
		shortName: "hourglass",
		description: "Represents a collate operation",
		aliases: ["hourglass", "collate"],
		handler: Ne
	},
	{
		semanticName: "Comment",
		name: "Curly Brace",
		shortName: "brace",
		description: "Adds a comment",
		aliases: ["comment", "brace-l"],
		handler: ue
	},
	{
		semanticName: "Comment Right",
		name: "Curly Brace",
		shortName: "brace-r",
		description: "Adds a comment",
		handler: fe
	},
	{
		semanticName: "Comment with braces on both sides",
		name: "Curly Braces",
		shortName: "braces",
		description: "Adds a comment",
		handler: pe
	},
	{
		semanticName: "Com Link",
		name: "Lightning Bolt",
		shortName: "bolt",
		description: "Communication link",
		aliases: ["com-link", "lightning-bolt"],
		handler: Ue
	},
	{
		semanticName: "Document",
		name: "Document",
		shortName: "doc",
		description: "Represents a document",
		aliases: ["doc", "document"],
		handler: At
	},
	{
		semanticName: "Delay",
		name: "Half-Rounded Rectangle",
		shortName: "delay",
		description: "Represents a delay",
		aliases: ["half-rounded-rectangle"],
		handler: Ae
	},
	{
		semanticName: "Direct Access Storage",
		name: "Horizontal Cylinder",
		shortName: "h-cyl",
		description: "Direct access storage",
		aliases: ["das", "horizontal-cylinder"],
		handler: wt
	},
	{
		semanticName: "Disk Storage",
		name: "Lined Cylinder",
		shortName: "lin-cyl",
		description: "Disk storage",
		aliases: ["disk", "lined-cylinder"],
		handler: Ye
	},
	{
		semanticName: "Display",
		name: "Curved Trapezoid",
		shortName: "curv-trap",
		description: "Represents a display",
		aliases: ["curved-trapezoid", "display"],
		handler: me
	},
	{
		semanticName: "Divided Process",
		name: "Divided Rectangle",
		shortName: "div-rect",
		description: "Divided process shape",
		aliases: [
			"div-proc",
			"divided-rectangle",
			"divided-process"
		],
		handler: Ce
	},
	{
		semanticName: "Extract",
		name: "Triangle",
		shortName: "tri",
		description: "Extraction process",
		aliases: ["extract", "triangle"],
		handler: kt
	},
	{
		semanticName: "Internal Storage",
		name: "Window Pane",
		shortName: "win-pane",
		description: "Internal storage",
		aliases: ["internal-storage", "window-pane"],
		handler: Mt
	},
	{
		semanticName: "Junction",
		name: "Filled Circle",
		shortName: "f-circ",
		description: "Junction point",
		aliases: ["junction", "filled-circle"],
		handler: Te
	},
	{
		semanticName: "Loop Limit",
		name: "Trapezoidal Pentagon",
		shortName: "notch-pent",
		description: "Loop limit step",
		aliases: ["loop-limit", "notched-pentagon"],
		handler: Et
	},
	{
		semanticName: "Manual File",
		name: "Flipped Triangle",
		shortName: "flip-tri",
		description: "Manual file operation",
		aliases: ["manual-file", "flipped-triangle"],
		handler: Oe
	},
	{
		semanticName: "Manual Input",
		name: "Sloped Rectangle",
		shortName: "sl-rect",
		description: "Manual input step",
		aliases: ["manual-input", "sloped-rectangle"],
		handler: st
	},
	{
		semanticName: "Multi-Document",
		name: "Stacked Document",
		shortName: "docs",
		description: "Multiple documents",
		aliases: [
			"documents",
			"st-doc",
			"stacked-document"
		],
		handler: Qe
	},
	{
		semanticName: "Multi-Process",
		name: "Stacked Rectangle",
		shortName: "st-rect",
		description: "Multiple processes",
		aliases: [
			"procs",
			"processes",
			"stacked-rectangle"
		],
		handler: Ze
	},
	{
		semanticName: "Stored Data",
		name: "Bow Tie Rectangle",
		shortName: "bow-rect",
		description: "Stored data",
		aliases: ["stored-data", "bow-tie-rectangle"],
		handler: J
	},
	{
		semanticName: "Summary",
		name: "Crossed Circle",
		shortName: "cross-circ",
		description: "Summary",
		aliases: ["summary", "crossed-circle"],
		handler: Z
	},
	{
		semanticName: "Tagged Document",
		name: "Tagged Document",
		shortName: "tag-doc",
		description: "Tagged document",
		aliases: ["tag-doc", "tagged-document"],
		handler: _t
	},
	{
		semanticName: "Tagged Process",
		name: "Tagged Rectangle",
		shortName: "tag-rect",
		description: "Tagged process",
		aliases: [
			"tagged-rectangle",
			"tag-proc",
			"tagged-process"
		],
		handler: gt
	},
	{
		semanticName: "Paper Tape",
		name: "Flag",
		shortName: "flag",
		description: "Paper tape",
		aliases: ["paper-tape"],
		handler: jt
	},
	{
		semanticName: "Odd",
		name: "Odd",
		shortName: "odd",
		description: "Odd shape",
		internalAliases: ["rect_left_inv_arrow"],
		handler: nt
	},
	{
		semanticName: "Lined Document",
		name: "Lined Document",
		shortName: "lin-doc",
		description: "Lined document",
		aliases: ["lined-document"],
		handler: Xe
	}
], Xt = (/* @__PURE__ */ t(() => {
	let e = [...Object.entries({
		state: ut,
		choice: se,
		note: $e,
		rectWithTitle: rt,
		labelRect: Be,
		iconSquare: Le,
		iconCircle: Fe,
		icon: Pe,
		iconRounded: Ie,
		imageSquare: Re,
		anchor: ne,
		kanbanItem: Wt,
		mindmapCircle: Jt,
		defaultMindmapNode: qt,
		classBox: Bt,
		erBox: Ft,
		requirementBox: Vt
	}), ...Yt.flatMap((e) => [
		e.shortName,
		..."aliases" in e ? e.aliases : [],
		..."internalAliases" in e ? e.internalAliases : []
	].map((t) => [t, e.handler]))];
	return Object.fromEntries(e);
}, "generateShapeMap"))();
function Zt(e) {
	return e in Xt;
}
t(Zt, "isValidShape");
var Qt = /* @__PURE__ */ new Map();
async function $t(e, t, n) {
	let r, i;
	t.shape === "rect" && (t.rx && t.ry ? t.shape = "roundedRect" : t.shape = "squareRect");
	let a = t.shape ? Xt[t.shape] : void 0;
	if (!a) throw Error(`No such shape: ${t.shape}. Please check your syntax.`);
	if (t.link) {
		var o;
		let s;
		n.config.securityLevel === "sandbox" ? s = "_top" : t.linkTarget && (s = t.linkTarget || "_blank"), r = e.insert("svg:a").attr("xlink:href", t.link).attr("target", (o = s) == null ? null : o), i = await a(r, t, n);
	} else i = await a(e, t, n), r = i;
	return r.attr("data-look", p(t.look)), t.tooltip && i.attr("title", t.tooltip), Qt.set(t.id, r), t.haveCallback && r.attr("class", r.attr("class") + " clickable"), r;
}
t($t, "insertNode");
var en = /* @__PURE__ */ t((e, t) => {
	Qt.set(t.id, e);
}, "setNodeElem"), tn = /* @__PURE__ */ t(() => {
	Qt.clear();
}, "clear"), nn = /* @__PURE__ */ t((t) => {
	let n = Qt.get(t.id);
	e.trace("Transforming node", t.diff, t, "translate(" + (t.x - t.width / 2 - 5) + ", " + t.width / 2 + ")");
	let r = t.diff || 0;
	return t.clusterNode ? n.attr("transform", "translate(" + (t.x + r - t.width / 2) + ", " + (t.y - t.height / 2 - 8) + ")") : n.attr("transform", "translate(" + t.x + ", " + t.y + ")"), r;
}, "positionNode");
//#endregion
export { $t as a, nn as c, L as i, en as l, tn as n, Zt as o, M as r, C as s, R as t, T as u };
