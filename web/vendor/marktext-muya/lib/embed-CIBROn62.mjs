import { t as e } from "./defineProperty-upRMmtd8.mjs";
import { n as t } from "./es/index.js";
import { _ as n, a as r, c as i, d as a, f as o, g as s, h as c, l, m as u, n as d, o as f, p, r as m, s as h, t as g, u as _, v, y } from "./linear-_i7axQhS.mjs";
import { n as b, r as x, t as S } from "./ordinal-CQXecEOr.mjs";
import { A as C, C as w, D as T, E, M as D, O, S as k, T as ee, _ as te, a as ne, c as re, d as ie, f as ae, i as oe, j as se, k as ce, l as le, n as ue, o as de, p as fe, r as pe, s as me, t as he, u as ge, w as _e, x as ve } from "./time-C7uuhDcq.mjs";
import { t as ye } from "./range-DbSjioQV.mjs";
import { $ as be, B as xe, C as Se, F as Ce, H as we, I as Te, J as Ee, L as De, N as Oe, Q as ke, R as Ae, S as je, U as Me, V as Ne, _ as Pe, a as Fe, b as Ie, c as Le, d as Re, f as ze, g as Be, h as Ve, i as He, l as Ue, m as We, n as Ge, nt as Ke, o as qe, p as Je, q as Ye, r as eee, rt as tee, s as nee, t as ree, tt as iee, u as aee, v as Xe, x as Ze, y as Qe, z as $e } from "./step-BLAKVGAu.mjs";
import { i as et, n as tt, r as nt, t as rt } from "./defaultLocale-MdLIoXIH.mjs";
import { a as it, c as at, d as ot, f as st, i as ct, l as lt, n as ut, o as dt, p as oee, r as ft, s as pt, t as mt, u as ht } from "./treemap-BnMONfi6.mjs";
import { n as gt, t as _t } from "./init-CQl8l1Ov.mjs";
import { t as vt } from "./colors-p9Z0js5l.mjs";
import { t as yt } from "./arc-CaXU7sh_.mjs";
//#region ../../node_modules/.pnpm/d3-array@3.2.4/node_modules/d3-array/src/variance.js
function bt(e, t) {
	let n = 0, r, i = 0, a = 0;
	if (t === void 0) for (let t of e) t != null && (t = +t) >= t && (r = t - i, i += r / ++n, a += r * (t - i));
	else {
		let o = -1;
		for (let s of e) (s = t(s, ++o, e)) != null && (s = +s) >= s && (r = s - i, i += r / ++n, a += r * (s - i));
	}
	if (n > 1) return a / (n - 1);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-array@3.2.4/node_modules/d3-array/src/deviation.js
function xt(e, t) {
	let n = bt(e, t);
	return n && Math.sqrt(n);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-array@3.2.4/node_modules/d3-array/src/fsum.js
var St = class {
	constructor() {
		this._partials = new Float64Array(32), this._n = 0;
	}
	add(e) {
		let t = this._partials, n = 0;
		for (let r = 0; r < this._n && r < 32; r++) {
			let i = t[r], a = e + i, o = Math.abs(e) < Math.abs(i) ? e - (a - i) : i - (a - e);
			o && (t[n++] = o), e = a;
		}
		return t[n] = e, this._n = n + 1, this;
	}
	valueOf() {
		let e = this._partials, t = this._n, n, r, i, a = 0;
		if (t > 0) {
			for (a = e[--t]; t > 0 && (n = a, r = e[--t], a = n + r, i = r - (a - n), !i););
			t > 0 && (i < 0 && e[t - 1] < 0 || i > 0 && e[t - 1] > 0) && (r = i * 2, n = a + r, r == n - a && (a = n));
		}
		return a;
	}
};
//#endregion
//#region ../../node_modules/.pnpm/d3-array@3.2.4/node_modules/d3-array/src/permute.js
function Ct(e, t) {
	return Array.from(t, (t) => e[t]);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-array@3.2.4/node_modules/d3-array/src/sort.js
function wt(e = y) {
	if (e === y) return Tt;
	if (typeof e != "function") throw TypeError("compare is not a function");
	return (t, n) => {
		let r = e(t, n);
		return r || r === 0 ? r : (e(n, n) === 0) - (e(t, t) === 0);
	};
}
function Tt(e, t) {
	return (e == null || !(e >= e)) - (t == null || !(t >= t)) || (e < t ? -1 : +(e > t));
}
//#endregion
//#region ../../node_modules/.pnpm/d3-array@3.2.4/node_modules/d3-array/src/quickselect.js
function Et(e, t, n = 0, r = Infinity, i) {
	if (t = Math.floor(t), n = Math.floor(Math.max(0, n)), r = Math.floor(Math.min(e.length - 1, r)), !(n <= t && t <= r)) return e;
	for (i = i === void 0 ? Tt : wt(i); r > n;) {
		if (r - n > 600) {
			let a = r - n + 1, o = t - n + 1, s = Math.log(a), c = .5 * Math.exp(2 * s / 3), l = .5 * Math.sqrt(s * c * (a - c) / a) * (o - a / 2 < 0 ? -1 : 1), u = Math.max(n, Math.floor(t - o * c / a + l)), d = Math.min(r, Math.floor(t + (a - o) * c / a + l));
			Et(e, t, u, d, i);
		}
		let a = e[t], o = n, s = r;
		for (Dt(e, n, t), i(e[r], a) > 0 && Dt(e, n, r); o < s;) {
			for (Dt(e, o, s), ++o, --s; i(e[o], a) < 0;) ++o;
			for (; i(e[s], a) > 0;) --s;
		}
		i(e[n], a) === 0 ? Dt(e, n, s) : (++s, Dt(e, s, r)), s <= t && (n = s + 1), t <= s && (r = s - 1);
	}
	return e;
}
function Dt(e, t, n) {
	let r = e[t];
	e[t] = e[n], e[n] = r;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-array@3.2.4/node_modules/d3-array/src/quantile.js
function Ot(e, t, r) {
	if (e = Float64Array.from(n(e, r)), !(!(i = e.length) || isNaN(t = +t))) {
		if (t <= 0 || i < 2) return se(e);
		if (t >= 1) return D(e);
		var i, a = (i - 1) * t, o = Math.floor(a), s = D(Et(e, o).subarray(0, o + 1));
		return s + (se(e.subarray(o + 1)) - s) * (a - o);
	}
}
function kt(e, t, n = s) {
	if (!(!(r = e.length) || isNaN(t = +t))) {
		if (t <= 0 || r < 2) return +n(e[0], 0, e);
		if (t >= 1) return +n(e[r - 1], r - 1, e);
		var r, i = (r - 1) * t, a = Math.floor(i), o = +n(e[a], a, e);
		return o + (+n(e[a + 1], a + 1, e) - o) * (i - a);
	}
}
//#endregion
//#region ../../node_modules/.pnpm/d3-array@3.2.4/node_modules/d3-array/src/mean.js
function At(e, t) {
	let n = 0, r = 0;
	if (t === void 0) for (let t of e) t != null && (t = +t) >= t && (++n, r += t);
	else {
		let i = -1;
		for (let a of e) (a = t(a, ++i, e)) != null && (a = +a) >= a && (++n, r += a);
	}
	if (n) return r / n;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-array@3.2.4/node_modules/d3-array/src/median.js
function jt(e, t) {
	return Ot(e, .5, t);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-array@3.2.4/node_modules/d3-array/src/merge.js
function* Mt(e) {
	for (let t of e) yield* t;
}
function Nt(e) {
	return Array.from(Mt(e));
}
//#endregion
//#region ../../node_modules/.pnpm/d3-array@3.2.4/node_modules/d3-array/src/sum.js
function Pt(e, t) {
	let n = 0;
	if (t === void 0) for (let t of e) (t = +t) && (n += t);
	else {
		let r = -1;
		for (let i of e) (i = +t(i, ++r, e)) && (n += i);
	}
	return n;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-array@3.2.4/node_modules/d3-array/src/intersection.js
function Ft(e, ...t) {
	e = new x(e), t = t.map(It);
	out: for (let n of e) for (let r of t) if (!r.has(n)) {
		e.delete(n);
		continue out;
	}
	return e;
}
function It(e) {
	return e instanceof x ? e : new x(e);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-array@3.2.4/node_modules/d3-array/src/union.js
function Lt(...e) {
	let t = new x();
	for (let n of e) for (let e of n) t.add(e);
	return t;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-timer@3.0.1/node_modules/d3-timer/src/interval.js
function see(e, t, n) {
	var r = new $e(), i = t;
	return t == null ? (r.restart(e, t, n), r) : (r._restart = r.restart, r.restart = function(e, t, n) {
		t = +t, n = n == null ? xe() : +n, r._restart(function a(o) {
			o += i, r._restart(a, i += t, n), e(o);
		}, t, n);
	}, r.restart(e, t, n), r);
}
//#endregion
//#region ../../node_modules/.pnpm/robust-predicates@3.0.2/node_modules/robust-predicates/esm/util.js
var Rt = 11102230246251565e-32, zt = 134217729, Bt = (3 + 8 * Rt) * Rt;
function Vt(e, t, n, r, i) {
	let a, o, s, c, l = t[0], u = r[0], d = 0, f = 0;
	u > l == u > -l ? (a = l, l = t[++d]) : (a = u, u = r[++f]);
	let p = 0;
	if (d < e && f < n) for (u > l == u > -l ? (o = l + a, s = a - (o - l), l = t[++d]) : (o = u + a, s = a - (o - u), u = r[++f]), a = o, s !== 0 && (i[p++] = s); d < e && f < n;) u > l == u > -l ? (o = a + l, c = o - a, s = a - (o - c) + (l - c), l = t[++d]) : (o = a + u, c = o - a, s = a - (o - c) + (u - c), u = r[++f]), a = o, s !== 0 && (i[p++] = s);
	for (; d < e;) o = a + l, c = o - a, s = a - (o - c) + (l - c), l = t[++d], a = o, s !== 0 && (i[p++] = s);
	for (; f < n;) o = a + u, c = o - a, s = a - (o - c) + (u - c), u = r[++f], a = o, s !== 0 && (i[p++] = s);
	return (a !== 0 || p === 0) && (i[p++] = a), p;
}
function Ht(e, t) {
	let n = t[0];
	for (let r = 1; r < e; r++) n += t[r];
	return n;
}
function A(e) {
	return new Float64Array(e);
}
//#endregion
//#region ../../node_modules/.pnpm/robust-predicates@3.0.2/node_modules/robust-predicates/esm/orient2d.js
var Ut = (3 + 16 * Rt) * Rt, Wt = (2 + 12 * Rt) * Rt, Gt = (9 + 64 * Rt) * Rt * Rt, Kt = A(4), qt = A(8), Jt = A(12), Yt = A(16), Xt = A(4);
function Zt(e, t, n, r, i, a, o) {
	let s, c, l, u, d, f, p, m, h, g, _, v, y, b, x, S, C, w, T = e - i, E = n - i, D = t - a, O = r - a;
	b = T * O, f = zt * T, p = f - (f - T), m = T - p, f = zt * O, h = f - (f - O), g = O - h, x = m * g - (b - p * h - m * h - p * g), S = D * E, f = zt * D, p = f - (f - D), m = D - p, f = zt * E, h = f - (f - E), g = E - h, C = m * g - (S - p * h - m * h - p * g), _ = x - C, d = x - _, Kt[0] = x - (_ + d) + (d - C), v = b + _, d = v - b, y = b - (v - d) + (_ - d), _ = y - S, d = y - _, Kt[1] = y - (_ + d) + (d - S), w = v + _, d = w - v, Kt[2] = v - (w - d) + (_ - d), Kt[3] = w;
	let k = Ht(4, Kt), ee = Wt * o;
	if (k >= ee || -k >= ee || (d = e - T, s = e - (T + d) + (d - i), d = n - E, l = n - (E + d) + (d - i), d = t - D, c = t - (D + d) + (d - a), d = r - O, u = r - (O + d) + (d - a), s === 0 && c === 0 && l === 0 && u === 0) || (ee = Gt * o + Bt * Math.abs(k), k += T * u + O * s - (D * l + E * c), k >= ee || -k >= ee)) return k;
	b = s * O, f = zt * s, p = f - (f - s), m = s - p, f = zt * O, h = f - (f - O), g = O - h, x = m * g - (b - p * h - m * h - p * g), S = c * E, f = zt * c, p = f - (f - c), m = c - p, f = zt * E, h = f - (f - E), g = E - h, C = m * g - (S - p * h - m * h - p * g), _ = x - C, d = x - _, Xt[0] = x - (_ + d) + (d - C), v = b + _, d = v - b, y = b - (v - d) + (_ - d), _ = y - S, d = y - _, Xt[1] = y - (_ + d) + (d - S), w = v + _, d = w - v, Xt[2] = v - (w - d) + (_ - d), Xt[3] = w;
	let te = Vt(4, Kt, 4, Xt, qt);
	b = T * u, f = zt * T, p = f - (f - T), m = T - p, f = zt * u, h = f - (f - u), g = u - h, x = m * g - (b - p * h - m * h - p * g), S = D * l, f = zt * D, p = f - (f - D), m = D - p, f = zt * l, h = f - (f - l), g = l - h, C = m * g - (S - p * h - m * h - p * g), _ = x - C, d = x - _, Xt[0] = x - (_ + d) + (d - C), v = b + _, d = v - b, y = b - (v - d) + (_ - d), _ = y - S, d = y - _, Xt[1] = y - (_ + d) + (d - S), w = v + _, d = w - v, Xt[2] = v - (w - d) + (_ - d), Xt[3] = w;
	let ne = Vt(te, qt, 4, Xt, Jt);
	return b = s * u, f = zt * s, p = f - (f - s), m = s - p, f = zt * u, h = f - (f - u), g = u - h, x = m * g - (b - p * h - m * h - p * g), S = c * l, f = zt * c, p = f - (f - c), m = c - p, f = zt * l, h = f - (f - l), g = l - h, C = m * g - (S - p * h - m * h - p * g), _ = x - C, d = x - _, Xt[0] = x - (_ + d) + (d - C), v = b + _, d = v - b, y = b - (v - d) + (_ - d), _ = y - S, d = y - _, Xt[1] = y - (_ + d) + (d - S), w = v + _, d = w - v, Xt[2] = v - (w - d) + (_ - d), Xt[3] = w, Yt[Vt(ne, Jt, 4, Xt, Yt) - 1];
}
function Qt(e, t, n, r, i, a) {
	let o = (t - a) * (n - i), s = (e - i) * (r - a), c = o - s, l = Math.abs(o + s);
	return Math.abs(c) >= Ut * l ? c : -Zt(e, t, n, r, i, a, l);
}
(7 + 56 * Rt) * Rt, (3 + 28 * Rt) * Rt, (26 + 288 * Rt) * Rt * Rt, A(4), A(4), A(4), A(4), A(4), A(4), A(4), A(4), A(4), A(8), A(8), A(8), A(4), A(8), A(8), A(8), A(12), A(192), A(192), (10 + 96 * Rt) * Rt, (4 + 48 * Rt) * Rt, (44 + 576 * Rt) * Rt * Rt, A(4), A(4), A(4), A(4), A(4), A(4), A(4), A(4), A(8), A(8), A(8), A(8), A(8), A(8), A(8), A(8), A(8), A(4), A(4), A(4), A(8), A(16), A(16), A(16), A(32), A(32), A(48), A(64), A(1152), A(1152), (16 + 224 * Rt) * Rt, (5 + 72 * Rt) * Rt, (71 + 1408 * Rt) * Rt * Rt, A(4), A(4), A(4), A(4), A(4), A(4), A(4), A(4), A(4), A(4), A(24), A(24), A(24), A(24), A(24), A(24), A(24), A(24), A(24), A(24), A(1152), A(1152), A(1152), A(1152), A(1152), A(2304), A(2304), A(3456), A(5760), A(8), A(8), A(8), A(16), A(24), A(48), A(48), A(96), A(192), A(384), A(384), A(384), A(768), A(96), A(96), A(96), A(1152);
//#endregion
//#region ../../node_modules/.pnpm/delaunator@5.0.1/node_modules/delaunator/index.js
var $t = 2 ** -52, en = new Uint32Array(512), tn = class e {
	static from(t, n = un, r = dn) {
		let i = t.length, a = new Float64Array(i * 2);
		for (let e = 0; e < i; e++) {
			let i = t[e];
			a[2 * e] = n(i), a[2 * e + 1] = r(i);
		}
		return new e(a);
	}
	constructor(e) {
		let t = e.length >> 1;
		if (t > 0 && typeof e[0] != "number") throw Error("Expected coords to contain numbers.");
		this.coords = e;
		let n = Math.max(2 * t - 5, 0);
		this._triangles = new Uint32Array(n * 3), this._halfedges = new Int32Array(n * 3), this._hashSize = Math.ceil(Math.sqrt(t)), this._hullPrev = new Uint32Array(t), this._hullNext = new Uint32Array(t), this._hullTri = new Uint32Array(t), this._hullHash = new Int32Array(this._hashSize), this._ids = new Uint32Array(t), this._dists = new Float64Array(t), this.update();
	}
	update() {
		let { coords: e, _hullPrev: t, _hullNext: n, _hullTri: r, _hullHash: i } = this, a = e.length >> 1, o = Infinity, s = Infinity, c = -Infinity, l = -Infinity;
		for (let t = 0; t < a; t++) {
			let n = e[2 * t], r = e[2 * t + 1];
			n < o && (o = n), r < s && (s = r), n > c && (c = n), r > l && (l = r), this._ids[t] = t;
		}
		let u = (o + c) / 2, d = (s + l) / 2, f, p, m;
		for (let t = 0, n = Infinity; t < a; t++) {
			let r = rn(u, d, e[2 * t], e[2 * t + 1]);
			r < n && (f = t, n = r);
		}
		let h = e[2 * f], g = e[2 * f + 1];
		for (let t = 0, n = Infinity; t < a; t++) {
			if (t === f) continue;
			let r = rn(h, g, e[2 * t], e[2 * t + 1]);
			r < n && r > 0 && (p = t, n = r);
		}
		let _ = e[2 * p], v = e[2 * p + 1], y = Infinity;
		for (let t = 0; t < a; t++) {
			if (t === f || t === p) continue;
			let n = on(h, g, _, v, e[2 * t], e[2 * t + 1]);
			n < y && (m = t, y = n);
		}
		let b = e[2 * m], x = e[2 * m + 1];
		if (y === Infinity) {
			for (let t = 0; t < a; t++) this._dists[t] = e[2 * t] - e[0] || e[2 * t + 1] - e[1];
			cn(this._ids, this._dists, 0, a - 1);
			let t = new Uint32Array(a), n = 0;
			for (let e = 0, r = -Infinity; e < a; e++) {
				let i = this._ids[e], a = this._dists[i];
				a > r && (t[n++] = i, r = a);
			}
			this.hull = t.subarray(0, n), this.triangles = new Uint32Array(), this.halfedges = new Uint32Array();
			return;
		}
		if (Qt(h, g, _, v, b, x) < 0) {
			let e = p, t = _, n = v;
			p = m, _ = b, v = x, m = e, b = t, x = n;
		}
		let S = sn(h, g, _, v, b, x);
		this._cx = S.x, this._cy = S.y;
		for (let t = 0; t < a; t++) this._dists[t] = rn(e[2 * t], e[2 * t + 1], S.x, S.y);
		cn(this._ids, this._dists, 0, a - 1), this._hullStart = f;
		let C = 3;
		n[f] = t[m] = p, n[p] = t[f] = m, n[m] = t[p] = f, r[f] = 0, r[p] = 1, r[m] = 2, i.fill(-1), i[this._hashKey(h, g)] = f, i[this._hashKey(_, v)] = p, i[this._hashKey(b, x)] = m, this.trianglesLen = 0, this._addTriangle(f, p, m, -1, -1, -1);
		for (let a = 0, o, s; a < this._ids.length; a++) {
			let c = this._ids[a], l = e[2 * c], u = e[2 * c + 1];
			if (a > 0 && Math.abs(l - o) <= $t && Math.abs(u - s) <= $t || (o = l, s = u, c === f || c === p || c === m)) continue;
			let d = 0;
			for (let e = 0, t = this._hashKey(l, u); e < this._hashSize && (d = i[(t + e) % this._hashSize], !(d !== -1 && d !== n[d])); e++);
			d = t[d];
			let h = d, g;
			for (; g = n[h], Qt(l, u, e[2 * h], e[2 * h + 1], e[2 * g], e[2 * g + 1]) >= 0;) if (h = g, h === d) {
				h = -1;
				break;
			}
			if (h === -1) continue;
			let _ = this._addTriangle(h, c, n[h], -1, -1, r[h]);
			r[c] = this._legalize(_ + 2), r[h] = _, C++;
			let v = n[h];
			for (; g = n[v], Qt(l, u, e[2 * v], e[2 * v + 1], e[2 * g], e[2 * g + 1]) < 0;) _ = this._addTriangle(v, c, g, r[c], -1, r[v]), r[c] = this._legalize(_ + 2), n[v] = v, C--, v = g;
			if (h === d) for (; g = t[h], Qt(l, u, e[2 * g], e[2 * g + 1], e[2 * h], e[2 * h + 1]) < 0;) _ = this._addTriangle(g, c, h, -1, r[h], r[g]), this._legalize(_ + 2), r[g] = _, n[h] = h, C--, h = g;
			this._hullStart = t[c] = h, n[h] = t[v] = c, n[c] = v, i[this._hashKey(l, u)] = c, i[this._hashKey(e[2 * h], e[2 * h + 1])] = h;
		}
		this.hull = new Uint32Array(C);
		for (let e = 0, t = this._hullStart; e < C; e++) this.hull[e] = t, t = n[t];
		this.triangles = this._triangles.subarray(0, this.trianglesLen), this.halfedges = this._halfedges.subarray(0, this.trianglesLen);
	}
	_hashKey(e, t) {
		return Math.floor(nn(e - this._cx, t - this._cy) * this._hashSize) % this._hashSize;
	}
	_legalize(e) {
		let { _triangles: t, _halfedges: n, coords: r } = this, i = 0, a = 0;
		for (;;) {
			let o = n[e], s = e - e % 3;
			if (a = s + (e + 2) % 3, o === -1) {
				if (i === 0) break;
				e = en[--i];
				continue;
			}
			let c = o - o % 3, l = s + (e + 1) % 3, u = c + (o + 2) % 3, d = t[a], f = t[e], p = t[l], m = t[u];
			if (an(r[2 * d], r[2 * d + 1], r[2 * f], r[2 * f + 1], r[2 * p], r[2 * p + 1], r[2 * m], r[2 * m + 1])) {
				t[e] = m, t[o] = d;
				let r = n[u];
				if (r === -1) {
					let t = this._hullStart;
					do {
						if (this._hullTri[t] === u) {
							this._hullTri[t] = e;
							break;
						}
						t = this._hullPrev[t];
					} while (t !== this._hullStart);
				}
				this._link(e, r), this._link(o, n[a]), this._link(a, u);
				let s = c + (o + 1) % 3;
				i < en.length && (en[i++] = s);
			} else {
				if (i === 0) break;
				e = en[--i];
			}
		}
		return a;
	}
	_link(e, t) {
		this._halfedges[e] = t, t !== -1 && (this._halfedges[t] = e);
	}
	_addTriangle(e, t, n, r, i, a) {
		let o = this.trianglesLen;
		return this._triangles[o] = e, this._triangles[o + 1] = t, this._triangles[o + 2] = n, this._link(o, r), this._link(o + 1, i), this._link(o + 2, a), this.trianglesLen += 3, o;
	}
};
function nn(e, t) {
	let n = e / (Math.abs(e) + Math.abs(t));
	return (t > 0 ? 3 - n : 1 + n) / 4;
}
function rn(e, t, n, r) {
	let i = e - n, a = t - r;
	return i * i + a * a;
}
function an(e, t, n, r, i, a, o, s) {
	let c = e - o, l = t - s, u = n - o, d = r - s, f = i - o, p = a - s, m = c * c + l * l, h = u * u + d * d, g = f * f + p * p;
	return c * (d * g - h * p) - l * (u * g - h * f) + m * (u * p - d * f) < 0;
}
function on(e, t, n, r, i, a) {
	let o = n - e, s = r - t, c = i - e, l = a - t, u = o * o + s * s, d = c * c + l * l, f = .5 / (o * l - s * c), p = (l * u - s * d) * f, m = (o * d - c * u) * f;
	return p * p + m * m;
}
function sn(e, t, n, r, i, a) {
	let o = n - e, s = r - t, c = i - e, l = a - t, u = o * o + s * s, d = c * c + l * l, f = .5 / (o * l - s * c);
	return {
		x: e + (l * u - s * d) * f,
		y: t + (o * d - c * u) * f
	};
}
function cn(e, t, n, r) {
	if (r - n <= 20) for (let i = n + 1; i <= r; i++) {
		let r = e[i], a = t[r], o = i - 1;
		for (; o >= n && t[e[o]] > a;) e[o + 1] = e[o--];
		e[o + 1] = r;
	}
	else {
		let i = n + r >> 1, a = n + 1, o = r;
		ln(e, i, a), t[e[n]] > t[e[r]] && ln(e, n, r), t[e[a]] > t[e[r]] && ln(e, a, r), t[e[n]] > t[e[a]] && ln(e, n, a);
		let s = e[a], c = t[s];
		for (;;) {
			do
				a++;
			while (t[e[a]] < c);
			do
				o--;
			while (t[e[o]] > c);
			if (o < a) break;
			ln(e, a, o);
		}
		e[n + 1] = e[o], e[o] = s, r - a + 1 >= o - n ? (cn(e, t, a, r), cn(e, t, n, o - 1)) : (cn(e, t, n, o - 1), cn(e, t, a, r));
	}
}
function ln(e, t, n) {
	let r = e[t];
	e[t] = e[n], e[n] = r;
}
function un(e) {
	return e[0];
}
function dn(e) {
	return e[1];
}
//#endregion
//#region ../../node_modules/.pnpm/d3-delaunay@6.0.4/node_modules/d3-delaunay/src/path.js
var fn = 1e-6, pn = class {
	constructor() {
		this._x0 = this._y0 = this._x1 = this._y1 = null, this._ = "";
	}
	moveTo(e, t) {
		this._ += `M${this._x0 = this._x1 = +e},${this._y0 = this._y1 = +t}`;
	}
	closePath() {
		this._x1 !== null && (this._x1 = this._x0, this._y1 = this._y0, this._ += "Z");
	}
	lineTo(e, t) {
		this._ += `L${this._x1 = +e},${this._y1 = +t}`;
	}
	arc(e, t, n) {
		e = +e, t = +t, n = +n;
		let r = e + n, i = t;
		if (n < 0) throw Error("negative radius");
		this._x1 === null ? this._ += `M${r},${i}` : (Math.abs(this._x1 - r) > fn || Math.abs(this._y1 - i) > fn) && (this._ += "L" + r + "," + i), n && (this._ += `A${n},${n},0,1,1,${e - n},${t}A${n},${n},0,1,1,${this._x1 = r},${this._y1 = i}`);
	}
	rect(e, t, n, r) {
		this._ += `M${this._x0 = this._x1 = +e},${this._y0 = this._y1 = +t}h${+n}v${+r}h${-n}Z`;
	}
	value() {
		return this._ || null;
	}
}, mn = class {
	constructor() {
		this._ = [];
	}
	moveTo(e, t) {
		this._.push([e, t]);
	}
	closePath() {
		this._.push(this._[0].slice());
	}
	lineTo(e, t) {
		this._.push([e, t]);
	}
	value() {
		return this._.length ? this._ : null;
	}
}, hn = class {
	constructor(e, [t, n, r, i] = [
		0,
		0,
		960,
		500
	]) {
		if (!((r = +r) >= (t = +t)) || !((i = +i) >= (n = +n))) throw Error("invalid bounds");
		this.delaunay = e, this._circumcenters = new Float64Array(e.points.length * 2), this.vectors = new Float64Array(e.points.length * 2), this.xmax = r, this.xmin = t, this.ymax = i, this.ymin = n, this._init();
	}
	update() {
		return this.delaunay.update(), this._init(), this;
	}
	_init() {
		let { delaunay: { points: e, hull: t, triangles: n }, vectors: r } = this, i, a, o = this.circumcenters = this._circumcenters.subarray(0, n.length / 3 * 2);
		for (let r = 0, s = 0, c = n.length, l, u; r < c; r += 3, s += 2) {
			let c = n[r] * 2, d = n[r + 1] * 2, f = n[r + 2] * 2, p = e[c], m = e[c + 1], h = e[d], g = e[d + 1], _ = e[f], v = e[f + 1], y = h - p, b = g - m, x = _ - p, S = v - m, C = (y * S - b * x) * 2;
			if (Math.abs(C) < 1e-9) {
				if (i === void 0) {
					i = a = 0;
					for (let n of t) i += e[n * 2], a += e[n * 2 + 1];
					i /= t.length, a /= t.length;
				}
				let n = 1e9 * Math.sign((i - p) * S - (a - m) * x);
				l = (p + _) / 2 - n * S, u = (m + v) / 2 + n * x;
			} else {
				let e = 1 / C, t = y * y + b * b, n = x * x + S * S;
				l = p + (S * t - b * n) * e, u = m + (y * n - x * t) * e;
			}
			o[s] = l, o[s + 1] = u;
		}
		let s = t[t.length - 1], c, l = s * 4, u, d = e[2 * s], f, p = e[2 * s + 1];
		r.fill(0);
		for (let n = 0; n < t.length; ++n) s = t[n], c = l, u = d, f = p, l = s * 4, d = e[2 * s], p = e[2 * s + 1], r[c + 2] = r[l] = f - p, r[c + 3] = r[l + 1] = d - u;
	}
	render(e) {
		let t = e == null ? e = new pn() : void 0, { delaunay: { halfedges: n, inedges: r, hull: i }, circumcenters: a, vectors: o } = this;
		if (i.length <= 1) return null;
		for (let t = 0, r = n.length; t < r; ++t) {
			let r = n[t];
			if (r < t) continue;
			let i = Math.floor(t / 3) * 2, o = Math.floor(r / 3) * 2, s = a[i], c = a[i + 1], l = a[o], u = a[o + 1];
			this._renderSegment(s, c, l, u, e);
		}
		let s, c = i[i.length - 1];
		for (let t = 0; t < i.length; ++t) {
			s = c, c = i[t];
			let n = Math.floor(r[c] / 3) * 2, l = a[n], u = a[n + 1], d = s * 4, f = this._project(l, u, o[d + 2], o[d + 3]);
			f && this._renderSegment(l, u, f[0], f[1], e);
		}
		return t && t.value();
	}
	renderBounds(e) {
		let t = e == null ? e = new pn() : void 0;
		return e.rect(this.xmin, this.ymin, this.xmax - this.xmin, this.ymax - this.ymin), t && t.value();
	}
	renderCell(e, t) {
		let n = t == null ? t = new pn() : void 0, r = this._clip(e);
		if (r === null || !r.length) return;
		t.moveTo(r[0], r[1]);
		let i = r.length;
		for (; r[0] === r[i - 2] && r[1] === r[i - 1] && i > 1;) i -= 2;
		for (let e = 2; e < i; e += 2) (r[e] !== r[e - 2] || r[e + 1] !== r[e - 1]) && t.lineTo(r[e], r[e + 1]);
		return t.closePath(), n && n.value();
	}
	*cellPolygons() {
		let { delaunay: { points: e } } = this;
		for (let t = 0, n = e.length / 2; t < n; ++t) {
			let e = this.cellPolygon(t);
			e && (e.index = t, yield e);
		}
	}
	cellPolygon(e) {
		let t = new mn();
		return this.renderCell(e, t), t.value();
	}
	_renderSegment(e, t, n, r, i) {
		let a, o = this._regioncode(e, t), s = this._regioncode(n, r);
		o === 0 && s === 0 ? (i.moveTo(e, t), i.lineTo(n, r)) : (a = this._clipSegment(e, t, n, r, o, s)) && (i.moveTo(a[0], a[1]), i.lineTo(a[2], a[3]));
	}
	contains(e, t, n) {
		return (t = +t, t !== t) || (n = +n, n !== n) ? !1 : this.delaunay._step(e, t, n) === e;
	}
	*neighbors(e) {
		let t = this._clip(e);
		if (t) for (let n of this.delaunay.neighbors(e)) {
			let e = this._clip(n);
			if (e) {
				loop: for (let r = 0, i = t.length; r < i; r += 2) for (let a = 0, o = e.length; a < o; a += 2) if (t[r] === e[a] && t[r + 1] === e[a + 1] && t[(r + 2) % i] === e[(a + o - 2) % o] && t[(r + 3) % i] === e[(a + o - 1) % o]) {
					yield n;
					break loop;
				}
			}
		}
	}
	_cell(e) {
		let { circumcenters: t, delaunay: { inedges: n, halfedges: r, triangles: i } } = this, a = n[e];
		if (a === -1) return null;
		let o = [], s = a;
		do {
			let n = Math.floor(s / 3);
			if (o.push(t[n * 2], t[n * 2 + 1]), s = s % 3 == 2 ? s - 2 : s + 1, i[s] !== e) break;
			s = r[s];
		} while (s !== a && s !== -1);
		return o;
	}
	_clip(e) {
		if (e === 0 && this.delaunay.hull.length === 1) return [
			this.xmax,
			this.ymin,
			this.xmax,
			this.ymax,
			this.xmin,
			this.ymax,
			this.xmin,
			this.ymin
		];
		let t = this._cell(e);
		if (t === null) return null;
		let { vectors: n } = this, r = e * 4;
		return this._simplify(n[r] || n[r + 1] ? this._clipInfinite(e, t, n[r], n[r + 1], n[r + 2], n[r + 3]) : this._clipFinite(e, t));
	}
	_clipFinite(e, t) {
		let n = t.length, r = null, i, a, o = t[n - 2], s = t[n - 1], c, l = this._regioncode(o, s), u, d = 0;
		for (let f = 0; f < n; f += 2) if (i = o, a = s, o = t[f], s = t[f + 1], c = l, l = this._regioncode(o, s), c === 0 && l === 0) u = d, d = 0, r ? r.push(o, s) : r = [o, s];
		else {
			let t, n, f, p, m;
			if (c === 0) {
				if ((t = this._clipSegment(i, a, o, s, c, l)) === null) continue;
				[n, f, p, m] = t;
			} else {
				if ((t = this._clipSegment(o, s, i, a, l, c)) === null) continue;
				[p, m, n, f] = t, u = d, d = this._edgecode(n, f), u && d && this._edge(e, u, d, r, r.length), r ? r.push(n, f) : r = [n, f];
			}
			u = d, d = this._edgecode(p, m), u && d && this._edge(e, u, d, r, r.length), r ? r.push(p, m) : r = [p, m];
		}
		if (r) u = d, d = this._edgecode(r[0], r[1]), u && d && this._edge(e, u, d, r, r.length);
		else if (this.contains(e, (this.xmin + this.xmax) / 2, (this.ymin + this.ymax) / 2)) return [
			this.xmax,
			this.ymin,
			this.xmax,
			this.ymax,
			this.xmin,
			this.ymax,
			this.xmin,
			this.ymin
		];
		return r;
	}
	_clipSegment(e, t, n, r, i, a) {
		let o = i < a;
		for (o && ([e, t, n, r, i, a] = [
			n,
			r,
			e,
			t,
			a,
			i
		]);;) {
			if (i === 0 && a === 0) return o ? [
				n,
				r,
				e,
				t
			] : [
				e,
				t,
				n,
				r
			];
			if (i & a) return null;
			let s, c, l = i || a;
			l & 8 ? (s = e + (n - e) * (this.ymax - t) / (r - t), c = this.ymax) : l & 4 ? (s = e + (n - e) * (this.ymin - t) / (r - t), c = this.ymin) : l & 2 ? (c = t + (r - t) * (this.xmax - e) / (n - e), s = this.xmax) : (c = t + (r - t) * (this.xmin - e) / (n - e), s = this.xmin), i ? (e = s, t = c, i = this._regioncode(e, t)) : (n = s, r = c, a = this._regioncode(n, r));
		}
	}
	_clipInfinite(e, t, n, r, i, a) {
		let o = Array.from(t), s;
		if ((s = this._project(o[0], o[1], n, r)) && o.unshift(s[0], s[1]), (s = this._project(o[o.length - 2], o[o.length - 1], i, a)) && o.push(s[0], s[1]), o = this._clipFinite(e, o)) for (let t = 0, n = o.length, r, i = this._edgecode(o[n - 2], o[n - 1]); t < n; t += 2) r = i, i = this._edgecode(o[t], o[t + 1]), r && i && (t = this._edge(e, r, i, o, t), n = o.length);
		else this.contains(e, (this.xmin + this.xmax) / 2, (this.ymin + this.ymax) / 2) && (o = [
			this.xmin,
			this.ymin,
			this.xmax,
			this.ymin,
			this.xmax,
			this.ymax,
			this.xmin,
			this.ymax
		]);
		return o;
	}
	_edge(e, t, n, r, i) {
		for (; t !== n;) {
			let n, a;
			switch (t) {
				case 5:
					t = 4;
					continue;
				case 4:
					t = 6, n = this.xmax, a = this.ymin;
					break;
				case 6:
					t = 2;
					continue;
				case 2:
					t = 10, n = this.xmax, a = this.ymax;
					break;
				case 10:
					t = 8;
					continue;
				case 8:
					t = 9, n = this.xmin, a = this.ymax;
					break;
				case 9:
					t = 1;
					continue;
				case 1:
					t = 5, n = this.xmin, a = this.ymin;
					break;
			}
			(r[i] !== n || r[i + 1] !== a) && this.contains(e, n, a) && (r.splice(i, 0, n, a), i += 2);
		}
		return i;
	}
	_project(e, t, n, r) {
		let i = Infinity, a, o, s;
		if (r < 0) {
			if (t <= this.ymin) return null;
			(a = (this.ymin - t) / r) < i && (s = this.ymin, o = e + (i = a) * n);
		} else if (r > 0) {
			if (t >= this.ymax) return null;
			(a = (this.ymax - t) / r) < i && (s = this.ymax, o = e + (i = a) * n);
		}
		if (n > 0) {
			if (e >= this.xmax) return null;
			(a = (this.xmax - e) / n) < i && (o = this.xmax, s = t + (i = a) * r);
		} else if (n < 0) {
			if (e <= this.xmin) return null;
			(a = (this.xmin - e) / n) < i && (o = this.xmin, s = t + (i = a) * r);
		}
		return [o, s];
	}
	_edgecode(e, t) {
		return (e === this.xmin ? 1 : e === this.xmax ? 2 : 0) | (t === this.ymin ? 4 : t === this.ymax ? 8 : 0);
	}
	_regioncode(e, t) {
		return (e < this.xmin ? 1 : e > this.xmax ? 2 : 0) | (t < this.ymin ? 4 : t > this.ymax ? 8 : 0);
	}
	_simplify(e) {
		if (e && e.length > 4) {
			for (let t = 0; t < e.length; t += 2) {
				let n = (t + 2) % e.length, r = (t + 4) % e.length;
				(e[t] === e[n] && e[n] === e[r] || e[t + 1] === e[n + 1] && e[n + 1] === e[r + 1]) && (e.splice(n, 2), t -= 2);
			}
			e.length || (e = null);
		}
		return e;
	}
}, gn = 2 * Math.PI, _n = Math.pow;
function vn(e) {
	return e[0];
}
function yn(e) {
	return e[1];
}
function bn(e) {
	let { triangles: t, coords: n } = e;
	for (let e = 0; e < t.length; e += 3) {
		let r = 2 * t[e], i = 2 * t[e + 1], a = 2 * t[e + 2];
		if ((n[a] - n[r]) * (n[i + 1] - n[r + 1]) - (n[i] - n[r]) * (n[a + 1] - n[r + 1]) > 1e-10) return !1;
	}
	return !0;
}
function xn(e, t, n) {
	return [e + Math.sin(e + t) * n, t + Math.cos(e - t) * n];
}
var Sn = class e {
	static from(t, n = vn, r = yn, i) {
		return new e("length" in t ? Cn(t, n, r, i) : Float64Array.from(wn(t, n, r, i)));
	}
	constructor(e) {
		this._delaunator = new tn(e), this.inedges = new Int32Array(e.length / 2), this._hullIndex = new Int32Array(e.length / 2), this.points = this._delaunator.coords, this._init();
	}
	update() {
		return this._delaunator.update(), this._init(), this;
	}
	_init() {
		let e = this._delaunator, t = this.points;
		if (e.hull && e.hull.length > 2 && bn(e)) {
			this.collinear = Int32Array.from({ length: t.length / 2 }, (e, t) => t).sort((e, n) => t[2 * e] - t[2 * n] || t[2 * e + 1] - t[2 * n + 1]);
			let e = this.collinear[0], n = this.collinear[this.collinear.length - 1], r = [
				t[2 * e],
				t[2 * e + 1],
				t[2 * n],
				t[2 * n + 1]
			], i = 1e-8 * Math.hypot(r[3] - r[1], r[2] - r[0]);
			for (let e = 0, n = t.length / 2; e < n; ++e) {
				let n = xn(t[2 * e], t[2 * e + 1], i);
				t[2 * e] = n[0], t[2 * e + 1] = n[1];
			}
			this._delaunator = new tn(t);
		} else delete this.collinear;
		let n = this.halfedges = this._delaunator.halfedges, r = this.hull = this._delaunator.hull, i = this.triangles = this._delaunator.triangles, a = this.inedges.fill(-1), o = this._hullIndex.fill(-1);
		for (let e = 0, t = n.length; e < t; ++e) {
			let t = i[e % 3 == 2 ? e - 2 : e + 1];
			(n[e] === -1 || a[t] === -1) && (a[t] = e);
		}
		for (let e = 0, t = r.length; e < t; ++e) o[r[e]] = e;
		r.length <= 2 && r.length > 0 && (this.triangles = new Int32Array(3).fill(-1), this.halfedges = new Int32Array(3).fill(-1), this.triangles[0] = r[0], a[r[0]] = 1, r.length === 2 && (a[r[1]] = 0, this.triangles[1] = r[1], this.triangles[2] = r[1]));
	}
	voronoi(e) {
		return new hn(this, e);
	}
	*neighbors(e) {
		let { inedges: t, hull: n, _hullIndex: r, halfedges: i, triangles: a, collinear: o } = this;
		if (o) {
			let t = o.indexOf(e);
			t > 0 && (yield o[t - 1]), t < o.length - 1 && (yield o[t + 1]);
			return;
		}
		let s = t[e];
		if (s === -1) return;
		let c = s, l = -1;
		do {
			if (yield l = a[c], c = c % 3 == 2 ? c - 2 : c + 1, a[c] !== e) return;
			if (c = i[c], c === -1) {
				let t = n[(r[e] + 1) % n.length];
				t !== l && (yield t);
				return;
			}
		} while (c !== s);
	}
	find(e, t, n = 0) {
		if ((e = +e, e !== e) || (t = +t, t !== t)) return -1;
		let r = n, i;
		for (; (i = this._step(n, e, t)) >= 0 && i !== n && i !== r;) n = i;
		return i;
	}
	_step(e, t, n) {
		let { inedges: r, hull: i, _hullIndex: a, halfedges: o, triangles: s, points: c } = this;
		if (r[e] === -1 || !c.length) return (e + 1) % (c.length >> 1);
		let l = e, u = _n(t - c[e * 2], 2) + _n(n - c[e * 2 + 1], 2), d = r[e], f = d;
		do {
			let r = s[f], d = _n(t - c[r * 2], 2) + _n(n - c[r * 2 + 1], 2);
			if (d < u && (u = d, l = r), f = f % 3 == 2 ? f - 2 : f + 1, s[f] !== e) break;
			if (f = o[f], f === -1) {
				if (f = i[(a[e] + 1) % i.length], f !== r && _n(t - c[f * 2], 2) + _n(n - c[f * 2 + 1], 2) < u) return f;
				break;
			}
		} while (f !== d);
		return l;
	}
	render(e) {
		let t = e == null ? e = new pn() : void 0, { points: n, halfedges: r, triangles: i } = this;
		for (let t = 0, a = r.length; t < a; ++t) {
			let a = r[t];
			if (a < t) continue;
			let o = i[t] * 2, s = i[a] * 2;
			e.moveTo(n[o], n[o + 1]), e.lineTo(n[s], n[s + 1]);
		}
		return this.renderHull(e), t && t.value();
	}
	renderPoints(e, t) {
		t === void 0 && (!e || typeof e.moveTo != "function") && (t = e, e = null), t = t == null ? 2 : +t;
		let n = e == null ? e = new pn() : void 0, { points: r } = this;
		for (let n = 0, i = r.length; n < i; n += 2) {
			let i = r[n], a = r[n + 1];
			e.moveTo(i + t, a), e.arc(i, a, t, 0, gn);
		}
		return n && n.value();
	}
	renderHull(e) {
		let t = e == null ? e = new pn() : void 0, { hull: n, points: r } = this, i = n[0] * 2, a = n.length;
		e.moveTo(r[i], r[i + 1]);
		for (let t = 1; t < a; ++t) {
			let i = 2 * n[t];
			e.lineTo(r[i], r[i + 1]);
		}
		return e.closePath(), t && t.value();
	}
	hullPolygon() {
		let e = new mn();
		return this.renderHull(e), e.value();
	}
	renderTriangle(e, t) {
		let n = t == null ? t = new pn() : void 0, { points: r, triangles: i } = this, a = i[e *= 3] * 2, o = i[e + 1] * 2, s = i[e + 2] * 2;
		return t.moveTo(r[a], r[a + 1]), t.lineTo(r[o], r[o + 1]), t.lineTo(r[s], r[s + 1]), t.closePath(), n && n.value();
	}
	*trianglePolygons() {
		let { triangles: e } = this;
		for (let t = 0, n = e.length / 3; t < n; ++t) yield this.trianglePolygon(t);
	}
	trianglePolygon(e) {
		let t = new mn();
		return this.renderTriangle(e, t), t.value();
	}
};
function Cn(e, t, n, r) {
	let i = e.length, a = new Float64Array(i * 2);
	for (let o = 0; o < i; ++o) {
		let i = e[o];
		a[o * 2] = t.call(r, i, o, e), a[o * 2 + 1] = n.call(r, i, o, e);
	}
	return a;
}
function* wn(e, t, n, r) {
	let i = 0;
	for (let a of e) yield t.call(r, a, i, e), yield n.call(r, a, i, e), ++i;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-dsv@3.0.1/node_modules/d3-dsv/src/dsv.js
var Tn = {}, En = {}, Dn = 34, On = 10, kn = 13;
function An(e) {
	return Function("d", "return {" + e.map(function(e, t) {
		return JSON.stringify(e) + ": d[" + t + "] || \"\"";
	}).join(",") + "}");
}
function jn(e, t) {
	var n = An(e);
	return function(r, i) {
		return t(n(r), i, e);
	};
}
function Mn(e) {
	var t = Object.create(null), n = [];
	return e.forEach(function(e) {
		for (var r in e) r in t || n.push(t[r] = r);
	}), n;
}
function Nn(e, t) {
	var n = e + "", r = n.length;
	return r < t ? Array(t - r + 1).join(0) + n : n;
}
function Pn(e) {
	return e < 0 ? "-" + Nn(-e, 6) : e > 9999 ? "+" + Nn(e, 6) : Nn(e, 4);
}
function Fn(e) {
	var t = e.getUTCHours(), n = e.getUTCMinutes(), r = e.getUTCSeconds(), i = e.getUTCMilliseconds();
	return isNaN(e) ? "Invalid Date" : Pn(e.getUTCFullYear(), 4) + "-" + Nn(e.getUTCMonth() + 1, 2) + "-" + Nn(e.getUTCDate(), 2) + (i ? "T" + Nn(t, 2) + ":" + Nn(n, 2) + ":" + Nn(r, 2) + "." + Nn(i, 3) + "Z" : r ? "T" + Nn(t, 2) + ":" + Nn(n, 2) + ":" + Nn(r, 2) + "Z" : n || t ? "T" + Nn(t, 2) + ":" + Nn(n, 2) + "Z" : "");
}
function In(e) {
	var t = RegExp("[\"" + e + "\n\r]"), n = e.charCodeAt(0);
	function r(e, t) {
		var n, r, a = i(e, function(e, i) {
			if (n) return n(e, i - 1);
			r = e, n = t ? jn(e, t) : An(e);
		});
		return a.columns = r || [], a;
	}
	function i(e, t) {
		var r = [], i = e.length, a = 0, o = 0, s, c = i <= 0, l = !1;
		e.charCodeAt(i - 1) === On && --i, e.charCodeAt(i - 1) === kn && --i;
		function u() {
			if (c) return En;
			if (l) return l = !1, Tn;
			var t, r = a, o;
			if (e.charCodeAt(r) === Dn) {
				for (; a++ < i && e.charCodeAt(a) !== Dn || e.charCodeAt(++a) === Dn;);
				return (t = a) >= i ? c = !0 : (o = e.charCodeAt(a++)) === On ? l = !0 : o === kn && (l = !0, e.charCodeAt(a) === On && ++a), e.slice(r + 1, t - 1).replace(/""/g, "\"");
			}
			for (; a < i;) {
				if ((o = e.charCodeAt(t = a++)) === On) l = !0;
				else if (o === kn) l = !0, e.charCodeAt(a) === On && ++a;
				else if (o !== n) continue;
				return e.slice(r, t);
			}
			return c = !0, e.slice(r, i);
		}
		for (; (s = u()) !== En;) {
			for (var d = []; s !== Tn && s !== En;) d.push(s), s = u();
			t && (d = t(d, o++)) == null || r.push(d);
		}
		return r;
	}
	function a(t, n) {
		return t.map(function(t) {
			return n.map(function(e) {
				return u(t[e]);
			}).join(e);
		});
	}
	function o(t, n) {
		return n == null && (n = Mn(t)), [n.map(u).join(e)].concat(a(t, n)).join("\n");
	}
	function s(e, t) {
		return t == null && (t = Mn(e)), a(e, t).join("\n");
	}
	function c(e) {
		return e.map(l).join("\n");
	}
	function l(t) {
		return t.map(u).join(e);
	}
	function u(e) {
		return e == null ? "" : e instanceof Date ? Fn(e) : t.test(e += "") ? "\"" + e.replace(/"/g, "\"\"") + "\"" : e;
	}
	return {
		parse: r,
		parseRows: i,
		format: o,
		formatBody: s,
		formatRows: c,
		formatRow: l,
		formatValue: u
	};
}
//#endregion
//#region ../../node_modules/.pnpm/d3-force@3.0.0/node_modules/d3-force/src/center.js
function Ln(e, t) {
	var n, r = 1;
	e == null && (e = 0), t == null && (t = 0);
	function i() {
		var i, a = n.length, o, s = 0, c = 0;
		for (i = 0; i < a; ++i) o = n[i], s += o.x, c += o.y;
		for (s = (s / a - e) * r, c = (c / a - t) * r, i = 0; i < a; ++i) o = n[i], o.x -= s, o.y -= c;
	}
	return i.initialize = function(e) {
		n = e;
	}, i.x = function(t) {
		return arguments.length ? (e = +t, i) : e;
	}, i.y = function(e) {
		return arguments.length ? (t = +e, i) : t;
	}, i.strength = function(e) {
		return arguments.length ? (r = +e, i) : r;
	}, i;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-quadtree@3.0.1/node_modules/d3-quadtree/src/add.js
function Rn(e) {
	let t = +this._x.call(null, e), n = +this._y.call(null, e);
	return zn(this.cover(t, n), t, n, e);
}
function zn(e, t, n, r) {
	if (isNaN(t) || isNaN(n)) return e;
	var i, a = e._root, o = { data: r }, s = e._x0, c = e._y0, l = e._x1, u = e._y1, d, f, p, m, h, g, _, v;
	if (!a) return e._root = o, e;
	for (; a.length;) if ((h = t >= (d = (s + l) / 2)) ? s = d : l = d, (g = n >= (f = (c + u) / 2)) ? c = f : u = f, i = a, !(a = a[_ = g << 1 | h])) return i[_] = o, e;
	if (p = +e._x.call(null, a.data), m = +e._y.call(null, a.data), t === p && n === m) return o.next = a, i ? i[_] = o : e._root = o, e;
	do
		i = i ? i[_] = [
			,
			,
			,
			,
		] : e._root = [
			,
			,
			,
			,
		], (h = t >= (d = (s + l) / 2)) ? s = d : l = d, (g = n >= (f = (c + u) / 2)) ? c = f : u = f;
	while ((_ = g << 1 | h) == (v = (m >= f) << 1 | p >= d));
	return i[v] = a, i[_] = o, e;
}
function Bn(e) {
	var t, n, r = e.length, i, a, o = Array(r), s = Array(r), c = Infinity, l = Infinity, u = -Infinity, d = -Infinity;
	for (n = 0; n < r; ++n) isNaN(i = +this._x.call(null, t = e[n])) || isNaN(a = +this._y.call(null, t)) || (o[n] = i, s[n] = a, i < c && (c = i), i > u && (u = i), a < l && (l = a), a > d && (d = a));
	if (c > u || l > d) return this;
	for (this.cover(c, l).cover(u, d), n = 0; n < r; ++n) zn(this, o[n], s[n], e[n]);
	return this;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-quadtree@3.0.1/node_modules/d3-quadtree/src/cover.js
function Vn(e, t) {
	if (isNaN(e = +e) || isNaN(t = +t)) return this;
	var n = this._x0, r = this._y0, i = this._x1, a = this._y1;
	if (isNaN(n)) i = (n = Math.floor(e)) + 1, a = (r = Math.floor(t)) + 1;
	else {
		for (var o = i - n || 1, s = this._root, c, l; n > e || e >= i || r > t || t >= a;) switch (l = (t < r) << 1 | e < n, c = [
			,
			,
			,
			,
		], c[l] = s, s = c, o *= 2, l) {
			case 0:
				i = n + o, a = r + o;
				break;
			case 1:
				n = i - o, a = r + o;
				break;
			case 2:
				i = n + o, r = a - o;
				break;
			case 3:
				n = i - o, r = a - o;
				break;
		}
		this._root && this._root.length && (this._root = s);
	}
	return this._x0 = n, this._y0 = r, this._x1 = i, this._y1 = a, this;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-quadtree@3.0.1/node_modules/d3-quadtree/src/data.js
function Hn() {
	var e = [];
	return this.visit(function(t) {
		if (!t.length) do
			e.push(t.data);
		while (t = t.next);
	}), e;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-quadtree@3.0.1/node_modules/d3-quadtree/src/extent.js
function Un(e) {
	return arguments.length ? this.cover(+e[0][0], +e[0][1]).cover(+e[1][0], +e[1][1]) : isNaN(this._x0) ? void 0 : [[this._x0, this._y0], [this._x1, this._y1]];
}
//#endregion
//#region ../../node_modules/.pnpm/d3-quadtree@3.0.1/node_modules/d3-quadtree/src/quad.js
function Wn(e, t, n, r, i) {
	this.node = e, this.x0 = t, this.y0 = n, this.x1 = r, this.y1 = i;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-quadtree@3.0.1/node_modules/d3-quadtree/src/find.js
function Gn(e, t, n) {
	var r, i = this._x0, a = this._y0, o, s, c, l, u = this._x1, d = this._y1, f = [], p = this._root, m, h;
	for (p && f.push(new Wn(p, i, a, u, d)), n == null ? n = Infinity : (i = e - n, a = t - n, u = e + n, d = t + n, n *= n); m = f.pop();) if (!(!(p = m.node) || (o = m.x0) > u || (s = m.y0) > d || (c = m.x1) < i || (l = m.y1) < a)) if (p.length) {
		var g = (o + c) / 2, _ = (s + l) / 2;
		f.push(new Wn(p[3], g, _, c, l), new Wn(p[2], o, _, g, l), new Wn(p[1], g, s, c, _), new Wn(p[0], o, s, g, _)), (h = (t >= _) << 1 | e >= g) && (m = f[f.length - 1], f[f.length - 1] = f[f.length - 1 - h], f[f.length - 1 - h] = m);
	} else {
		var v = e - +this._x.call(null, p.data), y = t - +this._y.call(null, p.data), b = v * v + y * y;
		if (b < n) {
			var x = Math.sqrt(n = b);
			i = e - x, a = t - x, u = e + x, d = t + x, r = p.data;
		}
	}
	return r;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-quadtree@3.0.1/node_modules/d3-quadtree/src/remove.js
function Kn(e) {
	if (isNaN(u = +this._x.call(null, e)) || isNaN(d = +this._y.call(null, e))) return this;
	var t, n = this._root, r, i, a, o = this._x0, s = this._y0, c = this._x1, l = this._y1, u, d, f, p, m, h, g, _;
	if (!n) return this;
	if (n.length) for (;;) {
		if ((m = u >= (f = (o + c) / 2)) ? o = f : c = f, (h = d >= (p = (s + l) / 2)) ? s = p : l = p, t = n, !(n = n[g = h << 1 | m])) return this;
		if (!n.length) break;
		(t[g + 1 & 3] || t[g + 2 & 3] || t[g + 3 & 3]) && (r = t, _ = g);
	}
	for (; n.data !== e;) if (i = n, !(n = n.next)) return this;
	return (a = n.next) && delete n.next, i ? (a ? i.next = a : delete i.next, this) : t ? (a ? t[g] = a : delete t[g], (n = t[0] || t[1] || t[2] || t[3]) && n === (t[3] || t[2] || t[1] || t[0]) && !n.length && (r ? r[_] = n : this._root = n), this) : (this._root = a, this);
}
function qn(e) {
	for (var t = 0, n = e.length; t < n; ++t) this.remove(e[t]);
	return this;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-quadtree@3.0.1/node_modules/d3-quadtree/src/root.js
function Jn() {
	return this._root;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-quadtree@3.0.1/node_modules/d3-quadtree/src/size.js
function Yn() {
	var e = 0;
	return this.visit(function(t) {
		if (!t.length) do
			++e;
		while (t = t.next);
	}), e;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-quadtree@3.0.1/node_modules/d3-quadtree/src/visit.js
function Xn(e) {
	var t = [], n, r = this._root, i, a, o, s, c;
	for (r && t.push(new Wn(r, this._x0, this._y0, this._x1, this._y1)); n = t.pop();) if (!e(r = n.node, a = n.x0, o = n.y0, s = n.x1, c = n.y1) && r.length) {
		var l = (a + s) / 2, u = (o + c) / 2;
		(i = r[3]) && t.push(new Wn(i, l, u, s, c)), (i = r[2]) && t.push(new Wn(i, a, u, l, c)), (i = r[1]) && t.push(new Wn(i, l, o, s, u)), (i = r[0]) && t.push(new Wn(i, a, o, l, u));
	}
	return this;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-quadtree@3.0.1/node_modules/d3-quadtree/src/visitAfter.js
function Zn(e) {
	var t = [], n = [], r;
	for (this._root && t.push(new Wn(this._root, this._x0, this._y0, this._x1, this._y1)); r = t.pop();) {
		var i = r.node;
		if (i.length) {
			var a, o = r.x0, s = r.y0, c = r.x1, l = r.y1, u = (o + c) / 2, d = (s + l) / 2;
			(a = i[0]) && t.push(new Wn(a, o, s, u, d)), (a = i[1]) && t.push(new Wn(a, u, s, c, d)), (a = i[2]) && t.push(new Wn(a, o, d, u, l)), (a = i[3]) && t.push(new Wn(a, u, d, c, l));
		}
		n.push(r);
	}
	for (; r = n.pop();) e(r.node, r.x0, r.y0, r.x1, r.y1);
	return this;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-quadtree@3.0.1/node_modules/d3-quadtree/src/x.js
function Qn(e) {
	return e[0];
}
function $n(e) {
	return arguments.length ? (this._x = e, this) : this._x;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-quadtree@3.0.1/node_modules/d3-quadtree/src/y.js
function er(e) {
	return e[1];
}
function tr(e) {
	return arguments.length ? (this._y = e, this) : this._y;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-quadtree@3.0.1/node_modules/d3-quadtree/src/quadtree.js
function nr(e, t, n) {
	var r = new rr(t == null ? Qn : t, n == null ? er : n, NaN, NaN, NaN, NaN);
	return e == null ? r : r.addAll(e);
}
function rr(e, t, n, r, i, a) {
	this._x = e, this._y = t, this._x0 = n, this._y0 = r, this._x1 = i, this._y1 = a, this._root = void 0;
}
function ir(e) {
	for (var t = { data: e.data }, n = t; e = e.next;) n = n.next = { data: e.data };
	return t;
}
var ar = nr.prototype = rr.prototype;
ar.copy = function() {
	var e = new rr(this._x, this._y, this._x0, this._y0, this._x1, this._y1), t = this._root, n, r;
	if (!t) return e;
	if (!t.length) return e._root = ir(t), e;
	for (n = [{
		source: t,
		target: e._root = [
			,
			,
			,
			,
		]
	}]; t = n.pop();) for (var i = 0; i < 4; ++i) (r = t.source[i]) && (r.length ? n.push({
		source: r,
		target: t.target[i] = [
			,
			,
			,
			,
		]
	}) : t.target[i] = ir(r));
	return e;
}, ar.add = Rn, ar.addAll = Bn, ar.cover = Vn, ar.data = Hn, ar.extent = Un, ar.find = Gn, ar.remove = Kn, ar.removeAll = qn, ar.root = Jn, ar.size = Yn, ar.visit = Xn, ar.visitAfter = Zn, ar.x = $n, ar.y = tr;
//#endregion
//#region ../../node_modules/.pnpm/d3-force@3.0.0/node_modules/d3-force/src/constant.js
function or(e) {
	return function() {
		return e;
	};
}
//#endregion
//#region ../../node_modules/.pnpm/d3-force@3.0.0/node_modules/d3-force/src/jiggle.js
function sr(e) {
	return (e() - .5) * 1e-6;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-force@3.0.0/node_modules/d3-force/src/collide.js
function cr(e) {
	return e.x + e.vx;
}
function lr(e) {
	return e.y + e.vy;
}
function ur(e) {
	var t, n, r, i = 1, a = 1;
	typeof e != "function" && (e = or(e == null ? 1 : +e));
	function o() {
		for (var e, o = t.length, c, l, u, d, f, p, m = 0; m < a; ++m) for (c = nr(t, cr, lr).visitAfter(s), e = 0; e < o; ++e) l = t[e], f = n[l.index], p = f * f, u = l.x + l.vx, d = l.y + l.vy, c.visit(h);
		function h(e, t, n, a, o) {
			var s = e.data, c = e.r, m = f + c;
			if (s) {
				if (s.index > l.index) {
					var h = u - s.x - s.vx, g = d - s.y - s.vy, _ = h * h + g * g;
					_ < m * m && (h === 0 && (h = sr(r), _ += h * h), g === 0 && (g = sr(r), _ += g * g), _ = (m - (_ = Math.sqrt(_))) / _ * i, l.vx += (h *= _) * (m = (c *= c) / (p + c)), l.vy += (g *= _) * m, s.vx -= h * (m = 1 - m), s.vy -= g * m);
				}
				return;
			}
			return t > u + m || a < u - m || n > d + m || o < d - m;
		}
	}
	function s(e) {
		if (e.data) return e.r = n[e.data.index];
		for (var t = e.r = 0; t < 4; ++t) e[t] && e[t].r > e.r && (e.r = e[t].r);
	}
	function c() {
		if (t) {
			var r, i = t.length, a;
			for (n = Array(i), r = 0; r < i; ++r) a = t[r], n[a.index] = +e(a, r, t);
		}
	}
	return o.initialize = function(e, n) {
		t = e, r = n, c();
	}, o.iterations = function(e) {
		return arguments.length ? (a = +e, o) : a;
	}, o.strength = function(e) {
		return arguments.length ? (i = +e, o) : i;
	}, o.radius = function(t) {
		return arguments.length ? (e = typeof t == "function" ? t : or(+t), c(), o) : e;
	}, o;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-force@3.0.0/node_modules/d3-force/src/link.js
function dr(e) {
	return e.index;
}
function fr(e, t) {
	var n = e.get(t);
	if (!n) throw Error("node not found: " + t);
	return n;
}
function pr(e) {
	var t = dr, n = d, r, i = or(30), a, o, s, c, l, u = 1;
	e == null && (e = []);
	function d(e) {
		return 1 / Math.min(s[e.source.index], s[e.target.index]);
	}
	function f(t) {
		for (var n = 0, i = e.length; n < u; ++n) for (var o = 0, s, d, f, p, m, h, g; o < i; ++o) s = e[o], d = s.source, f = s.target, p = f.x + f.vx - d.x - d.vx || sr(l), m = f.y + f.vy - d.y - d.vy || sr(l), h = Math.sqrt(p * p + m * m), h = (h - a[o]) / h * t * r[o], p *= h, m *= h, f.vx -= p * (g = c[o]), f.vy -= m * g, d.vx += p * (g = 1 - g), d.vy += m * g;
	}
	function p() {
		if (o) {
			var n, i = o.length, l = e.length, u = new Map(o.map((e, n) => [t(e, n, o), e])), d;
			for (n = 0, s = Array(i); n < l; ++n) d = e[n], d.index = n, typeof d.source != "object" && (d.source = fr(u, d.source)), typeof d.target != "object" && (d.target = fr(u, d.target)), s[d.source.index] = (s[d.source.index] || 0) + 1, s[d.target.index] = (s[d.target.index] || 0) + 1;
			for (n = 0, c = Array(l); n < l; ++n) d = e[n], c[n] = s[d.source.index] / (s[d.source.index] + s[d.target.index]);
			r = Array(l), m(), a = Array(l), h();
		}
	}
	function m() {
		if (o) for (var t = 0, i = e.length; t < i; ++t) r[t] = +n(e[t], t, e);
	}
	function h() {
		if (o) for (var t = 0, n = e.length; t < n; ++t) a[t] = +i(e[t], t, e);
	}
	return f.initialize = function(e, t) {
		o = e, l = t, p();
	}, f.links = function(t) {
		return arguments.length ? (e = t, p(), f) : e;
	}, f.id = function(e) {
		return arguments.length ? (t = e, f) : t;
	}, f.iterations = function(e) {
		return arguments.length ? (u = +e, f) : u;
	}, f.strength = function(e) {
		return arguments.length ? (n = typeof e == "function" ? e : or(+e), m(), f) : n;
	}, f.distance = function(e) {
		return arguments.length ? (i = typeof e == "function" ? e : or(+e), h(), f) : i;
	}, f;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-force@3.0.0/node_modules/d3-force/src/lcg.js
var mr = 1664525, hr = 1013904223, gr = 4294967296;
function _r() {
	let e = 1;
	return () => (e = (mr * e + hr) % gr) / gr;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-force@3.0.0/node_modules/d3-force/src/simulation.js
function vr(e) {
	return e.x;
}
function yr(e) {
	return e.y;
}
var br = 10, xr = Math.PI * (3 - Math.sqrt(5));
function Sr(e) {
	var t, n = 1, r = .001, i = 1 - r ** (1 / 300), a = 0, o = .6, s = /* @__PURE__ */ new Map(), c = Ne(d), l = tee("tick", "end"), u = _r();
	e == null && (e = []);
	function d() {
		f(), l.call("tick", t), n < r && (c.stop(), l.call("end", t));
	}
	function f(r) {
		var c, l = e.length, u;
		r === void 0 && (r = 1);
		for (var d = 0; d < r; ++d) for (n += (a - n) * i, s.forEach(function(e) {
			e(n);
		}), c = 0; c < l; ++c) u = e[c], u.fx == null ? u.x += u.vx *= o : (u.x = u.fx, u.vx = 0), u.fy == null ? u.y += u.vy *= o : (u.y = u.fy, u.vy = 0);
		return t;
	}
	function p() {
		for (var t = 0, n = e.length, r; t < n; ++t) {
			if (r = e[t], r.index = t, r.fx != null && (r.x = r.fx), r.fy != null && (r.y = r.fy), isNaN(r.x) || isNaN(r.y)) {
				var i = br * Math.sqrt(.5 + t), a = t * xr;
				r.x = i * Math.cos(a), r.y = i * Math.sin(a);
			}
			(isNaN(r.vx) || isNaN(r.vy)) && (r.vx = r.vy = 0);
		}
	}
	function m(t) {
		return t.initialize && t.initialize(e, u), t;
	}
	return p(), t = {
		tick: f,
		restart: function() {
			return c.restart(d), t;
		},
		stop: function() {
			return c.stop(), t;
		},
		nodes: function(n) {
			return arguments.length ? (e = n, p(), s.forEach(m), t) : e;
		},
		alpha: function(e) {
			return arguments.length ? (n = +e, t) : n;
		},
		alphaMin: function(e) {
			return arguments.length ? (r = +e, t) : r;
		},
		alphaDecay: function(e) {
			return arguments.length ? (i = +e, t) : +i;
		},
		alphaTarget: function(e) {
			return arguments.length ? (a = +e, t) : a;
		},
		velocityDecay: function(e) {
			return arguments.length ? (o = 1 - e, t) : 1 - o;
		},
		randomSource: function(e) {
			return arguments.length ? (u = e, s.forEach(m), t) : u;
		},
		force: function(e, n) {
			return arguments.length > 1 ? (n == null ? s.delete(e) : s.set(e, m(n)), t) : s.get(e);
		},
		find: function(t, n, r) {
			var i = 0, a = e.length, o, s, c, l, u;
			for (r == null ? r = Infinity : r *= r, i = 0; i < a; ++i) l = e[i], o = t - l.x, s = n - l.y, c = o * o + s * s, c < r && (u = l, r = c);
			return u;
		},
		on: function(e, n) {
			return arguments.length > 1 ? (l.on(e, n), t) : l.on(e);
		}
	};
}
//#endregion
//#region ../../node_modules/.pnpm/d3-force@3.0.0/node_modules/d3-force/src/manyBody.js
function Cr() {
	var e, t, n, r, i = or(-30), a, o = 1, s = Infinity, c = .81;
	function l(n) {
		var i, a = e.length, o = nr(e, vr, yr).visitAfter(d);
		for (r = n, i = 0; i < a; ++i) t = e[i], o.visit(f);
	}
	function u() {
		if (e) {
			var t, n = e.length, r;
			for (a = Array(n), t = 0; t < n; ++t) r = e[t], a[r.index] = +i(r, t, e);
		}
	}
	function d(e) {
		var t = 0, n, r, i = 0, o, s, c;
		if (e.length) {
			for (o = s = c = 0; c < 4; ++c) (n = e[c]) && (r = Math.abs(n.value)) && (t += n.value, i += r, o += r * n.x, s += r * n.y);
			e.x = o / i, e.y = s / i;
		} else {
			n = e, n.x = n.data.x, n.y = n.data.y;
			do
				t += a[n.data.index];
			while (n = n.next);
		}
		e.value = t;
	}
	function f(e, i, l, u) {
		if (!e.value) return !0;
		var d = e.x - t.x, f = e.y - t.y, p = u - i, m = d * d + f * f;
		if (p * p / c < m) return m < s && (d === 0 && (d = sr(n), m += d * d), f === 0 && (f = sr(n), m += f * f), m < o && (m = Math.sqrt(o * m)), t.vx += d * e.value * r / m, t.vy += f * e.value * r / m), !0;
		if (!(e.length || m >= s)) {
			(e.data !== t || e.next) && (d === 0 && (d = sr(n), m += d * d), f === 0 && (f = sr(n), m += f * f), m < o && (m = Math.sqrt(o * m)));
			do
				e.data !== t && (p = a[e.data.index] * r / m, t.vx += d * p, t.vy += f * p);
			while (e = e.next);
		}
	}
	return l.initialize = function(t, r) {
		e = t, n = r, u();
	}, l.strength = function(e) {
		return arguments.length ? (i = typeof e == "function" ? e : or(+e), u(), l) : i;
	}, l.distanceMin = function(e) {
		return arguments.length ? (o = e * e, l) : Math.sqrt(o);
	}, l.distanceMax = function(e) {
		return arguments.length ? (s = e * e, l) : Math.sqrt(s);
	}, l.theta = function(e) {
		return arguments.length ? (c = e * e, l) : Math.sqrt(c);
	}, l;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-force@3.0.0/node_modules/d3-force/src/x.js
function wr(e) {
	var t = or(.1), n, r, i;
	typeof e != "function" && (e = or(e == null ? 0 : +e));
	function a(e) {
		for (var t = 0, a = n.length, o; t < a; ++t) o = n[t], o.vx += (i[t] - o.x) * r[t] * e;
	}
	function o() {
		if (n) {
			var a, o = n.length;
			for (r = Array(o), i = Array(o), a = 0; a < o; ++a) r[a] = isNaN(i[a] = +e(n[a], a, n)) ? 0 : +t(n[a], a, n);
		}
	}
	return a.initialize = function(e) {
		n = e, o();
	}, a.strength = function(e) {
		return arguments.length ? (t = typeof e == "function" ? e : or(+e), o(), a) : t;
	}, a.x = function(t) {
		return arguments.length ? (e = typeof t == "function" ? t : or(+t), o(), a) : e;
	}, a;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-force@3.0.0/node_modules/d3-force/src/y.js
function Tr(e) {
	var t = or(.1), n, r, i;
	typeof e != "function" && (e = or(e == null ? 0 : +e));
	function a(e) {
		for (var t = 0, a = n.length, o; t < a; ++t) o = n[t], o.vy += (i[t] - o.y) * r[t] * e;
	}
	function o() {
		if (n) {
			var a, o = n.length;
			for (r = Array(o), i = Array(o), a = 0; a < o; ++a) r[a] = isNaN(i[a] = +e(n[a], a, n)) ? 0 : +t(n[a], a, n);
		}
	}
	return a.initialize = function(e) {
		n = e, o();
	}, a.strength = function(e) {
		return arguments.length ? (t = typeof e == "function" ? e : or(+e), o(), a) : t;
	}, a.y = function(t) {
		return arguments.length ? (e = typeof t == "function" ? t : or(+t), o(), a) : e;
	}, a;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/math.js
var Er = 1e-6, Dr = Math.PI, Or = Dr / 2, kr = Dr / 4, Ar = Dr * 2, jr = 180 / Dr, Mr = Dr / 180, Nr = Math.abs, Pr = Math.atan, Fr = Math.atan2, j = Math.cos, Ir = Math.ceil, Lr = Math.exp, Rr = Math.hypot, zr = Math.log, Br = Math.pow, M = Math.sin, Vr = Math.sign || function(e) {
	return e > 0 ? 1 : e < 0 ? -1 : 0;
}, Hr = Math.sqrt, Ur = Math.tan;
function Wr(e) {
	return e > 1 ? 0 : e < -1 ? Dr : Math.acos(e);
}
function Gr(e) {
	return e > 1 ? Or : e < -1 ? -Or : Math.asin(e);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/noop.js
function Kr() {}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/stream.js
function qr(e, t) {
	e && Yr.hasOwnProperty(e.type) && Yr[e.type](e, t);
}
var Jr = {
	Feature: function(e, t) {
		qr(e.geometry, t);
	},
	FeatureCollection: function(e, t) {
		for (var n = e.features, r = -1, i = n.length; ++r < i;) qr(n[r].geometry, t);
	}
}, Yr = {
	Sphere: function(e, t) {
		t.sphere();
	},
	Point: function(e, t) {
		e = e.coordinates, t.point(e[0], e[1], e[2]);
	},
	MultiPoint: function(e, t) {
		for (var n = e.coordinates, r = -1, i = n.length; ++r < i;) e = n[r], t.point(e[0], e[1], e[2]);
	},
	LineString: function(e, t) {
		Xr(e.coordinates, t, 0);
	},
	MultiLineString: function(e, t) {
		for (var n = e.coordinates, r = -1, i = n.length; ++r < i;) Xr(n[r], t, 0);
	},
	Polygon: function(e, t) {
		Zr(e.coordinates, t);
	},
	MultiPolygon: function(e, t) {
		for (var n = e.coordinates, r = -1, i = n.length; ++r < i;) Zr(n[r], t);
	},
	GeometryCollection: function(e, t) {
		for (var n = e.geometries, r = -1, i = n.length; ++r < i;) qr(n[r], t);
	}
};
function Xr(e, t, n) {
	var r = -1, i = e.length - n, a;
	for (t.lineStart(); ++r < i;) a = e[r], t.point(a[0], a[1], a[2]);
	t.lineEnd();
}
function Zr(e, t) {
	var n = -1, r = e.length;
	for (t.polygonStart(); ++n < r;) Xr(e[n], t, 1);
	t.polygonEnd();
}
function Qr(e, t) {
	e && Jr.hasOwnProperty(e.type) ? Jr[e.type](e, t) : qr(e, t);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/area.js
var $r = new St(), ei = new St(), ti, ni, ri, ii, ai, oi = {
	point: Kr,
	lineStart: Kr,
	lineEnd: Kr,
	polygonStart: function() {
		$r = new St(), oi.lineStart = si, oi.lineEnd = ci;
	},
	polygonEnd: function() {
		var e = +$r;
		ei.add(e < 0 ? Ar + e : e), this.lineStart = this.lineEnd = this.point = Kr;
	},
	sphere: function() {
		ei.add(Ar);
	}
};
function si() {
	oi.point = li;
}
function ci() {
	ui(ti, ni);
}
function li(e, t) {
	oi.point = ui, ti = e, ni = t, e *= Mr, t *= Mr, ri = e, ii = j(t = t / 2 + kr), ai = M(t);
}
function ui(e, t) {
	e *= Mr, t *= Mr, t = t / 2 + kr;
	var n = e - ri, r = n >= 0 ? 1 : -1, i = r * n, a = j(t), o = M(t), s = ai * o, c = ii * a + s * j(i), l = s * r * M(i);
	$r.add(Fr(l, c)), ri = e, ii = a, ai = o;
}
function di(e) {
	return ei = new St(), Qr(e, oi), ei * 2;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/cartesian.js
function fi(e) {
	return [Fr(e[1], e[0]), Gr(e[2])];
}
function pi(e) {
	var t = e[0], n = e[1], r = j(n);
	return [
		r * j(t),
		r * M(t),
		M(n)
	];
}
function mi(e, t) {
	return e[0] * t[0] + e[1] * t[1] + e[2] * t[2];
}
function hi(e, t) {
	return [
		e[1] * t[2] - e[2] * t[1],
		e[2] * t[0] - e[0] * t[2],
		e[0] * t[1] - e[1] * t[0]
	];
}
function gi(e, t) {
	e[0] += t[0], e[1] += t[1], e[2] += t[2];
}
function _i(e, t) {
	return [
		e[0] * t,
		e[1] * t,
		e[2] * t
	];
}
function vi(e) {
	var t = Hr(e[0] * e[0] + e[1] * e[1] + e[2] * e[2]);
	e[0] /= t, e[1] /= t, e[2] /= t;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/bounds.js
var yi, bi, xi, Si, Ci, wi, Ti, Ei, Di, Oi, ki, Ai = {
	point: ji,
	lineStart: Ni,
	lineEnd: Pi,
	polygonStart: function() {
		Ai.point = Fi, Ai.lineStart = Ii, Ai.lineEnd = Li, Di = new St(), oi.polygonStart();
	},
	polygonEnd: function() {
		oi.polygonEnd(), Ai.point = ji, Ai.lineStart = Ni, Ai.lineEnd = Pi, $r < 0 ? (yi = -(xi = 180), bi = -(Si = 90)) : Di > 1e-6 ? Si = 90 : Di < -1e-6 && (bi = -90), ki[0] = yi, ki[1] = xi;
	},
	sphere: function() {
		yi = -(xi = 180), bi = -(Si = 90);
	}
};
function ji(e, t) {
	Oi.push(ki = [yi = e, xi = e]), t < bi && (bi = t), t > Si && (Si = t);
}
function Mi(e, t) {
	var n = pi([e * Mr, t * Mr]);
	if (Ei) {
		var r = hi(Ei, n), i = hi([
			r[1],
			-r[0],
			0
		], r);
		vi(i), i = fi(i);
		var a = e - Ci, o = a > 0 ? 1 : -1, s = i[0] * jr * o, c, l = Nr(a) > 180;
		l ^ (o * Ci < s && s < o * e) ? (c = i[1] * jr, c > Si && (Si = c)) : (s = (s + 360) % 360 - 180, l ^ (o * Ci < s && s < o * e) ? (c = -i[1] * jr, c < bi && (bi = c)) : (t < bi && (bi = t), t > Si && (Si = t))), l ? e < Ci ? Ri(yi, e) > Ri(yi, xi) && (xi = e) : Ri(e, xi) > Ri(yi, xi) && (yi = e) : xi >= yi ? (e < yi && (yi = e), e > xi && (xi = e)) : e > Ci ? Ri(yi, e) > Ri(yi, xi) && (xi = e) : Ri(e, xi) > Ri(yi, xi) && (yi = e);
	} else Oi.push(ki = [yi = e, xi = e]);
	t < bi && (bi = t), t > Si && (Si = t), Ei = n, Ci = e;
}
function Ni() {
	Ai.point = Mi;
}
function Pi() {
	ki[0] = yi, ki[1] = xi, Ai.point = ji, Ei = null;
}
function Fi(e, t) {
	if (Ei) {
		var n = e - Ci;
		Di.add(Nr(n) > 180 ? n + (n > 0 ? 360 : -360) : n);
	} else wi = e, Ti = t;
	oi.point(e, t), Mi(e, t);
}
function Ii() {
	oi.lineStart();
}
function Li() {
	Fi(wi, Ti), oi.lineEnd(), Nr(Di) > 1e-6 && (yi = -(xi = 180)), ki[0] = yi, ki[1] = xi, Ei = null;
}
function Ri(e, t) {
	return (t -= e) < 0 ? t + 360 : t;
}
function cee(e, t) {
	return e[0] - t[0];
}
function zi(e, t) {
	return e[0] <= e[1] ? e[0] <= t && t <= e[1] : t < e[0] || e[1] < t;
}
function Bi(e) {
	var t, n, r, i, a, o, s;
	if (Si = xi = -(yi = bi = Infinity), Oi = [], Qr(e, Ai), n = Oi.length) {
		for (Oi.sort(cee), t = 1, r = Oi[0], a = [r]; t < n; ++t) i = Oi[t], zi(r, i[0]) || zi(r, i[1]) ? (Ri(r[0], i[1]) > Ri(r[0], r[1]) && (r[1] = i[1]), Ri(i[0], r[1]) > Ri(r[0], r[1]) && (r[0] = i[0])) : a.push(r = i);
		for (o = -Infinity, n = a.length - 1, t = 0, r = a[n]; t <= n; r = i, ++t) i = a[t], (s = Ri(r[1], i[0])) > o && (o = s, yi = i[0], xi = r[1]);
	}
	return Oi = ki = null, yi === Infinity || bi === Infinity ? [[NaN, NaN], [NaN, NaN]] : [[yi, bi], [xi, Si]];
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/centroid.js
var Vi, Hi, Ui, Wi, Gi, Ki, qi, Ji, Yi, Xi, Zi, Qi, $i, ea, ta, na, ra = {
	sphere: Kr,
	point: ia,
	lineStart: oa,
	lineEnd: la,
	polygonStart: function() {
		ra.lineStart = ua, ra.lineEnd = da;
	},
	polygonEnd: function() {
		ra.lineStart = oa, ra.lineEnd = la;
	}
};
function ia(e, t) {
	e *= Mr, t *= Mr;
	var n = j(t);
	aa(n * j(e), n * M(e), M(t));
}
function aa(e, t, n) {
	++Vi, Ui += (e - Ui) / Vi, Wi += (t - Wi) / Vi, Gi += (n - Gi) / Vi;
}
function oa() {
	ra.point = sa;
}
function sa(e, t) {
	e *= Mr, t *= Mr;
	var n = j(t);
	ea = n * j(e), ta = n * M(e), na = M(t), ra.point = ca, aa(ea, ta, na);
}
function ca(e, t) {
	e *= Mr, t *= Mr;
	var n = j(t), r = n * j(e), i = n * M(e), a = M(t), o = Fr(Hr((o = ta * a - na * i) * o + (o = na * r - ea * a) * o + (o = ea * i - ta * r) * o), ea * r + ta * i + na * a);
	Hi += o, Ki += o * (ea + (ea = r)), qi += o * (ta + (ta = i)), Ji += o * (na + (na = a)), aa(ea, ta, na);
}
function la() {
	ra.point = ia;
}
function ua() {
	ra.point = fa;
}
function da() {
	pa(Qi, $i), ra.point = ia;
}
function fa(e, t) {
	Qi = e, $i = t, e *= Mr, t *= Mr, ra.point = pa;
	var n = j(t);
	ea = n * j(e), ta = n * M(e), na = M(t), aa(ea, ta, na);
}
function pa(e, t) {
	e *= Mr, t *= Mr;
	var n = j(t), r = n * j(e), i = n * M(e), a = M(t), o = ta * a - na * i, s = na * r - ea * a, c = ea * i - ta * r, l = Rr(o, s, c), u = Gr(l), d = l && -u / l;
	Yi.add(d * o), Xi.add(d * s), Zi.add(d * c), Hi += u, Ki += u * (ea + (ea = r)), qi += u * (ta + (ta = i)), Ji += u * (na + (na = a)), aa(ea, ta, na);
}
function ma(e) {
	Vi = Hi = Ui = Wi = Gi = Ki = qi = Ji = 0, Yi = new St(), Xi = new St(), Zi = new St(), Qr(e, ra);
	var t = +Yi, n = +Xi, r = +Zi, i = Rr(t, n, r);
	return i < 1e-12 && (t = Ki, n = qi, r = Ji, Hi < 1e-6 && (t = Ui, n = Wi, r = Gi), i = Rr(t, n, r), i < 1e-12) ? [NaN, NaN] : [Fr(n, t) * jr, Gr(r / i) * jr];
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/compose.js
function ha(e, t) {
	function n(n, r) {
		return n = e(n, r), t(n[0], n[1]);
	}
	return e.invert && t.invert && (n.invert = function(n, r) {
		return n = t.invert(n, r), n && e.invert(n[0], n[1]);
	}), n;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/rotation.js
function ga(e, t) {
	return Nr(e) > Dr && (e -= Math.round(e / Ar) * Ar), [e, t];
}
ga.invert = ga;
function _a(e, t, n) {
	return (e %= Ar) ? t || n ? ha(ya(e), ba(t, n)) : ya(e) : t || n ? ba(t, n) : ga;
}
function va(e) {
	return function(t, n) {
		return t += e, Nr(t) > Dr && (t -= Math.round(t / Ar) * Ar), [t, n];
	};
}
function ya(e) {
	var t = va(e);
	return t.invert = va(-e), t;
}
function ba(e, t) {
	var n = j(e), r = M(e), i = j(t), a = M(t);
	function o(e, t) {
		var o = j(t), s = j(e) * o, c = M(e) * o, l = M(t), u = l * n + s * r;
		return [Fr(c * i - u * a, s * n - l * r), Gr(u * i + c * a)];
	}
	return o.invert = function(e, t) {
		var o = j(t), s = j(e) * o, c = M(e) * o, l = M(t), u = l * i - c * a;
		return [Fr(c * i + l * a, s * n + u * r), Gr(u * n - s * r)];
	}, o;
}
function xa(e) {
	e = _a(e[0] * Mr, e[1] * Mr, e.length > 2 ? e[2] * Mr : 0);
	function t(t) {
		return t = e(t[0] * Mr, t[1] * Mr), t[0] *= jr, t[1] *= jr, t;
	}
	return t.invert = function(t) {
		return t = e.invert(t[0] * Mr, t[1] * Mr), t[0] *= jr, t[1] *= jr, t;
	}, t;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/circle.js
function Sa(e, t, n, r, i, a) {
	if (n) {
		var o = j(t), s = M(t), c = r * n;
		i == null ? (i = t + r * Ar, a = t - c / 2) : (i = Ca(o, i), a = Ca(o, a), (r > 0 ? i < a : i > a) && (i += r * Ar));
		for (var l, u = i; r > 0 ? u > a : u < a; u -= c) l = fi([
			o,
			-s * j(u),
			-s * M(u)
		]), e.point(l[0], l[1]);
	}
}
function Ca(e, t) {
	t = pi(t), t[0] -= e, vi(t);
	var n = Wr(-t[1]);
	return ((-t[2] < 0 ? -n : n) + Ar - Er) % Ar;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/clip/buffer.js
function wa() {
	var e = [], t;
	return {
		point: function(e, n, r) {
			t.push([
				e,
				n,
				r
			]);
		},
		lineStart: function() {
			e.push(t = []);
		},
		lineEnd: Kr,
		rejoin: function() {
			e.length > 1 && e.push(e.pop().concat(e.shift()));
		},
		result: function() {
			var n = e;
			return e = [], t = null, n;
		}
	};
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/pointEqual.js
function Ta(e, t) {
	return Nr(e[0] - t[0]) < 1e-6 && Nr(e[1] - t[1]) < 1e-6;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/clip/rejoin.js
function Ea(e, t, n, r) {
	this.x = e, this.z = t, this.o = n, this.e = r, this.v = !1, this.n = this.p = null;
}
function Da(e, t, n, r, i) {
	var a = [], o = [], s, c;
	if (e.forEach(function(e) {
		if (!((t = e.length - 1) <= 0)) {
			var t, n = e[0], r = e[t], c;
			if (Ta(n, r)) {
				if (!n[2] && !r[2]) {
					for (i.lineStart(), s = 0; s < t; ++s) i.point((n = e[s])[0], n[1]);
					i.lineEnd();
					return;
				}
				r[0] += 2 * Er;
			}
			a.push(c = new Ea(n, e, null, !0)), o.push(c.o = new Ea(n, null, c, !1)), a.push(c = new Ea(r, e, null, !1)), o.push(c.o = new Ea(r, null, c, !0));
		}
	}), a.length) {
		for (o.sort(t), Oa(a), Oa(o), s = 0, c = o.length; s < c; ++s) o[s].e = n = !n;
		for (var l = a[0], u, d;;) {
			for (var f = l, p = !0; f.v;) if ((f = f.n) === l) return;
			u = f.z, i.lineStart();
			do {
				if (f.v = f.o.v = !0, f.e) {
					if (p) for (s = 0, c = u.length; s < c; ++s) i.point((d = u[s])[0], d[1]);
					else r(f.x, f.n.x, 1, i);
					f = f.n;
				} else {
					if (p) for (u = f.p.z, s = u.length - 1; s >= 0; --s) i.point((d = u[s])[0], d[1]);
					else r(f.x, f.p.x, -1, i);
					f = f.p;
				}
				f = f.o, u = f.z, p = !p;
			} while (!f.v);
			i.lineEnd();
		}
	}
}
function Oa(e) {
	if (t = e.length) {
		for (var t, n = 0, r = e[0], i; ++n < t;) r.n = i = e[n], i.p = r, r = i;
		r.n = i = e[0], i.p = r;
	}
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/polygonContains.js
function ka(e) {
	return Nr(e[0]) <= Dr ? e[0] : Vr(e[0]) * ((Nr(e[0]) + Dr) % Ar - Dr);
}
function Aa(e, t) {
	var n = ka(t), r = t[1], i = M(r), a = [
		M(n),
		-j(n),
		0
	], o = 0, s = 0, c = new St();
	i === 1 ? r = Or + Er : i === -1 && (r = -Or - Er);
	for (var l = 0, u = e.length; l < u; ++l) if (f = (d = e[l]).length) for (var d, f, p = d[f - 1], m = ka(p), h = p[1] / 2 + kr, g = M(h), _ = j(h), v = 0; v < f; ++v, m = b, g = S, _ = C, p = y) {
		var y = d[v], b = ka(y), x = y[1] / 2 + kr, S = M(x), C = j(x), w = b - m, T = w >= 0 ? 1 : -1, E = T * w, D = E > Dr, O = g * S;
		if (c.add(Fr(O * T * M(E), _ * C + O * j(E))), o += D ? w + T * Ar : w, D ^ m >= n ^ b >= n) {
			var k = hi(pi(p), pi(y));
			vi(k);
			var ee = hi(a, k);
			vi(ee);
			var te = (D ^ w >= 0 ? -1 : 1) * Gr(ee[2]);
			(r > te || r === te && (k[0] || k[1])) && (s += D ^ w >= 0 ? 1 : -1);
		}
	}
	return (o < -1e-6 || o < 1e-6 && c < -1e-12) ^ s & 1;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/clip/index.js
function ja(e, t, n, r) {
	return function(i) {
		var a = t(i), o = wa(), s = t(o), c = !1, l, u, d, f = {
			point: p,
			lineStart: h,
			lineEnd: g,
			polygonStart: function() {
				f.point = _, f.lineStart = v, f.lineEnd = y, u = [], l = [];
			},
			polygonEnd: function() {
				f.point = p, f.lineStart = h, f.lineEnd = g, u = Nt(u);
				var e = Aa(l, r);
				u.length ? (c || (i.polygonStart(), c = !0), Da(u, Na, e, n, i)) : e && (c || (i.polygonStart(), c = !0), i.lineStart(), n(null, null, 1, i), i.lineEnd()), c && (i.polygonEnd(), c = !1), u = l = null;
			},
			sphere: function() {
				i.polygonStart(), i.lineStart(), n(null, null, 1, i), i.lineEnd(), i.polygonEnd();
			}
		};
		function p(t, n) {
			e(t, n) && i.point(t, n);
		}
		function m(e, t) {
			a.point(e, t);
		}
		function h() {
			f.point = m, a.lineStart();
		}
		function g() {
			f.point = p, a.lineEnd();
		}
		function _(e, t) {
			d.push([e, t]), s.point(e, t);
		}
		function v() {
			s.lineStart(), d = [];
		}
		function y() {
			_(d[0][0], d[0][1]), s.lineEnd();
			var e = s.clean(), t = o.result(), n, r = t.length, a, f, p;
			if (d.pop(), l.push(d), d = null, r) {
				if (e & 1) {
					if (f = t[0], (a = f.length - 1) > 0) {
						for (c || (i.polygonStart(), c = !0), i.lineStart(), n = 0; n < a; ++n) i.point((p = f[n])[0], p[1]);
						i.lineEnd();
					}
					return;
				}
				r > 1 && e & 2 && t.push(t.pop().concat(t.shift())), u.push(t.filter(Ma));
			}
		}
		return f;
	};
}
function Ma(e) {
	return e.length > 1;
}
function Na(e, t) {
	return ((e = e.x)[0] < 0 ? e[1] - Or - Er : Or - e[1]) - ((t = t.x)[0] < 0 ? t[1] - Or - Er : Or - t[1]);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/clip/antimeridian.js
var Pa = ja(function() {
	return !0;
}, Fa, La, [-Dr, -Or]);
function Fa(e) {
	var t = NaN, n = NaN, r = NaN, i;
	return {
		lineStart: function() {
			e.lineStart(), i = 1;
		},
		point: function(a, o) {
			var s = a > 0 ? Dr : -Dr, c = Nr(a - t);
			Nr(c - Dr) < 1e-6 ? (e.point(t, n = (n + o) / 2 > 0 ? Or : -Or), e.point(r, n), e.lineEnd(), e.lineStart(), e.point(s, n), e.point(a, n), i = 0) : r !== s && c >= Dr && (Nr(t - r) < 1e-6 && (t -= r * Er), Nr(a - s) < 1e-6 && (a -= s * Er), n = Ia(t, n, a, o), e.point(r, n), e.lineEnd(), e.lineStart(), e.point(s, n), i = 0), e.point(t = a, n = o), r = s;
		},
		lineEnd: function() {
			e.lineEnd(), t = n = NaN;
		},
		clean: function() {
			return 2 - i;
		}
	};
}
function Ia(e, t, n, r) {
	var i, a, o = M(e - n);
	return Nr(o) > 1e-6 ? Pr((M(t) * (a = j(r)) * M(n) - M(r) * (i = j(t)) * M(e)) / (i * a * o)) : (t + r) / 2;
}
function La(e, t, n, r) {
	var i;
	if (e == null) i = n * Or, r.point(-Dr, i), r.point(0, i), r.point(Dr, i), r.point(Dr, 0), r.point(Dr, -i), r.point(0, -i), r.point(-Dr, -i), r.point(-Dr, 0), r.point(-Dr, i);
	else if (Nr(e[0] - t[0]) > 1e-6) {
		var a = e[0] < t[0] ? Dr : -Dr;
		i = n * a / 2, r.point(-a, i), r.point(0, i), r.point(a, i);
	} else r.point(t[0], t[1]);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/clip/circle.js
function Ra(e) {
	var t = j(e), n = 2 * Mr, r = t > 0, i = Nr(t) > Er;
	function a(t, r, i, a) {
		Sa(a, e, n, i, t, r);
	}
	function o(e, n) {
		return j(e) * j(n) > t;
	}
	function s(e) {
		var t, n, a, s, u;
		return {
			lineStart: function() {
				s = a = !1, u = 1;
			},
			point: function(d, f) {
				var p = [d, f], m, h = o(d, f), g = r ? h ? 0 : l(d, f) : h ? l(d + (d < 0 ? Dr : -Dr), f) : 0;
				if (!t && (s = a = h) && e.lineStart(), h !== a && (m = c(t, p), (!m || Ta(t, m) || Ta(p, m)) && (p[2] = 1)), h !== a) u = 0, h ? (e.lineStart(), m = c(p, t), e.point(m[0], m[1])) : (m = c(t, p), e.point(m[0], m[1], 2), e.lineEnd()), t = m;
				else if (i && t && r ^ h) {
					var _;
					!(g & n) && (_ = c(p, t, !0)) && (u = 0, r ? (e.lineStart(), e.point(_[0][0], _[0][1]), e.point(_[1][0], _[1][1]), e.lineEnd()) : (e.point(_[1][0], _[1][1]), e.lineEnd(), e.lineStart(), e.point(_[0][0], _[0][1], 3)));
				}
				h && (!t || !Ta(t, p)) && e.point(p[0], p[1]), t = p, a = h, n = g;
			},
			lineEnd: function() {
				a && e.lineEnd(), t = null;
			},
			clean: function() {
				return u | (s && a) << 1;
			}
		};
	}
	function c(e, n, r) {
		var i = pi(e), a = pi(n), o = [
			1,
			0,
			0
		], s = hi(i, a), c = mi(s, s), l = s[0], u = c - l * l;
		if (!u) return !r && e;
		var d = t * c / u, f = -t * l / u, p = hi(o, s), m = _i(o, d);
		gi(m, _i(s, f));
		var h = p, g = mi(m, h), _ = mi(h, h), v = g * g - _ * (mi(m, m) - 1);
		if (!(v < 0)) {
			var y = Hr(v), b = _i(h, (-g - y) / _);
			if (gi(b, m), b = fi(b), !r) return b;
			var x = e[0], S = n[0], C = e[1], w = n[1], T;
			S < x && (T = x, x = S, S = T);
			var E = S - x, D = Nr(E - Dr) < Er, O = D || E < 1e-6;
			if (!D && w < C && (T = C, C = w, w = T), O ? D ? C + w > 0 ^ b[1] < (Nr(b[0] - x) < 1e-6 ? C : w) : C <= b[1] && b[1] <= w : E > Dr ^ (x <= b[0] && b[0] <= S)) {
				var k = _i(h, (-g + y) / _);
				return gi(k, m), [b, fi(k)];
			}
		}
	}
	function l(t, n) {
		var i = r ? e : Dr - e, a = 0;
		return t < -i ? a |= 1 : t > i && (a |= 2), n < -i ? a |= 4 : n > i && (a |= 8), a;
	}
	return ja(o, s, a, r ? [0, -e] : [-Dr, e - Dr]);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/clip/line.js
function za(e, t, n, r, i, a) {
	var o = e[0], s = e[1], c = t[0], l = t[1], u = 0, d = 1, f = c - o, p = l - s, m = n - o;
	if (!(!f && m > 0)) {
		if (m /= f, f < 0) {
			if (m < u) return;
			m < d && (d = m);
		} else if (f > 0) {
			if (m > d) return;
			m > u && (u = m);
		}
		if (m = i - o, !(!f && m < 0)) {
			if (m /= f, f < 0) {
				if (m > d) return;
				m > u && (u = m);
			} else if (f > 0) {
				if (m < u) return;
				m < d && (d = m);
			}
			if (m = r - s, !(!p && m > 0)) {
				if (m /= p, p < 0) {
					if (m < u) return;
					m < d && (d = m);
				} else if (p > 0) {
					if (m > d) return;
					m > u && (u = m);
				}
				if (m = a - s, !(!p && m < 0)) {
					if (m /= p, p < 0) {
						if (m > d) return;
						m > u && (u = m);
					} else if (p > 0) {
						if (m < u) return;
						m < d && (d = m);
					}
					return u > 0 && (e[0] = o + u * f, e[1] = s + u * p), d < 1 && (t[0] = o + d * f, t[1] = s + d * p), !0;
				}
			}
		}
	}
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/clip/rectangle.js
var Ba = 1e9, Va = -Ba;
function Ha(e, t, n, r) {
	function i(i, a) {
		return e <= i && i <= n && t <= a && a <= r;
	}
	function a(i, a, s, l) {
		var u = 0, d = 0;
		if (i == null || (u = o(i, s)) !== (d = o(a, s)) || c(i, a) < 0 ^ s > 0) do
			l.point(u === 0 || u === 3 ? e : n, u > 1 ? r : t);
		while ((u = (u + s + 4) % 4) !== d);
		else l.point(a[0], a[1]);
	}
	function o(r, i) {
		return Nr(r[0] - e) < 1e-6 ? i > 0 ? 0 : 3 : Nr(r[0] - n) < 1e-6 ? i > 0 ? 2 : 1 : Nr(r[1] - t) < 1e-6 ? +(i > 0) : i > 0 ? 3 : 2;
	}
	function s(e, t) {
		return c(e.x, t.x);
	}
	function c(e, t) {
		var n = o(e, 1), r = o(t, 1);
		return n === r ? n === 0 ? t[1] - e[1] : n === 1 ? e[0] - t[0] : n === 2 ? e[1] - t[1] : t[0] - e[0] : n - r;
	}
	return function(o) {
		var c = o, l = wa(), u, d, f, p, m, h, g, _, v, y, b, x = {
			point: S,
			lineStart: E,
			lineEnd: D,
			polygonStart: w,
			polygonEnd: T
		};
		function S(e, t) {
			i(e, t) && c.point(e, t);
		}
		function C() {
			for (var t = 0, n = 0, i = d.length; n < i; ++n) for (var a = d[n], o = 1, s = a.length, c = a[0], l, u, f = c[0], p = c[1]; o < s; ++o) l = f, u = p, c = a[o], f = c[0], p = c[1], u <= r ? p > r && (f - l) * (r - u) > (p - u) * (e - l) && ++t : p <= r && (f - l) * (r - u) < (p - u) * (e - l) && --t;
			return t;
		}
		function w() {
			c = l, u = [], d = [], b = !0;
		}
		function T() {
			var e = C(), t = b && e, n = (u = Nt(u)).length;
			(t || n) && (o.polygonStart(), t && (o.lineStart(), a(null, null, 1, o), o.lineEnd()), n && Da(u, s, e, a, o), o.polygonEnd()), c = o, u = d = f = null;
		}
		function E() {
			x.point = O, d && d.push(f = []), y = !0, v = !1, g = _ = NaN;
		}
		function D() {
			u && (O(p, m), h && v && l.rejoin(), u.push(l.result())), x.point = S, v && c.lineEnd();
		}
		function O(a, o) {
			var s = i(a, o);
			if (d && f.push([a, o]), y) p = a, m = o, h = s, y = !1, s && (c.lineStart(), c.point(a, o));
			else if (s && v) c.point(a, o);
			else {
				var l = [g = Math.max(Va, Math.min(Ba, g)), _ = Math.max(Va, Math.min(Ba, _))], u = [a = Math.max(Va, Math.min(Ba, a)), o = Math.max(Va, Math.min(Ba, o))];
				za(l, u, e, t, n, r) ? (v || (c.lineStart(), c.point(l[0], l[1])), c.point(u[0], u[1]), s || c.lineEnd(), b = !1) : s && (c.lineStart(), c.point(a, o), b = !1);
			}
			g = a, _ = o, v = s;
		}
		return x;
	};
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/graticule.js
function Ua(e, t, n) {
	var r = ye(e, t - Er, n).concat(t);
	return function(e) {
		return r.map(function(t) {
			return [e, t];
		});
	};
}
function Wa(e, t, n) {
	var r = ye(e, t - Er, n).concat(t);
	return function(e) {
		return r.map(function(t) {
			return [t, e];
		});
	};
}
function Ga() {
	var e, t, n, r, i, a, o, s, c = 10, l = c, u = 90, d = 360, f, p, m, h, g = 2.5;
	function _() {
		return {
			type: "MultiLineString",
			coordinates: v()
		};
	}
	function v() {
		return ye(Ir(r / u) * u, n, u).map(m).concat(ye(Ir(s / d) * d, o, d).map(h)).concat(ye(Ir(t / c) * c, e, c).filter(function(e) {
			return Nr(e % u) > Er;
		}).map(f)).concat(ye(Ir(a / l) * l, i, l).filter(function(e) {
			return Nr(e % d) > Er;
		}).map(p));
	}
	return _.lines = function() {
		return v().map(function(e) {
			return {
				type: "LineString",
				coordinates: e
			};
		});
	}, _.outline = function() {
		return {
			type: "Polygon",
			coordinates: [m(r).concat(h(o).slice(1), m(n).reverse().slice(1), h(s).reverse().slice(1))]
		};
	}, _.extent = function(e) {
		return arguments.length ? _.extentMajor(e).extentMinor(e) : _.extentMinor();
	}, _.extentMajor = function(e) {
		return arguments.length ? (r = +e[0][0], n = +e[1][0], s = +e[0][1], o = +e[1][1], r > n && (e = r, r = n, n = e), s > o && (e = s, s = o, o = e), _.precision(g)) : [[r, s], [n, o]];
	}, _.extentMinor = function(n) {
		return arguments.length ? (t = +n[0][0], e = +n[1][0], a = +n[0][1], i = +n[1][1], t > e && (n = t, t = e, e = n), a > i && (n = a, a = i, i = n), _.precision(g)) : [[t, a], [e, i]];
	}, _.step = function(e) {
		return arguments.length ? _.stepMajor(e).stepMinor(e) : _.stepMinor();
	}, _.stepMajor = function(e) {
		return arguments.length ? (u = +e[0], d = +e[1], _) : [u, d];
	}, _.stepMinor = function(e) {
		return arguments.length ? (c = +e[0], l = +e[1], _) : [c, l];
	}, _.precision = function(c) {
		return arguments.length ? (g = +c, f = Ua(a, i, 90), p = Wa(t, e, g), m = Ua(s, o, 90), h = Wa(r, n, g), _) : g;
	}, _.extentMajor([[-180, -90 + Er], [180, 90 - Er]]).extentMinor([[-180, -80 - Er], [180, 80 + Er]]);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/identity.js
var Ka = (e) => e, qa = new St(), Ja = new St(), Ya, Xa, Za, Qa, $a = {
	point: Kr,
	lineStart: Kr,
	lineEnd: Kr,
	polygonStart: function() {
		$a.lineStart = eo, $a.lineEnd = lee;
	},
	polygonEnd: function() {
		$a.lineStart = $a.lineEnd = $a.point = Kr, qa.add(Nr(Ja)), Ja = new St();
	},
	result: function() {
		var e = qa / 2;
		return qa = new St(), e;
	}
};
function eo() {
	$a.point = to;
}
function to(e, t) {
	$a.point = no, Ya = Za = e, Xa = Qa = t;
}
function no(e, t) {
	Ja.add(Qa * e - Za * t), Za = e, Qa = t;
}
function lee() {
	no(Ya, Xa);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/path/bounds.js
var ro = Infinity, io = ro, ao = -ro, oo = ao, so = {
	point: co,
	lineStart: Kr,
	lineEnd: Kr,
	polygonStart: Kr,
	polygonEnd: Kr,
	result: function() {
		var e = [[ro, io], [ao, oo]];
		return ao = oo = -(io = ro = Infinity), e;
	}
};
function co(e, t) {
	e < ro && (ro = e), e > ao && (ao = e), t < io && (io = t), t > oo && (oo = t);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/path/centroid.js
var lo = 0, uo = 0, fo = 0, po = 0, mo = 0, ho = 0, go = 0, _o = 0, vo = 0, yo, bo, xo, So, Co = {
	point: wo,
	lineStart: To,
	lineEnd: Oo,
	polygonStart: function() {
		Co.lineStart = ko, Co.lineEnd = Ao;
	},
	polygonEnd: function() {
		Co.point = wo, Co.lineStart = To, Co.lineEnd = Oo;
	},
	result: function() {
		var e = vo ? [go / vo, _o / vo] : ho ? [po / ho, mo / ho] : fo ? [lo / fo, uo / fo] : [NaN, NaN];
		return lo = uo = fo = po = mo = ho = go = _o = vo = 0, e;
	}
};
function wo(e, t) {
	lo += e, uo += t, ++fo;
}
function To() {
	Co.point = Eo;
}
function Eo(e, t) {
	Co.point = Do, wo(xo = e, So = t);
}
function Do(e, t) {
	var n = e - xo, r = t - So, i = Hr(n * n + r * r);
	po += i * (xo + e) / 2, mo += i * (So + t) / 2, ho += i, wo(xo = e, So = t);
}
function Oo() {
	Co.point = wo;
}
function ko() {
	Co.point = jo;
}
function Ao() {
	Mo(yo, bo);
}
function jo(e, t) {
	Co.point = Mo, wo(yo = xo = e, bo = So = t);
}
function Mo(e, t) {
	var n = e - xo, r = t - So, i = Hr(n * n + r * r);
	po += i * (xo + e) / 2, mo += i * (So + t) / 2, ho += i, i = So * e - xo * t, go += i * (xo + e), _o += i * (So + t), vo += i * 3, wo(xo = e, So = t);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/path/context.js
function No(e) {
	this._context = e;
}
No.prototype = {
	_radius: 4.5,
	pointRadius: function(e) {
		return this._radius = e, this;
	},
	polygonStart: function() {
		this._line = 0;
	},
	polygonEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._point = 0;
	},
	lineEnd: function() {
		this._line === 0 && this._context.closePath(), this._point = NaN;
	},
	point: function(e, t) {
		switch (this._point) {
			case 0:
				this._context.moveTo(e, t), this._point = 1;
				break;
			case 1:
				this._context.lineTo(e, t);
				break;
			default:
				this._context.moveTo(e + this._radius, t), this._context.arc(e, t, this._radius, 0, Ar);
				break;
		}
	},
	result: Kr
};
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/path/measure.js
var Po = new St(), Fo, Io, Lo, Ro, zo, Bo = {
	point: Kr,
	lineStart: function() {
		Bo.point = Vo;
	},
	lineEnd: function() {
		Fo && Ho(Io, Lo), Bo.point = Kr;
	},
	polygonStart: function() {
		Fo = !0;
	},
	polygonEnd: function() {
		Fo = null;
	},
	result: function() {
		var e = +Po;
		return Po = new St(), e;
	}
};
function Vo(e, t) {
	Bo.point = Ho, Io = Ro = e, Lo = zo = t;
}
function Ho(e, t) {
	Ro -= e, zo -= t, Po.add(Hr(Ro * Ro + zo * zo)), Ro = e, zo = t;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/path/string.js
var Uo, Wo, Go, Ko, qo = class {
	constructor(e) {
		this._append = e == null ? Jo : Yo(e), this._radius = 4.5, this._ = "";
	}
	pointRadius(e) {
		return this._radius = +e, this;
	}
	polygonStart() {
		this._line = 0;
	}
	polygonEnd() {
		this._line = NaN;
	}
	lineStart() {
		this._point = 0;
	}
	lineEnd() {
		this._line === 0 && (this._ += "Z"), this._point = NaN;
	}
	point(e, t) {
		switch (this._point) {
			case 0:
				this._append`M${e},${t}`, this._point = 1;
				break;
			case 1:
				this._append`L${e},${t}`;
				break;
			default:
				if (this._append`M${e},${t}`, this._radius !== Go || this._append !== Wo) {
					let e = this._radius, t = this._;
					this._ = "", this._append`m0,${e}a${e},${e} 0 1,1 0,${-2 * e}a${e},${e} 0 1,1 0,${2 * e}z`, Go = e, Wo = this._append, Ko = this._, this._ = t;
				}
				this._ += Ko;
				break;
		}
	}
	result() {
		let e = this._;
		return this._ = "", e.length ? e : null;
	}
};
function Jo(e) {
	let t = 1;
	this._ += e[0];
	for (let n = e.length; t < n; ++t) this._ += arguments[t] + e[t];
}
function Yo(e) {
	let t = Math.floor(e);
	if (!(t >= 0)) throw RangeError(`invalid digits: ${e}`);
	if (t > 15) return Jo;
	if (t !== Uo) {
		let e = 10 ** t;
		Uo = t, Wo = function(t) {
			let n = 1;
			this._ += t[0];
			for (let r = t.length; n < r; ++n) this._ += Math.round(arguments[n] * e) / e + t[n];
		};
	}
	return Wo;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/path/index.js
function Xo(e, t) {
	let n = 3, r = 4.5, i, a;
	function o(e) {
		return e && (typeof r == "function" && a.pointRadius(+r.apply(this, arguments)), Qr(e, i(a))), a.result();
	}
	return o.area = function(e) {
		return Qr(e, i($a)), $a.result();
	}, o.measure = function(e) {
		return Qr(e, i(Bo)), Bo.result();
	}, o.bounds = function(e) {
		return Qr(e, i(so)), so.result();
	}, o.centroid = function(e) {
		return Qr(e, i(Co)), Co.result();
	}, o.projection = function(t) {
		return arguments.length ? (i = t == null ? (e = null, Ka) : (e = t).stream, o) : e;
	}, o.context = function(e) {
		return arguments.length ? (a = e == null ? (t = null, new qo(n)) : new No(t = e), typeof r != "function" && a.pointRadius(r), o) : t;
	}, o.pointRadius = function(e) {
		return arguments.length ? (r = typeof e == "function" ? e : (a.pointRadius(+e), +e), o) : r;
	}, o.digits = function(e) {
		if (!arguments.length) return n;
		if (e == null) n = null;
		else {
			let t = Math.floor(e);
			if (!(t >= 0)) throw RangeError(`invalid digits: ${e}`);
			n = t;
		}
		return t === null && (a = new qo(n)), o;
	}, o.projection(e).digits(n).context(t);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/transform.js
function Zo(e) {
	return function(t) {
		var n = new Qo();
		for (var r in e) n[r] = e[r];
		return n.stream = t, n;
	};
}
function Qo() {}
Qo.prototype = {
	constructor: Qo,
	point: function(e, t) {
		this.stream.point(e, t);
	},
	sphere: function() {
		this.stream.sphere();
	},
	lineStart: function() {
		this.stream.lineStart();
	},
	lineEnd: function() {
		this.stream.lineEnd();
	},
	polygonStart: function() {
		this.stream.polygonStart();
	},
	polygonEnd: function() {
		this.stream.polygonEnd();
	}
};
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/projection/fit.js
function $o(e, t, n) {
	var r = e.clipExtent && e.clipExtent();
	return e.scale(150).translate([0, 0]), r != null && e.clipExtent(null), Qr(n, e.stream(so)), t(so.result()), r != null && e.clipExtent(r), e;
}
function es(e, t, n) {
	return $o(e, function(n) {
		var r = t[1][0] - t[0][0], i = t[1][1] - t[0][1], a = Math.min(r / (n[1][0] - n[0][0]), i / (n[1][1] - n[0][1])), o = +t[0][0] + (r - a * (n[1][0] + n[0][0])) / 2, s = +t[0][1] + (i - a * (n[1][1] + n[0][1])) / 2;
		e.scale(150 * a).translate([o, s]);
	}, n);
}
function ts(e, t, n) {
	return es(e, [[0, 0], t], n);
}
function ns(e, t, n) {
	return $o(e, function(n) {
		var r = +t, i = r / (n[1][0] - n[0][0]), a = (r - i * (n[1][0] + n[0][0])) / 2, o = -i * n[0][1];
		e.scale(150 * i).translate([a, o]);
	}, n);
}
function rs(e, t, n) {
	return $o(e, function(n) {
		var r = +t, i = r / (n[1][1] - n[0][1]), a = -i * n[0][0], o = (r - i * (n[1][1] + n[0][1])) / 2;
		e.scale(150 * i).translate([a, o]);
	}, n);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/projection/resample.js
var is = 16, as = j(30 * Mr);
function os(e, t) {
	return +t ? cs(e, t) : ss(e);
}
function ss(e) {
	return Zo({ point: function(t, n) {
		t = e(t, n), this.stream.point(t[0], t[1]);
	} });
}
function cs(e, t) {
	function n(r, i, a, o, s, c, l, u, d, f, p, m, h, g) {
		var _ = l - r, v = u - i, y = _ * _ + v * v;
		if (y > 4 * t && h--) {
			var b = o + f, x = s + p, S = c + m, C = Hr(b * b + x * x + S * S), w = Gr(S /= C), T = Nr(Nr(S) - 1) < 1e-6 || Nr(a - d) < 1e-6 ? (a + d) / 2 : Fr(x, b), E = e(T, w), D = E[0], O = E[1], k = D - r, ee = O - i, te = v * k - _ * ee;
			(te * te / y > t || Nr((_ * k + v * ee) / y - .5) > .3 || o * f + s * p + c * m < as) && (n(r, i, a, o, s, c, D, O, T, b /= C, x /= C, S, h, g), g.point(D, O), n(D, O, T, b, x, S, l, u, d, f, p, m, h, g));
		}
	}
	return function(t) {
		var r, i, a, o, s, c, l, u, d, f, p, m, h = {
			point: g,
			lineStart: _,
			lineEnd: y,
			polygonStart: function() {
				t.polygonStart(), h.lineStart = b;
			},
			polygonEnd: function() {
				t.polygonEnd(), h.lineStart = _;
			}
		};
		function g(n, r) {
			n = e(n, r), t.point(n[0], n[1]);
		}
		function _() {
			u = NaN, h.point = v, t.lineStart();
		}
		function v(r, i) {
			var a = pi([r, i]), o = e(r, i);
			n(u, d, l, f, p, m, u = o[0], d = o[1], l = r, f = a[0], p = a[1], m = a[2], is, t), t.point(u, d);
		}
		function y() {
			h.point = g, t.lineEnd();
		}
		function b() {
			_(), h.point = x, h.lineEnd = S;
		}
		function x(e, t) {
			v(r = e, t), i = u, a = d, o = f, s = p, c = m, h.point = v;
		}
		function S() {
			n(u, d, l, f, p, m, i, a, r, o, s, c, is, t), h.lineEnd = y, y();
		}
		return h;
	};
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/projection/index.js
var ls = Zo({ point: function(e, t) {
	this.stream.point(e * Mr, t * Mr);
} });
function us(e) {
	return Zo({ point: function(t, n) {
		var r = e(t, n);
		return this.stream.point(r[0], r[1]);
	} });
}
function ds(e, t, n, r, i) {
	function a(a, o) {
		return a *= r, o *= i, [t + e * a, n - e * o];
	}
	return a.invert = function(a, o) {
		return [(a - t) / e * r, (n - o) / e * i];
	}, a;
}
function fs(e, t, n, r, i, a) {
	if (!a) return ds(e, t, n, r, i);
	var o = j(a), s = M(a), c = o * e, l = s * e, u = o / e, d = s / e, f = (s * n - o * t) / e, p = (s * t + o * n) / e;
	function m(e, a) {
		return e *= r, a *= i, [c * e - l * a + t, n - l * e - c * a];
	}
	return m.invert = function(e, t) {
		return [r * (u * e - d * t + f), i * (p - d * e - u * t)];
	}, m;
}
function ps(e) {
	return ms(function() {
		return e;
	})();
}
function ms(e) {
	var t, n = 150, r = 480, i = 250, a = 0, o = 0, s = 0, c = 0, l = 0, u, d = 0, f = 1, p = 1, m = null, h = Pa, g = null, _, v, y, b = Ka, x = .5, S, C, w, T, E;
	function D(e) {
		return w(e[0] * Mr, e[1] * Mr);
	}
	function O(e) {
		return e = w.invert(e[0], e[1]), e && [e[0] * jr, e[1] * jr];
	}
	D.stream = function(e) {
		return T && E === e ? T : T = ls(us(u)(h(S(b(E = e)))));
	}, D.preclip = function(e) {
		return arguments.length ? (h = e, m = void 0, ee()) : h;
	}, D.postclip = function(e) {
		return arguments.length ? (b = e, g = _ = v = y = null, ee()) : b;
	}, D.clipAngle = function(e) {
		return arguments.length ? (h = +e ? Ra(m = e * Mr) : (m = null, Pa), ee()) : m * jr;
	}, D.clipExtent = function(e) {
		return arguments.length ? (b = e == null ? (g = _ = v = y = null, Ka) : Ha(g = +e[0][0], _ = +e[0][1], v = +e[1][0], y = +e[1][1]), ee()) : g == null ? null : [[g, _], [v, y]];
	}, D.scale = function(e) {
		return arguments.length ? (n = +e, k()) : n;
	}, D.translate = function(e) {
		return arguments.length ? (r = +e[0], i = +e[1], k()) : [r, i];
	}, D.center = function(e) {
		return arguments.length ? (a = e[0] % 360 * Mr, o = e[1] % 360 * Mr, k()) : [a * jr, o * jr];
	}, D.rotate = function(e) {
		return arguments.length ? (s = e[0] % 360 * Mr, c = e[1] % 360 * Mr, l = e.length > 2 ? e[2] % 360 * Mr : 0, k()) : [
			s * jr,
			c * jr,
			l * jr
		];
	}, D.angle = function(e) {
		return arguments.length ? (d = e % 360 * Mr, k()) : d * jr;
	}, D.reflectX = function(e) {
		return arguments.length ? (f = e ? -1 : 1, k()) : f < 0;
	}, D.reflectY = function(e) {
		return arguments.length ? (p = e ? -1 : 1, k()) : p < 0;
	}, D.precision = function(e) {
		return arguments.length ? (S = os(C, x = e * e), ee()) : Hr(x);
	}, D.fitExtent = function(e, t) {
		return es(D, e, t);
	}, D.fitSize = function(e, t) {
		return ts(D, e, t);
	}, D.fitWidth = function(e, t) {
		return ns(D, e, t);
	}, D.fitHeight = function(e, t) {
		return rs(D, e, t);
	};
	function k() {
		var e = fs(n, 0, 0, f, p, d).apply(null, t(a, o)), m = fs(n, r - e[0], i - e[1], f, p, d);
		return u = _a(s, c, l), C = ha(t, m), w = ha(u, C), S = os(C, x), ee();
	}
	function ee() {
		return T = E = null, D;
	}
	return function() {
		return t = e.apply(this, arguments), D.invert = t.invert && O, k();
	};
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/projection/conic.js
function hs(e) {
	var t = 0, n = Dr / 3, r = ms(e), i = r(t, n);
	return i.parallels = function(e) {
		return arguments.length ? r(t = e[0] * Mr, n = e[1] * Mr) : [t * jr, n * jr];
	}, i;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/projection/cylindricalEqualArea.js
function gs(e) {
	var t = j(e);
	function n(e, n) {
		return [e * t, M(n) / t];
	}
	return n.invert = function(e, n) {
		return [e / t, Gr(n * t)];
	}, n;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/projection/conicEqualArea.js
function _s(e, t) {
	var n = M(e), r = (n + M(t)) / 2;
	if (Nr(r) < 1e-6) return gs(e);
	var i = 1 + n * (2 * r - n), a = Hr(i) / r;
	function o(e, t) {
		var n = Hr(i - 2 * r * M(t)) / r;
		return [n * M(e *= r), a - n * j(e)];
	}
	return o.invert = function(e, t) {
		var n = a - t, o = Fr(e, Nr(n)) * Vr(n);
		return n * r < 0 && (o -= Dr * Vr(e) * Vr(n)), [o / r, Gr((i - (e * e + n * n) * r * r) / (2 * r))];
	}, o;
}
function vs() {
	return hs(_s).scale(155.424).center([0, 33.6442]);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/projection/albers.js
function ys() {
	return vs().parallels([29.5, 45.5]).scale(1070).translate([480, 250]).rotate([96, 0]).center([-.6, 38.7]);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/projection/albersUsa.js
function bs(e) {
	var t = e.length;
	return {
		point: function(n, r) {
			for (var i = -1; ++i < t;) e[i].point(n, r);
		},
		sphere: function() {
			for (var n = -1; ++n < t;) e[n].sphere();
		},
		lineStart: function() {
			for (var n = -1; ++n < t;) e[n].lineStart();
		},
		lineEnd: function() {
			for (var n = -1; ++n < t;) e[n].lineEnd();
		},
		polygonStart: function() {
			for (var n = -1; ++n < t;) e[n].polygonStart();
		},
		polygonEnd: function() {
			for (var n = -1; ++n < t;) e[n].polygonEnd();
		}
	};
}
function xs() {
	var e, t, n = ys(), r, i = vs().rotate([154, 0]).center([-2, 58.5]).parallels([55, 65]), a, o = vs().rotate([157, 0]).center([-3, 19.9]).parallels([8, 18]), s, c, l = { point: function(e, t) {
		c = [e, t];
	} };
	function u(e) {
		var t = e[0], n = e[1];
		return c = null, (r.point(t, n), c) || (a.point(t, n), c) || (s.point(t, n), c);
	}
	u.invert = function(e) {
		var t = n.scale(), r = n.translate(), a = (e[0] - r[0]) / t, s = (e[1] - r[1]) / t;
		return (s >= .12 && s < .234 && a >= -.425 && a < -.214 ? i : s >= .166 && s < .234 && a >= -.214 && a < -.115 ? o : n).invert(e);
	}, u.stream = function(r) {
		return e && t === r ? e : e = bs([
			n.stream(t = r),
			i.stream(r),
			o.stream(r)
		]);
	}, u.precision = function(e) {
		return arguments.length ? (n.precision(e), i.precision(e), o.precision(e), d()) : n.precision();
	}, u.scale = function(e) {
		return arguments.length ? (n.scale(e), i.scale(e * .35), o.scale(e), u.translate(n.translate())) : n.scale();
	}, u.translate = function(e) {
		if (!arguments.length) return n.translate();
		var t = n.scale(), c = +e[0], u = +e[1];
		return r = n.translate(e).clipExtent([[c - .455 * t, u - .238 * t], [c + .455 * t, u + .238 * t]]).stream(l), a = i.translate([c - .307 * t, u + .201 * t]).clipExtent([[c - .425 * t + Er, u + .12 * t + Er], [c - .214 * t - Er, u + .234 * t - Er]]).stream(l), s = o.translate([c - .205 * t, u + .212 * t]).clipExtent([[c - .214 * t + Er, u + .166 * t + Er], [c - .115 * t - Er, u + .234 * t - Er]]).stream(l), d();
	}, u.fitExtent = function(e, t) {
		return es(u, e, t);
	}, u.fitSize = function(e, t) {
		return ts(u, e, t);
	}, u.fitWidth = function(e, t) {
		return ns(u, e, t);
	}, u.fitHeight = function(e, t) {
		return rs(u, e, t);
	};
	function d() {
		return e = t = null, u;
	}
	return u.scale(1070);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/projection/azimuthal.js
function Ss(e) {
	return function(t, n) {
		var r = j(t), i = j(n), a = e(r * i);
		return a === Infinity ? [2, 0] : [a * i * M(t), a * M(n)];
	};
}
function Cs(e) {
	return function(t, n) {
		var r = Hr(t * t + n * n), i = e(r), a = M(i), o = j(i);
		return [Fr(t * a, r * o), Gr(r && n * a / r)];
	};
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/projection/azimuthalEqualArea.js
var ws = Ss(function(e) {
	return Hr(2 / (1 + e));
});
ws.invert = Cs(function(e) {
	return 2 * Gr(e / 2);
});
function Ts() {
	return ps(ws).scale(124.75).clipAngle(179.999);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/projection/azimuthalEquidistant.js
var Es = Ss(function(e) {
	return (e = Wr(e)) && e / M(e);
});
Es.invert = Cs(function(e) {
	return e;
});
function Ds() {
	return ps(Es).scale(79.4188).clipAngle(179.999);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/projection/mercator.js
function Os(e, t) {
	return [e, zr(Ur((Or + t) / 2))];
}
Os.invert = function(e, t) {
	return [e, 2 * Pr(Lr(t)) - Or];
};
function ks() {
	return As(Os).scale(961 / Ar);
}
function As(e) {
	var t = ps(e), n = t.center, r = t.scale, i = t.translate, a = t.clipExtent, o = null, s, c, l;
	t.scale = function(e) {
		return arguments.length ? (r(e), u()) : r();
	}, t.translate = function(e) {
		return arguments.length ? (i(e), u()) : i();
	}, t.center = function(e) {
		return arguments.length ? (n(e), u()) : n();
	}, t.clipExtent = function(e) {
		return arguments.length ? (e == null ? o = s = c = l = null : (o = +e[0][0], s = +e[0][1], c = +e[1][0], l = +e[1][1]), u()) : o == null ? null : [[o, s], [c, l]];
	};
	function u() {
		var n = Dr * r(), i = t(xa(t.rotate()).invert([0, 0]));
		return a(o == null ? [[i[0] - n, i[1] - n], [i[0] + n, i[1] + n]] : e === Os ? [[Math.max(i[0] - n, o), s], [Math.min(i[0] + n, c), l]] : [[o, Math.max(i[1] - n, s)], [c, Math.min(i[1] + n, l)]]);
	}
	return u();
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/projection/conicConformal.js
function js(e) {
	return Ur((Or + e) / 2);
}
function Ms(e, t) {
	var n = j(e), r = e === t ? M(e) : zr(n / j(t)) / zr(js(t) / js(e)), i = n * Br(js(e), r) / r;
	if (!r) return Os;
	function a(e, t) {
		i > 0 ? t < -Or + 1e-6 && (t = -Or + Er) : t > Or - 1e-6 && (t = Or - Er);
		var n = i / Br(js(t), r);
		return [n * M(r * e), i - n * j(r * e)];
	}
	return a.invert = function(e, t) {
		var n = i - t, a = Vr(r) * Hr(e * e + n * n), o = Fr(e, Nr(n)) * Vr(n);
		return n * r < 0 && (o -= Dr * Vr(e) * Vr(n)), [o / r, 2 * Pr(Br(i / a, 1 / r)) - Or];
	}, a;
}
function Ns() {
	return hs(Ms).scale(109.5).parallels([30, 30]);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/projection/equirectangular.js
function Ps(e, t) {
	return [e, t];
}
Ps.invert = Ps;
function Fs() {
	return ps(Ps).scale(152.63);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/projection/conicEquidistant.js
function Is(e, t) {
	var n = j(e), r = e === t ? M(e) : (n - j(t)) / (t - e), i = n / r + e;
	if (Nr(r) < 1e-6) return Ps;
	function a(e, t) {
		var n = i - t, a = r * e;
		return [n * M(a), i - n * j(a)];
	}
	return a.invert = function(e, t) {
		var n = i - t, a = Fr(e, Nr(n)) * Vr(n);
		return n * r < 0 && (a -= Dr * Vr(e) * Vr(n)), [a / r, i - Vr(r) * Hr(e * e + n * n)];
	}, a;
}
function Ls() {
	return hs(Is).scale(131.154).center([0, 13.9389]);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/projection/equalEarth.js
var Rs = 1.340264, zs = -.081106, Bs = 893e-6, Vs = .003796, Hs = Hr(3) / 2, Us = 12;
function Ws(e, t) {
	var n = Gr(Hs * M(t)), r = n * n, i = r * r * r;
	return [e * j(n) / (Hs * (Rs + 3 * zs * r + i * (7 * Bs + 9 * Vs * r))), n * (Rs + zs * r + i * (Bs + Vs * r))];
}
Ws.invert = function(e, t) {
	for (var n = t, r = n * n, i = r * r * r, a = 0, o, s, c; a < Us && (s = n * (Rs + zs * r + i * (Bs + Vs * r)) - t, c = Rs + 3 * zs * r + i * (7 * Bs + 9 * Vs * r), n -= o = s / c, r = n * n, i = r * r * r, !(Nr(o) < 1e-12)); ++a);
	return [Hs * e * (Rs + 3 * zs * r + i * (7 * Bs + 9 * Vs * r)) / j(n), Gr(M(n) / Hs)];
};
function Gs() {
	return ps(Ws).scale(177.158);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/projection/gnomonic.js
function Ks(e, t) {
	var n = j(t), r = j(e) * n;
	return [n * M(e) / r, M(t) / r];
}
Ks.invert = Cs(Pr);
function uee() {
	return ps(Ks).scale(144.049).clipAngle(60);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/projection/identity.js
function dee() {
	var e = 1, t = 0, n = 0, r = 1, i = 1, a = 0, o, s, c = null, l, u, d, f = 1, p = 1, m = Zo({ point: function(e, t) {
		var n = y([e, t]);
		this.stream.point(n[0], n[1]);
	} }), h = Ka, g, _;
	function v() {
		return f = e * r, p = e * i, g = _ = null, y;
	}
	function y(e) {
		var r = e[0] * f, i = e[1] * p;
		if (a) {
			var c = i * o - r * s;
			r = r * o + i * s, i = c;
		}
		return [r + t, i + n];
	}
	return y.invert = function(e) {
		var r = e[0] - t, i = e[1] - n;
		if (a) {
			var c = i * o + r * s;
			r = r * o - i * s, i = c;
		}
		return [r / f, i / p];
	}, y.stream = function(e) {
		return g && _ === e ? g : g = m(h(_ = e));
	}, y.postclip = function(e) {
		return arguments.length ? (h = e, c = l = u = d = null, v()) : h;
	}, y.clipExtent = function(e) {
		return arguments.length ? (h = e == null ? (c = l = u = d = null, Ka) : Ha(c = +e[0][0], l = +e[0][1], u = +e[1][0], d = +e[1][1]), v()) : c == null ? null : [[c, l], [u, d]];
	}, y.scale = function(t) {
		return arguments.length ? (e = +t, v()) : e;
	}, y.translate = function(e) {
		return arguments.length ? (t = +e[0], n = +e[1], v()) : [t, n];
	}, y.angle = function(e) {
		return arguments.length ? (a = e % 360 * Mr, s = M(a), o = j(a), v()) : a * jr;
	}, y.reflectX = function(e) {
		return arguments.length ? (r = e ? -1 : 1, v()) : r < 0;
	}, y.reflectY = function(e) {
		return arguments.length ? (i = e ? -1 : 1, v()) : i < 0;
	}, y.fitExtent = function(e, t) {
		return es(y, e, t);
	}, y.fitSize = function(e, t) {
		return ts(y, e, t);
	}, y.fitWidth = function(e, t) {
		return ns(y, e, t);
	}, y.fitHeight = function(e, t) {
		return rs(y, e, t);
	}, y;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/projection/naturalEarth1.js
function qs(e, t) {
	var n = t * t, r = n * n;
	return [e * (.8707 - .131979 * n + r * (-.013791 + r * (.003971 * n - .001529 * r))), t * (1.007226 + n * (.015085 + r * (-.044475 + .028874 * n - .005916 * r)))];
}
qs.invert = function(e, t) {
	var n = t, r = 25, i;
	do {
		var a = n * n, o = a * a;
		n -= i = (n * (1.007226 + a * (.015085 + o * (-.044475 + .028874 * a - .005916 * o))) - t) / (1.007226 + a * (.015085 * 3 + o * (-.044475 * 7 + .028874 * 9 * a - .005916 * 11 * o)));
	} while (Nr(i) > 1e-6 && --r > 0);
	return [e / (.8707 + (a = n * n) * (-.131979 + a * (-.013791 + a * a * a * (.003971 - .001529 * a)))), n];
};
function fee() {
	return ps(qs).scale(175.295);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/projection/orthographic.js
function Js(e, t) {
	return [j(t) * M(e), M(t)];
}
Js.invert = Cs(Gr);
function pee() {
	return ps(Js).scale(249.5).clipAngle(90 + Er);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/projection/stereographic.js
function Ys(e, t) {
	var n = j(t), r = 1 + j(e) * n;
	return [n * M(e) / r, M(t) / r];
}
Ys.invert = Cs(function(e) {
	return 2 * Pr(e);
});
function mee() {
	return ps(Ys).scale(250).clipAngle(142);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo@3.1.1/node_modules/d3-geo/src/projection/transverseMercator.js
function Xs(e, t) {
	return [zr(Ur((Or + t) / 2)), -e];
}
Xs.invert = function(e, t) {
	return [-t, 2 * Pr(Lr(e)) - Or];
};
function hee() {
	var e = As(Xs), t = e.center, n = e.rotate;
	return e.center = function(e) {
		return arguments.length ? t([-e[1], e[0]]) : (e = t(), [e[1], -e[0]]);
	}, e.rotate = function(e) {
		return arguments.length ? n([
			e[0],
			e[1],
			e.length > 2 ? e[2] + 90 : 90
		]) : (e = n(), [
			e[0],
			e[1],
			e[2] - 90
		]);
	}, n([
		0,
		0,
		90
	]).scale(159.155);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-hierarchy@3.1.2/node_modules/d3-hierarchy/src/cluster.js
function Zs(e, t) {
	return e.parent === t.parent ? 1 : 2;
}
function Qs(e) {
	return e.reduce($s, 0) / e.length;
}
function $s(e, t) {
	return e + t.x;
}
function ec(e) {
	return 1 + e.reduce(tc, 0);
}
function tc(e, t) {
	return Math.max(e, t.y);
}
function nc(e) {
	for (var t; t = e.children;) e = t[0];
	return e;
}
function rc(e) {
	for (var t; t = e.children;) e = t[t.length - 1];
	return e;
}
function ic() {
	var e = Zs, t = 1, n = 1, r = !1;
	function i(i) {
		var a, o = 0;
		i.eachAfter(function(t) {
			var n = t.children;
			n ? (t.x = Qs(n), t.y = ec(n)) : (t.x = a ? o += e(t, a) : 0, t.y = 0, a = t);
		});
		var s = nc(i), c = rc(i), l = s.x - e(s, c) / 2, u = c.x + e(c, s) / 2;
		return i.eachAfter(r ? function(e) {
			e.x = (e.x - i.x) * t, e.y = (i.y - e.y) * n;
		} : function(e) {
			e.x = (e.x - l) / (u - l) * t, e.y = (1 - (i.y ? e.y / i.y : 1)) * n;
		});
	}
	return i.separation = function(t) {
		return arguments.length ? (e = t, i) : e;
	}, i.size = function(e) {
		return arguments.length ? (r = !1, t = +e[0], n = +e[1], i) : r ? null : [t, n];
	}, i.nodeSize = function(e) {
		return arguments.length ? (r = !0, t = +e[0], n = +e[1], i) : r ? [t, n] : null;
	}, i;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-hierarchy@3.1.2/node_modules/d3-hierarchy/src/lcg.js
var ac = 1664525, oc = 1013904223, sc = 4294967296;
function cc() {
	let e = 1;
	return () => (e = (ac * e + oc) % sc) / sc;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-hierarchy@3.1.2/node_modules/d3-hierarchy/src/array.js
function lc(e) {
	return typeof e == "object" && "length" in e ? e : Array.from(e);
}
function uc(e, t) {
	let n = e.length, r, i;
	for (; n;) i = t() * n-- | 0, r = e[n], e[n] = e[i], e[i] = r;
	return e;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-hierarchy@3.1.2/node_modules/d3-hierarchy/src/pack/enclose.js
function dc(e, t) {
	for (var n = 0, r = (e = uc(Array.from(e), t)).length, i = [], a, o; n < r;) a = e[n], o && mc(o, a) ? ++n : (o = gc(i = fc(i, a)), n = 0);
	return o;
}
function fc(e, t) {
	var n, r;
	if (hc(t, e)) return [t];
	for (n = 0; n < e.length; ++n) if (pc(t, e[n]) && hc(vc(e[n], t), e)) return [e[n], t];
	for (n = 0; n < e.length - 1; ++n) for (r = n + 1; r < e.length; ++r) if (pc(vc(e[n], e[r]), t) && pc(vc(e[n], t), e[r]) && pc(vc(e[r], t), e[n]) && hc(yc(e[n], e[r], t), e)) return [
		e[n],
		e[r],
		t
	];
	throw Error();
}
function pc(e, t) {
	var n = e.r - t.r, r = t.x - e.x, i = t.y - e.y;
	return n < 0 || n * n < r * r + i * i;
}
function mc(e, t) {
	var n = e.r - t.r + Math.max(e.r, t.r, 1) * 1e-9, r = t.x - e.x, i = t.y - e.y;
	return n > 0 && n * n > r * r + i * i;
}
function hc(e, t) {
	for (var n = 0; n < t.length; ++n) if (!mc(e, t[n])) return !1;
	return !0;
}
function gc(e) {
	switch (e.length) {
		case 1: return _c(e[0]);
		case 2: return vc(e[0], e[1]);
		case 3: return yc(e[0], e[1], e[2]);
	}
}
function _c(e) {
	return {
		x: e.x,
		y: e.y,
		r: e.r
	};
}
function vc(e, t) {
	var n = e.x, r = e.y, i = e.r, a = t.x, o = t.y, s = t.r, c = a - n, l = o - r, u = s - i, d = Math.sqrt(c * c + l * l);
	return {
		x: (n + a + c / d * u) / 2,
		y: (r + o + l / d * u) / 2,
		r: (d + i + s) / 2
	};
}
function yc(e, t, n) {
	var r = e.x, i = e.y, a = e.r, o = t.x, s = t.y, c = t.r, l = n.x, u = n.y, d = n.r, f = r - o, p = r - l, m = i - s, h = i - u, g = c - a, _ = d - a, v = r * r + i * i - a * a, y = v - o * o - s * s + c * c, b = v - l * l - u * u + d * d, x = p * m - f * h, S = (m * b - h * y) / (x * 2) - r, C = (h * g - m * _) / x, w = (p * y - f * b) / (x * 2) - i, T = (f * _ - p * g) / x, E = C * C + T * T - 1, D = 2 * (a + S * C + w * T), O = S * S + w * w - a * a, k = -(Math.abs(E) > 1e-6 ? (D + Math.sqrt(D * D - 4 * E * O)) / (2 * E) : O / D);
	return {
		x: r + S + C * k,
		y: i + w + T * k,
		r: k
	};
}
//#endregion
//#region ../../node_modules/.pnpm/d3-hierarchy@3.1.2/node_modules/d3-hierarchy/src/pack/siblings.js
function bc(e, t, n) {
	var r = e.x - t.x, i, a, o = e.y - t.y, s, c, l = r * r + o * o;
	l ? (a = t.r + n.r, a *= a, c = e.r + n.r, c *= c, a > c ? (i = (l + c - a) / (2 * l), s = Math.sqrt(Math.max(0, c / l - i * i)), n.x = e.x - i * r - s * o, n.y = e.y - i * o + s * r) : (i = (l + a - c) / (2 * l), s = Math.sqrt(Math.max(0, a / l - i * i)), n.x = t.x + i * r - s * o, n.y = t.y + i * o + s * r)) : (n.x = t.x + n.r, n.y = t.y);
}
function xc(e, t) {
	var n = e.r + t.r - 1e-6, r = t.x - e.x, i = t.y - e.y;
	return n > 0 && n * n > r * r + i * i;
}
function Sc(e) {
	var t = e._, n = e.next._, r = t.r + n.r, i = (t.x * n.r + n.x * t.r) / r, a = (t.y * n.r + n.y * t.r) / r;
	return i * i + a * a;
}
function Cc(e) {
	this._ = e, this.next = null, this.previous = null;
}
function wc(e, t) {
	if (!(a = (e = lc(e)).length)) return 0;
	var n = e[0], r, i, a, o, s, c, l, u, d, f;
	if (n.x = 0, n.y = 0, !(a > 1)) return n.r;
	if (r = e[1], n.x = -r.r, r.x = n.r, r.y = 0, !(a > 2)) return n.r + r.r;
	bc(r, n, i = e[2]), n = new Cc(n), r = new Cc(r), i = new Cc(i), n.next = i.previous = r, r.next = n.previous = i, i.next = r.previous = n;
	pack: for (c = 3; c < a; ++c) {
		bc(n._, r._, i = e[c]), i = new Cc(i), l = r.next, u = n.previous, d = r._.r, f = n._.r;
		do
			if (d <= f) {
				if (xc(l._, i._)) {
					r = l, n.next = r, r.previous = n, --c;
					continue pack;
				}
				d += l._.r, l = l.next;
			} else {
				if (xc(u._, i._)) {
					n = u, n.next = r, r.previous = n, --c;
					continue pack;
				}
				f += u._.r, u = u.previous;
			}
		while (l !== u.next);
		for (i.previous = n, i.next = r, n.next = r.previous = r = i, o = Sc(n); (i = i.next) !== r;) (s = Sc(i)) < o && (n = i, o = s);
		r = n.next;
	}
	for (n = [r._], i = r; (i = i.next) !== r;) n.push(i._);
	for (i = dc(n, t), c = 0; c < a; ++c) n = e[c], n.x -= i.x, n.y -= i.y;
	return i.r;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-hierarchy@3.1.2/node_modules/d3-hierarchy/src/pack/index.js
function Tc(e) {
	return Math.sqrt(e.value);
}
function Ec() {
	var e = null, t = 1, n = 1, r = at;
	function i(i) {
		let a = cc();
		return i.x = t / 2, i.y = n / 2, e ? i.eachBefore(Dc(e)).eachAfter(Oc(r, .5, a)).eachBefore(kc(1)) : i.eachBefore(Dc(Tc)).eachAfter(Oc(at, 1, a)).eachAfter(Oc(r, i.r / Math.min(t, n), a)).eachBefore(kc(Math.min(t, n) / (2 * i.r))), i;
	}
	return i.radius = function(t) {
		return arguments.length ? (e = ht(t), i) : e;
	}, i.size = function(e) {
		return arguments.length ? (t = +e[0], n = +e[1], i) : [t, n];
	}, i.padding = function(e) {
		return arguments.length ? (r = typeof e == "function" ? e : lt(+e), i) : r;
	}, i;
}
function Dc(e) {
	return function(t) {
		t.children || (t.r = Math.max(0, +e(t) || 0));
	};
}
function Oc(e, t, n) {
	return function(r) {
		if (i = r.children) {
			var i, a, o = i.length, s = e(r) * t || 0, c;
			if (s) for (a = 0; a < o; ++a) i[a].r += s;
			if (c = wc(i, n), s) for (a = 0; a < o; ++a) i[a].r -= s;
			r.r = c + s;
		}
	};
}
function kc(e) {
	return function(t) {
		var n = t.parent;
		t.r *= e, n && (t.x = n.x + e * t.x, t.y = n.y + e * t.y);
	};
}
//#endregion
//#region ../../node_modules/.pnpm/d3-hierarchy@3.1.2/node_modules/d3-hierarchy/src/partition.js
function Ac() {
	var e = 1, t = 1, n = 0, r = !1;
	function i(i) {
		var o = i.height + 1;
		return i.x0 = i.y0 = n, i.x1 = e, i.y1 = t / o, i.eachBefore(a(t, o)), r && i.eachBefore(pt), i;
	}
	function a(e, t) {
		return function(r) {
			r.children && dt(r, r.x0, e * (r.depth + 1) / t, r.x1, e * (r.depth + 2) / t);
			var i = r.x0, a = r.y0, o = r.x1 - n, s = r.y1 - n;
			o < i && (i = o = (i + o) / 2), s < a && (a = s = (a + s) / 2), r.x0 = i, r.y0 = a, r.x1 = o, r.y1 = s;
		};
	}
	return i.round = function(e) {
		return arguments.length ? (r = !!e, i) : r;
	}, i.size = function(n) {
		return arguments.length ? (e = +n[0], t = +n[1], i) : [e, t];
	}, i.padding = function(e) {
		return arguments.length ? (n = +e, i) : n;
	}, i;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-hierarchy@3.1.2/node_modules/d3-hierarchy/src/stratify.js
var jc = { depth: -1 }, Mc = {}, Nc = {};
function Pc(e) {
	return e.id;
}
function Fc(e) {
	return e.parentId;
}
function Ic() {
	var e = Pc, t = Fc, n;
	function r(r) {
		var i = Array.from(r), a = e, o = t, s, c, l, u, d, f, p, m, h = /* @__PURE__ */ new Map();
		if (n != null) {
			let e = i.map((e, t) => Lc(n(e, t, r))), t = e.map(Rc), s = new Set(e).add("");
			for (let n of t) s.has(n) || (s.add(n), e.push(n), t.push(Rc(n)), i.push(Nc));
			a = (t, n) => e[n], o = (e, n) => t[n];
		}
		for (l = 0, s = i.length; l < s; ++l) c = i[l], f = i[l] = new ot(c), (p = a(c, l, r)) != null && (p += "") && (m = f.id = p, h.set(m, h.has(m) ? Mc : f)), (p = o(c, l, r)) != null && (p += "") && (f.parent = p);
		for (l = 0; l < s; ++l) if (f = i[l], p = f.parent) {
			if (d = h.get(p), !d) throw Error("missing: " + p);
			if (d === Mc) throw Error("ambiguous: " + p);
			d.children ? d.children.push(f) : d.children = [f], f.parent = d;
		} else {
			if (u) throw Error("multiple roots");
			u = f;
		}
		if (!u) throw Error("no root");
		if (n != null) {
			for (; u.data === Nc && u.children.length === 1;) u = u.children[0], --s;
			for (let e = i.length - 1; e >= 0 && (f = i[e], f.data === Nc); --e) f.data = null;
		}
		if (u.parent = jc, u.eachBefore(function(e) {
			e.depth = e.parent.depth + 1, --s;
		}).eachBefore(st), u.parent = null, s > 0) throw Error("cycle");
		return u;
	}
	return r.id = function(t) {
		return arguments.length ? (e = ht(t), r) : e;
	}, r.parentId = function(e) {
		return arguments.length ? (t = ht(e), r) : t;
	}, r.path = function(e) {
		return arguments.length ? (n = ht(e), r) : n;
	}, r;
}
function Lc(e) {
	e = `${e}`;
	let t = e.length;
	return zc(e, t - 1) && !zc(e, t - 2) && (e = e.slice(0, -1)), e[0] === "/" ? e : `/${e}`;
}
function Rc(e) {
	let t = e.length;
	if (t < 2) return "";
	for (; --t > 1 && !zc(e, t););
	return e.slice(0, t);
}
function zc(e, t) {
	if (e[t] === "/") {
		let n = 0;
		for (; t > 0 && e[--t] === "\\";) ++n;
		if (!(n & 1)) return !0;
	}
	return !1;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-hierarchy@3.1.2/node_modules/d3-hierarchy/src/tree.js
function Bc(e, t) {
	return e.parent === t.parent ? 1 : 2;
}
function Vc(e) {
	var t = e.children;
	return t ? t[0] : e.t;
}
function Hc(e) {
	var t = e.children;
	return t ? t[t.length - 1] : e.t;
}
function Uc(e, t, n) {
	var r = n / (t.i - e.i);
	t.c -= r, t.s += n, e.c += r, t.z += n, t.m += n;
}
function Wc(e) {
	for (var t = 0, n = 0, r = e.children, i = r.length, a; --i >= 0;) a = r[i], a.z += t, a.m += t, t += a.s + (n += a.c);
}
function Gc(e, t, n) {
	return e.a.parent === t.parent ? e.a : n;
}
function Kc(e, t) {
	this._ = e, this.parent = null, this.children = null, this.A = null, this.a = this, this.z = 0, this.m = 0, this.c = 0, this.s = 0, this.t = null, this.i = t;
}
Kc.prototype = Object.create(ot.prototype);
function qc(e) {
	for (var t = new Kc(e, 0), n, r = [t], i, a, o, s; n = r.pop();) if (a = n._.children) for (n.children = Array(s = a.length), o = s - 1; o >= 0; --o) r.push(i = n.children[o] = new Kc(a[o], o)), i.parent = n;
	return (t.parent = new Kc(null, 0)).children = [t], t;
}
function Jc() {
	var e = Bc, t = 1, n = 1, r = null;
	function i(i) {
		var s = qc(i);
		if (s.eachAfter(a), s.parent.m = -s.z, s.eachBefore(o), r) i.eachBefore(c);
		else {
			var l = i, u = i, d = i;
			i.eachBefore(function(e) {
				e.x < l.x && (l = e), e.x > u.x && (u = e), e.depth > d.depth && (d = e);
			});
			var f = l === u ? 1 : e(l, u) / 2, p = f - l.x, m = t / (u.x + f + p), h = n / (d.depth || 1);
			i.eachBefore(function(e) {
				e.x = (e.x + p) * m, e.y = e.depth * h;
			});
		}
		return i;
	}
	function a(t) {
		var n = t.children, r = t.parent.children, i = t.i ? r[t.i - 1] : null;
		if (n) {
			Wc(t);
			var a = (n[0].z + n[n.length - 1].z) / 2;
			i ? (t.z = i.z + e(t._, i._), t.m = t.z - a) : t.z = a;
		} else i && (t.z = i.z + e(t._, i._));
		t.parent.A = s(t, i, t.parent.A || r[0]);
	}
	function o(e) {
		e._.x = e.z + e.parent.m, e.m += e.parent.m;
	}
	function s(t, n, r) {
		if (n) {
			for (var i = t, a = t, o = n, s = i.parent.children[0], c = i.m, l = a.m, u = o.m, d = s.m, f; o = Hc(o), i = Vc(i), o && i;) s = Vc(s), a = Hc(a), a.a = t, f = o.z + u - i.z - c + e(o._, i._), f > 0 && (Uc(Gc(o, t, r), t, f), c += f, l += f), u += o.m, c += i.m, d += s.m, l += a.m;
			o && !Hc(a) && (a.t = o, a.m += u - l), i && !Vc(s) && (s.t = i, s.m += c - d, r = t);
		}
		return r;
	}
	function c(e) {
		e.x *= t, e.y = e.depth * n;
	}
	return i.separation = function(t) {
		return arguments.length ? (e = t, i) : e;
	}, i.size = function(e) {
		return arguments.length ? (r = !1, t = +e[0], n = +e[1], i) : r ? null : [t, n];
	}, i.nodeSize = function(e) {
		return arguments.length ? (r = !0, t = +e[0], n = +e[1], i) : r ? [t, n] : null;
	}, i;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-hierarchy@3.1.2/node_modules/d3-hierarchy/src/treemap/binary.js
function Yc(e, t, n, r, i) {
	var a = e.children, o, s = a.length, c, l = Array(s + 1);
	for (l[0] = c = o = 0; o < s; ++o) l[o + 1] = c += a[o].value;
	u(0, s, e.value, t, n, r, i);
	function u(e, t, n, r, i, o, s) {
		if (e >= t - 1) {
			var c = a[e];
			c.x0 = r, c.y0 = i, c.x1 = o, c.y1 = s;
			return;
		}
		for (var d = l[e], f = n / 2 + d, p = e + 1, m = t - 1; p < m;) {
			var h = p + m >>> 1;
			l[h] < f ? p = h + 1 : m = h;
		}
		f - l[p - 1] < l[p] - f && e + 1 < p && --p;
		var g = l[p] - d, _ = n - g;
		if (o - r > s - i) {
			var v = n ? (r * _ + o * g) / n : o;
			u(e, p, g, r, i, v, s), u(p, t, _, v, i, o, s);
		} else {
			var y = n ? (i * _ + s * g) / n : s;
			u(e, p, g, r, i, o, y), u(p, t, _, r, y, o, s);
		}
	}
}
//#endregion
//#region ../../node_modules/.pnpm/d3-hierarchy@3.1.2/node_modules/d3-hierarchy/src/treemap/sliceDice.js
function Xc(e, t, n, r, i) {
	(e.depth & 1 ? it : dt)(e, t, n, r, i);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-hierarchy@3.1.2/node_modules/d3-hierarchy/src/treemap/resquarify.js
var Zc = (function e(t) {
	function n(e, n, r, i, a) {
		if ((o = e._squarify) && o.ratio === t) for (var o, s, c, l, u = -1, d, f = o.length, p = e.value; ++u < f;) {
			for (s = o[u], c = s.children, l = s.value = 0, d = c.length; l < d; ++l) s.value += c[l].value;
			s.dice ? dt(s, n, r, i, p ? r += (a - r) * s.value / p : a) : it(s, n, r, p ? n += (i - n) * s.value / p : i, a), p -= s.value;
		}
		else e._squarify = o = ft(t, e, n, r, i, a), o.ratio = t;
	}
	return n.ratio = function(t) {
		return e((t = +t) > 1 ? t : 1);
	}, n;
})(ut);
//#endregion
//#region ../../node_modules/.pnpm/d3-scale@4.0.2/node_modules/d3-scale/src/identity.js
function Qc(e) {
	var t;
	function n(e) {
		return e == null || isNaN(e = +e) ? t : e;
	}
	return n.invert = n, n.domain = n.range = function(t) {
		return arguments.length ? (e = Array.from(t, i), n) : e.slice();
	}, n.unknown = function(e) {
		return arguments.length ? (t = e, n) : t;
	}, n.copy = function() {
		return Qc(e).unknown(t);
	}, e = arguments.length ? Array.from(e, i) : [0, 1], d(n);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-scale@4.0.2/node_modules/d3-scale/src/log.js
function $c(e) {
	return Math.log(e);
}
function el(e) {
	return Math.exp(e);
}
function tl(e) {
	return -Math.log(-e);
}
function nl(e) {
	return -Math.exp(-e);
}
function rl(e) {
	return isFinite(e) ? +("1e" + e) : e < 0 ? 0 : e;
}
function il(e) {
	return e === 10 ? rl : e === Math.E ? Math.exp : (t) => e ** +t;
}
function al(e) {
	return e === Math.E ? Math.log : e === 10 && Math.log10 || e === 2 && Math.log2 || (e = Math.log(e), (t) => Math.log(t) / e);
}
function ol(e) {
	return (t, n) => -e(-t, n);
}
function sl(e) {
	let t = e($c, el), n = t.domain, r = 10, i, a;
	function o() {
		return i = al(r), a = il(r), n()[0] < 0 ? (i = ol(i), a = ol(a), e(tl, nl)) : e($c, el), t;
	}
	return t.base = function(e) {
		return arguments.length ? (r = +e, o()) : r;
	}, t.domain = function(e) {
		return arguments.length ? (n(e), o()) : n();
	}, t.ticks = (e) => {
		let t = n(), o = t[0], s = t[t.length - 1], c = s < o;
		c && ([o, s] = [s, o]);
		let l = i(o), u = i(s), d, f, m = e == null ? 10 : +e, h = [];
		if (!(r % 1) && u - l < m) {
			if (l = Math.floor(l), u = Math.ceil(u), o > 0) {
				for (; l <= u; ++l) for (d = 1; d < r; ++d) if (f = l < 0 ? d / a(-l) : d * a(l), !(f < o)) {
					if (f > s) break;
					h.push(f);
				}
			} else for (; l <= u; ++l) for (d = r - 1; d >= 1; --d) if (f = l > 0 ? d / a(-l) : d * a(l), !(f < o)) {
				if (f > s) break;
				h.push(f);
			}
			h.length * 2 < m && (h = p(o, s, m));
		} else h = p(l, u, Math.min(u - l, m)).map(a);
		return c ? h.reverse() : h;
	}, t.tickFormat = (e, n) => {
		if (e == null && (e = 10), n == null && (n = r === 10 ? "s" : ","), typeof n != "function" && (!(r % 1) && (n = et(n)).precision == null && (n.trim = !0), n = rt(n)), e === Infinity) return n;
		let o = Math.max(1, r * e / t.ticks().length);
		return (e) => {
			let t = e / a(Math.round(i(e)));
			return t * r < r - .5 && (t *= r), t <= o ? n(e) : "";
		};
	}, t.nice = () => n(C(n(), {
		floor: (e) => a(Math.floor(i(e))),
		ceil: (e) => a(Math.ceil(i(e)))
	})), t;
}
function cl() {
	let e = sl(h()).domain([1, 10]);
	return e.copy = () => r(e, cl()).base(e.base()), gt.apply(e, arguments), e;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-scale@4.0.2/node_modules/d3-scale/src/symlog.js
function ll(e) {
	return function(t) {
		return Math.sign(t) * Math.log1p(Math.abs(t / e));
	};
}
function ul(e) {
	return function(t) {
		return Math.sign(t) * Math.expm1(Math.abs(t)) * e;
	};
}
function dl(e) {
	var t = 1, n = e(ll(t), ul(t));
	return n.constant = function(n) {
		return arguments.length ? e(ll(t = +n), ul(t)) : t;
	}, d(n);
}
function fl() {
	var e = dl(h());
	return e.copy = function() {
		return r(e, fl()).constant(e.constant());
	}, gt.apply(e, arguments);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-scale@4.0.2/node_modules/d3-scale/src/pow.js
function pl(e) {
	return function(t) {
		return t < 0 ? -((-t) ** +e) : t ** +e;
	};
}
function ml(e) {
	return e < 0 ? -Math.sqrt(-e) : Math.sqrt(e);
}
function hl(e) {
	return e < 0 ? -e * e : e * e;
}
function gl(e) {
	var t = e(f, f), n = 1;
	function r() {
		return n === 1 ? e(f, f) : n === .5 ? e(ml, hl) : e(pl(n), pl(1 / n));
	}
	return t.exponent = function(e) {
		return arguments.length ? (n = +e, r()) : n;
	}, d(t);
}
function _l() {
	var e = gl(h());
	return e.copy = function() {
		return r(e, _l()).exponent(e.exponent());
	}, gt.apply(e, arguments), e;
}
function vl() {
	return _l.apply(null, arguments).exponent(.5);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-scale@4.0.2/node_modules/d3-scale/src/quantile.js
function yl() {
	var e = [], t = [], n = [], r;
	function i() {
		var r = 0, i = Math.max(1, t.length);
		for (n = Array(i - 1); ++r < i;) n[r - 1] = kt(e, r / i);
		return a;
	}
	function a(e) {
		return e == null || isNaN(e = +e) ? r : t[c(n, e)];
	}
	return a.invertExtent = function(r) {
		var i = t.indexOf(r);
		return i < 0 ? [NaN, NaN] : [i > 0 ? n[i - 1] : e[0], i < n.length ? n[i] : e[e.length - 1]];
	}, a.domain = function(t) {
		if (!arguments.length) return e.slice();
		e = [];
		for (let n of t) n != null && !isNaN(n = +n) && e.push(n);
		return e.sort(y), i();
	}, a.range = function(e) {
		return arguments.length ? (t = Array.from(e), i()) : t.slice();
	}, a.unknown = function(e) {
		return arguments.length ? (r = e, a) : r;
	}, a.quantiles = function() {
		return n.slice();
	}, a.copy = function() {
		return yl().domain(e).range(t).unknown(r);
	}, gt.apply(a, arguments);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-scale@4.0.2/node_modules/d3-scale/src/quantize.js
function bl() {
	var e = 0, t = 1, n = 1, r = [.5], i = [0, 1], a;
	function o(e) {
		return e != null && e <= e ? i[c(r, e, 0, n)] : a;
	}
	function s() {
		var i = -1;
		for (r = Array(n); ++i < n;) r[i] = ((i + 1) * t - (i - n) * e) / (n + 1);
		return o;
	}
	return o.domain = function(n) {
		return arguments.length ? ([e, t] = n, e = +e, t = +t, s()) : [e, t];
	}, o.range = function(e) {
		return arguments.length ? (n = (i = Array.from(e)).length - 1, s()) : i.slice();
	}, o.invertExtent = function(a) {
		var o = i.indexOf(a);
		return o < 0 ? [NaN, NaN] : o < 1 ? [e, r[0]] : o >= n ? [r[n - 1], t] : [r[o - 1], r[o]];
	}, o.unknown = function(e) {
		return arguments.length && (a = e), o;
	}, o.thresholds = function() {
		return r.slice();
	}, o.copy = function() {
		return bl().domain([e, t]).range(i).unknown(a);
	}, gt.apply(d(o), arguments);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-scale@4.0.2/node_modules/d3-scale/src/threshold.js
function xl() {
	var e = [.5], t = [0, 1], n, r = 1;
	function i(i) {
		return i != null && i <= i ? t[c(e, i, 0, r)] : n;
	}
	return i.domain = function(n) {
		return arguments.length ? (e = Array.from(n), r = Math.min(e.length, t.length - 1), i) : e.slice();
	}, i.range = function(n) {
		return arguments.length ? (t = Array.from(n), r = Math.min(e.length, t.length - 1), i) : t.slice();
	}, i.invertExtent = function(n) {
		var r = t.indexOf(n);
		return [e[r - 1], e[r]];
	}, i.unknown = function(e) {
		return arguments.length ? (n = e, i) : n;
	}, i.copy = function() {
		return xl().domain(e).range(t).unknown(n);
	}, gt.apply(i, arguments);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-scale@4.0.2/node_modules/d3-scale/src/utcTime.js
function Sl() {
	return gt.apply(he(le, re, ie, fe, ve, w, ee, T, O, ne).domain([Date.UTC(2e3, 0, 1), Date.UTC(2e3, 0, 2)]), arguments);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-scale@4.0.2/node_modules/d3-scale/src/sequential.js
function Cl() {
	var e = 0, t = 1, n, r, i, a, o = f, s = !1, c;
	function l(e) {
		return e == null || isNaN(e = +e) ? c : o(i === 0 ? .5 : (e = (a(e) - n) * i, s ? Math.max(0, Math.min(1, e)) : e));
	}
	l.domain = function(o) {
		return arguments.length ? ([e, t] = o, n = a(e = +e), r = a(t = +t), i = n === r ? 0 : 1 / (r - n), l) : [e, t];
	}, l.clamp = function(e) {
		return arguments.length ? (s = !!e, l) : s;
	}, l.interpolator = function(e) {
		return arguments.length ? (o = e, l) : o;
	};
	function u(e) {
		return function(t) {
			var n, r;
			return arguments.length ? ([n, r] = t, o = e(n, r), l) : [o(0), o(1)];
		};
	}
	return l.range = u(Ee), l.rangeRound = u(Ye), l.unknown = function(e) {
		return arguments.length ? (c = e, l) : c;
	}, function(o) {
		return a = o, n = o(e), r = o(t), i = n === r ? 0 : 1 / (r - n), l;
	};
}
function wl(e, t) {
	return t.domain(e.domain()).interpolator(e.interpolator()).clamp(e.clamp()).unknown(e.unknown());
}
function Tl() {
	var e = d(Cl()(f));
	return e.copy = function() {
		return wl(e, Tl());
	}, _t.apply(e, arguments);
}
function El() {
	var e = sl(Cl()).domain([1, 10]);
	return e.copy = function() {
		return wl(e, El()).base(e.base());
	}, _t.apply(e, arguments);
}
function Dl() {
	var e = dl(Cl());
	return e.copy = function() {
		return wl(e, Dl()).constant(e.constant());
	}, _t.apply(e, arguments);
}
function Ol() {
	var e = gl(Cl());
	return e.copy = function() {
		return wl(e, Ol()).exponent(e.exponent());
	}, _t.apply(e, arguments);
}
function kl() {
	return Ol.apply(null, arguments).exponent(.5);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-scale@4.0.2/node_modules/d3-scale/src/diverging.js
function Al() {
	var e = 0, t = .5, n = 1, r = 1, i, a, o, s, c, l = f, u, d = !1, p;
	function m(e) {
		return isNaN(e = +e) ? p : (e = .5 + ((e = +u(e)) - a) * (r * e < r * a ? s : c), l(d ? Math.max(0, Math.min(1, e)) : e));
	}
	m.domain = function(l) {
		return arguments.length ? ([e, t, n] = l, i = u(e = +e), a = u(t = +t), o = u(n = +n), s = i === a ? 0 : .5 / (a - i), c = a === o ? 0 : .5 / (o - a), r = a < i ? -1 : 1, m) : [
			e,
			t,
			n
		];
	}, m.clamp = function(e) {
		return arguments.length ? (d = !!e, m) : d;
	}, m.interpolator = function(e) {
		return arguments.length ? (l = e, m) : l;
	};
	function h(e) {
		return function(t) {
			var n, r, i;
			return arguments.length ? ([n, r, i] = t, l = Me(e, [
				n,
				r,
				i
			]), m) : [
				l(0),
				l(.5),
				l(1)
			];
		};
	}
	return m.range = h(Ee), m.rangeRound = h(Ye), m.unknown = function(e) {
		return arguments.length ? (p = e, m) : p;
	}, function(l) {
		return u = l, i = l(e), a = l(t), o = l(n), s = i === a ? 0 : .5 / (a - i), c = a === o ? 0 : .5 / (o - a), r = a < i ? -1 : 1, m;
	};
}
function jl() {
	var e = d(Al()(f));
	return e.copy = function() {
		return wl(e, jl());
	}, _t.apply(e, arguments);
}
function Ml() {
	var e = sl(Al()).domain([
		.1,
		1,
		10
	]);
	return e.copy = function() {
		return wl(e, Ml()).base(e.base());
	}, _t.apply(e, arguments);
}
function Nl() {
	var e = dl(Al());
	return e.copy = function() {
		return wl(e, Nl()).constant(e.constant());
	}, _t.apply(e, arguments);
}
function Pl() {
	var e = gl(Al());
	return e.copy = function() {
		return wl(e, Pl()).exponent(e.exponent());
	}, _t.apply(e, arguments);
}
function Fl() {
	return Pl.apply(null, arguments).exponent(.5);
}
//#endregion
//#region ../../node_modules/.pnpm/d3-scale-chromatic@3.1.0/node_modules/d3-scale-chromatic/src/categorical/category10.js
var Il = vt("1f77b4ff7f0e2ca02cd627289467bd8c564be377c27f7f7fbcbd2217becf"), Ll = vt("7fc97fbeaed4fdc086ffff99386cb0f0027fbf5b17666666"), Rl = vt("1b9e77d95f027570b3e7298a66a61ee6ab02a6761d666666"), zl = vt("4269d0efb118ff725c6cc5b03ca951ff8ab7a463f297bbf59c6b4e9498a0"), Bl = vt("a6cee31f78b4b2df8a33a02cfb9a99e31a1cfdbf6fff7f00cab2d66a3d9affff99b15928"), Vl = vt("fbb4aeb3cde3ccebc5decbe4fed9a6ffffcce5d8bdfddaecf2f2f2"), Hl = vt("b3e2cdfdcdaccbd5e8f4cae4e6f5c9fff2aef1e2cccccccc"), Ul = vt("e41a1c377eb84daf4a984ea3ff7f00ffff33a65628f781bf999999"), Wl = vt("66c2a5fc8d628da0cbe78ac3a6d854ffd92fe5c494b3b3b3"), Gl = vt("8dd3c7ffffb3bebadafb807280b1d3fdb462b3de69fccde5d9d9d9bc80bdccebc5ffed6f");
//#endregion
//#region ../../node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/area.js
function Kl(e, t, n) {
	var r = null, i = De(!0), a = null, o = Ze, s = null, c = Se(l);
	e = typeof e == "function" ? e : e === void 0 ? Qe : De(+e), t = typeof t == "function" ? t : De(t === void 0 ? 0 : +t), n = typeof n == "function" ? n : n === void 0 ? Ie : De(+n);
	function l(l) {
		var u, d, f, p = (l = je(l)).length, m, h = !1, g, _ = Array(p), v = Array(p);
		for (a == null && (s = o(g = c())), u = 0; u <= p; ++u) {
			if (!(u < p && i(m = l[u], u, l)) === h) if (h = !h) d = u, s.areaStart(), s.lineStart();
			else {
				for (s.lineEnd(), s.lineStart(), f = u - 1; f >= d; --f) s.point(_[f], v[f]);
				s.lineEnd(), s.areaEnd();
			}
			h && (_[u] = +e(m, u, l), v[u] = +t(m, u, l), s.point(r ? +r(m, u, l) : _[u], n ? +n(m, u, l) : v[u]));
		}
		if (g) return s = null, g + "" || null;
	}
	function u() {
		return Xe().defined(i).curve(o).context(a);
	}
	return l.x = function(t) {
		return arguments.length ? (e = typeof t == "function" ? t : De(+t), r = null, l) : e;
	}, l.x0 = function(t) {
		return arguments.length ? (e = typeof t == "function" ? t : De(+t), l) : e;
	}, l.x1 = function(e) {
		return arguments.length ? (r = e == null ? null : typeof e == "function" ? e : De(+e), l) : r;
	}, l.y = function(e) {
		return arguments.length ? (t = typeof e == "function" ? e : De(+e), n = null, l) : t;
	}, l.y0 = function(e) {
		return arguments.length ? (t = typeof e == "function" ? e : De(+e), l) : t;
	}, l.y1 = function(e) {
		return arguments.length ? (n = e == null ? null : typeof e == "function" ? e : De(+e), l) : n;
	}, l.lineX0 = l.lineY0 = function() {
		return u().x(e).y(t);
	}, l.lineY1 = function() {
		return u().x(e).y(n);
	}, l.lineX1 = function() {
		return u().x(r).y(t);
	}, l.defined = function(e) {
		return arguments.length ? (i = typeof e == "function" ? e : De(!!e), l) : i;
	}, l.curve = function(e) {
		return arguments.length ? (o = e, a != null && (s = o(a)), l) : o;
	}, l.context = function(e) {
		return arguments.length ? (e == null ? a = s = null : s = o(a = e), l) : a;
	}, l;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/symbol/circle.js
var ql = { draw(e, t) {
	let n = Ce(t / Oe);
	e.moveTo(n, 0), e.arc(0, 0, n, 0, Te);
} };
//#endregion
//#region ../../node_modules/.pnpm/d3-shape@3.2.0/node_modules/d3-shape/src/symbol.js
function Jl(e, t) {
	let n = null, r = Se(i);
	e = typeof e == "function" ? e : De(e || ql), t = typeof t == "function" ? t : De(t === void 0 ? 64 : +t);
	function i() {
		let i;
		if (n || (n = i = r()), e.apply(this, arguments).draw(n, +t.apply(this, arguments)), i) return n = null, i + "" || null;
	}
	return i.type = function(t) {
		return arguments.length ? (e = typeof t == "function" ? t : De(t), i) : e;
	}, i.size = function(e) {
		return arguments.length ? (t = typeof e == "function" ? e : De(+e), i) : t;
	}, i.context = function(e) {
		return arguments.length ? (n = e == null ? null : e, i) : n;
	}, i;
}
//#endregion
//#region ../../node_modules/.pnpm/json-stringify-pretty-compact@4.0.0/node_modules/json-stringify-pretty-compact/index.js
var Yl = /("(?:[^\\"]|\\.)*")|[:,]/g;
function Xl(e, t = {}) {
	let n = JSON.stringify([1], void 0, t.indent === void 0 ? 2 : t.indent).slice(2, -3), r = n === "" ? Infinity : t.maxLength === void 0 ? 80 : t.maxLength, { replacer: i } = t;
	return (function e(t, a, o) {
		t && typeof t.toJSON == "function" && (t = t.toJSON());
		let s = JSON.stringify(t, i);
		if (s === void 0) return s;
		let c = r - a.length - o;
		if (s.length <= c) {
			let e = s.replace(Yl, (e, t) => t || `${e} `);
			if (e.length <= c) return e;
		}
		if (i != null && (t = JSON.parse(s), i = void 0), typeof t == "object" && t) {
			let r = a + n, i = [], o = 0, s, c;
			if (Array.isArray(t)) {
				s = "[", c = "]";
				let { length: n } = t;
				for (; o < n; o++) i.push(e(t[o], r, o === n - 1 ? 0 : 1) || "null");
			} else {
				s = "{", c = "}";
				let n = Object.keys(t), { length: a } = n;
				for (; o < a; o++) {
					let s = n[o], c = `${JSON.stringify(s)}: `, l = e(t[s], r, c.length + (o === a - 1 ? 0 : 1));
					l !== void 0 && i.push(c + l);
				}
			}
			if (i.length > 0) return [
				s,
				n + i.join(`,\n${r}`),
				c
			].join(`\n${a}`);
		}
		return s;
	})(e, "", 0);
}
//#endregion
//#region ../../node_modules/.pnpm/vega-util@2.1.0/node_modules/vega-util/build/vega-util.js
function Zl(e, t, n) {
	return e.fields = t || [], e.fname = n, e;
}
function Ql(e) {
	return e == null ? null : e.fname;
}
function $l(e) {
	return e == null ? null : e.fields;
}
function eu(e) {
	return e.length === 1 ? tu(e[0]) : nu(e);
}
var tu = (e) => function(t) {
	return t[e];
}, nu = (e) => {
	let t = e.length;
	return function(n) {
		for (let r = 0; r < t; ++r) n = n[e[r]];
		return n;
	};
};
function N(e) {
	throw Error(e);
}
function ru(e) {
	let t = [], n = e.length, r = null, i = 0, a = "", o, s, c;
	e += "";
	function l() {
		t.push(a + e.substring(o, s)), a = "", o = s + 1;
	}
	for (o = s = 0; s < n; ++s) if (c = e[s], c === "\\") a += e.substring(o, s++), o = s;
	else if (c === r) l(), r = null, i = -1;
	else if (r) continue;
	else o === i && c === "\"" || o === i && c === "'" ? (o = s + 1, r = c) : c === "." && !i ? s > o ? l() : o = s + 1 : c === "[" ? (s > o && l(), i = o = s + 1) : c === "]" && (i || N("Access path missing open bracket: " + e), i > 0 && l(), i = 0, o = s + 1);
	return i && N("Access path missing closing bracket: " + e), r && N("Access path missing closing quote: " + e), s > o && (s++, l()), t;
}
function iu(e, t, n) {
	let r = ru(e);
	return e = r.length === 1 ? r[0] : e, Zl((n && n.get || eu)(r), [e], t || e);
}
var au = iu("id"), ou = Zl((e) => e, [], "identity"), su = Zl(() => 0, [], "zero"), cu = Zl(() => 1, [], "one"), lu = Zl(() => !0, [], "true"), uu = Zl(() => !1, [], "false"), du = new Set([...Object.getOwnPropertyNames(Object.prototype).filter((e) => typeof Object.prototype[e] == "function"), "__proto__"]);
function fu(e, t, n) {
	let r = [t].concat([].slice.call(n));
	console[e].apply(console, r);
}
function pu(e, t, n = fu) {
	let r = e || 0;
	return {
		level(e) {
			return arguments.length ? (r = +e, this) : r;
		},
		error() {
			return r >= 1 && n(t || "error", "ERROR", arguments), this;
		},
		warn() {
			return r >= 2 && n(t || "warn", "WARN", arguments), this;
		},
		info() {
			return r >= 3 && n(t || "log", "INFO", arguments), this;
		},
		debug() {
			return r >= 4 && n(t || "log", "DEBUG", arguments), this;
		}
	};
}
var P = Array.isArray;
function F(e) {
	return e === Object(e);
}
var mu = (e) => e !== "__proto__";
function hu(...e) {
	return e.reduce((e, t) => {
		for (let n in t) if (n === "signals") e.signals = _u(e.signals, t.signals);
		else {
			let r = n === "legend" ? { layout: 1 } : n === "style" ? !0 : null;
			gu(e, n, t[n], r);
		}
		return e;
	}, {});
}
function gu(e, t, n, r) {
	if (!mu(t)) return;
	let i, a;
	if (F(n) && !P(n)) for (i in a = F(e[t]) ? e[t] : e[t] = {}, n) r && (r === !0 || r[i]) ? gu(a, i, n[i]) : mu(i) && (a[i] = n[i]);
	else e[t] = n;
}
function _u(e, t) {
	if (e == null) return t;
	let n = {}, r = [];
	function i(e) {
		n[e.name] || (n[e.name] = 1, r.push(e));
	}
	return t.forEach(i), e.forEach(i), r;
}
function vu(e) {
	return e[e.length - 1];
}
function yu(e) {
	return e == null || e === "" ? null : +e;
}
var bu = (e) => (t) => e * Math.exp(t), xu = (e) => (t) => Math.log(e * t), Su = (e) => (t) => Math.sign(t) * Math.log1p(Math.abs(t / e)), Cu = (e) => (t) => Math.sign(t) * Math.expm1(Math.abs(t)) * e, wu = (e) => (t) => t < 0 ? -((-t) ** +e) : t ** +e;
function Tu(e, t, n, r) {
	let i = n(e[0]), a = n(vu(e)), o = (a - i) * t;
	return [r(i - o), r(a - o)];
}
function Eu(e, t) {
	return Tu(e, t, yu, ou);
}
function Du(e, t) {
	var n = Math.sign(e[0]);
	return Tu(e, t, xu(n), bu(n));
}
function Ou(e, t, n) {
	return Tu(e, t, wu(n), wu(1 / n));
}
function ku(e, t, n) {
	return Tu(e, t, Su(n), Cu(n));
}
function Au(e, t, n, r, i) {
	let a = r(e[0]), o = r(vu(e)), s = t == null ? (a + o) / 2 : r(t);
	return [i(s + (a - s) * n), i(s + (o - s) * n)];
}
function ju(e, t, n) {
	return Au(e, t, n, yu, ou);
}
function Mu(e, t, n) {
	let r = Math.sign(e[0]);
	return Au(e, t, n, xu(r), bu(r));
}
function Nu(e, t, n, r) {
	return Au(e, t, n, wu(r), wu(1 / r));
}
function Pu(e, t, n, r) {
	return Au(e, t, n, Su(r), Cu(r));
}
function Fu(e) {
	return 1 + ~~(new Date(e).getMonth() / 3);
}
function Iu(e) {
	return 1 + ~~(new Date(e).getUTCMonth() / 3);
}
function I(e) {
	return e == null ? [] : P(e) ? e : [e];
}
function Lu(e, t, n) {
	let r = e[0], i = e[1], a;
	return i < r && (a = i, i = r, r = a), a = i - r, a >= n - t ? [t, n] : [r = Math.min(Math.max(r, t), n - a), r + a];
}
function Ru(e) {
	return typeof e == "function";
}
var zu = "descending";
function Bu(e, t, n) {
	n = n || {}, t = I(t) || [];
	let r = [], i = [], a = {}, o = n.comparator || Hu;
	return I(e).forEach((e, o) => {
		e != null && (r.push(t[o] === zu ? -1 : 1), i.push(e = Ru(e) ? e : iu(e, null, n)), ($l(e) || []).forEach((e) => a[e] = 1));
	}), i.length === 0 ? null : Zl(o(i, r), Object.keys(a));
}
var Vu = (e, t) => (e < t || e == null) && t != null ? -1 : (e > t || t == null) && e != null ? 1 : (t = t instanceof Date ? +t : t, e = e instanceof Date ? +e : e) !== e && t === t ? -1 : +(t !== t && e === e), Hu = (e, t) => e.length === 1 ? Uu(e[0], t[0]) : Wu(e, t, e.length), Uu = (e, t) => function(n, r) {
	return Vu(e(n), e(r)) * t;
}, Wu = (e, t, n) => (t.push(0), function(r, i) {
	let a, o = 0, s = -1;
	for (; o === 0 && ++s < n;) a = e[s], o = Vu(a(r), a(i));
	return o * t[s];
});
function Gu(e) {
	return Ru(e) ? e : () => e;
}
function Ku(e, t) {
	let n;
	return (r) => {
		n && clearTimeout(n), n = setTimeout(() => (t(r), n = null), e);
	};
}
function qu(e) {
	for (let t, n, r = 1, i = arguments.length; r < i; ++r) for (n in t = arguments[r], t) e[n] = t[n];
	return e;
}
function Ju(e, t) {
	let n = 0, r, i, a, o;
	if (e && (r = e.length)) if (t == null) {
		for (i = e[n]; n < r && (i == null || i !== i); i = e[++n]);
		for (a = o = i; n < r; ++n) i = e[n], i != null && (i < a && (a = i), i > o && (o = i));
	} else {
		for (i = t(e[n]); n < r && (i == null || i !== i); i = t(e[++n]));
		for (a = o = i; n < r; ++n) i = t(e[n]), i != null && (i < a && (a = i), i > o && (o = i));
	}
	return [a, o];
}
function Yu(e, t) {
	let n = e.length, r = -1, i, a, o, s, c;
	if (t == null) {
		for (; ++r < n;) if (a = e[r], a != null && a >= a) {
			i = o = a;
			break;
		}
		if (r === n) return [-1, -1];
		for (s = c = r; ++r < n;) a = e[r], a != null && (i > a && (i = a, s = r), o < a && (o = a, c = r));
	} else {
		for (; ++r < n;) if (a = t(e[r], r, e), a != null && a >= a) {
			i = o = a;
			break;
		}
		if (r === n) return [-1, -1];
		for (s = c = r; ++r < n;) a = t(e[r], r, e), a != null && (i > a && (i = a, s = r), o < a && (o = a, c = r));
	}
	return [s, c];
}
function L(e, t) {
	return Object.hasOwn(e, t);
}
var Xu = {};
function Zu(e) {
	let t = {}, n;
	function r(e) {
		return L(t, e) && t[e] !== Xu;
	}
	let i = {
		size: 0,
		empty: 0,
		object: t,
		has: r,
		get(e) {
			return r(e) ? t[e] : void 0;
		},
		set(e, n) {
			return r(e) || (++i.size, t[e] === Xu && --i.empty), t[e] = n, this;
		},
		delete(e) {
			return r(e) && (--i.size, ++i.empty, t[e] = Xu), this;
		},
		clear() {
			i.size = i.empty = 0, i.object = t = {};
		},
		test(e) {
			return arguments.length ? (n = e, i) : n;
		},
		clean() {
			let e = {}, r = 0;
			for (let i in t) {
				let a = t[i];
				a !== Xu && (!n || !n(a)) && (e[i] = a, ++r);
			}
			i.size = r, i.empty = 0, i.object = t = e;
		}
	};
	return e && Object.keys(e).forEach((t) => {
		i.set(t, e[t]);
	}), i;
}
function Qu(e, t, n, r, i, a) {
	if (!n && n !== 0) return a;
	let o = +n, s = e[0], c = vu(e), l;
	c < s && (l = s, s = c, c = l), l = Math.abs(t - s);
	let u = Math.abs(c - t);
	return l < u && l <= o ? r : u <= o ? i : a;
}
function R(e, t, n) {
	let r = e.prototype = Object.create(t.prototype);
	return Object.defineProperty(r, "constructor", {
		value: e,
		writable: !0,
		enumerable: !0,
		configurable: !0
	}), qu(r, n);
}
function $u(e, t, n, r) {
	let i = t[0], a = t[t.length - 1], o;
	return i > a && (o = i, i = a, a = o), n = n === void 0 || n, r = r === void 0 || r, (n ? i <= e : i < e) && (r ? e <= a : e < a);
}
function ed(e) {
	return typeof e == "boolean";
}
function td(e) {
	return Object.prototype.toString.call(e) === "[object Date]";
}
function nd(e) {
	return e && Ru(e[Symbol.iterator]);
}
function rd(e) {
	return typeof e == "number";
}
function id(e) {
	return Object.prototype.toString.call(e) === "[object RegExp]";
}
function z(e) {
	return typeof e == "string";
}
function ad(e, t, n) {
	e && (e = t ? I(e).map((e) => e.replace(/\\(.)/g, "$1")) : I(e));
	let r = e && e.length, i = n && n.get || eu, a = (e) => i(t ? [e] : ru(e)), o;
	if (!r) o = function() {
		return "";
	};
	else if (r === 1) {
		let t = a(e[0]);
		o = function(e) {
			return "" + t(e);
		};
	} else {
		let t = e.map(a);
		o = function(e) {
			let n = "" + t[0](e), i = 0;
			for (; ++i < r;) n += "|" + t[i](e);
			return n;
		};
	}
	return Zl(o, e, "key");
}
function od(e, t) {
	let n = e[0], r = vu(e), i = +t;
	return i ? i === 1 ? r : n + i * (r - n) : n;
}
var sd = 1e4;
function cd(e) {
	e = +e || sd;
	let t, n, r, i = () => {
		t = {}, n = {}, r = 0;
	}, a = (i, a) => (++r > e && (n = t, t = {}, r = 1), t[i] = a);
	return i(), {
		clear: i,
		has: (e) => L(t, e) || L(n, e),
		get: (e) => L(t, e) ? t[e] : L(n, e) ? a(e, n[e]) : void 0,
		set: (e, n) => L(t, e) ? t[e] = n : a(e, n)
	};
}
function ld(e, t, n, r) {
	let i = t.length, a = n.length;
	if (!a) return t;
	if (!i) return n;
	let o = r || new t.constructor(i + a), s = 0, c = 0, l = 0;
	for (; s < i && c < a; ++l) o[l] = e(t[s], n[c]) > 0 ? n[c++] : t[s++];
	for (; s < i; ++s, ++l) o[l] = t[s];
	for (; c < a; ++c, ++l) o[l] = n[c];
	return o;
}
function ud(e, t) {
	let n = "";
	for (; --t >= 0;) n += e;
	return n;
}
function dd(e, t, n, r) {
	let i = n || " ", a = e + "", o = t - a.length;
	return o <= 0 ? a : r === "left" ? ud(i, o) + a : r === "center" ? ud(i, ~~(o / 2)) + a + ud(i, Math.ceil(o / 2)) : a + ud(i, o);
}
function fd(e) {
	return e && vu(e) - e[0] || 0;
}
function B(e) {
	return P(e) ? `[${e.map((e) => e === null ? "null" : B(e))}]` : F(e) || z(e) ? JSON.stringify(e).replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029") : e;
}
function pd(e) {
	return e == null || e === "" ? null : !e || e === "false" || e === "0" ? !1 : !!e;
}
var md = (e) => rd(e) || td(e) ? e : Date.parse(e);
function hd(e, t) {
	return t = t || md, e == null || e === "" ? null : t(e);
}
function gd(e) {
	return e == null || e === "" ? null : e + "";
}
function _d(e) {
	let t = {}, n = e.length;
	for (let r = 0; r < n; ++r) t[e[r]] = !0;
	return t;
}
function vd(e, t, n, r) {
	let i = r == null ? "…" : r, a = e + "", o = a.length, s = Math.max(0, t - i.length);
	return o <= t ? a : n === "left" ? i + a.slice(o - s) : n === "center" ? a.slice(0, Math.ceil(s / 2)) + i + a.slice(o - ~~(s / 2)) : a.slice(0, s) + i;
}
function yd(e, t, n) {
	if (e) if (t) {
		let r = e.length;
		for (let i = 0; i < r; ++i) {
			let r = t(e[i]);
			r && n(r, i, e);
		}
	} else e.forEach(n);
}
//#endregion
//#region ../../node_modules/.pnpm/topojson-client@3.1.0/node_modules/topojson-client/src/identity.js
function bd(e) {
	return e;
}
//#endregion
//#region ../../node_modules/.pnpm/topojson-client@3.1.0/node_modules/topojson-client/src/transform.js
function xd(e) {
	if (e == null) return bd;
	var t, n, r = e.scale[0], i = e.scale[1], a = e.translate[0], o = e.translate[1];
	return function(e, s) {
		s || (t = n = 0);
		var c = 2, l = e.length, u = Array(l);
		for (u[0] = (t += e[0]) * r + a, u[1] = (n += e[1]) * i + o; c < l;) u[c] = e[c], ++c;
		return u;
	};
}
//#endregion
//#region ../../node_modules/.pnpm/topojson-client@3.1.0/node_modules/topojson-client/src/reverse.js
function Sd(e, t) {
	for (var n, r = e.length, i = r - t; i < --r;) n = e[i], e[i++] = e[r], e[r] = n;
}
//#endregion
//#region ../../node_modules/.pnpm/topojson-client@3.1.0/node_modules/topojson-client/src/feature.js
function Cd(e, t) {
	return typeof t == "string" && (t = e.objects[t]), t.type === "GeometryCollection" ? {
		type: "FeatureCollection",
		features: t.geometries.map(function(t) {
			return wd(e, t);
		})
	} : wd(e, t);
}
function wd(e, t) {
	var n = t.id, r = t.bbox, i = t.properties == null ? {} : t.properties, a = Td(e, t);
	return n == null && r == null ? {
		type: "Feature",
		properties: i,
		geometry: a
	} : r == null ? {
		type: "Feature",
		id: n,
		properties: i,
		geometry: a
	} : {
		type: "Feature",
		id: n,
		bbox: r,
		properties: i,
		geometry: a
	};
}
function Td(e, t) {
	var n = xd(e.transform), r = e.arcs;
	function i(e, t) {
		t.length && t.pop();
		for (var i = r[e < 0 ? ~e : e], a = 0, o = i.length; a < o; ++a) t.push(n(i[a], a));
		e < 0 && Sd(t, o);
	}
	function a(e) {
		return n(e);
	}
	function o(e) {
		for (var t = [], n = 0, r = e.length; n < r; ++n) i(e[n], t);
		return t.length < 2 && t.push(t[0]), t;
	}
	function s(e) {
		for (var t = o(e); t.length < 4;) t.push(t[0]);
		return t;
	}
	function c(e) {
		return e.map(s);
	}
	function l(e) {
		var t = e.type, n;
		switch (t) {
			case "GeometryCollection": return {
				type: t,
				geometries: e.geometries.map(l)
			};
			case "Point":
				n = a(e.coordinates);
				break;
			case "MultiPoint":
				n = e.coordinates.map(a);
				break;
			case "LineString":
				n = o(e.arcs);
				break;
			case "MultiLineString":
				n = e.arcs.map(o);
				break;
			case "Polygon":
				n = c(e.arcs);
				break;
			case "MultiPolygon":
				n = e.arcs.map(c);
				break;
			default: return null;
		}
		return {
			type: t,
			coordinates: n
		};
	}
	return l(t);
}
//#endregion
//#region ../../node_modules/.pnpm/topojson-client@3.1.0/node_modules/topojson-client/src/stitch.js
function Ed(e, t) {
	var n = {}, r = {}, i = {}, a = [], o = -1;
	t.forEach(function(n, r) {
		var i = e.arcs[n < 0 ? ~n : n], a;
		i.length < 3 && !i[1][0] && !i[1][1] && (a = t[++o], t[o] = n, t[r] = a);
	}), t.forEach(function(e) {
		var t = s(e), n = t[0], a = t[1], o, c;
		if (o = i[n]) if (delete i[o.end], o.push(e), o.end = a, c = r[a]) {
			delete r[c.start];
			var l = c === o ? o : o.concat(c);
			r[l.start = o.start] = i[l.end = c.end] = l;
		} else r[o.start] = i[o.end] = o;
		else if (o = r[a]) if (delete r[o.start], o.unshift(e), o.start = n, c = i[n]) {
			delete i[c.end];
			var u = c === o ? o : c.concat(o);
			r[u.start = c.start] = i[u.end = o.end] = u;
		} else r[o.start] = i[o.end] = o;
		else o = [e], r[o.start = n] = i[o.end = a] = o;
	});
	function s(t) {
		var n = e.arcs[t < 0 ? ~t : t], r = n[0], i;
		return e.transform ? (i = [0, 0], n.forEach(function(e) {
			i[0] += e[0], i[1] += e[1];
		})) : i = n[n.length - 1], t < 0 ? [i, r] : [r, i];
	}
	function c(e, t) {
		for (var r in e) {
			var i = e[r];
			delete t[i.start], delete i.start, delete i.end, i.forEach(function(e) {
				n[e < 0 ? ~e : e] = 1;
			}), a.push(i);
		}
	}
	return c(i, r), c(r, i), t.forEach(function(e) {
		n[e < 0 ? ~e : e] || a.push([e]);
	}), a;
}
//#endregion
//#region ../../node_modules/.pnpm/topojson-client@3.1.0/node_modules/topojson-client/src/mesh.js
function Dd(e) {
	return Td(e, Od.apply(this, arguments));
}
function Od(e, t, n) {
	var r, i, a;
	if (arguments.length > 1) r = kd(e, t, n);
	else for (i = 0, r = Array(a = e.arcs.length); i < a; ++i) r[i] = i;
	return {
		type: "MultiLineString",
		arcs: Ed(e, r)
	};
}
function kd(e, t, n) {
	var r = [], i = [], a;
	function o(e) {
		var t = e < 0 ? ~e : e;
		(i[t] || (i[t] = [])).push({
			i: e,
			g: a
		});
	}
	function s(e) {
		e.forEach(o);
	}
	function c(e) {
		e.forEach(s);
	}
	function l(e) {
		e.forEach(c);
	}
	function u(e) {
		switch (a = e, e.type) {
			case "GeometryCollection":
				e.geometries.forEach(u);
				break;
			case "LineString":
				s(e.arcs);
				break;
			case "MultiLineString":
			case "Polygon":
				c(e.arcs);
				break;
			case "MultiPolygon":
				l(e.arcs);
				break;
		}
	}
	return u(t), i.forEach(n == null ? function(e) {
		r.push(e[0].i);
	} : function(e) {
		n(e[0].g, e[e.length - 1].g) && r.push(e[0].i);
	}), r;
}
//#endregion
//#region ../../node_modules/.pnpm/vega-time@3.1.0/node_modules/vega-time/build/vega-time.js
var Ad = "year", jd = "quarter", Md = "month", Nd = "week", Pd = "date", Fd = "dayofyear", Id = "hours", Ld = "minutes", Rd = "seconds", zd = "milliseconds", Bd = [
	Ad,
	jd,
	Md,
	Nd,
	Pd,
	"day",
	Fd,
	Id,
	Ld,
	Rd,
	zd
], Vd = Bd.reduce((e, t, n) => (e[t] = 1 + n, e), {});
function Hd(e) {
	let t = I(e).slice(), n = {};
	return t.length || N("Missing time unit."), t.forEach((e) => {
		L(Vd, e) ? n[e] = 1 : N(`Invalid time unit: ${e}.`);
	}), (n.week || n.day ? 1 : 0) + (n.quarter || n.month || n.date ? 1 : 0) + +!!n.dayofyear > 1 && N(`Incompatible time units: ${e}`), t.sort((e, t) => Vd[e] - Vd[t]), t;
}
var Ud = {
	[Ad]: "%Y ",
	[jd]: "Q%q ",
	[Md]: "%b ",
	[Pd]: "%d ",
	[Nd]: "W%U ",
	day: "%a ",
	[Fd]: "%j ",
	[Id]: "%H:00",
	[Ld]: "00:%M",
	[Rd]: ":%S",
	[zd]: ".%L",
	[`${Ad}-${Md}`]: "%Y-%m ",
	[`${Ad}-${Md}-${Pd}`]: "%Y-%m-%d ",
	[`${Id}-${Ld}`]: "%H:%M"
};
function Wd(e, t) {
	let n = qu({}, Ud, t), r = Hd(e), i = r.length, a = "", o = 0, s, c;
	for (o = 0; o < i;) for (s = r.length; s > o; --s) if (c = r.slice(o, s).join("-"), n[c] != null) {
		a += n[c], o = s;
		break;
	}
	return a.trim();
}
var Gd = /* @__PURE__ */ new Date();
function Kd(e) {
	return Gd.setFullYear(e), Gd.setMonth(0), Gd.setDate(1), Gd.setHours(0, 0, 0, 0), Gd;
}
function qd(e) {
	return Yd(new Date(e));
}
function Jd(e) {
	return Xd(new Date(e));
}
function Yd(e) {
	return k.count(Kd(e.getFullYear()) - 1, e);
}
function Xd(e) {
	return te.count(Kd(e.getFullYear()) - 1, e);
}
function Zd(e) {
	return Kd(e).getDay();
}
function Qd(e, t, n, r, i, a, o) {
	if (0 <= e && e < 100) {
		let s = new Date(-1, t, n, r, i, a, o);
		return s.setFullYear(e), s;
	}
	return new Date(e, t, n, r, i, a, o);
}
function $d(e) {
	return tf(new Date(e));
}
function ef(e) {
	return nf(new Date(e));
}
function tf(e) {
	let t = Date.UTC(e.getUTCFullYear(), 0, 1);
	return w.count(t - 1, e);
}
function nf(e) {
	let t = Date.UTC(e.getUTCFullYear(), 0, 1);
	return ve.count(t - 1, e);
}
function rf(e) {
	return Gd.setTime(Date.UTC(e, 0, 1)), Gd.getUTCDay();
}
function af(e, t, n, r, i, a, o) {
	if (0 <= e && e < 100) {
		let e = new Date(Date.UTC(-1, t, n, r, i, a, o));
		return e.setUTCFullYear(n.y), e;
	}
	return new Date(Date.UTC(e, t, n, r, i, a, o));
}
function of(e, t, n, r, i) {
	let a = t || 1, o = vu(e), s = (e, t, i) => (i = i || e, sf(n[i], r[i], e === o && a, t)), c = /* @__PURE__ */ new Date(), l = _d(e), u = l.year ? s(Ad) : Gu(2012), d = l.month ? s(Md) : l.quarter ? s(jd) : su, f = l.week && l.day ? s("day", 1, Nd + "day") : l.week ? s(Nd, 1) : l.day ? s("day", 1) : l.date ? s(Pd, 1) : l.dayofyear ? s(Fd, 1) : cu, p = l.hours ? s(Id) : su, m = l.minutes ? s(Ld) : su, h = l.seconds ? s(Rd) : su, g = l.milliseconds ? s(zd) : su;
	return function(e) {
		c.setTime(+e);
		let t = u(c);
		return i(t, d(c), f(c, t), p(c), m(c), h(c), g(c));
	};
}
function sf(e, t, n, r) {
	let i = n <= 1 ? e : r ? (t, i) => r + n * Math.floor((e(t, i) - r) / n) : (t, r) => n * Math.floor(e(t, r) / n);
	return t ? (e, n) => t(i(e, n), n) : i;
}
function cf(e, t, n) {
	return t + e * 7 - (n + 6) % 7;
}
var lf = {
	[Ad]: (e) => e.getFullYear(),
	[jd]: (e) => Math.floor(e.getMonth() / 3),
	[Md]: (e) => e.getMonth(),
	[Pd]: (e) => e.getDate(),
	[Id]: (e) => e.getHours(),
	[Ld]: (e) => e.getMinutes(),
	[Rd]: (e) => e.getSeconds(),
	[zd]: (e) => e.getMilliseconds(),
	[Fd]: (e) => Yd(e),
	[Nd]: (e) => Xd(e),
	[Nd + "day"]: (e, t) => cf(Xd(e), e.getDay(), Zd(t)),
	day: (e, t) => cf(1, e.getDay(), Zd(t))
}, uf = {
	[jd]: (e) => 3 * e,
	[Nd]: (e, t) => cf(e, 0, Zd(t))
};
function df(e, t) {
	return of(e, t || 1, lf, uf, Qd);
}
var ff = {
	[Ad]: (e) => e.getUTCFullYear(),
	[jd]: (e) => Math.floor(e.getUTCMonth() / 3),
	[Md]: (e) => e.getUTCMonth(),
	[Pd]: (e) => e.getUTCDate(),
	[Id]: (e) => e.getUTCHours(),
	[Ld]: (e) => e.getUTCMinutes(),
	[Rd]: (e) => e.getUTCSeconds(),
	[zd]: (e) => e.getUTCMilliseconds(),
	[Fd]: (e) => tf(e),
	[Nd]: (e) => nf(e),
	day: (e, t) => cf(1, e.getUTCDay(), rf(t)),
	[Nd + "day"]: (e, t) => cf(nf(e), e.getUTCDay(), rf(t))
}, pf = {
	[jd]: (e) => 3 * e,
	[Nd]: (e, t) => cf(e, 0, rf(t))
};
function mf(e, t) {
	return of(e, t || 1, ff, pf, af);
}
var hf = {
	[Ad]: ge,
	[jd]: ae.every(3),
	[Md]: ae,
	[Nd]: te,
	[Pd]: k,
	day: k,
	[Fd]: k,
	[Id]: _e,
	[Ld]: E,
	[Rd]: O,
	[zd]: ce
}, gf = {
	[Ad]: ie,
	[jd]: fe.every(3),
	[Md]: fe,
	[Nd]: ve,
	[Pd]: w,
	day: w,
	[Fd]: w,
	[Id]: ee,
	[Ld]: T,
	[Rd]: O,
	[zd]: ce
};
function _f(e) {
	return hf[e];
}
function vf(e) {
	return gf[e];
}
function yf(e, t, n) {
	return e ? e.offset(t, n) : void 0;
}
function bf(e, t, n) {
	return yf(_f(e), t, n);
}
function xf(e, t, n) {
	return yf(vf(e), t, n);
}
function Sf(e, t, n, r) {
	return e ? e.range(t, n, r) : void 0;
}
function Cf(e, t, n, r) {
	return Sf(_f(e), t, n, r);
}
function wf(e, t, n, r) {
	return Sf(vf(e), t, n, r);
}
var Tf = 1e3, Ef = Tf * 60, Df = Ef * 60, Of = Df * 24, kf = Of * 7, Af = Of * 30, jf = Of * 365, Mf = [
	Ad,
	Md,
	Pd,
	Id,
	Ld,
	Rd,
	zd
], Nf = Mf.slice(0, -1), Pf = Nf.slice(0, -1), Ff = Pf.slice(0, -1), If = Ff.slice(0, -1), Lf = [Ad, Nd], Rf = [Ad, Md], zf = [Ad], Bf = [
	[
		Nf,
		1,
		Tf
	],
	[
		Nf,
		5,
		5 * Tf
	],
	[
		Nf,
		15,
		15 * Tf
	],
	[
		Nf,
		30,
		30 * Tf
	],
	[
		Pf,
		1,
		Ef
	],
	[
		Pf,
		5,
		5 * Ef
	],
	[
		Pf,
		15,
		15 * Ef
	],
	[
		Pf,
		30,
		30 * Ef
	],
	[
		Ff,
		1,
		Df
	],
	[
		Ff,
		3,
		3 * Df
	],
	[
		Ff,
		6,
		6 * Df
	],
	[
		Ff,
		12,
		12 * Df
	],
	[
		If,
		1,
		Of
	],
	[
		Lf,
		1,
		kf
	],
	[
		Rf,
		1,
		Af
	],
	[
		Rf,
		3,
		3 * Af
	],
	[
		zf,
		1,
		jf
	]
];
function Vf(e) {
	let t = e.extent, n = e.maxbins || 40, r = Math.abs(fd(t)) / n, i = v((e) => e[2]).right(Bf, r), a, s;
	return i === Bf.length ? (a = zf, s = o(t[0] / jf, t[1] / jf, n)) : i ? (i = Bf[r / Bf[i - 1][2] < Bf[i][2] / r ? i - 1 : i], a = i[0], s = i[1]) : (a = Mf, s = Math.max(o(t[0], t[1], n), 1)), {
		units: a,
		step: s
	};
}
//#endregion
//#region ../../node_modules/.pnpm/vega-format@2.1.0/node_modules/vega-format/build/vega-format.js
function Hf(e) {
	let t = {};
	return (n) => t[n] || (t[n] = e(n));
}
function Uf(e, t) {
	return (n) => {
		let r = e(n), i = r.indexOf(t);
		if (i < 0) return r;
		let a = Wf(r, i), o = a < r.length ? r.slice(a) : "";
		for (; --a > i;) if (r[a] !== "0") {
			++a;
			break;
		}
		return r.slice(0, a) + o;
	};
}
function Wf(e, t) {
	let n = e.lastIndexOf("e"), r;
	if (n > 0) return n;
	for (n = e.length; --n > t;) if (r = e.charCodeAt(n), r >= 48 && r <= 57) return n + 1;
}
function Gf(e) {
	let t = Hf(e.format), n = e.formatPrefix;
	return {
		format: t,
		formatPrefix: n,
		formatFloat(e) {
			let n = et(e || ",");
			if (n.precision == null) {
				switch (n.precision = 12, n.type) {
					case "%":
						n.precision -= 2;
						break;
					case "e":
						--n.precision;
						break;
				}
				return Uf(t(n), t(".1f")(1)[1]);
			} else return t(n);
		},
		formatSpan(e, r, i, s) {
			s = et(s == null ? ",f" : s);
			let c = o(e, r, i), u = Math.max(Math.abs(e), Math.abs(r)), d;
			if (s.precision == null) switch (s.type) {
				case "s": return isNaN(d = _(c, u)) || (s.precision = d), n(s, u);
				case "":
				case "e":
				case "g":
				case "p":
				case "r":
					isNaN(d = l(c, u)) || (s.precision = d - (s.type === "e"));
					break;
				case "f":
				case "%":
					isNaN(d = a(c)) || (s.precision = d - (s.type === "%") * 2);
					break;
			}
			return t(s);
		}
	};
}
var Kf;
qf();
function qf() {
	return Kf = Gf({
		format: rt,
		formatPrefix: tt
	});
}
function Jf(e) {
	return Gf(nt(e));
}
function Yf(e) {
	return arguments.length ? Kf = Jf(e) : Kf;
}
function Xf(e, t, n) {
	n = n || {}, F(n) || N(`Invalid time multi-format specifier: ${n}`);
	let r = t(Rd), i = t(Ld), a = t(Id), o = t(Pd), s = t(Nd), c = t(Md), l = t(jd), u = t(Ad), d = e(n.milliseconds || ".%L"), f = e(n.seconds || ":%S"), p = e(n.minutes || "%I:%M"), m = e(n.hours || "%I %p"), h = e(n.date || n.day || "%a %d"), g = e(n.week || "%b %d"), _ = e(n.month || "%B"), v = e(n.quarter || "%B"), y = e(n.year || "%Y");
	return (e) => (r(e) < e ? d : i(e) < e ? f : a(e) < e ? p : o(e) < e ? m : c(e) < e ? s(e) < e ? h : g : u(e) < e ? l(e) < e ? _ : v : y)(e);
}
function Zf(e) {
	let t = Hf(e.format), n = Hf(e.utcFormat);
	return {
		timeFormat: (e) => z(e) ? t(e) : Xf(t, _f, e),
		utcFormat: (e) => z(e) ? n(e) : Xf(n, vf, e),
		timeParse: Hf(e.parse),
		utcParse: Hf(e.utcParse)
	};
}
var Qf;
$f();
function $f() {
	return Qf = Zf({
		format: pe,
		parse: oe,
		utcFormat: ne,
		utcParse: de
	});
}
function ep(e) {
	return Zf(me(e));
}
function tp(e) {
	return arguments.length ? Qf = ep(e) : Qf;
}
var np = (e, t) => qu({}, e, t);
function rp(e, t) {
	return np(e ? Jf(e) : Yf(), t ? ep(t) : tp());
}
function ip(e, t) {
	let n = arguments.length;
	return n && n !== 2 && N("defaultLocale expects either zero or two arguments."), n ? np(Yf(e), tp(t)) : np(Yf(), tp());
}
function ap() {
	return qf(), $f(), ip();
}
//#endregion
//#region ../../node_modules/.pnpm/vega-loader@5.1.0/node_modules/vega-loader/build/vega-loader.browser.js
var op = /^(data:|([A-Za-z]+:)?\/\/)/, sp = /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|file|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i, cp = /[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205f\u3000]/g, lp = "file://";
function up(e) {
	return (e) => ({
		options: e || {},
		sanitize: fp,
		load: dp,
		fileAccess: !1,
		file: pp(),
		http: hp
	});
}
async function dp(e, t) {
	let n = await this.sanitize(e, t), r = n.href;
	return n.localFile ? this.file(r) : this.http(r, t == null ? void 0 : t.http);
}
async function fp(e, t) {
	t = qu({}, this.options, t);
	let n = this.fileAccess, r = { href: null }, i, a, o, s = sp.test(e.replace(cp, ""));
	(e == null || typeof e != "string" || !s) && N("Sanitize failure, invalid URI: " + B(e));
	let c = op.test(e);
	return (o = t.baseURL) && !c && (!e.startsWith("/") && !o.endsWith("/") && (e = "/" + e), e = o + e), a = (i = e.startsWith(lp)) || t.mode === "file" || t.mode !== "http" && !c && n, i ? e = e.slice(7) : e.startsWith("//") && (t.defaultProtocol === "file" ? (e = e.slice(2), a = !0) : e = (t.defaultProtocol || "http") + ":" + e), Object.defineProperty(r, "localFile", { value: !!a }), r.href = e, t.target && (r.target = t.target + ""), t.rel && (r.rel = t.rel + ""), t.context === "image" && t.crossOrigin && (r.crossOrigin = t.crossOrigin + ""), r;
}
function pp(e) {
	return mp;
}
async function mp() {
	N("No file system access.");
}
async function hp(e, t) {
	let n = qu({}, this.options.http, t), r = t && t.response, i = await fetch(e, n);
	return i.ok ? Ru(i[r]) ? i[r]() : i.text() : N(i.status + "" + i.statusText);
}
var gp = (e) => e != null && e === e, _p = (e) => e === "true" || e === "false" || e === !0 || e === !1, vp = (e) => !Number.isNaN(Date.parse(e)), yp = (e) => !Number.isNaN(+e) && !(e instanceof Date), gee = (e) => yp(e) && Number.isInteger(+e), bp = {
	boolean: pd,
	integer: yu,
	number: yu,
	date: hd,
	string: gd,
	unknown: ou
}, xp = [
	_p,
	gee,
	yp,
	vp
], _ee = [
	"boolean",
	"integer",
	"number",
	"date"
];
function Sp(e, t) {
	if (!e || !e.length) return "unknown";
	let n = e.length, r = xp.length, i = xp.map((e, t) => t + 1);
	for (let a = 0, o = 0, s, c; a < n; ++a) for (c = t ? e[a][t] : e[a], s = 0; s < r; ++s) if (i[s] && gp(c) && !xp[s](c) && (i[s] = 0, ++o, o === xp.length)) return "string";
	return _ee[i.reduce((e, t) => e === 0 ? t : e, 0) - 1];
}
function Cp(e, t) {
	return t.reduce((t, n) => (t[n] = Sp(e, n), t), {});
}
function wp(e) {
	let t = function(t, n) {
		let r = { delimiter: e };
		return Tp(t, n ? qu(n, r) : r);
	};
	return t.responseType = "text", t;
}
function Tp(e, t) {
	return t.header && (e = t.header.map(B).join(t.delimiter) + "\n" + e), In(t.delimiter).parse(e + "");
}
Tp.responseType = "text";
function vee(e) {
	return typeof Buffer == "function" && Ru(Buffer.isBuffer) ? Buffer.isBuffer(e) : !1;
}
function Ep(e, t) {
	let n = t && t.property ? iu(t.property) : ou;
	return F(e) && !vee(e) ? yee(n(e), t) : n(JSON.parse(e));
}
Ep.responseType = "json";
function yee(e, t) {
	return !P(e) && nd(e) && (e = [...e]), t && t.copy ? JSON.parse(JSON.stringify(e)) : e;
}
var bee = {
	interior: (e, t) => e !== t,
	exterior: (e, t) => e === t
};
function Dp(e, t) {
	let n, r, i, a;
	return e = Ep(e, t), t && t.feature ? (n = Cd, i = t.feature) : t && t.mesh ? (n = Dd, i = t.mesh, a = bee[t.filter]) : N("Missing TopoJSON feature or mesh parameter."), r = (r = e.objects[i]) ? n(e, r, a) : N("Invalid TopoJSON object: " + i), r && r.features || [r];
}
Dp.responseType = "json";
var Op = {
	dsv: Tp,
	csv: wp(","),
	tsv: wp("	"),
	json: Ep,
	topojson: Dp
};
function kp(e, t) {
	return arguments.length > 1 ? (Op[e] = t, this) : L(Op, e) ? Op[e] : null;
}
function Ap(e) {
	let t = kp(e);
	return t && t.responseType || "text";
}
function jp(e, t, n, r) {
	t = t || {};
	let i = kp(t.type || "json");
	return i || N("Unknown data format type: " + t.type), e = i(e, t), t.parse && xee(e, t.parse, n, r), L(e, "columns") && delete e.columns, e;
}
function xee(e, t, n, r) {
	if (!e.length) return;
	let i = tp();
	n = n || i.timeParse, r = r || i.utcParse;
	let a = e.columns || Object.keys(e[0]), o, s, c, l, u, d;
	t === "auto" && (t = Cp(e, a)), a = Object.keys(t);
	let f = a.map((e) => {
		let i = t[e], a, o;
		if (i && (i.startsWith("date:") || i.startsWith("utc:"))) return a = i.split(/:(.+)?/, 2), o = a[1], (o[0] === "'" && o[o.length - 1] === "'" || o[0] === "\"" && o[o.length - 1] === "\"") && (o = o.slice(1, -1)), (a[0] === "utc" ? r : n)(o);
		if (!bp[i]) throw Error("Illegal format pattern: " + e + ":" + i);
		return bp[i];
	});
	for (c = 0, u = e.length, d = a.length; c < u; ++c) for (o = e[c], l = 0; l < d; ++l) s = a[l], o[s] = f[l](o[s]);
}
var Mp = up();
//#endregion
//#region ../../node_modules/.pnpm/vega-dataflow@6.1.0/node_modules/vega-dataflow/build/vega-dataflow.js
function Np(e) {
	let t = e || ou, n = [], r = {};
	return n.add = (e) => {
		let i = t(e);
		return r[i] || (r[i] = 1, n.push(e)), n;
	}, n.remove = (e) => {
		let i = t(e);
		if (r[i]) {
			r[i] = 0;
			let t = n.indexOf(e);
			t >= 0 && n.splice(t, 1);
		}
		return n;
	}, n;
}
async function Pp(e, t) {
	try {
		await t(e);
	} catch (t) {
		e.error(t);
	}
}
var Fp = Symbol("vega_id"), See = 1;
function Ip(e) {
	return !!(e && V(e));
}
function V(e) {
	return e[Fp];
}
function Lp(e, t) {
	return e[Fp] = t, e;
}
function Rp(e) {
	let t = e === Object(e) ? e : { data: e };
	return V(t) ? t : Lp(t, See++);
}
function zp(e) {
	return Bp(e, Rp({}));
}
function Bp(e, t) {
	for (let n in e) t[n] = e[n];
	return t;
}
function Vp(e, t) {
	return Lp(t, V(e));
}
function Hp(e, t) {
	return e ? t ? (n, r) => e(n, r) || V(t(n)) - V(t(r)) : (t, n) => e(t, n) || V(t) - V(n) : null;
}
function Up(e) {
	return e && e.constructor === Wp;
}
function Wp() {
	let e = [], t = [], n = [], r = [], i = [], a = null, o = !1;
	return {
		constructor: Wp,
		insert(t) {
			let n = I(t), r = n.length;
			for (let t = 0; t < r; ++t) e.push(n[t]);
			return this;
		},
		remove(e) {
			let n = Ru(e) ? r : t, i = I(e), a = i.length;
			for (let e = 0; e < a; ++e) n.push(i[e]);
			return this;
		},
		modify(e, t, r) {
			let a = {
				field: t,
				value: Gu(r)
			};
			return Ru(e) ? (a.filter = e, i.push(a)) : (a.tuple = e, n.push(a)), this;
		},
		encode(e, t) {
			return Ru(e) ? i.push({
				filter: e,
				field: t
			}) : n.push({
				tuple: e,
				field: t
			}), this;
		},
		clean(e) {
			return a = e, this;
		},
		reflow() {
			return o = !0, this;
		},
		pulse(s, c) {
			let l = {}, u = {}, d, f, p, m, h, g;
			for (d = 0, f = c.length; d < f; ++d) l[V(c[d])] = 1;
			for (d = 0, f = t.length; d < f; ++d) h = t[d], l[V(h)] = -1;
			for (d = 0, f = r.length; d < f; ++d) m = r[d], c.forEach((e) => {
				m(e) && (l[V(e)] = -1);
			});
			for (d = 0, f = e.length; d < f; ++d) h = e[d], g = V(h), l[g] ? l[g] = 1 : s.add.push(Rp(e[d]));
			for (d = 0, f = c.length; d < f; ++d) h = c[d], l[V(h)] < 0 && s.rem.push(h);
			function _(e, t, n) {
				n ? e[t] = n(e) : s.encode = t, o || (u[V(e)] = e);
			}
			for (d = 0, f = n.length; d < f; ++d) p = n[d], h = p.tuple, m = p.field, g = l[V(h)], g > 0 && (_(h, m, p.value), s.modifies(m));
			for (d = 0, f = i.length; d < f; ++d) p = i[d], m = p.filter, c.forEach((e) => {
				m(e) && l[V(e)] > 0 && _(e, p.field, p.value);
			}), s.modifies(p.field);
			if (o) s.mod = t.length || r.length ? c.filter((e) => l[V(e)] > 0) : c.slice();
			else for (g in u) s.mod.push(u[g]);
			return (a || a == null && (t.length || r.length)) && s.clean(!0), s;
		}
	};
}
var Gp = "_:mod:_";
function Kp() {
	Object.defineProperty(this, Gp, {
		writable: !0,
		value: {}
	});
}
Kp.prototype = {
	set(e, t, n, r) {
		let i = this, a = i[e], o = i[Gp];
		return t != null && t >= 0 ? (a[t] !== n || r) && (a[t] = n, o[t + ":" + e] = -1, o[e] = -1) : (a !== n || r) && (i[e] = n, o[e] = P(n) ? 1 + n.length : -1), i;
	},
	modified(e, t) {
		let n = this[Gp];
		if (!arguments.length) {
			for (let e in n) if (n[e]) return !0;
			return !1;
		} else if (P(e)) {
			for (let t = 0; t < e.length; ++t) if (n[e[t]]) return !0;
			return !1;
		}
		return t != null && t >= 0 ? t + 1 < n[e] || !!n[t + ":" + e] : !!n[e];
	},
	clear() {
		return this[Gp] = {}, this;
	}
};
var Cee = 0, qp = "pulse", Jp = new Kp(), Yp = 1, Xp = 2;
function Zp(e, t, n, r) {
	this.id = ++Cee, this.value = e, this.stamp = -1, this.rank = -1, this.qrank = -1, this.flags = 0, t && (this._update = t), n && this.parameters(n, r);
}
function Qp(e) {
	return function(t) {
		let n = this.flags;
		return arguments.length === 0 ? !!(n & e) : (this.flags = t ? n | e : n & ~e, this);
	};
}
Zp.prototype = {
	targets() {
		return this._targets || (this._targets = Np(au));
	},
	set(e) {
		return this.value === e ? 0 : (this.value = e, 1);
	},
	skip: Qp(Yp),
	modified: Qp(Xp),
	parameters(e, t, n) {
		t = t !== !1;
		let r = this._argval = this._argval || new Kp(), i = this._argops = this._argops || [], a = [], o, s, c, l, u = (e, n, o) => {
			o instanceof Zp ? (o !== this && (t && o.targets().add(this), a.push(o)), i.push({
				op: o,
				name: e,
				index: n
			})) : r.set(e, n, o);
		};
		for (o in e) if (s = e[o], o === qp) I(s).forEach((e) => {
			e instanceof Zp ? e !== this && (e.targets().add(this), a.push(e)) : N("Pulse parameters must be operator instances.");
		}), this.source = s;
		else if (P(s)) for (r.set(o, -1, Array(c = s.length)), l = 0; l < c; ++l) u(o, l, s[l]);
		else u(o, -1, s);
		return this.marshall().clear(), n && (i.initonly = !0), a;
	},
	marshall(e) {
		let t = this._argval || Jp, n = this._argops, r, i, a, o;
		if (n) {
			let s = n.length;
			for (i = 0; i < s; ++i) r = n[i], a = r.op, o = a.modified() && a.stamp === e, t.set(r.name, r.index, a.value, o);
			if (n.initonly) {
				for (i = 0; i < s; ++i) r = n[i], r.op.targets().remove(this);
				this._argops = null, this._update = null;
			}
		}
		return t;
	},
	detach() {
		let e = this._argops, t, n, r, i;
		if (e) for (t = 0, n = e.length; t < n; ++t) r = e[t], i = r.op, i._targets && i._targets.remove(this);
		this.pulse = null, this.source = null;
	},
	evaluate(e) {
		let t = this._update;
		if (t) {
			let n = this.marshall(e.stamp), r = t.call(this, n, e);
			if (n.clear(), r !== this.value) this.value = r;
			else if (!this.modified()) return e.StopPropagation;
		}
	},
	run(e) {
		if (e.stamp < this.stamp) return e.StopPropagation;
		let t;
		return this.skip() ? (this.skip(!1), t = 0) : t = this.evaluate(e), this.pulse = t || e;
	}
};
function $p(e, t, n, r) {
	let i = 1, a;
	return e instanceof Zp ? a = e : e && e.prototype instanceof Zp ? a = new e() : Ru(e) ? a = new Zp(null, e) : (i = 0, a = new Zp(e, t)), this.rank(a), i && (r = n, n = t), n && this.connect(a, a.parameters(n, r)), this.touch(a), a;
}
function em(e, t) {
	let n = e.rank, r = t.length;
	for (let i = 0; i < r; ++i) if (n < t[i].rank) {
		this.rerank(e);
		return;
	}
}
var tm = 0;
function nm(e, t, n) {
	this.id = ++tm, this.value = null, n && (this.receive = n), e && (this._filter = e), t && (this._apply = t);
}
function rm(e, t, n) {
	return new nm(e, t, n);
}
nm.prototype = {
	_filter: lu,
	_apply: ou,
	targets() {
		return this._targets || (this._targets = Np(au));
	},
	consume(e) {
		return arguments.length ? (this._consume = !!e, this) : !!this._consume;
	},
	receive(e) {
		if (this._filter(e)) {
			let t = this.value = this._apply(e), n = this._targets, r = n ? n.length : 0;
			for (let e = 0; e < r; ++e) n[e].receive(t);
			this._consume && (e.preventDefault(), e.stopPropagation());
		}
	},
	filter(e) {
		let t = rm(e);
		return this.targets().add(t), t;
	},
	apply(e) {
		let t = rm(null, e);
		return this.targets().add(t), t;
	},
	merge() {
		let e = rm();
		this.targets().add(e);
		for (let t = 0, n = arguments.length; t < n; ++t) arguments[t].targets().add(e);
		return e;
	},
	throttle(e) {
		let t = -1;
		return this.filter(() => {
			let n = Date.now();
			return n - t > e ? (t = n, 1) : 0;
		});
	},
	debounce(e) {
		let t = rm();
		return this.targets().add(rm(null, null, Ku(e, (e) => {
			let n = e.dataflow;
			t.receive(e), n && n.run && n.run();
		}))), t;
	},
	between(e, t) {
		let n = !1;
		return e.targets().add(rm(null, null, () => n = !0)), t.targets().add(rm(null, null, () => n = !1)), this.filter(() => n);
	},
	detach() {
		this._filter = lu, this._targets = null;
	}
};
function im(e, t, n, r) {
	let i = this, a = rm(n, r), o = function(e) {
		e.dataflow = i;
		try {
			a.receive(e);
		} catch (e) {
			i.error(e);
		} finally {
			i.run();
		}
	}, s;
	s = typeof e == "string" && typeof document < "u" ? document.querySelectorAll(e) : I(e);
	let c = s.length;
	for (let e = 0; e < c; ++e) s[e].addEventListener(t, o);
	return a;
}
function am(e, t) {
	let n = this.locale();
	return jp(e, t, n.timeParse, n.utcParse);
}
function om(e, t, n) {
	return t = this.parse(t, n), this.pulse(e, this.changeset().insert(t));
}
async function sm(e, t) {
	let n = this, r = 0, i;
	try {
		i = await n.loader().load(e, {
			context: "dataflow",
			response: Ap(t && t.type)
		});
		try {
			i = n.parse(i, t);
		} catch (t) {
			r = -2, n.warn("Data ingestion failed", e, t);
		}
	} catch (t) {
		r = -1, n.warn("Loading failed", e, t);
	}
	return {
		data: i,
		status: r
	};
}
async function cm(e, t, n) {
	let r = this, i = r._pending || lm(r);
	i.requests += 1;
	let a = await r.request(t, n);
	return r.pulse(e, r.changeset().remove(lu).insert(a.data || [])), i.done(), a;
}
function lm(e) {
	let t, n = new Promise((e) => t = e);
	return n.requests = 0, n.done = () => {
		--n.requests === 0 && (e._pending = null, t(e));
	}, e._pending = n;
}
var um = { skip: !0 };
function wee(e, t, n, r, i) {
	return (e instanceof Zp ? dm : Tee)(this, e, t, n, r, i), this;
}
function Tee(e, t, n, r, i, a) {
	let o = qu({}, a, um), s, c;
	Ru(n) || (n = Gu(n)), r === void 0 ? s = (t) => e.touch(n(t)) : Ru(r) ? (c = new Zp(null, r, i, !1), s = (t) => {
		c.evaluate(t);
		let r = n(t), i = c.value;
		Up(i) ? e.pulse(r, i, a) : e.update(r, i, o);
	}) : s = (t) => e.update(n(t), r, o), t.apply(s);
}
function dm(e, t, n, r, i, a) {
	if (r === void 0) t.targets().add(n);
	else {
		let o = a || {}, s = new Zp(null, fm(n, r), i, !1);
		s.modified(o.force), s.rank = t.rank, t.targets().add(s), n && (s.skip(!0), s.value = n.value, s.targets().add(n), e.connect(n, [s]));
	}
}
function fm(e, t) {
	return t = Ru(t) ? t : Gu(t), e ? function(n, r) {
		let i = t(n, r);
		return e.skip() || (e.skip(i !== this.value).value = i), i;
	} : t;
}
function pm(e) {
	e.rank = ++this._rank;
}
function mm(e) {
	let t = [e], n, r, i;
	for (; t.length;) if (this.rank(n = t.pop()), r = n._targets) for (i = r.length; --i >= 0;) t.push(n = r[i]), n === e && N("Cycle detected in dataflow graph.");
}
var hm = {}, gm = 1, _m = 2, vm = 4, ym = gm | _m, bm = gm | vm, xm = _m | 5, Sm = 8, Cm = 16, wm = 32, Tm = 64;
function Em(e, t, n) {
	this.dataflow = e, this.stamp = t == null ? -1 : t, this.add = [], this.rem = [], this.mod = [], this.fields = null, this.encode = n || null;
}
function Dm(e, t) {
	let n = [];
	return yd(e, t, (e) => n.push(e)), n;
}
function Om(e, t) {
	let n = {};
	return e.visit(t, (e) => {
		n[V(e)] = 1;
	}), (e) => n[V(e)] ? null : e;
}
function km(e, t) {
	return e ? (n, r) => e(n, r) && t(n, r) : t;
}
Em.prototype = {
	StopPropagation: hm,
	ADD: gm,
	REM: _m,
	MOD: vm,
	ADD_REM: ym,
	ADD_MOD: bm,
	ALL: xm,
	REFLOW: Sm,
	SOURCE: Cm,
	NO_SOURCE: wm,
	NO_FIELDS: Tm,
	fork(e) {
		return new Em(this.dataflow).init(this, e);
	},
	clone() {
		let e = this.fork(xm);
		return e.add = e.add.slice(), e.rem = e.rem.slice(), e.mod = e.mod.slice(), e.source && (e.source = e.source.slice()), e.materialize(xm | Cm);
	},
	addAll() {
		let e = this;
		return !e.source || e.add === e.rem || !e.rem.length && e.source.length === e.add.length ? e : (e = new Em(this.dataflow).init(this), e.add = e.source, e.rem = [], e);
	},
	init(e, t) {
		let n = this;
		return n.stamp = e.stamp, n.encode = e.encode, e.fields && !(t & Tm) && (n.fields = e.fields), t & gm ? (n.addF = e.addF, n.add = e.add) : (n.addF = null, n.add = []), t & _m ? (n.remF = e.remF, n.rem = e.rem) : (n.remF = null, n.rem = []), t & vm ? (n.modF = e.modF, n.mod = e.mod) : (n.modF = null, n.mod = []), t & wm ? (n.srcF = null, n.source = null) : (n.srcF = e.srcF, n.source = e.source, e.cleans && (n.cleans = e.cleans)), n;
	},
	runAfter(e) {
		this.dataflow.runAfter(e);
	},
	changed(e) {
		let t = e || xm;
		return t & gm && this.add.length || t & _m && this.rem.length || t & vm && this.mod.length;
	},
	reflow(e) {
		if (e) return this.fork(xm).reflow();
		let t = this.add.length, n = this.source && this.source.length;
		return n && n !== t && (this.mod = this.source, t && this.filter(vm, Om(this, gm))), this;
	},
	clean(e) {
		return arguments.length ? (this.cleans = !!e, this) : this.cleans;
	},
	modifies(e) {
		let t = this.fields || (this.fields = {});
		return P(e) ? e.forEach((e) => t[e] = !0) : t[e] = !0, this;
	},
	modified(e, t) {
		let n = this.fields;
		return (t || this.mod.length) && n ? arguments.length ? P(e) ? e.some((e) => n[e]) : n[e] : !!n : !1;
	},
	filter(e, t) {
		let n = this;
		return e & gm && (n.addF = km(n.addF, t)), e & _m && (n.remF = km(n.remF, t)), e & vm && (n.modF = km(n.modF, t)), e & Cm && (n.srcF = km(n.srcF, t)), n;
	},
	materialize(e) {
		e = e || xm;
		let t = this;
		return e & gm && t.addF && (t.add = Dm(t.add, t.addF), t.addF = null), e & _m && t.remF && (t.rem = Dm(t.rem, t.remF), t.remF = null), e & vm && t.modF && (t.mod = Dm(t.mod, t.modF), t.modF = null), e & Cm && t.srcF && (t.source = t.source.filter(t.srcF), t.srcF = null), t;
	},
	visit(e, t) {
		let n = this, r = t;
		if (e & Cm) return yd(n.source, n.srcF, r), n;
		e & gm && yd(n.add, n.addF, r), e & _m && yd(n.rem, n.remF, r), e & vm && yd(n.mod, n.modF, r);
		let i = n.source;
		if (e & Sm && i) {
			let e = n.add.length + n.mod.length;
			e === i.length || (e ? yd(i, Om(n, bm), r) : yd(i, n.srcF, r));
		}
		return n;
	}
};
function Am(e, t, n, r) {
	let i = this, a = 0;
	this.dataflow = e, this.stamp = t, this.fields = null, this.encode = r || null, this.pulses = n;
	for (let e of n) if (e.stamp === t) {
		if (e.fields) {
			let t = i.fields || (i.fields = {});
			for (let n in e.fields) t[n] = 1;
		}
		e.changed(i.ADD) && (a |= i.ADD), e.changed(i.REM) && (a |= i.REM), e.changed(i.MOD) && (a |= i.MOD);
	}
	this.changes = a;
}
R(Am, Em, {
	fork(e) {
		let t = new Em(this.dataflow).init(this, e & this.NO_FIELDS);
		return e !== void 0 && (e & t.ADD && this.visit(t.ADD, (e) => t.add.push(e)), e & t.REM && this.visit(t.REM, (e) => t.rem.push(e)), e & t.MOD && this.visit(t.MOD, (e) => t.mod.push(e))), t;
	},
	changed(e) {
		return this.changes & e;
	},
	modified(e) {
		let t = this, n = t.fields;
		return n && t.changes & t.MOD ? P(e) ? e.some((e) => n[e]) : n[e] : 0;
	},
	filter() {
		N("MultiPulse does not support filtering.");
	},
	materialize() {
		N("MultiPulse does not support materialization.");
	},
	visit(e, t) {
		let n = this, r = n.pulses, i = r.length, a = 0;
		if (e & n.SOURCE) for (; a < i; ++a) r[a].visit(e, t);
		else for (; a < i; ++a) r[a].stamp === n.stamp && r[a].visit(e, t);
		return n;
	}
});
async function jm(e, t, n) {
	let r = this, i = [];
	if (r._pulse) return Fm(r);
	if (r._pending && await r._pending, t && await Pp(r, t), !r._touched.length) return r.debug("Dataflow invoked, but nothing to do."), r;
	let a = ++r._clock;
	r._pulse = new Em(r, a, e), r._touched.forEach((e) => r._enqueue(e, !0)), r._touched = Np(au);
	let o = 0, s, c, l;
	try {
		for (; r._heap.size() > 0;) {
			if (s = r._heap.pop(), s.rank !== s.qrank) {
				r._enqueue(s, !0);
				continue;
			}
			c = s.run(r._getPulse(s, e)), c.then ? c = await c : c.async && (i.push(c.async), c = hm), c !== hm && s._targets && s._targets.forEach((e) => r._enqueue(e)), ++o;
		}
	} catch (e) {
		r._heap.clear(), l = e;
	}
	if (r._input = {}, r._pulse = null, r.debug(`Pulse ${a}: ${o} operators`), l && (r._postrun = [], r.error(l)), r._postrun.length) {
		let e = r._postrun.sort((e, t) => t.priority - e.priority);
		r._postrun = [];
		for (let t = 0; t < e.length; ++t) await Pp(r, e[t].callback);
	}
	return n && await Pp(r, n), i.length && Promise.all(i).then((e) => r.runAsync(null, () => {
		e.forEach((e) => {
			try {
				e(r);
			} catch (e) {
				r.error(e);
			}
		});
	})), r;
}
async function Mm(e, t, n) {
	for (; this._running;) await this._running;
	let r = () => this._running = null;
	return (this._running = this.evaluate(e, t, n)).then(r, r), this._running;
}
function Nm(e, t, n) {
	return this._pulse ? Fm(this) : (this.evaluate(e, t, n), this);
}
function Pm(e, t, n) {
	if (this._pulse || t) this._postrun.push({
		priority: n || 0,
		callback: e
	});
	else try {
		e(this);
	} catch (e) {
		this.error(e);
	}
}
function Fm(e) {
	return e.error("Dataflow already running. Use runAsync() to chain invocations."), e;
}
function Eee(e, t) {
	let n = e.stamp < this._clock;
	n && (e.stamp = this._clock), (n || t) && (e.qrank = e.rank, this._heap.push(e));
}
function Dee(e, t) {
	let n = e.source, r = this._clock;
	return n && P(n) ? new Am(this, r, n.map((e) => e.pulse), t) : this._input[e.id] || Oee(this._pulse, n && n.pulse);
}
function Oee(e, t) {
	return t && t.stamp === e.stamp ? t : (e = e.fork(), t && t !== hm && (e.source = t.source), e);
}
var Im = {
	skip: !1,
	force: !1
};
function kee(e, t) {
	let n = t || Im;
	return this._pulse ? this._enqueue(e) : this._touched.add(e), n.skip && e.skip(!0), this;
}
function Aee(e, t, n) {
	let r = n || Im;
	return (e.set(t) || r.force) && this.touch(e, r), this;
}
function jee(e, t, n) {
	this.touch(e, n || Im);
	let r = new Em(this, this._clock + +!this._pulse), i = e.pulse && e.pulse.source || [];
	return r.target = e, this._input[e.id] = t.pulse(r, i), this;
}
function Lm(e) {
	let t = [];
	return {
		clear: () => t = [],
		size: () => t.length,
		peek: () => t[0],
		push: (n) => (t.push(n), Rm(t, 0, t.length - 1, e)),
		pop: () => {
			let n = t.pop(), r;
			return t.length ? (r = t[0], t[0] = n, zm(t, 0, e)) : r = n, r;
		}
	};
}
function Rm(e, t, n, r) {
	let i, a, o = e[n];
	for (; n > t;) {
		if (a = n - 1 >> 1, i = e[a], r(o, i) < 0) {
			e[n] = i, n = a;
			continue;
		}
		break;
	}
	return e[n] = o;
}
function zm(e, t, n) {
	let r = t, i = e.length, a = e[t], o = (t << 1) + 1, s;
	for (; o < i;) s = o + 1, s < i && n(e[o], e[s]) >= 0 && (o = s), e[t] = e[o], t = o, o = (t << 1) + 1;
	return e[t] = a, Rm(e, r, t, n);
}
function Bm() {
	this.logger(pu()), this.logLevel(1), this._clock = 0, this._rank = 0, this._locale = ip();
	try {
		this._loader = Mp();
	} catch {}
	this._touched = Np(au), this._input = {}, this._pulse = null, this._heap = Lm((e, t) => e.qrank - t.qrank), this._postrun = [];
}
function Vm(e) {
	return function() {
		return this._log[e].apply(this, arguments);
	};
}
Bm.prototype = {
	stamp() {
		return this._clock;
	},
	loader(e) {
		return arguments.length ? (this._loader = e, this) : this._loader;
	},
	locale(e) {
		return arguments.length ? (this._locale = e, this) : this._locale;
	},
	logger(e) {
		return arguments.length ? (this._log = e, this) : this._log;
	},
	error: Vm("error"),
	warn: Vm("warn"),
	info: Vm("info"),
	debug: Vm("debug"),
	logLevel: Vm("level"),
	cleanThreshold: 1e4,
	add: $p,
	connect: em,
	rank: pm,
	rerank: mm,
	pulse: jee,
	touch: kee,
	update: Aee,
	changeset: Wp,
	ingest: om,
	parse: am,
	preload: cm,
	request: sm,
	events: im,
	on: wee,
	evaluate: jm,
	run: Nm,
	runAsync: Mm,
	runAfter: Pm,
	_enqueue: Eee,
	_getPulse: Dee
};
function H(e, t) {
	Zp.call(this, e, null, t);
}
R(H, Zp, {
	run(e) {
		if (e.stamp < this.stamp) return e.StopPropagation;
		let t;
		return this.skip() ? this.skip(!1) : t = this.evaluate(e), t = t || e, t.then ? t = t.then((e) => this.pulse = e) : t !== e.StopPropagation && (this.pulse = t), t;
	},
	evaluate(e) {
		let t = this.marshall(e.stamp), n = this.transform(t, e);
		return t.clear(), n;
	},
	transform() {}
});
var Hm = {};
function Um(e) {
	let t = Wm(e);
	return t && t.Definition || null;
}
function Wm(e) {
	return e = e && e.toLowerCase(), L(Hm, e) ? Hm[e] : null;
}
//#endregion
//#region ../../node_modules/.pnpm/vega-statistics@2.0.0/node_modules/vega-statistics/build/vega-statistics.js
function* Gm(e, t) {
	if (t == null) for (let t of e) t != null && t !== "" && (t = +t) >= t && (yield t);
	else {
		let n = -1;
		for (let r of e) r = t(r, ++n, e), r != null && r !== "" && (r = +r) >= r && (yield r);
	}
}
function Km(e, t, n) {
	let r = Float64Array.from(Gm(e, n));
	return r.sort(y), t.map((e) => kt(r, e));
}
function qm(e, t) {
	return Km(e, [
		.25,
		.5,
		.75
	], t);
}
function Jm(e, t) {
	let n = e.length, r = xt(e, t), i = qm(e, t), a = (i[2] - i[0]) / 1.34;
	return 1.06 * (Math.min(r, a) || r || Math.abs(i[0]) || 1) * n ** -.2;
}
function Ym(e) {
	let t = e.maxbins || 20, n = e.base || 10, r = Math.log(n), i = e.divide || [5, 2], a = e.extent[0], o = e.extent[1], s, c, l, u, d, f, p = e.span || o - a || Math.abs(a) || 1;
	if (e.step) s = e.step;
	else if (e.steps) {
		for (u = p / t, d = 0, f = e.steps.length; d < f && e.steps[d] < u; ++d);
		s = e.steps[Math.max(0, d - 1)];
	} else {
		for (c = Math.ceil(Math.log(t) / r), l = e.minstep || 0, s = Math.max(l, n ** +(Math.round(Math.log(p) / r) - c)); Math.ceil(p / s) > t;) s *= n;
		for (d = 0, f = i.length; d < f; ++d) u = s / i[d], u >= l && p / u <= t && (s = u);
	}
	u = Math.log(s);
	let m = n ** (-(u >= 0 ? 0 : ~~(-u / r) + 1) - 1);
	return (e.nice || e.nice === void 0) && (u = Math.floor(a / s + m) * s, a = a < u ? u - s : u, o = Math.ceil(o / s) * s), {
		start: a,
		stop: o === a ? a + s : o,
		step: s
	};
}
var Xm = Math.random;
function Zm(e) {
	Xm = e;
}
function Qm(e, t, n, r) {
	if (!e.length) return [void 0, void 0];
	let i = Float64Array.from(Gm(e, r)), a = i.length, o = t, s, c, l, u;
	for (l = 0, u = Array(o); l < o; ++l) {
		for (s = 0, c = 0; c < a; ++c) s += i[~~(Xm() * a)];
		u[l] = s / a;
	}
	return u.sort(y), [Ot(u, n / 2), Ot(u, 1 - n / 2)];
}
function $m(e, t, n, r) {
	r = r || ((e) => e);
	let i = e.length, a = new Float64Array(i), o = 0, s = 1, c = r(e[0]), l = c, u = c + t, d;
	for (; s < i; ++s) {
		if (d = r(e[s]), d >= u) {
			for (l = (c + l) / 2; o < s; ++o) a[o] = l;
			u = d + t, c = d;
		}
		l = d;
	}
	for (l = (c + l) / 2; o < s; ++o) a[o] = l;
	return n ? eh(a, t + t / 4) : a;
}
function eh(e, t) {
	let n = e.length, r = 0, i = 1, a, o;
	for (; e[r] === e[i];) ++i;
	for (; i < n;) {
		for (a = i + 1; e[i] === e[a];) ++a;
		if (e[i] - e[i - 1] < t) {
			for (o = i + (r + a - i - i >> 1); o < i;) e[o++] = e[i];
			for (; o > i;) e[o--] = e[r];
		}
		r = i, i = a;
	}
	return e;
}
function th(e) {
	return function() {
		return e = (1103515245 * e + 12345) % 2147483647, e / 2147483647;
	};
}
function nh(e, t) {
	t == null && (t = e, e = 0);
	let n, r, i, a = {
		min(e) {
			return arguments.length ? (n = e || 0, i = r - n, a) : n;
		},
		max(e) {
			return arguments.length ? (r = e || 0, i = r - n, a) : r;
		},
		sample() {
			return n + Math.floor(i * Xm());
		},
		pdf(e) {
			return e === Math.floor(e) && e >= n && e < r ? 1 / i : 0;
		},
		cdf(e) {
			let t = Math.floor(e);
			return t < n ? 0 : t >= r ? 1 : (t - n + 1) / i;
		},
		icdf(e) {
			return e >= 0 && e <= 1 ? n - 1 + Math.floor(e * i) : NaN;
		}
	};
	return a.min(e).max(t);
}
var rh = Math.sqrt(2 * Math.PI), ih = Math.SQRT2, ah = NaN;
function oh(e, t) {
	e = e || 0, t = t == null ? 1 : t;
	let n = 0, r = 0, i, a;
	if (ah === ah) n = ah, ah = NaN;
	else {
		do
			n = Xm() * 2 - 1, r = Xm() * 2 - 1, i = n * n + r * r;
		while (i === 0 || i > 1);
		a = Math.sqrt(-2 * Math.log(i) / i), n *= a, ah = r * a;
	}
	return e + n * t;
}
function sh(e, t, n) {
	n = n == null ? 1 : n;
	let r = (e - (t || 0)) / n;
	return Math.exp(-.5 * r * r) / (n * rh);
}
function ch(e, t, n) {
	t = t || 0, n = n == null ? 1 : n;
	let r = (e - t) / n, i = Math.abs(r), a;
	if (i > 37) a = 0;
	else {
		let e = Math.exp(-i * i / 2), t;
		i < 7.07106781186547 ? (t = .0352624965998911 * i + .700383064443688, t = t * i + 6.37396220353165, t = t * i + 33.912866078383, t = t * i + 112.079291497871, t = t * i + 221.213596169931, t = t * i + 220.206867912376, a = e * t, t = .0883883476483184 * i + 1.75566716318264, t = t * i + 16.064177579207, t = t * i + 86.7807322029461, t = t * i + 296.564248779674, t = t * i + 637.333633378831, t = t * i + 793.826512519948, t = t * i + 440.413735824752, a /= t) : (t = i + .65, t = i + 4 / t, t = i + 3 / t, t = i + 2 / t, t = i + 1 / t, a = e / t / 2.506628274631);
	}
	return r > 0 ? 1 - a : a;
}
function lh(e, t, n) {
	return e < 0 || e > 1 ? NaN : (t || 0) + (n == null ? 1 : n) * ih * uh(2 * e - 1);
}
function uh(e) {
	let t = -Math.log((1 - e) * (1 + e)), n;
	return t < 6.25 ? (t -= 3.125, n = -364441206401782e-35, n = -16850591381820166e-35 + n * t, n = 128584807152564e-32 + n * t, n = 11157877678025181e-33 + n * t, n = -1333171662854621e-31 + n * t, n = 20972767875968562e-33 + n * t, n = 6637638134358324e-30 + n * t, n = -4054566272975207e-29 + n * t, n = -8151934197605472e-29 + n * t, n = 26335093153082323e-28 + n * t, n = -12975133253453532e-27 + n * t, n = -5415412054294628e-26 + n * t, n = 1.0512122733215323e-9 + n * t, n = -4.112633980346984e-9 + n * t, n = -2.9070369957882005e-8 + n * t, n = 4.2347877827932404e-7 + n * t, n = -13654692000834679e-22 + n * t, n = -13882523362786469e-21 + n * t, n = .00018673420803405714 + n * t, n = -.000740702534166267 + n * t, n = -.006033670871430149 + n * t, n = .24015818242558962 + n * t, n = 1.6536545626831027 + n * t) : t < 16 ? (t = Math.sqrt(t) - 3.25, n = 2.2137376921775787e-9, n = 9.075656193888539e-8 + n * t, n = -2.7517406297064545e-7 + n * t, n = 1.8239629214389228e-8 + n * t, n = 15027403968909828e-22 + n * t, n = -4013867526981546e-21 + n * t, n = 29234449089955446e-22 + n * t, n = 12475304481671779e-21 + n * t, n = -47318229009055734e-21 + n * t, n = 6828485145957318e-20 + n * t, n = 24031110387097894e-21 + n * t, n = -.0003550375203628475 + n * t, n = .0009532893797373805 + n * t, n = -.0016882755560235047 + n * t, n = .002491442096107851 + n * t, n = -.003751208507569241 + n * t, n = .005370914553590064 + n * t, n = 1.0052589676941592 + n * t, n = 3.0838856104922208 + n * t) : Number.isFinite(t) ? (t = Math.sqrt(t) - 5, n = -27109920616438573e-27, n = -2555641816996525e-25 + n * t, n = 1.5076572693500548e-9 + n * t, n = -3.789465440126737e-9 + n * t, n = 7.61570120807834e-9 + n * t, n = -1.496002662714924e-8 + n * t, n = 2.914795345090108e-8 + n * t, n = -6.771199775845234e-8 + n * t, n = 2.2900482228026655e-7 + n * t, n = -9.9298272942317e-7 + n * t, n = 4526062597223154e-21 + n * t, n = -1968177810553167e-20 + n * t, n = 7599527703001776e-20 + n * t, n = -.00021503011930044477 + n * t, n = -.00013871931833623122 + n * t, n = 1.0103004648645344 + n * t, n = 4.849906401408584 + n * t) : n = Infinity, n * e;
}
function dh(e, t) {
	let n, r, i = {
		mean(e) {
			return arguments.length ? (n = e || 0, i) : n;
		},
		stdev(e) {
			return arguments.length ? (r = e == null ? 1 : e, i) : r;
		},
		sample: () => oh(n, r),
		pdf: (e) => sh(e, n, r),
		cdf: (e) => ch(e, n, r),
		icdf: (e) => lh(e, n, r)
	};
	return i.mean(e).stdev(t);
}
function fh(e, t) {
	let n = dh(), r = 0, i = {
		data(n) {
			return arguments.length ? (e = n, r = n ? n.length : 0, i.bandwidth(t)) : e;
		},
		bandwidth(n) {
			return arguments.length ? (t = n, !t && e && (t = Jm(e)), i) : t;
		},
		sample() {
			return e[~~(Xm() * r)] + t * n.sample();
		},
		pdf(i) {
			let a = 0, o = 0;
			for (; o < r; ++o) a += n.pdf((i - e[o]) / t);
			return a / t / r;
		},
		cdf(i) {
			let a = 0, o = 0;
			for (; o < r; ++o) a += n.cdf((i - e[o]) / t);
			return a / r;
		},
		icdf() {
			throw Error("KDE icdf not supported.");
		}
	};
	return i.data(e);
}
function ph(e, t) {
	return e = e || 0, t = t == null ? 1 : t, Math.exp(e + oh() * t);
}
function mh(e, t, n) {
	if (e <= 0) return 0;
	t = t || 0, n = n == null ? 1 : n;
	let r = (Math.log(e) - t) / n;
	return Math.exp(-.5 * r * r) / (n * rh * e);
}
function hh(e, t, n) {
	return ch(Math.log(e), t, n);
}
function gh(e, t, n) {
	return Math.exp(lh(e, t, n));
}
function _h(e, t) {
	let n, r, i = {
		mean(e) {
			return arguments.length ? (n = e || 0, i) : n;
		},
		stdev(e) {
			return arguments.length ? (r = e == null ? 1 : e, i) : r;
		},
		sample: () => ph(n, r),
		pdf: (e) => mh(e, n, r),
		cdf: (e) => hh(e, n, r),
		icdf: (e) => gh(e, n, r)
	};
	return i.mean(e).stdev(t);
}
function vh(e, t) {
	let n = 0, r;
	function i(e) {
		let t = [], r = 0, i;
		for (i = 0; i < n; ++i) r += t[i] = e[i] == null ? 1 : +e[i];
		for (i = 0; i < n; ++i) t[i] /= r;
		return t;
	}
	let a = {
		weights(e) {
			return arguments.length ? (r = i(t = e || []), a) : t;
		},
		distributions(r) {
			return arguments.length ? (r ? (n = r.length, e = r) : (n = 0, e = []), a.weights(t)) : e;
		},
		sample() {
			let t = Xm(), i = e[n - 1], a = r[0], o = 0;
			for (; o < n - 1; a += r[++o]) if (t < a) {
				i = e[o];
				break;
			}
			return i.sample();
		},
		pdf(t) {
			let i = 0, a = 0;
			for (; a < n; ++a) i += r[a] * e[a].pdf(t);
			return i;
		},
		cdf(t) {
			let i = 0, a = 0;
			for (; a < n; ++a) i += r[a] * e[a].cdf(t);
			return i;
		},
		icdf() {
			throw Error("Mixture icdf not supported.");
		}
	};
	return a.distributions(e).weights(t);
}
function yh(e, t) {
	return t == null && (t = e == null ? 1 : e, e = 0), e + (t - e) * Xm();
}
function bh(e, t, n) {
	return n == null && (n = t == null ? 1 : t, t = 0), e >= t && e <= n ? 1 / (n - t) : 0;
}
function xh(e, t, n) {
	return n == null && (n = t == null ? 1 : t, t = 0), e < t ? 0 : e > n ? 1 : (e - t) / (n - t);
}
function Sh(e, t, n) {
	return n == null && (n = t == null ? 1 : t, t = 0), e >= 0 && e <= 1 ? t + e * (n - t) : NaN;
}
function Ch(e, t) {
	let n, r, i = {
		min(e) {
			return arguments.length ? (n = e || 0, i) : n;
		},
		max(e) {
			return arguments.length ? (r = e == null ? 1 : e, i) : r;
		},
		sample: () => yh(n, r),
		pdf: (e) => bh(e, n, r),
		cdf: (e) => xh(e, n, r),
		icdf: (e) => Sh(e, n, r)
	};
	return t == null && (t = e == null ? 1 : e, e = 0), i.min(e).max(t);
}
function wh(e, t, n) {
	let r = 0, i = 0;
	for (let a of e) {
		let e = n(a);
		t(a) == null || e == null || isNaN(e) || (r += (e - r) / ++i);
	}
	return {
		coef: [r],
		predict: () => r,
		rSquared: 0
	};
}
function Th(e, t, n, r) {
	let i = r - e * e, a = Math.abs(i) < 1e-24 ? 0 : (n - e * t) / i;
	return [t - a * e, a];
}
function Eh(e, t, n, r) {
	e = e.filter((e) => {
		let r = t(e), i = n(e);
		return r != null && (r = +r) >= r && i != null && (i = +i) >= i;
	}), r && e.sort((e, n) => t(e) - t(n));
	let i = e.length, a = new Float64Array(i), o = new Float64Array(i), s = 0, c = 0, l = 0, u, d, f;
	for (f of e) a[s] = u = +t(f), o[s] = d = +n(f), ++s, c += (u - c) / s, l += (d - l) / s;
	for (s = 0; s < i; ++s) a[s] -= c, o[s] -= l;
	return [
		a,
		o,
		c,
		l
	];
}
function Dh(e, t, n, r) {
	let i = -1, a, o;
	for (let s of e) a = t(s), o = n(s), a != null && (a = +a) >= a && o != null && (o = +o) >= o && r(a, o, ++i);
}
function Oh(e, t, n, r, i) {
	let a = 0, o = 0;
	return Dh(e, t, n, (e, t) => {
		let n = t - i(e), s = t - r;
		a += n * n, o += s * s;
	}), 1 - a / o;
}
function kh(e, t, n) {
	let r = 0, i = 0, a = 0, o = 0, s = 0;
	Dh(e, t, n, (e, t) => {
		++s, r += (e - r) / s, i += (t - i) / s, a += (e * t - a) / s, o += (e * e - o) / s;
	});
	let c = Th(r, i, a, o), l = (e) => c[0] + c[1] * e;
	return {
		coef: c,
		predict: l,
		rSquared: Oh(e, t, n, i, l)
	};
}
function Ah(e, t, n) {
	let r = 0, i = 0, a = 0, o = 0, s = 0;
	Dh(e, t, n, (e, t) => {
		++s, e = Math.log(e), r += (e - r) / s, i += (t - i) / s, a += (e * t - a) / s, o += (e * e - o) / s;
	});
	let c = Th(r, i, a, o), l = (e) => c[0] + c[1] * Math.log(e);
	return {
		coef: c,
		predict: l,
		rSquared: Oh(e, t, n, i, l)
	};
}
function jh(e, t, n) {
	let [r, i, a, o] = Eh(e, t, n), s = 0, c = 0, l = 0, u = 0, d = 0, f, p, m;
	Dh(e, t, n, (e, t) => {
		f = r[d++], p = Math.log(t), m = f * t, s += (t * p - s) / d, c += (m - c) / d, l += (m * p - l) / d, u += (f * m - u) / d;
	});
	let [h, g] = Th(c / o, s / o, l / o, u / o), _ = (e) => Math.exp(h + g * (e - a));
	return {
		coef: [Math.exp(h - g * a), g],
		predict: _,
		rSquared: Oh(e, t, n, o, _)
	};
}
function Mh(e, t, n) {
	let r = 0, i = 0, a = 0, o = 0, s = 0, c = 0;
	Dh(e, t, n, (e, t) => {
		let n = Math.log(e), l = Math.log(t);
		++c, r += (n - r) / c, i += (l - i) / c, a += (n * l - a) / c, o += (n * n - o) / c, s += (t - s) / c;
	});
	let l = Th(r, i, a, o), u = (e) => l[0] * e ** +l[1];
	return l[0] = Math.exp(l[0]), {
		coef: l,
		predict: u,
		rSquared: Oh(e, t, n, s, u)
	};
}
function Nh(e, t, n) {
	let [r, i, a, o] = Eh(e, t, n), s = r.length, c = 0, l = 0, u = 0, d = 0, f = 0, p, m, h, g;
	for (p = 0; p < s;) m = r[p], h = i[p++], g = m * m, c += (g - c) / p, l += (g * m - l) / p, u += (g * g - u) / p, d += (m * h - d) / p, f += (g * h - f) / p;
	let _ = u - c * c, v = c * _ - l * l, y = (f * c - d * l) / v, b = (d * _ - f * l) / v, x = -y * c, S = (e) => (e -= a, y * e * e + b * e + x + o);
	return {
		coef: [
			x - b * a + y * a * a + o,
			b - 2 * y * a,
			y
		],
		predict: S,
		rSquared: Oh(e, t, n, o, S)
	};
}
function Ph(e, t, n, r) {
	if (r === 0) return wh(e, t, n);
	if (r === 1) return kh(e, t, n);
	if (r === 2) return Nh(e, t, n);
	let [i, a, o, s] = Eh(e, t, n), c = i.length, l = [], u = [], d = r + 1, f, p, m, h, g;
	for (f = 0; f < d; ++f) {
		for (m = 0, h = 0; m < c; ++m) h += i[m] ** +f * a[m];
		for (l.push(h), g = new Float64Array(d), p = 0; p < d; ++p) {
			for (m = 0, h = 0; m < c; ++m) h += i[m] ** +(f + p);
			g[p] = h;
		}
		u.push(g);
	}
	u.push(l);
	let _ = Ih(u), v = (e) => {
		e -= o;
		let t = s + _[0] + _[1] * e + _[2] * e * e;
		for (f = 3; f < d; ++f) t += _[f] * e ** +f;
		return t;
	};
	return {
		coef: Fh(d, _, -o, s),
		predict: v,
		rSquared: Oh(e, t, n, s, v)
	};
}
function Fh(e, t, n, r) {
	let i = Array(e), a, o, s, c;
	for (a = 0; a < e; ++a) i[a] = 0;
	for (a = e - 1; a >= 0; --a) for (s = t[a], c = 1, i[a] += s, o = 1; o <= a; ++o) c *= (a + 1 - o) / o, i[a - o] += s * n ** +o * c;
	return i[0] += r, i;
}
function Ih(e) {
	let t = e.length - 1, n = [], r, i, a, o, s;
	for (r = 0; r < t; ++r) {
		for (o = r, i = r + 1; i < t; ++i) Math.abs(e[r][i]) > Math.abs(e[r][o]) && (o = i);
		for (a = r; a < t + 1; ++a) s = e[a][r], e[a][r] = e[a][o], e[a][o] = s;
		for (i = r + 1; i < t; ++i) for (a = t; a >= r; a--) e[a][i] -= e[a][r] * e[r][i] / e[r][r];
	}
	for (i = t - 1; i >= 0; --i) {
		for (s = 0, a = i + 1; a < t; ++a) s += e[a][i] * n[a];
		n[i] = (e[t][i] - s) / e[i][i];
	}
	return n;
}
var Lh = 2, Rh = 1e-12;
function zh(e, t, n, r) {
	let [i, a, o, s] = Eh(e, t, n, !0), c = i.length, l = Math.max(2, ~~(r * c)), u = new Float64Array(c), d = new Float64Array(c), f = new Float64Array(c).fill(1);
	for (let e = -1; ++e <= Lh;) {
		let t = [0, l - 1];
		for (let e = 0; e < c; ++e) {
			let n = i[e], r = t[0], o = t[1], s = n - i[r] > i[o] - n ? r : o, c = 0, l = 0, p = 0, m = 0, h = 0, g = 1 / Math.abs(i[s] - n || 1);
			for (let e = r; e <= o; ++e) {
				let t = i[e], r = a[e], o = Bh(Math.abs(n - t) * g) * f[e], s = t * o;
				c += o, l += s, p += r * o, m += r * s, h += t * s;
			}
			let [_, v] = Th(l / c, p / c, m / c, h / c);
			u[e] = _ + v * n, d[e] = Math.abs(a[e] - u[e]), Vh(i, e + 1, t);
		}
		if (e === Lh) break;
		let n = jt(d);
		if (Math.abs(n) < Rh) break;
		for (let e = 0, t, r; e < c; ++e) t = d[e] / (6 * n), f[e] = t >= 1 ? Rh : (r = 1 - t * t) * r;
	}
	return Hh(i, u, o, s);
}
function Bh(e) {
	return (e = 1 - e * e * e) * e * e;
}
function Vh(e, t, n) {
	let r = e[t], i = n[0], a = n[1] + 1;
	if (!(a >= e.length)) for (; t > i && e[a] - r <= r - e[i];) n[0] = ++i, n[1] = a, ++a;
}
function Hh(e, t, n, r) {
	let i = e.length, a = [], o = 0, s = 0, c = [], l;
	for (; o < i; ++o) l = e[o] + n, c[0] === l ? c[1] += (t[o] - c[1]) / ++s : (s = 0, c[1] += r, c = [l, t[o]], a.push(c));
	return c[1] += r, a;
}
var Uh = .5 * Math.PI / 180;
function Wh(e, t, n, r) {
	n = n || 25, r = Math.max(n, r || 200);
	let i = (t) => [t, e(t)], a = t[0], o = t[1], s = o - a, c = s / r, l = [i(a)], u = [];
	if (n === r) {
		for (let e = 1; e < r; ++e) l.push(i(a + e / n * s));
		return l.push(i(o)), l;
	} else {
		u.push(i(o));
		for (let e = n; --e > 0;) u.push(i(a + e / n * s));
	}
	let d = l[0], f = u[u.length - 1], p = 1 / s, m = Gh(d[1], u);
	for (; f;) {
		let e = i((d[0] + f[0]) / 2);
		e[0] - d[0] >= c && Kh(d, e, f, p, m) > Uh ? u.push(e) : (d = f, l.push(f), u.pop()), f = u[u.length - 1];
	}
	return l;
}
function Gh(e, t) {
	let n = e, r = e, i = t.length;
	for (let e = 0; e < i; ++e) {
		let i = t[e][1];
		i < n && (n = i), i > r && (r = i);
	}
	return 1 / (r - n);
}
function Kh(e, t, n, r, i) {
	let a = Math.atan2(i * (n[1] - e[1]), r * (n[0] - e[0])), o = Math.atan2(i * (t[1] - e[1]), r * (t[0] - e[0]));
	return Math.abs(a - o);
}
//#endregion
//#region ../../node_modules/.pnpm/vega-transforms@5.1.0/node_modules/vega-transforms/build/vega-transforms.js
var qh = /* @__PURE__ */ t({
	aggregate: () => fg,
	bin: () => mg,
	collect: () => gg,
	compare: () => _g,
	countpattern: () => yg,
	cross: () => xg,
	density: () => Og,
	dotbin: () => Fg,
	expression: () => Lg,
	extent: () => zg,
	facet: () => Vg,
	field: () => Hg,
	filter: () => Ug,
	flatten: () => Wg,
	fold: () => Gg,
	formula: () => Kg,
	generate: () => qg,
	impute: () => Yg,
	joinaggregate: () => $g,
	kde: () => e_,
	key: () => t_,
	load: () => r_,
	lookup: () => o_,
	multiextent: () => s_,
	multivalues: () => l_,
	params: () => d_,
	pivot: () => f_,
	prefacet: () => g_,
	project: () => __,
	proxy: () => y_,
	quantile: () => b_,
	relay: () => S_,
	sample: () => C_,
	sequence: () => w_,
	sieve: () => T_,
	subflow: () => Bg,
	timeunit: () => E_,
	tupleindex: () => O_,
	values: () => k_,
	window: () => L_
});
function Jh(e) {
	return (t) => {
		let n = e.length, r = 1, i = String(e[0](t));
		for (; r < n; ++r) i += "|" + e[r](t);
		return i;
	};
}
function Yh(e) {
	return !e || !e.length ? function() {
		return "";
	} : e.length === 1 ? e[0] : Jh(e);
}
function Xh(e, t, n) {
	return n || e + (t ? "_" + t : "");
}
var Zh = () => {}, Qh = {
	init: Zh,
	add: Zh,
	rem: Zh,
	idx: 0
}, $h = {
	values: {
		init: (e) => e.cell.store = !0,
		value: (e) => e.cell.data.values(),
		idx: -1
	},
	count: { value: (e) => e.cell.num },
	__count__: { value: (e) => e.missing + e.valid },
	missing: { value: (e) => e.missing },
	valid: { value: (e) => e.valid },
	sum: {
		init: (e) => e.sum = 0,
		value: (e) => e.valid ? e.sum : void 0,
		add: (e, t) => e.sum += +t,
		rem: (e, t) => e.sum -= t
	},
	product: {
		init: (e) => e.product = 1,
		value: (e) => e.valid ? e.product : void 0,
		add: (e, t) => e.product *= t,
		rem: (e, t) => e.product /= t
	},
	mean: {
		init: (e) => e.mean = 0,
		value: (e) => e.valid ? e.mean : void 0,
		add: (e, t) => (e.mean_d = t - e.mean, e.mean += e.mean_d / e.valid),
		rem: (e, t) => (e.mean_d = t - e.mean, e.mean -= e.valid ? e.mean_d / e.valid : e.mean)
	},
	average: {
		value: (e) => e.valid ? e.mean : void 0,
		req: ["mean"],
		idx: 1
	},
	variance: {
		init: (e) => e.dev = 0,
		value: (e) => e.valid > 1 ? e.dev / (e.valid - 1) : void 0,
		add: (e, t) => e.dev += e.mean_d * (t - e.mean),
		rem: (e, t) => e.dev -= e.mean_d * (t - e.mean),
		req: ["mean"],
		idx: 1
	},
	variancep: {
		value: (e) => e.valid > 1 ? e.dev / e.valid : void 0,
		req: ["variance"],
		idx: 2
	},
	stdev: {
		value: (e) => e.valid > 1 ? Math.sqrt(e.dev / (e.valid - 1)) : void 0,
		req: ["variance"],
		idx: 2
	},
	stdevp: {
		value: (e) => e.valid > 1 ? Math.sqrt(e.dev / e.valid) : void 0,
		req: ["variance"],
		idx: 2
	},
	stderr: {
		value: (e) => e.valid > 1 ? Math.sqrt(e.dev / (e.valid * (e.valid - 1))) : void 0,
		req: ["variance"],
		idx: 2
	},
	distinct: {
		value: (e) => e.cell.data.distinct(e.get),
		req: ["values"],
		idx: 3
	},
	ci0: {
		value: (e) => e.cell.data.ci0(e.get),
		req: ["values"],
		idx: 3
	},
	ci1: {
		value: (e) => e.cell.data.ci1(e.get),
		req: ["values"],
		idx: 3
	},
	median: {
		value: (e) => e.cell.data.q2(e.get),
		req: ["values"],
		idx: 3
	},
	q1: {
		value: (e) => e.cell.data.q1(e.get),
		req: ["values"],
		idx: 3
	},
	q3: {
		value: (e) => e.cell.data.q3(e.get),
		req: ["values"],
		idx: 3
	},
	min: {
		init: (e) => e.min = void 0,
		value: (e) => e.min = Number.isNaN(e.min) ? e.cell.data.min(e.get) : e.min,
		add: (e, t) => {
			(t < e.min || e.min === void 0) && (e.min = t);
		},
		rem: (e, t) => {
			t <= e.min && (e.min = NaN);
		},
		req: ["values"],
		idx: 4
	},
	max: {
		init: (e) => e.max = void 0,
		value: (e) => e.max = Number.isNaN(e.max) ? e.cell.data.max(e.get) : e.max,
		add: (e, t) => {
			(t > e.max || e.max === void 0) && (e.max = t);
		},
		rem: (e, t) => {
			t >= e.max && (e.max = NaN);
		},
		req: ["values"],
		idx: 4
	},
	argmin: {
		init: (e) => e.argmin = void 0,
		value: (e) => e.argmin || e.cell.data.argmin(e.get),
		add: (e, t, n) => {
			t < e.min && (e.argmin = n);
		},
		rem: (e, t) => {
			t <= e.min && (e.argmin = void 0);
		},
		req: ["min", "values"],
		idx: 3
	},
	argmax: {
		init: (e) => e.argmax = void 0,
		value: (e) => e.argmax || e.cell.data.argmax(e.get),
		add: (e, t, n) => {
			t > e.max && (e.argmax = n);
		},
		rem: (e, t) => {
			t >= e.max && (e.argmax = void 0);
		},
		req: ["max", "values"],
		idx: 3
	},
	exponential: {
		init: (e, t) => {
			e.exp = 0, e.exp_r = t;
		},
		value: (e) => e.valid ? e.exp * (1 - e.exp_r) / (1 - e.exp_r ** e.valid) : void 0,
		add: (e, t) => e.exp = e.exp_r * e.exp + t,
		rem: (e, t) => e.exp = (e.exp - t / e.exp_r ** (e.valid - 1)) / e.exp_r
	},
	exponentialb: {
		value: (e) => e.valid ? e.exp * (1 - e.exp_r) : void 0,
		req: ["exponential"],
		idx: 1
	}
}, eg = Object.keys($h).filter((e) => e !== "__count__");
function tg(e, t) {
	return (n, r) => qu({
		name: e,
		aggregate_param: r,
		out: n || e
	}, Qh, t);
}
[...eg, "__count__"].forEach((e) => {
	$h[e] = tg(e, $h[e]);
});
function ng(e, t, n) {
	return $h[e](n, t);
}
function rg(e, t) {
	return e.idx - t.idx;
}
function ig(e) {
	let t = {};
	e.forEach((e) => t[e.name] = e);
	let n = (e) => {
		e.req && e.req.forEach((e) => {
			t[e] || n(t[e] = $h[e]());
		});
	};
	return e.forEach(n), Object.values(t).sort(rg);
}
function ag() {
	this.valid = 0, this.missing = 0, this._ops.forEach((e) => e.aggregate_param == null ? e.init(this) : e.init(this, e.aggregate_param));
}
function og(e, t) {
	if (e == null || e === "") {
		++this.missing;
		return;
	}
	e === e && (++this.valid, this._ops.forEach((n) => n.add(this, e, t)));
}
function sg(e, t) {
	if (e == null || e === "") {
		--this.missing;
		return;
	}
	e === e && (--this.valid, this._ops.forEach((n) => n.rem(this, e, t)));
}
function cg(e) {
	return this._out.forEach((t) => e[t.out] = t.value(this)), e;
}
function lg(e, t) {
	let n = t || ou, r = ig(e), i = e.slice().sort(rg);
	function a(e) {
		this._ops = r, this._out = i, this.cell = e, this.init();
	}
	return a.prototype.init = ag, a.prototype.add = og, a.prototype.rem = sg, a.prototype.set = cg, a.prototype.get = n, a.fields = e.map((e) => e.out), a;
}
function ug(e) {
	this._key = e ? iu(e) : V, this.reset();
}
var dg = ug.prototype;
dg.reset = function() {
	this._add = [], this._rem = [], this._ext = null, this._get = null, this._q = null;
}, dg.add = function(e) {
	this._add.push(e);
}, dg.rem = function(e) {
	this._rem.push(e);
}, dg.values = function() {
	if (this._get = null, this._rem.length === 0) return this._add;
	let e = this._add, t = this._rem, n = this._key, r = e.length, i = t.length, a = Array(r - i), o = {}, s, c, l;
	for (s = 0; s < i; ++s) o[n(t[s])] = 1;
	for (s = 0, c = 0; s < r; ++s) o[n(l = e[s])] ? o[n(l)] = 0 : a[c++] = l;
	return this._rem = [], this._add = a;
}, dg.distinct = function(e) {
	let t = this.values(), n = {}, r = t.length, i = 0, a;
	for (; --r >= 0;) a = e(t[r]) + "", L(n, a) || (n[a] = 1, ++i);
	return i;
}, dg.extent = function(e) {
	if (this._get !== e || !this._ext) {
		let t = this.values(), n = Yu(t, e);
		this._ext = [t[n[0]], t[n[1]]], this._get = e;
	}
	return this._ext;
}, dg.argmin = function(e) {
	return this.extent(e)[0] || {};
}, dg.argmax = function(e) {
	return this.extent(e)[1] || {};
}, dg.min = function(e) {
	let t = this.extent(e)[0];
	return t == null ? void 0 : e(t);
}, dg.max = function(e) {
	let t = this.extent(e)[1];
	return t == null ? void 0 : e(t);
}, dg.quartile = function(e) {
	return (this._get !== e || !this._q) && (this._q = qm(this.values(), e), this._get = e), this._q;
}, dg.q1 = function(e) {
	return this.quartile(e)[0];
}, dg.q2 = function(e) {
	return this.quartile(e)[1];
}, dg.q3 = function(e) {
	return this.quartile(e)[2];
}, dg.ci = function(e) {
	return (this._get !== e || !this._ci) && (this._ci = Qm(this.values(), 1e3, .05, e), this._get = e), this._ci;
}, dg.ci0 = function(e) {
	return this.ci(e)[0];
}, dg.ci1 = function(e) {
	return this.ci(e)[1];
};
function fg(e) {
	H.call(this, null, e), this._adds = [], this._mods = [], this._alen = 0, this._mlen = 0, this._drop = !0, this._cross = !1, this._dims = [], this._dnames = [], this._measures = [], this._countOnly = !1, this._counts = null, this._prev = null, this._inputs = null, this._outputs = null;
}
fg.Definition = {
	type: "Aggregate",
	metadata: {
		generates: !0,
		changes: !0
	},
	params: [
		{
			name: "groupby",
			type: "field",
			array: !0
		},
		{
			name: "ops",
			type: "enum",
			array: !0,
			values: eg
		},
		{
			name: "aggregate_params",
			type: "number",
			null: !0,
			array: !0
		},
		{
			name: "fields",
			type: "field",
			null: !0,
			array: !0
		},
		{
			name: "as",
			type: "string",
			null: !0,
			array: !0
		},
		{
			name: "drop",
			type: "boolean",
			default: !0
		},
		{
			name: "cross",
			type: "boolean",
			default: !1
		},
		{
			name: "key",
			type: "field"
		}
	]
}, R(fg, H, {
	transform(e, t) {
		let n = this, r = t.fork(t.NO_SOURCE | t.NO_FIELDS), i = e.modified();
		return n.stamp = r.stamp, n.value && (i || t.modified(n._inputs, !0)) ? (n._prev = n.value, n.value = i ? n.init(e) : Object.create(null), t.visit(t.SOURCE, (e) => n.add(e))) : (n.value = n.value || n.init(e), t.visit(t.REM, (e) => n.rem(e)), t.visit(t.ADD, (e) => n.add(e))), r.modifies(n._outputs), n._drop = e.drop !== !1, e.cross && n._dims.length > 1 && (n._drop = !1, n.cross()), t.clean() && n._drop && r.clean(!0).runAfter(() => this.clean()), n.changes(r);
	},
	cross() {
		let e = this, t = e.value, n = e._dnames, r = n.map(() => ({})), i = n.length;
		function a(e) {
			let t, a, o, s;
			for (t in e) for (o = e[t].tuple, a = 0; a < i; ++a) r[a][s = o[n[a]]] = s;
		}
		a(e._prev), a(t);
		function o(a, s, c) {
			let l = n[c], u = r[c++];
			for (let n in u) {
				let r = a ? a + "|" + n : n;
				s[l] = u[n], c < i ? o(r, s, c) : t[r] || e.cell(r, s);
			}
		}
		o("", {}, 0);
	},
	init(e) {
		let t = this._inputs = [], n = this._outputs = [], r = {};
		function i(e) {
			let n = I($l(e)), i = n.length, a = 0, o;
			for (; a < i; ++a) r[o = n[a]] || (r[o] = 1, t.push(o));
		}
		this._dims = I(e.groupby), this._dnames = this._dims.map((e) => {
			let t = Ql(e);
			return i(e), n.push(t), t;
		}), this.cellkey = e.key ? e.key : Yh(this._dims), this._countOnly = !0, this._counts = [], this._measures = [];
		let a = e.fields || [null], o = e.ops || ["count"], s = e.aggregate_params || [null], c = e.as || [], l = a.length, u = {}, d, f, p, m, h, g, _;
		for (l !== o.length && N("Unmatched number of fields and aggregate ops."), _ = 0; _ < l; ++_) {
			if (d = a[_], f = o[_], p = s[_] || null, d == null && f !== "count" && N("Null aggregate field specified."), h = Ql(d), g = Xh(f, h, c[_]), n.push(g), f === "count") {
				this._counts.push(g);
				continue;
			}
			m = u[h], m || (i(d), m = u[h] = [], m.field = d, this._measures.push(m)), f !== "count" && (this._countOnly = !1), m.push(ng(f, p, g));
		}
		return this._measures = this._measures.map((e) => lg(e, e.field)), Object.create(null);
	},
	cellkey: Yh(),
	cell(e, t) {
		let n = this.value[e];
		return n ? n.num === 0 && this._drop && n.stamp < this.stamp ? (n.stamp = this.stamp, this._adds[this._alen++] = n) : n.stamp < this.stamp && (n.stamp = this.stamp, this._mods[this._mlen++] = n) : (n = this.value[e] = this.newcell(e, t), this._adds[this._alen++] = n), n;
	},
	newcell(e, t) {
		let n = {
			key: e,
			num: 0,
			agg: null,
			tuple: this.newtuple(t, this._prev && this._prev[e]),
			stamp: this.stamp,
			store: !1
		};
		if (!this._countOnly) {
			let e = this._measures, t = e.length;
			n.agg = Array(t);
			for (let r = 0; r < t; ++r) n.agg[r] = new e[r](n);
		}
		return n.store && (n.data = new ug()), n;
	},
	newtuple(e, t) {
		let n = this._dnames, r = this._dims, i = r.length, a = {};
		for (let t = 0; t < i; ++t) a[n[t]] = r[t](e);
		return t ? Vp(t.tuple, a) : Rp(a);
	},
	clean() {
		let e = this.value;
		for (let t in e) e[t].num === 0 && delete e[t];
	},
	add(e) {
		let t = this.cellkey(e), n = this.cell(t, e);
		if (n.num += 1, this._countOnly) return;
		n.store && n.data.add(e);
		let r = n.agg;
		for (let t = 0, n = r.length; t < n; ++t) r[t].add(r[t].get(e), e);
	},
	rem(e) {
		let t = this.cellkey(e), n = this.cell(t, e);
		if (--n.num, this._countOnly) return;
		n.store && n.data.rem(e);
		let r = n.agg;
		for (let t = 0, n = r.length; t < n; ++t) r[t].rem(r[t].get(e), e);
	},
	celltuple(e) {
		let t = e.tuple, n = this._counts;
		e.store && e.data.values();
		for (let r = 0, i = n.length; r < i; ++r) t[n[r]] = e.num;
		if (!this._countOnly) {
			let n = e.agg;
			for (let e = 0, r = n.length; e < r; ++e) n[e].set(t);
		}
		return t;
	},
	changes(e) {
		let t = this._adds, n = this._mods, r = this._prev, i = this._drop, a = e.add, o = e.rem, s = e.mod, c, l, u, d;
		if (r) for (l in r) c = r[l], (!i || c.num) && o.push(c.tuple);
		for (u = 0, d = this._alen; u < d; ++u) a.push(this.celltuple(t[u])), t[u] = null;
		for (u = 0, d = this._mlen; u < d; ++u) c = n[u], (c.num === 0 && i ? o : s).push(this.celltuple(c)), n[u] = null;
		return this._alen = this._mlen = 0, this._prev = null, e;
	}
});
var pg = 1e-14;
function mg(e) {
	H.call(this, null, e);
}
mg.Definition = {
	type: "Bin",
	metadata: { modifies: !0 },
	params: [
		{
			name: "field",
			type: "field",
			required: !0
		},
		{
			name: "interval",
			type: "boolean",
			default: !0
		},
		{
			name: "anchor",
			type: "number"
		},
		{
			name: "maxbins",
			type: "number",
			default: 20
		},
		{
			name: "base",
			type: "number",
			default: 10
		},
		{
			name: "divide",
			type: "number",
			array: !0,
			default: [5, 2]
		},
		{
			name: "extent",
			type: "number",
			array: !0,
			length: 2,
			required: !0
		},
		{
			name: "span",
			type: "number"
		},
		{
			name: "step",
			type: "number"
		},
		{
			name: "steps",
			type: "number",
			array: !0
		},
		{
			name: "minstep",
			type: "number",
			default: 0
		},
		{
			name: "nice",
			type: "boolean",
			default: !0
		},
		{
			name: "name",
			type: "string"
		},
		{
			name: "as",
			type: "string",
			array: !0,
			length: 2,
			default: ["bin0", "bin1"]
		}
	]
}, R(mg, H, {
	transform(e, t) {
		let n = e.interval !== !1, r = this._bins(e), i = r.start, a = r.step, o = e.as || ["bin0", "bin1"], s = o[0], c = o[1], l;
		return e.modified() ? (t = t.reflow(!0), l = t.SOURCE) : l = t.modified($l(e.field)) ? t.ADD_MOD : t.ADD, t.visit(l, n ? (e) => {
			let t = r(e);
			e[s] = t, e[c] = t == null ? null : i + a * (1 + (t - i) / a);
		} : (e) => e[s] = r(e)), t.modifies(n ? o : s);
	},
	_bins(e) {
		if (this.value && !e.modified()) return this.value;
		let t = e.field, n = Ym(e), r = n.step, i = n.start, a = i + Math.ceil((n.stop - i) / r) * r, o, s;
		(o = e.anchor) != null && (s = o - (i + r * Math.floor((o - i) / r)), i += s, a += s);
		let c = function(e) {
			let n = yu(t(e));
			return n == null ? null : n < i ? -Infinity : n > a ? Infinity : (n = Math.max(i, Math.min(n, a - r)), i + r * Math.floor(pg + (n - i) / r));
		};
		return c.start = i, c.stop = n.stop, c.step = r, this.value = Zl(c, $l(t), e.name || "bin_" + Ql(t));
	}
});
function hg(e, t, n) {
	let r = e, i = t || [], a = n || [], o = {}, s = 0;
	return {
		add: (e) => a.push(e),
		remove: (e) => o[r(e)] = ++s,
		size: () => i.length,
		data: (e, t) => (s && (i = i.filter((e) => !o[r(e)]), o = {}, s = 0), t && e && i.sort(e), a.length && (i = e ? ld(e, i, a.sort(e)) : i.concat(a), a = []), i)
	};
}
function gg(e) {
	H.call(this, [], e);
}
gg.Definition = {
	type: "Collect",
	metadata: { source: !0 },
	params: [{
		name: "sort",
		type: "compare"
	}]
}, R(gg, H, { transform(e, t) {
	let n = t.fork(t.ALL), r = hg(V, this.value, n.materialize(n.ADD).add), i = e.sort, a = t.changed() || i && (e.modified("sort") || t.modified(i.fields));
	return n.visit(n.REM, r.remove), this.modified(a), this.value = n.source = r.data(Hp(i), a), t.source && t.source.root && (this.value.root = t.source.root), n;
} });
function _g(e) {
	Zp.call(this, null, vg, e);
}
R(_g, Zp);
function vg(e) {
	return this.value && !e.modified() ? this.value : Bu(e.fields, e.orders);
}
function yg(e) {
	H.call(this, null, e);
}
yg.Definition = {
	type: "CountPattern",
	metadata: {
		generates: !0,
		changes: !0
	},
	params: [
		{
			name: "field",
			type: "field",
			required: !0
		},
		{
			name: "case",
			type: "enum",
			values: [
				"upper",
				"lower",
				"mixed"
			],
			default: "mixed"
		},
		{
			name: "pattern",
			type: "string",
			default: "[\\w\"]+"
		},
		{
			name: "stopwords",
			type: "string",
			default: ""
		},
		{
			name: "as",
			type: "string",
			array: !0,
			length: 2,
			default: ["text", "count"]
		}
	]
};
function bg(e, t, n) {
	switch (t) {
		case "upper":
			e = e.toUpperCase();
			break;
		case "lower":
			e = e.toLowerCase();
			break;
	}
	return e.match(n);
}
R(yg, H, {
	transform(e, t) {
		let n = (t) => (n) => {
			for (var r = bg(s(n), e.case, a) || [], i, c = 0, l = r.length; c < l; ++c) o.test(i = r[c]) || t(i);
		}, r = this._parameterCheck(e, t), i = this._counts, a = this._match, o = this._stop, s = e.field, c = e.as || ["text", "count"], l = n((e) => i[e] = 1 + (i[e] || 0)), u = n((e) => --i[e]);
		return r ? t.visit(t.SOURCE, l) : (t.visit(t.ADD, l), t.visit(t.REM, u)), this._finish(t, c);
	},
	_parameterCheck(e, t) {
		let n = !1;
		return (e.modified("stopwords") || !this._stop) && (this._stop = RegExp("^" + (e.stopwords || "") + "$", "i"), n = !0), (e.modified("pattern") || !this._match) && (this._match = new RegExp(e.pattern || "[\\w']+", "g"), n = !0), (e.modified("field") || t.modified(e.field.fields)) && (n = !0), n && (this._counts = {}), n;
	},
	_finish(e, t) {
		let n = this._counts, r = this._tuples || (this._tuples = {}), i = t[0], a = t[1], o = e.fork(e.NO_SOURCE | e.NO_FIELDS), s, c, l;
		for (s in n) c = r[s], l = n[s] || 0, !c && l ? (r[s] = c = Rp({}), c[i] = s, c[a] = l, o.add.push(c)) : l === 0 ? (c && o.rem.push(c), n[s] = null, r[s] = null) : c[a] !== l && (c[a] = l, o.mod.push(c));
		return o.modifies(t);
	}
});
function xg(e) {
	H.call(this, null, e);
}
xg.Definition = {
	type: "Cross",
	metadata: { generates: !0 },
	params: [{
		name: "filter",
		type: "expr"
	}, {
		name: "as",
		type: "string",
		array: !0,
		length: 2,
		default: ["a", "b"]
	}]
}, R(xg, H, { transform(e, t) {
	let n = t.fork(t.NO_SOURCE), r = e.as || ["a", "b"], i = r[0], a = r[1], o = !this.value || t.changed(t.ADD_REM) || e.modified("as") || e.modified("filter"), s = this.value;
	return o ? (s && (n.rem = s), s = t.materialize(t.SOURCE).source, n.add = this.value = Sg(s, i, a, e.filter || lu)) : n.mod = s, n.source = this.value, n.modifies(r);
} });
function Sg(e, t, n, r) {
	for (var i = [], a = {}, o = e.length, s = 0, c, l; s < o; ++s) for (a[t] = l = e[s], c = 0; c < o; ++c) a[n] = e[c], r(a) && (i.push(Rp(a)), a = {}, a[t] = l);
	return i;
}
var Cg = {
	kde: fh,
	mixture: vh,
	normal: dh,
	lognormal: _h,
	uniform: Ch
}, wg = "distributions", Tg = "function", Eg = "field";
function Dg(e, t) {
	let n = e[Tg];
	L(Cg, n) || N("Unknown distribution function: " + n);
	let r = Cg[n]();
	for (let n in e) n === Eg ? r.data((e.from || t()).map(e[n])) : n === wg ? r[n](e[n].map((e) => Dg(e, t))) : typeof r[n] === Tg && r[n](e[n]);
	return r;
}
function Og(e) {
	H.call(this, null, e);
}
var kg = [
	{
		key: { function: "normal" },
		params: [{
			name: "mean",
			type: "number",
			default: 0
		}, {
			name: "stdev",
			type: "number",
			default: 1
		}]
	},
	{
		key: { function: "lognormal" },
		params: [{
			name: "mean",
			type: "number",
			default: 0
		}, {
			name: "stdev",
			type: "number",
			default: 1
		}]
	},
	{
		key: { function: "uniform" },
		params: [{
			name: "min",
			type: "number",
			default: 0
		}, {
			name: "max",
			type: "number",
			default: 1
		}]
	},
	{
		key: { function: "kde" },
		params: [
			{
				name: "field",
				type: "field",
				required: !0
			},
			{
				name: "from",
				type: "data"
			},
			{
				name: "bandwidth",
				type: "number",
				default: 0
			}
		]
	}
], Ag = {
	key: { function: "mixture" },
	params: [{
		name: "distributions",
		type: "param",
		array: !0,
		params: kg
	}, {
		name: "weights",
		type: "number",
		array: !0
	}]
};
Og.Definition = {
	type: "Density",
	metadata: { generates: !0 },
	params: [
		{
			name: "extent",
			type: "number",
			array: !0,
			length: 2
		},
		{
			name: "steps",
			type: "number"
		},
		{
			name: "minsteps",
			type: "number",
			default: 25
		},
		{
			name: "maxsteps",
			type: "number",
			default: 200
		},
		{
			name: "method",
			type: "string",
			default: "pdf",
			values: ["pdf", "cdf"]
		},
		{
			name: "distribution",
			type: "param",
			params: kg.concat(Ag)
		},
		{
			name: "as",
			type: "string",
			array: !0,
			default: ["value", "density"]
		}
	]
}, R(Og, H, { transform(e, t) {
	let n = t.fork(t.NO_SOURCE | t.NO_FIELDS);
	if (!this.value || t.changed() || e.modified()) {
		let r = Dg(e.distribution, jg(t)), i = e.steps || e.minsteps || 25, a = e.steps || e.maxsteps || 200, o = e.method || "pdf";
		o !== "pdf" && o !== "cdf" && N("Invalid density method: " + o), !e.extent && !r.data && N("Missing density extent parameter."), o = r[o];
		let s = e.as || ["value", "density"], c = e.extent || Ju(r.data()), l = Wh(o, c, i, a).map((e) => {
			let t = {};
			return t[s[0]] = e[0], t[s[1]] = e[1], Rp(t);
		});
		this.value && (n.rem = this.value), this.value = n.add = n.source = l;
	}
	return n;
} });
function jg(e) {
	return () => e.materialize(e.SOURCE).source;
}
function Mg(e, t) {
	return e ? e.map((e, n) => t[n] || Ql(e)) : null;
}
function Ng(e, t, n) {
	let r = [], i = (e) => e(c), a, o, s, c, l, u;
	if (t == null) r.push(e.map(n));
	else for (a = {}, o = 0, s = e.length; o < s; ++o) c = e[o], l = t.map(i), u = a[l], u || (a[l] = u = [], u.dims = l, r.push(u)), u.push(n(c));
	return r;
}
var Pg = "bin";
function Fg(e) {
	H.call(this, null, e);
}
Fg.Definition = {
	type: "DotBin",
	metadata: { modifies: !0 },
	params: [
		{
			name: "field",
			type: "field",
			required: !0
		},
		{
			name: "groupby",
			type: "field",
			array: !0
		},
		{
			name: "step",
			type: "number"
		},
		{
			name: "smooth",
			type: "boolean",
			default: !1
		},
		{
			name: "as",
			type: "string",
			default: Pg
		}
	]
};
var Ig = (e, t) => fd(Ju(e, t)) / 30;
R(Fg, H, { transform(e, t) {
	if (this.value && !(e.modified() || t.changed())) return t;
	let n = t.materialize(t.SOURCE).source, r = Ng(t.source, e.groupby, ou), i = e.smooth || !1, a = e.field, o = e.step || Ig(n, a), s = Hp((e, t) => a(e) - a(t)), c = e.as || Pg, l = r.length, u = Infinity, d = -Infinity, f = 0, p;
	for (; f < l; ++f) {
		let e = r[f].sort(s);
		p = -1;
		for (let t of $m(e, o, i, a)) t < u && (u = t), t > d && (d = t), e[++p][c] = t;
	}
	return this.value = {
		start: u,
		stop: d,
		step: o
	}, t.reflow(!0).modifies(c);
} });
function Lg(e) {
	Zp.call(this, null, Rg, e), this.modified(!0);
}
R(Lg, Zp);
function Rg(e) {
	let t = e.expr;
	return this.value && !e.modified("expr") ? this.value : Zl((n) => t(n, e), $l(t), Ql(t));
}
function zg(e) {
	H.call(this, [void 0, void 0], e);
}
zg.Definition = {
	type: "Extent",
	metadata: {},
	params: [{
		name: "field",
		type: "field",
		required: !0
	}]
}, R(zg, H, { transform(e, t) {
	let n = this.value, r = e.field, i = t.changed() || t.modified(r.fields) || e.modified("field"), a = n[0], o = n[1];
	if ((i || a == null) && (a = Infinity, o = -Infinity), t.visit(i ? t.SOURCE : t.ADD, (e) => {
		let t = yu(r(e));
		t != null && (t < a && (a = t), t > o && (o = t));
	}), !Number.isFinite(a) || !Number.isFinite(o)) {
		let e = Ql(r);
		e && (e = ` for field "${e}"`), t.dataflow.warn(`Infinite extent${e}: [${a}, ${o}]`), a = o = void 0;
	}
	this.value = [a, o];
} });
function Bg(e, t) {
	Zp.call(this, e), this.parent = t, this.count = 0;
}
R(Bg, Zp, {
	connect(e) {
		return this.detachSubflow = e.detachSubflow, this.targets().add(e), e.source = this;
	},
	add(e) {
		this.count += 1, this.value.add.push(e);
	},
	rem(e) {
		--this.count, this.value.rem.push(e);
	},
	mod(e) {
		this.value.mod.push(e);
	},
	init(e) {
		this.value.init(e, e.NO_SOURCE);
	},
	evaluate() {
		return this.value;
	}
});
function Vg(e) {
	H.call(this, {}, e), this._keys = Zu();
	let t = this._targets = [];
	t.active = 0, t.forEach = (e) => {
		for (let n = 0, r = t.active; n < r; ++n) e(t[n], n, t);
	};
}
R(Vg, H, {
	activate(e) {
		this._targets[this._targets.active++] = e;
	},
	subflow(e, t, n, r) {
		let i = this.value, a = L(i, e) && i[e], o, s;
		return a ? a.value.stamp < n.stamp && (a.init(n), this.activate(a)) : (s = r || (s = this._group[e]) && s.tuple, o = n.dataflow, a = new Bg(n.fork(n.NO_SOURCE), this), o.add(a).connect(t(o, e, s)), i[e] = a, this.activate(a)), a;
	},
	clean() {
		let e = this.value, t = 0;
		for (let n in e) if (e[n].count === 0) {
			let r = e[n].detachSubflow;
			r && r(), delete e[n], ++t;
		}
		if (t) {
			let e = this._targets.filter((e) => e && e.count > 0);
			this.initTargets(e);
		}
	},
	initTargets(e) {
		let t = this._targets, n = t.length, r = e ? e.length : 0, i = 0;
		for (; i < r; ++i) t[i] = e[i];
		for (; i < n && t[i] != null; ++i) t[i] = null;
		t.active = r;
	},
	transform(e, t) {
		let n = t.dataflow, r = e.key, i = e.subflow, a = this._keys, o = e.modified("key"), s = (e) => this.subflow(e, i, t);
		return this._group = e.group || {}, this.initTargets(), t.visit(t.REM, (e) => {
			let t = V(e), n = a.get(t);
			n !== void 0 && (a.delete(t), s(n).rem(e));
		}), t.visit(t.ADD, (e) => {
			let t = r(e);
			a.set(V(e), t), s(t).add(e);
		}), o || t.modified(r.fields) ? t.visit(t.MOD, (e) => {
			let t = V(e), n = a.get(t), i = r(e);
			n === i ? s(i).mod(e) : (a.set(t, i), s(n).rem(e), s(i).add(e));
		}) : t.changed(t.MOD) && t.visit(t.MOD, (e) => {
			s(a.get(V(e))).mod(e);
		}), o && t.visit(t.REFLOW, (e) => {
			let t = V(e), n = a.get(t), i = r(e);
			n !== i && (a.set(t, i), s(n).rem(e), s(i).add(e));
		}), t.clean() ? n.runAfter(() => {
			this.clean(), a.clean();
		}) : a.empty > n.cleanThreshold && n.runAfter(a.clean), t;
	}
});
function Hg(e) {
	Zp.call(this, null, Mee, e);
}
R(Hg, Zp);
function Mee(e) {
	return this.value && !e.modified() ? this.value : P(e.name) ? I(e.name).map((e) => iu(e)) : iu(e.name, e.as);
}
function Ug(e) {
	H.call(this, Zu(), e);
}
Ug.Definition = {
	type: "Filter",
	metadata: { changes: !0 },
	params: [{
		name: "expr",
		type: "expr",
		required: !0
	}]
}, R(Ug, H, { transform(e, t) {
	let n = t.dataflow, r = this.value, i = t.fork(), a = i.add, o = i.rem, s = i.mod, c = e.expr, l = !0;
	t.visit(t.REM, (e) => {
		let t = V(e);
		r.has(t) ? r.delete(t) : o.push(e);
	}), t.visit(t.ADD, (t) => {
		c(t, e) ? a.push(t) : r.set(V(t), 1);
	});
	function u(t) {
		let n = V(t), i = c(t, e), u = r.get(n);
		i && u ? (r.delete(n), a.push(t)) : !i && !u ? (r.set(n, 1), o.push(t)) : l && i && !u && s.push(t);
	}
	return t.visit(t.MOD, u), e.modified() && (l = !1, t.visit(t.REFLOW, u)), r.empty > n.cleanThreshold && n.runAfter(r.clean), i;
} });
function Wg(e) {
	H.call(this, [], e);
}
Wg.Definition = {
	type: "Flatten",
	metadata: { generates: !0 },
	params: [
		{
			name: "fields",
			type: "field",
			array: !0,
			required: !0
		},
		{
			name: "index",
			type: "string"
		},
		{
			name: "as",
			type: "string",
			array: !0
		}
	]
}, R(Wg, H, { transform(e, t) {
	let n = t.fork(t.NO_SOURCE), r = e.fields, i = Mg(r, e.as || []), a = e.index || null, o = i.length;
	return n.rem = this.value, t.visit(t.SOURCE, (e) => {
		let t = r.map((t) => t(e)), s = t.reduce((e, t) => Math.max(e, t.length), 0), c = 0, l, u, d;
		for (; c < s; ++c) {
			for (u = zp(e), l = 0; l < o; ++l) u[i[l]] = (d = t[l][c]) == null ? null : d;
			a && (u[a] = c), n.add.push(u);
		}
	}), this.value = n.source = n.add, a && n.modifies(a), n.modifies(i);
} });
function Gg(e) {
	H.call(this, [], e);
}
Gg.Definition = {
	type: "Fold",
	metadata: { generates: !0 },
	params: [{
		name: "fields",
		type: "field",
		array: !0,
		required: !0
	}, {
		name: "as",
		type: "string",
		array: !0,
		length: 2,
		default: ["key", "value"]
	}]
}, R(Gg, H, { transform(e, t) {
	let n = t.fork(t.NO_SOURCE), r = e.fields, i = r.map(Ql), a = e.as || ["key", "value"], o = a[0], s = a[1], c = r.length;
	return n.rem = this.value, t.visit(t.SOURCE, (e) => {
		for (let t = 0, a; t < c; ++t) a = zp(e), a[o] = i[t], a[s] = r[t](e), n.add.push(a);
	}), this.value = n.source = n.add, n.modifies(a);
} });
function Kg(e) {
	H.call(this, null, e);
}
Kg.Definition = {
	type: "Formula",
	metadata: { modifies: !0 },
	params: [
		{
			name: "expr",
			type: "expr",
			required: !0
		},
		{
			name: "as",
			type: "string",
			required: !0
		},
		{
			name: "initonly",
			type: "boolean"
		}
	]
}, R(Kg, H, { transform(e, t) {
	let n = e.expr, r = e.as, i = e.modified(), a = e.initonly ? t.ADD : i ? t.SOURCE : t.modified(n.fields) || t.modified(r) ? t.ADD_MOD : t.ADD;
	return i && (t = t.materialize().reflow(!0)), e.initonly || t.modifies(r), t.visit(a, (t) => t[r] = n(t, e));
} });
function qg(e) {
	H.call(this, [], e);
}
R(qg, H, { transform(e, t) {
	let n = t.fork(t.ALL), r = e.generator, i = this.value, a = e.size - i.length, o, s, c;
	if (a > 0) {
		for (o = []; --a >= 0;) o.push(c = Rp(r(e))), i.push(c);
		n.add = n.add.length ? n.materialize(n.ADD).add.concat(o) : o;
	} else s = i.slice(0, -a), n.rem = n.rem.length ? n.materialize(n.REM).rem.concat(s) : s, i = i.slice(-a);
	return n.source = this.value = i, n;
} });
var Jg = {
	value: "value",
	median: jt,
	mean: At,
	min: se,
	max: D
}, Nee = [];
function Yg(e) {
	H.call(this, [], e);
}
Yg.Definition = {
	type: "Impute",
	metadata: { changes: !0 },
	params: [
		{
			name: "field",
			type: "field",
			required: !0
		},
		{
			name: "key",
			type: "field",
			required: !0
		},
		{
			name: "keyvals",
			array: !0
		},
		{
			name: "groupby",
			type: "field",
			array: !0
		},
		{
			name: "method",
			type: "enum",
			default: "value",
			values: [
				"value",
				"mean",
				"median",
				"max",
				"min"
			]
		},
		{
			name: "value",
			default: 0
		}
	]
};
function Xg(e) {
	var t = e.method || Jg.value, n;
	if (Jg[t] == null) N("Unrecognized imputation method: " + t);
	else if (t === Jg.value) return n = e.value === void 0 ? 0 : e.value, () => n;
	else return Jg[t];
}
function Zg(e) {
	let t = e.field;
	return (e) => e ? t(e) : NaN;
}
R(Yg, H, { transform(e, t) {
	var n = t.fork(t.ALL), r = Xg(e), i = Zg(e), a = Ql(e.field), o = Ql(e.key), s = (e.groupby || []).map(Ql), c = Qg(t.source, e.groupby, e.key, e.keyvals), l = [], u = this.value, d = c.domain.length, f, p, m, h, g, _, v, y, b, x;
	for (g = 0, y = c.length; g < y; ++g) for (f = c[g], m = f.values, p = NaN, v = 0; v < d; ++v) if (f[v] == null) {
		for (h = c.domain[v], x = { _impute: !0 }, _ = 0, b = m.length; _ < b; ++_) x[s[_]] = m[_];
		x[o] = h, x[a] = Number.isNaN(p) ? p = r(f, i) : p, l.push(Rp(x));
	}
	return l.length && (n.add = n.materialize(n.ADD).add.concat(l)), u.length && (n.rem = n.materialize(n.REM).rem.concat(u)), this.value = l, n;
} });
function Qg(e, t, n, r) {
	var i = (e) => e(g), a = [], o = r ? r.slice() : [], s = {}, c = {}, l, u, d, f, p, m, h, g;
	for (o.forEach((e, t) => s[e] = t + 1), f = 0, h = e.length; f < h; ++f) g = e[f], m = n(g), p = s[m] || (s[m] = o.push(m)), u = (l = t ? t.map(i) : Nee) + "", (d = c[u]) || (d = c[u] = [], a.push(d), d.values = l), d[p - 1] = g;
	return a.domain = o, a;
}
function $g(e) {
	fg.call(this, e);
}
$g.Definition = {
	type: "JoinAggregate",
	metadata: { modifies: !0 },
	params: [
		{
			name: "groupby",
			type: "field",
			array: !0
		},
		{
			name: "fields",
			type: "field",
			null: !0,
			array: !0
		},
		{
			name: "ops",
			type: "enum",
			array: !0,
			values: eg
		},
		{
			name: "as",
			type: "string",
			null: !0,
			array: !0
		},
		{
			name: "key",
			type: "field"
		}
	]
}, R($g, fg, {
	transform(e, t) {
		let n = this, r = e.modified(), i;
		return n.value && (r || t.modified(n._inputs, !0)) ? (i = n.value = r ? n.init(e) : {}, t.visit(t.SOURCE, (e) => n.add(e))) : (i = n.value = n.value || this.init(e), t.visit(t.REM, (e) => n.rem(e)), t.visit(t.ADD, (e) => n.add(e))), n.changes(), t.visit(t.SOURCE, (e) => {
			qu(e, i[n.cellkey(e)].tuple);
		}), t.reflow(r).modifies(this._outputs);
	},
	changes() {
		let e = this._adds, t = this._mods, n, r;
		for (n = 0, r = this._alen; n < r; ++n) this.celltuple(e[n]), e[n] = null;
		for (n = 0, r = this._mlen; n < r; ++n) this.celltuple(t[n]), t[n] = null;
		this._alen = this._mlen = 0;
	}
});
function e_(e) {
	H.call(this, null, e);
}
e_.Definition = {
	type: "KDE",
	metadata: { generates: !0 },
	params: [
		{
			name: "groupby",
			type: "field",
			array: !0
		},
		{
			name: "field",
			type: "field",
			required: !0
		},
		{
			name: "cumulative",
			type: "boolean",
			default: !1
		},
		{
			name: "counts",
			type: "boolean",
			default: !1
		},
		{
			name: "bandwidth",
			type: "number",
			default: 0
		},
		{
			name: "extent",
			type: "number",
			array: !0,
			length: 2
		},
		{
			name: "resolve",
			type: "enum",
			values: ["shared", "independent"],
			default: "independent"
		},
		{
			name: "steps",
			type: "number"
		},
		{
			name: "minsteps",
			type: "number",
			default: 25
		},
		{
			name: "maxsteps",
			type: "number",
			default: 200
		},
		{
			name: "as",
			type: "string",
			array: !0,
			default: ["value", "density"]
		}
	]
}, R(e_, H, { transform(e, t) {
	let n = t.fork(t.NO_SOURCE | t.NO_FIELDS);
	if (!this.value || t.changed() || e.modified()) {
		let r = t.materialize(t.SOURCE).source, i = Ng(r, e.groupby, e.field), a = (e.groupby || []).map(Ql), o = e.bandwidth, s = e.cumulative ? "cdf" : "pdf", c = e.as || ["value", "density"], l = [], u = e.extent, d = e.steps || e.minsteps || 25, f = e.steps || e.maxsteps || 200;
		s !== "pdf" && s !== "cdf" && N("Invalid density method: " + s), e.resolve === "shared" && (u || (u = Ju(r, e.field)), d = f = e.steps || f), i.forEach((t) => {
			let n = fh(t, o)[s], r = e.counts ? t.length : 1;
			Wh(n, u || Ju(t), d, f).forEach((e) => {
				let n = {};
				for (let e = 0; e < a.length; ++e) n[a[e]] = t.dims[e];
				n[c[0]] = e[0], n[c[1]] = e[1] * r, l.push(Rp(n));
			});
		}), this.value && (n.rem = this.value), this.value = n.add = n.source = l;
	}
	return n;
} });
function t_(e) {
	Zp.call(this, null, n_, e);
}
R(t_, Zp);
function n_(e) {
	return this.value && !e.modified() ? this.value : ad(e.fields, e.flat);
}
function r_(e) {
	H.call(this, [], e), this._pending = null;
}
R(r_, H, { transform(e, t) {
	let n = t.dataflow;
	return this._pending ? a_(this, t, this._pending) : i_(e) ? t.StopPropagation : e.values ? a_(this, t, n.parse(e.values, e.format)) : e.async ? { async: n.request(e.url, e.format).then((e) => (this._pending = I(e.data), (e) => e.touch(this))) } : n.request(e.url, e.format).then((e) => a_(this, t, I(e.data)));
} });
function i_(e) {
	return e.modified("async") && !(e.modified("values") || e.modified("url") || e.modified("format"));
}
function a_(e, t, n) {
	n.forEach(Rp);
	let r = t.fork(t.NO_FIELDS & t.NO_SOURCE);
	return r.rem = e.value, e.value = r.source = r.add = n, e._pending = null, r.rem.length && r.clean(!0), r;
}
function o_(e) {
	H.call(this, {}, e);
}
o_.Definition = {
	type: "Lookup",
	metadata: { modifies: !0 },
	params: [
		{
			name: "index",
			type: "index",
			params: [{
				name: "from",
				type: "data",
				required: !0
			}, {
				name: "key",
				type: "field",
				required: !0
			}]
		},
		{
			name: "values",
			type: "field",
			array: !0
		},
		{
			name: "fields",
			type: "field",
			array: !0,
			required: !0
		},
		{
			name: "as",
			type: "string",
			array: !0
		},
		{
			name: "default",
			default: null
		}
	]
}, R(o_, H, { transform(e, t) {
	let n = e.fields, r = e.index, i = e.values, a = e.default == null ? null : e.default, o = e.modified(), s = n.length, c = o ? t.SOURCE : t.ADD, l = t, u = e.as, d, f, p;
	return i ? (f = i.length, s > 1 && !u && N("Multi-field lookup requires explicit \"as\" parameter."), u && u.length !== s * f && N("The \"as\" parameter has too few output field names."), u = u || i.map(Ql), d = function(e) {
		for (var t = 0, o = 0, c, l; t < s; ++t) if (l = r.get(n[t](e)), l == null) for (c = 0; c < f; ++c, ++o) e[u[o]] = a;
		else for (c = 0; c < f; ++c, ++o) e[u[o]] = i[c](l);
	}) : (u || N("Missing output field names."), d = function(e) {
		for (var t = 0, i; t < s; ++t) i = r.get(n[t](e)), e[u[t]] = i == null ? a : i;
	}), o ? l = t.reflow(!0) : (p = n.some((e) => t.modified(e.fields)), c |= p ? t.MOD : 0), t.visit(c, d), l.modifies(u);
} });
function s_(e) {
	Zp.call(this, null, c_, e);
}
R(s_, Zp);
function c_(e) {
	if (this.value && !e.modified()) return this.value;
	let t = e.extents, n = t.length, r = Infinity, i = -Infinity, a, o;
	for (a = 0; a < n; ++a) o = t[a], o[0] < r && (r = o[0]), o[1] > i && (i = o[1]);
	return [r, i];
}
function l_(e) {
	Zp.call(this, null, u_, e);
}
R(l_, Zp);
function u_(e) {
	return this.value && !e.modified() ? this.value : e.values.reduce((e, t) => e.concat(t), []);
}
function d_(e) {
	H.call(this, null, e);
}
R(d_, H, { transform(e, t) {
	return this.modified(e.modified()), this.value = e, t.fork(t.NO_SOURCE | t.NO_FIELDS);
} });
function f_(e) {
	fg.call(this, e);
}
f_.Definition = {
	type: "Pivot",
	metadata: {
		generates: !0,
		changes: !0
	},
	params: [
		{
			name: "groupby",
			type: "field",
			array: !0
		},
		{
			name: "field",
			type: "field",
			required: !0
		},
		{
			name: "value",
			type: "field",
			required: !0
		},
		{
			name: "op",
			type: "enum",
			values: eg,
			default: "sum"
		},
		{
			name: "limit",
			type: "number",
			default: 0
		},
		{
			name: "key",
			type: "field"
		}
	]
}, R(f_, fg, {
	_transform: fg.prototype.transform,
	transform(e, t) {
		return this._transform(p_(e, t), t);
	}
});
function p_(e, t) {
	let n = e.field, r = e.value, i = (e.op === "count" ? "__count__" : e.op) || "sum", a = $l(n).concat($l(r)), o = h_(n, e.limit || 0, t);
	return t.changed() && e.set("__pivot__", null, null, !0), {
		key: e.key,
		groupby: e.groupby,
		ops: o.map(() => i),
		fields: o.map((e) => m_(e, n, r, a)),
		as: o.map((e) => e + ""),
		modified: e.modified.bind(e)
	};
}
function m_(e, t, n, r) {
	return Zl((r) => t(r) === e ? n(r) : NaN, r, e + "");
}
function h_(e, t, n) {
	let r = {}, i = [];
	return n.visit(n.SOURCE, (t) => {
		let n = e(t);
		r[n] || (r[n] = 1, i.push(n));
	}), i.sort(Vu), t ? i.slice(0, t) : i;
}
function g_(e) {
	Vg.call(this, e);
}
R(g_, Vg, { transform(e, t) {
	let n = e.subflow, r = e.field, i = (e) => this.subflow(V(e), n, t, e);
	return (e.modified("field") || r && t.modified($l(r))) && N("PreFacet does not support field modification."), this.initTargets(), r ? (t.visit(t.MOD, (e) => {
		let t = i(e);
		r(e).forEach((e) => t.mod(e));
	}), t.visit(t.ADD, (e) => {
		let t = i(e);
		r(e).forEach((e) => t.add(Rp(e)));
	}), t.visit(t.REM, (e) => {
		let t = i(e);
		r(e).forEach((e) => t.rem(e));
	})) : (t.visit(t.MOD, (e) => i(e).mod(e)), t.visit(t.ADD, (e) => i(e).add(e)), t.visit(t.REM, (e) => i(e).rem(e))), t.clean() && t.runAfter(() => this.clean()), t;
} });
function __(e) {
	H.call(this, null, e);
}
__.Definition = {
	type: "Project",
	metadata: {
		generates: !0,
		changes: !0
	},
	params: [{
		name: "fields",
		type: "field",
		array: !0
	}, {
		name: "as",
		type: "string",
		null: !0,
		array: !0
	}]
}, R(__, H, { transform(e, t) {
	let n = t.fork(t.NO_SOURCE), r = e.fields, i = Mg(e.fields, e.as || []), a = r ? (e, t) => v_(e, t, r, i) : Bp, o;
	return this.value ? o = this.value : (t = t.addAll(), o = this.value = {}), t.visit(t.REM, (e) => {
		let t = V(e);
		n.rem.push(o[t]), o[t] = null;
	}), t.visit(t.ADD, (e) => {
		let t = a(e, Rp({}));
		o[V(e)] = t, n.add.push(t);
	}), t.visit(t.MOD, (e) => {
		n.mod.push(a(e, o[V(e)]));
	}), n;
} });
function v_(e, t, n, r) {
	for (let i = 0, a = n.length; i < a; ++i) t[r[i]] = n[i](e);
	return t;
}
function y_(e) {
	H.call(this, null, e);
}
R(y_, H, { transform(e, t) {
	return this.value = e.value, e.modified("value") ? t.fork(t.NO_SOURCE | t.NO_FIELDS) : t.StopPropagation;
} });
function b_(e) {
	H.call(this, null, e);
}
b_.Definition = {
	type: "Quantile",
	metadata: {
		generates: !0,
		changes: !0
	},
	params: [
		{
			name: "groupby",
			type: "field",
			array: !0
		},
		{
			name: "field",
			type: "field",
			required: !0
		},
		{
			name: "probs",
			type: "number",
			array: !0
		},
		{
			name: "step",
			type: "number",
			default: .01
		},
		{
			name: "as",
			type: "string",
			array: !0,
			default: ["prob", "value"]
		}
	]
};
var x_ = 1e-14;
R(b_, H, { transform(e, t) {
	let n = t.fork(t.NO_SOURCE | t.NO_FIELDS), r = e.as || ["prob", "value"];
	if (this.value && !e.modified() && !t.changed()) return n.source = this.value, n;
	let i = t.materialize(t.SOURCE).source, a = Ng(i, e.groupby, e.field), o = (e.groupby || []).map(Ql), s = [], c = e.step || .01, l = e.probs || ye(c / 2, 1 - x_, c), u = l.length;
	return a.forEach((e) => {
		let t = Km(e, l);
		for (let n = 0; n < u; ++n) {
			let i = {};
			for (let t = 0; t < o.length; ++t) i[o[t]] = e.dims[t];
			i[r[0]] = l[n], i[r[1]] = t[n], s.push(Rp(i));
		}
	}), this.value && (n.rem = this.value), this.value = n.add = n.source = s, n;
} });
function S_(e) {
	H.call(this, null, e);
}
R(S_, H, { transform(e, t) {
	let n, r;
	return this.value ? r = this.value : (n = t = t.addAll(), r = this.value = {}), e.derive && (n = t.fork(t.NO_SOURCE), t.visit(t.REM, (e) => {
		let t = V(e);
		n.rem.push(r[t]), r[t] = null;
	}), t.visit(t.ADD, (e) => {
		let t = zp(e);
		r[V(e)] = t, n.add.push(t);
	}), t.visit(t.MOD, (e) => {
		let t = r[V(e)];
		for (let r in e) t[r] = e[r], n.modifies(r);
		n.mod.push(t);
	})), n;
} });
function C_(e) {
	H.call(this, [], e), this.count = 0;
}
C_.Definition = {
	type: "Sample",
	metadata: {},
	params: [{
		name: "size",
		type: "number",
		default: 1e3
	}]
}, R(C_, H, { transform(e, t) {
	let n = t.fork(t.NO_SOURCE), r = e.modified("size"), i = e.size, a = this.value.reduce((e, t) => (e[V(t)] = 1, e), {}), o = this.value, s = this.count, c = 0;
	function l(e) {
		let t, r;
		o.length < i ? o.push(e) : (r = ~~((s + 1) * Xm()), r < o.length && r >= c && (t = o[r], a[V(t)] && n.rem.push(t), o[r] = e)), ++s;
	}
	if (t.rem.length && (t.visit(t.REM, (e) => {
		let t = V(e);
		a[t] && (a[t] = -1, n.rem.push(e)), --s;
	}), o = o.filter((e) => a[V(e)] !== -1)), (t.rem.length || r) && o.length < i && t.source && (c = s = o.length, t.visit(t.SOURCE, (e) => {
		a[V(e)] || l(e);
	}), c = -1), r && o.length > i) {
		let e = o.length - i;
		for (let t = 0; t < e; ++t) a[V(o[t])] = -1, n.rem.push(o[t]);
		o = o.slice(e);
	}
	return t.mod.length && t.visit(t.MOD, (e) => {
		a[V(e)] && n.mod.push(e);
	}), t.add.length && t.visit(t.ADD, l), (t.add.length || c < 0) && (n.add = o.filter((e) => !a[V(e)])), this.count = s, this.value = n.source = o, n;
} });
function w_(e) {
	H.call(this, null, e);
}
w_.Definition = {
	type: "Sequence",
	metadata: {
		generates: !0,
		changes: !0
	},
	params: [
		{
			name: "start",
			type: "number",
			required: !0
		},
		{
			name: "stop",
			type: "number",
			required: !0
		},
		{
			name: "step",
			type: "number",
			default: 1
		},
		{
			name: "as",
			type: "string",
			default: "data"
		}
	]
}, R(w_, H, { transform(e, t) {
	if (this.value && !e.modified()) return;
	let n = t.materialize().fork(t.MOD), r = e.as || "data";
	return n.rem = this.value ? t.rem.concat(this.value) : t.rem, this.value = ye(e.start, e.stop, e.step || 1).map((e) => {
		let t = {};
		return t[r] = e, Rp(t);
	}), n.add = t.add.concat(this.value), n;
} });
function T_(e) {
	H.call(this, null, e), this.modified(!0);
}
R(T_, H, { transform(e, t) {
	return this.value = t.source, t.changed() ? t.fork(t.NO_SOURCE | t.NO_FIELDS) : t.StopPropagation;
} });
function E_(e) {
	H.call(this, null, e);
}
var D_ = ["unit0", "unit1"];
E_.Definition = {
	type: "TimeUnit",
	metadata: { modifies: !0 },
	params: [
		{
			name: "field",
			type: "field",
			required: !0
		},
		{
			name: "interval",
			type: "boolean",
			default: !0
		},
		{
			name: "units",
			type: "enum",
			values: Bd,
			array: !0
		},
		{
			name: "step",
			type: "number",
			default: 1
		},
		{
			name: "maxbins",
			type: "number",
			default: 40
		},
		{
			name: "extent",
			type: "date",
			array: !0
		},
		{
			name: "timezone",
			type: "enum",
			default: "local",
			values: ["local", "utc"]
		},
		{
			name: "as",
			type: "string",
			array: !0,
			length: 2,
			default: D_
		}
	]
}, R(E_, H, {
	transform(e, t) {
		let n = e.field, r = e.interval !== !1, i = e.timezone === "utc", a = this._floor(e, t), o = (i ? vf : _f)(a.unit).offset, s = e.as || D_, c = s[0], l = s[1], u = a.step, d = a.start || Infinity, f = a.stop || -Infinity, p = t.ADD;
		return (e.modified() || t.changed(t.REM) || t.modified($l(n))) && (t = t.reflow(!0), p = t.SOURCE, d = Infinity, f = -Infinity), t.visit(p, (e) => {
			let t = n(e), i, s;
			t == null ? (e[c] = null, r && (e[l] = null)) : (e[c] = i = s = a(t), r && (e[l] = s = o(i, u)), i < d && (d = i), s > f && (f = s));
		}), a.start = d, a.stop = f, t.modifies(r ? s : c);
	},
	_floor(e, t) {
		let n = e.timezone === "utc", { units: r, step: i } = e.units ? {
			units: e.units,
			step: e.step || 1
		} : Vf({
			extent: e.extent || Ju(t.materialize(t.SOURCE).source, e.field),
			maxbins: e.maxbins
		}), a = Hd(r), o = this.value || {}, s = (n ? mf : df)(a, i);
		return s.unit = vu(a), s.units = a, s.step = i, s.start = o.start, s.stop = o.stop, this.value = s;
	}
});
function O_(e) {
	H.call(this, Zu(), e);
}
R(O_, H, { transform(e, t) {
	let n = t.dataflow, r = e.field, i = this.value, a = (e) => i.set(r(e), e), o = !0;
	return e.modified("field") || t.modified(r.fields) ? (i.clear(), t.visit(t.SOURCE, a)) : t.changed() ? (t.visit(t.REM, (e) => i.delete(r(e))), t.visit(t.ADD, a)) : o = !1, this.modified(o), i.empty > n.cleanThreshold && n.runAfter(i.clean), t.fork();
} });
function k_(e) {
	H.call(this, null, e);
}
R(k_, H, { transform(e, t) {
	(!this.value || e.modified("field") || e.modified("sort") || t.changed() || e.sort && t.modified(e.sort.fields)) && (this.value = (e.sort ? t.source.slice().sort(Hp(e.sort)) : t.source).map(e.field));
} });
function A_(e, t, n, r) {
	let i = j_[e](t, n);
	return {
		init: i.init || su,
		update: function(e, t) {
			t[r] = i.next(e);
		}
	};
}
var j_ = {
	row_number: function() {
		return { next: (e) => e.index + 1 };
	},
	rank: function() {
		let e;
		return {
			init: () => e = 1,
			next: (t) => {
				let n = t.index, r = t.data;
				return n && t.compare(r[n - 1], r[n]) ? e = n + 1 : e;
			}
		};
	},
	dense_rank: function() {
		let e;
		return {
			init: () => e = 1,
			next: (t) => {
				let n = t.index, r = t.data;
				return n && t.compare(r[n - 1], r[n]) ? ++e : e;
			}
		};
	},
	percent_rank: function() {
		let e = j_.rank(), t = e.next;
		return {
			init: e.init,
			next: (e) => (t(e) - 1) / (e.data.length - 1)
		};
	},
	cume_dist: function() {
		let e;
		return {
			init: () => e = 0,
			next: (t) => {
				let n = t.data, r = t.compare, i = t.index;
				if (e < i) {
					for (; i + 1 < n.length && !r(n[i], n[i + 1]);) ++i;
					e = i;
				}
				return (1 + e) / n.length;
			}
		};
	},
	ntile: function(e, t) {
		t = +t, t > 0 || N("ntile num must be greater than zero.");
		let n = j_.cume_dist(), r = n.next;
		return {
			init: n.init,
			next: (e) => Math.ceil(t * r(e))
		};
	},
	lag: function(e, t) {
		return t = +t || 1, { next: (n) => {
			let r = n.index - t;
			return r >= 0 ? e(n.data[r]) : null;
		} };
	},
	lead: function(e, t) {
		return t = +t || 1, { next: (n) => {
			let r = n.index + t, i = n.data;
			return r < i.length ? e(i[r]) : null;
		} };
	},
	first_value: function(e) {
		return { next: (t) => e(t.data[t.i0]) };
	},
	last_value: function(e) {
		return { next: (t) => e(t.data[t.i1 - 1]) };
	},
	nth_value: function(e, t) {
		return t = +t, t > 0 || N("nth_value nth must be greater than zero."), { next: (n) => {
			let r = n.i0 + (t - 1);
			return r < n.i1 ? e(n.data[r]) : null;
		} };
	},
	prev_value: function(e) {
		let t;
		return {
			init: () => t = null,
			next: (n) => {
				let r = e(n.data[n.index]);
				return r == null ? t : t = r;
			}
		};
	},
	next_value: function(e) {
		let t, n;
		return {
			init: () => (t = null, n = -1),
			next: (r) => {
				let i = r.data;
				return r.index <= n ? t : (n = M_(e, i, r.index)) < 0 ? (n = i.length, t = null) : t = e(i[n]);
			}
		};
	}
};
function M_(e, t, n) {
	for (let r = t.length; n < r; ++n) if (e(t[n]) != null) return n;
	return -1;
}
var N_ = Object.keys(j_);
function P_(e) {
	let t = I(e.ops), n = I(e.fields), r = I(e.params), i = I(e.aggregate_params), a = I(e.as), o = this.outputs = [], s = this.windows = [], c = {}, l = {}, u = [], d = [], f = !0;
	function p(e) {
		I($l(e)).forEach((e) => c[e] = 1);
	}
	p(e.sort), t.forEach((e, t) => {
		let c = n[t], m = r[t], h = i[t] || null, g = Ql(c), _ = Xh(e, g, a[t]);
		if (p(c), o.push(_), L(j_, e)) s.push(A_(e, c, m, _));
		else {
			if (c == null && e !== "count" && N("Null aggregate field specified."), e === "count") {
				u.push(_);
				return;
			}
			f = !1;
			let t = l[g];
			t || (t = l[g] = [], t.field = c, d.push(t)), t.push(ng(e, h, _));
		}
	}), (u.length || d.length) && (this.cell = I_(d, u, f)), this.inputs = Object.keys(c);
}
var F_ = P_.prototype;
F_.init = function() {
	this.windows.forEach((e) => e.init()), this.cell && this.cell.init();
}, F_.update = function(e, t) {
	let n = this.cell, r = this.windows, i = e.data, a = r && r.length, o;
	if (n) {
		for (o = e.p0; o < e.i0; ++o) n.rem(i[o]);
		for (o = e.p1; o < e.i1; ++o) n.add(i[o]);
		n.set(t);
	}
	for (o = 0; o < a; ++o) r[o].update(e, t);
};
function I_(e, t, n) {
	e = e.map((e) => lg(e, e.field));
	let r = {
		num: 0,
		agg: null,
		store: !1,
		count: t
	};
	if (!n) for (var i = e.length, a = r.agg = Array(i), o = 0; o < i; ++o) a[o] = new e[o](r);
	if (r.store) var s = r.data = new ug();
	return r.add = function(e) {
		if (r.num += 1, !n) {
			s && s.add(e);
			for (let t = 0; t < i; ++t) a[t].add(a[t].get(e), e);
		}
	}, r.rem = function(e) {
		if (--r.num, !n) {
			s && s.rem(e);
			for (let t = 0; t < i; ++t) a[t].rem(a[t].get(e), e);
		}
	}, r.set = function(e) {
		let i, o;
		for (s && s.values(), i = 0, o = t.length; i < o; ++i) e[t[i]] = r.num;
		if (!n) for (i = 0, o = a.length; i < o; ++i) a[i].set(e);
	}, r.init = function() {
		r.num = 0, s && s.reset();
		for (let e = 0; e < i; ++e) a[e].init();
	}, r;
}
function L_(e) {
	H.call(this, {}, e), this._mlen = 0, this._mods = [];
}
L_.Definition = {
	type: "Window",
	metadata: { modifies: !0 },
	params: [
		{
			name: "sort",
			type: "compare"
		},
		{
			name: "groupby",
			type: "field",
			array: !0
		},
		{
			name: "ops",
			type: "enum",
			array: !0,
			values: N_.concat(eg)
		},
		{
			name: "params",
			type: "number",
			null: !0,
			array: !0
		},
		{
			name: "aggregate_params",
			type: "number",
			null: !0,
			array: !0
		},
		{
			name: "fields",
			type: "field",
			null: !0,
			array: !0
		},
		{
			name: "as",
			type: "string",
			null: !0,
			array: !0
		},
		{
			name: "frame",
			type: "number",
			null: !0,
			array: !0,
			length: 2,
			default: [null, 0]
		},
		{
			name: "ignorePeers",
			type: "boolean",
			default: !1
		}
	]
}, R(L_, H, {
	transform(e, t) {
		this.stamp = t.stamp;
		let n = e.modified(), r = Hp(e.sort), i = Yh(e.groupby), a = (e) => this.group(i(e)), o = this.state;
		(!o || n) && (o = this.state = new P_(e)), n || t.modified(o.inputs) ? (this.value = {}, t.visit(t.SOURCE, (e) => a(e).add(e))) : (t.visit(t.REM, (e) => a(e).remove(e)), t.visit(t.ADD, (e) => a(e).add(e)));
		for (let t = 0, n = this._mlen; t < n; ++t) R_(this._mods[t], o, r, e);
		return this._mlen = 0, this._mods = [], t.reflow(n).modifies(o.outputs);
	},
	group(e) {
		let t = this.value[e];
		return t || (t = this.value[e] = hg(V), t.stamp = -1), t.stamp < this.stamp && (t.stamp = this.stamp, this._mods[this._mlen++] = t), t;
	}
});
function R_(e, t, n, r) {
	let i = r.sort, a = i && !r.ignorePeers, o = r.frame || [null, 0], s = e.data(n), c = s.length, l = a ? v(i) : null, u = {
		i0: 0,
		i1: 0,
		p0: 0,
		p1: 0,
		index: 0,
		data: s,
		compare: i || Gu(-1)
	};
	t.init();
	for (let e = 0; e < c; ++e) z_(u, o, e, c), a && B_(u, l), t.update(u, s[e]);
}
function z_(e, t, n, r) {
	e.p0 = e.i0, e.p1 = e.i1, e.i0 = t[0] == null ? 0 : Math.max(0, n - Math.abs(t[0])), e.i1 = t[1] == null ? r : Math.min(r, n + Math.abs(t[1]) + 1), e.index = n;
}
function B_(e, t) {
	let n = e.i0, r = e.i1 - 1, i = e.compare, a = e.data, o = a.length - 1;
	n > 0 && !i(a[n], a[n - 1]) && (e.i0 = t.left(a, a[n])), r < o && !i(a[r], a[r + 1]) && (e.i1 = t.right(a, a[r]));
}
//#endregion
//#region ../../node_modules/.pnpm/vega-canvas@2.0.0/node_modules/vega-canvas/build/vega-canvas.browser.js
function V_(e, t) {
	if (typeof document < "u" && document.createElement) {
		let n = document.createElement("canvas");
		if (n && n.getContext) return n.width = e, n.height = t, n;
	}
	return null;
}
var H_ = () => typeof Image < "u" ? Image : null;
//#endregion
//#region ../../node_modules/.pnpm/vega-scale@8.1.0/node_modules/vega-scale/build/vega-scale.js
function U_(e, t, n) {
	let r = e - t + n * 2;
	return e ? r > 0 ? r : 1 : 0;
}
var W_ = "identity", G_ = "linear", K_ = "sqrt", q_ = "symlog", J_ = "time", Y_ = "sequential", X_ = "diverging", Z_ = "quantile", Q_ = "quantize", $_ = "threshold", ev = "ordinal", tv = "point", nv = "band", rv = "bin-ordinal", iv = "continuous", av = "discrete", ov = "discretizing", sv = "interpolating", cv = "temporal";
function lv(e) {
	return function(t) {
		let n = t[0], r = t[1], i;
		return r < n && (i = n, n = r, r = i), [e.invert(n), e.invert(r)];
	};
}
function uv(e) {
	return function(t) {
		let n = e.range(), r = t[0], i = t[1], a = -1, o, s, c, l;
		for (i < r && (s = r, r = i, i = s), c = 0, l = n.length; c < l; ++c) n[c] >= r && n[c] <= i && (a < 0 && (a = c), o = c);
		if (!(a < 0)) return r = e.invertExtent(n[a]), i = e.invertExtent(n[o]), [r[0] === void 0 ? r[1] : r[0], i[1] === void 0 ? i[0] : i[1]];
	};
}
function dv() {
	let e = b().unknown(void 0), t = e.domain, n = e.range, r = [0, 1], i, a, o = !1, s = 0, l = 0, u = .5;
	delete e.unknown;
	function d() {
		let e = t().length, c = r[1] < r[0], d = r[1 - c], f = U_(e, s, l), p = r[c - 0];
		i = (d - p) / (f || 1), o && (i = Math.floor(i)), p += (d - p - i * (e - s)) * u, a = i * (1 - s), o && (p = Math.round(p), a = Math.round(a));
		let m = ye(e).map((e) => p + i * e);
		return n(c ? m.reverse() : m);
	}
	return e.domain = function(e) {
		return arguments.length ? (t(e), d()) : t();
	}, e.range = function(e) {
		return arguments.length ? (r = [+e[0], +e[1]], d()) : r.slice();
	}, e.rangeRound = function(e) {
		return r = [+e[0], +e[1]], o = !0, d();
	}, e.bandwidth = function() {
		return a;
	}, e.step = function() {
		return i;
	}, e.round = function(e) {
		return arguments.length ? (o = !!e, d()) : o;
	}, e.padding = function(e) {
		return arguments.length ? (l = Math.max(0, Math.min(1, e)), s = l, d()) : s;
	}, e.paddingInner = function(e) {
		return arguments.length ? (s = Math.max(0, Math.min(1, e)), d()) : s;
	}, e.paddingOuter = function(e) {
		return arguments.length ? (l = Math.max(0, Math.min(1, e)), d()) : l;
	}, e.align = function(e) {
		return arguments.length ? (u = Math.max(0, Math.min(1, e)), d()) : u;
	}, e.invertRange = function(e) {
		if (e[0] == null || e[1] == null) return;
		let i = r[1] < r[0], o = i ? n().reverse() : n(), s = o.length - 1, l = +e[0], u = +e[1], d, f, p;
		if (!(l !== l || u !== u) && (u < l && (p = l, l = u, u = p), !(u < o[0] || l > r[1 - i]))) return d = Math.max(0, c(o, l) - 1), f = l === u ? d : c(o, u) - 1, l - o[d] > a + 1e-10 && ++d, i && (p = d, d = s - f, f = s - p), d > f ? void 0 : t().slice(d, f + 1);
	}, e.invert = function(t) {
		let n = e.invertRange([t, t]);
		return n && n[0];
	}, e.copy = function() {
		return dv().domain(t()).range(r).round(o).paddingInner(s).paddingOuter(l).align(u);
	}, d();
}
function fv(e) {
	let t = e.copy;
	return e.padding = e.paddingOuter, delete e.paddingInner, e.copy = function() {
		return fv(t());
	}, e;
}
function pv() {
	return fv(dv().paddingInner(1));
}
var mv = Array.prototype.map;
function hv(e) {
	return mv.call(e, yu);
}
var gv = Array.prototype.slice;
function _v() {
	let e = [], t = [];
	function n(n) {
		return n == null || n !== n ? void 0 : t[(c(e, n) - 1) % t.length];
	}
	return n.domain = function(t) {
		return arguments.length ? (e = hv(t), n) : e.slice();
	}, n.range = function(e) {
		return arguments.length ? (t = gv.call(e), n) : t.slice();
	}, n.tickFormat = function(t, n) {
		return m(e[0], vu(e), t == null ? 10 : t, n);
	}, n.copy = function() {
		return _v().domain(n.domain()).range(n.range());
	}, n;
}
var vv = /* @__PURE__ */ new Map(), yv = Symbol("vega_scale");
function bv(e) {
	return e[yv] = !0, e;
}
function xv(e) {
	return e && e[yv] === !0;
}
function Sv(e, t, n) {
	let r = function() {
		let n = t();
		return n.invertRange || (n.invertRange = n.invert ? lv(n) : n.invertExtent ? uv(n) : void 0), n.type = e, bv(n);
	};
	return r.metadata = _d(I(n)), r;
}
function Cv(e, t, n) {
	return arguments.length > 1 ? (vv.set(e, Sv(e, t, n)), this) : wv(e) ? vv.get(e) : void 0;
}
Cv(W_, Qc), Cv(G_, g, iv), Cv("log", cl, [iv, "log"]), Cv("pow", _l, iv), Cv(K_, vl, iv), Cv(q_, fl, iv), Cv(J_, ue, [iv, cv]), Cv("utc", Sl, [iv, cv]), Cv(Y_, Tl, [iv, sv]), Cv(`${Y_}-${G_}`, Tl, [iv, sv]), Cv(`${Y_}-log`, El, [
	iv,
	sv,
	"log"
]), Cv(`${Y_}-pow`, Ol, [iv, sv]), Cv(`${Y_}-${K_}`, kl, [iv, sv]), Cv(`${Y_}-${q_}`, Dl, [iv, sv]), Cv(`${X_}-${G_}`, jl, [iv, sv]), Cv(`${X_}-log`, Ml, [
	iv,
	sv,
	"log"
]), Cv(`${X_}-pow`, Pl, [iv, sv]), Cv(`${X_}-${K_}`, Fl, [iv, sv]), Cv(`${X_}-${q_}`, Nl, [iv, sv]), Cv(Z_, yl, [ov, Z_]), Cv(Q_, bl, ov), Cv($_, xl, ov), Cv(rv, _v, [av, ov]), Cv(ev, b, av), Cv(nv, dv, av), Cv(tv, pv, av);
function wv(e) {
	return vv.has(e);
}
function Tv(e, t) {
	let n = vv.get(e);
	return n && n.metadata[t];
}
function Ev(e) {
	return Tv(e, iv);
}
function Dv(e) {
	return Tv(e, av);
}
function Ov(e) {
	return Tv(e, ov);
}
function kv(e) {
	return Tv(e, "log");
}
function Av(e) {
	return Tv(e, cv);
}
function jv(e) {
	return Tv(e, sv);
}
function Mv(e) {
	return Tv(e, Z_);
}
var Nv = [
	"clamp",
	"base",
	"constant",
	"exponent"
];
function Pv(e, t) {
	let n = t[0], r = vu(t) - n;
	return function(t) {
		return e(n + t * r);
	};
}
function Fv(e, t, n) {
	return Me(Rv(t || "rgb", n), e);
}
function Iv(e, t) {
	let n = Array(t), r = t + 1;
	for (let i = 0; i < t;) n[i] = e(++i / r);
	return n;
}
function Lv(e, t, n) {
	let r = n - t, i, a, o;
	return !r || !Number.isFinite(r) ? Gu(.5) : (i = (a = e.type).indexOf("-"), a = i < 0 ? a : a.slice(i + 1), o = Cv(a)().domain([t, n]).range([0, 1]), Nv.forEach((t) => e[t] ? o[t](e[t]()) : 0), o);
}
function Rv(e, t) {
	let n = we[zv(e)];
	return t != null && n && n.gamma ? n.gamma(t) : n;
}
function zv(e) {
	return "interpolate" + e.toLowerCase().split("-").map((e) => e[0].toUpperCase() + e.slice(1)).join("");
}
var Bv = {
	blues: "cfe1f2bed8eca8cee58fc1de74b2d75ba3cf4592c63181bd206fb2125ca40a4a90",
	greens: "d3eecdc0e6baabdda594d3917bc77d60ba6c46ab5e329a512089430e7735036429",
	greys: "e2e2e2d4d4d4c4c4c4b1b1b19d9d9d8888887575756262624d4d4d3535351e1e1e",
	oranges: "fdd8b3fdc998fdb87bfda55efc9244f87f2cf06b18e4580bd14904b93d029f3303",
	purples: "e2e1efd4d4e8c4c5e0b4b3d6a3a0cc928ec3827cb97566ae684ea25c3696501f8c",
	reds: "fdc9b4fcb49afc9e80fc8767fa7051f6573fec3f2fdc2a25c81b1db21218970b13",
	blueGreen: "d5efedc1e8e0a7ddd18bd2be70c6a958ba9144ad77319c5d2089460e7736036429",
	bluePurple: "ccddecbad0e4a8c2dd9ab0d4919cc98d85be8b6db28a55a6873c99822287730f71",
	greenBlue: "d3eecec5e8c3b1e1bb9bd8bb82cec269c2ca51b2cd3c9fc7288abd1675b10b60a1",
	orangeRed: "fddcaffdcf9bfdc18afdad77fb9562f67d53ee6545e24932d32d1ebf130da70403",
	purpleBlue: "dbdaebc8cee4b1c3de97b7d87bacd15b9fc93a90c01e7fb70b70ab056199045281",
	purpleBlueGreen: "dbd8eac8cee4b0c3de93b7d872acd1549fc83892bb1c88a3097f8702736b016353",
	purpleRed: "dcc9e2d3b3d7ce9eccd186c0da6bb2e14da0e23189d91e6fc61159ab07498f023a",
	redPurple: "fccfccfcbec0faa9b8f98faff571a5ec539ddb3695c41b8aa908808d0179700174",
	yellowGreen: "e4f4acd1eca0b9e2949ed68880c97c62bb6e47aa5e3297502083440e723b036034",
	yellowOrangeBrown: "feeaa1fedd84fecc63feb746fca031f68921eb7215db5e0bc54c05ab3d038f3204",
	yellowOrangeRed: "fee087fed16ffebd59fea849fd903efc7335f9522bee3423de1b20ca0b22af0225",
	blueOrange: "134b852f78b35da2cb9dcae1d2e5eff2f0ebfce0bafbbf74e8932fc5690d994a07",
	brownBlueGreen: "704108a0651ac79548e3c78af3e6c6eef1eac9e9e48ed1c74da79e187a72025147",
	purpleGreen: "5b1667834792a67fb6c9aed3e6d6e8eff0efd9efd5aedda971bb75368e490e5e29",
	purpleOrange: "4114696647968f83b7b9b4d6dadbebf3eeeafce0bafbbf74e8932fc5690d994a07",
	redBlue: "8c0d25bf363adf745ef4ae91fbdbc9f2efeed2e5ef9dcae15da2cb2f78b3134b85",
	redGrey: "8c0d25bf363adf745ef4ae91fcdccbfaf4f1e2e2e2c0c0c0969696646464343434",
	yellowGreenBlue: "eff9bddbf1b4bde5b594d5b969c5be45b4c22c9ec02182b82163aa23479c1c3185",
	redYellowBlue: "a50026d4322cf16e43fcac64fedd90faf8c1dcf1ecabd6e875abd04a74b4313695",
	redYellowGreen: "a50026d4322cf16e43fcac63fedd8df9f7aed7ee8ea4d86e64bc6122964f006837",
	pinkYellowGreen: "8e0152c0267edd72adf0b3d6faddedf5f3efe1f2cab6de8780bb474f9125276419",
	spectral: "9e0142d13c4bf0704afcac63fedd8dfbf8b0e0f3a1a9dda269bda94288b55e4fa2",
	viridis: "440154470e61481a6c482575472f7d443a834144873d4e8a39568c35608d31688e2d708e2a788e27818e23888e21918d1f988b1fa08822a8842ab07f35b77943bf7154c56866cc5d7ad1518fd744a5db36bcdf27d2e21be9e51afde725",
	magma: "0000040404130b0924150e3720114b2c11603b0f704a107957157e651a80721f817f24828c29819a2e80a8327db6377ac43c75d1426fde4968e95462f1605df76f5cfa7f5efc8f65fe9f6dfeaf78febf84fece91fddea0fcedaffcfdbf",
	inferno: "0000040403130c0826170c3b240c4f330a5f420a68500d6c5d126e6b176e781c6d86216b932667a12b62ae305cbb3755c73e4cd24644dd513ae65c30ed6925f3771af8850ffb9506fca50afcb519fac62df6d645f2e661f3f484fcffa4",
	plasma: "0d088723069033059742039d5002a25d01a66a00a87801a88405a7900da49c179ea72198b12a90ba3488c33d80cb4779d35171da5a69e16462e76e5bed7953f2834cf68f44fa9a3dfca636fdb32ffec029fcce25f9dc24f5ea27f0f921",
	cividis: "00205100235800265d002961012b65042e670831690d346b11366c16396d1c3c6e213f6e26426e2c456e31476e374a6e3c4d6e42506e47536d4c566d51586e555b6e5a5e6e5e616e62646f66676f6a6a706e6d717270717573727976737c79747f7c75827f758682768985778c8877908b78938e789691789a94789e9778a19b78a59e77a9a177aea575b2a874b6ab73bbaf71c0b26fc5b66dc9b96acebd68d3c065d8c462ddc85fe2cb5ce7cf58ebd355f0d652f3da4ff7de4cfae249fce647",
	rainbow: "6e40aa883eb1a43db3bf3cafd83fa4ee4395fe4b83ff576eff6659ff7847ff8c38f3a130e2b72fcfcc36bee044aff05b8ff4576ff65b52f6673af27828ea8d1ddfa319d0b81cbecb23abd82f96e03d82e14c6edb5a5dd0664dbf6e40aa",
	sinebow: "ff4040fc582af47218e78d0bd5a703bfbf00a7d5038de70b72f41858fc2a40ff402afc5818f4720be78d03d5a700bfbf03a7d50b8de71872f42a58fc4040ff582afc7218f48d0be7a703d5bf00bfd503a7e70b8df41872fc2a58ff4040",
	turbo: "23171b32204a3e2a71453493493eae4b49c54a53d7485ee44569ee4074f53c7ff8378af93295f72e9ff42ba9ef28b3e926bce125c5d925cdcf27d5c629dcbc2de3b232e9a738ee9d3ff39347f68950f9805afc7765fd6e70fe667cfd5e88fc5795fb51a1f84badf545b9f140c5ec3cd0e637dae034e4d931ecd12ef4c92bfac029ffb626ffad24ffa223ff9821ff8d1fff821dff771cfd6c1af76118f05616e84b14df4111d5380fcb2f0dc0260ab61f07ac1805a313029b0f00950c00910b00",
	browns: "eedbbdecca96e9b97ae4a865dc9856d18954c7784cc0673fb85536ad44339f3632",
	tealBlues: "bce4d89dd3d181c3cb65b3c245a2b9368fae347da0306a932c5985",
	teals: "bbdfdfa2d4d58ac9c975bcbb61b0af4da5a43799982b8b8c1e7f7f127273006667",
	warmGreys: "dcd4d0cec5c1c0b8b4b3aaa7a59c9998908c8b827f7e7673726866665c5a59504e",
	goldGreen: "f4d166d5ca60b6c35c98bb597cb25760a6564b9c533f8f4f33834a257740146c36",
	goldOrange: "f4d166f8be5cf8aa4cf5983bf3852aef701be2621fd65322c54923b142239e3a26",
	goldRed: "f4d166f6be59f9aa51fc964ef6834bee734ae56249db5247cf4244c43141b71d3e",
	lightGreyRed: "efe9e6e1dad7d5cbc8c8bdb9bbaea9cd967ddc7b43e15f19df4011dc000b",
	lightGreyTeal: "e4eaead6dcddc8ced2b7c2c7a6b4bc64b0bf22a6c32295c11f85be1876bc",
	lightMulti: "e0f1f2c4e9d0b0de9fd0e181f6e072f6c053f3993ef77440ef4a3c",
	lightOrange: "f2e7daf7d5baf9c499fab184fa9c73f68967ef7860e8645bde515bd43d5b",
	lightTealBlue: "e3e9e0c0dccf9aceca7abfc859afc0389fb9328dad2f7ca0276b95255988",
	darkBlue: "3232322d46681a5c930074af008cbf05a7ce25c0dd38daed50f3faffffff",
	darkGold: "3c3c3c584b37725e348c7631ae8b2bcfa424ecc31ef9de30fff184ffffff",
	darkGreen: "3a3a3a215748006f4d048942489e4276b340a6c63dd2d836ffeb2cffffaa",
	darkMulti: "3737371f5287197d8c29a86995ce3fffe800ffffff",
	darkRed: "3434347036339e3c38cc4037e75d1eec8620eeab29f0ce32ffeb2c"
}, Vv = {
	accent: Ll,
	category10: Il,
	category20: "1f77b4aec7e8ff7f0effbb782ca02c98df8ad62728ff98969467bdc5b0d58c564bc49c94e377c2f7b6d27f7f7fc7c7c7bcbd22dbdb8d17becf9edae5",
	category20b: "393b795254a36b6ecf9c9ede6379398ca252b5cf6bcedb9c8c6d31bd9e39e7ba52e7cb94843c39ad494ad6616be7969c7b4173a55194ce6dbdde9ed6",
	category20c: "3182bd6baed69ecae1c6dbefe6550dfd8d3cfdae6bfdd0a231a35474c476a1d99bc7e9c0756bb19e9ac8bcbddcdadaeb636363969696bdbdbdd9d9d9",
	dark2: Rl,
	observable10: zl,
	paired: Bl,
	pastel1: Vl,
	pastel2: Hl,
	set1: Ul,
	set2: Wl,
	set3: Gl,
	tableau10: "4c78a8f58518e4575672b7b254a24beeca3bb279a2ff9da69d755dbab0ac",
	tableau20: "4c78a89ecae9f58518ffbf7954a24b88d27ab79a20f2cf5b43989483bcb6e45756ff9d9879706ebab0acd67195fcbfd2b279a2d6a5c99e765fd8b5a5"
};
function Hv(e) {
	if (P(e)) return e;
	let t = e.length / 6 | 0, n = Array(t);
	for (let r = 0; r < t;) n[r] = "#" + e.slice(r * 6, ++r * 6);
	return n;
}
function Uv(e, t) {
	for (let n in e) Gv(n, t(e[n]));
}
var Wv = {};
Uv(Vv, Hv), Uv(Bv, (e) => Fv(Hv(e)));
function Gv(e, t) {
	return e = e && e.toLowerCase(), arguments.length > 1 ? (Wv[e] = t, this) : Wv[e];
}
var Kv = (e) => P(e) ? e.map((e) => String(e)) : String(e), qv = (e, t) => e[1] - t[1], Jv = (e, t) => t[1] - e[1];
function Yv(e, t, n) {
	let r;
	return rd(t) && (e.bins && (t = Math.max(t, e.bins.length)), n != null && (t = Math.min(t, Math.floor(fd(e.domain()) / n || 1) + 1))), F(t) && (r = t.step, t = t.interval), z(t) && (t = e.type === "time" ? _f(t) : e.type == "utc" ? vf(t) : N("Only time and utc scales accept interval strings."), r && (t = t.every(r))), t;
}
function Xv(e, t, n) {
	let r = e.range(), i = r[0], a = vu(r), o = qv;
	if (i > a && (r = a, a = i, i = r, o = Jv), i = Math.floor(i), a = Math.ceil(a), t = t.map((t) => [t, e(t)]).filter((e) => i <= e[1] && e[1] <= a).sort(o).map((e) => e[0]), n > 0 && t.length > 1) {
		let e = [t[0], vu(t)];
		for (; t.length > n && t.length >= 3;) t = t.filter((e, t) => !(t % 2));
		t.length < 3 && (t = e);
	}
	return t;
}
function Zv(e, t) {
	return e.bins ? Xv(e, e.bins, t) : e.ticks ? e.ticks(t) : e.domain();
}
function Qv(e, t, n, r, i, a) {
	let o = t.type, s = Kv;
	if (o === "time" || i === "time") s = e.timeFormat(r);
	else if (o === "utc" || i === "utc") s = e.utcFormat(r);
	else if (kv(o)) {
		let i = e.formatFloat(r);
		if (a || t.bins) s = i;
		else {
			let e = $v(t, n, !1);
			s = (t) => e(t) ? i(t) : "";
		}
	} else if (t.tickFormat) {
		let i = t.domain();
		s = e.formatSpan(i[0], i[i.length - 1], n, r);
	} else r && (s = e.format(r));
	return s;
}
function $v(e, t, n) {
	let r = Zv(e, t), i = e.base(), a = Math.log(i), o = Math.max(1, i * t / r.length), s = (e) => {
		let t = e / i ** +Math.round(Math.log(e) / a);
		return t * i < i - .5 && (t *= i), t <= o;
	};
	return n ? r.filter(s) : s;
}
var ey = {
	[Z_]: "quantiles",
	[Q_]: "thresholds",
	[$_]: "domain"
}, ty = {
	[Z_]: "quantiles",
	[Q_]: "domain"
};
function ny(e, t) {
	return e.bins ? ay(e.bins) : e.type === "log" ? $v(e, t, !0) : ey[e.type] ? iy(e[ey[e.type]]()) : Zv(e, t);
}
function ry(e, t, n) {
	let r = t[ty[t.type]](), i = r.length, a = i > 1 ? r[1] - r[0] : r[0], o;
	for (o = 1; o < i; ++o) a = Math.min(a, r[o] - r[o - 1]);
	return e.formatSpan(0, a, 30, n);
}
function iy(e) {
	let t = [-Infinity].concat(e);
	return t.max = Infinity, t;
}
function ay(e) {
	let t = e.slice(0, -1);
	return t.max = vu(e), t;
}
var Pee = (e) => ey[e.type] || e.bins;
function oy(e, t, n, r, i, a, o) {
	let s = ty[t.type] && a !== "time" && a !== "utc" ? ry(e, t, i) : Qv(e, t, n, i, a, o);
	return r === "symbol" && Pee(t) ? Fee(s) : r === "discrete" ? Iee(s) : Lee(s);
}
var Fee = (e) => (t, n, r) => {
	let i = sy(r[n + 1], sy(r.max, Infinity)), a = cy(t, e), o = cy(i, e);
	return a && o ? a + " – " + o : o ? "< " + o : "≥ " + a;
}, sy = (e, t) => e == null ? t : e, Iee = (e) => (t, n) => n ? e(t) : null, Lee = (e) => (t) => e(t), cy = (e, t) => Number.isFinite(e) ? t(e) : null;
function Ree(e) {
	let t = e.domain(), n = t.length - 1, r = +t[0], i = +vu(t), a = i - r;
	if (e.type === "threshold") {
		let e = n ? a / n : .1;
		r -= e, i += e, a = i - r;
	}
	return (e) => (e - r) / a;
}
function zee(e, t, n, r) {
	let i = r || t.type;
	return z(n) && Av(i) && (n = n.replace(/%a/g, "%A").replace(/%b/g, "%B")), !n && i === "time" ? e.timeFormat("%A, %d %B %Y, %X") : !n && i === "utc" ? e.utcFormat("%A, %d %B %Y, %X UTC") : oy(e, t, 5, null, n, r, !0);
}
function ly(e, t, n) {
	n = n || {};
	let r = Math.max(3, n.maxlen || 7), i = zee(e, t, n.format, n.formatType);
	if (Ov(t.type)) {
		let e = ny(t).slice(1).map(i), n = e.length;
		return `${n} boundar${n === 1 ? "y" : "ies"}: ${e.join(", ")}`;
	} else if (Dv(t.type)) {
		let e = t.domain(), n = e.length, a = n > r ? e.slice(0, r - 2).map(i).join(", ") + ", ending with " + e.slice(-1).map(i) : e.map(i).join(", ");
		return `${n} value${n === 1 ? "" : "s"}: ${a}`;
	} else {
		let e = t.domain();
		return `values from ${i(e[0])} to ${i(vu(e))}`;
	}
}
//#endregion
//#region ../../node_modules/.pnpm/vega-scenegraph@5.1.0/node_modules/vega-scenegraph/build/vega-scenegraph.js
var uy = 0;
function Bee() {
	uy = 0;
}
var dy = "p_";
function fy(e) {
	return e && e.gradient;
}
function py(e, t, n) {
	let r = e.gradient, i = e.id, a = r === "radial" ? dy : "";
	return i || (i = e.id = "gradient_" + uy++, r === "radial" ? (e.x1 = my(e.x1, .5), e.y1 = my(e.y1, .5), e.r1 = my(e.r1, 0), e.x2 = my(e.x2, .5), e.y2 = my(e.y2, .5), e.r2 = my(e.r2, .5), a = dy) : (e.x1 = my(e.x1, 0), e.y1 = my(e.y1, 0), e.x2 = my(e.x2, 1), e.y2 = my(e.y2, 0))), t[i] = e, "url(" + (n || "") + "#" + a + i + ")";
}
function my(e, t) {
	return e == null ? t : e;
}
function hy(e, t) {
	var n = [], r;
	return r = {
		gradient: "linear",
		x1: e ? e[0] : 0,
		y1: e ? e[1] : 0,
		x2: t ? t[0] : 1,
		y2: t ? t[1] : 0,
		stops: n,
		stop: function(e, t) {
			return n.push({
				offset: e,
				color: t
			}), r;
		}
	};
}
var gy = {
	basis: { curve: Pe },
	"basis-closed": { curve: Be },
	"basis-open": { curve: Ve },
	bundle: {
		curve: We,
		tension: "beta",
		value: .85
	},
	cardinal: {
		curve: Je,
		tension: "tension",
		value: 0
	},
	"cardinal-open": {
		curve: Re,
		tension: "tension",
		value: 0
	},
	"cardinal-closed": {
		curve: ze,
		tension: "tension",
		value: 0
	},
	"catmull-rom": {
		curve: aee,
		tension: "alpha",
		value: .5
	},
	"catmull-rom-closed": {
		curve: Ue,
		tension: "alpha",
		value: .5
	},
	"catmull-rom-open": {
		curve: Le,
		tension: "alpha",
		value: .5
	},
	linear: { curve: Ze },
	"linear-closed": { curve: nee },
	monotone: {
		horizontal: qe,
		vertical: Fe
	},
	natural: { curve: He },
	step: { curve: eee },
	"step-after": { curve: ree },
	"step-before": { curve: Ge }
};
function _y(e, t, n) {
	var r = L(gy, e) && gy[e], i = null;
	return r && (i = r.curve || r[t || "vertical"], r.tension && n != null && (i = i[r.tension](n))), i;
}
var Vee = {
	m: 2,
	l: 2,
	h: 1,
	v: 1,
	z: 0,
	c: 6,
	s: 4,
	q: 4,
	t: 2,
	a: 7
}, Hee = /[mlhvzcsqta]([^mlhvzcsqta]+|$)/gi, Uee = /^[+-]?(([0-9]*\.[0-9]+)|([0-9]+\.)|([0-9]+))([eE][+-]?[0-9]+)?/, Wee = /^((\s+,?\s*)|(,\s*))/, Gee = /^[01]/;
function vy(e) {
	let t = [];
	return (e.match(Hee) || []).forEach((e) => {
		let n = e[0], r = n.toLowerCase(), i = Vee[r], a = yy(r, i, e.slice(1).trim()), o = a.length;
		if (o < i || o && o % i !== 0) throw Error("Invalid SVG path, incorrect parameter count");
		if (t.push([n, ...a.slice(0, i)]), o !== i) {
			r === "m" && (n = n === "M" ? "L" : "l");
			for (let e = i; e < o; e += i) t.push([n, ...a.slice(e, e + i)]);
		}
	}), t;
}
function yy(e, t, n) {
	let r = [];
	for (let i = 0; t && i < n.length;) for (let a = 0; a < t; ++a) {
		let t = e === "a" && (a === 3 || a === 4) ? Gee : Uee, o = n.slice(i).match(t);
		if (o === null) throw Error("Invalid SVG path, incorrect parameter type");
		i += o[0].length, r.push(+o[0]);
		let s = n.slice(i).match(Wee);
		s !== null && (i += s[0].length);
	}
	return r;
}
var by = Math.PI / 180, xy = 1e-14, Sy = Math.PI / 2, Cy = Math.PI * 2, wy = Math.sqrt(3) / 2, Ty = {}, Ey = {}, Dy = [].join;
function Oy(e, t, n, r, i, a, o, s, c) {
	let l = Dy.call(arguments);
	if (Ty[l]) return Ty[l];
	let u = o * by, d = Math.sin(u), f = Math.cos(u);
	n = Math.abs(n), r = Math.abs(r);
	let p = f * (s - e) * .5 + d * (c - t) * .5, m = f * (c - t) * .5 - d * (s - e) * .5, h = p * p / (n * n) + m * m / (r * r);
	h > 1 && (h = Math.sqrt(h), n *= h, r *= h);
	let g = f / n, _ = d / n, v = -d / r, y = f / r, b = g * s + _ * c, x = v * s + y * c, S = g * e + _ * t, C = v * e + y * t, w = 1 / ((S - b) * (S - b) + (C - x) * (C - x)) - .25;
	w < 0 && (w = 0);
	let T = Math.sqrt(w);
	a == i && (T = -T);
	let E = .5 * (b + S) - T * (C - x), D = .5 * (x + C) + T * (S - b), O = Math.atan2(x - D, b - E), k = Math.atan2(C - D, S - E) - O;
	k < 0 && a === 1 ? k += Cy : k > 0 && a === 0 && (k -= Cy);
	let ee = Math.ceil(Math.abs(k / (Sy + .001))), te = [];
	for (let e = 0; e < ee; ++e) te[e] = [
		E,
		D,
		O + e * k / ee,
		O + (e + 1) * k / ee,
		n,
		r,
		d,
		f
	];
	return Ty[l] = te;
}
function ky(e) {
	let t = Dy.call(e);
	if (Ey[t]) return Ey[t];
	var n = e[0], r = e[1], i = e[2], a = e[3], o = e[4], s = e[5], c = e[6], l = e[7];
	let u = l * o, d = -c * s, f = c * o, p = l * s, m = Math.cos(i), h = Math.sin(i), g = Math.cos(a), _ = Math.sin(a), v = .5 * (a - i), y = Math.sin(v * .5), b = 8 / 3 * y * y / Math.sin(v), x = n + m - b * h, S = r + h + b * m, C = n + g, w = r + _, T = C + b * _, E = w - b * g;
	return Ey[t] = [
		u * x + d * S,
		f * x + p * S,
		u * T + d * E,
		f * T + p * E,
		u * C + d * w,
		f * C + p * w
	];
}
var Ay = [
	"l",
	0,
	0,
	0,
	0,
	0,
	0,
	0
];
function jy(e, t, n) {
	let r = Ay[0] = e[0];
	if (r === "a" || r === "A") Ay[1] = t * e[1], Ay[2] = n * e[2], Ay[3] = e[3], Ay[4] = e[4], Ay[5] = e[5], Ay[6] = t * e[6], Ay[7] = n * e[7];
	else if (r === "h" || r === "H") Ay[1] = t * e[1];
	else if (r === "v" || r === "V") Ay[1] = n * e[1];
	else for (var i = 1, a = e.length; i < a; ++i) Ay[i] = (i % 2 == 1 ? t : n) * e[i];
	return Ay;
}
function My(e, t, n, r, i, a) {
	var o, s = null, c = 0, l = 0, u = 0, d = 0, f, p, m, h, g = 0, _ = 0;
	n == null && (n = 0), r == null && (r = 0), i == null && (i = 1), a == null && (a = i), e.beginPath && e.beginPath();
	for (var v = 0, y = t.length; v < y; ++v) {
		switch (o = t[v], (i !== 1 || a !== 1) && (o = jy(o, i, a)), o[0]) {
			case "l":
				c += o[1], l += o[2], e.lineTo(c + n, l + r);
				break;
			case "L":
				c = o[1], l = o[2], e.lineTo(c + n, l + r);
				break;
			case "h":
				c += o[1], e.lineTo(c + n, l + r);
				break;
			case "H":
				c = o[1], e.lineTo(c + n, l + r);
				break;
			case "v":
				l += o[1], e.lineTo(c + n, l + r);
				break;
			case "V":
				l = o[1], e.lineTo(c + n, l + r);
				break;
			case "m":
				c += o[1], l += o[2], g = c, _ = l, e.moveTo(c + n, l + r);
				break;
			case "M":
				c = o[1], l = o[2], g = c, _ = l, e.moveTo(c + n, l + r);
				break;
			case "c":
				f = c + o[5], p = l + o[6], u = c + o[3], d = l + o[4], e.bezierCurveTo(c + o[1] + n, l + o[2] + r, u + n, d + r, f + n, p + r), c = f, l = p;
				break;
			case "C":
				c = o[5], l = o[6], u = o[3], d = o[4], e.bezierCurveTo(o[1] + n, o[2] + r, u + n, d + r, c + n, l + r);
				break;
			case "s":
				f = c + o[3], p = l + o[4], u = 2 * c - u, d = 2 * l - d, e.bezierCurveTo(u + n, d + r, c + o[1] + n, l + o[2] + r, f + n, p + r), u = c + o[1], d = l + o[2], c = f, l = p;
				break;
			case "S":
				f = o[3], p = o[4], u = 2 * c - u, d = 2 * l - d, e.bezierCurveTo(u + n, d + r, o[1] + n, o[2] + r, f + n, p + r), c = f, l = p, u = o[1], d = o[2];
				break;
			case "q":
				f = c + o[3], p = l + o[4], u = c + o[1], d = l + o[2], e.quadraticCurveTo(u + n, d + r, f + n, p + r), c = f, l = p;
				break;
			case "Q":
				f = o[3], p = o[4], e.quadraticCurveTo(o[1] + n, o[2] + r, f + n, p + r), c = f, l = p, u = o[1], d = o[2];
				break;
			case "t":
				f = c + o[1], p = l + o[2], s[0].match(/[QqTt]/) === null ? (u = c, d = l) : s[0] === "t" ? (u = 2 * c - m, d = 2 * l - h) : s[0] === "q" && (u = 2 * c - u, d = 2 * l - d), m = u, h = d, e.quadraticCurveTo(u + n, d + r, f + n, p + r), c = f, l = p, u = c + o[1], d = l + o[2];
				break;
			case "T":
				f = o[1], p = o[2], u = 2 * c - u, d = 2 * l - d, e.quadraticCurveTo(u + n, d + r, f + n, p + r), c = f, l = p;
				break;
			case "a":
				Ny(e, c + n, l + r, [
					o[1],
					o[2],
					o[3],
					o[4],
					o[5],
					o[6] + c + n,
					o[7] + l + r
				]), c += o[6], l += o[7];
				break;
			case "A":
				Ny(e, c + n, l + r, [
					o[1],
					o[2],
					o[3],
					o[4],
					o[5],
					o[6] + n,
					o[7] + r
				]), c = o[6], l = o[7];
				break;
			case "z":
			case "Z":
				c = g, l = _, e.closePath();
				break;
		}
		s = o;
	}
}
function Ny(e, t, n, r) {
	let i = Oy(r[5], r[6], r[0], r[1], r[3], r[4], r[2], t, n);
	for (let t = 0; t < i.length; ++t) {
		let n = ky(i[t]);
		e.bezierCurveTo(n[0], n[1], n[2], n[3], n[4], n[5]);
	}
}
var Py = .5773502691896257, Fy = {
	circle: { draw: function(e, t) {
		let n = Math.sqrt(t) / 2;
		e.moveTo(n, 0), e.arc(0, 0, n, 0, Cy);
	} },
	cross: { draw: function(e, t) {
		var n = Math.sqrt(t) / 2, r = n / 2.5;
		e.moveTo(-n, -r), e.lineTo(-n, r), e.lineTo(-r, r), e.lineTo(-r, n), e.lineTo(r, n), e.lineTo(r, r), e.lineTo(n, r), e.lineTo(n, -r), e.lineTo(r, -r), e.lineTo(r, -n), e.lineTo(-r, -n), e.lineTo(-r, -r), e.closePath();
	} },
	diamond: { draw: function(e, t) {
		let n = Math.sqrt(t) / 2;
		e.moveTo(-n, 0), e.lineTo(0, -n), e.lineTo(n, 0), e.lineTo(0, n), e.closePath();
	} },
	square: { draw: function(e, t) {
		var n = Math.sqrt(t), r = -n / 2;
		e.rect(r, r, n, n);
	} },
	arrow: { draw: function(e, t) {
		var n = Math.sqrt(t) / 2, r = n / 7, i = n / 2.5, a = n / 8;
		e.moveTo(-r, n), e.lineTo(r, n), e.lineTo(r, -a), e.lineTo(i, -a), e.lineTo(0, -n), e.lineTo(-i, -a), e.lineTo(-r, -a), e.closePath();
	} },
	wedge: { draw: function(e, t) {
		var n = Math.sqrt(t) / 2, r = wy * n, i = r - n * Py, a = n / 4;
		e.moveTo(0, -r - i), e.lineTo(-a, r - i), e.lineTo(a, r - i), e.closePath();
	} },
	triangle: { draw: function(e, t) {
		var n = Math.sqrt(t) / 2, r = wy * n, i = r - n * Py;
		e.moveTo(0, -r - i), e.lineTo(-n, r - i), e.lineTo(n, r - i), e.closePath();
	} },
	"triangle-up": { draw: function(e, t) {
		var n = Math.sqrt(t) / 2, r = wy * n;
		e.moveTo(0, -r), e.lineTo(-n, r), e.lineTo(n, r), e.closePath();
	} },
	"triangle-down": { draw: function(e, t) {
		var n = Math.sqrt(t) / 2, r = wy * n;
		e.moveTo(0, r), e.lineTo(-n, -r), e.lineTo(n, -r), e.closePath();
	} },
	"triangle-right": { draw: function(e, t) {
		var n = Math.sqrt(t) / 2, r = wy * n;
		e.moveTo(r, 0), e.lineTo(-r, -n), e.lineTo(-r, n), e.closePath();
	} },
	"triangle-left": { draw: function(e, t) {
		var n = Math.sqrt(t) / 2, r = wy * n;
		e.moveTo(-r, 0), e.lineTo(r, -n), e.lineTo(r, n), e.closePath();
	} },
	stroke: { draw: function(e, t) {
		let n = Math.sqrt(t) / 2;
		e.moveTo(-n, 0), e.lineTo(n, 0);
	} }
};
function Iy(e) {
	return L(Fy, e) ? Fy[e] : Ry(e);
}
var Ly = {};
function Ry(e) {
	if (!L(Ly, e)) {
		let t = vy(e);
		Ly[e] = { draw: function(e, n) {
			My(e, t, 0, 0, Math.sqrt(n) / 2);
		} };
	}
	return Ly[e];
}
var zy = .448084975506;
function By(e) {
	return e.x;
}
function Vy(e) {
	return e.y;
}
function Hy(e) {
	return e.width;
}
function Uy(e) {
	return e.height;
}
function Wy(e) {
	return typeof e == "function" ? e : () => +e;
}
function Gy(e, t, n) {
	return Math.max(t, Math.min(e, n));
}
function Ky() {
	var e = By, t = Vy, n = Hy, r = Uy, i = Wy(0), a = i, o = i, s = i, c = null;
	function l(l, u, d) {
		var f, p = u == null ? +e.call(this, l) : u, m = d == null ? +t.call(this, l) : d, h = +n.call(this, l), g = +r.call(this, l), _ = Math.min(h, g) / 2, v = Gy(+i.call(this, l), 0, _), y = Gy(+a.call(this, l), 0, _), b = Gy(+o.call(this, l), 0, _), x = Gy(+s.call(this, l), 0, _);
		if (c || (c = f = Ae()), v <= 0 && y <= 0 && b <= 0 && x <= 0) c.rect(p, m, h, g);
		else {
			var S = p + h, C = m + g;
			c.moveTo(p + v, m), c.lineTo(S - y, m), c.bezierCurveTo(S - zy * y, m, S, m + zy * y, S, m + y), c.lineTo(S, C - x), c.bezierCurveTo(S, C - zy * x, S - zy * x, C, S - x, C), c.lineTo(p + b, C), c.bezierCurveTo(p + zy * b, C, p, C - zy * b, p, C - b), c.lineTo(p, m + v), c.bezierCurveTo(p, m + zy * v, p + zy * v, m, p + v, m), c.closePath();
		}
		if (f) return c = null, f + "" || null;
	}
	return l.x = function(t) {
		return arguments.length ? (e = Wy(t), l) : e;
	}, l.y = function(e) {
		return arguments.length ? (t = Wy(e), l) : t;
	}, l.width = function(e) {
		return arguments.length ? (n = Wy(e), l) : n;
	}, l.height = function(e) {
		return arguments.length ? (r = Wy(e), l) : r;
	}, l.cornerRadius = function(e, t, n, r) {
		return arguments.length ? (i = Wy(e), a = t == null ? i : Wy(t), s = n == null ? i : Wy(n), o = r == null ? a : Wy(r), l) : i;
	}, l.context = function(e) {
		return arguments.length ? (c = e == null ? null : e, l) : c;
	}, l;
}
function qy() {
	var e, t, n, r, i = null, a, o, s, c;
	function l(e, t, n) {
		let r = n / 2;
		if (a) {
			var l = s - t, u = e - o;
			if (l || u) {
				var d = Math.hypot(l, u), f = (l /= d) * c, p = (u /= d) * c, m = Math.atan2(u, l);
				i.moveTo(o - f, s - p), i.lineTo(e - l * r, t - u * r), i.arc(e, t, r, m - Math.PI, m), i.lineTo(o + f, s + p), i.arc(o, s, c, m, m + Math.PI);
			} else i.arc(e, t, r, 0, Cy);
			i.closePath();
		} else a = 1;
		o = e, s = t, c = r;
	}
	function u(o) {
		var s, c = o.length, u, d = !1, f;
		for (i == null && (i = f = Ae()), s = 0; s <= c; ++s) !(s < c && r(u = o[s], s, o)) === d && (d = !d) && (a = 0), d && l(+e(u, s, o), +t(u, s, o), +n(u, s, o));
		if (f) return i = null, f + "" || null;
	}
	return u.x = function(t) {
		return arguments.length ? (e = t, u) : e;
	}, u.y = function(e) {
		return arguments.length ? (t = e, u) : t;
	}, u.size = function(e) {
		return arguments.length ? (n = e, u) : n;
	}, u.defined = function(e) {
		return arguments.length ? (r = e, u) : r;
	}, u.context = function(e) {
		return arguments.length ? (i = e == null ? null : e, u) : i;
	}, u;
}
function Jy(e, t) {
	return e == null ? t : e;
}
var Yy = (e) => e.x || 0, Xy = (e) => e.y || 0, Zy = (e) => e.width || 0, Qy = (e) => e.height || 0, $y = (e) => (e.x || 0) + (e.width || 0), eb = (e) => (e.y || 0) + (e.height || 0), tb = (e) => e.startAngle || 0, nb = (e) => e.endAngle || 0, rb = (e) => e.padAngle || 0, ib = (e) => e.innerRadius || 0, ab = (e) => e.outerRadius || 0, ob = (e) => e.cornerRadius || 0, sb = (e) => Jy(e.cornerRadiusTopLeft, e.cornerRadius) || 0, cb = (e) => Jy(e.cornerRadiusTopRight, e.cornerRadius) || 0, lb = (e) => Jy(e.cornerRadiusBottomRight, e.cornerRadius) || 0, ub = (e) => Jy(e.cornerRadiusBottomLeft, e.cornerRadius) || 0, db = (e) => Jy(e.size, 64), fb = (e) => e.size || 1, pb = (e) => e.defined !== !1, mb = (e) => Iy(e.shape || "circle"), hb = yt().startAngle(tb).endAngle(nb).padAngle(rb).innerRadius(ib).outerRadius(ab).cornerRadius(ob), gb = Kl().x(Yy).y1(Xy).y0(eb).defined(pb), _b = Kl().y(Xy).x1(Yy).x0($y).defined(pb), vb = Xe().x(Yy).y(Xy).defined(pb), yb = Ky().x(Yy).y(Xy).width(Zy).height(Qy).cornerRadius(sb, cb, lb, ub), bb = Jl().type(mb).size(db), xb = qy().x(Yy).y(Xy).defined(pb).size(fb);
function Sb(e) {
	return e.cornerRadius || e.cornerRadiusTopLeft || e.cornerRadiusTopRight || e.cornerRadiusBottomRight || e.cornerRadiusBottomLeft;
}
function Cb(e, t) {
	return hb.context(e)(t);
}
function wb(e, t) {
	let n = t[0], r = n.interpolate || "linear";
	return (n.orient === "horizontal" ? _b : gb).curve(_y(r, n.orient, n.tension)).context(e)(t);
}
function Tb(e, t) {
	let n = t[0], r = n.interpolate || "linear";
	return vb.curve(_y(r, n.orient, n.tension)).context(e)(t);
}
function Eb(e, t, n, r) {
	return yb.context(e)(t, n, r);
}
function Db(e, t) {
	return (t.mark.shape || t.shape).context(e)(t);
}
function Ob(e, t) {
	return bb.context(e)(t);
}
function kb(e, t) {
	return xb.context(e)(t);
}
var Ab = 1;
function jb() {
	Ab = 1;
}
function Mb(e, t, n) {
	var r = t.clip, i = e._defs, a = t.clip_id || (t.clip_id = "clip" + Ab++), o = i.clipping[a] || (i.clipping[a] = { id: a });
	return Ru(r) ? o.path = r(null) : Sb(n) ? o.path = Eb(null, n, 0, 0) : (o.width = n.width || 0, o.height = n.height || 0), "url(#" + a + ")";
}
function Nb(e) {
	this.clear(), e && this.union(e);
}
Nb.prototype = {
	clone() {
		return new Nb(this);
	},
	clear() {
		return this.x1 = +Number.MAX_VALUE, this.y1 = +Number.MAX_VALUE, this.x2 = -Number.MAX_VALUE, this.y2 = -Number.MAX_VALUE, this;
	},
	empty() {
		return this.x1 === +Number.MAX_VALUE && this.y1 === +Number.MAX_VALUE && this.x2 === -Number.MAX_VALUE && this.y2 === -Number.MAX_VALUE;
	},
	equals(e) {
		return this.x1 === e.x1 && this.y1 === e.y1 && this.x2 === e.x2 && this.y2 === e.y2;
	},
	set(e, t, n, r) {
		return n < e ? (this.x2 = e, this.x1 = n) : (this.x1 = e, this.x2 = n), r < t ? (this.y2 = t, this.y1 = r) : (this.y1 = t, this.y2 = r), this;
	},
	add(e, t) {
		return e < this.x1 && (this.x1 = e), t < this.y1 && (this.y1 = t), e > this.x2 && (this.x2 = e), t > this.y2 && (this.y2 = t), this;
	},
	expand(e) {
		return this.x1 -= e, this.y1 -= e, this.x2 += e, this.y2 += e, this;
	},
	round() {
		return this.x1 = Math.floor(this.x1), this.y1 = Math.floor(this.y1), this.x2 = Math.ceil(this.x2), this.y2 = Math.ceil(this.y2), this;
	},
	scale(e) {
		return this.x1 *= e, this.y1 *= e, this.x2 *= e, this.y2 *= e, this;
	},
	translate(e, t) {
		return this.x1 += e, this.x2 += e, this.y1 += t, this.y2 += t, this;
	},
	rotate(e, t, n) {
		let r = this.rotatedPoints(e, t, n);
		return this.clear().add(r[0], r[1]).add(r[2], r[3]).add(r[4], r[5]).add(r[6], r[7]);
	},
	rotatedPoints(e, t, n) {
		var { x1: r, y1: i, x2: a, y2: o } = this, s = Math.cos(e), c = Math.sin(e), l = t - t * s + n * c, u = n - t * c - n * s;
		return [
			s * r - c * i + l,
			c * r + s * i + u,
			s * r - c * o + l,
			c * r + s * o + u,
			s * a - c * i + l,
			c * a + s * i + u,
			s * a - c * o + l,
			c * a + s * o + u
		];
	},
	union(e) {
		return e.x1 < this.x1 && (this.x1 = e.x1), e.y1 < this.y1 && (this.y1 = e.y1), e.x2 > this.x2 && (this.x2 = e.x2), e.y2 > this.y2 && (this.y2 = e.y2), this;
	},
	intersect(e) {
		return e.x1 > this.x1 && (this.x1 = e.x1), e.y1 > this.y1 && (this.y1 = e.y1), e.x2 < this.x2 && (this.x2 = e.x2), e.y2 < this.y2 && (this.y2 = e.y2), this;
	},
	encloses(e) {
		return e && this.x1 <= e.x1 && this.x2 >= e.x2 && this.y1 <= e.y1 && this.y2 >= e.y2;
	},
	alignsWith(e) {
		return e && (this.x1 == e.x1 || this.x2 == e.x2 || this.y1 == e.y1 || this.y2 == e.y2);
	},
	intersects(e) {
		return e && !(this.x2 < e.x1 || this.x1 > e.x2 || this.y2 < e.y1 || this.y1 > e.y2);
	},
	contains(e, t) {
		return !(e < this.x1 || e > this.x2 || t < this.y1 || t > this.y2);
	},
	width() {
		return this.x2 - this.x1;
	},
	height() {
		return this.y2 - this.y1;
	}
};
function Pb(e) {
	this.mark = e, this.bounds = this.bounds || new Nb();
}
function Fb(e) {
	Pb.call(this, e), this.items = this.items || [];
}
R(Fb, Pb);
var Ib = class {
	constructor(e) {
		this._pending = 0, this._loader = e || Mp();
	}
	pending() {
		return this._pending;
	}
	sanitizeURL(e) {
		let t = this;
		return Lb(t), t._loader.sanitize(e, { context: "href" }).then((e) => (Rb(t), e)).catch(() => (Rb(t), null));
	}
	loadImage(e) {
		let t = this, n = H_();
		return Lb(t), t._loader.sanitize(e, { context: "image" }).then((e) => {
			let r = e.href;
			if (!r || !n) throw { url: r };
			let i = new n(), a = L(e, "crossOrigin") ? e.crossOrigin : "anonymous";
			return a != null && (i.crossOrigin = a), i.onload = () => Rb(t), i.onerror = () => Rb(t), i.src = r, i;
		}).catch((e) => (Rb(t), {
			complete: !1,
			width: 0,
			height: 0,
			src: e && e.url || ""
		}));
	}
	ready() {
		let e = this;
		return new Promise((t) => {
			function n(r) {
				e.pending() ? setTimeout(() => {
					n(!0);
				}, 10) : t(r);
			}
			n(!1);
		});
	}
};
function Lb(e) {
	e._pending += 1;
}
function Rb(e) {
	--e._pending;
}
function zb(e, t, n) {
	if (t.stroke && t.opacity !== 0 && t.strokeOpacity !== 0) {
		let r = t.strokeWidth == null ? 1 : +t.strokeWidth;
		e.expand(r + (n ? Bb(t, r) : 0));
	}
	return e;
}
function Bb(e, t) {
	return e.strokeJoin && e.strokeJoin !== "miter" ? 0 : t;
}
var Vb = Cy - 1e-8, Hb, Ub, Wb, Gb, Kb, qb, Jb, Yb, Xb = (e, t) => Hb.add(e, t), Zb = (e, t) => Xb(Ub = e, Wb = t), Qb = (e) => Xb(e, Hb.y1), $b = (e) => Xb(Hb.x1, e), ex = (e, t) => Kb * e + Jb * t, tx = (e, t) => qb * e + Yb * t, nx = (e, t) => Xb(ex(e, t), tx(e, t)), rx = (e, t) => Zb(ex(e, t), tx(e, t));
function ix(e, t) {
	return Hb = e, t ? (Gb = t * by, Kb = Yb = Math.cos(Gb), qb = Math.sin(Gb), Jb = -qb) : (Kb = Yb = 1, Gb = qb = Jb = 0), ax;
}
var ax = {
	beginPath() {},
	closePath() {},
	moveTo: rx,
	lineTo: rx,
	rect(e, t, n, r) {
		Gb ? (nx(e + n, t), nx(e + n, t + r), nx(e, t + r), rx(e, t)) : (Xb(e + n, t + r), Zb(e, t));
	},
	quadraticCurveTo(e, t, n, r) {
		let i = ex(e, t), a = tx(e, t), o = ex(n, r), s = tx(n, r);
		ox(Ub, i, o, Qb), ox(Wb, a, s, $b), Zb(o, s);
	},
	bezierCurveTo(e, t, n, r, i, a) {
		let o = ex(e, t), s = tx(e, t), c = ex(n, r), l = tx(n, r), u = ex(i, a), d = tx(i, a);
		sx(Ub, o, c, u, Qb), sx(Wb, s, l, d, $b), Zb(u, d);
	},
	arc(e, t, n, r, i, a) {
		if (r += Gb, i += Gb, Ub = n * Math.cos(i) + e, Wb = n * Math.sin(i) + t, Math.abs(i - r) > Vb) Xb(e - n, t - n), Xb(e + n, t + n);
		else {
			let o = (r) => Xb(n * Math.cos(r) + e, n * Math.sin(r) + t), s, c;
			if (o(r), o(i), i !== r) if (r %= Cy, r < 0 && (r += Cy), i %= Cy, i < 0 && (i += Cy), i < r && (a = !a, s = r, r = i, i = s), a) for (i -= Cy, s = r - r % Sy, c = 0; c < 4 && s > i; ++c, s -= Sy) o(s);
			else for (s = r - r % Sy + Sy, c = 0; c < 4 && s < i; ++c, s += Sy) o(s);
		}
	}
};
function ox(e, t, n, r) {
	let i = (e - t) / (e + n - 2 * t);
	0 < i && i < 1 && r(e + (t - e) * i);
}
function sx(e, t, n, r, i) {
	let a = r - e + 3 * t - 3 * n, o = e + n - 2 * t, s = e - t, c = 0, l = 0, u;
	Math.abs(a) > xy ? (u = o * o + s * a, u >= 0 && (u = Math.sqrt(u), c = (-o + u) / a, l = (-o - u) / a)) : c = .5 * s / o, 0 < c && c < 1 && i(cx(c, e, t, n, r)), 0 < l && l < 1 && i(cx(l, e, t, n, r));
}
function cx(e, t, n, r, i) {
	let a = 1 - e, o = a * a, s = e * e;
	return o * a * t + 3 * o * e * n + 3 * a * s * r + s * e * i;
}
var lx = (lx = V_(1, 1)) ? lx.getContext("2d") : null, ux = new Nb();
function dx(e) {
	return function(t, n) {
		if (!lx) return !0;
		e(lx, t), ux.clear().union(t.bounds).intersect(n).round();
		let { x1: r, y1: i, x2: a, y2: o } = ux;
		for (let e = i; e <= o; ++e) for (let t = r; t <= a; ++t) if (lx.isPointInPath(t, e)) return !0;
		return !1;
	};
}
function fx(e, t) {
	return t.contains(e.x || 0, e.y || 0);
}
function px(e, t) {
	let n = e.x || 0, r = e.y || 0, i = e.width || 0, a = e.height || 0;
	return t.intersects(ux.set(n, r, n + i, r + a));
}
function mx(e, t) {
	let n = e.x || 0, r = e.y || 0;
	return hx(t, n, r, e.x2 == null ? n : e.x2, e.y2 == null ? r : e.y2);
}
function hx(e, t, n, r, i) {
	let { x1: a, y1: o, x2: s, y2: c } = e, l = r - t, u = i - n, d = 0, f = 1, p, m, h, g;
	for (g = 0; g < 4; ++g) {
		if (g === 0 && (p = -l, m = -(a - t)), g === 1 && (p = l, m = s - t), g === 2 && (p = -u, m = -(o - n)), g === 3 && (p = u, m = c - n), Math.abs(p) < 1e-10 && m < 0) return !1;
		if (h = m / p, p < 0) {
			if (h > f) return !1;
			h > d && (d = h);
		} else if (p > 0) {
			if (h < d) return !1;
			h < f && (f = h);
		}
	}
	return !0;
}
function gx(e, t) {
	e.globalCompositeOperation = t.blend || "source-over";
}
function _x(e, t) {
	return e == null ? t : e;
}
function vx(e, t) {
	let n = t.length;
	for (let r = 0; r < n; ++r) e.addColorStop(t[r].offset, t[r].color);
	return e;
}
function yx(e, t, n) {
	let r = n.width(), i = n.height(), a;
	if (t.gradient === "radial") a = e.createRadialGradient(n.x1 + _x(t.x1, .5) * r, n.y1 + _x(t.y1, .5) * i, Math.max(r, i) * _x(t.r1, 0), n.x1 + _x(t.x2, .5) * r, n.y1 + _x(t.y2, .5) * i, Math.max(r, i) * _x(t.r2, .5));
	else {
		let o = _x(t.x1, 0), s = _x(t.y1, 0), c = _x(t.x2, 1), l = _x(t.y2, 0);
		if (o === c || s === l || r === i) a = e.createLinearGradient(n.x1 + o * r, n.y1 + s * i, n.x1 + c * r, n.y1 + l * i);
		else {
			let n = V_(Math.ceil(r), Math.ceil(i)), a = n.getContext("2d");
			return a.scale(r, i), a.fillStyle = vx(a.createLinearGradient(o, s, c, l), t.stops), a.fillRect(0, 0, r, i), e.createPattern(n, "no-repeat");
		}
	}
	return vx(a, t.stops);
}
function bx(e, t, n) {
	return fy(n) ? yx(e, n, t.bounds) : n;
}
function xx(e, t, n) {
	return n *= t.fillOpacity == null ? 1 : t.fillOpacity, n > 0 ? (e.globalAlpha = n, e.fillStyle = bx(e, t, t.fill), !0) : !1;
}
var Sx = [];
function Cx(e, t, n) {
	var r = (r = t.strokeWidth) == null ? 1 : r;
	return r <= 0 ? !1 : (n *= t.strokeOpacity == null ? 1 : t.strokeOpacity, n > 0 ? (e.globalAlpha = n, e.strokeStyle = bx(e, t, t.stroke), e.lineWidth = r, e.lineCap = t.strokeCap || "butt", e.lineJoin = t.strokeJoin || "miter", e.miterLimit = t.strokeMiterLimit || 10, e.setLineDash && (e.setLineDash(t.strokeDash || Sx), e.lineDashOffset = t.strokeDashOffset || 0), !0) : !1);
}
function wx(e, t) {
	return e.zindex - t.zindex || e.index - t.index;
}
function Tx(e) {
	if (!e.zdirty) return e.zitems;
	var t = e.items, n = [], r, i, a;
	for (i = 0, a = t.length; i < a; ++i) r = t[i], r.index = i, r.zindex && n.push(r);
	return e.zdirty = !1, e.zitems = n.sort(wx);
}
function Ex(e, t) {
	var n = e.items, r, i;
	if (!n || !n.length) return;
	let a = Tx(e);
	if (a && a.length) {
		for (r = 0, i = n.length; r < i; ++r) n[r].zindex || t(n[r]);
		n = a;
	}
	for (r = 0, i = n.length; r < i; ++r) t(n[r]);
}
function Dx(e, t) {
	var n = e.items, r, i;
	if (!n || !n.length) return null;
	let a = Tx(e);
	for (a && a.length && (n = a), i = n.length; --i >= 0;) if (r = t(n[i])) return r;
	if (n === a) {
		for (n = e.items, i = n.length; --i >= 0;) if (!n[i].zindex && (r = t(n[i]))) return r;
	}
	return null;
}
function Ox(e) {
	return function(t, n, r) {
		Ex(n, (n) => {
			(!r || r.intersects(n.bounds)) && Ax(e, t, n, n);
		});
	};
}
function kx(e) {
	return function(t, n, r) {
		n.items.length && (!r || r.intersects(n.bounds)) && Ax(e, t, n.items[0], n.items);
	};
}
function Ax(e, t, n, r) {
	var i = n.opacity == null ? 1 : n.opacity;
	i !== 0 && (e(t, r) || (gx(t, n), n.fill && xx(t, n, i) && t.fill(), n.stroke && Cx(t, n, i) && t.stroke()));
}
function jx(e) {
	return e = e || lu, function(t, n, r, i, a, o) {
		return r *= t.pixelRatio, i *= t.pixelRatio, Dx(n, (n) => {
			let s = n.bounds;
			if (!(s && !s.contains(a, o) || !s) && e(t, n, r, i, a, o)) return n;
		});
	};
}
function Mx(e, t) {
	return function(n, r, i, a) {
		var o = Array.isArray(r) ? r[0] : r, s = t == null ? o.fill : t, c = o.stroke && n.isPointInStroke, l, u;
		return c && (l = o.strokeWidth, u = o.strokeCap, n.lineWidth = l == null ? 1 : l, n.lineCap = u == null ? "butt" : u), e(n, r) ? !1 : s && n.isPointInPath(i, a) || c && n.isPointInStroke(i, a);
	};
}
function Nx(e) {
	return jx(Mx(e));
}
function Px(e, t) {
	return "translate(" + e + "," + t + ")";
}
function Fx(e) {
	return "rotate(" + e + ")";
}
function Ix(e, t) {
	return "scale(" + e + "," + t + ")";
}
function Lx(e) {
	return Px(e.x || 0, e.y || 0);
}
function Rx(e) {
	return Px(e.x || 0, e.y || 0) + (e.angle ? " " + Fx(e.angle) : "");
}
function zx(e) {
	return Px(e.x || 0, e.y || 0) + (e.angle ? " " + Fx(e.angle) : "") + (e.scaleX || e.scaleY ? " " + Ix(e.scaleX || 1, e.scaleY || 1) : "");
}
function Bx(e, t, n) {
	function r(e, n) {
		e("transform", Rx(n)), e("d", t(null, n));
	}
	function i(e, n) {
		return t(ix(e, n.angle), n), zb(e, n).translate(n.x || 0, n.y || 0);
	}
	function a(e, n) {
		var r = n.x || 0, i = n.y || 0, a = n.angle || 0;
		e.translate(r, i), a && e.rotate(a *= by), e.beginPath(), t(e, n), a && e.rotate(-a), e.translate(-r, -i);
	}
	return {
		type: e,
		tag: "path",
		nested: !1,
		attr: r,
		bound: i,
		draw: Ox(a),
		pick: Nx(a),
		isect: n || dx(a)
	};
}
var Vx = Bx("arc", Cb);
function Hx(e, t) {
	for (var n = e[0].orient === "horizontal" ? t[1] : t[0], r = e[0].orient === "horizontal" ? "y" : "x", i = e.length, a = Infinity, o, s; --i >= 0;) e[i].defined !== !1 && (s = Math.abs(e[i][r] - n), s < a && (a = s, o = e[i]));
	return o;
}
function Ux(e, t) {
	for (var n = (e[0].strokeWidth || 1) ** 2, r = e.length, i, a, o; --r >= 0;) if (e[r].defined !== !1 && (i = e[r].x - t[0], a = e[r].y - t[1], o = i * i + a * a, o < n)) return e[r];
	return null;
}
function Wx(e, t) {
	for (var n = e.length, r, i, a; --n >= 0;) if (e[n].defined !== !1 && (r = e[n].x - t[0], i = e[n].y - t[1], a = r * r + i * i, r = e[n].size || 1, a < r * r)) return e[n];
	return null;
}
function Gx(e, t, n) {
	function r(e, n) {
		var r = n.mark.items;
		r.length && e("d", t(null, r));
	}
	function i(e, n) {
		var r = n.items;
		return r.length === 0 ? e : (t(ix(e), r), zb(e, r[0]));
	}
	function a(e, n) {
		e.beginPath(), t(e, n);
	}
	let o = Mx(a);
	function s(e, t, n, r, i, a) {
		var s = t.items, c = t.bounds;
		return !s || !s.length || c && !c.contains(i, a) ? null : (n *= e.pixelRatio, r *= e.pixelRatio, o(e, s, n, r) ? s[0] : null);
	}
	return {
		type: e,
		tag: "path",
		nested: !0,
		attr: r,
		bound: i,
		draw: kx(a),
		pick: s,
		isect: fx,
		tip: n
	};
}
var Kx = Gx("area", wb, Hx);
function qx(e, t) {
	var n = t.clip;
	e.save(), Ru(n) ? (e.beginPath(), n(e), e.clip()) : Jx(e, t.group);
}
function Jx(e, t) {
	e.beginPath(), Sb(t) ? Eb(e, t, 0, 0) : e.rect(0, 0, t.width || 0, t.height || 0), e.clip();
}
function Yx(e) {
	let t = _x(e.strokeWidth, 1);
	return e.strokeOffset == null ? e.stroke && t > .5 && t < 1.5 ? .5 - Math.abs(t - 1) : 0 : e.strokeOffset;
}
function Xx(e, t) {
	e("transform", Lx(t));
}
function Zx(e, t) {
	let n = Yx(t);
	e("d", Eb(null, t, n, n));
}
function Qx(e, t) {
	e("class", "background"), e("aria-hidden", !0), Zx(e, t);
}
function $x(e, t) {
	e("class", "foreground"), e("aria-hidden", !0), t.strokeForeground ? Zx(e, t) : e("d", "");
}
function eS(e, t, n) {
	e("clip-path", t.clip ? Mb(n, t, t) : null);
}
function tS(e, t) {
	if (!t.clip && t.items) {
		let n = t.items, r = n.length;
		for (let t = 0; t < r; ++t) e.union(n[t].bounds);
	}
	return (t.clip || t.width || t.height) && !t.noBound && e.add(0, 0).add(t.width || 0, t.height || 0), zb(e, t), e.translate(t.x || 0, t.y || 0);
}
function nS(e, t, n, r) {
	let i = Yx(t);
	e.beginPath(), Eb(e, t, (n || 0) + i, (r || 0) + i);
}
var rS = Mx(nS), iS = Mx(nS, !1), aS = Mx(nS, !0);
function oS(e, t, n, r) {
	Ex(t, (t) => {
		let i = t.x || 0, a = t.y || 0, o = t.strokeForeground, s = t.opacity == null ? 1 : t.opacity;
		(t.stroke || t.fill) && s && (nS(e, t, i, a), gx(e, t), t.fill && xx(e, t, s) && e.fill(), t.stroke && !o && Cx(e, t, s) && e.stroke()), e.save(), e.translate(i, a), t.clip && Jx(e, t), n && n.translate(-i, -a), Ex(t, (t) => {
			(t.marktype === "group" || r == null || r.includes(t.marktype)) && this.draw(e, t, n, r);
		}), n && n.translate(i, a), e.restore(), o && t.stroke && s && (nS(e, t, i, a), gx(e, t), Cx(e, t, s) && e.stroke());
	});
}
function sS(e, t, n, r, i, a) {
	if (t.bounds && !t.bounds.contains(i, a) || !t.items) return null;
	let o = n * e.pixelRatio, s = r * e.pixelRatio;
	return Dx(t, (c) => {
		let l, u, d, f = c.bounds;
		if (f && !f.contains(i, a)) return;
		u = c.x || 0, d = c.y || 0;
		let p = u + (c.width || 0), m = d + (c.height || 0), h = c.clip;
		if (h && (i < u || i > p || a < d || a > m)) return;
		if (e.save(), e.translate(u, d), u = i - u, d = a - d, h && Sb(c) && !aS(e, c, o, s)) return e.restore(), null;
		let g = c.strokeForeground, _ = t.interactive !== !1;
		return _ && g && c.stroke && iS(e, c, o, s) ? (e.restore(), c) : (l = Dx(c, (e) => cS(e, u, d) ? this.pick(e, n, r, u, d) : null), !l && _ && (c.fill || !g && c.stroke) && rS(e, c, o, s) && (l = c), e.restore(), l || null);
	});
}
function cS(e, t, n) {
	return (e.interactive !== !1 || e.marktype === "group") && e.bounds && e.bounds.contains(t, n);
}
var lS = {
	type: "group",
	tag: "g",
	nested: !1,
	attr: Xx,
	bound: tS,
	draw: oS,
	pick: sS,
	isect: px,
	content: eS,
	background: Qx,
	foreground: $x
}, uS = {
	xmlns: "http://www.w3.org/2000/svg",
	"xmlns:xlink": "http://www.w3.org/1999/xlink",
	version: "1.1"
};
function dS(e, t) {
	var n = e.image;
	return (!n || e.url && e.url !== n.url) && (n = {
		complete: !1,
		width: 0,
		height: 0
	}, t.loadImage(e.url).then((t) => {
		e.image = t, e.image.url = e.url;
	})), n;
}
function fS(e, t) {
	return e.width == null ? !t || !t.width ? 0 : e.aspect !== !1 && e.height ? e.height * t.width / t.height : t.width : e.width;
}
function pS(e, t) {
	return e.height == null ? !t || !t.height ? 0 : e.aspect !== !1 && e.width ? e.width * t.height / t.width : t.height : e.height;
}
function mS(e, t) {
	return e === "center" ? t / 2 : e === "right" ? t : 0;
}
function hS(e, t) {
	return e === "middle" ? t / 2 : e === "bottom" ? t : 0;
}
function gS(e, t, n) {
	let r = dS(t, n), i = fS(t, r), a = pS(t, r), o = (t.x || 0) - mS(t.align, i), s = (t.y || 0) - hS(t.baseline, a);
	e("href", !r.src && r.toDataURL ? r.toDataURL() : r.src || "", uS["xmlns:xlink"], "xlink:href"), e("transform", Px(o, s)), e("width", i), e("height", a), e("preserveAspectRatio", t.aspect === !1 ? "none" : "xMidYMid");
}
function _S(e, t) {
	let n = t.image, r = fS(t, n), i = pS(t, n), a = (t.x || 0) - mS(t.align, r), o = (t.y || 0) - hS(t.baseline, i);
	return e.set(a, o, a + r, o + i);
}
function vS(e, t, n) {
	Ex(t, (t) => {
		if (n && !n.intersects(t.bounds)) return;
		let r = dS(t, this), i = fS(t, r), a = pS(t, r);
		if (i === 0 || a === 0) return;
		let o = (t.x || 0) - mS(t.align, i), s = (t.y || 0) - hS(t.baseline, a), c, l, u, d;
		t.aspect !== !1 && (l = r.width / r.height, u = t.width / t.height, l === l && u === u && l !== u && (u < l ? (d = i / l, s += (a - d) / 2, a = d) : (d = a * l, o += (i - d) / 2, i = d))), (r.complete || r.toDataURL) && (gx(e, t), e.globalAlpha = (c = t.opacity) == null ? 1 : c, e.imageSmoothingEnabled = t.smooth !== !1, e.drawImage(r, o, s, i, a));
	});
}
var yS = {
	type: "image",
	tag: "image",
	nested: !1,
	attr: gS,
	bound: _S,
	draw: vS,
	pick: jx(),
	isect: lu,
	get: dS,
	xOffset: mS,
	yOffset: hS
}, bS = Gx("line", Tb, Ux);
function xS(e, t) {
	var n = t.scaleX || 1, r = t.scaleY || 1;
	(n !== 1 || r !== 1) && e("vector-effect", "non-scaling-stroke"), e("transform", zx(t)), e("d", t.path);
}
function SS(e, t) {
	var n = t.path;
	if (n == null) return !0;
	var r = t.x || 0, i = t.y || 0, a = t.scaleX || 1, o = t.scaleY || 1, s = (t.angle || 0) * by, c = t.pathCache;
	(!c || c.path !== n) && ((t.pathCache = c = vy(n)).path = n), s && e.rotate && e.translate ? (e.translate(r, i), e.rotate(s), My(e, c, 0, 0, a, o), e.rotate(-s), e.translate(-r, -i)) : My(e, c, r, i, a, o);
}
function CS(e, t) {
	return SS(ix(e, t.angle), t) ? e.set(0, 0, 0, 0) : zb(e, t, !0);
}
var wS = {
	type: "path",
	tag: "path",
	nested: !1,
	attr: xS,
	bound: CS,
	draw: Ox(SS),
	pick: Nx(SS),
	isect: dx(SS)
};
function TS(e, t) {
	e("d", Eb(null, t));
}
function ES(e, t) {
	var n, r;
	return zb(e.set(n = t.x || 0, r = t.y || 0, n + t.width || 0, r + t.height || 0), t);
}
function DS(e, t) {
	e.beginPath(), Eb(e, t);
}
var OS = {
	type: "rect",
	tag: "path",
	nested: !1,
	attr: TS,
	bound: ES,
	draw: Ox(DS),
	pick: Nx(DS),
	isect: px
};
function kS(e, t) {
	e("transform", Lx(t)), e("x2", t.x2 == null ? 0 : t.x2 - (t.x || 0)), e("y2", t.y2 == null ? 0 : t.y2 - (t.y || 0));
}
function AS(e, t) {
	var n, r;
	return zb(e.set(n = t.x || 0, r = t.y || 0, t.x2 == null ? n : t.x2, t.y2 == null ? r : t.y2), t);
}
function jS(e, t, n) {
	var r, i, a, o;
	return t.stroke && Cx(e, t, n) ? (r = t.x || 0, i = t.y || 0, a = t.x2 == null ? r : t.x2, o = t.y2 == null ? i : t.y2, e.beginPath(), e.moveTo(r, i), e.lineTo(a, o), !0) : !1;
}
function MS(e, t, n) {
	Ex(t, (t) => {
		if (!(n && !n.intersects(t.bounds))) {
			var r = t.opacity == null ? 1 : t.opacity;
			r && jS(e, t, r) && (gx(e, t), e.stroke());
		}
	});
}
function NS(e, t, n, r) {
	return e.isPointInStroke ? jS(e, t, 1) && e.isPointInStroke(n, r) : !1;
}
var PS = {
	type: "rule",
	tag: "line",
	nested: !1,
	attr: kS,
	bound: AS,
	draw: MS,
	pick: jx(NS),
	isect: mx
}, FS = Bx("shape", Db), IS = Bx("symbol", Ob, fx), LS = cd(), RS = {
	height: WS,
	measureWidth: HS,
	estimateWidth: BS,
	width: BS,
	canvas: zS
};
zS(!0);
function zS(e) {
	RS.width = e && lx ? HS : BS;
}
function BS(e, t) {
	return VS(YS(e, t), WS(e));
}
function VS(e, t) {
	return ~~(.8 * e.length * t);
}
function HS(e, t) {
	return WS(e) <= 0 || !(t = YS(e, t)) ? 0 : US(t, $S(e));
}
function US(e, t) {
	let n = `(${t}) ${e}`, r = LS.get(n);
	return r === void 0 && (lx.font = t, r = lx.measureText(e).width, LS.set(n, r)), r;
}
function WS(e) {
	return e.fontSize == null ? 11 : +e.fontSize || 0;
}
function GS(e) {
	return e.lineHeight == null ? WS(e) + 2 : e.lineHeight;
}
function KS(e) {
	return P(e) ? e.length > 1 ? e : e[0] : e;
}
function qS(e) {
	return KS(e.lineBreak && e.text && !P(e.text) ? e.text.split(e.lineBreak) : e.text);
}
function JS(e) {
	let t = qS(e);
	return (P(t) ? t.length - 1 : 0) * GS(e);
}
function YS(e, t) {
	let n = t == null ? "" : (t + "").trim();
	return e.limit > 0 && n.length ? ZS(e, n) : n;
}
function XS(e) {
	if (RS.width === HS) {
		let t = $S(e);
		return (e) => US(e, t);
	} else if (RS.width === BS) {
		let t = WS(e);
		return (e) => VS(e, t);
	} else return (t) => RS.width(e, t);
}
function ZS(e, t) {
	var n = +e.limit, r = XS(e);
	if (r(t) < n) return t;
	var i = e.ellipsis || "…", a = e.dir === "rtl", o = 0, s = t.length, c;
	if (n -= r(i), a) {
		for (; o < s;) c = o + s >>> 1, r(t.slice(c)) > n ? o = c + 1 : s = c;
		return i + t.slice(o);
	} else {
		for (; o < s;) c = 1 + (o + s >>> 1), r(t.slice(0, c)) < n ? o = c : s = c - 1;
		return t.slice(0, o) + i;
	}
}
function QS(e, t) {
	var n = e.font;
	return (t && n ? String(n).replace(/"/g, "'") : n) || "sans-serif";
}
function $S(e, t) {
	return (e.fontStyle ? e.fontStyle + " " : "") + (e.fontVariant ? e.fontVariant + " " : "") + (e.fontWeight ? e.fontWeight + " " : "") + WS(e) + "px " + QS(e, t);
}
function eC(e) {
	var t = e.baseline, n = WS(e);
	return Math.round(t === "top" ? .79 * n : t === "middle" ? .3 * n : t === "bottom" ? -.21 * n : t === "line-top" ? .29 * n + .5 * GS(e) : t === "line-bottom" ? .29 * n - .5 * GS(e) : 0);
}
var tC = {
	left: "start",
	center: "middle",
	right: "end"
}, nC = new Nb();
function rC(e) {
	var t = e.x || 0, n = e.y || 0, r = e.radius || 0, i;
	return r && (i = (e.theta || 0) - Sy, t += r * Math.cos(i), n += r * Math.sin(i)), nC.x1 = t, nC.y1 = n, nC;
}
function iC(e, t) {
	var n = t.dx || 0, r = (t.dy || 0) + eC(t), i = rC(t), a = i.x1, o = i.y1, s = t.angle || 0, c;
	e("text-anchor", tC[t.align] || "start"), s ? (c = Px(a, o) + " " + Fx(s), (n || r) && (c += " " + Px(n, r))) : c = Px(a + n, o + r), e("transform", c);
}
function aC(e, t, n) {
	var r = RS.height(t), i = t.align, a = rC(t), o = a.x1, s = a.y1, c = t.dx || 0, l = (t.dy || 0) + eC(t) - Math.round(.8 * r), u = qS(t), d;
	if (P(u) ? (r += GS(t) * (u.length - 1), d = u.reduce((e, n) => Math.max(e, RS.width(t, n)), 0)) : d = RS.width(t, u), i === "center" ? c -= d / 2 : i === "right" && (c -= d), e.set(c += o, l += s, c + d, l + r), t.angle && !n) e.rotate(t.angle * by, o, s);
	else if (n === 2) return e.rotatedPoints(t.angle * by, o, s);
	return e;
}
function oC(e, t, n) {
	Ex(t, (t) => {
		var r = t.opacity == null ? 1 : t.opacity, i, a, o, s, c, l, u;
		if (!(n && !n.intersects(t.bounds) || r === 0 || t.fontSize <= 0 || t.text == null || t.text.length === 0)) {
			if (e.font = $S(t), e.textAlign = t.align || "left", i = rC(t), a = i.x1, o = i.y1, t.angle && (e.save(), e.translate(a, o), e.rotate(t.angle * by), a = o = 0), a += t.dx || 0, o += (t.dy || 0) + eC(t), l = qS(t), gx(e, t), P(l)) for (c = GS(t), s = 0; s < l.length; ++s) u = YS(t, l[s]), t.fill && xx(e, t, r) && e.fillText(u, a, o), t.stroke && Cx(e, t, r) && e.strokeText(u, a, o), o += c;
			else u = YS(t, l), t.fill && xx(e, t, r) && e.fillText(u, a, o), t.stroke && Cx(e, t, r) && e.strokeText(u, a, o);
			t.angle && e.restore();
		}
	});
}
function sC(e, t, n, r, i, a) {
	if (t.fontSize <= 0) return !1;
	if (!t.angle) return !0;
	var o = rC(t), s = o.x1, c = o.y1, l = aC(nC, t, 1), u = -t.angle * by, d = Math.cos(u), f = Math.sin(u), p = d * i - f * a + (s - d * s + f * c), m = f * i + d * a + (c - f * s - d * c);
	return l.contains(p, m);
}
function cC(e, t) {
	let n = aC(nC, e, 2);
	return hx(t, n[0], n[1], n[2], n[3]) || hx(t, n[0], n[1], n[4], n[5]) || hx(t, n[4], n[5], n[6], n[7]) || hx(t, n[2], n[3], n[6], n[7]);
}
var lC = {
	arc: Vx,
	area: Kx,
	group: lS,
	image: yS,
	line: bS,
	path: wS,
	rect: OS,
	rule: PS,
	shape: FS,
	symbol: IS,
	text: {
		type: "text",
		tag: "text",
		nested: !1,
		attr: iC,
		bound: aC,
		draw: oC,
		pick: jx(sC),
		isect: cC
	},
	trail: Gx("trail", kb, Wx)
};
function uC(e, t, n) {
	var r = lC[e.mark.marktype], i = t || r.bound;
	return r.nested && (e = e.mark), i(e.bounds || (e.bounds = new Nb()), e, n);
}
var dC = { mark: null };
function fC(e, t, n) {
	var r = lC[e.marktype], i = r.bound, a = e.items, o = a && a.length, s, c, l, u;
	if (r.nested) return o ? l = a[0] : (dC.mark = e, l = dC), u = uC(l, i, n), t = t && t.union(u) || u, t;
	if (t = t || e.bounds && e.bounds.clear() || new Nb(), o) for (s = 0, c = a.length; s < c; ++s) t.union(uC(a[s], i, n));
	return e.bounds = t;
}
var pC = /* @__PURE__ */ "marktype.name.role.interactive.clip.items.zindex.x.y.width.height.align.baseline.fill.fillOpacity.opacity.blend.stroke.strokeOpacity.strokeWidth.strokeCap.strokeDash.strokeDashOffset.strokeForeground.strokeOffset.startAngle.endAngle.innerRadius.outerRadius.cornerRadius.padAngle.cornerRadiusTopLeft.cornerRadiusTopRight.cornerRadiusBottomLeft.cornerRadiusBottomRight.interpolate.tension.orient.defined.url.aspect.smooth.path.scaleX.scaleY.x2.y2.size.shape.text.angle.theta.radius.dir.dx.dy.ellipsis.limit.lineBreak.lineHeight.font.fontSize.fontWeight.fontStyle.fontVariant.description.aria.ariaRole.ariaRoleDescription".split(".");
function mC(e, t) {
	return JSON.stringify(e, pC, t);
}
function hC(e) {
	return gC(typeof e == "string" ? JSON.parse(e) : e);
}
function gC(e) {
	var t = e.marktype, n = e.items, r, i, a;
	if (n) for (i = 0, a = n.length; i < a; ++i) r = t ? "mark" : "group", n[i][r] = e, n[i].zindex && (n[i][r].zdirty = !0), (t || r) === "group" && gC(n[i]);
	return t && fC(e), e;
}
var _C = class {
	constructor(e) {
		arguments.length ? this.root = hC(e) : (this.root = vC({
			marktype: "group",
			name: "root",
			role: "frame"
		}), this.root.items = [new Fb(this.root)]);
	}
	toJSON(e) {
		return mC(this.root, e || 0);
	}
	mark(e, t, n) {
		t = t || this.root.items[0];
		let r = vC(e, t);
		return t.items[n] = r, r.zindex && (r.group.zdirty = !0), r;
	}
};
function vC(e, t) {
	let n = {
		bounds: new Nb(),
		clip: !!e.clip,
		group: t,
		interactive: e.interactive !== !1,
		items: [],
		marktype: e.marktype,
		name: e.name || void 0,
		role: e.role || void 0,
		zindex: e.zindex || 0
	};
	return e.aria != null && (n.aria = e.aria), e.description && (n.description = e.description), n;
}
function yC(e, t, n) {
	return !e && typeof document < "u" && document.createElement && (e = document), e ? n ? e.createElementNS(n, t) : e.createElement(t) : null;
}
function bC(e, t) {
	t = t.toLowerCase();
	for (var n = e.childNodes, r = 0, i = n.length; r < i; ++r) if (n[r].tagName.toLowerCase() === t) return n[r];
}
function xC(e, t, n, r) {
	var i = e.childNodes[t], a;
	return (!i || i.tagName.toLowerCase() !== n.toLowerCase()) && (a = i || null, i = yC(e.ownerDocument, n, r), e.insertBefore(i, a)), i;
}
function SC(e, t) {
	for (var n = e.childNodes, r = n.length; r > t;) e.removeChild(n[--r]);
	return e;
}
function CC(e) {
	return "mark-" + e.marktype + (e.role ? " role-" + e.role : "") + (e.name ? " " + e.name : "");
}
function wC(e, t) {
	let n = t.getBoundingClientRect();
	return [e.clientX - n.left - (t.clientLeft || 0), e.clientY - n.top - (t.clientTop || 0)];
}
function TC(e, t, n, r) {
	var i = e && e.mark, a, o;
	if (i && (a = lC[i.marktype]).tip) {
		for (o = wC(t, n), o[0] -= r[0], o[1] -= r[1]; e = e.mark.group;) o[0] -= e.x || 0, o[1] -= e.y || 0;
		e = a.tip(i.items, o);
	}
	return e;
}
var EC = class {
	constructor(e, t) {
		this._active = null, this._handlers = {}, this._loader = e || Mp(), this._tooltip = t || DC;
	}
	initialize(e, t, n) {
		return this._el = e, this._obj = n || null, this.origin(t);
	}
	element() {
		return this._el;
	}
	canvas() {
		return this._el && this._el.firstChild;
	}
	origin(e) {
		return arguments.length ? (this._origin = e || [0, 0], this) : this._origin.slice();
	}
	scene(e) {
		return arguments.length ? (this._scene = e, this) : this._scene;
	}
	on() {}
	off() {}
	_handlerIndex(e, t, n) {
		for (let r = e ? e.length : 0; --r >= 0;) if (e[r].type === t && (!n || e[r].handler === n)) return r;
		return -1;
	}
	handlers(e) {
		let t = this._handlers, n = [];
		if (e) n.push(...t[this.eventName(e)]);
		else for (let e in t) n.push(...t[e]);
		return n;
	}
	eventName(e) {
		let t = e.indexOf(".");
		return t < 0 ? e : e.slice(0, t);
	}
	handleHref(e, t, n) {
		this._loader.sanitize(n, { context: "href" }).then((t) => {
			let n = new MouseEvent(e.type, e), r = yC(null, "a");
			for (let e in t) r.setAttribute(e, t[e]);
			r.dispatchEvent(n);
		}).catch(() => {});
	}
	handleTooltip(e, t, n) {
		if (t && t.tooltip != null) {
			t = TC(t, e, this.canvas(), this._origin);
			let r = n && t && t.tooltip || null;
			this._tooltip.call(this._obj, this, e, t, r);
		}
	}
	getItemBoundingClientRect(e) {
		let t = this.canvas();
		if (!t) return;
		let n = t.getBoundingClientRect(), r = this._origin, i = e.bounds, a = i.width(), o = i.height(), s = i.x1 + r[0] + n.left, c = i.y1 + r[1] + n.top;
		for (; e.mark && (e = e.mark.group);) s += e.x || 0, c += e.y || 0;
		return {
			x: s,
			y: c,
			width: a,
			height: o,
			left: s,
			top: c,
			right: s + a,
			bottom: c + o
		};
	}
};
function DC(e, t, n, r) {
	e.element().setAttribute("title", r || "");
}
var OC = class {
	constructor(e) {
		this._el = null, this._bgcolor = null, this._loader = new Ib(e);
	}
	initialize(e, t, n, r, i) {
		return this._el = e, this.resize(t, n, r, i);
	}
	element() {
		return this._el;
	}
	canvas() {
		return this._el && this._el.firstChild;
	}
	background(e) {
		return arguments.length === 0 ? this._bgcolor : (this._bgcolor = e, this);
	}
	resize(e, t, n, r) {
		return this._width = e, this._height = t, this._origin = n || [0, 0], this._scale = r || 1, this;
	}
	dirty() {}
	render(e, t) {
		let n = this;
		return n._call = function() {
			n._render(e, t);
		}, n._call(), n._call = null, n;
	}
	_render() {}
	renderAsync(e, t) {
		let n = this.render(e, t);
		return this._ready ? this._ready.then(() => n) : Promise.resolve(n);
	}
	_load(e, t) {
		var n = this, r = n._loader[e](t);
		if (!n._ready) {
			let e = n._call;
			n._ready = n._loader.ready().then((t) => {
				t && e(), n._ready = null;
			});
		}
		return r;
	}
	sanitizeURL(e) {
		return this._load("sanitizeURL", e);
	}
	loadImage(e) {
		return this._load("loadImage", e);
	}
}, kC = "keydown", AC = "keypress", jC = "keyup", MC = "dragenter", NC = "dragleave", PC = "dragover", FC = "pointerdown", IC = "pointerup", LC = "pointermove", RC = "pointerout", zC = "pointerover", BC = "mousedown", VC = "mouseup", HC = "mousemove", UC = "mouseout", WC = "mouseover", GC = "click", KC = "dblclick", qC = "wheel", JC = "mousewheel", YC = "touchstart", XC = "touchmove", ZC = "touchend", QC = [
	kC,
	AC,
	jC,
	MC,
	NC,
	PC,
	FC,
	IC,
	LC,
	RC,
	zC,
	BC,
	VC,
	HC,
	UC,
	WC,
	GC,
	KC,
	qC,
	JC,
	YC,
	XC,
	ZC
], $C = LC, ew = UC, tw = GC, nw = class extends EC {
	constructor(e, t) {
		super(e, t), this._down = null, this._touch = null, this._first = !0, this._events = {}, this.events = QC, this.pointermove = aw([LC, HC], [zC, WC], [RC, UC]), this.dragover = aw([PC], [MC], [NC]), this.pointerout = ow([RC, UC]), this.dragleave = ow([NC]);
	}
	initialize(e, t, n) {
		return this._canvas = e && bC(e, "canvas"), [
			GC,
			BC,
			FC,
			LC,
			RC,
			NC
		].forEach((e) => rw(this, e)), super.initialize(e, t, n);
	}
	canvas() {
		return this._canvas;
	}
	context() {
		return this._canvas.getContext("2d");
	}
	DOMMouseScroll(e) {
		this.fire(JC, e);
	}
	pointerdown(e) {
		this._down = this._active, this.fire(FC, e);
	}
	mousedown(e) {
		this._down = this._active, this.fire(BC, e);
	}
	click(e) {
		this._down === this._active && (this.fire(GC, e), this._down = null);
	}
	touchstart(e) {
		this._touch = this.pickEvent(e.changedTouches[0]), this._first && (this._active = this._touch, this._first = !1), this.fire(YC, e, !0);
	}
	touchmove(e) {
		this.fire(XC, e, !0);
	}
	touchend(e) {
		this.fire(ZC, e, !0), this._touch = null;
	}
	fire(e, t, n) {
		let r = n ? this._touch : this._active, i = this._handlers[e];
		if (t.vegaType = e, e === tw && r && r.href ? this.handleHref(t, r, r.href) : (e === $C || e === ew) && this.handleTooltip(t, r, e !== ew), i) for (let e = 0, n = i.length; e < n; ++e) i[e].handler.call(this._obj, t, r);
	}
	on(e, t) {
		let n = this.eventName(e), r = this._handlers;
		return this._handlerIndex(r[n], e, t) < 0 && (rw(this, e), (r[n] || (r[n] = [])).push({
			type: e,
			handler: t
		})), this;
	}
	off(e, t) {
		let n = this.eventName(e), r = this._handlers[n], i = this._handlerIndex(r, e, t);
		return i >= 0 && r.splice(i, 1), this;
	}
	pickEvent(e) {
		let t = wC(e, this._canvas), n = this._origin;
		return this.pick(this._scene, t[0], t[1], t[0] - n[0], t[1] - n[1]);
	}
	pick(e, t, n, r, i) {
		let a = this.context();
		return lC[e.marktype].pick.call(this, a, e, t, n, r, i);
	}
}, Kee = (e) => e === YC || e === XC || e === ZC ? [
	YC,
	XC,
	ZC
] : [e];
function rw(e, t) {
	Kee(t).forEach((t) => qee(e, t));
}
function qee(e, t) {
	let n = e.canvas();
	n && !e._events[t] && (e._events[t] = 1, n.addEventListener(t, e[t] ? (n) => e[t](n) : (n) => e.fire(t, n)));
}
function iw(e, t, n) {
	t.forEach((t) => e.fire(t, n));
}
function aw(e, t, n) {
	return function(r) {
		let i = this._active, a = this.pickEvent(r);
		a === i ? iw(this, e, r) : ((!i || !i.exit) && iw(this, n, r), this._active = a, iw(this, t, r), iw(this, e, r));
	};
}
function ow(e) {
	return function(t) {
		iw(this, e, t), this._active = null;
	};
}
function Jee() {
	return typeof window < "u" && window.devicePixelRatio || 1;
}
function Yee(e, t, n, r, i, a) {
	let o = typeof HTMLElement < "u" && e instanceof HTMLElement && e.parentNode != null, s = e.getContext("2d"), c = o ? Jee() : i;
	e.width = t * c, e.height = n * c;
	for (let e in a) s[e] = a[e];
	return o && c !== 1 && (e.style.width = t + "px", e.style.height = n + "px"), s.pixelRatio = c, s.setTransform(c, 0, 0, c, c * r[0], c * r[1]), e;
}
var sw = class extends OC {
	constructor(e) {
		super(e), this._options = {}, this._redraw = !1, this._dirty = new Nb(), this._tempb = new Nb();
	}
	initialize(e, t, n, r, i, a) {
		return this._options = a || {}, this._canvas = this._options.externalContext ? null : V_(1, 1, this._options.type), e && this._canvas && (SC(e, 0).appendChild(this._canvas), this._canvas.setAttribute("class", "marks")), super.initialize(e, t, n, r, i);
	}
	resize(e, t, n, r) {
		if (super.resize(e, t, n, r), this._canvas) Yee(this._canvas, this._width, this._height, this._origin, this._scale, this._options.context);
		else {
			let e = this._options.externalContext;
			e || N("CanvasRenderer is missing a valid canvas or context"), e.scale(this._scale, this._scale), e.translate(this._origin[0], this._origin[1]);
		}
		return this._redraw = !0, this;
	}
	canvas() {
		return this._canvas;
	}
	context() {
		return this._options.externalContext || (this._canvas ? this._canvas.getContext("2d") : null);
	}
	dirty(e) {
		let t = this._tempb.clear().union(e.bounds), n = e.mark.group;
		for (; n;) t.translate(n.x || 0, n.y || 0), n = n.mark.group;
		this._dirty.union(t);
	}
	_render(e, t) {
		let n = this.context(), r = this._origin, i = this._width, a = this._height, o = this._dirty, s = Xee(r, i, a);
		n.save();
		let c = this._redraw || o.empty() ? (this._redraw = !1, s.expand(1)) : Zee(n, s.intersect(o), r);
		return this.clear(-r[0], -r[1], i, a), this.draw(n, e, c, t), n.restore(), o.clear(), this;
	}
	draw(e, t, n, r) {
		if (t.marktype !== "group" && r != null && !r.includes(t.marktype)) return;
		let i = lC[t.marktype];
		t.clip && qx(e, t), i.draw.call(this, e, t, n, r), t.clip && e.restore();
	}
	clear(e, t, n, r) {
		let i = this._options, a = this.context();
		i.type !== "pdf" && !i.externalContext && a.clearRect(e, t, n, r), this._bgcolor != null && (a.fillStyle = this._bgcolor, a.fillRect(e, t, n, r));
	}
}, Xee = (e, t, n) => new Nb().set(0, 0, t, n).translate(-e[0], -e[1]);
function Zee(e, t, n) {
	return t.expand(1).round(), e.pixelRatio % 1 && t.scale(e.pixelRatio).round().scale(1 / e.pixelRatio), t.translate(-(n[0] % 1), -(n[1] % 1)), e.beginPath(), e.rect(t.x1, t.y1, t.width(), t.height()), e.clip(), t;
}
var cw = class extends EC {
	constructor(e, t) {
		super(e, t);
		let n = this;
		n._hrefHandler = lw(n, (e, t) => {
			t && t.href && n.handleHref(e, t, t.href);
		}), n._tooltipHandler = lw(n, (e, t) => {
			n.handleTooltip(e, t, e.type !== ew);
		});
	}
	initialize(e, t, n) {
		let r = this._svg;
		return r && (r.removeEventListener(tw, this._hrefHandler), r.removeEventListener($C, this._tooltipHandler), r.removeEventListener(ew, this._tooltipHandler)), this._svg = r = e && bC(e, "svg"), r && (r.addEventListener(tw, this._hrefHandler), r.addEventListener($C, this._tooltipHandler), r.addEventListener(ew, this._tooltipHandler)), super.initialize(e, t, n);
	}
	canvas() {
		return this._svg;
	}
	on(e, t) {
		let n = this.eventName(e), r = this._handlers;
		if (this._handlerIndex(r[n], e, t) < 0) {
			let i = {
				type: e,
				handler: t,
				listener: lw(this, t)
			};
			(r[n] || (r[n] = [])).push(i), this._svg && this._svg.addEventListener(n, i.listener);
		}
		return this;
	}
	off(e, t) {
		let n = this.eventName(e), r = this._handlers[n], i = this._handlerIndex(r, e, t);
		return i >= 0 && (this._svg && this._svg.removeEventListener(n, r[i].listener), r.splice(i, 1)), this;
	}
}, lw = (e, t) => (n) => {
	let r = n.target.__data__;
	r = Array.isArray(r) ? r[0] : r, n.vegaType = n.type, t.call(e._obj, n, r);
}, uw = "aria-hidden", dw = "aria-label", fw = "role", pw = "aria-roledescription", mw = "graphics-object", hw = "graphics-symbol", gw = (e, t, n) => ({
	[fw]: e,
	[pw]: t,
	[dw]: n || void 0
}), Qee = _d([
	"axis-domain",
	"axis-grid",
	"axis-label",
	"axis-tick",
	"axis-title",
	"legend-band",
	"legend-entry",
	"legend-gradient",
	"legend-label",
	"legend-title",
	"legend-symbol",
	"title"
]), _w = {
	axis: {
		desc: "axis",
		caption: tte
	},
	legend: {
		desc: "legend",
		caption: nte
	},
	"title-text": {
		desc: "title",
		caption: (e) => `Title text '${xw(e)}'`
	},
	"title-subtitle": {
		desc: "subtitle",
		caption: (e) => `Subtitle text '${xw(e)}'`
	}
}, vw = {
	ariaRole: fw,
	ariaRoleDescription: pw,
	description: dw
};
function yw(e, t) {
	let n = t.aria === !1;
	if (e(uw, n || void 0), n || t.description == null) for (let t in vw) e(vw[t], void 0);
	else {
		let n = t.mark.marktype;
		e(dw, t.description), e(fw, t.ariaRole || (n === "group" ? mw : hw)), e(pw, t.ariaRoleDescription || `${n} mark`);
	}
}
function bw(e) {
	return e.aria === !1 ? { [uw]: !0 } : Qee[e.role] ? null : _w[e.role] ? ete(e, _w[e.role]) : $ee(e);
}
function $ee(e) {
	let t = e.marktype;
	return gw(t === "group" || t === "text" || e.items.some((e) => e.description != null && e.aria !== !1) ? mw : hw, `${t} mark container`, e.description);
}
function ete(e, t) {
	try {
		let n = e.items[0], r = t.caption || (() => "");
		return gw(t.role || hw, t.desc, n.description || r(n));
	} catch {
		return null;
	}
}
function xw(e) {
	return I(e.text).join(" ");
}
function tte(e) {
	let t = e.datum, n = e.orient, r = t.title ? Sw(e) : null, i = e.context, a = i.scales[t.scale].value, o = i.dataflow.locale(), s = a.type;
	return `${n === "left" || n === "right" ? "Y" : "X"}-axis` + (r ? ` titled '${r}'` : "") + ` for a ${Dv(s) ? "discrete" : s} scale with ${ly(o, a, e)}`;
}
function nte(e) {
	let t = e.datum, n = t.title ? Sw(e) : null, r = `${t.type || ""} legend`.trim(), i = t.scales, a = Object.keys(i), o = e.context, s = o.scales[i[a[0]]].value, c = o.dataflow.locale();
	return ite(r) + (n ? ` titled '${n}'` : "") + ` for ${rte(a)} with ${ly(c, s, e)}`;
}
function Sw(e) {
	try {
		return I(vu(e.items).items[0].text).join(" ");
	} catch {
		return null;
	}
}
function rte(e) {
	return e = e.map((e) => e + (e === "fill" || e === "stroke" ? " color" : "")), e.length < 2 ? e[0] : e.slice(0, -1).join(", ") + " and " + vu(e);
}
function ite(e) {
	return e.length ? e[0].toUpperCase() + e.slice(1) : e;
}
var Cw = (e) => (e + "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"), ate = (e) => Cw(e).replace(/"/g, "&quot;").replace(/\t/g, "&#x9;").replace(/\n/g, "&#xA;").replace(/\r/g, "&#xD;");
function ww() {
	let e = "", t = "", n = "", r = [], i = () => t = n = "", a = (a) => {
		t && (e += `${t}>${n}`, i()), r.push(a);
	}, o = (e, n) => (n != null && (t += ` ${e}="${ate(n)}"`), s), s = {
		open(e, ...n) {
			a(e), t = "<" + e;
			for (let e of n) for (let t in e) o(t, e[t]);
			return s;
		},
		close() {
			let a = r.pop();
			return t ? e += t + (n ? `>${n}</${a}>` : "/>") : e += `</${a}>`, i(), s;
		},
		attr: o,
		text: (e) => (n += Cw(e), s),
		toString: () => e
	};
	return s;
}
var Tw = (e) => Ew(ww(), e) + "";
function Ew(e, t) {
	if (e.open(t.tagName), t.hasAttributes()) {
		let n = t.attributes, r = n.length;
		for (let t = 0; t < r; ++t) e.attr(n[t].name, n[t].value);
	}
	if (t.hasChildNodes()) {
		let n = t.childNodes;
		for (let t of n) t.nodeType === 3 ? e.text(t.nodeValue) : Ew(e, t);
	}
	return e.close();
}
var Dw = {
	fill: "fill",
	fillOpacity: "fill-opacity",
	stroke: "stroke",
	strokeOpacity: "stroke-opacity",
	strokeWidth: "stroke-width",
	strokeCap: "stroke-linecap",
	strokeJoin: "stroke-linejoin",
	strokeDash: "stroke-dasharray",
	strokeDashOffset: "stroke-dashoffset",
	strokeMiterLimit: "stroke-miterlimit",
	opacity: "opacity"
}, Ow = { blend: "mix-blend-mode" }, kw = {
	fill: "none",
	"stroke-miterlimit": 10
}, Aw = 0, jw = "http://www.w3.org/2000/xmlns/", Mw = uS.xmlns, Nw = class extends OC {
	constructor(e) {
		super(e), this._dirtyID = 0, this._dirty = [], this._svg = null, this._root = null, this._defs = null;
	}
	initialize(e, t, n, r, i) {
		return this._defs = {}, this._clearDefs(), e && (this._svg = xC(e, 0, "svg", Mw), this._svg.setAttributeNS(jw, "xmlns", Mw), this._svg.setAttributeNS(jw, "xmlns:xlink", uS["xmlns:xlink"]), this._svg.setAttribute("version", uS.version), this._svg.setAttribute("class", "marks"), SC(e, 1), this._root = xC(this._svg, Aw, "g", Mw), Gw(this._root, kw), SC(this._svg, Aw + 1)), this.background(this._bgcolor), super.initialize(e, t, n, r, i);
	}
	background(e) {
		return arguments.length && this._svg && this._svg.style.setProperty("background-color", e), super.background(...arguments);
	}
	resize(e, t, n, r) {
		return super.resize(e, t, n, r), this._svg && (Gw(this._svg, {
			width: this._width * this._scale,
			height: this._height * this._scale,
			viewBox: `0 0 ${this._width} ${this._height}`
		}), this._root.setAttribute("transform", `translate(${this._origin})`)), this._dirty = [], this;
	}
	canvas() {
		return this._svg;
	}
	svg() {
		let e = this._svg, t = this._bgcolor;
		if (!e) return null;
		let n;
		t && (e.removeAttribute("style"), n = xC(e, Aw, "rect", Mw), Gw(n, {
			width: this._width,
			height: this._height,
			fill: t
		}));
		let r = Tw(e);
		return t && (e.removeChild(n), this._svg.style.setProperty("background-color", t)), r;
	}
	_render(e, t) {
		return this._dirtyCheck() && (this._dirtyAll && this._clearDefs(), this.mark(this._root, e, void 0, t), SC(this._root, 1)), this.defs(), this._dirty = [], ++this._dirtyID, this;
	}
	dirty(e) {
		e.dirty !== this._dirtyID && (e.dirty = this._dirtyID, this._dirty.push(e));
	}
	isDirty(e) {
		return this._dirtyAll || !e._svg || !e._svg.ownerSVGElement || e.dirty === this._dirtyID;
	}
	_dirtyCheck() {
		this._dirtyAll = !0;
		let e = this._dirty;
		if (!e.length || !this._dirtyID) return !0;
		let t = ++this._dirtyID, n, r, i, a, o, s, c;
		for (o = 0, s = e.length; o < s; ++o) if (n = e[o], r = n.mark, r.marktype !== i && (i = r.marktype, a = lC[i]), r.zdirty && r.dirty !== t && (this._dirtyAll = !1, Pw(n, t), r.items.forEach((e) => {
			e.dirty = t;
		})), !r.zdirty) {
			if (n.exit) {
				a.nested && r.items.length ? (c = r.items[0], c._svg && this._update(a, c._svg, c)) : n._svg && (c = n._svg.parentNode, c && c.removeChild(n._svg)), n._svg = null;
				continue;
			}
			n = a.nested ? r.items[0] : n, n._update !== t && (!n._svg || !n._svg.ownerSVGElement ? (this._dirtyAll = !1, Pw(n, t)) : this._update(a, n._svg, n), n._update = t);
		}
		return !this._dirtyAll;
	}
	mark(e, t, n, r) {
		if (!this.isDirty(t)) return t._svg;
		let i = this._svg, a = t.marktype, o = lC[a], s = t.interactive === !1 ? "none" : null, c = o.tag === "g", l = Rw(t, e, n, "g", i);
		if (a !== "group" && r != null && !r.includes(a)) return SC(l, 0), t._svg;
		l.setAttribute("class", CC(t));
		let u = bw(t);
		for (let e in u) Kw(l, e, u[e]);
		c || Kw(l, "pointer-events", s), Kw(l, "clip-path", t.clip ? Mb(this, t, t.group) : null);
		let d = null, f = 0, p = (e) => {
			let t = this.isDirty(e), n = Rw(e, l, d, o.tag, i);
			t && (this._update(o, n, e), c && Lw(this, n, e, r)), d = n, ++f;
		};
		return o.nested ? t.items.length && p(t.items[0]) : Ex(t, p), SC(l, f), l;
	}
	_update(e, t, n) {
		Bw = t, Vw = t.__values__, yw(Uw, n), e.attr(Uw, n, this);
		let r = Hw[e.type];
		r && r.call(this, e, t, n), Bw && this.style(Bw, n);
	}
	style(e, t) {
		if (t != null) {
			for (let n in Dw) {
				let r = n === "font" ? QS(t) : t[n];
				if (r === Vw[n]) continue;
				let i = Dw[n];
				r == null ? e.removeAttribute(i) : (fy(r) && (r = py(r, this._defs.gradient, Jw())), e.setAttribute(i, r + "")), Vw[n] = r;
			}
			for (let n in Ow) Ww(e, Ow[n], t[n]);
		}
	}
	defs() {
		let e = this._svg, t = this._defs, n = t.el, r = 0;
		for (let i in t.gradient) n || (t.el = n = xC(e, Aw + 1, "defs", Mw)), r = Fw(n, t.gradient[i], r);
		for (let i in t.clipping) n || (t.el = n = xC(e, Aw + 1, "defs", Mw)), r = Iw(n, t.clipping[i], r);
		n && (r === 0 ? (e.removeChild(n), t.el = null) : SC(n, r));
	}
	_clearDefs() {
		let e = this._defs;
		e.gradient = {}, e.clipping = {};
	}
};
function Pw(e, t) {
	for (; e && e.dirty !== t; e = e.mark.group) if (e.dirty = t, e.mark && e.mark.dirty !== t) e.mark.dirty = t;
	else return;
}
function Fw(e, t, n) {
	let r, i, a;
	if (t.gradient === "radial") {
		let r = xC(e, n++, "pattern", Mw);
		Gw(r, {
			id: dy + t.id,
			viewBox: "0,0,1,1",
			width: "100%",
			height: "100%",
			preserveAspectRatio: "xMidYMid slice"
		}), r = xC(r, 0, "rect", Mw), Gw(r, {
			width: 1,
			height: 1,
			fill: `url(${Jw()}#${t.id})`
		}), e = xC(e, n++, "radialGradient", Mw), Gw(e, {
			id: t.id,
			fx: t.x1,
			fy: t.y1,
			fr: t.r1,
			cx: t.x2,
			cy: t.y2,
			r: t.r2
		});
	} else e = xC(e, n++, "linearGradient", Mw), Gw(e, {
		id: t.id,
		x1: t.x1,
		x2: t.x2,
		y1: t.y1,
		y2: t.y2
	});
	for (r = 0, i = t.stops.length; r < i; ++r) a = xC(e, r, "stop", Mw), a.setAttribute("offset", t.stops[r].offset), a.setAttribute("stop-color", t.stops[r].color);
	return SC(e, r), n;
}
function Iw(e, t, n) {
	let r;
	return e = xC(e, n, "clipPath", Mw), e.setAttribute("id", t.id), t.path ? (r = xC(e, 0, "path", Mw), r.setAttribute("d", t.path)) : (r = xC(e, 0, "rect", Mw), Gw(r, {
		x: 0,
		y: 0,
		width: t.width,
		height: t.height
	})), SC(e, 1), n + 1;
}
function Lw(e, t, n, r) {
	t = t.lastChild.previousSibling;
	let i, a = 0;
	Ex(n, (n) => {
		i = e.mark(t, n, i, r), ++a;
	}), SC(t, 1 + a);
}
function Rw(e, t, n, r, i) {
	let a = e._svg, o;
	if (!a && (o = t.ownerDocument, a = yC(o, r, Mw), e._svg = a, e.mark && (a.__data__ = e, a.__values__ = { fill: "default" }, r === "g"))) {
		let t = yC(o, "path", Mw);
		a.appendChild(t), t.__data__ = e;
		let n = yC(o, "g", Mw);
		a.appendChild(n), n.__data__ = e;
		let r = yC(o, "path", Mw);
		a.appendChild(r), r.__data__ = e, r.__values__ = { fill: "default" };
	}
	return (a.ownerSVGElement !== i || zw(a, n)) && t.insertBefore(a, n ? n.nextSibling : t.firstChild), a;
}
function zw(e, t) {
	return e.parentNode && e.parentNode.childNodes.length > 1 && e.previousSibling != t;
}
var Bw = null, Vw = null, Hw = {
	group(e, t, n) {
		let r = Bw = t.childNodes[2];
		Vw = r.__values__, e.foreground(Uw, n, this), Vw = t.__values__, Bw = t.childNodes[1], e.content(Uw, n, this);
		let i = Bw = t.childNodes[0];
		e.background(Uw, n, this);
		let a = n.mark.interactive === !1 ? "none" : null;
		if (a !== Vw.events && (Kw(r, "pointer-events", a), Kw(i, "pointer-events", a), Vw.events = a), n.strokeForeground && n.stroke) {
			let e = n.fill;
			Kw(r, "display", null), this.style(i, n), Kw(i, "stroke", null), e && (n.fill = null), Vw = r.__values__, this.style(r, n), e && (n.fill = e), Bw = null;
		} else Kw(r, "display", "none");
	},
	image(e, t, n) {
		n.smooth === !1 ? (Ww(t, "image-rendering", "optimizeSpeed"), Ww(t, "image-rendering", "pixelated")) : Ww(t, "image-rendering", null);
	},
	text(e, t, n) {
		let r = qS(n), i, a, o, s;
		P(r) ? (a = r.map((e) => YS(n, e)), i = a.join("\n"), i !== Vw.text && (SC(t, 0), o = t.ownerDocument, s = GS(n), a.forEach((e, r) => {
			let i = yC(o, "tspan", Mw);
			i.__data__ = n, i.textContent = e, r && (i.setAttribute("x", 0), i.setAttribute("dy", s)), t.appendChild(i);
		}), Vw.text = i)) : (a = YS(n, r), a !== Vw.text && (t.textContent = a, Vw.text = a)), Kw(t, "font-family", QS(n)), Kw(t, "font-size", WS(n) + "px"), Kw(t, "font-style", n.fontStyle), Kw(t, "font-variant", n.fontVariant), Kw(t, "font-weight", n.fontWeight);
	}
};
function Uw(e, t, n) {
	t !== Vw[e] && (n ? qw(Bw, e, t, n) : Kw(Bw, e, t), Vw[e] = t);
}
function Ww(e, t, n) {
	n !== Vw[t] && (n == null ? e.style.removeProperty(t) : e.style.setProperty(t, n + ""), Vw[t] = n);
}
function Gw(e, t) {
	for (let n in t) Kw(e, n, t[n]);
}
function Kw(e, t, n) {
	n == null ? e.removeAttribute(t) : e.setAttribute(t, n);
}
function qw(e, t, n, r) {
	n == null ? e.removeAttributeNS(r, t) : e.setAttributeNS(r, t, n);
}
function Jw() {
	let e;
	return typeof window > "u" ? "" : (e = window.location).hash ? e.href.slice(0, -e.hash.length) : e.href;
}
var Yw = class extends OC {
	constructor(e) {
		super(e), this._text = null, this._defs = {
			gradient: {},
			clipping: {}
		};
	}
	svg() {
		return this._text;
	}
	_render(e) {
		let t = ww();
		t.open("svg", qu({}, uS, {
			class: "marks",
			width: this._width * this._scale,
			height: this._height * this._scale,
			viewBox: `0 0 ${this._width} ${this._height}`
		}));
		let n = this._bgcolor;
		return n && n !== "transparent" && n !== "none" && t.open("rect", {
			width: this._width,
			height: this._height,
			fill: n
		}).close(), t.open("g", kw, { transform: "translate(" + this._origin + ")" }), this.mark(t, e), t.close(), this.defs(t), this._text = t.close() + "", this;
	}
	mark(e, t) {
		let n = lC[t.marktype], r = n.tag, i = [yw, n.attr];
		e.open("g", {
			class: CC(t),
			"clip-path": t.clip ? Mb(this, t, t.group) : null
		}, bw(t), { "pointer-events": r !== "g" && t.interactive === !1 ? "none" : null });
		let a = (a) => {
			let o = this.href(a);
			if (o && e.open("a", o), e.open(r, this.attr(t, a, i, r === "g" ? null : r)), r === "text") {
				let t = qS(a);
				if (P(t)) {
					let n = {
						x: 0,
						dy: GS(a)
					};
					for (let r = 0; r < t.length; ++r) e.open("tspan", r ? n : null).text(YS(a, t[r])).close();
				} else e.text(YS(a, t));
			} else if (r === "g") {
				let r = a.strokeForeground, i = a.fill, o = a.stroke;
				r && o && (a.stroke = null), e.open("path", this.attr(t, a, n.background, "bgrect")).close(), e.open("g", this.attr(t, a, n.content)), Ex(a, (t) => this.mark(e, t)), e.close(), r && o ? (i && (a.fill = null), a.stroke = o, e.open("path", this.attr(t, a, n.foreground, "bgrect")).close(), i && (a.fill = i)) : e.open("path", this.attr(t, a, n.foreground, "bgfore")).close();
			}
			e.close(), o && e.close();
		};
		return n.nested ? t.items && t.items.length && a(t.items[0]) : Ex(t, a), e.close();
	}
	href(e) {
		let t = e.href, n;
		if (t) {
			if (n = this._hrefs && this._hrefs[t]) return n;
			this.sanitizeURL(t).then((e) => {
				e["xlink:href"] = e.href, e.href = null, (this._hrefs || (this._hrefs = {}))[t] = e;
			});
		}
		return null;
	}
	attr(e, t, n, r) {
		let i = {}, a = (e, t, n, r) => {
			i[r || e] = t;
		};
		return Array.isArray(n) ? n.forEach((e) => e(a, t, this)) : n(a, t, this), r && Xw(i, t, e, r, this._defs), i;
	}
	defs(e) {
		let t = this._defs.gradient, n = this._defs.clipping;
		if (Object.keys(t).length + Object.keys(n).length !== 0) {
			e.open("defs");
			for (let n in t) {
				let r = t[n], i = r.stops;
				r.gradient === "radial" ? (e.open("pattern", {
					id: dy + n,
					viewBox: "0,0,1,1",
					width: "100%",
					height: "100%",
					preserveAspectRatio: "xMidYMid slice"
				}), e.open("rect", {
					width: "1",
					height: "1",
					fill: "url(#" + n + ")"
				}).close(), e.close(), e.open("radialGradient", {
					id: n,
					fx: r.x1,
					fy: r.y1,
					fr: r.r1,
					cx: r.x2,
					cy: r.y2,
					r: r.r2
				})) : e.open("linearGradient", {
					id: n,
					x1: r.x1,
					x2: r.x2,
					y1: r.y1,
					y2: r.y2
				});
				for (let t = 0; t < i.length; ++t) e.open("stop", {
					offset: i[t].offset,
					"stop-color": i[t].color
				}).close();
				e.close();
			}
			for (let t in n) {
				let r = n[t];
				e.open("clipPath", { id: t }), r.path ? e.open("path", { d: r.path }).close() : e.open("rect", {
					x: 0,
					y: 0,
					width: r.width,
					height: r.height
				}).close(), e.close();
			}
			e.close();
		}
	}
};
function Xw(e, t, n, r, i) {
	let a;
	if (t == null || (r === "bgrect" && n.interactive === !1 && (e["pointer-events"] = "none"), r === "bgfore" && (n.interactive === !1 && (e["pointer-events"] = "none"), e.display = "none", t.fill !== null))) return e;
	r === "image" && t.smooth === !1 && (a = ["image-rendering: optimizeSpeed;", "image-rendering: pixelated;"]), r === "text" && (e["font-family"] = QS(t), e["font-size"] = WS(t) + "px", e["font-style"] = t.fontStyle, e["font-variant"] = t.fontVariant, e["font-weight"] = t.fontWeight);
	for (let n in Dw) {
		let r = t[n], a = Dw[n];
		r === "transparent" && (a === "fill" || a === "stroke") || r != null && (fy(r) && (r = py(r, i.gradient, "")), e[a] = r);
	}
	for (let e in Ow) {
		let n = t[e];
		n != null && (a = a || [], a.push(`${Ow[e]}: ${n};`));
	}
	return a && (e.style = a.join(" ")), e;
}
var Zw = {
	svgMarkTypes: ["text"],
	svgOnTop: !0,
	debug: !1
};
function Qw(e) {
	var t, n, r;
	Zw.svgMarkTypes = (t = e.svgMarkTypes) == null ? ["text"] : t, Zw.svgOnTop = (n = e.svgOnTop) == null ? !0 : n, Zw.debug = (r = e.debug) == null ? !1 : r;
}
var $w = class extends OC {
	constructor(e) {
		super(e), this._svgRenderer = new Nw(e), this._canvasRenderer = new sw(e);
	}
	initialize(e, t, n, r, i) {
		this._root_el = xC(e, 0, "div");
		let a = xC(this._root_el, 0, "div"), o = xC(this._root_el, 1, "div");
		return this._root_el.style.position = "relative", Zw.debug || (a.style.height = "100%", o.style.position = "absolute", o.style.top = "0", o.style.left = "0", o.style.height = "100%", o.style.width = "100%"), this._svgEl = Zw.svgOnTop ? o : a, this._canvasEl = Zw.svgOnTop ? a : o, this._svgEl.style.pointerEvents = "none", this._canvasRenderer.initialize(this._canvasEl, t, n, r, i), this._svgRenderer.initialize(this._svgEl, t, n, r, i), super.initialize(e, t, n, r, i);
	}
	dirty(e) {
		return Zw.svgMarkTypes.includes(e.mark.marktype) ? this._svgRenderer.dirty(e) : this._canvasRenderer.dirty(e), this;
	}
	_render(e, t) {
		let n = (t == null ? [
			"arc",
			"area",
			"image",
			"line",
			"path",
			"rect",
			"rule",
			"shape",
			"symbol",
			"text",
			"trail"
		] : t).filter((e) => !Zw.svgMarkTypes.includes(e));
		this._svgRenderer.render(e, Zw.svgMarkTypes), this._canvasRenderer.render(e, n);
	}
	resize(e, t, n, r) {
		return super.resize(e, t, n, r), this._svgRenderer.resize(e, t, n, r), this._canvasRenderer.resize(e, t, n, r), this;
	}
	background(e) {
		return Zw.svgOnTop ? this._canvasRenderer.background(e) : this._svgRenderer.background(e), this;
	}
}, eT = class extends nw {
	constructor(e, t) {
		super(e, t);
	}
	initialize(e, t, n) {
		let r = xC(xC(e, 0, "div"), +!Zw.svgOnTop, "div");
		return super.initialize(r, t, n);
	}
}, tT = "canvas", nT = "hybrid", rT = "png", iT = "svg", aT = "none", oT = {
	Canvas: tT,
	PNG: rT,
	SVG: iT,
	Hybrid: nT,
	None: aT
}, sT = {};
sT[tT] = sT[rT] = {
	renderer: sw,
	headless: sw,
	handler: nw
}, sT[iT] = {
	renderer: Nw,
	headless: Yw,
	handler: cw
}, sT[nT] = {
	renderer: $w,
	headless: $w,
	handler: eT
}, sT[aT] = {};
function cT(e, t) {
	return e = String(e || "").toLowerCase(), arguments.length > 1 ? (sT[e] = t, this) : sT[e];
}
function lT(e, t, n) {
	let r = [], i = new Nb().union(t), a = e.marktype;
	return a ? uT(e, i, n, r) : a === "group" ? fT(e, i, n, r) : N("Intersect scene must be mark node or group item.");
}
function uT(e, t, n, r) {
	if (dT(e, t, n)) {
		let i = e.items, a = e.marktype, o = i.length, s = 0;
		if (a === "group") for (; s < o; ++s) fT(i[s], t, n, r);
		else for (let e = lC[a].isect; s < o; ++s) {
			let n = i[s];
			pT(n, t, e) && r.push(n);
		}
	}
	return r;
}
function dT(e, t, n) {
	return e.bounds && t.intersects(e.bounds) && (e.marktype === "group" || e.interactive !== !1 && (!n || n(e)));
}
function fT(e, t, n, r) {
	n && n(e.mark) && pT(e, t, lC.group.isect) && r.push(e);
	let i = e.items, a = i && i.length;
	if (a) {
		let o = e.x || 0, s = e.y || 0;
		t.translate(-o, -s);
		for (let e = 0; e < a; ++e) uT(i[e], t, n, r);
		t.translate(o, s);
	}
	return r;
}
function pT(e, t, n) {
	let r = e.bounds;
	return t.encloses(r) || t.intersects(r) && n(e, t);
}
var mT = new Nb();
function hT(e) {
	let t = e.clip;
	if (Ru(t)) t(ix(mT.clear()));
	else if (t) mT.set(0, 0, e.group.width, e.group.height);
	else return;
	e.bounds.intersect(mT);
}
var gT = 1e-9;
function _T(e, t, n) {
	return e === t ? !0 : n === "path" ? vT(e, t) : e instanceof Date && t instanceof Date ? +e == +t : rd(e) && rd(t) ? Math.abs(e - t) <= gT : !e || !t || !F(e) && !F(t) ? e == t : yT(e, t);
}
function vT(e, t) {
	return _T(vy(e), vy(t));
}
function yT(e, t) {
	var n = Object.keys(e), r = Object.keys(t), i, a;
	if (n.length !== r.length) return !1;
	for (n.sort(), r.sort(), a = n.length - 1; a >= 0; a--) if (n[a] != r[a]) return !1;
	for (a = n.length - 1; a >= 0; a--) if (i = n[a], !_T(e[i], t[i], i)) return !1;
	return typeof e == typeof t;
}
function bT() {
	jb(), Bee();
}
//#endregion
//#region ../../node_modules/.pnpm/vega-view-transforms@5.1.0/node_modules/vega-view-transforms/build/vega-view-transforms.js
var xT = /* @__PURE__ */ t({
	bound: () => aE,
	identifier: () => cE,
	mark: () => uE,
	overlap: () => fE,
	render: () => bE,
	viewlayout: () => XE
}), ST = "top", CT = "left", wT = "right", TT = "bottom", ET = "top-left", DT = "top-right", OT = "bottom-left", kT = "bottom-right", AT = "start", jT = "middle", MT = "end", NT = "x", PT = "y", FT = "group", IT = "axis", LT = "title", RT = "frame", zT = "scope", BT = "legend", VT = "row-header", HT = "row-footer", UT = "row-title", WT = "column-header", GT = "column-footer", KT = "column-title", qT = "padding", JT = "symbol", YT = "fit", XT = "fit-x", ZT = "fit-y", QT = "pad", $T = "none", eE = "all", tE = "each", nE = "flush", rE = "column", iE = "row";
function aE(e) {
	H.call(this, null, e);
}
R(aE, H, { transform(e, t) {
	let n = t.dataflow, r = e.mark, i = r.marktype, a = lC[i], o = a.bound, s = r.bounds, c;
	if (a.nested) r.items.length && n.dirty(r.items[0]), s = oE(r, o), r.items.forEach((e) => {
		e.bounds.clear().union(s);
	});
	else if (i === FT || e.modified()) switch (t.visit(t.MOD, (e) => n.dirty(e)), s.clear(), r.items.forEach((e) => s.union(oE(e, o))), r.role) {
		case IT:
		case BT:
		case LT: t.reflow();
	}
	else c = t.changed(t.REM), t.visit(t.ADD, (e) => {
		s.union(oE(e, o));
	}), t.visit(t.MOD, (e) => {
		c = c || s.alignsWith(e.bounds), n.dirty(e), s.union(oE(e, o));
	}), c && (s.clear(), r.items.forEach((e) => s.union(e.bounds)));
	return hT(r), t.modifies("bounds");
} });
function oE(e, t, n) {
	return t(e.bounds.clear(), e, n);
}
var sE = ":vega_identifier:";
function cE(e) {
	H.call(this, 0, e);
}
cE.Definition = {
	type: "Identifier",
	metadata: { modifies: !0 },
	params: [{
		name: "as",
		type: "string",
		required: !0
	}]
}, R(cE, H, { transform(e, t) {
	let n = lE(t.dataflow), r = e.as, i = n.value;
	return t.visit(t.ADD, (e) => e[r] = e[r] || ++i), n.set(this.value = i), t;
} });
function lE(e) {
	return e._signals[sE] || (e._signals[sE] = e.add(0));
}
function uE(e) {
	H.call(this, null, e);
}
R(uE, H, { transform(e, t) {
	let n = this.value;
	n || (n = t.dataflow.scenegraph().mark(e.markdef, dE(e), e.index), n.group.context = e.context, e.context.group || (e.context.group = n.group), n.source = this.source, n.clip = e.clip, n.interactive = e.interactive, this.value = n);
	let r = n.marktype === FT ? Fb : Pb;
	return t.visit(t.ADD, (e) => r.call(e, n)), (e.modified("clip") || e.modified("interactive")) && (n.clip = e.clip, n.interactive = !!e.interactive, n.zdirty = !0, t.reflow()), n.items = t.source, t;
} });
function dE(e) {
	let t = e.groups, n = e.parent;
	return t && t.size === 1 ? t.get(Object.keys(t.object)[0]) : t && n ? t.lookup(n) : null;
}
function fE(e) {
	H.call(this, null, e);
}
var pE = {
	parity: (e) => e.filter((e, t) => t % 2 ? e.opacity = 0 : 1),
	greedy: (e, t) => {
		let n;
		return e.filter((e, r) => !r || !mE(n.bounds, e.bounds, t) ? (n = e, 1) : e.opacity = 0);
	}
}, mE = (e, t, n) => n > Math.max(t.x1 - e.x2, e.x1 - t.x2, t.y1 - e.y2, e.y1 - t.y2), hE = (e, t) => {
	for (var n = 1, r = e.length, i = e[0].bounds, a; n < r; i = a, ++n) if (mE(i, a = e[n].bounds, t)) return !0;
}, gE = (e) => {
	let t = e.bounds;
	return t.width() > 1 && t.height() > 1;
}, _E = (e, t, n) => {
	var r = e.range(), i = new Nb();
	return t === ST || t === TT ? i.set(r[0], -Infinity, r[1], Infinity) : i.set(-Infinity, r[0], Infinity, r[1]), i.expand(n || 1), (e) => i.encloses(e.bounds);
}, vE = (e) => (e.forEach((e) => e.opacity = 1), e), yE = (e, t) => e.reflow(t.modified()).modifies("opacity");
R(fE, H, { transform(e, t) {
	let n = pE[e.method] || pE.parity, r = e.separation || 0, i = t.materialize(t.SOURCE).source, a, o;
	if (!i || !i.length) return;
	if (!e.method) return e.modified("method") && (vE(i), t = yE(t, e)), t;
	if (i = i.filter(gE), !i.length) return;
	if (e.sort && (i = i.slice().sort(e.sort)), a = vE(i), t = yE(t, e), a.length >= 3 && hE(a, r)) {
		do
			a = n(a, r);
		while (a.length >= 3 && hE(a, r));
		a.length < 3 && !vu(i).opacity && (a.length > 1 && (vu(a).opacity = 0), vu(i).opacity = 1);
	}
	e.boundScale && e.boundTolerance >= 0 && (o = _E(e.boundScale, e.boundOrient, +e.boundTolerance), i.forEach((e) => {
		o(e) || (e.opacity = 0);
	}));
	let s = a[0].mark.bounds.clear();
	return i.forEach((e) => {
		e.opacity && s.union(e.bounds);
	}), t;
} });
function bE(e) {
	H.call(this, null, e);
}
R(bE, H, { transform(e, t) {
	let n = t.dataflow;
	if (t.visit(t.ALL, (e) => n.dirty(e)), t.fields && t.fields.zindex) {
		let e = t.source && t.source[0];
		e && (e.mark.zdirty = !0);
	}
} });
var xE = new Nb();
function SE(e, t, n) {
	return e[t] === n ? 0 : (e[t] = n, 1);
}
function CE(e) {
	var t = e.items[0].orient;
	return t === CT || t === wT;
}
function wE(e) {
	let t = +e.grid;
	return [
		e.ticks ? t++ : -1,
		e.labels ? t++ : -1,
		t + +e.domain
	];
}
function TE(e, t, n, r) {
	var i = t.items[0], a = i.datum, o = i.translate == null ? .5 : i.translate, s = i.orient, c = wE(a), l = i.range, u = i.offset, d = i.position, f = i.minExtent, p = i.maxExtent, m = a.title && i.items[c[2]].items[0], h = i.titlePadding, g = i.bounds, _ = m && JS(m), v = 0, y = 0, b, x;
	switch (xE.clear().union(g), g.clear(), (b = c[0]) > -1 && g.union(i.items[b].bounds), (b = c[1]) > -1 && g.union(i.items[b].bounds), s) {
		case ST:
			v = d || 0, y = -u, x = Math.max(f, Math.min(p, -g.y1)), g.add(0, -x).add(l, 0), m && EE(e, m, x, h, _, 0, -1, g);
			break;
		case CT:
			v = -u, y = d || 0, x = Math.max(f, Math.min(p, -g.x1)), g.add(-x, 0).add(0, l), m && EE(e, m, x, h, _, 1, -1, g);
			break;
		case wT:
			v = n + u, y = d || 0, x = Math.max(f, Math.min(p, g.x2)), g.add(0, 0).add(x, l), m && EE(e, m, x, h, _, 1, 1, g);
			break;
		case TT:
			v = d || 0, y = r + u, x = Math.max(f, Math.min(p, g.y2)), g.add(0, 0).add(l, x), m && EE(e, m, x, h, 0, 0, 1, g);
			break;
		default: v = i.x, y = i.y;
	}
	return zb(g.translate(v, y), i), SE(i, "x", v + o) | SE(i, "y", y + o) && (i.bounds = xE, e.dirty(i), i.bounds = g, e.dirty(i)), i.mark.bounds.clear().union(g);
}
function EE(e, t, n, r, i, a, o, s) {
	let c = t.bounds;
	if (t.auto) {
		let s = o * (n + i + r), l = 0, u = 0;
		e.dirty(t), a ? l = (t.x || 0) - (t.x = s) : u = (t.y || 0) - (t.y = s), t.mark.bounds.clear().union(c.translate(-l, -u)), e.dirty(t);
	}
	s.union(c);
}
var DE = (e, t) => Math.floor(Math.min(e, t)), OE = (e, t) => Math.ceil(Math.max(e, t));
function kE(e) {
	var t = e.items, n = t.length, r = 0, i, a;
	let o = {
		marks: [],
		rowheaders: [],
		rowfooters: [],
		colheaders: [],
		colfooters: [],
		rowtitle: null,
		coltitle: null
	};
	for (; r < n; ++r) if (i = t[r], a = i.items, i.marktype === FT) switch (i.role) {
		case IT:
		case BT:
		case LT: break;
		case VT:
			o.rowheaders.push(...a);
			break;
		case HT:
			o.rowfooters.push(...a);
			break;
		case WT:
			o.colheaders.push(...a);
			break;
		case GT:
			o.colfooters.push(...a);
			break;
		case UT:
			o.rowtitle = a[0];
			break;
		case KT:
			o.coltitle = a[0];
			break;
		default: o.marks.push(...a);
	}
	return o;
}
function AE(e) {
	return new Nb().set(0, 0, e.width || 0, e.height || 0);
}
function jE(e) {
	let t = e.bounds.clone();
	return t.empty() ? t.set(0, 0, 0, 0) : t.translate(-(e.x || 0), -(e.y || 0));
}
function ME(e, t, n) {
	let r = F(e) ? e[t] : e;
	return r == null ? n === void 0 ? 0 : n : r;
}
function NE(e) {
	return e < 0 ? Math.ceil(-e) : 0;
}
function PE(e, t, n) {
	var r = !n.nodirty, i = n.bounds === nE ? AE : jE, a = xE.set(0, 0, 0, 0), o = ME(n.align, rE), s = ME(n.align, iE), c = ME(n.padding, rE), l = ME(n.padding, iE), u = n.columns || t.length, d = u <= 0 ? 1 : Math.ceil(t.length / u), f = t.length, p = Array(f), m = Array(u), h = 0, g = Array(f), _ = Array(d), v = 0, y = Array(f), b = Array(f), x = Array(f), S, C, w, T, E, D, O, k, ee, te, ne;
	for (C = 0; C < u; ++C) m[C] = 0;
	for (C = 0; C < d; ++C) _[C] = 0;
	for (C = 0; C < f; ++C) D = t[C], E = x[C] = i(D), D.x = D.x || 0, y[C] = 0, D.y = D.y || 0, b[C] = 0, w = C % u, T = ~~(C / u), h = Math.max(h, O = Math.ceil(E.x2)), v = Math.max(v, k = Math.ceil(E.y2)), m[w] = Math.max(m[w], O), _[T] = Math.max(_[T], k), p[C] = c + NE(E.x1), g[C] = l + NE(E.y1), r && e.dirty(t[C]);
	for (C = 0; C < f; ++C) C % u === 0 && (p[C] = 0), C < u && (g[C] = 0);
	if (o === tE) for (w = 1; w < u; ++w) {
		for (ne = 0, C = w; C < f; C += u) ne < p[C] && (ne = p[C]);
		for (C = w; C < f; C += u) p[C] = ne + m[w - 1];
	}
	else if (o === eE) {
		for (ne = 0, C = 0; C < f; ++C) C % u && ne < p[C] && (ne = p[C]);
		for (C = 0; C < f; ++C) C % u && (p[C] = ne + h);
	} else for (o = !1, w = 1; w < u; ++w) for (C = w; C < f; C += u) p[C] += m[w - 1];
	if (s === tE) for (T = 1; T < d; ++T) {
		for (ne = 0, C = T * u, S = C + u; C < S; ++C) ne < g[C] && (ne = g[C]);
		for (C = T * u; C < S; ++C) g[C] = ne + _[T - 1];
	}
	else if (s === eE) {
		for (ne = 0, C = u; C < f; ++C) ne < g[C] && (ne = g[C]);
		for (C = u; C < f; ++C) g[C] = ne + v;
	} else for (s = !1, T = 1; T < d; ++T) for (C = T * u, S = C + u; C < S; ++C) g[C] += _[T - 1];
	for (ee = 0, C = 0; C < f; ++C) ee = p[C] + (C % u ? ee : 0), y[C] += ee - t[C].x;
	for (w = 0; w < u; ++w) for (te = 0, C = w; C < f; C += u) te += g[C], b[C] += te - t[C].y;
	if (o && ME(n.center, rE) && d > 1) for (C = 0; C < f; ++C) E = o === eE ? h : m[C % u], ee = E - x[C].x2 - t[C].x - y[C], ee > 0 && (y[C] += ee / 2);
	if (s && ME(n.center, iE) && u !== 1) for (C = 0; C < f; ++C) E = s === eE ? v : _[~~(C / u)], te = E - x[C].y2 - t[C].y - b[C], te > 0 && (b[C] += te / 2);
	for (C = 0; C < f; ++C) a.union(x[C].translate(y[C], b[C]));
	switch (ee = ME(n.anchor, NT), te = ME(n.anchor, PT), ME(n.anchor, rE)) {
		case MT:
			ee -= a.width();
			break;
		case jT: ee -= a.width() / 2;
	}
	switch (ME(n.anchor, iE)) {
		case MT:
			te -= a.height();
			break;
		case jT: te -= a.height() / 2;
	}
	for (ee = Math.round(ee), te = Math.round(te), a.clear(), C = 0; C < f; ++C) t[C].mark.bounds.clear();
	for (C = 0; C < f; ++C) D = t[C], D.x += y[C] += ee, D.y += b[C] += te, a.union(D.mark.bounds.union(D.bounds.translate(y[C], b[C]))), r && e.dirty(D);
	return a;
}
function FE(e, t, n) {
	var r = kE(t), i = r.marks, a = n.bounds === nE ? IE : LE, o = n.offset, s = n.columns || i.length, c = s <= 0 ? 1 : Math.ceil(i.length / s), l = c * s, u, d, f, p, m, h, g;
	let _ = PE(e, i, n);
	_.empty() && _.set(0, 0, 0, 0), r.rowheaders && (h = ME(n.headerBand, iE, null), u = RE(e, r.rowheaders, i, s, c, -ME(o, "rowHeader"), DE, 0, a, "x1", 0, s, 1, h)), r.colheaders && (h = ME(n.headerBand, rE, null), d = RE(e, r.colheaders, i, s, s, -ME(o, "columnHeader"), DE, 1, a, "y1", 0, 1, s, h)), r.rowfooters && (h = ME(n.footerBand, iE, null), f = RE(e, r.rowfooters, i, s, c, ME(o, "rowFooter"), OE, 0, a, "x2", s - 1, s, 1, h)), r.colfooters && (h = ME(n.footerBand, rE, null), p = RE(e, r.colfooters, i, s, s, ME(o, "columnFooter"), OE, 1, a, "y2", l - s, 1, s, h)), r.rowtitle && (m = ME(n.titleAnchor, iE), g = ME(o, "rowTitle"), g = m === MT ? f + g : u - g, h = ME(n.titleBand, iE, .5), zE(e, r.rowtitle, g, 0, _, h)), r.coltitle && (m = ME(n.titleAnchor, rE), g = ME(o, "columnTitle"), g = m === MT ? p + g : d - g, h = ME(n.titleBand, rE, .5), zE(e, r.coltitle, g, 1, _, h));
}
function IE(e, t) {
	return t === "x1" ? e.x || 0 : t === "y1" ? e.y || 0 : t === "x2" ? (e.x || 0) + (e.width || 0) : t === "y2" ? (e.y || 0) + (e.height || 0) : void 0;
}
function LE(e, t) {
	return e.bounds[t];
}
function RE(e, t, n, r, i, a, o, s, c, l, u, d, f, p) {
	var m = n.length, h = 0, g = 0, _, v, y, b, x, S, C, w, T;
	if (!m) return h;
	for (_ = u; _ < m; _ += d) n[_] && (h = o(h, c(n[_], l)));
	if (!t.length) return h;
	for (t.length > i && (e.warn("Grid headers exceed limit: " + i), t = t.slice(0, i)), h += a, v = 0, b = t.length; v < b; ++v) e.dirty(t[v]), t[v].mark.bounds.clear();
	for (_ = u, v = 0, b = t.length; v < b; ++v, _ += d) {
		for (S = t[v], x = S.mark.bounds, y = _; y >= 0 && (C = n[y]) == null; y -= f);
		s ? (w = p == null ? C.x : Math.round(C.bounds.x1 + p * C.bounds.width()), T = h) : (w = h, T = p == null ? C.y : Math.round(C.bounds.y1 + p * C.bounds.height())), x.union(S.bounds.translate(w - (S.x || 0), T - (S.y || 0))), S.x = w, S.y = T, e.dirty(S), g = o(g, x[l]);
	}
	return g;
}
function zE(e, t, n, r, i, a) {
	if (t) {
		e.dirty(t);
		var o = n, s = n;
		r ? o = Math.round(i.x1 + a * i.width()) : s = Math.round(i.y1 + a * i.height()), t.bounds.translate(o - (t.x || 0), s - (t.y || 0)), t.mark.bounds.clear().union(t.bounds), t.x = o, t.y = s, e.dirty(t);
	}
}
function BE(e, t) {
	let n = e[t] || {};
	return (t, r) => n[t] == null ? e[t] == null ? r : e[t] : n[t];
}
function VE(e, t) {
	let n = -Infinity;
	return e.forEach((e) => {
		e.offset != null && (n = Math.max(n, e.offset));
	}), n > -Infinity ? n : t;
}
function HE(e, t, n, r, i, a, o) {
	let s = BE(n, t), c = VE(e, s("offset", 0)), l = s("anchor", AT), u = l === MT ? 1 : l === jT ? .5 : 0, d = {
		align: tE,
		bounds: s("bounds", nE),
		columns: s("direction") === "vertical" ? 1 : e.length,
		padding: s("margin", 8),
		center: s("center"),
		nodirty: !0
	};
	switch (t) {
		case CT:
			d.anchor = {
				x: Math.floor(r.x1) - c,
				column: MT,
				y: u * (o || r.height() + 2 * r.y1),
				row: l
			};
			break;
		case wT:
			d.anchor = {
				x: Math.ceil(r.x2) + c,
				y: u * (o || r.height() + 2 * r.y1),
				row: l
			};
			break;
		case ST:
			d.anchor = {
				y: Math.floor(i.y1) - c,
				row: MT,
				x: u * (a || i.width() + 2 * i.x1),
				column: l
			};
			break;
		case TT:
			d.anchor = {
				y: Math.ceil(i.y2) + c,
				x: u * (a || i.width() + 2 * i.x1),
				column: l
			};
			break;
		case ET:
			d.anchor = {
				x: c,
				y: c
			};
			break;
		case DT:
			d.anchor = {
				x: a - c,
				y: c,
				column: MT
			};
			break;
		case OT:
			d.anchor = {
				x: c,
				y: o - c,
				row: MT
			};
			break;
		case kT:
			d.anchor = {
				x: a - c,
				y: o - c,
				column: MT,
				row: MT
			};
			break;
	}
	return d;
}
function UE(e, t) {
	var n = t.items[0], r = n.datum, i = n.orient, a = n.bounds, o = n.x, s = n.y, c, l;
	return n._bounds ? n._bounds.clear().union(a) : n._bounds = a.clone(), a.clear(), GE(e, n, n.items[0].items[0]), a = WE(n, a), c = 2 * n.padding, l = 2 * n.padding, a.empty() || (c = Math.ceil(a.width() + c), l = Math.ceil(a.height() + l)), r.type === JT && JE(n.items[0].items[0].items[0].items), i !== $T && (n.x = o = 0, n.y = s = 0), n.width = c, n.height = l, zb(a.set(o, s, o + c, s + l), n), n.mark.bounds.clear().union(a), n;
}
function WE(e, t) {
	return e.items.forEach((e) => t.union(e.bounds)), t.x1 = e.padding, t.y1 = e.padding, t;
}
function GE(e, t, n) {
	var r = t.padding, i = r - n.x, a = r - n.y;
	if (!t.datum.title) (i || a) && qE(e, n, i, a);
	else {
		var o = t.items[1].items[0], s = o.anchor, c = t.titlePadding || 0, l = r - o.x, u = r - o.y;
		switch (o.orient) {
			case CT:
				i += Math.ceil(o.bounds.width()) + c;
				break;
			case wT:
			case TT: break;
			default: a += o.bounds.height() + c;
		}
		switch ((i || a) && qE(e, n, i, a), o.orient) {
			case CT:
				u += KE(t, n, o, s, 1, 1);
				break;
			case wT:
				l += KE(t, n, o, MT, 0, 0) + c, u += KE(t, n, o, s, 1, 1);
				break;
			case TT:
				l += KE(t, n, o, s, 0, 0), u += KE(t, n, o, MT, -1, 0, 1) + c;
				break;
			default: l += KE(t, n, o, s, 0, 0);
		}
		(l || u) && qE(e, o, l, u), (l = Math.round(o.bounds.x1 - r)) < 0 && (qE(e, n, -l, 0), qE(e, o, -l, 0));
	}
}
function KE(e, t, n, r, i, a, o) {
	let s = e.datum.type !== "symbol", c = n.datum.vgrad, l = (s && (a || !c) && !o ? t.items[0] : t).bounds[i ? "y2" : "x2"] - e.padding, u = c && a ? l : 0, d = c && a ? 0 : l, f = i <= 0 ? 0 : JS(n);
	return Math.round(r === AT ? u : r === MT ? d - f : .5 * (l - f));
}
function qE(e, t, n, r) {
	t.x += n, t.y += r, t.bounds.translate(n, r), t.mark.bounds.translate(n, r), e.dirty(t);
}
function JE(e) {
	let t = e.reduce((e, t) => (e[t.column] = Math.max(t.bounds.x2 - t.x, e[t.column] || 0), e), {});
	e.forEach((e) => {
		e.width = t[e.column], e.height = e.bounds.y2 - e.y;
	});
}
function YE(e, t, n, r, i) {
	var a = t.items[0], o = a.frame, s = a.orient, c = a.anchor, l = a.offset, u = a.padding, d = a.items[0].items[0], f = a.items[1] && a.items[1].items[0], p = s === CT || s === wT ? r : n, m = 0, h = 0, g = 0, _ = 0, v = 0, y;
	if (o === FT ? s === CT && (m = r, p = 0) : s === CT ? (m = i.y2, p = i.y1) : s === wT ? (m = i.y1, p = i.y2) : (m = i.x1, p = i.x2), y = c === AT ? m : c === MT ? p : (m + p) / 2, f && f.text) {
		switch (s) {
			case ST:
			case TT:
				v = d.bounds.height() + u;
				break;
			case CT:
				_ = d.bounds.width() + u;
				break;
			case wT:
				_ = -d.bounds.width() - u;
				break;
		}
		xE.clear().union(f.bounds), xE.translate(_ - (f.x || 0), v - (f.y || 0)), SE(f, "x", _) | SE(f, "y", v) && (e.dirty(f), f.bounds.clear().union(xE), f.mark.bounds.clear().union(xE), e.dirty(f)), xE.clear().union(f.bounds);
	} else xE.clear();
	switch (xE.union(d.bounds), s) {
		case ST:
			h = y, g = i.y1 - xE.height() - l;
			break;
		case CT:
			h = i.x1 - xE.width() - l, g = y;
			break;
		case wT:
			h = i.x2 + xE.width() + l, g = y;
			break;
		case TT:
			h = y, g = i.y2 + l;
			break;
		default: h = a.x, g = a.y;
	}
	return SE(a, "x", h) | SE(a, "y", g) && (xE.translate(h, g), e.dirty(a), a.bounds.clear().union(xE), t.bounds.clear().union(xE), e.dirty(a)), a.bounds;
}
function XE(e) {
	H.call(this, null, e);
}
R(XE, H, { transform(e, t) {
	let n = t.dataflow;
	return e.mark.items.forEach((t) => {
		e.layout && FE(n, t, e.layout), QE(n, t, e);
	}), ZE(e.mark.group) ? t.reflow() : t;
} });
function ZE(e) {
	return e && e.mark.role !== "legend-entry";
}
function QE(e, t, n) {
	var r = t.items, i = Math.max(0, t.width || 0), a = Math.max(0, t.height || 0), o = new Nb().set(0, 0, i, a), s = o.clone(), c = o.clone(), l = [], u, d, f, p, m, h;
	for (m = 0, h = r.length; m < h; ++m) switch (d = r[m], d.role) {
		case IT:
			p = CE(d) ? s : c, p.union(TE(e, d, i, a));
			break;
		case LT:
			u = d;
			break;
		case BT:
			l.push(UE(e, d));
			break;
		case RT:
		case zT:
		case VT:
		case HT:
		case UT:
		case WT:
		case GT:
		case KT:
			s.union(d.bounds), c.union(d.bounds);
			break;
		default: o.union(d.bounds);
	}
	if (l.length) {
		let t = {};
		l.forEach((e) => {
			f = e.orient || wT, f !== $T && (t[f] || (t[f] = [])).push(e);
		});
		for (let r in t) {
			let o = t[r];
			PE(e, o, HE(o, r, n.legends, s, c, i, a));
		}
		l.forEach((t) => {
			let r = t.bounds;
			if (r.equals(t._bounds) || (t.bounds = t._bounds, e.dirty(t), t.bounds = r, e.dirty(t)), n.autosize && (n.autosize.type === YT || n.autosize.type === XT || n.autosize.type === ZT)) switch (t.orient) {
				case CT:
				case wT:
					o.add(r.x1, 0).add(r.x2, 0);
					break;
				case ST:
				case TT: o.add(0, r.y1).add(0, r.y2);
			}
			else o.union(r);
		});
	}
	o.union(s).union(c), u && o.union(YE(e, u, i, a, o)), t.clip && o.set(0, 0, t.width || 0, t.height || 0), $E(e, t, o, n);
}
function $E(e, t, n, r) {
	let i = r.autosize || {}, a = i.type;
	if (e._autosize < 1 || !a) return;
	let o = e._width, s = e._height, c = Math.max(0, t.width || 0), l = Math.max(0, Math.ceil(-n.x1)), u = Math.max(0, t.height || 0), d = Math.max(0, Math.ceil(-n.y1)), f = Math.max(0, Math.ceil(n.x2 - c)), p = Math.max(0, Math.ceil(n.y2 - u));
	if (i.contains === qT) {
		let t = e.padding();
		o -= t.left + t.right, s -= t.top + t.bottom;
	}
	a === $T ? (l = 0, d = 0, c = o, u = s) : a === YT ? (c = Math.max(0, o - l - f), u = Math.max(0, s - d - p)) : a === XT ? (c = Math.max(0, o - l - f), s = u + d + p) : a === ZT ? (o = c + l + f, u = Math.max(0, s - d - p)) : a === QT && (o = c + l + f, s = u + d + p), e._resizeView(o, s, c, u, [l, d], i.resize);
}
//#endregion
//#region ../../node_modules/.pnpm/vega-encode@5.1.0/node_modules/vega-encode/build/vega-encode.js
var eD = /* @__PURE__ */ t({
	axisticks: () => tD,
	datajoin: () => nD,
	encode: () => aD,
	legendentries: () => oD,
	linkpath: () => dD,
	pie: () => vD,
	scale: () => CD,
	sortitems: () => ID,
	stack: () => VD
});
function tD(e) {
	H.call(this, null, e);
}
R(tD, H, { transform(e, t) {
	if (this.value && !e.modified()) return t.StopPropagation;
	var n = t.dataflow.locale(), r = t.fork(t.NO_SOURCE | t.NO_FIELDS), i = this.value, a = e.scale, o = Yv(a, e.count == null ? e.values ? e.values.length : 10 : e.count, e.minstep), s = e.format || Qv(n, a, o, e.formatSpecifier, e.formatType, !!e.values), c = e.values ? Xv(a, e.values, o) : Zv(a, o);
	return i && (r.rem = i), i = c.map((e, t) => Rp({
		index: t / (c.length - 1 || 1),
		value: e,
		label: s(e)
	})), e.extra && i.length && i.push(Rp({
		index: -1,
		extra: { value: i[0].value },
		label: ""
	})), r.source = i, r.add = i, this.value = i, r;
} });
function nD(e) {
	H.call(this, null, e);
}
function rD() {
	return Rp({});
}
function iD(e) {
	let t = Zu().test((e) => e.exit);
	return t.lookup = (n) => t.get(e(n)), t;
}
R(nD, H, { transform(e, t) {
	var n = t.dataflow, r = t.fork(t.NO_SOURCE | t.NO_FIELDS), i = e.item || rD, a = e.key || V, o = this.value;
	return P(r.encode) && (r.encode = null), o && (e.modified("key") || t.modified(a)) && N("DataJoin does not support modified key function or fields."), o || (t = t.addAll(), this.value = o = iD(a)), t.visit(t.ADD, (e) => {
		let t = a(e), n = o.get(t);
		n ? n.exit ? (o.empty--, r.add.push(n)) : r.mod.push(n) : (n = i(e), o.set(t, n), r.add.push(n)), n.datum = e, n.exit = !1;
	}), t.visit(t.MOD, (e) => {
		let t = a(e), n = o.get(t);
		n && (n.datum = e, r.mod.push(n));
	}), t.visit(t.REM, (e) => {
		let t = a(e), n = o.get(t);
		e === n.datum && !n.exit && (r.rem.push(n), n.exit = !0, ++o.empty);
	}), t.changed(t.ADD_MOD) && r.modifies("datum"), (t.clean() || e.clean && o.empty > n.cleanThreshold) && n.runAfter(o.clean), r;
} });
function aD(e) {
	H.call(this, null, e);
}
R(aD, H, { transform(e, t) {
	var n = t.fork(t.ADD_REM), r = e.mod || !1, i = e.encoders, a = t.encode;
	if (P(a)) if (n.changed() || a.every((e) => i[e])) a = a[0], n.encode = null;
	else return t.StopPropagation;
	var o = a === "enter", s = i.update || uu, c = i.enter || uu, l = i.exit || uu, u = (a && !o ? i[a] : s) || uu;
	if (t.changed(t.ADD) && (t.visit(t.ADD, (t) => {
		c(t, e), s(t, e);
	}), n.modifies(c.output), n.modifies(s.output), u !== uu && u !== s && (t.visit(t.ADD, (t) => {
		u(t, e);
	}), n.modifies(u.output))), t.changed(t.REM) && l !== uu && (t.visit(t.REM, (t) => {
		l(t, e);
	}), n.modifies(l.output)), o || u !== uu) {
		let i = t.MOD | (e.modified() ? t.REFLOW : 0);
		o ? (t.visit(i, (t) => {
			let i = c(t, e) || r;
			(u(t, e) || i) && n.mod.push(t);
		}), n.mod.length && n.modifies(c.output)) : t.visit(i, (t) => {
			(u(t, e) || r) && n.mod.push(t);
		}), n.mod.length && n.modifies(u.output);
	}
	return n.changed() ? n : t.StopPropagation;
} });
function oD(e) {
	H.call(this, [], e);
}
R(oD, H, { transform(e, t) {
	if (this.value != null && !e.modified()) return t.StopPropagation;
	var n = t.dataflow.locale(), r = t.fork(t.NO_SOURCE | t.NO_FIELDS), i = this.value, a = e.type || "symbol", o = e.scale, s = +e.limit, c = Yv(o, e.count == null ? 5 : e.count, e.minstep), l = !!e.values || a === "symbol", u = e.format || oy(n, o, c, a, e.formatSpecifier, e.formatType, l), d = e.values || ny(o, c), f, p, m, h, g;
	return i && (r.rem = i), a === "symbol" ? (s && d.length > s ? (t.dataflow.warn("Symbol legend count exceeds limit, filtering items."), i = d.slice(0, s - 1), g = !0) : i = d, Ru(m = e.size) ? (!e.values && o(i[0]) === 0 && (i = i.slice(1)), h = i.reduce((t, n) => Math.max(t, m(n, e)), 0)) : m = Gu(h = m || 8), i = i.map((t, n) => Rp({
		index: n,
		label: u(t, n, i),
		value: t,
		offset: h,
		size: m(t, e)
	})), g && (g = d[i.length], i.push(Rp({
		index: i.length,
		label: `\u2026${d.length - i.length} entries`,
		value: g,
		offset: h,
		size: m(g, e)
	})))) : a === "gradient" ? (f = o.domain(), p = Lv(o, f[0], vu(f)), d.length < 3 && !e.values && f[0] !== vu(f) && (d = [f[0], vu(f)]), i = d.map((e, t) => Rp({
		index: t,
		label: u(e, t, d),
		value: e,
		perc: p(e)
	}))) : (m = d.length - 1, p = Ree(o), i = d.map((e, t) => Rp({
		index: t,
		label: u(e, t, d),
		value: e,
		perc: t ? p(e) : 0,
		perc2: t === m ? 1 : p(d[t + 1])
	}))), r.source = i, r.add = i, this.value = i, r;
} });
var sD = (e) => e.source.x, cD = (e) => e.source.y, lD = (e) => e.target.x, uD = (e) => e.target.y;
function dD(e) {
	H.call(this, {}, e);
}
dD.Definition = {
	type: "LinkPath",
	metadata: { modifies: !0 },
	params: [
		{
			name: "sourceX",
			type: "field",
			default: "source.x"
		},
		{
			name: "sourceY",
			type: "field",
			default: "source.y"
		},
		{
			name: "targetX",
			type: "field",
			default: "target.x"
		},
		{
			name: "targetY",
			type: "field",
			default: "target.y"
		},
		{
			name: "orient",
			type: "enum",
			default: "vertical",
			values: [
				"horizontal",
				"vertical",
				"radial"
			]
		},
		{
			name: "shape",
			type: "enum",
			default: "line",
			values: [
				"line",
				"arc",
				"curve",
				"diagonal",
				"orthogonal"
			]
		},
		{
			name: "require",
			type: "signal"
		},
		{
			name: "as",
			type: "string",
			default: "path"
		}
	]
}, R(dD, H, { transform(e, t) {
	var n = e.sourceX || sD, r = e.sourceY || cD, i = e.targetX || lD, a = e.targetY || uD, o = e.as || "path", s = e.orient || "vertical", c = e.shape || "line", l = _D.get(c + "-" + s) || _D.get(c);
	return l || N("LinkPath unsupported type: " + e.shape + (e.orient ? "-" + e.orient : "")), t.visit(t.SOURCE, (e) => {
		e[o] = l(n(e), r(e), i(e), a(e));
	}), t.reflow(e.modified()).modifies(o);
} });
var fD = (e, t, n, r) => "M" + e + "," + t + "L" + n + "," + r, pD = (e, t, n, r) => fD(t * Math.cos(e), t * Math.sin(e), r * Math.cos(n), r * Math.sin(n)), mD = (e, t, n, r) => {
	var i = n - e, a = r - t, o = Math.hypot(i, a) / 2, s = 180 * Math.atan2(a, i) / Math.PI;
	return "M" + e + "," + t + "A" + o + "," + o + " " + s + " 0 1 " + n + "," + r;
}, hD = (e, t, n, r) => mD(t * Math.cos(e), t * Math.sin(e), r * Math.cos(n), r * Math.sin(n)), gD = (e, t, n, r) => {
	let i = n - e, a = r - t, o = .2 * (i + a), s = .2 * (a - i);
	return "M" + e + "," + t + "C" + (e + o) + "," + (t + s) + " " + (n + s) + "," + (r - o) + " " + n + "," + r;
}, _D = Zu({
	line: fD,
	"line-radial": pD,
	arc: mD,
	"arc-radial": hD,
	curve: gD,
	"curve-radial": (e, t, n, r) => gD(t * Math.cos(e), t * Math.sin(e), r * Math.cos(n), r * Math.sin(n)),
	"orthogonal-horizontal": (e, t, n, r) => "M" + e + "," + t + "V" + r + "H" + n,
	"orthogonal-vertical": (e, t, n, r) => "M" + e + "," + t + "H" + n + "V" + r,
	"orthogonal-radial": (e, t, n, r) => {
		let i = Math.cos(e), a = Math.sin(e), o = Math.cos(n), s = Math.sin(n), c = Math.abs(n - e) > Math.PI ? n <= e : n > e;
		return "M" + t * i + "," + t * a + "A" + t + "," + t + " 0 0," + +!!c + " " + t * o + "," + t * s + "L" + r * o + "," + r * s;
	},
	"diagonal-horizontal": (e, t, n, r) => {
		let i = (e + n) / 2;
		return "M" + e + "," + t + "C" + i + "," + t + " " + i + "," + r + " " + n + "," + r;
	},
	"diagonal-vertical": (e, t, n, r) => {
		let i = (t + r) / 2;
		return "M" + e + "," + t + "C" + e + "," + i + " " + n + "," + i + " " + n + "," + r;
	},
	"diagonal-radial": (e, t, n, r) => {
		let i = Math.cos(e), a = Math.sin(e), o = Math.cos(n), s = Math.sin(n), c = (t + r) / 2;
		return "M" + t * i + "," + t * a + "C" + c * i + "," + c * a + " " + c * o + "," + c * s + " " + r * o + "," + r * s;
	}
});
function vD(e) {
	H.call(this, null, e);
}
vD.Definition = {
	type: "Pie",
	metadata: { modifies: !0 },
	params: [
		{
			name: "field",
			type: "field"
		},
		{
			name: "startAngle",
			type: "number",
			default: 0
		},
		{
			name: "endAngle",
			type: "number",
			default: 6.283185307179586
		},
		{
			name: "sort",
			type: "boolean",
			default: !1
		},
		{
			name: "as",
			type: "string",
			array: !0,
			length: 2,
			default: ["startAngle", "endAngle"]
		}
	]
}, R(vD, H, { transform(e, t) {
	var n = e.as || ["startAngle", "endAngle"], r = n[0], i = n[1], a = e.field || cu, o = e.startAngle || 0, s = e.endAngle == null ? 2 * Math.PI : e.endAngle, c = t.source, l = c.map(a), u = l.length, d = o, f = (s - o) / Pt(l), p = ye(u), m, h, g;
	for (e.sort && p.sort((e, t) => l[e] - l[t]), m = 0; m < u; ++m) g = l[p[m]], h = c[p[m]], h[r] = d, h[i] = d += g * f;
	return this.value = l, t.reflow(e.modified()).modifies(n);
} });
var yD = 5;
function bD(e) {
	let t = e.type;
	return !e.bins && (t === "linear" || t === "pow" || t === "sqrt");
}
function xD(e) {
	return Ev(e) && e !== "sequential";
}
var SD = _d([
	"set",
	"modified",
	"clear",
	"type",
	"scheme",
	"schemeExtent",
	"schemeCount",
	"domain",
	"domainMin",
	"domainMid",
	"domainMax",
	"domainRaw",
	"domainImplicit",
	"nice",
	"zero",
	"bins",
	"range",
	"rangeStep",
	"round",
	"reverse",
	"interpolate",
	"interpolateGamma"
]);
function CD(e) {
	H.call(this, null, e), this.modified(!0);
}
R(CD, H, { transform(e, t) {
	var n = t.dataflow, r = this.value, i = wD(e);
	for (i in (!r || i !== r.type) && (this.value = r = Cv(i)()), e) if (!SD[i]) {
		if (i === "padding" && xD(r.type)) continue;
		Ru(r[i]) ? r[i](e[i]) : n.warn("Unsupported scale property: " + i);
	}
	return jD(r, e, AD(r, e, ED(r, e, n))), t.fork(t.NO_SOURCE | t.NO_FIELDS);
} });
function wD(e) {
	var t = e.type, n = "", r;
	return t === "sequential" ? Y_ + "-" + G_ : (TD(e) && (r = e.rawDomain ? e.rawDomain.length : e.domain ? e.domain.length + +(e.domainMid != null) : 0, n = r === 2 ? Y_ + "-" : r === 3 ? X_ + "-" : ""), (n + t || "linear").toLowerCase());
}
function TD(e) {
	let t = e.type;
	return Ev(t) && t !== "time" && t !== "utc" && (e.scheme || e.range && e.range.length && e.range.every(z));
}
function ED(e, t, n) {
	let r = DD(e, t.domainRaw, n);
	if (r > -1) return r;
	var i = t.domain, a = e.type, o = t.zero || t.zero === void 0 && bD(e), s, c;
	if (!i) return 0;
	if ((o || t.domainMin != null || t.domainMax != null || t.domainMid != null) && (s = (i = i.slice()).length - 1 || 1, o && (i[0] > 0 && (i[0] = 0), i[s] < 0 && (i[s] = 0)), t.domainMin != null && (i[0] = t.domainMin), t.domainMax != null && (i[s] = t.domainMax), t.domainMid != null)) {
		c = t.domainMid;
		let e = c > i[s] ? s + 1 : c < i[0] ? 0 : s;
		e !== s && n.warn("Scale domainMid exceeds domain min or max.", c), i.splice(e, 0, c);
	}
	return xD(a) && t.padding && i[0] !== vu(i) && (i = OD(a, i, t.range, t.padding, t.exponent, t.constant)), e.domain(kD(a, i, n)), a === "ordinal" && e.unknown(t.domainImplicit ? S : void 0), t.nice && e.nice && e.nice(t.nice !== !0 && Yv(e, t.nice) || null), i.length;
}
function DD(e, t, n) {
	return t ? (e.domain(kD(e.type, t, n)), t.length) : -1;
}
function OD(e, t, n, r, i, a) {
	var o = Math.abs(vu(n) - n[0]), s = o / (o - 2 * r), c = e === "log" ? Mu(t, null, s) : e === "sqrt" ? Nu(t, null, s, .5) : e === "pow" ? Nu(t, null, s, i || 1) : e === "symlog" ? Pu(t, null, s, a || 1) : ju(t, null, s);
	return t = t.slice(), t[0] = c[0], t[t.length - 1] = c[1], t;
}
function kD(e, t, n) {
	return kv(e) && Math.abs(t.reduce((e, t) => e + (t < 0 ? -1 : +(t > 0)), 0)) !== t.length && n.warn("Log scale domain includes zero: " + B(t)), t;
}
function AD(e, t, n) {
	let r = t.bins;
	if (r && !P(r)) {
		let t = e.domain(), n = t[0], i = vu(t), a = r.step, o = r.start == null ? n : r.start, s = r.stop == null ? i : r.stop;
		a || N("Scale bins parameter missing step property."), o < n && (o = a * Math.ceil(n / a)), s > i && (s = a * Math.floor(i / a)), r = ye(o, s + a / 2, a);
	}
	return r ? e.bins = r : e.bins && delete e.bins, e.type === "bin-ordinal" && (r ? !t.domain && !t.domainRaw && (e.domain(r), n = r.length) : e.bins = e.domain()), n;
}
function jD(e, t, n) {
	var r = e.type, i = t.round || !1, a = t.range;
	if (t.rangeStep != null) a = MD(r, t, n);
	else if (t.scheme && (a = ND(r, t, n), Ru(a))) {
		if (e.interpolator) return e.interpolator(a);
		N(`Scale type ${r} does not support interpolating color schemes.`);
	}
	if (a && jv(r)) return e.interpolator(Fv(FD(a, t.reverse), t.interpolate, t.interpolateGamma));
	a && t.interpolate && e.interpolate ? e.interpolate(Rv(t.interpolate, t.interpolateGamma)) : Ru(e.round) ? e.round(i) : Ru(e.rangeRound) && e.interpolate(i ? Ye : Ee), a && e.range(FD(a, t.reverse));
}
function MD(e, t, n) {
	e !== "band" && e !== "point" && N("Only band and point scales support rangeStep.");
	var r = (t.paddingOuter == null ? t.padding : t.paddingOuter) || 0, i = e === "point" ? 1 : (t.paddingInner == null ? t.padding : t.paddingInner) || 0;
	return [0, t.rangeStep * U_(n, i, r)];
}
function ND(e, t, n) {
	var r = t.schemeExtent, i, a;
	return P(t.scheme) ? a = Fv(t.scheme, t.interpolate, t.interpolateGamma) : (i = t.scheme.toLowerCase(), a = Gv(i), a || N(`Unrecognized scheme name: ${t.scheme}`)), n = e === "threshold" ? n + 1 : e === "bin-ordinal" ? n - 1 : e === "quantile" || e === "quantize" ? +t.schemeCount || yD : n, jv(e) ? PD(a, r, t.reverse) : Ru(a) ? Iv(PD(a, r), n) : e === "ordinal" ? a : a.slice(0, n);
}
function PD(e, t, n) {
	return Ru(e) && (t || n) ? Pv(e, FD(t || [0, 1], n)) : e;
}
function FD(e, t) {
	return t ? e.slice().reverse() : e;
}
function ID(e) {
	H.call(this, null, e);
}
R(ID, H, { transform(e, t) {
	let n = e.modified("sort") || t.changed(t.ADD) || t.modified(e.sort.fields) || t.modified("datum");
	return n && t.source.sort(Hp(e.sort)), this.modified(n), t;
} });
var LD = "zero", RD = "center", zD = "normalize", BD = ["y0", "y1"];
function VD(e) {
	H.call(this, null, e);
}
VD.Definition = {
	type: "Stack",
	metadata: { modifies: !0 },
	params: [
		{
			name: "field",
			type: "field"
		},
		{
			name: "groupby",
			type: "field",
			array: !0
		},
		{
			name: "sort",
			type: "compare"
		},
		{
			name: "offset",
			type: "enum",
			default: LD,
			values: [
				LD,
				RD,
				zD
			]
		},
		{
			name: "as",
			type: "string",
			array: !0,
			length: 2,
			default: BD
		}
	]
}, R(VD, H, { transform(e, t) {
	var n = e.as || BD, r = n[0], i = n[1], a = Hp(e.sort), o = e.field || cu, s = e.offset === RD ? HD : e.offset === zD ? UD : WD, c = GD(t.source, e.groupby, a, o), l, u, d;
	for (l = 0, u = c.length, d = c.max; l < u; ++l) s(c[l], d, o, r, i);
	return t.reflow(e.modified()).modifies(n);
} });
function HD(e, t, n, r, i) {
	for (var a = (t - e.sum) / 2, o = e.length, s = 0, c; s < o; ++s) c = e[s], c[r] = a, c[i] = a += Math.abs(n(c));
}
function UD(e, t, n, r, i) {
	for (var a = 1 / e.sum, o = 0, s = e.length, c = 0, l = 0, u; c < s; ++c) u = e[c], u[r] = o, u[i] = o = a * (l += Math.abs(n(u)));
}
function WD(e, t, n, r, i) {
	for (var a = 0, o = 0, s = e.length, c = 0, l, u; c < s; ++c) u = e[c], l = +n(u), l < 0 ? (u[r] = o, u[i] = o += l) : (u[r] = a, u[i] = a += l);
}
function GD(e, t, n, r) {
	var i = [], a = (e) => e(u), o, s, c, l, u, d, f, p, m;
	if (t == null) i.push(e.slice());
	else for (o = {}, s = 0, c = e.length; s < c; ++s) u = e[s], d = t.map(a), f = o[d], f || (o[d] = f = [], i.push(f)), f.push(u);
	for (d = 0, m = 0, l = i.length; d < l; ++d) {
		for (f = i[d], s = 0, p = 0, c = f.length; s < c; ++s) p += Math.abs(r(f[s]));
		f.sum = p, p > m && (m = p), n && f.sort(n);
	}
	return i.max = m, i;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo-projection@4.0.0/node_modules/d3-geo-projection/src/math.js
var KD = Math.abs, qD = Math.cos, JD = Math.sin, YD = Math.PI, XD = YD / 2;
YD / 4;
var ZD = $D(2);
YD * 2, 180 / YD, YD / 180;
function QD(e) {
	return e > 1 ? XD : e < -1 ? -XD : Math.asin(e);
}
function $D(e) {
	return e > 0 ? Math.sqrt(e) : 0;
}
//#endregion
//#region ../../node_modules/.pnpm/d3-geo-projection@4.0.0/node_modules/d3-geo-projection/src/mollweide.js
function eO(e, t) {
	var n = e * JD(t), r = 30, i;
	do
		t -= i = (t + JD(t) - n) / (1 + qD(t));
	while (KD(i) > 1e-6 && --r > 0);
	return t / 2;
}
function tO(e, t, n) {
	function r(r, i) {
		return [e * r * qD(i = eO(n, i)), t * JD(i)];
	}
	return r.invert = function(r, i) {
		return i = QD(i / t), [r / (e * qD(i)), QD((2 * i + JD(2 * i)) / n)];
	}, r;
}
var nO = tO(ZD / XD, ZD, YD);
function rO() {
	return ps(nO).scale(169.529);
}
//#endregion
//#region ../../node_modules/.pnpm/vega-projection@2.1.0/node_modules/vega-projection/build/vega-projection.js
var iO = Xo(), aO = [
	"clipAngle",
	"clipExtent",
	"scale",
	"translate",
	"center",
	"rotate",
	"parallels",
	"precision",
	"reflectX",
	"reflectY",
	"coefficient",
	"distance",
	"fraction",
	"lobes",
	"parallel",
	"radius",
	"ratio",
	"spacing",
	"tilt"
];
function oO(e, t) {
	return function n() {
		let r = t();
		return r.type = e, r.path = Xo().projection(r), r.copy = r.copy || function() {
			let e = n();
			return aO.forEach((t) => {
				r[t] && e[t](r[t]());
			}), e.path.pointRadius(r.path.pointRadius()), e;
		}, bv(r);
	};
}
function sO(e, t) {
	if (!e || typeof e != "string") throw Error("Projection type must be a name string.");
	return e = e.toLowerCase(), arguments.length > 1 ? (lO[e] = oO(e, t), this) : lO[e] || null;
}
function cO(e) {
	return e && e.path || iO;
}
var lO = {
	albers: ys,
	albersusa: xs,
	azimuthalequalarea: Ts,
	azimuthalequidistant: Ds,
	conicconformal: Ns,
	conicequalarea: vs,
	conicequidistant: Ls,
	equalEarth: Gs,
	equirectangular: Fs,
	gnomonic: uee,
	identity: dee,
	mercator: ks,
	mollweide: rO,
	naturalEarth1: fee,
	orthographic: pee,
	stereographic: mee,
	transversemercator: hee
};
for (let e in lO) sO(e, lO[e]);
//#endregion
//#region ../../node_modules/.pnpm/vega-geo@5.1.0/node_modules/vega-geo/build/vega-geo.js
var uO = /* @__PURE__ */ t({
	contour: () => PO,
	geojson: () => RO,
	geopath: () => zO,
	geopoint: () => VO,
	geoshape: () => HO,
	graticule: () => WO,
	heatmap: () => GO,
	isocontour: () => xO,
	kde2d: () => AO,
	projection: () => XO
});
function dO() {}
var fO = [
	[],
	[[[1, 1.5], [.5, 1]]],
	[[[1.5, 1], [1, 1.5]]],
	[[[1.5, 1], [.5, 1]]],
	[[[1, .5], [1.5, 1]]],
	[[[1, 1.5], [.5, 1]], [[1, .5], [1.5, 1]]],
	[[[1, .5], [1, 1.5]]],
	[[[1, .5], [.5, 1]]],
	[[[.5, 1], [1, .5]]],
	[[[1, 1.5], [1, .5]]],
	[[[.5, 1], [1, .5]], [[1.5, 1], [1, 1.5]]],
	[[[1.5, 1], [1, .5]]],
	[[[.5, 1], [1.5, 1]]],
	[[[1, 1.5], [1.5, 1]]],
	[[[.5, 1], [1, 1.5]]],
	[]
];
function pO() {
	var e = 1, t = 1, n = s;
	function r(e, t) {
		return t.map((t) => i(e, t));
	}
	function i(e, t) {
		var r = [], i = [];
		return a(e, t, (a) => {
			n(a, e, t), mO(a) > 0 ? r.push([a]) : i.push(a);
		}), i.forEach((e) => {
			for (var t = 0, n = r.length, i; t < n; ++t) if (hO((i = r[t])[0], e) !== -1) {
				i.push(e);
				return;
			}
		}), {
			type: "MultiPolygon",
			value: t,
			coordinates: r
		};
	}
	function a(n, r, i) {
		var a = [], s = [], c = l = -1, l, u, d = n[0] >= r, f, p;
		for (fO[d << 1].forEach(m); ++c < e - 1;) u = d, d = n[c + 1] >= r, fO[u | d << 1].forEach(m);
		for (fO[d << 0].forEach(m); ++l < t - 1;) {
			for (c = -1, d = n[l * e + e] >= r, f = n[l * e] >= r, fO[d << 1 | f << 2].forEach(m); ++c < e - 1;) u = d, d = n[l * e + e + c + 1] >= r, p = f, f = n[l * e + c + 1] >= r, fO[u | d << 1 | f << 2 | p << 3].forEach(m);
			fO[d | f << 3].forEach(m);
		}
		for (c = -1, f = n[l * e] >= r, fO[f << 2].forEach(m); ++c < e - 1;) p = f, f = n[l * e + c + 1] >= r, fO[f << 2 | p << 3].forEach(m);
		fO[f << 3].forEach(m);
		function m(e) {
			var t = [e[0][0] + c, e[0][1] + l], n = [e[1][0] + c, e[1][1] + l], r = o(t), u = o(n), d, f;
			(d = s[r]) ? (f = a[u]) ? (delete s[d.end], delete a[f.start], d === f ? (d.ring.push(n), i(d.ring)) : a[d.start] = s[f.end] = {
				start: d.start,
				end: f.end,
				ring: d.ring.concat(f.ring)
			}) : (delete s[d.end], d.ring.push(n), s[d.end = u] = d) : (d = a[u]) ? (f = s[r]) ? (delete a[d.start], delete s[f.end], d === f ? (d.ring.push(n), i(d.ring)) : a[f.start] = s[d.end] = {
				start: f.start,
				end: d.end,
				ring: f.ring.concat(d.ring)
			}) : (delete a[d.start], d.ring.unshift(t), a[d.start = r] = d) : a[r] = s[u] = {
				start: r,
				end: u,
				ring: [t, n]
			};
		}
	}
	function o(t) {
		return t[0] * 2 + t[1] * (e + 1) * 4;
	}
	function s(n, r, i) {
		n.forEach((n) => {
			var a = n[0], o = n[1], s = a | 0, c = o | 0, l, u = r[c * e + s];
			a > 0 && a < e && s === a && (l = r[c * e + s - 1], n[0] = a + (i - l) / (u - l) - .5), o > 0 && o < t && c === o && (l = r[(c - 1) * e + s], n[1] = o + (i - l) / (u - l) - .5);
		});
	}
	return r.contour = i, r.size = function(n) {
		if (!arguments.length) return [e, t];
		var i = Math.floor(n[0]), a = Math.floor(n[1]);
		return i >= 0 && a >= 0 || N("invalid size"), e = i, t = a, r;
	}, r.smooth = function(e) {
		return arguments.length ? (n = e ? s : dO, r) : n === s;
	}, r;
}
function mO(e) {
	for (var t = 0, n = e.length, r = e[n - 1][1] * e[0][0] - e[n - 1][0] * e[0][1]; ++t < n;) r += e[t - 1][1] * e[t][0] - e[t - 1][0] * e[t][1];
	return r;
}
function hO(e, t) {
	for (var n = -1, r = t.length, i; ++n < r;) if (i = gO(e, t[n])) return i;
	return 0;
}
function gO(e, t) {
	for (var n = t[0], r = t[1], i = -1, a = 0, o = e.length, s = o - 1; a < o; s = a++) {
		var c = e[a], l = c[0], u = c[1], d = e[s], f = d[0], p = d[1];
		if (_O(c, d, t)) return 0;
		u > r != p > r && n < (f - l) * (r - u) / (p - u) + l && (i = -i);
	}
	return i;
}
function _O(e, t, n) {
	var r;
	return vO(e, t, n) && yO(e[r = +(e[0] === t[0])], n[r], t[r]);
}
function vO(e, t, n) {
	return (t[0] - e[0]) * (n[1] - e[1]) === (n[0] - e[0]) * (t[1] - e[1]);
}
function yO(e, t, n) {
	return e <= t && t <= n || n <= t && t <= e;
}
function bO(e, t, n) {
	return function(r) {
		var i = Ju(r), a = n ? Math.min(i[0], 0) : i[0], s = i[1], c = s - a, l = t ? o(a, s, e) : c / (e + 1);
		return ye(a + l, s, l);
	};
}
function xO(e) {
	H.call(this, null, e);
}
xO.Definition = {
	type: "Isocontour",
	metadata: { generates: !0 },
	params: [
		{
			name: "field",
			type: "field"
		},
		{
			name: "thresholds",
			type: "number",
			array: !0
		},
		{
			name: "levels",
			type: "number"
		},
		{
			name: "nice",
			type: "boolean",
			default: !1
		},
		{
			name: "resolve",
			type: "enum",
			values: ["shared", "independent"],
			default: "independent"
		},
		{
			name: "zero",
			type: "boolean",
			default: !0
		},
		{
			name: "smooth",
			type: "boolean",
			default: !0
		},
		{
			name: "scale",
			type: "number",
			expr: !0
		},
		{
			name: "translate",
			type: "number",
			array: !0,
			expr: !0
		},
		{
			name: "as",
			type: "string",
			null: !0,
			default: "contour"
		}
	]
}, R(xO, H, { transform(e, t) {
	if (this.value && !t.changed() && !e.modified()) return t.StopPropagation;
	var n = t.fork(t.NO_SOURCE | t.NO_FIELDS), r = t.materialize(t.SOURCE).source, i = e.field || ou, a = pO().smooth(e.smooth !== !1), o = e.thresholds || SO(r, i, e), s = e.as === null ? null : e.as || "contour", c = [];
	return r.forEach((t) => {
		let n = i(t), r = a.size([n.width, n.height])(n.values, P(o) ? o : o(n.values));
		CO(r, n, t, e), r.forEach((e) => {
			c.push(Bp(t, Rp(s == null ? e : { [s]: e })));
		});
	}), this.value && (n.rem = this.value), this.value = n.source = n.add = c, n;
} });
function SO(e, t, n) {
	let r = bO(n.levels || 10, n.nice, n.zero !== !1);
	return n.resolve === "shared" ? r(e.map((e) => D(t(e).values))) : r;
}
function CO(e, t, n, r) {
	let i = r.scale || t.scale, a = r.translate || t.translate;
	if (Ru(i) && (i = i(n, r)), Ru(a) && (a = a(n, r)), (i === 1 || i == null) && !a) return;
	let o = (rd(i) ? i : i[0]) || 1, s = (rd(i) ? i : i[1]) || 1, c = a && a[0] || 0, l = a && a[1] || 0;
	e.forEach(wO(t, o, s, c, l));
}
function wO(e, t, n, r, i) {
	let a = e.x1 || 0, o = e.y1 || 0, s = t * n < 0;
	function c(e) {
		e.forEach(l);
	}
	function l(e) {
		s && e.reverse(), e.forEach(u);
	}
	function u(e) {
		e[0] = (e[0] - a) * t + r, e[1] = (e[1] - o) * n + i;
	}
	return function(e) {
		return e.coordinates.forEach(c), e;
	};
}
function TO(e, t, n) {
	let r = e >= 0 ? e : Jm(t, n);
	return Math.round((Math.sqrt(4 * r * r + 1) - 1) / 2);
}
function EO(e) {
	return Ru(e) ? e : Gu(+e);
}
function DO() {
	var e = (e) => e[0], t = (e) => e[1], n = cu, r = [-1, -1], i = 960, a = 500, o = 2;
	function s(s, c) {
		let l = TO(r[0], s, e) >> o, u = TO(r[1], s, t) >> o, d = l ? l + 2 : 0, f = u ? u + 2 : 0, p = 2 * d + (i >> o), m = 2 * f + (a >> o), h = new Float32Array(p * m), g = new Float32Array(p * m), _ = h;
		s.forEach((r) => {
			let i = d + (+e(r) >> o), a = f + (+t(r) >> o);
			i >= 0 && i < p && a >= 0 && a < m && (h[i + a * p] += +n(r));
		}), l > 0 && u > 0 ? (OO(p, m, h, g, l), kO(p, m, g, h, u), OO(p, m, h, g, l), kO(p, m, g, h, u), OO(p, m, h, g, l), kO(p, m, g, h, u)) : l > 0 ? (OO(p, m, h, g, l), OO(p, m, g, h, l), OO(p, m, h, g, l), _ = g) : u > 0 && (kO(p, m, h, g, u), kO(p, m, g, h, u), kO(p, m, h, g, u), _ = g);
		let v = c ? 2 ** (-2 * o) : 1 / Pt(_);
		for (let e = 0, t = p * m; e < t; ++e) _[e] *= v;
		return {
			values: _,
			scale: 1 << o,
			width: p,
			height: m,
			x1: d,
			y1: f,
			x2: d + (i >> o),
			y2: f + (a >> o)
		};
	}
	return s.x = function(t) {
		return arguments.length ? (e = EO(t), s) : e;
	}, s.y = function(e) {
		return arguments.length ? (t = EO(e), s) : t;
	}, s.weight = function(e) {
		return arguments.length ? (n = EO(e), s) : n;
	}, s.size = function(e) {
		if (!arguments.length) return [i, a];
		var t = +e[0], n = +e[1];
		return t >= 0 && n >= 0 || N("invalid size"), i = t, a = n, s;
	}, s.cellSize = function(e) {
		return arguments.length ? ((e = +e) >= 1 || N("invalid cell size"), o = Math.floor(Math.log(e) / Math.LN2), s) : 1 << o;
	}, s.bandwidth = function(e) {
		return arguments.length ? (e = I(e), e.length === 1 && (e = [+e[0], +e[0]]), e.length !== 2 && N("invalid bandwidth"), r = e, s) : r;
	}, s;
}
function OO(e, t, n, r, i) {
	let a = (i << 1) + 1;
	for (let o = 0; o < t; ++o) for (let t = 0, s = 0; t < e + i; ++t) t < e && (s += n[t + o * e]), t >= i && (t >= a && (s -= n[t - a + o * e]), r[t - i + o * e] = s / Math.min(t + 1, e - 1 + a - t, a));
}
function kO(e, t, n, r, i) {
	let a = (i << 1) + 1;
	for (let o = 0; o < e; ++o) for (let s = 0, c = 0; s < t + i; ++s) s < t && (c += n[o + s * e]), s >= i && (s >= a && (c -= n[o + (s - a) * e]), r[o + (s - i) * e] = c / Math.min(s + 1, t - 1 + a - s, a));
}
function AO(e) {
	H.call(this, null, e);
}
AO.Definition = {
	type: "KDE2D",
	metadata: { generates: !0 },
	params: [
		{
			name: "size",
			type: "number",
			array: !0,
			length: 2,
			required: !0
		},
		{
			name: "x",
			type: "field",
			required: !0
		},
		{
			name: "y",
			type: "field",
			required: !0
		},
		{
			name: "weight",
			type: "field"
		},
		{
			name: "groupby",
			type: "field",
			array: !0
		},
		{
			name: "cellSize",
			type: "number"
		},
		{
			name: "bandwidth",
			type: "number",
			array: !0,
			length: 2
		},
		{
			name: "counts",
			type: "boolean",
			default: !1
		},
		{
			name: "as",
			type: "string",
			default: "grid"
		}
	]
};
var jO = [
	"x",
	"y",
	"weight",
	"size",
	"cellSize",
	"bandwidth"
];
function MO(e, t) {
	return jO.forEach((n) => t[n] == null ? 0 : e[n](t[n])), e;
}
R(AO, H, { transform(e, t) {
	if (this.value && !t.changed() && !e.modified()) return t.StopPropagation;
	var n = t.fork(t.NO_SOURCE | t.NO_FIELDS), r = t.materialize(t.SOURCE).source, i = NO(r, e.groupby), a = (e.groupby || []).map(Ql), o = MO(DO(), e), s = e.as || "grid", c = [];
	function l(e, t) {
		for (let n = 0; n < a.length; ++n) e[a[n]] = t[n];
		return e;
	}
	return c = i.map((t) => Rp(l({ [s]: o(t, e.counts) }, t.dims))), this.value && (n.rem = this.value), this.value = n.source = n.add = c, n;
} });
function NO(e, t) {
	var n = [], r = (e) => e(s), i, a, o, s, c, l;
	if (t == null) n.push(e);
	else for (i = {}, a = 0, o = e.length; a < o; ++a) s = e[a], c = t.map(r), l = i[c], l || (i[c] = l = [], l.dims = c, n.push(l)), l.push(s);
	return n;
}
function PO(e) {
	H.call(this, null, e);
}
PO.Definition = {
	type: "Contour",
	metadata: { generates: !0 },
	params: [
		{
			name: "size",
			type: "number",
			array: !0,
			length: 2,
			required: !0
		},
		{
			name: "values",
			type: "number",
			array: !0
		},
		{
			name: "x",
			type: "field"
		},
		{
			name: "y",
			type: "field"
		},
		{
			name: "weight",
			type: "field"
		},
		{
			name: "cellSize",
			type: "number"
		},
		{
			name: "bandwidth",
			type: "number"
		},
		{
			name: "count",
			type: "number"
		},
		{
			name: "nice",
			type: "boolean",
			default: !1
		},
		{
			name: "thresholds",
			type: "number",
			array: !0
		},
		{
			name: "smooth",
			type: "boolean",
			default: !0
		}
	]
}, R(PO, H, { transform(e, t) {
	if (this.value && !t.changed() && !e.modified()) return t.StopPropagation;
	var n = t.fork(t.NO_SOURCE | t.NO_FIELDS), r = pO().smooth(e.smooth !== !1), i = e.values, a = e.thresholds || bO(e.count || 10, e.nice, !!i), o = e.size, s, c;
	return i || (i = t.materialize(t.SOURCE).source, s = MO(DO(), e)(i, !0), c = wO(s, s.scale || 1, s.scale || 1, 0, 0), o = [s.width, s.height], i = s.values), a = P(a) ? a : a(i), i = r.size(o)(i, a), c && i.forEach(c), this.value && (n.rem = this.value), this.value = n.source = n.add = (i || []).map(Rp), n;
} });
var FO = "Feature", IO = "FeatureCollection", LO = "MultiPoint";
function RO(e) {
	H.call(this, null, e);
}
RO.Definition = {
	type: "GeoJSON",
	metadata: {},
	params: [{
		name: "fields",
		type: "field",
		array: !0,
		length: 2
	}, {
		name: "geojson",
		type: "field"
	}]
}, R(RO, H, { transform(e, t) {
	var n = this._features, r = this._points, i = e.fields, a = i && i[0], o = i && i[1], s = e.geojson || !i && ou, c = t.ADD, l = e.modified() || t.changed(t.REM) || t.modified($l(s)) || a && t.modified($l(a)) || o && t.modified($l(o));
	(!this.value || l) && (c = t.SOURCE, this._features = n = [], this._points = r = []), s && t.visit(c, (e) => n.push(s(e))), a && o && (t.visit(c, (e) => {
		var t = a(e), n = o(e);
		t != null && n != null && (t = +t) === t && (n = +n) === n && r.push([t, n]);
	}), n = n.concat({
		type: FO,
		geometry: {
			type: LO,
			coordinates: r
		}
	})), this.value = {
		type: IO,
		features: n
	};
} });
function zO(e) {
	H.call(this, null, e);
}
zO.Definition = {
	type: "GeoPath",
	metadata: { modifies: !0 },
	params: [
		{
			name: "projection",
			type: "projection"
		},
		{
			name: "field",
			type: "field"
		},
		{
			name: "pointRadius",
			type: "number",
			expr: !0
		},
		{
			name: "as",
			type: "string",
			default: "path"
		}
	]
}, R(zO, H, { transform(e, t) {
	var n = t.fork(t.ALL), r = this.value, i = e.field || ou, a = e.as || "path", o = n.SOURCE;
	!r || e.modified() ? (this.value = r = cO(e.projection), n.materialize().reflow()) : o = i === ou || t.modified(i.fields) ? n.ADD_MOD : n.ADD;
	let s = BO(r, e.pointRadius);
	return n.visit(o, (e) => e[a] = r(i(e))), r.pointRadius(s), n.modifies(a);
} });
function BO(e, t) {
	let n = e.pointRadius();
	return e.context(null), t != null && e.pointRadius(t), n;
}
function VO(e) {
	H.call(this, null, e);
}
VO.Definition = {
	type: "GeoPoint",
	metadata: { modifies: !0 },
	params: [
		{
			name: "projection",
			type: "projection",
			required: !0
		},
		{
			name: "fields",
			type: "field",
			array: !0,
			required: !0,
			length: 2
		},
		{
			name: "as",
			type: "string",
			array: !0,
			length: 2,
			default: ["x", "y"]
		}
	]
}, R(VO, H, { transform(e, t) {
	var n = e.projection, r = e.fields[0], i = e.fields[1], a = e.as || ["x", "y"], o = a[0], s = a[1], c;
	function l(e) {
		let t = n([r(e), i(e)]);
		t ? (e[o] = t[0], e[s] = t[1]) : (e[o] = void 0, e[s] = void 0);
	}
	return e.modified() ? t = t.materialize().reflow(!0).visit(t.SOURCE, l) : (c = t.modified(r.fields) || t.modified(i.fields), t.visit(c ? t.ADD_MOD : t.ADD, l)), t.modifies(a);
} });
function HO(e) {
	H.call(this, null, e);
}
HO.Definition = {
	type: "GeoShape",
	metadata: {
		modifies: !0,
		nomod: !0
	},
	params: [
		{
			name: "projection",
			type: "projection"
		},
		{
			name: "field",
			type: "field",
			default: "datum"
		},
		{
			name: "pointRadius",
			type: "number",
			expr: !0
		},
		{
			name: "as",
			type: "string",
			default: "shape"
		}
	]
}, R(HO, H, { transform(e, t) {
	var n = t.fork(t.ALL), r = this.value, i = e.as || "shape", a = n.ADD;
	return (!r || e.modified()) && (this.value = r = UO(cO(e.projection), e.field || iu("datum"), e.pointRadius), n.materialize().reflow(), a = n.SOURCE), n.visit(a, (e) => e[i] = r), n.modifies(i);
} });
function UO(e, t, n) {
	let r = n == null ? (n) => e(t(n)) : (r) => {
		var i = e.pointRadius(), a = e.pointRadius(n)(t(r));
		return e.pointRadius(i), a;
	};
	return r.context = (t) => (e.context(t), r), r;
}
function WO(e) {
	H.call(this, [], e), this.generator = Ga();
}
WO.Definition = {
	type: "Graticule",
	metadata: {
		changes: !0,
		generates: !0
	},
	params: [
		{
			name: "extent",
			type: "array",
			array: !0,
			length: 2,
			content: {
				type: "number",
				array: !0,
				length: 2
			}
		},
		{
			name: "extentMajor",
			type: "array",
			array: !0,
			length: 2,
			content: {
				type: "number",
				array: !0,
				length: 2
			}
		},
		{
			name: "extentMinor",
			type: "array",
			array: !0,
			length: 2,
			content: {
				type: "number",
				array: !0,
				length: 2
			}
		},
		{
			name: "step",
			type: "number",
			array: !0,
			length: 2
		},
		{
			name: "stepMajor",
			type: "number",
			array: !0,
			length: 2,
			default: [90, 360]
		},
		{
			name: "stepMinor",
			type: "number",
			array: !0,
			length: 2,
			default: [10, 10]
		},
		{
			name: "precision",
			type: "number",
			default: 2.5
		}
	]
}, R(WO, H, { transform(e, t) {
	var n = this.value, r = this.generator, i;
	if (!n.length || e.modified()) for (let t in e) Ru(r[t]) && r[t](e[t]);
	return i = r(), n.length ? t.mod.push(Vp(n[0], i)) : t.add.push(Rp(i)), n[0] = i, t;
} });
function GO(e) {
	H.call(this, null, e);
}
GO.Definition = {
	type: "heatmap",
	metadata: { modifies: !0 },
	params: [
		{
			name: "field",
			type: "field"
		},
		{
			name: "color",
			type: "string",
			expr: !0
		},
		{
			name: "opacity",
			type: "number",
			expr: !0
		},
		{
			name: "resolve",
			type: "enum",
			values: ["shared", "independent"],
			default: "independent"
		},
		{
			name: "as",
			type: "string",
			default: "image"
		}
	]
}, R(GO, H, { transform(e, t) {
	if (!t.changed() && !e.modified()) return t.StopPropagation;
	var n = t.materialize(t.SOURCE).source, r = e.resolve === "shared", i = e.field || ou, a = qO(e.opacity, e), o = KO(e.color, e), s = e.as || "image", c = {
		$x: 0,
		$y: 0,
		$value: 0,
		$max: r ? D(n.map((e) => D(i(e).values))) : 0
	};
	return n.forEach((e) => {
		let t = i(e), n = qu({}, e, c);
		r || (n.$max = D(t.values || [])), e[s] = YO(t, n, o.dep ? o : Gu(o(n)), a.dep ? a : Gu(a(n)));
	}), t.reflow(!0).modifies(s);
} });
function KO(e, t) {
	let n;
	return Ru(e) ? (n = (n) => Ke(e(n, t)), n.dep = JO(e)) : n = Gu(Ke(e || "#888")), n;
}
function qO(e, t) {
	let n;
	return Ru(e) ? (n = (n) => e(n, t), n.dep = JO(e)) : e ? n = Gu(e) : (n = (e) => e.$value / e.$max || 0, n.dep = !0), n;
}
function JO(e) {
	if (!Ru(e)) return !1;
	let t = _d($l(e));
	return t.$x || t.$y || t.$value || t.$max;
}
function YO(e, t, n, r) {
	let i = e.width, a = e.height, o = e.x1 || 0, s = e.y1 || 0, c = e.x2 || i, l = e.y2 || a, u = e.values, d = u ? (e) => u[e] : su, f = V_(c - o, l - s), p = f.getContext("2d"), m = p.getImageData(0, 0, c - o, l - s), h = m.data;
	for (let e = s, a = 0; e < l; ++e) {
		t.$y = e - s;
		for (let s = o, l = e * i; s < c; ++s, a += 4) {
			t.$x = s - o, t.$value = d(s + l);
			let e = n(t);
			h[a + 0] = e.r, h[a + 1] = e.g, h[a + 2] = e.b, h[a + 3] = ~~(255 * r(t));
		}
	}
	return p.putImageData(m, 0, 0), f;
}
function XO(e) {
	H.call(this, null, e), this.modified(!0);
}
R(XO, H, { transform(e, t) {
	let n = this.value;
	return !n || e.modified("type") ? (this.value = n = QO(e.type), aO.forEach((t) => {
		e[t] != null && $O(n, t, e[t]);
	})) : aO.forEach((t) => {
		e.modified(t) && $O(n, t, e[t]);
	}), e.pointRadius != null && n.path.pointRadius(e.pointRadius), e.fit && ZO(n, e), t.fork(t.NO_SOURCE | t.NO_FIELDS);
} });
function ZO(e, t) {
	let n = ek(t.fit);
	t.extent ? e.fitExtent(t.extent, n) : t.size && e.fitSize(t.size, n);
}
function QO(e) {
	let t = sO((e || "mercator").toLowerCase());
	return t || N("Unrecognized projection type: " + e), t();
}
function $O(e, t, n) {
	Ru(e[t]) && e[t](n);
}
function ek(e) {
	return e = I(e), e.length === 1 ? e[0] : {
		type: IO,
		features: e.reduce((e, t) => e.concat(tk(t)), [])
	};
}
function tk(e) {
	return e.type === IO ? e.features : I(e).filter((e) => e != null).map((e) => e.type === FO ? e : {
		type: FO,
		geometry: e
	});
}
//#endregion
//#region ../../node_modules/.pnpm/vega-force@5.1.0/node_modules/vega-force/build/vega-force.js
var nk = /* @__PURE__ */ t({ force: () => ck }), rk = {
	center: Ln,
	collide: ur,
	nbody: Cr,
	link: pr,
	x: wr,
	y: Tr
}, ik = "forces", ak = [
	"alpha",
	"alphaMin",
	"alphaTarget",
	"velocityDecay",
	"forces"
], ok = ["static", "iterations"], sk = [
	"x",
	"y",
	"vx",
	"vy"
];
function ck(e) {
	H.call(this, null, e);
}
ck.Definition = {
	type: "Force",
	metadata: { modifies: !0 },
	params: [
		{
			name: "static",
			type: "boolean",
			default: !1
		},
		{
			name: "restart",
			type: "boolean",
			default: !1
		},
		{
			name: "iterations",
			type: "number",
			default: 300
		},
		{
			name: "alpha",
			type: "number",
			default: 1
		},
		{
			name: "alphaMin",
			type: "number",
			default: .001
		},
		{
			name: "alphaTarget",
			type: "number",
			default: 0
		},
		{
			name: "velocityDecay",
			type: "number",
			default: .4
		},
		{
			name: "forces",
			type: "param",
			array: !0,
			params: [
				{
					key: { force: "center" },
					params: [{
						name: "x",
						type: "number",
						default: 0
					}, {
						name: "y",
						type: "number",
						default: 0
					}]
				},
				{
					key: { force: "collide" },
					params: [
						{
							name: "radius",
							type: "number",
							expr: !0
						},
						{
							name: "strength",
							type: "number",
							default: .7
						},
						{
							name: "iterations",
							type: "number",
							default: 1
						}
					]
				},
				{
					key: { force: "nbody" },
					params: [
						{
							name: "strength",
							type: "number",
							default: -30,
							expr: !0
						},
						{
							name: "theta",
							type: "number",
							default: .9
						},
						{
							name: "distanceMin",
							type: "number",
							default: 1
						},
						{
							name: "distanceMax",
							type: "number"
						}
					]
				},
				{
					key: { force: "link" },
					params: [
						{
							name: "links",
							type: "data"
						},
						{
							name: "id",
							type: "field"
						},
						{
							name: "distance",
							type: "number",
							default: 30,
							expr: !0
						},
						{
							name: "strength",
							type: "number",
							expr: !0
						},
						{
							name: "iterations",
							type: "number",
							default: 1
						}
					]
				},
				{
					key: { force: "x" },
					params: [{
						name: "strength",
						type: "number",
						default: .1
					}, {
						name: "x",
						type: "field"
					}]
				},
				{
					key: { force: "y" },
					params: [{
						name: "strength",
						type: "number",
						default: .1
					}, {
						name: "y",
						type: "field"
					}]
				}
			]
		},
		{
			name: "as",
			type: "string",
			array: !0,
			modify: !1,
			default: sk
		}
	]
}, R(ck, H, {
	transform(e, t) {
		var n = this.value, r = t.changed(t.ADD_REM), i = e.modified(ak), a = e.iterations || 300;
		if (n ? (r && (t.modifies("index"), n.nodes(t.source)), (i || t.changed(t.MOD)) && dk(n, e, 0, t)) : (this.value = n = uk(t.source, e), n.on("tick", lk(t.dataflow, this)), e.static || (r = !0, n.tick()), t.modifies("index")), i || r || e.modified(ok) || t.changed() && e.restart) {
			if (n.alpha(Math.max(n.alpha(), e.alpha || 1)).alphaDecay(1 - n.alphaMin() ** (1 / a)), e.static) for (n.stop(); --a >= 0;) n.tick();
			else if (n.stopped() && n.restart(), !r) return t.StopPropagation;
		}
		return this.finish(e, t);
	},
	finish(e, t) {
		let n = t.dataflow;
		for (let e = this._argops, t = 0, s = e.length, c; t < s; ++t) if (c = e[t], !(c.name !== ik || c.op._argval.force !== "link")) {
			for (var r = c.op._argops, i = 0, a = r.length, o; i < a; ++i) if (r[i].name === "links" && (o = r[i].op.source)) {
				n.pulse(o, n.changeset().reflow());
				break;
			}
		}
		return t.reflow(e.modified()).modifies(sk);
	}
});
function lk(e, t) {
	return () => e.touch(t).run();
}
function uk(e, t) {
	let n = Sr(e), r = n.stop, i = n.restart, a = !1;
	return n.stopped = () => a, n.restart = () => (a = !1, i()), n.stop = () => (a = !0, r()), dk(n, t, !0).on("end", () => a = !0);
}
function dk(e, t, n, r) {
	var i = I(t.forces), a, o, s, c;
	for (a = 0, o = ak.length; a < o; ++a) s = ak[a], s !== ik && t.modified(s) && e[s](t[s]);
	for (a = 0, o = i.length; a < o; ++a) c = ik + a, s = n || t.modified(ik, a) ? pk(i[a]) : r && fk(i[a], r) ? e.force(c) : null, s && e.force(c, s);
	for (o = e.numForces || 0; a < o; ++a) e.force(ik + a, null);
	return e.numForces = i.length, e;
}
function fk(e, t) {
	var n, r;
	for (n in e) if (Ru(r = e[n]) && t.modified($l(r))) return 1;
	return 0;
}
function pk(e) {
	var t, n;
	for (n in L(rk, e.force) || N("Unrecognized force: " + e.force), t = rk[e.force](), e) Ru(t[n]) && mk(t[n], e[n], e);
	return t;
}
function mk(e, t, n) {
	e(Ru(t) ? (e) => t(e, n) : t);
}
//#endregion
//#region ../../node_modules/.pnpm/vega-hierarchy@5.1.0/node_modules/vega-hierarchy/build/vega-hierarchy.js
var hk = /* @__PURE__ */ t({
	nest: () => _k,
	pack: () => Tk,
	partition: () => Dk,
	stratify: () => Ok,
	tree: () => jk,
	treelinks: () => Mk,
	treemap: () => Fk
});
function gk(e, t, n) {
	let r = {};
	return e.each((e) => {
		let i = e.data;
		n(i) && (r[t(i)] = e);
	}), e.lookup = r, e;
}
function _k(e) {
	H.call(this, null, e);
}
_k.Definition = {
	type: "Nest",
	metadata: {
		treesource: !0,
		changes: !0
	},
	params: [{
		name: "keys",
		type: "field",
		array: !0
	}, {
		name: "generate",
		type: "boolean"
	}]
};
var vk = (e) => e.values;
R(_k, H, { transform(e, t) {
	t.source || N("Nest transform requires an upstream data source.");
	var n = e.generate, r = e.modified(), i = t.clone(), a = this.value;
	return (!a || r || t.changed()) && (a && a.each((e) => {
		e.children && Ip(e.data) && i.rem.push(e.data);
	}), this.value = a = oee({ values: I(e.keys).reduce((e, t) => (e.key(t), e), yk()).entries(i.source) }, vk), n && a.each((e) => {
		e.children && (e = Rp(e.data), i.add.push(e), i.source.push(e));
	}), gk(a, V, V)), i.source.root = a, i;
} });
function yk() {
	let e = [], t = {
		entries: (e) => r(n(e, 0), 0),
		key: (n) => (e.push(n), t)
	};
	function n(t, r) {
		if (r >= e.length) return t;
		let i = t.length, a = e[r++], o = {}, s = {}, c = -1, l, u, d;
		for (; ++c < i;) l = a(u = t[c]) + "", (d = o[l]) ? d.push(u) : o[l] = [u];
		for (l in o) s[l] = n(o[l], r);
		return s;
	}
	function r(t, n) {
		if (++n > e.length) return t;
		let i = [];
		for (let e in t) i.push({
			key: e,
			values: r(t[e], n)
		});
		return i;
	}
	return t;
}
function bk(e) {
	H.call(this, null, e);
}
var xk = (e, t) => e.parent === t.parent ? 1 : 2;
R(bk, H, { transform(e, t) {
	(!t.source || !t.source.root) && N(this.constructor.name + " transform requires a backing tree data source.");
	let n = this.layout(e.method), r = this.fields, i = t.source.root, a = e.as || r;
	e.field ? i.sum(e.field) : i.count(), e.sort && i.sort(Hp(e.sort, (e) => e.data)), Sk(n, this.params, e), n.separation && n.separation(e.separation === !1 ? cu : xk);
	try {
		this.value = n(i);
	} catch (e) {
		N(e);
	}
	return i.each((e) => Ck(e, r, a)), t.reflow(e.modified()).modifies(a).modifies("leaf");
} });
function Sk(e, t, n) {
	for (let r, i = 0, a = t.length; i < a; ++i) r = t[i], r in n && e[r](n[r]);
}
function Ck(e, t, n) {
	let r = e.data, i = t.length - 1;
	for (let a = 0; a < i; ++a) r[n[a]] = e[t[a]];
	r[n[i]] = e.children ? e.children.length : 0;
}
var wk = [
	"x",
	"y",
	"r",
	"depth",
	"children"
];
function Tk(e) {
	bk.call(this, e);
}
Tk.Definition = {
	type: "Pack",
	metadata: {
		tree: !0,
		modifies: !0
	},
	params: [
		{
			name: "field",
			type: "field"
		},
		{
			name: "sort",
			type: "compare"
		},
		{
			name: "padding",
			type: "number",
			default: 0
		},
		{
			name: "radius",
			type: "field",
			default: null
		},
		{
			name: "size",
			type: "number",
			array: !0,
			length: 2
		},
		{
			name: "as",
			type: "string",
			array: !0,
			length: wk.length,
			default: wk
		}
	]
}, R(Tk, bk, {
	layout: Ec,
	params: [
		"radius",
		"size",
		"padding"
	],
	fields: wk
});
var Ek = [
	"x0",
	"y0",
	"x1",
	"y1",
	"depth",
	"children"
];
function Dk(e) {
	bk.call(this, e);
}
Dk.Definition = {
	type: "Partition",
	metadata: {
		tree: !0,
		modifies: !0
	},
	params: [
		{
			name: "field",
			type: "field"
		},
		{
			name: "sort",
			type: "compare"
		},
		{
			name: "padding",
			type: "number",
			default: 0
		},
		{
			name: "round",
			type: "boolean",
			default: !1
		},
		{
			name: "size",
			type: "number",
			array: !0,
			length: 2
		},
		{
			name: "as",
			type: "string",
			array: !0,
			length: Ek.length,
			default: Ek
		}
	]
}, R(Dk, bk, {
	layout: Ac,
	params: [
		"size",
		"round",
		"padding"
	],
	fields: Ek
});
function Ok(e) {
	H.call(this, null, e);
}
Ok.Definition = {
	type: "Stratify",
	metadata: { treesource: !0 },
	params: [{
		name: "key",
		type: "field",
		required: !0
	}, {
		name: "parentKey",
		type: "field",
		required: !0
	}]
}, R(Ok, H, { transform(e, t) {
	t.source || N("Stratify transform requires an upstream data source.");
	let n = this.value, r = e.modified(), i = t.fork(t.ALL).materialize(t.SOURCE), a = !n || r || t.changed(t.ADD_REM) || t.modified(e.key.fields) || t.modified(e.parentKey.fields);
	return i.source = i.source.slice(), a && (n = i.source.length ? gk(Ic().id(e.key).parentId(e.parentKey)(i.source), e.key, lu) : gk(Ic()([{}]), e.key, e.key)), i.source.root = this.value = n, i;
} });
var kk = {
	tidy: Jc,
	cluster: ic
}, Ak = [
	"x",
	"y",
	"depth",
	"children"
];
function jk(e) {
	bk.call(this, e);
}
jk.Definition = {
	type: "Tree",
	metadata: {
		tree: !0,
		modifies: !0
	},
	params: [
		{
			name: "field",
			type: "field"
		},
		{
			name: "sort",
			type: "compare"
		},
		{
			name: "method",
			type: "enum",
			default: "tidy",
			values: ["tidy", "cluster"]
		},
		{
			name: "size",
			type: "number",
			array: !0,
			length: 2
		},
		{
			name: "nodeSize",
			type: "number",
			array: !0,
			length: 2
		},
		{
			name: "separation",
			type: "boolean",
			default: !0
		},
		{
			name: "as",
			type: "string",
			array: !0,
			length: Ak.length,
			default: Ak
		}
	]
}, R(jk, bk, {
	layout(e) {
		let t = e || "tidy";
		if (L(kk, t)) return kk[t]();
		N("Unrecognized Tree layout method: " + t);
	},
	params: ["size", "nodeSize"],
	fields: Ak
});
function Mk(e) {
	H.call(this, [], e);
}
Mk.Definition = {
	type: "TreeLinks",
	metadata: {
		tree: !0,
		generates: !0,
		changes: !0
	},
	params: []
}, R(Mk, H, { transform(e, t) {
	let n = this.value, r = t.source && t.source.root, i = t.fork(t.NO_SOURCE), a = {};
	return r || N("TreeLinks transform requires a tree data source."), t.changed(t.ADD_REM) ? (i.rem = n, t.visit(t.SOURCE, (e) => a[V(e)] = 1), r.each((e) => {
		let t = e.data, n = e.parent && e.parent.data;
		n && a[V(t)] && a[V(n)] && i.add.push(Rp({
			source: n,
			target: t
		}));
	}), this.value = i.add) : t.changed(t.MOD) && (t.visit(t.MOD, (e) => a[V(e)] = 1), n.forEach((e) => {
		(a[V(e.source)] || a[V(e.target)]) && i.mod.push(e);
	})), i;
} });
var Nk = {
	binary: Yc,
	dice: dt,
	slice: it,
	slicedice: Xc,
	squarify: ct,
	resquarify: Zc
}, Pk = [
	"x0",
	"y0",
	"x1",
	"y1",
	"depth",
	"children"
];
function Fk(e) {
	bk.call(this, e);
}
Fk.Definition = {
	type: "Treemap",
	metadata: {
		tree: !0,
		modifies: !0
	},
	params: [
		{
			name: "field",
			type: "field"
		},
		{
			name: "sort",
			type: "compare"
		},
		{
			name: "method",
			type: "enum",
			default: "squarify",
			values: [
				"squarify",
				"resquarify",
				"binary",
				"dice",
				"slice",
				"slicedice"
			]
		},
		{
			name: "padding",
			type: "number",
			default: 0
		},
		{
			name: "paddingInner",
			type: "number",
			default: 0
		},
		{
			name: "paddingOuter",
			type: "number",
			default: 0
		},
		{
			name: "paddingTop",
			type: "number",
			default: 0
		},
		{
			name: "paddingRight",
			type: "number",
			default: 0
		},
		{
			name: "paddingBottom",
			type: "number",
			default: 0
		},
		{
			name: "paddingLeft",
			type: "number",
			default: 0
		},
		{
			name: "ratio",
			type: "number",
			default: 1.618033988749895
		},
		{
			name: "round",
			type: "boolean",
			default: !1
		},
		{
			name: "size",
			type: "number",
			array: !0,
			length: 2
		},
		{
			name: "as",
			type: "string",
			array: !0,
			length: Pk.length,
			default: Pk
		}
	]
}, R(Fk, bk, {
	layout() {
		let e = mt();
		return e.ratio = (t) => {
			let n = e.tile();
			n.ratio && e.tile(n.ratio(t));
		}, e.method = (t) => {
			L(Nk, t) ? e.tile(Nk[t]) : N("Unrecognized Treemap layout method: " + t);
		}, e;
	},
	params: [
		"method",
		"ratio",
		"size",
		"round",
		"padding",
		"paddingInner",
		"paddingOuter",
		"paddingTop",
		"paddingRight",
		"paddingBottom",
		"paddingLeft"
	],
	fields: Pk
});
//#endregion
//#region ../../node_modules/.pnpm/vega-label@2.1.0/node_modules/vega-label/build/vega-label.js
var Ik = /* @__PURE__ */ t({ label: () => SA }), Lk = 4278190080;
function Rk(e, t) {
	let n = e.bitmap();
	return (t || []).forEach((t) => n.set(e(t.boundary[0]), e(t.boundary[3]))), [n, void 0];
}
function zk(e, t, n, r, i) {
	let a = e.width, o = e.height, s = r || i, c = V_(a, o).getContext("2d"), l = V_(a, o).getContext("2d"), u = s && V_(a, o).getContext("2d");
	n.forEach((e) => Vk(c, e, !1)), Vk(l, t, !1), s && Vk(u, t, !0);
	let d = Bk(c, a, o), f = Bk(l, a, o), p = s && Bk(u, a, o), m = e.bitmap(), h = s && e.bitmap(), g, _, v, y, b, x, S, C;
	for (_ = 0; _ < o; ++_) for (g = 0; g < a; ++g) b = _ * a + g, x = d[b] & Lk, C = f[b] & Lk, S = s && p[b] & Lk, (x || S || C) && (v = e(g), y = e(_), !i && (x || C) && m.set(v, y), s && (x || S) && h.set(v, y));
	return [m, h];
}
function Bk(e, t, n) {
	return new Uint32Array(e.getImageData(0, 0, t, n).data.buffer);
}
function Vk(e, t, n) {
	if (!t.length) return;
	let r = t[0].mark.marktype;
	r === "group" ? t.forEach((t) => {
		t.items.forEach((t) => Vk(e, t.items, n));
	}) : lC[r].draw(e, { items: n ? t.map(Hk) : t });
}
function Hk(e) {
	let t = Bp(e, {});
	return t.stroke && t.strokeOpacity !== 0 || t.fill && t.fillOpacity !== 0 ? {
		...t,
		strokeOpacity: 1,
		stroke: "#000",
		fillOpacity: 0
	} : t;
}
var Uk = 5, Wk = 31, Gk = 32, Kk = new Uint32Array(Gk + 1), qk = new Uint32Array(Gk + 1);
qk[0] = 0, Kk[0] = ~qk[0];
for (let e = 1; e <= Gk; ++e) qk[e] = qk[e - 1] << 1 | 1, Kk[e] = ~qk[e];
function Jk(e, t) {
	let n = new Uint32Array(~~((e * t + Gk) / Gk));
	function r(e, t) {
		n[e] |= t;
	}
	function i(e, t) {
		n[e] &= t;
	}
	return {
		array: n,
		get: (t, r) => {
			let i = r * e + t;
			return n[i >>> Uk] & 1 << (i & Wk);
		},
		set: (t, n) => {
			let i = n * e + t;
			r(i >>> Uk, 1 << (i & Wk));
		},
		clear: (t, n) => {
			let r = n * e + t;
			i(r >>> Uk, ~(1 << (r & Wk)));
		},
		getRange: (t, r, i, a) => {
			let o = a, s, c, l, u;
			for (; o >= r; --o) if (s = o * e + t, c = o * e + i, l = s >>> Uk, u = c >>> Uk, l === u) {
				if (n[l] & Kk[s & Wk] & qk[(c & Wk) + 1]) return !0;
			} else {
				if (n[l] & Kk[s & Wk] || n[u] & qk[(c & Wk) + 1]) return !0;
				for (let e = l + 1; e < u; ++e) if (n[e]) return !0;
			}
			return !1;
		},
		setRange: (t, n, i, a) => {
			let o, s, c, l, u;
			for (; n <= a; ++n) if (o = n * e + t, s = n * e + i, c = o >>> Uk, l = s >>> Uk, c === l) r(c, Kk[o & Wk] & qk[(s & Wk) + 1]);
			else for (r(c, Kk[o & Wk]), r(l, qk[(s & Wk) + 1]), u = c + 1; u < l; ++u) r(u, 4294967295);
		},
		clearRange: (t, n, r, a) => {
			let o, s, c, l, u;
			for (; n <= a; ++n) if (o = n * e + t, s = n * e + r, c = o >>> Uk, l = s >>> Uk, c === l) i(c, qk[o & Wk] | Kk[(s & Wk) + 1]);
			else for (i(c, qk[o & Wk]), i(l, Kk[(s & Wk) + 1]), u = c + 1; u < l; ++u) i(u, 0);
		},
		outOfBounds: (n, r, i, a) => n < 0 || r < 0 || a >= t || i >= e
	};
}
function Yk(e, t, n) {
	let r = Math.max(1, Math.sqrt(e * t / 1e6)), i = ~~((e + 2 * n + r) / r), a = ~~((t + 2 * n + r) / r), o = (e) => ~~((e + n) / r);
	return o.invert = (e) => e * r - n, o.bitmap = () => Jk(i, a), o.ratio = r, o.padding = n, o.width = e, o.height = t, o;
}
function Xk(e, t, n, r) {
	let i = e.width, a = e.height;
	return function(e) {
		let t = e.datum.datum.items[r].items, n = t.length, o = e.datum.fontSize, s = RS.width(e.datum, e.datum.text), c = 0, l, u, d, f, p, m, h;
		for (let r = 0; r < n; ++r) l = t[r].x, d = t[r].y, u = t[r].x2 === void 0 ? l : t[r].x2, f = t[r].y2 === void 0 ? d : t[r].y2, p = (l + u) / 2, m = (d + f) / 2, h = Math.abs(u - l + f - d), h >= c && (c = h, e.x = p, e.y = m);
		return p = s / 2, m = o / 2, l = e.x - p, u = e.x + p, d = e.y - m, f = e.y + m, e.align = "center", l < 0 && u <= i ? e.align = "left" : 0 <= l && i < u && (e.align = "right"), e.baseline = "middle", d < 0 && f <= a ? e.baseline = "top" : 0 <= d && a < f && (e.baseline = "bottom"), !0;
	};
}
function Zk(e, t, n, r, i, a) {
	let o = n / 2;
	return e - o < 0 || e + o > i || t - (o = r / 2) < 0 || t + o > a;
}
function Qk(e, t, n, r, i, a, o, s) {
	let c = i * a / (r * 2), l = e(t - c), u = e(t + c), d = e(n - (a /= 2)), f = e(n + a);
	return o.outOfBounds(l, d, u, f) || o.getRange(l, d, u, f) || s && s.getRange(l, d, u, f);
}
function $k(e, t, n, r) {
	let i = e.width, a = e.height, o = t[0], s = t[1];
	function c(t, n, r, c, l) {
		let u = e.invert(t), d = e.invert(n), f = r, p = a, m;
		if (!Zk(u, d, c, l, i, a) && !Qk(e, u, d, l, c, f, o, s) && !Qk(e, u, d, l, c, l, o, null)) {
			for (; p - f >= 1;) m = (f + p) / 2, Qk(e, u, d, l, c, m, o, s) ? p = m : f = m;
			if (f > r) return [
				u,
				d,
				f,
				!0
			];
		}
	}
	return function(t) {
		let s = t.datum.datum.items[r].items, l = s.length, u = t.datum.fontSize, d = RS.width(t.datum, t.datum.text), f = n ? u : 0, p = !1, m = !1, h = 0, g, _, v, y, b, x, S, C, w, T, E, D, O, k, ee, te, ne;
		for (let r = 0; r < l; ++r) {
			for (g = s[r].x, v = s[r].y, _ = s[r].x2 === void 0 ? g : s[r].x2, y = s[r].y2 === void 0 ? v : s[r].y2, g > _ && (ne = g, g = _, _ = ne), v > y && (ne = v, v = y, y = ne), w = e(g), E = e(_), T = ~~((w + E) / 2), D = e(v), k = e(y), O = ~~((D + k) / 2), S = T; S >= w; --S) for (C = O; C >= D; --C) te = c(S, C, f, d, u), te && ([t.x, t.y, f, p] = te);
			for (S = T; S <= E; ++S) for (C = O; C <= k; ++C) te = c(S, C, f, d, u), te && ([t.x, t.y, f, p] = te);
			!p && !n && (ee = Math.abs(_ - g + y - v), b = (g + _) / 2, x = (v + y) / 2, ee >= h && !Zk(b, x, d, u, i, a) && !Qk(e, b, x, u, d, u, o, null) && (h = ee, t.x = b, t.y = x, m = !0));
		}
		return p || m ? (b = d / 2, x = u / 2, o.setRange(e(t.x - b), e(t.y - x), e(t.x + b), e(t.y + x)), t.align = "center", t.baseline = "middle", !0) : !1;
	};
}
var eA = [
	-1,
	-1,
	1,
	1
], tA = [
	-1,
	1,
	-1,
	1
];
function nA(e, t, n, r) {
	let i = e.width, a = e.height, o = t[0], s = t[1], c = e.bitmap();
	return function(t) {
		let l = t.datum.datum.items[r].items, u = l.length, d = t.datum.fontSize, f = RS.width(t.datum, t.datum.text), p = [], m = n ? d : 0, h = !1, g = !1, _ = 0, v, y, b, x, S, C, w, T, E, D, O, k;
		for (let r = 0; r < u; ++r) {
			for (v = l[r].x, b = l[r].y, y = l[r].x2 === void 0 ? v : l[r].x2, x = l[r].y2 === void 0 ? b : l[r].y2, p.push([e((v + y) / 2), e((b + x) / 2)]); p.length;) if ([w, T] = p.pop(), !(o.get(w, T) || s.get(w, T) || c.get(w, T))) {
				c.set(w, T);
				for (let e = 0; e < 4; ++e) S = w + eA[e], C = T + tA[e], c.outOfBounds(S, C, S, C) || p.push([S, C]);
				if (S = e.invert(w), C = e.invert(T), E = m, D = a, !Zk(S, C, f, d, i, a) && !Qk(e, S, C, d, f, E, o, s) && !Qk(e, S, C, d, f, d, o, null)) {
					for (; D - E >= 1;) O = (E + D) / 2, Qk(e, S, C, d, f, O, o, s) ? D = O : E = O;
					E > m && (t.x = S, t.y = C, m = E, h = !0);
				}
			}
			!h && !n && (k = Math.abs(y - v + x - b), S = (v + y) / 2, C = (b + x) / 2, k >= _ && !Zk(S, C, f, d, i, a) && !Qk(e, S, C, d, f, d, o, null) && (_ = k, t.x = S, t.y = C, g = !0));
		}
		return h || g ? (S = f / 2, C = d / 2, o.setRange(e(t.x - S), e(t.y - C), e(t.x + S), e(t.y + C)), t.align = "center", t.baseline = "middle", !0) : !1;
	};
}
var rA = [
	"right",
	"center",
	"left"
], iA = [
	"bottom",
	"middle",
	"top"
];
function aA(e, t, n, r) {
	let i = e.width, a = e.height, o = t[0], s = t[1], c = r.length;
	return function(t) {
		var l;
		let u = t.boundary, d = t.datum.fontSize;
		if (u[2] < 0 || u[5] < 0 || u[0] > i || u[3] > a) return !1;
		let f = (l = t.textWidth) == null ? 0 : l, p, m, h, g, _, v, y, b, x, S, C, w, T, E, D;
		for (let i = 0; i < c; ++i) {
			if (p = (n[i] & 3) - 1, m = (n[i] >>> 2 & 3) - 1, h = p === 0 && m === 0 || r[i] < 0, g = p && m ? Math.SQRT1_2 : 1, _ = r[i] < 0 ? -1 : 1, v = u[1 + p] + r[i] * p * g, C = u[4 + m] + _ * d * m / 2 + r[i] * m * g, b = C - d / 2, x = C + d / 2, w = e(v), E = e(b), D = e(x), !f) if (oA(w, w, E, D, o, s, v, v, b, x, u, h)) f = RS.width(t.datum, t.datum.text);
			else continue;
			if (S = v + _ * f * p / 2, v = S - f / 2, y = S + f / 2, w = e(v), T = e(y), oA(w, T, E, D, o, s, v, y, b, x, u, h)) return t.x = p ? p * _ < 0 ? y : v : S, t.y = m ? m * _ < 0 ? x : b : C, t.align = rA[p * _ + 1], t.baseline = iA[m * _ + 1], o.setRange(w, E, T, D), !0;
		}
		return !1;
	};
}
function oA(e, t, n, r, i, a, o, s, c, l, u, d) {
	return !(i.outOfBounds(e, n, t, r) || (d && a || i).getRange(e, n, t, r));
}
var sA = 0, cA = 4, lA = 8, uA = 0, dA = 1, fA = 2, pA = {
	"top-left": sA + uA,
	top: sA + dA,
	"top-right": sA + fA,
	left: cA + uA,
	middle: cA + dA,
	right: cA + fA,
	"bottom-left": lA + uA,
	bottom: lA + dA,
	"bottom-right": lA + fA
}, mA = {
	naive: Xk,
	"reduced-search": $k,
	floodfill: nA
};
function hA(e, t, n, r, i, a, o, s, c, l, u) {
	if (!e.length) return e;
	let d = Math.max(r.length, i.length), f = gA(r, d), p = _A(i, d), m = vA(e[0].datum), h = m === "group" && e[0].datum.items[c].marktype, g = h === "area", _ = yA(m, h, s, c), v = l === null || l === Infinity, y = g && u === "naive", b = -1, x = -1, S = e.map((e) => {
		let t = v ? RS.width(e, e.text) : void 0;
		return b = Math.max(b, t), x = Math.max(x, e.fontSize), {
			datum: e,
			opacity: 0,
			x: void 0,
			y: void 0,
			align: void 0,
			baseline: void 0,
			boundary: _(e),
			textWidth: t
		};
	});
	l = l === null || l === Infinity ? Math.max(b, x) + Math.max(...r) : l;
	let C = Yk(t[0], t[1], l), w;
	if (!y) {
		n && S.sort((e, t) => n(e.datum, t.datum));
		let t = !1;
		for (let e = 0; e < p.length && !t; ++e) t = p[e] === 5 || f[e] < 0;
		let r = (m && o || g) && e.map((e) => e.datum);
		w = a.length || r ? zk(C, r || [], a, t, g) : Rk(C, o && S);
	}
	let T = g ? mA[u](C, w, o, c) : aA(C, w, p, f);
	return S.forEach((e) => e.opacity = +T(e)), S;
}
function gA(e, t) {
	let n = new Float64Array(t), r = e.length;
	for (let t = 0; t < r; ++t) n[t] = e[t] || 0;
	for (let e = r; e < t; ++e) n[e] = n[r - 1];
	return n;
}
function _A(e, t) {
	let n = new Int8Array(t), r = e.length;
	for (let t = 0; t < r; ++t) n[t] |= pA[e[t]];
	for (let e = r; e < t; ++e) n[e] = n[r - 1];
	return n;
}
function vA(e) {
	return e && e.mark && e.mark.marktype;
}
function yA(e, t, n, r) {
	let i = (e) => [
		e.x,
		e.x,
		e.x,
		e.y,
		e.y,
		e.y
	];
	return e ? e === "line" || e === "area" ? (e) => i(e.datum) : t === "line" ? (e) => {
		let t = e.datum.items[r].items;
		return i(t.length ? t[n === "start" ? 0 : t.length - 1] : {
			x: NaN,
			y: NaN
		});
	} : (e) => {
		let t = e.datum.bounds;
		return [
			t.x1,
			(t.x1 + t.x2) / 2,
			t.x2,
			t.y1,
			(t.y1 + t.y2) / 2,
			t.y2
		];
	} : i;
}
var bA = [
	"x",
	"y",
	"opacity",
	"align",
	"baseline"
], xA = [
	"top-left",
	"left",
	"bottom-left",
	"top",
	"bottom",
	"top-right",
	"right",
	"bottom-right"
];
function SA(e) {
	H.call(this, null, e);
}
SA.Definition = {
	type: "Label",
	metadata: { modifies: !0 },
	params: [
		{
			name: "size",
			type: "number",
			array: !0,
			length: 2,
			required: !0
		},
		{
			name: "sort",
			type: "compare"
		},
		{
			name: "anchor",
			type: "string",
			array: !0,
			default: xA
		},
		{
			name: "offset",
			type: "number",
			array: !0,
			default: [1]
		},
		{
			name: "padding",
			type: "number",
			default: 0,
			null: !0
		},
		{
			name: "lineAnchor",
			type: "string",
			values: ["start", "end"],
			default: "end"
		},
		{
			name: "markIndex",
			type: "number",
			default: 0
		},
		{
			name: "avoidBaseMark",
			type: "boolean",
			default: !0
		},
		{
			name: "avoidMarks",
			type: "data",
			array: !0
		},
		{
			name: "method",
			type: "string",
			default: "naive"
		},
		{
			name: "as",
			type: "string",
			array: !0,
			length: bA.length,
			default: bA
		}
	]
}, R(SA, H, { transform(e, t) {
	function n(n) {
		let r = e[n];
		return Ru(r) && t.modified(r.fields);
	}
	let r = e.modified();
	if (!(r || t.changed(t.ADD_REM) || n("sort"))) return;
	(!e.size || e.size.length !== 2) && N("Size parameter should be specified as a [width, height] array.");
	let i = e.as || bA;
	return hA(t.materialize(t.SOURCE).source || [], e.size, e.sort, I(e.offset == null ? 1 : e.offset), I(e.anchor || xA), e.avoidMarks || [], e.avoidBaseMark !== !1, e.lineAnchor || "end", e.markIndex || 0, e.padding === void 0 ? 0 : e.padding, e.method || "naive").forEach((e) => {
		let t = e.datum;
		t[i[0]] = e.x, t[i[1]] = e.y, t[i[2]] = e.opacity, t[i[3]] = e.align, t[i[4]] = e.baseline;
	}), t.reflow(r).modifies(i);
} });
//#endregion
//#region ../../node_modules/.pnpm/vega-regression@2.1.0/node_modules/vega-regression/build/vega-regression.js
var CA = /* @__PURE__ */ t({
	loess: () => TA,
	regression: () => OA
});
function wA(e, t) {
	var n = [], r = function(e) {
		return e(s);
	}, i, a, o, s, c, l;
	if (t == null) n.push(e);
	else for (i = {}, a = 0, o = e.length; a < o; ++a) s = e[a], c = t.map(r), l = i[c], l || (i[c] = l = [], l.dims = c, n.push(l)), l.push(s);
	return n;
}
function TA(e) {
	H.call(this, null, e);
}
TA.Definition = {
	type: "Loess",
	metadata: { generates: !0 },
	params: [
		{
			name: "x",
			type: "field",
			required: !0
		},
		{
			name: "y",
			type: "field",
			required: !0
		},
		{
			name: "groupby",
			type: "field",
			array: !0
		},
		{
			name: "bandwidth",
			type: "number",
			default: .3
		},
		{
			name: "as",
			type: "string",
			array: !0
		}
	]
}, R(TA, H, { transform(e, t) {
	let n = t.fork(t.NO_SOURCE | t.NO_FIELDS);
	if (!this.value || t.changed() || e.modified()) {
		let r = t.materialize(t.SOURCE).source, i = wA(r, e.groupby), a = (e.groupby || []).map(Ql), o = a.length, s = e.as || [Ql(e.x), Ql(e.y)], c = [];
		i.forEach((t) => {
			zh(t, e.x, e.y, e.bandwidth || .3).forEach((e) => {
				let n = {};
				for (let e = 0; e < o; ++e) n[a[e]] = t.dims[e];
				n[s[0]] = e[0], n[s[1]] = e[1], c.push(Rp(n));
			});
		}), this.value && (n.rem = this.value), this.value = n.add = n.source = c;
	}
	return n;
} });
var EA = {
	constant: wh,
	linear: kh,
	log: Ah,
	exp: jh,
	pow: Mh,
	quad: Nh,
	poly: Ph
}, DA = (e, t) => e === "poly" ? t : e === "quad" ? 2 : 1;
function OA(e) {
	H.call(this, null, e);
}
OA.Definition = {
	type: "Regression",
	metadata: { generates: !0 },
	params: [
		{
			name: "x",
			type: "field",
			required: !0
		},
		{
			name: "y",
			type: "field",
			required: !0
		},
		{
			name: "groupby",
			type: "field",
			array: !0
		},
		{
			name: "method",
			type: "string",
			default: "linear",
			values: Object.keys(EA)
		},
		{
			name: "order",
			type: "number",
			default: 3
		},
		{
			name: "extent",
			type: "number",
			array: !0,
			length: 2
		},
		{
			name: "params",
			type: "boolean",
			default: !1
		},
		{
			name: "as",
			type: "string",
			array: !0
		}
	]
}, R(OA, H, { transform(e, t) {
	let n = t.fork(t.NO_SOURCE | t.NO_FIELDS);
	if (!this.value || t.changed() || e.modified()) {
		let r = t.materialize(t.SOURCE).source, i = wA(r, e.groupby), a = (e.groupby || []).map(Ql), o = e.method || "linear", s = e.order == null ? 3 : e.order, c = DA(o, s), l = e.as || [Ql(e.x), Ql(e.y)], u = EA[o], d = [], f = e.extent;
		L(EA, o) || N("Invalid regression method: " + o), f != null && o === "log" && f[0] <= 0 && (t.dataflow.warn("Ignoring extent with values <= 0 for log regression."), f = null), i.forEach((n) => {
			if (n.length <= c) {
				t.dataflow.warn("Skipping regression with more parameters than data points.");
				return;
			}
			let r = u(n, e.x, e.y, s);
			if (e.params) {
				d.push(Rp({
					keys: n.dims,
					coef: r.coef,
					rSquared: r.rSquared
				}));
				return;
			}
			let i = f || Ju(n, e.x), p = (e) => {
				let t = {};
				for (let e = 0; e < a.length; ++e) t[a[e]] = n.dims[e];
				t[l[0]] = e[0], t[l[1]] = e[1], d.push(Rp(t));
			};
			o === "linear" || o === "constant" ? i.forEach((e) => p([e, r.predict(e)])) : Wh(r.predict, i, 25, 200).forEach(p);
		}), this.value && (n.rem = this.value), this.value = n.add = n.source = d;
	}
	return n;
} });
//#endregion
//#region ../../node_modules/.pnpm/vega-voronoi@5.1.0/node_modules/vega-voronoi/build/vega-voronoi.js
var kA = /* @__PURE__ */ t({ voronoi: () => AA });
function AA(e) {
	H.call(this, null, e);
}
AA.Definition = {
	type: "Voronoi",
	metadata: { modifies: !0 },
	params: [
		{
			name: "x",
			type: "field",
			required: !0
		},
		{
			name: "y",
			type: "field",
			required: !0
		},
		{
			name: "size",
			type: "number",
			array: !0,
			length: 2
		},
		{
			name: "extent",
			type: "array",
			array: !0,
			length: 2,
			default: [[-1e5, -1e5], [1e5, 1e5]],
			content: {
				type: "number",
				array: !0,
				length: 2
			}
		},
		{
			name: "as",
			type: "string",
			default: "path"
		}
	]
};
var jA = [
	-1e5,
	-1e5,
	1e5,
	1e5
];
R(AA, H, { transform(e, t) {
	let n = e.as || "path", r = t.source;
	if (!r || !r.length) return t;
	let i = e.size;
	i = i ? [
		0,
		0,
		i[0],
		i[1]
	] : (i = e.extent) ? [
		i[0][0],
		i[0][1],
		i[1][0],
		i[1][1]
	] : jA;
	let a = this.value = Sn.from(r, e.x, e.y).voronoi(i);
	for (let e = 0, t = r.length; e < t; ++e) {
		let t = a.cellPolygon(e);
		r[e][n] = t && !NA(t) ? MA(t) : null;
	}
	return t.reflow(e.modified()).modifies(n);
} });
function MA(e) {
	let t = e[0][0], n = e[0][1], r = e.length - 1;
	for (; e[r][0] === t && e[r][1] === n; --r);
	return "M" + e.slice(0, r + 1).join("L") + "Z";
}
function NA(e) {
	return e.length === 2 && e[0][0] === e[1][0] && e[0][1] === e[1][1];
}
//#endregion
//#region ../../node_modules/.pnpm/vega-wordcloud@5.1.0/node_modules/vega-wordcloud/build/vega-wordcloud.js
var PA = /* @__PURE__ */ t({ wordcloud: () => XA }), FA = Math.PI / 180, IA = 64, LA = 2048;
function RA() {
	var e = [256, 256], t, n, r, i, a, o, s, c = UA, l = [], u = Math.random, d = {};
	d.layout = function() {
		for (var c = f(V_()), d = GA((e[0] >> 5) * e[1]), m = null, h = l.length, g = -1, _ = [], v = l.map((e) => ({
			text: t(e),
			font: n(e),
			style: i(e),
			weight: a(e),
			rotate: o(e),
			size: ~~(r(e) + 1e-14),
			padding: s(e),
			xoff: 0,
			yoff: 0,
			x1: 0,
			y1: 0,
			x0: 0,
			y0: 0,
			hasText: !1,
			sprite: null,
			datum: e
		})).sort((e, t) => t.size - e.size); ++g < h;) {
			var y = v[g];
			y.x = e[0] * (u() + .5) >> 1, y.y = e[1] * (u() + .5) >> 1, zA(c, y, v, g), y.hasText && p(d, y, m) && (_.push(y), m ? VA(m, y) : m = [{
				x: y.x + y.x0,
				y: y.y + y.y0
			}, {
				x: y.x + y.x1,
				y: y.y + y.y1
			}], y.x -= e[0] >> 1, y.y -= e[1] >> 1);
		}
		return _;
	};
	function f(e) {
		e.width = e.height = 1;
		var t = Math.sqrt(e.getContext("2d").getImageData(0, 0, 1, 1).data.length >> 2);
		e.width = (IA << 5) / t, e.height = LA / t;
		var n = e.getContext("2d");
		return n.fillStyle = n.strokeStyle = "red", n.textAlign = "center", {
			context: n,
			ratio: t
		};
	}
	function p(t, n, r) {
		for (var i = n.x, a = n.y, o = Math.hypot(e[0], e[1]), s = c(e), l = u() < .5 ? 1 : -1, d = -l, f, p, m; (f = s(d += l)) && (p = ~~f[0], m = ~~f[1], !(Math.min(Math.abs(p), Math.abs(m)) >= o));) if (n.x = i + p, n.y = a + m, !(n.x + n.x0 < 0 || n.y + n.y0 < 0 || n.x + n.x1 > e[0] || n.y + n.y1 > e[1]) && (!r || !BA(n, t, e[0])) && (!r || HA(n, r))) {
			for (var h = n.sprite, g = n.width >> 5, _ = e[0] >> 5, v = n.x - (g << 4), y = v & 127, b = 32 - y, x = n.y1 - n.y0, S = (n.y + n.y0) * _ + (v >> 5), C, w = 0; w < x; w++) {
				C = 0;
				for (var T = 0; T <= g; T++) t[S + T] |= C << b | (T < g ? (C = h[w * g + T]) >>> y : 0);
				S += _;
			}
			return n.sprite = null, !0;
		}
		return !1;
	}
	return d.words = function(e) {
		return arguments.length ? (l = e, d) : l;
	}, d.size = function(t) {
		return arguments.length ? (e = [+t[0], +t[1]], d) : e;
	}, d.font = function(e) {
		return arguments.length ? (n = KA(e), d) : n;
	}, d.fontStyle = function(e) {
		return arguments.length ? (i = KA(e), d) : i;
	}, d.fontWeight = function(e) {
		return arguments.length ? (a = KA(e), d) : a;
	}, d.rotate = function(e) {
		return arguments.length ? (o = KA(e), d) : o;
	}, d.text = function(e) {
		return arguments.length ? (t = KA(e), d) : t;
	}, d.spiral = function(e) {
		return arguments.length ? (c = qA[e] || e, d) : c;
	}, d.fontSize = function(e) {
		return arguments.length ? (r = KA(e), d) : r;
	}, d.padding = function(e) {
		return arguments.length ? (s = KA(e), d) : s;
	}, d.random = function(e) {
		return arguments.length ? (u = e, d) : u;
	}, d;
}
function zA(e, t, n, r) {
	if (!t.sprite) {
		var i = e.context, a = e.ratio;
		i.clearRect(0, 0, (IA << 5) / a, LA / a);
		var o = 0, s = 0, c = 0, l = n.length, u, d, f, p, m;
		for (--r; ++r < l;) {
			if (t = n[r], i.save(), i.font = t.style + " " + t.weight + " " + ~~((t.size + 1) / a) + "px " + t.font, u = i.measureText(t.text + "m").width * a, f = t.size << 1, t.rotate) {
				var h = Math.sin(t.rotate * FA), g = Math.cos(t.rotate * FA), _ = u * g, v = u * h, y = f * g, b = f * h;
				u = Math.max(Math.abs(_ + b), Math.abs(_ - b)) + 31 >> 5 << 5, f = ~~Math.max(Math.abs(v + y), Math.abs(v - y));
			} else u = u + 31 >> 5 << 5;
			if (f > c && (c = f), o + u >= IA << 5 && (o = 0, s += c, c = 0), s + f >= LA) break;
			i.translate((o + (u >> 1)) / a, (s + (f >> 1)) / a), t.rotate && i.rotate(t.rotate * FA), i.fillText(t.text, 0, 0), t.padding && (i.lineWidth = 2 * t.padding, i.strokeText(t.text, 0, 0)), i.restore(), t.width = u, t.height = f, t.xoff = o, t.yoff = s, t.x1 = u >> 1, t.y1 = f >> 1, t.x0 = -t.x1, t.y0 = -t.y1, t.hasText = !0, o += u;
		}
		for (var x = i.getImageData(0, 0, (IA << 5) / a, LA / a).data, S = []; --r >= 0;) if (t = n[r], t.hasText) {
			for (u = t.width, d = u >> 5, f = t.y1 - t.y0, p = 0; p < f * d; p++) S[p] = 0;
			if (o = t.xoff, o == null) return;
			s = t.yoff;
			var C = 0, w = -1;
			for (m = 0; m < f; m++) {
				for (p = 0; p < u; p++) {
					var T = d * m + (p >> 5), E = x[(s + m) * (IA << 5) + (o + p) << 2] ? 1 << 31 - p % 32 : 0;
					S[T] |= E, C |= E;
				}
				C ? w = m : (t.y0++, f--, m--, s++);
			}
			t.y1 = t.y0 + w, t.sprite = S.slice(0, (t.y1 - t.y0) * d);
		}
	}
}
function BA(e, t, n) {
	n >>= 5;
	for (var r = e.sprite, i = e.width >> 5, a = e.x - (i << 4), o = a & 127, s = 32 - o, c = e.y1 - e.y0, l = (e.y + e.y0) * n + (a >> 5), u, d = 0; d < c; d++) {
		u = 0;
		for (var f = 0; f <= i; f++) if ((u << s | (f < i ? (u = r[d * i + f]) >>> o : 0)) & t[l + f]) return !0;
		l += n;
	}
	return !1;
}
function VA(e, t) {
	var n = e[0], r = e[1];
	t.x + t.x0 < n.x && (n.x = t.x + t.x0), t.y + t.y0 < n.y && (n.y = t.y + t.y0), t.x + t.x1 > r.x && (r.x = t.x + t.x1), t.y + t.y1 > r.y && (r.y = t.y + t.y1);
}
function HA(e, t) {
	return e.x + e.x1 > t[0].x && e.x + e.x0 < t[1].x && e.y + e.y1 > t[0].y && e.y + e.y0 < t[1].y;
}
function UA(e) {
	var t = e[0] / e[1];
	return function(e) {
		return [t * (e *= .1) * Math.cos(e), e * Math.sin(e)];
	};
}
function WA(e) {
	var t = 4, n = t * e[0] / e[1], r = 0, i = 0;
	return function(e) {
		var a = e < 0 ? -1 : 1;
		switch (Math.sqrt(1 + 4 * a * e) - a & 3) {
			case 0:
				r += n;
				break;
			case 1:
				i += t;
				break;
			case 2:
				r -= n;
				break;
			default:
				i -= t;
				break;
		}
		return [r, i];
	};
}
function GA(e) {
	for (var t = [], n = -1; ++n < e;) t[n] = 0;
	return t;
}
function KA(e) {
	return typeof e == "function" ? e : function() {
		return e;
	};
}
var qA = {
	archimedean: UA,
	rectangular: WA
}, JA = [
	"x",
	"y",
	"font",
	"fontSize",
	"fontStyle",
	"fontWeight",
	"angle"
], YA = [
	"text",
	"font",
	"rotate",
	"fontSize",
	"fontStyle",
	"fontWeight"
];
function XA(e) {
	H.call(this, RA(), e);
}
XA.Definition = {
	type: "Wordcloud",
	metadata: { modifies: !0 },
	params: [
		{
			name: "size",
			type: "number",
			array: !0,
			length: 2
		},
		{
			name: "font",
			type: "string",
			expr: !0,
			default: "sans-serif"
		},
		{
			name: "fontStyle",
			type: "string",
			expr: !0,
			default: "normal"
		},
		{
			name: "fontWeight",
			type: "string",
			expr: !0,
			default: "normal"
		},
		{
			name: "fontSize",
			type: "number",
			expr: !0,
			default: 14
		},
		{
			name: "fontSizeRange",
			type: "number",
			array: "nullable",
			default: [10, 50]
		},
		{
			name: "rotate",
			type: "number",
			expr: !0,
			default: 0
		},
		{
			name: "text",
			type: "field"
		},
		{
			name: "spiral",
			type: "string",
			values: ["archimedean", "rectangular"]
		},
		{
			name: "padding",
			type: "number",
			expr: !0
		},
		{
			name: "as",
			type: "string",
			array: !0,
			length: 7,
			default: JA
		}
	]
}, R(XA, H, { transform(e, t) {
	e.size && !(e.size[0] && e.size[1]) && N("Wordcloud size dimensions must be non-zero.");
	function n(n) {
		let r = e[n];
		return Ru(r) && t.modified(r.fields);
	}
	let r = e.modified();
	if (!(r || t.changed(t.ADD_REM) || YA.some(n))) return;
	let i = t.materialize(t.SOURCE).source, a = this.value, o = e.as || JA, s = e.fontSize || 14, c;
	if (Ru(s) ? c = e.fontSizeRange : s = Gu(s), c) {
		let e = s, t = Cv("sqrt")().domain(Ju(i, e)).range(c);
		s = (n) => t(e(n));
	}
	i.forEach((e) => {
		e[o[0]] = NaN, e[o[1]] = NaN, e[o[3]] = 0;
	});
	let l = a.words(i).text(e.text).size(e.size || [500, 500]).padding(e.padding || 1).spiral(e.spiral || "archimedean").rotate(e.rotate || 0).font(e.font || "sans-serif").fontStyle(e.fontStyle || "normal").fontWeight(e.fontWeight || "normal").fontSize(s).random(Xm).layout(), u = a.size(), d = u[0] >> 1, f = u[1] >> 1, p = l.length;
	for (let e = 0, t, n; e < p; ++e) t = l[e], n = t.datum, n[o[0]] = t.x + d, n[o[1]] = t.y + f, n[o[2]] = t.font, n[o[3]] = t.size, n[o[4]] = t.style, n[o[5]] = t.weight, n[o[6]] = t.rotate;
	return t.reflow(r).modifies(o);
} });
//#endregion
//#region ../../node_modules/.pnpm/vega-crossfilter@5.1.0/node_modules/vega-crossfilter/build/vega-crossfilter.js
var ZA = /* @__PURE__ */ t({
	crossfilter: () => cj,
	resolvefilter: () => lj
}), QA = (e) => new Uint8Array(e), $A = (e) => new Uint16Array(e), ej = (e) => new Uint32Array(e);
function tj() {
	let e = 8, t = [], n = ej(0), r = rj(0, e), i = rj(0, e);
	return {
		data: () => t,
		seen: () => n = nj(n, t.length),
		add(e) {
			for (let n = 0, r = t.length, i = e.length, a; n < i; ++n) a = e[n], a._index = r++, t.push(a);
		},
		remove(e, n) {
			let a = t.length, o = Array(a - e), s = t, c, l, u;
			for (l = 0; !n[l] && l < a; ++l) o[l] = t[l], s[l] = l;
			for (u = l; l < a; ++l) c = t[l], n[l] ? s[l] = -1 : (s[l] = u, r[u] = r[l], i[u] = i[l], o[u] = c, c._index = u++), r[l] = 0;
			return t = o, s;
		},
		size: () => t.length,
		curr: () => r,
		prev: () => i,
		reset: (e) => i[e] = r[e],
		all: () => e < 257 ? 255 : e < 65537 ? 65535 : 4294967295,
		set(e, t) {
			r[e] |= t;
		},
		clear(e, t) {
			r[e] &= ~t;
		},
		resize(t, n) {
			(t > r.length || n > e) && (e = Math.max(n, e), r = rj(t, e, r), i = rj(t, e));
		}
	};
}
function nj(e, t, n) {
	return e.length >= t ? e : (n = n || new e.constructor(t), n.set(e), n);
}
function rj(e, t, n) {
	let r = (t < 257 ? QA : t < 65537 ? $A : ej)(e);
	return n && r.set(n), r;
}
function ij(e, t, n) {
	let r = 1 << t;
	return {
		one: r,
		zero: ~r,
		range: n.slice(),
		bisect: e.bisect,
		index: e.index,
		size: e.size,
		onAdd(e, t) {
			let n = this, i = n.bisect(n.range, e.value), a = e.index, o = i[0], s = i[1], c = a.length, l;
			for (l = 0; l < o; ++l) t[a[l]] |= r;
			for (l = s; l < c; ++l) t[a[l]] |= r;
			return n;
		}
	};
}
function aj() {
	let e = ej(0), t = [], n = 0;
	function r(r, i, a) {
		if (!i.length) return [];
		let o = n, s = i.length, c = ej(s), l = Array(s), u, d, f;
		for (f = 0; f < s; ++f) l[f] = r(i[f]), c[f] = f;
		if (l = oj(l, c), o) u = t, d = e, t = Array(o + s), e = ej(o + s), sj(a, u, d, o, l, c, s, t, e);
		else {
			if (a > 0) for (f = 0; f < s; ++f) c[f] += a;
			t = l, e = c;
		}
		return n = o + s, {
			index: c,
			value: l
		};
	}
	function i(r, i) {
		let a = n, o, s, c;
		for (s = 0; !i[e[s]] && s < a; ++s);
		for (c = s; s < a; ++s) i[o = e[s]] || (e[c] = o, t[c] = t[s], ++c);
		n = a - r;
	}
	function a(t) {
		for (let r = 0, i = n; r < i; ++r) e[r] = t[e[r]];
	}
	function o(e, r) {
		let i;
		return r ? i = r.length : (r = t, i = n), [u(r, e[0], 0, i), c(r, e[1], 0, i)];
	}
	return {
		insert: r,
		remove: i,
		bisect: o,
		reindex: a,
		index: () => e,
		size: () => n
	};
}
function oj(e, t) {
	return e.sort.call(t, (t, n) => {
		let r = e[t], i = e[n];
		return r < i ? -1 : +(r > i);
	}), Ct(e, t);
}
function sj(e, t, n, r, i, a, o, s, c) {
	let l = 0, u = 0, d;
	for (d = 0; l < r && u < o; ++d) t[l] < i[u] ? (s[d] = t[l], c[d] = n[l++]) : (s[d] = i[u], c[d] = a[u++] + e);
	for (; l < r; ++l, ++d) s[d] = t[l], c[d] = n[l];
	for (; u < o; ++u, ++d) s[d] = i[u], c[d] = a[u] + e;
}
function cj(e) {
	H.call(this, tj(), e), this._indices = null, this._dims = null;
}
cj.Definition = {
	type: "CrossFilter",
	metadata: {},
	params: [{
		name: "fields",
		type: "field",
		array: !0,
		required: !0
	}, {
		name: "query",
		type: "array",
		array: !0,
		required: !0,
		content: {
			type: "number",
			array: !0,
			length: 2
		}
	}]
}, R(cj, H, {
	transform(e, t) {
		return this._dims ? e.modified("fields") || e.fields.some((e) => t.modified(e.fields)) ? this.reinit(e, t) : this.eval(e, t) : this.init(e, t);
	},
	init(e, t) {
		let n = e.fields, r = e.query, i = this._indices = {}, a = this._dims = [], o = r.length, s = 0, c, l;
		for (; s < o; ++s) c = n[s].fname, l = i[c] || (i[c] = aj()), a.push(ij(l, s, r[s]));
		return this.eval(e, t);
	},
	reinit(e, t) {
		let n = t.materialize().fork(), r = e.fields, i = e.query, a = this._indices, o = this._dims, s = this.value, c = s.curr(), l = s.prev(), u = s.all(), d = n.rem = n.add, f = n.mod, p = i.length, m = {}, h, g, _, v, y, b, x, S, C;
		if (l.set(c), t.rem.length && (y = this.remove(e, t, n)), t.add.length && s.add(t.add), t.mod.length) for (b = {}, v = t.mod, x = 0, S = v.length; x < S; ++x) b[v[x]._index] = 1;
		for (x = 0; x < p; ++x) C = r[x], (!o[x] || e.modified("fields", x) || t.modified(C.fields)) && (_ = C.fname, (h = m[_]) || (a[_] = g = aj(), m[_] = h = g.insert(C, t.source, 0)), o[x] = ij(g, x, i[x]).onAdd(h, c));
		for (x = 0, S = s.data().length; x < S; ++x) if (y[x]) continue;
		else l[x] === c[x] ? b[x] && c[x] !== u && f.push(x) : d.push(x);
		return s.mask = (1 << p) - 1, n;
	},
	eval(e, t) {
		let n = t.materialize().fork(), r = this._dims.length, i = 0;
		return t.rem.length && (this.remove(e, t, n), i |= (1 << r) - 1), e.modified("query") && !e.modified("fields") && (i |= this.update(e, t, n)), t.add.length && (this.insert(e, t, n), i |= (1 << r) - 1), t.mod.length && (this.modify(t, n), i |= (1 << r) - 1), this.value.mask = i, n;
	},
	insert(e, t, n) {
		let r = t.add, i = this.value, a = this._dims, o = this._indices, s = e.fields, c = {}, l = n.add, u = i.size() + r.length, d = a.length, f = i.size(), p, m, h;
		i.resize(u, d), i.add(r);
		let g = i.curr(), _ = i.prev(), v = i.all();
		for (p = 0; p < d; ++p) m = s[p].fname, h = c[m] || (c[m] = o[m].insert(s[p], r, f)), a[p].onAdd(h, g);
		for (; f < u; ++f) _[f] = v, g[f] !== v && l.push(f);
	},
	modify(e, t) {
		let n = t.mod, r = this.value, i = r.curr(), a = r.all(), o = e.mod, s, c, l;
		for (s = 0, c = o.length; s < c; ++s) l = o[s]._index, i[l] !== a && n.push(l);
	},
	remove(e, t, n) {
		let r = this._indices, i = this.value, a = i.curr(), o = i.prev(), s = i.all(), c = {}, l = n.rem, u = t.rem, d, f, p, m;
		for (d = 0, f = u.length; d < f; ++d) p = u[d]._index, c[p] = 1, o[p] = m = a[p], a[p] = s, m !== s && l.push(p);
		for (p in r) r[p].remove(f, c);
		return this.reindex(t, f, c), c;
	},
	reindex(e, t, n) {
		let r = this._indices, i = this.value;
		e.runAfter(() => {
			let e = i.remove(t, n);
			for (let t in r) r[t].reindex(e);
		});
	},
	update(e, t, n) {
		let r = this._dims, i = e.query, a = t.stamp, o = r.length, s = 0, c, l;
		for (n.filters = 0, l = 0; l < o; ++l) e.modified("query", l) && (c = l, ++s);
		if (s === 1) s = r[c].one, this.incrementOne(r[c], i[c], n.add, n.rem);
		else for (l = 0, s = 0; l < o; ++l) e.modified("query", l) && (s |= r[l].one, this.incrementAll(r[l], i[l], a, n.add), n.rem = n.add);
		return s;
	},
	incrementAll(e, t, n, r) {
		let i = this.value, a = i.seen(), o = i.curr(), s = i.prev(), c = e.index(), l = e.bisect(e.range), u = e.bisect(t), d = u[0], f = u[1], p = l[0], m = l[1], h = e.one, g, _, v;
		if (d < p) for (g = d, _ = Math.min(p, f); g < _; ++g) v = c[g], a[v] !== n && (s[v] = o[v], a[v] = n, r.push(v)), o[v] ^= h;
		else if (d > p) for (g = p, _ = Math.min(d, m); g < _; ++g) v = c[g], a[v] !== n && (s[v] = o[v], a[v] = n, r.push(v)), o[v] ^= h;
		if (f > m) for (g = Math.max(d, m), _ = f; g < _; ++g) v = c[g], a[v] !== n && (s[v] = o[v], a[v] = n, r.push(v)), o[v] ^= h;
		else if (f < m) for (g = Math.max(p, f), _ = m; g < _; ++g) v = c[g], a[v] !== n && (s[v] = o[v], a[v] = n, r.push(v)), o[v] ^= h;
		e.range = t.slice();
	},
	incrementOne(e, t, n, r) {
		let i = this.value.curr(), a = e.index(), o = e.bisect(e.range), s = e.bisect(t), c = s[0], l = s[1], u = o[0], d = o[1], f = e.one, p, m, h;
		if (c < u) for (p = c, m = Math.min(u, l); p < m; ++p) h = a[p], i[h] ^= f, n.push(h);
		else if (c > u) for (p = u, m = Math.min(c, d); p < m; ++p) h = a[p], i[h] ^= f, r.push(h);
		if (l > d) for (p = Math.max(c, d), m = l; p < m; ++p) h = a[p], i[h] ^= f, n.push(h);
		else if (l < d) for (p = Math.max(u, l), m = d; p < m; ++p) h = a[p], i[h] ^= f, r.push(h);
		e.range = t.slice();
	}
});
function lj(e) {
	H.call(this, null, e);
}
lj.Definition = {
	type: "ResolveFilter",
	metadata: {},
	params: [{
		name: "ignore",
		type: "number",
		required: !0,
		description: "A bit mask indicating which filters to ignore."
	}, {
		name: "filter",
		type: "object",
		required: !0,
		description: "Per-tuple filter bitmaps from a CrossFilter transform."
	}]
}, R(lj, H, { transform(e, t) {
	let n = ~(e.ignore || 0), r = e.filter, i = r.mask;
	if ((i & n) === 0) return t.StopPropagation;
	let a = t.fork(t.ALL), o = r.data(), s = r.curr(), c = r.prev(), l = (e) => s[e] & n ? null : o[e];
	return a.filter(a.MOD, l), i & i - 1 ? (a.filter(a.ADD, (e) => {
		let t = s[e] & n;
		return !t && t ^ c[e] & n ? o[e] : null;
	}), a.filter(a.REM, (e) => {
		let t = s[e] & n;
		return t && !(t ^ (t ^ c[e] & n)) ? o[e] : null;
	})) : (a.filter(a.ADD, l), a.filter(a.REM, (e) => (s[e] & n) === i ? o[e] : null)), a.filter(a.SOURCE, (e) => l(e._index));
} });
//#endregion
//#region ../../node_modules/.pnpm/vega-expression@6.1.0/node_modules/vega-expression/build/vega-expression.js
var uj = "RawCode", dj = "Literal", fj = "Property", pj = "Identifier", mj = "ArrayExpression", hj = "BinaryExpression", gj = "CallExpression", _j = "ConditionalExpression", vj = "LogicalExpression", yj = "MemberExpression", bj = "ObjectExpression", xj = "UnaryExpression";
function Sj(e) {
	this.type = e;
}
Sj.prototype.visit = function(e) {
	let t, n, r;
	if (e(this)) return 1;
	for (t = Cj(this), n = 0, r = t.length; n < r; ++n) if (t[n].visit(e)) return 1;
};
function Cj(e) {
	switch (e.type) {
		case mj: return e.elements;
		case hj:
		case vj: return [e.left, e.right];
		case gj: return [e.callee].concat(e.arguments);
		case _j: return [
			e.test,
			e.consequent,
			e.alternate
		];
		case yj: return [e.object, e.property];
		case bj: return e.properties;
		case fj: return [e.key, e.value];
		case xj: return [e.argument];
		case pj:
		case dj:
		case uj:
		default: return [];
	}
}
var wj, U, W, Tj, Ej, Dj = 1, Oj = 2, kj = 3, Aj = 4, jj = 5, Mj = 6, Nj = 7, Pj = 8, Fj = 9;
wj = {}, wj[Dj] = "Boolean", wj[Oj] = "<end>", wj[kj] = "Identifier", wj[Aj] = "Keyword", wj[jj] = "Null", wj[Mj] = "Numeric", wj[Nj] = "Punctuator", wj[Pj] = "String", wj[Fj] = "RegularExpression";
var Ij = "ArrayExpression", Lj = "BinaryExpression", Rj = "CallExpression", zj = "ConditionalExpression", Bj = "Identifier", Vj = "Literal", Hj = "LogicalExpression", Uj = "MemberExpression", Wj = "ObjectExpression", Gj = "Property", Kj = "UnaryExpression", qj = "Unexpected token %0", Jj = "Unexpected number", Yj = "Unexpected string", Xj = "Unexpected identifier", Zj = "Unexpected reserved word", Qj = "Unexpected end of input", $j = "Invalid regular expression", eM = "Invalid regular expression: missing /", tM = "Octal literals are not allowed in strict mode.", nM = "Duplicate data property in object literal not allowed in strict mode", rM = "ILLEGAL", iM = "Disabled.", aM = /* @__PURE__ */ RegExp("[\\xAA\\xB5\\xBA\\xC0-\\xD6\\xD8-\\xF6\\xF8-\\u02C1\\u02C6-\\u02D1\\u02E0-\\u02E4\\u02EC\\u02EE\\u0370-\\u0374\\u0376\\u0377\\u037A-\\u037D\\u037F\\u0386\\u0388-\\u038A\\u038C\\u038E-\\u03A1\\u03A3-\\u03F5\\u03F7-\\u0481\\u048A-\\u052F\\u0531-\\u0556\\u0559\\u0561-\\u0587\\u05D0-\\u05EA\\u05F0-\\u05F2\\u0620-\\u064A\\u066E\\u066F\\u0671-\\u06D3\\u06D5\\u06E5\\u06E6\\u06EE\\u06EF\\u06FA-\\u06FC\\u06FF\\u0710\\u0712-\\u072F\\u074D-\\u07A5\\u07B1\\u07CA-\\u07EA\\u07F4\\u07F5\\u07FA\\u0800-\\u0815\\u081A\\u0824\\u0828\\u0840-\\u0858\\u08A0-\\u08B2\\u0904-\\u0939\\u093D\\u0950\\u0958-\\u0961\\u0971-\\u0980\\u0985-\\u098C\\u098F\\u0990\\u0993-\\u09A8\\u09AA-\\u09B0\\u09B2\\u09B6-\\u09B9\\u09BD\\u09CE\\u09DC\\u09DD\\u09DF-\\u09E1\\u09F0\\u09F1\\u0A05-\\u0A0A\\u0A0F\\u0A10\\u0A13-\\u0A28\\u0A2A-\\u0A30\\u0A32\\u0A33\\u0A35\\u0A36\\u0A38\\u0A39\\u0A59-\\u0A5C\\u0A5E\\u0A72-\\u0A74\\u0A85-\\u0A8D\\u0A8F-\\u0A91\\u0A93-\\u0AA8\\u0AAA-\\u0AB0\\u0AB2\\u0AB3\\u0AB5-\\u0AB9\\u0ABD\\u0AD0\\u0AE0\\u0AE1\\u0B05-\\u0B0C\\u0B0F\\u0B10\\u0B13-\\u0B28\\u0B2A-\\u0B30\\u0B32\\u0B33\\u0B35-\\u0B39\\u0B3D\\u0B5C\\u0B5D\\u0B5F-\\u0B61\\u0B71\\u0B83\\u0B85-\\u0B8A\\u0B8E-\\u0B90\\u0B92-\\u0B95\\u0B99\\u0B9A\\u0B9C\\u0B9E\\u0B9F\\u0BA3\\u0BA4\\u0BA8-\\u0BAA\\u0BAE-\\u0BB9\\u0BD0\\u0C05-\\u0C0C\\u0C0E-\\u0C10\\u0C12-\\u0C28\\u0C2A-\\u0C39\\u0C3D\\u0C58\\u0C59\\u0C60\\u0C61\\u0C85-\\u0C8C\\u0C8E-\\u0C90\\u0C92-\\u0CA8\\u0CAA-\\u0CB3\\u0CB5-\\u0CB9\\u0CBD\\u0CDE\\u0CE0\\u0CE1\\u0CF1\\u0CF2\\u0D05-\\u0D0C\\u0D0E-\\u0D10\\u0D12-\\u0D3A\\u0D3D\\u0D4E\\u0D60\\u0D61\\u0D7A-\\u0D7F\\u0D85-\\u0D96\\u0D9A-\\u0DB1\\u0DB3-\\u0DBB\\u0DBD\\u0DC0-\\u0DC6\\u0E01-\\u0E30\\u0E32\\u0E33\\u0E40-\\u0E46\\u0E81\\u0E82\\u0E84\\u0E87\\u0E88\\u0E8A\\u0E8D\\u0E94-\\u0E97\\u0E99-\\u0E9F\\u0EA1-\\u0EA3\\u0EA5\\u0EA7\\u0EAA\\u0EAB\\u0EAD-\\u0EB0\\u0EB2\\u0EB3\\u0EBD\\u0EC0-\\u0EC4\\u0EC6\\u0EDC-\\u0EDF\\u0F00\\u0F40-\\u0F47\\u0F49-\\u0F6C\\u0F88-\\u0F8C\\u1000-\\u102A\\u103F\\u1050-\\u1055\\u105A-\\u105D\\u1061\\u1065\\u1066\\u106E-\\u1070\\u1075-\\u1081\\u108E\\u10A0-\\u10C5\\u10C7\\u10CD\\u10D0-\\u10FA\\u10FC-\\u1248\\u124A-\\u124D\\u1250-\\u1256\\u1258\\u125A-\\u125D\\u1260-\\u1288\\u128A-\\u128D\\u1290-\\u12B0\\u12B2-\\u12B5\\u12B8-\\u12BE\\u12C0\\u12C2-\\u12C5\\u12C8-\\u12D6\\u12D8-\\u1310\\u1312-\\u1315\\u1318-\\u135A\\u1380-\\u138F\\u13A0-\\u13F4\\u1401-\\u166C\\u166F-\\u167F\\u1681-\\u169A\\u16A0-\\u16EA\\u16EE-\\u16F8\\u1700-\\u170C\\u170E-\\u1711\\u1720-\\u1731\\u1740-\\u1751\\u1760-\\u176C\\u176E-\\u1770\\u1780-\\u17B3\\u17D7\\u17DC\\u1820-\\u1877\\u1880-\\u18A8\\u18AA\\u18B0-\\u18F5\\u1900-\\u191E\\u1950-\\u196D\\u1970-\\u1974\\u1980-\\u19AB\\u19C1-\\u19C7\\u1A00-\\u1A16\\u1A20-\\u1A54\\u1AA7\\u1B05-\\u1B33\\u1B45-\\u1B4B\\u1B83-\\u1BA0\\u1BAE\\u1BAF\\u1BBA-\\u1BE5\\u1C00-\\u1C23\\u1C4D-\\u1C4F\\u1C5A-\\u1C7D\\u1CE9-\\u1CEC\\u1CEE-\\u1CF1\\u1CF5\\u1CF6\\u1D00-\\u1DBF\\u1E00-\\u1F15\\u1F18-\\u1F1D\\u1F20-\\u1F45\\u1F48-\\u1F4D\\u1F50-\\u1F57\\u1F59\\u1F5B\\u1F5D\\u1F5F-\\u1F7D\\u1F80-\\u1FB4\\u1FB6-\\u1FBC\\u1FBE\\u1FC2-\\u1FC4\\u1FC6-\\u1FCC\\u1FD0-\\u1FD3\\u1FD6-\\u1FDB\\u1FE0-\\u1FEC\\u1FF2-\\u1FF4\\u1FF6-\\u1FFC\\u2071\\u207F\\u2090-\\u209C\\u2102\\u2107\\u210A-\\u2113\\u2115\\u2119-\\u211D\\u2124\\u2126\\u2128\\u212A-\\u212D\\u212F-\\u2139\\u213C-\\u213F\\u2145-\\u2149\\u214E\\u2160-\\u2188\\u2C00-\\u2C2E\\u2C30-\\u2C5E\\u2C60-\\u2CE4\\u2CEB-\\u2CEE\\u2CF2\\u2CF3\\u2D00-\\u2D25\\u2D27\\u2D2D\\u2D30-\\u2D67\\u2D6F\\u2D80-\\u2D96\\u2DA0-\\u2DA6\\u2DA8-\\u2DAE\\u2DB0-\\u2DB6\\u2DB8-\\u2DBE\\u2DC0-\\u2DC6\\u2DC8-\\u2DCE\\u2DD0-\\u2DD6\\u2DD8-\\u2DDE\\u2E2F\\u3005-\\u3007\\u3021-\\u3029\\u3031-\\u3035\\u3038-\\u303C\\u3041-\\u3096\\u309D-\\u309F\\u30A1-\\u30FA\\u30FC-\\u30FF\\u3105-\\u312D\\u3131-\\u318E\\u31A0-\\u31BA\\u31F0-\\u31FF\\u3400-\\u4DB5\\u4E00-\\u9FCC\\uA000-\\uA48C\\uA4D0-\\uA4FD\\uA500-\\uA60C\\uA610-\\uA61F\\uA62A\\uA62B\\uA640-\\uA66E\\uA67F-\\uA69D\\uA6A0-\\uA6EF\\uA717-\\uA71F\\uA722-\\uA788\\uA78B-\\uA78E\\uA790-\\uA7AD\\uA7B0\\uA7B1\\uA7F7-\\uA801\\uA803-\\uA805\\uA807-\\uA80A\\uA80C-\\uA822\\uA840-\\uA873\\uA882-\\uA8B3\\uA8F2-\\uA8F7\\uA8FB\\uA90A-\\uA925\\uA930-\\uA946\\uA960-\\uA97C\\uA984-\\uA9B2\\uA9CF\\uA9E0-\\uA9E4\\uA9E6-\\uA9EF\\uA9FA-\\uA9FE\\uAA00-\\uAA28\\uAA40-\\uAA42\\uAA44-\\uAA4B\\uAA60-\\uAA76\\uAA7A\\uAA7E-\\uAAAF\\uAAB1\\uAAB5\\uAAB6\\uAAB9-\\uAABD\\uAAC0\\uAAC2\\uAADB-\\uAADD\\uAAE0-\\uAAEA\\uAAF2-\\uAAF4\\uAB01-\\uAB06\\uAB09-\\uAB0E\\uAB11-\\uAB16\\uAB20-\\uAB26\\uAB28-\\uAB2E\\uAB30-\\uAB5A\\uAB5C-\\uAB5F\\uAB64\\uAB65\\uABC0-\\uABE2\\uAC00-\\uD7A3\\uD7B0-\\uD7C6\\uD7CB-\\uD7FB\\uF900-\\uFA6D\\uFA70-\\uFAD9\\uFB00-\\uFB06\\uFB13-\\uFB17\\uFB1D\\uFB1F-\\uFB28\\uFB2A-\\uFB36\\uFB38-\\uFB3C\\uFB3E\\uFB40\\uFB41\\uFB43\\uFB44\\uFB46-\\uFBB1\\uFBD3-\\uFD3D\\uFD50-\\uFD8F\\uFD92-\\uFDC7\\uFDF0-\\uFDFB\\uFE70-\\uFE74\\uFE76-\\uFEFC\\uFF21-\\uFF3A\\uFF41-\\uFF5A\\uFF66-\\uFFBE\\uFFC2-\\uFFC7\\uFFCA-\\uFFCF\\uFFD2-\\uFFD7\\uFFDA-\\uFFDC]"), oM = /* @__PURE__ */ RegExp("[\\xAA\\xB5\\xBA\\xC0-\\xD6\\xD8-\\xF6\\xF8-\\u02C1\\u02C6-\\u02D1\\u02E0-\\u02E4\\u02EC\\u02EE\\u0300-\\u0374\\u0376\\u0377\\u037A-\\u037D\\u037F\\u0386\\u0388-\\u038A\\u038C\\u038E-\\u03A1\\u03A3-\\u03F5\\u03F7-\\u0481\\u0483-\\u0487\\u048A-\\u052F\\u0531-\\u0556\\u0559\\u0561-\\u0587\\u0591-\\u05BD\\u05BF\\u05C1\\u05C2\\u05C4\\u05C5\\u05C7\\u05D0-\\u05EA\\u05F0-\\u05F2\\u0610-\\u061A\\u0620-\\u0669\\u066E-\\u06D3\\u06D5-\\u06DC\\u06DF-\\u06E8\\u06EA-\\u06FC\\u06FF\\u0710-\\u074A\\u074D-\\u07B1\\u07C0-\\u07F5\\u07FA\\u0800-\\u082D\\u0840-\\u085B\\u08A0-\\u08B2\\u08E4-\\u0963\\u0966-\\u096F\\u0971-\\u0983\\u0985-\\u098C\\u098F\\u0990\\u0993-\\u09A8\\u09AA-\\u09B0\\u09B2\\u09B6-\\u09B9\\u09BC-\\u09C4\\u09C7\\u09C8\\u09CB-\\u09CE\\u09D7\\u09DC\\u09DD\\u09DF-\\u09E3\\u09E6-\\u09F1\\u0A01-\\u0A03\\u0A05-\\u0A0A\\u0A0F\\u0A10\\u0A13-\\u0A28\\u0A2A-\\u0A30\\u0A32\\u0A33\\u0A35\\u0A36\\u0A38\\u0A39\\u0A3C\\u0A3E-\\u0A42\\u0A47\\u0A48\\u0A4B-\\u0A4D\\u0A51\\u0A59-\\u0A5C\\u0A5E\\u0A66-\\u0A75\\u0A81-\\u0A83\\u0A85-\\u0A8D\\u0A8F-\\u0A91\\u0A93-\\u0AA8\\u0AAA-\\u0AB0\\u0AB2\\u0AB3\\u0AB5-\\u0AB9\\u0ABC-\\u0AC5\\u0AC7-\\u0AC9\\u0ACB-\\u0ACD\\u0AD0\\u0AE0-\\u0AE3\\u0AE6-\\u0AEF\\u0B01-\\u0B03\\u0B05-\\u0B0C\\u0B0F\\u0B10\\u0B13-\\u0B28\\u0B2A-\\u0B30\\u0B32\\u0B33\\u0B35-\\u0B39\\u0B3C-\\u0B44\\u0B47\\u0B48\\u0B4B-\\u0B4D\\u0B56\\u0B57\\u0B5C\\u0B5D\\u0B5F-\\u0B63\\u0B66-\\u0B6F\\u0B71\\u0B82\\u0B83\\u0B85-\\u0B8A\\u0B8E-\\u0B90\\u0B92-\\u0B95\\u0B99\\u0B9A\\u0B9C\\u0B9E\\u0B9F\\u0BA3\\u0BA4\\u0BA8-\\u0BAA\\u0BAE-\\u0BB9\\u0BBE-\\u0BC2\\u0BC6-\\u0BC8\\u0BCA-\\u0BCD\\u0BD0\\u0BD7\\u0BE6-\\u0BEF\\u0C00-\\u0C03\\u0C05-\\u0C0C\\u0C0E-\\u0C10\\u0C12-\\u0C28\\u0C2A-\\u0C39\\u0C3D-\\u0C44\\u0C46-\\u0C48\\u0C4A-\\u0C4D\\u0C55\\u0C56\\u0C58\\u0C59\\u0C60-\\u0C63\\u0C66-\\u0C6F\\u0C81-\\u0C83\\u0C85-\\u0C8C\\u0C8E-\\u0C90\\u0C92-\\u0CA8\\u0CAA-\\u0CB3\\u0CB5-\\u0CB9\\u0CBC-\\u0CC4\\u0CC6-\\u0CC8\\u0CCA-\\u0CCD\\u0CD5\\u0CD6\\u0CDE\\u0CE0-\\u0CE3\\u0CE6-\\u0CEF\\u0CF1\\u0CF2\\u0D01-\\u0D03\\u0D05-\\u0D0C\\u0D0E-\\u0D10\\u0D12-\\u0D3A\\u0D3D-\\u0D44\\u0D46-\\u0D48\\u0D4A-\\u0D4E\\u0D57\\u0D60-\\u0D63\\u0D66-\\u0D6F\\u0D7A-\\u0D7F\\u0D82\\u0D83\\u0D85-\\u0D96\\u0D9A-\\u0DB1\\u0DB3-\\u0DBB\\u0DBD\\u0DC0-\\u0DC6\\u0DCA\\u0DCF-\\u0DD4\\u0DD6\\u0DD8-\\u0DDF\\u0DE6-\\u0DEF\\u0DF2\\u0DF3\\u0E01-\\u0E3A\\u0E40-\\u0E4E\\u0E50-\\u0E59\\u0E81\\u0E82\\u0E84\\u0E87\\u0E88\\u0E8A\\u0E8D\\u0E94-\\u0E97\\u0E99-\\u0E9F\\u0EA1-\\u0EA3\\u0EA5\\u0EA7\\u0EAA\\u0EAB\\u0EAD-\\u0EB9\\u0EBB-\\u0EBD\\u0EC0-\\u0EC4\\u0EC6\\u0EC8-\\u0ECD\\u0ED0-\\u0ED9\\u0EDC-\\u0EDF\\u0F00\\u0F18\\u0F19\\u0F20-\\u0F29\\u0F35\\u0F37\\u0F39\\u0F3E-\\u0F47\\u0F49-\\u0F6C\\u0F71-\\u0F84\\u0F86-\\u0F97\\u0F99-\\u0FBC\\u0FC6\\u1000-\\u1049\\u1050-\\u109D\\u10A0-\\u10C5\\u10C7\\u10CD\\u10D0-\\u10FA\\u10FC-\\u1248\\u124A-\\u124D\\u1250-\\u1256\\u1258\\u125A-\\u125D\\u1260-\\u1288\\u128A-\\u128D\\u1290-\\u12B0\\u12B2-\\u12B5\\u12B8-\\u12BE\\u12C0\\u12C2-\\u12C5\\u12C8-\\u12D6\\u12D8-\\u1310\\u1312-\\u1315\\u1318-\\u135A\\u135D-\\u135F\\u1380-\\u138F\\u13A0-\\u13F4\\u1401-\\u166C\\u166F-\\u167F\\u1681-\\u169A\\u16A0-\\u16EA\\u16EE-\\u16F8\\u1700-\\u170C\\u170E-\\u1714\\u1720-\\u1734\\u1740-\\u1753\\u1760-\\u176C\\u176E-\\u1770\\u1772\\u1773\\u1780-\\u17D3\\u17D7\\u17DC\\u17DD\\u17E0-\\u17E9\\u180B-\\u180D\\u1810-\\u1819\\u1820-\\u1877\\u1880-\\u18AA\\u18B0-\\u18F5\\u1900-\\u191E\\u1920-\\u192B\\u1930-\\u193B\\u1946-\\u196D\\u1970-\\u1974\\u1980-\\u19AB\\u19B0-\\u19C9\\u19D0-\\u19D9\\u1A00-\\u1A1B\\u1A20-\\u1A5E\\u1A60-\\u1A7C\\u1A7F-\\u1A89\\u1A90-\\u1A99\\u1AA7\\u1AB0-\\u1ABD\\u1B00-\\u1B4B\\u1B50-\\u1B59\\u1B6B-\\u1B73\\u1B80-\\u1BF3\\u1C00-\\u1C37\\u1C40-\\u1C49\\u1C4D-\\u1C7D\\u1CD0-\\u1CD2\\u1CD4-\\u1CF6\\u1CF8\\u1CF9\\u1D00-\\u1DF5\\u1DFC-\\u1F15\\u1F18-\\u1F1D\\u1F20-\\u1F45\\u1F48-\\u1F4D\\u1F50-\\u1F57\\u1F59\\u1F5B\\u1F5D\\u1F5F-\\u1F7D\\u1F80-\\u1FB4\\u1FB6-\\u1FBC\\u1FBE\\u1FC2-\\u1FC4\\u1FC6-\\u1FCC\\u1FD0-\\u1FD3\\u1FD6-\\u1FDB\\u1FE0-\\u1FEC\\u1FF2-\\u1FF4\\u1FF6-\\u1FFC\\u200C\\u200D\\u203F\\u2040\\u2054\\u2071\\u207F\\u2090-\\u209C\\u20D0-\\u20DC\\u20E1\\u20E5-\\u20F0\\u2102\\u2107\\u210A-\\u2113\\u2115\\u2119-\\u211D\\u2124\\u2126\\u2128\\u212A-\\u212D\\u212F-\\u2139\\u213C-\\u213F\\u2145-\\u2149\\u214E\\u2160-\\u2188\\u2C00-\\u2C2E\\u2C30-\\u2C5E\\u2C60-\\u2CE4\\u2CEB-\\u2CF3\\u2D00-\\u2D25\\u2D27\\u2D2D\\u2D30-\\u2D67\\u2D6F\\u2D7F-\\u2D96\\u2DA0-\\u2DA6\\u2DA8-\\u2DAE\\u2DB0-\\u2DB6\\u2DB8-\\u2DBE\\u2DC0-\\u2DC6\\u2DC8-\\u2DCE\\u2DD0-\\u2DD6\\u2DD8-\\u2DDE\\u2DE0-\\u2DFF\\u2E2F\\u3005-\\u3007\\u3021-\\u302F\\u3031-\\u3035\\u3038-\\u303C\\u3041-\\u3096\\u3099\\u309A\\u309D-\\u309F\\u30A1-\\u30FA\\u30FC-\\u30FF\\u3105-\\u312D\\u3131-\\u318E\\u31A0-\\u31BA\\u31F0-\\u31FF\\u3400-\\u4DB5\\u4E00-\\u9FCC\\uA000-\\uA48C\\uA4D0-\\uA4FD\\uA500-\\uA60C\\uA610-\\uA62B\\uA640-\\uA66F\\uA674-\\uA67D\\uA67F-\\uA69D\\uA69F-\\uA6F1\\uA717-\\uA71F\\uA722-\\uA788\\uA78B-\\uA78E\\uA790-\\uA7AD\\uA7B0\\uA7B1\\uA7F7-\\uA827\\uA840-\\uA873\\uA880-\\uA8C4\\uA8D0-\\uA8D9\\uA8E0-\\uA8F7\\uA8FB\\uA900-\\uA92D\\uA930-\\uA953\\uA960-\\uA97C\\uA980-\\uA9C0\\uA9CF-\\uA9D9\\uA9E0-\\uA9FE\\uAA00-\\uAA36\\uAA40-\\uAA4D\\uAA50-\\uAA59\\uAA60-\\uAA76\\uAA7A-\\uAAC2\\uAADB-\\uAADD\\uAAE0-\\uAAEF\\uAAF2-\\uAAF6\\uAB01-\\uAB06\\uAB09-\\uAB0E\\uAB11-\\uAB16\\uAB20-\\uAB26\\uAB28-\\uAB2E\\uAB30-\\uAB5A\\uAB5C-\\uAB5F\\uAB64\\uAB65\\uABC0-\\uABEA\\uABEC\\uABED\\uABF0-\\uABF9\\uAC00-\\uD7A3\\uD7B0-\\uD7C6\\uD7CB-\\uD7FB\\uF900-\\uFA6D\\uFA70-\\uFAD9\\uFB00-\\uFB06\\uFB13-\\uFB17\\uFB1D-\\uFB28\\uFB2A-\\uFB36\\uFB38-\\uFB3C\\uFB3E\\uFB40\\uFB41\\uFB43\\uFB44\\uFB46-\\uFBB1\\uFBD3-\\uFD3D\\uFD50-\\uFD8F\\uFD92-\\uFDC7\\uFDF0-\\uFDFB\\uFE00-\\uFE0F\\uFE20-\\uFE2D\\uFE33\\uFE34\\uFE4D-\\uFE4F\\uFE70-\\uFE74\\uFE76-\\uFEFC\\uFF10-\\uFF19\\uFF21-\\uFF3A\\uFF3F\\uFF41-\\uFF5A\\uFF66-\\uFFBE\\uFFC2-\\uFFC7\\uFFCA-\\uFFCF\\uFFD2-\\uFFD7\\uFFDA-\\uFFDC]");
function sM(e, t) {
	/* istanbul ignore next */
	if (!e) throw Error("ASSERT: " + t);
}
function cM(e) {
	return e >= 48 && e <= 57;
}
function lM(e) {
	return "0123456789abcdefABCDEF".includes(e);
}
function uM(e) {
	return "01234567".includes(e);
}
function dM(e) {
	return e === 32 || e === 9 || e === 11 || e === 12 || e === 160 || e >= 5760 && [
		5760,
		6158,
		8192,
		8193,
		8194,
		8195,
		8196,
		8197,
		8198,
		8199,
		8200,
		8201,
		8202,
		8239,
		8287,
		12288,
		65279
	].includes(e);
}
function fM(e) {
	return e === 10 || e === 13 || e === 8232 || e === 8233;
}
function pM(e) {
	return e === 36 || e === 95 || e >= 65 && e <= 90 || e >= 97 && e <= 122 || e === 92 || e >= 128 && aM.test(String.fromCharCode(e));
}
function mM(e) {
	return e === 36 || e === 95 || e >= 65 && e <= 90 || e >= 97 && e <= 122 || e >= 48 && e <= 57 || e === 92 || e >= 128 && oM.test(String.fromCharCode(e));
}
var hM = {
	if: 1,
	in: 1,
	do: 1,
	var: 1,
	for: 1,
	new: 1,
	try: 1,
	let: 1,
	this: 1,
	else: 1,
	case: 1,
	void: 1,
	with: 1,
	enum: 1,
	while: 1,
	break: 1,
	catch: 1,
	throw: 1,
	const: 1,
	yield: 1,
	class: 1,
	super: 1,
	return: 1,
	typeof: 1,
	delete: 1,
	switch: 1,
	export: 1,
	import: 1,
	public: 1,
	static: 1,
	default: 1,
	finally: 1,
	extends: 1,
	package: 1,
	private: 1,
	function: 1,
	continue: 1,
	debugger: 1,
	interface: 1,
	protected: 1,
	instanceof: 1,
	implements: 1
};
function gM() {
	for (; W < Tj;) {
		let e = U.charCodeAt(W);
		if (dM(e) || fM(e)) ++W;
		else break;
	}
}
function _M(e) {
	var t, n, r, i = 0;
	for (n = e === "u" ? 4 : 2, t = 0; t < n; ++t) W < Tj && lM(U[W]) ? (r = U[W++], i = i * 16 + "0123456789abcdef".indexOf(r.toLowerCase())) : GM({}, qj, rM);
	return String.fromCharCode(i);
}
function vM() {
	var e = U[W], t = 0, n, r;
	for (e === "}" && GM({}, qj, rM); W < Tj && (e = U[W++], lM(e));) t = t * 16 + "0123456789abcdef".indexOf(e.toLowerCase());
	return (t > 1114111 || e !== "}") && GM({}, qj, rM), t <= 65535 ? String.fromCharCode(t) : (n = (t - 65536 >> 10) + 55296, r = (t - 65536 & 1023) + 56320, String.fromCharCode(n, r));
}
function yM() {
	var e = U.charCodeAt(W++), t = String.fromCharCode(e);
	for (e === 92 && (U.charCodeAt(W) !== 117 && GM({}, qj, rM), ++W, e = _M("u"), (!e || e === "\\" || !pM(e.charCodeAt(0))) && GM({}, qj, rM), t = e); W < Tj && (e = U.charCodeAt(W), mM(e));) ++W, t += String.fromCharCode(e), e === 92 && (t = t.substr(0, t.length - 1), U.charCodeAt(W) !== 117 && GM({}, qj, rM), ++W, e = _M("u"), (!e || e === "\\" || !mM(e.charCodeAt(0))) && GM({}, qj, rM), t += e);
	return t;
}
function bM() {
	for (var e = W++, t; W < Tj;) {
		if (t = U.charCodeAt(W), t === 92) return W = e, yM();
		if (mM(t)) ++W;
		else break;
	}
	return U.slice(e, W);
}
function xM() {
	var e = W, t = U.charCodeAt(W) === 92 ? yM() : bM();
	return {
		type: t.length === 1 ? kj : hM.hasOwnProperty(t) ? Aj : t === "null" ? jj : t === "true" || t === "false" ? Dj : kj,
		value: t,
		start: e,
		end: W
	};
}
function SM() {
	var e = W, t = U.charCodeAt(W), n, r = U[W], i, a, o;
	switch (t) {
		case 46:
		case 40:
		case 41:
		case 59:
		case 44:
		case 123:
		case 125:
		case 91:
		case 93:
		case 58:
		case 63:
		case 126: return ++W, {
			type: Nj,
			value: String.fromCharCode(t),
			start: e,
			end: W
		};
		default: if (n = U.charCodeAt(W + 1), n === 61) switch (t) {
			case 43:
			case 45:
			case 47:
			case 60:
			case 62:
			case 94:
			case 124:
			case 37:
			case 38:
			case 42: return W += 2, {
				type: Nj,
				value: String.fromCharCode(t) + String.fromCharCode(n),
				start: e,
				end: W
			};
			case 33:
			case 61: return W += 2, U.charCodeAt(W) === 61 && ++W, {
				type: Nj,
				value: U.slice(e, W),
				start: e,
				end: W
			};
		}
	}
	if (o = U.substr(W, 4), o === ">>>=") return W += 4, {
		type: Nj,
		value: o,
		start: e,
		end: W
	};
	if (a = o.substr(0, 3), a === ">>>" || a === "<<=" || a === ">>=") return W += 3, {
		type: Nj,
		value: a,
		start: e,
		end: W
	};
	if (i = a.substr(0, 2), r === i[1] && "+-<>&|".includes(r) || i === "=>") return W += 2, {
		type: Nj,
		value: i,
		start: e,
		end: W
	};
	if (i === "//" && GM({}, qj, rM), "<>=!+-*%&|^/".includes(r)) return ++W, {
		type: Nj,
		value: r,
		start: e,
		end: W
	};
	GM({}, qj, rM);
}
function CM(e) {
	let t = "";
	for (; W < Tj && lM(U[W]);) t += U[W++];
	return t.length === 0 && GM({}, qj, rM), pM(U.charCodeAt(W)) && GM({}, qj, rM), {
		type: Mj,
		value: parseInt("0x" + t, 16),
		start: e,
		end: W
	};
}
function wM(e) {
	let t = "0" + U[W++];
	for (; W < Tj && uM(U[W]);) t += U[W++];
	return (pM(U.charCodeAt(W)) || cM(U.charCodeAt(W))) && GM({}, qj, rM), {
		type: Mj,
		value: parseInt(t, 8),
		octal: !0,
		start: e,
		end: W
	};
}
function TM() {
	var e, t, n = U[W];
	if (sM(cM(n.charCodeAt(0)) || n === ".", "Numeric literal must start with a decimal digit or a decimal point"), t = W, e = "", n !== ".") {
		if (e = U[W++], n = U[W], e === "0") {
			if (n === "x" || n === "X") return ++W, CM(t);
			if (uM(n)) return wM(t);
			n && cM(n.charCodeAt(0)) && GM({}, qj, rM);
		}
		for (; cM(U.charCodeAt(W));) e += U[W++];
		n = U[W];
	}
	if (n === ".") {
		for (e += U[W++]; cM(U.charCodeAt(W));) e += U[W++];
		n = U[W];
	}
	if (n === "e" || n === "E") if (e += U[W++], n = U[W], (n === "+" || n === "-") && (e += U[W++]), cM(U.charCodeAt(W))) for (; cM(U.charCodeAt(W));) e += U[W++];
	else GM({}, qj, rM);
	return pM(U.charCodeAt(W)) && GM({}, qj, rM), {
		type: Mj,
		value: parseFloat(e),
		start: t,
		end: W
	};
}
function EM() {
	var e = "", t, n, r, i, a = !1;
	for (t = U[W], sM(t === "'" || t === "\"", "String literal must starts with a quote"), n = W, ++W; W < Tj;) if (r = U[W++], r === t) {
		t = "";
		break;
	} else if (r === "\\") if (r = U[W++], !r || !fM(r.charCodeAt(0))) switch (r) {
		case "u":
		case "x":
			U[W] === "{" ? (++W, e += vM()) : e += _M(r);
			break;
		case "n":
			e += "\n";
			break;
		case "r":
			e += "\r";
			break;
		case "t":
			e += "	";
			break;
		case "b":
			e += "\b";
			break;
		case "f":
			e += "\f";
			break;
		case "v":
			e += "\v";
			break;
		default:
			uM(r) ? (i = "01234567".indexOf(r), i !== 0 && (a = !0), W < Tj && uM(U[W]) && (a = !0, i = i * 8 + "01234567".indexOf(U[W++]), "0123".includes(r) && W < Tj && uM(U[W]) && (i = i * 8 + "01234567".indexOf(U[W++]))), e += String.fromCharCode(i)) : e += r;
			break;
	}
	else r === "\r" && U[W] === "\n" && ++W;
	else if (fM(r.charCodeAt(0))) break;
	else e += r;
	return t !== "" && GM({}, qj, rM), {
		type: Pj,
		value: e,
		octal: a,
		start: n,
		end: W
	};
}
function DM(e, t) {
	let n = e;
	t.includes("u") && (n = n.replace(/\\u\{([0-9a-fA-F]+)\}/g, (e, t) => {
		if (parseInt(t, 16) <= 1114111) return "x";
		GM({}, $j);
	}).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "x"));
	try {
		new RegExp(n);
	} catch {
		GM({}, $j);
	}
	try {
		return new RegExp(e, t);
	} catch {
		return null;
	}
}
function OM() {
	var e = U[W], t, n, r, i;
	for (sM(e === "/", "Regular expression literal must start with a slash"), t = U[W++], n = !1, r = !1; W < Tj;) if (e = U[W++], t += e, e === "\\") e = U[W++], fM(e.charCodeAt(0)) && GM({}, eM), t += e;
	else if (fM(e.charCodeAt(0))) GM({}, eM);
	else if (n) e === "]" && (n = !1);
	else if (e === "/") {
		r = !0;
		break;
	} else e === "[" && (n = !0);
	return r || GM({}, eM), i = t.substr(1, t.length - 2), {
		value: i,
		literal: t
	};
}
function kM() {
	for (var e, t = "", n = ""; W < Tj && (e = U[W], mM(e.charCodeAt(0)));) ++W, e === "\\" && W < Tj ? GM({}, qj, rM) : (n += e, t += e);
	return n.search(/[^gimuy]/g) >= 0 && GM({}, $j, n), {
		value: n,
		literal: t
	};
}
function AM() {
	var e, t, n, r;
	return Ej = null, gM(), e = W, t = OM(), n = kM(), r = DM(t.value, n.value), {
		literal: t.literal + n.literal,
		value: r,
		regex: {
			pattern: t.value,
			flags: n.value
		},
		start: e,
		end: W
	};
}
function jM(e) {
	return e.type === kj || e.type === Aj || e.type === Dj || e.type === jj;
}
function MM() {
	if (gM(), W >= Tj) return {
		type: Oj,
		start: W,
		end: W
	};
	let e = U.charCodeAt(W);
	return pM(e) ? xM() : e === 40 || e === 41 || e === 59 ? SM() : e === 39 || e === 34 ? EM() : e === 46 ? cM(U.charCodeAt(W + 1)) ? TM() : SM() : cM(e) ? TM() : SM();
}
function NM() {
	let e = Ej;
	return W = e.end, Ej = MM(), W = e.end, e;
}
function PM() {
	let e = W;
	Ej = MM(), W = e;
}
function FM(e) {
	let t = new Sj(Ij);
	return t.elements = e, t;
}
function IM(e, t, n) {
	let r = new Sj(e === "||" || e === "&&" ? Hj : Lj);
	return r.operator = e, r.left = t, r.right = n, r;
}
function LM(e, t) {
	let n = new Sj(Rj);
	return n.callee = e, n.arguments = t, n;
}
function RM(e, t, n) {
	let r = new Sj(zj);
	return r.test = e, r.consequent = t, r.alternate = n, r;
}
function zM(e) {
	let t = new Sj(Bj);
	return t.name = e, t;
}
function BM(e) {
	let t = new Sj(Vj);
	return t.value = e.value, t.raw = U.slice(e.start, e.end), e.regex && (t.raw === "//" && (t.raw = "/(?:)/"), t.regex = e.regex), t;
}
function VM(e, t, n) {
	let r = new Sj(Uj);
	return r.computed = e === "[", r.object = t, r.property = n, r.computed || (n.member = !0), r;
}
function HM(e) {
	let t = new Sj(Wj);
	return t.properties = e, t;
}
function UM(e, t, n) {
	let r = new Sj(Gj);
	return r.key = t, r.value = n, r.kind = e, r;
}
function WM(e, t) {
	let n = new Sj(Kj);
	return n.operator = e, n.argument = t, n.prefix = !0, n;
}
function GM(e, t) {
	var n, r = Array.prototype.slice.call(arguments, 2), i = t.replace(/%(\d)/g, (e, t) => (sM(t < r.length, "Message reference must be in range"), r[t]));
	throw n = Error(i), n.index = W, n.description = i, n;
}
function KM(e) {
	e.type === Oj && GM(e, Qj), e.type === Mj && GM(e, Jj), e.type === Pj && GM(e, Yj), e.type === kj && GM(e, Xj), e.type === Aj && GM(e, Zj), GM(e, qj, e.value);
}
function qM(e) {
	let t = NM();
	(t.type !== Nj || t.value !== e) && KM(t);
}
function JM(e) {
	return Ej.type === Nj && Ej.value === e;
}
function YM(e) {
	return Ej.type === Aj && Ej.value === e;
}
function XM() {
	let e = [];
	for (W = Ej.start, qM("["); !JM("]");) JM(",") ? (NM(), e.push(null)) : (e.push(fN()), JM("]") || qM(","));
	return NM(), FM(e);
}
function ZM() {
	W = Ej.start;
	let e = NM();
	return e.type === Pj || e.type === Mj ? (e.octal && GM(e, tM), BM(e)) : zM(e.value);
}
function QM() {
	var e, t, n, r;
	if (W = Ej.start, e = Ej, e.type === kj) return n = ZM(), qM(":"), r = fN(), UM("init", n, r);
	if (e.type === Oj || e.type === Nj) KM(e);
	else return t = ZM(), qM(":"), r = fN(), UM("init", t, r);
}
function $M() {
	var e = [], t, n, r, i = {}, a = String;
	for (W = Ej.start, qM("{"); !JM("}");) t = QM(), n = t.key.type === Bj ? t.key.name : a(t.key.value), r = "$" + n, Object.prototype.hasOwnProperty.call(i, r) ? GM({}, nM) : i[r] = !0, e.push(t), JM("}") || qM(",");
	return qM("}"), HM(e);
}
function eN() {
	qM("(");
	let e = pN();
	return qM(")"), e;
}
var tN = { if: 1 };
function nN() {
	var e, t, n;
	if (JM("(")) return eN();
	if (JM("[")) return XM();
	if (JM("{")) return $M();
	if (e = Ej.type, W = Ej.start, e === kj || tN[Ej.value]) n = zM(NM().value);
	else if (e === Pj || e === Mj) Ej.octal && GM(Ej, tM), n = BM(NM());
	else if (e === Aj) throw Error(iM);
	else e === Dj ? (t = NM(), t.value = t.value === "true", n = BM(t)) : e === jj ? (t = NM(), t.value = null, n = BM(t)) : JM("/") || JM("/=") ? (n = BM(AM()), PM()) : KM(NM());
	return n;
}
function rN() {
	let e = [];
	if (qM("("), !JM(")")) for (; W < Tj && (e.push(fN()), !JM(")"));) qM(",");
	return qM(")"), e;
}
function iN() {
	W = Ej.start;
	let e = NM();
	return jM(e) || KM(e), zM(e.value);
}
function aN() {
	return qM("."), iN();
}
function oN() {
	qM("[");
	let e = pN();
	return qM("]"), e;
}
function sN() {
	for (var e = nN(), t, n;;) if (JM(".")) n = aN(), e = VM(".", e, n);
	else if (JM("(")) t = rN(), e = LM(e, t);
	else if (JM("[")) n = oN(), e = VM("[", e, n);
	else break;
	return e;
}
function cN() {
	let e = sN();
	if (Ej.type === Nj && (JM("++") || JM("--"))) throw Error(iM);
	return e;
}
function lN() {
	var e, t;
	if (Ej.type !== Nj && Ej.type !== Aj) t = cN();
	else if (JM("++") || JM("--")) throw Error(iM);
	else if (JM("+") || JM("-") || JM("~") || JM("!")) e = NM(), t = lN(), t = WM(e.value, t);
	else if (YM("delete") || YM("void") || YM("typeof")) throw Error(iM);
	else t = cN();
	return t;
}
function uN(e) {
	let t = 0;
	if (e.type !== Nj && e.type !== Aj) return 0;
	switch (e.value) {
		case "||":
			t = 1;
			break;
		case "&&":
			t = 2;
			break;
		case "|":
			t = 3;
			break;
		case "^":
			t = 4;
			break;
		case "&":
			t = 5;
			break;
		case "==":
		case "!=":
		case "===":
		case "!==":
			t = 6;
			break;
		case "<":
		case ">":
		case "<=":
		case ">=":
		case "instanceof":
		case "in":
			t = 7;
			break;
		case "<<":
		case ">>":
		case ">>>":
			t = 8;
			break;
		case "+":
		case "-":
			t = 9;
			break;
		case "*":
		case "/":
		case "%":
			t = 11;
			break;
	}
	return t;
}
function dN() {
	var e = Ej, t, n, r, i, a, o, s, c = lN(), l;
	if (r = Ej, i = uN(r), i === 0) return c;
	for (r.prec = i, NM(), t = [e, Ej], o = lN(), a = [
		c,
		r,
		o
	]; (i = uN(Ej)) > 0;) {
		for (; a.length > 2 && i <= a[a.length - 2].prec;) o = a.pop(), s = a.pop().value, c = a.pop(), t.pop(), n = IM(s, c, o), a.push(n);
		r = NM(), r.prec = i, a.push(r), t.push(Ej), n = lN(), a.push(n);
	}
	for (l = a.length - 1, n = a[l], t.pop(); l > 1;) t.pop(), n = IM(a[l - 1].value, a[l - 2], n), l -= 2;
	return n;
}
function fN() {
	var e = dN(), t, n;
	return JM("?") && (NM(), t = fN(), qM(":"), n = fN(), e = RM(e, t, n)), e;
}
function pN() {
	let e = fN();
	if (JM(",")) throw Error(iM);
	return e;
}
function mN(e) {
	U = e, W = 0, Tj = U.length, Ej = null, PM();
	let t = pN();
	if (Ej.type !== Oj) throw Error("Unexpect token after expression.");
	return t;
}
var hN = {
	NaN: "NaN",
	E: "Math.E",
	LN2: "Math.LN2",
	LN10: "Math.LN10",
	LOG2E: "Math.LOG2E",
	LOG10E: "Math.LOG10E",
	PI: "Math.PI",
	SQRT1_2: "Math.SQRT1_2",
	SQRT2: "Math.SQRT2",
	MIN_VALUE: "Number.MIN_VALUE",
	MAX_VALUE: "Number.MAX_VALUE"
};
function gN(e) {
	function t(t, n, r, i) {
		let a = e(n[0]);
		return r && (a = r + "(" + a + ")", r.lastIndexOf("new ", 0) === 0 && (a = "(" + a + ")")), a + "." + t + (i < 0 ? "" : i === 0 ? "()" : "(" + n.slice(1).map(e).join(",") + ")");
	}
	function n(e, n, r) {
		return (i) => t(e, i, n, r);
	}
	let r = "new Date", i = "String", a = "RegExp";
	return {
		isNaN: "Number.isNaN",
		isFinite: "Number.isFinite",
		abs: "Math.abs",
		acos: "Math.acos",
		asin: "Math.asin",
		atan: "Math.atan",
		atan2: "Math.atan2",
		ceil: "Math.ceil",
		cos: "Math.cos",
		exp: "Math.exp",
		floor: "Math.floor",
		hypot: "Math.hypot",
		log: "Math.log",
		max: "Math.max",
		min: "Math.min",
		pow: "Math.pow",
		random: "Math.random",
		round: "Math.round",
		sin: "Math.sin",
		sqrt: "Math.sqrt",
		tan: "Math.tan",
		clamp: function(t) {
			t.length < 3 && N("Missing arguments to clamp function."), t.length > 3 && N("Too many arguments to clamp function.");
			let n = t.map(e);
			return "Math.max(" + n[1] + ", Math.min(" + n[2] + "," + n[0] + "))";
		},
		now: "Date.now",
		utc: "Date.UTC",
		datetime: r,
		date: n("getDate", r, 0),
		day: n("getDay", r, 0),
		year: n("getFullYear", r, 0),
		month: n("getMonth", r, 0),
		hours: n("getHours", r, 0),
		minutes: n("getMinutes", r, 0),
		seconds: n("getSeconds", r, 0),
		milliseconds: n("getMilliseconds", r, 0),
		time: n("getTime", r, 0),
		timezoneoffset: n("getTimezoneOffset", r, 0),
		utcdate: n("getUTCDate", r, 0),
		utcday: n("getUTCDay", r, 0),
		utcyear: n("getUTCFullYear", r, 0),
		utcmonth: n("getUTCMonth", r, 0),
		utchours: n("getUTCHours", r, 0),
		utcminutes: n("getUTCMinutes", r, 0),
		utcseconds: n("getUTCSeconds", r, 0),
		utcmilliseconds: n("getUTCMilliseconds", r, 0),
		length: n("length", null, -1),
		parseFloat: "parseFloat",
		parseInt: "parseInt",
		upper: n("toUpperCase", i, 0),
		lower: n("toLowerCase", i, 0),
		substring: n("substring", i),
		split: n("split", i),
		trim: n("trim", i, 0),
		btoa: "btoa",
		atob: "atob",
		regexp: a,
		test: n("test", a),
		if: function(t) {
			t.length < 3 && N("Missing arguments to if function."), t.length > 3 && N("Too many arguments to if function.");
			let n = t.map(e);
			return "(" + n[0] + "?" + n[1] + ":" + n[2] + ")";
		}
	};
}
function _N(e) {
	let t = e && e.length - 1;
	return t && (e[0] === "\"" && e[t] === "\"" || e[0] === "'" && e[t] === "'") ? e.slice(1, -1) : e;
}
function vN(e) {
	e = e || {};
	let t = e.allowed ? _d(e.allowed) : {}, n = e.forbidden ? _d(e.forbidden) : {}, r = e.constants || hN, i = (e.functions || gN)(d), a = e.globalvar, o = e.fieldvar, s = Ru(a) ? a : (e) => `${a}["${e}"]`;
	new Set([...Object.getOwnPropertyNames(Object.prototype).filter((e) => typeof Object.prototype[e] == "function"), "__proto__"]);
	let c = {}, l = {}, u = 0;
	function d(e) {
		if (z(e)) return e;
		let t = f[e.type];
		return t == null && N("Unsupported type: " + e.type), t(e);
	}
	let f = {
		Literal: (e) => e.raw,
		Identifier: (e) => {
			let i = e.name;
			return u > 0 ? i : L(n, i) ? N("Illegal identifier: " + i) : L(r, i) ? r[i] : L(t, i) ? i : (c[i] = 1, s(i));
		},
		MemberExpression: (e) => {
			let t = !e.computed, n = d(e.object);
			t && (u += 1);
			let r = d(e.property);
			return n === o && (l[_N(r)] = 1), t && --u, n + (t ? "." + r : "[" + r + "]");
		},
		CallExpression: (e) => {
			e.callee.type !== "Identifier" && N("Illegal callee type: " + e.callee.type);
			let t = e.callee.name, n = e.arguments, r = L(i, t) && i[t];
			return r || N("Unrecognized function: " + t), Ru(r) ? r(n) : r + "(" + n.map(d).join(",") + ")";
		},
		ArrayExpression: (e) => "[" + e.elements.map(d).join(",") + "]",
		BinaryExpression: (e) => "(" + d(e.left) + " " + e.operator + " " + d(e.right) + ")",
		UnaryExpression: (e) => "(" + e.operator + d(e.argument) + ")",
		ConditionalExpression: (e) => "(" + d(e.test) + "?" + d(e.consequent) + ":" + d(e.alternate) + ")",
		LogicalExpression: (e) => "(" + d(e.left) + e.operator + d(e.right) + ")",
		ObjectExpression: (e) => {
			for (let t of e.properties) {
				let e = t.key.name;
				du.has(e) && N("Illegal property: " + e);
			}
			return "{" + e.properties.map(d).join(",") + "}";
		},
		Property: (e) => {
			u += 1;
			let t = d(e.key);
			return --u, t + ":" + d(e.value);
		}
	};
	function p(e) {
		let t = {
			code: d(e),
			globals: Object.keys(c),
			fields: Object.keys(l)
		};
		return c = {}, l = {}, t;
	}
	return p.functions = i, p.constants = r, p;
}
//#endregion
//#region ../../node_modules/.pnpm/vega-selections@6.1.0/node_modules/vega-selections/build/vega-selection.js
var yN = Symbol("vega_selection_getter");
function bN(e) {
	return (!e.getter || !e.getter[yN]) && (e.getter = iu(e.field), e.getter[yN] = !0), e.getter;
}
var xN = "intersect", SN = "union", CN = "vlMulti", wN = "vlPoint", TN = "or", EN = "and", DN = "_vgsid_", ON = iu(DN), kN = "E", AN = "R", jN = "R-E", MN = "R-LE", NN = "R-RE", PN = "E-LT", FN = "E-LTE", IN = "E-GT", LN = "E-GTE", RN = "E-VALID", zN = "E-ONE", BN = "index:unit";
function VN(e, t) {
	for (var n = t.fields, r = t.values, i = n.length, a = 0, o, s; a < i; ++a) if (s = n[a], o = bN(s)(e), td(o) && (o = yu(o)), td(r[a]) && (r[a] = yu(r[a])), P(r[a]) && td(r[a][0]) && (r[a] = r[a].map(yu)), s.type === kN) {
		if (P(r[a]) ? !r[a].includes(o) : o !== r[a]) return !1;
	} else if (s.type === AN) {
		if (!$u(o, r[a])) return !1;
	} else if (s.type === NN) {
		if (!$u(o, r[a], !0, !1)) return !1;
	} else if (s.type === jN) {
		if (!$u(o, r[a], !1, !1)) return !1;
	} else if (s.type === MN) {
		if (!$u(o, r[a], !1, !0)) return !1;
	} else if (s.type === PN) {
		if (o >= r[a]) return !1;
	} else if (s.type === FN) {
		if (o > r[a]) return !1;
	} else if (s.type === IN) {
		if (o <= r[a]) return !1;
	} else if (s.type === LN) {
		if (o < r[a]) return !1;
	} else if (s.type === RN) {
		if (o === null || isNaN(o)) return !1;
	} else if (s.type === zN && r[a].indexOf(o) === -1) return !1;
	return !0;
}
function HN(e, t, n) {
	for (var r = this.context.data[e], i = r ? r.values.value : [], a = r ? r[BN] && r[BN].value : void 0, o = n === xN, s = i.length, c = 0, l, u, d, f, p; c < s; ++c) if (l = i[c], a && o) {
		if (u = u || {}, d = u[f = l.unit] || 0, d === -1) continue;
		if (p = VN(t, l), u[f] = p ? -1 : ++d, p && a.size === 1) return !0;
		if (!p && d === a.get(f).count) return !1;
	} else if (p = VN(t, l), o ^ p) return p;
	return s && o;
}
var UN = v(ON), WN = UN.left, GN = UN.right;
function KN(e, t, n) {
	let r = this.context.data[e], i = r ? r.values.value : [], a = r ? r[BN] && r[BN].value : void 0, o = n === xN, s = ON(t), c = WN(i, s);
	if (c === i.length || ON(i[c]) !== s) return !1;
	if (a && o) {
		if (a.size === 1) return !0;
		if (GN(i, s) - c < a.size) return !1;
	}
	return !0;
}
function qN(e, t) {
	return e.map((e) => qu(t.fields ? { values: t.fields.map((t) => bN(t)(e.datum)) } : { [DN]: ON(e.datum) }, t));
}
function JN(e, t, n, r) {
	for (var i = this.context.data[e], a = i ? i.values.value : [], o = {}, s = {}, c = {}, l, u, d, f, p, m, h, g, _, v, y = a.length, b = 0, x, S; b < y; ++b) if (l = a[b], f = l.unit, u = l.fields, d = l.values, u && d) {
		for (x = 0, S = u.length; x < S; ++x) p = u[x], h = o[p.field] || (o[p.field] = {}), g = h[f] || (h[f] = []), c[p.field] = _ = p.type.charAt(0), v = YN[`${_}_union`], h[f] = v(g, I(d[x]));
		n && (g = s[f] || (s[f] = []), g.push(I(d).reduce((e, t, n) => (e[u[n].field] = t, e), {})));
	} else p = DN, m = ON(l), h = o[p] || (o[p] = {}), g = h[f] || (h[f] = []), g.push(m), n && (g = s[f] || (s[f] = []), g.push({ [DN]: m }));
	if (t = t || SN, o[DN] ? o[DN] = YN[`${DN}_${t}`](...Object.values(o[DN])) : Object.keys(o).forEach((e) => {
		o[e] = Object.keys(o[e]).map((t) => o[e][t]).reduce((n, r) => n === void 0 ? r : YN[`${c[e]}_${t}`](n, r));
	}), a = Object.keys(s), n && a.length) {
		let e = r ? wN : CN;
		o[e] = t === SN ? { [TN]: a.reduce((e, t) => (e.push(...s[t]), e), []) } : { [EN]: a.map((e) => ({ [TN]: s[e] })) };
	}
	return o;
}
var YN = {
	[`${DN}_union`]: Lt,
	[`${DN}_intersect`]: Ft,
	E_union: function(e, t) {
		if (!e.length) return t;
		for (var n = 0, r = t.length; n < r; ++n) e.includes(t[n]) || e.push(t[n]);
		return e;
	},
	E_intersect: function(e, t) {
		return e.length ? e.filter((e) => t.includes(e)) : t;
	},
	R_union: function(e, t) {
		var n = yu(t[0]), r = yu(t[1]);
		return n > r && (n = t[1], r = t[0]), e.length ? (e[0] > n && (e[0] = n), e[1] < r && (e[1] = r), e) : [n, r];
	},
	R_intersect: function(e, t) {
		var n = yu(t[0]), r = yu(t[1]);
		return n > r && (n = t[1], r = t[0]), e.length ? r < e[0] || e[1] < n ? [] : (e[0] < n && (e[0] = n), e[1] > r && (e[1] = r), e) : [n, r];
	}
}, XN = ":", ZN = "@";
function QN(e, t, n, r) {
	t[0].type !== "Literal" && N("First argument to selection functions must be a string literal.");
	let i = t[0].value, a = t.length >= 2 && vu(t).value, o = "unit", s = ZN + o, c = XN + i;
	a === xN && !L(r, s) && (r[s] = n.getData(i).indataRef(n, o)), L(r, c) || (r[c] = n.getData(i).tuplesRef());
}
//#endregion
//#region ../../node_modules/.pnpm/vega-functions@6.1.0/node_modules/vega-functions/build/vega-functions.js
function $N(e) {
	let t = this.context.data[e];
	return t ? t.values.value : [];
}
function eP(e, t, n) {
	let r = this.context.data[e]["index:" + t], i = r ? r.value.get(n) : void 0;
	return i && i.count;
}
function tP(e, t) {
	let n = this.context.dataflow, r = this.context.data[e].input;
	return n.pulse(r, n.changeset().remove(lu).insert(t)), 1;
}
function nP(e, t, n) {
	if (e) {
		let n = this.context.dataflow, r = e.mark.source;
		n.pulse(r, n.changeset().encode(e, t));
	}
	return n === void 0 ? e : n;
}
var rP = (e) => function(t, n) {
	let r = this.context.dataflow.locale();
	return t === null ? "null" : r[e](n)(t);
}, iP = rP("format"), aP = rP("timeFormat"), oP = rP("utcFormat"), sP = rP("timeParse"), cP = rP("utcParse"), lP = new Date(2e3, 0, 1);
function uP(e, t, n) {
	return !Number.isInteger(e) || !Number.isInteger(t) ? "" : (lP.setYear(2e3), lP.setMonth(e), lP.setDate(t), aP.call(this, lP, n));
}
function dP(e) {
	return uP.call(this, e, 1, "%B");
}
function fP(e) {
	return uP.call(this, e, 1, "%b");
}
function pP(e) {
	return uP.call(this, 0, 2 + e, "%A");
}
function mP(e) {
	return uP.call(this, 0, 2 + e, "%a");
}
function hP(e, t, n, r) {
	t[0].type !== "Literal" && N("First argument to data functions must be a string literal.");
	let i = t[0].value, a = ":" + i;
	if (!L(a, r)) try {
		r[a] = n.getData(i).tuplesRef();
	} catch {}
}
function gP(e, t, n, r) {
	t[0].type !== "Literal" && N("First argument to indata must be a string literal."), t[1].type !== "Literal" && N("Second argument to indata must be a string literal.");
	let i = t[0].value, a = t[1].value, o = "@" + a;
	L(o, r) || (r[o] = n.getData(i).indataRef(n, a));
}
function _P(e, t, n, r) {
	if (t[0].type === "Literal") vP(n, r, t[0].value);
	else for (e in n.scales) vP(n, r, e);
}
function vP(e, t, n) {
	let r = "%" + n;
	if (!L(t, r)) try {
		t[r] = e.scaleRef(n);
	} catch {}
}
function yP(e, t) {
	if (z(e)) {
		let n = t.scales[e];
		return n && xv(n.value) ? n.value : void 0;
	} else if (Ru(e)) return xv(e) ? e : void 0;
}
function bP(e, t, n) {
	t.__bandwidth = (e) => e && e.bandwidth ? e.bandwidth() : 0, n._bandwidth = _P, n._range = _P, n._scale = _P;
	let r = (t) => "_[" + (t.type === "Literal" ? B("%" + t.value) : B("%") + "+" + e(t)) + "]";
	return {
		_bandwidth: (e) => `this.__bandwidth(${r(e[0])})`,
		_range: (e) => `${r(e[0])}.range()`,
		_scale: (t) => `${r(t[0])}(${e(t[1])})`
	};
}
function xP(e, t) {
	return function(n, r, i) {
		if (n) {
			let t = yP(n, (i || this).context);
			return t && t.path[e](r);
		} else return t(r);
	};
}
var SP = xP("area", di), CP = xP("bounds", Bi), wP = xP("centroid", ma);
function TP(e, t) {
	let n = yP(e, (t || this).context);
	return n && n.scale();
}
function EP(e) {
	let t = this.context.group, n = !1;
	if (t) for (; e;) {
		if (e === t) {
			n = !0;
			break;
		}
		e = e.mark.group;
	}
	return n;
}
function DP(e, t, n) {
	try {
		e[t].apply(e, ["EXPRESSION"].concat([].slice.call(n)));
	} catch (t) {
		e.warn(t);
	}
	return n[n.length - 1];
}
function OP() {
	return DP(this.context.dataflow, "warn", arguments);
}
function kP() {
	return DP(this.context.dataflow, "info", arguments);
}
function AP() {
	return DP(this.context.dataflow, "debug", arguments);
}
function jP(e) {
	let t = e / 255;
	return t <= .03928 ? t / 12.92 : ((t + .055) / 1.055) ** 2.4;
}
function MP(e) {
	let t = Ke(e), n = jP(t.r), r = jP(t.g), i = jP(t.b);
	return .2126 * n + .7152 * r + .0722 * i;
}
function NP(e, t) {
	let n = MP(e), r = MP(t), i = Math.max(n, r), a = Math.min(n, r);
	return (i + .05) / (a + .05);
}
function PP() {
	let e = [].slice.call(arguments);
	return e.unshift({}), qu(...e);
}
function FP(e, t) {
	return e === t || e !== e && t !== t ? !0 : P(e) ? P(t) && e.length === t.length ? IP(e, t) : !1 : F(e) && F(t) ? LP(e, t) : !1;
}
function IP(e, t) {
	for (let n = 0, r = e.length; n < r; ++n) if (!FP(e[n], t[n])) return !1;
	return !0;
}
function LP(e, t) {
	for (let n in e) if (!FP(e[n], t[n])) return !1;
	return !0;
}
function RP(e) {
	return (t) => LP(e, t);
}
function zP(e, t, n, r, i, a) {
	let o = this.context.dataflow, s = this.context.data[e], c = s.input, l = o.stamp(), u = s.changes, d, f;
	if (o._trigger === !1 || !(c.value.length || t || r)) return 0;
	if ((!u || u.stamp < l) && (s.changes = u = o.changeset(), u.stamp = l, o.runAfter(() => {
		s.modified = !0, o.pulse(c, u).run();
	}, !0, 1)), n && (d = n === !0 ? lu : P(n) || Ip(n) ? n : RP(n), u.remove(d)), t && u.insert(t), r && (d = RP(r), c.value.some(d) ? u.remove(d) : u.insert(r)), i) for (f in a) u.modify(i, f, a[f]);
	return 1;
}
function BP(e) {
	let t = e.touches, n = t[0].clientX - t[1].clientX, r = t[0].clientY - t[1].clientY;
	return Math.hypot(n, r);
}
function VP(e) {
	let t = e.touches;
	return Math.atan2(t[0].clientY - t[1].clientY, t[0].clientX - t[1].clientX);
}
var HP = {};
function UP(e, t) {
	let n = HP[t] || (HP[t] = iu(t));
	return P(e) ? e.map(n) : n(e);
}
function WP(e) {
	return P(e) || ArrayBuffer.isView(e) ? e : null;
}
function GP(e) {
	return WP(e) || (z(e) ? e : null);
}
function KP(e, ...t) {
	return WP(e).join(...t);
}
function qP(e, ...t) {
	return GP(e).indexOf(...t);
}
function JP(e, ...t) {
	return GP(e).lastIndexOf(...t);
}
function YP(e, ...t) {
	return GP(e).slice(...t);
}
function XP(e, t, n) {
	return Ru(n) && N("Function argument passed to replace."), !z(t) && !id(t) && N("Please pass a string or RegExp argument to replace."), String(e).replace(t, n);
}
function ZP(e) {
	return WP(e).slice().reverse();
}
function QP(e) {
	return WP(e).slice().sort(Vu);
}
function $P(e, t, n) {
	return U_(e || 0, t || 0, n || 0);
}
function eF(e, t) {
	let n = yP(e, (t || this).context);
	return n && n.bandwidth ? n.bandwidth() : 0;
}
function tF(e, t) {
	let n = yP(e, (t || this).context);
	return n ? n.copy() : void 0;
}
function nF(e, t) {
	let n = yP(e, (t || this).context);
	return n ? n.domain() : [];
}
function rF(e, t, n) {
	let r = yP(e, (n || this).context);
	return r ? P(t) ? (r.invertRange || r.invert)(t) : (r.invert || r.invertExtent)(t) : void 0;
}
function iF(e, t) {
	let n = yP(e, (t || this).context);
	return n && n.range ? n.range() : [];
}
function aF(e, t, n) {
	let r = yP(e, (n || this).context);
	return r ? r(t) : void 0;
}
function oF(e, t, n, r, i) {
	e = yP(e, (i || this).context);
	let a = hy(t, n), o = e.domain(), s = o[0], c = vu(o), l = ou;
	return c - s ? l = Lv(e, s, c) : e = (e.interpolator ? Cv("sequential")().interpolator(e.interpolator()) : Cv("linear")().interpolate(e.interpolate()).range(e.range())).domain([s = 0, c = 1]), e.ticks && (o = e.ticks(+r || 15), s !== o[0] && o.unshift(s), c !== vu(o) && o.push(c)), o.forEach((t) => a.stop(l(t), e(t))), a;
}
function sF(e, t, n) {
	let r = yP(e, (n || this).context);
	return function(e) {
		return r ? r.path.context(e)(t) : "";
	};
}
function cF(e) {
	let t = null;
	return function(n) {
		return n ? My(n, t = t || vy(e)) : e;
	};
}
var lF = (e) => e.data;
function uF(e, t) {
	let n = $N.call(t, e);
	return n.root && n.root.lookup || {};
}
function dF(e, t, n) {
	let r = uF(e, this), i = r[t], a = r[n];
	return i && a ? i.path(a).map(lF) : void 0;
}
function fF(e, t) {
	let n = uF(e, this)[t];
	return n ? n.ancestors().map(lF) : void 0;
}
var pF = () => typeof window < "u" && window || null;
function mF() {
	let e = pF();
	return e ? e.screen : {};
}
function hF() {
	let e = pF();
	return e ? [e.innerWidth, e.innerHeight] : [void 0, void 0];
}
function gF() {
	let e = this.context.dataflow, t = e.container && e.container();
	return t ? [t.clientWidth, t.clientHeight] : [void 0, void 0];
}
function _F(e, t, n) {
	if (!e) return [];
	let [r, i] = e, a = new Nb().set(r[0], r[1], i[0], i[1]);
	return lT(n || this.context.dataflow.scenegraph().root, a, vF(t));
}
function vF(e) {
	let t = null;
	if (e) {
		let n = I(e.marktype), r = I(e.markname);
		t = (e) => (!n.length || n.some((t) => e.marktype === t)) && (!r.length || r.some((t) => e.name === t));
	}
	return t;
}
function yF(e, t, n, r = 5) {
	e = I(e);
	let i = e[e.length - 1];
	return i === void 0 || Math.hypot(i[0] - t, i[1] - n) > r ? [...e, [t, n]] : e;
}
function bF(e) {
	return I(e).reduce((t, [n, r], i) => t += i == 0 ? `M ${n},${r} ` : i === e.length - 1 ? " Z" : `L ${n},${r} `, "");
}
function xF(e, t, n) {
	let { x: r, y: i, mark: a } = n, o = new Nb().set(2 ** 53 - 1, 2 ** 53 - 1, -(2 ** 53 - 1), -(2 ** 53 - 1));
	for (let [e, n] of t) e < o.x1 && (o.x1 = e), e > o.x2 && (o.x2 = e), n < o.y1 && (o.y1 = n), n > o.y2 && (o.y2 = n);
	return o.translate(r, i), _F([[o.x1, o.y1], [o.x2, o.y2]], e, a).filter((e) => SF(e.x, e.y, t));
}
function SF(e, t, n) {
	let r = 0;
	for (let i = 0, a = n.length - 1; i < n.length; a = i++) {
		let [o, s] = n[a], [c, l] = n[i];
		l > t != s > t && e < (o - c) * (t - l) / (s - l) + c && r++;
	}
	return r & 1;
}
var CF = {
	random() {
		return Xm();
	},
	cumulativeNormal: ch,
	cumulativeLogNormal: hh,
	cumulativeUniform: xh,
	densityNormal: sh,
	densityLogNormal: mh,
	densityUniform: bh,
	quantileNormal: lh,
	quantileLogNormal: gh,
	quantileUniform: Sh,
	sampleNormal: oh,
	sampleLogNormal: ph,
	sampleUniform: yh,
	isArray: P,
	isBoolean: ed,
	isDate: td,
	isDefined(e) {
		return e !== void 0;
	},
	isNumber: rd,
	isObject: F,
	isRegExp: id,
	isString: z,
	isTuple: Ip,
	isValid(e) {
		return e != null && e === e;
	},
	toBoolean: pd,
	toDate(e) {
		return hd(e);
	},
	toNumber: yu,
	toString: gd,
	indexof: qP,
	join: KP,
	lastindexof: JP,
	replace: XP,
	reverse: ZP,
	sort: QP,
	slice: YP,
	flush: Qu,
	lerp: od,
	merge: PP,
	pad: dd,
	peek: vu,
	pluck: UP,
	span: fd,
	inrange: $u,
	truncate: vd,
	rgb: Ke,
	lab: be,
	hcl: ke,
	hsl: iee,
	luminance: MP,
	contrast: NP,
	sequence: ye,
	format: iP,
	utcFormat: oP,
	utcParse: cP,
	utcOffset: xf,
	utcSequence: wf,
	timeFormat: aP,
	timeParse: sP,
	timeOffset: bf,
	timeSequence: Cf,
	timeUnitSpecifier: Wd,
	monthFormat: dP,
	monthAbbrevFormat: fP,
	dayFormat: pP,
	dayAbbrevFormat: mP,
	quarter: Fu,
	utcquarter: Iu,
	week: Jd,
	utcweek: ef,
	dayofyear: qd,
	utcdayofyear: $d,
	warn: OP,
	info: kP,
	debug: AP,
	extent(e) {
		return Ju(e);
	},
	inScope: EP,
	intersect: _F,
	clampRange: Lu,
	pinchDistance: BP,
	pinchAngle: VP,
	screen: mF,
	containerSize: gF,
	windowSize: hF,
	bandspace: $P,
	setdata: tP,
	pathShape: cF,
	panLinear: Eu,
	panLog: Du,
	panPow: Ou,
	panSymlog: ku,
	zoomLinear: ju,
	zoomLog: Mu,
	zoomPow: Nu,
	zoomSymlog: Pu,
	encode: nP,
	modify: zP,
	lassoAppend: yF,
	lassoPath: bF,
	intersectLasso: xF
}, wF = [
	"view",
	"item",
	"group",
	"xy",
	"x",
	"y"
], TF = "event.vega.", EF = "this.", DF = {}, OF = {
	forbidden: ["_"],
	allowed: [
		"datum",
		"event",
		"item"
	],
	fieldvar: "datum",
	globalvar: (e) => `_[${B("$" + e)}]`,
	functions: AF,
	constants: hN,
	visitors: DF
}, kF = vN(OF);
function AF(e) {
	let t = gN(e);
	wF.forEach((e) => t[e] = TF + e);
	for (let e in CF) t[e] = EF + e;
	return qu(t, bP(e, CF, DF)), t;
}
function jF(e, t, n) {
	return arguments.length === 1 ? CF[e] : (CF[e] = t, n && (DF[e] = n), kF && (kF.functions[e] = EF + e), this);
}
jF("bandwidth", eF, _P), jF("copy", tF, _P), jF("domain", nF, _P), jF("range", iF, _P), jF("invert", rF, _P), jF("scale", aF, _P), jF("gradient", oF, _P), jF("geoArea", SP, _P), jF("geoBounds", CP, _P), jF("geoCentroid", wP, _P), jF("geoShape", sF, _P), jF("geoScale", TP, _P), jF("indata", eP, gP), jF("data", $N, hP), jF("treePath", dF, hP), jF("treeAncestors", fF, hP), jF("vlSelectionTest", HN, QN), jF("vlSelectionIdTest", KN, QN), jF("vlSelectionResolve", JN, QN), jF("vlSelectionTuples", qN);
function MF(e, t) {
	let n = {}, r;
	try {
		e = z(e) ? e : B(e) + "", r = mN(e);
	} catch {
		N("Expression parse error: " + e);
	}
	r.visit((e) => {
		if (e.type !== "CallExpression") return;
		let r = e.callee.name, i = OF.visitors[r];
		i && i(r, e.arguments, t, n);
	});
	let i = kF(r);
	return i.globals.forEach((e) => {
		let r = "$" + e;
		!L(n, r) && t.getSignal(e) && (n[r] = t.signalRef(e));
	}), {
		$expr: qu({ code: i.code }, t.options.ast ? { ast: r } : null),
		$fields: i.fields,
		$params: n
	};
}
//#endregion
//#region ../../node_modules/.pnpm/vega-runtime@7.1.0/node_modules/vega-runtime/build/vega-runtime.js
function ote(e) {
	let t = this, n = e.operators || [];
	return e.background && (t.background = e.background), e.eventConfig && (t.eventConfig = e.eventConfig), e.locale && (t.locale = e.locale), n.forEach((e) => t.parseOperator(e)), n.forEach((e) => t.parseOperatorParameters(e)), (e.streams || []).forEach((e) => t.parseStream(e)), (e.updates || []).forEach((e) => t.parseUpdate(e)), t.resolve();
}
var ste = _d(["rule"]), NF = _d([
	"group",
	"image",
	"rect"
]);
function cte(e, t) {
	let n = "";
	return ste[t] ? n : (e.x2 && (e.x ? (NF[t] && (n += "if(o.x>o.x2)$=o.x,o.x=o.x2,o.x2=$;"), n += "o.width=o.x2-o.x;") : n += "o.x=o.x2-(o.width||0);"), e.xc && (n += "o.x=o.xc-(o.width||0)/2;"), e.y2 && (e.y ? (NF[t] && (n += "if(o.y>o.y2)$=o.y,o.y=o.y2,o.y2=$;"), n += "o.height=o.y2-o.y;") : n += "o.y=o.y2-(o.height||0);"), e.yc && (n += "o.y=o.yc-(o.height||0)/2;"), n);
}
function PF(e) {
	return (e + "").toLowerCase();
}
function lte(e) {
	return PF(e) === "operator";
}
function ute(e) {
	return PF(e) === "collect";
}
function FF(e, t, n) {
	n.endsWith(";") || (n = "return(" + n + ");");
	let r = Function(...t.concat(n));
	return e && e.functions ? r.bind(e.functions) : r;
}
function dte(e, t, n, r) {
	return `((u = ${e}) < (v = ${t}) || u == null) && v != null ? ${n}
  : (u > v || v == null) && u != null ? ${r}
  : ((v = v instanceof Date ? +v : v), (u = u instanceof Date ? +u : u)) !== u && v === v ? ${n}
  : v !== v && u === u ? ${r} : `;
}
var fte = {
	operator: (e, t) => FF(e, ["_"], t.code),
	parameter: (e, t) => FF(e, ["datum", "_"], t.code),
	event: (e, t) => FF(e, ["event"], t.code),
	handler: (e, t) => FF(e, ["_", "event"], `var datum=event.item&&event.item.datum;return ${t.code};`),
	encode: (e, t) => {
		let { marktype: n, channels: r } = t, i = "var o=item,datum=o.datum,m=0,$;";
		for (let e in r) {
			let t = "o[" + B(e) + "]";
			i += `$=${r[e].code};if(${t}!==$)${t}=$,m=1;`;
		}
		return i += cte(r, n), i += "return m;", FF(e, ["item", "_"], i);
	},
	codegen: {
		get(e) {
			let t = `[${e.map(B).join("][")}]`, n = Function("_", `return _${t};`);
			return n.path = t, n;
		},
		comparator(e, t) {
			let n, r = Function("a", "b", "var u, v; return " + e.map((e, r) => {
				let i = t[r], a, o;
				return e.path ? (a = `a${e.path}`, o = `b${e.path}`) : ((n = n || {})["f" + r] = e, a = `this.f${r}(a)`, o = `this.f${r}(b)`), dte(a, o, -i, i);
			}).join("") + "0;");
			return n ? r.bind(n) : r;
		}
	}
};
function pte(e) {
	let t = this;
	lte(e.type) || !e.type ? t.operator(e, e.update ? t.operatorExpression(e.update) : null) : t.transform(e, e.type);
}
function mte(e) {
	let t = this;
	if (e.params) {
		let n = t.get(e.id);
		n || N("Invalid operator id: " + e.id), t.dataflow.connect(n, n.parameters(t.parseParameters(e.params), e.react, e.initonly));
	}
}
function hte(e, t) {
	t = t || {};
	let n = this;
	for (let r in e) {
		let i = e[r];
		t[r] = P(i) ? i.map((e) => IF(e, n, t)) : IF(i, n, t);
	}
	return t;
}
function IF(e, t, n) {
	if (!e || !F(e)) return e;
	for (let r = 0, i = LF.length, a; r < i; ++r) if (a = LF[r], L(e, a.key)) return a.parse(e, t, n);
	return e;
}
var LF = [
	{
		key: "$ref",
		parse: gte
	},
	{
		key: "$key",
		parse: vte
	},
	{
		key: "$expr",
		parse: _te
	},
	{
		key: "$field",
		parse: yte
	},
	{
		key: "$encode",
		parse: xte
	},
	{
		key: "$compare",
		parse: bte
	},
	{
		key: "$context",
		parse: Ste
	},
	{
		key: "$subflow",
		parse: Cte
	},
	{
		key: "$tupleid",
		parse: wte
	}
];
function gte(e, t) {
	return t.get(e.$ref) || N("Operator not defined: " + e.$ref);
}
function _te(e, t, n) {
	e.$params && t.parseParameters(e.$params, n);
	let r = "e:" + e.$expr.code;
	return t.fn[r] || (t.fn[r] = Zl(t.parameterExpression(e.$expr), e.$fields));
}
function vte(e, t) {
	let n = "k:" + e.$key + "_" + !!e.$flat;
	return t.fn[n] || (t.fn[n] = ad(e.$key, e.$flat, t.expr.codegen));
}
function yte(e, t) {
	if (!e.$field) return null;
	let n = "f:" + e.$field + "_" + e.$name;
	return t.fn[n] || (t.fn[n] = iu(e.$field, e.$name, t.expr.codegen));
}
function bte(e, t) {
	let n = "c:" + e.$compare + "_" + e.$order, r = I(e.$compare).map((e) => e && e.$tupleid ? V : e);
	return t.fn[n] || (t.fn[n] = Bu(r, e.$order, t.expr.codegen));
}
function xte(e, t) {
	let n = e.$encode, r = {};
	for (let e in n) {
		let i = n[e];
		r[e] = Zl(t.encodeExpression(i.$expr), i.$fields), r[e].output = i.$output;
	}
	return r;
}
function Ste(e, t) {
	return t;
}
function Cte(e, t) {
	let n = e.$subflow;
	return function(e, r, i) {
		let a = t.fork().parse(n), o = a.get(n.operators[0].id), s = a.signals.parent;
		return s && s.set(i), o.detachSubflow = () => t.detach(a), o;
	};
}
function wte() {
	return V;
}
function Tte(e) {
	var t = this, n = e.filter == null ? void 0 : t.eventExpression(e.filter), r = e.stream == null ? void 0 : t.get(e.stream), i;
	e.source ? r = t.events(e.source, e.type, n) : e.merge && (i = e.merge.map((e) => t.get(e)), r = i[0].merge.apply(i[0], i.slice(1))), e.between && (i = e.between.map((e) => t.get(e)), r = r.between(i[0], i[1])), e.filter && (r = r.filter(n)), e.throttle != null && (r = r.throttle(+e.throttle)), e.debounce != null && (r = r.debounce(+e.debounce)), r == null && N("Invalid stream definition: " + JSON.stringify(e)), e.consume && r.consume(!0), t.stream(e, r);
}
function Ete(e) {
	var t = this, n = F(n = e.source) ? n.$ref : n, r = t.get(n), i = null, a = e.update, o = void 0;
	r || N("Source not defined: " + e.source), i = e.target && e.target.$expr ? t.eventExpression(e.target.$expr) : t.get(e.target), a && a.$expr && (a.$params && (o = t.parseParameters(a.$params)), a = t.handlerExpression(a.$expr)), t.update(e, r, i, a, o);
}
var Dte = { skip: !0 };
function Ote(e) {
	var t = this, n = {};
	if (e.signals) {
		var r = n.signals = {};
		Object.keys(t.signals).forEach((n) => {
			let i = t.signals[n];
			e.signals(n, i) && (r[n] = i.value);
		});
	}
	if (e.data) {
		var i = n.data = {};
		Object.keys(t.data).forEach((n) => {
			let r = t.data[n];
			e.data(n, r) && (i[n] = r.input.value);
		});
	}
	return t.subcontext && e.recurse !== !1 && (n.subcontext = t.subcontext.map((t) => t.getState(e))), n;
}
function kte(e) {
	var t = this, n = t.dataflow, r = e.data, i = e.signals;
	Object.keys(i || {}).forEach((e) => {
		n.update(t.signals[e], i[e], Dte);
	}), Object.keys(r || {}).forEach((e) => {
		n.pulse(t.data[e].input, n.changeset().remove(lu).insert(r[e]));
	}), (e.subcontext || []).forEach((e, n) => {
		let r = t.subcontext[n];
		r && r.setState(e);
	});
}
function RF(e, t, n, r) {
	return new zF(e, t, n, r);
}
function zF(e, t, n, r) {
	this.dataflow = e, this.transforms = t, this.events = e.events.bind(e), this.expr = r || fte, this.signals = {}, this.scales = {}, this.nodes = {}, this.data = {}, this.fn = {}, n && (this.functions = Object.create(n), this.functions.context = this);
}
function BF(e) {
	this.dataflow = e.dataflow, this.transforms = e.transforms, this.events = e.events, this.expr = e.expr, this.signals = Object.create(e.signals), this.scales = Object.create(e.scales), this.nodes = Object.create(e.nodes), this.data = Object.create(e.data), this.fn = Object.create(e.fn), e.functions && (this.functions = Object.create(e.functions), this.functions.context = this);
}
zF.prototype = BF.prototype = {
	fork() {
		let e = new BF(this);
		return (this.subcontext || (this.subcontext = [])).push(e), e;
	},
	detach(e) {
		this.subcontext = this.subcontext.filter((t) => t !== e);
		let t = Object.keys(e.nodes);
		for (let n of t) e.nodes[n]._targets = null;
		for (let n of t) e.nodes[n].detach();
		e.nodes = null;
	},
	get(e) {
		return this.nodes[e];
	},
	set(e, t) {
		return this.nodes[e] = t;
	},
	add(e, t) {
		let n = this, r = n.dataflow, i = e.value;
		if (n.set(e.id, t), ute(e.type) && i && (i.$ingest ? r.ingest(t, i.$ingest, i.$format) : i.$request ? r.preload(t, i.$request, i.$format) : r.pulse(t, r.changeset().insert(i))), e.root && (n.root = t), e.parent) {
			let i = n.get(e.parent.$ref);
			i ? (r.connect(i, [t]), t.targets().add(i)) : (n.unresolved = n.unresolved || []).push(() => {
				i = n.get(e.parent.$ref), r.connect(i, [t]), t.targets().add(i);
			});
		}
		if (e.signal && (n.signals[e.signal] = t), e.scale && (n.scales[e.scale] = t), e.data) for (let r in e.data) {
			let i = n.data[r] || (n.data[r] = {});
			e.data[r].forEach((e) => i[e] = t);
		}
	},
	resolve() {
		return (this.unresolved || []).forEach((e) => e()), delete this.unresolved, this;
	},
	operator(e, t) {
		this.add(e, this.dataflow.add(e.value, t));
	},
	transform(e, t) {
		this.add(e, this.dataflow.add(this.transforms[PF(t)]));
	},
	stream(e, t) {
		this.set(e.id, t);
	},
	update(e, t, n, r, i) {
		this.dataflow.on(t, n, r, i, e.options);
	},
	operatorExpression(e) {
		return this.expr.operator(this, e);
	},
	parameterExpression(e) {
		return this.expr.parameter(this, e);
	},
	eventExpression(e) {
		return this.expr.event(this, e);
	},
	handlerExpression(e) {
		return this.expr.handler(this, e);
	},
	encodeExpression(e) {
		return this.expr.encode(this, e);
	},
	parse: ote,
	parseOperator: pte,
	parseOperatorParameters: mte,
	parseParameters: hte,
	parseStream: Tte,
	parseUpdate: Ete,
	getState: Ote,
	setState: kte
};
//#endregion
//#region ../../node_modules/.pnpm/vega-view@6.1.0/node_modules/vega-view/build/vega-view.js
function Ate(e) {
	let t = e.container();
	t && (t.setAttribute("role", "graphics-document"), t.setAttribute("aria-roleDescription", "visualization"), VF(t, e.description()));
}
function VF(e, t) {
	e && (t == null ? e.removeAttribute("aria-label") : e.setAttribute("aria-label", t));
}
function jte(e) {
	e.add(null, (t) => (e._background = t.bg, e._resize = 1, t.bg), { bg: e._signals.background });
}
var HF = "default";
function Mte(e) {
	let t = e._signals.cursor || (e._signals.cursor = e.add({
		user: HF,
		item: null
	}));
	e.on(e.events("view", "pointermove"), t, (e, n) => {
		let r = t.value, i = r ? z(r) ? r : r.user : HF, a = n.item && n.item.cursor || null;
		return r && i === r.user && a == r.item ? r : {
			user: i,
			item: a
		};
	}), e.add(null, function(t) {
		let n = t.cursor, r = this.value;
		return z(n) || (r = n.item, n = n.user), UF(e, n && n !== HF ? n : r || n), r;
	}, { cursor: t });
}
function UF(e, t) {
	let n = e.globalCursor() ? typeof document < "u" && document.body : e.container();
	if (n) return t == null ? n.style.removeProperty("cursor") : n.style.cursor = t;
}
function WF(e, t) {
	var n = e._runtime.data;
	return L(n, t) || N("Unrecognized data set: " + t), n[t];
}
function Nte(e, t) {
	return arguments.length < 2 ? WF(this, e).values.value : GF.call(this, e, Wp().remove(lu).insert(t));
}
function GF(e, t) {
	Up(t) || N("Second argument to changes must be a changeset.");
	let n = WF(this, e);
	return n.modified = !0, this.pulse(n.input, t);
}
function Pte(e, t) {
	return GF.call(this, e, Wp().insert(t));
}
function Fte(e, t) {
	return GF.call(this, e, Wp().remove(t));
}
function KF(e) {
	var t = e.padding();
	return Math.max(0, e._viewWidth + t.left + t.right);
}
function qF(e) {
	var t = e.padding();
	return Math.max(0, e._viewHeight + t.top + t.bottom);
}
function JF(e) {
	var t = e.padding(), n = e._origin;
	return [t.left + n[0], t.top + n[1]];
}
function Ite(e) {
	var t = JF(e), n = KF(e), r = qF(e);
	e._renderer.background(e.background()), e._renderer.resize(n, r, t), e._handler.origin(t), e._resizeListeners.forEach((t) => {
		try {
			t(n, r);
		} catch (t) {
			e.error(t);
		}
	});
}
function Lte(e, t, n) {
	var r = e._renderer, i = r && r.canvas(), a, o, s;
	return i && (s = JF(e), o = t.changedTouches ? t.changedTouches[0] : t, a = wC(o, i), a[0] -= s[0], a[1] -= s[1]), t.dataflow = e, t.item = n, t.vega = Rte(e, n, a), t;
}
function Rte(e, t, n) {
	let r = t ? t.mark.marktype === "group" ? t : t.mark.group : null;
	function i(e) {
		var n = r, i;
		if (e) {
			for (i = t; i; i = i.mark.group) if (i.mark.name === e) {
				n = i;
				break;
			}
		}
		return n && n.mark && n.mark.interactive ? n : {};
	}
	function a(e) {
		if (!e) return n;
		z(e) && (e = i(e));
		let t = n.slice();
		for (; e;) t[0] -= e.x || 0, t[1] -= e.y || 0, e = e.mark && e.mark.group;
		return t;
	}
	return {
		view: Gu(e),
		item: Gu(t || {}),
		group: i,
		xy: a,
		x: (e) => a(e)[0],
		y: (e) => a(e)[1]
	};
}
var YF = "view", zte = "timer", Bte = "window", Vte = { trap: !1 };
function Hte(e) {
	let t = qu({ defaults: {} }, e), n = (e, t) => {
		t.forEach((t) => {
			P(e[t]) && (e[t] = _d(e[t]));
		});
	};
	return n(t.defaults, ["prevent", "allow"]), n(t, [
		"view",
		"window",
		"selector"
	]), t;
}
function XF(e, t, n, r) {
	e._eventListeners.push({
		type: n,
		sources: I(t),
		handler: r
	});
}
function Ute(e, t) {
	var n = e._eventConfig.defaults, r = n.prevent, i = n.allow;
	return r === !1 || i === !0 ? !1 : r === !0 || i === !1 ? !0 : r ? r[t] : i ? !i[t] : e.preventDefault();
}
function ZF(e, t, n) {
	let r = e._eventConfig && e._eventConfig[t];
	return r === !1 || F(r) && !r[n] ? (e.warn(`Blocked ${t} ${n} event listener.`), !1) : !0;
}
function Wte(e, t, n) {
	var r = this, i = new nm(n), a = function(n, a) {
		r.runAsync(null, () => {
			e === YF && Ute(r, t) && n.preventDefault(), i.receive(Lte(r, n, a));
		});
	}, o;
	if (e === zte) ZF(r, "timer", t) && r.timer(a, t);
	else if (e === YF) ZF(r, "view", t) && r.addEventListener(t, a, Vte);
	else if (e === Bte ? ZF(r, "window", t) && typeof window < "u" && (o = [window]) : typeof document < "u" && ZF(r, "selector", t) && (o = Array.from(document.querySelectorAll(e))), !o) r.warn("Can not resolve event source: " + e);
	else {
		for (var s = 0, c = o.length; s < c; ++s) o[s].addEventListener(t, a);
		XF(r, o, t, a);
	}
	return i;
}
function QF(e) {
	return e.item;
}
function $F(e) {
	return e.item.mark.source;
}
function eI(e) {
	return function(t, n) {
		return n.vega.view().changeset().encode(n.item, e);
	};
}
function Gte(e, t) {
	return e = [e || "hover"], t = [t || "update", e[0]], this.on(this.events("view", "pointerover", QF), $F, eI(e)), this.on(this.events("view", "pointerout", QF), $F, eI(t)), this;
}
function Kte() {
	for (var e = this._tooltip, t = this._timers, n = this._handler.handlers(), r = this._eventListeners, i = t.length, a, o, s, c; --i >= 0;) t[i].stop();
	for (i = r.length; --i >= 0;) for (o = r[i], a = o.sources.length; --a >= 0;) o.sources[a].removeEventListener(o.type, o.handler);
	for (e && e.call(this, this._handler, null, null, null), i = n.length; --i >= 0;) c = n[i].type, s = n[i].handler, this._handler.off(c, s);
	return this;
}
function tI(e, t, n) {
	let r = document.createElement(e);
	for (let e in t) r.setAttribute(e, t[e]);
	return n != null && (r.textContent = n), r;
}
var qte = "vega-bind", Jte = "vega-bind-name", Yte = "vega-bind-radio";
function Xte(e, t, n) {
	if (!t) return;
	let r = n.param, i = n.state;
	return i || (i = n.state = {
		elements: null,
		active: !1,
		set: null,
		update: (t) => {
			t != e.signal(r.signal) && e.runAsync(null, () => {
				i.source = !0, e.signal(r.signal, t);
			});
		}
	}, r.debounce && (i.update = Ku(r.debounce, i.update))), (r.input == null && r.element ? Zte : $te)(i, t, r, e), i.active || (e.on(e._signals[r.signal], null, () => {
		i.source ? i.source = !1 : i.set(e.signal(r.signal));
	}), i.active = !0), i;
}
function Zte(e, t, n, r) {
	let i = n.event || "input", a = () => e.update(t.value);
	r.signal(n.signal, t.value), t.addEventListener(i, a), XF(r, t, i, a), e.set = (e) => {
		t.value = e, t.dispatchEvent(Qte(i));
	};
}
function Qte(e) {
	return typeof Event < "u" ? new Event(e) : { type: e };
}
function $te(e, t, n, r) {
	let i = r.signal(n.signal), a = tI("div", { class: qte }), o = n.input === "radio" ? a : a.appendChild(tI("label"));
	o.appendChild(tI("span", { class: Jte }, n.name || n.signal)), t.appendChild(a);
	let s = ene;
	switch (n.input) {
		case "checkbox":
			s = tne;
			break;
		case "select":
			s = nne;
			break;
		case "radio":
			s = rne;
			break;
		case "range":
			s = ine;
			break;
	}
	s(e, o, n, i);
}
function ene(e, t, n, r) {
	let i = tI("input");
	for (let e in n) e !== "signal" && e !== "element" && i.setAttribute(e === "input" ? "type" : e, n[e]);
	i.setAttribute("name", n.signal), i.value = r, t.appendChild(i), i.addEventListener("input", () => e.update(i.value)), e.elements = [i], e.set = (e) => i.value = e;
}
function tne(e, t, n, r) {
	let i = {
		type: "checkbox",
		name: n.signal
	};
	r && (i.checked = !0);
	let a = tI("input", i);
	t.appendChild(a), a.addEventListener("change", () => e.update(a.checked)), e.elements = [a], e.set = (e) => a.checked = !!e || null;
}
function nne(e, t, n, r) {
	let i = tI("select", { name: n.signal }), a = n.labels || [];
	n.options.forEach((e, t) => {
		let n = { value: e };
		nI(e, r) && (n.selected = !0), i.appendChild(tI("option", n, (a[t] || e) + ""));
	}), t.appendChild(i), i.addEventListener("change", () => {
		e.update(n.options[i.selectedIndex]);
	}), e.elements = [i], e.set = (e) => {
		for (let t = 0, r = n.options.length; t < r; ++t) if (nI(n.options[t], e)) {
			i.selectedIndex = t;
			return;
		}
	};
}
function rne(e, t, n, r) {
	let i = tI("span", { class: Yte }), a = n.labels || [];
	t.appendChild(i), e.elements = n.options.map((t, o) => {
		let s = {
			type: "radio",
			name: n.signal,
			value: t
		};
		nI(t, r) && (s.checked = !0);
		let c = tI("input", s);
		c.addEventListener("change", () => e.update(t));
		let l = tI("label", {}, (a[o] || t) + "");
		return l.prepend(c), i.appendChild(l), c;
	}), e.set = (t) => {
		let n = e.elements, r = n.length;
		for (let e = 0; e < r; ++e) nI(n[e].value, t) && (n[e].checked = !0);
	};
}
function ine(e, t, n, r) {
	r = r === void 0 ? (+n.max + +n.min) / 2 : r;
	let i = n.max == null ? Math.max(100, +r) || 100 : n.max, a = n.min || Math.min(0, i, +r) || 0, s = n.step || o(a, i, 100), c = tI("input", {
		type: "range",
		name: n.signal,
		min: a,
		max: i,
		step: s
	});
	c.value = r;
	let l = tI("span", {}, +r);
	t.appendChild(c), t.appendChild(l);
	let u = () => {
		l.textContent = c.value, e.update(+c.value);
	};
	c.addEventListener("input", u), c.addEventListener("change", u), e.elements = [c], e.set = (e) => {
		c.value = e, l.textContent = e;
	};
}
function nI(e, t) {
	return e === t || e + "" == t + "";
}
function rI(e, t, n, r, i, a) {
	return t = t || new r(e.loader()), t.initialize(n, KF(e), qF(e), JF(e), i, a).background(e.background());
}
function iI(e, t) {
	return t ? function() {
		try {
			t.apply(this, arguments);
		} catch (t) {
			e.error(t);
		}
	} : null;
}
function ane(e, t, n, r) {
	let i = new r(e.loader(), iI(e, e.tooltip())).scene(e.scenegraph().root).initialize(n, JF(e), e);
	return t && t.handlers().forEach((e) => {
		i.on(e.type, e.handler);
	}), i;
}
function one(e, t) {
	let n = this, r = n._renderType, i = n._eventConfig.bind, a = cT(r);
	e = n._el = e ? aI(n, e, !0) : null, Ate(n), a || n.error("Unrecognized renderer type: " + r);
	let o = a.handler || nw, s = e ? a.renderer : a.headless;
	return n._renderer = s ? rI(n, n._renderer, e, s) : null, n._handler = ane(n, n._handler, e, o), n._redraw = !0, e && i !== "none" && (t = t ? n._elBind = aI(n, t, !0) : e.appendChild(tI("form", { class: "vega-bindings" })), n._bind.forEach((e) => {
		e.param.element && i !== "container" && (e.element = aI(n, e.param.element, !!e.param.input));
	}), n._bind.forEach((e) => {
		Xte(n, e.element || t, e);
	})), n;
}
function aI(e, t, n) {
	if (typeof t == "string") if (typeof document < "u") {
		if (t = document.querySelector(t), !t) return e.error("Signal bind element not found: " + t), null;
	} else return e.error("DOM document instance not found."), null;
	if (t && n) try {
		t.textContent = "";
	} catch (n) {
		t = null, e.error(n);
	}
	return t;
}
var oI = (e) => +e || 0, sne = (e) => ({
	top: e,
	bottom: e,
	left: e,
	right: e
});
function sI(e) {
	return F(e) ? {
		top: oI(e.top),
		bottom: oI(e.bottom),
		left: oI(e.left),
		right: oI(e.right)
	} : sne(oI(e));
}
async function cI(e, t, n, r) {
	let i = cT(t), a = i && i.headless;
	return a || N("Unrecognized renderer type: " + t), await e.runAsync(), rI(e, null, null, a, n, r).renderAsync(e._scenegraph.root);
}
async function cne(e, t) {
	e !== oT.Canvas && e !== oT.SVG && e !== oT.PNG && N("Unrecognized image type: " + e);
	let n = await cI(this, e, t);
	return e === oT.SVG ? lne(n.svg(), "image/svg+xml") : n.canvas().toDataURL("image/png");
}
function lne(e, t) {
	let n = new Blob([e], { type: t });
	return window.URL.createObjectURL(n);
}
async function une(e, t) {
	return (await cI(this, oT.Canvas, e, t)).canvas();
}
async function dne(e) {
	return (await cI(this, oT.SVG, e)).svg();
}
function fne(e, t, n) {
	return RF(e, Hm, CF, n).parse(t);
}
function pne(e) {
	var t = this._runtime.scales;
	return L(t, e) || N("Unrecognized scale or projection: " + e), t[e].value;
}
var lI = "width", uI = "height", dI = "padding", fI = { skip: !0 };
function pI(e, t) {
	var n = e.autosize(), r = e.padding();
	return t - (n && n.contains === dI ? r.left + r.right : 0);
}
function mI(e, t) {
	var n = e.autosize(), r = e.padding();
	return t - (n && n.contains === dI ? r.top + r.bottom : 0);
}
function mne(e) {
	var t = e._signals, n = t[lI], r = t[uI], i = t[dI];
	function a() {
		e._autosize = e._resize = 1;
	}
	e._resizeWidth = e.add(null, (t) => {
		e._width = t.size, e._viewWidth = pI(e, t.size), a();
	}, { size: n }), e._resizeHeight = e.add(null, (t) => {
		e._height = t.size, e._viewHeight = mI(e, t.size), a();
	}, { size: r });
	let o = e.add(null, a, { pad: i });
	e._resizeWidth.rank = n.rank + 1, e._resizeHeight.rank = r.rank + 1, o.rank = i.rank + 1;
}
function hne(e, t, n, r, i, a) {
	this.runAfter((o) => {
		let s = 0;
		o._autosize = 0, o.width() !== n && (s = 1, o.signal(lI, n, fI), o._resizeWidth.skip(!0)), o.height() !== r && (s = 1, o.signal(uI, r, fI), o._resizeHeight.skip(!0)), o._viewWidth !== e && (o._resize = 1, o._viewWidth = e), o._viewHeight !== t && (o._resize = 1, o._viewHeight = t), (o._origin[0] !== i[0] || o._origin[1] !== i[1]) && (o._resize = 1, o._origin = i), s && o.run("enter"), a && o.runAfter((e) => e.resize());
	}, !1, 1);
}
function gne(e) {
	return this._runtime.getState(e || {
		data: _ne,
		signals: vne,
		recurse: !0
	});
}
function _ne(e, t) {
	return t.modified && P(t.input.value) && !e.startsWith("_:vega:_");
}
function vne(e, t) {
	return !(e === "parent" || t instanceof Hm.proxy);
}
function yne(e) {
	return this.runAsync(null, (t) => {
		t._trigger = !1, t._runtime.setState(e);
	}, (e) => {
		e._trigger = !0;
	}), this;
}
function bne(e, t) {
	function n(t) {
		e({
			timestamp: Date.now(),
			elapsed: t
		});
	}
	this._timers.push(see(n, t));
}
function xne(e, t, n, r) {
	let i = e.element();
	i && i.setAttribute("title", Sne(r));
}
function Sne(e) {
	return e == null ? "" : P(e) ? hI(e) : F(e) && !td(e) ? Cne(e) : e + "";
}
function Cne(e) {
	return Object.keys(e).map((t) => {
		let n = e[t];
		return t + ": " + (P(n) ? hI(n) : gI(n));
	}).join("\n");
}
function hI(e) {
	return "[" + e.map(gI).join(", ") + "]";
}
function gI(e) {
	return P(e) ? "[…]" : F(e) && !td(e) ? "{…}" : e;
}
function wne() {
	if (this.renderer() === "canvas" && this._renderer._canvas) {
		let e = null, t = () => {
			e != null && e();
			let n = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
			n.addEventListener("change", t), e = () => {
				n.removeEventListener("change", t);
			}, this._renderer._canvas.getContext("2d").pixelRatio = window.devicePixelRatio || 1, this._redraw = !0, this._resize = 1, this.resize().runAsync();
		};
		t();
	}
}
function _I(e, t) {
	let n = this;
	if (t = t || {}, Bm.call(n), t.loader && n.loader(t.loader), t.logger && n.logger(t.logger), t.logLevel != null && n.logLevel(t.logLevel), t.locale || e.locale) {
		let r = qu({}, e.locale, t.locale);
		n.locale(rp(r.number, r.time));
	}
	n._el = null, n._elBind = null, n._renderType = t.renderer || oT.Canvas, n._scenegraph = new _C();
	let r = n._scenegraph.root;
	n._renderer = null, n._tooltip = t.tooltip || xne, n._redraw = !0, n._handler = new nw().scene(r), n._globalCursor = !1, n._preventDefault = !1, n._timers = [], n._eventListeners = [], n._resizeListeners = [], n._eventConfig = Hte(e.eventConfig), n.globalCursor(n._eventConfig.globalCursor);
	let i = fne(n, e, t.expr);
	n._runtime = i, n._signals = i.signals, n._bind = (e.bindings || []).map((e) => ({
		state: null,
		param: qu({}, e)
	})), i.root && i.root.set(r), r.source = i.data.root.input, n.pulse(i.data.root.input, n.changeset().insert(r.items)), n._width = n.width(), n._height = n.height(), n._viewWidth = pI(n, n._width), n._viewHeight = mI(n, n._height), n._origin = [0, 0], n._resize = 0, n._autosize = 1, mne(n), jte(n), Mte(n), n.description(e.description), t.hover && n.hover(), t.container && n.initialize(t.container, t.bind), t.watchPixelRatio && n._watchPixelRatio();
}
function vI(e, t) {
	return L(e._signals, t) ? e._signals[t] : N("Unrecognized signal name: " + B(t));
}
function yI(e, t) {
	let n = (e._targets || []).filter((e) => e._update && e._update.handler === t);
	return n.length ? n[0] : null;
}
function bI(e, t, n, r) {
	let i = yI(n, r);
	return i || (i = iI(e, () => r(t, n.value)), i.handler = r, e.on(n, null, i)), e;
}
function xI(e, t, n) {
	let r = yI(t, n);
	return r && t._targets.remove(r), e;
}
R(_I, Bm, {
	async evaluate(e, t, n) {
		if (await Bm.prototype.evaluate.call(this, e, t), this._redraw || this._resize) try {
			this._renderer && (this._resize && (this._resize = 0, Ite(this)), await this._renderer.renderAsync(this._scenegraph.root)), this._redraw = !1;
		} catch (e) {
			this.error(e);
		}
		return n && Pp(this, n), this;
	},
	dirty(e) {
		this._redraw = !0, this._renderer && this._renderer.dirty(e);
	},
	description(e) {
		if (arguments.length) {
			let t = e == null ? null : e + "";
			return t !== this._desc && VF(this._el, this._desc = t), this;
		}
		return this._desc;
	},
	container() {
		return this._el;
	},
	scenegraph() {
		return this._scenegraph;
	},
	origin() {
		return this._origin.slice();
	},
	signal(e, t, n) {
		let r = vI(this, e);
		return arguments.length === 1 ? r.value : this.update(r, t, n);
	},
	width(e) {
		return arguments.length ? this.signal("width", e) : this.signal("width");
	},
	height(e) {
		return arguments.length ? this.signal("height", e) : this.signal("height");
	},
	padding(e) {
		return arguments.length ? this.signal("padding", sI(e)) : sI(this.signal("padding"));
	},
	autosize(e) {
		return arguments.length ? this.signal("autosize", e) : this.signal("autosize");
	},
	background(e) {
		return arguments.length ? this.signal("background", e) : this.signal("background");
	},
	renderer(e) {
		return arguments.length ? (cT(e) || N("Unrecognized renderer type: " + e), e !== this._renderType && (this._renderType = e, this._resetRenderer()), this) : this._renderType;
	},
	tooltip(e) {
		return arguments.length ? (e !== this._tooltip && (this._tooltip = e, this._resetRenderer()), this) : this._tooltip;
	},
	loader(e) {
		return arguments.length ? (e !== this._loader && (Bm.prototype.loader.call(this, e), this._resetRenderer()), this) : this._loader;
	},
	resize() {
		return this._autosize = 1, this.touch(vI(this, "autosize"));
	},
	_resetRenderer() {
		this._renderer && (this._renderer = null, this.initialize(this._el, this._elBind));
	},
	_resizeView: hne,
	addEventListener(e, t, n) {
		let r = t;
		return n && n.trap === !1 || (r = iI(this, t), r.raw = t), this._handler.on(e, r), this;
	},
	removeEventListener(e, t) {
		for (var n = this._handler.handlers(e), r = n.length, i, a; --r >= 0;) if (a = n[r].type, i = n[r].handler, e === a && (t === i || t === i.raw)) {
			this._handler.off(a, i);
			break;
		}
		return this;
	},
	addResizeListener(e) {
		let t = this._resizeListeners;
		return t.includes(e) || t.push(e), this;
	},
	removeResizeListener(e) {
		var t = this._resizeListeners, n = t.indexOf(e);
		return n >= 0 && t.splice(n, 1), this;
	},
	addSignalListener(e, t) {
		return bI(this, e, vI(this, e), t);
	},
	removeSignalListener(e, t) {
		return xI(this, vI(this, e), t);
	},
	addDataListener(e, t) {
		return bI(this, e, WF(this, e).values, t);
	},
	removeDataListener(e, t) {
		return xI(this, WF(this, e).values, t);
	},
	globalCursor(e) {
		if (arguments.length) {
			if (this._globalCursor !== !!e) {
				let t = UF(this, null);
				this._globalCursor = !!e, t && UF(this, t);
			}
			return this;
		} else return this._globalCursor;
	},
	preventDefault(e) {
		return arguments.length ? (this._preventDefault = e, this) : this._preventDefault;
	},
	timer: bne,
	events: Wte,
	finalize: Kte,
	hover: Gte,
	data: Nte,
	change: GF,
	insert: Pte,
	remove: Fte,
	scale: pne,
	initialize: one,
	toImageURL: cne,
	toCanvas: une,
	toSVG: dne,
	getState: gne,
	setState: yne,
	_watchPixelRatio: wne
});
//#endregion
//#region ../../node_modules/.pnpm/vega-event-selector@4.0.0/node_modules/vega-event-selector/build/vega-event-selector.js
var Tne = "view", SI = "[", CI = "]", wI = "{", TI = "}", EI = ":", DI = ",", OI = "@", kI = ">", AI = /[[\]{}]/, jI = {
	"*": 1,
	arc: 1,
	area: 1,
	group: 1,
	image: 1,
	line: 1,
	path: 1,
	rect: 1,
	rule: 1,
	shape: 1,
	symbol: 1,
	text: 1,
	trail: 1
}, MI, NI;
function PI(e, t, n) {
	return MI = t || Tne, NI = n || jI, LI(e.trim()).map(RI);
}
function FI(e) {
	return NI[e];
}
function II(e, t, n, r, i) {
	let a = e.length, o = 0, s;
	for (; t < a; ++t) {
		if (s = e[t], !o && s === n) return t;
		i && i.includes(s) ? --o : r && r.includes(s) && ++o;
	}
	return t;
}
function LI(e) {
	let t = [], n = e.length, r = 0, i = 0;
	for (; i < n;) i = II(e, i, DI, SI + wI, CI + TI), t.push(e.substring(r, i).trim()), r = ++i;
	if (t.length === 0) throw "Empty event selector: " + e;
	return t;
}
function RI(e) {
	return e[0] === "[" ? zI(e) : BI(e);
}
function zI(e) {
	let t = e.length, n = 1, r;
	if (n = II(e, n, CI, SI, CI), n === t) throw "Empty between selector: " + e;
	if (r = LI(e.substring(1, n)), r.length !== 2) throw "Between selector must have two elements: " + e;
	if (e = e.slice(n + 1).trim(), e[0] !== kI) throw "Expected '>' after between selector: " + e;
	r = r.map(RI);
	let i = RI(e.slice(1).trim());
	return i.between ? {
		between: r,
		stream: i
	} : (i.between = r, i);
}
function BI(e) {
	let t = { source: MI }, n = [], r = [0, 0], i = 0, a = 0, o = e.length, s = 0, c, l;
	if (e[o - 1] === TI) {
		if (s = e.lastIndexOf(wI), s >= 0) {
			try {
				r = VI(e.substring(s + 1, o - 1));
			} catch {
				throw "Invalid throttle specification: " + e;
			}
			e = e.slice(0, s).trim(), o = e.length;
		} else throw "Unmatched right brace: " + e;
		s = 0;
	}
	if (!o) throw e;
	if (e[0] === OI && (i = ++s), c = II(e, s, EI), c < o && (n.push(e.substring(a, c).trim()), a = s = ++c), s = II(e, s, SI), s === o) n.push(e.substring(a, o).trim());
	else if (n.push(e.substring(a, s).trim()), l = [], a = ++s, a === o) throw "Unmatched left bracket: " + e;
	for (; s < o;) {
		if (s = II(e, s, CI), s === o) throw "Unmatched left bracket: " + e;
		if (l.push(e.substring(a, s).trim()), s < o - 1 && e[++s] !== SI) throw "Expected left bracket: " + e;
		a = ++s;
	}
	if (!(o = n.length) || AI.test(n[o - 1])) throw "Invalid event selector: " + e;
	return o > 1 ? (t.type = n[1], i ? t.markname = n[0].slice(1) : FI(n[0]) ? t.marktype = n[0] : t.source = n[0]) : t.type = n[0], t.type.slice(-1) === "!" && (t.consume = !0, t.type = t.type.slice(0, -1)), l != null && (t.filter = l), r[0] && (t.throttle = r[0]), r[1] && (t.debounce = r[1]), t;
}
function VI(e) {
	let t = e.split(DI);
	if (!e.length || t.length > 2) throw e;
	return t.map((t) => {
		let n = +t;
		if (n !== n) throw e;
		return n;
	});
}
//#endregion
//#region ../../node_modules/.pnpm/vega-parser@7.1.0/node_modules/vega-parser/build/vega-parser.js
function HI(e) {
	return F(e) ? e : { type: e || "pad" };
}
var UI = (e) => +e || 0, WI = (e) => ({
	top: e,
	bottom: e,
	left: e,
	right: e
});
function GI(e) {
	return F(e) ? e.signal ? e : {
		top: UI(e.top),
		bottom: UI(e.bottom),
		left: UI(e.left),
		right: UI(e.right)
	} : WI(UI(e));
}
var KI = (e) => F(e) && !P(e) ? qu({}, e) : { value: e };
function qI(e, t, n, r) {
	return n == null ? 0 : (F(n) && !P(n) || P(n) && n.length && F(n[0]) ? e.update[t] = n : e[r || "enter"][t] = { value: n }, 1);
}
function JI(e, t, n) {
	for (let n in t) qI(e, n, t[n]);
	for (let t in n) qI(e, t, n[t], "update");
}
function YI(e, t, n) {
	for (let r in t) n && L(n, r) || (e[r] = qu(e[r] || {}, t[r]));
	return e;
}
function XI(e, t) {
	return t && (t.enter && t.enter[e] || t.update && t.update[e]);
}
var ZI = "frame", QI = "scope", $I = "axis", eL = "axis-domain", tL = "axis-grid", nL = "axis-label", rL = "axis-tick", iL = "axis-title", aL = "legend", oL = "legend-band", sL = "legend-entry", cL = "legend-gradient", lL = "legend-label", uL = "legend-symbol", dL = "legend-title", fL = "title", pL = "title-text", mL = "title-subtitle";
function hL(e, t, n, r, i) {
	let a = {}, o = {}, s, c, l, u;
	for (c in c = "lineBreak", t === "text" && i[c] != null && !XI(c, e) && gL(a, c, i[c]), (n == "legend" || String(n).startsWith("axis")) && (n = null), u = n === "frame" ? i.group : n === "mark" ? qu({}, i.mark, i[t]) : null, u) l = XI(c, e) || (c === "fill" || c === "stroke") && (XI("fill", e) || XI("stroke", e)), l || gL(a, c, u[c]);
	for (c in I(r).forEach((t) => {
		let n = i.style && i.style[t];
		for (let t in n) XI(t, e) || gL(a, t, n[t]);
	}), e = qu({}, e), a) u = a[c], u.signal ? (s = s || {})[c] = u : o[c] = u;
	return e.enter = qu(o, e.enter), s && (e.update = qu(s, e.update)), e;
}
function gL(e, t, n) {
	e[t] = n && n.signal ? { signal: n.signal } : { value: n };
}
var _L = (e) => z(e) ? B(e) : e.signal ? `(${e.signal})` : CL(e);
function vL(e) {
	if (e.gradient != null) return xL(e);
	let t = e.signal ? `(${e.signal})` : e.color ? bL(e.color) : e.field == null ? e.value === void 0 ? void 0 : B(e.value) : CL(e.field);
	return e.scale != null && (t = TL(e, t)), t === void 0 && (t = null), e.exponent != null && (t = `pow(${t},${SL(e.exponent)})`), e.mult != null && (t += `*${SL(e.mult)}`), e.offset != null && (t += `+${SL(e.offset)}`), e.round && (t = `round(${t})`), t;
}
var yL = (e, t, n, r) => `(${e}(${[
	t,
	n,
	r
].map(vL).join(",")})+'')`;
function bL(e) {
	return e.c ? yL("hcl", e.h, e.c, e.l) : e.h || e.s ? yL("hsl", e.h, e.s, e.l) : e.l || e.a ? yL("lab", e.l, e.a, e.b) : e.r || e.g || e.b ? yL("rgb", e.r, e.g, e.b) : null;
}
function xL(e) {
	let t = [
		e.start,
		e.stop,
		e.count
	].map((e) => e == null ? null : B(e));
	for (; t.length && vu(t) == null;) t.pop();
	return t.unshift(_L(e.gradient)), `gradient(${t.join(",")})`;
}
function SL(e) {
	return F(e) ? "(" + vL(e) + ")" : e;
}
function CL(e) {
	return wL(F(e) ? e : { datum: e });
}
function wL(e) {
	let t, n, r;
	if (e.signal) t = "datum", r = e.signal;
	else if (e.group || e.parent) {
		for (n = Math.max(1, e.level || 1), t = "item"; n-- > 0;) t += ".mark.group";
		e.parent ? (r = e.parent, t += ".datum") : r = e.group;
	} else e.datum ? (t = "datum", r = e.datum) : N("Invalid field reference: " + B(e));
	return e.signal || (r = z(r) ? ru(r).map(B).join("][") : wL(r)), t + "[" + r + "]";
}
function TL(e, t) {
	let n = _L(e.scale);
	return e.range == null ? (t !== void 0 && (t = `_scale(${n}, ${t})`), e.band && (t = (t ? t + "+" : "") + `_bandwidth(${n})` + (+e.band == 1 ? "" : "*" + SL(e.band)), e.extra && (t = `(datum.extra ? _scale(${n}, datum.extra.value) : ${t})`)), t == null && (t = "0")) : t = `lerp(_range(${n}), ${+e.range})`, t;
}
function EL(e) {
	let t = "";
	return e.forEach((e) => {
		let n = vL(e);
		t += e.test ? `(${e.test})?${n}:` : n;
	}), vu(t) === ":" && (t += "null"), t;
}
function DL(e, t, n, r, i, a) {
	let o = {};
	a = a || {}, a.encoders = { $encode: o }, e = hL(e, t, n, r, i.config);
	for (let n in e) o[n] = OL(e[n], t, a, i);
	return a;
}
function OL(e, t, n, r) {
	let i = {}, a = {};
	for (let t in e) e[t] != null && (i[t] = AL(kL(e[t]), r, n, a));
	return {
		$expr: {
			marktype: t,
			channels: i
		},
		$fields: Object.keys(a),
		$output: Object.keys(e)
	};
}
function kL(e) {
	return P(e) ? EL(e) : vL(e);
}
function AL(e, t, n, r) {
	let i = MF(e, t);
	return i.$fields.forEach((e) => r[e] = 1), qu(n, i.$params), i.$expr;
}
var jL = "outer", ML = [
	"value",
	"update",
	"init",
	"react",
	"bind"
];
function NL(e, t) {
	N(e + " for \"outer\" push: " + B(t));
}
function PL(e, t) {
	let n = e.name;
	if (e.push === jL) t.signals[n] || NL("No prior signal definition", n), ML.forEach((t) => {
		e[t] !== void 0 && NL("Invalid property ", t);
	});
	else {
		let r = t.addSignal(n, e.value);
		e.react === !1 && (r.react = !1), e.bind && t.addBinding(n, e.bind);
	}
}
function FL(e, t, n, r) {
	this.id = -1, this.type = e, this.value = t, this.params = n, r && (this.parent = r);
}
function IL(e, t, n, r) {
	return new FL(e, t, n, r);
}
function LL(e, t) {
	return IL("operator", e, t);
}
function G(e) {
	let t = { $ref: e.id };
	return e.id < 0 && (e.refs = e.refs || []).push(t), t;
}
function RL(e, t) {
	return t ? {
		$field: e,
		$name: t
	} : { $field: e };
}
var zL = RL("key");
function BL(e, t) {
	return {
		$compare: e,
		$order: t
	};
}
function VL(e, t) {
	let n = { $key: e };
	return t && (n.$flat = !0), n;
}
var HL = "ascending", UL = "descending";
function WL(e) {
	return F(e) ? (e.order === UL ? "-" : "+") + GL(e.op, e.field) : "";
}
function GL(e, t) {
	return (e && e.signal ? "$" + e.signal : e || "") + (e && t ? "_" : "") + (t && t.signal ? "$" + t.signal : t || "");
}
var KL = "scope", qL = "view";
function JL(e) {
	return e && e.signal;
}
function YL(e) {
	return e && e.expr;
}
function XL(e) {
	if (JL(e)) return !0;
	if (F(e)) {
		for (let t in e) if (XL(e[t])) return !0;
	}
	return !1;
}
function ZL(e, t) {
	return e == null ? t : e;
}
function QL(e) {
	return e && e.signal || e;
}
var $L = "timer";
function eR(e, t) {
	return (e.merge ? nR : e.stream ? rR : e.type ? iR : N("Invalid stream specification: " + B(e)))(e, t);
}
function tR(e) {
	return e === KL ? qL : e || qL;
}
function nR(e, t) {
	let n = aR({ merge: e.merge.map((e) => eR(e, t)) }, e, t);
	return t.addStream(n).id;
}
function rR(e, t) {
	let n = aR({ stream: eR(e.stream, t) }, e, t);
	return t.addStream(n).id;
}
function iR(e, t) {
	let n;
	e.type === $L ? (n = t.event($L, e.throttle), e = {
		between: e.between,
		filter: e.filter
	}) : n = t.event(tR(e.source), e.type);
	let r = aR({ stream: n }, e, t);
	return Object.keys(r).length === 1 ? n : t.addStream(r).id;
}
function aR(e, t, n) {
	let r = t.between;
	return r && (r.length !== 2 && N("Stream \"between\" parameter must have 2 entries: " + B(t)), e.between = [eR(r[0], n), eR(r[1], n)]), r = t.filter ? [].concat(t.filter) : [], (t.marktype || t.markname || t.markrole) && r.push(oR(t.marktype, t.markname, t.markrole)), t.source === KL && r.push("inScope(event.item)"), r.length && (e.filter = MF("(" + r.join(")&&(") + ")", n).$expr), (r = t.throttle) != null && (e.throttle = +r), (r = t.debounce) != null && (e.debounce = +r), t.consume && (e.consume = !0), e;
}
function oR(e, t, n) {
	let r = "event.item";
	return r + (e && e !== "*" ? "&&" + r + ".mark.marktype==='" + e + "'" : "") + (n ? "&&" + r + ".mark.role==='" + n + "'" : "") + (t ? "&&" + r + ".mark.name==='" + t + "'" : "");
}
var sR = {
	code: "_.$value",
	ast: {
		type: "Identifier",
		value: "value"
	}
};
function cR(e, t, n) {
	let r = e.encode, i = { target: n }, a = e.events, o = e.update, s = [];
	a || N("Signal update missing events specification."), z(a) && (a = PI(a, t.isSubscope() ? KL : qL)), a = I(a).filter((e) => e.signal || e.scale ? (s.push(e), 0) : 1), s.length > 1 && (s = [uR(s)]), a.length && s.push(a.length > 1 ? { merge: a } : a[0]), r != null && (o && N("Signal encode and update are mutually exclusive."), o = "encode(item()," + B(r) + ")"), i.update = z(o) ? MF(o, t) : o.expr == null ? o.value == null ? o.signal == null ? N("Invalid signal update specification.") : {
		$expr: sR,
		$params: { $value: t.signalRef(o.signal) }
	} : o.value : MF(o.expr, t), e.force && (i.options = { force: !0 }), s.forEach((e) => t.addUpdate(qu(lR(e, t), i)));
}
function lR(e, t) {
	return { source: e.signal ? t.signalRef(e.signal) : e.scale ? t.scaleRef(e.scale) : eR(e, t) };
}
function uR(e) {
	return { signal: "[" + e.map((e) => e.scale ? "scale(\"" + e.scale + "\")" : e.signal) + "]" };
}
function dR(e, t) {
	let n = t.getSignal(e.name), r = e.update;
	e.init && (r ? N("Signals can not include both init and update expressions.") : (r = e.init, n.initonly = !0)), r && (r = MF(r, t), n.update = r.$expr, n.params = r.$params), e.on && e.on.forEach((e) => cR(e, t, n.id));
}
var fR = (e) => (t, n, r) => IL(e, n, t || void 0, r), pR = fR("aggregate"), mR = fR("axisticks"), hR = fR("bound"), gR = fR("collect"), _R = fR("compare"), vR = fR("datajoin"), yR = fR("encode"), bR = fR("expression"), xR = fR("facet"), SR = fR("field"), CR = fR("key"), wR = fR("legendentries"), TR = fR("load"), ER = fR("mark"), DR = fR("multiextent"), OR = fR("multivalues"), kR = fR("overlap"), AR = fR("params"), jR = fR("prefacet"), MR = fR("projection"), NR = fR("proxy"), PR = fR("relay"), FR = fR("render"), IR = fR("scale"), LR = fR("sieve"), RR = fR("sortitems"), zR = fR("viewlayout"), BR = fR("values"), VR = 0, HR = {
	min: "min",
	max: "max",
	count: "sum"
};
function UR(e, t) {
	let n = e.type || "linear";
	wv(n) || N("Unrecognized scale type: " + B(n)), t.addScale(e.name, {
		type: n,
		domain: void 0
	});
}
function WR(e, t) {
	let n = t.getScale(e.name).params, r;
	for (r in n.domain = JR(e.domain, e, t), e.range != null && (n.range = oz(e, t, n)), e.interpolate != null && az(e.interpolate, n), e.nice != null && (n.nice = iz(e.nice, t)), e.bins != null && (n.bins = rz(e.bins, t)), e) L(n, r) || r === "name" || (n[r] = GR(e[r], t));
}
function GR(e, t) {
	return F(e) ? e.signal ? t.signalRef(e.signal) : N("Unsupported object: " + B(e)) : e;
}
function KR(e, t) {
	return e.signal ? t.signalRef(e.signal) : e.map((e) => GR(e, t));
}
function qR(e) {
	N("Can not find data set: " + B(e));
}
function JR(e, t, n) {
	if (!e) {
		(t.domainMin != null || t.domainMax != null) && N("No scale domain defined for domainMin/domainMax to override.");
		return;
	}
	return e.signal ? n.signalRef(e.signal) : (P(e) ? YR : e.fields ? ZR : XR)(e, t, n);
}
function YR(e, t, n) {
	return e.map((e) => GR(e, n));
}
function XR(e, t, n) {
	let r = n.getData(e.data);
	return r || qR(e.data), Dv(t.type) ? r.valuesRef(n, e.field, ez(e.sort, !1)) : Mv(t.type) ? r.domainRef(n, e.field) : r.extentRef(n, e.field);
}
function ZR(e, t, n) {
	let r = e.data, i = e.fields.reduce((e, t) => (t = z(t) ? {
		data: r,
		field: t
	} : P(t) || t.signal ? QR(t, n) : t, e.push(t), e), []);
	return (Dv(t.type) ? $R : Mv(t.type) ? tz : nz)(e, n, i);
}
function QR(e, t) {
	let n = "_:vega:_" + VR++, r = gR({});
	if (P(e)) r.value = { $ingest: e };
	else if (e.signal) {
		let i = "setdata(" + B(n) + "," + e.signal + ")";
		r.params.input = t.signalRef(i);
	}
	return t.addDataPipeline(n, [r, LR({})]), {
		data: n,
		field: "data"
	};
}
function $R(e, t, n) {
	let r = ez(e.sort, !0), i, a, o = {
		groupby: zL,
		pulse: n.map((e) => {
			let n = t.getData(e.data);
			return n || qR(e.data), n.countsRef(t, e.field, r);
		})
	};
	r && (i = r.op || "count", a = r.field ? GL(i, r.field) : "count", o.ops = [HR[i]], o.fields = [t.fieldRef(a)], o.as = [a]), i = t.add(pR(o));
	let s = t.add(gR({ pulse: G(i) }));
	return a = t.add(BR({
		field: zL,
		sort: t.sortRef(r),
		pulse: G(s)
	})), G(a);
}
function ez(e, t) {
	return e && (!e.field && !e.op ? F(e) ? e.field = "key" : e = { field: "key" } : !e.field && e.op !== "count" ? N("No field provided for sort aggregate op: " + e.op) : t && e.field && e.op && !HR[e.op] && N("Multiple domain scales can not be sorted using " + e.op)), e;
}
function tz(e, t, n) {
	let r = n.map((e) => {
		let n = t.getData(e.data);
		return n || qR(e.data), n.domainRef(t, e.field);
	});
	return G(t.add(OR({ values: r })));
}
function nz(e, t, n) {
	let r = n.map((e) => {
		let n = t.getData(e.data);
		return n || qR(e.data), n.extentRef(t, e.field);
	});
	return G(t.add(DR({ extents: r })));
}
function rz(e, t) {
	return e.signal || P(e) ? KR(e, t) : t.objectProperty(e);
}
function iz(e, t) {
	return e.signal ? t.signalRef(e.signal) : F(e) ? {
		interval: GR(e.interval),
		step: GR(e.step)
	} : GR(e);
}
function az(e, t) {
	t.interpolate = GR(e.type || e), e.gamma != null && (t.interpolateGamma = GR(e.gamma));
}
function oz(e, t, n) {
	let r = t.config.range, i = e.range;
	if (i.signal) return t.signalRef(i.signal);
	if (z(i)) {
		if (r && L(r, i)) return e = qu({}, e, { range: r[i] }), oz(e, t, n);
		i === "width" ? i = [0, { signal: "width" }] : i === "height" ? i = Dv(e.type) ? [0, { signal: "height" }] : [{ signal: "height" }, 0] : N("Unrecognized scale range value: " + B(i));
	} else if (i.scheme) {
		n.scheme = P(i.scheme) ? KR(i.scheme, t) : GR(i.scheme, t), i.extent && (n.schemeExtent = KR(i.extent, t)), i.count && (n.schemeCount = GR(i.count, t));
		return;
	} else if (i.step) {
		n.rangeStep = GR(i.step, t);
		return;
	} else if (Dv(e.type) && !P(i)) return JR(i, e, t);
	else P(i) || N("Unsupported range type: " + B(i));
	return i.map((e) => (P(e) ? KR : GR)(e, t));
}
function sz(e, t) {
	let n = t.config.projection || {}, r = {};
	for (let n in e) n !== "name" && (r[n] = cz(e[n], n, t));
	for (let e in n) r[e] == null && (r[e] = cz(n[e], e, t));
	t.addProjection(e.name, r);
}
function cz(e, t, n) {
	return P(e) ? e.map((e) => cz(e, t, n)) : F(e) ? e.signal ? n.signalRef(e.signal) : t === "fit" ? e : N("Unsupported parameter object: " + B(e)) : e;
}
var lz = "top", uz = "left", dz = "right", fz = "bottom", pz = "center", mz = "vertical", hz = "start", gz = "middle", _z = "end", vz = "index", yz = "label", bz = "offset", xz = "perc", Sz = "value", Cz = "guide-label", wz = "guide-title", Tz = "group-title", Ez = "group-subtitle", Dz = "symbol", Oz = "gradient", kz = "discrete", Az = "size", jz = [
	Az,
	"shape",
	"fill",
	"stroke",
	"strokeWidth",
	"strokeDash",
	"opacity"
], Mz = {
	name: 1,
	style: 1,
	interactive: 1
}, Nz = { value: 0 }, Pz = { value: 1 }, Fz = "group", Iz = "rect", Lz = "rule", Rz = "symbol", zz = "text";
function Bz(e) {
	return e.type = Fz, e.interactive = e.interactive || !1, e;
}
function Vz(e, t) {
	let n = (n, r) => ZL(e[n], ZL(t[n], r));
	return n.isVertical = (n) => mz === ZL(e.direction, t.direction || (n ? t.symbolDirection : t.gradientDirection)), n.gradientLength = () => ZL(e.gradientLength, t.gradientLength || t.gradientWidth), n.gradientThickness = () => ZL(e.gradientThickness, t.gradientThickness || t.gradientHeight), n.entryColumns = () => ZL(e.columns, ZL(t.columns, +n.isVertical(!0))), n;
}
function Hz(e, t) {
	let n = t && (t.update && t.update[e] || t.enter && t.enter[e]);
	return n && n.signal ? n : n ? n.value : null;
}
function Uz(e, t, n) {
	let r = t.config.style[n];
	return r && r[e];
}
function Wz(e, t, n) {
	return `item.anchor === '${hz}' ? ${e} : item.anchor === '${_z}' ? ${t} : ${n}`;
}
var Gz = Wz(B(uz), B(dz), B(pz));
function Kz(e) {
	let t = e("tickBand"), n = e("tickOffset"), r, i;
	return t ? t.signal ? (r = { signal: `(${t.signal}) === 'extent' ? 1 : 0.5` }, i = { signal: `(${t.signal}) === 'extent'` }, F(n) || (n = { signal: `(${t.signal}) === 'extent' ? 0 : ${n}` })) : t === "extent" ? (r = 1, i = !0, n = 0) : (r = .5, i = !1) : (r = e("bandPosition"), i = e("tickExtra")), {
		extra: i,
		band: r,
		offset: n
	};
}
function qz(e, t) {
	return t ? e ? F(e) ? Object.assign({}, e, { offset: qz(e.offset, t) }) : {
		value: e,
		offset: t
	} : t : e;
}
function Jz(e, t) {
	return t ? (e.name = t.name, e.style = t.style || e.style, e.interactive = !!t.interactive, e.encode = YI(e.encode, t, Mz)) : e.interactive = !1, e;
}
function Yz(e, t, n, r) {
	let i = Vz(e, n), a = i.isVertical(), o = i.gradientThickness(), s = i.gradientLength(), c, l, u, d, f;
	a ? (l = [0, 1], u = [0, 0], d = o, f = s) : (l = [0, 0], u = [1, 0], d = s, f = o);
	let p = {
		enter: c = {
			opacity: Nz,
			x: Nz,
			y: Nz,
			width: KI(d),
			height: KI(f)
		},
		update: qu({}, c, {
			opacity: Pz,
			fill: {
				gradient: t,
				start: l,
				stop: u
			}
		}),
		exit: { opacity: Nz }
	};
	return JI(p, {
		stroke: i("gradientStrokeColor"),
		strokeWidth: i("gradientStrokeWidth")
	}, { opacity: i("gradientOpacity") }), Jz({
		type: Iz,
		role: cL,
		encode: p
	}, r);
}
function Xz(e, t, n, r, i) {
	let a = Vz(e, n), o = a.isVertical(), s = a.gradientThickness(), c = a.gradientLength(), l, u, d, f, p = "";
	o ? (l = "y", d = "y2", u = "x", f = "width", p = "1-") : (l = "x", d = "x2", u = "y", f = "height");
	let m = {
		opacity: Nz,
		fill: {
			scale: t,
			field: Sz
		}
	};
	m[l] = {
		signal: p + "datum.perc",
		mult: c
	}, m[u] = Nz, m[d] = {
		signal: p + "datum.perc2",
		mult: c
	}, m[f] = KI(s);
	let h = {
		enter: m,
		update: qu({}, m, { opacity: Pz }),
		exit: { opacity: Nz }
	};
	return JI(h, {
		stroke: a("gradientStrokeColor"),
		strokeWidth: a("gradientStrokeWidth")
	}, { opacity: a("gradientOpacity") }), Jz({
		type: Iz,
		role: oL,
		key: Sz,
		from: i,
		encode: h
	}, r);
}
var Zz = `datum.${xz}<=0?"${uz}":datum.${xz}>=1?"${dz}":"${pz}"`, Qz = `datum.${xz}<=0?"${fz}":datum.${xz}>=1?"${lz}":"${gz}"`;
function $z(e, t, n, r) {
	let i = Vz(e, t), a = i.isVertical(), o = KI(i.gradientThickness()), s = i.gradientLength(), c = i("labelOverlap"), l, u, d, f, p = "", m = {
		enter: l = { opacity: Nz },
		update: u = {
			opacity: Pz,
			text: { field: yz }
		},
		exit: { opacity: Nz }
	};
	return JI(m, {
		fill: i("labelColor"),
		fillOpacity: i("labelOpacity"),
		font: i("labelFont"),
		fontSize: i("labelFontSize"),
		fontStyle: i("labelFontStyle"),
		fontWeight: i("labelFontWeight"),
		limit: ZL(e.labelLimit, t.gradientLabelLimit)
	}), a ? (l.align = { value: "left" }, l.baseline = u.baseline = { signal: Qz }, d = "y", f = "x", p = "1-") : (l.align = u.align = { signal: Zz }, l.baseline = { value: "top" }, d = "x", f = "y"), l[d] = u[d] = {
		signal: p + "datum.perc",
		mult: s
	}, l[f] = u[f] = o, o.offset = ZL(e.labelOffset, t.gradientLabelOffset) || 0, c = c ? {
		separation: i("labelSeparation"),
		method: c,
		order: "datum." + vz
	} : void 0, Jz({
		type: zz,
		role: lL,
		style: Cz,
		key: Sz,
		from: r,
		encode: m,
		overlap: c
	}, n);
}
function eB(e, t, n, r, i) {
	let a = Vz(e, t), o = n.entries, s = !!(o && o.interactive), c = o ? o.name : void 0, l = a("clipHeight"), u = a("symbolOffset"), d = { data: "value" }, f = `(${i}) ? datum.${bz} : datum.${Az}`, p = l ? KI(l) : { field: Az }, m = `datum.${vz}`, h = `max(1, ${i})`, g, _, v, y, b;
	p.mult = .5, g = {
		enter: _ = {
			opacity: Nz,
			x: {
				signal: f,
				mult: .5,
				offset: u
			},
			y: p
		},
		update: v = {
			opacity: Pz,
			x: _.x,
			y: _.y
		},
		exit: { opacity: Nz }
	};
	let x = null, S = null;
	e.fill || (x = t.symbolBaseFillColor, S = t.symbolBaseStrokeColor), JI(g, {
		fill: a("symbolFillColor", x),
		shape: a("symbolType"),
		size: a("symbolSize"),
		stroke: a("symbolStrokeColor", S),
		strokeDash: a("symbolDash"),
		strokeDashOffset: a("symbolDashOffset"),
		strokeWidth: a("symbolStrokeWidth")
	}, { opacity: a("symbolOpacity") }), jz.forEach((t) => {
		e[t] && (v[t] = _[t] = {
			scale: e[t],
			field: Sz
		});
	});
	let C = Jz({
		type: Rz,
		role: uL,
		key: Sz,
		from: d,
		clip: l ? !0 : void 0,
		encode: g
	}, n.symbols), w = KI(u);
	w.offset = a("labelOffset"), g = {
		enter: _ = {
			opacity: Nz,
			x: {
				signal: f,
				offset: w
			},
			y: p
		},
		update: v = {
			opacity: Pz,
			text: { field: yz },
			x: _.x,
			y: _.y
		},
		exit: { opacity: Nz }
	}, JI(g, {
		align: a("labelAlign"),
		baseline: a("labelBaseline"),
		fill: a("labelColor"),
		fillOpacity: a("labelOpacity"),
		font: a("labelFont"),
		fontSize: a("labelFontSize"),
		fontStyle: a("labelFontStyle"),
		fontWeight: a("labelFontWeight"),
		limit: a("labelLimit")
	});
	let T = Jz({
		type: zz,
		role: lL,
		style: Cz,
		key: Sz,
		from: d,
		encode: g
	}, n.labels);
	return g = {
		enter: {
			noBound: { value: !l },
			width: Nz,
			height: l ? KI(l) : Nz,
			opacity: Nz
		},
		exit: { opacity: Nz },
		update: v = {
			opacity: Pz,
			row: { signal: null },
			column: { signal: null }
		}
	}, a.isVertical(!0) ? (y = `ceil(item.mark.items.length / ${h})`, v.row.signal = `${m}%${y}`, v.column.signal = `floor(${m} / ${y})`, b = { field: ["row", m] }) : (v.row.signal = `floor(${m} / ${h})`, v.column.signal = `${m} % ${h}`, b = { field: m }), v.column.signal = `(${i})?${v.column.signal}:${m}`, r = { facet: {
		data: r,
		name: "value",
		groupby: vz
	} }, Bz({
		role: QI,
		from: r,
		encode: YI(g, o, Mz),
		marks: [C, T],
		name: c,
		interactive: s,
		sort: b
	});
}
function tB(e, t) {
	let n = Vz(e, t);
	return {
		align: n("gridAlign"),
		columns: n.entryColumns(),
		center: {
			row: !0,
			column: !1
		},
		padding: {
			row: n("rowPadding"),
			column: n("columnPadding")
		}
	};
}
var nB = "item.orient === \"left\"", rB = "item.orient === \"right\"", iB = `(${nB} || ${rB})`, aB = `datum.vgrad && ${iB}`, oB = Wz("\"top\"", "\"bottom\"", "\"middle\""), sB = `datum.vgrad && ${rB} ? (${Wz("\"right\"", "\"left\"", "\"center\"")}) : (${iB} && !(datum.vgrad && ${nB})) ? "left" : ${Gz}`, cB = `item._anchor || (${iB} ? "middle" : "start")`, lB = `${aB} ? (${nB} ? -90 : 90) : 0`, uB = `${iB} ? (datum.vgrad ? (${rB} ? "bottom" : "top") : ${oB}) : "top"`;
function dB(e, t, n, r) {
	let i = Vz(e, t), a = {
		enter: { opacity: Nz },
		update: {
			opacity: Pz,
			x: { field: { group: "padding" } },
			y: { field: { group: "padding" } }
		},
		exit: { opacity: Nz }
	};
	return JI(a, {
		orient: i("titleOrient"),
		_anchor: i("titleAnchor"),
		anchor: { signal: cB },
		angle: { signal: lB },
		align: { signal: sB },
		baseline: { signal: uB },
		text: e.title,
		fill: i("titleColor"),
		fillOpacity: i("titleOpacity"),
		font: i("titleFont"),
		fontSize: i("titleFontSize"),
		fontStyle: i("titleFontStyle"),
		fontWeight: i("titleFontWeight"),
		limit: i("titleLimit"),
		lineHeight: i("titleLineHeight")
	}, {
		align: i("titleAlign"),
		baseline: i("titleBaseline")
	}), Jz({
		type: zz,
		role: dL,
		style: wz,
		from: r,
		encode: a
	}, n);
}
function fB(e, t) {
	let n;
	return F(e) && (e.signal ? n = e.signal : e.path ? n = "pathShape(" + pB(e.path) + ")" : e.sphere && (n = "geoShape(" + pB(e.sphere) + ", {type: \"Sphere\"})")), n ? t.signalRef(n) : !!e;
}
function pB(e) {
	return F(e) && e.signal ? e.signal : B(e);
}
function mB(e) {
	let t = e.role || "";
	return t.startsWith("axis") || t.startsWith("legend") || t.startsWith("title") ? t : e.type === Fz ? QI : t || "mark";
}
function hB(e) {
	return {
		marktype: e.type,
		name: e.name || void 0,
		role: e.role || mB(e),
		zindex: +e.zindex || void 0,
		aria: e.aria,
		description: e.description
	};
}
function gB(e, t) {
	return e && e.signal ? t.signalRef(e.signal) : e !== !1;
}
function _B(e, t) {
	let n = Um(e.type);
	n || N("Unrecognized transform type: " + B(e.type));
	let r = IL(n.type.toLowerCase(), null, vB(n, e, t));
	return e.signal && t.addSignal(e.signal, t.proxy(r)), r.metadata = n.metadata || {}, r;
}
function vB(e, t, n) {
	let r = {}, i = e.params.length;
	for (let a = 0; a < i; ++a) {
		let i = e.params[a];
		r[i.name] = yB(i, t, n);
	}
	return r;
}
function yB(e, t, n) {
	let r = e.type, i = t[e.name];
	if (r === "index") return xB(e, t, n);
	if (i === void 0) {
		e.required && N("Missing required " + B(t.type) + " parameter: " + B(e.name));
		return;
	} else if (r === "param") return SB(e, t, n);
	else if (r === "projection") return n.projectionRef(t[e.name]);
	return e.array && !JL(i) ? i.map((t) => bB(e, t, n)) : bB(e, i, n);
}
function bB(e, t, n) {
	let r = e.type;
	if (JL(t)) return DB(r) ? N("Expression references can not be signals.") : OB(r) ? n.fieldRef(t) : kB(r) ? n.compareRef(t) : n.signalRef(t.signal);
	{
		let i = e.expr || OB(r);
		return i && wB(t) ? n.exprRef(t.expr, t.as) : i && TB(t) ? RL(t.field, t.as) : DB(r) ? MF(t, n) : EB(r) ? G(n.getData(t).values) : OB(r) ? RL(t) : kB(r) ? n.compareRef(t) : t;
	}
}
function xB(e, t, n) {
	return z(t.from) || N("Lookup \"from\" parameter must be a string literal."), n.getData(t.from).lookupRef(n, t.key);
}
function SB(e, t, n) {
	let r = t[e.name];
	return e.array ? (P(r) || N("Expected an array of sub-parameters. Instead: " + B(r)), r.map((t) => CB(e, t, n))) : CB(e, r, n);
}
function CB(e, t, n) {
	let r = e.params.length, i;
	for (let n = 0; n < r; ++n) {
		i = e.params[n];
		for (let e in i.key) if (i.key[e] !== t[e]) {
			i = null;
			break;
		}
		if (i) break;
	}
	i || N("Unsupported parameter: " + B(t));
	let a = qu(vB(i, t, n), i.key);
	return G(n.add(AR(a)));
}
var wB = (e) => e && e.expr, TB = (e) => e && e.field, EB = (e) => e === "data", DB = (e) => e === "expr", OB = (e) => e === "field", kB = (e) => e === "compare";
function AB(e, t, n) {
	let r, i, a, o, s;
	return e ? (r = e.facet) && (t || N("Only group marks can be faceted."), r.field == null ? (e.data ? s = G(n.getData(e.data).aggregate) : (a = _B(qu({
		type: "aggregate",
		groupby: I(r.groupby)
	}, r.aggregate), n), a.params.key = n.keyRef(r.groupby), a.params.pulse = jB(r, n), o = s = G(n.add(a))), i = n.keyRef(r.groupby, !0)) : o = s = jB(r, n)) : o = G(n.add(gR(null, [{}]))), o || (o = jB(e, n)), {
		key: i,
		pulse: o,
		parent: s
	};
}
function jB(e, t) {
	return e.$ref ? e : e.data && e.data.$ref ? e.data : G(t.getData(e.data).output);
}
function MB(e, t, n, r, i) {
	this.scope = e, this.input = t, this.output = n, this.values = r, this.aggregate = i, this.index = {};
}
MB.fromEntries = function(e, t) {
	let n = t.length, r = t[n - 1], i = t[n - 2], a = t[0], o = null, s = 1;
	for (a && a.type === "load" && (a = t[1]), e.add(t[0]); s < n; ++s) t[s].params.pulse = G(t[s - 1]), e.add(t[s]), t[s].type === "aggregate" && (o = t[s]);
	return new MB(e, a, i, r, o);
};
function NB(e) {
	return z(e) ? e : null;
}
function PB(e, t, n) {
	let r = GL(n.op, n.field), i;
	if (t.ops) {
		for (let e = 0, n = t.as.length; e < n; ++e) if (t.as[e] === r) return;
	} else t.ops = ["count"], t.fields = [null], t.as = ["count"];
	n.op && (t.ops.push((i = n.op.signal) ? e.signalRef(i) : n.op), t.fields.push(e.fieldRef(n.field)), t.as.push(r));
}
function FB(e, t, n, r, i, a, o) {
	let s = t[n] || (t[n] = {}), c = WL(a), l = NB(i), u, d;
	if (l != null && (e = t.scope, l += c ? "|" + c : "", u = s[l]), !u) {
		let n = a ? {
			field: zL,
			pulse: t.countsRef(e, i, a)
		} : {
			field: e.fieldRef(i),
			pulse: G(t.output)
		};
		c && (n.sort = e.sortRef(a)), d = e.add(IL(r, void 0, n)), o && (t.index[i] = d), u = G(d), l != null && (s[l] = u);
	}
	return u;
}
MB.prototype = {
	countsRef(e, t, n) {
		let r = this, i = r.counts || (r.counts = {}), a = NB(t), o, s, c;
		return a != null && (e = r.scope, o = i[a]), o ? n && n.field && PB(e, o.agg.params, n) : (c = {
			groupby: e.fieldRef(t, "key"),
			pulse: G(r.output)
		}, n && n.field && PB(e, c, n), s = e.add(pR(c)), o = e.add(gR({ pulse: G(s) })), o = {
			agg: s,
			ref: G(o)
		}, a != null && (i[a] = o)), o.ref;
	},
	tuplesRef() {
		return G(this.values);
	},
	extentRef(e, t) {
		return FB(e, this, "extent", "extent", t, !1);
	},
	domainRef(e, t) {
		return FB(e, this, "domain", "values", t, !1);
	},
	valuesRef(e, t, n) {
		return FB(e, this, "vals", "values", t, n || !0);
	},
	lookupRef(e, t) {
		return FB(e, this, "lookup", "tupleindex", t, !1);
	},
	indataRef(e, t) {
		return FB(e, this, "indata", "tupleindex", t, !0, !0);
	}
};
function IB(e, t, n) {
	let r = e.from.facet, i = r.name, a = jB(r, t), o;
	r.name || N("Facet must have a name: " + B(r)), r.data || N("Facet must reference a data set: " + B(r)), r.field ? o = t.add(jR({
		field: t.fieldRef(r.field),
		pulse: a
	})) : r.groupby ? o = t.add(xR({
		key: t.keyRef(r.groupby),
		group: G(t.proxy(n.parent)),
		pulse: a
	})) : N("Facet must specify groupby or field: " + B(r));
	let s = t.fork(), c = s.add(gR()), l = s.add(LR({ pulse: G(c) }));
	s.addData(i, new MB(s, c, c, l)), s.addSignal("parent", null), o.params.subflow = { $subflow: s.parse(e).toRuntime() };
}
function LB(e, t, n) {
	let r = t.add(jR({ pulse: n.pulse })), i = t.fork();
	i.add(LR()), i.addSignal("parent", null), r.params.subflow = { $subflow: i.parse(e).toRuntime() };
}
function RB(e, t, n) {
	let r = e.remove, i = e.insert, a = e.toggle, o = e.modify, s = e.values, c = t.add(LL()), l = MF("if(" + e.trigger + ",modify(\"" + n + "\"," + [
		i,
		r,
		a,
		o,
		s
	].map((e) => e == null ? "null" : e).join(",") + "),0)", t);
	c.update = l.$expr, c.params = l.$params;
}
function zB(e, t) {
	let n = mB(e), r = e.type === Fz, i = e.from && e.from.facet, a = e.overlap, o = e.layout || n === "scope" || n === "frame", s, c, l, u, d, f, p, m = n === "mark" || o || i, h = AB(e.from, r, t);
	c = t.add(vR({
		key: h.key || (e.key ? RL(e.key) : void 0),
		pulse: h.pulse,
		clean: !r
	}));
	let g = G(c);
	c = l = t.add(gR({ pulse: g })), c = t.add(ER({
		markdef: hB(e),
		interactive: gB(e.interactive, t),
		clip: fB(e.clip, t),
		context: { $context: !0 },
		groups: t.lookup(),
		parent: t.signals.parent ? t.signalRef("parent") : null,
		index: t.markpath(),
		pulse: G(c)
	}));
	let _ = G(c);
	c = u = t.add(yR(DL(e.encode, e.type, n, e.style, t, {
		mod: !1,
		pulse: _
	}))), c.params.parent = t.encode(), e.transform && e.transform.forEach((e) => {
		let n = _B(e, t), r = n.metadata;
		(r.generates || r.changes) && N("Mark transforms should not generate new data."), r.nomod || (u.params.mod = !0), n.params.pulse = G(c), t.add(c = n);
	}), e.sort && (c = t.add(RR({
		sort: t.compareRef(e.sort),
		pulse: G(c)
	})));
	let v = G(c);
	(i || o) && (o = t.add(zR({
		layout: t.objectProperty(e.layout),
		legends: t.legends,
		mark: _,
		pulse: v
	})), f = G(o));
	let y = t.add(hR({
		mark: _,
		pulse: f || v
	}));
	p = G(y), r && (m && (s = t.operators, s.pop(), o && s.pop()), t.pushState(v, f || p, g), i ? IB(e, t, h) : m ? LB(e, t, h) : t.parse(e), t.popState(), m && (o && s.push(o), s.push(y))), a && (p = BB(a, p, t));
	let b = t.add(FR({ pulse: p })), x = t.add(LR({ pulse: G(b) }, void 0, t.parent()));
	e.name != null && (d = e.name, t.addData(d, new MB(t, l, b, x)), e.on && e.on.forEach((e) => {
		(e.insert || e.remove || e.toggle) && N("Marks only support modify triggers."), RB(e, t, d);
	}));
}
function BB(e, t, n) {
	let r = e.method, i = e.bound, a = e.separation, o = {
		separation: JL(a) ? n.signalRef(a.signal) : a,
		method: JL(r) ? n.signalRef(r.signal) : r,
		pulse: t
	};
	if (e.order && (o.sort = n.compareRef({ field: e.order })), i) {
		let e = i.tolerance;
		o.boundTolerance = JL(e) ? n.signalRef(e.signal) : +e, o.boundScale = n.scaleRef(i.scale), o.boundOrient = i.orient;
	}
	return G(n.add(kR(o)));
}
function VB(e, t) {
	let n = t.config.legend, r = e.encode || {}, i = Vz(e, n), a = r.legend || {}, o = a.name || void 0, s = a.interactive, c = a.style, l = {}, u = 0, d, f, p;
	jz.forEach((t) => e[t] ? (l[t] = e[t], u = u || e[t]) : 0), u || N("Missing valid scale for legend.");
	let m = HB(e, t.scaleType(u)), h = {
		title: e.title != null,
		scales: l,
		type: m,
		vgrad: m !== "symbol" && i.isVertical()
	}, g = G(t.add(gR(null, [h]))), _ = { enter: {
		x: { value: 0 },
		y: { value: 0 }
	} }, v = G(t.add(wR(f = {
		type: m,
		scale: t.scaleRef(u),
		count: t.objectProperty(i("tickCount")),
		limit: t.property(i("symbolLimit")),
		values: t.objectProperty(e.values),
		minstep: t.property(e.tickMinStep),
		formatType: t.property(e.formatType),
		formatSpecifier: t.property(e.format)
	})));
	return m === Oz ? (p = [Yz(e, u, n, r.gradient), $z(e, n, r.labels, v)], f.count = f.count || t.signalRef(`max(2,2*floor((${QL(i.gradientLength())})/100))`)) : m === kz ? p = [Xz(e, u, n, r.gradient, v), $z(e, n, r.labels, v)] : (d = tB(e, n), p = [eB(e, n, r, v, QL(d.columns))], f.size = GB(e, t, p[0].marks)), p = [Bz({
		role: sL,
		from: g,
		encode: _,
		marks: p,
		layout: d,
		interactive: s
	})], h.title && p.push(dB(e, n, r.title, g)), zB(Bz({
		role: aL,
		from: g,
		encode: YI(WB(i, e, n), a, Mz),
		marks: p,
		aria: i("aria"),
		description: i("description"),
		zindex: i("zindex"),
		name: o,
		interactive: s,
		style: c
	}), t);
}
function HB(e, t) {
	let n = e.type || Dz;
	return !e.type && UB(e) === 1 && (e.fill || e.stroke) && (n = Ev(t) ? Oz : Ov(t) ? kz : Dz), n === Oz ? Ov(t) ? kz : Oz : n;
}
function UB(e) {
	return jz.reduce((t, n) => t + +!!e[n], 0);
}
function WB(e, t, n) {
	let r = {
		enter: {},
		update: {}
	};
	return JI(r, {
		orient: e("orient"),
		offset: e("offset"),
		padding: e("padding"),
		titlePadding: e("titlePadding"),
		cornerRadius: e("cornerRadius"),
		fill: e("fillColor"),
		stroke: e("strokeColor"),
		strokeWidth: n.strokeWidth,
		strokeDash: n.strokeDash,
		x: e("legendX"),
		y: e("legendY"),
		format: t.format,
		formatType: t.formatType
	}), r;
}
function GB(e, t, n) {
	return MF(`max(ceil(sqrt(${QL(KB("size", e, n))})+${QL(KB("strokeWidth", e, n))}),${QL(qB(n[1].encode, t, Cz))})`, t);
}
function KB(e, t, n) {
	return t[e] ? `scale("${t[e]}",datum)` : Hz(e, n[0].encode);
}
function qB(e, t, n) {
	return Hz("fontSize", e) || Uz("fontSize", t, n);
}
var JB = `item.orient==="${uz}"?-90:item.orient==="${dz}"?90:0`;
function YB(e, t) {
	e = z(e) ? { text: e } : e;
	let n = Vz(e, t.config.title), r = e.encode || {}, i = r.group || {}, a = i.name || void 0, o = i.interactive, s = i.style, c = [], l = G(t.add(gR(null, [{}])));
	return c.push(QB(e, n, XB(e), l)), e.subtitle && c.push($B(e, n, r.subtitle, l)), zB(Bz({
		role: fL,
		from: l,
		encode: ZB(n, i),
		marks: c,
		aria: n("aria"),
		description: n("description"),
		zindex: n("zindex"),
		name: a,
		interactive: o,
		style: s
	}), t);
}
function XB(e) {
	let t = e.encode;
	return t && t.title || qu({
		name: e.name,
		interactive: e.interactive,
		style: e.style
	}, t);
}
function ZB(e, t) {
	let n = {
		enter: {},
		update: {}
	};
	return JI(n, {
		orient: e("orient"),
		anchor: e("anchor"),
		align: { signal: Gz },
		angle: { signal: JB },
		limit: e("limit"),
		frame: e("frame"),
		offset: e("offset") || 0,
		padding: e("subtitlePadding")
	}), YI(n, t, Mz);
}
function QB(e, t, n, r) {
	let i = { value: 0 }, a = e.text, o = {
		enter: { opacity: i },
		update: { opacity: { value: 1 } },
		exit: { opacity: i }
	};
	return JI(o, {
		text: a,
		align: { signal: "item.mark.group.align" },
		angle: { signal: "item.mark.group.angle" },
		limit: { signal: "item.mark.group.limit" },
		baseline: "top",
		dx: t("dx"),
		dy: t("dy"),
		fill: t("color"),
		font: t("font"),
		fontSize: t("fontSize"),
		fontStyle: t("fontStyle"),
		fontWeight: t("fontWeight"),
		lineHeight: t("lineHeight")
	}, {
		align: t("align"),
		angle: t("angle"),
		baseline: t("baseline")
	}), Jz({
		type: zz,
		role: pL,
		style: Tz,
		from: r,
		encode: o
	}, n);
}
function $B(e, t, n, r) {
	let i = { value: 0 }, a = e.subtitle, o = {
		enter: { opacity: i },
		update: { opacity: { value: 1 } },
		exit: { opacity: i }
	};
	return JI(o, {
		text: a,
		align: { signal: "item.mark.group.align" },
		angle: { signal: "item.mark.group.angle" },
		limit: { signal: "item.mark.group.limit" },
		baseline: "top",
		dx: t("dx"),
		dy: t("dy"),
		fill: t("subtitleColor"),
		font: t("subtitleFont"),
		fontSize: t("subtitleFontSize"),
		fontStyle: t("subtitleFontStyle"),
		fontWeight: t("subtitleFontWeight"),
		lineHeight: t("subtitleLineHeight")
	}, {
		align: t("align"),
		angle: t("angle"),
		baseline: t("baseline")
	}), Jz({
		type: zz,
		role: mL,
		style: Ez,
		from: r,
		encode: o
	}, n);
}
function eV(e, t) {
	let n = [];
	e.transform && e.transform.forEach((e) => {
		n.push(_B(e, t));
	}), e.on && e.on.forEach((n) => {
		RB(n, t, e.name);
	}), t.addDataPipeline(e.name, tV(e, t, n));
}
function tV(e, t, n) {
	let r = [], i = null, a = !1, o = !1, s, c, l, u, d;
	for (e.values ? JL(e.values) || XL(e.format) ? (r.push(rV(t, e)), r.push(i = nV())) : r.push(i = nV({
		$ingest: e.values,
		$format: e.format
	})) : e.url ? XL(e.url) || XL(e.format) ? (r.push(rV(t, e)), r.push(i = nV())) : r.push(i = nV({
		$request: e.url,
		$format: e.format
	})) : e.source && (i = s = I(e.source).map((e) => G(t.getData(e).output)), r.push(null)), c = 0, l = n.length; c < l; ++c) u = n[c], d = u.metadata, !i && !d.source && r.push(i = nV()), r.push(u), d.generates && (o = !0), d.modifies && !o && (a = !0), d.source ? i = u : d.changes && (i = null);
	return s && (l = s.length - 1, r[0] = PR({
		derive: a,
		pulse: l ? s : s[0]
	}), (a || l) && r.splice(1, 0, nV())), i || r.push(nV()), r.push(LR({})), r;
}
function nV(e) {
	let t = gR({}, e);
	return t.metadata = { source: !0 }, t;
}
function rV(e, t) {
	return TR({
		url: t.url ? e.property(t.url) : void 0,
		async: t.async ? e.property(t.async) : void 0,
		values: t.values ? e.property(t.values) : void 0,
		format: e.objectProperty(t.format)
	});
}
var iV = (e) => e === fz || e === lz, aV = (e, t, n) => JL(e) ? fV(e.signal, t, n) : e === uz || e === lz ? t : n, oV = (e, t, n) => JL(e) ? uV(e.signal, t, n) : iV(e) ? t : n, sV = (e, t, n) => JL(e) ? dV(e.signal, t, n) : iV(e) ? n : t, cV = (e, t, n) => JL(e) ? pV(e.signal, t, n) : e === lz ? { value: t } : { value: n }, lV = (e, t, n) => JL(e) ? mV(e.signal, t, n) : e === dz ? { value: t } : { value: n }, uV = (e, t, n) => hV(`${e} === '${lz}' || ${e} === '${fz}'`, t, n), dV = (e, t, n) => hV(`${e} !== '${lz}' && ${e} !== '${fz}'`, t, n), fV = (e, t, n) => _V(`${e} === '${uz}' || ${e} === '${lz}'`, t, n), pV = (e, t, n) => _V(`${e} === '${lz}'`, t, n), mV = (e, t, n) => _V(`${e} === '${dz}'`, t, n), hV = (e, t, n) => (t = t == null ? t : KI(t), n = n == null ? n : KI(n), gV(t) && gV(n) ? (t = t ? t.signal || B(t.value) : null, n = n ? n.signal || B(n.value) : null, { signal: `${e} ? (${t}) : (${n})` }) : [qu({ test: e }, t)].concat(n || [])), gV = (e) => e == null || Object.keys(e).length === 1, _V = (e, t, n) => ({ signal: `${e} ? (${yV(t)}) : (${yV(n)})` }), vV = (e, t, n, r, i) => ({ signal: (r == null ? "" : `${e} === '${uz}' ? (${yV(r)}) : `) + (n == null ? "" : `${e} === '${fz}' ? (${yV(n)}) : `) + (i == null ? "" : `${e} === '${dz}' ? (${yV(i)}) : `) + (t == null ? "" : `${e} === '${lz}' ? (${yV(t)}) : `) + "(null)" }), yV = (e) => JL(e) ? e.signal : e == null ? null : B(e), bV = (e, t) => t === 0 ? 0 : JL(e) ? { signal: `(${e.signal}) * ${t}` } : { value: e * t }, xV = (e, t) => {
	let n = e.signal;
	return n && n.endsWith("(null)") ? { signal: n.slice(0, -6) + t.signal } : e;
};
function SV(e, t, n, r) {
	let i;
	if (t && L(t, e)) return t[e];
	if (L(n, e)) return n[e];
	if (e.startsWith("title")) {
		switch (e) {
			case "titleColor":
				i = "fill";
				break;
			case "titleFont":
			case "titleFontSize":
			case "titleFontWeight": i = e[5].toLowerCase() + e.slice(6);
		}
		return r[wz][i];
	} else if (e.startsWith("label")) {
		switch (e) {
			case "labelColor":
				i = "fill";
				break;
			case "labelFont":
			case "labelFontSize": i = e[5].toLowerCase() + e.slice(6);
		}
		return r[Cz][i];
	}
	return null;
}
function CV(e) {
	let t = {};
	for (let n of e) if (n) for (let e in n) t[e] = 1;
	return Object.keys(t);
}
function wV(e, t) {
	var n = t.config, r = n.style, i = n.axis, a = t.scaleType(e.scale) === "band" && n.axisBand, o = e.orient, s, c, l;
	if (JL(o)) {
		let e = CV([n.axisX, n.axisY]), t = CV([
			n.axisTop,
			n.axisBottom,
			n.axisLeft,
			n.axisRight
		]);
		s = {};
		for (l of e) s[l] = oV(o, SV(l, n.axisX, i, r), SV(l, n.axisY, i, r));
		c = {};
		for (l of t) c[l] = vV(o.signal, SV(l, n.axisTop, i, r), SV(l, n.axisBottom, i, r), SV(l, n.axisLeft, i, r), SV(l, n.axisRight, i, r));
	} else s = o === lz || o === fz ? n.axisX : n.axisY, c = n["axis" + o[0].toUpperCase() + o.slice(1)];
	return s || c || a ? qu({}, i, s, c, a) : i;
}
function TV(e, t, n, r) {
	let i = Vz(e, t), a = e.orient, o, s, c = {
		enter: o = { opacity: Nz },
		update: s = { opacity: Pz },
		exit: { opacity: Nz }
	};
	JI(c, {
		stroke: i("domainColor"),
		strokeCap: i("domainCap"),
		strokeDash: i("domainDash"),
		strokeDashOffset: i("domainDashOffset"),
		strokeWidth: i("domainWidth"),
		strokeOpacity: i("domainOpacity")
	});
	let l = EV(e, 0), u = EV(e, 1);
	return o.x = s.x = oV(a, l, Nz), o.x2 = s.x2 = oV(a, u), o.y = s.y = sV(a, l, Nz), o.y2 = s.y2 = sV(a, u), Jz({
		type: Lz,
		role: eL,
		from: r,
		encode: c
	}, n);
}
function EV(e, t) {
	return {
		scale: e.scale,
		range: t
	};
}
function DV(e, t, n, r, i) {
	let a = Vz(e, t), o = e.orient, s = e.gridScale, c = aV(o, 1, -1), l = OV(e.offset, c), u, d, f, p = {
		enter: u = { opacity: Nz },
		update: f = { opacity: Pz },
		exit: d = { opacity: Nz }
	};
	JI(p, {
		stroke: a("gridColor"),
		strokeCap: a("gridCap"),
		strokeDash: a("gridDash"),
		strokeDashOffset: a("gridDashOffset"),
		strokeOpacity: a("gridOpacity"),
		strokeWidth: a("gridWidth")
	});
	let m = {
		scale: e.scale,
		field: Sz,
		band: i.band,
		extra: i.extra,
		offset: i.offset,
		round: a("tickRound")
	}, h = oV(o, { signal: "height" }, { signal: "width" }), g = s ? {
		scale: s,
		range: 0,
		mult: c,
		offset: l
	} : {
		value: 0,
		offset: l
	}, _ = s ? {
		scale: s,
		range: 1,
		mult: c,
		offset: l
	} : qu(h, {
		mult: c,
		offset: l
	});
	return u.x = f.x = oV(o, m, g), u.y = f.y = sV(o, m, g), u.x2 = f.x2 = sV(o, _), u.y2 = f.y2 = oV(o, _), d.x = oV(o, m), d.y = sV(o, m), Jz({
		type: Lz,
		role: tL,
		key: Sz,
		from: r,
		encode: p
	}, n);
}
function OV(e, t) {
	if (t !== 1) if (!F(e)) e = JL(t) ? { signal: `(${t.signal}) * (${e || 0})` } : t * (e || 0);
	else {
		let n = e = qu({}, e);
		for (; n.mult != null;) if (F(n.mult)) n = n.mult = qu({}, n.mult);
		else return n.mult = JL(t) ? { signal: `(${n.mult}) * (${t.signal})` } : n.mult * t, e;
		n.mult = t;
	}
	return e;
}
function kV(e, t, n, r, i, a) {
	let o = Vz(e, t), s = e.orient, c = aV(s, -1, 1), l, u, d, f = {
		enter: l = { opacity: Nz },
		update: d = { opacity: Pz },
		exit: u = { opacity: Nz }
	};
	JI(f, {
		stroke: o("tickColor"),
		strokeCap: o("tickCap"),
		strokeDash: o("tickDash"),
		strokeDashOffset: o("tickDashOffset"),
		strokeOpacity: o("tickOpacity"),
		strokeWidth: o("tickWidth")
	});
	let p = KI(i);
	p.mult = c;
	let m = {
		scale: e.scale,
		field: Sz,
		band: a.band,
		extra: a.extra,
		offset: a.offset,
		round: o("tickRound")
	};
	return d.y = l.y = oV(s, Nz, m), d.y2 = l.y2 = oV(s, p), u.x = oV(s, m), d.x = l.x = sV(s, Nz, m), d.x2 = l.x2 = sV(s, p), u.y = sV(s, m), Jz({
		type: Lz,
		role: rL,
		key: Sz,
		from: r,
		encode: f
	}, n);
}
function AV(e, t, n, r, i) {
	return { signal: "flush(range(\"" + e + "\"), scale(\"" + e + "\", datum.value), " + t + "," + n + "," + r + "," + i + ")" };
}
function jV(e, t, n, r, i, a) {
	let o = Vz(e, t), s = e.orient, c = e.scale, l = aV(s, -1, 1), u = QL(o("labelFlush")), d = QL(o("labelFlushOffset")), f = o("labelAlign"), p = o("labelBaseline"), m = u === 0 || !!u, h, g = KI(i);
	g.mult = l, g.offset = KI(o("labelPadding") || 0), g.offset.mult = l;
	let _ = {
		scale: c,
		field: Sz,
		band: .5,
		offset: qz(a.offset, o("labelOffset"))
	}, v = oV(s, m ? AV(c, u, "\"left\"", "\"right\"", "\"center\"") : { value: "center" }, lV(s, "left", "right")), y = oV(s, cV(s, "bottom", "top"), m ? AV(c, u, "\"top\"", "\"bottom\"", "\"middle\"") : { value: "middle" }), b = AV(c, u, `-(${d})`, d, 0);
	m = m && d;
	let x = {
		opacity: Nz,
		x: oV(s, _, g),
		y: sV(s, _, g)
	}, S = {
		enter: x,
		update: h = {
			opacity: Pz,
			text: { field: yz },
			x: x.x,
			y: x.y,
			align: v,
			baseline: y
		},
		exit: {
			opacity: Nz,
			x: x.x,
			y: x.y
		}
	};
	JI(S, {
		dx: !f && m ? oV(s, b) : null,
		dy: !p && m ? sV(s, b) : null
	}), JI(S, {
		angle: o("labelAngle"),
		fill: o("labelColor"),
		fillOpacity: o("labelOpacity"),
		font: o("labelFont"),
		fontSize: o("labelFontSize"),
		fontWeight: o("labelFontWeight"),
		fontStyle: o("labelFontStyle"),
		limit: o("labelLimit"),
		lineHeight: o("labelLineHeight")
	}, {
		align: f,
		baseline: p
	});
	let C = o("labelBound"), w = o("labelOverlap");
	return w = w || C ? {
		separation: o("labelSeparation"),
		method: w,
		order: "datum.index",
		bound: C ? {
			scale: c,
			orient: s,
			tolerance: C
		} : null
	} : void 0, h.align !== v && (h.align = xV(h.align, v)), h.baseline !== y && (h.baseline = xV(h.baseline, y)), Jz({
		type: zz,
		role: nL,
		style: Cz,
		key: Sz,
		from: r,
		encode: S,
		overlap: w
	}, n);
}
function MV(e, t, n, r) {
	let i = Vz(e, t), a = e.orient, o = aV(a, -1, 1), s, c, l = {
		enter: s = {
			opacity: Nz,
			anchor: KI(i("titleAnchor", null)),
			align: { signal: Gz }
		},
		update: c = qu({}, s, {
			opacity: Pz,
			text: KI(e.title)
		}),
		exit: { opacity: Nz }
	}, u = { signal: `lerp(range("${e.scale}"), ${Wz(0, 1, .5)})` };
	return c.x = oV(a, u), c.y = sV(a, u), s.angle = oV(a, Nz, bV(o, 90)), s.baseline = oV(a, cV(a, fz, lz), { value: fz }), c.angle = s.angle, c.baseline = s.baseline, JI(l, {
		fill: i("titleColor"),
		fillOpacity: i("titleOpacity"),
		font: i("titleFont"),
		fontSize: i("titleFontSize"),
		fontStyle: i("titleFontStyle"),
		fontWeight: i("titleFontWeight"),
		limit: i("titleLimit"),
		lineHeight: i("titleLineHeight")
	}, {
		align: i("titleAlign"),
		angle: i("titleAngle"),
		baseline: i("titleBaseline")
	}), NV(i, a, l, n), l.update.align = xV(l.update.align, s.align), l.update.angle = xV(l.update.angle, s.angle), l.update.baseline = xV(l.update.baseline, s.baseline), Jz({
		type: zz,
		role: iL,
		style: wz,
		from: r,
		encode: l
	}, n);
}
function NV(e, t, n, r) {
	let i = (e, t) => e == null ? !XI(t, r) : (n.update[t] = xV(KI(e), n.update[t]), !1), a = i(e("titleX"), "x"), o = i(e("titleY"), "y");
	n.enter.auto = o === a ? KI(o) : oV(t, KI(o), KI(a));
}
function PV(e, t) {
	let n = wV(e, t), r = e.encode || {}, i = r.axis || {}, a = i.name || void 0, o = i.interactive, s = i.style, c = Vz(e, n), l = Kz(c), u = {
		scale: e.scale,
		ticks: !!c("ticks"),
		labels: !!c("labels"),
		grid: !!c("grid"),
		domain: !!c("domain"),
		title: e.title != null
	}, d = G(t.add(gR({}, [u]))), f = G(t.add(mR({
		scale: t.scaleRef(e.scale),
		extra: t.property(l.extra),
		count: t.objectProperty(e.tickCount),
		values: t.objectProperty(e.values),
		minstep: t.property(e.tickMinStep),
		formatType: t.property(e.formatType),
		formatSpecifier: t.property(e.format)
	}))), p = [], m;
	return u.grid && p.push(DV(e, n, r.grid, f, l)), u.ticks && (m = c("tickSize"), p.push(kV(e, n, r.ticks, f, m, l))), u.labels && (m = u.ticks ? m : 0, p.push(jV(e, n, r.labels, f, m, l))), u.domain && p.push(TV(e, n, r.domain, d)), u.title && p.push(MV(e, n, r.title, d)), zB(Bz({
		role: $I,
		from: d,
		encode: YI(FV(c, e), i, Mz),
		marks: p,
		aria: c("aria"),
		description: c("description"),
		zindex: c("zindex"),
		name: a,
		interactive: o,
		style: s
	}), t);
}
function FV(e, t) {
	let n = {
		enter: {},
		update: {}
	};
	return JI(n, {
		orient: e("orient"),
		offset: e("offset") || 0,
		position: ZL(t.position, 0),
		titlePadding: e("titlePadding"),
		minExtent: e("minExtent"),
		maxExtent: e("maxExtent"),
		range: { signal: `abs(span(range("${t.scale}")))` },
		translate: e("translate"),
		format: t.format,
		formatType: t.formatType
	}), n;
}
function IV(e, t, n) {
	let r = I(e.signals), i = I(e.scales);
	return n || r.forEach((e) => PL(e, t)), I(e.projections).forEach((e) => sz(e, t)), i.forEach((e) => UR(e, t)), I(e.data).forEach((e) => eV(e, t)), i.forEach((e) => WR(e, t)), (n || r).forEach((e) => dR(e, t)), I(e.axes).forEach((e) => PV(e, t)), I(e.marks).forEach((e) => zB(e, t)), I(e.legends).forEach((e) => VB(e, t)), e.title && YB(e.title, t), t.parseLambdas(), t;
}
var LV = (e) => YI({
	enter: {
		x: { value: 0 },
		y: { value: 0 }
	},
	update: {
		width: { signal: "width" },
		height: { signal: "height" }
	}
}, e);
function RV(e, t) {
	let n = t.config, r = G(t.root = t.add(LL())), i = BV(e, n);
	i.forEach((e) => PL(e, t)), t.description = e.description || n.description, t.eventConfig = n.events, t.legends = t.objectProperty(n.legend && n.legend.layout), t.locale = n.locale;
	let a = t.add(gR()), o = t.add(yR(DL(LV(e.encode), Fz, ZI, e.style, t, { pulse: G(a) }))), s = t.add(zR({
		layout: t.objectProperty(e.layout),
		legends: t.legends,
		autosize: t.signalRef("autosize"),
		mark: r,
		pulse: G(o)
	}));
	t.operators.pop(), t.pushState(G(o), G(s), null), IV(e, t, i), t.operators.push(s);
	let c = t.add(hR({
		mark: r,
		pulse: G(s)
	}));
	return c = t.add(FR({ pulse: G(c) })), c = t.add(LR({ pulse: G(c) })), t.addData("root", new MB(t, a, a, c)), t;
}
function zV(e, t) {
	return t && t.signal ? {
		name: e,
		update: t.signal
	} : {
		name: e,
		value: t
	};
}
function BV(e, t) {
	let n = (n) => ZL(e[n], t[n]), r = [
		zV("background", n("background")),
		zV("autosize", HI(n("autosize"))),
		zV("padding", GI(n("padding"))),
		zV("width", n("width") || 0),
		zV("height", n("height") || 0)
	], i = r.reduce((e, t) => (e[t.name] = t, e), {}), a = {};
	return I(e.signals).forEach((e) => {
		L(i, e.name) ? e = qu(i[e.name], e) : r.push(e), a[e.name] = e;
	}), I(t.signals).forEach((e) => {
		!L(a, e.name) && !L(i, e.name) && r.push(e);
	}), r;
}
function VV(e, t) {
	this.config = e || {}, this.options = t || {}, this.bindings = [], this.field = {}, this.signals = {}, this.lambdas = {}, this.scales = {}, this.events = {}, this.data = {}, this.streams = [], this.updates = [], this.operators = [], this.eventConfig = null, this.locale = null, this._id = 0, this._subid = 0, this._nextsub = [0], this._parent = [], this._encode = [], this._lookup = [], this._markpath = [];
}
function HV(e) {
	this.config = e.config, this.options = e.options, this.legends = e.legends, this.field = Object.create(e.field), this.signals = Object.create(e.signals), this.lambdas = Object.create(e.lambdas), this.scales = Object.create(e.scales), this.events = Object.create(e.events), this.data = Object.create(e.data), this.streams = [], this.updates = [], this.operators = [], this._id = 0, this._subid = ++e._nextsub[0], this._nextsub = e._nextsub, this._parent = e._parent.slice(), this._encode = e._encode.slice(), this._lookup = e._lookup.slice(), this._markpath = e._markpath;
}
VV.prototype = HV.prototype = {
	parse(e) {
		return IV(e, this);
	},
	fork() {
		return new HV(this);
	},
	isSubscope() {
		return this._subid > 0;
	},
	toRuntime() {
		return this.finish(), {
			description: this.description,
			operators: this.operators,
			streams: this.streams,
			updates: this.updates,
			bindings: this.bindings,
			eventConfig: this.eventConfig,
			locale: this.locale
		};
	},
	id() {
		return (this._subid ? this._subid + ":" : 0) + this._id++;
	},
	add(e) {
		return this.operators.push(e), e.id = this.id(), e.refs && (e.refs.forEach((t) => {
			t.$ref = e.id;
		}), e.refs = null), e;
	},
	proxy(e) {
		let t = e instanceof FL ? G(e) : e;
		return this.add(NR({ value: t }));
	},
	addStream(e) {
		return this.streams.push(e), e.id = this.id(), e;
	},
	addUpdate(e) {
		return this.updates.push(e), e;
	},
	finish() {
		let e, t;
		for (e in this.root && (this.root.root = !0), this.signals) this.signals[e].signal = e;
		for (e in this.scales) this.scales[e].scale = e;
		function n(e, t, n) {
			let r, i;
			e && (r = e.data || (e.data = {}), i = r[t] || (r[t] = []), i.push(n));
		}
		for (e in this.data) {
			t = this.data[e], n(t.input, e, "input"), n(t.output, e, "output"), n(t.values, e, "values");
			for (let r in t.index) n(t.index[r], e, "index:" + r);
		}
		return this;
	},
	pushState(e, t, n) {
		this._encode.push(G(this.add(LR({ pulse: e })))), this._parent.push(t), this._lookup.push(n ? G(this.proxy(n)) : null), this._markpath.push(-1);
	},
	popState() {
		this._encode.pop(), this._parent.pop(), this._lookup.pop(), this._markpath.pop();
	},
	parent() {
		return vu(this._parent);
	},
	encode() {
		return vu(this._encode);
	},
	lookup() {
		return vu(this._lookup);
	},
	markpath() {
		let e = this._markpath;
		return ++e[e.length - 1];
	},
	fieldRef(e, t) {
		if (z(e)) return RL(e, t);
		e.signal || N("Unsupported field reference: " + B(e));
		let n = e.signal, r = this.field[n];
		if (!r) {
			let e = { name: this.signalRef(n) };
			t && (e.as = t), this.field[n] = r = G(this.add(SR(e)));
		}
		return r;
	},
	compareRef(e) {
		let t = !1, n = (e) => JL(e) ? (t = !0, this.signalRef(e.signal)) : YL(e) ? (t = !0, this.exprRef(e.expr)) : e, r = I(e.field).map(n), i = I(e.order).map(n);
		return t ? G(this.add(_R({
			fields: r,
			orders: i
		}))) : BL(r, i);
	},
	keyRef(e, t) {
		let n = !1, r = (e) => JL(e) ? (n = !0, G(i[e.signal])) : e, i = this.signals;
		return e = I(e).map(r), n ? G(this.add(CR({
			fields: e,
			flat: t
		}))) : VL(e, t);
	},
	sortRef(e) {
		if (!e) return e;
		let t = GL(e.op, e.field), n = e.order || HL;
		return n.signal ? G(this.add(_R({
			fields: t,
			orders: this.signalRef(n.signal)
		}))) : BL(t, n);
	},
	event(e, t) {
		let n = e + ":" + t;
		if (!this.events[n]) {
			let r = this.id();
			this.streams.push({
				id: r,
				source: e,
				type: t
			}), this.events[n] = r;
		}
		return this.events[n];
	},
	hasOwnSignal(e) {
		return L(this.signals, e);
	},
	addSignal(e, t) {
		this.hasOwnSignal(e) && N("Duplicate signal name: " + B(e));
		let n = t instanceof FL ? t : this.add(LL(t));
		return this.signals[e] = n;
	},
	getSignal(e) {
		return this.signals[e] || N("Unrecognized signal name: " + B(e)), this.signals[e];
	},
	signalRef(e) {
		return this.signals[e] ? G(this.signals[e]) : (L(this.lambdas, e) || (this.lambdas[e] = this.add(LL(null))), G(this.lambdas[e]));
	},
	parseLambdas() {
		let e = Object.keys(this.lambdas);
		for (let t = 0, n = e.length; t < n; ++t) {
			let n = e[t], r = MF(n, this), i = this.lambdas[n];
			i.params = r.$params, i.update = r.$expr;
		}
	},
	property(e) {
		return e && e.signal ? this.signalRef(e.signal) : e;
	},
	objectProperty(e) {
		return !e || !F(e) ? e : this.signalRef(e.signal || UV(e));
	},
	exprRef(e, t) {
		let n = { expr: MF(e, this) };
		return t && (n.expr.$name = t), G(this.add(bR(n)));
	},
	addBinding(e, t) {
		this.bindings || N("Nested signals do not support binding: " + B(e)), this.bindings.push(qu({ signal: e }, t));
	},
	addScaleProj(e, t) {
		L(this.scales, e) && N("Duplicate scale or projection name: " + B(e)), this.scales[e] = this.add(t);
	},
	addScale(e, t) {
		this.addScaleProj(e, IR(t));
	},
	addProjection(e, t) {
		this.addScaleProj(e, MR(t));
	},
	getScale(e) {
		return this.scales[e] || N("Unrecognized scale name: " + B(e)), this.scales[e];
	},
	scaleRef(e) {
		return G(this.getScale(e));
	},
	scaleType(e) {
		return this.getScale(e).params.type;
	},
	projectionRef(e) {
		return this.scaleRef(e);
	},
	projectionType(e) {
		return this.scaleType(e);
	},
	addData(e, t) {
		return L(this.data, e) && N("Duplicate data set name: " + B(e)), this.data[e] = t;
	},
	getData(e) {
		return this.data[e] || N("Undefined data set name: " + B(e)), this.data[e];
	},
	addDataPipeline(e, t) {
		return L(this.data, e) && N("Duplicate data set name: " + B(e)), this.addData(e, MB.fromEntries(this, t));
	}
};
function UV(e) {
	return (P(e) ? WV : GV)(e);
}
function WV(e) {
	let t = e.length, n = "[";
	for (let r = 0; r < t; ++r) {
		let t = e[r];
		n += (r > 0 ? "," : "") + (F(t) ? t.signal || UV(t) : B(t));
	}
	return n + "]";
}
function GV(e) {
	let t = "{", n = 0, r, i;
	for (r in e) i = e[r], t += (++n > 1 ? "," : "") + B(r) + ":" + (F(i) ? i.signal || UV(i) : B(i));
	return t + "}";
}
function KV() {
	let e = "sans-serif", t = "#4c78a8", n = "#000", r = "#888", i = "#ddd";
	return {
		description: "Vega visualization",
		padding: 0,
		autosize: "pad",
		background: null,
		events: { defaults: { allow: ["wheel"] } },
		group: null,
		mark: null,
		arc: { fill: t },
		area: { fill: t },
		image: null,
		line: {
			stroke: t,
			strokeWidth: 2
		},
		path: { stroke: t },
		rect: { fill: t },
		rule: { stroke: n },
		shape: { stroke: t },
		symbol: {
			fill: t,
			size: 64
		},
		text: {
			fill: n,
			font: e,
			fontSize: 11
		},
		trail: {
			fill: t,
			size: 2
		},
		style: {
			"guide-label": {
				fill: n,
				font: e,
				fontSize: 10
			},
			"guide-title": {
				fill: n,
				font: e,
				fontSize: 11,
				fontWeight: "bold"
			},
			"group-title": {
				fill: n,
				font: e,
				fontSize: 13,
				fontWeight: "bold"
			},
			"group-subtitle": {
				fill: n,
				font: e,
				fontSize: 12
			},
			point: {
				size: 30,
				strokeWidth: 2,
				shape: "circle"
			},
			circle: {
				size: 30,
				strokeWidth: 2
			},
			square: {
				size: 30,
				strokeWidth: 2,
				shape: "square"
			},
			cell: {
				fill: "transparent",
				stroke: i
			},
			view: { fill: "transparent" }
		},
		title: {
			orient: "top",
			anchor: "middle",
			offset: 4,
			subtitlePadding: 3
		},
		axis: {
			minExtent: 0,
			maxExtent: 200,
			bandPosition: .5,
			domain: !0,
			domainWidth: 1,
			domainColor: r,
			grid: !1,
			gridWidth: 1,
			gridColor: i,
			labels: !0,
			labelAngle: 0,
			labelLimit: 180,
			labelOffset: 0,
			labelPadding: 2,
			ticks: !0,
			tickColor: r,
			tickOffset: 0,
			tickRound: !0,
			tickSize: 5,
			tickWidth: 1,
			titlePadding: 4
		},
		axisBand: { tickOffset: -.5 },
		projection: { type: "mercator" },
		legend: {
			orient: "right",
			padding: 0,
			gridAlign: "each",
			columnPadding: 10,
			rowPadding: 2,
			symbolDirection: "vertical",
			gradientDirection: "vertical",
			gradientLength: 200,
			gradientThickness: 16,
			gradientStrokeColor: i,
			gradientStrokeWidth: 0,
			gradientLabelOffset: 2,
			labelAlign: "left",
			labelBaseline: "middle",
			labelLimit: 160,
			labelOffset: 4,
			labelOverlap: !0,
			symbolLimit: 30,
			symbolType: "circle",
			symbolSize: 100,
			symbolOffset: 0,
			symbolStrokeWidth: 1.5,
			symbolBaseFillColor: "transparent",
			symbolBaseStrokeColor: r,
			titleLimit: 180,
			titleOrient: "top",
			titlePadding: 5,
			layout: {
				offset: 18,
				direction: "horizontal",
				left: { direction: "vertical" },
				right: { direction: "vertical" }
			}
		},
		range: {
			category: { scheme: "tableau10" },
			ordinal: { scheme: "blues" },
			heatmap: { scheme: "yellowgreenblue" },
			ramp: { scheme: "blues" },
			diverging: {
				scheme: "blueorange",
				extent: [1, 0]
			},
			symbol: [
				"circle",
				"square",
				"triangle-up",
				"cross",
				"diamond",
				"triangle-right",
				"triangle-down",
				"triangle-left"
			]
		}
	};
}
function qV(e, t, n) {
	return F(e) || N("Input Vega specification must be an object."), t = hu(KV(), t, e.config), RV(e, new VV(t, n)).toRuntime();
}
//#endregion
//#region ../../node_modules/.pnpm/vega@6.2.0/node_modules/vega/build/vega.module.js
var JV = /* @__PURE__ */ t({
	Bounds: () => Nb,
	CanvasHandler: () => nw,
	CanvasRenderer: () => sw,
	DATE: () => Pd,
	DAY: () => "day",
	DAYOFYEAR: () => Fd,
	Dataflow: () => Bm,
	Debug: () => 4,
	DisallowedObjectProperties: () => du,
	Error: () => 1,
	EventStream: () => nm,
	Gradient: () => hy,
	GroupItem: () => Fb,
	HOURS: () => Id,
	Handler: () => EC,
	HybridHandler: () => eT,
	HybridRenderer: () => $w,
	Info: () => 3,
	Item: () => Pb,
	MILLISECONDS: () => zd,
	MINUTES: () => Ld,
	MONTH: () => Md,
	Marks: () => lC,
	MultiPulse: () => Am,
	None: () => 0,
	Operator: () => Zp,
	Parameters: () => Kp,
	Pulse: () => Em,
	QUARTER: () => jd,
	RenderType: () => oT,
	Renderer: () => OC,
	ResourceLoader: () => Ib,
	SECONDS: () => Rd,
	SVGHandler: () => cw,
	SVGRenderer: () => Nw,
	SVGStringRenderer: () => Yw,
	Scenegraph: () => _C,
	TIME_UNITS: () => Bd,
	Transform: () => H,
	View: () => _I,
	WEEK: () => Nd,
	Warn: () => 2,
	YEAR: () => Ad,
	accessor: () => Zl,
	accessorFields: () => $l,
	accessorName: () => Ql,
	array: () => I,
	ascending: () => Vu,
	bandwidthNRD: () => Jm,
	bin: () => Ym,
	bootstrapCI: () => Qm,
	boundClip: () => hT,
	boundContext: () => ix,
	boundItem: () => uC,
	boundMark: () => fC,
	boundStroke: () => zb,
	changeset: () => Wp,
	clampRange: () => Lu,
	codegenExpression: () => vN,
	compare: () => Bu,
	constant: () => Gu,
	cumulativeLogNormal: () => hh,
	cumulativeNormal: () => ch,
	cumulativeUniform: () => xh,
	dayofyear: () => qd,
	debounce: () => Ku,
	defaultLocale: () => ip,
	definition: () => Um,
	densityLogNormal: () => mh,
	densityNormal: () => sh,
	densityUniform: () => bh,
	domChild: () => xC,
	domClear: () => SC,
	domCreate: () => yC,
	domFind: () => bC,
	dotbin: () => $m,
	error: () => N,
	expressionFunction: () => jF,
	extend: () => qu,
	extent: () => Ju,
	extentIndex: () => Yu,
	falsy: () => uu,
	fastmap: () => Zu,
	field: () => iu,
	flush: () => Qu,
	font: () => $S,
	fontFamily: () => QS,
	fontSize: () => WS,
	format: () => Op,
	formatLocale: () => Yf,
	formats: () => kp,
	hasOwnProperty: () => L,
	id: () => au,
	identity: () => ou,
	inferType: () => Sp,
	inferTypes: () => Cp,
	ingest: () => Rp,
	inherits: () => R,
	inrange: () => $u,
	interpolate: () => Rv,
	interpolateColors: () => Fv,
	interpolateRange: () => Pv,
	intersect: () => lT,
	intersectBoxLine: () => hx,
	intersectPath: () => dx,
	intersectPoint: () => fx,
	intersectRule: () => mx,
	isArray: () => P,
	isBoolean: () => ed,
	isDate: () => td,
	isFunction: () => Ru,
	isIterable: () => nd,
	isNumber: () => rd,
	isObject: () => F,
	isRegExp: () => id,
	isString: () => z,
	isTuple: () => Ip,
	key: () => ad,
	lerp: () => od,
	lineHeight: () => GS,
	loader: () => Mp,
	locale: () => rp,
	logger: () => pu,
	lruCache: () => cd,
	markup: () => ww,
	merge: () => ld,
	mergeConfig: () => hu,
	multiLineOffset: () => JS,
	one: () => cu,
	pad: () => dd,
	panLinear: () => Eu,
	panLog: () => Du,
	panPow: () => Ou,
	panSymlog: () => ku,
	parse: () => qV,
	parseExpression: () => mN,
	parseSelector: () => PI,
	path: () => Ae,
	pathCurves: () => _y,
	pathEqual: () => vT,
	pathParse: () => vy,
	pathRectangle: () => Ky,
	pathRender: () => My,
	pathSymbols: () => Iy,
	pathTrail: () => qy,
	peek: () => vu,
	point: () => wC,
	projection: () => sO,
	quantileLogNormal: () => gh,
	quantileNormal: () => lh,
	quantileUniform: () => Sh,
	quantiles: () => Km,
	quantizeInterpolator: () => Iv,
	quarter: () => Fu,
	quartiles: () => qm,
	random: () => Xm,
	randomInteger: () => nh,
	randomKDE: () => fh,
	randomLCG: () => th,
	randomLogNormal: () => _h,
	randomMixture: () => vh,
	randomNormal: () => dh,
	randomUniform: () => Ch,
	read: () => jp,
	regressionConstant: () => wh,
	regressionExp: () => jh,
	regressionLinear: () => kh,
	regressionLoess: () => zh,
	regressionLog: () => Ah,
	regressionPoly: () => Ph,
	regressionPow: () => Mh,
	regressionQuad: () => Nh,
	renderModule: () => cT,
	repeat: () => ud,
	resetDefaultLocale: () => ap,
	resetSVGDefIds: () => bT,
	responseType: () => Ap,
	runtimeContext: () => RF,
	sampleCurve: () => Wh,
	sampleLogNormal: () => ph,
	sampleNormal: () => oh,
	sampleUniform: () => yh,
	scale: () => Cv,
	sceneEqual: () => _T,
	sceneFromJSON: () => hC,
	scenePickVisit: () => Dx,
	sceneToJSON: () => mC,
	sceneVisit: () => Ex,
	sceneZOrder: () => Tx,
	scheme: () => Gv,
	serializeXML: () => Tw,
	setHybridRendererOptions: () => Qw,
	setRandom: () => Zm,
	span: () => fd,
	splitAccessPath: () => ru,
	stringValue: () => B,
	textMetrics: () => RS,
	timeBin: () => Vf,
	timeFloor: () => df,
	timeFormatLocale: () => tp,
	timeInterval: () => _f,
	timeOffset: () => bf,
	timeSequence: () => Cf,
	timeUnitSpecifier: () => Wd,
	timeUnits: () => Hd,
	toBoolean: () => pd,
	toDate: () => hd,
	toNumber: () => yu,
	toSet: () => _d,
	toString: () => gd,
	transform: () => Wm,
	transforms: () => Hm,
	truncate: () => vd,
	truthy: () => lu,
	tupleid: () => V,
	typeParsers: () => bp,
	utcFloor: () => mf,
	utcInterval: () => vf,
	utcOffset: () => xf,
	utcSequence: () => wf,
	utcdayofyear: () => $d,
	utcquarter: () => Iu,
	utcweek: () => ef,
	version: () => XV,
	visitArray: () => yd,
	week: () => Jd,
	writeConfig: () => gu,
	zero: () => su,
	zoomLinear: () => ju,
	zoomLog: () => Mu,
	zoomPow: () => Nu,
	zoomSymlog: () => Pu
}), YV = "6.2.0";
qu(Hm, qh, xT, eD, uO, nk, Ik, hk, CA, kA, PA, ZA);
var XV = YV;
//#endregion
//#region ../../node_modules/.pnpm/vega-interpreter@2.2.1/node_modules/vega-interpreter/build/vega-interpreter.js
function ZV(e, t, n) {
	let r;
	t.x2 && (t.x ? (n && e.x > e.x2 && (r = e.x, e.x = e.x2, e.x2 = r), e.width = e.x2 - e.x) : e.x = e.x2 - (e.width || 0)), t.xc && (e.x = e.xc - (e.width || 0) / 2), t.y2 && (t.y ? (n && e.y > e.y2 && (r = e.y, e.y = e.y2, e.y2 = r), e.height = e.y2 - e.y) : e.y = e.y2 - (e.height || 0)), t.yc && (e.y = e.yc - (e.height || 0) / 2);
}
var QV = {
	NaN: NaN,
	E: Math.E,
	LN2: Math.LN2,
	LN10: Math.LN10,
	LOG2E: Math.LOG2E,
	LOG10E: Math.LOG10E,
	PI: Math.PI,
	SQRT1_2: Math.SQRT1_2,
	SQRT2: Math.SQRT2,
	MIN_VALUE: Number.MIN_VALUE,
	MAX_VALUE: Number.MAX_VALUE
}, $V = {
	"*": (e, t) => e * t,
	"+": (e, t) => e + t,
	"-": (e, t) => e - t,
	"/": (e, t) => e / t,
	"%": (e, t) => e % t,
	">": (e, t) => e > t,
	"<": (e, t) => e < t,
	"<=": (e, t) => e <= t,
	">=": (e, t) => e >= t,
	"==": (e, t) => e == t,
	"!=": (e, t) => e != t,
	"===": (e, t) => e === t,
	"!==": (e, t) => e !== t,
	"&": (e, t) => e & t,
	"|": (e, t) => e | t,
	"^": (e, t) => e ^ t,
	"<<": (e, t) => e << t,
	">>": (e, t) => e >> t,
	">>>": (e, t) => e >>> t
}, eH = {
	"+": (e) => +e,
	"-": (e) => -e,
	"~": (e) => ~e,
	"!": (e) => !e
}, tH = Array.prototype.slice, nH = (e, t, n) => {
	let r = n ? n(t[0]) : t[0];
	return r[e].apply(r, tH.call(t, 1));
}, rH = {
	isNaN: Number.isNaN,
	isFinite: Number.isFinite,
	abs: Math.abs,
	acos: Math.acos,
	asin: Math.asin,
	atan: Math.atan,
	atan2: Math.atan2,
	ceil: Math.ceil,
	cos: Math.cos,
	exp: Math.exp,
	floor: Math.floor,
	log: Math.log,
	max: Math.max,
	min: Math.min,
	pow: Math.pow,
	random: Math.random,
	round: Math.round,
	sin: Math.sin,
	sqrt: Math.sqrt,
	tan: Math.tan,
	clamp: (e, t, n) => Math.max(t, Math.min(n, e)),
	now: Date.now,
	utc: Date.UTC,
	datetime: (e, t = 0, n = 1, r = 0, i = 0, a = 0, o = 0) => z(e) ? new Date(e) : new Date(e, t, n, r, i, a, o),
	date: (e) => new Date(e).getDate(),
	day: (e) => new Date(e).getDay(),
	year: (e) => new Date(e).getFullYear(),
	month: (e) => new Date(e).getMonth(),
	hours: (e) => new Date(e).getHours(),
	minutes: (e) => new Date(e).getMinutes(),
	seconds: (e) => new Date(e).getSeconds(),
	milliseconds: (e) => new Date(e).getMilliseconds(),
	time: (e) => new Date(e).getTime(),
	timezoneoffset: (e) => new Date(e).getTimezoneOffset(),
	utcdate: (e) => new Date(e).getUTCDate(),
	utcday: (e) => new Date(e).getUTCDay(),
	utcyear: (e) => new Date(e).getUTCFullYear(),
	utcmonth: (e) => new Date(e).getUTCMonth(),
	utchours: (e) => new Date(e).getUTCHours(),
	utcminutes: (e) => new Date(e).getUTCMinutes(),
	utcseconds: (e) => new Date(e).getUTCSeconds(),
	utcmilliseconds: (e) => new Date(e).getUTCMilliseconds(),
	length: (e) => e.length,
	join: function() {
		return nH("join", arguments);
	},
	indexof: function() {
		return nH("indexOf", arguments);
	},
	lastindexof: function() {
		return nH("lastIndexOf", arguments);
	},
	slice: function() {
		return nH("slice", arguments);
	},
	reverse: (e) => e.slice().reverse(),
	sort: (e) => e.slice().sort(Vu),
	parseFloat,
	parseInt,
	upper: (e) => String(e).toUpperCase(),
	lower: (e) => String(e).toLowerCase(),
	substring: function() {
		return nH("substring", arguments, String);
	},
	split: function() {
		return nH("split", arguments, String);
	},
	replace: function() {
		return nH("replace", arguments, String);
	},
	trim: (e) => String(e).trim(),
	btoa: (e) => btoa(e),
	atob: (e) => atob(e),
	regexp: RegExp,
	test: (e, t) => RegExp(e).test(t)
}, iH = [
	"view",
	"item",
	"group",
	"xy",
	"x",
	"y"
], aH = new Set([
	Function,
	eval,
	setTimeout,
	setInterval
]);
typeof setImmediate == "function" && aH.add(setImmediate);
var oH = {
	Literal: (e, t) => t.value,
	Identifier: (e, t) => {
		let n = t.name;
		return e.memberDepth > 0 ? n : n === "datum" ? e.datum : n === "event" ? e.event : n === "item" ? e.item : QV[n] || e.params["$" + n];
	},
	MemberExpression: (e, t) => {
		let n = !t.computed, r = e(t.object);
		n && (e.memberDepth += 1);
		let i = e(t.property);
		if (n && --e.memberDepth, aH.has(r[i])) {
			console.error(`Prevented interpretation of member "${i}" which could lead to insecure code execution`);
			return;
		}
		return r[i];
	},
	CallExpression: (e, t) => {
		let n = t.arguments, r = t.callee.name;
		return r.startsWith("_") && (r = r.slice(1)), r === "if" ? e(n[0]) ? e(n[1]) : e(n[2]) : (e.fn[r] || rH[r]).apply(e.fn, n.map(e));
	},
	ArrayExpression: (e, t) => t.elements.map(e),
	BinaryExpression: (e, t) => $V[t.operator](e(t.left), e(t.right)),
	UnaryExpression: (e, t) => eH[t.operator](e(t.argument)),
	ConditionalExpression: (e, t) => e(t.test) ? e(t.consequent) : e(t.alternate),
	LogicalExpression: (e, t) => t.operator === "&&" ? e(t.left) && e(t.right) : e(t.left) || e(t.right),
	ObjectExpression: (e, t) => t.properties.reduce((t, n) => {
		e.memberDepth += 1;
		let r = e(n.key);
		--e.memberDepth;
		let i = e(n.value);
		return du.has(r) ? console.error(`Prevented interpretation of property "${r}" which could lead to insecure code execution`) : aH.has(i) ? console.error(`Prevented interpretation of method "${r}" which could lead to insecure code execution`) : t[r] = i, t;
	}, {})
};
function sH(e, t, n, r, i, a) {
	let o = (e) => oH[e.type](o, e);
	return o.memberDepth = 0, o.fn = Object.create(t), o.params = n, o.datum = r, o.event = i, o.item = a, iH.forEach((e) => o.fn[e] = (...t) => i.vega[e](...t)), o(e);
}
var cH = {
	operator(e, t) {
		let n = t.ast, r = e.functions;
		return (e) => sH(n, r, e);
	},
	parameter(e, t) {
		let n = t.ast, r = e.functions;
		return (e, t) => sH(n, r, t, e);
	},
	event(e, t) {
		let n = t.ast, r = e.functions;
		return (e) => sH(n, r, void 0, void 0, e);
	},
	handler(e, t) {
		let n = t.ast, r = e.functions;
		return (e, t) => sH(n, r, e, t.item && t.item.datum, t);
	},
	encode(e, t) {
		let { marktype: n, channels: r } = t, i = e.functions, a = n === "group" || n === "image" || n === "rect";
		return (e, t) => {
			let o = e.datum, s = 0, c;
			for (let n in r) c = sH(r[n].ast, i, t, o, void 0, e), e[n] !== c && (e[n] = c, s = 1);
			return n !== "rule" && ZV(e, r, a), s;
		};
	}
};
//#endregion
//#region \0@oxc-project+runtime@0.130.0/helpers/checkPrivateRedeclaration.js
function lH(e, t) {
	if (t.has(e)) throw TypeError("Cannot initialize the same private elements twice on an object");
}
//#endregion
//#region \0@oxc-project+runtime@0.130.0/helpers/classPrivateFieldInitSpec.js
function uH(e, t, n) {
	lH(e, t), t.set(e, n);
}
//#endregion
//#region \0@oxc-project+runtime@0.130.0/helpers/assertClassBrand.js
function dH(e, t, n) {
	if (typeof e == "function" ? e === t : e.has(t)) return arguments.length < 3 ? t : n;
	throw TypeError("Private element is not present on this object");
}
//#endregion
//#region \0@oxc-project+runtime@0.130.0/helpers/classPrivateFieldSet2.js
function fH(e, t, n) {
	return e.set(dH(e, t), n), n;
}
//#endregion
//#region \0@oxc-project+runtime@0.130.0/helpers/classPrivateFieldGet2.js
function pH(e, t) {
	return e.get(dH(e, t));
}
//#endregion
//#region ../../node_modules/.pnpm/vega-lite@6.4.3_vega@6.2.0/node_modules/vega-lite/build/index.js
var mH = /* @__PURE__ */ t({
	accessPathDepth: () => eU,
	accessPathWithDatum: () => KH,
	accessWithDatumToUnescapedPath: () => JH,
	compile: () => Wre,
	contains: () => EH,
	deepEqual: () => uU,
	deleteNestedProperty: () => WH,
	duplicate: () => K,
	entries: () => zH,
	every: () => OH,
	fieldIntersection: () => IH,
	flatAccessWithDatum: () => qH,
	getFirstDefined: () => tU,
	hasIntersection: () => PH,
	hasProperty: () => J,
	hash: () => wH,
	internalField: () => aU,
	isBoolean: () => BH,
	isEmpty: () => LH,
	isEqual: () => MH,
	isInternalField: () => oU,
	isNullOrFalse: () => TH,
	isNumeric: () => cU,
	isPrimitive: () => VH,
	keys: () => q,
	logicalExpr: () => UH,
	mergeDeep: () => kH,
	never: () => xH,
	normalize: () => s1,
	normalizeAngle: () => sU,
	omit: () => CH,
	pick: () => SH,
	prefixGenerator: () => FH,
	removePathFromField: () => $H,
	replaceAll: () => QH,
	replacePathInField: () => ZH,
	resetIdCounter: () => iU,
	setEqual: () => NH,
	some: () => DH,
	stringify: () => dU,
	titleCase: () => GH,
	unescapeSingleQuoteAndPathDot: () => YH,
	unique: () => jH,
	uniqueId: () => rU,
	vals: () => RH,
	varName: () => HH,
	version: () => qre
}), hH = { version: "6.4.3" };
function gH(e) {
	return J(e, "or");
}
function _H(e) {
	return J(e, "and");
}
function vH(e) {
	return J(e, "not");
}
function yH(e, t) {
	if (vH(e)) yH(e.not, t);
	else if (_H(e)) for (let n of e.and) yH(n, t);
	else if (gH(e)) for (let n of e.or) yH(n, t);
	else t(e);
}
function bH(e, t) {
	return vH(e) ? { not: bH(e.not, t) } : _H(e) ? { and: e.and.map((e) => bH(e, t)) } : gH(e) ? { or: e.or.map((e) => bH(e, t)) } : t(e);
}
var K = structuredClone;
function xH(e) {
	throw Error(e);
}
function SH(e, t) {
	let n = {};
	for (let r of t) L(e, r) && (n[r] = e[r]);
	return n;
}
function CH(e, t) {
	let n = { ...e };
	for (let e of t) delete n[e];
	return n;
}
Set.prototype.toJSON = function() {
	return `Set(${[...this].map((e) => dU(e)).join(",")})`;
};
function wH(e) {
	if (rd(e)) return e;
	let t = z(e) ? e : dU(e);
	if (t.length < 250) return t;
	let n = 0;
	for (let e = 0; e < t.length; e++) {
		let r = t.charCodeAt(e);
		n = (n << 5) - n + r, n &= n;
	}
	return n;
}
function TH(e) {
	return e === !1 || e === null;
}
function EH(e, t) {
	return e.includes(t);
}
function DH(e, t) {
	let n = 0;
	for (let [r, i] of e.entries()) if (t(i, r, n++)) return !0;
	return !1;
}
function OH(e, t) {
	let n = 0;
	for (let [r, i] of e.entries()) if (!t(i, r, n++)) return !1;
	return !0;
}
function kH(e, ...t) {
	for (let n of t) AH(e, n == null ? {} : n);
	return e;
}
function AH(e, t) {
	for (let n of q(t)) gu(e, n, t[n], !0);
}
function jH(e, t) {
	let n = [], r = {}, i;
	for (let a of e) i = t(a), !(i in r) && (r[i] = 1, n.push(a));
	return n;
}
function MH(e, t) {
	let n = q(e), r = q(t);
	if (n.length !== r.length) return !1;
	for (let r of n) if (e[r] !== t[r]) return !1;
	return !0;
}
function NH(e, t) {
	if (e.size !== t.size) return !1;
	for (let n of e) if (!t.has(n)) return !1;
	return !0;
}
function PH(e, t) {
	for (let n of e) if (t.has(n)) return !0;
	return !1;
}
function FH(e) {
	let t = /* @__PURE__ */ new Set();
	for (let n of e) {
		let e = ru(n).map((e, t) => t === 0 ? e : `[${e}]`), r = e.map((t, n) => e.slice(0, n + 1).join(""));
		for (let e of r) t.add(e);
	}
	return t;
}
function IH(e, t) {
	return e === void 0 || t === void 0 ? !0 : PH(FH(e), FH(t));
}
function LH(e) {
	return q(e).length === 0;
}
var q = Object.keys, RH = Object.values, zH = Object.entries;
function BH(e) {
	return e === !0 || e === !1;
}
function VH(e) {
	return z(e) || rd(e) || BH(e);
}
function HH(e) {
	let t = e.replace(/\W/g, "_");
	return (e.match(/^\d+/) ? "_" : "") + t;
}
function UH(e, t) {
	return vH(e) ? `!(${UH(e.not, t)})` : _H(e) ? `(${e.and.map((e) => UH(e, t)).join(") && (")})` : gH(e) ? `(${e.or.map((e) => UH(e, t)).join(") || (")})` : t(e);
}
function WH(e, t) {
	if (t.length === 0) return !0;
	let n = t.shift();
	return n in e && WH(e[n], t) && delete e[n], LH(e);
}
function GH(e) {
	return e.charAt(0).toUpperCase() + e.substr(1);
}
function KH(e, t = "datum") {
	let n = ru(e), r = [];
	for (let e = 1; e <= n.length; e++) {
		let i = `[${n.slice(0, e).map(B).join("][")}]`;
		r.push(`${t}${i}`);
	}
	return r.join(" && ");
}
function qH(e, t = "datum") {
	return `${t}[${B(ru(e).join("."))}]`;
}
function JH(e) {
	return `datum['${e.replaceAll("'", "\\'")}']`;
}
function YH(e) {
	return e.replaceAll("\\'", "'").replaceAll("\\.", ".");
}
function XH(e) {
	return e.replace(/(\[|\]|\.|'|")/g, "\\$1");
}
function ZH(e) {
	return `${ru(e).map(XH).join("\\.")}`;
}
function QH(e, t, n) {
	return e.replace(new RegExp(t.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "g"), n);
}
function $H(e) {
	return `${ru(e).join(".")}`;
}
function eU(e) {
	return e ? ru(e).length : 0;
}
function tU(...e) {
	return e.find((e) => e !== void 0);
}
var nU = 42;
function rU(e) {
	let t = ++nU;
	return e ? String(e) + t : t;
}
function iU() {
	nU = 42;
}
function aU(e) {
	return oU(e) ? e : `__${e}`;
}
function oU(e) {
	return e.startsWith("__");
}
function sU(e) {
	if (e !== void 0) return (e % 360 + 360) % 360;
}
function cU(e) {
	return rd(e) ? !0 : !isNaN(e) && !isNaN(parseFloat(e));
}
var lU = Object.getPrototypeOf(structuredClone({}));
function uU(e, t) {
	if (e === t) return !0;
	if (e && t && typeof e == "object" && typeof t == "object") {
		if (e.constructor.name !== t.constructor.name) return !1;
		let n, r;
		if (Array.isArray(e)) {
			if (n = e.length, n != t.length) return !1;
			for (r = n; r-- !== 0;) if (!uU(e[r], t[r])) return !1;
			return !0;
		}
		if (e instanceof Map && t instanceof Map) {
			if (e.size !== t.size) return !1;
			for (let n of e.entries()) if (!t.has(n[0])) return !1;
			for (let n of e.entries()) if (!uU(n[1], t.get(n[0]))) return !1;
			return !0;
		}
		if (e instanceof Set && t instanceof Set) {
			if (e.size !== t.size) return !1;
			for (let n of e.entries()) if (!t.has(n[0])) return !1;
			return !0;
		}
		if (ArrayBuffer.isView(e) && ArrayBuffer.isView(t)) {
			if (n = e.length, n != t.length) return !1;
			for (r = n; r-- !== 0;) if (e[r] !== t[r]) return !1;
			return !0;
		}
		if (e.constructor === RegExp) return e.source === t.source && e.flags === t.flags;
		if (e.valueOf !== Object.prototype.valueOf && e.valueOf !== lU.valueOf) return e.valueOf() === t.valueOf();
		if (e.toString !== Object.prototype.toString && e.toString !== lU.toString) return e.toString() === t.toString();
		let i = Object.keys(e);
		if (n = i.length, n !== Object.keys(t).length) return !1;
		for (r = n; r-- !== 0;) if (!Object.prototype.hasOwnProperty.call(t, i[r])) return !1;
		for (r = n; r-- !== 0;) {
			let n = i[r];
			if (!uU(e[n], t[n])) return !1;
		}
		return !0;
	}
	return e !== e && t !== t;
}
function dU(e) {
	let t = [];
	return (function e(n) {
		if (n != null && n.toJSON && typeof n.toJSON == "function" && (n = n.toJSON()), n === void 0) return;
		if (typeof n == "number") return isFinite(n) ? `${n}` : "null";
		if (typeof n != "object") return JSON.stringify(n);
		let r, i;
		if (Array.isArray(n)) {
			for (i = "[", r = 0; r < n.length; r++) r && (i += ","), i += e(n[r]) || "null";
			return `${i}]`;
		}
		if (n === null) return "null";
		if (t.includes(n)) throw TypeError("Converting circular structure to JSON");
		let a = t.push(n) - 1, o = Object.keys(n).sort();
		for (i = "", r = 0; r < o.length; r++) {
			let t = o[r], a = e(n[t]);
			a && (i && (i += ","), i += `${JSON.stringify(t)}:${a}`);
		}
		return t.splice(a, 1), `{${i}}`;
	})(e);
}
function J(e, t) {
	return F(e) && L(e, t) && e[t] !== void 0;
}
var fU = "row", pU = "column", mU = "facet", hU = "x", gU = "y", _U = "x2", vU = "y2", yU = "xOffset", bU = "yOffset", xU = "radius", SU = "radius2", CU = "theta", wU = "theta2", TU = "latitude", EU = "longitude", DU = "latitude2", OU = "longitude2", kU = "time", AU = "color", jU = "fill", MU = "stroke", NU = "shape", PU = "size", FU = "angle", IU = "opacity", LU = "fillOpacity", RU = "strokeOpacity", zU = "strokeWidth", BU = "strokeDash", VU = "text", HU = "order", UU = "detail", WU = "key", GU = "tooltip", KU = "href", qU = "url", JU = "description", YU = {
	x: 1,
	y: 1,
	x2: 1,
	y2: 1
}, XU = {
	theta: 1,
	theta2: 1,
	radius: 1,
	radius2: 1
};
function ZU(e) {
	return L(XU, e);
}
var QU = {
	longitude: 1,
	longitude2: 1,
	latitude: 1,
	latitude2: 1
};
function $U(e) {
	switch (e) {
		case TU: return "y";
		case DU: return "y2";
		case EU: return "x";
		case OU: return "x2";
	}
}
function eW(e) {
	return L(QU, e);
}
var tW = q(QU), nW = {
	...YU,
	...XU,
	...QU,
	xOffset: 1,
	yOffset: 1,
	color: 1,
	fill: 1,
	stroke: 1,
	time: 1,
	opacity: 1,
	fillOpacity: 1,
	strokeOpacity: 1,
	strokeWidth: 1,
	strokeDash: 1,
	size: 1,
	angle: 1,
	shape: 1,
	order: 1,
	text: 1,
	detail: 1,
	key: 1,
	tooltip: 1,
	href: 1,
	url: 1,
	description: 1
};
function rW(e) {
	return e === AU || e === jU || e === MU;
}
var iW = {
	row: 1,
	column: 1,
	facet: 1
}, aW = q(iW), oW = {
	...nW,
	...iW
}, sW = q(oW), { order: Ene, detail: Dne, tooltip: One, ...cW } = oW, { row: kne, column: Ane, facet: jne, ...lW } = cW;
function uW(e) {
	return L(lW, e);
}
function dW(e) {
	return L(oW, e);
}
var fW = [
	_U,
	vU,
	DU,
	OU,
	wU,
	SU
];
function pW(e) {
	return mW(e) !== e;
}
function mW(e) {
	switch (e) {
		case _U: return hU;
		case vU: return gU;
		case DU: return TU;
		case OU: return EU;
		case wU: return CU;
		case SU: return xU;
	}
	return e;
}
function hW(e) {
	if (ZU(e)) switch (e) {
		case CU: return "startAngle";
		case wU: return "endAngle";
		case xU: return "outerRadius";
		case SU: return "innerRadius";
	}
	return e;
}
function gW(e) {
	switch (e) {
		case hU: return _U;
		case gU: return vU;
		case TU: return DU;
		case EU: return OU;
		case CU: return wU;
		case xU: return SU;
	}
}
function _W(e) {
	switch (e) {
		case hU:
		case _U: return "width";
		case gU:
		case vU: return "height";
	}
}
function vW(e) {
	switch (e) {
		case hU: return "xOffset";
		case gU: return "yOffset";
		case _U: return "x2Offset";
		case vU: return "y2Offset";
		case CU: return "thetaOffset";
		case xU: return "radiusOffset";
		case wU: return "theta2Offset";
		case SU: return "radius2Offset";
	}
}
function yW(e) {
	switch (e) {
		case hU: return "xOffset";
		case gU: return "yOffset";
	}
}
function bW(e) {
	switch (e) {
		case "xOffset": return "x";
		case "yOffset": return "y";
	}
}
var xW = q(nW), { x: Mne, y: Nne, x2: Pne, y2: Fne, xOffset: Ine, yOffset: Lne, latitude: Rne, longitude: zne, latitude2: Bne, longitude2: Vne, theta: Hne, theta2: Une, radius: Wne, radius2: Gne, ...SW } = nW, CW = q(SW), wW = {
	x: 1,
	y: 1
}, TW = q(wW);
function EW(e) {
	return L(wW, e);
}
var DW = {
	theta: 1,
	radius: 1
}, OW = q(DW);
function kW(e) {
	return e === "width" ? hU : gU;
}
var AW = {
	xOffset: 1,
	yOffset: 1
};
function jW(e) {
	return L(AW, e);
}
var MW = { time: 1 };
function NW(e) {
	return e in MW;
}
var { text: Kne, tooltip: qne, href: Jne, url: Yne, description: Xne, detail: Zne, key: Qne, order: $ne, ...PW } = SW, FW = q(PW);
function IW(e) {
	return L(SW, e);
}
function LW(e) {
	switch (e) {
		case AU:
		case jU:
		case MU:
		case PU:
		case NU:
		case IU:
		case zU:
		case BU: return !0;
		case LU:
		case RU:
		case FU:
		case kU: return !1;
	}
}
var RW = {
	...wW,
	...DW,
	...AW,
	...PW
}, zW = q(RW);
function BW(e) {
	return L(RW, e);
}
function VW(e, t) {
	return WW(e)[t];
}
var HW = {
	arc: "always",
	area: "always",
	bar: "always",
	circle: "always",
	geoshape: "always",
	image: "always",
	line: "always",
	rule: "always",
	point: "always",
	rect: "always",
	square: "always",
	trail: "always",
	text: "always",
	tick: "always"
}, { geoshape: ere, ...UW } = HW;
function WW(e) {
	switch (e) {
		case AU:
		case jU:
		case MU:
		case JU:
		case UU:
		case WU:
		case GU:
		case KU:
		case HU:
		case IU:
		case LU:
		case RU:
		case zU:
		case mU:
		case fU:
		case pU: return HW;
		case hU:
		case gU:
		case yU:
		case bU:
		case TU:
		case EU:
		case kU: return UW;
		case _U:
		case vU:
		case DU:
		case OU: return {
			area: "always",
			bar: "always",
			image: "always",
			rect: "always",
			rule: "always",
			circle: "binned",
			point: "binned",
			square: "binned",
			tick: "binned",
			line: "binned",
			trail: "binned"
		};
		case PU: return {
			point: "always",
			tick: "always",
			rule: "always",
			circle: "always",
			square: "always",
			bar: "always",
			text: "always",
			line: "always",
			trail: "always"
		};
		case BU: return {
			line: "always",
			point: "always",
			tick: "always",
			rule: "always",
			circle: "always",
			square: "always",
			bar: "always",
			geoshape: "always"
		};
		case NU: return {
			point: "always",
			geoshape: "always"
		};
		case VU: return { text: "always" };
		case FU: return {
			point: "always",
			square: "always",
			text: "always"
		};
		case qU: return { image: "always" };
		case CU: return {
			text: "always",
			arc: "always"
		};
		case xU: return {
			text: "always",
			arc: "always"
		};
		case wU:
		case SU: return { arc: "always" };
	}
}
function GW(e) {
	switch (e) {
		case hU:
		case gU:
		case CU:
		case xU:
		case yU:
		case bU:
		case PU:
		case FU:
		case zU:
		case IU:
		case LU:
		case RU:
		case kU:
		case _U:
		case vU:
		case wU:
		case SU: return;
		case mU:
		case fU:
		case pU:
		case NU:
		case BU:
		case VU:
		case GU:
		case KU:
		case qU:
		case JU: return "discrete";
		case AU:
		case jU:
		case MU: return "flexible";
		case TU:
		case EU:
		case DU:
		case OU:
		case UU:
		case WU:
		case HU: return;
	}
}
var KW = {
	argmax: 1,
	argmin: 1,
	average: 1,
	count: 1,
	distinct: 1,
	exponential: 1,
	exponentialb: 1,
	product: 1,
	max: 1,
	mean: 1,
	median: 1,
	min: 1,
	missing: 1,
	q1: 1,
	q3: 1,
	ci0: 1,
	ci1: 1,
	stderr: 1,
	stdev: 1,
	stdevp: 1,
	sum: 1,
	valid: 1,
	values: 1,
	variance: 1,
	variancep: 1
}, qW = {
	count: 1,
	min: 1,
	max: 1
};
function JW(e) {
	return J(e, "argmin");
}
function YW(e) {
	return J(e, "argmax");
}
function XW(e) {
	return z(e) && L(KW, e);
}
var ZW = new Set([
	"count",
	"valid",
	"missing",
	"distinct"
]);
function QW(e) {
	return z(e) && ZW.has(e);
}
function $W(e) {
	return z(e) && EH(["min", "max"], e);
}
var eG = new Set([
	"count",
	"sum",
	"distinct",
	"valid",
	"missing"
]), tG = new Set([
	"mean",
	"average",
	"median",
	"q1",
	"q3",
	"min",
	"max"
]);
function nG(e) {
	return ed(e) && (e = ZX(e, void 0)), `bin${q(e).map((t) => oG(e[t]) ? HH(`_${t}_${zH(e[t])}`) : HH(`_${t}_${e[t]}`)).join("")}`;
}
function rG(e) {
	return e === !0 || aG(e) && !e.binned;
}
function iG(e) {
	return e === "binned" || aG(e) && e.binned === !0;
}
function aG(e) {
	return F(e);
}
function oG(e) {
	return J(e, "param");
}
function sG(e) {
	switch (e) {
		case fU:
		case pU:
		case PU:
		case AU:
		case jU:
		case MU:
		case zU:
		case IU:
		case LU:
		case RU:
		case NU: return 6;
		case BU: return 4;
		default: return 10;
	}
}
function cG(e) {
	return J(e, "expr");
}
function lG(e, { level: t } = { level: 0 }) {
	let n = q(e || {}), r = {};
	for (let i of n) r[i] = t === 0 ? xG(e[i]) : lG(e[i], { level: t - 1 });
	return r;
}
function uG(e) {
	let { anchor: t, frame: n, offset: r, orient: i, angle: a, limit: o, color: s, subtitleColor: c, subtitleFont: l, subtitleFontSize: u, subtitleFontStyle: d, subtitleFontWeight: f, subtitleLineHeight: p, subtitlePadding: m, ...h } = e, g = {
		...h,
		...s ? { fill: s } : {}
	}, _ = {
		...t ? { anchor: t } : {},
		...n ? { frame: n } : {},
		...r ? { offset: r } : {},
		...i ? { orient: i } : {},
		...a === void 0 ? {} : { angle: a },
		...o === void 0 ? {} : { limit: o }
	}, v = {
		...c ? { subtitleColor: c } : {},
		...l ? { subtitleFont: l } : {},
		...u ? { subtitleFontSize: u } : {},
		...d ? { subtitleFontStyle: d } : {},
		...f ? { subtitleFontWeight: f } : {},
		...p ? { subtitleLineHeight: p } : {},
		...m ? { subtitlePadding: m } : {}
	};
	return {
		titleMarkConfig: g,
		subtitleMarkConfig: SH(e, [
			"align",
			"baseline",
			"dx",
			"dy",
			"limit"
		]),
		nonMarkTitleProperties: _,
		subtitle: v
	};
}
function dG(e) {
	return z(e) || P(e) && z(e[0]);
}
function Y(e) {
	return J(e, "signal");
}
function fG(e) {
	return J(e, "step");
}
function pG(e) {
	return P(e) ? !1 : J(e, "fields") && !J(e, "data");
}
function mG(e) {
	return P(e) ? !1 : J(e, "fields") && J(e, "data");
}
function hG(e) {
	return P(e) ? !1 : J(e, "field") && J(e, "data");
}
var gG = q({
	aria: 1,
	description: 1,
	ariaRole: 1,
	ariaRoleDescription: 1,
	blend: 1,
	opacity: 1,
	fill: 1,
	fillOpacity: 1,
	stroke: 1,
	strokeCap: 1,
	strokeWidth: 1,
	strokeOpacity: 1,
	strokeDash: 1,
	strokeDashOffset: 1,
	strokeJoin: 1,
	strokeOffset: 1,
	strokeMiterLimit: 1,
	startAngle: 1,
	endAngle: 1,
	padAngle: 1,
	innerRadius: 1,
	outerRadius: 1,
	size: 1,
	shape: 1,
	interpolate: 1,
	tension: 1,
	orient: 1,
	align: 1,
	baseline: 1,
	text: 1,
	dir: 1,
	dx: 1,
	dy: 1,
	ellipsis: 1,
	limit: 1,
	radius: 1,
	theta: 1,
	angle: 1,
	font: 1,
	fontSize: 1,
	fontWeight: 1,
	fontStyle: 1,
	lineBreak: 1,
	lineHeight: 1,
	cursor: 1,
	href: 1,
	tooltip: 1,
	cornerRadius: 1,
	cornerRadiusTopLeft: 1,
	cornerRadiusTopRight: 1,
	cornerRadiusBottomLeft: 1,
	cornerRadiusBottomRight: 1,
	aspect: 1,
	width: 1,
	height: 1,
	url: 1,
	smooth: 1
}), _G = {
	arc: 1,
	area: 1,
	group: 1,
	image: 1,
	line: 1,
	path: 1,
	rect: 1,
	rule: 1,
	shape: 1,
	symbol: 1,
	text: 1,
	trail: 1
}, vG = [
	"cornerRadius",
	"cornerRadiusTopLeft",
	"cornerRadiusTopRight",
	"cornerRadiusBottomLeft",
	"cornerRadiusBottomRight"
], yG = " – ";
function bG(e) {
	let t = P(e.condition) ? e.condition.map(SG) : SG(e.condition);
	return {
		...xG(e),
		condition: t
	};
}
function xG(e) {
	if (cG(e)) {
		let { expr: t, ...n } = e;
		return {
			signal: t,
			...n
		};
	}
	return e;
}
function SG(e) {
	if (cG(e)) {
		let { expr: t, ...n } = e;
		return {
			signal: t,
			...n
		};
	}
	return e;
}
function CG(e) {
	if (cG(e)) {
		let { expr: t, ...n } = e;
		return {
			signal: t,
			...n
		};
	}
	return Y(e) ? e : e === void 0 ? void 0 : { value: e };
}
function wG(e) {
	return Y(e) ? e.signal : B(e);
}
function TG(e) {
	return Y(e) ? e.signal : B(e.value);
}
function EG(e) {
	return Y(e) ? e.signal : e == null ? null : B(e);
}
function DG(e, t, n) {
	for (let r of n) {
		let n = AG(r, t.markDef, t.config);
		n !== void 0 && (e[r] = CG(n));
	}
	return e;
}
function OG(e) {
	var t;
	return [].concat(e.type, (t = e.style) == null ? [] : t);
}
function kG(e, t, n, r = {}) {
	let { vgChannel: i, ignoreVgConfig: a } = r;
	return i && J(t, i) ? t[i] : t[e] === void 0 ? a && (!i || i === e) ? void 0 : AG(e, t, n, r) : t[e];
}
function AG(e, t, n, { vgChannel: r } = {}) {
	let i = jG(e, t, n.style);
	return tU(r ? i : void 0, i, r ? n[t.type][r] : void 0, n[t.type][e], r ? n.mark[r] : n.mark[e]);
}
function jG(e, t, n) {
	return MG(e, OG(t), n);
}
function MG(e, t, n) {
	t = I(t);
	let r;
	for (let i of t) {
		let t = n[i];
		J(t, e) && (r = t[e]);
	}
	return r;
}
function NG(e, t) {
	return I(e).reduce((e, n) => {
		var r;
		return e.field.push($(n, t)), e.order.push((r = n.sort) == null ? "ascending" : r), e;
	}, {
		field: [],
		order: []
	});
}
function PG(e, t) {
	let n = [...e];
	return t.forEach((e) => {
		for (let t of n) if (uU(t, e)) return;
		n.push(e);
	}), n;
}
function FG(e, t) {
	return uU(e, t) || !t ? e : e ? [...I(e), ...I(t)].join(", ") : t;
}
function IG(e, t) {
	let n = e.value, r = t.value;
	if (n == null || r === null) return {
		explicit: e.explicit,
		value: null
	};
	if ((dG(n) || Y(n)) && (dG(r) || Y(r))) return {
		explicit: e.explicit,
		value: FG(n, r)
	};
	if (dG(n) || Y(n)) return {
		explicit: e.explicit,
		value: n
	};
	if (dG(r) || Y(r)) return {
		explicit: e.explicit,
		value: r
	};
	if (!dG(n) && !Y(n) && !dG(r) && !Y(r)) return {
		explicit: e.explicit,
		value: PG(n, r)
	};
	/* istanbul ignore next: Condition should not happen -- only for warning in development. */
	throw Error("It should never reach here");
}
function LG(e) {
	return `Invalid specification ${dU(e)}. Make sure the specification includes at least one of the following properties: "mark", "layer", "facet", "hconcat", "vconcat", "concat", or "repeat".`;
}
var RG = "Autosize \"fit\" only works for single views and layered views.";
function zG(e) {
	return `${e == "width" ? "Width" : "Height"} "container" only works for single views and layered views.`;
}
function BG(e) {
	return `${e == "width" ? "Width" : "Height"} "container" only works well with autosize "fit" or "fit-${e == "width" ? "x" : "y"}".`;
}
function VG(e) {
	return e ? `Dropping "fit-${e}" because spec has discrete ${_W(e)}.` : "Dropping \"fit\" because spec has discrete size.";
}
function HG(e) {
	return `Unknown field for ${e}. Cannot calculate view size.`;
}
function UG(e) {
	return `Cannot project a selection on encoding channel "${e}", which has no field.`;
}
function WG(e, t) {
	return `Cannot project a selection on encoding channel "${e}" as it uses an aggregate function ("${t}").`;
}
function GG(e) {
	return `The "nearest" transform is not supported for ${e} marks.`;
}
function KG(e) {
	return `Selection not supported for ${e} yet.`;
}
function qG(e) {
	return `Cannot find a selection named "${e}".`;
}
var JG = "Scale bindings are currently only supported for scales with unbinned, continuous domains.", YG = "Sequntial scales are deprecated. The available quantitative scale type values are linear, log, pow, sqrt, symlog, time and utc", XG = "Legend bindings are only supported for selections over an individual field or encoding channel.";
function ZG(e) {
	return `Lookups can only be performed on selection parameters. "${e}" is a variable parameter.`;
}
function QG(e) {
	return `Cannot define and lookup the "${e}" selection in the same view. Try moving the lookup into a second, layered view?`;
}
var $G = "The same selection must be used to override scale domains in a layered view.", eK = "Interval selections should be initialized using \"x\", \"y\", \"longitude\", or \"latitude\" keys.";
function tK(e) {
	return `Unknown repeated value "${e}".`;
}
function nK(e) {
	return `The "columns" property cannot be used when "${e}" has nested row/column.`;
}
var rK = "Multiple timer selections in one unit spec are not supported. Ignoring all but the first.", iK = "Animation involving facet, layer, or concat is currently unsupported.";
function aK(e) {
	return `A "field" or "encoding" must be specified when using a selection as a scale domain. Using "field": ${B(e)}.`;
}
function oK(e, t, n, r) {
	return `${e.length ? "Multiple " : "No "}matching ${B(t)} encoding found for selection ${B(n.param)}. Using "field": ${B(r)}.`;
}
var sK = "Axes cannot be shared in concatenated or repeated views yet (https://github.com/vega/vega-lite/issues/2415).";
function cK(e) {
	return `Unrecognized parse "${e}".`;
}
function lK(e, t, n) {
	return `An ancestor parsed field "${e}" as ${n} but a child wants to parse the field as ${t}.`;
}
var uK = "Attempt to add the same child twice.";
function dK(e) {
	return `Ignoring an invalid transform: ${dU(e)}.`;
}
var fK = "If \"from.fields\" is not specified, \"as\" has to be a string that specifies the key to be used for the data from the secondary source.";
function pK(e) {
	return `Config.customFormatTypes is not true, thus custom format type and format for channel ${e} are dropped.`;
}
function mK(e) {
	let { parentProjection: t, projection: n } = e;
	return `Layer's shared projection ${dU(t)} is overridden by a child projection ${dU(n)}.`;
}
var hK = "Arc marks uses theta channel rather than angle, replacing angle with theta.";
function gK(e) {
	return `${e}Offset dropped because ${e} is continuous`;
}
function _K(e, t, n) {
	return `Channel ${e} is a ${t}. Converted to {value: ${dU(n)}}.`;
}
function vK(e) {
	return `Invalid field type "${e}".`;
}
function yK(e, t) {
	return `Invalid field type "${e}" for aggregate: "${t}", using "quantitative" instead.`;
}
function bK(e) {
	return `Invalid aggregation operator "${e}".`;
}
function xK(e, t) {
	let { fill: n, stroke: r } = t;
	return `Dropping color ${e} as the plot also has ${n && r ? "fill and stroke" : n ? "fill" : "stroke"}.`;
}
function SK(e) {
	return `Position range does not support relative band size for ${e}.`;
}
function CK(e, t) {
	return `Dropping ${dU(e)} from channel "${t}" since it does not contain any data field, datum, value, or signal.`;
}
var wK = "Line marks cannot encode size with a non-groupby field. You may want to use trail marks instead.";
function TK(e, t, n) {
	return `${e} dropped as it is incompatible with "${t}".`;
}
function EK(e) {
	return `${e}-encoding is dropped as ${e} is not a valid encoding channel.`;
}
function DK(e) {
	return `${e} encoding should be discrete (ordinal / nominal / binned).`;
}
function OK(e) {
	return `${e} encoding should be discrete (ordinal / nominal / binned) or use a discretizing scale (e.g. threshold).`;
}
function kK(e) {
	return `Facet encoding dropped as ${e.join(" and ")} ${e.length > 1 ? "are" : "is"} also specified.`;
}
function AK(e, t) {
	return `Using discrete channel "${e}" to encode "${t}" field can be misleading as it does not encode ${t === "ordinal" ? "order" : "magnitude"}.`;
}
function jK(e) {
	return `The ${e} for range marks cannot be an expression`;
}
function MK(e, t) {
	return `Line mark is for continuous lines and thus cannot be used with ${e && t ? "x2 and y2" : e ? "x2" : "y2"}. We will use the rule mark (line segments) instead.`;
}
function NK(e, t) {
	return `Specified orient "${e}" overridden with "${t}".`;
}
function PK(e) {
	return `Cannot use the scale property "${e}" with non-color channel.`;
}
function FK(e) {
	return `Cannot use the relative band size with ${e} scale.`;
}
function IK(e) {
	return `Using unaggregated domain with raw field has no effect (${dU(e)}).`;
}
function LK(e) {
	return `Unaggregated domain not applicable for "${e}" since it produces values outside the origin domain of the source data.`;
}
function RK(e) {
	return `Unaggregated domain is currently unsupported for log scale (${dU(e)}).`;
}
function zK(e) {
	return `Cannot apply size to non-oriented mark "${e}".`;
}
function BK(e, t, n) {
	return `Channel "${e}" does not work with "${t}" scale. We are using "${n}" scale instead.`;
}
function VK(e, t) {
	return `FieldDef does not work with "${e}" scale. We are using "${t}" scale instead.`;
}
function HK(e, t, n) {
	return `${n}-scale's "${t}" is dropped as it does not work with ${e} scale.`;
}
function UK(e) {
	return `The step for "${e}" is dropped because the ${e === "width" ? "x" : "y"} is continuous.`;
}
function WK(e, t, n, r) {
	return `Conflicting ${t.toString()} property "${e.toString()}" (${dU(n)} and ${dU(r)}). Using ${dU(n)}.`;
}
function GK(e, t, n, r) {
	return `Conflicting ${t.toString()} property "${e.toString()}" (${dU(n)} and ${dU(r)}). Using the union of the two domains.`;
}
function KK(e) {
	return `Setting the scale to be independent for "${e}" means we also have to set the guide (axis or legend) to be independent.`;
}
function qK(e) {
	return `Dropping sort property ${dU(e)} as unioned domains only support boolean or op "count", "min", and "max".`;
}
var JK = "Domains that should be unioned has conflicting sort properties. Sort will be set to true.", YK = "Detected faceted independent scales that union domain of multiple fields from different data sources. We will use the first field. The result view size may be incorrect.", XK = "Detected faceted independent scales that union domain of the same fields from different source. We will assume that this is the same field from a different fork of the same data source. However, if this is not the case, the result view size may be incorrect.", ZK = "Detected faceted independent scales that union domain of multiple fields from the same data source. We will use the first field. The result view size may be incorrect.";
function QK(e, t) {
	return `Unioning discrete legend values from ${e} and ${t}.`;
}
function $K(e) {
	return `Cannot stack "${e}" if there is already "${e}2".`;
}
function eq(e) {
	return `Stack is applied to a non-linear scale (${e}).`;
}
function tq(e) {
	return `Stacking is applied even though the aggregate function is non-summative ("${e}").`;
}
function nq(e, t) {
	return `Invalid ${e}: ${dU(t)}.`;
}
function rq(e) {
	return `Dropping day from datetime ${dU(e)} as day cannot be combined with other units.`;
}
function iq(e, t) {
	return `${t ? "extent " : ""}${t && e ? "and " : ""}${e ? "center " : ""}${t && e ? "are " : "is "}not needed when data are aggregated.`;
}
function aq(e, t, n) {
	return `${e} is not usually used with ${t} for ${n}.`;
}
function oq(e, t) {
	return `Continuous axis should not have customized aggregation function ${e}; ${t} already agregates the axis.`;
}
function sq(e) {
	return `1D error band does not support ${e}.`;
}
function cq(e) {
	return `Channel ${e} is required for "binned" bin.`;
}
function lq(e) {
	return `Channel ${e} should not be used with "binned" bin.`;
}
function uq(e) {
	return `Domain for ${e} is required for threshold scale.`;
}
var dq = pu(2), fq = dq;
function pq(e) {
	return fq = e, fq;
}
function mq() {
	return fq = dq, fq;
}
function hq(...e) {
	fq.error(...e);
}
function X(...e) {
	fq.warn(...e);
}
function gq(...e) {
	fq.debug(...e);
}
function _q(e) {
	if (e && F(e)) {
		for (let t of Aq) if (J(e, t)) return !0;
	}
	return !1;
}
var vq = [
	"january",
	"february",
	"march",
	"april",
	"may",
	"june",
	"july",
	"august",
	"september",
	"october",
	"november",
	"december"
], yq = vq.map((e) => e.substr(0, 3)), bq = [
	"sunday",
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday"
], xq = bq.map((e) => e.substr(0, 3));
function Sq(e) {
	if (cU(e) && (e = +e), rd(e)) return e > 4 && X(nq("quarter", e)), e - 1;
	throw Error(nq("quarter", e));
}
function Cq(e) {
	if (cU(e) && (e = +e), rd(e)) return e - 1;
	{
		let t = e.toLowerCase(), n = vq.indexOf(t);
		if (n !== -1) return n;
		let r = t.substr(0, 3), i = yq.indexOf(r);
		if (i !== -1) return i;
		throw Error(nq("month", e));
	}
}
function wq(e) {
	if (cU(e) && (e = +e), rd(e)) return e % 7;
	{
		let t = e.toLowerCase(), n = bq.indexOf(t);
		if (n !== -1) return n;
		let r = t.substr(0, 3), i = xq.indexOf(r);
		if (i !== -1) return i;
		throw Error(nq("day", e));
	}
}
function Tq(e, t) {
	let n = [];
	if (t && e.day !== void 0 && q(e).length > 1 && (X(rq(e)), e = K(e), delete e.day), e.year === void 0 ? n.push(2012) : n.push(e.year), e.month !== void 0) {
		let r = t ? Cq(e.month) : e.month;
		n.push(r);
	} else if (e.quarter !== void 0) {
		let r = t ? Sq(e.quarter) : e.quarter;
		n.push(rd(r) ? r * 3 : `${r}*3`);
	} else n.push(0);
	if (e.date !== void 0) n.push(e.date);
	else if (e.day !== void 0) {
		let r = t ? wq(e.day) : e.day;
		n.push(rd(r) ? r + 1 : `${r}+1`);
	} else n.push(1);
	for (let t of [
		"hours",
		"minutes",
		"seconds",
		"milliseconds"
	]) {
		let r = e[t];
		n.push(r === void 0 ? 0 : r);
	}
	return n;
}
function Eq(e) {
	let t = Tq(e, !0).join(", ");
	return e.utc ? `utc(${t})` : `datetime(${t})`;
}
function Dq(e) {
	let t = Tq(e, !1).join(", ");
	return e.utc ? `utc(${t})` : `datetime(${t})`;
}
function Oq(e) {
	let t = Tq(e, !0);
	return e.utc ? +new Date(Date.UTC(...t)) : +new Date(...t);
}
var kq = {
	year: 1,
	quarter: 1,
	month: 1,
	week: 1,
	day: 1,
	dayofyear: 1,
	date: 1,
	hours: 1,
	minutes: 1,
	seconds: 1,
	milliseconds: 1
}, Aq = q(kq);
function jq(e) {
	return L(kq, e);
}
function Mq(e) {
	return F(e) ? e.binned : Nq(e);
}
function Nq(e) {
	return e == null ? void 0 : e.startsWith("binned");
}
function Pq(e) {
	return e.startsWith("utc");
}
function Fq(e) {
	return e.substring(3);
}
var Iq = {
	"year-month": "%b %Y ",
	"year-month-date": "%b %d, %Y "
};
function Lq(e) {
	return Aq.filter((t) => zq(e, t));
}
function Rq(e) {
	let t = Lq(e);
	return t[t.length - 1];
}
function zq(e, t) {
	let n = e.indexOf(t);
	return !(n < 0 || n > 0 && t === "seconds" && e.charAt(n - 1) === "i" || e.length > n + 3 && t === "day" && e.charAt(n + 3) === "o" || n > 0 && t === "year" && e.charAt(n - 1) === "f");
}
function Bq(e, t, { end: n } = { end: !1 }) {
	let r = KH(t), i = Pq(e) ? "utc" : "";
	function a(e) {
		return e === "quarter" ? `(${i}quarter(${r})-1)` : `${i}${e}(${r})`;
	}
	let o, s = {};
	for (let t of Aq) zq(e, t) && (s[t] = a(t), o = t);
	return n && (s[o] += "+1"), Dq(s);
}
function Vq(e) {
	if (e) return `timeUnitSpecifier(${dU(Lq(e))}, ${dU(Iq)})`;
}
function Hq(e, t, n) {
	if (!e) return;
	let r = Vq(e);
	return `${n || Pq(e) ? "utc" : "time"}Format(${t}, ${r})`;
}
function Uq(e) {
	if (!e) return;
	let t;
	return z(e) ? t = Nq(e) ? {
		unit: e.substring(6),
		binned: !0
	} : { unit: e } : F(e) && (t = {
		...e,
		...e.unit ? { unit: e.unit } : {}
	}), Pq(t.unit) && (t.utc = !0, t.unit = Fq(t.unit)), t;
}
function Wq(e) {
	let { utc: t, ...n } = Uq(e);
	return n.unit ? (t ? "utc" : "") + q(n).map((e) => HH(`${e === "unit" ? "" : `_${e}_`}${n[e]}`)).join("") : `${t ? "utc" : ""}timeunit${q(n).map((e) => HH(`_${e}_${n[e]}`)).join("")}`;
}
function Gq(e, t = (e) => e) {
	let n = Uq(e), r = Rq(n.unit);
	if (r && r !== "day") {
		let e = {
			year: 2001,
			month: 1,
			date: 1,
			hours: 0,
			minutes: 0,
			seconds: 0,
			milliseconds: 0
		}, { step: i, part: a } = Jq(r, n.step);
		return `${t(Eq({
			...e,
			[a]: +e[a] + i
		}))} - ${t(Eq(e))}`;
	}
}
var Kq = {
	year: 1,
	month: 1,
	date: 1,
	hours: 1,
	minutes: 1,
	seconds: 1,
	milliseconds: 1
};
function qq(e) {
	return L(Kq, e);
}
function Jq(e, t = 1) {
	if (qq(e)) return {
		part: e,
		step: t
	};
	switch (e) {
		case "day":
		case "dayofyear": return {
			part: "date",
			step: t
		};
		case "quarter": return {
			part: "month",
			step: t * 3
		};
		case "week": return {
			part: "date",
			step: t * 7
		};
	}
}
function Yq(e) {
	return J(e, "param");
}
function Xq(e) {
	return !!(e != null && e.field) && e.equal !== void 0;
}
function Zq(e) {
	return !!(e != null && e.field) && e.lt !== void 0;
}
function Qq(e) {
	return !!(e != null && e.field) && e.lte !== void 0;
}
function $q(e) {
	return !!(e != null && e.field) && e.gt !== void 0;
}
function eJ(e) {
	return !!(e != null && e.field) && e.gte !== void 0;
}
function tJ(e) {
	return !!(e != null && e.field && (P(e.range) && e.range.length === 2 || Y(e.range)));
}
function nJ(e) {
	return !!(e != null && e.field) && (P(e.oneOf) || P(e.in));
}
function rJ(e) {
	return !!(e != null && e.field) && e.valid !== void 0;
}
function iJ(e) {
	return nJ(e) || Xq(e) || tJ(e) || Zq(e) || $q(e) || Qq(e) || eJ(e);
}
function aJ(e, t) {
	return nZ(e, {
		timeUnit: t,
		wrapTime: !0
	});
}
function oJ(e, t) {
	return e.map((e) => aJ(e, t));
}
function sJ(e, t = !0) {
	let { field: n } = e, { unit: r, binned: i } = Uq(e.timeUnit) || {}, a = $(e, { expr: "datum" }), o = r ? `time(${i ? a : Bq(r, n)})` : a;
	if (Xq(e)) return `${o}===${aJ(e.equal, r)}`;
	if (Zq(e)) {
		let t = e.lt;
		return `${o}<${aJ(t, r)}`;
	} else if ($q(e)) {
		let t = e.gt;
		return `${o}>${aJ(t, r)}`;
	} else if (Qq(e)) {
		let t = e.lte;
		return `${o}<=${aJ(t, r)}`;
	} else if (eJ(e)) {
		let t = e.gte;
		return `${o}>=${aJ(t, r)}`;
	} else if (nJ(e)) return `indexof([${oJ(e.oneOf, r).join(",")}], ${o}) !== -1`;
	else if (rJ(e)) return cJ(o, e.valid);
	else if (tJ(e)) {
		let { range: n } = lG(e), i = Y(n) ? { signal: `${n.signal}[0]` } : n[0], a = Y(n) ? { signal: `${n.signal}[1]` } : n[1];
		if (i !== null && a !== null && t) return `inrange(${o}, [${aJ(i, r)}, ${aJ(a, r)}])`;
		let s = [];
		return i !== null && s.push(`${o} >= ${aJ(i, r)}`), a !== null && s.push(`${o} <= ${aJ(a, r)}`), s.length > 0 ? s.join(" && ") : "true";
	}
	/* istanbul ignore next: it should never reach here */
	throw Error(`Invalid field predicate: ${dU(e)}`);
}
function cJ(e, t = !0) {
	return t ? `isValid(${e}) && isFinite(+${e})` : `!isValid(${e}) || !isFinite(+${e})`;
}
function lJ(e) {
	return iJ(e) && e.timeUnit ? {
		...e,
		timeUnit: Uq(e.timeUnit)
	} : e;
}
var uJ = {
	quantitative: "quantitative",
	ordinal: "ordinal",
	temporal: "temporal",
	nominal: "nominal",
	geojson: "geojson"
};
function dJ(e) {
	return e === "quantitative" || e === "temporal";
}
function fJ(e) {
	return e === "ordinal" || e === "nominal";
}
var pJ = uJ.quantitative, mJ = uJ.ordinal, hJ = uJ.temporal, gJ = uJ.nominal, _J = uJ.geojson;
function vJ(e) {
	if (e) switch (e = e.toLowerCase(), e) {
		case "q":
		case pJ: return "quantitative";
		case "t":
		case hJ: return "temporal";
		case "o":
		case mJ: return "ordinal";
		case "n":
		case gJ: return "nominal";
		case _J: return "geojson";
	}
}
var yJ = {
	LINEAR: "linear",
	LOG: "log",
	POW: "pow",
	SQRT: "sqrt",
	TIME: "time",
	UTC: "utc",
	POINT: "point",
	BAND: "band"
}, bJ = {
	linear: "numeric",
	log: "numeric",
	pow: "numeric",
	sqrt: "numeric",
	symlog: "numeric",
	identity: "numeric",
	sequential: "numeric",
	time: "time",
	utc: "time",
	ordinal: "ordinal",
	"bin-ordinal": "bin-ordinal",
	point: "ordinal-position",
	band: "ordinal-position",
	quantile: "discretizing",
	quantize: "discretizing",
	threshold: "discretizing"
};
function xJ(e, t) {
	let n = bJ[e], r = bJ[t];
	return n === r || n === "ordinal-position" && r === "time" || r === "ordinal-position" && n === "time";
}
var SJ = {
	linear: 0,
	log: 1,
	pow: 1,
	sqrt: 1,
	symlog: 1,
	identity: 1,
	sequential: 1,
	time: 0,
	utc: 0,
	point: 10,
	band: 11,
	ordinal: 0,
	"bin-ordinal": 0,
	quantile: 0,
	quantize: 0,
	threshold: 0
};
function CJ(e) {
	return SJ[e];
}
var wJ = new Set([
	"linear",
	"log",
	"pow",
	"sqrt",
	"symlog"
]), TJ = new Set([
	...wJ,
	"time",
	"utc"
]);
function EJ(e) {
	return wJ.has(e);
}
var DJ = new Set([
	"quantile",
	"quantize",
	"threshold"
]), OJ = new Set([
	...TJ,
	...DJ,
	"sequential",
	"identity"
]), kJ = new Set([
	"ordinal",
	"bin-ordinal",
	"point",
	"band"
]);
function AJ(e) {
	return kJ.has(e);
}
function jJ(e) {
	return OJ.has(e);
}
function MJ(e) {
	return TJ.has(e);
}
function NJ(e) {
	return DJ.has(e);
}
var PJ = {
	pointPadding: .5,
	barBandPaddingInner: .1,
	rectBandPaddingInner: 0,
	tickBandPaddingInner: .25,
	bandWithNestedOffsetPaddingInner: .2,
	bandWithNestedOffsetPaddingOuter: .2,
	minBandSize: 2,
	minFontSize: 8,
	maxFontSize: 40,
	minOpacity: .3,
	maxOpacity: .8,
	minSize: 4,
	minStrokeWidth: 1,
	maxStrokeWidth: 4,
	quantileCount: 4,
	quantizeCount: 4,
	zero: !0,
	framesPerSecond: 2,
	animationDuration: 5
};
function FJ(e) {
	return !z(e) && J(e, "name");
}
function IJ(e) {
	return J(e, "param");
}
function LJ(e) {
	return J(e, "unionWith");
}
function RJ(e) {
	return F(e) && "field" in e;
}
var { type: tre, domain: nre, range: rre, rangeMax: ire, rangeMin: are, scheme: ore, ...zJ } = {
	type: 1,
	domain: 1,
	domainMax: 1,
	domainMin: 1,
	domainMid: 1,
	domainRaw: 1,
	align: 1,
	range: 1,
	rangeMax: 1,
	rangeMin: 1,
	scheme: 1,
	bins: 1,
	reverse: 1,
	round: 1,
	clamp: 1,
	nice: 1,
	base: 1,
	exponent: 1,
	constant: 1,
	interpolate: 1,
	zero: 1,
	padding: 1,
	paddingInner: 1,
	paddingOuter: 1
}, BJ = q(zJ);
function VJ(e, t) {
	switch (t) {
		case "type":
		case "domain":
		case "reverse":
		case "range": return !0;
		case "scheme":
		case "interpolate": return ![
			"point",
			"band",
			"identity"
		].includes(e);
		case "bins": return ![
			"point",
			"band",
			"identity",
			"ordinal"
		].includes(e);
		case "round": return MJ(e) || e === "band" || e === "point";
		case "padding":
		case "rangeMin":
		case "rangeMax": return MJ(e) || ["point", "band"].includes(e);
		case "paddingOuter":
		case "align": return ["point", "band"].includes(e);
		case "paddingInner": return e === "band";
		case "domainMax":
		case "domainMid":
		case "domainMin":
		case "domainRaw":
		case "clamp": return MJ(e);
		case "nice": return MJ(e) || e === "quantize" || e === "threshold";
		case "exponent": return e === "pow";
		case "base": return e === "log";
		case "constant": return e === "symlog";
		case "zero": return jJ(e) && !EH([
			"log",
			"time",
			"utc",
			"threshold",
			"quantile"
		], e);
	}
}
function HJ(e, t) {
	switch (t) {
		case "interpolate":
		case "scheme":
		case "domainMid": return rW(e) ? void 0 : PK(t);
		case "align":
		case "type":
		case "bins":
		case "domain":
		case "domainMax":
		case "domainMin":
		case "domainRaw":
		case "range":
		case "base":
		case "exponent":
		case "constant":
		case "nice":
		case "padding":
		case "paddingInner":
		case "paddingOuter":
		case "rangeMax":
		case "rangeMin":
		case "reverse":
		case "round":
		case "clamp":
		case "zero": return;
	}
}
function UJ(e, t) {
	return EH([mJ, gJ], t) ? e === void 0 || AJ(e) : t === hJ ? EH([
		yJ.TIME,
		yJ.UTC,
		void 0
	], e) : t === pJ ? EJ(e) || NJ(e) || e === void 0 : !0;
}
function WJ(e, t, n = !1) {
	if (!BW(e)) return !1;
	switch (e) {
		case hU:
		case gU:
		case yU:
		case bU:
		case CU:
		case xU: return MJ(t) || t === "band" ? !0 : t === "point" ? !n : !1;
		case kU: return EH(["linear", "band"], t);
		case PU:
		case zU:
		case IU:
		case LU:
		case RU:
		case FU: return MJ(t) || NJ(t) || EH([
			"band",
			"point",
			"ordinal"
		], t);
		case AU:
		case jU:
		case MU: return t !== "band";
		case BU:
		case NU: return t === "ordinal" || NJ(t);
	}
}
function GJ(e) {
	return F(e) && "value" in e;
}
var KJ = {
	arc: "arc",
	area: "area",
	bar: "bar",
	image: "image",
	line: "line",
	point: "point",
	rect: "rect",
	rule: "rule",
	text: "text",
	tick: "tick",
	trail: "trail",
	circle: "circle",
	square: "square",
	geoshape: "geoshape"
}, qJ = KJ.arc, JJ = KJ.area, YJ = KJ.bar, XJ = KJ.image, ZJ = KJ.line, QJ = KJ.point, $J = KJ.rect, eY = KJ.rule, tY = KJ.text, nY = KJ.tick, rY = KJ.trail, iY = KJ.circle, aY = KJ.square, oY = KJ.geoshape;
function sY(e) {
	return [
		"line",
		"area",
		"trail"
	].includes(e);
}
function cY(e) {
	return [
		"rect",
		"bar",
		"image",
		"arc",
		"tick"
	].includes(e);
}
var lY = new Set(q(KJ));
function uY(e) {
	return J(e, "type");
}
var dY = [
	"stroke",
	"strokeWidth",
	"strokeDash",
	"strokeDashOffset",
	"strokeOpacity",
	"strokeJoin",
	"strokeMiterLimit"
], fY = ["fill", "fillOpacity"], pY = [...dY, ...fY], mY = q({
	color: 1,
	filled: 1,
	invalid: 1,
	order: 1,
	radius2: 1,
	theta2: 1,
	timeUnitBandSize: 1,
	timeUnitBandPosition: 1
}), hY = [
	"binSpacing",
	"continuousBandSize",
	"discreteBandSize",
	"minBandSize"
], gY = {
	area: ["line", "point"],
	bar: hY,
	rect: hY,
	line: ["point"],
	tick: [
		"bandSize",
		"thickness",
		...hY
	]
}, _Y = {
	color: "#4c78a8",
	invalid: "break-paths-show-path-domains",
	timeUnitBandSize: 1
}, vY = q({
	mark: 1,
	arc: 1,
	area: 1,
	bar: 1,
	circle: 1,
	image: 1,
	line: 1,
	point: 1,
	rect: 1,
	rule: 1,
	square: 1,
	text: 1,
	tick: 1,
	trail: 1,
	geoshape: 1
});
function yY(e) {
	return J(e, "band");
}
var bY = {
	horizontal: ["cornerRadiusTopRight", "cornerRadiusBottomRight"],
	vertical: ["cornerRadiusTopLeft", "cornerRadiusTopRight"]
}, xY = {
	binSpacing: 0,
	continuousBandSize: 5,
	minBandSize: .25,
	timeUnitBandPosition: .5
}, SY = {
	...xY,
	binSpacing: 1
}, CY = {
	...xY,
	thickness: 1
};
function wY(e) {
	return uY(e) ? e.type : e;
}
function TY(e, { isPath: t }) {
	return e === void 0 || e === "break-paths-show-path-domains" ? t ? "break-paths-show-domains" : "filter" : e === null ? "show" : e;
}
function EY({ markDef: e, config: t, scaleChannel: n, scaleType: r, isCountAggregate: i }) {
	var a;
	if (!r || !jJ(r) || i) return "always-valid";
	let o = TY(kG("invalid", e, t), { isPath: sY(e.type) });
	return ((a = t.scale) == null || (a = a.invalid) == null ? void 0 : a[n]) === void 0 ? o : "show";
}
function DY(e) {
	return e === "break-paths-filter-domains" || e === "break-paths-show-domains";
}
function OY({ scaleName: e, scale: t, mode: n }) {
	let r = `domain('${e}')`;
	if (!t || !e) return;
	let i = `${r}[0]`, a = `peek(${r})`, o = t.domainHasZero();
	return o === "definitely" ? {
		scale: e,
		value: 0
	} : o === "maybe" ? { signal: `scale('${e}', inrange(0, ${r}) ? 0 : ${n === "zeroOrMin" ? i : a})` } : { signal: `scale('${e}', ${n === "zeroOrMin" ? i : a})` };
}
function kY({ scaleChannel: e, channelDef: t, scale: n, scaleName: r, markDef: i, config: a }) {
	let o = n == null ? void 0 : n.get("type"), s = GX(t), c = EY({
		scaleChannel: e,
		markDef: i,
		config: a,
		scaleType: o,
		isCountAggregate: QW(s == null ? void 0 : s.aggregate)
	});
	if (s && c === "show") {
		var l, u;
		let t = (l = (u = a.scale.invalid) == null ? void 0 : u[e]) == null ? "zero-or-min" : l;
		return {
			test: cJ($(s, { expr: "datum" }), !1),
			...AY(t, n, r)
		};
	}
}
function AY(e, t, n) {
	if (GJ(e)) {
		let { value: t } = e;
		return Y(t) ? { signal: t.signal } : { value: t };
	}
	return OY({
		scale: t,
		scaleName: n,
		mode: "zeroOrMin"
	});
}
function jY(e) {
	let { channel: t, channelDef: n, markDef: r, scale: i, scaleName: a, config: o } = e, s = mW(t), c = IY(e), l = kY({
		scaleChannel: s,
		channelDef: n,
		scale: i,
		scaleName: a,
		markDef: r,
		config: o
	});
	return l === void 0 ? c : [l, c];
}
function MY(e) {
	let { datum: t } = e;
	return _q(t) ? Eq(t) : `${dU(t)}`;
}
function NY(e, t, n, r) {
	let i = {};
	if (t && (i.scale = t), yX(e)) {
		let { datum: t } = e;
		_q(t) ? i.signal = Eq(t) : Y(t) ? i.signal = t.signal : cG(t) ? i.signal = t.expr : i.value = t;
	} else i.field = $(e, n);
	if (r) {
		let { offset: e, band: t } = r;
		e && (i.offset = e), t && (i.band = t);
	}
	return i;
}
function PY({ scaleName: e, fieldOrDatumDef: t, fieldOrDatumDef2: n, offset: r, startSuffix: i, endSuffix: a = "end", bandPosition: o = .5 }) {
	let s = !Y(o) && 0 < o && o < 1 ? "datum" : void 0, c = $(t, {
		expr: s,
		suffix: i
	}), l = n === void 0 ? $(t, {
		suffix: a,
		expr: s
	}) : $(n, { expr: s }), u = {};
	return o === 0 || o === 1 ? (u.scale = e, u.field = o === 0 ? c : l) : u.signal = `scale("${e}", ${Y(o) ? `(1-${o.signal}) * ${c} + ${o.signal} * ${l}` : `${1 - o} * ${c} + ${o} * ${l}`})`, r && (u.offset = r), u;
}
function FY({ scaleName: e, fieldDef: t }) {
	let n = $(t, { expr: "datum" });
	return `abs(scale("${e}", ${$(t, {
		expr: "datum",
		suffix: "end"
	})}) - scale("${e}", ${n}))`;
}
function IY({ channel: e, channelDef: t, channel2Def: n, markDef: r, config: i, scaleName: a, scale: o, stack: s, offset: c, defaultRef: l, bandPosition: u }) {
	if (t) {
		/* istanbul ignore else */
		if (Q(t)) {
			var d, f;
			let l = o == null ? void 0 : o.get("type");
			if (CX(t)) {
				u != null || (u = uX({
					fieldDef: t,
					fieldDef2: n,
					markDef: r,
					config: i
				}));
				let { bin: o, timeUnit: d, type: f } = t;
				if (rG(o) || u && d && f === hJ) return s != null && s.impute ? NY(t, a, { binSuffix: "mid" }, { offset: c }) : u && !AJ(l) ? PY({
					scaleName: a,
					fieldOrDatumDef: t,
					bandPosition: u,
					offset: c
				}) : NY(t, a, iZ(t, e) ? { binSuffix: "range" } : {}, { offset: c });
				if (iG(o)) {
					if (Z(n)) return PY({
						scaleName: a,
						fieldOrDatumDef: t,
						fieldOrDatumDef2: n,
						bandPosition: u,
						offset: c
					});
					X(cq(e === hU ? _U : vU));
				}
			}
			return NY(t, a, AJ(l) ? { binSuffix: "range" } : {}, {
				offset: c,
				band: l === "band" ? (d = (f = u) == null ? t.bandPosition : f) == null ? .5 : d : void 0
			});
		} else if (wX(t)) {
			let n = t.value, r = c ? { offset: c } : {};
			return {
				...LY(e, n),
				...r
			};
		}
	}
	return Ru(l) && (l = l()), l && {
		...l,
		...c ? { offset: c } : {}
	};
}
function LY(e, t) {
	return EH(["x", "x2"], e) && t === "width" ? { field: { group: "width" } } : EH(["y", "y2"], e) && t === "height" ? { field: { group: "height" } } : CG(t);
}
function RY(e) {
	return e && e !== "number" && e !== "time";
}
function zY(e, t, n) {
	return `${e}(${t}${n ? `, ${dU(n)}` : ""})`;
}
function BY({ fieldOrDatumDef: e, format: t, formatType: n, expr: r, normalizeStack: i, config: a }) {
	if (RY(n)) return HY({
		fieldOrDatumDef: e,
		format: t,
		formatType: n,
		expr: r,
		config: a
	});
	let o = VY(e, r, i), s = vX(e);
	if (t === void 0 && n === void 0 && a.customFormatTypes) {
		if (s === "quantitative") {
			if (i && a.normalizedNumberFormatType) return HY({
				fieldOrDatumDef: e,
				format: a.normalizedNumberFormat,
				formatType: a.normalizedNumberFormatType,
				expr: r,
				config: a
			});
			if (a.numberFormatType) return HY({
				fieldOrDatumDef: e,
				format: a.numberFormat,
				formatType: a.numberFormatType,
				expr: r,
				config: a
			});
		}
		if (s === "temporal" && a.timeFormatType && Z(e) && e.timeUnit === void 0) return HY({
			fieldOrDatumDef: e,
			format: a.timeFormat,
			formatType: a.timeFormatType,
			expr: r,
			config: a
		});
	}
	function c(e) {
		return Z(e) ? Uq(e.timeUnit) || {} : {
			unit: void 0,
			utc: void 0
		};
	}
	if (eZ(e)) {
		var l;
		let { unit: n, utc: r } = c(e), i = XY({
			field: o,
			timeUnit: n,
			format: t,
			formatType: a.timeFormatType,
			rawTimeFormat: a.timeFormat,
			isUTCScale: r || TX(e) && ((l = e.scale) == null ? void 0 : l.type) === yJ.UTC
		});
		return i ? { signal: i } : void 0;
	}
	return t = GY({
		type: s,
		specifiedFormat: t,
		config: a,
		normalizeStack: i
	}), Z(e) && rG(e.bin) ? { signal: YY(o, $(e, {
		expr: r,
		binSuffix: "end"
	}), t, n, a) } : t || vX(e) === "quantitative" ? { signal: `${qY(o, t)}` } : { signal: `isValid(${o}) ? ${o} : ""+${o}` };
}
function VY(e, t, n) {
	return Z(e) ? n ? `${$(e, {
		expr: t,
		suffix: "end"
	})}-${$(e, {
		expr: t,
		suffix: "start"
	})}` : $(e, { expr: t }) : MY(e);
}
function HY({ fieldOrDatumDef: e, format: t, formatType: n, expr: r, normalizeStack: i, config: a, field: o }) {
	if (o != null || (o = VY(e, r, i)), o !== "datum.value" && Z(e) && rG(e.bin)) {
		let i = $(e, {
			expr: r,
			binSuffix: "end"
		});
		return { signal: YY(o, i, t, n, a) };
	}
	return { signal: zY(n, o, t) };
}
function UY(e, t, n, r, i, a) {
	if (!(z(r) && RY(r)) && !(n === void 0 && r === void 0 && i.customFormatTypes && vX(e) === "quantitative" && (i.normalizedNumberFormatType && EX(e) && e.stack === "normalize" || i.numberFormatType))) {
		if (EX(e) && e.stack === "normalize" && i.normalizedNumberFormat) return GY({
			type: "quantitative",
			config: i,
			normalizeStack: !0
		});
		if (eZ(e)) {
			var o;
			let t = Z(e) ? (o = Uq(e.timeUnit)) == null ? void 0 : o.unit : void 0;
			return t === void 0 && i.customFormatTypes && i.timeFormatType ? void 0 : KY({
				specifiedFormat: n,
				timeUnit: t,
				config: i,
				omitTimeFormatConfig: a
			});
		}
		return GY({
			type: t,
			specifiedFormat: n,
			config: i
		});
	}
}
function WY(e, t, n) {
	if (e && (Y(e) || e === "number" || e === "time")) return e;
	if (eZ(t) && n !== "time" && n !== "utc") {
		var r;
		return Z(t) && (r = Uq(t == null ? void 0 : t.timeUnit)) != null && r.utc ? "utc" : "time";
	}
}
function GY({ type: e, specifiedFormat: t, config: n, normalizeStack: r }) {
	if (z(t)) return t;
	if (e === pJ) return r ? n.normalizedNumberFormat : n.numberFormat;
}
function KY({ specifiedFormat: e, timeUnit: t, config: n, omitTimeFormatConfig: r }) {
	return e || (t ? { signal: Vq(t) } : r ? void 0 : n.timeFormat);
}
function qY(e, t) {
	return `format(${e}, "${t || ""}")`;
}
function JY(e, t, n, r) {
	var i;
	return RY(n) ? zY(n, e, t) : qY(e, (i = z(t) ? t : void 0) == null ? r.numberFormat : i);
}
function YY(e, t, n, r, i) {
	if (n === void 0 && r === void 0 && i.customFormatTypes && i.numberFormatType) return YY(e, t, i.numberFormat, i.numberFormatType, i);
	let a = JY(e, n, r, i), o = JY(t, n, r, i);
	return `${cJ(e, !1)} ? "null" : ${a} + "${yG}" + ${o}`;
}
function XY({ field: e, timeUnit: t, format: n, formatType: r, rawTimeFormat: i, isUTCScale: a }) {
	return !t || n ? !t && r ? `${r}(${e}, ${dU(n)})` : (n = z(n) ? n : i, `${a ? "utc" : "time"}Format(${e}, ${dU(n)})`) : Hq(t, e, a);
}
var ZY = "min", QY = {
	x: 1,
	y: 1,
	color: 1,
	fill: 1,
	stroke: 1,
	strokeWidth: 1,
	size: 1,
	shape: 1,
	fillOpacity: 1,
	strokeOpacity: 1,
	opacity: 1,
	text: 1
};
function $Y(e) {
	return L(QY, e);
}
function eX(e) {
	return J(e, "encoding");
}
function tX(e) {
	return e && (e.op === "count" || J(e, "field"));
}
function nX(e) {
	return e && P(e);
}
function rX(e) {
	return J(e, "row") || J(e, "column");
}
function iX(e) {
	return J(e, "header");
}
function aX(e) {
	return J(e, "facet");
}
function oX(e) {
	return J(e, "param");
}
function sX(e) {
	return !z(e) && J(e, "repeat");
}
function cX(e) {
	let { field: t, timeUnit: n, bin: r, aggregate: i } = e;
	return {
		...n ? { timeUnit: n } : {},
		...r ? { bin: r } : {},
		...i ? { aggregate: i } : {},
		field: t
	};
}
function lX(e) {
	return J(e, "sort");
}
function uX({ fieldDef: e, fieldDef2: t, markDef: n, config: r }) {
	if (Q(e) && e.bandPosition !== void 0) return e.bandPosition;
	if (Z(e)) {
		let { timeUnit: i, bin: a } = e;
		if (i && !t) return AG("timeUnitBandPosition", n, r);
		if (rG(a)) return .5;
	}
}
function dX({ channel: e, fieldDef: t, fieldDef2: n, markDef: r, config: i, scaleType: a, useVlSizeChannel: o }) {
	let s = _W(e), c = kG(o ? "size" : s, r, i, { vgChannel: s });
	if (c !== void 0) return c;
	if (Z(t)) {
		let { timeUnit: e, bin: o } = t;
		if (e && !n) return { band: AG("timeUnitBandSize", r, i) };
		if (rG(o) && !AJ(a)) return { band: 1 };
	}
	if (cY(r.type)) {
		var l;
		if (a) if (AJ(a)) {
			var u;
			return ((u = i[r.type]) == null ? void 0 : u.discreteBandSize) || { band: 1 };
		} else {
			var d;
			return (d = i[r.type]) == null ? void 0 : d.continuousBandSize;
		}
		return (l = i[r.type]) == null ? void 0 : l.discreteBandSize;
	}
}
function fX(e, t, n, r) {
	return rG(e.bin) || e.timeUnit && CX(e) && e.type === "temporal" ? uX({
		fieldDef: e,
		fieldDef2: t,
		markDef: n,
		config: r
	}) !== void 0 : !1;
}
function pX(e) {
	return J(e, "sort") && !J(e, "field");
}
function mX(e) {
	return J(e, "condition");
}
function hX(e) {
	let t = e == null ? void 0 : e.condition;
	return !!t && !P(t) && Z(t);
}
function gX(e) {
	let t = e == null ? void 0 : e.condition;
	return !!t && !P(t) && Q(t);
}
function _X(e) {
	let t = e == null ? void 0 : e.condition;
	return !!t && (P(t) || wX(t));
}
function Z(e) {
	return J(e, "field") || (e == null ? void 0 : e.aggregate) === "count";
}
function vX(e) {
	return e == null ? void 0 : e.type;
}
function yX(e) {
	return J(e, "datum");
}
function bX(e) {
	return CX(e) && !jX(e) || SX(e);
}
function xX(e) {
	return CX(e) && e.type === "quantitative" && !e.bin || SX(e);
}
function SX(e) {
	return yX(e) && rd(e.datum);
}
function Q(e) {
	return Z(e) || yX(e);
}
function CX(e) {
	return e && (J(e, "field") || e.aggregate === "count") && J(e, "type");
}
function wX(e) {
	return J(e, "value");
}
function TX(e) {
	return J(e, "scale") || J(e, "sort");
}
function EX(e) {
	return J(e, "axis") || J(e, "stack") || J(e, "impute");
}
function DX(e) {
	return J(e, "legend");
}
function OX(e) {
	return J(e, "format") || J(e, "formatType");
}
function kX(e) {
	return CH(e, [
		"legend",
		"axis",
		"header",
		"scale"
	]);
}
function AX(e) {
	return J(e, "op");
}
function $(e, t = {}) {
	let n = e.field, r = t.prefix, i = t.suffix, a = "";
	if (NX(e)) n = aU("count");
	else {
		let r;
		if (!t.nofn) if (AX(e)) r = e.op;
		else {
			let { bin: l, aggregate: u, timeUnit: d } = e;
			if (rG(l)) {
				var o, s;
				r = nG(l), i = ((o = t.binSuffix) == null ? "" : o) + ((s = t.suffix) == null ? "" : s);
			} else if (u) YW(u) ? (a = `["${n}"]`, n = `argmax_${u.argmax}`) : JW(u) ? (a = `["${n}"]`, n = `argmin_${u.argmin}`) : r = String(u);
			else if (d && !Mq(d)) {
				var c;
				r = Wq(d), i = (!["range", "mid"].includes(t.binSuffix) && t.binSuffix || "") + ((c = t.suffix) == null ? "" : c);
			}
		}
		r && (n = n ? `${r}_${n}` : r);
	}
	return i && (n = `${n}_${i}`), r && (n = `${r}_${n}`), t.forAs ? $H(n) : t.expr ? qH(n, t.expr) + a : ZH(n) + a;
}
function jX(e) {
	switch (e.type) {
		case "nominal":
		case "ordinal":
		case "geojson": return !0;
		case "quantitative": return Z(e) && !!e.bin;
		case "temporal": return !1;
	}
	throw Error(vK(e.type));
}
function MX(e) {
	var t;
	return TX(e) && NJ((t = e.scale) == null ? void 0 : t.type);
}
function NX(e) {
	return e.aggregate === "count";
}
function PX(e, t) {
	let { field: n, bin: r, timeUnit: i, aggregate: a } = e;
	if (a === "count") return t.countTitle;
	if (rG(r)) return `${n} (binned)`;
	if (i && !Mq(i)) {
		var o;
		let e = (o = Uq(i)) == null ? void 0 : o.unit;
		if (e) return `${n} (${Lq(e).join("-")})`;
	} else if (a) return YW(a) ? `${n} for max ${a.argmax}` : JW(a) ? `${n} for min ${a.argmin}` : `${GH(a)} of ${n}`;
	return n;
}
function FX(e) {
	let { aggregate: t, bin: n, timeUnit: r, field: i } = e;
	if (YW(t)) return `${i} for argmax(${t.argmax})`;
	if (JW(t)) return `${i} for argmin(${t.argmin})`;
	let a = r && !Mq(r) ? Uq(r) : void 0, o = t || (a == null ? void 0 : a.unit) || (a == null ? void 0 : a.maxbins) && "timeunit" || rG(n) && "bin";
	return o ? `${o.toUpperCase()}(${i})` : i;
}
var IX = (e, t) => {
	switch (t.fieldTitle) {
		case "plain": return e.field;
		case "functional": return FX(e);
		default: return PX(e, t);
	}
}, LX = IX;
function RX(e) {
	LX = e;
}
function zX() {
	RX(IX);
}
function BX(e, t, { allowDisabling: n, includeDefault: r = !0 }) {
	var i;
	let a = (i = VX(e)) == null ? void 0 : i.title;
	if (!Z(e)) return a == null ? e.title : a;
	let o = e, s = r ? HX(o, t) : void 0;
	if (n) return tU(a, o.title, s);
	var c;
	return (c = a == null ? o.title : a) == null ? s : c;
}
function VX(e) {
	if (EX(e) && e.axis) return e.axis;
	if (DX(e) && e.legend) return e.legend;
	if (iX(e) && e.header) return e.header;
}
function HX(e, t) {
	return LX(e, t);
}
function UX(e) {
	if (OX(e)) {
		let { format: t, formatType: n } = e;
		return {
			format: t,
			formatType: n
		};
	} else {
		var t;
		let { format: n, formatType: r } = (t = VX(e)) == null ? {} : t;
		return {
			format: n,
			formatType: r
		};
	}
}
function WX(e, t) {
	var n;
	switch (t) {
		case "latitude":
		case "longitude": return "quantitative";
		case "row":
		case "column":
		case "facet":
		case "shape":
		case "strokeDash": return "nominal";
		case "order": return "ordinal";
	}
	if (lX(e) && P(e.sort)) return "ordinal";
	let { aggregate: r, bin: i, timeUnit: a } = e;
	if (a) return "temporal";
	if (i || r && !YW(r) && !JW(r)) return "quantitative";
	if (TX(e) && (n = e.scale) != null && n.type) switch (bJ[e.scale.type]) {
		case "numeric":
		case "discretizing": return "quantitative";
		case "time": return "temporal";
	}
	return "nominal";
}
function GX(e) {
	if (Z(e)) return e;
	if (hX(e)) return e.condition;
}
function KX(e) {
	if (Q(e)) return e;
	if (gX(e)) return e.condition;
}
function qX(e, t, n, r = {}) {
	return VH(e) ? (X(_K(t, z(e) ? "string" : rd(e) ? "number" : "boolean", e)), { value: e }) : Q(e) ? JX(e, t, n, r) : gX(e) ? {
		...e,
		condition: JX(e.condition, t, n, r)
	} : e;
}
function JX(e, t, n, r) {
	if (OX(e)) {
		let { format: i, formatType: a, ...o } = e;
		if (RY(a) && !n.customFormatTypes) return X(pK(t)), JX(o, t, n, r);
	} else {
		let i = EX(e) ? "axis" : DX(e) ? "legend" : iX(e) ? "header" : null;
		if (i && e[i]) {
			let { format: a, formatType: o, ...s } = e[i];
			if (RY(o) && !n.customFormatTypes) return X(pK(t)), JX({
				...e,
				[i]: s
			}, t, n, r);
		}
	}
	return Z(e) ? XX(e, t, r) : YX(e);
}
function YX(e) {
	let t = e.type;
	if (t) return e;
	let { datum: n } = e;
	return t = rd(n) ? "quantitative" : z(n) ? "nominal" : _q(n) ? "temporal" : void 0, {
		...e,
		type: t
	};
}
function XX(e, t, { compositeMark: n = !1 } = {}) {
	let { aggregate: r, timeUnit: i, bin: a, field: o } = e, s = { ...e };
	if (!n && r && !XW(r) && !YW(r) && !JW(r) && (X(bK(r)), delete s.aggregate), i && (s.timeUnit = Uq(i)), o && (s.field = `${o}`), rG(a) && (s.bin = ZX(a, t)), iG(a) && !EW(t) && X(lq(t)), CX(s)) {
		let { type: e } = s, t = vJ(e);
		e !== t && (s.type = t), e !== "quantitative" && QW(r) && (X(yK(e, r)), s.type = "quantitative");
	} else pW(t) || (s.type = WX(s, t));
	if (CX(s)) {
		let { compatible: e, warning: n } = $X(s, t) || {};
		e === !1 && X(n);
	}
	if (lX(s) && z(s.sort)) {
		let { sort: e } = s;
		if ($Y(e)) return {
			...s,
			sort: { encoding: e }
		};
		let t = e.substring(1);
		if (e.charAt(0) === "-" && $Y(t)) return {
			...s,
			sort: {
				encoding: t,
				order: "descending"
			}
		};
	}
	if (iX(s)) {
		let { header: e } = s;
		if (e) {
			let { orient: t, ...n } = e;
			if (t) return {
				...s,
				header: {
					...n,
					labelOrient: e.labelOrient || t,
					titleOrient: e.titleOrient || t
				}
			};
		}
	}
	return s;
}
function ZX(e, t) {
	return ed(e) ? { maxbins: sG(t) } : e === "binned" ? { binned: !0 } : !e.maxbins && !e.step ? {
		...e,
		maxbins: sG(t)
	} : e;
}
var QX = { compatible: !0 };
function $X(e, t) {
	let n = e.type;
	if (n === "geojson" && t !== "shape") return {
		compatible: !1,
		warning: `Channel ${t} should not be used with a geojson data.`
	};
	switch (t) {
		case fU:
		case pU:
		case mU: return jX(e) ? QX : {
			compatible: !1,
			warning: DK(t)
		};
		case hU:
		case gU:
		case yU:
		case bU:
		case AU:
		case jU:
		case MU:
		case VU:
		case UU:
		case WU:
		case GU:
		case KU:
		case qU:
		case FU:
		case CU:
		case xU:
		case JU: return QX;
		case EU:
		case OU:
		case TU:
		case DU: return n === pJ ? QX : {
			compatible: !1,
			warning: `Channel ${t} should be used with a quantitative field only, not ${e.type} field.`
		};
		case IU:
		case LU:
		case RU:
		case zU:
		case PU:
		case wU:
		case SU:
		case _U:
		case vU:
		case kU: return n === "nominal" && !e.sort ? {
			compatible: !1,
			warning: `Channel ${t} should not be used with an unsorted discrete field.`
		} : QX;
		case NU:
		case BU: return !jX(e) && !MX(e) ? {
			compatible: !1,
			warning: OK(t)
		} : QX;
		case HU: return e.type === "nominal" && !("sort" in e) ? {
			compatible: !1,
			warning: "Channel order is inappropriate for nominal field, which has no inherent order."
		} : QX;
	}
}
function eZ(e) {
	let { formatType: t } = UX(e);
	return t === "time" || !t && tZ(e);
}
function tZ(e) {
	return e && (e.type === "temporal" || Z(e) && !!e.timeUnit);
}
function nZ(e, { timeUnit: t, type: n, wrapTime: r, undefinedIfExprNotRequired: i }) {
	var a;
	let o = t && ((a = Uq(t)) == null ? void 0 : a.unit), s = o || n === "temporal", c;
	return cG(e) ? c = e.expr : Y(e) ? c = e.signal : _q(e) ? (s = !0, c = Eq(e)) : (z(e) || rd(e)) && s && (c = `datetime(${dU(e)})`, jq(o) && (rd(e) && e < 1e4 || z(e) && isNaN(Date.parse(e))) && (c = Eq({ [o]: e }))), c ? r && s ? `time(${c})` : c : i ? void 0 : dU(e);
}
function rZ(e, t) {
	let { type: n } = e;
	return t.map((t) => {
		let r = nZ(t, {
			timeUnit: Z(e) && !Mq(e.timeUnit) ? e.timeUnit : void 0,
			type: n,
			undefinedIfExprNotRequired: !0
		});
		return r === void 0 ? t : { signal: r };
	});
}
function iZ(e, t) {
	return rG(e.bin) ? BW(t) && ["ordinal", "nominal"].includes(e.type) : (console.warn("Only call this method for binned field defs."), !1);
}
var aZ = {
	labelAlign: {
		part: "labels",
		vgProp: "align"
	},
	labelBaseline: {
		part: "labels",
		vgProp: "baseline"
	},
	labelColor: {
		part: "labels",
		vgProp: "fill"
	},
	labelFont: {
		part: "labels",
		vgProp: "font"
	},
	labelFontSize: {
		part: "labels",
		vgProp: "fontSize"
	},
	labelFontStyle: {
		part: "labels",
		vgProp: "fontStyle"
	},
	labelFontWeight: {
		part: "labels",
		vgProp: "fontWeight"
	},
	labelOpacity: {
		part: "labels",
		vgProp: "opacity"
	},
	labelOffset: null,
	labelPadding: null,
	gridColor: {
		part: "grid",
		vgProp: "stroke"
	},
	gridDash: {
		part: "grid",
		vgProp: "strokeDash"
	},
	gridDashOffset: {
		part: "grid",
		vgProp: "strokeDashOffset"
	},
	gridOpacity: {
		part: "grid",
		vgProp: "opacity"
	},
	gridWidth: {
		part: "grid",
		vgProp: "strokeWidth"
	},
	tickColor: {
		part: "ticks",
		vgProp: "stroke"
	},
	tickDash: {
		part: "ticks",
		vgProp: "strokeDash"
	},
	tickDashOffset: {
		part: "ticks",
		vgProp: "strokeDashOffset"
	},
	tickOpacity: {
		part: "ticks",
		vgProp: "opacity"
	},
	tickSize: null,
	tickWidth: {
		part: "ticks",
		vgProp: "strokeWidth"
	}
};
function oZ(e) {
	return e == null ? void 0 : e.condition;
}
var sZ = [
	"domain",
	"grid",
	"labels",
	"ticks",
	"title"
], cZ = {
	grid: "grid",
	gridCap: "grid",
	gridColor: "grid",
	gridDash: "grid",
	gridDashOffset: "grid",
	gridOpacity: "grid",
	gridScale: "grid",
	gridWidth: "grid",
	orient: "main",
	bandPosition: "both",
	aria: "main",
	description: "main",
	domain: "main",
	domainCap: "main",
	domainColor: "main",
	domainDash: "main",
	domainDashOffset: "main",
	domainOpacity: "main",
	domainWidth: "main",
	format: "main",
	formatType: "main",
	labelAlign: "main",
	labelAngle: "main",
	labelBaseline: "main",
	labelBound: "main",
	labelColor: "main",
	labelFlush: "main",
	labelFlushOffset: "main",
	labelFont: "main",
	labelFontSize: "main",
	labelFontStyle: "main",
	labelFontWeight: "main",
	labelLimit: "main",
	labelLineHeight: "main",
	labelOffset: "main",
	labelOpacity: "main",
	labelOverlap: "main",
	labelPadding: "main",
	labels: "main",
	labelSeparation: "main",
	maxExtent: "main",
	minExtent: "main",
	offset: "both",
	position: "main",
	tickCap: "main",
	tickColor: "main",
	tickDash: "main",
	tickDashOffset: "main",
	tickMinStep: "both",
	tickOffset: "both",
	tickOpacity: "main",
	tickRound: "both",
	ticks: "main",
	tickSize: "main",
	tickWidth: "both",
	title: "main",
	titleAlign: "main",
	titleAnchor: "main",
	titleAngle: "main",
	titleBaseline: "main",
	titleColor: "main",
	titleFont: "main",
	titleFontSize: "main",
	titleFontStyle: "main",
	titleFontWeight: "main",
	titleLimit: "main",
	titleLineHeight: "main",
	titleOpacity: "main",
	titlePadding: "main",
	titleX: "main",
	titleY: "main",
	encode: "both",
	scale: "both",
	tickBand: "both",
	tickCount: "both",
	tickExtra: "both",
	translate: "both",
	values: "both",
	zindex: "both"
}, lZ = {
	orient: 1,
	aria: 1,
	bandPosition: 1,
	description: 1,
	domain: 1,
	domainCap: 1,
	domainColor: 1,
	domainDash: 1,
	domainDashOffset: 1,
	domainOpacity: 1,
	domainWidth: 1,
	format: 1,
	formatType: 1,
	grid: 1,
	gridCap: 1,
	gridColor: 1,
	gridDash: 1,
	gridDashOffset: 1,
	gridOpacity: 1,
	gridWidth: 1,
	labelAlign: 1,
	labelAngle: 1,
	labelBaseline: 1,
	labelBound: 1,
	labelColor: 1,
	labelFlush: 1,
	labelFlushOffset: 1,
	labelFont: 1,
	labelFontSize: 1,
	labelFontStyle: 1,
	labelFontWeight: 1,
	labelLimit: 1,
	labelLineHeight: 1,
	labelOffset: 1,
	labelOpacity: 1,
	labelOverlap: 1,
	labelPadding: 1,
	labels: 1,
	labelSeparation: 1,
	maxExtent: 1,
	minExtent: 1,
	offset: 1,
	position: 1,
	tickBand: 1,
	tickCap: 1,
	tickColor: 1,
	tickCount: 1,
	tickDash: 1,
	tickDashOffset: 1,
	tickExtra: 1,
	tickMinStep: 1,
	tickOffset: 1,
	tickOpacity: 1,
	tickRound: 1,
	ticks: 1,
	tickSize: 1,
	tickWidth: 1,
	title: 1,
	titleAlign: 1,
	titleAnchor: 1,
	titleAngle: 1,
	titleBaseline: 1,
	titleColor: 1,
	titleFont: 1,
	titleFontSize: 1,
	titleFontStyle: 1,
	titleFontWeight: 1,
	titleLimit: 1,
	titleLineHeight: 1,
	titleOpacity: 1,
	titlePadding: 1,
	titleX: 1,
	titleY: 1,
	translate: 1,
	values: 1,
	zindex: 1
}, uZ = {
	...lZ,
	style: 1,
	labelExpr: 1,
	encoding: 1
};
function dZ(e) {
	return L(uZ, e);
}
var fZ = q({
	axis: 1,
	axisBand: 1,
	axisBottom: 1,
	axisDiscrete: 1,
	axisLeft: 1,
	axisPoint: 1,
	axisQuantitative: 1,
	axisRight: 1,
	axisTemporal: 1,
	axisTop: 1,
	axisX: 1,
	axisXBand: 1,
	axisXDiscrete: 1,
	axisXPoint: 1,
	axisXQuantitative: 1,
	axisXTemporal: 1,
	axisY: 1,
	axisYBand: 1,
	axisYDiscrete: 1,
	axisYPoint: 1,
	axisYQuantitative: 1,
	axisYTemporal: 1
});
function pZ(e) {
	return J(e, "mark");
}
var mZ = class {
	constructor(t, n) {
		e(this, "name", void 0), e(this, "run", void 0), this.name = t, this.run = n;
	}
	hasMatchingType(e) {
		return pZ(e) ? wY(e.mark) === this.name : !1;
	}
};
function hZ(e, t) {
	let n = e == null ? void 0 : e[t];
	return n ? P(n) ? DH(n, (e) => !!e.field) : Z(n) || hX(n) : !1;
}
function gZ(e, t) {
	let n = e == null ? void 0 : e[t];
	return n ? P(n) ? DH(n, (e) => !!e.field) : Z(n) || yX(n) || gX(n) : !1;
}
function _Z(e, t) {
	if (EW(t)) {
		let n = e[t];
		if ((Z(n) || yX(n)) && (fJ(n.type) || Z(n) && n.timeUnit)) return gZ(e, yW(t));
	}
	return !1;
}
function vZ(e) {
	return DH(sW, (t) => {
		if (hZ(e, t)) {
			let n = e[t];
			if (P(n)) return DH(n, (e) => !!e.aggregate);
			{
				let e = GX(n);
				return e && !!e.aggregate;
			}
		}
		return !1;
	});
}
function yZ(e, t) {
	let n = [], r = [], i = [], a = [], o = {};
	return wZ(e, (s, c) => {
		if (Z(s)) {
			let { field: l, aggregate: u, bin: d, timeUnit: f, ...p } = s;
			if (u || f || d) {
				let e = VX(s), m = e == null ? void 0 : e.title, h = $(s, { forAs: !0 }), g = {
					...m ? [] : { title: BX(s, t, { allowDisabling: !0 }) },
					...p,
					field: h
				};
				if (u) {
					let e;
					if (YW(u) ? (e = "argmax", h = $({
						op: "argmax",
						field: u.argmax
					}, { forAs: !0 }), g.field = `${h}.${l}`) : JW(u) ? (e = "argmin", h = $({
						op: "argmin",
						field: u.argmin
					}, { forAs: !0 }), g.field = `${h}.${l}`) : u !== "boxplot" && u !== "errorbar" && u !== "errorband" && (e = u), e) {
						let t = {
							op: e,
							as: h
						};
						l && (t.field = l), a.push(t);
					}
				} else if (n.push(h), CX(s) && rG(d)) {
					if (r.push({
						bin: d,
						field: l,
						as: h
					}), n.push($(s, { binSuffix: "end" })), iZ(s, c) && n.push($(s, { binSuffix: "range" })), EW(c)) {
						let e = { field: `${h}_end` };
						o[`${c}2`] = e;
					}
					g.bin = "binned", pW(c) || (g.type = pJ);
				} else if (f && !Mq(f)) {
					i.push({
						timeUnit: f,
						field: l,
						as: h
					});
					let e = CX(s) && s.type !== hJ && "time";
					e && (c === VU || c === GU ? g.formatType = e : IW(c) ? g.legend = {
						formatType: e,
						...g.legend
					} : EW(c) && (g.axis = {
						formatType: e,
						...g.axis
					}));
				}
				o[c] = g;
			} else n.push(l), o[c] = e[c];
		} else o[c] = e[c];
	}), {
		bins: r,
		timeUnits: i,
		aggregate: a,
		groupby: n,
		encoding: o
	};
}
function bZ(e, t, n) {
	let r = VW(t, n);
	if (!r) return !1;
	if (r === "binned") {
		let n = e[t === _U ? hU : gU];
		return !!(Z(n) && Z(e[t]) && iG(n.bin));
	}
	return !0;
}
function xZ(e, t, n, r) {
	let i = {};
	for (let t of q(e)) dW(t) || X(EK(t));
	for (let a of xW) {
		if (!e[a]) continue;
		let o = e[a];
		if (jW(a)) {
			let e = bW(a), t = i[e];
			if (Z(t) && dJ(t.type) && Z(o) && !t.timeUnit) {
				X(gK(e));
				continue;
			}
		}
		if (a === "angle" && t === "arc" && !e.theta && (X(hK), a = CU), !bZ(e, a, t)) {
			X(TK(a, t));
			continue;
		}
		if (a === PU && t === "line") {
			let t = GX(e[a]);
			if (t != null && t.aggregate) {
				X(wK);
				continue;
			}
		}
		if (a === AU && (n ? "fill" in e : "stroke" in e)) {
			X(xK("encoding", {
				fill: "fill" in e,
				stroke: "stroke" in e
			}));
			continue;
		}
		if (a === UU || a === HU && !P(o) && !wX(o) || a === GU && P(o)) {
			if (o) {
				if (a === HU) {
					let t = e[a];
					if (pX(t)) {
						i[a] = t;
						continue;
					}
				}
				i[a] = I(o).reduce((e, t) => (Z(t) ? e.push(XX(t, a)) : X(CK(t, a)), e), []);
			}
		} else {
			if (a === GU && o === null) i[a] = null;
			else if (!Z(o) && !yX(o) && !wX(o) && !mX(o) && !Y(o)) {
				X(CK(o, a));
				continue;
			}
			i[a] = qX(o, a, r);
		}
	}
	return i;
}
function SZ(e, t) {
	let n = {};
	for (let r of q(e)) n[r] = qX(e[r], r, t, { compositeMark: !0 });
	return n;
}
function CZ(e) {
	let t = [];
	for (let n of q(e)) if (hZ(e, n)) {
		let r = e[n], i = I(r);
		for (let e of i) Z(e) ? t.push(e) : hX(e) && t.push(e.condition);
	}
	return t;
}
function wZ(e, t, n) {
	if (e) for (let r of q(e)) {
		let i = e[r];
		if (P(i)) for (let e of i) t.call(n, e, r);
		else t.call(n, i, r);
	}
}
function TZ(e, t, n, r) {
	return e ? q(e).reduce((n, i) => {
		let a = e[i];
		return P(a) ? a.reduce((e, n) => t.call(r, e, n, i), n) : t.call(r, n, a, i);
	}, n) : n;
}
function EZ(e, t) {
	return q(t).reduce((n, r) => {
		switch (r) {
			case hU:
			case gU:
			case KU:
			case JU:
			case qU:
			case _U:
			case vU: return n;
			case yU:
			case bU:
				if (e === "line" || e === "area" || e === "trail") {
					let e = t[r];
					if (Z(e)) {
						let i = t[r === yU ? hU : gU];
						if (Z(i) && !i.aggregate && !e.aggregate) {
							let t = $(i, {}), r = $(e, {});
							t && r && t !== r && n.push(t);
						}
					}
				}
				return n;
			case CU:
			case wU:
			case xU:
			case SU:
			case kU:
			case TU:
			case EU:
			case DU:
			case OU:
			case VU:
			case NU:
			case FU:
			case GU: return n;
			case HU: if (e === "line" || e === "trail") return n;
			case UU:
			case WU: {
				let e = t[r];
				if (P(e) || Z(e)) for (let t of I(e)) t.aggregate || n.push($(t, {}));
				return n;
			}
			case PU: if (e === "trail") return n;
			case AU:
			case jU:
			case MU:
			case IU:
			case LU:
			case RU:
			case BU:
			case zU: {
				let e = GX(t[r]);
				return e && !e.aggregate && n.push($(e, {})), n;
			}
		}
	}, []);
}
function DZ(e) {
	let { tooltip: t, ...n } = e;
	if (!t) return { filteredEncoding: n };
	let r, i;
	if (P(t)) {
		for (let e of t) e.aggregate ? (r || (r = []), r.push(e)) : (i || (i = []), i.push(e));
		r && (n.tooltip = r);
	} else t.aggregate ? n.tooltip = t : i = t;
	return P(i) && i.length === 1 && (i = i[0]), {
		customTooltipWithoutAggregatedField: i,
		filteredEncoding: n
	};
}
function OZ(e, t, n, r = !0) {
	if ("tooltip" in n) return { tooltip: n.tooltip };
	let i = e.map(({ fieldPrefix: e, titlePrefix: n }) => {
		let i = r ? ` of ${kZ(t)}` : "";
		return {
			field: e + t.field,
			type: t.type,
			title: Y(n) ? { signal: `${n}"${escape(i)}"` } : n + i
		};
	}), a = CZ(n).map(kX);
	return { tooltip: [...i, ...jH(a, wH)] };
}
function kZ(e) {
	let { title: t, field: n } = e;
	return tU(t, n);
}
function AZ(e, t, n, r, i) {
	let { scale: a, axis: o } = n;
	return ({ partName: s, mark: c, positionPrefix: l, endPositionPrefix: u = void 0, extraEncoding: d = {} }) => {
		let f = kZ(n);
		return jZ(e, s, i, {
			mark: c,
			encoding: {
				[t]: {
					field: `${l}_${n.field}`,
					type: n.type,
					...f === void 0 ? {} : { title: f },
					...a === void 0 ? {} : { scale: a },
					...o === void 0 ? {} : { axis: o }
				},
				...z(u) ? { [`${t}2`]: { field: `${u}_${n.field}` } } : {},
				...r,
				...d
			}
		});
	};
}
function jZ(e, t, n, r) {
	let { clip: i, color: a, opacity: o } = e, s = e.type;
	return e[t] || e[t] === void 0 && n[t] ? [{
		...r,
		mark: {
			...n[t],
			...i ? { clip: i } : {},
			...a ? { color: a } : {},
			...o ? { opacity: o } : {},
			...uY(r.mark) ? r.mark : { type: r.mark },
			style: `${s}-${String(t)}`,
			...ed(e[t]) ? {} : e[t]
		}
	}] : [];
}
function MZ(e, t, n) {
	let { encoding: r } = e, i = t === "vertical" ? "y" : "x", a = r[i], o = r[`${i}2`], s = r[`${i}Error`], c = r[`${i}Error2`];
	return {
		continuousAxisChannelDef: NZ(a, n),
		continuousAxisChannelDef2: NZ(o, n),
		continuousAxisChannelDefError: NZ(s, n),
		continuousAxisChannelDefError2: NZ(c, n),
		continuousAxis: i
	};
}
function NZ(e, t) {
	if (e != null && e.aggregate) {
		let { aggregate: n, ...r } = e;
		return n !== t && X(oq(n, t)), r;
	} else return e;
}
function PZ(e, t) {
	let { mark: n, encoding: r } = e, { x: i, y: a } = r;
	if (uY(n) && n.orient) return n.orient;
	if (bX(i)) {
		if (bX(a)) {
			let e = Z(i) && i.aggregate, n = Z(a) && a.aggregate;
			if (!e && n === t) return "vertical";
			if (!n && e === t) return "horizontal";
			if (e === t && n === t) throw Error("Both x and y cannot have aggregate");
			return eZ(a) && !eZ(i) ? "horizontal" : "vertical";
		}
		return "horizontal";
	} else if (bX(a)) return "vertical";
	else throw Error(`Need a valid continuous axis for ${t}s`);
}
var FZ = "boxplot", IZ = [
	"box",
	"median",
	"outliers",
	"rule",
	"ticks"
], LZ = new mZ(FZ, zZ);
function RZ(e) {
	return rd(e) ? "tukey" : e;
}
function zZ(e, { config: t }) {
	var n;
	e = {
		...e,
		encoding: SZ(e.encoding, t)
	};
	let { mark: r, encoding: i, params: a, projection: o, ...s } = e, c = uY(r) ? r : { type: r };
	a && X(KG("boxplot"));
	let l = (n = c.extent) == null ? t.boxplot.extent : n, u = kG("size", c, t), d = c.invalid, f = RZ(l), { bins: p, timeUnits: m, transform: h, continuousAxisChannelDef: g, continuousAxis: _, groupby: v, aggregate: y, encodingWithoutContinuousAxis: b, ticksOrient: x, boxOrient: S, customTooltipWithoutAggregatedField: C } = VZ(e, l, t), w = $H(g.field), { color: T, size: E, ...D } = b, O = (e) => AZ(c, _, g, e, t.boxplot), k = O(D), ee = O(b), te = (F(t.boxplot.box) ? t.boxplot.box.color : t.mark.color) || "#4c78a8", ne = O({
		...D,
		...E ? { size: E } : {},
		color: { condition: {
			test: `${JH(`lower_box_${g.field}`)} >= ${JH(`upper_box_${g.field}`)}`,
			...T || { value: te }
		} }
	}), re = OZ([
		{
			fieldPrefix: f === "min-max" ? "upper_whisker_" : "max_",
			titlePrefix: "Max"
		},
		{
			fieldPrefix: "upper_box_",
			titlePrefix: "Q3"
		},
		{
			fieldPrefix: "mid_box_",
			titlePrefix: "Median"
		},
		{
			fieldPrefix: "lower_box_",
			titlePrefix: "Q1"
		},
		{
			fieldPrefix: f === "min-max" ? "lower_whisker_" : "min_",
			titlePrefix: "Min"
		}
	], g, b), ie = {
		type: "tick",
		color: "black",
		opacity: 1,
		orient: x,
		invalid: d,
		aria: !1
	}, ae = f === "min-max" ? re : OZ([{
		fieldPrefix: "upper_whisker_",
		titlePrefix: "Upper Whisker"
	}, {
		fieldPrefix: "lower_whisker_",
		titlePrefix: "Lower Whisker"
	}], g, b), oe = [
		...k({
			partName: "rule",
			mark: {
				type: "rule",
				invalid: d,
				aria: !1
			},
			positionPrefix: "lower_whisker",
			endPositionPrefix: "lower_box",
			extraEncoding: ae
		}),
		...k({
			partName: "rule",
			mark: {
				type: "rule",
				invalid: d,
				aria: !1
			},
			positionPrefix: "upper_box",
			endPositionPrefix: "upper_whisker",
			extraEncoding: ae
		}),
		...k({
			partName: "ticks",
			mark: ie,
			positionPrefix: "lower_whisker",
			extraEncoding: ae
		}),
		...k({
			partName: "ticks",
			mark: ie,
			positionPrefix: "upper_whisker",
			extraEncoding: ae
		})
	], se = [
		...f === "tukey" ? [] : oe,
		...ee({
			partName: "box",
			mark: {
				type: "bar",
				...u ? { size: u } : {},
				orient: S,
				invalid: d,
				ariaRoleDescription: "box"
			},
			positionPrefix: "lower_box",
			endPositionPrefix: "upper_box",
			extraEncoding: re
		}),
		...ne({
			partName: "median",
			mark: {
				type: "tick",
				invalid: d,
				...F(t.boxplot.median) && t.boxplot.median.color ? { color: t.boxplot.median.color } : {},
				...u ? { size: u } : {},
				orient: x,
				aria: !1
			},
			positionPrefix: "mid_box",
			extraEncoding: re
		})
	];
	if (f === "min-max") {
		var ce;
		return {
			...s,
			transform: ((ce = s.transform) == null ? [] : ce).concat(h),
			layer: se
		};
	}
	let le = JH(`lower_box_${g.field}`), ue = JH(`upper_box_${g.field}`), de = `(${ue} - ${le})`, fe = `${le} - ${l} * ${de}`, pe = `${ue} + ${l} * ${de}`, me = JH(g.field), he = {
		joinaggregate: BZ(g.field),
		groupby: v
	}, ge = {
		transform: [{ filter: `(${fe} <= ${me}) && (${me} <= ${pe})` }, {
			aggregate: [
				{
					op: "min",
					field: g.field,
					as: `lower_whisker_${w}`
				},
				{
					op: "max",
					field: g.field,
					as: `upper_whisker_${w}`
				},
				{
					op: "min",
					field: `lower_box_${g.field}`,
					as: `lower_box_${w}`
				},
				{
					op: "max",
					field: `upper_box_${g.field}`,
					as: `upper_box_${w}`
				},
				...y
			],
			groupby: v
		}],
		layer: oe
	}, { tooltip: _e, ...ve } = D, { scale: ye, axis: be } = g, xe = kZ(g), Se = jZ(c, "outliers", t.boxplot, {
		transform: [{ filter: `(${me} < ${fe}) || (${me} > ${pe})` }],
		mark: "point",
		encoding: {
			[_]: {
				field: g.field,
				type: g.type,
				...xe === void 0 ? {} : { title: xe },
				...ye === void 0 ? {} : { scale: ye },
				...be === void 0 ? {} : { axis: be }
			},
			...ve,
			...T ? { color: T } : {},
			...C ? { tooltip: C } : {}
		}
	})[0], Ce, we = [
		...p,
		...m,
		he
	];
	return Se ? Ce = {
		transform: we,
		layer: [Se, ge]
	} : (Ce = ge, Ce.transform.unshift(...we)), {
		...s,
		layer: [Ce, {
			transform: h,
			layer: se
		}]
	};
}
function BZ(e) {
	let t = $H(e);
	return [{
		op: "q1",
		field: e,
		as: `lower_box_${t}`
	}, {
		op: "q3",
		field: e,
		as: `upper_box_${t}`
	}];
}
function VZ(e, t, n) {
	let r = PZ(e, FZ), { continuousAxisChannelDef: i, continuousAxis: a } = MZ(e, r, FZ), o = i.field, s = $H(o), c = RZ(t), l = [
		...BZ(o),
		{
			op: "median",
			field: o,
			as: `mid_box_${s}`
		},
		{
			op: "min",
			field: o,
			as: (c === "min-max" ? "lower_whisker_" : "min_") + s
		},
		{
			op: "max",
			field: o,
			as: (c === "min-max" ? "upper_whisker_" : "max_") + s
		}
	], u = c === "min-max" || c === "tukey" ? [] : [
		{
			calculate: `${JH(`upper_box_${s}`)} - ${JH(`lower_box_${s}`)}`,
			as: `iqr_${s}`
		},
		{
			calculate: `min(${JH(`upper_box_${s}`)} + ${JH(`iqr_${s}`)} * ${t}, ${JH(`max_${s}`)})`,
			as: `upper_whisker_${s}`
		},
		{
			calculate: `max(${JH(`lower_box_${s}`)} - ${JH(`iqr_${s}`)} * ${t}, ${JH(`min_${s}`)})`,
			as: `lower_whisker_${s}`
		}
	], { [a]: d, ...f } = e.encoding, { customTooltipWithoutAggregatedField: p, filteredEncoding: m } = DZ(f), { bins: h, timeUnits: g, aggregate: _, groupby: v, encoding: y } = yZ(m, n), b = r === "vertical" ? "horizontal" : "vertical", x = r;
	return {
		bins: h,
		timeUnits: g,
		transform: [
			...h,
			...g,
			{
				aggregate: [..._, ...l],
				groupby: v
			},
			...u
		],
		groupby: v,
		aggregate: _,
		continuousAxisChannelDef: i,
		continuousAxis: a,
		encodingWithoutContinuousAxis: y,
		ticksOrient: b,
		boxOrient: x,
		customTooltipWithoutAggregatedField: p
	};
}
var HZ = "errorbar", UZ = ["ticks", "rule"], WZ = new mZ(HZ, GZ);
function GZ(e, { config: t }) {
	e = {
		...e,
		encoding: SZ(e.encoding, t)
	};
	let { transform: n, continuousAxisChannelDef: r, continuousAxis: i, encodingWithoutContinuousAxis: a, ticksOrient: o, markDef: s, outerSpec: c, tooltipEncoding: l } = XZ(e, HZ, t);
	delete a.size;
	let u = AZ(s, i, r, a, t.errorbar), d = s.thickness, f = s.size, p = {
		type: "tick",
		orient: o,
		aria: !1,
		...d === void 0 ? {} : { thickness: d },
		...f === void 0 ? {} : { size: f }
	}, m = [
		...u({
			partName: "ticks",
			mark: p,
			positionPrefix: "lower",
			extraEncoding: l
		}),
		...u({
			partName: "ticks",
			mark: p,
			positionPrefix: "upper",
			extraEncoding: l
		}),
		...u({
			partName: "rule",
			mark: {
				type: "rule",
				ariaRoleDescription: "errorbar",
				...d === void 0 ? {} : { size: d }
			},
			positionPrefix: "lower",
			endPositionPrefix: "upper",
			extraEncoding: l
		})
	];
	return {
		...c,
		transform: n,
		...m.length > 1 ? { layer: m } : { ...m[0] }
	};
}
function KZ(e, t) {
	let { encoding: n } = e;
	if (qZ(n)) return {
		orient: PZ(e, t),
		inputType: "raw"
	};
	let r = JZ(n), i = YZ(n), a = n.x, o = n.y;
	if (r) {
		if (i) throw Error(`${t} cannot be both type aggregated-upper-lower and aggregated-error`);
		let e = n.x2, r = n.y2;
		if (Q(e) && Q(r)) throw Error(`${t} cannot have both x2 and y2`);
		if (Q(e)) {
			if (bX(a)) return {
				orient: "horizontal",
				inputType: "aggregated-upper-lower"
			};
			throw Error(`Both x and x2 have to be quantitative in ${t}`);
		} else if (Q(r)) {
			if (bX(o)) return {
				orient: "vertical",
				inputType: "aggregated-upper-lower"
			};
			throw Error(`Both y and y2 have to be quantitative in ${t}`);
		}
		throw Error("No ranged axis");
	} else {
		let e = n.xError, r = n.xError2, i = n.yError, s = n.yError2;
		if (Q(r) && !Q(e)) throw Error(`${t} cannot have xError2 without xError`);
		if (Q(s) && !Q(i)) throw Error(`${t} cannot have yError2 without yError`);
		if (Q(e) && Q(i)) throw Error(`${t} cannot have both xError and yError with both are quantiative`);
		if (Q(e)) {
			if (bX(a)) return {
				orient: "horizontal",
				inputType: "aggregated-error"
			};
			throw Error("All x, xError, and xError2 (if exist) have to be quantitative");
		} else if (Q(i)) {
			if (bX(o)) return {
				orient: "vertical",
				inputType: "aggregated-error"
			};
			throw Error("All y, yError, and yError2 (if exist) have to be quantitative");
		}
		throw Error("No ranged axis");
	}
}
function qZ(e) {
	return (Q(e.x) || Q(e.y)) && !Q(e.x2) && !Q(e.y2) && !Q(e.xError) && !Q(e.xError2) && !Q(e.yError) && !Q(e.yError2);
}
function JZ(e) {
	return Q(e.x2) || Q(e.y2);
}
function YZ(e) {
	return Q(e.xError) || Q(e.xError2) || Q(e.yError) || Q(e.yError2);
}
function XZ(e, t, n) {
	var r;
	let { mark: i, encoding: a, params: o, projection: s, ...c } = e, l = uY(i) ? i : { type: i };
	o && X(KG(t));
	let { orient: u, inputType: d } = KZ(e, t), { continuousAxisChannelDef: f, continuousAxisChannelDef2: p, continuousAxisChannelDefError: m, continuousAxisChannelDefError2: h, continuousAxis: g } = MZ(e, u, t), { errorBarSpecificAggregate: _, postAggregateCalculates: v, tooltipSummary: y, tooltipTitleWithFieldName: b } = ZZ(l, f, p, m, h, d, t, n), { [g]: x, [g === "x" ? "x2" : "y2"]: S, [g === "x" ? "xError" : "yError"]: C, [g === "x" ? "xError2" : "yError2"]: w, ...T } = a, { bins: E, timeUnits: D, aggregate: O, groupby: k, encoding: ee } = yZ(T, n), te = [...O, ..._], ne = d === "raw" ? k : [], re = OZ(y, f, ee, b);
	return {
		transform: [
			...(r = c.transform) == null ? [] : r,
			...E,
			...D,
			...te.length === 0 ? [] : [{
				aggregate: te,
				groupby: ne
			}],
			...v
		],
		groupby: ne,
		continuousAxisChannelDef: f,
		continuousAxis: g,
		encodingWithoutContinuousAxis: ee,
		ticksOrient: u === "vertical" ? "horizontal" : "vertical",
		markDef: l,
		outerSpec: c,
		tooltipEncoding: re
	};
}
function ZZ(e, t, n, r, i, a, o, s) {
	let c = [], l = [], u = t.field, d, f = !1;
	if (a === "raw") {
		let t = e.center ? e.center : e.extent ? e.extent === "iqr" ? "median" : "mean" : s.errorbar.center, n = e.extent ? e.extent : t === "mean" ? "stderr" : "iqr";
		if (t === "median" != (n === "iqr") && X(aq(t, n, o)), n === "stderr" || n === "stdev") c = [{
			op: n,
			field: u,
			as: `extent_${u}`
		}, {
			op: t,
			field: u,
			as: `center_${u}`
		}], l = [{
			calculate: `${JH(`center_${u}`)} + ${JH(`extent_${u}`)}`,
			as: `upper_${u}`
		}, {
			calculate: `${JH(`center_${u}`)} - ${JH(`extent_${u}`)}`,
			as: `lower_${u}`
		}], d = [
			{
				fieldPrefix: "center_",
				titlePrefix: GH(t)
			},
			{
				fieldPrefix: "upper_",
				titlePrefix: QZ(t, n, "+")
			},
			{
				fieldPrefix: "lower_",
				titlePrefix: QZ(t, n, "-")
			}
		], f = !0;
		else {
			let e, t, r;
			n === "ci" ? (e = "mean", t = "ci0", r = "ci1") : (e = "median", t = "q1", r = "q3"), c = [
				{
					op: t,
					field: u,
					as: `lower_${u}`
				},
				{
					op: r,
					field: u,
					as: `upper_${u}`
				},
				{
					op: e,
					field: u,
					as: `center_${u}`
				}
			], d = [
				{
					fieldPrefix: "upper_",
					titlePrefix: BX({
						field: u,
						aggregate: r,
						type: "quantitative"
					}, s, { allowDisabling: !1 })
				},
				{
					fieldPrefix: "lower_",
					titlePrefix: BX({
						field: u,
						aggregate: t,
						type: "quantitative"
					}, s, { allowDisabling: !1 })
				},
				{
					fieldPrefix: "center_",
					titlePrefix: BX({
						field: u,
						aggregate: e,
						type: "quantitative"
					}, s, { allowDisabling: !1 })
				}
			];
		}
	} else {
		(e.center || e.extent) && X(iq(e.center, e.extent)), a === "aggregated-upper-lower" ? (d = [], l = [{
			calculate: JH(n.field),
			as: `upper_${u}`
		}, {
			calculate: JH(u),
			as: `lower_${u}`
		}]) : a === "aggregated-error" && (d = [{
			fieldPrefix: "",
			titlePrefix: u
		}], l = [{
			calculate: `${JH(u)} + ${JH(r.field)}`,
			as: `upper_${u}`
		}], i ? l.push({
			calculate: `${JH(u)} + ${JH(i.field)}`,
			as: `lower_${u}`
		}) : l.push({
			calculate: `${JH(u)} - ${JH(r.field)}`,
			as: `lower_${u}`
		}));
		for (let e of l) d.push({
			fieldPrefix: e.as.substring(0, 6),
			titlePrefix: QH(QH(e.calculate, "datum['", ""), "']", "")
		});
	}
	return {
		postAggregateCalculates: l,
		errorBarSpecificAggregate: c,
		tooltipSummary: d,
		tooltipTitleWithFieldName: f
	};
}
function QZ(e, t, n) {
	return `${GH(e)} ${n} ${t}`;
}
var $Z = "errorband", eQ = ["band", "borders"], tQ = new mZ($Z, nQ);
function nQ(e, { config: t }) {
	e = {
		...e,
		encoding: SZ(e.encoding, t)
	};
	let { transform: n, continuousAxisChannelDef: r, continuousAxis: i, encodingWithoutContinuousAxis: a, markDef: o, outerSpec: s, tooltipEncoding: c } = XZ(e, $Z, t), l = o, u = AZ(l, i, r, a, t.errorband), d = e.encoding.x !== void 0 && e.encoding.y !== void 0, f = { type: d ? "area" : "rect" }, p = { type: d ? "line" : "rule" }, m = {
		...l.interpolate ? { interpolate: l.interpolate } : {},
		...l.tension && l.interpolate ? { tension: l.tension } : {}
	};
	return d ? (f = {
		...f,
		...m,
		ariaRoleDescription: "errorband"
	}, p = {
		...p,
		...m,
		aria: !1
	}) : l.interpolate ? X(sq("interpolate")) : l.tension && X(sq("tension")), {
		...s,
		transform: n,
		layer: [
			...u({
				partName: "band",
				mark: f,
				positionPrefix: "lower",
				endPositionPrefix: "upper",
				extraEncoding: c
			}),
			...u({
				partName: "borders",
				mark: p,
				positionPrefix: "lower",
				extraEncoding: c
			}),
			...u({
				partName: "borders",
				mark: p,
				positionPrefix: "upper",
				extraEncoding: c
			})
		]
	};
}
var rQ = {};
function iQ(e, t, n) {
	rQ[e] = {
		normalizer: new mZ(e, t),
		parts: n
	};
}
function aQ() {
	return q(rQ);
}
iQ(FZ, zZ, IZ), iQ(HZ, GZ, UZ), iQ($Z, nQ, eQ);
var oQ = [
	"gradientHorizontalMaxLength",
	"gradientHorizontalMinLength",
	"gradientVerticalMaxLength",
	"gradientVerticalMinLength",
	"unselectedOpacity"
], sQ = {
	titleAlign: "align",
	titleAnchor: "anchor",
	titleAngle: "angle",
	titleBaseline: "baseline",
	titleColor: "color",
	titleFont: "font",
	titleFontSize: "fontSize",
	titleFontStyle: "fontStyle",
	titleFontWeight: "fontWeight",
	titleLimit: "limit",
	titleLineHeight: "lineHeight",
	titleOrient: "orient",
	titlePadding: "offset"
}, cQ = {
	labelAlign: "align",
	labelAnchor: "anchor",
	labelAngle: "angle",
	labelBaseline: "baseline",
	labelColor: "color",
	labelFont: "font",
	labelFontSize: "fontSize",
	labelFontStyle: "fontStyle",
	labelFontWeight: "fontWeight",
	labelLimit: "limit",
	labelLineHeight: "lineHeight",
	labelOrient: "orient",
	labelPadding: "offset"
}, lQ = q(sQ), uQ = q(cQ), dQ = q({
	header: 1,
	headerRow: 1,
	headerColumn: 1,
	headerFacet: 1
}), fQ = [
	"size",
	"shape",
	"fill",
	"stroke",
	"strokeDash",
	"strokeWidth",
	"opacity"
], pQ = {
	gradientHorizontalMaxLength: 200,
	gradientHorizontalMinLength: 100,
	gradientVerticalMaxLength: 200,
	gradientVerticalMinLength: 64,
	unselectedOpacity: .35
}, mQ = {
	aria: 1,
	clipHeight: 1,
	columnPadding: 1,
	columns: 1,
	cornerRadius: 1,
	description: 1,
	direction: 1,
	fillColor: 1,
	format: 1,
	formatType: 1,
	gradientLength: 1,
	gradientOpacity: 1,
	gradientStrokeColor: 1,
	gradientStrokeWidth: 1,
	gradientThickness: 1,
	gridAlign: 1,
	labelAlign: 1,
	labelBaseline: 1,
	labelColor: 1,
	labelFont: 1,
	labelFontSize: 1,
	labelFontStyle: 1,
	labelFontWeight: 1,
	labelLimit: 1,
	labelOffset: 1,
	labelOpacity: 1,
	labelOverlap: 1,
	labelPadding: 1,
	labelSeparation: 1,
	legendX: 1,
	legendY: 1,
	offset: 1,
	orient: 1,
	padding: 1,
	rowPadding: 1,
	strokeColor: 1,
	symbolDash: 1,
	symbolDashOffset: 1,
	symbolFillColor: 1,
	symbolLimit: 1,
	symbolOffset: 1,
	symbolOpacity: 1,
	symbolSize: 1,
	symbolStrokeColor: 1,
	symbolStrokeWidth: 1,
	symbolType: 1,
	tickCount: 1,
	tickMinStep: 1,
	title: 1,
	titleAlign: 1,
	titleAnchor: 1,
	titleBaseline: 1,
	titleColor: 1,
	titleFont: 1,
	titleFontSize: 1,
	titleFontStyle: 1,
	titleFontWeight: 1,
	titleLimit: 1,
	titleLineHeight: 1,
	titleOpacity: 1,
	titleOrient: 1,
	titlePadding: 1,
	type: 1,
	values: 1,
	zindex: 1
}, hQ = "_vgsid_", gQ = {
	point: {
		on: "click",
		fields: [hQ],
		toggle: "event.shiftKey",
		resolve: "global",
		clear: "dblclick"
	},
	interval: {
		on: "[pointerdown, window:pointerup] > window:pointermove!",
		encodings: ["x", "y"],
		translate: "[pointerdown, window:pointerup] > window:pointermove!",
		zoom: "wheel!",
		mark: {
			fill: "#333",
			fillOpacity: .125,
			stroke: "white"
		},
		resolve: "global",
		clear: "dblclick"
	}
};
function _Q(e) {
	return e === "legend" || !!(e != null && e.legend);
}
function vQ(e) {
	return _Q(e) && F(e);
}
function yQ(e) {
	return !!(e != null && e.select);
}
function bQ(e) {
	let t = [];
	for (let n of e || []) {
		if (yQ(n)) continue;
		let { expr: e, bind: r, ...i } = n;
		if (r && e) {
			let n = {
				...i,
				bind: r,
				init: e
			};
			t.push(n);
		} else {
			let n = {
				...i,
				...e ? { update: e } : {},
				...r ? { bind: r } : {}
			};
			t.push(n);
		}
	}
	return t;
}
function xQ(e) {
	return CQ(e) || wQ(e) || SQ(e);
}
function SQ(e) {
	return J(e, "concat");
}
function CQ(e) {
	return J(e, "vconcat");
}
function wQ(e) {
	return J(e, "hconcat");
}
function TQ({ step: e, offsetIsDiscrete: t }) {
	if (t) {
		var n;
		return (n = e.for) == null ? "offset" : n;
	} else return "position";
}
function EQ(e) {
	return J(e, "step");
}
function DQ(e) {
	return J(e, "view") || J(e, "width") || J(e, "height");
}
var OQ = 20, kQ = q({
	align: 1,
	bounds: 1,
	center: 1,
	columns: 1,
	spacing: 1
});
function AQ(e, t, n) {
	let r = n[t], i = {}, { spacing: a, columns: o } = r;
	a !== void 0 && (i.spacing = a), o !== void 0 && (aX(e) && !rX(e.facet) || SQ(e)) && (i.columns = o), CQ(e) && (i.columns = 1);
	for (let t of kQ) if (e[t] !== void 0) if (t === "spacing") {
		var s, c;
		let n = e[t];
		i[t] = rd(n) ? n : {
			row: (s = n.row) == null ? a : s,
			column: (c = n.column) == null ? a : c
		};
	} else i[t] = e[t];
	return i;
}
function jQ(e, t) {
	var n;
	return (n = e[t]) == null ? e[t === "width" ? "continuousWidth" : "continuousHeight"] : n;
}
function MQ(e, t) {
	let n = NQ(e, t);
	return EQ(n) ? n.step : PQ;
}
function NQ(e, t) {
	var n;
	return tU((n = e[t]) == null ? e[t === "width" ? "discreteWidth" : "discreteHeight"] : n, { step: e.step });
}
var PQ = 20, FQ = {
	background: "white",
	padding: 5,
	timeFormat: "%b %d, %Y",
	countTitle: "Count of Records",
	view: {
		continuousWidth: 300,
		continuousHeight: 300,
		step: PQ
	},
	mark: _Y,
	arc: {},
	area: {},
	bar: SY,
	circle: {},
	geoshape: {},
	image: {},
	line: {},
	point: {},
	rect: xY,
	rule: { color: "black" },
	square: {},
	text: { color: "black" },
	tick: CY,
	trail: {},
	boxplot: {
		size: 14,
		extent: 1.5,
		box: {},
		median: { color: "white" },
		outliers: {},
		rule: {},
		ticks: null
	},
	errorbar: {
		center: "mean",
		rule: !0,
		ticks: !1
	},
	errorband: {
		band: { opacity: .3 },
		borders: !1
	},
	scale: PJ,
	projection: {},
	legend: pQ,
	header: {
		titlePadding: 10,
		labelPadding: 10
	},
	headerColumn: {},
	headerRow: {},
	headerFacet: {},
	selection: gQ,
	style: {},
	title: {},
	facet: { spacing: OQ },
	concat: { spacing: OQ },
	normalizedNumberFormat: ".0%"
}, IQ = [
	"#4c78a8",
	"#f58518",
	"#e45756",
	"#72b7b2",
	"#54a24b",
	"#eeca3b",
	"#b279a2",
	"#ff9da6",
	"#9d755d",
	"#bab0ac"
], LQ = {
	text: 11,
	guideLabel: 10,
	guideTitle: 11,
	groupTitle: 13,
	groupSubtitle: 12
}, RQ = {
	blue: IQ[0],
	orange: IQ[1],
	red: IQ[2],
	teal: IQ[3],
	green: IQ[4],
	yellow: IQ[5],
	purple: IQ[6],
	pink: IQ[7],
	brown: IQ[8],
	gray0: "#000",
	gray1: "#111",
	gray2: "#222",
	gray3: "#333",
	gray4: "#444",
	gray5: "#555",
	gray6: "#666",
	gray7: "#777",
	gray8: "#888",
	gray9: "#999",
	gray10: "#aaa",
	gray11: "#bbb",
	gray12: "#ccc",
	gray13: "#ddd",
	gray14: "#eee",
	gray15: "#fff"
};
function zQ(e = {}) {
	return {
		signals: [{
			name: "color",
			value: F(e) ? {
				...RQ,
				...e
			} : RQ
		}],
		mark: { color: { signal: "color.blue" } },
		rule: { color: { signal: "color.gray0" } },
		text: { color: { signal: "color.gray0" } },
		style: {
			"guide-label": { fill: { signal: "color.gray0" } },
			"guide-title": { fill: { signal: "color.gray0" } },
			"group-title": { fill: { signal: "color.gray0" } },
			"group-subtitle": { fill: { signal: "color.gray0" } },
			cell: { stroke: { signal: "color.gray8" } }
		},
		axis: {
			domainColor: { signal: "color.gray13" },
			gridColor: { signal: "color.gray8" },
			tickColor: { signal: "color.gray13" }
		},
		range: { category: [
			{ signal: "color.blue" },
			{ signal: "color.orange" },
			{ signal: "color.red" },
			{ signal: "color.teal" },
			{ signal: "color.green" },
			{ signal: "color.yellow" },
			{ signal: "color.purple" },
			{ signal: "color.pink" },
			{ signal: "color.brown" },
			{ signal: "color.grey8" }
		] }
	};
}
function BQ(e) {
	return {
		signals: [{
			name: "fontSize",
			value: F(e) ? {
				...LQ,
				...e
			} : LQ
		}],
		text: { fontSize: { signal: "fontSize.text" } },
		style: {
			"guide-label": { fontSize: { signal: "fontSize.guideLabel" } },
			"guide-title": { fontSize: { signal: "fontSize.guideTitle" } },
			"group-title": { fontSize: { signal: "fontSize.groupTitle" } },
			"group-subtitle": { fontSize: { signal: "fontSize.groupSubtitle" } }
		}
	};
}
function VQ(e) {
	return {
		text: { font: e },
		style: {
			"guide-label": { font: e },
			"guide-title": { font: e },
			"group-title": { font: e },
			"group-subtitle": { font: e }
		}
	};
}
function HQ(e) {
	let t = q(e || {}), n = {};
	for (let r of t) {
		let t = e[r];
		n[r] = oZ(t) ? bG(t) : xG(t);
	}
	return n;
}
function UQ(e) {
	let t = q(e), n = {};
	for (let r of t) n[r] = HQ(e[r]);
	return n;
}
var WQ = [
	...vY,
	...fZ,
	...dQ,
	"background",
	"padding",
	"legend",
	"lineBreak",
	"scale",
	"style",
	"title",
	"view"
];
function GQ(e = {}) {
	let { color: t, font: n, fontSize: r, selection: i, ...a } = e, o = hu({}, K(FQ), n ? VQ(n) : {}, t ? zQ(t) : {}, r ? BQ(r) : {}, a || {});
	i && gu(o, "selection", i, !0);
	let s = CH(o, WQ);
	for (let e of [
		"background",
		"lineBreak",
		"padding"
	]) o[e] && (s[e] = xG(o[e]));
	for (let e of vY) o[e] && (s[e] = lG(o[e]));
	for (let e of fZ) o[e] && (s[e] = HQ(o[e]));
	for (let e of dQ) o[e] && (s[e] = lG(o[e]));
	if (o.legend && (s.legend = lG(o.legend)), o.scale) {
		let { invalid: e, ...t } = o.scale, n = lG(e, { level: 1 });
		s.scale = {
			...lG(t),
			...q(n).length > 0 ? { invalid: n } : {}
		};
	}
	return o.style && (s.style = UQ(o.style)), o.title && (s.title = lG(o.title)), o.view && (s.view = lG(o.view)), s;
}
var KQ = new Set(["view", ...lY]), qQ = /* @__PURE__ */ "color.fontSize.background.padding.facet.concat.numberFormat.numberFormatType.normalizedNumberFormat.normalizedNumberFormatType.timeFormat.countTitle.header.axisQuantitative.axisTemporal.axisDiscrete.axisPoint.axisXBand.axisXPoint.axisXDiscrete.axisXQuantitative.axisXTemporal.axisYBand.axisYPoint.axisYDiscrete.axisYQuantitative.axisYTemporal.scale.selection.overlay".split("."), JQ = {
	view: [
		"continuousWidth",
		"continuousHeight",
		"discreteWidth",
		"discreteHeight",
		"step"
	],
	...gY
};
function YQ(e) {
	e = K(e);
	for (let t of qQ) delete e[t];
	if (e.axis) for (let t in e.axis) oZ(e.axis[t]) && delete e.axis[t];
	if (e.legend) for (let t of oQ) delete e.legend[t];
	if (e.mark) {
		for (let t of mY) delete e.mark[t];
		e.mark.tooltip && F(e.mark.tooltip) && delete e.mark.tooltip;
	}
	e.params && (e.signals = (e.signals || []).concat(bQ(e.params)), delete e.params);
	for (let t of KQ) {
		for (let n of mY) delete e[t][n];
		let n = JQ[t];
		if (n) for (let r of n) delete e[t][r];
		ZQ(e, t);
	}
	for (let t of aQ()) delete e[t];
	XQ(e);
	for (let t in e) F(e[t]) && LH(e[t]) && delete e[t];
	return LH(e) ? void 0 : e;
}
function XQ(e) {
	let { titleMarkConfig: t, subtitleMarkConfig: n, subtitle: r } = uG(e.title);
	LH(t) || (e.style["group-title"] = {
		...e.style["group-title"],
		...t
	}), LH(n) || (e.style["group-subtitle"] = {
		...e.style["group-subtitle"],
		...n
	}), LH(r) ? delete e.title : e.title = r;
}
function ZQ(e, t, n, r) {
	var i;
	let a = e[t];
	t === "view" && (n = "cell");
	let o = {
		...a,
		...e.style[(i = n) == null ? t : i]
	};
	if (!LH(o)) {
		var s;
		e.style[(s = n) == null ? t : s] = o;
	}
	delete e[t];
}
function QQ(e) {
	return J(e, "layer");
}
function $Q(e) {
	return J(e, "repeat");
}
function e$(e) {
	return !P(e.repeat) && J(e.repeat, "layer");
}
var t$ = class {
	map(e, t) {
		return aX(e) ? this.mapFacet(e, t) : $Q(e) ? this.mapRepeat(e, t) : wQ(e) ? this.mapHConcat(e, t) : CQ(e) ? this.mapVConcat(e, t) : SQ(e) ? this.mapConcat(e, t) : this.mapLayerOrUnit(e, t);
	}
	mapLayerOrUnit(e, t) {
		if (QQ(e)) return this.mapLayer(e, t);
		if (pZ(e)) return this.mapUnit(e, t);
		throw Error(LG(e));
	}
	mapLayer(e, t) {
		return {
			...e,
			layer: e.layer.map((e) => this.mapLayerOrUnit(e, t))
		};
	}
	mapHConcat(e, t) {
		return {
			...e,
			hconcat: e.hconcat.map((e) => this.map(e, t))
		};
	}
	mapVConcat(e, t) {
		return {
			...e,
			vconcat: e.vconcat.map((e) => this.map(e, t))
		};
	}
	mapConcat(e, t) {
		let { concat: n, ...r } = e;
		return {
			...r,
			concat: n.map((e) => this.map(e, t))
		};
	}
	mapFacet(e, t) {
		return {
			...e,
			spec: this.map(e.spec, t)
		};
	}
	mapRepeat(e, t) {
		return {
			...e,
			spec: this.map(e.spec, t)
		};
	}
}, sre = {
	zero: 1,
	center: 1,
	normalize: 1
};
function n$(e) {
	return L(sre, e);
}
var r$ = new Set([
	qJ,
	YJ,
	JJ,
	eY,
	QJ,
	iY,
	aY,
	ZJ,
	tY,
	nY
]), i$ = new Set([
	YJ,
	JJ,
	qJ
]);
function a$(e) {
	return Z(e) && vX(e) === "quantitative" && !e.bin;
}
function o$(e, t, { orient: n, type: r }) {
	let i = t === "x" ? "y" : "radius", a = t === "x" && ["bar", "area"].includes(r), o = e[t], s = e[i];
	if (Z(o) && Z(s)) {
		if (a$(o) && a$(s)) {
			if (o.stack) return t;
			if (s.stack) return i;
			let e = Z(o) && !!o.aggregate;
			if (e !== (Z(s) && !!s.aggregate)) return e ? t : i;
			if (a) {
				if (n === "vertical") return i;
				if (n === "horizontal") return t;
			}
		} else if (a$(o)) return t;
		else if (a$(s)) return i;
	} else if (a$(o)) return a && n === "vertical" ? void 0 : t;
	else if (a$(s)) return a && n === "horizontal" ? void 0 : i;
}
function s$(e) {
	switch (e) {
		case "x": return "y";
		case "y": return "x";
		case "theta": return "radius";
		case "radius": return "theta";
	}
}
function c$(e, t) {
	var n, r;
	let i = uY(e) ? e : { type: e }, a = i.type;
	if (!r$.has(a)) return null;
	let o = o$(t, "x", i) || o$(t, "theta", i);
	if (!o) return null;
	let s = t[o], c = Z(s) ? $(s, {}) : void 0, l = s$(o), u = [], d = /* @__PURE__ */ new Set();
	if (t[l]) {
		let e = t[l], n = Z(e) ? $(e, {}) : void 0;
		n && n !== c && (u.push(l), d.add(n));
	}
	let f = l === "x" ? "xOffset" : "yOffset", p = t[f], m = Z(p) ? $(p, {}) : void 0;
	m && m !== c && (u.push(f), d.add(m));
	let h = CW.reduce((e, n) => {
		if (n !== "tooltip" && hZ(t, n)) {
			let r = t[n];
			for (let t of I(r)) {
				let r = GX(t);
				if (r.aggregate) continue;
				let i = $(r, {});
				(!i || !d.has(i)) && e.push({
					channel: n,
					fieldDef: r
				});
			}
		}
		return e;
	}, []), g;
	return s.stack === void 0 ? i$.has(a) && (g = "zero") : g = ed(s.stack) ? s.stack ? "zero" : null : s.stack, !g || !n$(g) || vZ(t) && h.length === 0 ? null : (!(s == null || (n = s.scale) == null) && n.type && (s == null || (r = s.scale) == null ? void 0 : r.type) !== yJ.LINEAR && s != null && s.stack && X(eq(s.scale.type)), Q(t[gW(o)]) ? (s.stack !== void 0 && X($K(o)), null) : (Z(s) && s.aggregate && !eG.has(s.aggregate) && X(tq(s.aggregate)), {
		groupbyChannels: u,
		groupbyFields: d,
		fieldChannel: o,
		impute: s.impute === null ? !1 : sY(a),
		stackBy: h,
		offset: g
	}));
}
function l$(e, t, n) {
	let r = lG(e), i = kG("orient", r, n);
	if (r.orient = m$(r.type, t, i), i !== void 0 && i !== r.orient && X(NK(r.orient, i)), r.type === "bar" && r.orient) {
		let e = kG("cornerRadiusEnd", r, n);
		if (e !== void 0) {
			let n = r.orient === "horizontal" && t.x2 || r.orient === "vertical" && t.y2 ? ["cornerRadius"] : bY[r.orient];
			for (let t of n) r[t] = e;
			r.cornerRadiusEnd !== void 0 && delete r.cornerRadiusEnd;
		}
	}
	let a = kG("opacity", r, n), o = kG("fillOpacity", r, n);
	return a === void 0 && o === void 0 && (r.opacity = f$(r.type, t)), kG("cursor", r, n) === void 0 && (r.cursor = u$(r, t, n)), r;
}
function u$(e, t, n) {
	return t.href || e.href || kG("href", e, n) ? "pointer" : e.cursor;
}
var d$ = .7;
function f$(e, t) {
	if (EH([
		QJ,
		nY,
		iY,
		aY
	], e) && !vZ(t)) return d$;
}
function p$(e, t, { graticule: n }) {
	if (n) return !1;
	let r = AG("filled", e, t), i = e.type;
	return tU(r, i !== QJ && i !== ZJ && i !== eY);
}
function m$(e, t, n) {
	switch (e) {
		case QJ:
		case iY:
		case aY:
		case $J:
		case XJ: return;
	}
	let { x: r, y: i, x2: a, y2: o } = t;
	switch (e) {
		case tY:
		case YJ:
			if (Z(r) && (iG(r.bin) || Z(i) && i.aggregate && !r.aggregate)) return "vertical";
			if (Z(i) && (iG(i.bin) || Z(r) && r.aggregate && !i.aggregate)) return "horizontal";
			if (o || a) {
				if (n) return n;
				if (!a) return (Z(r) && r.type === pJ && !rG(r.bin) || SX(r)) && Z(i) && iG(i.bin) ? "horizontal" : "vertical";
				if (!o) return (Z(i) && i.type === pJ && !rG(i.bin) || SX(i)) && Z(r) && iG(r.bin) ? "vertical" : "horizontal";
			}
		case eY: if (a && !(Z(r) && iG(r.bin)) && o && !(Z(i) && iG(i.bin))) return;
		case JJ:
			if (o) return Z(i) && iG(i.bin) ? "horizontal" : "vertical";
			if (a) return Z(r) && iG(r.bin) ? "vertical" : "horizontal";
			if (e === eY) {
				if (r && !i) return "vertical";
				if (i && !r) return "horizontal";
			}
		case ZJ:
		case nY: {
			let t = xX(r), a = xX(i);
			if (n) return n;
			if (t && !a) return e === "tick" ? "vertical" : "horizontal";
			if (!t && a) return e === "tick" ? "horizontal" : "vertical";
			if (t && a) return "vertical";
			{
				let e = CX(r) && r.type === hJ, t = CX(i) && i.type === hJ;
				if (e && !t) return "vertical";
				if (!e && t) return "horizontal";
			}
			return;
		}
	}
	return "vertical";
}
function h$(e) {
	let { point: t, line: n, ...r } = e;
	return q(r).length > 1 ? r : r.type;
}
function g$(e) {
	for (let t of [
		"line",
		"area",
		"rule",
		"trail"
	]) e[t] && (e = {
		...e,
		[t]: CH(e[t], ["point", "line"])
	});
	return e;
}
function _$(e, t = {}, n) {
	return e.point === "transparent" ? { opacity: 0 } : e.point ? F(e.point) ? e.point : {} : e.point === void 0 ? t.point || n.shape ? F(t.point) ? t.point : {} : void 0 : null;
}
function v$(e, t = {}) {
	return e.line ? e.line === !0 ? {} : e.line : e.line === void 0 ? t.line ? t.line === !0 ? {} : t.line : void 0 : null;
}
var y$ = class {
	constructor() {
		e(this, "name", "path-overlay");
	}
	hasMatchingType(e, t) {
		if (pZ(e)) {
			let { mark: n, encoding: r } = e, i = uY(n) ? n : { type: n };
			switch (i.type) {
				case "line":
				case "rule":
				case "trail": return !!_$(i, t[i.type], r);
				case "area": return !!_$(i, t[i.type], r) || !!v$(i, t[i.type]);
			}
		}
		return !1;
	}
	run(e, t, n) {
		let { config: r } = t, { params: i, projection: a, mark: o, name: s, encoding: c, ...l } = e, u = SZ(c, r), d = uY(o) ? o : { type: o }, f = _$(d, r[d.type], u), p = d.type === "area" && v$(d, r[d.type]), m = [{
			name: s,
			...i ? { params: i } : {},
			mark: h$({
				...d.type === "area" && kG("opacity", d, r) == null && kG("fillOpacity", d, r) == null ? { opacity: d$ } : {},
				...d
			}),
			encoding: CH(u, ["shape"])
		}], h = c$(l$(d, u, r), u), g = u;
		if (h) {
			let { fieldChannel: e, offset: t } = h;
			g = {
				...u,
				[e]: {
					...u[e],
					...t ? { stack: t } : {}
				}
			};
		}
		return g = CH(g, ["y2", "x2"]), p && m.push({
			...a ? { projection: a } : {},
			mark: {
				type: "line",
				...SH(d, [
					"clip",
					"interpolate",
					"tension",
					"tooltip"
				]),
				...p
			},
			encoding: g
		}), f && m.push({
			...a ? { projection: a } : {},
			mark: {
				type: "point",
				opacity: 1,
				filled: !0,
				...SH(d, ["clip", "tooltip"]),
				...f
			},
			encoding: g
		}), n({
			...l,
			layer: m
		}, {
			...t,
			config: g$(r)
		});
	}
};
function b$(e, t) {
	return t ? rX(e) ? E$(e, t) : C$(e, t) : e;
}
function x$(e, t) {
	return t ? E$(e, t) : e;
}
function S$(e, t, n) {
	let r = t[e];
	if (sX(r)) {
		if (r.repeat in n) return {
			...t,
			[e]: n[r.repeat]
		};
		X(tK(r.repeat));
		return;
	}
	return t;
}
function C$(e, t) {
	if (e = S$("field", e, t), e !== void 0) {
		if (e === null) return null;
		if (lX(e) && tX(e.sort)) {
			let n = S$("field", e.sort, t);
			e = {
				...e,
				...n ? { sort: n } : {}
			};
		}
		return e;
	}
}
function w$(e, t) {
	if (Z(e)) return C$(e, t);
	{
		let n = S$("datum", e, t);
		return n !== e && !n.type && (n.type = "nominal"), n;
	}
}
function T$(e, t) {
	if (Q(e)) {
		let n = w$(e, t);
		if (n) return n;
		if (mX(e)) return { condition: e.condition };
	} else {
		if (gX(e)) {
			let n = w$(e.condition, t);
			if (n) return {
				...e,
				condition: n
			};
			{
				let { condition: t, ...n } = e;
				return n;
			}
		}
		return e;
	}
}
function E$(e, t) {
	let n = {};
	for (let r in e) if (J(e, r)) {
		let i = e[r];
		if (P(i)) n[r] = i.map((e) => T$(e, t)).filter((e) => e);
		else {
			let e = T$(i, t);
			e !== void 0 && (n[r] = e);
		}
	}
	return n;
}
var D$ = class {
	constructor() {
		e(this, "name", "RuleForRangedLine");
	}
	hasMatchingType(e) {
		if (pZ(e)) {
			let { encoding: t, mark: n } = e;
			if (n === "line" || uY(n) && n.type === "line") for (let e of fW) {
				let n = t[mW(e)];
				if (t[e] && (Z(n) && !iG(n.bin) || yX(n))) return !0;
			}
		}
		return !1;
	}
	run(e, t, n) {
		let { encoding: r, mark: i } = e;
		return X(MK(!!r.x2, !!r.y2)), n({
			...e,
			mark: F(i) ? {
				...i,
				type: "rule"
			} : "rule"
		}, t);
	}
}, O$ = class extends t$ {
	constructor(...t) {
		super(...t), e(this, "nonFacetUnitNormalizers", [
			LZ,
			WZ,
			tQ,
			new y$(),
			new D$()
		]);
	}
	map(e, t) {
		if (pZ(e)) {
			let n = hZ(e.encoding, fU), r = hZ(e.encoding, pU), i = hZ(e.encoding, mU);
			if (n || r || i) return this.mapFacetedUnit(e, t);
		}
		return super.map(e, t);
	}
	mapUnit(e, t) {
		let { parentEncoding: n, parentProjection: r } = t, i = x$(e.encoding, t.repeater), a = {
			...e,
			...e.name ? { name: [t.repeaterPrefix, e.name].filter((e) => e).join("_") } : {},
			...i ? { encoding: i } : {}
		};
		if (n || r) return this.mapUnitWithParentEncodingOrProjection(a, t);
		let o = this.mapLayerOrUnit.bind(this);
		for (let e of this.nonFacetUnitNormalizers) if (e.hasMatchingType(a, t.config)) return e.run(a, t, o);
		return a;
	}
	mapRepeat(e, t) {
		return e$(e) ? this.mapLayerRepeat(e, t) : this.mapNonLayerRepeat(e, t);
	}
	mapLayerRepeat(e, t) {
		let { repeat: n, spec: r, ...i } = e, { row: a, column: o, layer: s } = n, { repeater: c = {}, repeaterPrefix: l = "" } = t;
		return a || o ? this.mapRepeat({
			...e,
			repeat: {
				...a ? { row: a } : {},
				...o ? { column: o } : {}
			},
			spec: {
				repeat: { layer: s },
				spec: r
			}
		}, t) : {
			...i,
			layer: s.map((e) => {
				let n = {
					...c,
					layer: e
				}, i = `${(r.name ? `${r.name}_` : "") + l}child__layer_${HH(e)}`, a = this.mapLayerOrUnit(r, {
					...t,
					repeater: n,
					repeaterPrefix: i
				});
				return a.name = i, a;
			})
		};
	}
	mapNonLayerRepeat(e, t) {
		var n;
		let { repeat: r, spec: i, data: a, ...o } = e;
		!P(r) && e.columns && (e = CH(e, ["columns"]), X(nK("repeat")));
		let s = [], { repeater: c = {}, repeaterPrefix: l = "" } = t, u = !P(r) && r.row || [c ? c.row : null], d = !P(r) && r.column || [c ? c.column : null], f = P(r) && r || [c ? c.repeat : null];
		for (let e of f) for (let n of u) for (let a of d) {
			let o = {
				repeat: e,
				row: n,
				column: a,
				layer: c.layer
			}, u = `${(i.name ? `${i.name}_` : "") + l}child__${P(r) ? `${HH(e)}` : (r.row ? `row_${HH(n)}` : "") + (r.column ? `column_${HH(a)}` : "")}`, d = this.map(i, {
				...t,
				repeater: o,
				repeaterPrefix: u
			});
			d.name = u, s.push(CH(d, ["data"]));
		}
		let p = P(r) ? e.columns : r.column ? r.column.length : 1;
		return {
			data: (n = i.data) == null ? a : n,
			align: "all",
			...o,
			columns: p,
			concat: s
		};
	}
	mapFacet(e, t) {
		let { facet: n } = e;
		return rX(n) && e.columns && (e = CH(e, ["columns"]), X(nK("facet"))), super.mapFacet(e, t);
	}
	mapUnitWithParentEncodingOrProjection(e, t) {
		let { encoding: n, projection: r } = e, { parentEncoding: i, parentProjection: a, config: o } = t, s = A$({
			parentProjection: a,
			projection: r
		}), c = k$({
			parentEncoding: i,
			encoding: x$(n, t.repeater)
		});
		return this.mapUnit({
			...e,
			...s ? { projection: s } : {},
			...c ? { encoding: c } : {}
		}, { config: o });
	}
	mapFacetedUnit(e, t) {
		let { row: n, column: r, facet: i, ...a } = e.encoding, { mark: o, width: s, projection: c, height: l, view: u, params: d, encoding: f, ...p } = e, { facetMapping: m, layout: h } = this.getFacetMappingAndLayout({
			row: n,
			column: r,
			facet: i
		}, t), g = x$(a, t.repeater);
		return this.mapFacet({
			...p,
			...h,
			facet: m,
			spec: {
				...s ? { width: s } : {},
				...l ? { height: l } : {},
				...u ? { view: u } : {},
				...c ? { projection: c } : {},
				mark: o,
				encoding: g,
				...d ? { params: d } : {}
			}
		}, t);
	}
	getFacetMappingAndLayout(e, t) {
		let { row: n, column: r, facet: i } = e;
		if (n || r) {
			i && X(kK([...n ? [fU] : [], ...r ? [pU] : []]));
			let t = {}, a = {};
			for (let n of [fU, pU]) {
				let r = e[n];
				if (r) {
					let { align: e, center: i, spacing: o, columns: s, ...c } = r;
					t[n] = c;
					for (let e of [
						"align",
						"center",
						"spacing"
					]) r[e] !== void 0 && (a[e] != null || (a[e] = {}), a[e][n] = r[e]);
				}
			}
			return {
				facetMapping: t,
				layout: a
			};
		} else {
			let { align: e, center: n, spacing: r, columns: a, ...o } = i;
			return {
				facetMapping: b$(o, t.repeater),
				layout: {
					...e ? { align: e } : {},
					...n ? { center: n } : {},
					...r ? { spacing: r } : {},
					...a ? { columns: a } : {}
				}
			};
		}
	}
	mapLayer(e, { parentEncoding: t, parentProjection: n, ...r }) {
		let { encoding: i, projection: a, ...o } = e, s = {
			...r,
			parentEncoding: k$({
				parentEncoding: t,
				encoding: i,
				layer: !0
			}),
			parentProjection: A$({
				parentProjection: n,
				projection: a
			})
		};
		return super.mapLayer({
			...o,
			...e.name ? { name: [s.repeaterPrefix, e.name].filter((e) => e).join("_") } : {}
		}, s);
	}
};
function k$({ parentEncoding: e, encoding: t = {}, layer: n }) {
	let r = {};
	if (e) {
		let i = new Set([...q(e), ...q(t)]);
		for (let a of i) {
			let i = t[a], o = e[a];
			if (Q(i)) {
				let e = {
					...o,
					...i
				};
				r[a] = e;
			} else gX(i) ? r[a] = {
				...i,
				condition: {
					...o,
					...i.condition
				}
			} : i || i === null ? r[a] = i : (n || wX(o) || Y(o) || Q(o) || P(o)) && (r[a] = o);
		}
	} else r = t;
	return !r || LH(r) ? void 0 : r;
}
function A$(e) {
	let { parentProjection: t, projection: n } = e;
	return t && n && X(mK({
		parentProjection: t,
		projection: n
	})), n == null ? t : n;
}
function j$(e) {
	return J(e, "filter");
}
function M$(e) {
	return J(e, "stop");
}
function N$(e) {
	return J(e, "lookup");
}
function P$(e) {
	return J(e, "data");
}
function F$(e) {
	return J(e, "param");
}
function I$(e) {
	return J(e, "pivot");
}
function L$(e) {
	return J(e, "density");
}
function R$(e) {
	return J(e, "quantile");
}
function z$(e) {
	return J(e, "regression");
}
function B$(e) {
	return J(e, "loess");
}
function V$(e) {
	return J(e, "sample");
}
function H$(e) {
	return J(e, "window");
}
function U$(e) {
	return J(e, "joinaggregate");
}
function W$(e) {
	return J(e, "flatten");
}
function G$(e) {
	return J(e, "calculate");
}
function K$(e) {
	return J(e, "bin");
}
function q$(e) {
	return J(e, "impute");
}
function J$(e) {
	return J(e, "timeUnit");
}
function Y$(e) {
	return J(e, "aggregate");
}
function X$(e) {
	return J(e, "stack");
}
function Z$(e) {
	return J(e, "fold");
}
function Q$(e) {
	return J(e, "extent") && !J(e, "density") && !J(e, "regression");
}
function $$(e) {
	return e.map((e) => j$(e) ? { filter: bH(e.filter, lJ) } : e);
}
var e1 = class extends t$ {
	map(e, t) {
		return t.emptySelections != null || (t.emptySelections = {}), t.selectionPredicates != null || (t.selectionPredicates = {}), e = t1(e, t), super.map(e, t);
	}
	mapLayerOrUnit(e, t) {
		if (e = t1(e, t), e.encoding) {
			let n = {};
			for (let [r, i] of zH(e.encoding)) n[r] = n1(i, t);
			e = {
				...e,
				encoding: n
			};
		}
		return super.mapLayerOrUnit(e, t);
	}
	mapUnit(e, t) {
		let { selection: n, ...r } = e;
		return n ? {
			...r,
			params: zH(n).map(([e, n]) => {
				var r;
				let { init: i, bind: a, empty: o, ...s } = n;
				s.type === "single" ? (s.type = "point", s.toggle = !1) : s.type === "multi" && (s.type = "point"), t.emptySelections[e] = o !== "none";
				for (let n of RH((r = t.selectionPredicates[e]) == null ? {} : r)) n.empty = o !== "none";
				return {
					name: e,
					value: i,
					select: s,
					bind: a
				};
			})
		} : e;
	}
};
function t1(e, t) {
	let { transform: n, ...r } = e;
	if (n) {
		let e = n.map((e) => {
			if (j$(e)) return { filter: i1(e, t) };
			if (K$(e) && aG(e.bin)) return {
				...e,
				bin: r1(e.bin)
			};
			if (N$(e)) {
				let { selection: t, ...n } = e.from;
				return t ? {
					...e,
					from: {
						param: t,
						...n
					}
				} : e;
			}
			return e;
		});
		return {
			...r,
			transform: e
		};
	}
	return e;
}
function n1(e, t) {
	var n;
	let r = K(e);
	if (Z(r) && aG(r.bin) && (r.bin = r1(r.bin)), TX(r) && !((n = r.scale) == null || (n = n.domain) == null) && n.selection) {
		let { selection: e, ...t } = r.scale.domain;
		r.scale.domain = {
			...t,
			...e ? { param: e } : {}
		};
	}
	if (mX(r)) if (P(r.condition)) r.condition = r.condition.map((e) => {
		let { selection: n, param: r, test: i, ...a } = e;
		return r ? e : {
			...a,
			test: i1(e, t)
		};
	});
	else {
		let { selection: e, param: n, test: i, ...a } = n1(r.condition, t);
		r.condition = n ? r.condition : {
			...a,
			test: i1(r.condition, t)
		};
	}
	return r;
}
function r1(e) {
	let t = e.extent;
	if (t != null && t.selection) {
		let { selection: n, ...r } = t;
		return {
			...e,
			extent: {
				...r,
				param: n
			}
		};
	}
	return e;
}
function i1(e, t) {
	let n = (e) => bH(e, (e) => {
		var n, r;
		let i = {
			param: e,
			empty: (n = t.emptySelections[e]) == null ? !0 : n
		};
		return (r = t.selectionPredicates)[e] != null || (r[e] = []), t.selectionPredicates[e].push(i), i;
	});
	return e.selection ? n(e.selection) : bH(e.test || e.filter, (e) => e.selection ? n(e.selection) : e);
}
var a1 = class extends t$ {
	map(e, t) {
		var n;
		let r = (n = t.selections) == null ? [] : n;
		if (e.params && !pZ(e)) {
			let t = [];
			for (let n of e.params) yQ(n) ? r.push(n) : t.push(n);
			e.params = t;
		}
		return t.selections = r, super.map(e, t);
	}
	mapUnit(e, t) {
		var n;
		let r = t.selections;
		if (!r || !r.length) return e;
		let i = ((n = t.path) == null ? [] : n).concat(e.name), a = [];
		for (let t of r) if (!t.views || !t.views.length) a.push(t);
		else for (let n of t.views) (z(n) && (n === e.name || i.includes(n)) || P(n) && n.map((e) => i.indexOf(e)).every((e, t, n) => e !== -1 && (t === 0 || e > n[t - 1]))) && a.push(t);
		return a.length && (e.params = a), e;
	}
};
for (let e of [
	"mapFacet",
	"mapRepeat",
	"mapHConcat",
	"mapVConcat",
	"mapLayer"
]) {
	let t = a1.prototype[e];
	a1.prototype[e] = function(e, n) {
		return t.call(this, e, o1(e, n));
	};
}
function o1(e, t) {
	var n;
	return e.name ? {
		...t,
		path: ((n = t.path) == null ? [] : n).concat(e.name)
	} : t;
}
function s1(e, t) {
	t === void 0 && (t = GQ(e.config));
	let n = d1(e, t), { width: r, height: i } = e, a = p1(n, {
		width: r,
		height: i,
		autosize: e.autosize
	}, t);
	return {
		...n,
		...a ? { autosize: a } : {}
	};
}
var c1 = new O$(), l1 = new e1(), u1 = new a1();
function d1(e, t = {}) {
	let n = { config: t };
	return u1.map(c1.map(l1.map(e, n), n), n);
}
function f1(e) {
	return z(e) ? { type: e } : e == null ? {} : e;
}
function p1(e, t, n) {
	let { width: r, height: i } = t, a = pZ(e) || QQ(e), o = {};
	a ? r == "container" && i == "container" ? (o.type = "fit", o.contains = "padding") : r == "container" ? (o.type = "fit-x", o.contains = "padding") : i == "container" && (o.type = "fit-y", o.contains = "padding") : (r == "container" && (X(zG("width")), r = void 0), i == "container" && (X(zG("height")), i = void 0));
	let s = {
		type: "pad",
		...o,
		...n ? f1(n.autosize) : {},
		...f1(e.autosize)
	};
	if (s.type === "fit" && !a && (X(RG), s.type = "pad"), r == "container" && !(s.type == "fit" || s.type == "fit-x") && X(BG("width")), i == "container" && !(s.type == "fit" || s.type == "fit-y") && X(BG("height")), !uU(s, { type: "pad" })) return s;
}
function m1(e) {
	return [
		"fit",
		"fit-x",
		"fit-y"
	].includes(e);
}
function h1(e) {
	return e ? `fit-${kW(e)}` : "fit";
}
var g1 = ["background", "padding"];
function _1(e, t) {
	let n = {};
	for (let t of g1) e && e[t] !== void 0 && (n[t] = xG(e[t]));
	return t && (n.params = e.params), n;
}
var v1 = class t {
	constructor(t = {}, n = {}) {
		e(this, "explicit", void 0), e(this, "implicit", void 0), this.explicit = t, this.implicit = n;
	}
	clone() {
		return new t(K(this.explicit), K(this.implicit));
	}
	combine() {
		return {
			...this.explicit,
			...this.implicit
		};
	}
	get(e) {
		return tU(this.explicit[e], this.implicit[e]);
	}
	getWithExplicit(e) {
		return this.explicit[e] === void 0 ? this.implicit[e] === void 0 ? {
			explicit: !1,
			value: void 0
		} : {
			explicit: !1,
			value: this.implicit[e]
		} : {
			explicit: !0,
			value: this.explicit[e]
		};
	}
	setWithExplicit(e, { value: t, explicit: n }) {
		t !== void 0 && this.set(e, t, n);
	}
	set(e, t, n) {
		return delete this[n ? "implicit" : "explicit"][e], this[n ? "explicit" : "implicit"][e] = t, this;
	}
	copyKeyFromSplit(e, { explicit: t, implicit: n }) {
		t[e] === void 0 ? n[e] !== void 0 && this.set(e, n[e], !1) : this.set(e, t[e], !0);
	}
	copyKeyFromObject(e, t) {
		t[e] !== void 0 && this.set(e, t[e], !0);
	}
	copyAll(e) {
		for (let t of q(e.combine())) {
			let n = e.getWithExplicit(t);
			this.setWithExplicit(t, n);
		}
	}
};
function y1(e) {
	return {
		explicit: !0,
		value: e
	};
}
function b1(e) {
	return {
		explicit: !1,
		value: e
	};
}
function x1(e) {
	return (t, n, r, i) => {
		let a = e(t.value, n.value);
		return a > 0 ? t : a < 0 ? n : S1(t, n, r, i);
	};
}
function S1(e, t, n, r) {
	return e.explicit && t.explicit && X(WK(n, r, e.value, t.value)), e;
}
function C1(e, t, n, r, i = S1) {
	return e === void 0 || e.value === void 0 ? t : e.explicit && !t.explicit ? e : t.explicit && !e.explicit ? t : uU(e.value, t.value) ? e : i(e, t, n, r);
}
var w1 = class extends v1 {
	constructor(t = {}, n = {}, r = !1) {
		super(t, n), e(this, "explicit", void 0), e(this, "implicit", void 0), e(this, "parseNothing", void 0), this.explicit = t, this.implicit = n, this.parseNothing = r;
	}
	clone() {
		let e = super.clone();
		return e.parseNothing = this.parseNothing, e;
	}
};
function T1(e) {
	return J(e, "url");
}
function E1(e) {
	return J(e, "values");
}
function D1(e) {
	return J(e, "name") && !T1(e) && !E1(e) && !O1(e);
}
function O1(e) {
	return e && (k1(e) || A1(e) || j1(e));
}
function k1(e) {
	return J(e, "sequence");
}
function A1(e) {
	return J(e, "sphere");
}
function j1(e) {
	return J(e, "graticule");
}
var M1;
(function(e) {
	e[e.Raw = 0] = "Raw", e[e.Main = 1] = "Main", e[e.Row = 2] = "Row", e[e.Column = 3] = "Column", e[e.Lookup = 4] = "Lookup", e[e.PreFilterInvalid = 5] = "PreFilterInvalid", e[e.PostFilterInvalid = 6] = "PostFilterInvalid";
})(M1 || (M1 = {}));
function N1({ invalid: e, isPath: t }) {
	switch (TY(e, { isPath: t })) {
		case "filter": return {
			marks: "exclude-invalid-values",
			scales: "exclude-invalid-values"
		};
		case "break-paths-show-domains": return {
			marks: t ? "include-invalid-values" : "exclude-invalid-values",
			scales: "include-invalid-values"
		};
		case "break-paths-filter-domains": return {
			marks: t ? "include-invalid-values" : "exclude-invalid-values",
			scales: "exclude-invalid-values"
		};
		case "show": return {
			marks: "include-invalid-values",
			scales: "include-invalid-values"
		};
	}
}
function P1(e) {
	let { marks: t, scales: n } = N1(e);
	return t === n ? M1.Main : n === "include-invalid-values" ? M1.PreFilterInvalid : M1.PostFilterInvalid;
}
var F1 = class {
	constructor(t, n) {
		e(this, "debugName", void 0), e(this, "_children", []), e(this, "_parent", null), e(this, "_hash", void 0), this.debugName = n, t && (this.parent = t);
	}
	clone() {
		throw Error("Cannot clone node");
	}
	get parent() {
		return this._parent;
	}
	set parent(e) {
		this._parent = e, e && e.addChild(this);
	}
	get children() {
		return this._children;
	}
	numChildren() {
		return this._children.length;
	}
	addChild(e, t) {
		if (this._children.includes(e)) {
			X(uK);
			return;
		}
		t === void 0 ? this._children.push(e) : this._children.splice(t, 0, e);
	}
	removeChild(e) {
		let t = this._children.indexOf(e);
		return this._children.splice(t, 1), t;
	}
	remove() {
		let e = this._parent.removeChild(this);
		for (let t of this._children) t._parent = this._parent, this._parent.addChild(t, e++);
	}
	insertAsParentOf(e) {
		let t = e.parent;
		t.removeChild(this), this.parent = t, e.parent = this;
	}
	swapWithParent() {
		let e = this._parent, t = e.parent;
		for (let t of this._children) t.parent = e;
		this._children = [], e.removeChild(this);
		let n = e.parent.removeChild(e);
		this._parent = t, t.addChild(this, n), e.parent = this;
	}
}, I1 = class extends F1 {
	clone() {
		let e = new this.constructor();
		return e.debugName = `clone_${this.debugName}`, e._source = this._source, e._name = `clone_${this._name}`, e.type = this.type, e.refCounts = this.refCounts, e.refCounts[e._name] = 0, e;
	}
	constructor(t, n, r, i) {
		super(t, n), e(this, "type", void 0), e(this, "refCounts", void 0), e(this, "_source", void 0), e(this, "_name", void 0), this.type = r, this.refCounts = i, this._source = this._name = n, this.refCounts && !(this._name in this.refCounts) && (this.refCounts[this._name] = 0);
	}
	dependentFields() {
		return /* @__PURE__ */ new Set();
	}
	producedFields() {
		return /* @__PURE__ */ new Set();
	}
	hash() {
		return this._hash === void 0 && (this._hash = `Output ${rU()}`), this._hash;
	}
	getSource() {
		return this.refCounts[this._name]++, this._source;
	}
	isRequired() {
		return !!this.refCounts[this._name];
	}
	setSource(e) {
		this._source = e;
	}
};
function L1(e) {
	return e.as !== void 0;
}
function R1(e) {
	return `${e}_end`;
}
var z1 = class t extends F1 {
	clone() {
		return new t(null, K(this.timeUnits));
	}
	constructor(t, n) {
		super(t), e(this, "timeUnits", void 0), this.timeUnits = n;
	}
	static makeFromEncoding(e, n) {
		let r = n.reduceFieldDef((e, t, r) => {
			let { field: i, timeUnit: a } = t;
			if (a) {
				let o;
				if (Mq(a)) {
					if (B8(n)) {
						let { mark: e, markDef: r, config: s } = n, c = uX({
							fieldDef: t,
							markDef: r,
							config: s
						});
						(cY(e) || c) && (o = {
							timeUnit: Uq(a),
							field: i
						});
					}
				} else o = {
					as: $(t, { forAs: !0 }),
					field: i,
					timeUnit: a
				};
				if (B8(n)) {
					let { mark: e, markDef: i, config: a } = n, s = uX({
						fieldDef: t,
						markDef: i,
						config: a
					});
					cY(e) && EW(r) && s !== .5 && (o.rectBandPosition = s);
				}
				o && (e[wH(o)] = o);
			}
			return e;
		}, {});
		return LH(r) ? null : new t(e, r);
	}
	static makeFromTransform(e, n) {
		let { timeUnit: r, ...i } = { ...n }, a = Uq(r), o = {
			...i,
			timeUnit: a
		};
		return new t(e, { [wH(o)]: o });
	}
	merge(e) {
		this.timeUnits = { ...this.timeUnits };
		for (let t in e.timeUnits) this.timeUnits[t] || (this.timeUnits[t] = e.timeUnits[t]);
		for (let t of e.children) e.removeChild(t), t.parent = this;
		e.remove();
	}
	removeFormulas(e) {
		let t = {};
		for (let [n, r] of zH(this.timeUnits)) {
			let i = L1(r) ? r.as : `${r.field}_end`;
			e.has(i) || (t[n] = r);
		}
		this.timeUnits = t;
	}
	producedFields() {
		return new Set(RH(this.timeUnits).map((e) => L1(e) ? e.as : R1(e.field)));
	}
	dependentFields() {
		return new Set(RH(this.timeUnits).map((e) => e.field));
	}
	hash() {
		return `TimeUnit ${wH(this.timeUnits)}`;
	}
	assemble() {
		let e = [];
		for (let t of RH(this.timeUnits)) {
			let { rectBandPosition: n } = t, r = Uq(t.timeUnit);
			if (L1(t)) {
				let { field: i, as: a } = t, { unit: o, utc: s, ...c } = r, l = [a, `${a}_end`];
				e.push({
					field: ZH(i),
					type: "timeunit",
					...o ? { units: Lq(o) } : {},
					...s ? { timezone: "utc" } : {},
					...c,
					as: l
				}), e.push(...U1(l, n, r));
			} else if (t) {
				let { field: i } = t, a = YH(i), o = H1({
					timeUnit: r,
					field: a
				}), s = R1(a);
				e.push({
					type: "formula",
					expr: o,
					as: s
				}), e.push(...U1([a, s], n, r));
			}
		}
		return e;
	}
}, B1 = "offsetted_rect_start", V1 = "offsetted_rect_end";
function H1({ timeUnit: e, field: t, reverse: n }) {
	let { unit: r, utc: i } = e, { part: a, step: o } = Jq(Rq(r), e.step);
	return `${i ? "utcOffset" : "timeOffset"}('${a}', ${JH(t)}, ${n ? -o : o})`;
}
function U1([e, t], n, r) {
	if (n !== void 0 && n !== .5) {
		let i = JH(e), a = JH(t);
		return [{
			type: "formula",
			expr: W1([H1({
				timeUnit: r,
				field: e,
				reverse: !0
			}), i], n + .5),
			as: `${e}_${B1}`
		}, {
			type: "formula",
			expr: W1([i, a], n + .5),
			as: `${e}_${V1}`
		}];
	}
	return [];
}
function W1([e, t], n) {
	return `${1 - n} * ${e} + ${n} * ${t}`;
}
var G1 = "_tuple_fields", K1 = class {
	constructor(...t) {
		e(this, "hasChannel", void 0), e(this, "hasField", void 0), e(this, "hasSelectionId", void 0), e(this, "timeUnit", void 0), e(this, "items", void 0), this.items = t, this.hasChannel = {}, this.hasField = {}, this.hasSelectionId = !1;
	}
}, q1 = {
	defined: () => !0,
	parse: (e, t, n) => {
		var r, i, a;
		let o = t.name, s = (r = t.project) == null ? t.project = new K1() : r, c = {}, l = {}, u = /* @__PURE__ */ new Set(), d = (e, t) => {
			let n = t === "visual" ? e.channel : e.field, r = HH(`${o}_${n}`);
			for (let e = 1; u.has(r); e++) r = HH(`${o}_${n}_${e}`);
			return u.add(r), { [t]: r };
		}, f = t.type, p = e.config.selection[f], m = n.value === void 0 ? null : I(n.value), { fields: h, encodings: g } = F(n.select) ? n.select : {};
		if (!h && !g && m) {
			for (let e of m) if (F(e)) for (let t of q(e)) if (uW(t)) (g || (g = [])).push(t);
			else if (f === "interval") X(eK), g = p.encodings;
			else {
				var _;
				((_ = h) == null ? h = [] : _).push(t);
			}
		}
		!h && !g && (g = p.encodings, "fields" in p && (h = p.fields));
		for (let t of (i = g) == null ? [] : i) {
			let n = e.fieldDef(t);
			if (n) {
				let r = n.field;
				if (n.aggregate) {
					X(WG(t, n.aggregate));
					continue;
				} else if (!r) {
					X(UG(t));
					continue;
				}
				if (n.timeUnit && !Mq(n.timeUnit)) {
					r = e.vgField(t);
					let i = {
						timeUnit: n.timeUnit,
						as: r,
						field: n.field
					};
					l[wH(i)] = i;
				}
				if (!c[r]) {
					let i = f === "interval" && BW(t) && jJ(e.getScaleComponent(t).get("type")) ? "R" : n.bin ? "R-RE" : "E", a = {
						field: r,
						channel: t,
						type: i,
						index: s.items.length
					};
					a.signals = {
						...d(a, "data"),
						...d(a, "visual")
					}, s.items.push(c[r] = a), s.hasField[r] = c[r], s.hasSelectionId = s.hasSelectionId || r === hQ, eW(t) ? (a.geoChannel = t, a.channel = $U(t), s.hasChannel[a.channel] = c[r]) : s.hasChannel[t] = c[r];
				}
			} else X(UG(t));
		}
		for (let e of (a = h) == null ? [] : a) {
			if (s.hasField[e]) continue;
			let t = {
				type: "E",
				field: e,
				index: s.items.length
			};
			t.signals = { ...d(t, "data") }, s.items.push(t), s.hasField[e] = t, s.hasSelectionId = s.hasSelectionId || e === hQ;
		}
		m && (t.init = m.map((e) => s.items.map((t) => F(e) ? e[t.geoChannel || t.channel] === void 0 ? e[t.field] : e[t.geoChannel || t.channel] : e))), LH(l) || (s.timeUnit = new z1(null, l));
	},
	signals: (e, t, n) => {
		let r = t.name + G1;
		return n.filter((e) => e.name === r).length > 0 || t.project.hasSelectionId ? n : n.concat({
			name: r,
			value: t.project.items.map(a0)
		});
	}
}, J1 = "_curr", Y1 = "anim_value", X1 = "anim_clock", Z1 = "eased_anim_clock", Q1 = "min_extent", $1 = "max_range_extent", e0 = "last_tick_at", t0 = "is_playing", n0 = 1 / 60 * 1e3, r0 = (e, t) => [
	{
		name: Z1,
		update: X1
	},
	{
		name: `${e}_domain`,
		init: `domain('${t}')`
	},
	{
		name: Q1,
		init: `extent(${e}_domain)[0]`
	},
	{
		name: $1,
		init: `extent(range('${t}'))[1]`
	},
	{
		name: Y1,
		update: `invert('${t}', ${Z1})`
	}
], i0 = {
	defined: (e) => e.type === "point",
	topLevelSignals: (e, t, n) => (P2(t) && (n = n.concat([
		{
			name: X1,
			init: "0",
			on: [{
				events: {
					type: "timer",
					throttle: n0
				},
				update: `${t0} ? (${X1} + (now() - ${e0}) > ${$1} ? 0 : ${X1} + (now() - ${e0})) : ${X1}`
			}]
		},
		{
			name: e0,
			init: "now()",
			on: [{
				events: [{ signal: X1 }, { signal: t0 }],
				update: "now()"
			}]
		},
		{
			name: t0,
			init: "true"
		}
	])), n),
	signals: (e, t, n) => {
		var r;
		let i = t.name, a = i + G1, o = t.project, s = "(item().isVoronoi ? datum.datum : datum)", c = RH((r = e.component.selection) == null ? {} : r).reduce((e, t) => t.type === "interval" ? e.concat(t.name + v0) : e, []).map((e) => `indexof(item().mark.name, '${e}') < 0`).join(" && "), l = `datum && item().mark.marktype !== 'group' && indexof(item().mark.role, 'legend') < 0${c ? ` && ${c}` : ""}`, u = `unit: ${j2(e)}, `;
		if (t.project.hasSelectionId) u += `${hQ}: ${s}[${B(hQ)}]`;
		else if (P2(t)) u += `fields: ${a}, values: [${Y1} ? ${Y1} : ${Q1}]`;
		else {
			let t = o.items.map((t) => {
				let n = e.fieldDef(t.channel);
				return n != null && n.bin ? `[${s}[${B(e.vgField(t.channel, {}))}], ${s}[${B(e.vgField(t.channel, { binSuffix: "end" }))}]]` : `${s}[${B(t.field)}]`;
			}).join(", ");
			u += `fields: ${a}, values: [${t}]`;
		}
		if (P2(t)) return n.concat(r0(t.name, e.scaleName(kU)), [{
			name: i + E2,
			on: [{
				events: [{ signal: Z1 }, { signal: Y1 }],
				update: `{${u}}`,
				force: !0
			}]
		}]);
		{
			let e = t.events;
			return n.concat([{
				name: i + E2,
				on: e ? [{
					events: e,
					update: `${l} ? {${u}} : null`,
					force: !0
				}] : []
			}]);
		}
	}
};
function a0(e) {
	let { signals: t, hasLegend: n, index: r, ...i } = e;
	return i.field = ZH(i.field), i;
}
function o0(e, t = !0, n = ou) {
	if (P(e)) {
		let r = e.map((e) => o0(e, t, n));
		return t ? `[${r.join(", ")}]` : r;
	} else if (_q(e)) return n(t ? Eq(e) : Oq(e));
	return t ? n(dU(e)) : e;
}
function s0(e, t) {
	var n;
	for (let r of RH((n = e.component.selection) == null ? {} : n)) {
		let n = r.name, i = `${n}${E2}, ${r.resolve === "global" ? "true" : `{unit: ${j2(e)}}`}`;
		for (let n of k2) n.defined(r) && (n.signals && (t = n.signals(e, r, t)), n.modifyExpr && (i = n.modifyExpr(e, r, i)));
		t.push({
			name: n + D2,
			on: [{
				events: { signal: r.name + E2 },
				update: `modify(${B(r.name + T2)}, ${i})`
			}]
		});
	}
	return m0(t);
}
function c0(e, t) {
	if (e.component.selection && q(e.component.selection).length) {
		let n = B(e.getName("cell"));
		t.unshift({
			name: "facet",
			value: {},
			on: [{
				events: PI("pointermove", "scope"),
				update: `isTuple(facet) ? facet : group(${n}).datum`
			}]
		});
	}
	return m0(t);
}
function l0(e, t) {
	var n;
	let r = !1;
	for (let i of RH((n = e.component.selection) == null ? {} : n)) {
		let n = i.name, a = B(n + T2);
		if (t.filter((e) => e.name === n).length === 0) {
			let e = i.resolve === "global" ? "union" : i.resolve, n = i.type === "point" ? ", true, true)" : ")";
			t.push({
				name: i.name,
				update: `${O2}(${a}, ${B(e)}${n}`
			});
		}
		r = !0;
		for (let n of k2) n.defined(i) && n.topLevelSignals && (t = n.topLevelSignals(e, i, t));
	}
	return r && t.filter((e) => e.name === "unit").length === 0 && t.unshift({
		name: "unit",
		value: {},
		on: [{
			events: "pointermove",
			update: "isTuple(group()) ? group() : unit"
		}]
	}), m0(t);
}
function u0(e, t) {
	var n;
	let r = [], i = [], a = j2(e, { escape: !1 });
	for (let o of RH((n = e.component.selection) == null ? {} : n)) {
		let n = { name: o.name + T2 };
		if (o.project.hasSelectionId && (n.transform = [{
			type: "collect",
			sort: { field: hQ }
		}]), o.init) {
			let e = o.project.items.map(a0);
			n.values = o.project.hasSelectionId ? o.init.map((e) => ({
				unit: a,
				[hQ]: o0(e, !1)[0]
			})) : o.init.map((t) => ({
				unit: a,
				fields: e,
				values: o0(t, !1)
			}));
		}
		if ([...r, ...t].filter((e) => e.name === o.name + T2).length || r.push(n), P2(o) && t.length) {
			let n = e.lookupDataSource(e.getDataName(M1.Main)), r = t.find((e) => e.name === n), a = r.transform.find((e) => e.type === "filter" && e.expr.includes("vlSelectionTest"));
			if (a) {
				r.transform = r.transform.filter((e) => e !== a);
				let e = {
					name: r.name + J1,
					source: r.name,
					transform: [a]
				};
				i.push(e);
			}
		}
	}
	return r.concat(t, i);
}
function d0(e, t) {
	var n;
	for (let r of RH((n = e.component.selection) == null ? {} : n)) for (let n of k2) n.defined(r) && n.marks && (t = n.marks(e, r, t));
	return t;
}
function f0(e, t) {
	for (let n of e.children) B8(n) && (t = d0(n, t));
	return t;
}
function p0(e, t, n, r) {
	let i = V2(e, t.param, t);
	return { signal: jJ(n.get("type")) && P(r) && r[0] > r[1] ? `isValid(${i}) && reverse(${i})` : i };
}
function m0(e) {
	return e.map((e) => (e.on && !e.on.length && delete e.on, e));
}
var h0 = {
	defined: (e) => e.type === "interval" && e.resolve === "global" && e.bind && e.bind === "scales",
	parse: (e, t) => {
		let n = t.scales = [];
		for (let r of t.project.items) {
			let i = r.channel;
			if (!BW(i)) continue;
			let a = e.getScaleComponent(i), o = a ? a.get("type") : void 0;
			if (o == "sequential" && X(YG), !a || !jJ(o)) {
				X(JG);
				continue;
			}
			a.set("selectionExtent", {
				param: t.name,
				field: r.field
			}, !0), n.push(r);
		}
	},
	topLevelSignals: (e, t, n) => {
		let r = t.scales.filter((e) => n.filter((t) => t.name === e.signals.data).length === 0);
		if (!e.parent || _0(e) || r.length === 0) return n;
		let i = n.find((e) => e.name === t.name), a = i.update;
		if (a.includes(O2)) i.update = `{${r.map((e) => `${B(ZH(e.field))}: ${e.signals.data}`).join(", ")}}`;
		else {
			for (let e of r) {
				let t = `${B(ZH(e.field))}: ${e.signals.data}`;
				a.includes(t) || (a = `${a.substring(0, a.length - 1)}, ${t}}`);
			}
			i.update = a;
		}
		return n.concat(r.map((e) => ({ name: e.signals.data })));
	},
	signals: (e, t, n) => {
		if (e.parent && !_0(e)) for (let e of t.scales) {
			let t = n.find((t) => t.name === e.signals.data);
			t.push = "outer", delete t.value, delete t.update;
		}
		return n;
	}
};
function g0(e, t) {
	return `domain(${B(e.scaleName(t))})`;
}
function _0(e) {
	return e.parent && U8(e.parent) && (!e.parent.parent || _0(e.parent.parent));
}
var v0 = "_brush", y0 = "_scale_trigger", b0 = "geo_interval_init_tick", x0 = "_init", S0 = "_center", C0 = {
	defined: (e) => e.type === "interval",
	parse: (e, t, n) => {
		if (e.hasProjection) {
			let e = { ...F(n.select) ? n.select : {} };
			e.fields = [hQ], e.encodings || (e.encodings = n.value ? q(n.value) : [EU, TU]), n.select = {
				type: "interval",
				...e
			};
		}
		if (t.translate && !h0.defined(t)) {
			let e = `!event.item || event.item.mark.name !== ${B(t.name + v0)}`;
			for (let n of t.events) {
				var r, i;
				if (!n.between) {
					X(`${n} is not an ordered event stream for interval selections.`);
					continue;
				}
				let t = I((i = (r = n.between[0]).filter) == null ? r.filter = [] : i);
				t.includes(e) || t.push(e);
			}
		}
	},
	signals: (e, t, n) => {
		let r = t.name, i = r + E2, a = RH(t.project.hasChannel).filter((e) => e.channel === hU || e.channel === gU), o = t.init ? t.init[0] : null;
		if (n.push(...a.reduce((n, r) => n.concat(w0(e, t, r, o == null ? void 0 : o[r.index])), [])), e.hasProjection) {
			let s = B(e.projectionName()), c = e.projectionName() + S0, { x: l, y: u } = t.project.hasChannel, d = l == null ? void 0 : l.signals.visual, f = u == null ? void 0 : u.signals.visual, p = l ? o == null ? void 0 : o[l.index] : `${c}[0]`, m = u ? o == null ? void 0 : o[u.index] : `${c}[1]`, h = (t) => e.getSizeSignalRef(t).signal, g = `[[${d ? `${d}[0]` : "0"}, ${f ? `${f}[0]` : "0"}],[${d ? `${d}[1]` : h("width")}, ${f ? `${f}[1]` : h("height")}]]`;
			o && (n.unshift({
				name: r + x0,
				init: `[scale(${s}, [${l ? p[0] : p}, ${u ? m[0] : m}]), scale(${s}, [${l ? p[1] : p}, ${u ? m[1] : m}])]`
			}), (!l || !u) && (n.find((e) => e.name === c) || n.unshift({
				name: c,
				update: `invert(${s}, [${h("width")}/2, ${h("height")}/2])`
			})));
			let _ = `vlSelectionTuples(${`intersect(${g}, {markname: ${B(e.getName("marks"))}}, unit.mark)`}, ${`{unit: ${j2(e)}}`})`, v = a.map((e) => e.signals.visual);
			return n.concat({
				name: i,
				on: [{
					events: [...v.length ? [{ signal: v.join(" || ") }] : [], ...o ? [{ signal: b0 }] : []],
					update: _
				}]
			});
		} else {
			if (!h0.defined(t)) {
				let t = r + y0, i = a.map((t) => {
					let n = t.channel, { data: r, visual: i } = t.signals, a = B(e.scaleName(n)), o = jJ(e.getScaleComponent(n).get("type")) ? "+" : "";
					return `(!isArray(${r}) || (${o}invert(${a}, ${i})[0] === ${o}${r}[0] && ${o}invert(${a}, ${i})[1] === ${o}${r}[1]))`;
				});
				i.length && n.push({
					name: t,
					value: {},
					on: [{
						events: a.map((t) => ({ scale: e.scaleName(t.channel) })),
						update: `${i.join(" && ")} ? ${t} : {}`
					}]
				});
			}
			let s = a.map((e) => e.signals.data), c = `unit: ${j2(e)}, fields: ${r + G1}, values`;
			return n.concat({
				name: i,
				...o ? { init: `{${c}: ${o0(o)}}` } : {},
				...s.length ? { on: [{
					events: [{ signal: s.join(" || ") }],
					update: `${s.join(" && ")} ? {${c}: [${s}]} : null`
				}] } : {}
			});
		}
	},
	topLevelSignals: (e, t, n) => (B8(e) && e.hasProjection && t.init && (n.filter((e) => e.name === b0).length || n.unshift({
		name: b0,
		value: null,
		on: [{
			events: "timer{1}",
			update: `${b0} === null ? {} : ${b0}`
		}]
	})), n),
	marks: (e, t, n) => {
		let r = t.name, { x: i, y: a } = t.project.hasChannel, o = i == null ? void 0 : i.signals.visual, s = a == null ? void 0 : a.signals.visual, c = `data(${B(t.name + T2)})`;
		if (h0.defined(t) || !i && !a) return n;
		let l = {
			x: i === void 0 ? { value: 0 } : { signal: `${o}[0]` },
			y: a === void 0 ? { value: 0 } : { signal: `${s}[0]` },
			x2: i === void 0 ? { field: { group: "width" } } : { signal: `${o}[1]` },
			y2: a === void 0 ? { field: { group: "height" } } : { signal: `${s}[1]` }
		};
		if (t.resolve === "global") for (let t of q(l)) l[t] = [{
			test: `${c}.length && ${c}[0].unit === ${j2(e)}`,
			...l[t]
		}, { value: 0 }];
		let { fill: u, fillOpacity: d, cursor: f, ...p } = t.mark, m = q(p).reduce((e, t) => (e[t] = [{
			test: [i !== void 0 && `${o}[0] !== ${o}[1]`, a !== void 0 && `${s}[0] !== ${s}[1]`].filter((e) => e).join(" && "),
			value: p[t]
		}, { value: null }], e), {}), h = f == null ? t.translate ? "move" : null : f;
		return [
			{
				name: `${r + v0}_bg`,
				type: "rect",
				clip: !0,
				encode: {
					enter: {
						fill: { value: u },
						fillOpacity: { value: d }
					},
					update: l
				}
			},
			...n,
			{
				name: r + v0,
				type: "rect",
				clip: !0,
				encode: {
					enter: {
						...h ? { cursor: { value: h } } : {},
						fill: { value: "transparent" }
					},
					update: {
						...l,
						...m
					}
				}
			}
		];
	}
};
function w0(e, t, n, r) {
	let i = !e.hasProjection, a = n.channel, o = n.signals.visual, s = B(i ? e.scaleName(a) : e.projectionName()), c = (e) => `scale(${s}, ${e})`, l = e.getSizeSignalRef(a === hU ? "width" : "height").signal, u = `${a}(unit)`, d = t.events.reduce((e, t) => [
		...e,
		{
			events: t.between[0],
			update: `[${u}, ${u}]`
		},
		{
			events: t,
			update: `[${o}[0], clamp(${u}, 0, ${l})]`
		}
	], []);
	if (i) {
		let i = n.signals.data, l = h0.defined(t), u = e.getScaleComponent(a), f = u ? u.get("type") : void 0, p = r ? { init: o0(r, !0, c) } : { value: [] };
		return d.push({
			events: { signal: t.name + y0 },
			update: jJ(f) ? `[${c(`${i}[0]`)}, ${c(`${i}[1]`)}]` : "[0, 0]"
		}), l ? [{
			name: i,
			on: []
		}] : [{
			name: o,
			...p,
			on: d
		}, {
			name: i,
			...r ? { init: o0(r) } : {},
			on: [{
				events: { signal: o },
				update: `${o}[0] === ${o}[1] ? null : invert(${s}, ${o})`
			}]
		}];
	} else {
		let e = a === hU ? 0 : 1, n = t.name + x0;
		return [{
			name: o,
			...r ? { init: `[${n}[0][${e}], ${n}[1][${e}]]` } : { value: [] },
			on: d
		}];
	}
}
function T0({ model: e, channelDef: t, vgChannel: n, invalidValueRef: r, mainRefFn: i }) {
	let a = mX(t) && t.condition, o = [];
	a && (o = I(a).map((t) => {
		let n = i(t);
		if (oX(t)) {
			let { param: r, empty: i } = t;
			return {
				test: B2(e, {
					param: r,
					empty: i
				}),
				...n
			};
		} else return {
			test: U2(e, t.test),
			...n
		};
	})), r !== void 0 && o.push(r);
	let s = i(t);
	return s !== void 0 && o.push(s), o.length > 1 || o.length === 1 && o[0].test ? { [n]: o } : o.length === 1 ? { [n]: o[0] } : {};
}
function E0(e, t = "text") {
	let n = e.encoding[t];
	return T0({
		model: e,
		channelDef: n,
		vgChannel: t,
		mainRefFn: (t) => D0(t, e.config),
		invalidValueRef: void 0
	});
}
function D0(e, t, n = "datum") {
	if (e) {
		if (wX(e)) return CG(e.value);
		if (Q(e)) {
			let { format: r, formatType: i } = UX(e);
			return BY({
				fieldOrDatumDef: e,
				format: r,
				formatType: i,
				expr: n,
				config: t
			});
		}
	}
}
function O0(e, t = {}) {
	let { encoding: n, markDef: r, config: i, stack: a } = e, o = n.tooltip;
	if (P(o)) return { tooltip: A0({ tooltip: o }, a, i, t) };
	{
		let s = t.reactiveGeom ? "datum.datum" : "datum";
		return T0({
			model: e,
			channelDef: o,
			vgChannel: "tooltip",
			mainRefFn: (e) => {
				let o = j0(e, i, s);
				if (o) return o;
				if (e === null) return;
				let c = kG("tooltip", r, i);
				if (c === !0 && (c = { content: "encoding" }), z(c)) return { value: c };
				if (F(c)) return Y(c) ? c : c.content === "encoding" ? A0(n, a, i, t) : { signal: s };
			},
			invalidValueRef: void 0
		});
	}
}
function k0(e, t, n, { reactiveGeom: r } = {}) {
	let i = {
		...n,
		...n.tooltipFormat
	}, a = /* @__PURE__ */ new Set(), o = r ? "datum.datum" : "datum", s = [];
	function c(n, r) {
		let c = mW(r), l = CX(n) ? n : {
			...n,
			type: e[c].type
		}, u = I(l.title || HX(l, i)).join(", ").replaceAll(/"/g, "\\\""), d;
		if (EW(r)) {
			let t = r === "x" ? "x2" : "y2", n = GX(e[t]);
			if (iG(l.bin) && n) {
				let e = $(l, { expr: o }), r = $(n, { expr: o }), { format: s, formatType: c } = UX(l);
				d = YY(e, r, s, c, i), a.add(t);
			}
		}
		if ((EW(r) || r === CU || r === xU) && t && t.fieldChannel === r && t.offset === "normalize") {
			let { format: e, formatType: t } = UX(l);
			d = BY({
				fieldOrDatumDef: l,
				format: e,
				formatType: t,
				expr: o,
				config: i,
				normalizeStack: !0
			}).signal;
		}
		d != null || (d = j0(l, i, o).signal), s.push({
			channel: r,
			key: u,
			value: d
		});
	}
	wZ(e, (e, t) => {
		Z(e) ? c(e, t) : hX(e) && c(e.condition, t);
	});
	let l = {};
	for (let { channel: e, key: t, value: n } of s) !a.has(e) && !l[t] && (l[t] = n);
	return l;
}
function A0(e, t, n, { reactiveGeom: r } = {}) {
	let i = zH(k0(e, t, n, { reactiveGeom: r })).map(([e, t]) => `"${e}": ${t}`);
	return i.length > 0 ? { signal: `{${i.join(", ")}}` } : void 0;
}
function j0(e, t, n = "datum") {
	if (Z(e) && fJ(e.type) && !e.timeUnit && !UX(e).format && !UX(e).formatType) {
		let t = `${n}["${e.field}"]`;
		return { signal: `isValid(${t}) ? isArray(${t}) ? join(${t}, '\\n') : ${t} : ""+${t}` };
	}
	return D0(e, t, n);
}
function M0(e) {
	let { markDef: t, config: n } = e, r = kG("aria", t, n);
	return r === !1 ? {} : {
		...r ? { aria: r } : {},
		...N0(e),
		...P0(e)
	};
}
function N0(e) {
	let { mark: t, markDef: n, config: r } = e;
	if (r.aria === !1) return {};
	let i = kG("ariaRoleDescription", n, r);
	return i == null ? L(_G, t) ? {} : { ariaRoleDescription: { value: t } } : { ariaRoleDescription: { value: i } };
}
function P0(e) {
	let { encoding: t, markDef: n, config: r, stack: i } = e, a = t.description;
	if (a) return T0({
		model: e,
		channelDef: a,
		vgChannel: "description",
		mainRefFn: (t) => D0(t, e.config),
		invalidValueRef: void 0
	});
	let o = kG("description", n, r);
	if (o != null) return { description: CG(o) };
	if (r.aria === !1) return {};
	let s = k0(t, i, r);
	if (!LH(s)) return { description: { signal: zH(s).filter(([e]) => !e.startsWith("_")).map(([e, t]) => [e, t.replaceAll("\\n", " ")]).map(([e, t], n) => `"${n > 0 ? "; " : ""}${e}: " + (${t})`).join(" + ") } };
}
function F0(e, t, n = {}) {
	let { markDef: r, encoding: i, config: a } = t, { vgChannel: o } = n, { defaultRef: s, defaultValue: c } = n, l = i[e];
	s === void 0 && (c != null || (c = kG(e, r, a, {
		vgChannel: o,
		ignoreVgConfig: !mX(l)
	})), c !== void 0 && (s = CG(c)));
	let u = {
		markDef: r,
		config: a,
		scaleName: t.scaleName(e),
		scale: t.getScaleComponent(e)
	}, d = kY({
		...u,
		scaleChannel: e,
		channelDef: l
	});
	return T0({
		model: t,
		channelDef: l,
		vgChannel: o == null ? e : o,
		invalidValueRef: d,
		mainRefFn: (t) => IY({
			...u,
			channel: e,
			channelDef: t,
			stack: null,
			defaultRef: s
		})
	});
}
function I0(e, t = { filled: void 0 }) {
	var n, r, i, a;
	let { markDef: o, encoding: s, config: c } = e, { type: l } = o, u = (n = t.filled) == null ? kG("filled", o, c) : n, d = EH([
		"bar",
		"point",
		"circle",
		"square",
		"geoshape"
	], l) ? "transparent" : void 0, f = (r = (i = kG(u === !0 ? "color" : void 0, o, c, { vgChannel: "fill" })) == null ? c.mark[u === !0 && "color"] : i) == null ? d : r, p = (a = kG(u === !1 ? "color" : void 0, o, c, { vgChannel: "stroke" })) == null ? c.mark[u === !1 && "color"] : a, m = u ? "fill" : "stroke", h = {
		...f ? { fill: CG(f) } : {},
		...p ? { stroke: CG(p) } : {}
	};
	return o.color && (u ? o.fill : o.stroke) && X(xK("property", {
		fill: "fill" in o,
		stroke: "stroke" in o
	})), {
		...h,
		...F0("color", e, {
			vgChannel: m,
			defaultValue: u ? f : p
		}),
		...F0("fill", e, { defaultValue: s.fill ? f : void 0 }),
		...F0("stroke", e, { defaultValue: s.stroke ? p : void 0 })
	};
}
function L0(e) {
	let { encoding: t, mark: n } = e, r = t.order;
	return !sY(n) && wX(r) ? T0({
		model: e,
		channelDef: r,
		vgChannel: "zindex",
		mainRefFn: (e) => CG(e.value),
		invalidValueRef: void 0
	}) : {};
}
function R0({ channel: e, markDef: t, encoding: n = {}, model: r, bandPosition: i }) {
	let a = `${e}Offset`, o = t[a], s = n[a];
	if ((a === "xOffset" || a === "yOffset") && s) return {
		offsetType: "encoding",
		offset: IY({
			channel: a,
			channelDef: s,
			markDef: t,
			config: r == null ? void 0 : r.config,
			scaleName: r.scaleName(a),
			scale: r.getScaleComponent(a),
			stack: null,
			defaultRef: CG(o),
			bandPosition: i
		})
	};
	let c = t[a];
	return c ? {
		offsetType: "visual",
		offset: c
	} : {};
}
function z0(e, t, { defaultPos: n, vgChannel: r }) {
	let { encoding: i, markDef: a, config: o, stack: s } = t, c = i[e], l = i[gW(e)], u = t.scaleName(e), d = t.getScaleComponent(e), { offset: f, offsetType: p } = R0({
		channel: e,
		markDef: a,
		encoding: i,
		model: t,
		bandPosition: .5
	}), m = V0({
		model: t,
		defaultPos: n,
		channel: e,
		scaleName: u,
		scale: d
	}), h = !c && EW(e) && (i.latitude || i.longitude) ? { field: t.getName(e) } : B0({
		channel: e,
		channelDef: c,
		channel2Def: l,
		markDef: a,
		config: o,
		scaleName: u,
		scale: d,
		stack: s,
		offset: f,
		defaultRef: m,
		bandPosition: p === "encoding" ? 0 : void 0
	});
	return h ? { [r || e]: h } : void 0;
}
function B0(e) {
	let { channel: t, channelDef: n, scaleName: r, stack: i, offset: a, markDef: o } = e;
	if (Q(n) && i && t === i.fieldChannel) {
		if (Z(n)) {
			let e = n.bandPosition;
			if (e === void 0 && o.type === "text" && (t === "radius" || t === "theta") && (e = .5), e !== void 0) return PY({
				scaleName: r,
				fieldOrDatumDef: n,
				startSuffix: "start",
				bandPosition: e,
				offset: a
			});
		}
		return NY(n, r, { suffix: "end" }, { offset: a });
	}
	return jY(e);
}
function V0({ model: e, defaultPos: t, channel: n, scaleName: r, scale: i }) {
	let { markDef: a, config: o } = e;
	return () => {
		let s = mW(n), c = kG(n, a, o, { vgChannel: hW(n) });
		if (c !== void 0) return LY(n, c);
		switch (t) {
			case "zeroOrMin": return H0({
				scaleName: r,
				scale: i,
				mode: "zeroOrMin",
				mainChannel: s,
				config: o
			});
			case "zeroOrMax": return H0({
				scaleName: r,
				scale: i,
				mode: { zeroOrMax: {
					widthSignal: e.width.signal,
					heightSignal: e.height.signal
				} },
				mainChannel: s,
				config: o
			});
			case "mid": return {
				...e[_W(n)],
				mult: .5
			};
		}
	};
}
function H0({ mainChannel: e, config: t, ...n }) {
	let r = OY(n), { mode: i } = n;
	if (r) return r;
	switch (e) {
		case "radius": {
			if (i === "zeroOrMin") return { value: 0 };
			let { widthSignal: e, heightSignal: t } = i.zeroOrMax;
			return { signal: `min(${e},${t})/2` };
		}
		case "theta": return i === "zeroOrMin" ? { value: 0 } : { signal: "2*PI" };
		case "x": return i === "zeroOrMin" ? { value: 0 } : { field: { group: "width" } };
		case "y": return i === "zeroOrMin" ? { field: { group: "height" } } : { value: 0 };
	}
}
var U0 = {
	left: "x",
	center: "xc",
	right: "x2"
}, W0 = {
	top: "y",
	middle: "yc",
	bottom: "y2"
};
function G0(e, t, n, r = "middle") {
	if (e === "radius" || e === "theta") return hW(e);
	let i = e === "x" ? "align" : "baseline", a = kG(i, t, n), o;
	return Y(a) ? (X(jK(i)), o = void 0) : o = a, e === "x" ? U0[o || (r === "top" ? "left" : "center")] : W0[o || r];
}
function K0(e, t, { defaultPos: n, defaultPos2: r, range: i }) {
	return i ? q0(e, t, {
		defaultPos: n,
		defaultPos2: r
	}) : z0(e, t, { defaultPos: n });
}
function q0(e, t, { defaultPos: n, defaultPos2: r }) {
	let { markDef: i, config: a } = t, o = gW(e), s = _W(e), c = J0(t, r, o);
	return {
		...z0(e, t, {
			defaultPos: n,
			vgChannel: c[s] ? G0(e, i, a) : hW(e)
		}),
		...c
	};
}
function J0(e, t, n) {
	let { encoding: r, mark: i, markDef: a, stack: o, config: s } = e, c = mW(n), l = _W(n), u = hW(n), d = r[c], f = e.scaleName(c), p = e.getScaleComponent(c), { offset: m } = n in r || n in a ? R0({
		channel: n,
		markDef: a,
		encoding: r,
		model: e
	}) : R0({
		channel: c,
		markDef: a,
		encoding: r,
		model: e
	});
	if (!d && (n === "x2" || n === "y2") && (r.latitude || r.longitude)) {
		let t = _W(n), r = e.markDef[t];
		return r == null ? { [u]: { field: e.getName(n) } } : { [t]: { value: r } };
	}
	let h = Y0({
		channel: n,
		channelDef: d,
		channel2Def: r[n],
		markDef: a,
		config: s,
		scaleName: f,
		scale: p,
		stack: o,
		offset: m,
		defaultRef: void 0
	});
	return h === void 0 ? X0(n, a) || X0(n, {
		[n]: jG(n, a, s.style),
		[l]: jG(l, a, s.style)
	}) || X0(n, s[i]) || X0(n, s.mark) || { [u]: V0({
		model: e,
		defaultPos: t,
		channel: n,
		scaleName: f,
		scale: p
	})() } : { [u]: h };
}
function Y0({ channel: e, channelDef: t, channel2Def: n, markDef: r, config: i, scaleName: a, scale: o, stack: s, offset: c, defaultRef: l }) {
	return Q(t) && s && e.charAt(0) === s.fieldChannel.charAt(0) ? NY(t, a, { suffix: "start" }, { offset: c }) : jY({
		channel: e,
		channelDef: n,
		scaleName: a,
		scale: o,
		stack: s,
		markDef: r,
		config: i,
		offset: c,
		defaultRef: l
	});
}
function X0(e, t) {
	let n = _W(e), r = hW(e);
	if (t[r] !== void 0) return { [r]: LY(e, t[r]) };
	if (t[e] !== void 0) return { [r]: LY(e, t[e]) };
	if (t[n]) {
		let r = t[n];
		if (yY(r)) X(SK(n));
		else return { [n]: LY(e, r) };
	}
}
function Z0(e, t) {
	var n, r;
	let { config: i, encoding: a, markDef: o } = e, s = o.type, c = gW(t), l = _W(t), u = a[t], d = a[c], f = e.getScaleComponent(t), p = f ? f.get("type") : void 0, m = o.orient, h = (n = (r = a[l]) == null ? a.size : r) == null ? kG("size", o, i, { vgChannel: l }) : n, g = vW(t), _ = s === "bar" && (t === "x" ? m === "vertical" : m === "horizontal") || s === "tick" && (t === "y" ? m === "vertical" : m === "horizontal");
	return Z(u) && (rG(u.bin) || iG(u.bin) || u.timeUnit && !d) && !(h && !yY(h)) && !a[g] && !AJ(p) ? t2({
		fieldDef: u,
		fieldDef2: d,
		channel: t,
		model: e
	}) : (Q(u) && AJ(p) || _) && !d ? $0(u, t, e) : q0(t, e, {
		defaultPos: "zeroOrMax",
		defaultPos2: "zeroOrMin"
	});
}
function Q0(e, t, n, r, i, a, o) {
	if (yY(i)) if (n) {
		let e = n.get("type");
		if (e === "band") {
			let e = `bandwidth('${t}')`;
			i.band !== 1 && (e = `${i.band} * ${e}`);
			let n = AG("minBandSize", { type: o }, r);
			return { signal: n ? `max(${EG(n)}, ${e})` : e };
		} else i.band !== 1 && X(FK(e));
	} else return {
		mult: i.band,
		field: { group: e }
	};
	else if (Y(i)) return i;
	else if (i) return { value: i };
	if (n) {
		let e = n.get("range");
		if (fG(e) && rd(e.step)) return { value: e.step - 2 };
	}
	if (!a) {
		let { bandPaddingInner: t, barBandPaddingInner: n, rectBandPaddingInner: i, tickBandPaddingInner: a } = r.scale, s = tU(t, o === "tick" ? a : o === "bar" ? n : i);
		if (Y(s)) return { signal: `(1 - (${s.signal})) * ${e}` };
		if (rd(s)) return { signal: `${1 - s} * ${e}` };
	}
	return { value: MQ(r.view, e) - 2 };
}
function $0(e, t, n) {
	var r, i;
	let { markDef: a, encoding: o, config: s, stack: c } = n, l = a.orient, u = n.scaleName(t), d = n.getScaleComponent(t), f = _W(t), p = gW(t), m = vW(t), h = n.scaleName(m), g = n.getScaleComponent(yW(t)), _ = a.type === "tick" || l === "horizontal" && t === "y" || l === "vertical" && t === "x", v;
	(o.size || a.size) && (_ ? v = F0("size", n, {
		vgChannel: f,
		defaultRef: CG(a.size)
	}) : X(zK(a.type)));
	let y = !!v, b = dX({
		channel: t,
		fieldDef: e,
		markDef: a,
		config: s,
		scaleType: (r = d || g) == null ? void 0 : r.get("type"),
		useVlSizeChannel: _
	});
	v = v || { [f]: Q0(f, h || u, g || d, s, b, !!e, a.type) };
	let x = G0(t, a, s, ((i = d || g) == null ? void 0 : i.get("type")) === "band" && yY(b) && !y ? "top" : "middle"), S = x === "xc" || x === "yc", { offset: C, offsetType: w } = R0({
		channel: t,
		markDef: a,
		encoding: o,
		model: n,
		bandPosition: S ? .5 : 0
	}), T = S && w !== "encoding" && Z(e) && e.timeUnit && !o[p] ? uX({
		fieldDef: e,
		markDef: a,
		config: s
	}) : void 0, E = T == null ? S ? w === "encoding" ? 0 : .5 : Y(b) ? { signal: `(1-${b})/2` } : yY(b) ? (1 - b.band) / 2 : 0 : T, D = jY({
		channel: t,
		channelDef: e,
		markDef: a,
		config: s,
		scaleName: u,
		scale: d,
		stack: c,
		offset: C,
		defaultRef: V0({
			model: n,
			defaultPos: "mid",
			channel: t,
			scaleName: u,
			scale: d
		}),
		bandPosition: E
	});
	if (f) return {
		[x]: D,
		...v
	};
	{
		let e = hW(p), t = v[f], n = C ? {
			...t,
			offset: C
		} : t;
		return {
			[x]: D,
			[e]: P(D) ? [D[0], {
				...D[1],
				offset: n
			}] : {
				...D,
				offset: n
			}
		};
	}
}
function e2(e, t, n, r, i, a, o) {
	if (ZU(e)) return 0;
	let s = e === "x" || e === "y2", c = s ? -t / 2 : t / 2;
	if (Y(n) || Y(i) || Y(r) || a) {
		let e = EG(n), t = EG(i), l = EG(r), u = EG(a), d = a ? `(${o} < ${u} ? ${s ? "" : "-"}0.5 * (${u} - (${o})) : ${c})` : c, f = l ? `${l} + ` : "", p = e ? `(${e} ? -1 : 1) * ` : "", m = t ? `(${t} + ${d})` : d;
		return { signal: f + p + m };
	} else return i = i || 0, r + (n ? -i - c : +i + c);
}
function t2({ fieldDef: e, fieldDef2: t, channel: n, model: r }) {
	var i, a, o;
	let { config: s, markDef: c, encoding: l } = r, u = r.getScaleComponent(n), d = r.scaleName(n), f = u ? u.get("type") : void 0, p = u.get("reverse"), m = dX({
		channel: n,
		fieldDef: e,
		markDef: c,
		config: s,
		scaleType: f
	}), h = (i = r.component.axes[n]) == null ? void 0 : i[0], g = (a = h == null ? void 0 : h.get("translate")) == null ? .5 : a, _ = EW(n) ? (o = kG("binSpacing", c, s)) == null ? 0 : o : 0, v = gW(n), y = hW(n), b = hW(v), x = AG("minBandSize", c, s), { offset: S } = R0({
		channel: n,
		markDef: c,
		encoding: l,
		model: r,
		bandPosition: 0
	}), { offset: C } = R0({
		channel: v,
		markDef: c,
		encoding: l,
		model: r,
		bandPosition: 0
	}), w = FY({
		fieldDef: e,
		scaleName: d
	}), T = e2(n, _, p, g, S, x, w), E = e2(v, _, p, g, C == null ? S : C, x, w), D = Y(m) ? { signal: `(1-${m.signal})/2` } : yY(m) ? (1 - m.band) / 2 : .5, O = uX({
		fieldDef: e,
		fieldDef2: t,
		markDef: c,
		config: s
	});
	if (rG(e.bin) || e.timeUnit) {
		let t = e.timeUnit && O !== .5;
		return {
			[b]: n2({
				fieldDef: e,
				scaleName: d,
				bandPosition: D,
				offset: E,
				useRectOffsetField: t
			}),
			[y]: n2({
				fieldDef: e,
				scaleName: d,
				bandPosition: Y(D) ? { signal: `1-${D.signal}` } : 1 - D,
				offset: T,
				useRectOffsetField: t
			})
		};
	} else if (iG(e.bin)) {
		let n = NY(e, d, {}, { offset: E });
		if (Z(t)) return {
			[b]: n,
			[y]: NY(t, d, {}, { offset: T })
		};
		if (aG(e.bin) && e.bin.step) return {
			[b]: n,
			[y]: {
				signal: `scale("${d}", ${$(e, { expr: "datum" })} + ${e.bin.step})`,
				offset: T
			}
		};
	}
	X(cq(v));
}
function n2({ fieldDef: e, scaleName: t, bandPosition: n, offset: r, useRectOffsetField: i }) {
	return PY({
		scaleName: t,
		fieldOrDatumDef: e,
		bandPosition: n,
		offset: r,
		...i ? {
			startSuffix: B1,
			endSuffix: V1
		} : {}
	});
}
var r2 = new Set([
	"aria",
	"width",
	"height"
]);
function i2(e, t) {
	let { fill: n = void 0, stroke: r = void 0 } = t.color === "include" ? I0(e) : {};
	return {
		...o2(e.markDef, t),
		...a2("fill", n),
		...a2("stroke", r),
		...F0("opacity", e),
		...F0("fillOpacity", e),
		...F0("strokeOpacity", e),
		...F0("strokeWidth", e),
		...F0("strokeDash", e),
		...L0(e),
		...O0(e),
		...E0(e, "href"),
		...M0(e)
	};
}
function a2(e, t) {
	return t ? { [e]: t } : {};
}
function o2(e, t) {
	return gG.reduce((n, r) => (!r2.has(r) && J(e, r) && t[r] !== "ignore" && (n[r] = CG(e[r])), n), {});
}
function s2(e) {
	let { config: t, markDef: n } = e, r = /* @__PURE__ */ new Set();
	if (e.forEachFieldDef((i, a) => {
		let o;
		if (!BW(a) || !(o = e.getScaleType(a))) return;
		let s = QW(i.aggregate);
		if (DY(EY({
			scaleChannel: a,
			markDef: n,
			config: t,
			scaleType: o,
			isCountAggregate: s
		}))) {
			var c;
			let t = e.vgField(a, {
				expr: "datum",
				binSuffix: (c = e.stack) != null && c.impute ? "mid" : void 0
			});
			t && r.add(t);
		}
	}), r.size > 0) return { defined: { signal: [...r].map((e) => cJ(e, !0)).join(" && ") } };
}
function c2(e, t) {
	if (t !== void 0) return { [e]: CG(t) };
}
var l2 = "voronoi", u2 = {
	defined: (e) => e.type === "point" && e.nearest,
	parse: (e, t) => {
		if (t.events) for (let n of t.events) n.markname = e.getName(l2);
	},
	marks: (e, t, n) => {
		let { x: r, y: i } = t.project.hasChannel, a = e.mark;
		if (sY(a)) return X(GG(a)), n;
		let o = {
			name: e.getName(l2),
			type: "path",
			interactive: !0,
			aria: !1,
			from: { data: e.getName("marks") },
			encode: { update: {
				fill: { value: "transparent" },
				strokeWidth: { value: .35 },
				stroke: { value: "transparent" },
				isVoronoi: { value: !0 },
				...O0(e, { reactiveGeom: !0 })
			} },
			transform: [{
				type: "voronoi",
				x: { expr: r || !i ? "datum.datum.x || 0" : "0" },
				y: { expr: i || !r ? "datum.datum.y || 0" : "0" },
				size: [e.getSizeSignalRef("width"), e.getSizeSignalRef("height")]
			}]
		}, s = 0, c = !1;
		return n.forEach((t, n) => {
			var r;
			let i = (r = t.name) == null ? "" : r;
			i === e.component.mark[0].name ? s = n : i.includes(l2) && (c = !0);
		}), c || n.splice(s + 1, 0, o), n;
	}
}, d2 = {
	defined: (e) => e.type === "point" && e.resolve === "global" && e.bind && e.bind !== "scales" && !_Q(e.bind),
	parse: (e, t, n) => N2(t, n),
	topLevelSignals: (e, t, n) => {
		var r;
		let i = t.name, a = t.project, o = t.bind, s = (r = t.init) == null ? void 0 : r[0], c = u2.defined(t) ? "(item().isVoronoi ? datum.datum : datum)" : "datum";
		return a.items.forEach((e, r) => {
			let a = HH(`${i}_${e.field}`);
			if (!n.filter((e) => e.name === a).length) {
				var l, u;
				n.unshift({
					name: a,
					...s ? { init: o0(s[r]) } : { value: null },
					on: t.events ? [{
						events: t.events,
						update: `datum && item().mark.marktype !== 'group' ? ${c}[${B(e.field)}] : null`
					}] : [],
					bind: (l = (u = o[e.field]) == null ? o[e.channel] : u) == null ? o : l
				});
			}
		}), n;
	},
	signals: (e, t, n) => {
		let r = t.name, i = t.project, a = n.find((e) => e.name === r + E2), o = r + G1, s = i.items.map((e) => HH(`${r}_${e.field}`)), c = s.map((e) => `${e} !== null`).join(" && ");
		return s.length && (a.update = `${c} ? {fields: ${o}, values: [${s.join(", ")}]} : null`), delete a.value, delete a.on, n;
	}
}, f2 = "_toggle", p2 = {
	defined: (e) => e.type === "point" && !P2(e) && !!e.toggle,
	signals: (e, t, n) => n.concat({
		name: t.name + f2,
		value: !1,
		on: [{
			events: t.events,
			update: t.toggle
		}]
	}),
	modifyExpr: (e, t) => {
		let n = t.name + E2, r = t.name + f2;
		return `${r} ? null : ${n}, ${t.resolve === "global" ? `${r} ? null : true, ` : `${r} ? null : {unit: ${j2(e)}}, `}${r} ? ${n} : null`;
	}
}, m2 = {
	defined: (e) => e.clear !== void 0 && e.clear !== !1 && !P2(e),
	parse: (e, t) => {
		t.clear && (t.clear = z(t.clear) ? PI(t.clear, "view") : t.clear);
	},
	topLevelSignals: (e, t, n) => {
		if (d2.defined(t)) for (let e of t.project.items) {
			let r = n.findIndex((n) => n.name === HH(`${t.name}_${e.field}`));
			r !== -1 && n[r].on.push({
				events: t.clear,
				update: "null"
			});
		}
		return n;
	},
	signals: (e, t, n) => {
		function r(e, r) {
			e !== -1 && n[e].on && n[e].on.push({
				events: t.clear,
				update: r
			});
		}
		if (t.type === "interval") for (let e of t.project.items) {
			let t = n.findIndex((t) => t.name === e.signals.visual);
			r(t, "[0, 0]"), t === -1 && r(n.findIndex((t) => t.name === e.signals.data), "null");
		}
		else {
			let e = n.findIndex((e) => e.name === t.name + E2);
			r(e, "null"), p2.defined(t) && (e = n.findIndex((e) => e.name === t.name + f2), r(e, "false"));
		}
		return n;
	}
}, h2 = {
	defined: (e) => {
		let t = e.resolve === "global" && e.bind && _Q(e.bind), n = e.project.items.length === 1 && e.project.items[0].field !== hQ;
		return t && !n && X(XG), t && n;
	},
	parse: (e, t, n) => {
		let r = K(n);
		if (r.select = z(r.select) ? {
			type: r.select,
			toggle: t.toggle
		} : {
			...r.select,
			toggle: t.toggle
		}, N2(t, r), F(n.select) && (n.select.on || n.select.clear)) {
			let e = "event.item && indexof(event.item.mark.role, \"legend\") < 0";
			for (let n of t.events) {
				var i;
				n.filter = I((i = n.filter) == null ? [] : i), n.filter.includes(e) || n.filter.push(e);
			}
		}
		let a = vQ(t.bind) ? t.bind.legend : "click";
		t.bind = { legend: { merge: z(a) ? PI(a, "view") : I(a) } };
	},
	topLevelSignals: (e, t, n) => {
		let r = t.name, i = vQ(t.bind) && t.bind.legend, a = (e) => (t) => {
			let n = K(t);
			return n.markname = e, n;
		};
		for (let e of t.project.items) {
			if (!e.hasLegend) continue;
			let o = `${HH(e.field)}_legend`, s = `${r}_${o}`;
			if (n.filter((e) => e.name === s).length === 0) {
				let e = i.merge.map(a(`${o}_symbols`)).concat(i.merge.map(a(`${o}_labels`))).concat(i.merge.map(a(`${o}_entries`)));
				n.unshift({
					name: s,
					...t.init ? {} : { value: null },
					on: [{
						events: e,
						update: "isDefined(datum.value) ? datum.value : item().items[0].items[0].datum.value",
						force: !0
					}, {
						events: i.merge,
						update: `!event.item || !datum ? null : ${s}`,
						force: !0
					}]
				});
			}
		}
		return n;
	},
	signals: (e, t, n) => {
		let r = t.name, i = t.project, a = n.find((e) => e.name === r + E2), o = r + G1, s = i.items.filter((e) => e.hasLegend).map((e) => HH(`${r}_${HH(e.field)}_legend`)), c = `${s.map((e) => `${e} !== null`).join(" && ")} ? {fields: ${o}, values: [${s.join(", ")}]} : null`;
		t.events && s.length > 0 ? a.on.push({
			events: s.map((e) => ({ signal: e })),
			update: c
		}) : s.length > 0 && (a.update = c, delete a.value, delete a.on);
		let l = n.find((e) => e.name === r + f2), u = vQ(t.bind) && t.bind.legend;
		return l && (t.events ? l.on.push({
			...l.on[0],
			events: u
		}) : l.on[0].events = u), n;
	}
};
function g2(e, t, n) {
	var r, i;
	let a = (r = e.fieldDef(t)) == null ? void 0 : r.field;
	for (let r of RH((i = e.component.selection) == null ? {} : i)) {
		var o;
		let e = (o = r.project.hasField[a]) == null ? r.project.hasChannel[t] : o;
		if (e && h2.defined(r)) {
			var s;
			let t = (s = n.get("selections")) == null ? [] : s;
			t.push(r.name), n.set("selections", t, !1), e.hasLegend = !0;
		}
	}
}
var _2 = "_translate_anchor", v2 = "_translate_delta", y2 = {
	defined: (e) => e.type === "interval" && e.translate,
	signals: (e, t, n) => {
		let r = t.name, i = h0.defined(t), a = r + _2, { x: o, y: s } = t.project.hasChannel, c = PI(t.translate, "scope");
		return i || (c = c.map((e) => (e.between[0].markname = r + v0, e))), n.push({
			name: a,
			value: {},
			on: [{
				events: c.map((e) => e.between[0]),
				update: `{x: x(unit), y: y(unit)${o === void 0 ? "" : `, extent_x: ${i ? g0(e, hU) : `slice(${o.signals.visual})`}`}${s === void 0 ? "" : `, extent_y: ${i ? g0(e, gU) : `slice(${s.signals.visual})`}`}}`
			}]
		}, {
			name: r + v2,
			value: {},
			on: [{
				events: c,
				update: `{x: ${a}.x - x(unit), y: ${a}.y - y(unit)}`
			}]
		}), o !== void 0 && b2(e, t, o, "width", n), s !== void 0 && b2(e, t, s, "height", n), n;
	}
};
function b2(e, t, n, r, i) {
	var a, o;
	let s = t.name, c = s + _2, l = s + v2, u = n.channel, d = h0.defined(t), f = i.find((e) => e.name === n.signals[d ? "data" : "visual"]), p = e.getSizeSignalRef(r).signal, m = e.getScaleComponent(u), h = m == null ? void 0 : m.get("type"), g = m == null ? void 0 : m.get("reverse"), _ = d ? u === hU ? g ? "" : "-" : g ? "-" : "" : "", v = `${c}.extent_${u}`, y = `${_}${l}.${u} / ${d ? `${p}` : `span(${v})`}`, b = `${!d || !m ? "panLinear" : h === "log" ? "panLog" : h === "symlog" ? "panSymlog" : h === "pow" ? "panPow" : "panLinear"}(${v}, ${y}${d ? h === "pow" ? `, ${(a = m.get("exponent")) == null ? 1 : a}` : h === "symlog" ? `, ${(o = m.get("constant")) == null ? 1 : o}` : "" : ""})`;
	f.on.push({
		events: { signal: l },
		update: d ? b : `clampRange(${b}, 0, ${p})`
	});
}
var x2 = "_zoom_anchor", S2 = "_zoom_delta", C2 = {
	defined: (e) => e.type === "interval" && e.zoom,
	signals: (e, t, n) => {
		let r = t.name, i = h0.defined(t), a = r + S2, { x: o, y: s } = t.project.hasChannel, c = B(e.scaleName(hU)), l = B(e.scaleName(gU)), u = PI(t.zoom, "scope");
		return i || (u = u.map((e) => (e.markname = r + v0, e))), n.push({
			name: r + x2,
			on: [{
				events: u,
				update: i ? `{${[c ? `x: invert(${c}, x(unit))` : "", l ? `y: invert(${l}, y(unit))` : ""].filter((e) => e).join(", ")}}` : "{x: x(unit), y: y(unit)}"
			}]
		}, {
			name: a,
			on: [{
				events: u,
				force: !0,
				update: "pow(1.001, event.deltaY * pow(16, event.deltaMode))"
			}]
		}), o !== void 0 && w2(e, t, o, "width", n), s !== void 0 && w2(e, t, s, "height", n), n;
	}
};
function w2(e, t, n, r, i) {
	var a, o;
	let s = t.name, c = n.channel, l = h0.defined(t), u = i.find((e) => e.name === n.signals[l ? "data" : "visual"]), d = e.getSizeSignalRef(r).signal, f = e.getScaleComponent(c), p = f == null ? void 0 : f.get("type"), m = l ? g0(e, c) : u.name, h = s + S2, g = `${s}${x2}.${c}`, _ = `${!l || !f ? "zoomLinear" : p === "log" ? "zoomLog" : p === "symlog" ? "zoomSymlog" : p === "pow" ? "zoomPow" : "zoomLinear"}(${m}, ${g}, ${h}${l ? p === "pow" ? `, ${(a = f.get("exponent")) == null ? 1 : a}` : p === "symlog" ? `, ${(o = f.get("constant")) == null ? 1 : o}` : "" : ""})`;
	u.on.push({
		events: { signal: h },
		update: l ? _ : `clampRange(${_}, 0, ${d})`
	});
}
var T2 = "_store", E2 = "_tuple", D2 = "_modify", O2 = "vlSelectionResolve", k2 = [
	i0,
	C0,
	q1,
	p2,
	d2,
	h0,
	h2,
	m2,
	y2,
	C2,
	u2
];
function A2(e) {
	let t = e.parent;
	for (; t && !V8(t);) t = t.parent;
	return t;
}
function j2(e, { escape: t } = { escape: !0 }) {
	let n = t ? B(e.name) : e.name, r = A2(e);
	if (r) {
		let { facet: e } = r;
		for (let t of aW) e[t] && (n += ` + '__facet_${t}_' + (facet[${B(r.vgField(t))}])`);
	}
	return n;
}
function M2(e) {
	var t;
	return RH((t = e.component.selection) == null ? {} : t).reduce((e, t) => e || t.project.hasSelectionId, !1);
}
function N2(e, t) {
	(z(t.select) || !t.select.on) && delete e.events, (z(t.select) || !t.select.clear) && delete e.clear, (z(t.select) || !t.select.toggle) && delete e.toggle;
}
function P2(e) {
	var t;
	return (t = e.events) == null ? void 0 : t.find((e) => "type" in e && e.type === "timer");
}
function F2(e) {
	let t = [];
	return e.type === "Identifier" ? [e.name] : e.type === "Literal" ? [e.value] : (e.type === "MemberExpression" && (t.push(...F2(e.object)), t.push(...F2(e.property))), t);
}
function I2(e) {
	return e.object.type === "MemberExpression" ? I2(e.object) : e.object.name === "datum";
}
function L2(e) {
	let t = mN(e), n = /* @__PURE__ */ new Set();
	return t.visit((e) => {
		e.type === "MemberExpression" && I2(e) && n.add(F2(e).slice(1).join("."));
	}), n;
}
var R2 = class t extends F1 {
	clone() {
		return new t(null, this.model, K(this.filter));
	}
	constructor(t, n, r) {
		super(t), e(this, "model", void 0), e(this, "filter", void 0), e(this, "expr", void 0), e(this, "_dependentFields", void 0), this.model = n, this.filter = r, this.expr = U2(this.model, this.filter, this), this._dependentFields = L2(this.expr);
	}
	dependentFields() {
		return this._dependentFields;
	}
	producedFields() {
		return /* @__PURE__ */ new Set();
	}
	assemble() {
		return {
			type: "filter",
			expr: this.expr
		};
	}
	hash() {
		return `Filter ${this.expr}`;
	}
};
function z2(e, t) {
	let n = {}, r = e.config.selection;
	if (!t || !t.length) return n;
	let i = 0;
	for (let o of t) {
		let t = HH(o.name), s = o.select, c = z(s) ? s : s.type, l = F(s) ? K(s) : { type: c }, u = r[c];
		for (let e in u) if (!(e === "fields" || e === "encodings") && (e === "mark" && (l.mark = {
			...u.mark,
			...l.mark
		}), l[e] === void 0 || l[e] === !0)) {
			var a;
			l[e] = K((a = u[e]) == null ? l[e] : a);
		}
		let d = n[t] = {
			...l,
			name: t,
			type: c,
			init: o.value,
			bind: o.bind,
			events: z(l.on) ? PI(l.on, "scope") : I(K(l.on))
		};
		if (P2(d) && (i++, i > 1)) {
			delete n[t];
			continue;
		}
		let f = K(o);
		for (let t of k2) t.defined(d) && t.parse && t.parse(e, d, f);
	}
	return i > 1 && X(rK), n;
}
function B2(e, t, n, r = "datum") {
	let i = z(t) ? t : t.param, a = HH(i), o = B(a + T2), s;
	try {
		s = e.getSelectionComponent(a, i);
	} catch {
		return `!!${a}`;
	}
	if (s.project.timeUnit) {
		let t = n == null ? e.component.data.raw : n, r = s.project.timeUnit.clone();
		t.parent ? r.insertAsParentOf(t) : t.parent = r;
	}
	let c = `${s.project.hasSelectionId ? "vlSelectionIdTest(" : "vlSelectionTest("}${o}, ${r}${s.resolve === "global" ? ")" : `, ${B(s.resolve)})`}`, l = `length(data(${o}))`;
	return t.empty === !1 ? `${l} && ${c}` : `!${l} || ${c}`;
}
function V2(e, t, n) {
	let r = HH(t), i = n.encoding, a = n.field, o;
	try {
		o = e.getSelectionComponent(r, t);
	} catch {
		return r;
	}
	if (!i && !a) a = o.project.items[0].field, o.project.items.length > 1 && X(aK(a));
	else if (i && !a) {
		let e = o.project.items.filter((e) => e.channel === i);
		!e.length || e.length > 1 ? (a = o.project.items[0].field, X(oK(e, i, n, a))) : a = e[0].field;
	}
	return `${o.name}[${B(ZH(a))}]`;
}
function H2(e, t) {
	var n;
	for (let [r, i] of zH((n = e.component.selection) == null ? {} : n)) {
		let n = e.getName(`lookup_${r}`);
		e.component.data.outputNodes[n] = i.materialized = new I1(new R2(t, e, { param: r }), n, M1.Lookup, e.component.data.outputNodeRefCounts);
	}
}
function U2(e, t, n) {
	return UH(t, (t) => z(t) ? t : Yq(t) ? B2(e, t, n) : sJ(t));
}
function W2(e, t) {
	if (e) return P(e) && !dG(e) ? e.map((e) => HX(e, t)).join(", ") : e;
}
function G2(e, t, n, r) {
	var i, a;
	e.encode != null || (e.encode = {}), (i = e.encode)[t] != null || (i[t] = {}), (a = e.encode[t]).update != null || (a.update = {}), e.encode[t].update[n] = r;
}
function K2(e, t, n, r = { header: !1 }) {
	let { disable: i, orient: a, scale: o, labelExpr: s, title: c, zindex: l, ...u } = e.combine();
	if (!i) {
		for (let e in u) {
			let n = e, r = cZ[n], i = u[n];
			if (r && r !== t && r !== "both") delete u[n];
			else if (oZ(i)) {
				let { condition: e, ...t } = i, r = I(e), a = aZ[n];
				if (a) {
					let { vgProp: e, part: i } = a;
					G2(u, i, e, [...r.map((e) => {
						let { test: t, ...n } = e;
						return {
							test: U2(null, t),
							...n
						};
					}), t]), delete u[n];
				} else a === null && (u[n] = { signal: r.map((e) => {
					let { test: t, ...n } = e;
					return `${U2(null, t)} ? ${TG(n)} : `;
				}).join("") + TG(t) });
			} else if (Y(i)) {
				let e = aZ[n];
				if (e) {
					let { vgProp: t, part: r } = e;
					G2(u, r, t, i), delete u[n];
				}
			}
			EH(["labelAlign", "labelBaseline"], n) && u[n] === null && delete u[n];
		}
		if (t === "grid") {
			if (!u.grid) return;
			if (u.encode) {
				let { grid: e } = u.encode;
				u.encode = { ...e ? { grid: e } : {} }, LH(u.encode) && delete u.encode;
			}
			return {
				scale: o,
				orient: a,
				...u,
				domain: !1,
				labels: !1,
				aria: !1,
				maxExtent: 0,
				minExtent: 0,
				ticks: !1,
				zindex: tU(l, 0)
			};
		} else {
			if (!r.header && e.mainExtracted) return;
			if (s !== void 0) {
				var d;
				let e = s;
				!((d = u.encode) == null || (d = d.labels) == null) && d.update && Y(u.encode.labels.update.text) && (e = QH(s, "datum.label", u.encode.labels.update.text.signal)), G2(u, "labels", "text", { signal: e });
			}
			if (u.labelAlign === null && delete u.labelAlign, u.encode) {
				for (let t of sZ) e.hasAxisPart(t) || delete u.encode[t];
				LH(u.encode) && delete u.encode;
			}
			let t = W2(c, n);
			return {
				scale: o,
				orient: a,
				grid: !1,
				...t ? { title: t } : {},
				...u,
				...n.aria === !1 ? { aria: !1 } : {},
				zindex: tU(l, 0)
			};
		}
	}
}
function q2(e) {
	let { axes: t } = e.component, n = [];
	for (let r of TW) if (t[r]) {
		for (let i of t[r]) if (!i.get("disable") && !i.get("gridScale")) {
			let t = r === "x" ? "height" : "width", i = e.getSizeSignalRef(t).signal;
			t !== i && n.push({
				name: t,
				update: i
			});
		}
	}
	return n;
}
function J2(e, t) {
	let { x: n = [], y: r = [] } = e;
	return [
		...n.map((e) => K2(e, "grid", t)),
		...r.map((e) => K2(e, "grid", t)),
		...n.map((e) => K2(e, "main", t)),
		...r.map((e) => K2(e, "main", t))
	].filter((e) => e);
}
function Y2(e, t, n, r) {
	return Object.assign.apply(null, [{}, ...e.map((e) => {
		if (e === "axisOrient") {
			let e = n === "x" ? "bottom" : "left", i = t[n === "x" ? "axisBottom" : "axisLeft"] || {}, a = t[n === "x" ? "axisTop" : "axisRight"] || {}, o = new Set([...q(i), ...q(a)]), s = {};
			for (let t of o.values()) s[t] = { signal: `${r.signal} === "${e}" ? ${EG(i[t])} : ${EG(a[t])}` };
			return s;
		}
		return t[e];
	})]);
}
function X2(e, t, n, r) {
	let i = t === "band" ? ["axisDiscrete", "axisBand"] : t === "point" ? ["axisDiscrete", "axisPoint"] : EJ(t) ? ["axisQuantitative"] : t === "time" || t === "utc" ? ["axisTemporal"] : [], a = e === "x" ? "axisX" : "axisY", o = Y(n) ? "axisOrient" : `axis${GH(n)}`, s = [...i, ...i.map((e) => a + e.substr(4))], c = [
		"axis",
		o,
		a
	];
	return {
		vlOnlyAxisConfig: Y2(s, r, e, n),
		vgAxisConfig: Y2(c, r, e, n),
		axisConfigStyle: Z2([...c, ...s], r)
	};
}
function Z2(e, t) {
	let n = [{}];
	for (let i of e) {
		var r;
		let e = (r = t[i]) == null ? void 0 : r.style;
		if (e) {
			e = I(e);
			for (let r of e) n.push(t.style[r]);
		}
	}
	return Object.assign.apply(null, n);
}
function Q2(e, t, n, r = {}) {
	let i = MG(e, n, t);
	if (i !== void 0) return {
		configFrom: "style",
		configValue: i
	};
	for (let t of [
		"vlOnlyAxisConfig",
		"vgAxisConfig",
		"axisConfigStyle"
	]) {
		var a;
		if (((a = r[t]) == null ? void 0 : a[e]) !== void 0) return {
			configFrom: t,
			configValue: r[t][e]
		};
	}
	return {};
}
var $2 = {
	scale: ({ model: e, channel: t }) => e.scaleName(t),
	format: ({ format: e }) => e,
	formatType: ({ formatType: e }) => e,
	grid: ({ fieldOrDatumDef: e, axis: t, scaleType: n }) => {
		var r;
		return (r = t.grid) == null ? e4(n, e) : r;
	},
	gridScale: ({ model: e, channel: t }) => t4(e, t),
	labelAlign: ({ axis: e, labelAngle: t, orient: n, channel: r }) => e.labelAlign || a4(t, n, r),
	labelAngle: ({ labelAngle: e }) => e,
	labelBaseline: ({ axis: e, labelAngle: t, orient: n, channel: r }) => e.labelBaseline || i4(t, n, r),
	labelFlush: ({ axis: e, fieldOrDatumDef: t, channel: n }) => {
		var r;
		return (r = e.labelFlush) == null ? o4(t.type, n) : r;
	},
	labelOverlap: ({ axis: e, fieldOrDatumDef: t, scaleType: n }) => {
		var r;
		return (r = e.labelOverlap) == null ? s4(t.type, n, Z(t) && !!t.timeUnit, Z(t) ? t.sort : void 0) : r;
	},
	orient: ({ orient: e }) => e,
	tickCount: ({ channel: e, model: t, axis: n, fieldOrDatumDef: r, scaleType: i }) => {
		var a;
		let o = e === "x" ? "width" : e === "y" ? "height" : void 0, s = o ? t.getSizeSignalRef(o) : void 0;
		return (a = n.tickCount) == null ? l4({
			fieldOrDatumDef: r,
			scaleType: i,
			size: s,
			values: n.values
		}) : a;
	},
	tickMinStep: ({ axis: e, format: t, fieldOrDatumDef: n }) => {
		var r;
		return (r = e.tickMinStep) == null ? u4({
			format: t,
			fieldOrDatumDef: n
		}) : r;
	},
	title: ({ axis: e, model: t, channel: n }) => {
		if (e.title !== void 0) return e.title;
		let r = d4(t, n);
		if (r !== void 0) return r;
		let i = t.typedFieldDef(n), a = n === "x" ? "x2" : "y2", o = t.fieldDef(a);
		return PG(i ? [cX(i)] : [], Z(o) ? [cX(o)] : []);
	},
	values: ({ axis: e, fieldOrDatumDef: t }) => f4(e, t),
	zindex: ({ axis: e, fieldOrDatumDef: t, mark: n }) => {
		var r;
		return (r = e.zindex) == null ? p4(n, t) : r;
	}
};
function e4(e, t) {
	return !AJ(e) && Z(t) && !rG(t == null ? void 0 : t.bin) && !iG(t == null ? void 0 : t.bin);
}
function t4(e, t) {
	let n = t === "x" ? "y" : "x";
	if (e.getScaleComponent(n)) return e.scaleName(n);
}
function n4(e, t, n, r, i) {
	let a = t == null ? void 0 : t.labelAngle;
	if (a !== void 0) return Y(a) ? a : sU(a);
	{
		let { configValue: a } = Q2("labelAngle", r, t == null ? void 0 : t.style, i);
		return a === void 0 ? n === hU && EH([gJ, mJ], e.type) && !(Z(e) && e.timeUnit) ? 270 : void 0 : sU(a);
	}
}
function r4(e) {
	return `(((${e.signal} % 360) + 360) % 360)`;
}
function i4(e, t, n, r) {
	if (e !== void 0) if (n === "x") {
		if (Y(e)) {
			let n = r4(e);
			return { signal: `(45 < ${n} && ${n} < 135) || (225 < ${n} && ${n} < 315) ? "middle" :(${n} <= 45 || 315 <= ${n}) === ${Y(t) ? `(${t.signal} === "top")` : t === "top"} ? "bottom" : "top"` };
		}
		if (45 < e && e < 135 || 225 < e && e < 315) return "middle";
		if (Y(t)) {
			let n = e <= 45 || 315 <= e ? "===" : "!==";
			return { signal: `${t.signal} ${n} "top" ? "bottom" : "top"` };
		}
		return (e <= 45 || 315 <= e) == (t === "top") ? "bottom" : "top";
	} else {
		if (Y(e)) {
			let n = r4(e), i = Y(t) ? `(${t.signal} === "left")` : t === "left";
			return { signal: `${n} <= 45 || 315 <= ${n} || (135 <= ${n} && ${n} <= 225) ? ${r ? "\"middle\"" : "null"} : (45 <= ${n} && ${n} <= 135) === ${i} ? "top" : "bottom"` };
		}
		if (e <= 45 || 315 <= e || 135 <= e && e <= 225) return r ? "middle" : null;
		if (Y(t)) {
			let n = 45 <= e && e <= 135 ? "===" : "!==";
			return { signal: `${t.signal} ${n} "left" ? "top" : "bottom"` };
		}
		return (45 <= e && e <= 135) == (t === "left") ? "top" : "bottom";
	}
}
function a4(e, t, n) {
	if (e === void 0) return;
	let r = n === "x", i = r ? 0 : 90, a = r ? "bottom" : "left";
	if (Y(e)) {
		let n = r4(e), o = Y(t) ? `(${t.signal} === "${a}")` : t === a;
		return { signal: `(${i ? `(${n} + 90)` : n} % 180 === 0) ? ${r ? null : "\"center\""} :(${i} < ${n} && ${n} < ${180 + i}) === ${o} ? "left" : "right"` };
	}
	if ((e + i) % 180 == 0) return r ? null : "center";
	if (Y(t)) {
		let n = i < e && e < 180 + i ? "===" : "!==";
		return { signal: `${`${t.signal} ${n} "${a}"`} ? "left" : "right"` };
	}
	return (i < e && e < 180 + i) == (t === a) ? "left" : "right";
}
function o4(e, t) {
	if (t === "x" && EH(["quantitative", "temporal"], e)) return !0;
}
function s4(e, t, n, r) {
	if (n && !F(r) || e !== "nominal" && e !== "ordinal") return t === "log" || t === "symlog" ? "greedy" : !0;
}
function c4(e) {
	return e === "x" ? "bottom" : "left";
}
function l4({ fieldOrDatumDef: e, scaleType: t, size: n, values: r }) {
	if (!r && !AJ(t) && t !== "log") {
		if (Z(e)) {
			var i;
			if (rG(e.bin)) return { signal: `ceil(${n.signal}/10)` };
			if (e.timeUnit && EH([
				"month",
				"hours",
				"day",
				"quarter"
			], (i = Uq(e.timeUnit)) == null ? void 0 : i.unit)) return;
		}
		return { signal: `ceil(${n.signal}/40)` };
	}
}
function u4({ format: e, fieldOrDatumDef: t }) {
	if (e === "d") return 1;
	if (Z(t)) {
		let { timeUnit: e } = t;
		if (e) {
			let t = Gq(e);
			if (t) return { signal: t };
		}
	}
}
function d4(e, t) {
	let n = t === "x" ? "x2" : "y2", r = e.fieldDef(t), i = e.fieldDef(n), a = r ? r.title : void 0, o = i ? i.title : void 0;
	if (a && o) return FG(a, o);
	if (a) return a;
	if (o) return o;
	if (a !== void 0) return a;
	if (o !== void 0) return o;
}
function f4(e, t) {
	let n = e.values;
	if (P(n)) return rZ(t, n);
	if (Y(n)) return n;
}
function p4(e, t) {
	return e === "rect" && jX(t) ? 1 : 0;
}
var m4 = class t extends F1 {
	clone() {
		return new t(null, K(this.transform));
	}
	constructor(t, n) {
		super(t), e(this, "transform", void 0), e(this, "_dependentFields", void 0), this.transform = n, this._dependentFields = L2(this.transform.calculate);
	}
	static parseAllForSortIndex(e, n) {
		return n.forEachFieldDef((n, r) => {
			if (TX(n) && nX(n.sort)) {
				let { field: i, timeUnit: a } = n, o = n.sort, s = o.map((e, t) => `${sJ({
					field: i,
					timeUnit: a,
					equal: e
				})} ? ${t} : `).join("") + o.length;
				e = new t(e, {
					calculate: s,
					as: h4(n, r, { forAs: !0 })
				});
			}
		}), e;
	}
	producedFields() {
		return new Set([this.transform.as]);
	}
	dependentFields() {
		return this._dependentFields;
	}
	assemble() {
		return {
			type: "formula",
			expr: this.transform.calculate,
			as: this.transform.as
		};
	}
	hash() {
		return `Calculate ${wH(this.transform)}`;
	}
};
function h4(e, t, n) {
	return $(e, {
		prefix: t,
		suffix: "sort_index",
		...n
	});
}
function g4(e, t) {
	return EH(["top", "bottom"], t) ? "column" : EH(["left", "right"], t) || e === "row" ? "row" : "column";
}
function _4(e, t, n, r) {
	let i = r === "row" ? n.headerRow : r === "column" ? n.headerColumn : n.headerFacet;
	return tU((t || {})[e], i[e], n.header[e]);
}
function v4(e, t, n, r) {
	let i = {};
	for (let a of e) {
		let e = _4(a, t || {}, n, r);
		e !== void 0 && (i[a] = e);
	}
	return i;
}
var y4 = ["row", "column"], b4 = ["header", "footer"];
function x4(e, t) {
	let n = e.component.layoutHeaders[t].title, r = e.config ? e.config : void 0, i = e.component.layoutHeaders[t].facetFieldDef ? e.component.layoutHeaders[t].facetFieldDef : void 0, { titleAnchor: a, titleAngle: o, titleOrient: s } = v4([
		"titleAnchor",
		"titleAngle",
		"titleOrient"
	], i.header, r, t), c = g4(t, s), l = sU(o);
	return {
		name: `${t}-title`,
		type: "group",
		role: `${c}-title`,
		title: {
			text: n,
			...t === "row" ? { orient: "left" } : {},
			style: "guide-title",
			...C4(l, c),
			...S4(c, l, a),
			...j4(r, i, t, lQ, sQ)
		}
	};
}
function S4(e, t, n = "middle") {
	switch (n) {
		case "start": return { align: "left" };
		case "end": return { align: "right" };
	}
	let r = a4(t, e === "row" ? "left" : "top", e === "row" ? "y" : "x");
	return r ? { align: r } : {};
}
function C4(e, t) {
	let n = i4(e, t === "row" ? "left" : "top", t === "row" ? "y" : "x", !0);
	return n ? { baseline: n } : {};
}
function w4(e, t) {
	let n = e.component.layoutHeaders[t], r = [];
	for (let i of b4) if (n[i]) for (let a of n[i]) {
		let o = D4(e, t, i, n, a);
		o != null && r.push(o);
	}
	return r;
}
function T4(e, t) {
	let { sort: n } = e;
	if (tX(n)) {
		var r;
		return {
			field: $(n, { expr: "datum" }),
			order: (r = n.order) == null ? "ascending" : r
		};
	} else if (P(n)) return {
		field: h4(e, t, { expr: "datum" }),
		order: "ascending"
	};
	else return {
		field: $(e, { expr: "datum" }),
		order: n == null ? "ascending" : n
	};
}
function E4(e, t, n) {
	let { format: r, formatType: i, labelAngle: a, labelAnchor: o, labelOrient: s, labelExpr: c } = v4([
		"format",
		"formatType",
		"labelAngle",
		"labelAnchor",
		"labelOrient",
		"labelExpr"
	], e.header, n, t), l = BY({
		fieldOrDatumDef: e,
		format: r,
		formatType: i,
		expr: "parent",
		config: n
	}).signal, u = g4(t, s);
	return {
		text: { signal: c ? QH(QH(c, "datum.label", l), "datum.value", $(e, { expr: "parent" })) : l },
		...t === "row" ? { orient: "left" } : {},
		style: "guide-label",
		frame: "group",
		...C4(a, u),
		...S4(u, a, o),
		...j4(n, e, t, uQ, cQ)
	};
}
function D4(e, t, n, r, i) {
	if (i) {
		let a = null, { facetFieldDef: o } = r, s = e.config ? e.config : void 0;
		if (o && i.labels) {
			let { labelOrient: e } = v4(["labelOrient"], o.header, s, t);
			(t === "row" && !EH(["top", "bottom"], e) || t === "column" && !EH(["left", "right"], e)) && (a = E4(o, t, s));
		}
		let c = V8(e) && !rX(e.facet), l = i.axes, u = (l == null ? void 0 : l.length) > 0;
		if (a || u) {
			let s = t === "row" ? "height" : "width";
			return {
				name: e.getName(`${t}_${n}`),
				type: "group",
				role: `${t}-${n}`,
				...r.facetFieldDef ? {
					from: { data: e.getName(`${t}_domain`) },
					sort: T4(o, t)
				} : {},
				...u && c ? { from: { data: e.getName(`facet_domain_${t}`) } } : {},
				...a ? { title: a } : {},
				...i.sizeSignal ? { encode: { update: { [s]: i.sizeSignal } } } : {},
				...u ? { axes: l } : {}
			};
		}
	}
	return null;
}
var O4 = {
	column: {
		start: 0,
		end: 1
	},
	row: {
		start: 1,
		end: 0
	}
};
function k4(e, t) {
	return O4[t][e];
}
function A4(e, t) {
	let n = {};
	for (let r of aW) {
		let i = e[r];
		if (i != null && i.facetFieldDef) {
			let { titleAnchor: e, titleOrient: a } = v4(["titleAnchor", "titleOrient"], i.facetFieldDef.header, t, r), o = g4(r, a), s = k4(e, o);
			s !== void 0 && (n[o] = s);
		}
	}
	return LH(n) ? void 0 : n;
}
function j4(e, t, n, r, i) {
	let a = {};
	for (let o of r) {
		if (!i[o]) continue;
		let r = _4(o, t == null ? void 0 : t.header, e, n);
		r !== void 0 && (a[i[o]] = r);
	}
	return a;
}
function M4(e) {
	return [
		...N4(e, "width"),
		...N4(e, "height"),
		...N4(e, "childWidth"),
		...N4(e, "childHeight")
	];
}
function N4(e, t) {
	let n = t === "width" ? "x" : "y", r = e.component.layoutSize.get(t);
	if (r == null || r === "merged") return [];
	let i = e.getSizeSignalRef(t).signal;
	if (r === "step") {
		let t = e.getScaleComponent(n);
		if (t) {
			let r = t.get("type"), a = t.get("range");
			if (AJ(r) && fG(a)) {
				let r = e.scaleName(n);
				return V8(e.parent) && e.parent.component.resolve.scale[n] === "independent" ? [P4(r, a)] : [P4(r, a), {
					name: i,
					update: F4(r, t, `domain('${r}').length`)
				}];
			}
		}
		/* istanbul ignore next: Condition should not happen -- only for warning in development. */
		throw Error("layout size is step although width/height is not step.");
	} else if (r == "container") {
		let t = i.endsWith("width"), n = t ? "containerSize()[0]" : "containerSize()[1]", r = `isFinite(${n}) ? ${n} : ${jQ(e.config.view, t ? "width" : "height")}`;
		return [{
			name: i,
			init: r,
			on: [{
				update: r,
				events: "window:resize"
			}]
		}];
	} else return [{
		name: i,
		value: r
	}];
}
function P4(e, t) {
	let n = `${e}_step`;
	return Y(t.step) ? {
		name: n,
		update: t.step.signal
	} : {
		name: n,
		value: t.step
	};
}
function F4(e, t, n) {
	let r = t.get("type"), i = t.get("padding"), a = tU(t.get("paddingOuter"), i), o = t.get("paddingInner");
	return o = r === "band" ? o === void 0 ? i : o : 1, `bandspace(${n}, ${EG(o)}, ${EG(a)}) * ${e}_step`;
}
function I4(e) {
	return e === "childWidth" ? "width" : e === "childHeight" ? "height" : e;
}
function L4(e, t) {
	return q(e).reduce((n, r) => ({
		...n,
		...T0({
			model: t,
			channelDef: e[r],
			vgChannel: r,
			mainRefFn: (e) => CG(e.value),
			invalidValueRef: void 0
		})
	}), {});
}
function R4(e, t) {
	if (V8(t)) return e === "theta" ? "independent" : "shared";
	if (U8(t)) return "shared";
	if (H8(t)) return EW(e) || e === "theta" || e === "radius" ? "independent" : "shared";
	/* istanbul ignore next: should never reach here. */
	throw Error("invalid model type for resolve");
}
function z4(e, t) {
	let n = e.scale[t], r = EW(t) ? "axis" : "legend";
	return n === "independent" ? (e[r][t] === "shared" && X(KK(t)), "independent") : e[r][t] || "shared";
}
var B4 = q({
	...mQ,
	disable: 1,
	labelExpr: 1,
	selections: 1,
	opacity: 1,
	shape: 1,
	stroke: 1,
	fill: 1,
	size: 1,
	strokeWidth: 1,
	strokeDash: 1,
	encode: 1
}), V4 = class extends v1 {}, H4 = {
	symbols: U4,
	gradient: W4,
	labels: G4,
	entries: K4
};
function U4(e, { fieldOrDatumDef: t, model: n, channel: r, legendCmpt: i, legendType: a }) {
	var o, s, c, l;
	if (a !== "symbol") return;
	let { markDef: u, encoding: d, config: f, mark: p } = n, m = u.filled && p !== "trail", h = {
		...DG({}, n, pY),
		...I0(n, { filled: m })
	}, g = (o = i.get("symbolOpacity")) == null ? f.legend.symbolOpacity : o, _ = (s = i.get("symbolFillColor")) == null ? f.legend.symbolFillColor : s, v = (c = i.get("symbolStrokeColor")) == null ? f.legend.symbolStrokeColor : c, y = g === void 0 ? (l = q4(d.opacity)) == null ? u.opacity : l : void 0;
	if (h.fill) {
		if (r === "fill" || m && r === AU) delete h.fill;
		else if (J(h.fill, "field")) if (_) delete h.fill;
		else {
			var b;
			h.fill = CG((b = f.legend.symbolBaseFillColor) == null ? "black" : b), h.fillOpacity = CG(y == null ? 1 : y);
		}
		else if (P(h.fill)) {
			var x, S, C;
			let e = (x = (S = J4((C = d.fill) == null ? d.color : C)) == null ? u.fill : S) == null ? m && u.color : x;
			e && (h.fill = CG(e));
		}
	}
	if (h.stroke) {
		if (r === "stroke" || !m && r === AU) delete h.stroke;
		else if (J(h.stroke, "field") || v) delete h.stroke;
		else if (P(h.stroke)) {
			let e = tU(J4(d.stroke || d.color), u.stroke, m ? u.color : void 0);
			e && (h.stroke = { value: e });
		}
	}
	if (r !== IU) {
		let e = Z(t) && X4(n, i, t);
		e ? h.opacity = [{
			test: e,
			...CG(y == null ? 1 : y)
		}, CG(f.legend.unselectedOpacity)] : y && (h.opacity = CG(y));
	}
	return h = {
		...h,
		...e
	}, LH(h) ? void 0 : h;
}
function W4(e, { model: t, legendType: n, legendCmpt: r }) {
	var i;
	if (n !== "gradient") return;
	let { config: a, markDef: o, encoding: s } = t, c = {}, l = ((i = r.get("gradientOpacity")) == null ? a.legend.gradientOpacity : i) === void 0 ? q4(s.opacity) || o.opacity : void 0;
	return l && (c.opacity = CG(l)), c = {
		...c,
		...e
	}, LH(c) ? void 0 : c;
}
function G4(e, { fieldOrDatumDef: t, model: n, channel: r, legendCmpt: i }) {
	let a = n.legend(r) || {}, o = n.config, s = Z(t) ? X4(n, i, t) : void 0, c = s ? [{
		test: s,
		value: 1
	}, { value: o.legend.unselectedOpacity }] : void 0, { format: l, formatType: u } = a, d;
	RY(u) ? d = HY({
		fieldOrDatumDef: t,
		field: "datum.value",
		format: l,
		formatType: u,
		config: o
	}) : l === void 0 && u === void 0 && o.customFormatTypes && (t.type === "quantitative" && o.numberFormatType ? d = HY({
		fieldOrDatumDef: t,
		field: "datum.value",
		format: o.numberFormat,
		formatType: o.numberFormatType,
		config: o
	}) : t.type === "temporal" && o.timeFormatType && Z(t) && t.timeUnit === void 0 && (d = HY({
		fieldOrDatumDef: t,
		field: "datum.value",
		format: o.timeFormat,
		formatType: o.timeFormatType,
		config: o
	})));
	let f = {
		...c ? { opacity: c } : {},
		...d ? { text: d } : {},
		...e
	};
	return LH(f) ? void 0 : f;
}
function K4(e, { legendCmpt: t }) {
	let n = t.get("selections");
	return n != null && n.length ? {
		...e,
		fill: { value: "transparent" }
	} : e;
}
function q4(e) {
	return Y4(e, (e, t) => Math.max(e, t.value));
}
function J4(e) {
	return Y4(e, (e, t) => tU(e, t.value));
}
function Y4(e, t) {
	if (_X(e)) return I(e.condition).reduce(t, e.value);
	if (wX(e)) return e.value;
}
function X4(e, t, n) {
	let r = t.get("selections");
	if (!(r != null && r.length)) return;
	let i = B(n.field);
	return r.map((e) => `(!length(data(${B(HH(e) + T2)})) || (${e}[${i}] && indexof(${e}[${i}], datum.value) >= 0))`).join(" || ");
}
var Z4 = {
	direction: ({ direction: e }) => e,
	format: ({ fieldOrDatumDef: e, legend: t, config: n }) => {
		let { format: r, formatType: i } = t;
		return UY(e, e.type, r, i, n, !1);
	},
	formatType: ({ legend: e, fieldOrDatumDef: t, scaleType: n }) => {
		let { formatType: r } = e;
		return WY(r, t, n);
	},
	gradientLength: (e) => {
		var t, n;
		let { legend: r, legendConfig: i } = e;
		return (t = (n = r.gradientLength) == null ? i.gradientLength : n) == null ? i3(e) : t;
	},
	labelOverlap: ({ legend: e, legendConfig: t, scaleType: n }) => {
		var r, i;
		return (r = (i = e.labelOverlap) == null ? t.labelOverlap : i) == null ? o3(n) : r;
	},
	symbolType: ({ legend: e, markDef: t, channel: n, encoding: r }) => {
		var i;
		return (i = e.symbolType) == null ? $4(t.type, n, r.shape, t.shape) : i;
	},
	title: ({ fieldOrDatumDef: e, config: t }) => BX(e, t, { allowDisabling: !0 }),
	type: ({ legendType: e, scaleType: t, channel: n }) => {
		if (rW(n) && MJ(t)) {
			if (e === "gradient") return;
		} else if (e === "symbol") return;
		return e;
	},
	values: ({ fieldOrDatumDef: e, legend: t }) => Q4(t, e)
};
function Q4(e, t) {
	let n = e.values;
	if (P(n)) return rZ(t, n);
	if (Y(n)) return n;
}
function $4(e, t, n, r) {
	if (t !== "shape") {
		var i;
		let e = (i = J4(n)) == null ? r : i;
		if (e) return e;
	}
	switch (e) {
		case "bar":
		case "rect":
		case "image":
		case "square": return "square";
		case "line":
		case "trail":
		case "rule": return "stroke";
		case "arc":
		case "point":
		case "circle":
		case "tick":
		case "geoshape":
		case "area":
		case "text": return "circle";
	}
}
function e3(e) {
	let { legend: t } = e;
	return tU(t.type, t3(e));
}
function t3({ channel: e, timeUnit: t, scaleType: n }) {
	if (rW(e)) {
		if (EH([
			"quarter",
			"month",
			"day"
		], t)) return "symbol";
		if (MJ(n)) return "gradient";
	}
	return "symbol";
}
function n3({ legendConfig: e, legendType: t, orient: n, legend: r }) {
	var i, a;
	return (i = (a = r.direction) == null ? e[t ? "gradientDirection" : "symbolDirection"] : a) == null ? r3(n, t) : i;
}
function r3(e, t) {
	switch (e) {
		case "top":
		case "bottom": return "horizontal";
		case "left":
		case "right":
		case "none":
		case void 0: return;
		default: return t === "gradient" ? "horizontal" : void 0;
	}
}
function i3({ legendConfig: e, model: t, direction: n, orient: r, scaleType: i }) {
	let { gradientHorizontalMaxLength: a, gradientHorizontalMinLength: o, gradientVerticalMaxLength: s, gradientVerticalMinLength: c } = e;
	if (MJ(i)) return n === "horizontal" ? r === "top" || r === "bottom" ? a3(t, "width", o, a) : o : a3(t, "height", c, s);
}
function a3(e, t, n, r) {
	return { signal: `clamp(${e.getSizeSignalRef(t).signal}, ${n}, ${r})` };
}
function o3(e) {
	if (EH([
		"quantile",
		"threshold",
		"log",
		"symlog"
	], e)) return "greedy";
}
function s3(e) {
	let t = B8(e) ? c3(e) : f3(e);
	return e.component.legends = t, t;
}
function c3(e) {
	let { encoding: t } = e, n = {};
	for (let r of [AU, ...fQ]) {
		let i = KX(t[r]);
		!i || !e.getScaleComponent(r) || r === NU && Z(i) && i.type === _J || (n[r] = d3(e, r));
	}
	return n;
}
function l3(e, t) {
	let n = e.scaleName(t);
	if (e.mark === "trail") {
		if (t === "color") return { stroke: n };
		if (t === "size") return { strokeWidth: n };
	}
	return t === "color" ? e.markDef.filled ? { fill: n } : { stroke: n } : { [t]: n };
}
function u3(e, t, n, r) {
	switch (t) {
		case "disable": return n !== void 0;
		case "values": return !!(n != null && n.values);
		case "title": if (t === "title" && e === (r == null ? void 0 : r.title)) return !0;
	}
	return e === (n || {})[t];
}
function d3(e, t) {
	var n, r;
	let i = e.legend(t), { markDef: a, encoding: o, config: s } = e, c = s.legend, l = new V4({}, l3(e, t));
	g2(e, t, l);
	let u = i === void 0 ? c.disable : !i;
	if (l.set("disable", u, i !== void 0), u) return l;
	i = i || {};
	let d = e.getScaleComponent(t).get("type"), f = KX(o[t]), p = Z(f) ? (n = Uq(f.timeUnit)) == null ? void 0 : n.unit : void 0, m = i.orient || s.legend.orient || "right", h = e3({
		legend: i,
		channel: t,
		timeUnit: p,
		scaleType: d
	}), g = n3({
		legend: i,
		legendType: h,
		orient: m,
		legendConfig: c
	}), _ = {
		legend: i,
		channel: t,
		model: e,
		markDef: a,
		encoding: o,
		fieldOrDatumDef: f,
		legendConfig: c,
		config: s,
		scaleType: d,
		orient: m,
		legendType: h,
		direction: g
	};
	for (let n of B4) {
		if (h === "gradient" && n.startsWith("symbol") || h === "symbol" && n.startsWith("gradient")) continue;
		let r = n in Z4 ? Z4[n](_) : i[n];
		if (r !== void 0) {
			let a = u3(r, n, i, e.fieldDef(t));
			(a || s.legend[n] === void 0) && l.set(n, r, a);
		}
	}
	let v = (r = i == null ? void 0 : i.encoding) == null ? {} : r, y = l.get("selections"), b = {}, x = {
		fieldOrDatumDef: f,
		model: e,
		channel: t,
		legendCmpt: l,
		legendType: h
	};
	for (let t of [
		"labels",
		"legend",
		"title",
		"symbols",
		"gradient",
		"entries"
	]) {
		var S;
		let n = L4((S = v[t]) == null ? {} : S, e), r = t in H4 ? H4[t](n, x) : n;
		r !== void 0 && !LH(r) && (b[t] = {
			...y != null && y.length && Z(f) ? { name: `${HH(f.field)}_legend_${t}` } : {},
			...y != null && y.length ? { interactive: !0 } : {},
			update: y != null && y.length ? {
				...r,
				cursor: { value: "pointer" }
			} : r
		});
	}
	return LH(b) || l.set("encode", b, !!(i != null && i.encoding)), l;
}
function f3(e) {
	let { legends: t, resolve: n } = e.component;
	for (let r of e.children) {
		s3(r);
		for (let i of q(r.component.legends)) n.legend[i] = z4(e.component.resolve, i), n.legend[i] === "shared" && (t[i] = p3(t[i], r.component.legends[i]), t[i] || (n.legend[i] = "independent", delete t[i]));
	}
	for (let r of q(t)) for (let t of e.children) t.component.legends[r] && n.legend[r] === "shared" && delete t.component.legends[r];
	return t;
}
function p3(e, t) {
	if (!e) return t.clone();
	let n = e.getWithExplicit("orient"), r = t.getWithExplicit("orient");
	if (n.explicit && r.explicit && n.value !== r.value) return;
	let i = !1;
	for (let n of B4) {
		let r = C1(e.getWithExplicit(n), t.getWithExplicit(n), n, "legend", (e, t) => {
			switch (n) {
				case "symbolType": return m3(e, t);
				case "title": return IG(e, t);
				case "type": return i = !0, b1("symbol");
			}
			return S1(e, t, n, "legend");
		});
		e.setWithExplicit(n, r);
	}
	if (i) {
		var a, o;
		!((a = e.implicit) == null || (a = a.encode) == null) && a.gradient && WH(e.implicit, ["encode", "gradient"]), !((o = e.explicit) == null || (o = o.encode) == null) && o.gradient && WH(e.explicit, ["encode", "gradient"]);
	}
	return e;
}
function m3(e, t) {
	return t.value === "circle" ? t : e;
}
function h3(e, t, n, r) {
	if (iZ(t, n)) {
		var i, a;
		let o = B8(e) ? (i = (a = e.axis(n)) == null ? e.legend(n) : a) == null ? {} : i : {}, s = $(t, { expr: "datum" }), c = $(t, {
			expr: "datum",
			binSuffix: "end"
		});
		return {
			formulaAs: $(t, {
				binSuffix: "range",
				forAs: !0
			}),
			formula: YY(s, c, o.format, o.formatType, r)
		};
	}
	return {};
}
function g3(e, t) {
	return `${nG(e)}_${t}`;
}
function _3(e, t) {
	return {
		signal: e.getName(`${t}_bins`),
		extentSignal: e.getName(`${t}_extent`)
	};
}
function v3(e, t, n) {
	var r;
	let i = g3((r = ZX(n, void 0)) == null ? {} : r, t);
	return e.getName(`${i}_bins`);
}
function y3(e) {
	return "as" in e;
}
function b3(e, t, n) {
	let r, i;
	r = y3(e) ? z(e.as) ? [e.as, `${e.as}_end`] : [e.as[0], e.as[1]] : [$(e, { forAs: !0 }), $(e, {
		binSuffix: "end",
		forAs: !0
	})];
	let a = { ...ZX(t, void 0) }, o = g3(a, e.field), { signal: s, extentSignal: c } = _3(n, o);
	if (oG(a.extent)) {
		let e = a.extent;
		i = V2(n, e.param, e), delete a.extent;
	}
	return {
		key: o,
		binComponent: {
			bin: a,
			field: e.field,
			as: [r],
			...s ? { signal: s } : {},
			...c ? { extentSignal: c } : {},
			...i ? { span: i } : {}
		}
	};
}
var x3 = class t extends F1 {
	clone() {
		return new t(null, K(this.bins));
	}
	constructor(t, n) {
		super(t), e(this, "bins", void 0), this.bins = n;
	}
	static makeFromEncoding(e, n) {
		let r = n.reduceFieldDef((e, t, r) => {
			if (CX(t) && rG(t.bin)) {
				let { key: i, binComponent: a } = b3(t, t.bin, n);
				e[i] = {
					...a,
					...e[i],
					...h3(n, t, r, n.config)
				};
			}
			return e;
		}, {});
		return LH(r) ? null : new t(e, r);
	}
	static makeFromTransform(e, n, r) {
		let { key: i, binComponent: a } = b3(n, n.bin, r);
		return new t(e, { [i]: a });
	}
	merge(e, t) {
		for (let n of q(e.bins)) n in this.bins ? (t(e.bins[n].signal, this.bins[n].signal), this.bins[n].as = jH([...this.bins[n].as, ...e.bins[n].as], wH)) : this.bins[n] = e.bins[n];
		for (let t of e.children) e.removeChild(t), t.parent = this;
		e.remove();
	}
	producedFields() {
		return new Set(RH(this.bins).map((e) => e.as).flat(2));
	}
	dependentFields() {
		return new Set(RH(this.bins).map((e) => e.field));
	}
	hash() {
		return `Bin ${wH(this.bins)}`;
	}
	assemble() {
		return RH(this.bins).flatMap((e) => {
			let t = [], [n, ...r] = e.as, { extent: i, ...a } = e.bin, o = {
				type: "bin",
				field: ZH(e.field),
				as: n,
				signal: e.signal,
				...oG(i) ? { extent: null } : { extent: i },
				...e.span ? { span: { signal: `span(${e.span})` } } : {},
				...a
			};
			!i && e.extentSignal && (t.push({
				type: "extent",
				field: ZH(e.field),
				signal: e.extentSignal
			}), o.extent = { signal: e.extentSignal }), t.push(o);
			for (let e of r) for (let r = 0; r < 2; r++) t.push({
				type: "formula",
				expr: $({ field: n[r] }, { expr: "datum" }),
				as: e[r]
			});
			return e.formula && t.push({
				type: "formula",
				expr: e.formula,
				as: e.formulaAs
			}), t;
		});
	}
};
function S3(e, t, n, r) {
	var i;
	let a = B8(r) ? r.encoding[gW(t)] : void 0;
	if (CX(n) && B8(r) && fX(n, a, r.markDef, r.config)) {
		e.add($(n, {})), e.add($(n, { suffix: "end" }));
		let { mark: i, markDef: a, config: o } = r, s = uX({
			fieldDef: n,
			markDef: a,
			config: o
		});
		cY(i) && s !== .5 && EW(t) && (e.add($(n, { suffix: B1 })), e.add($(n, { suffix: V1 }))), n.bin && iZ(n, t) && e.add($(n, { binSuffix: "range" }));
	} else if (eW(t)) {
		let n = $U(t);
		e.add(r.getName(n));
	} else e.add($(n));
	return TX(n) && RJ((i = n.scale) == null ? void 0 : i.range) && e.add(n.scale.range.field), e;
}
function C3(e, t) {
	for (let r of q(t)) {
		let i = t[r];
		for (let t of q(i)) if (r in e) {
			var n;
			e[r][t] = new Set([...(n = e[r][t]) == null ? [] : n, ...i[t]]);
		} else e[r] = { [t]: i[t] };
	}
}
var w3 = class t extends F1 {
	clone() {
		return new t(null, new Set(this.dimensions), K(this.measures));
	}
	constructor(t, n, r) {
		super(t), e(this, "dimensions", void 0), e(this, "measures", void 0), this.dimensions = n, this.measures = r;
	}
	get groupBy() {
		return this.dimensions;
	}
	static makeFromEncoding(e, n) {
		let r = !1;
		n.forEachFieldDef((e) => {
			e.aggregate && (r = !0);
		});
		let i = {}, a = /* @__PURE__ */ new Set();
		return !r || (n.forEachFieldDef((e, t) => {
			let { aggregate: r, field: o } = e;
			if (r) if (r === "count") i["*"] != null || (i["*"] = {}), i["*"].count = new Set([$(e, { forAs: !0 })]);
			else {
				if (JW(r) || YW(r)) {
					let e = JW(r) ? "argmin" : "argmax", t = r[e];
					i[t] != null || (i[t] = {}), i[t][e] = new Set([$({
						op: e,
						field: t
					}, { forAs: !0 })]);
				} else i[o] != null || (i[o] = {}), i[o][r] = new Set([$(e, { forAs: !0 })]);
				BW(t) && n.scaleDomain(t) === "unaggregated" && (i[o] != null || (i[o] = {}), i[o].min = new Set([$({
					field: o,
					aggregate: "min"
				}, { forAs: !0 })]), i[o].max = new Set([$({
					field: o,
					aggregate: "max"
				}, { forAs: !0 })]));
			}
			else S3(a, t, e, n);
		}), a.size + q(i).length === 0) ? null : new t(e, a, i);
	}
	static makeFromTransform(e, n) {
		var r;
		let i = /* @__PURE__ */ new Set(), a = {};
		for (let e of n.aggregate) {
			let { op: t, field: n, as: r } = e;
			if (t) if (t === "count") a["*"] != null || (a["*"] = {}), a["*"].count = new Set([r || $(e, { forAs: !0 })]);
			else {
				var o;
				a[n] != null || (a[n] = {}), (o = a[n])[t] != null || (o[t] = /* @__PURE__ */ new Set()), a[n][t].add(r || $(e, { forAs: !0 }));
			}
		}
		for (let e of (r = n.groupby) == null ? [] : r) i.add(e);
		return i.size + q(a).length === 0 ? null : new t(e, i, a);
	}
	merge(e) {
		return NH(this.dimensions, e.dimensions) ? (C3(this.measures, e.measures), !0) : (gq("different dimensions, cannot merge"), !1);
	}
	addDimensions(e) {
		e.forEach(this.dimensions.add, this.dimensions);
	}
	dependentFields() {
		return new Set([...this.dimensions, ...q(this.measures)]);
	}
	producedFields() {
		let e = /* @__PURE__ */ new Set();
		for (let t of q(this.measures)) for (let n of q(this.measures[t])) {
			let r = this.measures[t][n];
			r.size === 0 ? e.add(`${n}_${t}`) : r.forEach(e.add, e);
		}
		return e;
	}
	hash() {
		return `Aggregate ${wH({
			dimensions: this.dimensions,
			measures: this.measures
		})}`;
	}
	assemble() {
		let e = [], t = [], n = [];
		for (let r of q(this.measures)) for (let i of q(this.measures[r])) for (let a of this.measures[r][i]) n.push(a), e.push(i), t.push(r === "*" ? null : ZH(r));
		return {
			type: "aggregate",
			groupby: [...this.dimensions].map(ZH),
			ops: e,
			fields: t,
			as: n
		};
	}
}, T3 = class extends F1 {
	constructor(t, n, r, i) {
		super(t), e(this, "model", void 0), e(this, "name", void 0), e(this, "data", void 0), e(this, "column", void 0), e(this, "row", void 0), e(this, "facet", void 0), e(this, "childModel", void 0), this.model = n, this.name = r, this.data = i;
		for (let e of aW) {
			let t = n.facet[e];
			if (t) {
				let { bin: r, sort: i } = t;
				this[e] = {
					name: n.getName(`${e}_domain`),
					fields: [$(t), ...rG(r) ? [$(t, { binSuffix: "end" })] : []],
					...tX(i) ? { sortField: i } : P(i) ? { sortIndexField: h4(t, e) } : {}
				};
			}
		}
		this.childModel = n.child;
	}
	hash() {
		let e = "Facet";
		for (let t of aW) this[t] && (e += ` ${t.charAt(0)}:${wH(this[t])}`);
		return e;
	}
	get fields() {
		let e = [];
		for (let n of aW) {
			var t;
			(t = this[n]) != null && t.fields && e.push(...this[n].fields);
		}
		return e;
	}
	dependentFields() {
		let e = new Set(this.fields);
		for (let t of aW) this[t] && (this[t].sortField && e.add(this[t].sortField.field), this[t].sortIndexField && e.add(this[t].sortIndexField));
		return e;
	}
	producedFields() {
		return /* @__PURE__ */ new Set();
	}
	getSource() {
		return this.name;
	}
	getChildIndependentFieldsWithStep() {
		let e = {};
		for (let t of TW) {
			let n = this.childModel.component.scales[t];
			if (n && !n.merged) {
				let r = n.get("type"), i = n.get("range");
				if (AJ(r) && fG(i)) {
					let n = k6(A6(this.childModel, t));
					n ? e[t] = n : X(HG(t));
				}
			}
		}
		return e;
	}
	assembleRowColumnHeaderData(e, t, n) {
		let r = {
			row: "y",
			column: "x",
			facet: void 0
		}[e], i = [], a = [], o = [];
		r && n && n[r] && (t ? (i.push(`distinct_${n[r]}`), a.push("max")) : (i.push(n[r]), a.push("distinct")), o.push(`distinct_${n[r]}`));
		let { sortField: s, sortIndexField: c } = this[e];
		if (s) {
			let { op: e = ZY, field: t } = s;
			i.push(t), a.push(e), o.push($(s, { forAs: !0 }));
		} else c && (i.push(c), a.push("max"), o.push(c));
		return {
			name: this[e].name,
			source: t == null ? this.data : t,
			transform: [{
				type: "aggregate",
				groupby: this[e].fields,
				...i.length ? {
					fields: i,
					ops: a,
					as: o
				} : {}
			}]
		};
	}
	assembleFacetHeaderData(e) {
		let { columns: t } = this.model.layout, { layoutHeaders: n } = this.model.component, r = [], i = {};
		for (let e of y4) {
			for (let t of b4) {
				var a, o;
				let r = (a = (o = n[e]) == null ? void 0 : o[t]) == null ? [] : a;
				for (let t of r) {
					var s;
					if (((s = t.axes) == null ? void 0 : s.length) > 0) {
						i[e] = !0;
						break;
					}
				}
			}
			if (i[e]) {
				let n = `length(data("${this.facet.name}"))`, i = e === "row" ? t ? { signal: `ceil(${n} / ${t})` } : 1 : t ? { signal: `min(${n}, ${t})` } : { signal: n };
				r.push({
					name: `${this.facet.name}_${e}`,
					transform: [{
						type: "sequence",
						start: 0,
						stop: i
					}]
				});
			}
		}
		let { row: c, column: l } = i;
		return (c || l) && r.unshift(this.assembleRowColumnHeaderData("facet", null, e)), r;
	}
	assemble() {
		let e = [], t = null, n = this.getChildIndependentFieldsWithStep(), { column: r, row: i, facet: a } = this;
		if (r && i && (n.x || n.y)) {
			var o, s;
			t = `cross_${this.column.name}_${this.row.name}`;
			let r = [].concat((o = n.x) == null ? [] : o, (s = n.y) == null ? [] : s), i = r.map(() => "distinct");
			e.push({
				name: t,
				source: this.data,
				transform: [{
					type: "aggregate",
					groupby: this.fields,
					fields: r,
					ops: i
				}]
			});
		}
		for (let r of [pU, fU]) this[r] && e.push(this.assembleRowColumnHeaderData(r, t, n));
		if (a) {
			let t = this.assembleFacetHeaderData(n);
			t && e.push(...t);
		}
		return e;
	}
};
function E3(e) {
	return e.startsWith("'") && e.endsWith("'") || e.startsWith("\"") && e.endsWith("\"") ? e.slice(1, -1) : e;
}
function D3(e, t) {
	let n = KH(e);
	return t === "number" ? `toNumber(${n})` : t === "boolean" ? `toBoolean(${n})` : t === "string" ? `toString(${n})` : t === "date" ? `toDate(${n})` : t === "flatten" ? n : t.startsWith("date:") ? `timeParse(${n},'${E3(t.slice(5, t.length))}')` : t.startsWith("utc:") ? `utcParse(${n},'${E3(t.slice(4, t.length))}')` : (X(cK(t)), null);
}
function O3(e) {
	let t = {};
	return yH(e.filter, (e) => {
		if (iJ(e)) {
			let r = null;
			if (Xq(e)) r = xG(e.equal);
			else if (Qq(e)) r = xG(e.lte);
			else if (Zq(e)) r = xG(e.lt);
			else if ($q(e)) r = xG(e.gt);
			else if (eJ(e)) r = xG(e.gte);
			else if (tJ(e)) r = e.range[0];
			else if (nJ(e)) {
				var n;
				r = ((n = e.oneOf) == null ? e.in : n)[0];
			}
			r && (_q(r) ? t[e.field] = "date" : rd(r) ? t[e.field] = "number" : z(r) && (t[e.field] = "string")), e.timeUnit && (t[e.field] = "date");
		}
	}), t;
}
function k3(e) {
	let t = {};
	function n(e) {
		eZ(e) ? t[e.field] = "date" : e.type === "quantitative" && $W(e.aggregate) ? t[e.field] = "number" : eU(e.field) > 1 ? e.field in t || (t[e.field] = "flatten") : TX(e) && tX(e.sort) && eU(e.sort.field) > 1 && (e.sort.field in t || (t[e.sort.field] = "flatten"));
	}
	if ((B8(e) || V8(e)) && e.forEachFieldDef((t, r) => {
		if (CX(t)) n(t);
		else {
			let i = mW(r), a = e.fieldDef(i);
			n({
				...t,
				type: a.type
			});
		}
	}), B8(e)) {
		let { mark: n, markDef: r, encoding: i } = e;
		if (sY(n) && !e.encoding.order) {
			let e = i[r.orient === "horizontal" ? "y" : "x"];
			Z(e) && e.type === "quantitative" && !(e.field in t) && (t[e.field] = "number");
		}
	}
	return t;
}
function A3(e) {
	let t = {};
	if (B8(e) && e.component.selection) for (let n of q(e.component.selection)) {
		let r = e.component.selection[n];
		for (let e of r.project.items) !e.channel && eU(e.field) > 1 && (t[e.field] = "flatten");
	}
	return t;
}
var j3 = class t extends F1 {
	clone() {
		return new t(null, K(this._parse));
	}
	constructor(t, n) {
		super(t), e(this, "_parse", void 0), this._parse = n;
	}
	hash() {
		return `Parse ${wH(this._parse)}`;
	}
	static makeExplicit(e, t, n) {
		var r;
		let i = {}, a = t.data;
		return !O1(a) && !(a == null || (r = a.format) == null) && r.parse && (i = a.format.parse), this.makeWithAncestors(e, i, {}, n);
	}
	static makeWithAncestors(e, n, r, i) {
		for (let e of q(r)) {
			let t = i.getWithExplicit(e);
			t.value !== void 0 && (t.explicit || t.value === r[e] || t.value === "derived" || r[e] === "flatten" ? delete r[e] : X(lK(e, r[e], t.value)));
		}
		for (let e of q(n)) {
			let t = i.get(e);
			t !== void 0 && (t === n[e] ? delete n[e] : X(lK(e, n[e], t)));
		}
		let a = new v1(n, r);
		i.copyAll(a);
		let o = {};
		for (let e of q(a.combine())) {
			let t = a.get(e);
			t !== null && (o[e] = t);
		}
		return q(o).length === 0 || i.parseNothing ? null : new t(e, o);
	}
	get parse() {
		return this._parse;
	}
	merge(e) {
		this._parse = {
			...this._parse,
			...e.parse
		}, e.remove();
	}
	assembleFormatParse() {
		let e = {};
		for (let t of q(this._parse)) {
			let n = this._parse[t];
			eU(t) === 1 && (e[t] = n);
		}
		return e;
	}
	producedFields() {
		return new Set(q(this._parse));
	}
	dependentFields() {
		return new Set(q(this._parse));
	}
	assembleTransforms(e = !1) {
		return q(this._parse).filter((t) => e ? eU(t) > 1 : !0).map((e) => {
			let t = D3(e, this._parse[e]);
			return t ? {
				type: "formula",
				expr: t,
				as: $H(e)
			} : null;
		}).filter((e) => e !== null);
	}
}, M3 = class e extends F1 {
	clone() {
		return new e(null);
	}
	constructor(e) {
		super(e);
	}
	dependentFields() {
		return /* @__PURE__ */ new Set();
	}
	producedFields() {
		return new Set([hQ]);
	}
	hash() {
		return "Identifier";
	}
	assemble() {
		return {
			type: "identifier",
			as: hQ
		};
	}
}, N3 = class t extends F1 {
	clone() {
		return new t(null, this.params);
	}
	constructor(t, n) {
		super(t), e(this, "params", void 0), this.params = n;
	}
	dependentFields() {
		return /* @__PURE__ */ new Set();
	}
	producedFields() {}
	hash() {
		return `Graticule ${wH(this.params)}`;
	}
	assemble() {
		return {
			type: "graticule",
			...this.params === !0 ? {} : this.params
		};
	}
}, P3 = class t extends F1 {
	clone() {
		return new t(null, this.params);
	}
	constructor(t, n) {
		super(t), e(this, "params", void 0), this.params = n;
	}
	dependentFields() {
		return /* @__PURE__ */ new Set();
	}
	producedFields() {
		var e;
		return new Set([(e = this.params.as) == null ? "data" : e]);
	}
	hash() {
		return `Hash ${wH(this.params)}`;
	}
	assemble() {
		return {
			type: "sequence",
			...this.params
		};
	}
}, F3 = class extends F1 {
	constructor(t) {
		super(null), e(this, "_data", void 0), e(this, "_name", void 0), e(this, "_generator", void 0), t != null || (t = { name: "source" });
		let n;
		if (O1(t) || (n = t.format ? { ...CH(t.format, ["parse"]) } : {}), E1(t)) this._data = { values: t.values };
		else if (T1(t)) {
			if (this._data = { url: t.url }, !n.type) {
				let e = /(?:\.([^.]+))?$/.exec(t.url)[1];
				EH([
					"json",
					"csv",
					"tsv",
					"dsv",
					"topojson"
				], e) || (e = "json"), n.type = e;
			}
		} else A1(t) ? this._data = { values: [{ type: "Sphere" }] } : (D1(t) || O1(t)) && (this._data = {});
		this._generator = O1(t), t.name && (this._name = t.name), n && !LH(n) && (this._data.format = n);
	}
	dependentFields() {
		return /* @__PURE__ */ new Set();
	}
	producedFields() {}
	get data() {
		return this._data;
	}
	hasName() {
		return !!this._name;
	}
	get isGenerator() {
		return this._generator;
	}
	get dataName() {
		return this._name;
	}
	set dataName(e) {
		this._name = e;
	}
	set parent(e) {
		throw Error("Source nodes have to be roots.");
	}
	remove() {
		throw Error("Source nodes are roots and cannot be removed.");
	}
	hash() {
		throw Error("Cannot hash sources");
	}
	assemble() {
		return {
			name: this._name,
			...this._data,
			transform: []
		};
	}
};
function I3(e) {
	return e instanceof F3 || e instanceof N3 || e instanceof P3;
}
var L3 = /* @__PURE__ */ new WeakMap(), R3 = class {
	constructor() {
		uH(this, L3, void 0), fH(L3, this, !1);
	}
	setModified() {
		fH(L3, this, !0);
	}
	get modifiedFlag() {
		return pH(L3, this);
	}
}, z3 = class extends R3 {
	getNodeDepths(e, t, n) {
		n.set(e, t);
		for (let r of e.children) this.getNodeDepths(r, t + 1, n);
		return n;
	}
	optimize(e) {
		let t = [...this.getNodeDepths(e, 0, /* @__PURE__ */ new Map()).entries()].sort((e, t) => t[1] - e[1]);
		for (let e of t) this.run(e[0]);
		return this.modifiedFlag;
	}
}, B3 = class extends R3 {
	optimize(e) {
		this.run(e);
		for (let t of e.children) this.optimize(t);
		return this.modifiedFlag;
	}
}, V3 = class extends B3 {
	mergeNodes(e, t) {
		let n = t.shift();
		for (let r of t) e.removeChild(r), r.parent = n, r.remove();
	}
	run(e) {
		let t = e.children.map((e) => e.hash()), n = {};
		for (let r = 0; r < t.length; r++) n[t[r]] === void 0 ? n[t[r]] = [e.children[r]] : n[t[r]].push(e.children[r]);
		for (let t of q(n)) n[t].length > 1 && (this.setModified(), this.mergeNodes(e, n[t]));
	}
}, H3 = class extends B3 {
	constructor(t) {
		super(), e(this, "requiresSelectionId", void 0), this.requiresSelectionId = t && M2(t);
	}
	run(e) {
		e instanceof M3 && (this.requiresSelectionId && (I3(e.parent) || e.parent instanceof w3 || e.parent instanceof j3) || (this.setModified(), e.remove()));
	}
}, U3 = class extends R3 {
	optimize(e) {
		return this.run(e, /* @__PURE__ */ new Set()), this.modifiedFlag;
	}
	run(e, t) {
		let n = /* @__PURE__ */ new Set();
		e instanceof z1 && (n = e.producedFields(), PH(n, t) && (this.setModified(), e.removeFormulas(t), e.producedFields.length === 0 && e.remove()));
		for (let r of e.children) this.run(r, new Set([...t, ...n]));
	}
}, W3 = class extends B3 {
	constructor() {
		super();
	}
	run(e) {
		e instanceof I1 && !e.isRequired() && (this.setModified(), e.remove());
	}
}, G3 = class extends z3 {
	run(e) {
		if (!I3(e) && !(e.numChildren() > 1)) {
			for (let t of e.children) if (t instanceof j3) if (e instanceof j3) this.setModified(), e.merge(t);
			else {
				if (IH(e.producedFields(), t.dependentFields())) continue;
				this.setModified(), t.swapWithParent();
			}
		}
	}
}, K3 = class extends z3 {
	run(e) {
		let t = [...e.children], n = e.children.filter((e) => e instanceof j3);
		if (e.numChildren() > 1 && n.length >= 1) {
			let r = {}, i = /* @__PURE__ */ new Set();
			for (let e of n) {
				let t = e.parse;
				for (let e of q(t)) e in r ? r[e] !== t[e] && i.add(e) : r[e] = t[e];
			}
			for (let e of i) delete r[e];
			if (!LH(r)) {
				this.setModified();
				let n = new j3(e, r);
				for (let i of t) {
					if (i instanceof j3) for (let e of q(r)) delete i.parse[e];
					e.removeChild(i), i.parent = n, i instanceof j3 && q(i.parse).length === 0 && i.remove();
				}
			}
		}
	}
}, q3 = class extends z3 {
	run(e) {
		e instanceof I1 || e.numChildren() > 0 || e instanceof T3 || e instanceof F3 || (this.setModified(), e.remove());
	}
}, J3 = class extends z3 {
	run(e) {
		let t = e.children.filter((e) => e instanceof z1), n = t.pop();
		for (let e of t) this.setModified(), n.merge(e);
	}
}, Y3 = class extends z3 {
	run(e) {
		let t = e.children.filter((e) => e instanceof w3), n = {};
		for (let e of t) {
			let t = wH(e.groupBy);
			t in n || (n[t] = []), n[t].push(e);
		}
		for (let t of q(n)) {
			let r = n[t];
			if (r.length > 1) {
				let t = r.pop();
				for (let n of r) t.merge(n) && (e.removeChild(n), n.parent = t, n.remove(), this.setModified());
			}
		}
	}
}, X3 = class extends z3 {
	constructor(t) {
		super(), e(this, "model", void 0), this.model = t;
	}
	run(e) {
		let t = !(I3(e) || e instanceof R2 || e instanceof j3 || e instanceof M3), n = [], r = [];
		for (let i of e.children) i instanceof x3 && (t && !IH(e.producedFields(), i.dependentFields()) ? n.push(i) : r.push(i));
		if (n.length > 0) {
			let t = n.pop();
			for (let e of n) t.merge(e, this.model.renameSignal.bind(this.model));
			this.setModified(), e instanceof x3 ? e.merge(t, this.model.renameSignal.bind(this.model)) : t.swapWithParent();
		}
		if (r.length > 1) {
			let e = r.pop();
			for (let t of r) e.merge(t, this.model.renameSignal.bind(this.model));
			this.setModified();
		}
	}
}, Z3 = class extends z3 {
	run(e) {
		let t = [...e.children];
		if (!DH(t, (e) => e instanceof I1) || e.numChildren() <= 1) return;
		let n = [], r;
		for (let i of t) if (i instanceof I1) {
			let t = i;
			for (; t.numChildren() === 1;) {
				let [e] = t.children;
				if (e instanceof I1) t = e;
				else break;
			}
			n.push(...t.children), r ? (e.removeChild(i), i.parent = r.parent, r.parent.removeChild(r), r.parent = t, this.setModified()) : r = t;
		} else n.push(i);
		if (n.length) {
			this.setModified();
			for (let e of n) e.parent.removeChild(e), e.parent = r;
		}
	}
}, Q3 = class t extends F1 {
	clone() {
		return new t(null, K(this.transform));
	}
	constructor(t, n) {
		super(t), e(this, "transform", void 0), this.transform = n;
	}
	addDimensions(e) {
		this.transform.groupby = jH(this.transform.groupby.concat(e), (e) => e);
	}
	dependentFields() {
		let e = /* @__PURE__ */ new Set();
		return this.transform.groupby && this.transform.groupby.forEach(e.add, e), this.transform.joinaggregate.map((e) => e.field).filter((e) => e !== void 0).forEach(e.add, e), e;
	}
	producedFields() {
		return new Set(this.transform.joinaggregate.map(this.getDefaultName));
	}
	getDefaultName(e) {
		var t;
		return (t = e.as) == null ? $(e) : t;
	}
	hash() {
		return `JoinAggregateTransform ${wH(this.transform)}`;
	}
	assemble() {
		let e = [], t = [], n = [];
		for (let r of this.transform.joinaggregate) t.push(r.op), n.push(this.getDefaultName(r)), e.push(r.field === void 0 ? null : r.field);
		let r = this.transform.groupby;
		return {
			type: "joinaggregate",
			as: n,
			ops: t,
			fields: e,
			...r === void 0 ? {} : { groupby: r }
		};
	}
}, $3 = class t extends F1 {
	clone() {
		return new t(null, { ...this.filter });
	}
	constructor(t, n) {
		super(t), e(this, "filter", void 0), this.filter = n;
	}
	static make(e, n, r) {
		let { config: i, markDef: a } = n, { marks: o, scales: s } = r;
		if (o === "include-invalid-values" && s === "include-invalid-values") return null;
		let c = n.reduceFieldDef((e, t, r) => {
			let o = BW(r) && n.getScaleComponent(r);
			if (o) {
				let n = o.get("type"), { aggregate: s } = t, c = EY({
					scaleChannel: r,
					markDef: a,
					config: i,
					scaleType: n,
					isCountAggregate: QW(s)
				});
				c !== "show" && c !== "always-valid" && (e[t.field] = t);
			}
			return e;
		}, {});
		return q(c).length ? new t(e, c) : null;
	}
	dependentFields() {
		return new Set(q(this.filter));
	}
	producedFields() {
		return /* @__PURE__ */ new Set();
	}
	hash() {
		return `FilterInvalid ${wH(this.filter)}`;
	}
	assemble() {
		let e = q(this.filter).reduce((e, t) => {
			let n = this.filter[t], r = $(n, { expr: "datum" });
			return n !== null && (n.type === "temporal" ? e.push(`(isDate(${r}) || (${e6(r)}))`) : n.type === "quantitative" && e.push(e6(r))), e;
		}, []);
		return e.length > 0 ? {
			type: "filter",
			expr: e.join(" && ")
		} : null;
	}
};
function e6(e) {
	return `isValid(${e}) && isFinite(+${e})`;
}
function t6(e) {
	return e.stack.stackBy.reduce((e, t) => {
		let n = t.fieldDef, r = $(n);
		return r && e.push(r), e;
	}, []);
}
function n6(e) {
	return P(e) && e.every((e) => z(e)) && e.length > 1;
}
var r6 = class t extends F1 {
	clone() {
		return new t(null, K(this._stack));
	}
	constructor(t, n) {
		super(t), e(this, "_stack", void 0), this._stack = n;
	}
	static makeFromTransform(e, n) {
		let { stack: r, groupby: i, as: a, offset: o = "zero" } = n, s = [], c = [];
		if (n.sort !== void 0) for (let e of n.sort) s.push(e.field), c.push(tU(e.order, "ascending"));
		let l = {
			field: s,
			order: c
		}, u;
		return u = n6(a) ? a : z(a) ? [a, `${a}_end`] : [`${n.stack}_start`, `${n.stack}_end`], new t(e, {
			dimensionFieldDefs: [],
			stackField: r,
			groupby: i,
			offset: o,
			sort: l,
			facetby: [],
			as: u
		});
	}
	static makeFromEncoding(e, n) {
		let r = n.stack, { encoding: i } = n;
		if (!r) return null;
		let { groupbyChannels: a, fieldChannel: o, offset: s, impute: c } = r, l = a.map((e) => {
			let t = i[e];
			return GX(t);
		}).filter((e) => !!e), u = t6(n), d = n.encoding.order, f;
		if (P(d) || Z(d)) f = NG(d);
		else {
			let e = pX(d) ? d.sort : o === "y" ? "descending" : "ascending";
			f = u.reduce((t, n) => (t.field.includes(n) || (t.field.push(n), t.order.push(e)), t), {
				field: [],
				order: []
			});
		}
		return new t(e, {
			dimensionFieldDefs: l,
			stackField: n.vgField(o),
			facetby: [],
			stackby: u,
			sort: f,
			offset: s,
			impute: c,
			as: [n.vgField(o, {
				suffix: "start",
				forAs: !0
			}), n.vgField(o, {
				suffix: "end",
				forAs: !0
			})]
		});
	}
	get stack() {
		return this._stack;
	}
	addDimensions(e) {
		this._stack.facetby.push(...e);
	}
	dependentFields() {
		let e = /* @__PURE__ */ new Set();
		return e.add(this._stack.stackField), this.getGroupbyFields().forEach(e.add, e), this._stack.facetby.forEach(e.add, e), this._stack.sort.field.forEach(e.add, e), e;
	}
	producedFields() {
		return new Set(this._stack.as);
	}
	hash() {
		return `Stack ${wH(this._stack)}`;
	}
	getGroupbyFields() {
		let { dimensionFieldDefs: e, impute: t, groupby: n } = this._stack;
		return e.length > 0 ? e.map((e) => e.bin ? t ? [$(e, { binSuffix: "mid" })] : [$(e, {}), $(e, { binSuffix: "end" })] : [$(e)]).flat() : n == null ? [] : n;
	}
	assemble() {
		let e = [], { facetby: t, dimensionFieldDefs: n, stackField: r, stackby: i, sort: a, offset: o, impute: s, as: c } = this._stack;
		if (s) for (let a of n) {
			let { bandPosition: n = .5, bin: o } = a;
			if (o) {
				let t = $(a, { expr: "datum" }), r = $(a, {
					expr: "datum",
					binSuffix: "end"
				});
				e.push({
					type: "formula",
					expr: `${e6(t)} ? ${n}*${t}+${1 - n}*${r} : ${t}`,
					as: $(a, {
						binSuffix: "mid",
						forAs: !0
					})
				});
			}
			e.push({
				type: "impute",
				field: r,
				groupby: [...i, ...t],
				key: $(a, { binSuffix: "mid" }),
				method: "value",
				value: 0
			});
		}
		return e.push({
			type: "stack",
			groupby: [...this.getGroupbyFields(), ...t],
			field: r,
			sort: a,
			as: c,
			offset: o
		}), e;
	}
}, i6 = class t extends F1 {
	clone() {
		return new t(null, K(this.transform));
	}
	constructor(t, n) {
		super(t), e(this, "transform", void 0), this.transform = n;
	}
	addDimensions(e) {
		this.transform.groupby = jH(this.transform.groupby.concat(e), (e) => e);
	}
	dependentFields() {
		var e, t;
		let n = /* @__PURE__ */ new Set();
		return ((e = this.transform.groupby) == null ? [] : e).forEach(n.add, n), ((t = this.transform.sort) == null ? [] : t).forEach((e) => n.add(e.field)), this.transform.window.map((e) => e.field).filter((e) => e !== void 0).forEach(n.add, n), n;
	}
	producedFields() {
		return new Set(this.transform.window.map(this.getDefaultName));
	}
	getDefaultName(e) {
		var t;
		return (t = e.as) == null ? $(e) : t;
	}
	hash() {
		return `WindowTransform ${wH(this.transform)}`;
	}
	assemble() {
		let e = [], t = [], n = [], r = [];
		for (let i of this.transform.window) t.push(i.op), n.push(this.getDefaultName(i)), r.push(i.param === void 0 ? null : i.param), e.push(i.field === void 0 ? null : i.field);
		let i = this.transform.frame, a = this.transform.groupby;
		if (i && i[0] === null && i[1] === null && t.every((e) => XW(e))) return {
			type: "joinaggregate",
			as: n,
			ops: t,
			fields: e,
			...a === void 0 ? {} : { groupby: a }
		};
		let o = [], s = [];
		if (this.transform.sort !== void 0) for (let e of this.transform.sort) {
			var c;
			o.push(e.field), s.push((c = e.order) == null ? "ascending" : c);
		}
		let l = {
			field: o,
			order: s
		}, u = this.transform.ignorePeers;
		return {
			type: "window",
			params: r,
			as: n,
			ops: t,
			fields: e,
			sort: l,
			...u === void 0 ? {} : { ignorePeers: u },
			...a === void 0 ? {} : { groupby: a },
			...i === void 0 ? {} : { frame: i }
		};
	}
};
function a6(e) {
	function t(n) {
		if (!(n instanceof T3)) {
			let r = n.clone();
			if (r instanceof I1) {
				let t = c6 + r.getSource();
				r.setSource(t), e.model.component.data.outputNodes[t] = r;
			} else (r instanceof w3 || r instanceof r6 || r instanceof i6 || r instanceof Q3) && r.addDimensions(e.fields);
			for (let e of n.children.flatMap(t)) e.parent = r;
			return [r];
		}
		return n.children.flatMap(t);
	}
	return t;
}
function o6(e) {
	if (e instanceof T3) if (e.numChildren() === 1 && !(e.children[0] instanceof I1)) {
		let t = e.children[0];
		(t instanceof w3 || t instanceof r6 || t instanceof i6 || t instanceof Q3) && t.addDimensions(e.fields), t.swapWithParent(), o6(e);
	} else {
		let t = e.model.component.data.main;
		s6(t);
		let n = a6(e), r = e.children.map(n).flat();
		for (let e of r) e.parent = t;
	}
	else e.children.map(o6);
}
function s6(e) {
	if (e instanceof I1 && e.type === M1.Main && e.numChildren() === 1) {
		let t = e.children[0];
		t instanceof T3 || (t.swapWithParent(), s6(e));
	}
}
var c6 = "scale_", l6 = 5;
function u6(e) {
	for (let t of e) {
		for (let e of t.children) if (e.parent !== t) return !1;
		if (!u6(t.children)) return !1;
	}
	return !0;
}
function d6(e, t) {
	let n = !1;
	for (let r of t) n = e.optimize(r) || n;
	return n;
}
function f6(e, t, n) {
	let r = e.sources, i = !1;
	return i = d6(new W3(), r) || i, i = d6(new H3(t), r) || i, r = r.filter((e) => e.numChildren() > 0), i = d6(new q3(), r) || i, r = r.filter((e) => e.numChildren() > 0), n || (i = d6(new G3(), r) || i, i = d6(new X3(t), r) || i, i = d6(new U3(), r) || i, i = d6(new K3(), r) || i, i = d6(new Y3(), r) || i, i = d6(new J3(), r) || i, i = d6(new V3(), r) || i, i = d6(new Z3(), r) || i), e.sources = r, i;
}
function p6(e, t) {
	u6(e.sources);
	let n = 0, r = 0;
	for (let r = 0; r < l6 && f6(e, t, !0); r++) n++;
	e.sources.map(o6);
	for (let n = 0; n < l6 && f6(e, t, !1); n++) r++;
	u6(e.sources), Math.max(n, r) === l6 && X(`Maximum optimization runs(${l6}) reached.`);
}
var m6 = class t {
	constructor(t) {
		e(this, "signal", void 0), Object.defineProperty(this, "signal", {
			enumerable: !0,
			get: t
		});
	}
	static fromName(e, n) {
		return new t(() => e(n));
	}
};
function h6(e) {
	B8(e) ? g6(e) : _6(e);
}
function g6(e) {
	let t = e.component.scales;
	for (let n of q(t)) {
		let r = y6(e, n);
		if (t[n].setWithExplicit("domains", r), w6(e, n), e.component.data.isFaceted) {
			let t = e;
			for (; !V8(t) && t.parent;) t = t.parent;
			if (t.component.resolve.scale[n] === "shared") for (let e of r.value) hG(e) && (e.data = c6 + e.data.replace(c6, ""));
		}
	}
}
function _6(e) {
	for (let t of e.children) h6(t);
	let t = e.component.scales;
	for (let n of q(t)) {
		let r, i = null;
		for (let t of e.children) {
			let e = t.component.scales[n];
			if (e) {
				r = r === void 0 ? e.getWithExplicit("domains") : C1(r, e.getWithExplicit("domains"), "domains", "scale", D6);
				let t = e.get("selectionExtent");
				i && t && i.param !== t.param && X($G), i = t;
			}
		}
		t[n].setWithExplicit("domains", r), i && t[n].set("selectionExtent", i, !0);
	}
}
function v6(e, t, n, r) {
	if (e === "unaggregated") {
		let { valid: e, reason: r } = E6(t, n);
		if (!e) {
			X(r);
			return;
		}
	} else if (e === void 0 && r.useUnaggregatedDomain) {
		let { valid: e } = E6(t, n);
		if (e) return "unaggregated";
	}
	return e;
}
function y6(e, t) {
	let n = e.getScaleComponent(t).get("type"), { encoding: r } = e, i = v6(e.scaleDomain(t), e.typedFieldDef(t), n, e.config.scale);
	return i !== e.scaleDomain(t) && (e.specifiedScales[t] = {
		...e.specifiedScales[t],
		domain: i
	}), t === "x" && KX(r.x2) ? KX(r.x) ? C1(S6(n, i, e, "x"), S6(n, i, e, "x2"), "domain", "scale", D6) : S6(n, i, e, "x2") : t === "y" && KX(r.y2) ? KX(r.y) ? C1(S6(n, i, e, "y"), S6(n, i, e, "y2"), "domain", "scale", D6) : S6(n, i, e, "y2") : S6(n, i, e, t);
}
function b6(e, t, n) {
	return e.map((e) => ({ signal: `{data: ${nZ(e, {
		timeUnit: n,
		type: t
	})}}` }));
}
function x6(e, t, n) {
	var r;
	let i = (r = Uq(n)) == null ? void 0 : r.unit;
	return t === "temporal" || i ? b6(e, t, i) : [e];
}
function S6(e, t, n, r) {
	let { encoding: i, markDef: a, mark: o, config: s, stack: c } = n, l = KX(i[r]), { type: u } = l, d = l.timeUnit, f = P1({
		invalid: AG("invalid", a, s),
		isPath: sY(o)
	});
	if (LJ(t)) {
		let i = S6(e, void 0, n, r);
		return y1([...x6(t.unionWith, u, d), ...i.value]);
	} else if (Y(t)) return y1([t]);
	else if (t && t !== "unaggregated" && !IJ(t)) return y1(x6(t, u, d));
	if (c && r === c.fieldChannel) {
		if (c.offset === "normalize") return b1([[0, 1]]);
		let e = n.requestDataName(f);
		return b1([{
			data: e,
			field: n.vgField(r, { suffix: "start" })
		}, {
			data: e,
			field: n.vgField(r, { suffix: "end" })
		}]);
	}
	let p = BW(r) && Z(l) ? T6(n, r, e) : void 0;
	if (yX(l)) return b1(x6([l.datum], u, d));
	let m = l;
	if (t === "unaggregated") {
		let { field: e } = l;
		return b1([{
			data: n.requestDataName(f),
			field: $({
				field: e,
				aggregate: "min"
			})
		}, {
			data: n.requestDataName(f),
			field: $({
				field: e,
				aggregate: "max"
			})
		}]);
	} else if (rG(m.bin)) {
		if (AJ(e)) return b1(e === "bin-ordinal" ? [] : [{
			data: BH(p) ? n.requestDataName(f) : n.requestDataName(M1.Raw),
			field: n.vgField(r, iZ(m, r) ? { binSuffix: "range" } : {}),
			sort: p === !0 || !F(p) ? {
				field: n.vgField(r, {}),
				op: "min"
			} : p
		}]);
		{
			let { bin: e } = m;
			if (rG(e)) {
				let t = v3(n, m.field, e);
				return b1([new m6(() => {
					let e = n.getSignalName(t);
					return `[${e}.start, ${e}.stop]`;
				})]);
			} else return b1([{
				data: n.requestDataName(f),
				field: n.vgField(r, {})
			}]);
		}
	} else if (m.timeUnit && EH(["time", "utc"], e)) {
		let e = i[gW(r)];
		if (fX(m, e, a, s)) {
			let t = n.requestDataName(f), i = uX({
				fieldDef: m,
				fieldDef2: e,
				markDef: a,
				config: s
			}), c = cY(o) && i !== .5 && EW(r);
			return b1([{
				data: t,
				field: n.vgField(r, c ? { suffix: B1 } : {})
			}, {
				data: t,
				field: n.vgField(r, { suffix: c ? V1 : "end" })
			}]);
		}
	}
	return b1(p ? [{
		data: BH(p) ? n.requestDataName(f) : n.requestDataName(M1.Raw),
		field: n.vgField(r),
		sort: p
	}] : [{
		data: n.requestDataName(f),
		field: n.vgField(r)
	}]);
}
function C6(e, t) {
	let { op: n, field: r, order: i } = e;
	return {
		op: n == null ? t ? "sum" : ZY : n,
		...r ? { field: ZH(r) } : {},
		...i ? { order: i } : {}
	};
}
function w6(e, t) {
	var n;
	let r = e.component.scales[t], i = e.specifiedScales[t].domain, a = (n = e.fieldDef(t)) == null ? void 0 : n.bin, o = IJ(i) ? i : void 0, s = aG(a) && oG(a.extent) ? a.extent : void 0;
	(o || s) && r.set("selectionExtent", o == null ? s : o, !0);
}
function T6(e, t, n) {
	if (!AJ(n)) return;
	let r = e.fieldDef(t), i = r.sort;
	if (nX(i)) return {
		op: "min",
		field: h4(r, t),
		order: "ascending"
	};
	let { stack: a } = e, o = a ? new Set([...a.groupbyFields, ...a.stackBy.map((e) => e.fieldDef.field)]) : void 0;
	if (tX(i)) return C6(i, a && !o.has(i.field));
	if (eX(i)) {
		let { encoding: t, order: n } = i, r = e.fieldDef(t), { aggregate: s, field: c } = r, l = a && !o.has(c);
		if (JW(s) || YW(s)) return C6({
			field: $(r),
			order: n
		}, l);
		if (XW(s) || !s) return C6({
			op: s,
			field: c,
			order: n
		}, l);
	} else if (i === "descending") return {
		op: "min",
		field: e.vgField(t),
		order: "descending"
	};
	else if (EH(["ascending", void 0], i)) return !0;
}
function E6(e, t) {
	let { aggregate: n, type: r } = e;
	return n ? z(n) && !tG.has(n) ? {
		valid: !1,
		reason: LK(n)
	} : r === "quantitative" && t === "log" ? {
		valid: !1,
		reason: RK(e)
	} : { valid: !0 } : {
		valid: !1,
		reason: IK(e)
	};
}
function D6(e, t, n, r) {
	return e.explicit && t.explicit && X(GK(n, r, e.value, t.value)), {
		explicit: e.explicit,
		value: [...e.value, ...t.value]
	};
}
function O6(e) {
	let t = jH(e.map((e) => {
		if (hG(e)) {
			let { sort: t, ...n } = e;
			return n;
		}
		return e;
	}), wH), n = jH(e.map((e) => {
		if (hG(e)) {
			let t = e.sort;
			return t !== void 0 && !BH(t) && ("op" in t && t.op === "count" && delete t.field, t.order === "ascending" && delete t.order), t;
		}
	}).filter((e) => e !== void 0), wH);
	if (t.length === 0) return;
	if (t.length === 1) {
		let t = e[0];
		if (hG(t) && n.length > 0) {
			let e = n[0];
			if (n.length > 1) {
				X(JK);
				let t = n.filter((e) => F(e) && "op" in e && e.op !== "min");
				e = n.every((e) => F(e) && "op" in e) && t.length === 1 ? t[0] : !0;
			} else if (F(e) && "field" in e) {
				let n = e.field;
				t.field === n && (e = e.order ? { order: e.order } : !0);
			}
			return {
				...t,
				sort: e
			};
		}
		return t;
	}
	let r = jH(n.map((e) => BH(e) || !("op" in e) || z(e.op) && L(qW, e.op) ? e : (X(qK(e)), !0)), wH), i;
	r.length === 1 ? i = r[0] : r.length > 1 && (X(JK), i = !0);
	let a = jH(e.map((e) => hG(e) ? e.data : null), (e) => e);
	return a.length === 1 && a[0] !== null ? {
		data: a[0],
		fields: t.map((e) => e.field),
		...i ? { sort: i } : {}
	} : {
		fields: t,
		...i ? { sort: i } : {}
	};
}
function k6(e) {
	if (hG(e) && z(e.field)) return e.field;
	if (pG(e)) {
		let t;
		for (let n of e.fields) if (hG(n) && z(n.field)) {
			if (!t) t = n.field;
			else if (t !== n.field) return X(YK), t;
		}
		return X(XK), t;
	} else if (mG(e)) {
		X(ZK);
		let t = e.fields[0];
		return z(t) ? t : void 0;
	}
}
function A6(e, t) {
	return O6(e.component.scales[t].get("domains").map((t) => (hG(t) && (t.data = e.lookupDataSource(t.data)), t)));
}
function j6(e, t, n, r) {
	var i, a;
	e.encode != null || (e.encode = {}), (i = e.encode)[t] != null || (i[t] = {}), (a = e.encode[t]).update != null || (a.update = {}), e.encode[t].update[n] = r;
}
function M6(e, t) {
	var n;
	if (B8(e)) {
		let n = e.fieldDef(t);
		if (n != null && n.field) return n.field;
	}
	let r = ((n = e.children) == null ? [] : n).map((e) => M6(e, t)).filter((e) => !!e);
	if (r.length > 0) {
		let e = jH(r, wH);
		return e.length === 1 ? e[0] : void 0;
	}
}
function N6(e, t, n) {
	if (t === n) return !0;
	let r = e.getScaleType(t), i = e.getScaleType(n);
	return !r || !i ? !1 : AJ(r) === AJ(i);
}
function P6(e, t) {
	return e ? `field:${e}` : `channel:${String(t)}`;
}
function F6(e) {
	if (P(e)) {
		let t = e.filter(VH);
		return t.length > 0 ? t : null;
	}
	if (pG(e)) {
		let t = [];
		if (t.push(...e.fields.flatMap((e) => P(e) ? e.filter(VH) : [])), t.length > 0) return jH(t, wH);
	}
	return null;
}
function I6(e, t) {
	try {
		return F6(A6(e, t));
	} catch {
		return null;
	}
}
function L6(e, t, n) {
	let r = I6(e, t), i = I6(e, n);
	return r && i ? jH([...r, ...i], wH) : null;
}
function R6(e, t, n) {
	if (t && t.length > 0) {
		let r = e.getWithExplicit("values");
		r != null && r.explicit || (n && X(n), e.set("values", t, !1));
	}
}
function z6(e, t, n) {
	let r = e.getScaleComponent(t), i = e.getScaleComponent(n);
	if (!r || !i) return !1;
	let a = r.getWithExplicit("domains"), o = i.getWithExplicit("domains");
	if (!(a != null && a.explicit && o != null && o.explicit)) return !1;
	let s = A6(e, t), c = A6(e, n);
	return wH(s) === wH(c);
}
function B6(e) {
	let t = e.component.legends, n = {};
	for (let r of q(t)) {
		let i = P6(M6(e, r), r);
		if (!n[i]) {
			n[i] = [{
				channel: r,
				cmpt: t[r].clone()
			}];
			continue;
		}
		let a = !1;
		for (let o of n[i]) if (N6(e, o.channel, r) && p3(o.cmpt, t[r])) {
			let t = e.getScaleType(o.channel), n = e.getScaleType(r);
			t && n && AJ(t) && AJ(n) && (z6(e, o.channel, r) ? R6(o.cmpt, I6(e, o.channel)) : R6(o.cmpt, L6(e, o.channel, r), QK(o.channel, r))), a = !0;
			break;
		}
		a || n[i].push({
			channel: r,
			cmpt: t[r].clone()
		});
	}
	return RH(n).flat().map((t) => V6(t.cmpt, e.config)).filter((e) => e !== void 0);
}
function V6(e, t) {
	var n;
	let { disable: r, labelExpr: i, selections: a, ...o } = e.combine();
	if (!r) {
		if (t.aria === !1 && o.aria == null && (o.aria = !1), (n = o.encode) != null && n.symbols) {
			let e = o.encode.symbols.update;
			e.fill && e.fill.value !== "transparent" && !e.stroke && !o.stroke && (e.stroke = { value: "transparent" });
			for (let t of fQ) o[t] && delete e[t];
		}
		if (o.title || delete o.title, i !== void 0) {
			var s;
			let e = i;
			!((s = o.encode) == null || (s = s.labels) == null) && s.update && Y(o.encode.labels.update.text) && (e = QH(i, "datum.label", o.encode.labels.update.text.signal)), j6(o, "labels", "text", { signal: e });
		}
		return o;
	}
}
function H6(e) {
	return U8(e) || H8(e) ? U6(e) : W6(e);
}
function U6(e) {
	return e.children.reduce((e, t) => e.concat(t.assembleProjections()), W6(e));
}
function W6(e) {
	let t = e.component.projection;
	if (!t || t.merged) return [];
	let n = t.combine(), { name: r } = n;
	if (t.data) {
		let i = { signal: `[${t.size.map((e) => e.signal).join(", ")}]` }, a = t.data.reduce((t, n) => {
			let r = Y(n) ? n.signal : `data('${e.lookupDataSource(n)}')`;
			return EH(t, r) || t.push(r), t;
		}, []);
		if (a.length <= 0) throw Error("Projection's fit didn't find any data sources");
		return [{
			name: r,
			size: i,
			fit: { signal: a.length > 1 ? `[${a.join(", ")}]` : a[0] },
			...n
		}];
	} else return [{
		name: r,
		translate: { signal: "[width / 2, height / 2]" },
		...n
	}];
}
var G6 = [
	"type",
	"clipAngle",
	"clipExtent",
	"center",
	"rotate",
	"precision",
	"reflectX",
	"reflectY",
	"coefficient",
	"distance",
	"fraction",
	"lobes",
	"parallel",
	"radius",
	"ratio",
	"spacing",
	"tilt"
], K6 = class extends v1 {
	constructor(t, n, r, i) {
		super({ ...n }, { name: t }), e(this, "specifiedProjection", void 0), e(this, "size", void 0), e(this, "data", void 0), e(this, "merged", !1), this.specifiedProjection = n, this.size = r, this.data = i;
	}
	get isFit() {
		return !!this.data;
	}
};
function q6(e) {
	e.component.projection = B8(e) ? J6(e) : Z6(e);
}
function J6(e) {
	if (e.hasProjection) {
		let t = lG(e.specifiedProjection), n = !(t && (t.scale != null || t.translate != null)), r = n ? [e.getSizeSignalRef("width"), e.getSizeSignalRef("height")] : void 0, i = n ? Y6(e) : void 0, a = new K6(e.projectionName(!0), {
			...lG(e.config.projection),
			...t
		}, r, i);
		return a.get("type") || a.set("type", "equalEarth", !1), a;
	}
}
function Y6(e) {
	let t = [], { encoding: n } = e;
	for (let r of [[EU, TU], [OU, DU]]) (KX(n[r[0]]) || KX(n[r[1]])) && t.push({ signal: e.getName(`geojson_${t.length}`) });
	return e.channelHasField(NU) && e.typedFieldDef(NU).type === _J && t.push({ signal: e.getName(`geojson_${t.length}`) }), t.length === 0 && t.push(e.requestDataName(M1.Main)), t;
}
function X6(e, t) {
	let n = OH(G6, (n) => !!(!L(e.explicit, n) && !L(t.explicit, n) || L(e.explicit, n) && L(t.explicit, n) && uU(e.get(n), t.get(n))));
	if (uU(e.size, t.size)) {
		if (n) return e;
		if (uU(e.explicit, {})) return t;
		if (uU(t.explicit, {})) return e;
	}
	return null;
}
function Z6(e) {
	if (e.children.length === 0) return;
	let t;
	for (let t of e.children) q6(t);
	let n = OH(e.children, (e) => {
		let n = e.component.projection;
		if (!n) return !0;
		if (t) {
			let e = X6(t, n);
			return e && (t = e), !!e;
		} else return t = n, !0;
	});
	if (t && n) {
		let n = e.projectionName(!0), r = new K6(n, t.specifiedProjection, t.size, K(t.data));
		for (let t of e.children) {
			let e = t.component.projection;
			e && (e.isFit && r.data.push(...t.component.projection.data), t.renameProjection(e.get("name"), n), e.merged = !0);
		}
		return r;
	}
}
function Q6(e) {
	return U8(e) || H8(e) ? e.children.reduce((e, t) => e.concat(Q6(t)), $6(e)) : $6(e);
}
function $6(e) {
	return q(e.component.scales).reduce((t, n) => {
		let r = e.component.scales[n];
		if (r.merged) return t;
		let i = r.combine(), { name: a, type: o, selectionExtent: s, domains: c, range: l, reverse: u, ...d } = i, f = e8(i.range, a, n, e), p = A6(e, n), m = s ? p0(e, s, r, p) : null;
		return t.push({
			name: a,
			type: o,
			...p ? { domain: p } : {},
			...m ? { domainRaw: m } : {},
			range: f,
			...u === void 0 ? {} : { reverse: u },
			...d
		}), t;
	}, []);
}
function e8(e, t, n, r) {
	if (EW(n)) {
		if (fG(e)) return { step: { signal: `${t}_step` } };
	} else if (F(e) && hG(e)) return {
		...e,
		data: r.lookupDataSource(e.data)
	};
	return e;
}
var t8 = class extends v1 {
	constructor(t, n) {
		super({}, { name: t }), e(this, "merged", !1), this.setWithExplicit("type", n);
	}
	domainHasZero() {
		let e = this.get("type");
		if (EH([
			yJ.LOG,
			yJ.TIME,
			yJ.UTC
		], e)) return "definitely-not";
		let t = this.get("zero");
		if (t === !0 || t === void 0 && EH([
			yJ.LINEAR,
			yJ.SQRT,
			yJ.POW
		], e)) return "definitely";
		let n = this.get("domains");
		if (n.length > 0) {
			let e = !1, t = !1, r = !1;
			for (let i of n) {
				if (P(i)) {
					let n = i[0], r = i[i.length - 1];
					if (rd(n) && rd(r)) if (n <= 0 && r >= 0) {
						e = !0;
						continue;
					} else {
						t = !0;
						continue;
					}
				}
				r = !0;
			}
			if (e) return "definitely";
			if (t && !r) return "definitely-not";
		}
		return "maybe";
	}
}, n8 = ["range", "scheme"];
function r8(e) {
	let t = e.component.scales;
	for (let n of zW) {
		let r = t[n];
		if (!r) continue;
		let i = a8(n, e);
		r.setWithExplicit("range", i);
	}
}
function i8(e, t) {
	let n = e.fieldDef(t);
	if (n != null && n.bin) {
		let { bin: r, field: i } = n, a = _W(t), o = e.getName(a);
		if (F(r) && r.binned && r.step !== void 0) return new m6(() => {
			let n = e.scaleName(t), i = `(domain("${n}")[1] - domain("${n}")[0]) / ${r.step}`;
			return `${e.getSignalName(o)} / (${i})`;
		});
		if (rG(r)) {
			let t = v3(e, i, r);
			return new m6(() => {
				let n = e.getSignalName(t), r = `(${n}.stop - ${n}.start) / ${n}.step`;
				return `${e.getSignalName(o)} / (${r})`;
			});
		}
	}
}
function a8(e, t) {
	let n = t.specifiedScales[e], { size: r } = t, i = t.getScaleComponent(e).get("type");
	for (let r of n8) if (n[r] !== void 0) {
		let a = VJ(i, r), o = HJ(e, r);
		if (!a) X(HK(i, r, e));
		else if (o) X(o);
		else switch (r) {
			case "range": {
				let r = n.range;
				if (P(r)) {
					if (EW(e)) return y1(r.map((e) => {
						if (e === "width" || e === "height") {
							let n = t.getName(e), r = t.getSignalName.bind(t);
							return m6.fromName(r, n);
						}
						return e;
					}));
				} else if (F(r)) return y1({
					data: t.requestDataName(M1.Main),
					field: r.field,
					sort: {
						op: "min",
						field: t.vgField(e)
					}
				});
				return y1(r);
			}
			case "scheme": return y1(o8(n[r]));
		}
	}
	let a = e === hU || e === "xOffset" ? "width" : "height", o = r[a];
	if (EQ(o)) {
		if (EW(e)) if (AJ(i)) {
			let n = l8(o, t, e);
			if (n) return y1({ step: n });
		} else X(UK(a));
		else if (jW(e)) {
			let n = e === yU ? "x" : "y";
			if (t.getScaleComponent(n).get("type") === "band") {
				let e = u8(o, i);
				if (e) return y1(e);
			}
		}
	}
	let { rangeMin: s, rangeMax: c } = n, l = c8(e, t);
	return (s !== void 0 || c !== void 0) && VJ(i, "rangeMin") && P(l) && l.length === 2 ? y1([s == null ? l[0] : s, c == null ? l[1] : c]) : b1(l);
}
function o8(e) {
	return FJ(e) ? {
		scheme: e.name,
		...CH(e, ["name"])
	} : { scheme: e };
}
function s8(e, t, n, { center: r } = {}) {
	let i = _W(e), a = t.getName(i), o = t.getSignalName.bind(t);
	return e === gU && jJ(n) ? r ? [m6.fromName((e) => `${o(e)}/2`, a), m6.fromName((e) => `-${o(e)}/2`, a)] : [m6.fromName(o, a), 0] : r ? [m6.fromName((e) => `-${o(e)}/2`, a), m6.fromName((e) => `${o(e)}/2`, a)] : [0, m6.fromName(o, a)];
}
function c8(e, t) {
	let { size: n, config: r, mark: i, encoding: a } = t, { type: o } = KX(a[e]), s = t.getScaleComponent(e).get("type"), { domain: c, domainMid: l } = t.specifiedScales[e];
	switch (e) {
		case hU:
		case gU:
			if (EH(["point", "band"], s)) {
				let i = f8(e, n, r.view);
				if (EQ(i)) return { step: l8(i, t, e) };
			}
			return s8(e, t, s);
		case yU:
		case bU: return d8(e, t, s);
		case PU: {
			let a = h8(i, r), o = _8(i, n, t, r);
			return NJ(s) ? m8(a, o, p8(s, r, c, e)) : [a, o];
		}
		case CU: return [0, Math.PI * 2];
		case FU: return [0, 360];
		case xU: return [0, new m6(() => `min(${t.getSignalName(V8(t.parent) ? "child_width" : "width")},${t.getSignalName(V8(t.parent) ? "child_height" : "height")})/2`)];
		case kU: return { step: 1e3 / r.scale.framesPerSecond };
		case zU: return [r.scale.minStrokeWidth, r.scale.maxStrokeWidth];
		case BU: return [
			[1, 0],
			[4, 2],
			[2, 1],
			[1, 1],
			[
				1,
				2,
				4,
				2
			]
		];
		case NU: return "symbol";
		case AU:
		case jU:
		case MU: return s === "ordinal" ? o === "nominal" ? "category" : "ordinal" : l === void 0 ? i === "rect" || i === "geoshape" ? "heatmap" : "ramp" : "diverging";
		case IU:
		case LU:
		case RU: return [r.scale.minOpacity, r.scale.maxOpacity];
	}
}
function l8(e, t, n) {
	let { encoding: r } = t, i = t.getScaleComponent(n), a = yW(n), o = r[a];
	if (TQ({
		step: e,
		offsetIsDiscrete: Q(o) && fJ(o.type)
	}) === "offset" && gZ(r, a)) {
		var s;
		let n = t.getScaleComponent(a), r = `domain('${t.scaleName(a)}').length`;
		if (n.get("type") === "band") {
			var c, l, u, d;
			let e = (c = (l = n.get("paddingInner")) == null ? n.get("padding") : l) == null ? 0 : c, t = (u = (d = n.get("paddingOuter")) == null ? n.get("padding") : d) == null ? 0 : u;
			r = `bandspace(${r}, ${e}, ${t})`;
		}
		let o = (s = i.get("paddingInner")) == null ? i.get("padding") : s;
		return { signal: `${e.step} * ${r} / (1-${wG(o)})` };
	} else return e.step;
}
function u8(e, t) {
	if (TQ({
		step: e,
		offsetIsDiscrete: AJ(t)
	}) === "offset") return { step: e.step };
}
function d8(e, t, n) {
	let r = e === yU ? "x" : "y", i = t.getScaleComponent(r);
	if (!i) return s8(r, t, n, { center: !0 });
	let a = i.get("type"), o = t.scaleName(r), { markDef: s, config: c } = t;
	if (a === "band") {
		let e = f8(r, t.size, t.config.view);
		if (EQ(e)) {
			let t = u8(e, n);
			if (t) return t;
		}
		return [0, { signal: `bandwidth('${o}')` }];
	} else {
		let n = t.encoding[r];
		if (Z(n) && n.timeUnit) {
			let e = Gq(n.timeUnit, (e) => `scale('${o}', ${e})`), r = t.config.scale.bandWithNestedOffsetPaddingInner, i = uX({
				fieldDef: n,
				markDef: s,
				config: c
			}) - .5, a = i === 0 ? "" : ` + ${i}`;
			if (r) {
				let t = Y(r) ? `${r.signal}/2${a}` : `${r / 2 + i}`, n = Y(r) ? `(1 - ${r.signal}/2)${a}` : `${1 - r / 2 + i}`;
				return [{ signal: `${t} * (${e})` }, { signal: `${n} * (${e})` }];
			}
			return [0, { signal: e }];
		}
		return xH(`Cannot use ${e} scale if ${r} scale is not discrete.`);
	}
}
function f8(e, t, n) {
	let r = e === hU ? "width" : "height", i = t[r];
	return i === void 0 ? NQ(n, r) : i;
}
function p8(e, t, n, r) {
	switch (e) {
		case "quantile": return t.scale.quantileCount;
		case "quantize": return t.scale.quantizeCount;
		case "threshold": return n !== void 0 && P(n) ? n.length + 1 : (X(uq(r)), 3);
	}
}
function m8(e, t, n) {
	let r = () => {
		let r = EG(t), i = EG(e), a = `(${r} - ${i}) / (${n} - 1)`;
		return `sequence(${i}, ${r} + ${a}, ${a})`;
	};
	return Y(t) ? new m6(r) : { signal: r() };
}
function h8(e, t) {
	switch (e) {
		case "bar":
		case "tick": return t.scale.minBandSize;
		case "line":
		case "trail":
		case "rule": return t.scale.minStrokeWidth;
		case "text": return t.scale.minFontSize;
		case "point":
		case "square":
		case "circle": return t.scale.minSize;
	}
	/* istanbul ignore next: should never reach here */
	throw Error(TK("size", e));
}
var g8 = .95;
function _8(e, t, n, r) {
	let i = {
		x: i8(n, "x"),
		y: i8(n, "y")
	};
	switch (e) {
		case "bar":
		case "tick": {
			if (r.scale.maxBandSize !== void 0) return r.scale.maxBandSize;
			let e = v8(t, i, r.view);
			return rd(e) ? e - 1 : new m6(() => `${e.signal} - 1`);
		}
		case "line":
		case "trail":
		case "rule": return r.scale.maxStrokeWidth;
		case "text": return r.scale.maxFontSize;
		case "point":
		case "square":
		case "circle": {
			if (r.scale.maxSize) return r.scale.maxSize;
			let e = v8(t, i, r.view);
			return rd(e) ? (g8 * e) ** 2 : new m6(() => `pow(${g8} * ${e.signal}, 2)`);
		}
	}
	/* istanbul ignore next: should never reach here */
	throw Error(TK("size", e));
}
function v8(e, t, n) {
	let r = EQ(e.width) ? e.width.step : MQ(n, "width"), i = EQ(e.height) ? e.height.step : MQ(n, "height");
	return t.x || t.y ? new m6(() => `min(${[t.x ? t.x.signal : r, t.y ? t.y.signal : i].join(", ")})`) : Math.min(r, i);
}
function y8(e, t) {
	B8(e) ? b8(e, t) : C8(e, t);
}
function b8(e, t) {
	let n = e.component.scales, { config: r, encoding: i, markDef: a, specifiedScales: o } = e;
	for (let s of q(n)) {
		let c = o[s], l = n[s], u = e.getScaleComponent(s), d = KX(i[s]), f = c[t], p = u.get("type"), m = u.get("padding"), h = u.get("paddingInner"), g = VJ(p, t), _ = HJ(s, t);
		if (f !== void 0 && (g ? _ && X(_) : X(HK(p, t, s))), g && _ === void 0) if (f !== void 0) {
			let e = d.timeUnit, n = d.type;
			switch (t) {
				case "domainMax":
				case "domainMin":
					_q(c[t]) || n === "temporal" || e ? l.set(t, { signal: nZ(c[t], {
						type: n,
						timeUnit: e
					}) }, !0) : l.set(t, c[t], !0);
					break;
				default: l.copyKeyFromObject(t, c);
			}
		} else {
			let n = J(x8, t) ? x8[t]({
				model: e,
				channel: s,
				fieldOrDatumDef: d,
				scaleType: p,
				scalePadding: m,
				scalePaddingInner: h,
				domain: c.domain,
				domainMin: c.domainMin,
				domainMax: c.domainMax,
				markDef: a,
				config: r,
				hasNestedOffsetScale: _Z(i, s),
				hasSecondaryRangeChannel: !!i[gW(s)]
			}) : r.scale[t];
			n !== void 0 && l.set(t, n, !1);
		}
	}
}
var x8 = {
	bins: ({ model: e, fieldOrDatumDef: t }) => Z(t) ? w8(e, t) : void 0,
	interpolate: ({ channel: e, fieldOrDatumDef: t }) => T8(e, t.type),
	nice: ({ scaleType: e, channel: t, domain: n, domainMin: r, domainMax: i, fieldOrDatumDef: a }) => E8(e, t, n, r, i, a),
	padding: ({ channel: e, scaleType: t, fieldOrDatumDef: n, markDef: r, config: i }) => D8(e, t, i.scale, n, r, i.bar),
	paddingInner: ({ scalePadding: e, channel: t, markDef: n, scaleType: r, config: i, hasNestedOffsetScale: a }) => O8(e, t, n.type, r, i.scale, a),
	paddingOuter: ({ scalePadding: e, channel: t, scaleType: n, scalePaddingInner: r, config: i, hasNestedOffsetScale: a }) => k8(e, t, n, r, i.scale, a),
	reverse: ({ fieldOrDatumDef: e, scaleType: t, channel: n, config: r }) => A8(t, Z(e) ? e.sort : void 0, n, r.scale),
	zero: ({ channel: e, fieldOrDatumDef: t, domain: n, markDef: r, scaleType: i, config: a, hasSecondaryRangeChannel: o }) => j8(e, t, n, r, i, a.scale, o)
};
function S8(e) {
	B8(e) ? r8(e) : C8(e, "range");
}
function C8(e, t) {
	let n = e.component.scales;
	for (let n of e.children) t === "range" ? S8(n) : y8(n, t);
	for (let r of q(n)) {
		let i;
		for (let n of e.children) {
			let e = n.component.scales[r];
			if (e) {
				let n = e.getWithExplicit(t);
				i = C1(i, n, t, "scale", x1((e, n) => {
					switch (t) {
						case "range": return e.step && n.step ? e.step - n.step : 0;
					}
					return 0;
				}));
			}
		}
		n[r].setWithExplicit(t, i);
	}
}
function w8(e, t) {
	let n = t.bin;
	if (rG(n)) {
		let r = v3(e, t.field, n);
		return new m6(() => e.getSignalName(r));
	} else if (iG(n) && aG(n) && n.step !== void 0) return { step: n.step };
}
function T8(e, t) {
	if (EH([
		AU,
		jU,
		MU
	], e) && t !== "nominal") return "hcl";
}
function E8(e, t, n, r, i, a) {
	var o;
	if (!((o = GX(a)) != null && o.bin || P(n) || i != null || r != null || EH([yJ.TIME, yJ.UTC], e))) return EW(t) ? !0 : void 0;
}
function D8(e, t, n, r, i, a) {
	if (EW(e)) {
		if (MJ(t)) {
			if (n.continuousPadding !== void 0) return n.continuousPadding;
			let { type: t, orient: o } = i;
			if (t === "bar" && !(Z(r) && (r.bin || r.timeUnit)) && (o === "vertical" && e === "x" || o === "horizontal" && e === "y")) return a.continuousBandSize;
		}
		if (t === yJ.POINT) return n.pointPadding;
	}
}
function O8(e, t, n, r, i, a = !1) {
	if (e === void 0) {
		if (EW(t)) {
			let { bandPaddingInner: e, barBandPaddingInner: t, rectBandPaddingInner: r, tickBandPaddingInner: o, bandWithNestedOffsetPaddingInner: s } = i;
			return a ? s : tU(e, n === "bar" ? t : n === "tick" ? o : r);
		} else if (jW(t) && r === yJ.BAND) return i.offsetBandPaddingInner;
	}
}
function k8(e, t, n, r, i, a = !1) {
	if (e === void 0) {
		if (EW(t)) {
			let { bandPaddingOuter: e, bandWithNestedOffsetPaddingOuter: t } = i;
			if (a) return t;
			if (n === yJ.BAND) return tU(e, Y(r) ? { signal: `${r.signal}/2` } : r / 2);
		} else if (jW(t)) {
			if (n === yJ.POINT) return .5;
			if (n === yJ.BAND) return i.offsetBandPaddingOuter;
		}
	}
}
function A8(e, t, n, r) {
	if (n === "x" && r.xReverse !== void 0) return jJ(e) && t === "descending" ? Y(r.xReverse) ? { signal: `!${r.xReverse.signal}` } : !r.xReverse : r.xReverse;
	if (jJ(e) && t === "descending") return !0;
}
function j8(e, t, n, r, i, a, o) {
	if (n && n !== "unaggregated" && jJ(i)) {
		if (P(n)) {
			let e = n[0], t = n[n.length - 1];
			if (rd(e) && e <= 0 && rd(t) && t >= 0) return !0;
		}
		return !1;
	}
	if (e === "size" && t.type === "quantitative" && !NJ(i)) return !0;
	if (!(Z(t) && t.bin) && EH([...TW, ...OW], e)) {
		let { orient: t, type: n } = r;
		return EH([
			"bar",
			"area",
			"line",
			"trail"
		], n) && (t === "horizontal" && e === "y" || t === "vertical" && e === "x") ? !1 : EH(["bar", "area"], n) && !o ? !0 : a == null ? void 0 : a.zero;
	}
	return !1;
}
function M8(e, t, n, r, i = !1) {
	let a = N8(t, n, r, i), { type: o } = e;
	return BW(t) ? o === void 0 ? a : WJ(t, o) ? Z(n) && !UJ(o, n.type) ? (X(VK(o, a)), a) : o : (X(BK(t, o, a)), a) : null;
}
function N8(e, t, n, r) {
	switch (t.type) {
		case "nominal":
		case "ordinal": {
			var i;
			if (rW(e) || GW(e) === "discrete") return e === "shape" && t.type === "ordinal" && X(AK(e, "ordinal")), "ordinal";
			if (NW(e)) return "band";
			if (EW(e) || jW(e)) {
				if (EH([
					"rect",
					"bar",
					"image",
					"rule",
					"tick"
				], n.type) || r) return "band";
			} else if (n.type === "arc" && e in DW) return "band";
			let a = n[_W(e)];
			return yY(a) || EX(t) && (i = t.axis) != null && i.tickBand ? "band" : "point";
		}
		case "temporal": return rW(e) ? "time" : GW(e) === "discrete" ? (X(AK(e, "temporal")), "ordinal") : Z(t) && t.timeUnit && Uq(t.timeUnit).utc ? "utc" : NW(e) ? "band" : "time";
		case "quantitative": return rW(e) ? Z(t) && rG(t.bin) ? "bin-ordinal" : "linear" : GW(e) === "discrete" ? (X(AK(e, "quantitative")), "ordinal") : NW(e) ? "band" : "linear";
		case "geojson": return;
	}
	/* istanbul ignore next: should never reach this */
	throw Error(vK(t.type));
}
function P8(e, { ignoreRange: t } = {}) {
	F8(e), h6(e);
	for (let t of BJ) y8(e, t);
	t || S8(e);
}
function F8(e) {
	B8(e) ? e.component.scales = I8(e) : e.component.scales = R8(e);
}
function I8(e) {
	let { encoding: t, mark: n, markDef: r } = e, i = {};
	for (let a of zW) {
		let o = KX(t[a]);
		if (o && n === oY && a === NU && o.type === _J) continue;
		let s = o && o.scale;
		if (o && s !== null && s !== !1) {
			s != null || (s = {});
			let n = _Z(t, a), c = M8(s, a, o, r, n);
			i[a] = new t8(e.scaleName(`${a}`, !0), {
				value: c,
				explicit: s.type === c
			});
		}
	}
	return i;
}
var L8 = x1((e, t) => CJ(e) - CJ(t));
function R8(e) {
	let t = e.component.scales = {}, n = {}, r = e.component.resolve;
	for (let t of e.children) {
		F8(t);
		for (let a of q(t.component.scales)) {
			var i;
			if ((i = r.scale)[a] != null || (i[a] = R4(a, e)), r.scale[a] === "shared") {
				let e = n[a], i = t.component.scales[a].getWithExplicit("type");
				e ? xJ(e.value, i.value) ? n[a] = C1(e, i, "type", "scale", L8) : (r.scale[a] = "independent", delete n[a]) : n[a] = i;
			}
		}
	}
	for (let r of q(n)) {
		let i = e.scaleName(r, !0), a = n[r];
		t[r] = new t8(i, a);
		for (let t of e.children) {
			let e = t.component.scales[r];
			e && (t.renameScale(e.get("name"), i), e.merged = !0);
		}
	}
	return t;
}
var z8 = class {
	constructor() {
		e(this, "nameMap", void 0), this.nameMap = {};
	}
	rename(e, t) {
		this.nameMap[e] = t;
	}
	has(e) {
		return this.nameMap[e] !== void 0;
	}
	get(e) {
		for (; this.nameMap[e] && e !== this.nameMap[e];) e = this.nameMap[e];
		return e;
	}
};
function B8(e) {
	return (e == null ? void 0 : e.type) === "unit";
}
function V8(e) {
	return (e == null ? void 0 : e.type) === "facet";
}
function H8(e) {
	return (e == null ? void 0 : e.type) === "concat";
}
function U8(e) {
	return (e == null ? void 0 : e.type) === "layer";
}
var W8 = class {
	constructor(t, n, r, i, a, o, s) {
		var c, l;
		e(this, "type", void 0), e(this, "parent", void 0), e(this, "config", void 0), e(this, "name", void 0), e(this, "size", void 0), e(this, "title", void 0), e(this, "description", void 0), e(this, "data", void 0), e(this, "transforms", void 0), e(this, "layout", void 0), e(this, "scaleNameMap", void 0), e(this, "projectionNameMap", void 0), e(this, "signalNameMap", void 0), e(this, "component", void 0), e(this, "view", void 0), this.type = n, this.parent = r, this.config = a, this.parent = r, this.config = a, this.view = lG(s), this.name = (c = t.name) == null ? i : c, this.title = dG(t.title) ? { text: t.title } : t.title ? lG(t.title) : void 0, this.scaleNameMap = r ? r.scaleNameMap : new z8(), this.projectionNameMap = r ? r.projectionNameMap : new z8(), this.signalNameMap = r ? r.signalNameMap : new z8(), this.data = t.data, this.description = t.description, this.transforms = $$((l = t.transform) == null ? [] : l), this.layout = n === "layer" || n === "unit" ? {} : AQ(t, n, a), this.component = {
			data: {
				sources: r ? r.component.data.sources : [],
				outputNodes: r ? r.component.data.outputNodes : {},
				outputNodeRefCounts: r ? r.component.data.outputNodeRefCounts : {},
				isFaceted: aX(t) || (r == null ? void 0 : r.component.data.isFaceted) && t.data === void 0
			},
			layoutSize: new v1(),
			layoutHeaders: {
				row: {},
				column: {},
				facet: {}
			},
			mark: null,
			resolve: {
				scale: {},
				axis: {},
				legend: {},
				...o ? K(o) : {}
			},
			selection: null,
			scales: null,
			projection: null,
			axes: {},
			legends: {}
		};
	}
	get width() {
		return this.getSizeSignalRef("width");
	}
	get height() {
		return this.getSizeSignalRef("height");
	}
	parse() {
		this.parseScale(), this.parseLayoutSize(), this.renameTopLevelLayoutSizeSignal(), this.parseSelections(), this.parseProjection(), this.parseData(), this.parseAxesAndHeaders(), this.parseLegends(), this.parseMarkGroup();
	}
	parseScale() {
		P8(this);
	}
	parseProjection() {
		q6(this);
	}
	renameTopLevelLayoutSizeSignal() {
		this.getName("width") !== "width" && this.renameSignal(this.getName("width"), "width"), this.getName("height") !== "height" && this.renameSignal(this.getName("height"), "height");
	}
	parseLegends() {
		s3(this);
	}
	assembleEncodeFromView(e) {
		let { style: t, ...n } = e, r = {};
		for (let e of q(n)) {
			let t = n[e];
			t !== void 0 && (r[e] = CG(t));
		}
		return r;
	}
	assembleGroupEncodeEntry(e) {
		let t = {};
		return this.view && (t = this.assembleEncodeFromView(this.view)), !e && (this.description && (t.description = CG(this.description)), this.type === "unit" || this.type === "layer") ? {
			width: this.getSizeSignalRef("width"),
			height: this.getSizeSignalRef("height"),
			...t
		} : LH(t) ? void 0 : t;
	}
	assembleLayout() {
		if (!this.layout) return;
		let { spacing: e, ...t } = this.layout, { component: n, config: r } = this, i = A4(n.layoutHeaders, r);
		return {
			padding: e,
			...this.assembleDefaultLayout(),
			...t,
			...i ? { titleBand: i } : {}
		};
	}
	assembleDefaultLayout() {
		return {};
	}
	assembleHeaderMarks() {
		let { layoutHeaders: e } = this.component, t = [];
		for (let n of aW) e[n].title && t.push(x4(this, n));
		for (let e of y4) t = t.concat(w4(this, e));
		return t;
	}
	assembleAxes() {
		return J2(this.component.axes, this.config);
	}
	assembleLegends() {
		return B6(this);
	}
	assembleProjections() {
		return H6(this);
	}
	assembleTitle() {
		var e;
		let { encoding: t, ...n } = (e = this.title) == null ? {} : e, r = {
			...uG(this.config.title).nonMarkTitleProperties,
			...n,
			...t ? { encode: { update: t } } : {}
		};
		if (r.text) return EH(["unit", "layer"], this.type) ? EH(["middle", void 0], r.anchor) && (r.frame != null || (r.frame = "group")) : r.anchor != null || (r.anchor = "start"), LH(r) ? void 0 : r;
	}
	assembleGroup(e = []) {
		let t = {};
		e = e.concat(this.assembleSignals()), e.length > 0 && (t.signals = e);
		let n = this.assembleLayout();
		n && (t.layout = n), t.marks = [].concat(this.assembleHeaderMarks(), this.assembleMarks());
		let r = !this.parent || V8(this.parent) ? Q6(this) : [];
		r.length > 0 && (t.scales = r);
		let i = this.assembleAxes();
		i.length > 0 && (t.axes = i);
		let a = this.assembleLegends();
		return a.length > 0 && (t.legends = a), t;
	}
	getName(e) {
		return HH((this.name ? `${this.name}_` : "") + e);
	}
	getDataName(e) {
		return this.getName(M1[e].toLowerCase());
	}
	requestDataName(e) {
		let t = this.getDataName(e), n = this.component.data.outputNodeRefCounts;
		return n[t] = (n[t] || 0) + 1, t;
	}
	getSizeSignalRef(e) {
		if (V8(this.parent)) {
			let t = kW(I4(e)), n = this.component.scales[t];
			if (n && !n.merged) {
				let e = n.get("type"), r = n.get("range");
				if (AJ(e) && fG(r)) {
					let e = n.get("name"), r = k6(A6(this, t));
					return r ? { signal: F4(e, n, $({
						aggregate: "distinct",
						field: r
					}, { expr: "datum" })) } : (X(HG(t)), null);
				}
			}
		}
		return { signal: this.signalNameMap.get(this.getName(e)) };
	}
	lookupDataSource(e) {
		let t = this.component.data.outputNodes[e];
		return t ? t.getSource() : e;
	}
	getSignalName(e) {
		return this.signalNameMap.get(e);
	}
	renameSignal(e, t) {
		this.signalNameMap.rename(e, t);
	}
	renameScale(e, t) {
		this.scaleNameMap.rename(e, t);
	}
	renameProjection(e, t) {
		this.projectionNameMap.rename(e, t);
	}
	scaleName(e, t) {
		if (t) return this.getName(e);
		if (dW(e) && BW(e) && this.component.scales[e] || this.scaleNameMap.has(this.getName(e))) return this.scaleNameMap.get(this.getName(e));
	}
	projectionName(e) {
		if (e) return this.getName("projection");
		if (this.component.projection && !this.component.projection.merged || this.projectionNameMap.has(this.getName("projection"))) return this.projectionNameMap.get(this.getName("projection"));
	}
	getScaleComponent(e) {
		/* istanbul ignore next: This is warning for debugging test */
		if (!this.component.scales) throw Error("getScaleComponent cannot be called before parseScale(). Make sure you have called parseScale or use parseUnitModelWithScale().");
		let t = this.component.scales[e];
		return t && !t.merged ? t : this.parent ? this.parent.getScaleComponent(e) : void 0;
	}
	getScaleType(e) {
		let t = this.getScaleComponent(e);
		return t ? t.get("type") : void 0;
	}
	getSelectionComponent(e, t) {
		let n = this.component.selection[e];
		if (!n && this.parent && (n = this.parent.getSelectionComponent(e, t)), !n) throw Error(qG(t));
		return n;
	}
	hasAxisOrientSignalRef() {
		var e, t;
		return ((e = this.component.axes.x) == null ? void 0 : e.some((e) => e.hasOrientSignalRef())) || ((t = this.component.axes.y) == null ? void 0 : t.some((e) => e.hasOrientSignalRef()));
	}
}, G8 = class extends W8 {
	vgField(e, t = {}) {
		let n = this.fieldDef(e);
		if (n) return $(n, t);
	}
	reduceFieldDef(e, t) {
		return TZ(this.getMapping(), (t, n, r) => {
			let i = GX(n);
			return i ? e(t, i, r) : t;
		}, t);
	}
	forEachFieldDef(e, t) {
		wZ(this.getMapping(), (t, n) => {
			let r = GX(t);
			r && e(r, n);
		}, t);
	}
}, K8 = class t extends F1 {
	clone() {
		return new t(null, K(this.transform));
	}
	constructor(t, n) {
		var r, i, a, o;
		super(t), e(this, "transform", void 0), this.transform = n, this.transform = K(n);
		let s = (r = this.transform.as) == null ? [void 0, void 0] : r;
		this.transform.as = [(i = s[0]) == null ? "value" : i, (a = s[1]) == null ? "density" : a];
		let c = (o = this.transform.resolve) == null ? "shared" : o;
		this.transform.resolve = c;
	}
	dependentFields() {
		var e;
		return new Set([this.transform.density, ...(e = this.transform.groupby) == null ? [] : e]);
	}
	producedFields() {
		return new Set(this.transform.as);
	}
	hash() {
		return `DensityTransform ${wH(this.transform)}`;
	}
	assemble() {
		let { density: e, ...t } = this.transform, n = {
			type: "kde",
			field: e,
			...t
		};
		return n.resolve = this.transform.resolve, n;
	}
}, q8 = class t extends F1 {
	clone() {
		return new t(null, K(this.transform));
	}
	constructor(t, n) {
		super(t), e(this, "transform", void 0), this.transform = n, this.transform = K(n);
	}
	dependentFields() {
		return new Set([this.transform.extent]);
	}
	producedFields() {
		return /* @__PURE__ */ new Set([]);
	}
	hash() {
		return `ExtentTransform ${wH(this.transform)}`;
	}
	assemble() {
		let { extent: e, param: t } = this.transform;
		return {
			type: "extent",
			field: e,
			signal: t
		};
	}
}, J8 = class t extends F1 {
	clone() {
		return new t(this.parent, K(this.transform));
	}
	constructor(t, n) {
		super(t), e(this, "transform", void 0), this.transform = n, this.transform = K(n);
		let { flatten: r, as: i = [] } = this.transform;
		this.transform.as = r.map((e, t) => {
			var n;
			return (n = i[t]) == null ? e : n;
		});
	}
	dependentFields() {
		return new Set(this.transform.flatten);
	}
	producedFields() {
		return new Set(this.transform.as);
	}
	hash() {
		return `FlattenTransform ${wH(this.transform)}`;
	}
	assemble() {
		let { flatten: e, as: t } = this.transform;
		return {
			type: "flatten",
			fields: e,
			as: t
		};
	}
}, Y8 = class t extends F1 {
	clone() {
		return new t(null, K(this.transform));
	}
	constructor(t, n) {
		var r, i, a;
		super(t), e(this, "transform", void 0), this.transform = n, this.transform = K(n);
		let o = (r = this.transform.as) == null ? [void 0, void 0] : r;
		this.transform.as = [(i = o[0]) == null ? "key" : i, (a = o[1]) == null ? "value" : a];
	}
	dependentFields() {
		return new Set(this.transform.fold);
	}
	producedFields() {
		return new Set(this.transform.as);
	}
	hash() {
		return `FoldTransform ${wH(this.transform)}`;
	}
	assemble() {
		let { fold: e, as: t } = this.transform;
		return {
			type: "fold",
			fields: e,
			as: t
		};
	}
}, X8 = class t extends F1 {
	clone() {
		return new t(null, K(this.fields), this.geojson, this.signal);
	}
	static parseAll(e, n) {
		if (n.component.projection && !n.component.projection.isFit) return e;
		let r = 0;
		for (let i of [[EU, TU], [OU, DU]]) {
			let a = i.map((e) => {
				let t = KX(n.encoding[e]);
				return Z(t) ? t.field : yX(t) ? { expr: `${t.datum}` } : wX(t) ? { expr: `${t.value}` } : void 0;
			});
			(a[0] || a[1]) && (e = new t(e, a, null, n.getName(`geojson_${r++}`)));
		}
		if (n.channelHasField(NU)) {
			let i = n.typedFieldDef(NU);
			i.type === _J && (e = new t(e, null, i.field, n.getName(`geojson_${r}`)));
		}
		return e;
	}
	constructor(t, n, r, i) {
		super(t), e(this, "fields", void 0), e(this, "geojson", void 0), e(this, "signal", void 0), this.fields = n, this.geojson = r, this.signal = i;
	}
	dependentFields() {
		var e;
		let t = ((e = this.fields) == null ? [] : e).filter(z);
		return new Set([...this.geojson ? [this.geojson] : [], ...t]);
	}
	producedFields() {
		return /* @__PURE__ */ new Set();
	}
	hash() {
		return `GeoJSON ${this.geojson} ${this.signal} ${wH(this.fields)}`;
	}
	assemble() {
		return [...this.geojson ? [{
			type: "filter",
			expr: `isValid(datum["${this.geojson}"])`
		}] : [], {
			type: "geojson",
			...this.fields ? { fields: this.fields } : {},
			...this.geojson ? { geojson: this.geojson } : {},
			signal: this.signal
		}];
	}
}, Z8 = class t extends F1 {
	clone() {
		return new t(null, this.projection, K(this.fields), K(this.as));
	}
	constructor(t, n, r, i) {
		super(t), e(this, "projection", void 0), e(this, "fields", void 0), e(this, "as", void 0), this.projection = n, this.fields = r, this.as = i;
	}
	static parseAll(e, n) {
		if (!n.projectionName()) return e;
		for (let r of [[EU, TU], [OU, DU]]) {
			let i = r.map((e) => {
				let t = KX(n.encoding[e]);
				return Z(t) ? t.field : yX(t) ? { expr: `${t.datum}` } : wX(t) ? { expr: `${t.value}` } : void 0;
			}), a = r[0] === OU ? "2" : "";
			(i[0] || i[1]) && (e = new t(e, n.projectionName(), i, [n.getName(`x${a}`), n.getName(`y${a}`)]));
		}
		return e;
	}
	dependentFields() {
		return new Set(this.fields.filter(z));
	}
	producedFields() {
		return new Set(this.as);
	}
	hash() {
		return `Geopoint ${this.projection} ${wH(this.fields)} ${wH(this.as)}`;
	}
	assemble() {
		return {
			type: "geopoint",
			projection: this.projection,
			fields: this.fields,
			as: this.as
		};
	}
}, Q8 = class t extends F1 {
	clone() {
		return new t(null, K(this.transform));
	}
	constructor(t, n) {
		super(t), e(this, "transform", void 0), this.transform = n;
	}
	dependentFields() {
		var e;
		return new Set([
			this.transform.impute,
			this.transform.key,
			...(e = this.transform.groupby) == null ? [] : e
		]);
	}
	producedFields() {
		return new Set([this.transform.impute]);
	}
	processSequence(e) {
		let { start: t = 0, stop: n, step: r } = e;
		return { signal: `sequence(${[
			t,
			n,
			...r ? [r] : []
		].join(",")})` };
	}
	static makeFromTransform(e, n) {
		return new t(e, n);
	}
	static makeFromEncoding(e, n) {
		let r = n.encoding, i = r.x, a = r.y;
		if (Z(i) && Z(a)) {
			let o = i.impute ? i : a.impute ? a : void 0;
			if (o === void 0) return;
			let s = i.impute ? a : a.impute ? i : void 0, { method: c, value: l, frame: u, keyvals: d } = o.impute, f = EZ(n.mark, r);
			return new t(e, {
				impute: o.field,
				key: s.field,
				...c ? { method: c } : {},
				...l === void 0 ? {} : { value: l },
				...u ? { frame: u } : {},
				...d === void 0 ? {} : { keyvals: d },
				...f.length ? { groupby: f } : {}
			});
		}
		return null;
	}
	hash() {
		return `Impute ${wH(this.transform)}`;
	}
	assemble() {
		let { impute: e, key: t, keyvals: n, method: r, groupby: i, value: a, frame: o = [null, null] } = this.transform, s = {
			type: "impute",
			field: e,
			key: t,
			...n ? { keyvals: M$(n) ? this.processSequence(n) : n } : {},
			method: "value",
			...i ? { groupby: i } : {},
			value: !r || r === "value" ? a : null
		};
		return r && r !== "value" ? [
			s,
			{
				type: "window",
				as: [`imputed_${e}_value`],
				ops: [r],
				fields: [e],
				frame: o,
				ignorePeers: !1,
				...i ? { groupby: i } : {}
			},
			{
				type: "formula",
				expr: `datum.${e} === null ? datum.imputed_${e}_value : datum.${e}`,
				as: e
			}
		] : [s];
	}
}, $8 = class t extends F1 {
	clone() {
		return new t(null, K(this.transform));
	}
	constructor(t, n) {
		var r, i, a;
		super(t), e(this, "transform", void 0), this.transform = n, this.transform = K(n);
		let o = (r = this.transform.as) == null ? [void 0, void 0] : r;
		this.transform.as = [(i = o[0]) == null ? n.on : i, (a = o[1]) == null ? n.loess : a];
	}
	dependentFields() {
		var e;
		return new Set([
			this.transform.loess,
			this.transform.on,
			...(e = this.transform.groupby) == null ? [] : e
		]);
	}
	producedFields() {
		return new Set(this.transform.as);
	}
	hash() {
		return `LoessTransform ${wH(this.transform)}`;
	}
	assemble() {
		let { loess: e, on: t, ...n } = this.transform;
		return {
			type: "loess",
			x: t,
			y: e,
			...n
		};
	}
}, e5 = class t extends F1 {
	clone() {
		return new t(null, K(this.transform), this.secondary);
	}
	constructor(t, n, r) {
		super(t), e(this, "transform", void 0), e(this, "secondary", void 0), this.transform = n, this.secondary = r;
	}
	static make(e, n, r, i) {
		let a = n.component.data.sources, { from: o } = r, s = null;
		if (P$(o)) {
			let e = S5(o.data, a);
			e || (e = new F3(o.data), a.push(e));
			let t = n.getName(`lookup_${i}`);
			s = new I1(e, t, M1.Lookup, n.component.data.outputNodeRefCounts), n.component.data.outputNodes[t] = s;
		} else if (F$(o)) {
			let e = o.param;
			r = {
				as: e,
				...r
			};
			let t;
			try {
				t = n.getSelectionComponent(HH(e), e);
			} catch {
				throw Error(ZG(e));
			}
			if (s = t.materialized, !s) throw Error(QG(e));
		}
		return new t(e, r, s.getSource());
	}
	dependentFields() {
		return new Set([this.transform.lookup]);
	}
	producedFields() {
		return new Set(this.transform.as ? I(this.transform.as) : this.transform.from.fields);
	}
	hash() {
		return `Lookup ${wH({
			transform: this.transform,
			secondary: this.secondary
		})}`;
	}
	assemble() {
		let e;
		if (this.transform.from.fields) e = {
			values: this.transform.from.fields,
			...this.transform.as ? { as: I(this.transform.as) } : {}
		};
		else {
			let t = this.transform.as;
			z(t) || (X(fK), t = "_lookup"), e = { as: [t] };
		}
		return {
			type: "lookup",
			from: this.secondary,
			key: this.transform.from.key,
			fields: [this.transform.lookup],
			...e,
			...this.transform.default ? { default: this.transform.default } : {}
		};
	}
}, t5 = class t extends F1 {
	clone() {
		return new t(null, K(this.transform));
	}
	constructor(t, n) {
		var r, i, a;
		super(t), e(this, "transform", void 0), this.transform = n, this.transform = K(n);
		let o = (r = this.transform.as) == null ? [void 0, void 0] : r;
		this.transform.as = [(i = o[0]) == null ? "prob" : i, (a = o[1]) == null ? "value" : a];
	}
	dependentFields() {
		var e;
		return new Set([this.transform.quantile, ...(e = this.transform.groupby) == null ? [] : e]);
	}
	producedFields() {
		return new Set(this.transform.as);
	}
	hash() {
		return `QuantileTransform ${wH(this.transform)}`;
	}
	assemble() {
		let { quantile: e, ...t } = this.transform;
		return {
			type: "quantile",
			field: e,
			...t
		};
	}
}, n5 = class t extends F1 {
	clone() {
		return new t(null, K(this.transform));
	}
	constructor(t, n) {
		var r, i, a;
		super(t), e(this, "transform", void 0), this.transform = n, this.transform = K(n);
		let o = (r = this.transform.as) == null ? [void 0, void 0] : r;
		this.transform.as = [(i = o[0]) == null ? n.on : i, (a = o[1]) == null ? n.regression : a];
	}
	dependentFields() {
		var e;
		return new Set([
			this.transform.regression,
			this.transform.on,
			...(e = this.transform.groupby) == null ? [] : e
		]);
	}
	producedFields() {
		return new Set(this.transform.as);
	}
	hash() {
		return `RegressionTransform ${wH(this.transform)}`;
	}
	assemble() {
		let { regression: e, on: t, ...n } = this.transform;
		return {
			type: "regression",
			x: t,
			y: e,
			...n
		};
	}
}, r5 = class t extends F1 {
	clone() {
		return new t(null, K(this.transform));
	}
	constructor(t, n) {
		super(t), e(this, "transform", void 0), this.transform = n;
	}
	addDimensions(e) {
		var t;
		this.transform.groupby = jH(((t = this.transform.groupby) == null ? [] : t).concat(e), (e) => e);
	}
	producedFields() {}
	dependentFields() {
		var e;
		return new Set([
			this.transform.pivot,
			this.transform.value,
			...(e = this.transform.groupby) == null ? [] : e
		]);
	}
	hash() {
		return `PivotTransform ${wH(this.transform)}`;
	}
	assemble() {
		let { pivot: e, value: t, groupby: n, limit: r, op: i } = this.transform;
		return {
			type: "pivot",
			field: e,
			value: t,
			...r === void 0 ? {} : { limit: r },
			...i === void 0 ? {} : { op: i },
			...n === void 0 ? {} : { groupby: n }
		};
	}
}, i5 = class t extends F1 {
	clone() {
		return new t(null, K(this.transform));
	}
	constructor(t, n) {
		super(t), e(this, "transform", void 0), this.transform = n;
	}
	dependentFields() {
		return /* @__PURE__ */ new Set();
	}
	producedFields() {
		return /* @__PURE__ */ new Set();
	}
	hash() {
		return `SampleTransform ${wH(this.transform)}`;
	}
	assemble() {
		return {
			type: "sample",
			size: this.transform.sample
		};
	}
};
function a5(e) {
	let t = 0;
	function n(r, i) {
		if (r instanceof F3 && !r.isGenerator && !T1(r.data) && (e.push(i), i = {
			name: null,
			source: i.name,
			transform: []
		}), r instanceof j3 && (r.parent instanceof F3 && !i.source ? (i.format = {
			...i.format,
			parse: r.assembleFormatParse()
		}, i.transform.push(...r.assembleTransforms(!0))) : i.transform.push(...r.assembleTransforms())), r instanceof T3) {
			i.name || (i.name = `data_${t++}`), !i.source || i.transform.length > 0 ? (e.push(i), r.data = i.name) : r.data = i.source, e.push(...r.assemble());
			return;
		}
		switch ((r instanceof N3 || r instanceof P3 || r instanceof $3 || r instanceof R2 || r instanceof m4 || r instanceof Z8 || r instanceof w3 || r instanceof e5 || r instanceof i6 || r instanceof Q3 || r instanceof Y8 || r instanceof J8 || r instanceof K8 || r instanceof $8 || r instanceof t5 || r instanceof n5 || r instanceof M3 || r instanceof i5 || r instanceof r5 || r instanceof q8) && i.transform.push(r.assemble()), (r instanceof x3 || r instanceof z1 || r instanceof Q8 || r instanceof r6 || r instanceof X8) && i.transform.push(...r.assemble()), r instanceof I1 && (i.source && i.transform.length === 0 ? r.setSource(i.source) : r.parent instanceof I1 ? r.setSource(i.name) : (i.name || (i.name = `data_${t++}`), r.setSource(i.name), r.numChildren() === 1 && (e.push(i), i = {
			name: null,
			source: i.name,
			transform: []
		}))), r.numChildren()) {
			case 0:
				r instanceof I1 && (!i.source || i.transform.length > 0) && e.push(i);
				break;
			case 1:
				n(r.children[0], i);
				break;
			default: {
				i.name || (i.name = `data_${t++}`);
				let a = i.name;
				!i.source || i.transform.length > 0 ? e.push(i) : a = i.source;
				for (let e of r.children) n(e, {
					name: null,
					source: a,
					transform: []
				});
				break;
			}
		}
	}
	return n;
}
function o5(e) {
	let t = [], n = a5(t);
	for (let t of e.children) n(t, {
		source: e.name,
		name: null,
		transform: []
	});
	return t;
}
function s5(e, t) {
	let n = [], r = a5(n), i = 0;
	for (let t of e.sources) t.hasName() || (t.dataName = `source_${i++}`), r(t, t.assemble());
	for (let e of n) e.transform.length === 0 && delete e.transform;
	let a = 0;
	for (let [e, t] of n.entries()) {
		var o;
		((o = t.transform) == null ? [] : o).length === 0 && !t.source && n.splice(a++, 0, n.splice(e, 1)[0]);
	}
	for (let t of n) {
		var s;
		for (let n of (s = t.transform) == null ? [] : s) n.type === "lookup" && (n.from = e.outputNodes[n.from].getSource());
	}
	for (let e of n) e.name in t && (e.values = t[e.name]);
	return n;
}
function c5(e) {
	return e === "top" || e === "left" || Y(e) ? "header" : "footer";
}
function l5(e) {
	for (let t of aW) u5(e, t);
	f5(e, "x"), f5(e, "y");
}
function u5(e, t) {
	let { facet: n, config: r, child: i, component: a } = e;
	if (e.channelHasField(t)) {
		var o;
		let s = n[t], c = _4("title", null, r, t), l = BX(s, r, {
			allowDisabling: !0,
			includeDefault: c === void 0 || !!c
		});
		i.component.layoutHeaders[t].title && (l = P(l) ? l.join(", ") : l, l += ` / ${i.component.layoutHeaders[t].title}`, i.component.layoutHeaders[t].title = null);
		let u = _4("labelOrient", s.header, r, t), d = s.header === null ? !1 : tU((o = s.header) == null ? void 0 : o.labels, r.header.labels, !0), f = EH(["bottom", "right"], u) ? "footer" : "header";
		a.layoutHeaders[t] = {
			title: s.header === null ? null : l,
			facetFieldDef: s,
			[f]: t === "facet" ? [] : [d5(e, t, d)]
		};
	}
}
function d5(e, t, n) {
	let r = t === "row" ? "height" : "width";
	return {
		labels: n,
		sizeSignal: e.child.component.layoutSize.get(r) ? e.child.getSizeSignalRef(r) : void 0,
		axes: []
	};
}
function f5(e, t) {
	let { child: n } = e;
	if (n.component.axes[t]) {
		let { layoutHeaders: r, resolve: i } = e.component;
		if (i.axis[t] = z4(i, t), i.axis[t] === "shared") {
			let i = t === "x" ? "column" : "row", a = r[i];
			for (let r of n.component.axes[t]) {
				let t = c5(r.get("orient"));
				a[t] != null || (a[t] = [d5(e, i, !1)]);
				let n = K2(r, "main", e.config, { header: !0 });
				n && a[t][0].axes.push(n), r.mainExtracted = !0;
			}
		}
	}
}
function p5(e) {
	h5(e), g5(e, "width"), g5(e, "height");
}
function m5(e) {
	h5(e);
	let t = e.layout.columns === 1 ? "width" : "childWidth", n = e.layout.columns === void 0 ? "height" : "childHeight";
	g5(e, t), g5(e, n);
}
function h5(e) {
	for (let t of e.children) t.parseLayoutSize();
}
function g5(e, t) {
	let n = I4(t), r = kW(n), i = e.component.resolve, a = e.component.layoutSize, o;
	for (let t of e.children) {
		var s;
		let a = t.component.layoutSize.getWithExplicit(n), c = (s = i.scale[r]) == null ? R4(r, e) : s;
		if (c === "independent" && a.value === "step") {
			o = void 0;
			break;
		}
		if (o) {
			if (c === "independent" && o.value !== a.value) {
				o = void 0;
				break;
			}
			o = C1(o, a, n, "");
		} else o = a;
	}
	if (o) {
		for (let r of e.children) e.renameSignal(r.getName(n), e.getName(t)), r.component.layoutSize.set(n, "merged", !1);
		a.setWithExplicit(t, o);
	} else a.setWithExplicit(t, {
		explicit: !1,
		value: void 0
	});
}
function _5(e) {
	let { size: t, component: n } = e;
	for (let r of TW) {
		let i = _W(r);
		if (t[i] != null && t[i] != null) {
			let e = t[i];
			n.layoutSize.set(i, EQ(e) ? "step" : e, !0);
		} else {
			let t = v5(e, i);
			n.layoutSize.set(i, t, !1);
		}
	}
}
function v5(e, t) {
	let n = t === "width" ? "x" : "y", r = e.config, i = e.getScaleComponent(n);
	if (i) {
		let e = i.get("type"), n = i.get("range");
		if (AJ(e)) {
			let e = NQ(r.view, t);
			return fG(n) || EQ(e) ? "step" : e;
		} else return jQ(r.view, t);
	} else if (e.hasProjection || e.mark === "arc") return jQ(r.view, t);
	else {
		let e = NQ(r.view, t);
		return EQ(e) ? e.step : e;
	}
}
function y5(e, t, n) {
	return $(t, {
		suffix: `by_${$(e)}`,
		...n
	});
}
var b5 = class t extends G8 {
	constructor(t, n, r, i) {
		super(t, "facet", n, r, i, t.resolve), e(this, "facet", void 0), e(this, "child", void 0), e(this, "children", void 0), this.child = F5(t.spec, this, this.getName("child"), void 0, i), this.children = [this.child], this.facet = this.initFacet(t.facet);
	}
	initFacet(e) {
		if (!rX(e)) return { facet: this.initFacetFieldDef(e, "facet") };
		let t = q(e), n = {};
		for (let r of t) {
			if (![fU, pU].includes(r)) {
				X(TK(r, "facet"));
				break;
			}
			let t = e[r];
			if (t.field === void 0) {
				X(CK(t, r));
				break;
			}
			n[r] = this.initFacetFieldDef(t, r);
		}
		return n;
	}
	initFacetFieldDef(e, t) {
		let n = XX(e, t);
		return n.header ? n.header = lG(n.header) : n.header === null && (n.header = null), n;
	}
	channelHasField(e) {
		return J(this.facet, e);
	}
	fieldDef(e) {
		return this.facet[e];
	}
	parseData() {
		this.component.data = T5(this), this.child.parseData();
	}
	parseLayoutSize() {
		h5(this);
	}
	parseSelections() {
		this.child.parseSelections(), this.component.selection = this.child.component.selection, RH(this.component.selection).some((e) => P2(e)) && hq(iK);
	}
	parseMarkGroup() {
		this.child.parseMarkGroup();
	}
	parseAxesAndHeaders() {
		this.child.parseAxesAndHeaders(), l5(this);
	}
	assembleSelectionTopLevelSignals(e) {
		return this.child.assembleSelectionTopLevelSignals(e);
	}
	assembleSignals() {
		return this.child.assembleSignals(), [];
	}
	assembleSelectionData(e) {
		return this.child.assembleSelectionData(e);
	}
	getHeaderLayoutMixins() {
		let e = {};
		for (let t of aW) for (let n of b4) {
			let r = this.component.layoutHeaders[t], i = r[n], { facetFieldDef: a } = r;
			if (a) {
				let n = _4("titleOrient", a.header, this.config, t);
				if (["right", "bottom"].includes(n)) {
					let r = g4(t, n);
					e.titleAnchor != null || (e.titleAnchor = {}), e.titleAnchor[r] = "end";
				}
			}
			if (i != null && i[0]) {
				let i = t === "row" ? "height" : "width", a = n === "header" ? "headerBand" : "footerBand";
				t !== "facet" && !this.child.component.layoutSize.get(i) && (e[a] != null || (e[a] = {}), e[a][t] = .5), r.title && (e.offset != null || (e.offset = {}), e.offset[t === "row" ? "rowTitle" : "columnTitle"] = 10);
			}
		}
		return e;
	}
	assembleDefaultLayout() {
		let { column: e, row: t } = this.facet, n = e ? this.columnDistinctSignal() : t ? 1 : void 0, r = "all";
		return (!t && this.component.resolve.scale.x === "independent" || !e && this.component.resolve.scale.y === "independent") && (r = "none"), {
			...this.getHeaderLayoutMixins(),
			...n ? { columns: n } : {},
			bounds: "full",
			align: r
		};
	}
	assembleLayoutSignals() {
		return this.child.assembleLayoutSignals();
	}
	columnDistinctSignal() {
		if (!(this.parent && this.parent instanceof t)) return { signal: `length(data('${this.getName("column_domain")}'))` };
	}
	assembleGroupStyle() {}
	assembleGroup(e) {
		return this.parent && this.parent instanceof t ? {
			...this.channelHasField("column") ? { encode: { update: { columns: { field: $(this.facet.column, { prefix: "distinct" }) } } } } : {},
			...super.assembleGroup(e)
		} : super.assembleGroup(e);
	}
	getCardinalityAggregateForChild() {
		let e = [], n = [], r = [];
		if (this.child instanceof t) {
			if (this.child.channelHasField("column")) {
				let t = $(this.child.facet.column);
				e.push(t), n.push("distinct"), r.push(`distinct_${t}`);
			}
		} else for (let t of TW) {
			let i = this.child.component.scales[t];
			if (i && !i.merged) {
				let a = i.get("type"), o = i.get("range");
				if (AJ(a) && fG(o)) {
					let i = k6(A6(this.child, t));
					i ? (e.push(i), n.push("distinct"), r.push(`distinct_${i}`)) : X(HG(t));
				}
			}
		}
		return {
			fields: e,
			ops: n,
			as: r
		};
	}
	assembleFacet() {
		let { name: e, data: t } = this.component.data.facetRoot, { row: n, column: r } = this.facet, { fields: i, ops: a, as: o } = this.getCardinalityAggregateForChild(), s = [];
		for (let e of aW) {
			let t = this.facet[e];
			if (t) {
				s.push($(t));
				let { bin: c, sort: l } = t;
				if (rG(c) && s.push($(t, { binSuffix: "end" })), tX(l)) {
					let { field: e, op: s = ZY } = l, c = y5(t, l);
					n && r ? (i.push(c), a.push("max"), o.push(c)) : (i.push(e), a.push(s), o.push(c));
				} else if (P(l)) {
					let n = h4(t, e);
					i.push(n), a.push("max"), o.push(n);
				}
			}
		}
		let c = !!n && !!r;
		return {
			name: e,
			data: t,
			groupby: s,
			...c || i.length > 0 ? { aggregate: {
				...c ? { cross: c } : {},
				...i.length ? {
					fields: i,
					ops: a,
					as: o
				} : {}
			} } : {}
		};
	}
	facetSortFields(e) {
		let { facet: t } = this, n = t[e];
		return n ? tX(n.sort) ? [y5(n, n.sort, { expr: "datum" })] : P(n.sort) ? [h4(n, e, { expr: "datum" })] : [$(n, { expr: "datum" })] : [];
	}
	facetSortOrder(e) {
		let { facet: t } = this, n = t[e];
		if (n) {
			let { sort: e } = n;
			return [(tX(e) ? e.order : !P(e) && e) || "ascending"];
		}
		return [];
	}
	assembleLabelTitle() {
		let { facet: e, config: t } = this;
		if (e.facet) return E4(e.facet, "facet", t);
		let n = {
			row: ["top", "bottom"],
			column: ["left", "right"]
		};
		for (let i of y4) if (e[i]) {
			var r;
			let a = _4("labelOrient", (r = e[i]) == null ? void 0 : r.header, t, i);
			if (n[i].includes(a)) return E4(e[i], i, t);
		}
	}
	assembleMarks() {
		let { child: e } = this, t = this.component.data.facetRoot, n = o5(t), r = e.assembleGroupEncodeEntry(!1), i = this.assembleLabelTitle() || e.assembleTitle(), a = e.assembleGroupStyle();
		return [{
			name: this.getName("cell"),
			type: "group",
			...i ? { title: i } : {},
			...a ? { style: a } : {},
			from: { facet: this.assembleFacet() },
			sort: {
				field: aW.map((e) => this.facetSortFields(e)).flat(),
				order: aW.map((e) => this.facetSortOrder(e)).flat()
			},
			...n.length > 0 ? { data: n } : {},
			...r ? { encode: { update: r } } : {},
			...e.assembleGroup(c0(this, []))
		}];
	}
	getMapping() {
		return this.facet;
	}
};
function x5(e, t) {
	let { row: n, column: r } = t;
	if (n && r) {
		let t = null;
		for (let i of [n, r]) if (tX(i.sort)) {
			let { field: n, op: r = ZY } = i.sort;
			e = t = new Q3(e, {
				joinaggregate: [{
					op: r,
					field: n,
					as: y5(i, i.sort, { forAs: !0 })
				}],
				groupby: [$(i)]
			});
		}
		return t;
	}
	return null;
}
function S5(e, t) {
	for (let o of t) {
		var n, r, i, a;
		let t = o.data;
		if (e.name && o.hasName() && e.name !== o.dataName) continue;
		let s = (n = e.format) == null ? void 0 : n.mesh, c = (r = t.format) == null ? void 0 : r.feature;
		if (s && c) continue;
		let l = (i = e.format) == null ? void 0 : i.feature;
		if ((l || c) && l !== c) continue;
		let u = (a = t.format) == null ? void 0 : a.mesh;
		if (!((s || u) && s !== u)) {
			if (E1(e) && E1(t)) {
				if (uU(e.values, t.values)) return o;
			} else if (T1(e) && T1(t)) {
				if (e.url === t.url) return o;
			} else if (D1(e) && e.name === o.dataName) return o;
		}
	}
	return null;
}
function C5(e, t) {
	if (e.data || !e.parent) {
		if (e.data === null) {
			let e = new F3({ values: [] });
			return t.push(e), e;
		}
		let n = S5(e.data, t);
		if (n) return O1(e.data) || (n.data.format = kH({}, e.data.format, n.data.format)), !n.hasName() && e.data.name && (n.dataName = e.data.name), n;
		{
			let n = new F3(e.data);
			return t.push(n), n;
		}
	} else return e.parent.component.data.facetRoot ? e.parent.component.data.facetRoot : e.parent.component.data.main;
}
function w5(e, t, n) {
	let r = 0;
	for (let o of t.transforms) {
		let s, c;
		if (G$(o)) c = e = new m4(e, o), s = "derived";
		else if (j$(o)) {
			var i;
			let r = O3(o);
			c = e = (i = j3.makeWithAncestors(e, {}, r, n)) == null ? e : i, e = new R2(e, t, o.filter);
		} else if (K$(o)) c = e = x3.makeFromTransform(e, o, t), s = "number";
		else if (J$(o)) s = "date", n.getWithExplicit(o.field).value === void 0 && (e = new j3(e, { [o.field]: s }), n.set(o.field, s, !1)), c = e = z1.makeFromTransform(e, o);
		else if (Y$(o)) c = e = w3.makeFromTransform(e, o), s = "number", M2(t) && (e = new M3(e));
		else if (N$(o)) c = e = e5.make(e, t, o, r++), s = "derived";
		else if (H$(o)) c = e = new i6(e, o), s = "number";
		else if (U$(o)) c = e = new Q3(e, o), s = "number";
		else if (X$(o)) c = e = r6.makeFromTransform(e, o), s = "derived";
		else if (Z$(o)) c = e = new Y8(e, o), s = "derived";
		else if (Q$(o)) c = e = new q8(e, o), s = "derived";
		else if (W$(o)) c = e = new J8(e, o), s = "derived";
		else if (I$(o)) c = e = new r5(e, o), s = "derived";
		else if (V$(o)) e = new i5(e, o);
		else if (q$(o)) c = e = Q8.makeFromTransform(e, o), s = "derived";
		else if (L$(o)) c = e = new K8(e, o), s = "derived";
		else if (R$(o)) c = e = new t5(e, o), s = "derived";
		else if (z$(o)) c = e = new n5(e, o), s = "derived";
		else if (B$(o)) c = e = new $8(e, o), s = "derived";
		else {
			X(dK(o));
			continue;
		}
		if (c && s !== void 0) {
			var a;
			for (let e of (a = c.producedFields()) == null ? [] : a) n.set(e, s, !1);
		}
	}
	return e;
}
function T5(e) {
	var t, n, r;
	let i = C5(e, e.component.data.sources), { outputNodes: a, outputNodeRefCounts: o } = e.component.data, s = e.data, c = !(s && (O1(s) || T1(s) || E1(s))) && e.parent ? e.parent.component.data.ancestorParse.clone() : new w1();
	O1(s) ? (k1(s) ? i = new P3(i, s.sequence) : j1(s) && (i = new N3(i, s.graticule)), c.parseNothing = !0) : (s == null || (t = s.format) == null ? void 0 : t.parse) === null && (c.parseNothing = !0), i = (n = j3.makeExplicit(i, e, c)) == null ? i : n, i = new M3(i);
	let l = e.parent && U8(e.parent);
	if ((B8(e) || V8(e)) && l) {
		var u;
		i = (u = x3.makeFromEncoding(i, e)) == null ? i : u;
	}
	e.transforms.length > 0 && (i = w5(i, e, c));
	let d = A3(e), f = k3(e);
	if (i = (r = j3.makeWithAncestors(i, {}, {
		...d,
		...f
	}, c)) == null ? i : r, B8(e) && (i = X8.parseAll(i, e), i = Z8.parseAll(i, e)), B8(e) || V8(e)) {
		var p;
		if (!l) {
			var m;
			i = (m = x3.makeFromEncoding(i, e)) == null ? i : m;
		}
		i = (p = z1.makeFromEncoding(i, e)) == null ? i : p, i = m4.parseAllForSortIndex(i, e);
	}
	let h = i = E5(M1.Raw, e, i);
	if (B8(e)) {
		var g, _;
		let t = w3.makeFromEncoding(i, e);
		t && (i = t, M2(e) && (i = new M3(i))), i = (g = Q8.makeFromEncoding(i, e)) == null ? i : g, i = (_ = r6.makeFromEncoding(i, e)) == null ? i : _;
	}
	let v, y;
	if (B8(e)) {
		let { markDef: t, mark: n, config: r } = e, { marks: a, scales: o } = y = N1({
			invalid: kG("invalid", t, r),
			isPath: sY(n)
		});
		if (a !== o && o === "include-invalid-values" && (v = i = E5(M1.PreFilterInvalid, e, i)), a === "exclude-invalid-values") {
			var b;
			i = (b = $3.make(i, e, y)) == null ? i : b;
		}
	}
	let x = i = E5(M1.Main, e, i), S;
	if (B8(e) && y) {
		let { marks: t, scales: n } = y;
		if (t === "include-invalid-values" && n === "exclude-invalid-values") {
			var C;
			i = (C = $3.make(i, e, y)) == null ? i : C, S = i = E5(M1.PostFilterInvalid, e, i);
		}
	}
	B8(e) && H2(e, x);
	let w = null;
	if (V8(e)) {
		var T;
		let t = e.getName("facet");
		i = (T = x5(i, e.facet)) == null ? i : T, w = new T3(i, e, t, x.getSource()), a[t] = w;
	}
	return {
		...e.component.data,
		outputNodes: a,
		outputNodeRefCounts: o,
		raw: h,
		main: x,
		facetRoot: w,
		ancestorParse: c,
		preFilterInvalid: v,
		postFilterInvalid: S
	};
}
function E5(e, t, n) {
	let { outputNodes: r, outputNodeRefCounts: i } = t.component.data, a = t.getDataName(e), o = new I1(n, a, e, i);
	return r[a] = o, o;
}
var D5 = class extends W8 {
	constructor(t, n, r, i) {
		var a, o;
		super(t, "concat", n, r, i, t.resolve), e(this, "children", void 0), (((a = t.resolve) == null || (a = a.axis) == null ? void 0 : a.x) === "shared" || ((o = t.resolve) == null || (o = o.axis) == null ? void 0 : o.y) === "shared") && X(sK), this.children = this.getChildren(t).map((e, t) => F5(e, this, this.getName(`concat_${t}`), void 0, i));
	}
	parseData() {
		this.component.data = T5(this);
		for (let e of this.children) e.parseData();
	}
	parseSelections() {
		this.component.selection = {};
		for (let e of this.children) {
			e.parseSelections();
			for (let t of q(e.component.selection)) this.component.selection[t] = e.component.selection[t];
		}
		RH(this.component.selection).some((e) => P2(e)) && hq(iK);
	}
	parseMarkGroup() {
		for (let e of this.children) e.parseMarkGroup();
	}
	parseAxesAndHeaders() {
		for (let e of this.children) e.parseAxesAndHeaders();
	}
	getChildren(e) {
		return CQ(e) ? e.vconcat : wQ(e) ? e.hconcat : e.concat;
	}
	parseLayoutSize() {
		m5(this);
	}
	parseAxisGroup() {
		return null;
	}
	assembleSelectionTopLevelSignals(e) {
		return this.children.reduce((e, t) => t.assembleSelectionTopLevelSignals(e), e);
	}
	assembleSignals() {
		return this.children.forEach((e) => e.assembleSignals()), [];
	}
	assembleLayoutSignals() {
		let e = M4(this);
		for (let t of this.children) e.push(...t.assembleLayoutSignals());
		return e;
	}
	assembleSelectionData(e) {
		return this.children.reduce((e, t) => t.assembleSelectionData(e), e);
	}
	assembleMarks() {
		return this.children.map((e) => {
			let t = e.assembleTitle(), n = e.assembleGroupStyle(), r = e.assembleGroupEncodeEntry(!1);
			return {
				type: "group",
				name: e.getName("group"),
				...t ? { title: t } : {},
				...n ? { style: n } : {},
				...r ? { encode: { update: r } } : {},
				...e.assembleGroup()
			};
		});
	}
	assembleGroupStyle() {}
	assembleDefaultLayout() {
		let e = this.layout.columns;
		return {
			...e == null ? {} : { columns: e },
			bounds: "full",
			align: "each"
		};
	}
};
function cre(e) {
	return e === !1 || e === null;
}
var O5 = q({
	disable: 1,
	gridScale: 1,
	scale: 1,
	...lZ,
	labelExpr: 1,
	encode: 1
}), lre = class t extends v1 {
	constructor(t = {}, n = {}, r = !1) {
		super(), e(this, "explicit", void 0), e(this, "implicit", void 0), e(this, "mainExtracted", void 0), this.explicit = t, this.implicit = n, this.mainExtracted = r;
	}
	clone() {
		return new t(K(this.explicit), K(this.implicit), this.mainExtracted);
	}
	hasAxisPart(e) {
		return e === "axis" ? !0 : e === "grid" || e === "title" ? !!this.get(e) : !cre(this.get(e));
	}
	hasOrientSignalRef() {
		return Y(this.explicit.orient);
	}
};
function ure(e, t, n) {
	var r;
	let { encoding: i, config: a } = e, o = (r = KX(i[t])) == null ? KX(i[gW(t)]) : r, { format: s, formatType: c } = e.axis(t) || {};
	if (RY(c)) return {
		text: HY({
			fieldOrDatumDef: o,
			field: "datum.value",
			format: s,
			formatType: c,
			config: a
		}),
		...n
	};
	if (s === void 0 && c === void 0 && a.customFormatTypes) {
		if (vX(o) === "quantitative") {
			if (EX(o) && o.stack === "normalize" && a.normalizedNumberFormatType) return {
				text: HY({
					fieldOrDatumDef: o,
					field: "datum.value",
					format: a.normalizedNumberFormat,
					formatType: a.normalizedNumberFormatType,
					config: a
				}),
				...n
			};
			if (a.numberFormatType) return {
				text: HY({
					fieldOrDatumDef: o,
					field: "datum.value",
					format: a.numberFormat,
					formatType: a.numberFormatType,
					config: a
				}),
				...n
			};
		}
		if (vX(o) === "temporal" && a.timeFormatType && Z(o) && !o.timeUnit) return {
			text: HY({
				fieldOrDatumDef: o,
				field: "datum.value",
				format: a.timeFormat,
				formatType: a.timeFormatType,
				config: a
			}),
			...n
		};
	}
	return n;
}
function dre(e) {
	return TW.reduce((t, n) => (e.component.scales[n] && (t[n] = [vre(n, e)]), t), {});
}
var fre = {
	bottom: "top",
	top: "bottom",
	left: "right",
	right: "left"
};
function pre(e) {
	let { axes: t, resolve: n } = e.component, r = {
		top: 0,
		bottom: 0,
		right: 0,
		left: 0
	};
	for (let r of e.children) {
		r.parseAxesAndHeaders();
		for (let i of q(r.component.axes)) n.axis[i] = z4(e.component.resolve, i), n.axis[i] === "shared" && (t[i] = mre(t[i], r.component.axes[i]), t[i] || (n.axis[i] = "independent", delete t[i]));
	}
	for (let a of TW) {
		for (let o of e.children) if (o.component.axes[a]) {
			if (n.axis[a] === "independent") {
				var i;
				t[a] = ((i = t[a]) == null ? [] : i).concat(o.component.axes[a]);
				for (let e of o.component.axes[a]) {
					let { value: t, explicit: n } = e.getWithExplicit("orient");
					if (!Y(t)) {
						if (r[t] > 0 && !n) {
							let n = fre[t];
							r[t] > r[n] && e.set("orient", n, !1);
						}
						r[t]++;
					}
				}
			}
			delete o.component.axes[a];
		}
		if (n.axis[a] === "independent" && t[a] && t[a].length > 1) for (let [e, n] of (t[a] || []).entries()) e > 0 && n.get("grid") && !n.explicit.grid && (n.implicit.grid = !1);
	}
}
function mre(e, t) {
	if (e) {
		if (e.length !== t.length) return;
		let n = e.length;
		for (let r = 0; r < n; r++) {
			let n = e[r], i = t[r];
			if (!!n != !!i) return;
			if (n && i) {
				let t = n.getWithExplicit("orient"), a = i.getWithExplicit("orient");
				if (t.explicit && a.explicit && t.value !== a.value) return;
				e[r] = hre(n, i);
			}
		}
	} else return t.map((e) => e.clone());
	return e;
}
function hre(e, t) {
	for (let n of O5) {
		let r = C1(e.getWithExplicit(n), t.getWithExplicit(n), n, "axis", (e, t) => {
			switch (n) {
				case "title": return IG(e, t);
				case "gridScale": return {
					explicit: e.explicit,
					value: tU(e.value, t.value)
				};
			}
			return S1(e, t, n, "axis");
		});
		e.setWithExplicit(n, r);
	}
	return e;
}
function gre(e, t, n, r, i) {
	if (t === "disable") return n !== void 0;
	switch (n = n || {}, t) {
		case "titleAngle":
		case "labelAngle": return e === (Y(n.labelAngle) ? n.labelAngle : sU(n.labelAngle));
		case "values": return !!n.values;
		case "encode": return !!n.encoding || !!n.labelAngle;
		case "title": if (e === d4(r, i)) return !0;
	}
	return e === n[t];
}
var _re = new Set([
	"grid",
	"translate",
	"format",
	"formatType",
	"orient",
	"labelExpr",
	"tickCount",
	"position",
	"tickMinStep"
]);
function vre(e, t) {
	var n, r, i;
	let a = t.axis(e), o = new lre(), s = KX(t.encoding[e]), { mark: c, config: l } = t, u = (a == null ? void 0 : a.orient) || ((n = l[e === "x" ? "axisX" : "axisY"]) == null ? void 0 : n.orient) || ((r = l.axis) == null ? void 0 : r.orient) || c4(e), d = t.getScaleComponent(e).get("type"), f = X2(e, d, u, t.config), p = a === void 0 ? Q2("disable", l.style, a == null ? void 0 : a.style, f).configValue : !a;
	if (o.set("disable", p, a !== void 0), p) return o;
	a = a || {};
	let m = n4(s, a, e, l.style, f), h = WY(a.formatType, s, d), g = UY(s, s.type, a.format, a.formatType, l, !0), _ = {
		fieldOrDatumDef: s,
		axis: a,
		channel: e,
		model: t,
		scaleType: d,
		orient: u,
		labelAngle: m,
		format: g,
		formatType: h,
		mark: c,
		config: l
	};
	for (let n of O5) {
		let r = n in $2 ? $2[n](_) : dZ(n) ? a[n] : void 0, i = r !== void 0, s = gre(r, n, a, t, e);
		if (i && s) o.set(n, r, s);
		else {
			let { configValue: e = void 0, configFrom: t = void 0 } = dZ(n) && n !== "values" ? Q2(n, l.style, a.style, f) : {}, c = e !== void 0;
			i && !c ? o.set(n, r, s) : (t !== "vgAxisConfig" || _re.has(n) && c || oZ(e) || Y(e)) && o.set(n, e, !1);
		}
	}
	let v = (i = a.encoding) == null ? {} : i, y = sZ.reduce((n, r) => {
		var i;
		if (!o.hasAxisPart(r)) return n;
		let a = L4((i = v[r]) == null ? {} : i, t), s = r === "labels" ? ure(t, e, a) : a;
		return s !== void 0 && !LH(s) && (n[r] = { update: s }), n;
	}, {});
	return LH(y) || o.set("encode", y, !!a.encoding || a.labelAngle !== void 0), o;
}
function yre({ encoding: e, size: t }) {
	for (let n of TW) {
		let r = _W(n);
		EQ(t[r]) && bX(e[n]) && (delete t[r], X(UK(r)));
	}
	return t;
}
var bre = {
	vgMark: "arc",
	encodeEntry: (e) => ({
		...i2(e, {
			align: "ignore",
			baseline: "ignore",
			color: "include",
			size: "ignore",
			orient: "ignore",
			theta: "ignore"
		}),
		...z0("x", e, { defaultPos: "mid" }),
		...z0("y", e, { defaultPos: "mid" }),
		...Z0(e, "radius"),
		...Z0(e, "theta")
	})
}, xre = {
	vgMark: "area",
	encodeEntry: (e) => ({
		...i2(e, {
			align: "ignore",
			baseline: "ignore",
			color: "include",
			orient: "include",
			size: "ignore",
			theta: "ignore"
		}),
		...K0("x", e, {
			defaultPos: "zeroOrMin",
			defaultPos2: "zeroOrMin",
			range: e.markDef.orient === "horizontal"
		}),
		...K0("y", e, {
			defaultPos: "zeroOrMin",
			defaultPos2: "zeroOrMin",
			range: e.markDef.orient === "vertical"
		}),
		...s2(e)
	})
}, Sre = {
	vgMark: "rect",
	encodeEntry: (e) => ({
		...i2(e, {
			align: "ignore",
			baseline: "ignore",
			color: "include",
			orient: "ignore",
			size: "ignore",
			theta: "ignore"
		}),
		...Z0(e, "x"),
		...Z0(e, "y")
	})
}, Cre = {
	vgMark: "shape",
	encodeEntry: (e) => ({ ...i2(e, {
		align: "ignore",
		baseline: "ignore",
		color: "include",
		size: "ignore",
		orient: "ignore",
		theta: "ignore"
	}) }),
	postEncodingTransform: (e) => {
		let { encoding: t } = e, n = t.shape;
		return [{
			type: "geoshape",
			projection: e.projectionName(),
			...n && Z(n) && n.type === _J ? { field: $(n, { expr: "datum" }) } : {}
		}];
	}
}, wre = {
	vgMark: "image",
	encodeEntry: (e) => ({
		...i2(e, {
			align: "ignore",
			baseline: "ignore",
			color: "ignore",
			orient: "ignore",
			size: "ignore",
			theta: "ignore"
		}),
		...Z0(e, "x"),
		...Z0(e, "y"),
		...E0(e, "url")
	})
}, Tre = {
	vgMark: "line",
	encodeEntry: (e) => ({
		...i2(e, {
			align: "ignore",
			baseline: "ignore",
			color: "include",
			size: "ignore",
			orient: "ignore",
			theta: "ignore"
		}),
		...z0("x", e, { defaultPos: "mid" }),
		...z0("y", e, { defaultPos: "mid" }),
		...F0("size", e, { vgChannel: "strokeWidth" }),
		...s2(e)
	})
}, Ere = {
	vgMark: "trail",
	encodeEntry: (e) => ({
		...i2(e, {
			align: "ignore",
			baseline: "ignore",
			color: "include",
			size: "include",
			orient: "ignore",
			theta: "ignore"
		}),
		...z0("x", e, { defaultPos: "mid" }),
		...z0("y", e, { defaultPos: "mid" }),
		...F0("size", e),
		...s2(e)
	})
};
function k5(e, t) {
	let { config: n } = e;
	return {
		...i2(e, {
			align: "ignore",
			baseline: "ignore",
			color: "include",
			size: "include",
			orient: "ignore",
			theta: "ignore"
		}),
		...z0("x", e, { defaultPos: "mid" }),
		...z0("y", e, { defaultPos: "mid" }),
		...F0("size", e),
		...F0("angle", e),
		...Dre(e, n, t)
	};
}
function Dre(e, t, n) {
	return n ? { shape: { value: n } } : F0("shape", e);
}
var Ore = {
	vgMark: "symbol",
	encodeEntry: (e) => k5(e)
}, kre = {
	vgMark: "symbol",
	encodeEntry: (e) => k5(e, "circle")
}, Are = {
	vgMark: "symbol",
	encodeEntry: (e) => k5(e, "square")
}, jre = {
	vgMark: "rect",
	encodeEntry: (e) => ({
		...i2(e, {
			align: "ignore",
			baseline: "ignore",
			color: "include",
			orient: "ignore",
			size: "ignore",
			theta: "ignore"
		}),
		...Z0(e, "x"),
		...Z0(e, "y")
	})
}, Mre = {
	vgMark: "rule",
	encodeEntry: (e) => {
		let { markDef: t } = e, n = t.orient;
		return !e.encoding.x && !e.encoding.y && !e.encoding.latitude && !e.encoding.longitude ? {} : {
			...i2(e, {
				align: "ignore",
				baseline: "ignore",
				color: "include",
				orient: "ignore",
				size: "ignore",
				theta: "ignore"
			}),
			...K0("x", e, {
				defaultPos: n === "horizontal" ? "zeroOrMax" : "mid",
				defaultPos2: "zeroOrMin",
				range: n !== "vertical"
			}),
			...K0("y", e, {
				defaultPos: n === "vertical" ? "zeroOrMax" : "mid",
				defaultPos2: "zeroOrMin",
				range: n !== "horizontal"
			}),
			...F0("size", e, { vgChannel: "strokeWidth" })
		};
	}
}, Nre = {
	vgMark: "text",
	encodeEntry: (e) => {
		let { config: t, encoding: n } = e;
		return {
			...i2(e, {
				align: "include",
				baseline: "include",
				color: "include",
				size: "ignore",
				orient: "ignore",
				theta: "include"
			}),
			...z0("x", e, { defaultPos: "mid" }),
			...z0("y", e, { defaultPos: "mid" }),
			...E0(e),
			...F0("size", e, { vgChannel: "fontSize" }),
			...F0("angle", e),
			...c2("align", Pre(e.markDef, n, t)),
			...c2("baseline", Fre(e.markDef, n, t)),
			...z0("radius", e, { defaultPos: null }),
			...z0("theta", e, { defaultPos: null })
		};
	}
};
function Pre(e, t, n) {
	if (kG("align", e, n) === void 0) return "center";
}
function Fre(e, t, n) {
	if (kG("baseline", e, n) === void 0) return "middle";
}
var A5 = {
	arc: bre,
	area: xre,
	bar: Sre,
	circle: kre,
	geoshape: Cre,
	image: wre,
	line: Tre,
	point: Ore,
	rect: jre,
	rule: Mre,
	square: Are,
	text: Nre,
	tick: {
		vgMark: "rect",
		encodeEntry: (e) => {
			let { config: t, markDef: n } = e, r = n.orient, i = r === "horizontal" ? "x" : "y", a = r === "horizontal" ? "y" : "x", o = r === "horizontal" ? "height" : "width";
			return {
				...i2(e, {
					align: "ignore",
					baseline: "ignore",
					color: "include",
					orient: "ignore",
					size: "ignore",
					theta: "ignore"
				}),
				...Z0(e, i),
				...z0(a, e, {
					defaultPos: "mid",
					vgChannel: a === "y" ? "yc" : "xc"
				}),
				[o]: CG(kG("thickness", n, t))
			};
		}
	},
	trail: Ere
};
function Ire(e) {
	if (EH([
		ZJ,
		JJ,
		rY
	], e.mark)) {
		let t = EZ(e.mark, e.encoding);
		if (t.length > 0) return Lre(e, t);
	} else if (e.mark === YJ) {
		let t = vG.some((t) => kG(t, e.markDef, e.config));
		if (e.stack && !e.fieldDef("size") && t) return Rre(e);
	}
	return N5(e);
}
var j5 = "faceted_path_";
function Lre(e, t) {
	return [{
		name: e.getName("pathgroup"),
		type: "group",
		from: { facet: {
			name: j5 + e.requestDataName(M1.Main),
			data: e.requestDataName(M1.Main),
			groupby: t
		} },
		encode: { update: {
			width: { field: { group: "width" } },
			height: { field: { group: "height" } }
		} },
		marks: N5(e, { fromPrefix: j5 })
	}];
}
var M5 = "stack_group_";
function Rre(e) {
	var t;
	let [n] = N5(e, { fromPrefix: M5 }), r = e.scaleName(e.stack.fieldChannel), i = (t = {}) => e.vgField(e.stack.fieldChannel, t), a = (e, t) => `${e}(${[
		i({
			prefix: "min",
			suffix: "start",
			expr: t
		}),
		i({
			prefix: "max",
			suffix: "start",
			expr: t
		}),
		i({
			prefix: "min",
			suffix: "end",
			expr: t
		}),
		i({
			prefix: "max",
			suffix: "end",
			expr: t
		})
	].map((e) => `scale('${r}',${e})`).join(",")})`, o, s;
	e.stack.fieldChannel === "x" ? (o = {
		...SH(n.encode.update, [
			"y",
			"yc",
			"y2",
			"height",
			...vG
		]),
		x: { signal: a("min", "datum") },
		x2: { signal: a("max", "datum") },
		clip: { value: !0 }
	}, s = {
		x: {
			field: { group: "x" },
			mult: -1
		},
		height: { field: { group: "height" } }
	}, n.encode.update = {
		...CH(n.encode.update, [
			"y",
			"yc",
			"y2"
		]),
		height: { field: { group: "height" } }
	}) : (o = {
		...SH(n.encode.update, [
			"x",
			"xc",
			"x2",
			"width"
		]),
		y: { signal: a("min", "datum") },
		y2: { signal: a("max", "datum") },
		clip: { value: !0 }
	}, s = {
		y: {
			field: { group: "y" },
			mult: -1
		},
		width: { field: { group: "width" } }
	}, n.encode.update = {
		...CH(n.encode.update, [
			"x",
			"xc",
			"x2"
		]),
		width: { field: { group: "width" } }
	});
	for (let t of vG) {
		let r = AG(t, e.markDef, e.config);
		n.encode.update[t] ? (o[t] = n.encode.update[t], delete n.encode.update[t]) : r && (o[t] = CG(r)), r && (n.encode.update[t] = { value: 0 });
	}
	let c = [];
	if (((t = e.stack.groupbyChannels) == null ? void 0 : t.length) > 0) for (let t of e.stack.groupbyChannels) {
		let n = e.fieldDef(t), r = $(n);
		r && c.push(r), (n != null && n.bin || n != null && n.timeUnit) && c.push($(n, { binSuffix: "end" }));
	}
	return o = [
		"stroke",
		"strokeWidth",
		"strokeJoin",
		"strokeCap",
		"strokeDash",
		"strokeDashOffset",
		"strokeMiterLimit",
		"strokeOpacity"
	].reduce((t, r) => {
		if (n.encode.update[r]) return {
			...t,
			[r]: n.encode.update[r]
		};
		{
			let n = AG(r, e.markDef, e.config);
			return n === void 0 ? t : {
				...t,
				[r]: CG(n)
			};
		}
	}, o), o.stroke && (o.strokeForeground = { value: !0 }, o.strokeOffset = { value: 0 }), [{
		type: "group",
		from: { facet: {
			data: e.requestDataName(M1.Main),
			name: M5 + e.requestDataName(M1.Main),
			groupby: c,
			aggregate: {
				fields: [
					i({ suffix: "start" }),
					i({ suffix: "start" }),
					i({ suffix: "end" }),
					i({ suffix: "end" })
				],
				ops: [
					"min",
					"max",
					"min",
					"max"
				]
			}
		} },
		encode: { update: o },
		marks: [{
			type: "group",
			encode: { update: s },
			marks: [n]
		}]
	}];
}
function zre(e) {
	let { encoding: t, stack: n, mark: r, markDef: i, config: a } = e, o = t.order;
	if (!(!P(o) && wX(o) && TH(o.value) || !o && TH(kG("order", i, a)))) {
		if ((P(o) || Z(o)) && !n) return NG(o, { expr: "datum" });
		if (sY(r)) {
			let e = i.orient === "horizontal" ? "y" : "x", n = t[e];
			if (Z(n)) return { field: e };
		}
	}
}
function N5(e, t = { fromPrefix: "" }) {
	let { mark: n, markDef: r, encoding: i, config: a } = e, o = tU(r.clip, Bre(e), Vre(e)), s = OG(r), c = i.key, l = zre(e), u = Hre(e);
	if (u && Object.values(e.component.selection).some((e) => e.type === "point" && !e.bind && e.on !== "pointerover")) {
		var d;
		(d = e.markDef).cursor != null || (d.cursor = "pointer");
	}
	let f = kG("aria", r, a), p = A5[n].postEncodingTransform ? A5[n].postEncodingTransform(e) : null;
	return [{
		name: e.getName("marks"),
		type: A5[n].vgMark,
		...o ? { clip: o } : {},
		...s ? { style: s } : {},
		...c ? { key: c.field } : {},
		...l ? { sort: l } : {},
		...u || {},
		...f === !1 ? { aria: f } : {},
		from: { data: t.fromPrefix + e.requestDataName(M1.Main) },
		encode: { update: A5[n].encodeEntry(e) },
		...p ? { transform: p } : {}
	}];
}
function Bre(e) {
	let t = e.getScaleComponent("x"), n = e.getScaleComponent("y");
	return t != null && t.get("selectionExtent") || n != null && n.get("selectionExtent") ? !0 : void 0;
}
function Vre(e) {
	let t = e.component.projection;
	return t && !t.isFit ? !0 : void 0;
}
function Hre(e) {
	if (!e.component.selection) return null;
	let t = q(e.component.selection).length, n = t, r = e.parent;
	for (; r && n === 0;) n = q(r.component.selection).length, r = r.parent;
	return n ? { interactive: t > 0 || e.mark === "geoshape" || !!e.encoding.tooltip || !!e.markDef.tooltip } : null;
}
var P5 = class extends G8 {
	constructor(t, n, r, i = {}, a) {
		var o;
		super(t, "unit", n, r, a, void 0, DQ(t) ? t.view : void 0), e(this, "markDef", void 0), e(this, "encoding", void 0), e(this, "specifiedScales", {}), e(this, "stack", void 0), e(this, "specifiedAxes", {}), e(this, "specifiedLegends", {}), e(this, "specifiedProjection", {}), e(this, "selection", []), e(this, "children", []), e(this, "correctDataNames", (e) => {
			var t, n;
			return (t = e.from) != null && t.data && (e.from.data = this.lookupDataSource(e.from.data), "time" in this.encoding && (e.from.data = e.from.data + J1)), !((n = e.from) == null || (n = n.facet) == null) && n.data && (e.from.facet.data = this.lookupDataSource(e.from.facet.data)), e;
		});
		let s = uY(t.mark) ? { ...t.mark } : { type: t.mark }, c = s.type;
		s.filled === void 0 && (s.filled = p$(s, a, { graticule: t.data && j1(t.data) }));
		let l = this.encoding = xZ(t.encoding || {}, c, s.filled, a);
		this.markDef = l$(s, l, a), this.size = yre({
			encoding: l,
			size: DQ(t) ? {
				...i,
				...t.width === void 0 ? {} : { width: t.width },
				...t.height === void 0 ? {} : { height: t.height }
			} : i
		}), this.stack = c$(this.markDef, l), this.specifiedScales = this.initScales(c, l), this.specifiedAxes = this.initAxes(l), this.specifiedLegends = this.initLegends(l), this.specifiedProjection = t.projection, this.selection = ((o = t.params) == null ? [] : o).filter((e) => yQ(e)), this.alignStackOrderWithColorDomain();
	}
	get hasProjection() {
		let { encoding: e } = this, t = this.mark === oY, n = e && tW.some((t) => Q(e[t]));
		return t || n;
	}
	scaleDomain(e) {
		let t = this.specifiedScales[e];
		return t ? t.domain : void 0;
	}
	axis(e) {
		return this.specifiedAxes[e];
	}
	legend(e) {
		return this.specifiedLegends[e];
	}
	initScales(e, t) {
		return zW.reduce((e, n) => {
			let r = KX(t[n]);
			if (r) {
				var i;
				e[n] = this.initScale((i = r.scale) == null ? {} : i);
			}
			return e;
		}, {});
	}
	initScale(e) {
		let { domain: t, range: n } = e, r = lG(e);
		return P(t) && (r.domain = t.map(xG)), P(n) && (r.range = n.map(xG)), r;
	}
	initAxes(e) {
		return TW.reduce((t, n) => {
			let r = e[n];
			if (Q(r) || n === hU && Q(e.x2) || n === gU && Q(e.y2)) {
				let e = Q(r) ? r.axis : void 0;
				t[n] = e && this.initAxis({ ...e });
			}
			return t;
		}, {});
	}
	initAxis(e) {
		let t = q(e), n = {};
		for (let r of t) {
			let t = e[r];
			n[r] = oZ(t) ? bG(t) : xG(t);
		}
		return n;
	}
	initLegends(e) {
		return FW.reduce((t, n) => {
			let r = KX(e[n]);
			if (r && LW(n)) {
				let e = r.legend;
				t[n] = e && lG(e);
			}
			return t;
		}, {});
	}
	alignStackOrderWithColorDomain() {
		let { color: e, fill: t, order: n, xOffset: r, yOffset: i } = this.encoding, a = t || e, o = Z(a) ? a : void 0, s = o == null ? void 0 : o.field, c = o == null ? void 0 : o.scale, l = o == null ? void 0 : o.type, u = c == null ? void 0 : c.domain, d = r || i, f = Z(d) ? d : void 0, p = `_${s}_sort_index`;
		if (!n && Array.isArray(u) && typeof s == "string" && l === "nominal") if (f && !f.sort) f.sort = u;
		else {
			var m;
			if (!this.stack) return;
			let e = `indexof(${B(u)}, datum['${s}'])`, t = ((m = this.markDef) == null ? void 0 : m.orient) === "horizontal" ? "ascending" : "descending";
			this.transforms.push({
				calculate: e,
				as: p
			}), this.encoding.order = {
				field: p,
				type: "quantitative",
				sort: t
			};
		}
	}
	parseData() {
		this.component.data = T5(this);
	}
	parseLayoutSize() {
		_5(this);
	}
	parseSelections() {
		this.component.selection = z2(this, this.selection);
	}
	parseMarkGroup() {
		this.component.mark = Ire(this);
	}
	parseAxesAndHeaders() {
		this.component.axes = dre(this);
	}
	assembleSelectionTopLevelSignals(e) {
		return l0(this, e);
	}
	assembleSignals() {
		return [...q2(this), ...s0(this, [])];
	}
	assembleSelectionData(e) {
		return u0(this, e);
	}
	assembleLayout() {
		return null;
	}
	assembleLayoutSignals() {
		return M4(this);
	}
	assembleMarks() {
		var e;
		let t = (e = this.component.mark) == null ? [] : e;
		return (!this.parent || !U8(this.parent)) && (t = d0(this, t)), t.map(this.correctDataNames);
	}
	assembleGroupStyle() {
		let { style: e } = this.view || {};
		return e === void 0 ? this.encoding.x || this.encoding.y ? "cell" : "view" : e;
	}
	getMapping() {
		return this.encoding;
	}
	get mark() {
		return this.markDef.type;
	}
	channelHasField(e) {
		return hZ(this.encoding, e);
	}
	fieldDef(e) {
		let t = this.encoding[e];
		return GX(t);
	}
	typedFieldDef(e) {
		let t = this.fieldDef(e);
		return CX(t) ? t : null;
	}
}, Ure = class t extends W8 {
	constructor(n, r, i, a, o) {
		super(n, "layer", r, i, o, n.resolve, n.view), e(this, "children", void 0);
		let s = {
			...a,
			...n.width ? { width: n.width } : {},
			...n.height ? { height: n.height } : {}
		};
		this.children = n.layer.map((e, n) => {
			if (QQ(e)) return new t(e, this, this.getName(`layer_${n}`), s, o);
			if (pZ(e)) return new P5(e, this, this.getName(`layer_${n}`), s, o);
			throw Error(LG(e));
		});
	}
	parseData() {
		this.component.data = T5(this);
		for (let e of this.children) e.parseData();
	}
	parseLayoutSize() {
		p5(this);
	}
	parseSelections() {
		this.component.selection = {};
		for (let e of this.children) {
			e.parseSelections();
			for (let t of q(e.component.selection)) this.component.selection[t] = e.component.selection[t];
		}
		RH(this.component.selection).some((e) => P2(e)) && hq(iK);
	}
	parseMarkGroup() {
		for (let e of this.children) e.parseMarkGroup();
	}
	parseAxesAndHeaders() {
		pre(this);
	}
	assembleSelectionTopLevelSignals(e) {
		return this.children.reduce((e, t) => t.assembleSelectionTopLevelSignals(e), e);
	}
	assembleSignals() {
		return this.children.reduce((e, t) => e.concat(t.assembleSignals()), q2(this));
	}
	assembleLayoutSignals() {
		return this.children.reduce((e, t) => e.concat(t.assembleLayoutSignals()), M4(this));
	}
	assembleSelectionData(e) {
		return this.children.reduce((e, t) => t.assembleSelectionData(e), e);
	}
	assembleGroupStyle() {
		let e = /* @__PURE__ */ new Set();
		for (let t of this.children) for (let n of I(t.assembleGroupStyle())) e.add(n);
		let t = Array.from(e);
		return t.length > 1 ? t : t.length === 1 ? t[0] : void 0;
	}
	assembleTitle() {
		let e = super.assembleTitle();
		if (e) return e;
		for (let t of this.children) if (e = t.assembleTitle(), e) return e;
	}
	assembleLayout() {
		return null;
	}
	assembleMarks() {
		return f0(this, this.children.flatMap((e) => e.assembleMarks()));
	}
	assembleLegends() {
		return this.children.reduce((e, t) => e.concat(t.assembleLegends()), B6(this));
	}
};
function F5(e, t, n, r, i) {
	if (aX(e)) return new b5(e, t, n, i);
	if (QQ(e)) return new Ure(e, t, n, r, i);
	if (pZ(e)) return new P5(e, t, n, r, i);
	if (xQ(e)) return new D5(e, t, n, i);
	throw Error(LG(e));
}
function Wre(e, t = {}) {
	t.logger && pq(t.logger), t.fieldTitle && RX(t.fieldTitle);
	try {
		let n = GQ(hu(t.config, e.config)), r = s1(e, n), i = F5(r, null, "", void 0, n);
		return i.parse(), p6(i.component.data, i), {
			spec: Kre(i, Gre(e, r.autosize, n, i), e.datasets, e.usermeta),
			normalized: r
		};
	} finally {
		t.logger && mq(), t.fieldTitle && zX();
	}
}
function Gre(e, t, n, r) {
	let i = r.component.layoutSize.get("width"), a = r.component.layoutSize.get("height");
	if (t === void 0 ? (t = { type: "pad" }, r.hasAxisOrientSignalRef() && (t.resize = !0)) : z(t) && (t = { type: t }), i && a && m1(t.type)) {
		if (i === "step" && a === "step") X(VG()), t.type = "pad";
		else if (i === "step" || a === "step") {
			let e = i === "step" ? "width" : "height";
			X(VG(kW(e))), t.type = h1(e === "width" ? "height" : "width");
		}
	}
	return {
		...q(t).length === 1 && t.type ? t.type === "pad" ? {} : { autosize: t.type } : { autosize: t },
		..._1(n, !1),
		..._1(e, !0)
	};
}
function Kre(e, t, n = {}, r) {
	let i = e.config ? YQ(e.config) : void 0, a = s5(e.component.data, n), o = e.assembleSelectionData(a), s = e.assembleProjections(), c = e.assembleTitle(), l = e.assembleGroupStyle(), u = e.assembleGroupEncodeEntry(!0), d = e.assembleLayoutSignals();
	d = d.filter((e) => (e.name === "width" || e.name === "height") && e.value !== void 0 ? (t[e.name] = +e.value, !1) : !0);
	let { params: f, ...p } = t;
	return {
		$schema: "https://vega.github.io/schema/vega/v6.json",
		...e.description ? { description: e.description } : {},
		...p,
		...c ? { title: c } : {},
		...l ? { style: l } : {},
		...u ? { encode: { update: u } } : {},
		data: o,
		...s.length > 0 ? { projections: s } : {},
		...e.assembleGroup([
			...d,
			...e.assembleSelectionTopLevelSignals([]),
			...bQ(f)
		]),
		...i ? { config: i } : {},
		...r ? { usermeta: r } : {}
	};
}
var qre = hH.version;
//#endregion
//#region ../../node_modules/.pnpm/vega-schema-url-parser@3.0.2/node_modules/vega-schema-url-parser/dist/parser.modern.js
function I5(e) {
	let [t, n] = /schema\/([\w-]+)\/([\w\.\-]+)\.json$/g.exec(e).slice(1, 3);
	return {
		library: t,
		version: n
	};
}
//#endregion
//#region ../../node_modules/.pnpm/vega-themes@3.0.0_vega-lite@6.4.3_vega@6.2.0__vega@6.2.0/node_modules/vega-themes/build/index.js
var Jre = /* @__PURE__ */ t({
	carbong10: () => Die,
	carbong100: () => kie,
	carbong90: () => Oie,
	carbonwhite: () => Eie,
	dark: () => Xre,
	excel: () => Zre,
	fivethirtyeight: () => eie,
	ggplot2: () => tie,
	googlecharts: () => pie,
	latimes: () => aie,
	powerbi: () => Sie,
	quartz: () => oie,
	urbaninstitute: () => fie,
	version: () => Aie,
	vox: () => sie
}), Yre = { version: "3.0.0" }, L5 = "#fff", R5 = "#888", Xre = {
	background: "#333",
	view: { stroke: R5 },
	title: {
		color: L5,
		subtitleColor: L5
	},
	style: {
		"guide-label": { fill: L5 },
		"guide-title": { fill: L5 }
	},
	axis: {
		domainColor: L5,
		gridColor: R5,
		tickColor: L5
	}
}, z5 = "#4572a7", Zre = {
	background: "#fff",
	arc: { fill: z5 },
	area: { fill: z5 },
	line: {
		stroke: z5,
		strokeWidth: 2
	},
	path: { stroke: z5 },
	rect: { fill: z5 },
	shape: { stroke: z5 },
	symbol: {
		fill: z5,
		strokeWidth: 1.5,
		size: 50
	},
	axis: {
		bandPosition: .5,
		grid: !0,
		gridColor: "#000000",
		gridOpacity: 1,
		gridWidth: .5,
		labelPadding: 10,
		tickSize: 5,
		tickWidth: .5
	},
	axisBand: {
		grid: !1,
		tickExtra: !0
	},
	legend: {
		labelBaseline: "middle",
		labelFontSize: 11,
		symbolSize: 50,
		symbolType: "square"
	},
	range: { category: [
		"#4572a7",
		"#aa4643",
		"#8aa453",
		"#71598e",
		"#4598ae",
		"#d98445",
		"#94aace",
		"#d09393",
		"#b9cc98",
		"#a99cbc"
	] }
}, B5 = "#30a2da", V5 = "#cbcbcb", Qre = "#999", $re = "#333", H5 = "#f0f0f0", U5 = "#333", eie = {
	arc: { fill: B5 },
	area: { fill: B5 },
	axis: {
		domainColor: V5,
		grid: !0,
		gridColor: V5,
		gridWidth: 1,
		labelColor: Qre,
		labelFontSize: 10,
		titleColor: $re,
		tickColor: V5,
		tickSize: 10,
		titleFontSize: 14,
		titlePadding: 10,
		labelPadding: 4
	},
	axisBand: { grid: !1 },
	background: H5,
	group: { fill: H5 },
	legend: {
		labelColor: U5,
		labelFontSize: 11,
		padding: 1,
		symbolSize: 30,
		symbolType: "square",
		titleColor: U5,
		titleFontSize: 14,
		titlePadding: 10
	},
	line: {
		stroke: B5,
		strokeWidth: 2
	},
	path: {
		stroke: B5,
		strokeWidth: .5
	},
	rect: { fill: B5 },
	range: {
		category: [
			"#30a2da",
			"#fc4f30",
			"#e5ae38",
			"#6d904f",
			"#8b8b8b",
			"#b96db8",
			"#ff9e27",
			"#56cc60",
			"#52d2ca",
			"#52689e",
			"#545454",
			"#9fe4f8"
		],
		diverging: [
			"#cc0020",
			"#e77866",
			"#f6e7e1",
			"#d6e8ed",
			"#91bfd9",
			"#1d78b5"
		],
		heatmap: [
			"#d6e8ed",
			"#cee0e5",
			"#91bfd9",
			"#549cc6",
			"#1d78b5"
		]
	},
	point: {
		filled: !0,
		shape: "circle"
	},
	shape: { stroke: B5 },
	bar: {
		binSpacing: 2,
		fill: B5,
		stroke: null
	},
	title: {
		anchor: "start",
		fontSize: 24,
		fontWeight: 600,
		offset: 20
	}
}, W5 = "#000", tie = {
	group: { fill: "#e5e5e5" },
	arc: { fill: W5 },
	area: { fill: W5 },
	line: { stroke: W5 },
	path: { stroke: W5 },
	rect: { fill: W5 },
	shape: { stroke: W5 },
	symbol: {
		fill: W5,
		size: 40
	},
	axis: {
		domain: !1,
		grid: !0,
		gridColor: "#FFFFFF",
		gridOpacity: 1,
		labelColor: "#7F7F7F",
		labelPadding: 4,
		tickColor: "#7F7F7F",
		tickSize: 5.67,
		titleFontSize: 16,
		titleFontWeight: "normal"
	},
	legend: {
		labelBaseline: "middle",
		labelFontSize: 11,
		symbolSize: 40
	},
	range: { category: [
		"#000000",
		"#7F7F7F",
		"#1A1A1A",
		"#999999",
		"#333333",
		"#B0B0B0",
		"#4D4D4D",
		"#C9C9C9",
		"#666666",
		"#DCDCDC"
	] }
}, nie = 22, rie = "normal", G5 = "Benton Gothic, sans-serif", K5 = 11.5, iie = "normal", q5 = "#82c6df", J5 = "Benton Gothic Bold, sans-serif", Y5 = "normal", X5 = 13, Z5 = {
	"category-6": [
		"#ec8431",
		"#829eb1",
		"#c89d29",
		"#3580b1",
		"#adc839",
		"#ab7fb4"
	],
	"fire-7": [
		"#fbf2c7",
		"#f9e39c",
		"#f8d36e",
		"#f4bb6a",
		"#e68a4f",
		"#d15a40",
		"#ab4232"
	],
	"fireandice-6": [
		"#e68a4f",
		"#f4bb6a",
		"#f9e39c",
		"#dadfe2",
		"#a6b7c6",
		"#849eae"
	]
}, aie = {
	background: "#ffffff",
	title: {
		anchor: "start",
		color: "#000000",
		font: J5,
		fontSize: nie,
		fontWeight: rie
	},
	arc: { fill: q5 },
	area: { fill: q5 },
	line: {
		stroke: q5,
		strokeWidth: 2
	},
	path: { stroke: q5 },
	rect: { fill: q5 },
	shape: { stroke: q5 },
	symbol: {
		fill: q5,
		size: 30
	},
	axis: {
		labelFont: G5,
		labelFontSize: K5,
		labelFontWeight: iie,
		titleFont: J5,
		titleFontSize: X5,
		titleFontWeight: Y5
	},
	axisX: {
		labelAngle: 0,
		labelPadding: 4,
		tickSize: 3
	},
	axisY: {
		labelBaseline: "middle",
		maxExtent: 45,
		minExtent: 45,
		tickSize: 2,
		titleAlign: "left",
		titleAngle: 0,
		titleX: -45,
		titleY: -11
	},
	legend: {
		labelFont: G5,
		labelFontSize: K5,
		symbolType: "square",
		titleFont: J5,
		titleFontSize: X5,
		titleFontWeight: Y5
	},
	range: {
		category: Z5["category-6"],
		diverging: Z5["fireandice-6"],
		heatmap: Z5["fire-7"],
		ordinal: Z5["fire-7"],
		ramp: Z5["fire-7"]
	}
}, Q5 = "#ab5787", $5 = "#979797", oie = {
	background: "#f9f9f9",
	arc: { fill: Q5 },
	area: { fill: Q5 },
	line: { stroke: Q5 },
	path: { stroke: Q5 },
	rect: { fill: Q5 },
	shape: { stroke: Q5 },
	symbol: {
		fill: Q5,
		size: 30
	},
	axis: {
		domainColor: $5,
		domainWidth: .5,
		gridWidth: .2,
		labelColor: $5,
		tickColor: $5,
		tickWidth: .2,
		titleColor: $5
	},
	axisBand: { grid: !1 },
	axisX: {
		grid: !0,
		tickSize: 10
	},
	axisY: {
		domain: !1,
		grid: !0,
		tickSize: 0
	},
	legend: {
		labelFontSize: 11,
		padding: 1,
		symbolSize: 30,
		symbolType: "square"
	},
	range: { category: [
		"#ab5787",
		"#51b2e5",
		"#703c5c",
		"#168dd9",
		"#d190b6",
		"#00609f",
		"#d365ba",
		"#154866",
		"#666666",
		"#c4c4c4"
	] }
}, e7 = "#3e5c69", sie = {
	background: "#fff",
	arc: { fill: e7 },
	area: { fill: e7 },
	line: { stroke: e7 },
	path: { stroke: e7 },
	rect: { fill: e7 },
	shape: { stroke: e7 },
	symbol: { fill: e7 },
	axis: {
		domainWidth: .5,
		grid: !0,
		labelPadding: 2,
		tickSize: 5,
		tickWidth: .5,
		titleFontWeight: "normal"
	},
	axisBand: { grid: !1 },
	axisX: { gridWidth: .2 },
	axisY: {
		gridDash: [3],
		gridWidth: .4
	},
	legend: {
		labelFontSize: 11,
		padding: 1,
		symbolType: "square"
	},
	range: { category: [
		"#3e5c69",
		"#6793a6",
		"#182429",
		"#0570b0",
		"#3690c0",
		"#74a9cf",
		"#a6bddb",
		"#e2ddf2"
	] }
}, t7 = "#1696d2", n7 = "#000000", cie = "#FFFFFF", r7 = "Lato", i7 = "Lato", lie = "Lato", uie = "#DEDDDD", die = 18, a7 = {
	"shades-blue": [
		"#CFE8F3",
		"#A2D4EC",
		"#73BFE2",
		"#46ABDB",
		"#1696D2",
		"#12719E",
		"#0A4C6A",
		"#062635"
	],
	"six-groups-cat-1": [
		"#1696d2",
		"#ec008b",
		"#fdbf11",
		"#000000",
		"#d2d2d2",
		"#55b748"
	],
	"six-groups-seq": [
		"#cfe8f3",
		"#a2d4ec",
		"#73bfe2",
		"#46abdb",
		"#1696d2",
		"#12719e"
	],
	"diverging-colors": [
		"#ca5800",
		"#fdbf11",
		"#fdd870",
		"#fff2cf",
		"#cfe8f3",
		"#73bfe2",
		"#1696d2",
		"#0a4c6a"
	]
}, fie = {
	background: cie,
	title: {
		anchor: "start",
		fontSize: die,
		font: r7
	},
	axisX: {
		domain: !0,
		domainColor: n7,
		domainWidth: 1,
		grid: !1,
		labelFontSize: 12,
		labelFont: i7,
		labelAngle: 0,
		tickColor: n7,
		tickSize: 5,
		titleFontSize: 12,
		titlePadding: 10,
		titleFont: r7
	},
	axisY: {
		domain: !1,
		domainWidth: 1,
		grid: !0,
		gridColor: uie,
		gridWidth: 1,
		labelFontSize: 12,
		labelFont: i7,
		labelPadding: 8,
		ticks: !1,
		titleFontSize: 12,
		titlePadding: 10,
		titleFont: r7,
		titleAngle: 0,
		titleY: -10,
		titleX: 18
	},
	legend: {
		labelFontSize: 12,
		labelFont: i7,
		symbolSize: 100,
		titleFontSize: 12,
		titlePadding: 10,
		titleFont: r7,
		orient: "right",
		offset: 10
	},
	view: { stroke: "transparent" },
	range: {
		category: a7["six-groups-cat-1"],
		diverging: a7["diverging-colors"],
		heatmap: a7["diverging-colors"],
		ordinal: a7["six-groups-seq"],
		ramp: a7["shades-blue"]
	},
	area: { fill: t7 },
	rect: { fill: t7 },
	line: {
		color: t7,
		stroke: t7,
		strokeWidth: 5
	},
	trail: {
		color: t7,
		stroke: t7,
		strokeWidth: 0,
		size: 1
	},
	path: {
		stroke: t7,
		strokeWidth: .5
	},
	point: { filled: !0 },
	text: {
		font: lie,
		color: t7,
		fontSize: 11,
		align: "center",
		fontWeight: 400,
		size: 11
	},
	style: { bar: {
		fill: t7,
		stroke: null
	} },
	arc: { fill: t7 },
	shape: { stroke: t7 },
	symbol: {
		fill: t7,
		size: 30
	}
}, o7 = "#3366CC", s7 = "#ccc", c7 = "Arial, sans-serif", pie = {
	arc: { fill: o7 },
	area: { fill: o7 },
	path: { stroke: o7 },
	rect: { fill: o7 },
	shape: { stroke: o7 },
	symbol: { stroke: o7 },
	circle: { fill: o7 },
	background: "#fff",
	padding: {
		top: 10,
		right: 10,
		bottom: 10,
		left: 10
	},
	style: {
		"guide-label": {
			font: c7,
			fontSize: 12
		},
		"guide-title": {
			font: c7,
			fontSize: 12
		},
		"group-title": {
			font: c7,
			fontSize: 12
		}
	},
	title: {
		font: c7,
		fontSize: 14,
		fontWeight: "bold",
		dy: -3,
		anchor: "start"
	},
	axis: {
		gridColor: s7,
		tickColor: s7,
		domain: !1,
		grid: !0
	},
	range: {
		category: [
			"#4285F4",
			"#DB4437",
			"#F4B400",
			"#0F9D58",
			"#AB47BC",
			"#00ACC1",
			"#FF7043",
			"#9E9D24",
			"#5C6BC0",
			"#F06292",
			"#00796B",
			"#C2185B"
		],
		heatmap: [
			"#c6dafc",
			"#5e97f6",
			"#2a56c6"
		]
	}
}, l7 = (e) => e * 1.3333333333333333, u7 = l7(9), d7 = l7(10), f7 = l7(12), p7 = "Segoe UI", m7 = "wf_standard-font, helvetica, arial, sans-serif", h7 = "#252423", g7 = "#605E5C", _7 = "transparent", mie = "#C8C6C4", v7 = "#118DFF", hie = "#12239E", gie = "#E66C37", _ie = "#6B007B", vie = "#E044A7", yie = "#744EC2", bie = "#D9B300", xie = "#D64550", y7 = v7, b7 = "#DEEFFF", x7 = [b7, y7], Sie = {
	view: { stroke: _7 },
	background: _7,
	font: p7,
	header: {
		titleFont: m7,
		titleFontSize: f7,
		titleColor: h7,
		labelFont: p7,
		labelFontSize: d7,
		labelColor: g7
	},
	axis: {
		ticks: !1,
		grid: !1,
		domain: !1,
		labelColor: g7,
		labelFontSize: u7,
		titleFont: m7,
		titleColor: h7,
		titleFontSize: f7,
		titleFontWeight: "normal"
	},
	axisQuantitative: {
		tickCount: 3,
		grid: !0,
		gridColor: mie,
		gridDash: [1, 5],
		labelFlush: !1
	},
	axisBand: { tickExtra: !0 },
	axisX: { labelPadding: 5 },
	axisY: { labelPadding: 10 },
	bar: { fill: v7 },
	line: {
		stroke: v7,
		strokeWidth: 3,
		strokeCap: "round",
		strokeJoin: "round"
	},
	text: {
		font: p7,
		fontSize: u7,
		fill: g7
	},
	arc: { fill: v7 },
	area: {
		fill: v7,
		line: !0,
		opacity: .6
	},
	path: { stroke: v7 },
	rect: { fill: v7 },
	point: {
		fill: v7,
		filled: !0,
		size: 75
	},
	shape: { stroke: v7 },
	symbol: {
		fill: v7,
		strokeWidth: 1.5,
		size: 50
	},
	legend: {
		titleFont: p7,
		titleFontWeight: "bold",
		titleColor: g7,
		labelFont: p7,
		labelFontSize: d7,
		labelColor: g7,
		symbolType: "circle",
		symbolSize: 75
	},
	range: {
		category: [
			v7,
			hie,
			gie,
			_ie,
			vie,
			yie,
			bie,
			xie
		],
		diverging: x7,
		heatmap: x7,
		ordinal: [
			b7,
			"#c7e4ff",
			"#b0d9ff",
			"#9aceff",
			"#83c3ff",
			"#6cb9ff",
			"#55aeff",
			"#3fa3ff",
			"#2898ff",
			y7
		]
	}
}, S7 = "IBM Plex Sans,system-ui,-apple-system,BlinkMacSystemFont,\".sfnstext-regular\",sans-serif", Cie = "IBM Plex Sans Condensed, system-ui, -apple-system, BlinkMacSystemFont, \".SFNSText-Regular\", sans-serif", C7 = 400, w7 = {
	textPrimary: {
		g90: "#f4f4f4",
		g100: "#f4f4f4",
		white: "#161616",
		g10: "#161616"
	},
	textSecondary: {
		g90: "#c6c6c6",
		g100: "#c6c6c6",
		white: "#525252",
		g10: "#525252"
	},
	layerAccent01: {
		white: "#e0e0e0",
		g10: "#e0e0e0",
		g90: "#525252",
		g100: "#393939"
	},
	gridBg: {
		white: "#ffffff",
		g10: "#ffffff",
		g90: "#161616",
		g100: "#161616"
	}
}, wie = [
	"#8a3ffc",
	"#33b1ff",
	"#007d79",
	"#ff7eb6",
	"#fa4d56",
	"#fff1f1",
	"#6fdc8c",
	"#4589ff",
	"#d12771",
	"#d2a106",
	"#08bdba",
	"#bae6ff",
	"#ba4e00",
	"#d4bbff"
], Tie = [
	"#6929c4",
	"#1192e8",
	"#005d5d",
	"#9f1853",
	"#fa4d56",
	"#570408",
	"#198038",
	"#002d9c",
	"#ee538b",
	"#b28600",
	"#009d9a",
	"#012749",
	"#8a3800",
	"#a56eff"
];
function T7({ theme: e, background: t }) {
	let n = ["white", "g10"].includes(e) ? "light" : "dark", r = w7.gridBg[e], i = w7.textPrimary[e], a = w7.textSecondary[e], o = n === "dark" ? wie : Tie, s = n === "dark" ? "#d4bbff" : "#6929c4";
	return {
		background: t,
		arc: { fill: s },
		area: { fill: s },
		path: { stroke: s },
		rect: { fill: s },
		shape: { stroke: s },
		symbol: { stroke: s },
		circle: { fill: s },
		view: {
			fill: r,
			stroke: r
		},
		group: { fill: r },
		title: {
			color: i,
			anchor: "start",
			dy: -15,
			fontSize: 16,
			font: S7,
			fontWeight: 600
		},
		axis: {
			labelColor: a,
			labelFontSize: 12,
			labelFont: Cie,
			labelFontWeight: C7,
			titleColor: i,
			titleFontWeight: 600,
			titleFontSize: 12,
			grid: !0,
			gridColor: w7.layerAccent01[e],
			labelAngle: 0
		},
		axisX: { titlePadding: 10 },
		axisY: { titlePadding: 2.5 },
		style: {
			"guide-label": {
				font: S7,
				fill: a,
				fontWeight: C7
			},
			"guide-title": {
				font: S7,
				fill: a,
				fontWeight: C7
			}
		},
		range: {
			category: o,
			diverging: [
				"#750e13",
				"#a2191f",
				"#da1e28",
				"#fa4d56",
				"#ff8389",
				"#ffb3b8",
				"#ffd7d9",
				"#fff1f1",
				"#e5f6ff",
				"#bae6ff",
				"#82cfff",
				"#33b1ff",
				"#1192e8",
				"#0072c3",
				"#00539a",
				"#003a6d"
			],
			heatmap: [
				"#f6f2ff",
				"#e8daff",
				"#d4bbff",
				"#be95ff",
				"#a56eff",
				"#8a3ffc",
				"#6929c4",
				"#491d8b",
				"#31135e",
				"#1c0f30"
			]
		}
	};
}
var Eie = T7({
	theme: "white",
	background: "#ffffff"
}), Die = T7({
	theme: "g10",
	background: "#f4f4f4"
}), Oie = T7({
	theme: "g90",
	background: "#262626"
}), kie = T7({
	theme: "g100",
	background: "#161616"
}), Aie = Yre.version, jie = { version: "1.0.0" };
function Mie(e, t, n, r) {
	if (P(e)) return `[${e.map((e) => t(z(e) ? e : E7(e, n))).join(", ")}]`;
	if (F(e)) {
		let i = "", { title: a, image: o, ...s } = e;
		a && (i += `<h2>${t(a)}</h2>`), o && (i += `<img src="${new URL(t(o), r || location.href).href}">`);
		let c = Object.keys(s);
		if (c.length > 0) {
			i += "<table>";
			for (let e of c) {
				let r = s[e];
				r !== void 0 && (F(r) && (r = E7(r, n)), i += `<tr><td class="key">${t(e)}</td><td class="value">${t(r)}</td></tr>`);
			}
			i += "</table>";
		}
		return i || "{}";
	}
	return t(e);
}
function Nie(e) {
	let t = [];
	return function(n, r) {
		return typeof r != "object" || !r ? r : (t.length = t.indexOf(this) + 1, t.length > e ? "[Object]" : t.indexOf(r) >= 0 ? "[Circular]" : (t.push(r), r));
	};
}
function E7(e, t) {
	return JSON.stringify(e, Nie(t));
}
var Pie = "#vg-tooltip-element {\n  visibility: hidden;\n  padding: 8px;\n  position: fixed;\n  z-index: 1000;\n  font-family: sans-serif;\n  font-size: 11px;\n  border-radius: 3px;\n  box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);\n  /* The default theme is the light theme. */\n  background-color: rgba(255, 255, 255, 0.95);\n  border: 1px solid #d9d9d9;\n  color: black;\n}\n#vg-tooltip-element.visible {\n  visibility: visible;\n}\n#vg-tooltip-element h2 {\n  margin-top: 0;\n  margin-bottom: 10px;\n  font-size: 13px;\n}\n#vg-tooltip-element table {\n  border-spacing: 0;\n}\n#vg-tooltip-element table tr {\n  border: none;\n}\n#vg-tooltip-element table tr td {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  padding-top: 2px;\n  padding-bottom: 2px;\n}\n#vg-tooltip-element table tr td.key {\n  color: #808080;\n  max-width: 150px;\n  text-align: right;\n  padding-right: 4px;\n}\n#vg-tooltip-element table tr td.value {\n  display: block;\n  max-width: 300px;\n  max-height: 7em;\n  text-align: left;\n}\n#vg-tooltip-element.dark-theme {\n  background-color: rgba(32, 32, 32, 0.9);\n  border: 1px solid #f5f5f5;\n  color: white;\n}\n#vg-tooltip-element.dark-theme td.key {\n  color: #bfbfbf;\n}\n", D7 = "vg-tooltip-element", Fie = {
	offsetX: 10,
	offsetY: 10,
	id: D7,
	styleId: "vega-tooltip-style",
	theme: "light",
	disableDefaultStyle: !1,
	sanitize: Iie,
	maxDepth: 2,
	formatTooltip: Mie,
	baseURL: "",
	anchor: "cursor",
	position: [
		"top",
		"bottom",
		"left",
		"right",
		"top-left",
		"top-right",
		"bottom-left",
		"bottom-right"
	]
};
function Iie(e) {
	return String(e).replace(/&/g, "&amp;").replace(/</g, "&lt;");
}
function Lie(e) {
	if (!/^[A-Za-z]+[-:.\w]*$/.test(e)) throw Error("Invalid HTML ID");
	return Pie.toString().replaceAll(D7, e);
}
function O7(e, t, { offsetX: n, offsetY: r }) {
	let i = k7({
		x1: e.clientX,
		x2: e.clientX,
		y1: e.clientY,
		y2: e.clientY
	}, t, n, r);
	for (let e of [
		"bottom-right",
		"bottom-left",
		"top-right",
		"top-left"
	]) if (A7(i[e], t)) return i[e];
	return i["top-left"];
}
function Rie(e, t, n, r, i) {
	let { position: a, offsetX: o, offsetY: s } = i, c = e._el.getBoundingClientRect(), l = e._origin, u = k7(zie(c, l, n), r, o, s), d = Array.isArray(a) ? a : [a];
	for (let e of d) if (A7(u[e], r) && !Bie(t, u[e], r)) return u[e];
	return O7(t, r, i);
}
function zie(e, t, n) {
	let r = n.isVoronoi ? n.datum.bounds : n.bounds, i = e.left + t[0] + r.x1, a = e.top + t[1] + r.y1, o = n;
	for (; o.mark.group;) {
		var s, c;
		o = o.mark.group, i += (s = o.x) == null ? 0 : s, a += (c = o.y) == null ? 0 : c;
	}
	let l = r.x2 - r.x1, u = r.y2 - r.y1;
	return {
		x1: i,
		x2: i + l,
		y1: a,
		y2: a + u
	};
}
function k7(e, t, n, r) {
	let i = (e.x1 + e.x2) / 2, a = (e.y1 + e.y2) / 2, o = e.x1 - t.width - n, s = i - t.width / 2, c = e.x2 + n, l = e.y1 - t.height - r, u = a - t.height / 2, d = e.y2 + r;
	return {
		top: {
			x: s,
			y: l
		},
		bottom: {
			x: s,
			y: d
		},
		left: {
			x: o,
			y: u
		},
		right: {
			x: c,
			y: u
		},
		"top-left": {
			x: o,
			y: l
		},
		"top-right": {
			x: c,
			y: l
		},
		"bottom-left": {
			x: o,
			y: d
		},
		"bottom-right": {
			x: c,
			y: d
		}
	};
}
function A7(e, t) {
	return e.x >= 0 && e.y >= 0 && e.x + t.width <= window.innerWidth && e.y + t.height <= window.innerHeight;
}
function Bie(e, t, n) {
	return e.clientX >= t.x && e.clientX <= t.x + n.width && e.clientY >= t.y && e.clientY <= t.y + n.height;
}
var Vie = class {
	constructor(t) {
		e(this, "call", void 0), e(this, "options", void 0), e(this, "el", void 0), this.options = {
			...Fie,
			...t
		};
		let n = this.options.id;
		if (this.el = null, this.call = this.tooltipHandler.bind(this), !this.options.disableDefaultStyle && !document.getElementById(this.options.styleId)) {
			let e = document.createElement("style");
			e.setAttribute("id", this.options.styleId), e.innerHTML = Lie(n);
			let t = document.head;
			t.childNodes.length > 0 ? t.insertBefore(e, t.childNodes[0]) : t.appendChild(e);
		}
	}
	tooltipHandler(e, t, n, r) {
		if (this.el = document.getElementById(this.options.id), !this.el) {
			var i;
			this.el = document.createElement("div"), this.el.setAttribute("id", this.options.id), this.el.classList.add("vg-tooltip"), ((i = document.fullscreenElement) == null ? document.body : i).appendChild(this.el);
		}
		if (r == null || r === "") {
			this.el.classList.remove("visible", `${this.options.theme}-theme`);
			return;
		}
		this.el.innerHTML = this.options.formatTooltip(r, this.options.sanitize, this.options.maxDepth, this.options.baseURL), this.el.classList.add("visible", `${this.options.theme}-theme`);
		let { x: a, y: o } = this.options.anchor === "mark" ? Rie(e, t, n, this.el.getBoundingClientRect(), this.options) : O7(t, this.el.getBoundingClientRect(), this.options);
		this.el.style.top = `${o}px`, this.el.style.left = `${a}px`;
	}
};
jie.version;
//#endregion
//#region ../../node_modules/.pnpm/vega-embed@7.1.0_vega-lite@6.4.3_vega@6.2.0__vega@6.2.0/node_modules/vega-embed/build/embed.js
var j7, Hie = (function() {
	var e = function(t, n) {
		return e = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(e, t) {
			e.__proto__ = t;
		} || function(e, t) {
			for (var n in t) t.hasOwnProperty(n) && (e[n] = t[n]);
		}, e(t, n);
	};
	return function(t, n) {
		e(t, n);
		function r() {
			this.constructor = t;
		}
		t.prototype = n === null ? Object.create(n) : (r.prototype = n.prototype, new r());
	};
})(), Uie = Object.prototype.hasOwnProperty;
function M7(e, t) {
	return Uie.call(e, t);
}
function N7(e) {
	if (Array.isArray(e)) {
		for (var t = Array(e.length), n = 0; n < t.length; n++) t[n] = "" + n;
		return t;
	}
	if (Object.keys) return Object.keys(e);
	var r = [];
	for (var i in e) M7(e, i) && r.push(i);
	return r;
}
function P7(e) {
	switch (typeof e) {
		case "object": return JSON.parse(JSON.stringify(e));
		case "undefined": return null;
		default: return e;
	}
}
function F7(e) {
	for (var t = 0, n = e.length, r; t < n;) {
		if (r = e.charCodeAt(t), r >= 48 && r <= 57) {
			t++;
			continue;
		}
		return !1;
	}
	return !0;
}
function I7(e) {
	return e.indexOf("/") === -1 && e.indexOf("~") === -1 ? e : e.replace(/~/g, "~0").replace(/\//g, "~1");
}
function L7(e) {
	return e.replace(/~1/g, "/").replace(/~0/g, "~");
}
function R7(e) {
	if (e === void 0) return !0;
	if (e) {
		if (Array.isArray(e)) {
			for (var t = 0, n = e.length; t < n; t++) if (R7(e[t])) return !0;
		} else if (typeof e == "object") {
			for (var r = N7(e), i = r.length, a = 0; a < i; a++) if (R7(e[r[a]])) return !0;
		}
	}
	return !1;
}
function z7(e, t) {
	var n = [e];
	for (var r in t) {
		var i = typeof t[r] == "object" ? JSON.stringify(t[r], null, 2) : t[r];
		i !== void 0 && n.push(r + ": " + i);
	}
	return n.join("\n");
}
var B7 = function(e) {
	Hie(t, e);
	function t(t, n, r, i, a) {
		var o = this.constructor, s = e.call(this, z7(t, {
			name: n,
			index: r,
			operation: i,
			tree: a
		})) || this;
		return s.name = n, s.index = r, s.operation = i, s.tree = a, Object.setPrototypeOf(s, o.prototype), s.message = z7(t, {
			name: n,
			index: r,
			operation: i,
			tree: a
		}), s;
	}
	return t;
}(Error), V7 = B7, Wie = P7, H7 = {
	add: function(e, t, n) {
		return e[t] = this.value, { newDocument: n };
	},
	remove: function(e, t, n) {
		var r = e[t];
		return delete e[t], {
			newDocument: n,
			removed: r
		};
	},
	replace: function(e, t, n) {
		var r = e[t];
		return e[t] = this.value, {
			newDocument: n,
			removed: r
		};
	},
	move: function(e, t, n) {
		var r = U7(n, this.path);
		r && (r = P7(r));
		var i = W7(n, {
			op: "remove",
			path: this.from
		}).removed;
		return W7(n, {
			op: "add",
			path: this.path,
			value: i
		}), {
			newDocument: n,
			removed: r
		};
	},
	copy: function(e, t, n) {
		var r = U7(n, this.from);
		return W7(n, {
			op: "add",
			path: this.path,
			value: P7(r)
		}), { newDocument: n };
	},
	test: function(e, t, n) {
		return {
			newDocument: n,
			test: J7(e[t], this.value)
		};
	},
	_get: function(e, t, n) {
		return this.value = e[t], { newDocument: n };
	}
}, Gie = {
	add: function(e, t, n) {
		return F7(t) ? e.splice(t, 0, this.value) : e[t] = this.value, {
			newDocument: n,
			index: t
		};
	},
	remove: function(e, t, n) {
		return {
			newDocument: n,
			removed: e.splice(t, 1)[0]
		};
	},
	replace: function(e, t, n) {
		var r = e[t];
		return e[t] = this.value, {
			newDocument: n,
			removed: r
		};
	},
	move: H7.move,
	copy: H7.copy,
	test: H7.test,
	_get: H7._get
};
function U7(e, t) {
	if (t == "") return e;
	var n = {
		op: "_get",
		path: t
	};
	return W7(e, n), n.value;
}
function W7(e, t, n, r, i, a) {
	if (n === void 0 && (n = !1), r === void 0 && (r = !0), i === void 0 && (i = !0), a === void 0 && (a = 0), n && (typeof n == "function" ? n(t, 0, e, t.path) : K7(t, 0)), t.path === "") {
		var o = { newDocument: e };
		if (t.op === "add") return o.newDocument = t.value, o;
		if (t.op === "replace") return o.newDocument = t.value, o.removed = e, o;
		if (t.op === "move" || t.op === "copy") return o.newDocument = U7(e, t.from), t.op === "move" && (o.removed = e), o;
		if (t.op === "test") {
			if (o.test = J7(e, t.value), o.test === !1) throw new V7("Test operation failed", "TEST_OPERATION_FAILED", a, t, e);
			return o.newDocument = e, o;
		} else if (t.op === "remove") return o.removed = e, o.newDocument = null, o;
		else if (t.op === "_get") return t.value = e, o;
		else if (n) throw new V7("Operation `op` property is not one of operations defined in RFC-6902", "OPERATION_OP_INVALID", a, t, e);
		else return o;
	} else {
		r || (e = P7(e));
		var s = (t.path || "").split("/"), c = e, l = 1, u = s.length, d = void 0, f = void 0, p = void 0;
		for (p = typeof n == "function" ? n : K7;;) {
			if (f = s[l], f && f.indexOf("~") != -1 && (f = L7(f)), i && (f == "__proto__" || f == "prototype" && l > 0 && s[l - 1] == "constructor")) throw TypeError("JSON-Patch: modifying `__proto__` or `constructor/prototype` prop is banned for security reasons, if this was on purpose, please set `banPrototypeModifications` flag false and pass it to this function. More info in fast-json-patch README");
			if (n && d === void 0 && (c[f] === void 0 ? d = s.slice(0, l).join("/") : l == u - 1 && (d = t.path), d !== void 0 && p(t, 0, e, d)), l++, Array.isArray(c)) {
				if (f === "-") f = c.length;
				else if (n && !F7(f)) throw new V7("Expected an unsigned base-10 integer value, making the new referenced value the array element with the zero-based index", "OPERATION_PATH_ILLEGAL_ARRAY_INDEX", a, t, e);
				else F7(f) && (f = ~~f);
				if (l >= u) {
					if (n && t.op === "add" && f > c.length) throw new V7("The specified index MUST NOT be greater than the number of elements in the array", "OPERATION_VALUE_OUT_OF_BOUNDS", a, t, e);
					var o = Gie[t.op].call(t, c, f, e);
					if (o.test === !1) throw new V7("Test operation failed", "TEST_OPERATION_FAILED", a, t, e);
					return o;
				}
			} else if (l >= u) {
				var o = H7[t.op].call(t, c, f, e);
				if (o.test === !1) throw new V7("Test operation failed", "TEST_OPERATION_FAILED", a, t, e);
				return o;
			}
			if (c = c[f], n && l < u && (!c || typeof c != "object")) throw new V7("Cannot perform operation at the desired path", "OPERATION_PATH_UNRESOLVABLE", a, t, e);
		}
	}
}
function G7(e, t, n, r, i) {
	if (r === void 0 && (r = !0), i === void 0 && (i = !0), n && !Array.isArray(t)) throw new V7("Patch sequence must be an array", "SEQUENCE_NOT_AN_ARRAY");
	r || (e = P7(e));
	for (var a = Array(t.length), o = 0, s = t.length; o < s; o++) a[o] = W7(e, t[o], n, !0, i, o), e = a[o].newDocument;
	return a.newDocument = e, a;
}
function Kie(e, t, n) {
	var r = W7(e, t);
	if (r.test === !1) throw new V7("Test operation failed", "TEST_OPERATION_FAILED", n, t, e);
	return r.newDocument;
}
function K7(e, t, n, r) {
	if (typeof e != "object" || !e || Array.isArray(e)) throw new V7("Operation is not an object", "OPERATION_NOT_AN_OBJECT", t, e, n);
	if (!H7[e.op]) throw new V7("Operation `op` property is not one of operations defined in RFC-6902", "OPERATION_OP_INVALID", t, e, n);
	if (typeof e.path != "string") throw new V7("Operation `path` property is not a string", "OPERATION_PATH_INVALID", t, e, n);
	if (e.path.indexOf("/") !== 0 && e.path.length > 0) throw new V7("Operation `path` property must start with \"/\"", "OPERATION_PATH_INVALID", t, e, n);
	if ((e.op === "move" || e.op === "copy") && typeof e.from != "string") throw new V7("Operation `from` property is not present (applicable in `move` and `copy` operations)", "OPERATION_FROM_REQUIRED", t, e, n);
	if ((e.op === "add" || e.op === "replace" || e.op === "test") && e.value === void 0) throw new V7("Operation `value` property is not present (applicable in `add`, `replace` and `test` operations)", "OPERATION_VALUE_REQUIRED", t, e, n);
	if ((e.op === "add" || e.op === "replace" || e.op === "test") && R7(e.value)) throw new V7("Operation `value` property is not present (applicable in `add`, `replace` and `test` operations)", "OPERATION_VALUE_CANNOT_CONTAIN_UNDEFINED", t, e, n);
	if (n) {
		if (e.op == "add") {
			var i = e.path.split("/").length, a = r.split("/").length;
			if (i !== a + 1 && i !== a) throw new V7("Cannot perform an `add` operation at the desired path", "OPERATION_PATH_CANNOT_ADD", t, e, n);
		} else if (e.op === "replace" || e.op === "remove" || e.op === "_get") {
			if (e.path !== r) throw new V7("Cannot perform the operation at a path that does not exist", "OPERATION_PATH_UNRESOLVABLE", t, e, n);
		} else if (e.op === "move" || e.op === "copy") {
			var o = q7([{
				op: "_get",
				path: e.from,
				value: void 0
			}], n);
			if (o && o.name === "OPERATION_PATH_UNRESOLVABLE") throw new V7("Cannot perform the operation from a path that does not exist", "OPERATION_FROM_UNRESOLVABLE", t, e, n);
		}
	}
}
function q7(e, t, n) {
	try {
		if (!Array.isArray(e)) throw new V7("Patch sequence must be an array", "SEQUENCE_NOT_AN_ARRAY");
		if (t) G7(P7(t), P7(e), n || !0);
		else {
			n = n || K7;
			for (var r = 0; r < e.length; r++) n(e[r], r, t, void 0);
		}
	} catch (e) {
		if (e instanceof V7) return e;
		throw e;
	}
}
function J7(e, t) {
	if (e === t) return !0;
	if (e && t && typeof e == "object" && typeof t == "object") {
		var n = Array.isArray(e), r = Array.isArray(t), i, a, o;
		if (n && r) {
			if (a = e.length, a != t.length) return !1;
			for (i = a; i-- !== 0;) if (!J7(e[i], t[i])) return !1;
			return !0;
		}
		if (n != r) return !1;
		var s = Object.keys(e);
		if (a = s.length, a !== Object.keys(t).length) return !1;
		for (i = a; i-- !== 0;) if (!t.hasOwnProperty(s[i])) return !1;
		for (i = a; i-- !== 0;) if (o = s[i], !J7(e[o], t[o])) return !1;
		return !0;
	}
	return e !== e && t !== t;
}
var qie = /* @__PURE__ */ Object.freeze({
	__proto__: null,
	JsonPatchError: V7,
	_areEquals: J7,
	applyOperation: W7,
	applyPatch: G7,
	applyReducer: Kie,
	deepClone: Wie,
	getValueByPointer: U7,
	validate: q7,
	validator: K7
}), Y7 = /* @__PURE__ */ new WeakMap(), Jie = function() {
	function e(e) {
		this.observers = /* @__PURE__ */ new Map(), this.obj = e;
	}
	return e;
}(), Yie = function() {
	function e(e, t) {
		this.callback = e, this.observer = t;
	}
	return e;
}();
function Xie(e) {
	return Y7.get(e);
}
function Zie(e, t) {
	return e.observers.get(t);
}
function Qie(e, t) {
	e.observers.delete(t.callback);
}
function $ie(e, t) {
	t.unobserve();
}
function eae(e, t) {
	var n = [], r, i = Xie(e);
	if (!i) i = new Jie(e), Y7.set(e, i);
	else {
		var a = Zie(i, t);
		r = a && a.observer;
	}
	if (r) return r;
	if (r = {}, i.value = P7(e), t) {
		r.callback = t, r.next = null;
		var o = function() {
			X7(r);
		}, s = function() {
			clearTimeout(r.next), r.next = setTimeout(o);
		};
		typeof window < "u" && (window.addEventListener("mouseup", s), window.addEventListener("keyup", s), window.addEventListener("mousedown", s), window.addEventListener("keydown", s), window.addEventListener("change", s));
	}
	return r.patches = n, r.object = e, r.unobserve = function() {
		X7(r), clearTimeout(r.next), Qie(i, r), typeof window < "u" && (window.removeEventListener("mouseup", s), window.removeEventListener("keyup", s), window.removeEventListener("mousedown", s), window.removeEventListener("keydown", s), window.removeEventListener("change", s));
	}, i.observers.set(t, new Yie(t, r)), r;
}
function X7(e, t) {
	t === void 0 && (t = !1);
	var n = Y7.get(e.object);
	Z7(n.value, e.object, e.patches, "", t), e.patches.length && G7(n.value, e.patches);
	var r = e.patches;
	return r.length > 0 && (e.patches = [], e.callback && e.callback(r)), r;
}
function Z7(e, t, n, r, i) {
	if (t !== e) {
		typeof t.toJSON == "function" && (t = t.toJSON());
		for (var a = N7(t), o = N7(e), s = !1, c = o.length - 1; c >= 0; c--) {
			var l = o[c], u = e[l];
			if (M7(t, l) && !(t[l] === void 0 && u !== void 0 && Array.isArray(t) === !1)) {
				var d = t[l];
				typeof u == "object" && u && typeof d == "object" && d && Array.isArray(u) === Array.isArray(d) ? Z7(u, d, n, r + "/" + I7(l), i) : u !== d && (i && n.push({
					op: "test",
					path: r + "/" + I7(l),
					value: P7(u)
				}), n.push({
					op: "replace",
					path: r + "/" + I7(l),
					value: P7(d)
				}));
			} else Array.isArray(e) === Array.isArray(t) ? (i && n.push({
				op: "test",
				path: r + "/" + I7(l),
				value: P7(u)
			}), n.push({
				op: "remove",
				path: r + "/" + I7(l)
			}), s = !0) : (i && n.push({
				op: "test",
				path: r,
				value: e
			}), n.push({
				op: "replace",
				path: r,
				value: t
			}));
		}
		if (!(!s && a.length == o.length)) for (var c = 0; c < a.length; c++) {
			var l = a[c];
			!M7(e, l) && t[l] !== void 0 && n.push({
				op: "add",
				path: r + "/" + I7(l),
				value: P7(t[l])
			});
		}
	}
}
function tae(e, t, n) {
	n === void 0 && (n = !1);
	var r = [];
	return Z7(e, t, r, "", n), r;
}
Object.assign({}, qie, /* @__PURE__ */ Object.freeze({
	__proto__: null,
	compare: tae,
	generate: X7,
	observe: eae,
	unobserve: $ie
}), {
	JsonPatchError: B7,
	deepClone: P7,
	escapePathComponent: I7,
	unescapePathComponent: L7
});
function nae(e) {
	return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
var Q7, $7;
function rae() {
	if ($7) return Q7;
	$7 = 1;
	class e {
		constructor() {
			this.max = 1e3, this.map = /* @__PURE__ */ new Map();
		}
		get(e) {
			let t = this.map.get(e);
			if (t !== void 0) return this.map.delete(e), this.map.set(e, t), t;
		}
		delete(e) {
			return this.map.delete(e);
		}
		set(e, t) {
			if (!this.delete(e) && t !== void 0) {
				if (this.map.size >= this.max) {
					let e = this.map.keys().next().value;
					this.delete(e);
				}
				this.map.set(e, t);
			}
			return this;
		}
	}
	return Q7 = e, Q7;
}
var e9, t9;
function n9() {
	if (t9) return e9;
	t9 = 1;
	let e = Object.freeze({ loose: !0 }), t = Object.freeze({});
	return e9 = (n) => n ? typeof n == "object" ? n : e : t, e9;
}
var r9 = { exports: {} }, i9, a9;
function o9() {
	return a9 ? i9 : (a9 = 1, i9 = {
		MAX_LENGTH: 256,
		MAX_SAFE_COMPONENT_LENGTH: 16,
		MAX_SAFE_BUILD_LENGTH: 250,
		MAX_SAFE_INTEGER: 2 ** 53 - 1 || 9007199254740991,
		RELEASE_TYPES: [
			"major",
			"premajor",
			"minor",
			"preminor",
			"patch",
			"prepatch",
			"prerelease"
		],
		SEMVER_SPEC_VERSION: "2.0.0",
		FLAG_INCLUDE_PRERELEASE: 1,
		FLAG_LOOSE: 2
	}, i9);
}
var s9, c9;
function l9() {
	return c9 ? s9 : (c9 = 1, s9 = typeof process == "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? (...e) => console.error("SEMVER", ...e) : () => {}, s9);
}
var u9;
function d9() {
	return u9 ? r9.exports : (u9 = 1, (function(e, t) {
		let { MAX_SAFE_COMPONENT_LENGTH: n, MAX_SAFE_BUILD_LENGTH: r, MAX_LENGTH: i } = o9(), a = l9();
		t = e.exports = {};
		let o = t.re = [], s = t.safeRe = [], c = t.src = [], l = t.safeSrc = [], u = t.t = {}, d = 0, f = "[a-zA-Z0-9-]", p = [
			["\\s", 1],
			["\\d", i],
			[f, r]
		], m = (e) => {
			for (let [t, n] of p) e = e.split(`${t}*`).join(`${t}{0,${n}}`).split(`${t}+`).join(`${t}{1,${n}}`);
			return e;
		}, h = (e, t, n) => {
			let r = m(t), i = d++;
			a(e, i, t), u[e] = i, c[i] = t, l[i] = r, o[i] = new RegExp(t, n ? "g" : void 0), s[i] = new RegExp(r, n ? "g" : void 0);
		};
		h("NUMERICIDENTIFIER", "0|[1-9]\\d*"), h("NUMERICIDENTIFIERLOOSE", "\\d+"), h("NONNUMERICIDENTIFIER", `\\d*[a-zA-Z-]${f}*`), h("MAINVERSION", `(${c[u.NUMERICIDENTIFIER]})\\.(${c[u.NUMERICIDENTIFIER]})\\.(${c[u.NUMERICIDENTIFIER]})`), h("MAINVERSIONLOOSE", `(${c[u.NUMERICIDENTIFIERLOOSE]})\\.(${c[u.NUMERICIDENTIFIERLOOSE]})\\.(${c[u.NUMERICIDENTIFIERLOOSE]})`), h("PRERELEASEIDENTIFIER", `(?:${c[u.NONNUMERICIDENTIFIER]}|${c[u.NUMERICIDENTIFIER]})`), h("PRERELEASEIDENTIFIERLOOSE", `(?:${c[u.NONNUMERICIDENTIFIER]}|${c[u.NUMERICIDENTIFIERLOOSE]})`), h("PRERELEASE", `(?:-(${c[u.PRERELEASEIDENTIFIER]}(?:\\.${c[u.PRERELEASEIDENTIFIER]})*))`), h("PRERELEASELOOSE", `(?:-?(${c[u.PRERELEASEIDENTIFIERLOOSE]}(?:\\.${c[u.PRERELEASEIDENTIFIERLOOSE]})*))`), h("BUILDIDENTIFIER", `${f}+`), h("BUILD", `(?:\\+(${c[u.BUILDIDENTIFIER]}(?:\\.${c[u.BUILDIDENTIFIER]})*))`), h("FULLPLAIN", `v?${c[u.MAINVERSION]}${c[u.PRERELEASE]}?${c[u.BUILD]}?`), h("FULL", `^${c[u.FULLPLAIN]}$`), h("LOOSEPLAIN", `[v=\\s]*${c[u.MAINVERSIONLOOSE]}${c[u.PRERELEASELOOSE]}?${c[u.BUILD]}?`), h("LOOSE", `^${c[u.LOOSEPLAIN]}$`), h("GTLT", "((?:<|>)?=?)"), h("XRANGEIDENTIFIERLOOSE", `${c[u.NUMERICIDENTIFIERLOOSE]}|x|X|\\*`), h("XRANGEIDENTIFIER", `${c[u.NUMERICIDENTIFIER]}|x|X|\\*`), h("XRANGEPLAIN", `[v=\\s]*(${c[u.XRANGEIDENTIFIER]})(?:\\.(${c[u.XRANGEIDENTIFIER]})(?:\\.(${c[u.XRANGEIDENTIFIER]})(?:${c[u.PRERELEASE]})?${c[u.BUILD]}?)?)?`), h("XRANGEPLAINLOOSE", `[v=\\s]*(${c[u.XRANGEIDENTIFIERLOOSE]})(?:\\.(${c[u.XRANGEIDENTIFIERLOOSE]})(?:\\.(${c[u.XRANGEIDENTIFIERLOOSE]})(?:${c[u.PRERELEASELOOSE]})?${c[u.BUILD]}?)?)?`), h("XRANGE", `^${c[u.GTLT]}\\s*${c[u.XRANGEPLAIN]}$`), h("XRANGELOOSE", `^${c[u.GTLT]}\\s*${c[u.XRANGEPLAINLOOSE]}$`), h("COERCEPLAIN", `(^|[^\\d])(\\d{1,${n}})(?:\\.(\\d{1,${n}}))?(?:\\.(\\d{1,${n}}))?`), h("COERCE", `${c[u.COERCEPLAIN]}(?:$|[^\\d])`), h("COERCEFULL", c[u.COERCEPLAIN] + `(?:${c[u.PRERELEASE]})?(?:${c[u.BUILD]})?(?:$|[^\\d])`), h("COERCERTL", c[u.COERCE], !0), h("COERCERTLFULL", c[u.COERCEFULL], !0), h("LONETILDE", "(?:~>?)"), h("TILDETRIM", `(\\s*)${c[u.LONETILDE]}\\s+`, !0), t.tildeTrimReplace = "$1~", h("TILDE", `^${c[u.LONETILDE]}${c[u.XRANGEPLAIN]}$`), h("TILDELOOSE", `^${c[u.LONETILDE]}${c[u.XRANGEPLAINLOOSE]}$`), h("LONECARET", "(?:\\^)"), h("CARETTRIM", `(\\s*)${c[u.LONECARET]}\\s+`, !0), t.caretTrimReplace = "$1^", h("CARET", `^${c[u.LONECARET]}${c[u.XRANGEPLAIN]}$`), h("CARETLOOSE", `^${c[u.LONECARET]}${c[u.XRANGEPLAINLOOSE]}$`), h("COMPARATORLOOSE", `^${c[u.GTLT]}\\s*(${c[u.LOOSEPLAIN]})$|^$`), h("COMPARATOR", `^${c[u.GTLT]}\\s*(${c[u.FULLPLAIN]})$|^$`), h("COMPARATORTRIM", `(\\s*)${c[u.GTLT]}\\s*(${c[u.LOOSEPLAIN]}|${c[u.XRANGEPLAIN]})`, !0), t.comparatorTrimReplace = "$1$2$3", h("HYPHENRANGE", `^\\s*(${c[u.XRANGEPLAIN]})\\s+-\\s+(${c[u.XRANGEPLAIN]})\\s*$`), h("HYPHENRANGELOOSE", `^\\s*(${c[u.XRANGEPLAINLOOSE]})\\s+-\\s+(${c[u.XRANGEPLAINLOOSE]})\\s*$`), h("STAR", "(<|>)?=?\\s*\\*"), h("GTE0", "^\\s*>=\\s*0\\.0\\.0\\s*$"), h("GTE0PRE", "^\\s*>=\\s*0\\.0\\.0-0\\s*$");
	})(r9, r9.exports), r9.exports);
}
var f9, p9;
function iae() {
	if (p9) return f9;
	p9 = 1;
	let e = /^[0-9]+$/, t = (t, n) => {
		let r = e.test(t), i = e.test(n);
		return r && i && (t = +t, n = +n), t === n ? 0 : r && !i ? -1 : i && !r ? 1 : t < n ? -1 : 1;
	};
	return f9 = {
		compareIdentifiers: t,
		rcompareIdentifiers: (e, n) => t(n, e)
	}, f9;
}
var m9, h9;
function g9() {
	if (h9) return m9;
	h9 = 1;
	let e = l9(), { MAX_LENGTH: t, MAX_SAFE_INTEGER: n } = o9(), { safeRe: r, t: i } = d9(), a = n9(), { compareIdentifiers: o } = iae();
	class s {
		constructor(o, c) {
			if (c = a(c), o instanceof s) {
				if (o.loose === !!c.loose && o.includePrerelease === !!c.includePrerelease) return o;
				o = o.version;
			} else if (typeof o != "string") throw TypeError(`Invalid version. Must be a string. Got type "${typeof o}".`);
			if (o.length > t) throw TypeError(`version is longer than ${t} characters`);
			e("SemVer", o, c), this.options = c, this.loose = !!c.loose, this.includePrerelease = !!c.includePrerelease;
			let l = o.trim().match(c.loose ? r[i.LOOSE] : r[i.FULL]);
			if (!l) throw TypeError(`Invalid Version: ${o}`);
			if (this.raw = o, this.major = +l[1], this.minor = +l[2], this.patch = +l[3], this.major > n || this.major < 0) throw TypeError("Invalid major version");
			if (this.minor > n || this.minor < 0) throw TypeError("Invalid minor version");
			if (this.patch > n || this.patch < 0) throw TypeError("Invalid patch version");
			l[4] ? this.prerelease = l[4].split(".").map((e) => {
				if (/^[0-9]+$/.test(e)) {
					let t = +e;
					if (t >= 0 && t < n) return t;
				}
				return e;
			}) : this.prerelease = [], this.build = l[5] ? l[5].split(".") : [], this.format();
		}
		format() {
			return this.version = `${this.major}.${this.minor}.${this.patch}`, this.prerelease.length && (this.version += `-${this.prerelease.join(".")}`), this.version;
		}
		toString() {
			return this.version;
		}
		compare(t) {
			if (e("SemVer.compare", this.version, this.options, t), !(t instanceof s)) {
				if (typeof t == "string" && t === this.version) return 0;
				t = new s(t, this.options);
			}
			return t.version === this.version ? 0 : this.compareMain(t) || this.comparePre(t);
		}
		compareMain(e) {
			return e instanceof s || (e = new s(e, this.options)), o(this.major, e.major) || o(this.minor, e.minor) || o(this.patch, e.patch);
		}
		comparePre(t) {
			if (t instanceof s || (t = new s(t, this.options)), this.prerelease.length && !t.prerelease.length) return -1;
			if (!this.prerelease.length && t.prerelease.length) return 1;
			if (!this.prerelease.length && !t.prerelease.length) return 0;
			let n = 0;
			do {
				let r = this.prerelease[n], i = t.prerelease[n];
				if (e("prerelease compare", n, r, i), r === void 0 && i === void 0) return 0;
				if (i === void 0) return 1;
				if (r === void 0) return -1;
				if (r === i) continue;
				return o(r, i);
			} while (++n);
		}
		compareBuild(t) {
			t instanceof s || (t = new s(t, this.options));
			let n = 0;
			do {
				let r = this.build[n], i = t.build[n];
				if (e("build compare", n, r, i), r === void 0 && i === void 0) return 0;
				if (i === void 0) return 1;
				if (r === void 0) return -1;
				if (r === i) continue;
				return o(r, i);
			} while (++n);
		}
		inc(e, t, n) {
			if (e.startsWith("pre")) {
				if (!t && n === !1) throw Error("invalid increment argument: identifier is empty");
				if (t) {
					let e = `-${t}`.match(this.options.loose ? r[i.PRERELEASELOOSE] : r[i.PRERELEASE]);
					if (!e || e[1] !== t) throw Error(`invalid identifier: ${t}`);
				}
			}
			switch (e) {
				case "premajor":
					this.prerelease.length = 0, this.patch = 0, this.minor = 0, this.major++, this.inc("pre", t, n);
					break;
				case "preminor":
					this.prerelease.length = 0, this.patch = 0, this.minor++, this.inc("pre", t, n);
					break;
				case "prepatch":
					this.prerelease.length = 0, this.inc("patch", t, n), this.inc("pre", t, n);
					break;
				case "prerelease":
					this.prerelease.length === 0 && this.inc("patch", t, n), this.inc("pre", t, n);
					break;
				case "release":
					if (this.prerelease.length === 0) throw Error(`version ${this.raw} is not a prerelease`);
					this.prerelease.length = 0;
					break;
				case "major":
					(this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0) && this.major++, this.minor = 0, this.patch = 0, this.prerelease = [];
					break;
				case "minor":
					(this.patch !== 0 || this.prerelease.length === 0) && this.minor++, this.patch = 0, this.prerelease = [];
					break;
				case "patch":
					this.prerelease.length === 0 && this.patch++, this.prerelease = [];
					break;
				case "pre": {
					let e = +!!Number(n);
					if (this.prerelease.length === 0) this.prerelease = [e];
					else {
						let r = this.prerelease.length;
						for (; --r >= 0;) typeof this.prerelease[r] == "number" && (this.prerelease[r]++, r = -2);
						if (r === -1) {
							if (t === this.prerelease.join(".") && n === !1) throw Error("invalid increment argument: identifier already exists");
							this.prerelease.push(e);
						}
					}
					if (t) {
						let r = [t, e];
						n === !1 && (r = [t]), o(this.prerelease[0], t) === 0 ? isNaN(this.prerelease[1]) && (this.prerelease = r) : this.prerelease = r;
					}
					break;
				}
				default: throw Error(`invalid increment argument: ${e}`);
			}
			return this.raw = this.format(), this.build.length && (this.raw += `+${this.build.join(".")}`), this;
		}
	}
	return m9 = s, m9;
}
var _9, v9;
function y9() {
	if (v9) return _9;
	v9 = 1;
	let e = g9();
	return _9 = (t, n, r) => new e(t, r).compare(new e(n, r)), _9;
}
var b9, x9;
function aae() {
	if (x9) return b9;
	x9 = 1;
	let e = y9();
	return b9 = (t, n, r) => e(t, n, r) === 0, b9;
}
var S9, C9;
function oae() {
	if (C9) return S9;
	C9 = 1;
	let e = y9();
	return S9 = (t, n, r) => e(t, n, r) !== 0, S9;
}
var w9, T9;
function sae() {
	if (T9) return w9;
	T9 = 1;
	let e = y9();
	return w9 = (t, n, r) => e(t, n, r) > 0, w9;
}
var E9, D9;
function cae() {
	if (D9) return E9;
	D9 = 1;
	let e = y9();
	return E9 = (t, n, r) => e(t, n, r) >= 0, E9;
}
var O9, k9;
function lae() {
	if (k9) return O9;
	k9 = 1;
	let e = y9();
	return O9 = (t, n, r) => e(t, n, r) < 0, O9;
}
var A9, j9;
function uae() {
	if (j9) return A9;
	j9 = 1;
	let e = y9();
	return A9 = (t, n, r) => e(t, n, r) <= 0, A9;
}
var M9, N9;
function dae() {
	if (N9) return M9;
	N9 = 1;
	let e = aae(), t = oae(), n = sae(), r = cae(), i = lae(), a = uae();
	return M9 = (o, s, c, l) => {
		switch (s) {
			case "===": return typeof o == "object" && (o = o.version), typeof c == "object" && (c = c.version), o === c;
			case "!==": return typeof o == "object" && (o = o.version), typeof c == "object" && (c = c.version), o !== c;
			case "":
			case "=":
			case "==": return e(o, c, l);
			case "!=": return t(o, c, l);
			case ">": return n(o, c, l);
			case ">=": return r(o, c, l);
			case "<": return i(o, c, l);
			case "<=": return a(o, c, l);
			default: throw TypeError(`Invalid operator: ${s}`);
		}
	}, M9;
}
var P9, F9;
function fae() {
	if (F9) return P9;
	F9 = 1;
	let e = Symbol("SemVer ANY");
	class t {
		static get ANY() {
			return e;
		}
		constructor(r, i) {
			if (i = n(i), r instanceof t) {
				if (r.loose === !!i.loose) return r;
				r = r.value;
			}
			r = r.trim().split(/\s+/).join(" "), o("comparator", r, i), this.options = i, this.loose = !!i.loose, this.parse(r), this.semver === e ? this.value = "" : this.value = this.operator + this.semver.version, o("comp", this);
		}
		parse(t) {
			let n = this.options.loose ? r[i.COMPARATORLOOSE] : r[i.COMPARATOR], a = t.match(n);
			if (!a) throw TypeError(`Invalid comparator: ${t}`);
			this.operator = a[1] === void 0 ? "" : a[1], this.operator === "=" && (this.operator = ""), a[2] ? this.semver = new s(a[2], this.options.loose) : this.semver = e;
		}
		toString() {
			return this.value;
		}
		test(t) {
			if (o("Comparator.test", t, this.options.loose), this.semver === e || t === e) return !0;
			if (typeof t == "string") try {
				t = new s(t, this.options);
			} catch {
				return !1;
			}
			return a(t, this.operator, this.semver, this.options);
		}
		intersects(e, r) {
			if (!(e instanceof t)) throw TypeError("a Comparator is required");
			return this.operator === "" ? this.value === "" ? !0 : new c(e.value, r).test(this.value) : e.operator === "" ? e.value === "" ? !0 : new c(this.value, r).test(e.semver) : (r = n(r), r.includePrerelease && (this.value === "<0.0.0-0" || e.value === "<0.0.0-0") || !r.includePrerelease && (this.value.startsWith("<0.0.0") || e.value.startsWith("<0.0.0")) ? !1 : !!(this.operator.startsWith(">") && e.operator.startsWith(">") || this.operator.startsWith("<") && e.operator.startsWith("<") || this.semver.version === e.semver.version && this.operator.includes("=") && e.operator.includes("=") || a(this.semver, "<", e.semver, r) && this.operator.startsWith(">") && e.operator.startsWith("<") || a(this.semver, ">", e.semver, r) && this.operator.startsWith("<") && e.operator.startsWith(">")));
		}
	}
	P9 = t;
	let n = n9(), { safeRe: r, t: i } = d9(), a = dae(), o = l9(), s = g9(), c = R9();
	return P9;
}
var I9, L9;
function R9() {
	if (L9) return I9;
	L9 = 1;
	let e = /\s+/g;
	class t {
		constructor(n, a) {
			if (a = r(a), n instanceof t) return n.loose === !!a.loose && n.includePrerelease === !!a.includePrerelease ? n : new t(n.raw, a);
			if (n instanceof i) return this.raw = n.value, this.set = [[n]], this.formatted = void 0, this;
			if (this.options = a, this.loose = !!a.loose, this.includePrerelease = !!a.includePrerelease, this.raw = n.trim().replace(e, " "), this.set = this.raw.split("||").map((e) => this.parseRange(e.trim())).filter((e) => e.length), !this.set.length) throw TypeError(`Invalid SemVer Range: ${this.raw}`);
			if (this.set.length > 1) {
				let e = this.set[0];
				if (this.set = this.set.filter((e) => !m(e[0])), this.set.length === 0) this.set = [e];
				else if (this.set.length > 1) {
					for (let e of this.set) if (e.length === 1 && h(e[0])) {
						this.set = [e];
						break;
					}
				}
			}
			this.formatted = void 0;
		}
		get range() {
			if (this.formatted === void 0) {
				this.formatted = "";
				for (let e = 0; e < this.set.length; e++) {
					e > 0 && (this.formatted += "||");
					let t = this.set[e];
					for (let e = 0; e < t.length; e++) e > 0 && (this.formatted += " "), this.formatted += t[e].toString().trim();
				}
			}
			return this.formatted;
		}
		format() {
			return this.range;
		}
		toString() {
			return this.range;
		}
		parseRange(e) {
			let t = ((this.options.includePrerelease && f) | (this.options.loose && p)) + ":" + e, r = n.get(t);
			if (r) return r;
			let o = this.options.loose, h = o ? s[c.HYPHENRANGELOOSE] : s[c.HYPHENRANGE];
			e = e.replace(h, D(this.options.includePrerelease)), a("hyphen replace", e), e = e.replace(s[c.COMPARATORTRIM], l), a("comparator trim", e), e = e.replace(s[c.TILDETRIM], u), a("tilde trim", e), e = e.replace(s[c.CARETTRIM], d), a("caret trim", e);
			let g = e.split(" ").map((e) => _(e, this.options)).join(" ").split(/\s+/).map((e) => E(e, this.options));
			o && (g = g.filter((e) => (a("loose invalid filter", e, this.options), !!e.match(s[c.COMPARATORLOOSE])))), a("range list", g);
			let v = /* @__PURE__ */ new Map(), y = g.map((e) => new i(e, this.options));
			for (let e of y) {
				if (m(e)) return [e];
				v.set(e.value, e);
			}
			v.size > 1 && v.has("") && v.delete("");
			let b = [...v.values()];
			return n.set(t, b), b;
		}
		intersects(e, n) {
			if (!(e instanceof t)) throw TypeError("a Range is required");
			return this.set.some((t) => g(t, n) && e.set.some((e) => g(e, n) && t.every((t) => e.every((e) => t.intersects(e, n)))));
		}
		test(e) {
			if (!e) return !1;
			if (typeof e == "string") try {
				e = new o(e, this.options);
			} catch {
				return !1;
			}
			for (let t = 0; t < this.set.length; t++) if (O(this.set[t], e, this.options)) return !0;
			return !1;
		}
	}
	I9 = t;
	let n = new (rae())(), r = n9(), i = fae(), a = l9(), o = g9(), { safeRe: s, t: c, comparatorTrimReplace: l, tildeTrimReplace: u, caretTrimReplace: d } = d9(), { FLAG_INCLUDE_PRERELEASE: f, FLAG_LOOSE: p } = o9(), m = (e) => e.value === "<0.0.0-0", h = (e) => e.value === "", g = (e, t) => {
		let n = !0, r = e.slice(), i = r.pop();
		for (; n && r.length;) n = r.every((e) => i.intersects(e, t)), i = r.pop();
		return n;
	}, _ = (e, t) => (a("comp", e, t), e = x(e, t), a("caret", e), e = y(e, t), a("tildes", e), e = C(e, t), a("xrange", e), e = T(e, t), a("stars", e), e), v = (e) => !e || e.toLowerCase() === "x" || e === "*", y = (e, t) => e.trim().split(/\s+/).map((e) => b(e, t)).join(" "), b = (e, t) => {
		let n = t.loose ? s[c.TILDELOOSE] : s[c.TILDE];
		return e.replace(n, (t, n, r, i, o) => {
			a("tilde", e, t, n, r, i, o);
			let s;
			return v(n) ? s = "" : v(r) ? s = `>=${n}.0.0 <${+n + 1}.0.0-0` : v(i) ? s = `>=${n}.${r}.0 <${n}.${+r + 1}.0-0` : o ? (a("replaceTilde pr", o), s = `>=${n}.${r}.${i}-${o} <${n}.${+r + 1}.0-0`) : s = `>=${n}.${r}.${i} <${n}.${+r + 1}.0-0`, a("tilde return", s), s;
		});
	}, x = (e, t) => e.trim().split(/\s+/).map((e) => S(e, t)).join(" "), S = (e, t) => {
		a("caret", e, t);
		let n = t.loose ? s[c.CARETLOOSE] : s[c.CARET], r = t.includePrerelease ? "-0" : "";
		return e.replace(n, (t, n, i, o, s) => {
			a("caret", e, t, n, i, o, s);
			let c;
			return v(n) ? c = "" : v(i) ? c = `>=${n}.0.0${r} <${+n + 1}.0.0-0` : v(o) ? c = n === "0" ? `>=${n}.${i}.0${r} <${n}.${+i + 1}.0-0` : `>=${n}.${i}.0${r} <${+n + 1}.0.0-0` : s ? (a("replaceCaret pr", s), c = n === "0" ? i === "0" ? `>=${n}.${i}.${o}-${s} <${n}.${i}.${+o + 1}-0` : `>=${n}.${i}.${o}-${s} <${n}.${+i + 1}.0-0` : `>=${n}.${i}.${o}-${s} <${+n + 1}.0.0-0`) : (a("no pr"), c = n === "0" ? i === "0" ? `>=${n}.${i}.${o}${r} <${n}.${i}.${+o + 1}-0` : `>=${n}.${i}.${o}${r} <${n}.${+i + 1}.0-0` : `>=${n}.${i}.${o} <${+n + 1}.0.0-0`), a("caret return", c), c;
		});
	}, C = (e, t) => (a("replaceXRanges", e, t), e.split(/\s+/).map((e) => w(e, t)).join(" ")), w = (e, t) => {
		e = e.trim();
		let n = t.loose ? s[c.XRANGELOOSE] : s[c.XRANGE];
		return e.replace(n, (n, r, i, o, s, c) => {
			a("xRange", e, n, r, i, o, s, c);
			let l = v(i), u = l || v(o), d = u || v(s), f = d;
			return r === "=" && f && (r = ""), c = t.includePrerelease ? "-0" : "", l ? n = r === ">" || r === "<" ? "<0.0.0-0" : "*" : r && f ? (u && (o = 0), s = 0, r === ">" ? (r = ">=", u ? (i = +i + 1, o = 0, s = 0) : (o = +o + 1, s = 0)) : r === "<=" && (r = "<", u ? i = +i + 1 : o = +o + 1), r === "<" && (c = "-0"), n = `${r + i}.${o}.${s}${c}`) : u ? n = `>=${i}.0.0${c} <${+i + 1}.0.0-0` : d && (n = `>=${i}.${o}.0${c} <${i}.${+o + 1}.0-0`), a("xRange return", n), n;
		});
	}, T = (e, t) => (a("replaceStars", e, t), e.trim().replace(s[c.STAR], "")), E = (e, t) => (a("replaceGTE0", e, t), e.trim().replace(s[t.includePrerelease ? c.GTE0PRE : c.GTE0], "")), D = (e) => (t, n, r, i, a, o, s, c, l, u, d, f) => (n = v(r) ? "" : v(i) ? `>=${r}.0.0${e ? "-0" : ""}` : v(a) ? `>=${r}.${i}.0${e ? "-0" : ""}` : o ? `>=${n}` : `>=${n}${e ? "-0" : ""}`, c = v(l) ? "" : v(u) ? `<${+l + 1}.0.0-0` : v(d) ? `<${l}.${+u + 1}.0-0` : f ? `<=${l}.${u}.${d}-${f}` : e ? `<${l}.${u}.${+d + 1}-0` : `<=${c}`, `${n} ${c}`.trim()), O = (e, t, n) => {
		for (let n = 0; n < e.length; n++) if (!e[n].test(t)) return !1;
		if (t.prerelease.length && !n.includePrerelease) {
			for (let n = 0; n < e.length; n++) if (a(e[n].semver), e[n].semver !== i.ANY && e[n].semver.prerelease.length > 0) {
				let r = e[n].semver;
				if (r.major === t.major && r.minor === t.minor && r.patch === t.patch) return !0;
			}
			return !1;
		}
		return !0;
	};
	return I9;
}
var z9, B9;
function pae() {
	if (B9) return z9;
	B9 = 1;
	let e = R9();
	return z9 = (t, n, r) => {
		try {
			n = new e(n, r);
		} catch {
			return !1;
		}
		return n.test(t);
	}, z9;
}
var V9 = /* @__PURE__ */ nae(pae());
function mae(e, t, n) {
	let r = e.open(t), { origin: i } = new URL(t), a = 40;
	function o(t) {
		t.source === r && (a = 0, e.removeEventListener("message", o, !1));
	}
	e.addEventListener("message", o, !1);
	function s() {
		a <= 0 || (r.postMessage(n, i), setTimeout(s, 250), --a);
	}
	setTimeout(s, 250);
}
var hae = ".vega-embed {\n  position: relative;\n  display: inline-block;\n  box-sizing: border-box;\n}\n.vega-embed.has-actions {\n  padding-right: 38px;\n}\n.vega-embed details:not([open]) > :not(summary) {\n  display: none !important;\n}\n.vega-embed summary {\n  list-style: none;\n  position: absolute;\n  top: 0;\n  right: 0;\n  padding: 6px;\n  z-index: 1000;\n  background: white;\n  box-shadow: 1px 1px 3px rgba(0, 0, 0, 0.1);\n  color: #1b1e23;\n  border: 1px solid #aaa;\n  border-radius: 999px;\n  opacity: 0.2;\n  transition: opacity 0.4s ease-in;\n  cursor: pointer;\n  line-height: 0px;\n}\n.vega-embed summary::-webkit-details-marker {\n  display: none;\n}\n.vega-embed summary:active {\n  box-shadow: #aaa 0px 0px 0px 1px inset;\n}\n.vega-embed summary svg {\n  width: 14px;\n  height: 14px;\n}\n.vega-embed details[open] summary {\n  opacity: 0.7;\n}\n.vega-embed:hover summary, .vega-embed:focus-within summary {\n  opacity: 1 !important;\n  transition: opacity 0.2s ease;\n}\n.vega-embed .vega-actions {\n  position: absolute;\n  z-index: 1001;\n  top: 35px;\n  right: -9px;\n  display: flex;\n  flex-direction: column;\n  padding-bottom: 8px;\n  padding-top: 8px;\n  border-radius: 4px;\n  box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.2);\n  border: 1px solid #d9d9d9;\n  background: white;\n  animation-duration: 0.15s;\n  animation-name: scale-in;\n  animation-timing-function: cubic-bezier(0.2, 0, 0.13, 1.5);\n  text-align: left;\n}\n.vega-embed .vega-actions a {\n  padding: 8px 16px;\n  font-family: sans-serif;\n  font-size: 14px;\n  font-weight: 600;\n  white-space: nowrap;\n  color: #434a56;\n  text-decoration: none;\n}\n.vega-embed .vega-actions a:hover, .vega-embed .vega-actions a:focus {\n  background-color: #f7f7f9;\n  color: black;\n}\n.vega-embed .vega-actions::before, .vega-embed .vega-actions::after {\n  content: \"\";\n  display: inline-block;\n  position: absolute;\n}\n.vega-embed .vega-actions::before {\n  left: auto;\n  right: 14px;\n  top: -16px;\n  border: 8px solid rgba(0, 0, 0, 0);\n  border-bottom-color: #d9d9d9;\n}\n.vega-embed .vega-actions::after {\n  left: auto;\n  right: 15px;\n  top: -14px;\n  border: 7px solid rgba(0, 0, 0, 0);\n  border-bottom-color: #fff;\n}\n.vega-embed .chart-wrapper.fit-x {\n  width: 100%;\n}\n.vega-embed .chart-wrapper.fit-y {\n  height: 100%;\n}\n\n.vega-embed-wrapper {\n  max-width: 100%;\n  overflow: auto;\n  padding-right: 14px;\n}\n\n@keyframes scale-in {\n  from {\n    opacity: 0;\n    transform: scale(0.6);\n  }\n  to {\n    opacity: 1;\n    transform: scale(1);\n  }\n}\n";
function H9(e, ...t) {
	for (let n of t) gae(e, n);
	return e;
}
function gae(e, t) {
	for (let n of Object.keys(t)) gu(e, n, t[n], !0);
}
var _ae = { version: "7.1.0" }.version, U9 = JV, W9 = mH, G9 = typeof window < "u" ? window : void 0;
W9 === void 0 && !(G9 == null || (j7 = G9.vl) == null) && j7.compile && (W9 = G9.vl);
var K9 = {
	export: {
		svg: !0,
		png: !0
	},
	source: !0,
	compiled: !0,
	editor: !0
}, vae = {
	CLICK_TO_VIEW_ACTIONS: "Click to view actions",
	COMPILED_ACTION: "View Compiled Vega",
	EDITOR_ACTION: "Open in Vega Editor",
	PNG_ACTION: "Save as PNG",
	SOURCE_ACTION: "View Source",
	SVG_ACTION: "Save as SVG"
}, q9 = {
	vega: "Vega",
	"vega-lite": "Vega-Lite"
}, J9 = {
	vega: U9.version,
	"vega-lite": W9 ? W9.version : "not available"
}, yae = {
	vega: (e) => e,
	"vega-lite": (e, t, n) => W9.compile(e, {
		config: n,
		logger: t
	}).spec
}, bae = "\n<svg viewBox=\"0 0 16 16\" fill=\"currentColor\" stroke=\"none\" stroke-width=\"1\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n  <circle r=\"2\" cy=\"8\" cx=\"2\"></circle>\n  <circle r=\"2\" cy=\"8\" cx=\"8\"></circle>\n  <circle r=\"2\" cy=\"8\" cx=\"14\"></circle>\n</svg>", xae = "chart-wrapper";
function Sae(e) {
	return typeof e == "function";
}
function Y9(e, t, n, r) {
	let i = `<html><head>${t}</head><body><pre><code class="json">`, a = `</code></pre>${n}</body></html>`, o = window.open("");
	o.document.write(i + e + a), o.document.title = `${q9[r]} JSON Source`;
}
function X9(e, t, n) {
	if (e.$schema) {
		let i = I5(e.$schema);
		if (n && n !== i.library) {
			var r;
			t.warn(`The given visualization spec is written in ${q9[i.library]}, but mode argument sets ${(r = q9[n]) == null ? n : r}.`);
		}
		let a = i.library;
		return V9(J9[a], `^${i.version.slice(1)}`) || t.warn(`The input spec uses ${q9[a]} ${i.version}, but the current version of ${q9[a]} is v${J9[a]}.`), a;
	}
	return "mark" in e || "encoding" in e || "layer" in e || "hconcat" in e || "vconcat" in e || "facet" in e || "repeat" in e ? "vega-lite" : "marks" in e || "signals" in e || "scales" in e || "axes" in e || n == null ? "vega" : n;
}
function Z9(e) {
	return !!(e && "load" in e);
}
function Q9(e) {
	return Z9(e) ? e : U9.loader(e);
}
function Cae(e) {
	var t, n;
	let r = (t = (n = e.usermeta) == null ? void 0 : n.embedOptions) == null ? {} : t;
	return z(r.defaultStyle) && (r.defaultStyle = !1), r;
}
async function wae(e, t, n = {}) {
	var r, i;
	let a, o;
	z(t) ? (o = Q9(n.loader), a = JSON.parse(await o.load(t))) : a = t;
	let s = Cae(a), c = s.loader;
	if (!o || c) {
		var l;
		o = Q9((l = n.loader) == null ? c : l);
	}
	let u = await $9(s, o), d = await $9(n, o), f = {
		...H9(d, u),
		config: hu((r = d.config) == null ? {} : r, (i = u.config) == null ? {} : i)
	};
	return await Eae(e, a, f, o);
}
async function $9(e, t) {
	var n;
	let r = z(e.config) ? JSON.parse(await t.load(e.config)) : (n = e.config) == null ? {} : n, i = z(e.patch) ? JSON.parse(await t.load(e.patch)) : e.patch;
	return {
		...e,
		...i ? { patch: i } : {},
		...r ? { config: r } : {}
	};
}
function Tae(e) {
	var t;
	let n = e.getRootNode ? e.getRootNode() : document;
	return n instanceof ShadowRoot ? {
		root: n,
		rootContainer: n
	} : {
		root: document,
		rootContainer: (t = document.head) == null ? document.body : t
	};
}
async function Eae(e, t, n = {}, r) {
	var i, a, o, s, c, l, u;
	let d = n.theme ? hu(Jre[n.theme], (i = n.config) == null ? {} : i) : n.config, f = ed(n.actions) ? n.actions : H9({}, K9, (a = n.actions) == null ? {} : a), p = {
		...vae,
		...n.i18n
	}, m = (o = n.renderer) == null ? "svg" : o, h = (s = n.logger) == null ? pu(U9.Warn) : s;
	n.logLevel !== void 0 && h.level(n.logLevel);
	let g = (c = n.downloadFileName) == null ? "visualization" : c, _ = typeof e == "string" ? document.querySelector(e) : e;
	if (!_) throw Error(`${e} does not exist`);
	if (n.defaultStyle !== !1) {
		let e = "vega-embed-style", { root: t, rootContainer: r } = Tae(_);
		if (!t.getElementById(e)) {
			let t = document.createElement("style");
			t.id = e, t.innerHTML = n.defaultStyle === void 0 || n.defaultStyle === !0 ? hae.toString() : n.defaultStyle, r.appendChild(t);
		}
	}
	let v = X9(t, h, n.mode), y = yae[v](t, h, d);
	if (v === "vega-lite" && y.$schema) {
		let e = I5(y.$schema);
		V9(J9.vega, `^${e.version.slice(1)}`) || h.warn(`The compiled spec uses Vega ${e.version}, but current version is v${J9.vega}.`);
	}
	_.classList.add("vega-embed"), f && _.classList.add("has-actions"), _.innerHTML = "";
	let b = _;
	if (f) {
		let e = document.createElement("div");
		e.classList.add(xae), _.appendChild(e), b = e;
	}
	let x = n.patch;
	if (x && (y = x instanceof Function ? x(y) : G7(y, x, !0, !1).newDocument), n.formatLocale && U9.formatLocale(n.formatLocale), n.timeFormatLocale && U9.timeFormatLocale(n.timeFormatLocale), n.expressionFunctions) for (let e in n.expressionFunctions) {
		let t = n.expressionFunctions[e];
		"fn" in t ? U9.expressionFunction(e, t.fn, t.visitor) : t instanceof Function && U9.expressionFunction(e, t);
	}
	let { ast: S } = n, C = U9.parse(y, v === "vega-lite" ? {} : d, { ast: S }), w = new (n.viewClass || U9.View)(C, {
		loader: r,
		logger: h,
		renderer: m,
		...S ? { expr: (l = (u = U9.expressionInterpreter) == null ? n.expr : u) == null ? cH : l } : {}
	});
	if (w.addSignalListener("autosize", (e, t) => {
		let { type: n } = t;
		n == "fit-x" ? (b.classList.add("fit-x"), b.classList.remove("fit-y")) : n == "fit-y" ? (b.classList.remove("fit-x"), b.classList.add("fit-y")) : n == "fit" ? b.classList.add("fit-x", "fit-y") : b.classList.remove("fit-x", "fit-y");
	}), n.tooltip !== !1) {
		let { loader: e, tooltip: t } = n, r = e && !Z9(e) ? e == null ? void 0 : e.baseURL : void 0, i = Sae(t) ? t : new Vie({
			baseURL: r,
			...t === !0 ? {} : t
		}).call;
		w.tooltip(i);
	}
	let { hover: T } = n;
	if (T === void 0 && (T = v === "vega"), T) {
		let { hoverSet: e, updateSet: t } = typeof T == "boolean" ? {} : T;
		w.hover(e, t);
	}
	n && (n.width != null && w.width(n.width), n.height != null && w.height(n.height), n.padding != null && w.padding(n.padding)), await w.initialize(b, n.bind).runAsync();
	let E;
	if (f !== !1) {
		let e = _;
		if (n.defaultStyle !== !1 || n.forceActionsMenu) {
			let t = document.createElement("details");
			t.title = p.CLICK_TO_VIEW_ACTIONS, _.append(t), e = t;
			let n = document.createElement("summary");
			n.innerHTML = bae, t.append(n), E = (e) => {
				t.contains(e.target) || t.removeAttribute("open");
			}, document.addEventListener("click", E);
		}
		let r = document.createElement("div");
		if (e.append(r), r.classList.add("vega-actions"), f === !0 || f.export !== !1) {
			for (let e of ["svg", "png"]) if (f === !0 || f.export === !0 || f.export[e]) {
				let t = p[`${e.toUpperCase()}_ACTION`], i = document.createElement("a"), a = F(n.scaleFactor) ? n.scaleFactor[e] : n.scaleFactor;
				i.text = t, i.href = "#", i.target = "_blank", i.download = `${g}.${e}`, i.addEventListener("mousedown", async function(t) {
					t.preventDefault();
					let n = await w.toImageURL(e, a);
					this.href = n;
				}), r.append(i);
			}
		}
		if (f === !0 || f.source !== !1) {
			let e = document.createElement("a");
			e.text = p.SOURCE_ACTION, e.href = "#", e.addEventListener("click", function(e) {
				var r, i;
				Y9(Xl(t), (r = n.sourceHeader) == null ? "" : r, (i = n.sourceFooter) == null ? "" : i, v), e.preventDefault();
			}), r.append(e);
		}
		if (v === "vega-lite" && (f === !0 || f.compiled !== !1)) {
			let e = document.createElement("a");
			e.text = p.COMPILED_ACTION, e.href = "#", e.addEventListener("click", function(e) {
				var t, r;
				Y9(Xl(y), (t = n.sourceHeader) == null ? "" : t, (r = n.sourceFooter) == null ? "" : r, "vega"), e.preventDefault();
			}), r.append(e);
		}
		if (f === !0 || f.editor !== !1) {
			var D;
			let e = (D = n.editorUrl) == null ? "https://vega.github.io/editor/" : D, i = document.createElement("a");
			i.text = p.EDITOR_ACTION, i.href = "#", i.addEventListener("click", function(n) {
				mae(window, e, {
					config: d,
					mode: x ? "vega" : v,
					renderer: m,
					spec: Xl(x ? y : t)
				}), n.preventDefault();
			}), r.append(i);
		}
	}
	function O() {
		E && document.removeEventListener("click", E), w.finalize();
	}
	return {
		view: w,
		spec: t,
		vgSpec: y,
		finalize: O,
		embedOptions: n
	};
}
//#endregion
export { K9 as DEFAULT_ACTIONS, wae as default, X9 as guessMode, U9 as vega, W9 as vegaLite, _ae as version };
