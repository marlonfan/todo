import { r as e } from "./src-q1mJODQi.mjs";
import { f as t, x as n } from "./chunk-CSCIHK7Q-Bm1gw87X.mjs";
import { p as r } from "./chunk-5ZQYHXKU-cRTMH84-.mjs";
//#region ../../node_modules/.pnpm/mermaid@11.15.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-L5ZTLDWV.mjs
var i = /* @__PURE__ */ e(({ flowchart: e }) => {
	var t, n, r, i;
	let a = (t = e == null || (n = e.subGraphTitleMargin) == null ? void 0 : n.top) == null ? 0 : t, o = (r = e == null || (i = e.subGraphTitleMargin) == null ? void 0 : i.bottom) == null ? 0 : r;
	return {
		subGraphTitleTopMargin: a,
		subGraphTitleBottomMargin: o,
		subGraphTitleTotalMargin: a + o
	};
}, "getSubGraphTitleMargins");
async function a(i, a) {
	let o = i.getElementsByTagName("img");
	if (!o || o.length === 0) return;
	let s = a.replace(/<img[^>]*>/g, "").trim() === "";
	await Promise.all([...o].map((i) => new Promise((a) => {
		function o() {
			if (i.style.display = "flex", i.style.flexDirection = "column", s) {
				let [e = t.fontSize] = r(n().fontSize ? n().fontSize : window.getComputedStyle(document.body).fontSize), a = e * 5 + "px";
				i.style.minWidth = a, i.style.maxWidth = a;
			} else i.style.width = "100%";
			a(i);
		}
		e(o, "setupImage"), setTimeout(() => {
			i.complete && o();
		}), i.addEventListener("error", o), i.addEventListener("load", o);
	})));
}
e(a, "configureLabelImages");
//#endregion
export { i as n, a as t };
