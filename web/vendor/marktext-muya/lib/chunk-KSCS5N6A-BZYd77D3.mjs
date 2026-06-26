import { i as e, r as t, t as n } from "./src-q1mJODQi.mjs";
import { T as r, b as i, x as a } from "./chunk-CSCIHK7Q-Bm1gw87X.mjs";
import { _ as o, a as s, i as c, n as l, o as u, p as d, r as f, t as p, u as m, v as h, x as g } from "./step-BLAKVGAu.mjs";
import { K as _, g as v, q as y, u as b } from "./chunk-5ZQYHXKU-cRTMH84-.mjs";
import { n as x } from "./chunk-O5CBEL6O-CALp6o7A.mjs";
import { i as S, n as ee, r as C, t as w } from "./chunk-BSJP7CBP-DER-ilWr.mjs";
import { n as T } from "./chunk-L5ZTLDWV-KdfSpm4k.mjs";
import { i as E, n as te } from "./chunk-NZK2D7GU-CsuOrk0Z.mjs";
import { t as ne } from "./rough.esm-CU08Ovhz.mjs";
import { r as D } from "./chunk-3OPIFGDE-14tG0H5Y.mjs";
//#region ../../node_modules/.pnpm/mermaid@11.15.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-KSCS5N6A.mjs
var re = /* @__PURE__ */ t((e, t, n, r, i, a = !1, o) => {
	t.arrowTypeStart && A(e, "start", t.arrowTypeStart, n, r, i, a, o), t.arrowTypeEnd && A(e, "end", t.arrowTypeEnd, n, r, i, a, o);
}, "addEdgeMarkers"), O = {
	arrow_cross: {
		type: "cross",
		fill: !1
	},
	arrow_point: {
		type: "point",
		fill: !0
	},
	arrow_barb: {
		type: "barb",
		fill: !0
	},
	arrow_barb_neo: {
		type: "barb",
		fill: !0
	},
	arrow_circle: {
		type: "circle",
		fill: !1
	},
	aggregation: {
		type: "aggregation",
		fill: !1
	},
	extension: {
		type: "extension",
		fill: !1
	},
	composition: {
		type: "composition",
		fill: !0
	},
	dependency: {
		type: "dependency",
		fill: !0
	},
	lollipop: {
		type: "lollipop",
		fill: !1
	},
	only_one: {
		type: "onlyOne",
		fill: !1
	},
	zero_or_one: {
		type: "zeroOrOne",
		fill: !1
	},
	one_or_more: {
		type: "oneOrMore",
		fill: !1
	},
	zero_or_more: {
		type: "zeroOrMore",
		fill: !1
	},
	requirement_arrow: {
		type: "requirement_arrow",
		fill: !1
	},
	requirement_contains: {
		type: "requirement_contains",
		fill: !1
	}
}, k = [
	"cross",
	"point",
	"circle",
	"lollipop",
	"aggregation",
	"extension",
	"composition",
	"dependency",
	"barb"
], A = /* @__PURE__ */ t((t, n, r, i, a, o, s = !1, c) => {
	let l = O[r], u = l && k.includes(l.type);
	if (!l) {
		e.warn(`Unknown arrow type: ${r}`);
		return;
	}
	let d = `${a}_${o}-${l.type}${n === "start" ? "Start" : "End"}${s && u ? "-margin" : ""}`;
	if (c && c.trim() !== "") {
		let e = `${d}_${c.replace(/[^\dA-Za-z]/g, "_")}`;
		if (!document.getElementById(e)) {
			let t = document.getElementById(d);
			if (t) {
				var f;
				let n = t.cloneNode(!0);
				n.id = e, n.querySelectorAll("path, circle, line").forEach((e) => {
					e.setAttribute("stroke", c), l.fill && e.setAttribute("fill", c);
				}), (f = t.parentNode) == null || f.appendChild(n);
			}
		}
		t.attr(`marker-${n}`, `url(${i}#${e})`);
	} else t.attr(`marker-${n}`, `url(${i}#${d})`);
}, "addEdgeMarker"), ie = /* @__PURE__ */ t((e) => {
	var t;
	return typeof e == "string" ? e : (t = a()) == null || (t = t.flowchart) == null ? void 0 : t.curve;
}, "resolveEdgeCurveType"), j = /* @__PURE__ */ new Map(), M = /* @__PURE__ */ new Map(), N = /* @__PURE__ */ t(() => {
	j.clear(), M.clear();
}, "clear"), P = /* @__PURE__ */ t((e) => e ? typeof e == "string" ? e : e.reduce((e, t) => e + ";" + t, "") : "", "getLabelStyles"), F = /* @__PURE__ */ t(async (t, i) => {
	let o = a(), s = r(o), { labelStyles: c } = E(i);
	i.labelStyle = c;
	let l = t.insert("g").attr("class", "edgeLabel"), u = l.insert("g").attr("class", "label").attr("data-id", i.id), d = i.labelType === "markdown", f = await x(t, i.label, {
		style: P(i.labelStyle),
		useHtmlLabels: s,
		addSvgBackground: !0,
		isNode: !1,
		markdown: d,
		width: void 0
	}, o);
	u.node().appendChild(f), e.info("abc82", i, i.labelType);
	let p = f.getBBox(), m = p;
	if (s) {
		let e = f.children[0], t = n(f);
		p = e.getBoundingClientRect(), m = p, t.attr("width", p.width), t.attr("height", p.height);
	} else {
		let e = n(f).select("text").node();
		e && typeof e.getBBox == "function" && (m = e.getBBox());
	}
	u.attr("transform", w(m, s)), j.set(i.id, l), i.width = p.width, i.height = p.height;
	let h;
	if (i.startLabelLeft) {
		let e = t.insert("g").attr("class", "edgeTerminals"), r = e.insert("g").attr("class", "inner"), a = await D(r, i.startLabelLeft, P(i.labelStyle) || "", !1, !1);
		h = a;
		let o = a.getBBox();
		if (s) {
			let e = a.children[0], t = n(a);
			o = e.getBoundingClientRect(), t.attr("width", o.width), t.attr("height", o.height);
		}
		r.attr("transform", w(o, s)), M.get(i.id) || M.set(i.id, {}), M.get(i.id).startLeft = e, I(h, i.startLabelLeft);
	}
	if (i.startLabelRight) {
		let e = t.insert("g").attr("class", "edgeTerminals"), r = e.insert("g").attr("class", "inner"), a = await D(r, i.startLabelRight, P(i.labelStyle) || "", !1, !1);
		h = a;
		let o = a.getBBox();
		if (s) {
			let e = a.children[0], t = n(a);
			o = e.getBoundingClientRect(), t.attr("width", o.width), t.attr("height", o.height);
		}
		r.attr("transform", w(o, s)), M.get(i.id) || M.set(i.id, {}), M.get(i.id).startRight = e, I(h, i.startLabelRight);
	}
	if (i.endLabelLeft) {
		let e = t.insert("g").attr("class", "edgeTerminals"), r = e.insert("g").attr("class", "inner"), a = await D(e, i.endLabelLeft, P(i.labelStyle) || "", !1, !1);
		h = a;
		let o = a.getBBox();
		if (s) {
			let e = a.children[0], t = n(a);
			o = e.getBoundingClientRect(), t.attr("width", o.width), t.attr("height", o.height);
		}
		r.attr("transform", w(o, s)), M.get(i.id) || M.set(i.id, {}), M.get(i.id).endLeft = e, I(h, i.endLabelLeft);
	}
	if (i.endLabelRight) {
		let e = t.insert("g").attr("class", "edgeTerminals"), r = e.insert("g").attr("class", "inner"), a = await D(e, i.endLabelRight, P(i.labelStyle) || "", !1, !1);
		h = a;
		let o = a.getBBox();
		if (s) {
			let e = a.children[0], t = n(a);
			o = e.getBoundingClientRect(), t.attr("width", o.width), t.attr("height", o.height);
		}
		r.attr("transform", w(o, s)), M.get(i.id) || M.set(i.id, {}), M.get(i.id).endRight = e, I(h, i.endLabelRight);
	}
	return f;
}, "insertEdgeLabel");
function I(e, t) {
	r(a()) && e && (e.style.width = t.length * 9 + "px", e.style.height = "12px");
}
t(I, "setTerminalWidth");
var L = /* @__PURE__ */ t((t, n) => {
	e.debug("Moving label abc88 ", t.id, t.label, j.get(t.id), n);
	let r = n.updatedPath ? n.updatedPath : n.originalPath, { subGraphTitleTotalMargin: i } = T(a());
	if (t.label) {
		let a = j.get(t.id), o = t.x, s = t.y;
		if (r) {
			let i = v.calcLabelPosition(r);
			e.debug("Moving label " + t.label + " from (", o, ",", s, ") to (", i.x, ",", i.y, ") abc88"), n.updatedPath && (o = i.x, s = i.y);
		}
		a.attr("transform", `translate(${o}, ${s + i / 2})`);
	}
	if (t.startLabelLeft) {
		let e = M.get(t.id).startLeft, n = t.x, i = t.y;
		if (r) {
			let e = v.calcTerminalLabelPosition(t.arrowTypeStart ? 10 : 0, "start_left", r);
			n = e.x, i = e.y;
		}
		e.attr("transform", `translate(${n}, ${i})`);
	}
	if (t.startLabelRight) {
		let e = M.get(t.id).startRight, n = t.x, i = t.y;
		if (r) {
			let e = v.calcTerminalLabelPosition(t.arrowTypeStart ? 10 : 0, "start_right", r);
			n = e.x, i = e.y;
		}
		e.attr("transform", `translate(${n}, ${i})`);
	}
	if (t.endLabelLeft) {
		let e = M.get(t.id).endLeft, n = t.x, i = t.y;
		if (r) {
			let e = v.calcTerminalLabelPosition(t.arrowTypeEnd ? 10 : 0, "end_left", r);
			n = e.x, i = e.y;
		}
		e.attr("transform", `translate(${n}, ${i})`);
	}
	if (t.endLabelRight) {
		let e = M.get(t.id).endRight, n = t.x, i = t.y;
		if (r) {
			let e = v.calcTerminalLabelPosition(t.arrowTypeEnd ? 10 : 0, "end_right", r);
			n = e.x, i = e.y;
		}
		e.attr("transform", `translate(${n}, ${i})`);
	}
}, "positionEdgeLabel"), R = /* @__PURE__ */ t((e, t) => {
	let n = e.x, r = e.y, i = Math.abs(t.x - n), a = Math.abs(t.y - r), o = e.width / 2, s = e.height / 2;
	return i >= o || a >= s;
}, "outsideNode"), z = /* @__PURE__ */ t((t, n, r) => {
	e.debug(`intersection calc abc89:
  outsidePoint: ${JSON.stringify(n)}
  insidePoint : ${JSON.stringify(r)}
  node        : x:${t.x} y:${t.y} w:${t.width} h:${t.height}`);
	let i = t.x, a = t.y, o = Math.abs(i - r.x), s = t.width / 2, c = r.x < n.x ? s - o : s + o, l = t.height / 2, u = Math.abs(n.y - r.y), d = Math.abs(n.x - r.x);
	if (Math.abs(a - n.y) * s > Math.abs(i - n.x) * l) {
		let t = r.y < n.y ? n.y - l - a : a - l - n.y;
		c = d * t / u;
		let i = {
			x: r.x < n.x ? r.x + c : r.x - d + c,
			y: r.y < n.y ? r.y + u - t : r.y - u + t
		};
		return c === 0 && (i.x = n.x, i.y = n.y), d === 0 && (i.x = n.x), u === 0 && (i.y = n.y), e.debug(`abc89 top/bottom calc, Q ${u}, q ${t}, R ${d}, r ${c}`, i), i;
	} else {
		c = r.x < n.x ? n.x - s - i : i - s - n.x;
		let t = u * c / d, a = r.x < n.x ? r.x + d - c : r.x - d + c, o = r.y < n.y ? r.y + t : r.y - t;
		return e.debug(`sides calc abc89, Q ${u}, q ${t}, R ${d}, r ${c}`, {
			_x: a,
			_y: o
		}), c === 0 && (a = n.x, o = n.y), d === 0 && (a = n.x), u === 0 && (o = n.y), {
			x: a,
			y: o
		};
	}
}, "intersection"), B = /* @__PURE__ */ t((t, n) => {
	e.warn("abc88 cutPathAtIntersect", t, n);
	let r = [], i = t[0], a = !1;
	return t.forEach((t) => {
		if (e.info("abc88 checking point", t, n), !R(n, t) && !a) {
			let o = z(n, i, t);
			e.debug("abc88 inside", t, i, o), e.debug("abc88 intersection", o, n);
			let s = !1;
			r.forEach((e) => {
				s = s || e.x === o.x && e.y === o.y;
			}), r.some((e) => e.x === o.x && e.y === o.y) ? e.warn("abc88 no intersect", o, r) : r.push(o), a = !0;
		} else e.warn("abc88 outside", t, i), i = t, a || r.push(t);
	}), e.debug("returning points", r), r;
}, "cutPathAtIntersect");
function V(e) {
	let t = [], n = [];
	for (let r = 1; r < e.length - 1; r++) {
		let i = e[r - 1], a = e[r], o = e[r + 1];
		(i.x === a.x && a.y === o.y && Math.abs(a.x - o.x) > 5 && Math.abs(a.y - i.y) > 5 || i.y === a.y && a.x === o.x && Math.abs(a.x - i.x) > 5 && Math.abs(a.y - o.y) > 5) && (t.push(a), n.push(r));
	}
	return {
		cornerPoints: t,
		cornerPointPositions: n
	};
}
t(V, "extractCornerPoints");
var H = /* @__PURE__ */ t(function(e, t, n) {
	let r = t.x - e.x, i = t.y - e.y, a = n / Math.sqrt(r * r + i * i);
	return {
		x: t.x - a * r,
		y: t.y - a * i
	};
}, "findAdjacentPoint"), ae = /* @__PURE__ */ t(function(t) {
	let { cornerPointPositions: n } = V(t), r = [];
	for (let i = 0; i < t.length; i++) if (n.includes(i)) {
		let n = t[i - 1], a = t[i + 1], o = t[i], s = H(n, o, 5), c = H(a, o, 5), l = c.x - s.x, u = c.y - s.y;
		r.push(s);
		let d = Math.sqrt(2) * 2, f = {
			x: o.x,
			y: o.y
		};
		Math.abs(a.x - n.x) > 10 && Math.abs(a.y - n.y) >= 10 ? (e.debug("Corner point fixing", Math.abs(a.x - n.x), Math.abs(a.y - n.y)), f = o.x === s.x ? {
			x: l < 0 ? s.x - 5 + d : s.x + 5 - d,
			y: u < 0 ? s.y - d : s.y + d
		} : {
			x: l < 0 ? s.x - d : s.x + d,
			y: u < 0 ? s.y - 5 + d : s.y + 5 - d
		}) : e.debug("Corner point skipping fixing", Math.abs(a.x - n.x), Math.abs(a.y - n.y)), r.push(f, c);
	} else r.push(t[i]);
	return r;
}, "fixCorners"), U = /* @__PURE__ */ t((e, t, n) => {
	let r = e - t - n, i = Math.floor(r / 4);
	return `0 ${t} ${Array(i).fill("2 2").join(" ")} ${n}`;
}, "generateDashArray"), W = /* @__PURE__ */ t(function(t, r, i, x, C, w, T, E = !1) {
	if (!T) throw Error(`insertEdge: missing diagramId for edge "${r.id}" \u2014 edge IDs require a diagram prefix for uniqueness`);
	let { handDrawnSeed: D } = a(), O = r.points, k = !1, A = C;
	var j = w;
	let M = [];
	for (let e in r.cssCompiledStyles) te(e) || M.push(r.cssCompiledStyles[e]);
	e.debug("UIO intersect check", r.points, j.x, A.x), j.intersect && A.intersect && !E && (O = O.slice(1, r.points.length - 1), O.unshift(A.intersect(O[0])), e.debug("Last point UIO", r.start, "-->", r.end, O[O.length - 1], j, j.intersect(O[O.length - 1])), O.push(j.intersect(O[O.length - 1])));
	let N = btoa(JSON.stringify(O));
	r.toCluster && (e.info("to cluster abc88", i.get(r.toCluster)), O = B(r.points, i.get(r.toCluster).node), k = !0), r.fromCluster && (e.debug("from cluster abc88", i.get(r.fromCluster), JSON.stringify(O, null, 2)), O = B(O.reverse(), i.get(r.fromCluster).node).reverse(), k = !0);
	let P = O.filter((e) => !Number.isNaN(e.y)), F = ie(r.curve);
	F !== "rounded" && (P = ae(P));
	let I = g;
	switch (F) {
		case "linear":
			I = g;
			break;
		case "basis":
			I = o;
			break;
		case "cardinal":
			I = d;
			break;
		case "bumpX":
			I = _;
			break;
		case "bumpY":
			I = y;
			break;
		case "catmullRom":
			I = m;
			break;
		case "monotoneX":
			I = s;
			break;
		case "monotoneY":
			I = u;
			break;
		case "natural":
			I = c;
			break;
		case "step":
			I = f;
			break;
		case "stepAfter":
			I = p;
			break;
		case "stepBefore":
			I = l;
			break;
		case "rounded":
			I = g;
			break;
		default: I = o;
	}
	let { x: L, y: R } = ee(r), z = h().x(L).y(R).curve(I), V;
	switch (r.thickness) {
		case "normal":
			V = "edge-thickness-normal";
			break;
		case "thick":
			V = "edge-thickness-thick";
			break;
		case "invisible":
			V = "edge-thickness-invisible";
			break;
		default: V = "edge-thickness-normal";
	}
	switch (r.pattern) {
		case "solid":
			V += " edge-pattern-solid";
			break;
		case "dotted":
			V += " edge-pattern-dotted";
			break;
		case "dashed":
			V += " edge-pattern-dashed";
			break;
		default: V += " edge-pattern-solid";
	}
	let H, W = F === "rounded" ? G(q(P, r), 5) : z(P), K = Array.isArray(r.style) ? r.style : [r.style], J = K.find((e) => e == null ? void 0 : e.startsWith("stroke:")), Y = "";
	r.animate && (Y = "edge-animation-fast"), r.animation && (Y = "edge-animation-" + r.animation);
	let X = !1;
	if (r.look === "handDrawn") {
		let e = ne.svg(t);
		Object.assign([], P);
		let i = e.path(W, {
			roughness: .3,
			seed: D
		});
		V += " transition", H = n(i).select("path").attr("id", `${T}-${r.id}`).attr("class", " " + V + (r.classes ? " " + r.classes : "") + (Y ? " " + Y : "")).attr("style", K ? K.reduce((e, t) => e + ";" + t, "") : "");
		let a = H.attr("d");
		H.attr("d", a), t.node().appendChild(H.node());
	} else {
		var Z;
		let e = M.join(";"), n = K ? K.reduce((e, t) => e + t + ";", "") : "", i = (e ? e + ";" + n + ";" : n) + ";" + (K ? K.reduce((e, t) => e + ";" + t, "") : "");
		H = t.append("path").attr("d", W).attr("id", `${T}-${r.id}`).attr("class", " " + V + (r.classes ? " " + r.classes : "") + (Y ? " " + Y : "")).attr("style", i), J = (Z = i.match(/stroke:([^;]+)/)) == null ? void 0 : Z[1], X = r.animate === !0 || !!r.animation || e.includes("animation");
		let a = H.node(), o = typeof a.getTotalLength == "function" ? a.getTotalLength() : 0, s = S[r.arrowTypeStart] || 0, c = S[r.arrowTypeEnd] || 0;
		if (r.look === "neo" && !X) {
			let e = `stroke-dasharray: ${r.pattern === "dotted" || r.pattern === "dashed" ? U(o, s, c) : `0 ${s} ${o - s - c} ${c}`}; stroke-dashoffset: 0;`;
			H.attr("style", e + H.attr("style"));
		}
	}
	H.attr("data-edge", !0), H.attr("data-et", "edge"), H.attr("data-id", r.id), H.attr("data-points", N), H.attr("data-look", b(r.look)), r.showPoints && P.forEach((e) => {
		t.append("circle").style("stroke", "red").style("fill", "red").attr("r", 1).attr("cx", e.x).attr("cy", e.y);
	});
	let Q = "";
	(a().flowchart.arrowMarkerAbsolute || a().state.arrowMarkerAbsolute) && (Q = window.location.protocol + "//" + window.location.host + window.location.pathname + window.location.search, Q = Q.replace(/\(/g, "\\(").replace(/\)/g, "\\)")), e.info("arrowTypeStart", r.arrowTypeStart), e.info("arrowTypeEnd", r.arrowTypeEnd);
	let oe = !X && (r == null ? void 0 : r.look) === "neo";
	re(H, r, Q, T, x, oe, J);
	let se = Math.floor(O.length / 2), ce = O[se];
	v.isLabelCoordinateInPath(ce, H.attr("d")) || (k = !0);
	let $ = {};
	return k && ($.updatedPath = O), $.originalPath = r.points, $;
}, "insertEdge");
function G(e, t) {
	if (e.length < 2) return "";
	let n = "", r = e.length, i = 1e-5;
	for (let a = 0; a < r; a++) {
		let o = e[a], s = e[a - 1], c = e[a + 1];
		if (a === 0) n += `M${o.x},${o.y}`;
		else if (a === r - 1) n += `L${o.x},${o.y}`;
		else {
			let e = o.x - s.x, r = o.y - s.y, a = c.x - o.x, l = c.y - o.y, u = Math.hypot(e, r), d = Math.hypot(a, l);
			if (u < i || d < i) {
				n += `L${o.x},${o.y}`;
				continue;
			}
			let f = e / u, p = r / u, m = a / d, h = l / d, g = f * m + p * h, _ = Math.acos(Math.max(-1, Math.min(1, g)));
			if (_ < i || Math.abs(Math.PI - _) < i) {
				n += `L${o.x},${o.y}`;
				continue;
			}
			let v = Math.min(t / Math.sin(_ / 2), u / 2, d / 2), y = o.x - f * v, b = o.y - p * v, x = o.x + m * v, S = o.y + h * v;
			n += `L${y},${b}`, n += `Q${o.x},${o.y} ${x},${S}`;
		}
	}
	return n;
}
t(G, "generateRoundedPath");
function K(e, t) {
	if (!e || !t) return {
		angle: 0,
		deltaX: 0,
		deltaY: 0
	};
	let n = t.x - e.x, r = t.y - e.y;
	return {
		angle: Math.atan2(r, n),
		deltaX: n,
		deltaY: r
	};
}
t(K, "calculateDeltaAndAngle");
function q(e, t) {
	let n = e.map((e) => ({ ...e }));
	if (e.length >= 2 && C[t.arrowTypeStart]) {
		let r = C[t.arrowTypeStart], i = e[0], a = e[1], { angle: o } = K(i, a), s = r * Math.cos(o), c = r * Math.sin(o);
		n[0].x = i.x + s, n[0].y = i.y + c;
	}
	let r = e.length;
	if (r >= 2 && C[t.arrowTypeEnd]) {
		let i = C[t.arrowTypeEnd], a = e[r - 1], o = e[r - 2], { angle: s } = K(o, a), c = i * Math.cos(s), l = i * Math.sin(s);
		n[r - 1].x = a.x - c, n[r - 1].y = a.y - l;
	}
	return n;
}
t(q, "applyMarkerOffsetsToPoints");
var J = /* @__PURE__ */ t((e, t, n, r) => {
	t.forEach((t) => {
		Y[t](e, n, r);
	});
}, "insertMarkers"), Y = {
	extension: /* @__PURE__ */ t((t, n, r) => {
		e.trace("Making markers for ", r), t.append("defs").append("marker").attr("id", r + "_" + n + "-extensionStart").attr("class", "marker extension " + n).attr("refX", 18).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 28).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").attr("d", "M 1,7 L18,13 V 1 Z"), t.append("defs").append("marker").attr("id", r + "_" + n + "-extensionEnd").attr("class", "marker extension " + n).attr("refX", 1).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 28).attr("orient", "auto").append("path").attr("d", "M 1,1 V 13 L18,7 Z"), t.append("marker").attr("id", r + "_" + n + "-extensionStart-margin").attr("class", "marker extension " + n).attr("refX", 18).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 28).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").attr("viewBox", "0 0 20 14").append("polygon").attr("points", "10,7 18,13 18,1").style("stroke-width", 2).style("stroke-dasharray", "0"), t.append("defs").append("marker").attr("id", r + "_" + n + "-extensionEnd-margin").attr("class", "marker extension " + n).attr("refX", 9).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 28).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").attr("viewBox", "0 0 20 14").append("polygon").attr("points", "10,1 10,13 18,7").style("stroke-width", 2).style("stroke-dasharray", "0");
	}, "extension"),
	composition: /* @__PURE__ */ t((e, t, n) => {
		e.append("defs").append("marker").attr("id", n + "_" + t + "-compositionStart").attr("class", "marker composition " + t).attr("refX", 18).attr("refY", 7).attr("markerWidth", 190).attr("markerHeight", 240).attr("orient", "auto").append("path").attr("d", "M 18,7 L9,13 L1,7 L9,1 Z"), e.append("defs").append("marker").attr("id", n + "_" + t + "-compositionEnd").attr("class", "marker composition " + t).attr("refX", 1).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 28).attr("orient", "auto").append("path").attr("d", "M 18,7 L9,13 L1,7 L9,1 Z"), e.append("defs").append("marker").attr("id", n + "_" + t + "-compositionStart-margin").attr("class", "marker composition " + t).attr("refX", 15).attr("refY", 7).attr("markerWidth", 190).attr("markerHeight", 240).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").style("stroke-width", 0).attr("viewBox", "0 0 15 15").attr("d", "M 18,7 L9,13 L1,7 L9,1 Z"), e.append("defs").append("marker").attr("id", n + "_" + t + "-compositionEnd-margin").attr("class", "marker composition " + t).attr("refX", 3.5).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 28).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").style("stroke-width", 0).attr("d", "M 18,7 L9,13 L1,7 L9,1 Z");
	}, "composition"),
	aggregation: /* @__PURE__ */ t((e, t, n) => {
		e.append("defs").append("marker").attr("id", n + "_" + t + "-aggregationStart").attr("class", "marker aggregation " + t).attr("refX", 18).attr("refY", 7).attr("markerWidth", 190).attr("markerHeight", 240).attr("orient", "auto").append("path").attr("d", "M 18,7 L9,13 L1,7 L9,1 Z"), e.append("defs").append("marker").attr("id", n + "_" + t + "-aggregationEnd").attr("class", "marker aggregation " + t).attr("refX", 1).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 28).attr("orient", "auto").append("path").attr("d", "M 18,7 L9,13 L1,7 L9,1 Z"), e.append("defs").append("marker").attr("id", n + "_" + t + "-aggregationStart-margin").attr("class", "marker aggregation " + t).attr("refX", 15).attr("refY", 7).attr("markerWidth", 190).attr("markerHeight", 240).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").style("stroke-width", 2).attr("d", "M 18,7 L9,13 L1,7 L9,1 Z"), e.append("defs").append("marker").attr("id", n + "_" + t + "-aggregationEnd-margin").attr("class", "marker aggregation " + t).attr("refX", 1).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 28).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").style("stroke-width", 2).attr("d", "M 18,7 L9,13 L1,7 L9,1 Z");
	}, "aggregation"),
	dependency: /* @__PURE__ */ t((e, t, n) => {
		e.append("defs").append("marker").attr("id", n + "_" + t + "-dependencyStart").attr("class", "marker dependency " + t).attr("refX", 6).attr("refY", 7).attr("markerWidth", 190).attr("markerHeight", 240).attr("orient", "auto").append("path").attr("d", "M 5,7 L9,13 L1,7 L9,1 Z"), e.append("defs").append("marker").attr("id", n + "_" + t + "-dependencyEnd").attr("class", "marker dependency " + t).attr("refX", 13).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 28).attr("orient", "auto").append("path").attr("d", "M 18,7 L9,13 L14,7 L9,1 Z"), e.append("defs").append("marker").attr("id", n + "_" + t + "-dependencyStart-margin").attr("class", "marker dependency " + t).attr("refX", 4).attr("refY", 7).attr("markerWidth", 190).attr("markerHeight", 240).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").style("stroke-width", 0).attr("d", "M 5,7 L9,13 L1,7 L9,1 Z"), e.append("defs").append("marker").attr("id", n + "_" + t + "-dependencyEnd-margin").attr("class", "marker dependency " + t).attr("refX", 16).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 28).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").style("stroke-width", 0).attr("d", "M 18,7 L9,13 L14,7 L9,1 Z");
	}, "dependency"),
	lollipop: /* @__PURE__ */ t((e, t, n) => {
		e.append("defs").append("marker").attr("id", n + "_" + t + "-lollipopStart").attr("class", "marker lollipop " + t).attr("refX", 13).attr("refY", 7).attr("markerWidth", 190).attr("markerHeight", 240).attr("orient", "auto").append("circle").attr("fill", "transparent").attr("cx", 7).attr("cy", 7).attr("r", 6), e.append("defs").append("marker").attr("id", n + "_" + t + "-lollipopEnd").attr("class", "marker lollipop " + t).attr("refX", 1).attr("refY", 7).attr("markerWidth", 190).attr("markerHeight", 240).attr("orient", "auto").append("circle").attr("fill", "transparent").attr("cx", 7).attr("cy", 7).attr("r", 6), e.append("defs").append("marker").attr("id", n + "_" + t + "-lollipopStart-margin").attr("class", "marker lollipop " + t).attr("refX", 13).attr("refY", 7).attr("markerWidth", 190).attr("markerHeight", 240).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("circle").attr("fill", "transparent").attr("cx", 7).attr("cy", 7).attr("r", 6).attr("stroke-width", 2), e.append("defs").append("marker").attr("id", n + "_" + t + "-lollipopEnd-margin").attr("class", "marker lollipop " + t).attr("refX", 1).attr("refY", 7).attr("markerWidth", 190).attr("markerHeight", 240).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("circle").attr("fill", "transparent").attr("cx", 7).attr("cy", 7).attr("r", 6).attr("stroke-width", 2);
	}, "lollipop"),
	point: /* @__PURE__ */ t((e, t, n) => {
		e.append("marker").attr("id", n + "_" + t + "-pointEnd").attr("class", "marker " + t).attr("viewBox", "0 0 10 10").attr("refX", 5).attr("refY", 5).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 8).attr("markerHeight", 8).attr("orient", "auto").append("path").attr("d", "M 0 0 L 10 5 L 0 10 z").attr("class", "arrowMarkerPath").style("stroke-width", 1).style("stroke-dasharray", "1,0"), e.append("marker").attr("id", n + "_" + t + "-pointStart").attr("class", "marker " + t).attr("viewBox", "0 0 10 10").attr("refX", 4.5).attr("refY", 5).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 8).attr("markerHeight", 8).attr("orient", "auto").append("path").attr("d", "M 0 5 L 10 10 L 10 0 z").attr("class", "arrowMarkerPath").style("stroke-width", 1).style("stroke-dasharray", "1,0"), e.append("marker").attr("id", n + "_" + t + "-pointEnd-margin").attr("class", "marker " + t).attr("viewBox", "0 0 11.5 14").attr("refX", 11.5).attr("refY", 7).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 10.5).attr("markerHeight", 14).attr("orient", "auto").append("path").attr("d", "M 0 0 L 11.5 7 L 0 14 z").attr("class", "arrowMarkerPath").style("stroke-width", 0).style("stroke-dasharray", "1,0"), e.append("marker").attr("id", n + "_" + t + "-pointStart-margin").attr("class", "marker " + t).attr("viewBox", "0 0 11.5 14").attr("refX", 1).attr("refY", 7).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 11.5).attr("markerHeight", 14).attr("orient", "auto").append("polygon").attr("points", "0,7 11.5,14 11.5,0").attr("class", "arrowMarkerPath").style("stroke-width", 0).style("stroke-dasharray", "1,0");
	}, "point"),
	circle: /* @__PURE__ */ t((e, t, n) => {
		e.append("marker").attr("id", n + "_" + t + "-circleEnd").attr("class", "marker " + t).attr("viewBox", "0 0 10 10").attr("refX", 11).attr("refY", 5).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 11).attr("markerHeight", 11).attr("orient", "auto").append("circle").attr("cx", "5").attr("cy", "5").attr("r", "5").attr("class", "arrowMarkerPath").style("stroke-width", 1).style("stroke-dasharray", "1,0"), e.append("marker").attr("id", n + "_" + t + "-circleStart").attr("class", "marker " + t).attr("viewBox", "0 0 10 10").attr("refX", -1).attr("refY", 5).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 11).attr("markerHeight", 11).attr("orient", "auto").append("circle").attr("cx", "5").attr("cy", "5").attr("r", "5").attr("class", "arrowMarkerPath").style("stroke-width", 1).style("stroke-dasharray", "1,0"), e.append("marker").attr("id", n + "_" + t + "-circleEnd-margin").attr("class", "marker " + t).attr("viewBox", "0 0 10 10").attr("refY", 5).attr("refX", 12.25).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 14).attr("markerHeight", 14).attr("orient", "auto").append("circle").attr("cx", "5").attr("cy", "5").attr("r", "5").attr("class", "arrowMarkerPath").style("stroke-width", 0).style("stroke-dasharray", "1,0"), e.append("marker").attr("id", n + "_" + t + "-circleStart-margin").attr("class", "marker " + t).attr("viewBox", "0 0 10 10").attr("refX", -2).attr("refY", 5).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 14).attr("markerHeight", 14).attr("orient", "auto").append("circle").attr("cx", "5").attr("cy", "5").attr("r", "5").attr("class", "arrowMarkerPath").style("stroke-width", 0).style("stroke-dasharray", "1,0");
	}, "circle"),
	cross: /* @__PURE__ */ t((e, t, n) => {
		e.append("marker").attr("id", n + "_" + t + "-crossEnd").attr("class", "marker cross " + t).attr("viewBox", "0 0 11 11").attr("refX", 12).attr("refY", 5.2).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 11).attr("markerHeight", 11).attr("orient", "auto").append("path").attr("d", "M 1,1 l 9,9 M 10,1 l -9,9").attr("class", "arrowMarkerPath").style("stroke-width", 2).style("stroke-dasharray", "1,0"), e.append("marker").attr("id", n + "_" + t + "-crossStart").attr("class", "marker cross " + t).attr("viewBox", "0 0 11 11").attr("refX", -1).attr("refY", 5.2).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 11).attr("markerHeight", 11).attr("orient", "auto").append("path").attr("d", "M 1,1 l 9,9 M 10,1 l -9,9").attr("class", "arrowMarkerPath").style("stroke-width", 2).style("stroke-dasharray", "1,0"), e.append("marker").attr("id", n + "_" + t + "-crossEnd-margin").attr("class", "marker cross " + t).attr("viewBox", "0 0 15 15").attr("refX", 17.7).attr("refY", 7.5).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 12).attr("markerHeight", 12).attr("orient", "auto").append("path").attr("d", "M 1,1 L 14,14 M 1,14 L 14,1").attr("class", "arrowMarkerPath").style("stroke-width", 2.5), e.append("marker").attr("id", n + "_" + t + "-crossStart-margin").attr("class", "marker cross " + t).attr("viewBox", "0 0 15 15").attr("refX", -3.5).attr("refY", 7.5).attr("markerUnits", "userSpaceOnUse").attr("markerWidth", 12).attr("markerHeight", 12).attr("orient", "auto").append("path").attr("d", "M 1,1 L 14,14 M 1,14 L 14,1").attr("class", "arrowMarkerPath").style("stroke-width", 2.5).style("stroke-dasharray", "1,0");
	}, "cross"),
	barb: /* @__PURE__ */ t((e, t, n) => {
		e.append("defs").append("marker").attr("id", n + "_" + t + "-barbEnd").attr("refX", 19).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 14).attr("markerUnits", "userSpaceOnUse").attr("orient", "auto").append("path").attr("d", "M 19,7 L9,13 L14,7 L9,1 Z");
	}, "barb"),
	barbNeo: /* @__PURE__ */ t((e, t, n) => {
		let { themeVariables: r } = i(), { transitionColor: a } = r;
		e.append("defs").append("marker").attr("id", n + "_" + t + "-barbEnd").attr("refX", 19).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 14).attr("markerUnits", "strokeWidth").attr("orient", "auto").append("path").attr("d", "M 19,7 L11,14 L13,7 L11,0 Z"), e.append("defs").append("marker").attr("id", n + "_" + t + "-barbEnd-margin").attr("refX", 17).attr("refY", 7).attr("markerWidth", 20).attr("markerHeight", 14).attr("markerUnits", "userSpaceOnUse").attr("orient", "auto").append("path").attr("d", "M 19,7 L11,14 L13,7 L11,0 Z").attr("fill", `${a}`);
	}, "barbNeo"),
	only_one: /* @__PURE__ */ t((e, t, n) => {
		e.append("defs").append("marker").attr("id", n + "_" + t + "-onlyOneStart").attr("class", "marker onlyOne " + t).attr("refX", 0).attr("refY", 9).attr("markerWidth", 18).attr("markerHeight", 18).attr("orient", "auto").append("path").attr("d", "M9,0 L9,18 M15,0 L15,18"), e.append("defs").append("marker").attr("id", n + "_" + t + "-onlyOneEnd").attr("class", "marker onlyOne " + t).attr("refX", 18).attr("refY", 9).attr("markerWidth", 18).attr("markerHeight", 18).attr("orient", "auto").append("path").attr("d", "M3,0 L3,18 M9,0 L9,18");
	}, "only_one"),
	zero_or_one: /* @__PURE__ */ t((e, t, n) => {
		let r = e.append("defs").append("marker").attr("id", n + "_" + t + "-zeroOrOneStart").attr("class", "marker zeroOrOne " + t).attr("refX", 0).attr("refY", 9).attr("markerWidth", 30).attr("markerHeight", 18).attr("orient", "auto");
		r.append("circle").attr("fill", "white").attr("cx", 21).attr("cy", 9).attr("r", 6), r.append("path").attr("d", "M9,0 L9,18");
		let i = e.append("defs").append("marker").attr("id", n + "_" + t + "-zeroOrOneEnd").attr("class", "marker zeroOrOne " + t).attr("refX", 30).attr("refY", 9).attr("markerWidth", 30).attr("markerHeight", 18).attr("orient", "auto");
		i.append("circle").attr("fill", "white").attr("cx", 9).attr("cy", 9).attr("r", 6), i.append("path").attr("d", "M21,0 L21,18");
	}, "zero_or_one"),
	one_or_more: /* @__PURE__ */ t((e, t, n) => {
		e.append("defs").append("marker").attr("id", n + "_" + t + "-oneOrMoreStart").attr("class", "marker oneOrMore " + t).attr("refX", 18).attr("refY", 18).attr("markerWidth", 45).attr("markerHeight", 36).attr("orient", "auto").append("path").attr("d", "M0,18 Q 18,0 36,18 Q 18,36 0,18 M42,9 L42,27"), e.append("defs").append("marker").attr("id", n + "_" + t + "-oneOrMoreEnd").attr("class", "marker oneOrMore " + t).attr("refX", 27).attr("refY", 18).attr("markerWidth", 45).attr("markerHeight", 36).attr("orient", "auto").append("path").attr("d", "M3,9 L3,27 M9,18 Q27,0 45,18 Q27,36 9,18");
	}, "one_or_more"),
	zero_or_more: /* @__PURE__ */ t((e, t, n) => {
		let r = e.append("defs").append("marker").attr("id", n + "_" + t + "-zeroOrMoreStart").attr("class", "marker zeroOrMore " + t).attr("refX", 18).attr("refY", 18).attr("markerWidth", 57).attr("markerHeight", 36).attr("orient", "auto");
		r.append("circle").attr("fill", "white").attr("cx", 48).attr("cy", 18).attr("r", 6), r.append("path").attr("d", "M0,18 Q18,0 36,18 Q18,36 0,18");
		let i = e.append("defs").append("marker").attr("id", n + "_" + t + "-zeroOrMoreEnd").attr("class", "marker zeroOrMore " + t).attr("refX", 39).attr("refY", 18).attr("markerWidth", 57).attr("markerHeight", 36).attr("orient", "auto");
		i.append("circle").attr("fill", "white").attr("cx", 9).attr("cy", 18).attr("r", 6), i.append("path").attr("d", "M21,18 Q39,0 57,18 Q39,36 21,18");
	}, "zero_or_more"),
	only_one_neo: /* @__PURE__ */ t((e, t, n) => {
		let { themeVariables: r } = i(), { strokeWidth: a } = r;
		e.append("defs").append("marker").attr("id", n + "_" + t + "-onlyOneStart").attr("class", "marker onlyOne " + t).attr("refX", 0).attr("refY", 9).attr("markerWidth", 18).attr("markerHeight", 18).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").attr("d", "M9,0 L9,18 M15,0 L15,18").attr("stroke-width", `${a}`), e.append("defs").append("marker").attr("id", n + "_" + t + "-onlyOneEnd").attr("class", "marker onlyOne " + t).attr("refX", 18).attr("refY", 9).attr("markerWidth", 18).attr("markerHeight", 18).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").attr("d", "M3,0 L3,18 M9,0 L9,18").attr("stroke-width", `${a}`);
	}, "only_one_neo"),
	zero_or_one_neo: /* @__PURE__ */ t((e, t, n) => {
		let { themeVariables: r } = i(), { strokeWidth: a, mainBkg: o } = r, s = e.append("defs").append("marker").attr("id", n + "_" + t + "-zeroOrOneStart").attr("class", "marker zeroOrOne " + t).attr("refX", 0).attr("refY", 9).attr("markerWidth", 30).attr("markerHeight", 18).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse");
		s.append("circle").attr("fill", o == null ? "white" : o).attr("cx", 21).attr("cy", 9).attr("stroke-width", `${a}`).attr("r", 6), s.append("path").attr("d", "M9,0 L9,18").attr("stroke-width", `${a}`);
		let c = e.append("defs").append("marker").attr("id", n + "_" + t + "-zeroOrOneEnd").attr("class", "marker zeroOrOne " + t).attr("refX", 30).attr("refY", 9).attr("markerWidth", 30).attr("markerHeight", 18).attr("markerUnits", "userSpaceOnUse").attr("orient", "auto");
		c.append("circle").attr("fill", o == null ? "white" : o).attr("cx", 9).attr("cy", 9).attr("stroke-width", `${a}`).attr("r", 6), c.append("path").attr("d", "M21,0 L21,18").attr("stroke-width", `${a}`);
	}, "zero_or_one_neo"),
	one_or_more_neo: /* @__PURE__ */ t((e, t, n) => {
		let { themeVariables: r } = i(), { strokeWidth: a } = r;
		e.append("defs").append("marker").attr("id", n + "_" + t + "-oneOrMoreStart").attr("class", "marker oneOrMore " + t).attr("refX", 18).attr("refY", 18).attr("markerWidth", 45).attr("markerHeight", 36).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("path").attr("d", "M0,18 Q 18,0 36,18 Q 18,36 0,18 M42,9 L42,27").attr("stroke-width", `${a}`), e.append("defs").append("marker").attr("id", n + "_" + t + "-oneOrMoreEnd").attr("class", "marker oneOrMore " + t).attr("refX", 27).attr("refY", 18).attr("markerWidth", 45).attr("markerHeight", 36).attr("markerUnits", "userSpaceOnUse").attr("orient", "auto").append("path").attr("d", "M3,9 L3,27 M9,18 Q27,0 45,18 Q27,36 9,18").attr("stroke-width", `${a}`);
	}, "one_or_more_neo"),
	zero_or_more_neo: /* @__PURE__ */ t((e, t, n) => {
		let { themeVariables: r } = i(), { strokeWidth: a, mainBkg: o } = r, s = e.append("defs").append("marker").attr("id", n + "_" + t + "-zeroOrMoreStart").attr("class", "marker zeroOrMore " + t).attr("refX", 18).attr("refY", 18).attr("markerWidth", 57).attr("markerHeight", 36).attr("markerUnits", "userSpaceOnUse").attr("orient", "auto");
		s.append("circle").attr("fill", o == null ? "white" : o).attr("cx", 45.5).attr("cy", 18).attr("r", 6).attr("stroke-width", `${a}`), s.append("path").attr("d", "M0,18 Q18,0 36,18 Q18,36 0,18").attr("stroke-width", `${a}`);
		let c = e.append("defs").append("marker").attr("id", n + "_" + t + "-zeroOrMoreEnd").attr("class", "marker zeroOrMore " + t).attr("refX", 39).attr("refY", 18).attr("markerWidth", 57).attr("markerHeight", 36).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse");
		c.append("circle").attr("fill", o == null ? "white" : o).attr("cx", 11).attr("cy", 18).attr("r", 6).attr("stroke-width", `${a}`), c.append("path").attr("d", "M21,18 Q39,0 57,18 Q39,36 21,18").attr("stroke-width", `${a}`);
	}, "zero_or_more_neo"),
	requirement_arrow: /* @__PURE__ */ t((e, t, n) => {
		e.append("defs").append("marker").attr("id", n + "_" + t + "-requirement_arrowEnd").attr("refX", 20).attr("refY", 10).attr("markerWidth", 20).attr("markerHeight", 20).attr("orient", "auto").append("path").attr("d", "M0,0\n      L20,10\n      M20,10\n      L0,20");
	}, "requirement_arrow"),
	requirement_contains: /* @__PURE__ */ t((e, t, n) => {
		let r = e.append("defs").append("marker").attr("id", n + "_" + t + "-requirement_containsStart").attr("refX", 0).attr("refY", 10).attr("markerWidth", 20).attr("markerHeight", 20).attr("orient", "auto").append("g");
		r.append("circle").attr("cx", 10).attr("cy", 10).attr("r", 9).attr("fill", "none"), r.append("line").attr("x1", 1).attr("x2", 19).attr("y1", 10).attr("y2", 10), r.append("line").attr("y1", 1).attr("y2", 19).attr("x1", 10).attr("x2", 10);
	}, "requirement_contains"),
	requirement_arrow_neo: /* @__PURE__ */ t((e, t, n) => {
		let { themeVariables: r } = i(), { strokeWidth: a } = r;
		e.append("defs").append("marker").attr("id", n + "_" + t + "-requirement_arrowEnd").attr("refX", 20).attr("refY", 10).attr("markerWidth", 20).attr("markerHeight", 20).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").attr("stroke-width", `${a}`).attr("viewBox", "0 0 25 20").append("path").attr("d", "M0,0\n      L20,10\n      M20,10\n      L0,20").attr("stroke-linejoin", "miter");
	}, "requirement_arrow_neo"),
	requirement_contains_neo: /* @__PURE__ */ t((e, t, n) => {
		let { themeVariables: r } = i(), { strokeWidth: a } = r, o = e.append("defs").append("marker").attr("id", n + "_" + t + "-requirement_containsStart").attr("refX", 0).attr("refY", 10).attr("markerWidth", 20).attr("markerHeight", 20).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse").append("g");
		o.append("circle").attr("cx", 10).attr("cy", 10).attr("r", 9).attr("fill", "none"), o.append("line").attr("x1", 1).attr("x2", 19).attr("y1", 10).attr("y2", 10), o.append("line").attr("y1", 1).attr("y2", 19).attr("x1", 10).attr("x2", 10), o.selectAll("*").attr("stroke-width", `${a}`);
	}, "requirement_contains_neo")
}, X = J;
//#endregion
export { L as a, X as i, W as n, F as r, N as t };
