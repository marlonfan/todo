import { t as e } from "./mermaid-parser.core-LeAvxtoi.mjs";
import { i as t, r as n } from "./src-q1mJODQi.mjs";
import { H as r, K as i, U as a, a as o, c as s, f as c, v as l, w as u, x as d, y as f } from "./chunk-CSCIHK7Q-Bm1gw87X.mjs";
import { n as p } from "./ordinal-CQXecEOr.mjs";
import { I as m, L as h, S as g } from "./step-BLAKVGAu.mjs";
import { t as _ } from "./arc-CaXU7sh_.mjs";
import { i as v, p as y } from "./chunk-5ZQYHXKU-cRTMH84-.mjs";
import { t as b } from "./chunk-WU5MYG2G-Bix12dNS.mjs";
import { t as x } from "./chunk-4BX2VUAB-CAnGp29N.mjs";
//#region ../../node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/descending.js
function S(e, t) {
	return t < e ? -1 : t > e ? 1 : t >= e ? 0 : NaN;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/identity.js
function C(e) {
	return e;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/pie.js
function w() {
	var e = C, t = S, n = null, r = h(0), i = h(m), a = h(0);
	function o(o) {
		var s, c = (o = g(o)).length, l, u, d = 0, f = Array(c), p = Array(c), h = +r.apply(this, arguments), _ = Math.min(m, Math.max(-m, i.apply(this, arguments) - h)), v, y = Math.min(Math.abs(_) / c, a.apply(this, arguments)), b = y * (_ < 0 ? -1 : 1), x;
		for (s = 0; s < c; ++s) (x = p[f[s] = s] = +e(o[s], s, o)) > 0 && (d += x);
		for (t == null ? n != null && f.sort(function(e, t) {
			return n(o[e], o[t]);
		}) : f.sort(function(e, n) {
			return t(p[e], p[n]);
		}), s = 0, u = d ? (_ - c * b) / d : 0; s < c; ++s, h = v) l = f[s], x = p[l], v = h + (x > 0 ? x * u : 0) + b, p[l] = {
			data: o[l],
			index: s,
			value: x,
			startAngle: h,
			endAngle: v,
			padAngle: y
		};
		return p;
	}
	return o.value = function(t) {
		return arguments.length ? (e = typeof t == "function" ? t : h(+t), o) : e;
	}, o.sortValues = function(e) {
		return arguments.length ? (t = e, n = null, o) : t;
	}, o.sort = function(e) {
		return arguments.length ? (n = e, t = null, o) : n;
	}, o.startAngle = function(e) {
		return arguments.length ? (r = typeof e == "function" ? e : h(+e), o) : r;
	}, o.endAngle = function(e) {
		return arguments.length ? (i = typeof e == "function" ? e : h(+e), o) : i;
	}, o.padAngle = function(e) {
		return arguments.length ? (a = typeof e == "function" ? e : h(+e), o) : a;
	}, o;
}
//#endregion
//#region ../../node_modules/.pnpm/mermaid@11.15.0/node_modules/mermaid/dist/chunks/mermaid.core/pieDiagram-4H26LBE5.mjs
var T = c.pie, E = {
	sections: /* @__PURE__ */ new Map(),
	showData: !1,
	config: T
}, D = E.sections, O = E.showData, k = structuredClone(T), A = {
	getConfig: /* @__PURE__ */ n(() => structuredClone(k), "getConfig"),
	clear: /* @__PURE__ */ n(() => {
		D = /* @__PURE__ */ new Map(), O = E.showData, o();
	}, "clear"),
	setDiagramTitle: i,
	getDiagramTitle: u,
	setAccTitle: a,
	getAccTitle: f,
	setAccDescription: r,
	getAccDescription: l,
	addSection: /* @__PURE__ */ n(({ label: e, value: n }) => {
		if (n < 0) throw Error(`"${e}" has invalid value: ${n}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);
		D.has(e) || (D.set(e, n), t.debug(`added new section: ${e}, with value: ${n}`));
	}, "addSection"),
	getSections: /* @__PURE__ */ n(() => D, "getSections"),
	setShowData: /* @__PURE__ */ n((e) => {
		O = e;
	}, "setShowData"),
	getShowData: /* @__PURE__ */ n(() => O, "getShowData")
}, j = /* @__PURE__ */ n((e, t) => {
	x(e, t), t.setShowData(e.showData), e.sections.map(t.addSection);
}, "populateDb"), M = { parse: /* @__PURE__ */ n(async (n) => {
	let r = await e("pie", n);
	t.debug(r), j(r, A);
}, "parse") }, N = /* @__PURE__ */ n((e) => `
  .pieCircle{
    stroke: ${e.pieStrokeColor};
    stroke-width : ${e.pieStrokeWidth};
    opacity : ${e.pieOpacity};
  }
  .pieOuterCircle{
    stroke: ${e.pieOuterStrokeColor};
    stroke-width: ${e.pieOuterStrokeWidth};
    fill: none;
  }
  .pieTitleText {
    text-anchor: middle;
    font-size: ${e.pieTitleTextSize};
    fill: ${e.pieTitleTextColor};
    font-family: ${e.fontFamily};
  }
  .slice {
    font-family: ${e.fontFamily};
    fill: ${e.pieSectionTextColor};
    font-size:${e.pieSectionTextSize};
    // fill: white;
  }
  .legend text {
    fill: ${e.pieLegendTextColor};
    font-family: ${e.fontFamily};
    font-size: ${e.pieLegendTextSize};
  }
`, "getStyles"), P = /* @__PURE__ */ n((e) => {
	let t = [...e.values()].reduce((e, t) => e + t, 0), n = [...e.entries()].map(([e, t]) => ({
		label: e,
		value: t
	})).filter((e) => e.value / t * 100 >= 1);
	return w().value((e) => e.value).sort(null)(n);
}, "createPieArcs"), F = {
	parser: M,
	db: A,
	renderer: { draw: /* @__PURE__ */ n((e, n, r, i) => {
		var a, o;
		t.debug("rendering pie chart\n" + e);
		let c = i.db, l = d(), u = v(c.getConfig(), l.pie), f = b(n), m = f.append("g");
		m.attr("transform", "translate(225,225)");
		let { themeVariables: h } = l, [g] = y(h.pieOuterStrokeWidth);
		g != null || (g = 2);
		let x = u.textPosition, S = _().innerRadius(0).outerRadius(185), C = _().innerRadius(185 * x).outerRadius(185 * x);
		m.append("circle").attr("cx", 0).attr("cy", 0).attr("r", 185 + g / 2).attr("class", "pieOuterCircle");
		let w = c.getSections(), T = P(w), E = [
			h.pie1,
			h.pie2,
			h.pie3,
			h.pie4,
			h.pie5,
			h.pie6,
			h.pie7,
			h.pie8,
			h.pie9,
			h.pie10,
			h.pie11,
			h.pie12
		], D = 0;
		w.forEach((e) => {
			D += e;
		});
		let O = T.filter((e) => (e.data.value / D * 100).toFixed(0) !== "0"), k = p(E).domain([...w.keys()]);
		m.selectAll("mySlices").data(O).enter().append("path").attr("d", S).attr("fill", (e) => k(e.data.label)).attr("class", "pieCircle"), m.selectAll("mySlices").data(O).enter().append("text").text((e) => (e.data.value / D * 100).toFixed(0) + "%").attr("transform", (e) => "translate(" + C.centroid(e) + ")").style("text-anchor", "middle").attr("class", "slice");
		let A = m.append("text").text(c.getDiagramTitle()).attr("x", 0).attr("y", -400 / 2).attr("class", "pieTitleText"), j = [...w.entries()].map(([e, t]) => ({
			label: e,
			value: t
		})), M = m.selectAll(".legend").data(j).enter().append("g").attr("class", "legend").attr("transform", (e, t) => {
			let n = 22 * j.length / 2;
			return "translate(216," + (t * 22 - n) + ")";
		});
		M.append("rect").attr("width", 18).attr("height", 18).style("fill", (e) => k(e.label)).style("stroke", (e) => k(e.label)), M.append("text").attr("x", 22).attr("y", 14).text((e) => c.getShowData() ? `${e.label} [${e.value}]` : e.label);
		let N = 512 + Math.max(...M.selectAll("text").nodes().map((e) => {
			var t;
			return (t = e == null ? void 0 : e.getBoundingClientRect().width) == null ? 0 : t;
		})), F = (a = (o = A.node()) == null ? void 0 : o.getBoundingClientRect().width) == null ? 0 : a, I = 450 / 2 - F / 2, L = 450 / 2 + F / 2, R = Math.min(0, I), z = Math.max(N, L) - R;
		f.attr("viewBox", `${R} 0 ${z} 450`), s(f, 450, z, u.useMaxWidth);
	}, "draw") },
	styles: N
};
//#endregion
export { F as diagram };
