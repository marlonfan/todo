import { n as e } from "./es/index.js";
//#region ../../node_modules/.pnpm/d3-dispatch@3.0.1/node_modules/d3-dispatch/src/dispatch.js
var t = { value: () => {} };
function n() {
	for (var e = 0, t = arguments.length, n = {}, i; e < t; ++e) {
		if (!(i = arguments[e] + "") || i in n || /[\s.]/.test(i)) throw Error("illegal type: " + i);
		n[i] = [];
	}
	return new r(n);
}
function r(e) {
	this._ = e;
}
function i(e, t) {
	return e.trim().split(/^|\s+/).map(function(e) {
		var n = "", r = e.indexOf(".");
		if (r >= 0 && (n = e.slice(r + 1), e = e.slice(0, r)), e && !t.hasOwnProperty(e)) throw Error("unknown type: " + e);
		return {
			type: e,
			name: n
		};
	});
}
r.prototype = n.prototype = {
	constructor: r,
	on: function(e, t) {
		var n = this._, r = i(e + "", n), s, c = -1, l = r.length;
		if (arguments.length < 2) {
			for (; ++c < l;) if ((s = (e = r[c]).type) && (s = a(n[s], e.name))) return s;
			return;
		}
		if (t != null && typeof t != "function") throw Error("invalid callback: " + t);
		for (; ++c < l;) if (s = (e = r[c]).type) n[s] = o(n[s], e.name, t);
		else if (t == null) for (s in n) n[s] = o(n[s], e.name, null);
		return this;
	},
	copy: function() {
		var e = {}, t = this._;
		for (var n in t) e[n] = t[n].slice();
		return new r(e);
	},
	call: function(e, t) {
		if ((i = arguments.length - 2) > 0) for (var n = Array(i), r = 0, i, a; r < i; ++r) n[r] = arguments[r + 2];
		if (!this._.hasOwnProperty(e)) throw Error("unknown type: " + e);
		for (a = this._[e], r = 0, i = a.length; r < i; ++r) a[r].value.apply(t, n);
	},
	apply: function(e, t, n) {
		if (!this._.hasOwnProperty(e)) throw Error("unknown type: " + e);
		for (var r = this._[e], i = 0, a = r.length; i < a; ++i) r[i].value.apply(t, n);
	}
};
function a(e, t) {
	for (var n = 0, r = e.length, i; n < r; ++n) if ((i = e[n]).name === t) return i.value;
}
function o(e, n, r) {
	for (var i = 0, a = e.length; i < a; ++i) if (e[i].name === n) {
		e[i] = t, e = e.slice(0, i).concat(e.slice(i + 1));
		break;
	}
	return r != null && e.push({
		name: n,
		value: r
	}), e;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-color@3.1.0/node_modules/d3-color/src/define.js
function s(e, t, n) {
	e.prototype = t.prototype = n, n.constructor = e;
}
function c(e, t) {
	var n = Object.create(e.prototype);
	for (var r in t) n[r] = t[r];
	return n;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-color@3.1.0/node_modules/d3-color/src/color.js
function l() {}
var u = .7, d = 1 / u, f = "\\s*([+-]?\\d+)\\s*", p = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*", m = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*", h = /^#([0-9a-f]{3,8})$/, g = RegExp(`^rgb\\(${f},${f},${f}\\)$`), _ = RegExp(`^rgb\\(${m},${m},${m}\\)$`), v = RegExp(`^rgba\\(${f},${f},${f},${p}\\)$`), y = RegExp(`^rgba\\(${m},${m},${m},${p}\\)$`), ee = RegExp(`^hsl\\(${p},${m},${m}\\)$`), te = RegExp(`^hsla\\(${p},${m},${m},${p}\\)$`), ne = {
	aliceblue: 15792383,
	antiquewhite: 16444375,
	aqua: 65535,
	aquamarine: 8388564,
	azure: 15794175,
	beige: 16119260,
	bisque: 16770244,
	black: 0,
	blanchedalmond: 16772045,
	blue: 255,
	blueviolet: 9055202,
	brown: 10824234,
	burlywood: 14596231,
	cadetblue: 6266528,
	chartreuse: 8388352,
	chocolate: 13789470,
	coral: 16744272,
	cornflowerblue: 6591981,
	cornsilk: 16775388,
	crimson: 14423100,
	cyan: 65535,
	darkblue: 139,
	darkcyan: 35723,
	darkgoldenrod: 12092939,
	darkgray: 11119017,
	darkgreen: 25600,
	darkgrey: 11119017,
	darkkhaki: 12433259,
	darkmagenta: 9109643,
	darkolivegreen: 5597999,
	darkorange: 16747520,
	darkorchid: 10040012,
	darkred: 9109504,
	darksalmon: 15308410,
	darkseagreen: 9419919,
	darkslateblue: 4734347,
	darkslategray: 3100495,
	darkslategrey: 3100495,
	darkturquoise: 52945,
	darkviolet: 9699539,
	deeppink: 16716947,
	deepskyblue: 49151,
	dimgray: 6908265,
	dimgrey: 6908265,
	dodgerblue: 2003199,
	firebrick: 11674146,
	floralwhite: 16775920,
	forestgreen: 2263842,
	fuchsia: 16711935,
	gainsboro: 14474460,
	ghostwhite: 16316671,
	gold: 16766720,
	goldenrod: 14329120,
	gray: 8421504,
	green: 32768,
	greenyellow: 11403055,
	grey: 8421504,
	honeydew: 15794160,
	hotpink: 16738740,
	indianred: 13458524,
	indigo: 4915330,
	ivory: 16777200,
	khaki: 15787660,
	lavender: 15132410,
	lavenderblush: 16773365,
	lawngreen: 8190976,
	lemonchiffon: 16775885,
	lightblue: 11393254,
	lightcoral: 15761536,
	lightcyan: 14745599,
	lightgoldenrodyellow: 16448210,
	lightgray: 13882323,
	lightgreen: 9498256,
	lightgrey: 13882323,
	lightpink: 16758465,
	lightsalmon: 16752762,
	lightseagreen: 2142890,
	lightskyblue: 8900346,
	lightslategray: 7833753,
	lightslategrey: 7833753,
	lightsteelblue: 11584734,
	lightyellow: 16777184,
	lime: 65280,
	limegreen: 3329330,
	linen: 16445670,
	magenta: 16711935,
	maroon: 8388608,
	mediumaquamarine: 6737322,
	mediumblue: 205,
	mediumorchid: 12211667,
	mediumpurple: 9662683,
	mediumseagreen: 3978097,
	mediumslateblue: 8087790,
	mediumspringgreen: 64154,
	mediumturquoise: 4772300,
	mediumvioletred: 13047173,
	midnightblue: 1644912,
	mintcream: 16121850,
	mistyrose: 16770273,
	moccasin: 16770229,
	navajowhite: 16768685,
	navy: 128,
	oldlace: 16643558,
	olive: 8421376,
	olivedrab: 7048739,
	orange: 16753920,
	orangered: 16729344,
	orchid: 14315734,
	palegoldenrod: 15657130,
	palegreen: 10025880,
	paleturquoise: 11529966,
	palevioletred: 14381203,
	papayawhip: 16773077,
	peachpuff: 16767673,
	peru: 13468991,
	pink: 16761035,
	plum: 14524637,
	powderblue: 11591910,
	purple: 8388736,
	rebeccapurple: 6697881,
	red: 16711680,
	rosybrown: 12357519,
	royalblue: 4286945,
	saddlebrown: 9127187,
	salmon: 16416882,
	sandybrown: 16032864,
	seagreen: 3050327,
	seashell: 16774638,
	sienna: 10506797,
	silver: 12632256,
	skyblue: 8900331,
	slateblue: 6970061,
	slategray: 7372944,
	slategrey: 7372944,
	snow: 16775930,
	springgreen: 65407,
	steelblue: 4620980,
	tan: 13808780,
	teal: 32896,
	thistle: 14204888,
	tomato: 16737095,
	turquoise: 4251856,
	violet: 15631086,
	wheat: 16113331,
	white: 16777215,
	whitesmoke: 16119285,
	yellow: 16776960,
	yellowgreen: 10145074
};
s(l, b, {
	copy(e) {
		return Object.assign(new this.constructor(), this, e);
	},
	displayable() {
		return this.rgb().displayable();
	},
	hex: re,
	formatHex: re,
	formatHex8: ie,
	formatHsl: ae,
	formatRgb: oe,
	toString: oe
});
function re() {
	return this.rgb().formatHex();
}
function ie() {
	return this.rgb().formatHex8();
}
function ae() {
	return pe(this).formatHsl();
}
function oe() {
	return this.rgb().formatRgb();
}
function b(e) {
	var t, n;
	return e = (e + "").trim().toLowerCase(), (t = h.exec(e)) ? (n = t[1].length, t = parseInt(t[1], 16), n === 6 ? se(t) : n === 3 ? new C(t >> 8 & 15 | t >> 4 & 240, t >> 4 & 15 | t & 240, (t & 15) << 4 | t & 15, 1) : n === 8 ? x(t >> 24 & 255, t >> 16 & 255, t >> 8 & 255, (t & 255) / 255) : n === 4 ? x(t >> 12 & 15 | t >> 8 & 240, t >> 8 & 15 | t >> 4 & 240, t >> 4 & 15 | t & 240, ((t & 15) << 4 | t & 15) / 255) : null) : (t = g.exec(e)) ? new C(t[1], t[2], t[3], 1) : (t = _.exec(e)) ? new C(t[1] * 255 / 100, t[2] * 255 / 100, t[3] * 255 / 100, 1) : (t = v.exec(e)) ? x(t[1], t[2], t[3], t[4]) : (t = y.exec(e)) ? x(t[1] * 255 / 100, t[2] * 255 / 100, t[3] * 255 / 100, t[4]) : (t = ee.exec(e)) ? fe(t[1], t[2] / 100, t[3] / 100, 1) : (t = te.exec(e)) ? fe(t[1], t[2] / 100, t[3] / 100, t[4]) : ne.hasOwnProperty(e) ? se(ne[e]) : e === "transparent" ? new C(NaN, NaN, NaN, 0) : null;
}
function se(e) {
	return new C(e >> 16 & 255, e >> 8 & 255, e & 255, 1);
}
function x(e, t, n, r) {
	return r <= 0 && (e = t = n = NaN), new C(e, t, n, r);
}
function ce(e) {
	return e instanceof l || (e = b(e)), e ? (e = e.rgb(), new C(e.r, e.g, e.b, e.opacity)) : new C();
}
function S(e, t, n, r) {
	return arguments.length === 1 ? ce(e) : new C(e, t, n, r == null ? 1 : r);
}
function C(e, t, n, r) {
	this.r = +e, this.g = +t, this.b = +n, this.opacity = +r;
}
s(C, S, c(l, {
	brighter(e) {
		return e = e == null ? d : d ** +e, new C(this.r * e, this.g * e, this.b * e, this.opacity);
	},
	darker(e) {
		return e = e == null ? u : u ** +e, new C(this.r * e, this.g * e, this.b * e, this.opacity);
	},
	rgb() {
		return this;
	},
	clamp() {
		return new C(T(this.r), T(this.g), T(this.b), w(this.opacity));
	},
	displayable() {
		return -.5 <= this.r && this.r < 255.5 && -.5 <= this.g && this.g < 255.5 && -.5 <= this.b && this.b < 255.5 && 0 <= this.opacity && this.opacity <= 1;
	},
	hex: le,
	formatHex: le,
	formatHex8: ue,
	formatRgb: de,
	toString: de
}));
function le() {
	return `#${E(this.r)}${E(this.g)}${E(this.b)}`;
}
function ue() {
	return `#${E(this.r)}${E(this.g)}${E(this.b)}${E((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
}
function de() {
	let e = w(this.opacity);
	return `${e === 1 ? "rgb(" : "rgba("}${T(this.r)}, ${T(this.g)}, ${T(this.b)}${e === 1 ? ")" : `, ${e})`}`;
}
function w(e) {
	return isNaN(e) ? 1 : Math.max(0, Math.min(1, e));
}
function T(e) {
	return Math.max(0, Math.min(255, Math.round(e) || 0));
}
function E(e) {
	return e = T(e), (e < 16 ? "0" : "") + e.toString(16);
}
function fe(e, t, n, r) {
	return r <= 0 ? e = t = n = NaN : n <= 0 || n >= 1 ? e = t = NaN : t <= 0 && (e = NaN), new D(e, t, n, r);
}
function pe(e) {
	if (e instanceof D) return new D(e.h, e.s, e.l, e.opacity);
	if (e instanceof l || (e = b(e)), !e) return new D();
	if (e instanceof D) return e;
	e = e.rgb();
	var t = e.r / 255, n = e.g / 255, r = e.b / 255, i = Math.min(t, n, r), a = Math.max(t, n, r), o = NaN, s = a - i, c = (a + i) / 2;
	return s ? (o = t === a ? (n - r) / s + (n < r) * 6 : n === a ? (r - t) / s + 2 : (t - n) / s + 4, s /= c < .5 ? a + i : 2 - a - i, o *= 60) : s = c > 0 && c < 1 ? 0 : o, new D(o, s, c, e.opacity);
}
function me(e, t, n, r) {
	return arguments.length === 1 ? pe(e) : new D(e, t, n, r == null ? 1 : r);
}
function D(e, t, n, r) {
	this.h = +e, this.s = +t, this.l = +n, this.opacity = +r;
}
s(D, me, c(l, {
	brighter(e) {
		return e = e == null ? d : d ** +e, new D(this.h, this.s, this.l * e, this.opacity);
	},
	darker(e) {
		return e = e == null ? u : u ** +e, new D(this.h, this.s, this.l * e, this.opacity);
	},
	rgb() {
		var e = this.h % 360 + (this.h < 0) * 360, t = isNaN(e) || isNaN(this.s) ? 0 : this.s, n = this.l, r = n + (n < .5 ? n : 1 - n) * t, i = 2 * n - r;
		return new C(ge(e >= 240 ? e - 240 : e + 120, i, r), ge(e, i, r), ge(e < 120 ? e + 240 : e - 120, i, r), this.opacity);
	},
	clamp() {
		return new D(he(this.h), O(this.s), O(this.l), w(this.opacity));
	},
	displayable() {
		return (0 <= this.s && this.s <= 1 || isNaN(this.s)) && 0 <= this.l && this.l <= 1 && 0 <= this.opacity && this.opacity <= 1;
	},
	formatHsl() {
		let e = w(this.opacity);
		return `${e === 1 ? "hsl(" : "hsla("}${he(this.h)}, ${O(this.s) * 100}%, ${O(this.l) * 100}%${e === 1 ? ")" : `, ${e})`}`;
	}
}));
function he(e) {
	return e = (e || 0) % 360, e < 0 ? e + 360 : e;
}
function O(e) {
	return Math.max(0, Math.min(1, e || 0));
}
function ge(e, t, n) {
	return (e < 60 ? t + (n - t) * e / 60 : e < 180 ? n : e < 240 ? t + (n - t) * (240 - e) / 60 : t) * 255;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-color@3.1.0/node_modules/d3-color/src/math.js
var _e = Math.PI / 180, ve = 180 / Math.PI, k = 18, ye = .96422, be = 1, xe = .82521, Se = 4 / 29, A = 6 / 29, Ce = 3 * A * A, we = A * A * A;
function Te(e) {
	if (e instanceof M) return new M(e.l, e.a, e.b, e.opacity);
	if (e instanceof N) return Me(e);
	e instanceof C || (e = ce(e));
	var t = ke(e.r), n = ke(e.g), r = ke(e.b), i = Ee((.2225045 * t + .7168786 * n + .0606169 * r) / be), a, o;
	return t === n && n === r ? a = o = i : (a = Ee((.4360747 * t + .3850649 * n + .1430804 * r) / ye), o = Ee((.0139322 * t + .0971045 * n + .7141733 * r) / xe)), new M(116 * i - 16, 500 * (a - i), 200 * (i - o), e.opacity);
}
function j(e, t, n, r) {
	return arguments.length === 1 ? Te(e) : new M(e, t, n, r == null ? 1 : r);
}
function M(e, t, n, r) {
	this.l = +e, this.a = +t, this.b = +n, this.opacity = +r;
}
s(M, j, c(l, {
	brighter(e) {
		return new M(this.l + k * (e == null ? 1 : e), this.a, this.b, this.opacity);
	},
	darker(e) {
		return new M(this.l - k * (e == null ? 1 : e), this.a, this.b, this.opacity);
	},
	rgb() {
		var e = (this.l + 16) / 116, t = isNaN(this.a) ? e : e + this.a / 500, n = isNaN(this.b) ? e : e - this.b / 200;
		return t = ye * De(t), e = be * De(e), n = xe * De(n), new C(Oe(3.1338561 * t - 1.6168667 * e - .4906146 * n), Oe(-.9787684 * t + 1.9161415 * e + .033454 * n), Oe(.0719453 * t - .2289914 * e + 1.4052427 * n), this.opacity);
	}
}));
function Ee(e) {
	return e > we ? e ** (1 / 3) : e / Ce + Se;
}
function De(e) {
	return e > A ? e * e * e : Ce * (e - Se);
}
function Oe(e) {
	return 255 * (e <= .0031308 ? 12.92 * e : 1.055 * e ** (1 / 2.4) - .055);
}
function ke(e) {
	return (e /= 255) <= .04045 ? e / 12.92 : ((e + .055) / 1.055) ** 2.4;
}
function Ae(e) {
	if (e instanceof N) return new N(e.h, e.c, e.l, e.opacity);
	if (e instanceof M || (e = Te(e)), e.a === 0 && e.b === 0) return new N(NaN, 0 < e.l && e.l < 100 ? 0 : NaN, e.l, e.opacity);
	var t = Math.atan2(e.b, e.a) * ve;
	return new N(t < 0 ? t + 360 : t, Math.sqrt(e.a * e.a + e.b * e.b), e.l, e.opacity);
}
function je(e, t, n, r) {
	return arguments.length === 1 ? Ae(e) : new N(e, t, n, r == null ? 1 : r);
}
function N(e, t, n, r) {
	this.h = +e, this.c = +t, this.l = +n, this.opacity = +r;
}
function Me(e) {
	if (isNaN(e.h)) return new M(e.l, 0, 0, e.opacity);
	var t = e.h * _e;
	return new M(e.l, Math.cos(t) * e.c, Math.sin(t) * e.c, e.opacity);
}
s(N, je, c(l, {
	brighter(e) {
		return new N(this.h, this.c, this.l + k * (e == null ? 1 : e), this.opacity);
	},
	darker(e) {
		return new N(this.h, this.c, this.l - k * (e == null ? 1 : e), this.opacity);
	},
	rgb() {
		return Me(this).rgb();
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/d3-color@3.1.0/node_modules/d3-color/src/cubehelix.js
var Ne = -.14861, Pe = 1.78277, Fe = -.29227, Ie = -.90649, P = 1.97294, Le = P * Ie, Re = P * Pe, ze = Pe * Fe - Ie * Ne;
function Be(e) {
	if (e instanceof F) return new F(e.h, e.s, e.l, e.opacity);
	e instanceof C || (e = ce(e));
	var t = e.r / 255, n = e.g / 255, r = e.b / 255, i = (ze * r + Le * t - Re * n) / (ze + Le - Re), a = r - i, o = (P * (n - i) - Fe * a) / Ie, s = Math.sqrt(o * o + a * a) / (P * i * (1 - i)), c = s ? Math.atan2(o, a) * ve - 120 : NaN;
	return new F(c < 0 ? c + 360 : c, s, i, e.opacity);
}
function Ve(e, t, n, r) {
	return arguments.length === 1 ? Be(e) : new F(e, t, n, r == null ? 1 : r);
}
function F(e, t, n, r) {
	this.h = +e, this.s = +t, this.l = +n, this.opacity = +r;
}
s(F, Ve, c(l, {
	brighter(e) {
		return e = e == null ? d : d ** +e, new F(this.h, this.s, this.l * e, this.opacity);
	},
	darker(e) {
		return e = e == null ? u : u ** +e, new F(this.h, this.s, this.l * e, this.opacity);
	},
	rgb() {
		var e = isNaN(this.h) ? 0 : (this.h + 120) * _e, t = +this.l, n = isNaN(this.s) ? 0 : this.s * t * (1 - t), r = Math.cos(e), i = Math.sin(e);
		return new C(255 * (t + n * (Ne * r + Pe * i)), 255 * (t + n * (Fe * r + Ie * i)), 255 * (t + P * r * n), this.opacity);
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/basis.js
function He(e, t, n, r, i) {
	var a = e * e, o = a * e;
	return ((1 - 3 * e + 3 * a - o) * t + (4 - 6 * a + 3 * o) * n + (1 + 3 * e + 3 * a - 3 * o) * r + o * i) / 6;
}
function Ue(e) {
	var t = e.length - 1;
	return function(n) {
		var r = n <= 0 ? n = 0 : n >= 1 ? (n = 1, t - 1) : Math.floor(n * t), i = e[r], a = e[r + 1], o = r > 0 ? e[r - 1] : 2 * i - a, s = r < t - 1 ? e[r + 2] : 2 * a - i;
		return He((n - r / t) * t, o, i, a, s);
	};
}
//#endregion
//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/basisClosed.js
function We(e) {
	var t = e.length;
	return function(n) {
		var r = Math.floor(((n %= 1) < 0 ? ++n : n) * t), i = e[(r + t - 1) % t], a = e[r % t], o = e[(r + 1) % t], s = e[(r + 2) % t];
		return He((n - r / t) * t, i, a, o, s);
	};
}
//#endregion
//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/constant.js
var I = (e) => () => e;
//#endregion
//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/color.js
function Ge(e, t) {
	return function(n) {
		return e + n * t;
	};
}
function Ke(e, t, n) {
	return e **= +n, t = t ** +n - e, n = 1 / n, function(r) {
		return (e + r * t) ** +n;
	};
}
function L(e, t) {
	var n = t - e;
	return n ? Ge(e, n > 180 || n < -180 ? n - 360 * Math.round(n / 360) : n) : I(isNaN(e) ? t : e);
}
function qe(e) {
	return (e = +e) == 1 ? R : function(t, n) {
		return n - t ? Ke(t, n, e) : I(isNaN(t) ? n : t);
	};
}
function R(e, t) {
	var n = t - e;
	return n ? Ge(e, n) : I(isNaN(e) ? t : e);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/rgb.js
var z = (function e(t) {
	var n = qe(t);
	function r(e, t) {
		var r = n((e = S(e)).r, (t = S(t)).r), i = n(e.g, t.g), a = n(e.b, t.b), o = R(e.opacity, t.opacity);
		return function(t) {
			return e.r = r(t), e.g = i(t), e.b = a(t), e.opacity = o(t), e + "";
		};
	}
	return r.gamma = e, r;
})(1);
function Je(e) {
	return function(t) {
		var n = t.length, r = Array(n), i = Array(n), a = Array(n), o, s;
		for (o = 0; o < n; ++o) s = S(t[o]), r[o] = s.r || 0, i[o] = s.g || 0, a[o] = s.b || 0;
		return r = e(r), i = e(i), a = e(a), s.opacity = 1, function(e) {
			return s.r = r(e), s.g = i(e), s.b = a(e), s + "";
		};
	};
}
var Ye = Je(Ue), Xe = Je(We);
//#endregion
//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/numberArray.js
function Ze(e, t) {
	t || (t = []);
	var n = e ? Math.min(t.length, e.length) : 0, r = t.slice(), i;
	return function(a) {
		for (i = 0; i < n; ++i) r[i] = e[i] * (1 - a) + t[i] * a;
		return r;
	};
}
function Qe(e) {
	return ArrayBuffer.isView(e) && !(e instanceof DataView);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/array.js
function $e(e, t) {
	return (Qe(t) ? Ze : et)(e, t);
}
function et(e, t) {
	var n = t ? t.length : 0, r = e ? Math.min(n, e.length) : 0, i = Array(r), a = Array(n), o;
	for (o = 0; o < r; ++o) i[o] = V(e[o], t[o]);
	for (; o < n; ++o) a[o] = t[o];
	return function(e) {
		for (o = 0; o < r; ++o) a[o] = i[o](e);
		return a;
	};
}
//#endregion
//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/date.js
function tt(e, t) {
	var n = /* @__PURE__ */ new Date();
	return e = +e, t = +t, function(r) {
		return n.setTime(e * (1 - r) + t * r), n;
	};
}
//#endregion
//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/number.js
function B(e, t) {
	return e = +e, t = +t, function(n) {
		return e * (1 - n) + t * n;
	};
}
//#endregion
//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/object.js
function nt(e, t) {
	var n = {}, r = {}, i;
	for (i in (typeof e != "object" || !e) && (e = {}), (typeof t != "object" || !t) && (t = {}), t) i in e ? n[i] = V(e[i], t[i]) : r[i] = t[i];
	return function(e) {
		for (i in n) r[i] = n[i](e);
		return r;
	};
}
//#endregion
//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/string.js
var rt = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g, it = new RegExp(rt.source, "g");
function at(e) {
	return function() {
		return e;
	};
}
function ot(e) {
	return function(t) {
		return e(t) + "";
	};
}
function st(e, t) {
	var n = rt.lastIndex = it.lastIndex = 0, r, i, a, o = -1, s = [], c = [];
	for (e += "", t += ""; (r = rt.exec(e)) && (i = it.exec(t));) (a = i.index) > n && (a = t.slice(n, a), s[o] ? s[o] += a : s[++o] = a), (r = r[0]) === (i = i[0]) ? s[o] ? s[o] += i : s[++o] = i : (s[++o] = null, c.push({
		i: o,
		x: B(r, i)
	})), n = it.lastIndex;
	return n < t.length && (a = t.slice(n), s[o] ? s[o] += a : s[++o] = a), s.length < 2 ? c[0] ? ot(c[0].x) : at(t) : (t = c.length, function(e) {
		for (var n = 0, r; n < t; ++n) s[(r = c[n]).i] = r.x(e);
		return s.join("");
	});
}
//#endregion
//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/value.js
function V(e, t) {
	var n = typeof t, r;
	return t == null || n === "boolean" ? I(t) : (n === "number" ? B : n === "string" ? (r = b(t)) ? (t = r, z) : st : t instanceof b ? z : t instanceof Date ? tt : Qe(t) ? Ze : Array.isArray(t) ? et : typeof t.valueOf != "function" && typeof t.toString != "function" || isNaN(t) ? nt : B)(e, t);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/discrete.js
function ct(e) {
	var t = e.length;
	return function(n) {
		return e[Math.max(0, Math.min(t - 1, Math.floor(n * t)))];
	};
}
//#endregion
//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/hue.js
function lt(e, t) {
	var n = L(+e, +t);
	return function(e) {
		var t = n(e);
		return t - 360 * Math.floor(t / 360);
	};
}
//#endregion
//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/round.js
function ut(e, t) {
	return e = +e, t = +t, function(n) {
		return Math.round(e * (1 - n) + t * n);
	};
}
//#endregion
//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/transform/decompose.js
var dt = 180 / Math.PI, ft = {
	translateX: 0,
	translateY: 0,
	rotate: 0,
	skewX: 0,
	scaleX: 1,
	scaleY: 1
};
function pt(e, t, n, r, i, a) {
	var o, s, c;
	return (o = Math.sqrt(e * e + t * t)) && (e /= o, t /= o), (c = e * n + t * r) && (n -= e * c, r -= t * c), (s = Math.sqrt(n * n + r * r)) && (n /= s, r /= s, c /= s), e * r < t * n && (e = -e, t = -t, c = -c, o = -o), {
		translateX: i,
		translateY: a,
		rotate: Math.atan2(t, e) * dt,
		skewX: Math.atan(c) * dt,
		scaleX: o,
		scaleY: s
	};
}
//#endregion
//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/transform/parse.js
var H;
function mt(e) {
	let t = new (typeof DOMMatrix == "function" ? DOMMatrix : WebKitCSSMatrix)(e + "");
	return t.isIdentity ? ft : pt(t.a, t.b, t.c, t.d, t.e, t.f);
}
function ht(e) {
	return e == null || (H || (H = document.createElementNS("http://www.w3.org/2000/svg", "g")), H.setAttribute("transform", e), !(e = H.transform.baseVal.consolidate())) ? ft : (e = e.matrix, pt(e.a, e.b, e.c, e.d, e.e, e.f));
}
//#endregion
//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/transform/index.js
function gt(e, t, n, r) {
	function i(e) {
		return e.length ? e.pop() + " " : "";
	}
	function a(e, r, i, a, o, s) {
		if (e !== i || r !== a) {
			var c = o.push("translate(", null, t, null, n);
			s.push({
				i: c - 4,
				x: B(e, i)
			}, {
				i: c - 2,
				x: B(r, a)
			});
		} else (i || a) && o.push("translate(" + i + t + a + n);
	}
	function o(e, t, n, a) {
		e === t ? t && n.push(i(n) + "rotate(" + t + r) : (e - t > 180 ? t += 360 : t - e > 180 && (e += 360), a.push({
			i: n.push(i(n) + "rotate(", null, r) - 2,
			x: B(e, t)
		}));
	}
	function s(e, t, n, a) {
		e === t ? t && n.push(i(n) + "skewX(" + t + r) : a.push({
			i: n.push(i(n) + "skewX(", null, r) - 2,
			x: B(e, t)
		});
	}
	function c(e, t, n, r, a, o) {
		if (e !== n || t !== r) {
			var s = a.push(i(a) + "scale(", null, ",", null, ")");
			o.push({
				i: s - 4,
				x: B(e, n)
			}, {
				i: s - 2,
				x: B(t, r)
			});
		} else (n !== 1 || r !== 1) && a.push(i(a) + "scale(" + n + "," + r + ")");
	}
	return function(t, n) {
		var r = [], i = [];
		return t = e(t), n = e(n), a(t.translateX, t.translateY, n.translateX, n.translateY, r, i), o(t.rotate, n.rotate, r, i), s(t.skewX, n.skewX, r, i), c(t.scaleX, t.scaleY, n.scaleX, n.scaleY, r, i), t = n = null, function(e) {
			for (var t = -1, n = i.length, a; ++t < n;) r[(a = i[t]).i] = a.x(e);
			return r.join("");
		};
	};
}
var _t = gt(mt, "px, ", "px)", "deg)"), vt = gt(ht, ", ", ")", ")"), yt = 1e-12;
function bt(e) {
	return ((e = Math.exp(e)) + 1 / e) / 2;
}
function xt(e) {
	return ((e = Math.exp(e)) - 1 / e) / 2;
}
function St(e) {
	return ((e = Math.exp(2 * e)) - 1) / (e + 1);
}
var Ct = (function e(t, n, r) {
	function i(e, i) {
		var a = e[0], o = e[1], s = e[2], c = i[0], l = i[1], u = i[2], d = c - a, f = l - o, p = d * d + f * f, m, h;
		if (p < yt) h = Math.log(u / s) / t, m = function(e) {
			return [
				a + e * d,
				o + e * f,
				s * Math.exp(t * e * h)
			];
		};
		else {
			var g = Math.sqrt(p), _ = (u * u - s * s + r * p) / (2 * s * n * g), v = (u * u - s * s - r * p) / (2 * u * n * g), y = Math.log(Math.sqrt(_ * _ + 1) - _);
			h = (Math.log(Math.sqrt(v * v + 1) - v) - y) / t, m = function(e) {
				var r = e * h, i = bt(y), c = s / (n * g) * (i * St(t * r + y) - xt(y));
				return [
					a + c * d,
					o + c * f,
					s * i / bt(t * r + y)
				];
			};
		}
		return m.duration = h * 1e3 * t / Math.SQRT2, m;
	}
	return i.rho = function(t) {
		var n = Math.max(.001, +t), r = n * n;
		return e(n, r, r * r);
	}, i;
})(Math.SQRT2, 2, 4);
//#endregion
//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/hsl.js
function wt(e) {
	return function(t, n) {
		var r = e((t = me(t)).h, (n = me(n)).h), i = R(t.s, n.s), a = R(t.l, n.l), o = R(t.opacity, n.opacity);
		return function(e) {
			return t.h = r(e), t.s = i(e), t.l = a(e), t.opacity = o(e), t + "";
		};
	};
}
var Tt = wt(L), Et = wt(R);
//#endregion
//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/lab.js
function Dt(e, t) {
	var n = R((e = j(e)).l, (t = j(t)).l), r = R(e.a, t.a), i = R(e.b, t.b), a = R(e.opacity, t.opacity);
	return function(t) {
		return e.l = n(t), e.a = r(t), e.b = i(t), e.opacity = a(t), e + "";
	};
}
//#endregion
//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/hcl.js
function Ot(e) {
	return function(t, n) {
		var r = e((t = je(t)).h, (n = je(n)).h), i = R(t.c, n.c), a = R(t.l, n.l), o = R(t.opacity, n.opacity);
		return function(e) {
			return t.h = r(e), t.c = i(e), t.l = a(e), t.opacity = o(e), t + "";
		};
	};
}
var kt = Ot(L), At = Ot(R);
//#endregion
//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/cubehelix.js
function jt(e) {
	return (function t(n) {
		n = +n;
		function r(t, r) {
			var i = e((t = Ve(t)).h, (r = Ve(r)).h), a = R(t.s, r.s), o = R(t.l, r.l), s = R(t.opacity, r.opacity);
			return function(e) {
				return t.h = i(e), t.s = a(e), t.l = o(e ** +n), t.opacity = s(e), t + "";
			};
		}
		return r.gamma = t, r;
	})(1);
}
var Mt = jt(L), Nt = jt(R);
//#endregion
//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/piecewise.js
function Pt(e, t) {
	t === void 0 && (t = e, e = V);
	for (var n = 0, r = t.length - 1, i = t[0], a = Array(r < 0 ? 0 : r); n < r;) a[n] = e(i, i = t[++n]);
	return function(e) {
		var t = Math.max(0, Math.min(r - 1, Math.floor(e *= r)));
		return a[t](e - t);
	};
}
//#endregion
//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/quantize.js
function Ft(e, t) {
	for (var n = Array(t), r = 0; r < t; ++r) n[r] = e(r / (t - 1));
	return n;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-interpolate@3.0.1/node_modules/d3-interpolate/src/index.js
var It = /* @__PURE__ */ e({
	interpolate: () => V,
	interpolateArray: () => $e,
	interpolateBasis: () => Ue,
	interpolateBasisClosed: () => We,
	interpolateCubehelix: () => Mt,
	interpolateCubehelixLong: () => Nt,
	interpolateDate: () => tt,
	interpolateDiscrete: () => ct,
	interpolateHcl: () => kt,
	interpolateHclLong: () => At,
	interpolateHsl: () => Tt,
	interpolateHslLong: () => Et,
	interpolateHue: () => lt,
	interpolateLab: () => Dt,
	interpolateNumber: () => B,
	interpolateNumberArray: () => Ze,
	interpolateObject: () => nt,
	interpolateRgb: () => z,
	interpolateRgbBasis: () => Ye,
	interpolateRgbBasisClosed: () => Xe,
	interpolateRound: () => ut,
	interpolateString: () => st,
	interpolateTransformCss: () => _t,
	interpolateTransformSvg: () => vt,
	interpolateZoom: () => Ct,
	piecewise: () => Pt,
	quantize: () => Ft
}), U = 0, W = 0, G = 0, Lt = 1e3, K, q, Rt = 0, J = 0, zt = 0, Y = typeof performance == "object" && performance.now ? performance : Date, Bt = typeof window == "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(e) {
	setTimeout(e, 17);
};
function Vt() {
	return J || (Bt(Ht), J = Y.now() + zt);
}
function Ht() {
	J = 0;
}
function Ut() {
	this._call = this._time = this._next = null;
}
Ut.prototype = Wt.prototype = {
	constructor: Ut,
	restart: function(e, t, n) {
		if (typeof e != "function") throw TypeError("callback is not a function");
		n = (n == null ? Vt() : +n) + (t == null ? 0 : +t), !this._next && q !== this && (q ? q._next = this : K = this, q = this), this._call = e, this._time = n, Yt();
	},
	stop: function() {
		this._call && (this._call = null, this._time = Infinity, Yt());
	}
};
function Wt(e, t, n) {
	var r = new Ut();
	return r.restart(e, t, n), r;
}
function Gt() {
	Vt(), ++U;
	for (var e = K, t; e;) (t = J - e._time) >= 0 && e._call.call(void 0, t), e = e._next;
	--U;
}
function Kt() {
	J = (Rt = Y.now()) + zt, U = W = 0;
	try {
		Gt();
	} finally {
		U = 0, Jt(), J = 0;
	}
}
function qt() {
	var e = Y.now(), t = e - Rt;
	t > Lt && (zt -= t, Rt = e);
}
function Jt() {
	for (var e, t = K, n, r = Infinity; t;) t._call ? (r > t._time && (r = t._time), e = t, t = t._next) : (n = t._next, t._next = null, t = e ? e._next = n : K = n);
	q = e, Yt(r);
}
function Yt(e) {
	U || (W && (W = clearTimeout(W)), e - J > 24 ? (e < Infinity && (W = setTimeout(Kt, e - Y.now() - zt)), G && (G = clearInterval(G))) : (G || (Rt = Y.now(), G = setInterval(qt, Lt)), U = 1, Bt(Kt)));
}
//#endregion
//#region ../../node_modules/.pnpm/d3-path@3.1.0/node_modules/d3-path/src/path.js
var Xt = Math.PI, Zt = 2 * Xt, X = 1e-6, Qt = Zt - X;
function $t(e) {
	this._ += e[0];
	for (let t = 1, n = e.length; t < n; ++t) this._ += arguments[t] + e[t];
}
function en(e) {
	let t = Math.floor(e);
	if (!(t >= 0)) throw Error(`invalid digits: ${e}`);
	if (t > 15) return $t;
	let n = 10 ** t;
	return function(e) {
		this._ += e[0];
		for (let t = 1, r = e.length; t < r; ++t) this._ += Math.round(arguments[t] * n) / n + e[t];
	};
}
var tn = class {
	constructor(e) {
		this._x0 = this._y0 = this._x1 = this._y1 = null, this._ = "", this._append = e == null ? $t : en(e);
	}
	moveTo(e, t) {
		this._append`M${this._x0 = this._x1 = +e},${this._y0 = this._y1 = +t}`;
	}
	closePath() {
		this._x1 !== null && (this._x1 = this._x0, this._y1 = this._y0, this._append`Z`);
	}
	lineTo(e, t) {
		this._append`L${this._x1 = +e},${this._y1 = +t}`;
	}
	quadraticCurveTo(e, t, n, r) {
		this._append`Q${+e},${+t},${this._x1 = +n},${this._y1 = +r}`;
	}
	bezierCurveTo(e, t, n, r, i, a) {
		this._append`C${+e},${+t},${+n},${+r},${this._x1 = +i},${this._y1 = +a}`;
	}
	arcTo(e, t, n, r, i) {
		if (e = +e, t = +t, n = +n, r = +r, i = +i, i < 0) throw Error(`negative radius: ${i}`);
		let a = this._x1, o = this._y1, s = n - e, c = r - t, l = a - e, u = o - t, d = l * l + u * u;
		if (this._x1 === null) this._append`M${this._x1 = e},${this._y1 = t}`;
		else if (d > X) if (!(Math.abs(u * s - c * l) > X) || !i) this._append`L${this._x1 = e},${this._y1 = t}`;
		else {
			let f = n - a, p = r - o, m = s * s + c * c, h = f * f + p * p, g = Math.sqrt(m), _ = Math.sqrt(d), v = i * Math.tan((Xt - Math.acos((m + d - h) / (2 * g * _))) / 2), y = v / _, ee = v / g;
			Math.abs(y - 1) > X && this._append`L${e + y * l},${t + y * u}`, this._append`A${i},${i},0,0,${+(u * f > l * p)},${this._x1 = e + ee * s},${this._y1 = t + ee * c}`;
		}
	}
	arc(e, t, n, r, i, a) {
		if (e = +e, t = +t, n = +n, a = !!a, n < 0) throw Error(`negative radius: ${n}`);
		let o = n * Math.cos(r), s = n * Math.sin(r), c = e + o, l = t + s, u = 1 ^ a, d = a ? r - i : i - r;
		this._x1 === null ? this._append`M${c},${l}` : (Math.abs(this._x1 - c) > X || Math.abs(this._y1 - l) > X) && this._append`L${c},${l}`, n && (d < 0 && (d = d % Zt + Zt), d > Qt ? this._append`A${n},${n},0,1,${u},${e - o},${t - s}A${n},${n},0,1,${u},${this._x1 = c},${this._y1 = l}` : d > X && this._append`A${n},${n},0,${+(d >= Xt)},${u},${this._x1 = e + n * Math.cos(i)},${this._y1 = t + n * Math.sin(i)}`);
	}
	rect(e, t, n, r) {
		this._append`M${this._x0 = this._x1 = +e},${this._y0 = this._y1 = +t}h${n = +n}v${+r}h${-n}Z`;
	}
	toString() {
		return this._;
	}
};
function nn() {
	return new tn();
}
nn.prototype = tn.prototype;
//#endregion
//#region ../../node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/constant.js
function Z(e) {
	return function() {
		return e;
	};
}
//#endregion
//#region ../../node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/math.js
var rn = Math.abs, an = Math.atan2, on = Math.cos, sn = Math.max, cn = Math.min, ln = Math.sin, un = Math.sqrt, dn = 1e-12, fn = Math.PI, pn = fn / 2, mn = 2 * fn;
function hn(e) {
	return e > 1 ? 0 : e < -1 ? fn : Math.acos(e);
}
function gn(e) {
	return e >= 1 ? pn : e <= -1 ? -pn : Math.asin(e);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/path.js
function _n(e) {
	let t = 3;
	return e.digits = function(n) {
		if (!arguments.length) return t;
		if (n == null) t = null;
		else {
			let e = Math.floor(n);
			if (!(e >= 0)) throw RangeError(`invalid digits: ${n}`);
			t = e;
		}
		return e;
	}, () => new tn(t);
}
Array.prototype.slice;
function vn(e) {
	return typeof e == "object" && "length" in e ? e : Array.from(e);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/linear.js
function yn(e) {
	this._context = e;
}
yn.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._point = 0;
	},
	lineEnd: function() {
		(this._line || this._line !== 0 && this._point === 1) && this._context.closePath(), this._line = 1 - this._line;
	},
	point: function(e, t) {
		switch (e = +e, t = +t, this._point) {
			case 0:
				this._point = 1, this._line ? this._context.lineTo(e, t) : this._context.moveTo(e, t);
				break;
			case 1: this._point = 2;
			default:
				this._context.lineTo(e, t);
				break;
		}
	}
};
function bn(e) {
	return new yn(e);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/point.js
function xn(e) {
	return e[0];
}
function Sn(e) {
	return e[1];
}
//#endregion
//#region ../../node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/line.js
function Cn(e, t) {
	var n = Z(!0), r = null, i = bn, a = null, o = _n(s);
	e = typeof e == "function" ? e : e === void 0 ? xn : Z(e), t = typeof t == "function" ? t : t === void 0 ? Sn : Z(t);
	function s(s) {
		var c, l = (s = vn(s)).length, u, d = !1, f;
		for (r == null && (a = i(f = o())), c = 0; c <= l; ++c) !(c < l && n(u = s[c], c, s)) === d && ((d = !d) ? a.lineStart() : a.lineEnd()), d && a.point(+e(u, c, s), +t(u, c, s));
		if (f) return a = null, f + "" || null;
	}
	return s.x = function(t) {
		return arguments.length ? (e = typeof t == "function" ? t : Z(+t), s) : e;
	}, s.y = function(e) {
		return arguments.length ? (t = typeof e == "function" ? e : Z(+e), s) : t;
	}, s.defined = function(e) {
		return arguments.length ? (n = typeof e == "function" ? e : Z(!!e), s) : n;
	}, s.curve = function(e) {
		return arguments.length ? (i = e, r != null && (a = i(r)), s) : i;
	}, s.context = function(e) {
		return arguments.length ? (e == null ? r = a = null : a = i(r = e), s) : r;
	}, s;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/noop.js
function Q() {}
//#endregion
//#region ../../node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/basis.js
function wn(e, t, n) {
	e._context.bezierCurveTo((2 * e._x0 + e._x1) / 3, (2 * e._y0 + e._y1) / 3, (e._x0 + 2 * e._x1) / 3, (e._y0 + 2 * e._y1) / 3, (e._x0 + 4 * e._x1 + t) / 6, (e._y0 + 4 * e._y1 + n) / 6);
}
function Tn(e) {
	this._context = e;
}
Tn.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._x0 = this._x1 = this._y0 = this._y1 = NaN, this._point = 0;
	},
	lineEnd: function() {
		switch (this._point) {
			case 3: wn(this, this._x1, this._y1);
			case 2:
				this._context.lineTo(this._x1, this._y1);
				break;
		}
		(this._line || this._line !== 0 && this._point === 1) && this._context.closePath(), this._line = 1 - this._line;
	},
	point: function(e, t) {
		switch (e = +e, t = +t, this._point) {
			case 0:
				this._point = 1, this._line ? this._context.lineTo(e, t) : this._context.moveTo(e, t);
				break;
			case 1:
				this._point = 2;
				break;
			case 2: this._point = 3, this._context.lineTo((5 * this._x0 + this._x1) / 6, (5 * this._y0 + this._y1) / 6);
			default:
				wn(this, e, t);
				break;
		}
		this._x0 = this._x1, this._x1 = e, this._y0 = this._y1, this._y1 = t;
	}
};
function En(e) {
	return new Tn(e);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/basisClosed.js
function Dn(e) {
	this._context = e;
}
Dn.prototype = {
	areaStart: Q,
	areaEnd: Q,
	lineStart: function() {
		this._x0 = this._x1 = this._x2 = this._x3 = this._x4 = this._y0 = this._y1 = this._y2 = this._y3 = this._y4 = NaN, this._point = 0;
	},
	lineEnd: function() {
		switch (this._point) {
			case 1:
				this._context.moveTo(this._x2, this._y2), this._context.closePath();
				break;
			case 2:
				this._context.moveTo((this._x2 + 2 * this._x3) / 3, (this._y2 + 2 * this._y3) / 3), this._context.lineTo((this._x3 + 2 * this._x2) / 3, (this._y3 + 2 * this._y2) / 3), this._context.closePath();
				break;
			case 3:
				this.point(this._x2, this._y2), this.point(this._x3, this._y3), this.point(this._x4, this._y4);
				break;
		}
	},
	point: function(e, t) {
		switch (e = +e, t = +t, this._point) {
			case 0:
				this._point = 1, this._x2 = e, this._y2 = t;
				break;
			case 1:
				this._point = 2, this._x3 = e, this._y3 = t;
				break;
			case 2:
				this._point = 3, this._x4 = e, this._y4 = t, this._context.moveTo((this._x0 + 4 * this._x1 + e) / 6, (this._y0 + 4 * this._y1 + t) / 6);
				break;
			default:
				wn(this, e, t);
				break;
		}
		this._x0 = this._x1, this._x1 = e, this._y0 = this._y1, this._y1 = t;
	}
};
function On(e) {
	return new Dn(e);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/basisOpen.js
function kn(e) {
	this._context = e;
}
kn.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._x0 = this._x1 = this._y0 = this._y1 = NaN, this._point = 0;
	},
	lineEnd: function() {
		(this._line || this._line !== 0 && this._point === 3) && this._context.closePath(), this._line = 1 - this._line;
	},
	point: function(e, t) {
		switch (e = +e, t = +t, this._point) {
			case 0:
				this._point = 1;
				break;
			case 1:
				this._point = 2;
				break;
			case 2:
				this._point = 3;
				var n = (this._x0 + 4 * this._x1 + e) / 6, r = (this._y0 + 4 * this._y1 + t) / 6;
				this._line ? this._context.lineTo(n, r) : this._context.moveTo(n, r);
				break;
			case 3: this._point = 4;
			default:
				wn(this, e, t);
				break;
		}
		this._x0 = this._x1, this._x1 = e, this._y0 = this._y1, this._y1 = t;
	}
};
function An(e) {
	return new kn(e);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/bundle.js
function jn(e, t) {
	this._basis = new Tn(e), this._beta = t;
}
jn.prototype = {
	lineStart: function() {
		this._x = [], this._y = [], this._basis.lineStart();
	},
	lineEnd: function() {
		var e = this._x, t = this._y, n = e.length - 1;
		if (n > 0) for (var r = e[0], i = t[0], a = e[n] - r, o = t[n] - i, s = -1, c; ++s <= n;) c = s / n, this._basis.point(this._beta * e[s] + (1 - this._beta) * (r + c * a), this._beta * t[s] + (1 - this._beta) * (i + c * o));
		this._x = this._y = null, this._basis.lineEnd();
	},
	point: function(e, t) {
		this._x.push(+e), this._y.push(+t);
	}
};
var Mn = (function e(t) {
	function n(e) {
		return t === 1 ? new Tn(e) : new jn(e, t);
	}
	return n.beta = function(t) {
		return e(+t);
	}, n;
})(.85);
//#endregion
//#region ../../node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/cardinal.js
function Nn(e, t, n) {
	e._context.bezierCurveTo(e._x1 + e._k * (e._x2 - e._x0), e._y1 + e._k * (e._y2 - e._y0), e._x2 + e._k * (e._x1 - t), e._y2 + e._k * (e._y1 - n), e._x2, e._y2);
}
function Pn(e, t) {
	this._context = e, this._k = (1 - t) / 6;
}
Pn.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._x0 = this._x1 = this._x2 = this._y0 = this._y1 = this._y2 = NaN, this._point = 0;
	},
	lineEnd: function() {
		switch (this._point) {
			case 2:
				this._context.lineTo(this._x2, this._y2);
				break;
			case 3:
				Nn(this, this._x1, this._y1);
				break;
		}
		(this._line || this._line !== 0 && this._point === 1) && this._context.closePath(), this._line = 1 - this._line;
	},
	point: function(e, t) {
		switch (e = +e, t = +t, this._point) {
			case 0:
				this._point = 1, this._line ? this._context.lineTo(e, t) : this._context.moveTo(e, t);
				break;
			case 1:
				this._point = 2, this._x1 = e, this._y1 = t;
				break;
			case 2: this._point = 3;
			default:
				Nn(this, e, t);
				break;
		}
		this._x0 = this._x1, this._x1 = this._x2, this._x2 = e, this._y0 = this._y1, this._y1 = this._y2, this._y2 = t;
	}
};
var Fn = (function e(t) {
	function n(e) {
		return new Pn(e, t);
	}
	return n.tension = function(t) {
		return e(+t);
	}, n;
})(0);
//#endregion
//#region ../../node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/cardinalClosed.js
function In(e, t) {
	this._context = e, this._k = (1 - t) / 6;
}
In.prototype = {
	areaStart: Q,
	areaEnd: Q,
	lineStart: function() {
		this._x0 = this._x1 = this._x2 = this._x3 = this._x4 = this._x5 = this._y0 = this._y1 = this._y2 = this._y3 = this._y4 = this._y5 = NaN, this._point = 0;
	},
	lineEnd: function() {
		switch (this._point) {
			case 1:
				this._context.moveTo(this._x3, this._y3), this._context.closePath();
				break;
			case 2:
				this._context.lineTo(this._x3, this._y3), this._context.closePath();
				break;
			case 3:
				this.point(this._x3, this._y3), this.point(this._x4, this._y4), this.point(this._x5, this._y5);
				break;
		}
	},
	point: function(e, t) {
		switch (e = +e, t = +t, this._point) {
			case 0:
				this._point = 1, this._x3 = e, this._y3 = t;
				break;
			case 1:
				this._point = 2, this._context.moveTo(this._x4 = e, this._y4 = t);
				break;
			case 2:
				this._point = 3, this._x5 = e, this._y5 = t;
				break;
			default:
				Nn(this, e, t);
				break;
		}
		this._x0 = this._x1, this._x1 = this._x2, this._x2 = e, this._y0 = this._y1, this._y1 = this._y2, this._y2 = t;
	}
};
var Ln = (function e(t) {
	function n(e) {
		return new In(e, t);
	}
	return n.tension = function(t) {
		return e(+t);
	}, n;
})(0);
//#endregion
//#region ../../node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/cardinalOpen.js
function Rn(e, t) {
	this._context = e, this._k = (1 - t) / 6;
}
Rn.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._x0 = this._x1 = this._x2 = this._y0 = this._y1 = this._y2 = NaN, this._point = 0;
	},
	lineEnd: function() {
		(this._line || this._line !== 0 && this._point === 3) && this._context.closePath(), this._line = 1 - this._line;
	},
	point: function(e, t) {
		switch (e = +e, t = +t, this._point) {
			case 0:
				this._point = 1;
				break;
			case 1:
				this._point = 2;
				break;
			case 2:
				this._point = 3, this._line ? this._context.lineTo(this._x2, this._y2) : this._context.moveTo(this._x2, this._y2);
				break;
			case 3: this._point = 4;
			default:
				Nn(this, e, t);
				break;
		}
		this._x0 = this._x1, this._x1 = this._x2, this._x2 = e, this._y0 = this._y1, this._y1 = this._y2, this._y2 = t;
	}
};
var zn = (function e(t) {
	function n(e) {
		return new Rn(e, t);
	}
	return n.tension = function(t) {
		return e(+t);
	}, n;
})(0);
//#endregion
//#region ../../node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/catmullRom.js
function Bn(e, t, n) {
	var r = e._x1, i = e._y1, a = e._x2, o = e._y2;
	if (e._l01_a > 1e-12) {
		var s = 2 * e._l01_2a + 3 * e._l01_a * e._l12_a + e._l12_2a, c = 3 * e._l01_a * (e._l01_a + e._l12_a);
		r = (r * s - e._x0 * e._l12_2a + e._x2 * e._l01_2a) / c, i = (i * s - e._y0 * e._l12_2a + e._y2 * e._l01_2a) / c;
	}
	if (e._l23_a > 1e-12) {
		var l = 2 * e._l23_2a + 3 * e._l23_a * e._l12_a + e._l12_2a, u = 3 * e._l23_a * (e._l23_a + e._l12_a);
		a = (a * l + e._x1 * e._l23_2a - t * e._l12_2a) / u, o = (o * l + e._y1 * e._l23_2a - n * e._l12_2a) / u;
	}
	e._context.bezierCurveTo(r, i, a, o, e._x2, e._y2);
}
function Vn(e, t) {
	this._context = e, this._alpha = t;
}
Vn.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._x0 = this._x1 = this._x2 = this._y0 = this._y1 = this._y2 = NaN, this._l01_a = this._l12_a = this._l23_a = this._l01_2a = this._l12_2a = this._l23_2a = this._point = 0;
	},
	lineEnd: function() {
		switch (this._point) {
			case 2:
				this._context.lineTo(this._x2, this._y2);
				break;
			case 3:
				this.point(this._x2, this._y2);
				break;
		}
		(this._line || this._line !== 0 && this._point === 1) && this._context.closePath(), this._line = 1 - this._line;
	},
	point: function(e, t) {
		if (e = +e, t = +t, this._point) {
			var n = this._x2 - e, r = this._y2 - t;
			this._l23_a = Math.sqrt(this._l23_2a = (n * n + r * r) ** +this._alpha);
		}
		switch (this._point) {
			case 0:
				this._point = 1, this._line ? this._context.lineTo(e, t) : this._context.moveTo(e, t);
				break;
			case 1:
				this._point = 2;
				break;
			case 2: this._point = 3;
			default:
				Bn(this, e, t);
				break;
		}
		this._l01_a = this._l12_a, this._l12_a = this._l23_a, this._l01_2a = this._l12_2a, this._l12_2a = this._l23_2a, this._x0 = this._x1, this._x1 = this._x2, this._x2 = e, this._y0 = this._y1, this._y1 = this._y2, this._y2 = t;
	}
};
var Hn = (function e(t) {
	function n(e) {
		return t ? new Vn(e, t) : new Pn(e, 0);
	}
	return n.alpha = function(t) {
		return e(+t);
	}, n;
})(.5);
//#endregion
//#region ../../node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/catmullRomClosed.js
function Un(e, t) {
	this._context = e, this._alpha = t;
}
Un.prototype = {
	areaStart: Q,
	areaEnd: Q,
	lineStart: function() {
		this._x0 = this._x1 = this._x2 = this._x3 = this._x4 = this._x5 = this._y0 = this._y1 = this._y2 = this._y3 = this._y4 = this._y5 = NaN, this._l01_a = this._l12_a = this._l23_a = this._l01_2a = this._l12_2a = this._l23_2a = this._point = 0;
	},
	lineEnd: function() {
		switch (this._point) {
			case 1:
				this._context.moveTo(this._x3, this._y3), this._context.closePath();
				break;
			case 2:
				this._context.lineTo(this._x3, this._y3), this._context.closePath();
				break;
			case 3:
				this.point(this._x3, this._y3), this.point(this._x4, this._y4), this.point(this._x5, this._y5);
				break;
		}
	},
	point: function(e, t) {
		if (e = +e, t = +t, this._point) {
			var n = this._x2 - e, r = this._y2 - t;
			this._l23_a = Math.sqrt(this._l23_2a = (n * n + r * r) ** +this._alpha);
		}
		switch (this._point) {
			case 0:
				this._point = 1, this._x3 = e, this._y3 = t;
				break;
			case 1:
				this._point = 2, this._context.moveTo(this._x4 = e, this._y4 = t);
				break;
			case 2:
				this._point = 3, this._x5 = e, this._y5 = t;
				break;
			default:
				Bn(this, e, t);
				break;
		}
		this._l01_a = this._l12_a, this._l12_a = this._l23_a, this._l01_2a = this._l12_2a, this._l12_2a = this._l23_2a, this._x0 = this._x1, this._x1 = this._x2, this._x2 = e, this._y0 = this._y1, this._y1 = this._y2, this._y2 = t;
	}
};
var Wn = (function e(t) {
	function n(e) {
		return t ? new Un(e, t) : new In(e, 0);
	}
	return n.alpha = function(t) {
		return e(+t);
	}, n;
})(.5);
//#endregion
//#region ../../node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/catmullRomOpen.js
function Gn(e, t) {
	this._context = e, this._alpha = t;
}
Gn.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._x0 = this._x1 = this._x2 = this._y0 = this._y1 = this._y2 = NaN, this._l01_a = this._l12_a = this._l23_a = this._l01_2a = this._l12_2a = this._l23_2a = this._point = 0;
	},
	lineEnd: function() {
		(this._line || this._line !== 0 && this._point === 3) && this._context.closePath(), this._line = 1 - this._line;
	},
	point: function(e, t) {
		if (e = +e, t = +t, this._point) {
			var n = this._x2 - e, r = this._y2 - t;
			this._l23_a = Math.sqrt(this._l23_2a = (n * n + r * r) ** +this._alpha);
		}
		switch (this._point) {
			case 0:
				this._point = 1;
				break;
			case 1:
				this._point = 2;
				break;
			case 2:
				this._point = 3, this._line ? this._context.lineTo(this._x2, this._y2) : this._context.moveTo(this._x2, this._y2);
				break;
			case 3: this._point = 4;
			default:
				Bn(this, e, t);
				break;
		}
		this._l01_a = this._l12_a, this._l12_a = this._l23_a, this._l01_2a = this._l12_2a, this._l12_2a = this._l23_2a, this._x0 = this._x1, this._x1 = this._x2, this._x2 = e, this._y0 = this._y1, this._y1 = this._y2, this._y2 = t;
	}
};
var Kn = (function e(t) {
	function n(e) {
		return t ? new Gn(e, t) : new Rn(e, 0);
	}
	return n.alpha = function(t) {
		return e(+t);
	}, n;
})(.5);
//#endregion
//#region ../../node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/linearClosed.js
function qn(e) {
	this._context = e;
}
qn.prototype = {
	areaStart: Q,
	areaEnd: Q,
	lineStart: function() {
		this._point = 0;
	},
	lineEnd: function() {
		this._point && this._context.closePath();
	},
	point: function(e, t) {
		e = +e, t = +t, this._point ? this._context.lineTo(e, t) : (this._point = 1, this._context.moveTo(e, t));
	}
};
function Jn(e) {
	return new qn(e);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/monotone.js
function Yn(e) {
	return e < 0 ? -1 : 1;
}
function Xn(e, t, n) {
	var r = e._x1 - e._x0, i = t - e._x1, a = (e._y1 - e._y0) / (r || i < 0 && -0), o = (n - e._y1) / (i || r < 0 && -0), s = (a * i + o * r) / (r + i);
	return (Yn(a) + Yn(o)) * Math.min(Math.abs(a), Math.abs(o), .5 * Math.abs(s)) || 0;
}
function Zn(e, t) {
	var n = e._x1 - e._x0;
	return n ? (3 * (e._y1 - e._y0) / n - t) / 2 : t;
}
function Qn(e, t, n) {
	var r = e._x0, i = e._y0, a = e._x1, o = e._y1, s = (a - r) / 3;
	e._context.bezierCurveTo(r + s, i + s * t, a - s, o - s * n, a, o);
}
function $n(e) {
	this._context = e;
}
$n.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._x0 = this._x1 = this._y0 = this._y1 = this._t0 = NaN, this._point = 0;
	},
	lineEnd: function() {
		switch (this._point) {
			case 2:
				this._context.lineTo(this._x1, this._y1);
				break;
			case 3:
				Qn(this, this._t0, Zn(this, this._t0));
				break;
		}
		(this._line || this._line !== 0 && this._point === 1) && this._context.closePath(), this._line = 1 - this._line;
	},
	point: function(e, t) {
		var n = NaN;
		if (e = +e, t = +t, !(e === this._x1 && t === this._y1)) {
			switch (this._point) {
				case 0:
					this._point = 1, this._line ? this._context.lineTo(e, t) : this._context.moveTo(e, t);
					break;
				case 1:
					this._point = 2;
					break;
				case 2:
					this._point = 3, Qn(this, Zn(this, n = Xn(this, e, t)), n);
					break;
				default:
					Qn(this, this._t0, n = Xn(this, e, t));
					break;
			}
			this._x0 = this._x1, this._x1 = e, this._y0 = this._y1, this._y1 = t, this._t0 = n;
		}
	}
};
function er(e) {
	this._context = new tr(e);
}
(er.prototype = Object.create($n.prototype)).point = function(e, t) {
	$n.prototype.point.call(this, t, e);
};
function tr(e) {
	this._context = e;
}
tr.prototype = {
	moveTo: function(e, t) {
		this._context.moveTo(t, e);
	},
	closePath: function() {
		this._context.closePath();
	},
	lineTo: function(e, t) {
		this._context.lineTo(t, e);
	},
	bezierCurveTo: function(e, t, n, r, i, a) {
		this._context.bezierCurveTo(t, e, r, n, a, i);
	}
};
function nr(e) {
	return new $n(e);
}
function rr(e) {
	return new er(e);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/natural.js
function ir(e) {
	this._context = e;
}
ir.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._x = [], this._y = [];
	},
	lineEnd: function() {
		var e = this._x, t = this._y, n = e.length;
		if (n) if (this._line ? this._context.lineTo(e[0], t[0]) : this._context.moveTo(e[0], t[0]), n === 2) this._context.lineTo(e[1], t[1]);
		else for (var r = ar(e), i = ar(t), a = 0, o = 1; o < n; ++a, ++o) this._context.bezierCurveTo(r[0][a], i[0][a], r[1][a], i[1][a], e[o], t[o]);
		(this._line || this._line !== 0 && n === 1) && this._context.closePath(), this._line = 1 - this._line, this._x = this._y = null;
	},
	point: function(e, t) {
		this._x.push(+e), this._y.push(+t);
	}
};
function ar(e) {
	var t, n = e.length - 1, r, i = Array(n), a = Array(n), o = Array(n);
	for (i[0] = 0, a[0] = 2, o[0] = e[0] + 2 * e[1], t = 1; t < n - 1; ++t) i[t] = 1, a[t] = 4, o[t] = 4 * e[t] + 2 * e[t + 1];
	for (i[n - 1] = 2, a[n - 1] = 7, o[n - 1] = 8 * e[n - 1] + e[n], t = 1; t < n; ++t) r = i[t] / a[t - 1], a[t] -= r, o[t] -= r * o[t - 1];
	for (i[n - 1] = o[n - 1] / a[n - 1], t = n - 2; t >= 0; --t) i[t] = (o[t] - i[t + 1]) / a[t];
	for (a[n - 1] = (e[n] + i[n - 1]) / 2, t = 0; t < n - 1; ++t) a[t] = 2 * e[t + 1] - i[t + 1];
	return [i, a];
}
function or(e) {
	return new ir(e);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/curve/step.js
function $(e, t) {
	this._context = e, this._t = t;
}
$.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._x = this._y = NaN, this._point = 0;
	},
	lineEnd: function() {
		0 < this._t && this._t < 1 && this._point === 2 && this._context.lineTo(this._x, this._y), (this._line || this._line !== 0 && this._point === 1) && this._context.closePath(), this._line >= 0 && (this._t = 1 - this._t, this._line = 1 - this._line);
	},
	point: function(e, t) {
		switch (e = +e, t = +t, this._point) {
			case 0:
				this._point = 1, this._line ? this._context.lineTo(e, t) : this._context.moveTo(e, t);
				break;
			case 1: this._point = 2;
			default:
				if (this._t <= 0) this._context.lineTo(this._x, t), this._context.lineTo(e, t);
				else {
					var n = this._x * (1 - this._t) + e * this._t;
					this._context.lineTo(n, this._y), this._context.lineTo(n, t);
				}
				break;
		}
		this._x = e, this._y = t;
	}
};
function sr(e) {
	return new $(e, .5);
}
function cr(e) {
	return new $(e, 0);
}
function lr(e) {
	return new $(e, 1);
}
//#endregion
export { j as $, pn as A, Vt as B, _n as C, an as D, gn as E, un as F, _t as G, It as H, mn as I, V as J, vt as K, Z as L, cn as M, fn as N, on as O, ln as P, je as Q, nn as R, vn as S, hn as T, Pt as U, Wt as V, kt as W, B as X, st as Y, z as Z, En as _, nr as a, Sn as b, Kn as c, zn as d, b as et, Ln as f, On as g, An as h, or as i, sn as j, dn as k, Wn as l, Mn as m, cr as n, S as nt, rr as o, Fn as p, ut as q, sr as r, n as rt, Jn as s, lr as t, me as tt, Hn as u, Cn as v, rn as w, bn as x, xn as y, Ut as z };
