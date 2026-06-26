import { r as e } from "./src-q1mJODQi.mjs";
import { x as t } from "./chunk-CSCIHK7Q-Bm1gw87X.mjs";
//#region ../../node_modules/.pnpm/mermaid@11.15.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-NZK2D7GU.mjs
var n = /* @__PURE__ */ e((e) => {
	let { handDrawnSeed: n } = t();
	return {
		fill: e,
		hachureAngle: 120,
		hachureGap: 4,
		fillWeight: 2,
		roughness: .7,
		stroke: e,
		seed: n
	};
}, "solidStateFill"), r = /* @__PURE__ */ e((e) => {
	let t = i([
		...e.cssCompiledStyles || [],
		...e.cssStyles || [],
		...e.labelStyle || []
	]);
	return {
		stylesMap: t,
		stylesArray: [...t]
	};
}, "compileStyles"), i = /* @__PURE__ */ e((e) => {
	let t = /* @__PURE__ */ new Map();
	return e.forEach((e) => {
		let [n, r] = e.split(":");
		t.set(n.trim(), r == null ? void 0 : r.trim());
	}), t;
}, "styles2Map"), a = /* @__PURE__ */ e((e) => e === "color" || e === "font-size" || e === "font-family" || e === "font-weight" || e === "font-style" || e === "text-decoration" || e === "text-align" || e === "text-transform" || e === "line-height" || e === "letter-spacing" || e === "word-spacing" || e === "text-shadow" || e === "text-overflow" || e === "white-space" || e === "word-wrap" || e === "word-break" || e === "overflow-wrap" || e === "hyphens", "isLabelStyle"), o = /* @__PURE__ */ e((e) => {
	let { stylesArray: t } = r(e), n = [], i = [], o = [], s = [];
	return t.forEach((e) => {
		let t = e[0];
		a(t) ? n.push(e.join(":") + " !important") : (i.push(e.join(":") + " !important"), t.includes("stroke") && o.push(e.join(":") + " !important"), t === "fill" && s.push(e.join(":") + " !important"));
	}), {
		labelStyles: n.join(";"),
		nodeStyles: i.join(";"),
		stylesArray: t,
		borderStyles: o,
		backgroundStyles: s
	};
}, "styles2String"), s = /* @__PURE__ */ e((e, n) => {
	var i;
	let { themeVariables: a, handDrawnSeed: o } = t(), { nodeBorder: s, mainBkg: l } = a, { stylesMap: u } = r(e);
	return Object.assign({
		roughness: .7,
		fill: u.get("fill") || l,
		fillStyle: "hachure",
		fillWeight: 4,
		hachureGap: 5.2,
		stroke: u.get("stroke") || s,
		seed: o,
		strokeWidth: ((i = u.get("stroke-width")) == null ? void 0 : i.replace("px", "")) || 1.3,
		fillLineDash: [0, 0],
		strokeLineDash: c(u.get("stroke-dasharray"))
	}, n);
}, "userNodeOverrides"), c = /* @__PURE__ */ e((e) => {
	if (!e) return [0, 0];
	let t = e.trim().split(/\s+/).map(Number);
	if (t.length === 1) {
		let e = isNaN(t[0]) ? 0 : t[0];
		return [e, e];
	}
	return [isNaN(t[0]) ? 0 : t[0], isNaN(t[1]) ? 0 : t[1]];
}, "getStrokeDashArray");
//#endregion
export { s as a, o as i, a as n, n as r, r as t };
