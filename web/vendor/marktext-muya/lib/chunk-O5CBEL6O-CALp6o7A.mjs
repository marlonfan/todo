import { n as e } from "./marked.esm-CfbyM8ul.mjs";
import { i as t, r as n, t as r } from "./src-q1mJODQi.mjs";
import { A as i, F as a, b as o, s, z as c } from "./chunk-CSCIHK7Q-Bm1gw87X.mjs";
import { a as l } from "./chunk-5ZQYHXKU-cRTMH84-.mjs";
//#region ../../node_modules/.pnpm/@iconify+utils@3.0.2/node_modules/@iconify/utils/lib/icon/defaults.js
var u = Object.freeze({
	left: 0,
	top: 0,
	width: 16,
	height: 16
}), d = Object.freeze({
	rotate: 0,
	vFlip: !1,
	hFlip: !1
}), f = Object.freeze({
	...u,
	...d
}), p = Object.freeze({
	...f,
	body: "",
	hidden: !1
}), m = Object.freeze({
	width: null,
	height: null
}), h = Object.freeze({
	...m,
	...d
}), g = (e, t, n, r = "") => {
	let i = e.split(":");
	if (e.slice(0, 1) === "@") {
		if (i.length < 2 || i.length > 3) return null;
		r = i.shift().slice(1);
	}
	if (i.length > 3 || !i.length) return null;
	if (i.length > 1) {
		let e = i.pop(), n = i.pop(), a = {
			provider: i.length > 0 ? i[0] : r,
			prefix: n,
			name: e
		};
		return t && !_(a) ? null : a;
	}
	let a = i[0], o = a.split("-");
	if (o.length > 1) {
		let e = {
			provider: r,
			prefix: o.shift(),
			name: o.join("-")
		};
		return t && !_(e) ? null : e;
	}
	if (n && r === "") {
		let e = {
			provider: r,
			prefix: "",
			name: a
		};
		return t && !_(e, n) ? null : e;
	}
	return null;
}, _ = (e, t) => e ? !!((t && e.prefix === "" || e.prefix) && e.name) : !1;
//#endregion
//#region ../../node_modules/.pnpm/@iconify+utils@3.0.2/node_modules/@iconify/utils/lib/icon/transformations.js
function v(e, t) {
	let n = {};
	!e.hFlip != !t.hFlip && (n.hFlip = !0), !e.vFlip != !t.vFlip && (n.vFlip = !0);
	let r = ((e.rotate || 0) + (t.rotate || 0)) % 4;
	return r && (n.rotate = r), n;
}
//#endregion
//#region ../../node_modules/.pnpm/@iconify+utils@3.0.2/node_modules/@iconify/utils/lib/icon/merge.js
function y(e, t) {
	let n = v(e, t);
	for (let r in p) r in d ? r in e && !(r in n) && (n[r] = d[r]) : r in t ? n[r] = t[r] : r in e && (n[r] = e[r]);
	return n;
}
//#endregion
//#region ../../node_modules/.pnpm/@iconify+utils@3.0.2/node_modules/@iconify/utils/lib/icon-set/tree.js
function b(e, t) {
	let n = e.icons, r = e.aliases || Object.create(null), i = Object.create(null);
	function a(e) {
		if (n[e]) return i[e] = [];
		if (!(e in i)) {
			i[e] = null;
			let t = r[e] && r[e].parent, n = t && a(t);
			n && (i[e] = [t].concat(n));
		}
		return i[e];
	}
	return (t || Object.keys(n).concat(Object.keys(r))).forEach(a), i;
}
//#endregion
//#region ../../node_modules/.pnpm/@iconify+utils@3.0.2/node_modules/@iconify/utils/lib/icon-set/get-icon.js
function x(e, t, n) {
	let r = e.icons, i = e.aliases || Object.create(null), a = {};
	function o(e) {
		a = y(r[e] || i[e], a);
	}
	return o(t), n.forEach(o), y(e, a);
}
function ee(e, t) {
	if (e.icons[t]) return x(e, t, []);
	let n = b(e, [t])[t];
	return n ? x(e, t, n) : null;
}
//#endregion
//#region ../../node_modules/.pnpm/@iconify+utils@3.0.2/node_modules/@iconify/utils/lib/svg/size.js
var te = /(-?[0-9.]*[0-9]+[0-9.]*)/g, ne = /^-?[0-9.]*[0-9]+[0-9.]*$/g;
function S(e, t, n) {
	if (t === 1) return e;
	if (n = n || 100, typeof e == "number") return Math.ceil(e * t * n) / n;
	if (typeof e != "string") return e;
	let r = e.split(te);
	if (r === null || !r.length) return e;
	let i = [], a = r.shift(), o = ne.test(a);
	for (;;) {
		if (o) {
			let e = parseFloat(a);
			isNaN(e) ? i.push(a) : i.push(Math.ceil(e * t * n) / n);
		} else i.push(a);
		if (a = r.shift(), a === void 0) return i.join("");
		o = !o;
	}
}
//#endregion
//#region ../../node_modules/.pnpm/@iconify+utils@3.0.2/node_modules/@iconify/utils/lib/svg/defs.js
function re(e, t = "defs") {
	let n = "", r = e.indexOf("<" + t);
	for (; r >= 0;) {
		let i = e.indexOf(">", r), a = e.indexOf("</" + t);
		if (i === -1 || a === -1) break;
		let o = e.indexOf(">", a);
		if (o === -1) break;
		n += e.slice(i + 1, a).trim(), e = e.slice(0, r).trim() + e.slice(o + 1);
	}
	return {
		defs: n,
		content: e
	};
}
function C(e, t) {
	return e ? "<defs>" + e + "</defs>" + t : t;
}
function ie(e, t, n) {
	let r = re(e);
	return C(r.defs, t + r.content + n);
}
//#endregion
//#region ../../node_modules/.pnpm/@iconify+utils@3.0.2/node_modules/@iconify/utils/lib/svg/build.js
var ae = (e) => e === "unset" || e === "undefined" || e === "none";
function w(e, t) {
	let n = {
		...f,
		...e
	}, r = {
		...h,
		...t
	}, i = {
		left: n.left,
		top: n.top,
		width: n.width,
		height: n.height
	}, a = n.body;
	[n, r].forEach((e) => {
		let t = [], n = e.hFlip, r = e.vFlip, o = e.rotate;
		n ? r ? o += 2 : (t.push("translate(" + (i.width + i.left).toString() + " " + (0 - i.top).toString() + ")"), t.push("scale(-1 1)"), i.top = i.left = 0) : r && (t.push("translate(" + (0 - i.left).toString() + " " + (i.height + i.top).toString() + ")"), t.push("scale(1 -1)"), i.top = i.left = 0);
		let s;
		switch (o < 0 && (o -= Math.floor(o / 4) * 4), o %= 4, o) {
			case 1:
				s = i.height / 2 + i.top, t.unshift("rotate(90 " + s.toString() + " " + s.toString() + ")");
				break;
			case 2:
				t.unshift("rotate(180 " + (i.width / 2 + i.left).toString() + " " + (i.height / 2 + i.top).toString() + ")");
				break;
			case 3:
				s = i.width / 2 + i.left, t.unshift("rotate(-90 " + s.toString() + " " + s.toString() + ")");
				break;
		}
		o % 2 == 1 && (i.left !== i.top && (s = i.left, i.left = i.top, i.top = s), i.width !== i.height && (s = i.width, i.width = i.height, i.height = s)), t.length && (a = ie(a, "<g transform=\"" + t.join(" ") + "\">", "</g>"));
	});
	let o = r.width, s = r.height, c = i.width, l = i.height, u, d;
	o === null ? (d = s === null ? "1em" : s === "auto" ? l : s, u = S(d, c / l)) : (u = o === "auto" ? c : o, d = s === null ? S(u, l / c) : s === "auto" ? l : s);
	let p = {}, m = (e, t) => {
		ae(t) || (p[e] = t.toString());
	};
	m("width", u), m("height", d);
	let g = [
		i.left,
		i.top,
		c,
		l
	];
	return p.viewBox = g.join(" "), {
		attributes: p,
		viewBox: g,
		body: a
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@iconify+utils@3.0.2/node_modules/@iconify/utils/lib/svg/id.js
var T = /\sid="(\S+)"/g, oe = "IconifyId" + Date.now().toString(16) + (Math.random() * 16777216 | 0).toString(16), se = 0;
function ce(e, t = oe) {
	let n = [], r;
	for (; r = T.exec(e);) n.push(r[1]);
	if (!n.length) return e;
	let i = "suffix" + (Math.random() * 16777216 | Date.now()).toString(16);
	return n.forEach((n) => {
		let r = typeof t == "function" ? t(n) : t + (se++).toString(), a = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		e = e.replace(RegExp("([#;\"])(" + a + ")([\")]|\\.[a-z])", "g"), "$1" + r + i + "$3");
	}), e = e.replace(new RegExp(i, "g"), ""), e;
}
//#endregion
//#region ../../node_modules/.pnpm/@iconify+utils@3.0.2/node_modules/@iconify/utils/lib/svg/html.js
function le(e, t) {
	let n = e.indexOf("xlink:") === -1 ? "" : " xmlns:xlink=\"http://www.w3.org/1999/xlink\"";
	for (let e in t) n += " " + e + "=\"" + t[e] + "\"";
	return "<svg xmlns=\"http://www.w3.org/2000/svg\"" + n + ">" + e + "</svg>";
}
//#endregion
//#region ../../node_modules/.pnpm/ts-dedent@2.2.0/node_modules/ts-dedent/esm/index.js
function E(e) {
	var t = [...arguments].slice(1), n = Array.from(typeof e == "string" ? [e] : e);
	n[n.length - 1] = n[n.length - 1].replace(/\r?\n([\t ]*)$/, "");
	var r = n.reduce(function(e, t) {
		var n = t.match(/\n([\t ]+|(?!\s).)/g);
		return n ? e.concat(n.map(function(e) {
			var t, n;
			return (n = (t = e.match(/[\t ]/g)) == null ? void 0 : t.length) == null ? 0 : n;
		})) : e;
	}, []);
	if (r.length) {
		var i = RegExp("\n[	 ]{" + Math.min.apply(Math, r) + "}", "g");
		n = n.map(function(e) {
			return e.replace(i, "\n");
		});
	}
	n[0] = n[0].replace(/^\r?\n/, "");
	var a = n[0];
	return t.forEach(function(e, t) {
		var r = a.match(/(?:^|\n)( *)$/), i = r ? r[1] : "", o = e;
		typeof e == "string" && e.includes("\n") && (o = String(e).split("\n").map(function(e, t) {
			return t === 0 ? e : "" + i + e;
		}).join("\n")), a += o + n[t + 1];
	}), a;
}
//#endregion
//#region ../../node_modules/.pnpm/mermaid@11.15.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-O5CBEL6O.mjs
var D = {
	body: "<g><rect width=\"80\" height=\"80\" style=\"fill: #087ebf; stroke-width: 0px;\"/><text transform=\"translate(21.16 64.67)\" style=\"fill: #fff; font-family: ArialMT, Arial; font-size: 67.75px;\"><tspan x=\"0\" y=\"0\">?</tspan></text></g>",
	height: 80,
	width: 80
}, O = /* @__PURE__ */ new Map(), k = /* @__PURE__ */ new Map(), A = /* @__PURE__ */ n((e) => {
	for (let n of e) {
		if (!n.name) throw Error("Invalid icon loader. Must have a \"name\" property with non-empty string value.");
		if (t.debug("Registering icon pack:", n.name), "loader" in n) k.set(n.name, n.loader);
		else if ("icons" in n) O.set(n.name, n.icons);
		else throw t.error("Invalid icon loader:", n), Error("Invalid icon loader. Must have either \"icons\" or \"loader\" property.");
	}
}, "registerIconPacks"), j = /* @__PURE__ */ n(async (e, n) => {
	let r = g(e, !0, n !== void 0);
	if (!r) throw Error(`Invalid icon name: ${e}`);
	let i = r.prefix || n;
	if (!i) throw Error(`Icon name must contain a prefix: ${e}`);
	let a = O.get(i);
	if (!a) {
		let e = k.get(i);
		if (!e) throw Error(`Icon set not found: ${r.prefix}`);
		try {
			a = {
				...await e(),
				prefix: i
			}, O.set(i, a);
		} catch (e) {
			throw t.error(e), Error(`Failed to load icon set: ${r.prefix}`);
		}
	}
	let o = ee(a, r.name);
	if (!o) throw Error(`Icon not found: ${e}`);
	return o;
}, "getRegisteredIconData"), M = /* @__PURE__ */ n(async (e) => {
	try {
		return await j(e), !0;
	} catch {
		return !1;
	}
}, "isIconAvailable"), N = /* @__PURE__ */ n(async (e, n, r) => {
	let i;
	try {
		i = await j(e, n == null ? void 0 : n.fallbackPrefix);
	} catch (e) {
		t.error(e), i = D;
	}
	let a = w(i, n);
	return c(le(ce(a.body), {
		...a.attributes,
		...r
	}), o());
}, "getIconSVG");
function P(e, { markdownAutoWrap: t }) {
	return E(e.replace(/<br\/>/g, "\n").replace(/\n{2,}/g, "\n"));
}
n(P, "preprocessMarkdown");
function F(e) {
	return e.split(/\\n|\n|<br\s*\/?>/gi).map((e) => {
		var t, n;
		return (t = (n = e.trim().match(/<[^>]+>|[^\s<>]+/g)) == null ? void 0 : n.map((e) => ({
			content: e,
			type: "normal"
		}))) == null ? [] : t;
	});
}
n(F, "nonMarkdownToLines");
function I(t, r = {}) {
	let i = P(t, r), a = e.lexer(i), o = [[]], s = 0;
	function c(e, t = "normal") {
		e.type === "text" ? e.text.split("\n").forEach((e, n) => {
			n !== 0 && (s++, o.push([])), e.split(" ").forEach((e) => {
				e = e.replace(/&#39;/g, "'"), e && o[s].push({
					content: e,
					type: t
				});
			});
		}) : e.type === "strong" || e.type === "em" ? e.tokens.forEach((t) => {
			c(t, e.type);
		}) : e.type === "html" && o[s].push({
			content: e.text,
			type: "normal"
		});
	}
	return n(c, "processNode"), a.forEach((e) => {
		if (e.type === "paragraph") {
			var t;
			(t = e.tokens) == null || t.forEach((e) => {
				c(e);
			});
		} else e.type === "html" ? o[s].push({
			content: e.text,
			type: "normal"
		}) : o[s].push({
			content: e.raw,
			type: "normal"
		});
	}), o;
}
n(I, "markdownToLines");
function L(e) {
	return e ? `<p>${e.replace(/\\n|\n/g, "<br />")}</p>` : "";
}
n(L, "nonMarkdownToHTML");
function R(r, { markdownAutoWrap: i } = {}) {
	let a = e.lexer(r);
	function o(e) {
		if (e.type === "text") return i === !1 ? e.text.replace(/\n */g, "<br/>").replace(/ /g, "&nbsp;") : e.text.replace(/\n */g, "<br/>");
		if (e.type === "strong") {
			var n;
			return `<strong>${(n = e.tokens) == null ? void 0 : n.map(o).join("")}</strong>`;
		} else if (e.type === "em") {
			var r;
			return `<em>${(r = e.tokens) == null ? void 0 : r.map(o).join("")}</em>`;
		} else if (e.type === "paragraph") {
			var a;
			return `<p>${(a = e.tokens) == null ? void 0 : a.map(o).join("")}</p>`;
		} else if (e.type === "space") return "";
		else if (e.type === "html") return `${e.text}`;
		else if (e.type === "escape") return e.text;
		return t.warn(`Unsupported markdown: ${e.type}`), e.raw;
	}
	return n(o, "output"), a.map(o).join("");
}
n(R, "markdownToHTML");
function z(e) {
	return Intl.Segmenter ? [...new Intl.Segmenter().segment(e)].map((e) => e.segment) : [...e];
}
n(z, "splitTextToChars");
function B(e, t) {
	return V(e, [], z(t.content), t.type);
}
n(B, "splitWordToFitWidth");
function V(e, t, n, r) {
	if (n.length === 0) return [{
		content: t.join(""),
		type: r
	}, {
		content: "",
		type: r
	}];
	let [i, ...a] = n, o = [...t, i];
	return e([{
		content: o.join(""),
		type: r
	}]) ? V(e, o, a, r) : (t.length === 0 && i && (t.push(i), n.shift()), [{
		content: t.join(""),
		type: r
	}, {
		content: n.join(""),
		type: r
	}]);
}
n(V, "splitWordToFitWidthRecursion");
function H(e, t) {
	if (e.some(({ content: e }) => e.includes("\n"))) throw Error("splitLineToFitWidth does not support newlines in the line");
	return U(e, t);
}
n(H, "splitLineToFitWidth");
function U(e, t, n = [], r = []) {
	var i;
	if (e.length === 0) return r.length > 0 && n.push(r), n.length > 0 ? n : [];
	let a = "";
	e[0].content === " " && (a = " ", e.shift());
	let o = (i = e.shift()) == null ? {
		content: " ",
		type: "normal"
	} : i, s = [...r];
	if (a !== "" && s.push({
		content: a,
		type: "normal"
	}), s.push(o), t(s)) return U(e, t, n, s);
	if (r.length > 0) n.push(r), e.unshift(o);
	else if (o.content) {
		let [r, i] = B(t, o);
		n.push([r]), i.content && e.unshift(i);
	}
	return U(e, t, n);
}
n(U, "splitLineToFitWidthRecursion");
function W(e, t) {
	t && e.attr("style", t);
}
n(W, "applyStyle");
var G = 16384;
async function K(e, t, n, r, l = !1, u = o()) {
	let d = e.append("foreignObject");
	d.attr("width", `${Math.min(10 * n, G)}px`), d.attr("height", `${Math.min(10 * n, G)}px`);
	let f = d.append("xhtml:div"), p = i(t.label) ? await a(t.label.replace(s.lineBreakRegex, "\n"), u) : c(t.label, u), m = t.isNode ? "nodeLabel" : "edgeLabel", h = f.append("span");
	h.html(p), W(h, t.labelStyle), h.attr("class", `${m} ${r}`), W(f, t.labelStyle), f.style("display", "table-cell"), f.style("white-space", "nowrap"), f.style("line-height", "1.5"), n !== Infinity && (f.style("max-width", n + "px"), f.style("text-align", "center")), f.attr("xmlns", "http://www.w3.org/1999/xhtml"), l && f.attr("class", "labelBkg");
	let g = f.node().getBoundingClientRect();
	return g.width === n && (f.style("display", "table"), f.style("white-space", "break-spaces"), f.style("width", n + "px"), g = f.node().getBoundingClientRect()), d.node();
}
n(K, "addHtmlSpan");
function q(e, t, n, r = !1) {
	let i = e.append("tspan").attr("class", "text-outer-tspan").attr("x", 0).attr("y", t * n - .1 + "em").attr("dy", n + "em");
	return r && i.attr("text-anchor", "middle"), i;
}
n(q, "createTspan");
function J(e, t, n) {
	let r = e.append("text"), i = q(r, 1, t);
	Q(i, n);
	let a = i.node().getComputedTextLength();
	return r.remove(), a;
}
n(J, "computeWidthOfText");
function Y(e, t, n) {
	var r;
	let i = e.append("text"), a = q(i, 1, t);
	Q(a, [{
		content: n,
		type: "normal"
	}]);
	let o = (r = a.node()) == null ? void 0 : r.getBoundingClientRect();
	return o && i.remove(), o;
}
n(Y, "computeDimensionOfText");
function X(e, t, r, i = !1, a = !1) {
	let o = 1.1, s = t.append("g"), c = s.insert("rect").attr("class", "background").attr("style", "stroke: none"), l = s.append("text").attr("y", "-10.1");
	a && l.attr("text-anchor", "middle");
	let u = 0;
	for (let t of r) {
		let r = /* @__PURE__ */ n((t) => J(s, o, t) <= e, "checkWidth"), i = r(t) ? [t] : H(t, r);
		for (let e of i) Q(q(l, u, o, a), e), u++;
	}
	if (i) {
		let e = l.node().getBBox();
		return c.attr("x", e.x - 2).attr("y", e.y - 2).attr("width", e.width + 4).attr("height", e.height + 4), s.node();
	} else return l.node();
}
n(X, "createFormattedText");
function Z(e) {
	return e.replace(/&(amp|lt|gt);/g, (e, t) => {
		switch (t) {
			case "amp": return "&";
			case "lt": return "<";
			case "gt": return ">";
			default: return e;
		}
	});
}
n(Z, "decodeHTMLEntities");
function Q(e, t) {
	e.text(""), t.forEach((t, n) => {
		let r = e.append("tspan").attr("font-style", t.type === "em" ? "italic" : "normal").attr("class", "text-inner-tspan").attr("font-weight", t.type === "strong" ? "bold" : "normal");
		n === 0 ? r.text(Z(t.content)) : r.text(" " + Z(t.content));
	});
}
n(Q, "updateTextContentAndStyles");
async function $(e, t = {}) {
	let n = [];
	e.replace(/(fa[bklrs]?):fa-([\w-]+)/g, (e, r, i) => (n.push((async () => {
		let n = `${r}:${i}`;
		return await M(n) ? await N(n, void 0, { class: "label-icon" }) : `<i class='${c(e, t).replace(":", " ")}'></i>`;
	})()), e));
	let r = await Promise.all(n);
	return e.replace(/(fa[bklrs]?):fa-([\w-]+)/g, () => {
		var e;
		return (e = r.shift()) == null ? "" : e;
	});
}
n($, "replaceIconSubstring");
var ue = /* @__PURE__ */ n(async (e, n = "", { style: a = "", isTitle: o = !1, classes: s = "", useHtmlLabels: c = !0, markdown: u = !0, isNode: d = !0, width: f = 200, addSvgBackground: p = !1 } = {}, m) => {
	if (t.debug("XYZ createText", n, a, o, s, c, d, "addSvgBackground: ", p), c) {
		let t = await $(l(u ? R(n, m) : L(n)), m), r = n.replace(/\\\\/g, "\\");
		return await K(e, {
			isNode: d,
			label: i(n) ? r : t,
			labelStyle: a.replace("fill:", "color:")
		}, f, s, p, m);
	} else {
		let t = l(n.replace(/<br\s*\/?>/g, "<br/>")), i = X(f, e, u ? I(t.replace("<br>", "<br/>"), m) : F(t), n ? p : !1, !d);
		if (d) {
			/stroke:/.exec(a) && (a = a.replace("stroke:", "lineColor:"));
			let e = a.replace(/stroke:[^;]+;?/g, "").replace(/stroke-width:[^;]+;?/g, "").replace(/fill:[^;]+;?/g, "").replace(/color:/g, "fill:");
			r(i).attr("style", e);
		} else {
			let e = a.replace(/stroke:[^;]+;?/g, "").replace(/stroke-width:[^;]+;?/g, "").replace(/fill:[^;]+;?/g, "").replace(/background:/g, "fill:");
			r(i).select("rect").attr("style", e.replace(/background:/g, "fill:"));
			let t = a.replace(/stroke:[^;]+;?/g, "").replace(/stroke-width:[^;]+;?/g, "").replace(/fill:[^;]+;?/g, "").replace(/color:/g, "fill:");
			r(i).select("text").attr("style", t);
		}
		return o ? r(i).selectAll("tspan.text-outer-tspan").classed("title-row", !0) : r(i).selectAll("tspan.text-outer-tspan").classed("row", !0), i;
	}
}, "createText");
//#endregion
export { D as a, A as i, ue as n, E as o, N as r, Y as t };
