import { t as e } from "./mermaid-parser.core-LeAvxtoi.mjs";
import { i as t, r as n } from "./src-q1mJODQi.mjs";
import { c as r } from "./chunk-CSCIHK7Q-Bm1gw87X.mjs";
import { t as i } from "./chunk-WU5MYG2G-Bix12dNS.mjs";
//#region ../../node_modules/.pnpm/mermaid@11.15.0/node_modules/mermaid/dist/chunks/mermaid.core/infoDiagram-5YYISTIA.mjs
var a = { parse: /* @__PURE__ */ n(async (n) => {
	let r = await e("info", n);
	t.debug(r);
}, "parse") }, o = { version: "11.15.0" }, s = {
	parser: a,
	db: { getVersion: /* @__PURE__ */ n(() => o.version, "getVersion") },
	renderer: { draw: /* @__PURE__ */ n((e, n, a) => {
		t.debug("rendering info diagram\n" + e);
		let o = i(n);
		r(o, 100, 400, !0), o.append("g").append("text").attr("x", 100).attr("y", 40).attr("class", "version").attr("font-size", 32).style("text-anchor", "middle").text(`v${a}`);
	}, "draw") }
};
//#endregion
export { s as diagram };
