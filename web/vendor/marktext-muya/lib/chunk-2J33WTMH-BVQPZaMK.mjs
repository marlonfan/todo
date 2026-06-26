import { i as e, r as t } from "./src-q1mJODQi.mjs";
import { c as n } from "./chunk-CSCIHK7Q-Bm1gw87X.mjs";
//#region ../../node_modules/.pnpm/mermaid@11.15.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-2J33WTMH.mjs
var r = /* @__PURE__ */ t((t, r, o, s) => {
	t.attr("class", o);
	let { width: c, height: l, x: u, y: d } = i(t, r);
	n(t, l, c, s);
	let f = a(u, d, c, l, r);
	t.attr("viewBox", f), e.debug(`viewBox configured: ${f} with padding: ${r}`);
}, "setupViewPortForSVG"), i = /* @__PURE__ */ t((e, t) => {
	var n;
	let r = ((n = e.node()) == null ? void 0 : n.getBBox()) || {
		width: 0,
		height: 0,
		x: 0,
		y: 0
	};
	return {
		width: r.width + t * 2,
		height: r.height + t * 2,
		x: r.x,
		y: r.y
	};
}, "calculateDimensionsWithPadding"), a = /* @__PURE__ */ t((e, t, n, r, i) => `${e - i} ${t - i} ${n} ${r}`, "createViewBox");
//#endregion
export { r as t };
