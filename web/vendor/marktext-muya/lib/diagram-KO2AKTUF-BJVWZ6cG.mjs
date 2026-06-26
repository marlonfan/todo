import { S as e, t } from "./mermaid-parser.core-LeAvxtoi.mjs";
import { i as n, r, t as i } from "./src-q1mJODQi.mjs";
import { H as a, K as o, U as s, Y as c, a as l, b as u, f as d, v as f, w as p, x as m, y as h, z as g } from "./chunk-CSCIHK7Q-Bm1gw87X.mjs";
import { _, i as ee, t as te } from "./chunk-5ZQYHXKU-cRTMH84-.mjs";
import { t as ne } from "./chunk-4BX2VUAB-CAnGp29N.mjs";
//#region ../../node_modules/.pnpm/mermaid@11.15.0/node_modules/mermaid/dist/chunks/mermaid.core/diagram-KO2AKTUF.mjs
var v = "position frame", y = "frame positioned", b = "position relation", x = "relation positioned", re = /* @__PURE__ */ r(function(e) {
	n.debug("options str", e);
}, "setOptions"), ie = /* @__PURE__ */ r(function() {
	return {};
}, "getOptions"), ae = /* @__PURE__ */ r(function() {
	oe(), l();
}, "clear");
function oe() {
	S = {};
}
r(oe, "reset");
var se = d.eventmodeling, ce = /* @__PURE__ */ r(() => ee({
	...se,
	...u().eventmodeling
}), "getConfig"), S = {};
function C() {
	let e = le, { ast: t } = S, r = E();
	if (!t) throw Error("No data for EventModel");
	return t.frames.forEach((i, a) => {
		let o = N(i, t.dataEntities, r);
		e = q(e, {
			$kind: v,
			index: a,
			frame: i,
			textProps: o
		});
		let s;
		B(i) ? (n.debug("source frame", i.sourceFrames), s = t.frames.filter((e) => i.sourceFrames.some((t) => t.$refText === e.name)), s.forEach((t) => {
			e = q(e, {
				$kind: b,
				index: a,
				frame: i,
				sourceFrame: t
			});
		})) : e = q(e, {
			$kind: b,
			index: a,
			frame: i
		});
	}), e = {
		...e,
		sortedSwimlanesArray: L(e.swimlanes)
	}, e;
}
r(C, "getState");
function w(e) {
	S.ast = e;
}
r(w, "setAst");
var T = {
	swimlaneMinHeight: 70,
	swimlanePadding: 15,
	swimlaneGap: 10,
	boxPadding: 10,
	boxOverlap: 90,
	boxDefaultY: 0,
	boxMinWidth: 80,
	boxMaxWidth: 450,
	boxMinHeight: 80,
	boxMaxHeight: 750,
	contentStartX: 250,
	textMaxWidth: 430,
	boxTextFontWeight: "bold",
	boxTextPadding: 10,
	swimlaneTextFontWeight: "bold",
	labelUiAutomation: "UI/Automation",
	labelUiAutomationPrefix: "UI/A: ",
	labelCommandReadModel: "Command/Read Model",
	labelCommandReadModelPrefix: "C/RM: ",
	labelEvents: "Events",
	labelEventsPrefix: "Stream: "
};
function E() {
	return T;
}
r(E, "getDiagramProps");
var le = {
	boxes: [],
	swimlanes: {},
	relations: [],
	maxR: 0,
	sortedSwimlanesArray: []
};
function D(e) {
	let t = e.split(".");
	if (t.length === 2) return t[0];
}
r(D, "extractNamespace");
function O(e) {
	let t = e.split(".");
	return t.length === 2 ? t[1] : e;
}
r(O, "extractName");
function k(e, t) {
	if (!(!t || t.length === 0)) return Object.values(e).find((e) => e.namespace === t);
}
r(k, "findSwimlaneByNamespace");
function A(e, t, n) {
	return Math.max(t, ...Object.keys(e).filter((e) => {
		let r = Number.parseInt(e);
		return r > t && r < n;
	}).map((e) => Number.parseInt(e))) + 1;
}
r(A, "findNextAvailableIndex");
function j(e, t) {
	let n = D(e.entityIdentifier), r = k(t, n);
	switch (e.modelEntityType) {
		case "ui":
		case "pcr":
		case "processor": return r ? {
			index: r.index,
			label: r.namespace || T.labelUiAutomation
		} : n ? {
			index: A(t, 0, 100),
			label: T.labelUiAutomationPrefix + n
		} : {
			index: 0,
			label: T.labelUiAutomation
		};
		case "rmo":
		case "readmodel":
		case "cmd":
		case "command": return r ? {
			index: r.index,
			label: r.namespace || T.labelCommandReadModel
		} : n ? {
			index: A(t, 100, 200),
			label: T.labelCommandReadModelPrefix + n
		} : {
			index: 100,
			label: T.labelCommandReadModel
		};
		default: return r ? {
			index: r.index,
			label: r.namespace || T.labelEvents
		} : n ? {
			index: A(t, 200, 300),
			label: T.labelEventsPrefix + n
		} : {
			index: 200,
			label: T.labelEvents
		};
	}
}
r(j, "calculateSwimlaneProps");
function M(e) {
	let { themeVariables: t } = u();
	switch (e.modelEntityType) {
		case "ui":
			var n, r;
			return {
				fill: (n = t.emUiFill) == null ? "white" : n,
				stroke: (r = t.emUiStroke) == null ? "#dbdada" : r
			};
		case "pcr":
		case "processor":
			var i, a;
			return {
				fill: (i = t.emProcessorFill) == null ? "#edb3f6" : i,
				stroke: (a = t.emProcessorStroke) == null ? "#b88cbf" : a
			};
		case "rmo":
		case "readmodel":
			var o, s;
			return {
				fill: (o = t.emReadModelFill) == null ? "#d3f1a2" : o,
				stroke: (s = t.emReadModelStroke) == null ? "#a3b732" : s
			};
		case "cmd":
		case "command":
			var c, l;
			return {
				fill: (c = t.emCommandFill) == null ? "#bcd6fe" : c,
				stroke: (l = t.emCommandStroke) == null ? "#679ac3" : l
			};
		case "evt":
		case "event":
			var d, f;
			return {
				fill: (d = t.emEventFill) == null ? "#ffb778" : d,
				stroke: (f = t.emEventStroke) == null ? "#c19a0f" : f
			};
		default: return {
			fill: "red",
			stroke: "black"
		};
	}
}
r(M, "calculateEntityVisualProps");
function N(e, t, r) {
	var i;
	let a = u(), o = g((i = O(e.entityIdentifier)) == null ? "" : i, a), s, c = {
		fontSize: 16,
		fontWeight: 700,
		fontFamily: "\"trebuchet ms\", verdana, arial, sans-serif",
		joinWith: "<br/>"
	}, l = `<b>${_(o, r.textMaxWidth, c)}</b>`;
	if (e.dataInlineValue && (s = e.dataInlineValue, s = s.substring(s.indexOf("{") + 1), s = s.substring(0, s.lastIndexOf("}") - 1), s = g(s, a), s = _(s, r.textMaxWidth, c), s = s.replaceAll(" ", "&nbsp;")), e.dataReference) {
		let n = t.find((t) => {
			var n;
			return t.name === ((n = e.dataReference) == null ? void 0 : n.$refText);
		});
		n && (s = n.dataBlockValue, s = s.substring(s.indexOf("{\n") + 2), s = s.substring(0, s.lastIndexOf("}") - 1), s = g(s, a), s = _(s, r.textMaxWidth, c), s = s.replaceAll(" ", "&nbsp;"), s += "<br/>");
	}
	let d = s !== void 0;
	d && (l += `<br/><br/><code style="text-align: left; display: block;max-width:${r.textMaxWidth}px">${s}</code>`);
	let f = {
		fontSize: c.fontSize,
		fontWeight: c.fontWeight,
		fontFamily: c.fontFamily
	}, p = te(l, f), m = d ? p.width / 3 : p.width, h = {
		content: l,
		width: m,
		height: p.height
	};
	return n.debug(`[${e.name}] ${e.entityIdentifier} text`, h), h;
}
r(N, "calculateTextProps");
function P(e, t) {
	let n = t, r = M(n.frame), i = {
		width: n.textProps.width + 2 * T.boxTextPadding,
		height: n.textProps.height + 2 * T.boxTextPadding
	};
	return [{
		$kind: y,
		frame: n.frame,
		index: n.index,
		visual: r,
		dimension: i,
		textProps: n.textProps
	}];
}
r(P, "decidePositionFrame");
function F(e, t, n) {
	return t === void 0 ? T.contentStartX : t.index === e.index && e.r ? e.r + T.boxPadding : n === void 0 ? T.contentStartX : n.r - T.boxOverlap + T.boxPadding;
}
r(F, "calculateX");
function I(e, t) {
	let n = [...e.map((e) => e.r), t];
	return Math.max(...n);
}
r(I, "calculateMaxRight");
function L(e) {
	return Object.values(e).sort((e, t) => e.index - t.index);
}
r(L, "sortedSwimlanesArray");
function R(e, t) {
	let n = t, r = j(n.frame, e.swimlanes), i;
	i = r.index in e.swimlanes ? e.swimlanes[r.index] : {
		index: r.index,
		label: r.label,
		r: 0,
		y: r.index * T.swimlaneMinHeight + T.swimlaneGap,
		height: T.swimlaneMinHeight,
		maxHeight: T.swimlaneMinHeight
	};
	let a = e.boxes.length > 0 ? e.boxes[e.boxes.length - 1] : void 0, o = e.previousSwimlaneNumber === void 0 ? void 0 : e.swimlanes[e.previousSwimlaneNumber], s = {
		width: Math.max(T.boxMinWidth, Math.min(T.boxMaxWidth, n.dimension.width)) + 2 * T.boxPadding,
		height: Math.max(T.boxMinHeight, Math.min(T.boxMaxHeight, n.dimension.height)) + 2 * T.boxPadding
	}, c = F(i, o, a), l = c + s.width + T.boxPadding, u = I(Object.values(e.swimlanes), l);
	i.r = c + s.width, i.maxHeight = Math.max(i.maxHeight, s.height), i.height = Math.max(T.swimlaneMinHeight, i.maxHeight) + 2 * T.swimlanePadding;
	let d = {
		x: c,
		y: T.swimlanePadding + i.y,
		r: l,
		dimension: s,
		leftSibling: !1,
		swimlane: i,
		visual: n.visual,
		text: n.textProps.content,
		frame: n.frame,
		index: n.index
	}, f = {
		...e,
		boxes: [...e.boxes, d],
		swimlanes: {
			...e.swimlanes,
			[`${i.index}`]: i
		},
		previousSwimlaneNumber: r.index,
		previousFrame: n.frame,
		maxR: u
	}, p = L(f.swimlanes);
	p.length > 0 && (p[0].y = 0);
	for (let e = 1; e < p.length; e++) {
		let t = p[e], n = p[e - 1];
		t.y = n.y + n.height + T.swimlaneGap;
	}
	return f;
}
r(R, "evolveFramePositioned");
function z(e, t) {
	return e === 0 && t.sourceFrames.length === 0;
}
r(z, "isFirstFrame");
function B(e) {
	return e.sourceFrames !== void 0 && e.sourceFrames !== null && e.sourceFrames.length > 0;
}
r(B, "hasSourceFrame");
function V(e, t) {
	if (t != null) return e.find((e) => e.frame.name === t.name);
}
r(V, "findBoxByFrame");
function H(e, t, n) {
	if (!(n < 0)) for (let r = n; r >= 0; r--) {
		let n = e[r];
		if (n.swimlane.index !== t) return n;
	}
}
r(H, "findBoxByLineIndex");
function U(t, n) {
	let r = n;
	if (e(r.frame) || z(r.index, r.frame)) return [];
	let i = V(t.boxes, r.frame);
	if (i === void 0) throw Error(`Target box not found for frame ${r.frame.name}`);
	let a;
	return a = r.sourceFrame ? V(t.boxes, r.sourceFrame) : H(t.boxes, i.swimlane.index, r.index - 1), a === void 0 ? [] : [{
		$kind: x,
		frame: r.frame,
		index: r.index,
		sourceBox: a,
		targetBox: i
	}];
}
r(U, "decidePositionRelation");
function W(e, t) {
	let n = t, r = {
		visual: {
			fill: "none",
			stroke: "#000"
		},
		source: {
			x: n.sourceBox.x,
			y: n.sourceBox.y
		},
		target: {
			x: n.targetBox.x,
			y: n.targetBox.y
		},
		sourceBox: n.sourceBox,
		targetBox: n.targetBox
	};
	return {
		...e,
		relations: [...e.relations, r]
	};
}
r(W, "evolveRelationPositioned");
var ue = {
	[v]: P,
	[b]: U
}, de = {
	[y]: R,
	[x]: W
};
function G(e, t) {
	let r = ue[t.$kind];
	if (r == null) return [];
	let i = r(e, t);
	return n.debug("decided events", i), i;
}
r(G, "decide");
function K(e, t) {
	let r = t.reduce((e, t) => {
		let n = de[t.$kind];
		return n == null ? e : n(e, t);
	}, e);
	return n.debug("evolve events", {
		state: e,
		newState: r,
		events: t
	}), r;
}
r(K, "evolve");
function q(e, t) {
	return K(e, G(e, t));
}
r(q, "dispatch");
var J = {
	getConfig: ce,
	setOptions: re,
	getOptions: ie,
	clear: ae,
	setAccTitle: s,
	getAccTitle: h,
	getAccDescription: f,
	setAccDescription: a,
	setDiagramTitle: o,
	getDiagramTitle: p,
	setAst: w,
	getDiagramProps: E,
	getState: C
}, fe = { parse: /* @__PURE__ */ r(async (e) => {
	let r = await t("eventmodeling", e);
	n.debug(r), J.setAst(r), ne(r, J);
}, "parse") }, Y = m(), pe = Y == null ? void 0 : Y.eventmodeling;
function X(e, t) {
	return (n) => {
		let r = n.swimlane.y + t.swimlanePadding, i = e.append("g").attr("class", "em-box");
		i.append("rect").attr("x", n.x).attr("y", r).attr("rx", "3").attr("width", n.dimension.width).attr("height", n.dimension.height).attr("stroke", n.visual.stroke).attr("fill", n.visual.fill), i.append("foreignObject").attr("x", n.x + t.boxPadding).attr("y", r + 10).attr("width", n.dimension.width - 2 * t.boxPadding).attr("height", n.dimension.height - 2 * t.boxPadding).append("xhtml:div").style("display", "table").style("height", "100%").style("width", "100%").append("span").style("display", "table-cell").style("text-align", "center").style("vertical-align", "middle").html(n.text);
	};
}
r(X, "renderD3Box");
function Z(e, t) {
	return e > t;
}
r(Z, "dirUpwards");
function Q(e, t, r, i) {
	return (a) => {
		var o;
		let s = a.sourceBox.swimlane.y + t.swimlanePadding, c = a.targetBox.swimlane.y + t.swimlanePadding, l = Z(s, c), u = a.sourceBox.x + a.sourceBox.dimension.width * 2 / 3, d = a.targetBox.x + a.targetBox.dimension.width / 3, f, p;
		n.debug(`rendering relation up=${l} for `, {
			sourceBox: a.sourceBox,
			targetBox: a.targetBox
		}), l ? (f = s, p = c + a.targetBox.dimension.height) : (f = s + a.sourceBox.dimension.height, p = c);
		let m = (o = i.emRelationStroke) == null ? a.visual.stroke : o;
		e.append("path").attr("class", "em-relation").attr("fill", a.visual.fill).attr("stroke", m).attr("stroke-width", "1").attr("marker-end", `url(#${r})`).attr("d", `M${u} ${f} L${d} ${p}`);
	};
}
r(Q, "renderD3Relation");
function $(e, t, n, r) {
	return (i) => {
		var a, o;
		let s = e.append("g").attr("class", "em-swimlane"), c = (a = r.emSwimlaneBackgroundOdd) == null ? "rgb(250,250,250)" : a, l = (o = r.emSwimlaneBackgroundStroke) == null ? "rgb(240,240,240)" : o;
		s.append("rect").attr("x", 0).attr("y", i.y).attr("rx", "3").attr("width", t + n.swimlanePadding).attr("height", i.height).attr("fill", c).attr("stroke", l), s.append("text").attr("font-weight", n.swimlaneTextFontWeight).attr("x", 30).attr("y", i.y + 30).text(i.label);
	};
}
r($, "renderD3Swimlane");
var me = {
	parser: fe,
	db: J,
	renderer: { draw: /* @__PURE__ */ r(function(e, t, r, a) {
		var o, s;
		if (n.debug("in eventmodeling renderer", e + "\n", "id:", t, r), !pe) throw Error("EventModeling config not found");
		let l = a.db, { themeVariables: u, eventmodeling: d } = m(), f = i(`[id="${t}"]`), p = l.getDiagramProps(), h = l.getState(), g = `em-arrowhead-${t}`, _ = (o = u.emArrowhead) == null ? "#000000" : o;
		h.sortedSwimlanesArray.forEach($(f, h.maxR, p, u)), h.boxes.forEach(X(f, p)), h.relations.forEach(Q(f, p, g, u)), f.append("defs").append("marker").attr("id", g).attr("markerWidth", "10").attr("markerHeight", "7").attr("refX", "10").attr("refY", "3.5").attr("orient", "auto").append("polygon").attr("points", "0 0, 10 3.5, 0 7").attr("fill", _), c(void 0, f, (s = d == null ? void 0 : d.padding) == null ? 30 : s, d == null ? void 0 : d.useMaxWidth);
	}, "draw") },
	styles: /* @__PURE__ */ r((e) => "", "getStyles")
};
//#endregion
export { me as diagram };
