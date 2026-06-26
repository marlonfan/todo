import { t as e } from "./mermaid-parser.core-LeAvxtoi.mjs";
import { i as t, r as n, t as r } from "./src-q1mJODQi.mjs";
import { D as i, H as a, K as o, U as s, a as c, b as l, c as u, f as d, v as f, w as p, y as m } from "./chunk-CSCIHK7Q-Bm1gw87X.mjs";
import { n as h } from "./ordinal-CQXecEOr.mjs";
import { t as g } from "./defaultLocale-MdLIoXIH.mjs";
import { p as _, t as v } from "./treemap-BnMONfi6.mjs";
import { i as y } from "./chunk-5ZQYHXKU-cRTMH84-.mjs";
import { t as b } from "./chunk-WU5MYG2G-Bix12dNS.mjs";
import { t as x } from "./chunk-4BX2VUAB-CAnGp29N.mjs";
import { t as S } from "./chunk-2J33WTMH-BVQPZaMK.mjs";
import { i as C, n as w } from "./chunk-NZK2D7GU-CsuOrk0Z.mjs";
//#region ../../node_modules/.pnpm/mermaid@11.15.0/node_modules/mermaid/dist/chunks/mermaid.core/diagram-OG6HWLK6.mjs
var T, E = (T = class {
	constructor() {
		this.nodes = [], this.levels = /* @__PURE__ */ new Map(), this.outerNodes = [], this.classes = /* @__PURE__ */ new Map(), this.setAccTitle = s, this.getAccTitle = m, this.setDiagramTitle = o, this.getDiagramTitle = p, this.getAccDescription = f, this.setAccDescription = a;
	}
	getNodes() {
		return this.nodes;
	}
	getConfig() {
		var e;
		let t = d, n = l();
		return y({
			...t.treemap,
			...(e = n.treemap) == null ? {} : e
		});
	}
	addNode(e, t) {
		this.nodes.push(e), this.levels.set(e, t), t === 0 && (this.outerNodes.push(e), this.root != null || (this.root = e));
	}
	getRoot() {
		return {
			name: "",
			children: this.outerNodes
		};
	}
	addClass(e, t) {
		var n;
		let r = (n = this.classes.get(e)) == null ? {
			id: e,
			styles: [],
			textStyles: []
		} : n, i = t.replace(/\\,/g, "§§§").replace(/,/g, ";").replace(/§§§/g, ",").split(";");
		i && i.forEach((e) => {
			w(e) && (r != null && r.textStyles ? r.textStyles.push(e) : r.textStyles = [e]), r != null && r.styles ? r.styles.push(e) : r.styles = [e];
		}), this.classes.set(e, r);
	}
	getClasses() {
		return this.classes;
	}
	getStylesForClass(e) {
		var t, n;
		return (t = (n = this.classes.get(e)) == null ? void 0 : n.styles) == null ? [] : t;
	}
	clear() {
		c(), this.nodes = [], this.levels = /* @__PURE__ */ new Map(), this.outerNodes = [], this.classes = /* @__PURE__ */ new Map(), this.root = void 0;
	}
}, n(T, "TreeMapDB"), T);
function D(e) {
	if (!e.length) return [];
	let t = [], n = [];
	return e.forEach((e) => {
		let r = {
			name: e.name,
			children: e.type === "Leaf" ? void 0 : []
		};
		for (r.classSelector = e == null ? void 0 : e.classSelector, e != null && e.cssCompiledStyles && (r.cssCompiledStyles = e.cssCompiledStyles), e.type === "Leaf" && e.value !== void 0 && (r.value = e.value); n.length > 0 && n[n.length - 1].level >= e.level;) n.pop();
		if (n.length === 0) t.push(r);
		else {
			let e = n[n.length - 1].node;
			e.children ? e.children.push(r) : e.children = [r];
		}
		e.type !== "Leaf" && n.push({
			node: r,
			level: e.level
		});
	}), t;
}
n(D, "buildHierarchy");
var O = /* @__PURE__ */ n((e, t) => {
	var r, i;
	x(e, t);
	let a = [];
	for (let n of (r = e.TreemapRows) == null ? [] : r) if (n.$type === "ClassDefStatement") {
		var o, s;
		t.addClass((o = n.className) == null ? "" : o, (s = n.styleText) == null ? "" : s);
	}
	for (let n of (i = e.TreemapRows) == null ? [] : i) {
		let e = n.item;
		if (!e) continue;
		let r = n.indent ? parseInt(n.indent) : 0, i = k(e), o = e.classSelector ? t.getStylesForClass(e.classSelector) : [], s = o.length > 0 ? o : void 0, c = {
			level: r,
			name: i,
			type: e.$type,
			value: e.value,
			classSelector: e.classSelector,
			cssCompiledStyles: s
		};
		a.push(c);
	}
	let c = D(a), l = /* @__PURE__ */ n((e, n) => {
		for (let r of e) t.addNode(r, n), r.children && r.children.length > 0 && l(r.children, n + 1);
	}, "addNodesRecursively");
	l(c, 0);
}, "populate"), k = /* @__PURE__ */ n((e) => e.name ? String(e.name) : "", "getItemName"), A = {
	parser: { yy: void 0 },
	parse: /* @__PURE__ */ n(async (n) => {
		try {
			var r;
			let i = await e("treemap", n);
			t.debug("Treemap AST:", i);
			let a = (r = A.parser) == null ? void 0 : r.yy;
			if (!(a instanceof E)) throw Error("parser.parser?.yy was not a TreemapDB. This is due to a bug within Mermaid, please report this issue at https://github.com/mermaid-js/mermaid/issues.");
			O(i, a);
		} catch (e) {
			throw t.error("Error parsing treemap:", e), e;
		}
	}, "parse")
}, j = 10, M = 10, N = 25, P = {
	draw: /* @__PURE__ */ n((e, i, a, o) => {
		var s, c;
		let d = o.db, f = d.getConfig(), p = (s = f.padding) == null ? j : s, m = d.getDiagramTitle(), y = d.getRoot(), { themeVariables: x } = l();
		if (!y) return;
		let w = m ? 30 : 0, T = b(i), E = f.nodeWidth ? f.nodeWidth * M : 960, D = f.nodeHeight ? f.nodeHeight * M : 500, O = E, k = D + w;
		T.attr("viewBox", `0 0 ${O} ${k}`), u(T, k, O, f.useMaxWidth);
		let A;
		try {
			let e = f.valueFormat || ",";
			if (e === "$0,0") A = /* @__PURE__ */ n((e) => "$" + g(",")(e), "valueFormat");
			else if (e.startsWith("$") && e.includes(",")) {
				let t = /\.\d+/.exec(e), r = t ? t[0] : "";
				A = /* @__PURE__ */ n((e) => "$" + g("," + r)(e), "valueFormat");
			} else if (e.startsWith("$")) {
				let t = e.substring(1);
				A = /* @__PURE__ */ n((e) => "$" + g(t || "")(e), "valueFormat");
			} else A = g(e);
		} catch (e) {
			t.error("Error creating format function:", e), A = g(",");
		}
		let P = h().range([
			"transparent",
			x.cScale0,
			x.cScale1,
			x.cScale2,
			x.cScale3,
			x.cScale4,
			x.cScale5,
			x.cScale6,
			x.cScale7,
			x.cScale8,
			x.cScale9,
			x.cScale10,
			x.cScale11
		]), F = h().range([
			"transparent",
			x.cScalePeer0,
			x.cScalePeer1,
			x.cScalePeer2,
			x.cScalePeer3,
			x.cScalePeer4,
			x.cScalePeer5,
			x.cScalePeer6,
			x.cScalePeer7,
			x.cScalePeer8,
			x.cScalePeer9,
			x.cScalePeer10,
			x.cScalePeer11
		]), I = h().range([
			x.cScaleLabel0,
			x.cScaleLabel1,
			x.cScaleLabel2,
			x.cScaleLabel3,
			x.cScaleLabel4,
			x.cScaleLabel5,
			x.cScaleLabel6,
			x.cScaleLabel7,
			x.cScaleLabel8,
			x.cScaleLabel9,
			x.cScaleLabel10,
			x.cScaleLabel11
		]);
		m && T.append("text").attr("x", O / 2).attr("y", w / 2).attr("class", "treemapTitle").attr("text-anchor", "middle").attr("dominant-baseline", "middle").text(m);
		let L = T.append("g").attr("transform", `translate(0, ${w})`).attr("class", "treemapContainer"), R = _(y).sum((e) => {
			var t;
			return (t = e.value) == null ? 0 : t;
		}).sort((e, t) => {
			var n, r;
			return ((n = t.value) == null ? 0 : n) - ((r = e.value) == null ? 0 : r);
		}), z = v().size([E, D]).paddingTop((e) => e.children && e.children.length > 0 ? N + M : 0).paddingInner(p).paddingLeft((e) => e.children && e.children.length > 0 ? M : 0).paddingRight((e) => e.children && e.children.length > 0 ? M : 0).paddingBottom((e) => e.children && e.children.length > 0 ? M : 0).round(!0)(R), B = z.descendants().filter((e) => e.children && e.children.length > 0), V = L.selectAll(".treemapSection").data(B).enter().append("g").attr("class", "treemapSection").attr("transform", (e) => `translate(${e.x0},${e.y0})`);
		V.append("rect").attr("width", (e) => e.x1 - e.x0).attr("height", N).attr("class", "treemapSectionHeader").attr("fill", "none").attr("fill-opacity", .6).attr("stroke-width", .6).attr("style", (e) => e.depth === 0 ? "display: none;" : ""), V.append("clipPath").attr("id", (e, t) => `clip-section-${i}-${t}`).append("rect").attr("width", (e) => Math.max(0, e.x1 - e.x0 - 12)).attr("height", N), V.append("rect").attr("width", (e) => e.x1 - e.x0).attr("height", (e) => e.y1 - e.y0).attr("class", (e, t) => `treemapSection section${t}`).attr("fill", (e) => P(e.data.name)).attr("fill-opacity", .6).attr("stroke", (e) => F(e.data.name)).attr("stroke-width", 2).attr("stroke-opacity", .4).attr("style", (e) => {
			if (e.depth === 0) return "display: none;";
			let t = C({ cssCompiledStyles: e.data.cssCompiledStyles });
			return t.nodeStyles + ";" + t.borderStyles.join(";");
		}), V.append("text").attr("class", "treemapSectionLabel").attr("x", 6).attr("y", N / 2).attr("dominant-baseline", "middle").text((e) => e.depth === 0 ? "" : e.data.name).attr("font-weight", "bold").attr("style", (e) => e.depth === 0 ? "display: none;" : "dominant-baseline: middle; font-size: 12px; fill:" + I(e.data.name) + "; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" + C({ cssCompiledStyles: e.data.cssCompiledStyles }).labelStyles.replace("color:", "fill:")).each(function(e) {
			if (e.depth === 0) return;
			let t = r(this), n = e.data.name;
			t.text(n);
			let i = e.x1 - e.x0, a;
			a = f.showValues !== !1 && e.value ? i - 10 - 30 - 10 - 6 : i - 6 - 6;
			let o = Math.max(15, a), s = t.node();
			if (s.getComputedTextLength() > o) {
				let e = n;
				for (; e.length > 0;) {
					if (e = n.substring(0, e.length - 1), e.length === 0) {
						t.text("..."), s.getComputedTextLength() > o && t.text("");
						break;
					}
					if (t.text(e + "..."), s.getComputedTextLength() <= o) break;
				}
			}
		}), f.showValues !== !1 && V.append("text").attr("class", "treemapSectionValue").attr("x", (e) => e.x1 - e.x0 - 10).attr("y", N / 2).attr("text-anchor", "end").attr("dominant-baseline", "middle").text((e) => e.value ? A(e.value) : "").attr("font-style", "italic").attr("style", (e) => e.depth === 0 ? "display: none;" : "text-anchor: end; dominant-baseline: middle; font-size: 10px; fill:" + I(e.data.name) + "; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" + C({ cssCompiledStyles: e.data.cssCompiledStyles }).labelStyles.replace("color:", "fill:"));
		let H = z.leaves(), U = L.selectAll(".treemapLeafGroup").data(H).enter().append("g").attr("class", (e, t) => `treemapNode treemapLeafGroup leaf${t}${e.data.classSelector ? ` ${e.data.classSelector}` : ""}x`).attr("transform", (e) => `translate(${e.x0},${e.y0})`);
		U.append("rect").attr("width", (e) => e.x1 - e.x0).attr("height", (e) => e.y1 - e.y0).attr("class", "treemapLeaf").attr("fill", (e) => e.parent ? P(e.parent.data.name) : P(e.data.name)).attr("style", (e) => C({ cssCompiledStyles: e.data.cssCompiledStyles }).nodeStyles).attr("fill-opacity", .3).attr("stroke", (e) => e.parent ? P(e.parent.data.name) : P(e.data.name)).attr("stroke-width", 3), U.append("clipPath").attr("id", (e, t) => `clip-${i}-${t}`).append("rect").attr("width", (e) => Math.max(0, e.x1 - e.x0 - 4)).attr("height", (e) => Math.max(0, e.y1 - e.y0 - 4)), U.append("text").attr("class", "treemapLabel").attr("x", (e) => (e.x1 - e.x0) / 2).attr("y", (e) => (e.y1 - e.y0) / 2).attr("style", (e) => "text-anchor: middle; dominant-baseline: middle; font-size: 38px;fill:" + I(e.data.name) + ";" + C({ cssCompiledStyles: e.data.cssCompiledStyles }).labelStyles.replace("color:", "fill:")).attr("clip-path", (e, t) => `url(#clip-${i}-${t})`).text((e) => e.data.name).each(function(e) {
			let t = r(this), n = e.x1 - e.x0, i = e.y1 - e.y0, a = t.node(), o = n - 8, s = i - 8;
			if (o < 10 || s < 10) {
				t.style("display", "none");
				return;
			}
			let c = parseInt(t.style("font-size"), 10), l = .6;
			for (; a.getComputedTextLength() > o && c > 8;) c--, t.style("font-size", `${c}px`);
			let u = Math.max(6, Math.min(28, Math.round(c * l))), d = c + 2 + u;
			for (; d > s && c > 8 && (c--, u = Math.max(6, Math.min(28, Math.round(c * l))), !(u < 6 && c === 8));) t.style("font-size", `${c}px`), d = c + 2 + u;
			t.style("font-size", `${c}px`), (a.getComputedTextLength() > o || c < 8 || s < c) && t.style("display", "none");
		}), f.showValues !== !1 && U.append("text").attr("class", "treemapValue").attr("x", (e) => (e.x1 - e.x0) / 2).attr("y", function(e) {
			return (e.y1 - e.y0) / 2;
		}).attr("style", (e) => "text-anchor: middle; dominant-baseline: hanging; font-size: 28px;fill:" + I(e.data.name) + ";" + C({ cssCompiledStyles: e.data.cssCompiledStyles }).labelStyles.replace("color:", "fill:")).attr("clip-path", (e, t) => `url(#clip-${i}-${t})`).text((e) => e.value ? A(e.value) : "").each(function(e) {
			let t = r(this), n = this.parentNode;
			if (!n) {
				t.style("display", "none");
				return;
			}
			let i = r(n).select(".treemapLabel");
			if (i.empty() || i.style("display") === "none") {
				t.style("display", "none");
				return;
			}
			let a = parseFloat(i.style("font-size")), o = Math.max(6, Math.min(28, Math.round(a * .6)));
			t.style("font-size", `${o}px`);
			let s = (e.y1 - e.y0) / 2 + a / 2 + 2;
			t.attr("y", s);
			let c = e.x1 - e.x0, l = e.y1 - e.y0 - 4, u = c - 8;
			t.node().getComputedTextLength() > u || s + o > l || o < 6 ? t.style("display", "none") : t.style("display", null);
		}), S(T, (c = f.diagramPadding) == null ? 8 : c, "flowchart", (f == null ? void 0 : f.useMaxWidth) || !1);
	}, "draw"),
	getClasses: /* @__PURE__ */ n(function(e, t) {
		return t.db.getClasses();
	}, "getClasses")
}, F = {
	sectionStrokeColor: "black",
	sectionStrokeWidth: "1",
	sectionFillColor: "#efefef",
	leafStrokeColor: "black",
	leafStrokeWidth: "1",
	leafFillColor: "#efefef",
	labelFontSize: "12px",
	valueFontSize: "10px",
	titleFontSize: "14px"
}, I = {
	parser: A,
	get db() {
		return new E();
	},
	renderer: P,
	styles: /* @__PURE__ */ n(({ treemap: e } = {}) => {
		var t, n, r;
		let a = y(i(), l().themeVariables), o = y(F, e), s = (t = o.titleColor) == null ? a.titleColor : t, c = (n = o.labelColor) == null ? a.textColor : n, u = (r = o.valueColor) == null ? a.textColor : r;
		return `
  .treemapNode.section {
    stroke: ${o.sectionStrokeColor};
    stroke-width: ${o.sectionStrokeWidth};
    fill: ${o.sectionFillColor};
  }
  .treemapNode.leaf {
    stroke: ${o.leafStrokeColor};
    stroke-width: ${o.leafStrokeWidth};
    fill: ${o.leafFillColor};
  }
  .treemapLabel {
    fill: ${c};
    font-size: ${o.labelFontSize};
  }
  .treemapValue {
    fill: ${u};
    font-size: ${o.valueFontSize};
  }
  .treemapTitle {
    fill: ${s};
    font-size: ${o.titleFontSize};
  }
  `;
	}, "getStyles")
};
//#endregion
export { I as diagram };
