import { t as e } from "./purify.es-CRhf_fxZ.mjs";
import { t } from "./es/index.js";
import { a as n, i as r, r as i, t as a } from "./src-q1mJODQi.mjs";
import { C as o, E as s, I as c, L as l, N as u, P as d, Q as f, S as p, T as m, V as h, W as g, X as _, Z as v, _ as y, b, c as x, g as S, l as C, m as w, n as T, p as ee, q as te, r as E, t as D, u as O } from "./chunk-CSCIHK7Q-Bm1gw87X.mjs";
import { G as k, a as A, b as ne, f as re, g as j, h as M, i as ie, o as ae, v as oe, y as se } from "./chunk-5ZQYHXKU-cRTMH84-.mjs";
import { t as ce } from "./chunk-WU5MYG2G-Bix12dNS.mjs";
import { i as le, o as ue } from "./chunk-O5CBEL6O-CALp6o7A.mjs";
import "./chunk-BSJP7CBP-DER-ilWr.mjs";
import "./chunk-L5ZTLDWV-KdfSpm4k.mjs";
import "./chunk-NZK2D7GU-CsuOrk0Z.mjs";
import "./chunk-3OPIFGDE-14tG0H5Y.mjs";
import "./chunk-KSCS5N6A-BZYd77D3.mjs";
import { n as de } from "./chunk-LZXEDZCA-D7o8lyms.mjs";
import { n as fe, t as pe } from "./chunk-XPW4576I-Kzrr1HOt.mjs";
//#region ../../node_modules/.pnpm/@braintree+sanitize-url@7.1.1/node_modules/@braintree/sanitize-url/dist/constants.js
var me = /* @__PURE__ */ t(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.BLANK_URL = e.relativeFirstCharacters = e.whitespaceEscapeCharsRegex = e.urlSchemeRegex = e.ctrlCharactersRegex = e.htmlCtrlEntityRegex = e.htmlEntitiesRegex = e.invalidProtocolRegex = void 0, e.invalidProtocolRegex = /^([^\w]*)(javascript|data|vbscript)/im, e.htmlEntitiesRegex = /&#(\w+)(^\w|;)?/g, e.htmlCtrlEntityRegex = /&(newline|tab);/gi, e.ctrlCharactersRegex = /[\u0000-\u001F\u007F-\u009F\u2000-\u200D\uFEFF]/gim, e.urlSchemeRegex = /^.+(:|&colon;)/gim, e.whitespaceEscapeCharsRegex = /(\\|%5[cC])((%(6[eE]|72|74))|[nrt])/g, e.relativeFirstCharacters = [".", "/"], e.BLANK_URL = "about:blank";
})), he = /* @__PURE__ */ t(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.sanitizeUrl = void 0;
	var t = me();
	function n(e) {
		return t.relativeFirstCharacters.indexOf(e[0]) > -1;
	}
	function r(e) {
		return e.replace(t.ctrlCharactersRegex, "").replace(t.htmlEntitiesRegex, function(e, t) {
			return String.fromCharCode(t);
		});
	}
	function i(e) {
		return URL.canParse(e);
	}
	function a(e) {
		try {
			return decodeURIComponent(e);
		} catch {
			return e;
		}
	}
	function o(e) {
		if (!e) return t.BLANK_URL;
		var o, s = a(e.trim());
		do
			s = r(s).replace(t.htmlCtrlEntityRegex, "").replace(t.ctrlCharactersRegex, "").replace(t.whitespaceEscapeCharsRegex, "").trim(), s = a(s), o = s.match(t.ctrlCharactersRegex) || s.match(t.htmlEntitiesRegex) || s.match(t.htmlCtrlEntityRegex) || s.match(t.whitespaceEscapeCharsRegex);
		while (o && o.length > 0);
		var c = s;
		if (!c) return t.BLANK_URL;
		if (n(c)) return c;
		var l = c.trimStart(), u = l.match(t.urlSchemeRegex);
		if (!u) return c;
		var d = u[0].toLowerCase().trim();
		if (t.invalidProtocolRegex.test(d)) return t.BLANK_URL;
		var f = l.replace(/\\/g, "/");
		if (d === "mailto:" || d.includes("://")) return f;
		if (d === "http:" || d === "https:") {
			if (!i(f)) return t.BLANK_URL;
			var p = new URL(f);
			return p.protocol = p.protocol.toLowerCase(), p.hostname = p.hostname.toLowerCase(), p.toString();
		}
		return f;
	}
	e.sanitizeUrl = o;
}));
//#endregion
//#region ../../node_modules/.pnpm/es-toolkit@1.46.1/node_modules/es-toolkit/dist/compat/_internal/isPrototype.mjs
function ge(e) {
	let t = e == null ? void 0 : e.constructor;
	return e === (typeof t == "function" ? t.prototype : Object.prototype);
}
//#endregion
//#region ../../node_modules/.pnpm/es-toolkit@1.46.1/node_modules/es-toolkit/dist/compat/predicate/isEmpty.mjs
function _e(e) {
	if (e == null) return !0;
	if (k(e)) return typeof e.splice != "function" && typeof e != "string" && !ne(e) && !oe(e) && !se(e) ? !1 : e.length === 0;
	if (typeof e == "object") {
		if (e instanceof Map || e instanceof Set) return e.size === 0;
		let t = Object.keys(e);
		return ge(e) ? t.filter((e) => e !== "constructor").length === 0 : t.length === 0;
	}
	return !0;
}
//#endregion
//#region ../../node_modules/.pnpm/stylis@4.3.6/node_modules/stylis/src/Enum.js
var ve = "comm", ye = "rule", be = "decl", xe = "@import", Se = "@namespace", Ce = "@keyframes", we = "@layer", Te = Math.abs, Ee = String.fromCharCode;
function De(e) {
	return e.trim();
}
function N(e, t, n) {
	return e.replace(t, n);
}
function Oe(e, t, n) {
	return e.indexOf(t, n);
}
function P(e, t) {
	return e.charCodeAt(t) | 0;
}
function F(e, t, n) {
	return e.slice(t, n);
}
function I(e) {
	return e.length;
}
function ke(e) {
	return e.length;
}
function L(e, t) {
	return t.push(e), e;
}
//#endregion
//#region ../../node_modules/.pnpm/stylis@4.3.6/node_modules/stylis/src/Tokenizer.js
var R = 1, z = 1, Ae = 0, B = 0, V = 0, H = "";
function U(e, t, n, r, i, a, o, s) {
	return {
		value: e,
		root: t,
		parent: n,
		type: r,
		props: i,
		children: a,
		line: R,
		column: z,
		length: o,
		return: "",
		siblings: s
	};
}
function je() {
	return V;
}
function Me() {
	return V = B > 0 ? P(H, --B) : 0, z--, V === 10 && (z = 1, R--), V;
}
function W() {
	return V = B < Ae ? P(H, B++) : 0, z++, V === 10 && (z = 1, R++), V;
}
function G() {
	return P(H, B);
}
function K() {
	return B;
}
function q(e, t) {
	return F(H, e, t);
}
function J(e) {
	switch (e) {
		case 0:
		case 9:
		case 10:
		case 13:
		case 32: return 5;
		case 33:
		case 43:
		case 44:
		case 47:
		case 62:
		case 64:
		case 126:
		case 59:
		case 123:
		case 125: return 4;
		case 58: return 3;
		case 34:
		case 39:
		case 40:
		case 91: return 2;
		case 41:
		case 93: return 1;
	}
	return 0;
}
function Ne(e) {
	return R = z = 1, Ae = I(H = e), B = 0, [];
}
function Pe(e) {
	return H = "", e;
}
function Fe(e) {
	return De(q(B - 1, Re(e === 91 ? e + 2 : e === 40 ? e + 1 : e)));
}
function Ie(e) {
	for (; (V = G()) && V < 33;) W();
	return J(e) > 2 || J(V) > 3 ? "" : " ";
}
function Le(e, t) {
	for (; --t && W() && !(V < 48 || V > 102 || V > 57 && V < 65 || V > 70 && V < 97););
	return q(e, K() + (t < 6 && G() == 32 && W() == 32));
}
function Re(e) {
	for (; W();) switch (V) {
		case e: return B;
		case 34:
		case 39:
			e !== 34 && e !== 39 && Re(V);
			break;
		case 40:
			e === 41 && Re(e);
			break;
		case 92:
			W();
			break;
	}
	return B;
}
function ze(e, t) {
	for (; W() && e + V !== 57 && !(e + V === 84 && G() === 47););
	return "/*" + q(t, B - 1) + "*" + Ee(e === 47 ? e : W());
}
function Be(e) {
	for (; !J(G());) W();
	return q(e, B);
}
//#endregion
//#region ../../node_modules/.pnpm/stylis@4.3.6/node_modules/stylis/src/Parser.js
function Ve(e) {
	return Pe(Y("", null, null, null, [""], e = Ne(e), 0, [0], e));
}
function Y(e, t, n, r, i, a, o, s, c) {
	for (var l = 0, u = 0, d = o, f = 0, p = 0, m = 0, h = 1, g = 1, _ = 1, v = 0, y = "", b = i, x = a, S = r, C = y; g;) switch (m = v, v = W()) {
		case 40: if (m != 108 && P(C, d - 1) == 58) {
			Oe(C += N(Fe(v), "&", "&\f"), "&\f", Te(l ? s[l - 1] : 0)) != -1 && (_ = -1);
			break;
		}
		case 34:
		case 39:
		case 91:
			C += Fe(v);
			break;
		case 9:
		case 10:
		case 13:
		case 32:
			C += Ie(m);
			break;
		case 92:
			C += Le(K() - 1, 7);
			continue;
		case 47:
			switch (G()) {
				case 42:
				case 47:
					L(Ue(ze(W(), K()), t, n, c), c), (J(m || 1) == 5 || J(G() || 1) == 5) && I(C) && F(C, -1, void 0) !== " " && (C += " ");
					break;
				default: C += "/";
			}
			break;
		case 123 * h: s[l++] = I(C) * _;
		case 125 * h:
		case 59:
		case 0:
			switch (v) {
				case 0:
				case 125: g = 0;
				case 59 + u:
					_ == -1 && (C = N(C, /\f/g, "")), p > 0 && (I(C) - d || h === 0 && m === 47) && L(p > 32 ? We(C + ";", r, n, d - 1, c) : We(N(C, " ", "") + ";", r, n, d - 2, c), c);
					break;
				case 59: C += ";";
				default: if (L(S = He(C, t, n, l, u, i, s, y, b = [], x = [], d, a), a), v === 123) if (u === 0) Y(C, t, S, S, b, a, d, s, x);
				else {
					switch (f) {
						case 99: if (P(C, 3) === 110) break;
						case 108: if (P(C, 2) === 97) break;
						default: u = 0;
						case 100:
						case 109:
						case 115:
					}
					u ? Y(e, S, S, r && L(He(e, S, S, 0, 0, i, s, y, i, b = [], d, x), x), i, x, d, s, r ? b : x) : Y(C, S, S, S, [""], x, 0, s, x);
				}
			}
			l = u = p = 0, h = _ = 1, y = C = "", d = o;
			break;
		case 58: d = 1 + I(C), p = m;
		default:
			if (h < 1) {
				if (v == 123) --h;
				else if (v == 125 && h++ == 0 && Me() == 125) continue;
			}
			switch (C += Ee(v), v * h) {
				case 38:
					_ = u > 0 ? 1 : (C += "\f", -1);
					break;
				case 44:
					s[l++] = (I(C) - 1) * _, _ = 1;
					break;
				case 64:
					G() === 45 && (C += Fe(W())), f = G(), u = d = I(y = C += Be(K())), v++;
					break;
				case 45: m === 45 && I(C) == 2 && (h = 0);
			}
	}
	return a;
}
function He(e, t, n, r, i, a, o, s, c, l, u, d) {
	for (var f = i - 1, p = i === 0 ? a : [""], m = ke(p), h = 0, g = 0, _ = 0; h < r; ++h) for (var v = 0, y = F(e, f + 1, f = Te(g = o[h])), b = e; v < m; ++v) (b = De(g > 0 ? p[v] + " " + y : N(y, /&\f/g, p[v]))) && (c[_++] = b);
	return U(e, t, n, i === 0 ? ye : s, c, l, u, d);
}
function Ue(e, t, n, r) {
	return U(e, t, n, ve, Ee(je()), F(e, 2, -2), 0, r);
}
function We(e, t, n, r, i) {
	return U(e, t, n, be, F(e, 0, r), F(e, r + 1, -1), r, i);
}
//#endregion
//#region ../../node_modules/.pnpm/stylis@4.3.6/node_modules/stylis/src/Serializer.js
function Ge(e, t) {
	for (var n = "", r = 0; r < e.length; r++) n += t(e[r], r, e, t) || "";
	return n;
}
function Ke(e, t, n, r) {
	switch (e.type) {
		case we: if (e.children.length) break;
		case xe:
		case Se:
		case be: return e.return = e.return || e.value;
		case ve: return "";
		case Ce: return e.return = e.value + "{" + Ge(e.children, r) + "}";
		case ye: if (!I(e.value = e.props.join(","))) return "";
	}
	return I(n = Ge(e.children, r)) ? e.return = e.value + "{" + n + "}" : "";
}
//#endregion
//#region ../../node_modules/.pnpm/stylis@4.3.6/node_modules/stylis/src/Middleware.js
function qe(e) {
	var t = ke(e);
	return function(n, r, i, a) {
		for (var o = "", s = 0; s < t; s++) o += e[s](n, r, i, a) || "";
		return o;
	};
}
//#endregion
//#region ../../node_modules/.pnpm/mermaid@11.15.0/node_modules/mermaid/dist/mermaid.core.mjs
var Je, Ye = "c4", Xe = {
	id: Ye,
	detector: /* @__PURE__ */ i((e) => /^\s*C4Context|C4Container|C4Component|C4Dynamic|C4Deployment/.test(e), "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./c4Diagram-AAUBKEIU-BawJog2Q.mjs");
		return {
			id: Ye,
			diagram: e
		};
	}, "loader")
}, Ze = "flowchart", Qe = {
	id: Ze,
	detector: /* @__PURE__ */ i((e, t) => {
		var n, r;
		return (t == null || (n = t.flowchart) == null ? void 0 : n.defaultRenderer) === "dagre-wrapper" || (t == null || (r = t.flowchart) == null ? void 0 : r.defaultRenderer) === "elk" ? !1 : /^\s*graph/.test(e);
	}, "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./flowDiagram-I6XJVG4X-CizImyVw.mjs");
		return {
			id: Ze,
			diagram: e
		};
	}, "loader")
}, $e = "flowchart-v2", et = {
	id: $e,
	detector: /* @__PURE__ */ i((e, t) => {
		var n, r, i;
		return (t == null || (n = t.flowchart) == null ? void 0 : n.defaultRenderer) === "dagre-d3" ? !1 : ((t == null || (r = t.flowchart) == null ? void 0 : r.defaultRenderer) === "elk" && (t.layout = "elk"), /^\s*graph/.test(e) && (t == null || (i = t.flowchart) == null ? void 0 : i.defaultRenderer) === "dagre-wrapper" ? !0 : /^\s*flowchart/.test(e));
	}, "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./flowDiagram-I6XJVG4X-CizImyVw.mjs");
		return {
			id: $e,
			diagram: e
		};
	}, "loader")
}, tt = "er", nt = {
	id: tt,
	detector: /* @__PURE__ */ i((e) => /^\s*erDiagram/.test(e), "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./erDiagram-TEJ5UH35-BL6iMY14.mjs");
		return {
			id: tt,
			diagram: e
		};
	}, "loader")
}, rt = "gitGraph", it = {
	id: rt,
	detector: /* @__PURE__ */ i((e) => /^\s*gitGraph/.test(e), "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./gitGraphDiagram-PVQCEYII-B6N_gnVH.mjs");
		return {
			id: rt,
			diagram: e
		};
	}, "loader")
}, at = "gantt", ot = {
	id: at,
	detector: /* @__PURE__ */ i((e) => /^\s*gantt/.test(e), "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./ganttDiagram-6RSMTGT7-Ba6h-2jc.mjs");
		return {
			id: at,
			diagram: e
		};
	}, "loader")
}, st = "info", ct = {
	id: st,
	detector: /* @__PURE__ */ i((e) => /^\s*info/.test(e), "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./infoDiagram-5YYISTIA-GfECaUpm.mjs");
		return {
			id: st,
			diagram: e
		};
	}, "loader")
}, lt = "pie", ut = {
	id: lt,
	detector: /* @__PURE__ */ i((e) => /^\s*pie/.test(e), "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./pieDiagram-4H26LBE5-Ck08CeEo.mjs");
		return {
			id: lt,
			diagram: e
		};
	}, "loader")
}, dt = "quadrantChart", ft = {
	id: dt,
	detector: /* @__PURE__ */ i((e) => /^\s*quadrantChart/.test(e), "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./quadrantDiagram-W4KKPZXB-ChwgWjmz.mjs");
		return {
			id: dt,
			diagram: e
		};
	}, "loader")
}, pt = "xychart", mt = {
	id: pt,
	detector: /* @__PURE__ */ i((e) => /^\s*xychart(-beta)?/.test(e), "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./xychartDiagram-2RQKCTM6-BqYDxPsy.mjs");
		return {
			id: pt,
			diagram: e
		};
	}, "loader")
}, ht = "requirement", gt = {
	id: ht,
	detector: /* @__PURE__ */ i((e) => /^\s*requirement(Diagram)?/.test(e), "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./requirementDiagram-4Y6WPE33-DfaZQKqS.mjs");
		return {
			id: ht,
			diagram: e
		};
	}, "loader")
}, _t = "sequence", vt = {
	id: _t,
	detector: /* @__PURE__ */ i((e) => /^\s*sequenceDiagram/.test(e), "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./sequenceDiagram-3UESZ5HK-6gI4I-BF.mjs");
		return {
			id: _t,
			diagram: e
		};
	}, "loader")
}, yt = "class", bt = {
	id: yt,
	detector: /* @__PURE__ */ i((e, t) => {
		var n;
		return (t == null || (n = t.class) == null ? void 0 : n.defaultRenderer) === "dagre-wrapper" ? !1 : /^\s*classDiagram/.test(e);
	}, "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./classDiagram-4FO5ZUOK-C-bcS9eH.mjs");
		return {
			id: yt,
			diagram: e
		};
	}, "loader")
}, xt = "classDiagram", St = {
	id: xt,
	detector: /* @__PURE__ */ i((e, t) => {
		var n;
		return /^\s*classDiagram/.test(e) && (t == null || (n = t.class) == null ? void 0 : n.defaultRenderer) === "dagre-wrapper" ? !0 : /^\s*classDiagram-v2/.test(e);
	}, "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./classDiagram-v2-Q7XG4LA2-SqzuqdWW.mjs");
		return {
			id: xt,
			diagram: e
		};
	}, "loader")
}, Ct = "state", wt = {
	id: Ct,
	detector: /* @__PURE__ */ i((e, t) => {
		var n;
		return (t == null || (n = t.state) == null ? void 0 : n.defaultRenderer) === "dagre-wrapper" ? !1 : /^\s*stateDiagram/.test(e);
	}, "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./stateDiagram-AJRCARHV-Dyu6-a22.mjs");
		return {
			id: Ct,
			diagram: e
		};
	}, "loader")
}, Tt = "stateDiagram", Et = {
	id: Tt,
	detector: /* @__PURE__ */ i((e, t) => {
		var n;
		return !!(/^\s*stateDiagram-v2/.test(e) || /^\s*stateDiagram/.test(e) && (t == null || (n = t.state) == null ? void 0 : n.defaultRenderer) === "dagre-wrapper");
	}, "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./stateDiagram-v2-BHNVJYJU-DsczAqDe.mjs");
		return {
			id: Tt,
			diagram: e
		};
	}, "loader")
}, Dt = "journey", Ot = {
	id: Dt,
	detector: /* @__PURE__ */ i((e) => /^\s*journey/.test(e), "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./journeyDiagram-JHISSGLW--q6Y5EbD.mjs");
		return {
			id: Dt,
			diagram: e
		};
	}, "loader")
}, kt = { draw: /* @__PURE__ */ i((e, t, n) => {
	r.debug("rendering svg for syntax error\n");
	let i = ce(t), a = i.append("g");
	i.attr("viewBox", "0 0 2412 512"), x(i, 100, 512, !0), a.append("path").attr("class", "error-icon").attr("d", "m411.313,123.313c6.25-6.25 6.25-16.375 0-22.625s-16.375-6.25-22.625,0l-32,32-9.375,9.375-20.688-20.688c-12.484-12.5-32.766-12.5-45.25,0l-16,16c-1.261,1.261-2.304,2.648-3.31,4.051-21.739-8.561-45.324-13.426-70.065-13.426-105.867,0-192,86.133-192,192s86.133,192 192,192 192-86.133 192-192c0-24.741-4.864-48.327-13.426-70.065 1.402-1.007 2.79-2.049 4.051-3.31l16-16c12.5-12.492 12.5-32.758 0-45.25l-20.688-20.688 9.375-9.375 32.001-31.999zm-219.313,100.687c-52.938,0-96,43.063-96,96 0,8.836-7.164,16-16,16s-16-7.164-16-16c0-70.578 57.422-128 128-128 8.836,0 16,7.164 16,16s-7.164,16-16,16z"), a.append("path").attr("class", "error-icon").attr("d", "m459.02,148.98c-6.25-6.25-16.375-6.25-22.625,0s-6.25,16.375 0,22.625l16,16c3.125,3.125 7.219,4.688 11.313,4.688 4.094,0 8.188-1.563 11.313-4.688 6.25-6.25 6.25-16.375 0-22.625l-16.001-16z"), a.append("path").attr("class", "error-icon").attr("d", "m340.395,75.605c3.125,3.125 7.219,4.688 11.313,4.688 4.094,0 8.188-1.563 11.313-4.688 6.25-6.25 6.25-16.375 0-22.625l-16-16c-6.25-6.25-16.375-6.25-22.625,0s-6.25,16.375 0,22.625l15.999,16z"), a.append("path").attr("class", "error-icon").attr("d", "m400,64c8.844,0 16-7.164 16-16v-32c0-8.836-7.156-16-16-16-8.844,0-16,7.164-16,16v32c0,8.836 7.156,16 16,16z"), a.append("path").attr("class", "error-icon").attr("d", "m496,96.586h-32c-8.844,0-16,7.164-16,16 0,8.836 7.156,16 16,16h32c8.844,0 16-7.164 16-16 0-8.836-7.156-16-16-16z"), a.append("path").attr("class", "error-icon").attr("d", "m436.98,75.605c3.125,3.125 7.219,4.688 11.313,4.688 4.094,0 8.188-1.563 11.313-4.688l32-32c6.25-6.25 6.25-16.375 0-22.625s-16.375-6.25-22.625,0l-32,32c-6.251,6.25-6.251,16.375-0.001,22.625z"), a.append("text").attr("class", "error-text").attr("x", 1440).attr("y", 250).attr("font-size", "150px").style("text-anchor", "middle").text("Syntax error in text"), a.append("text").attr("class", "error-text").attr("x", 1250).attr("y", 400).attr("font-size", "100px").style("text-anchor", "middle").text(`mermaid version ${n}`);
}, "draw") }, At = kt, jt = {
	db: {},
	renderer: kt,
	parser: { parse: /* @__PURE__ */ i(() => {}, "parse") }
}, Mt = "flowchart-elk", Nt = {
	id: Mt,
	detector: /* @__PURE__ */ i((e, t = {}) => {
		var n;
		return /^\s*flowchart-elk/.test(e) || /^\s*(flowchart|graph)/.test(e) && (t == null || (n = t.flowchart) == null ? void 0 : n.defaultRenderer) === "elk" ? (t.layout = "elk", !0) : !1;
	}, "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./flowDiagram-I6XJVG4X-CizImyVw.mjs");
		return {
			id: Mt,
			diagram: e
		};
	}, "loader")
}, Pt = "timeline", Ft = {
	id: Pt,
	detector: /* @__PURE__ */ i((e) => /^\s*timeline/.test(e), "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./timeline-definition-PNZ67QCA-DzfL5946.mjs");
		return {
			id: Pt,
			diagram: e
		};
	}, "loader")
}, It = "mindmap", Lt = {
	id: It,
	detector: /* @__PURE__ */ i((e) => /^\s*mindmap/.test(e), "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./mindmap-definition-RKZ34NQL-Lor-REYs.mjs");
		return {
			id: It,
			diagram: e
		};
	}, "loader")
}, Rt = "kanban", zt = {
	id: Rt,
	detector: /* @__PURE__ */ i((e) => /^\s*kanban/.test(e), "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./kanban-definition-UN3LZRKU-DmC2SKJL.mjs");
		return {
			id: Rt,
			diagram: e
		};
	}, "loader")
}, Bt = "sankey", Vt = {
	id: Bt,
	detector: /* @__PURE__ */ i((e) => /^\s*sankey(-beta)?/.test(e), "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./sankeyDiagram-5OEKKPKP-BFpClx0E.mjs");
		return {
			id: Bt,
			diagram: e
		};
	}, "loader")
}, Ht = "packet", Ut = {
	id: Ht,
	detector: /* @__PURE__ */ i((e) => /^\s*packet(-beta)?/.test(e), "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./diagram-LMA3HP47-Cgk-JlfD.mjs");
		return {
			id: Ht,
			diagram: e
		};
	}, "loader")
}, Wt = "radar", Gt = {
	id: Wt,
	detector: /* @__PURE__ */ i((e) => /^\s*radar-beta/.test(e), "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./diagram-2AECGRRQ-DaiZickl.mjs");
		return {
			id: Wt,
			diagram: e
		};
	}, "loader")
}, Kt = "block", qt = {
	id: Kt,
	detector: /* @__PURE__ */ i((e) => /^\s*block(-beta)?/.test(e), "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./blockDiagram-GPEHLZMM-ClIAYB_I.mjs");
		return {
			id: Kt,
			diagram: e
		};
	}, "loader")
}, Jt = "treeView", Yt = {
	id: Jt,
	detector: /* @__PURE__ */ i((e) => /^\s*treeView-beta/.test(e), "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./diagram-5GNKFQAL-lR2s8Bhl.mjs");
		return {
			id: Jt,
			diagram: e
		};
	}, "loader")
}, Xt = "architecture", Zt = {
	id: Xt,
	detector: /* @__PURE__ */ i((e) => /^\s*architecture/.test(e), "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./architectureDiagram-3BPJPVTR-Cv_Dupw9.mjs");
		return {
			id: Xt,
			diagram: e
		};
	}, "loader")
}, Qt = "eventmodeling", $t = {
	id: Qt,
	detector: /* @__PURE__ */ i((e) => /^\s*eventmodeling/.test(e), "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./diagram-KO2AKTUF-BJVWZ6cG.mjs");
		return {
			id: Qt,
			diagram: e
		};
	}, "loader")
}, en = "ishikawa", tn = {
	id: en,
	detector: /* @__PURE__ */ i((e) => /^\s*ishikawa(-beta)?\b/i.test(e), "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./ishikawaDiagram-YF4QCWOH-BXT_26tr.mjs");
		return {
			id: en,
			diagram: e
		};
	}, "loader")
}, nn = "venn", rn = {
	id: nn,
	detector: /* @__PURE__ */ i((e) => /^\s*venn-beta/.test(e), "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./vennDiagram-CIIHVFJN-HkdaNg8x.mjs");
		return {
			id: nn,
			diagram: e
		};
	}, "loader")
}, an = "treemap", on = {
	id: an,
	detector: /* @__PURE__ */ i((e) => /^\s*treemap/.test(e), "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./diagram-OG6HWLK6-DhlzMZEo.mjs");
		return {
			id: an,
			diagram: e
		};
	}, "loader")
}, sn = "wardley-beta", cn = {
	id: sn,
	detector: /* @__PURE__ */ i((e) => /^\s*wardley-beta/i.test(e), "detector"),
	loader: /* @__PURE__ */ i(async () => {
		let { diagram: e } = await import("./wardleyDiagram-YWT4CUSO-DQmxQhj0.mjs");
		return {
			id: sn,
			diagram: e
		};
	}, "loader")
}, ln = !1, X = /* @__PURE__ */ i(() => {
	ln || (ln = !0, u("error", jt, (e) => e.toLowerCase().trim() === "error"), u("---", {
		db: { clear: /* @__PURE__ */ i(() => {}, "clear") },
		styles: {},
		renderer: { draw: /* @__PURE__ */ i(() => {}, "draw") },
		parser: { parse: /* @__PURE__ */ i(() => {
			throw Error("Diagrams beginning with --- are not valid. If you were trying to use a YAML front-matter, please ensure that you've correctly opened and closed the YAML front-matter with un-indented `---` blocks");
		}, "parse") },
		init: /* @__PURE__ */ i(() => null, "init")
	}, (e) => e.toLowerCase().trimStart().startsWith("---")), d(Nt, Lt, Zt), d(Xe, zt, St, bt, nt, ot, ct, ut, gt, vt, et, Qe, Ft, it, Et, wt, Ot, ft, Vt, Ut, mt, qt, $t, Yt, Gt, tn, on, rn, cn));
}, "addDiagrams"), un = /* @__PURE__ */ i(async () => {
	r.debug("Loading registered diagrams");
	let e = (await Promise.allSettled(Object.entries(w).map(async ([e, { detector: t, loader: n }]) => {
		if (n) try {
			p(e);
		} catch {
			try {
				let { diagram: e, id: r } = await n();
				u(r, e, t);
			} catch (t) {
				throw r.error(`Failed to load external diagram with key ${e}. Removing from detectors.`), delete w[e], t;
			}
		}
	}))).filter((e) => e.status === "rejected");
	if (e.length > 0) {
		r.error(`Failed to load ${e.length} external diagrams`);
		for (let t of e) r.error(t);
		throw Error(`Failed to load ${e.length} external diagrams`);
	}
}, "loadRegisteredDiagrams"), dn = "graphics-document document";
function fn(e, t) {
	e.attr("role", dn), t !== "" && e.attr("aria-roledescription", t);
}
i(fn, "setA11yDiagramInfo");
function pn(e, t, n, r) {
	if (e.insert !== void 0) {
		if (n) {
			let t = `chart-desc-${r}`;
			e.attr("aria-describedby", t), e.insert("desc", ":first-child").attr("id", t).text(n);
		}
		if (t) {
			let n = `chart-title-${r}`;
			e.attr("aria-labelledby", n), e.insert("title", ":first-child").attr("id", n).text(t);
		}
	}
}
i(pn, "addSVGa11yTitleDescription");
var mn = (Je = class e {
	constructor(e, t, n, r, i) {
		this.type = e, this.text = t, this.db = n, this.parser = r, this.renderer = i;
	}
	static async fromText(t, n = {}) {
		var r;
		let i = b(), a = ee(t, i);
		t = ae(t) + "\n";
		try {
			p(a);
		} catch {
			let e = o(a);
			if (!e) throw new D(`Diagram ${a} not found.`);
			let { id: t, diagram: n } = await e();
			u(t, n);
		}
		let { db: s, parser: c, renderer: l, init: d } = p(a);
		if (c.parser && (c.parser.yy = s), (r = s.clear) == null || r.call(s), d == null || d(i), n.title) {
			var f;
			(f = s.setDiagramTitle) == null || f.call(s, n.title);
		}
		return await c.parse(t), new e(a, t, s, c, l);
	}
	async render(e, t) {
		await this.renderer.draw(this.text, e, t, this);
	}
	getParser() {
		return this.parser;
	}
	getType() {
		return this.type;
	}
}, i(Je, "Diagram"), Je), hn = [], gn = /* @__PURE__ */ i(() => {
	hn.forEach((e) => {
		e();
	}), hn = [];
}, "attachFunctions"), _n = /* @__PURE__ */ i((e) => e.replace(/^\s*%%(?!{)[^\n]+\n?/gm, "").trimStart(), "cleanupComments");
function vn(e) {
	var t;
	let n = e.match(y);
	if (!n) return {
		text: e,
		metadata: {}
	};
	let r = (t = fe(n[1], { schema: pe })) == null ? {} : t;
	r = typeof r == "object" && !Array.isArray(r) ? r : {};
	let i = {};
	return r.displayMode && (i.displayMode = r.displayMode.toString()), r.title && (i.title = r.title.toString()), r.config && (i.config = r.config), {
		text: e.slice(n[0].length),
		metadata: i
	};
}
i(vn, "extractFrontMatter");
var yn = /* @__PURE__ */ i((e) => e.replace(/\r\n?/g, "\n").replace(/<(\w+)([^>]*)>/g, (e, t, n) => "<" + t + n.replace(/="([^"]*)"/g, "='$1'") + ">"), "cleanupText"), bn = /* @__PURE__ */ i((e) => {
	let { text: t, metadata: n } = vn(e), { displayMode: r, title: i, config: a = {} } = n;
	return r && (a.gantt || (a.gantt = {}), a.gantt.displayMode = r), {
		title: i,
		config: a,
		text: t
	};
}, "processFrontmatter"), xn = /* @__PURE__ */ i((e) => {
	var t;
	let n = (t = j.detectInit(e)) == null ? {} : t, r = j.detectDirective(e, "wrap");
	return Array.isArray(r) ? n.wrap = r.some(({ type: e }) => e === "wrap") : (r == null ? void 0 : r.type) === "wrap" && (n.wrap = !0), {
		text: M(e),
		directive: n
	};
}, "processDirectives");
function Sn(e) {
	let t = bn(yn(e)), n = xn(t.text), r = ie(t.config, n.directive);
	return e = _n(n.text), {
		code: e,
		title: t.title,
		config: r
	};
}
i(Sn, "preprocessDiagram");
function Cn(e) {
	let t = new TextEncoder().encode(e), n = Array.from(t, (e) => String.fromCodePoint(e)).join("");
	return btoa(n);
}
i(Cn, "toBase64");
var wn = 5e4, Tn = "graph TB;a[Maximum text size in diagram exceeded];style a fill:#faa", En = "sandbox", Dn = "loose", On = "http://www.w3.org/2000/svg", kn = "http://www.w3.org/1999/xlink", An = "http://www.w3.org/1999/xhtml", jn = "100%", Mn = "100%", Nn = "border:0;margin:0;", Pn = "margin:0", Fn = "allow-top-navigation-by-user-activation allow-popups", In = "The \"iframe\" tag is not supported by your browser.", Ln = ["foreignobject"], Rn = ["dominant-baseline"];
function zn(e) {
	var t;
	let n = Sn(e);
	return c(), T((t = n.config) == null ? {} : t), n;
}
i(zn, "processAndSetConfigs");
async function Bn(e, t) {
	X();
	try {
		let { code: t, config: n } = zn(e);
		return {
			diagramType: (await Qn(t)).type,
			config: n
		};
	} catch (e) {
		if (t != null && t.suppressErrors) return !1;
		throw e;
	}
}
i(Bn, "parse");
var Vn = /* @__PURE__ */ i((e, t, n = []) => `.${e} ${t} ${l(`{ ${n.join(" !important; ")} !important; }`)}`, "cssImportantStyles"), Hn = /* @__PURE__ */ i((e, t = /* @__PURE__ */ new Map()) => {
	let n = new CSSStyleSheet();
	if (e.fontFamily !== void 0 && n.insertRule(`:root { --mermaid-font-family: ${e.fontFamily}}`, n.cssRules.length), e.altFontFamily !== void 0 && n.insertRule(`:root { --mermaid-alt-font-family: ${e.altFontFamily}}`, n.cssRules.length), t instanceof Map) {
		let r = m(e) ? ["> *", "span"] : [
			"rect",
			"polygon",
			"ellipse",
			"circle",
			"path"
		];
		t.forEach((e) => {
			_e(e.styles) || r.forEach((t) => {
				n.insertRule(Vn(e.id, t, e.styles), n.cssRules.length);
			}), _e(e.textStyles) || n.insertRule(Vn(e.id, "tspan", ((e == null ? void 0 : e.textStyles) || []).map((e) => e.replace("color", "fill"))), n.cssRules.length);
		});
	}
	let r = "";
	if (e.themeCSS !== void 0) if (typeof n.replaceSync == "function") {
		let t = new CSSStyleSheet();
		t.replaceSync(e.themeCSS), r = C(t) + "\n";
	} else r += `${e.themeCSS}
`;
	return r + C(n);
}, "createCssStyles"), Un = /* @__PURE__ */ i((e, t) => Ge(Ve(`${e}{${t}}`), qe([/* @__PURE__ */ i(function(t, n, i, a) {
	if (t.type === "rule" && Array.isArray(t.props)) {
		if (t.parent && t.parent.type === "@keyframes") return;
		t.props = t.props.map((t) => t.startsWith(e) ? t : `${e} ${t}`);
	} else t.type.startsWith("@") && ([
		"@media",
		"@supports",
		"@layer",
		"@scope",
		"@container",
		"@starting-style",
		"@keyframes"
	].includes(t.type) || (r.warn(`Removing unsupported at-rule ${t.type} from CSS`), t.type = ve));
}, "addNamespace"), Ke])), "compileCSS"), Wn = /* @__PURE__ */ i((e, t, n, r) => Un(r, _(t, Hn(e, n), {
	...e.themeVariables,
	theme: e.theme,
	look: e.look
}, r)), "createUserStyles"), Gn = /* @__PURE__ */ i((e = "", t, n) => {
	let r = e;
	return !n && !t && (r = r.replace(/marker-end="url\([\d+./:=?A-Za-z-]*?#/g, "marker-end=\"url(#")), r = A(r), r = r.replace(/<br>/g, "<br/>"), r;
}, "cleanUpSvgCode"), Kn = /* @__PURE__ */ i((e = "", t) => {
	var n;
	return `<iframe style="width:${jn};height:${!(t == null || (n = t.viewBox) == null || (n = n.baseVal) == null) && n.height ? t.viewBox.baseVal.height + "px" : Mn};${Nn}" src="data:text/html;charset=UTF-8;base64,${Cn(`<body style="${Pn}">${e}</body>`)}" sandbox="${Fn}">
  ${In}
</iframe>`;
}, "putIntoIFrame"), qn = /* @__PURE__ */ i((e, t, n, r, i) => {
	let a = e.append("div");
	a.attr("id", n), r && a.attr("style", r);
	let o = a.append("svg").attr("id", t).attr("width", "100%").attr("xmlns", On);
	return i && o.attr("xmlns:xlink", i), o.append("g"), e;
}, "appendDivSvgG");
function Jn(e, t) {
	return e.append("iframe").attr("id", t).attr("style", "width: 100%; height: 100%;").attr("sandbox", "");
}
i(Jn, "sandboxedIframe");
var Yn = /* @__PURE__ */ i((e, t, n, r) => {
	var i, a, o;
	(i = e.getElementById(t)) == null || i.remove(), (a = e.getElementById(n)) == null || a.remove(), (o = e.getElementById(r)) == null || o.remove();
}, "removeExistingElements"), Xn = /* @__PURE__ */ i(async function(t, n, o) {
	var s, c, l, u, d, f, p;
	X();
	let m = zn(n);
	n = m.code;
	let h = b();
	r.debug(h), n.length > ((s = h == null ? void 0 : h.maxTextSize) == null ? wn : s) && (n = Tn);
	let g = `#${t}`, _ = "i" + t, v = "#" + _, y = "d" + t, x = "#" + y, C = /* @__PURE__ */ i(() => {
		let e = a(T ? v : x).node();
		e && "remove" in e && e.remove();
	}, "removeTempElements"), w = a(document.body), T = h.securityLevel === En, ee = h.securityLevel === Dn, te = h.fontFamily;
	o === void 0 ? (Yn(document, t, y, _), T ? (w = a(Jn(a(document.body), _).nodes()[0].contentDocument.body), w.node().style.margin = "0") : w = a("body"), qn(w, t, y)) : (o && (o.innerHTML = ""), T ? (w = a(Jn(a(o), _).nodes()[0].contentDocument.body), w.node().style.margin = "0") : w = a(o), qn(w, t, y, `font-family: ${te}`, kn));
	let E, D;
	try {
		E = await mn.fromText(n, { title: m.title });
	} catch (e) {
		if (h.suppressErrorRendering) throw C(), e;
		E = await mn.fromText("error"), D = e;
	}
	let O = w.select(x).node(), k = E.type, A = O.firstChild, ne = A.firstChild, re = Wn(h, k, (c = (l = E.renderer).getClasses) == null ? void 0 : c.call(l, n, E), g), j = document.createElement("style");
	j.innerHTML = re, A.insertBefore(j, ne);
	try {
		await E.renderer.draw(n, t, "11.15.0", E);
	} catch (e) {
		throw h.suppressErrorRendering ? C() : At.draw(n, t, "11.15.0"), e;
	}
	$n(k, w.select(`${x} svg`), (u = (d = E.db).getAccTitle) == null ? void 0 : u.call(d), (f = (p = E.db).getAccDescription) == null ? void 0 : f.call(p)), w.select(`[id="${t}"]`).selectAll("foreignobject > *").attr("xmlns", An);
	let M = w.select(x).node().innerHTML;
	if (r.debug("config.arrowMarkerAbsolute", h.arrowMarkerAbsolute), M = Gn(M, T, S(h.arrowMarkerAbsolute)), T) {
		let e = w.select(x + " svg").node();
		M = Kn(M, e);
	} else ee || (M = e.sanitize(M, {
		ADD_TAGS: Ln,
		ADD_ATTR: Rn,
		HTML_INTEGRATION_POINTS: { foreignobject: !0 }
	}));
	if (gn(), D) throw D;
	return C(), {
		diagramType: k,
		svg: M,
		bindFunctions: E.db.bindFunctions
	};
}, "render");
function Zn(e = {}) {
	var t;
	let r = E({}, e);
	r != null && r.fontFamily && !((t = r.themeVariables) != null && t.fontFamily) && (r.themeVariables || (r.themeVariables = {}), r.themeVariables.fontFamily = r.fontFamily), h(r), r != null && r.theme && r.theme in v ? r.themeVariables = v[r.theme].getThemeVariables(r.themeVariables) : r && (r.themeVariables = v.default.getThemeVariables(r.themeVariables)), n((typeof r == "object" ? te(r) : s()).logLevel), X();
}
i(Zn, "initialize");
var Qn = /* @__PURE__ */ i((e, t = {}) => {
	let { code: n } = Sn(e);
	return mn.fromText(n, t);
}, "getDiagramFromText");
function $n(e, t, n, r) {
	fn(t, e), pn(t, n, r, t.attr("id"));
}
i($n, "addA11yInfo");
var Z = Object.freeze({
	render: Xn,
	parse: Bn,
	getDiagramFromText: Qn,
	initialize: Zn,
	getConfig: b,
	setConfig: g,
	getSiteConfig: s,
	updateSiteConfig: f,
	reset: /* @__PURE__ */ i(() => {
		c();
	}, "reset"),
	globalReset: /* @__PURE__ */ i(() => {
		c(O);
	}, "globalReset"),
	defaultConfig: O
});
n(b().logLevel), c(b());
var er = /* @__PURE__ */ i((e, t, n) => {
	r.warn(e), re(e) ? (n && n(e.str, e.hash), t.push({
		...e,
		message: e.str,
		error: e
	})) : (n && n(e), e instanceof Error && t.push({
		str: e.message,
		message: e.message,
		hash: e.name,
		error: e
	}));
}, "handleError"), tr = /* @__PURE__ */ i(async function(e = { querySelector: ".mermaid" }) {
	try {
		await nr(e);
	} catch (t) {
		if (re(t) && r.error(t.str), $.parseError && $.parseError(t), !e.suppressErrors) throw r.error("Use the suppressErrors option to suppress these errors"), t;
	}
}, "run"), nr = /* @__PURE__ */ i(async function({ postRenderCallback: e, querySelector: t, nodes: n } = { querySelector: ".mermaid" }) {
	let i = Z.getConfig();
	r.debug(`${e ? "" : "No "}Callback function found`);
	let a;
	if (n) a = n;
	else if (t) a = document.querySelectorAll(t);
	else throw Error("Nodes and querySelector are both undefined");
	r.debug(`Found ${a.length} diagrams`), (i == null ? void 0 : i.startOnLoad) !== void 0 && (r.debug("Start On Load: " + (i == null ? void 0 : i.startOnLoad)), Z.updateSiteConfig({ startOnLoad: i == null ? void 0 : i.startOnLoad }));
	let o = new j.InitIDGenerator(i.deterministicIds, i.deterministicIDSeed), s, c = [];
	for (let t of Array.from(a)) {
		if (r.info("Rendering diagram: " + t.id), t.getAttribute("data-processed")) continue;
		t.setAttribute("data-processed", "true");
		let n = `mermaid-${o.next()}`;
		s = t.innerHTML, s = ue(j.entityDecode(s)).trim().replace(/<br\s*\/?>/gi, "<br/>");
		let i = j.detectInit(s);
		i && r.debug("Detected early reinit: ", i);
		try {
			let { svg: r, bindFunctions: i } = await dr(n, s, t);
			t.innerHTML = r, e && await e(n), i && i(t);
		} catch (e) {
			er(e, c, $.parseError);
		}
	}
	if (c.length > 0) throw c[0];
}, "runThrowsErrors"), rr = /* @__PURE__ */ i(function(e) {
	Z.initialize(e);
}, "initialize"), ir = /* @__PURE__ */ i(async function(e, t, n) {
	r.warn("mermaid.init is deprecated. Please use run instead."), e && rr(e);
	let i = {
		postRenderCallback: n,
		querySelector: ".mermaid"
	};
	typeof t == "string" ? i.querySelector = t : t && (t instanceof HTMLElement ? i.nodes = [t] : i.nodes = t), await tr(i);
}, "init"), ar = /* @__PURE__ */ i(async (e, { lazyLoad: t = !0 } = {}) => {
	X(), d(...e), t === !1 && await un();
}, "registerExternalDiagrams"), or = /* @__PURE__ */ i(function() {
	if ($.startOnLoad) {
		let { startOnLoad: e } = Z.getConfig();
		e && $.run().catch((e) => r.error("Mermaid failed to initialize", e));
	}
}, "contentLoaded");
typeof document < "u" && window.addEventListener("load", or, !1);
var sr = /* @__PURE__ */ i(function(e) {
	$.parseError = e;
}, "setParseErrorHandler"), Q = [], cr = !1, lr = /* @__PURE__ */ i(async () => {
	if (!cr) {
		for (cr = !0; Q.length > 0;) {
			let e = Q.shift();
			if (e) try {
				await e();
			} catch (e) {
				r.error("Error executing queue", e);
			}
		}
		cr = !1;
	}
}, "executeQueue"), ur = /* @__PURE__ */ i(async (e, t) => new Promise((n, a) => {
	let o = /* @__PURE__ */ i(() => new Promise((i, o) => {
		Z.parse(e, t).then((e) => {
			i(e), n(e);
		}, (e) => {
			var t;
			r.error("Error parsing", e), (t = $.parseError) == null || t.call($, e), o(e), a(e);
		});
	}), "performCall");
	Q.push(o), lr().catch(a);
}), "parse"), dr = /* @__PURE__ */ i((e, t, n) => new Promise((a, o) => {
	let s = /* @__PURE__ */ i(() => new Promise((i, s) => {
		Z.render(e, t, n).then((e) => {
			i(e), a(e);
		}, (e) => {
			var t;
			r.error("Error parsing", e), (t = $.parseError) == null || t.call($, e), s(e), o(e);
		});
	}), "performCall");
	Q.push(s), lr().catch(o);
}), "render"), $ = {
	startOnLoad: !0,
	mermaidAPI: Z,
	parse: ur,
	render: dr,
	init: ir,
	run: tr,
	registerExternalDiagrams: ar,
	registerLayoutLoaders: de,
	initialize: rr,
	parseError: void 0,
	contentLoaded: or,
	setParseErrorHandler: sr,
	detectType: ee,
	registerIconPacks: le,
	getRegisteredDiagramsMetadata: /* @__PURE__ */ i(() => Object.keys(w).map((e) => ({ id: e })), "getRegisteredDiagramsMetadata")
}, fr = $;
//#endregion
export { fr as default, he as t };
