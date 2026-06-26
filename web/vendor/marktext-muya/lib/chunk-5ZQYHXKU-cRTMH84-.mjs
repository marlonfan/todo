import { i as e, r as t, t as n } from "./src-q1mJODQi.mjs";
import { R as r, h as i, p as a, r as o, s } from "./chunk-CSCIHK7Q-Bm1gw87X.mjs";
import { _ as c, a as l, c as u, d, f, g as ee, h as te, i as ne, l as re, m as ie, n as ae, o as oe, p as se, r as ce, s as le, t as ue, u as de, x as fe } from "./step-BLAKVGAu.mjs";
import { t as pe } from "./mermaid.core-ClIT2jZ-.mjs";
//#region ../../node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/bump.js
var me = class {
	constructor(e, t) {
		this._context = e, this._x = t;
	}
	areaStart() {
		this._line = 0;
	}
	areaEnd() {
		this._line = NaN;
	}
	lineStart() {
		this._point = 0;
	}
	lineEnd() {
		(this._line || this._line !== 0 && this._point === 1) && this._context.closePath(), this._line = 1 - this._line;
	}
	point(e, t) {
		switch (e = +e, t = +t, this._point) {
			case 0:
				this._point = 1, this._line ? this._context.lineTo(e, t) : this._context.moveTo(e, t);
				break;
			case 1: this._point = 2;
			default:
				this._x ? this._context.bezierCurveTo(this._x0 = (this._x0 + e) / 2, this._y0, this._x0, t, e, t) : this._context.bezierCurveTo(this._x0, this._y0 = (this._y0 + t) / 2, e, this._y0, e, t);
				break;
		}
		this._x0 = e, this._y0 = t;
	}
};
function he(e) {
	return new me(e, !0);
}
function ge(e) {
	return new me(e, !1);
}
//#endregion
//#region ../../node_modules/.pnpm/es-toolkit@1.46.1/node_modules/es-toolkit/dist/predicate/isLength.mjs
function _e(e) {
	return Number.isSafeInteger(e) && e >= 0;
}
//#endregion
//#region ../../node_modules/.pnpm/es-toolkit@1.46.1/node_modules/es-toolkit/dist/compat/predicate/isArrayLike.mjs
function p(e) {
	return e != null && typeof e != "function" && _e(e.length);
}
//#endregion
//#region ../../node_modules/.pnpm/es-toolkit@1.46.1/node_modules/es-toolkit/dist/_internal/isUnsafeProperty.mjs
function ve(e) {
	return e === "__proto__";
}
//#endregion
//#region ../../node_modules/.pnpm/es-toolkit@1.46.1/node_modules/es-toolkit/dist/predicate/isPrimitive.mjs
function m(e) {
	return e == null || typeof e != "object" && typeof e != "function";
}
//#endregion
//#region ../../node_modules/.pnpm/es-toolkit@1.46.1/node_modules/es-toolkit/dist/compat/_internal/getSymbols.mjs
function ye(e) {
	return Object.getOwnPropertySymbols(e).filter((t) => Object.prototype.propertyIsEnumerable.call(e, t));
}
//#endregion
//#region ../../node_modules/.pnpm/es-toolkit@1.46.1/node_modules/es-toolkit/dist/compat/_internal/getTag.mjs
function h(e) {
	return e == null ? e === void 0 ? "[object Undefined]" : "[object Null]" : Object.prototype.toString.call(e);
}
//#endregion
//#region ../../node_modules/.pnpm/es-toolkit@1.46.1/node_modules/es-toolkit/dist/compat/_internal/tags.mjs
var g = "[object RegExp]", _ = "[object String]", v = "[object Number]", y = "[object Boolean]", b = "[object Arguments]", be = "[object Symbol]", xe = "[object Date]", Se = "[object Map]", Ce = "[object Set]", we = "[object Array]", Te = "[object ArrayBuffer]", Ee = "[object Object]", x = "[object DataView]", S = "[object Uint8Array]", C = "[object Uint8ClampedArray]", w = "[object Uint16Array]", T = "[object Uint32Array]", E = "[object Int8Array]", D = "[object Int16Array]", O = "[object Int32Array]", k = "[object Float32Array]", A = "[object Float64Array]", j = typeof globalThis == "object" && globalThis || typeof window == "object" && window || typeof self == "object" && self || typeof global == "object" && global || (function() {
	return this;
})() || Function("return this")();
//#endregion
//#region ../../node_modules/.pnpm/es-toolkit@1.46.1/node_modules/es-toolkit/dist/predicate/isBuffer.mjs
function M(e) {
	return j.Buffer !== void 0 && j.Buffer.isBuffer(e);
}
//#endregion
//#region ../../node_modules/.pnpm/es-toolkit@1.46.1/node_modules/es-toolkit/dist/predicate/isTypedArray.mjs
function N(e) {
	return ArrayBuffer.isView(e) && !(e instanceof DataView);
}
//#endregion
//#region ../../node_modules/.pnpm/es-toolkit@1.46.1/node_modules/es-toolkit/dist/object/cloneDeepWith.mjs
function De(e, t) {
	return P(e, void 0, e, /* @__PURE__ */ new Map(), t);
}
function P(e, t, n, r = /* @__PURE__ */ new Map(), i = void 0) {
	let a = i == null ? void 0 : i(e, t, n, r);
	if (a !== void 0) return a;
	if (m(e)) return e;
	if (r.has(e)) return r.get(e);
	if (Array.isArray(e)) {
		let t = Array(e.length);
		r.set(e, t);
		for (let a = 0; a < e.length; a++) t[a] = P(e[a], a, n, r, i);
		return Object.hasOwn(e, "index") && (t.index = e.index), Object.hasOwn(e, "input") && (t.input = e.input), t;
	}
	if (e instanceof Date) return new Date(e.getTime());
	if (e instanceof RegExp) {
		let t = new RegExp(e.source, e.flags);
		return t.lastIndex = e.lastIndex, t;
	}
	if (e instanceof Map) {
		let t = /* @__PURE__ */ new Map();
		r.set(e, t);
		for (let [a, o] of e) t.set(a, P(o, a, n, r, i));
		return t;
	}
	if (e instanceof Set) {
		let t = /* @__PURE__ */ new Set();
		r.set(e, t);
		for (let a of e) t.add(P(a, void 0, n, r, i));
		return t;
	}
	if (M(e)) return e.subarray();
	if (N(e)) {
		let t = new (Object.getPrototypeOf(e)).constructor(e.length);
		r.set(e, t);
		for (let a = 0; a < e.length; a++) t[a] = P(e[a], a, n, r, i);
		return t;
	}
	if (e instanceof ArrayBuffer || typeof SharedArrayBuffer < "u" && e instanceof SharedArrayBuffer) return e.slice(0);
	if (e instanceof DataView) {
		let t = new DataView(e.buffer.slice(0), e.byteOffset, e.byteLength);
		return r.set(e, t), F(t, e, n, r, i), t;
	}
	if (typeof File < "u" && e instanceof File) {
		let t = new File([e], e.name, { type: e.type });
		return r.set(e, t), F(t, e, n, r, i), t;
	}
	if (typeof Blob < "u" && e instanceof Blob) {
		let t = new Blob([e], { type: e.type });
		return r.set(e, t), F(t, e, n, r, i), t;
	}
	if (e instanceof Error) {
		let t = structuredClone(e);
		return r.set(e, t), t.message = e.message, t.name = e.name, t.stack = e.stack, t.cause = e.cause, t.constructor = e.constructor, F(t, e, n, r, i), t;
	}
	if (e instanceof Boolean) {
		let t = new Boolean(e.valueOf());
		return r.set(e, t), F(t, e, n, r, i), t;
	}
	if (e instanceof Number) {
		let t = new Number(e.valueOf());
		return r.set(e, t), F(t, e, n, r, i), t;
	}
	if (e instanceof String) {
		let t = new String(e.valueOf());
		return r.set(e, t), F(t, e, n, r, i), t;
	}
	if (typeof e == "object" && Oe(e)) {
		let t = Object.create(Object.getPrototypeOf(e));
		return r.set(e, t), F(t, e, n, r, i), t;
	}
	return e;
}
function F(e, t, n = e, r, i) {
	let a = [...Object.keys(t), ...ye(t)];
	for (let o = 0; o < a.length; o++) {
		let s = a[o], c = Object.getOwnPropertyDescriptor(e, s);
		(c == null || c.writable) && (e[s] = P(t[s], s, n, r, i));
	}
}
function Oe(e) {
	switch (h(e)) {
		case b:
		case we:
		case Te:
		case x:
		case y:
		case xe:
		case k:
		case A:
		case E:
		case D:
		case O:
		case Se:
		case v:
		case Ee:
		case g:
		case Ce:
		case _:
		case be:
		case S:
		case C:
		case w:
		case T: return !0;
		default: return !1;
	}
}
//#endregion
//#region ../../node_modules/.pnpm/es-toolkit@1.46.1/node_modules/es-toolkit/dist/compat/object/cloneDeepWith.mjs
function ke(e, t) {
	return De(e, (n, r, i, a) => {
		let o = t == null ? void 0 : t(n, r, i, a);
		if (o !== void 0) return o;
		if (typeof e == "object") {
			if (h(e) === "[object Object]" && typeof e.constructor != "function") {
				let t = {};
				return a.set(e, t), F(t, e, i, a), t;
			}
			switch (Object.prototype.toString.call(e)) {
				case v:
				case _:
				case y: {
					let t = new e.constructor(e == null ? void 0 : e.valueOf());
					return F(t, e), t;
				}
				case b: {
					let t = {};
					return F(t, e), t.length = e.length, t[Symbol.iterator] = e[Symbol.iterator], t;
				}
				default: return;
			}
		}
	});
}
//#endregion
//#region ../../node_modules/.pnpm/es-toolkit@1.46.1/node_modules/es-toolkit/dist/compat/object/cloneDeep.mjs
function Ae(e) {
	return ke(e);
}
//#endregion
//#region ../../node_modules/.pnpm/es-toolkit@1.46.1/node_modules/es-toolkit/dist/compat/predicate/isArguments.mjs
function I(e) {
	return typeof e == "object" && !!e && h(e) === "[object Arguments]";
}
//#endregion
//#region ../../node_modules/.pnpm/es-toolkit@1.46.1/node_modules/es-toolkit/dist/compat/predicate/isObjectLike.mjs
function L(e) {
	return typeof e == "object" && !!e;
}
//#endregion
//#region ../../node_modules/.pnpm/es-toolkit@1.46.1/node_modules/es-toolkit/dist/compat/predicate/isArrayLikeObject.mjs
function je(e) {
	return L(e) && p(e);
}
//#endregion
//#region ../../node_modules/.pnpm/es-toolkit@1.46.1/node_modules/es-toolkit/dist/compat/function/memoize.mjs
function R(e, t) {
	if (typeof e != "function" || t != null && typeof t != "function") throw TypeError("Expected a function");
	let n = function(...r) {
		let i = t ? t.apply(this, r) : r[0], a = n.cache;
		if (a.has(i)) return a.get(i);
		let o = e.apply(this, r);
		return n.cache = a.set(i, o) || a, o;
	};
	return n.cache = new (R.Cache || Map)(), n;
}
R.Cache = Map;
//#endregion
//#region ../../node_modules/.pnpm/es-toolkit@1.46.1/node_modules/es-toolkit/dist/function/noop.mjs
function Me() {}
//#endregion
//#region ../../node_modules/.pnpm/es-toolkit@1.46.1/node_modules/es-toolkit/dist/compat/predicate/isTypedArray.mjs
function z(e) {
	return N(e);
}
//#endregion
//#region ../../node_modules/.pnpm/es-toolkit@1.46.1/node_modules/es-toolkit/dist/compat/predicate/isPlainObject.mjs
function B(e) {
	if (typeof e != "object" || !e) return !1;
	if (Object.getPrototypeOf(e) === null) return !0;
	if (Object.prototype.toString.call(e) !== "[object Object]") {
		var t;
		let n = e[Symbol.toStringTag];
		return n == null || !((t = Object.getOwnPropertyDescriptor(e, Symbol.toStringTag)) != null && t.writable) ? !1 : e.toString() === `[object ${n}]`;
	}
	let n = e;
	for (; Object.getPrototypeOf(n) !== null;) n = Object.getPrototypeOf(n);
	return Object.getPrototypeOf(e) === n;
}
//#endregion
//#region ../../node_modules/.pnpm/es-toolkit@1.46.1/node_modules/es-toolkit/dist/object/clone.mjs
function Ne(e) {
	if (m(e)) return e;
	if (Array.isArray(e) || N(e) || e instanceof ArrayBuffer || typeof SharedArrayBuffer < "u" && e instanceof SharedArrayBuffer) return e.slice(0);
	let t = Object.getPrototypeOf(e);
	if (t == null) return Object.assign(Object.create(t), e);
	let n = t.constructor;
	if (e instanceof Date || e instanceof Map || e instanceof Set) return new n(e);
	if (e instanceof RegExp) {
		let t = new n(e);
		return t.lastIndex = e.lastIndex, t;
	}
	if (e instanceof DataView) return new n(e.buffer.slice(0));
	if (e instanceof Error) {
		let t;
		return t = e instanceof AggregateError ? new n(e.errors, e.message, { cause: e.cause }) : new n(e.message, { cause: e.cause }), t.stack = e.stack, Object.assign(t, e), t;
	}
	return typeof File < "u" && e instanceof File ? new n([e], e.name, {
		type: e.type,
		lastModified: e.lastModified
	}) : typeof e == "object" ? Object.assign(Object.create(t), e) : e;
}
//#endregion
//#region ../../node_modules/.pnpm/es-toolkit@1.46.1/node_modules/es-toolkit/dist/compat/object/mergeWith.mjs
function Pe(e, ...t) {
	let n = t.slice(0, -1), r = t[t.length - 1], i = e;
	for (let e = 0; e < n.length; e++) {
		let t = n[e];
		i = V(i, t, r, /* @__PURE__ */ new Map());
	}
	return i;
}
function V(e, t, n, r) {
	if (m(e) && (e = Object(e)), typeof t != "object" || !t) return e;
	if (r.has(t)) return Ne(r.get(t));
	if (r.set(t, e), Array.isArray(t)) {
		t = t.slice();
		for (let e = 0; e < t.length; e++) {
			var i;
			t[e] = (i = t[e]) == null ? void 0 : i;
		}
	}
	let a = [...Object.keys(t), ...ye(t)];
	for (let i = 0; i < a.length; i++) {
		let o = a[i];
		if (ve(o)) continue;
		let s = t[o], c = e[o];
		if (I(s) && (s = { ...s }), I(c) && (c = { ...c }), M(s) && (s = Ae(s)), Array.isArray(s)) if (Array.isArray(c)) {
			let e = [], t = Reflect.ownKeys(c);
			for (let n = 0; n < t.length; n++) {
				let r = t[n];
				e[r] = c[r];
			}
			c = e;
		} else if (je(c)) {
			let e = [];
			for (let t = 0; t < c.length; t++) e[t] = c[t];
			c = e;
		} else c = [];
		let l = n(c, s, o, e, t, r);
		l === void 0 ? Array.isArray(s) || L(c) && L(s) && (B(c) || B(s) || z(c) || z(s)) ? e[o] = V(c, s, n, r) : c == null && B(s) ? e[o] = V({}, s, n, r) : c == null && z(s) ? e[o] = Ae(s) : (c === void 0 || s !== void 0) && (e[o] = s) : e[o] = l;
	}
	return e;
}
//#endregion
//#region ../../node_modules/.pnpm/es-toolkit@1.46.1/node_modules/es-toolkit/dist/compat/object/merge.mjs
function Fe(e, ...t) {
	return Pe(e, ...t, Me);
}
//#endregion
//#region ../../node_modules/.pnpm/mermaid@11.15.0/node_modules/mermaid/dist/chunks/mermaid.core/chunk-5ZQYHXKU.mjs
var Ie = pe(), H, Le = {
	curveBasis: c,
	curveBasisClosed: ee,
	curveBasisOpen: te,
	curveBumpX: he,
	curveBumpY: ge,
	curveBundle: ie,
	curveCardinalClosed: f,
	curveCardinalOpen: d,
	curveCardinal: se,
	curveCatmullRomClosed: re,
	curveCatmullRomOpen: u,
	curveCatmullRom: de,
	curveLinear: fe,
	curveLinearClosed: le,
	curveMonotoneX: l,
	curveMonotoneY: oe,
	curveNatural: ne,
	curveStep: ce,
	curveStepAfter: ue,
	curveStepBefore: ae
}, Re = /\s*(?:(\w+)(?=:):|(\w+))\s*(?:(\w+)|((?:(?!}%{2}).|\r?\n)*))?\s*(?:}%{2})?/gi, ze = /* @__PURE__ */ t(function(e, t) {
	let n = Be(e, /(?:init\b)|(?:initialize\b)/), i = {};
	if (Array.isArray(n)) {
		let e = n.map((e) => e.args);
		r(e), i = o(i, [...e]);
	} else i = n.args;
	if (!i) return;
	let s = a(e, t), c = "config";
	return i[c] !== void 0 && (s === "flowchart-v2" && (s = "flowchart"), i[s] = i[c], delete i[c]), i;
}, "detectInit"), Be = /* @__PURE__ */ t(function(t, n = null) {
	try {
		let o = RegExp(`[%]{2}(?![{]${Re.source})(?=[}][%]{2}).*
`, "ig");
		t = t.trim().replace(o, "").replace(/'/gm, "\""), e.debug(`Detecting diagram directive${n === null ? "" : " type:" + n} based on the text:${t}`);
		let s, c = [];
		for (; (s = i.exec(t)) !== null;) {
			var r, a;
			if (s.index === i.lastIndex && i.lastIndex++, s && !n || n && (r = s[1]) != null && r.match(n) || n && (a = s[2]) != null && a.match(n)) {
				let e = s[1] ? s[1] : s[2], t = s[3] ? s[3].trim() : s[4] ? JSON.parse(s[4].trim()) : null;
				c.push({
					type: e,
					args: t
				});
			}
		}
		return c.length === 0 ? {
			type: t,
			args: null
		} : c.length === 1 ? c[0] : c;
	} catch (r) {
		return e.error(`ERROR: ${r.message} - Unable to parse directive type: '${n}' based on the text: '${t}'`), {
			type: void 0,
			args: null
		};
	}
}, "detectDirective"), Ve = /* @__PURE__ */ t(function(e) {
	return e.replace(i, "");
}, "removeDirectives"), He = /* @__PURE__ */ t(function(e, t) {
	for (let [n, r] of t.entries()) if (r.match(e)) return n;
	return -1;
}, "isSubstringInArray");
function U(e, t) {
	var n;
	return e ? (n = Le[`curve${e.charAt(0).toUpperCase() + e.slice(1)}`]) == null ? t : n : t;
}
t(U, "interpolateToCurve");
function Ue(e, t) {
	let n = e.trim();
	if (n) return t.securityLevel === "loose" ? n : (0, Ie.sanitizeUrl)(n);
}
t(Ue, "formatUrl");
var We = /* @__PURE__ */ t((t, ...n) => {
	let r = t.split("."), i = r.length - 1, a = r[i], o = window;
	for (let n = 0; n < i; n++) if (o = o[r[n]], !o) {
		e.error(`Function name: ${t} not found in window`);
		return;
	}
	o[a](...n);
}, "runFunc");
function W(e, t) {
	return !e || !t ? 0 : Math.sqrt((t.x - e.x) ** 2 + (t.y - e.y) ** 2);
}
t(W, "distance");
function Ge(e) {
	let t, n = 0;
	return e.forEach((e) => {
		n += W(e, t), t = e;
	}), G(e, n / 2);
}
t(Ge, "traverseEdge");
function Ke(e) {
	return e.length === 1 ? e[0] : Ge(e);
}
t(Ke, "calcLabelPosition");
var qe = /* @__PURE__ */ t((e, t = 2) => {
	let n = 10 ** t;
	return Math.round(e * n) / n;
}, "roundNumber"), G = /* @__PURE__ */ t((e, t) => {
	let n, r = t;
	for (let t of e) {
		if (n) {
			let e = W(t, n);
			if (e === 0) return n;
			if (e < r) r -= e;
			else {
				let i = r / e;
				if (i <= 0) return n;
				if (i >= 1) return {
					x: t.x,
					y: t.y
				};
				if (i > 0 && i < 1) return {
					x: qe((1 - i) * n.x + i * t.x, 5),
					y: qe((1 - i) * n.y + i * t.y, 5)
				};
			}
		}
		n = t;
	}
	throw Error("Could not find a suitable point for the given distance");
}, "calculatePoint"), Je = /* @__PURE__ */ t((t, n, r) => {
	e.info(`our points ${JSON.stringify(n)}`), n[0] !== r && (n = n.reverse());
	let i = G(n, 25), a = t ? 10 : 5, o = Math.atan2(n[0].y - i.y, n[0].x - i.x), s = {
		x: 0,
		y: 0
	};
	return s.x = Math.sin(o) * a + (n[0].x + i.x) / 2, s.y = -Math.cos(o) * a + (n[0].y + i.y) / 2, s;
}, "calcCardinalityPosition");
function Ye(t, n, r) {
	let i = structuredClone(r);
	e.info("our points", i), n !== "start_left" && n !== "start_right" && i.reverse();
	let a = G(i, 25 + t), o = 10 + t * .5, s = Math.atan2(i[0].y - a.y, i[0].x - a.x), c = {
		x: 0,
		y: 0
	};
	return n === "start_left" ? (c.x = Math.sin(s + Math.PI) * o + (i[0].x + a.x) / 2, c.y = -Math.cos(s + Math.PI) * o + (i[0].y + a.y) / 2) : n === "end_right" ? (c.x = Math.sin(s - Math.PI) * o + (i[0].x + a.x) / 2 - 5, c.y = -Math.cos(s - Math.PI) * o + (i[0].y + a.y) / 2 - 5) : n === "end_left" ? (c.x = Math.sin(s) * o + (i[0].x + a.x) / 2 - 5, c.y = -Math.cos(s) * o + (i[0].y + a.y) / 2 - 5) : (c.x = Math.sin(s) * o + (i[0].x + a.x) / 2, c.y = -Math.cos(s) * o + (i[0].y + a.y) / 2), c;
}
t(Ye, "calcTerminalLabelPosition");
function K(e) {
	let t = "", n = "";
	for (let r of e) r !== void 0 && (r.startsWith("color:") || r.startsWith("text-align:") ? n = n + r + ";" : t = t + r + ";");
	return {
		style: t,
		labelStyle: n
	};
}
t(K, "getStylesFromArray");
var Xe = 0, Ze = /* @__PURE__ */ t(() => (Xe++, "id-" + Math.random().toString(36).substr(2, 12) + "-" + Xe), "generateId");
function Qe(e) {
	let t = "";
	for (let n = 0; n < e; n++) t += "0123456789abcdef".charAt(Math.floor(Math.random() * 16));
	return t;
}
t(Qe, "makeRandomHex");
var $e = /* @__PURE__ */ t((e) => Qe(e.length), "random"), et = /* @__PURE__ */ t(function() {
	return {
		x: 0,
		y: 0,
		fill: void 0,
		anchor: "start",
		style: "#666",
		width: 100,
		height: 100,
		textMargin: 0,
		rx: 0,
		ry: 0,
		valign: void 0,
		text: ""
	};
}, "getTextObj"), tt = /* @__PURE__ */ t(function(e, t) {
	let n = t.text.replace(s.lineBreakRegex, " "), [, r] = Z(t.fontSize), i = e.append("text");
	i.attr("x", t.x), i.attr("y", t.y), i.style("text-anchor", t.anchor), i.style("font-family", t.fontFamily), i.style("font-size", r), i.style("font-weight", t.fontWeight), i.attr("fill", t.fill), t.class !== void 0 && i.attr("class", t.class);
	let a = i.append("tspan");
	return a.attr("x", t.x + t.textMargin * 2), a.attr("fill", t.fill), a.text(n), i;
}, "drawSimpleText"), nt = R((e, t, n) => {
	if (!e || (n = Object.assign({
		fontSize: 12,
		fontWeight: 400,
		fontFamily: "Arial",
		joinWith: "<br/>"
	}, n), s.lineBreakRegex.test(e))) return e;
	let r = e.split(" ").filter(Boolean), i = [], a = "";
	return r.forEach((e, o) => {
		let s = J(`${e} `, n), c = J(a, n);
		if (s > t) {
			let { hyphenatedStrings: r, remainingWord: o } = rt(e, t, "-", n);
			i.push(a, ...r), a = o;
		} else c + s >= t ? (i.push(a), a = e) : a = [a, e].filter(Boolean).join(" ");
		o + 1 === r.length && i.push(a);
	}), i.filter((e) => e !== "").join(n.joinWith);
}, (e, t, n) => `${e}${t}${n.fontSize}${n.fontWeight}${n.fontFamily}${n.joinWith}`), rt = R((e, t, n = "-", r) => {
	r = Object.assign({
		fontSize: 12,
		fontWeight: 400,
		fontFamily: "Arial",
		margin: 0
	}, r);
	let i = [...e], a = [], o = "";
	return i.forEach((e, s) => {
		let c = `${o}${e}`;
		if (J(c, r) >= t) {
			let e = s + 1, t = i.length === e, r = `${c}${n}`;
			a.push(t ? c : r), o = "";
		} else o = c;
	}), {
		hyphenatedStrings: a,
		remainingWord: o
	};
}, (e, t, n = "-", r) => `${e}${t}${n}${r.fontSize}${r.fontWeight}${r.fontFamily}`);
function q(e, t) {
	return Y(e, t).height;
}
t(q, "calculateTextHeight");
function J(e, t) {
	return Y(e, t).width;
}
t(J, "calculateTextWidth");
var Y = R((e, t) => {
	let { fontSize: r = 12, fontFamily: i = "Arial", fontWeight: a = 400 } = t;
	if (!e) return {
		width: 0,
		height: 0
	};
	let [, o] = Z(r), c = ["sans-serif", i], l = e.split(s.lineBreakRegex), u = [], d = n("body");
	if (!d.remove) return {
		width: 0,
		height: 0,
		lineHeight: 0
	};
	let f = d.append("svg");
	for (let e of c) {
		let t = 0, n = {
			width: 0,
			height: 0,
			lineHeight: 0
		};
		for (let r of l) {
			let i = et();
			i.text = r || "​";
			let s = tt(f, i).style("font-size", o).style("font-weight", a).style("font-family", e), c = (s._groups || s)[0][0].getBBox();
			if (c.width === 0 && c.height === 0) throw Error("svg element not in render tree");
			n.width = Math.round(Math.max(n.width, c.width)), t = Math.round(c.height), n.height += t, n.lineHeight = Math.round(Math.max(n.lineHeight, t));
		}
		u.push(n);
	}
	return f.remove(), u[isNaN(u[1].height) || isNaN(u[1].width) || isNaN(u[1].lineHeight) || u[0].height > u[1].height && u[0].width > u[1].width && u[0].lineHeight > u[1].lineHeight ? 0 : 1];
}, (e, t) => `${e}${t.fontSize}${t.fontWeight}${t.fontFamily}`), it = (H = class {
	constructor(e = !1, t) {
		this.count = 0, this.count = t ? t.length : 0, this.next = e ? () => this.count++ : () => Date.now();
	}
}, t(H, "InitIDGenerator"), H), X, at = /* @__PURE__ */ t(function(e) {
	return X = X || document.createElement("div"), e = escape(e).replace(/%26/g, "&").replace(/%23/g, "#").replace(/%3B/g, ";"), X.innerHTML = e, unescape(X.textContent);
}, "entityDecode");
function ot(e) {
	return "str" in e;
}
t(ot, "isDetailedError");
var st = /* @__PURE__ */ t((e, t, n, r) => {
	var i;
	if (!r) return;
	let a = (i = e.node()) == null ? void 0 : i.getBBox();
	a && e.append("text").text(r).attr("text-anchor", "middle").attr("x", a.x + a.width / 2).attr("y", -n).attr("class", t);
}, "insertTitle"), Z = /* @__PURE__ */ t((e) => {
	if (typeof e == "number") return [e, e + "px"];
	let t = parseInt(e == null ? "" : e, 10);
	return Number.isNaN(t) ? [void 0, void 0] : e === String(t) ? [t, e + "px"] : [t, e];
}, "parseFontSize");
function Q(e, t) {
	return Fe({}, e, t);
}
t(Q, "cleanAndMerge");
var ct = {
	assignWithDepth: o,
	wrapLabel: nt,
	calculateTextHeight: q,
	calculateTextWidth: J,
	calculateTextDimensions: Y,
	cleanAndMerge: Q,
	detectInit: ze,
	detectDirective: Be,
	isSubstringInArray: He,
	interpolateToCurve: U,
	calcLabelPosition: Ke,
	calcCardinalityPosition: Je,
	calcTerminalLabelPosition: Ye,
	formatUrl: Ue,
	getStylesFromArray: K,
	generateId: Ze,
	random: $e,
	runFunc: We,
	entityDecode: at,
	insertTitle: st,
	isLabelCoordinateInPath: $,
	parseFontSize: Z,
	InitIDGenerator: it
}, lt = /* @__PURE__ */ t(function(e) {
	let t = e;
	return t = t.replace(/style.*:\S*#.*;/g, function(e) {
		return e.substring(0, e.length - 1);
	}), t = t.replace(/classDef.*:\S*#.*;/g, function(e) {
		return e.substring(0, e.length - 1);
	}), t = t.replace(/#\w+;/g, function(e) {
		let t = e.substring(1, e.length - 1);
		return /^\+?\d+$/.test(t) ? "ﬂ°°" + t + "¶ß" : "ﬂ°" + t + "¶ß";
	}), t;
}, "encodeEntities"), ut = /* @__PURE__ */ t(function(e) {
	return e.replace(/ﬂ°°/g, "&#").replace(/ﬂ°/g, "&").replace(/¶ß/g, ";");
}, "decodeEntities"), dt = /* @__PURE__ */ t((e, t, { counter: n = 0, prefix: r, suffix: i }, a) => a || `${r ? `${r}_` : ""}${e}_${t}_${n}${i ? `_${i}` : ""}`, "getEdgeId");
function ft(e) {
	return e == null ? null : e;
}
t(ft, "handleUndefinedAttr");
function $(e, t) {
	let n = Math.round(e.x), r = Math.round(e.y), i = t.replace(/(\d+\.\d+)/g, (e) => Math.round(parseFloat(e)).toString());
	return i.includes(n.toString()) || i.includes(r.toString());
}
t($, "isLabelCoordinateInPath");
//#endregion
export { O as A, T as B, we as C, k as D, xe as E, g as F, p as G, C as H, Ce as I, he as K, _ as L, Se as M, v as N, A as O, Ee as P, be as R, Te as S, x as T, h as U, S as V, m as W, nt as _, ut as a, M as b, dt as c, U as d, ot as f, ct as g, Ve as h, Q as i, E as j, D as k, K as l, $e as m, q as n, lt as o, Z as p, ge as q, J as r, Ze as s, Y as t, ft as u, z as v, y as w, b as x, I as y, w as z };
