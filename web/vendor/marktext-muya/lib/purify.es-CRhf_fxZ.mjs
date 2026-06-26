//#region ../../node_modules/.pnpm/dompurify@3.4.5/node_modules/dompurify/dist/purify.es.mjs
function e(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function t(e) {
	if (Array.isArray(e)) return e;
}
function n(e, t) {
	var n = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
	if (n != null) {
		var r, i, a, o, s = [], c = !0, l = !1;
		try {
			if (a = (n = n.call(e)).next, t !== 0) for (; !(c = (r = a.call(n)).done) && (s.push(r.value), s.length !== t); c = !0);
		} catch (e) {
			l = !0, i = e;
		} finally {
			try {
				if (!c && n.return != null && (o = n.return(), Object(o) !== o)) return;
			} finally {
				if (l) throw i;
			}
		}
		return s;
	}
}
function r() {
	throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function i(e, i) {
	return t(e) || n(e, i) || a(e, i) || r();
}
function a(t, n) {
	if (t) {
		if (typeof t == "string") return e(t, n);
		var r = {}.toString.call(t).slice(8, -1);
		return r === "Object" && t.constructor && (r = t.constructor.name), r === "Map" || r === "Set" ? Array.from(t) : r === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r) ? e(t, n) : void 0;
	}
}
var o = Object.entries, s = Object.setPrototypeOf, c = Object.isFrozen, l = Object.getPrototypeOf, u = Object.getOwnPropertyDescriptor, d = Object.freeze, f = Object.seal, p = Object.create, ee = typeof Reflect < "u" && Reflect, m = ee.apply, te = ee.construct;
d || (d = function(e) {
	return e;
}), f || (f = function(e) {
	return e;
}), m || (m = function(e, t) {
	var n = [...arguments].slice(2);
	return e.apply(t, n);
}), te || (te = function(e) {
	return new e(...[...arguments].slice(1));
});
var h = T(Array.prototype.forEach), ne = T(Array.prototype.lastIndexOf), re = T(Array.prototype.pop), g = T(Array.prototype.push), ie = T(Array.prototype.splice), _ = Array.isArray, v = T(String.prototype.toLowerCase), ae = T(String.prototype.toString), oe = T(String.prototype.match), y = T(String.prototype.replace), se = T(String.prototype.indexOf), ce = T(String.prototype.trim), b = T(Number.prototype.toString), x = T(Boolean.prototype.toString), le = typeof BigInt > "u" ? null : T(BigInt.prototype.toString), ue = typeof Symbol > "u" ? null : T(Symbol.prototype.toString), S = T(Object.prototype.hasOwnProperty), C = T(Object.prototype.toString), w = T(RegExp.prototype.test), de = E(TypeError);
function T(e) {
	return function(t) {
		t instanceof RegExp && (t.lastIndex = 0);
		var n = [...arguments].slice(1);
		return m(e, t, n);
	};
}
function E(e) {
	return function() {
		return te(e, [...arguments]);
	};
}
function D(e, t) {
	let n = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : v;
	if (s && s(e, null), !_(t)) return e;
	let r = t.length;
	for (; r--;) {
		let i = t[r];
		if (typeof i == "string") {
			let e = n(i);
			e !== i && (c(t) || (t[r] = e), i = e);
		}
		e[i] = !0;
	}
	return e;
}
function fe(e) {
	for (let t = 0; t < e.length; t++) S(e, t) || (e[t] = null);
	return e;
}
function O(e) {
	let t = p(null);
	for (let r of o(e)) {
		var n = i(r, 2);
		let a = n[0], o = n[1];
		S(e, a) && (_(o) ? t[a] = fe(o) : o && typeof o == "object" && o.constructor === Object ? t[a] = O(o) : t[a] = o);
	}
	return t;
}
function pe(e) {
	switch (typeof e) {
		case "string": return e;
		case "number": return b(e);
		case "boolean": return x(e);
		case "bigint": return le ? le(e) : "0";
		case "symbol": return ue ? ue(e) : "Symbol()";
		case "undefined": return C(e);
		case "function":
		case "object": {
			if (e === null) return C(e);
			let t = e, n = k(t, "toString");
			if (typeof n == "function") {
				let e = n(t);
				return typeof e == "string" ? e : C(e);
			}
			return C(e);
		}
		default: return C(e);
	}
}
function k(e, t) {
	for (; e !== null;) {
		let n = u(e, t);
		if (n) {
			if (n.get) return T(n.get);
			if (typeof n.value == "function") return T(n.value);
		}
		e = l(e);
	}
	function n() {
		return null;
	}
	return n;
}
function me(e) {
	try {
		return w(e, ""), !0;
	} catch {
		return !1;
	}
}
var he = d(/* @__PURE__ */ "a.abbr.acronym.address.area.article.aside.audio.b.bdi.bdo.big.blink.blockquote.body.br.button.canvas.caption.center.cite.code.col.colgroup.content.data.datalist.dd.decorator.del.details.dfn.dialog.dir.div.dl.dt.element.em.fieldset.figcaption.figure.font.footer.form.h1.h2.h3.h4.h5.h6.head.header.hgroup.hr.html.i.img.input.ins.kbd.label.legend.li.main.map.mark.marquee.menu.menuitem.meter.nav.nobr.ol.optgroup.option.output.p.picture.pre.progress.q.rp.rt.ruby.s.samp.search.section.select.shadow.slot.small.source.spacer.span.strike.strong.style.sub.summary.sup.table.tbody.td.template.textarea.tfoot.th.thead.time.tr.track.tt.u.ul.var.video.wbr".split(".")), ge = d(/* @__PURE__ */ "svg.a.altglyph.altglyphdef.altglyphitem.animatecolor.animatemotion.animatetransform.circle.clippath.defs.desc.ellipse.enterkeyhint.exportparts.filter.font.g.glyph.glyphref.hkern.image.inputmode.line.lineargradient.marker.mask.metadata.mpath.part.path.pattern.polygon.polyline.radialgradient.rect.stop.style.switch.symbol.text.textpath.title.tref.tspan.view.vkern".split(".")), _e = d([
	"feBlend",
	"feColorMatrix",
	"feComponentTransfer",
	"feComposite",
	"feConvolveMatrix",
	"feDiffuseLighting",
	"feDisplacementMap",
	"feDistantLight",
	"feDropShadow",
	"feFlood",
	"feFuncA",
	"feFuncB",
	"feFuncG",
	"feFuncR",
	"feGaussianBlur",
	"feImage",
	"feMerge",
	"feMergeNode",
	"feMorphology",
	"feOffset",
	"fePointLight",
	"feSpecularLighting",
	"feSpotLight",
	"feTile",
	"feTurbulence"
]), ve = d([
	"animate",
	"color-profile",
	"cursor",
	"discard",
	"font-face",
	"font-face-format",
	"font-face-name",
	"font-face-src",
	"font-face-uri",
	"foreignobject",
	"hatch",
	"hatchpath",
	"mesh",
	"meshgradient",
	"meshpatch",
	"meshrow",
	"missing-glyph",
	"script",
	"set",
	"solidcolor",
	"unknown",
	"use"
]), ye = d(/* @__PURE__ */ "math.menclose.merror.mfenced.mfrac.mglyph.mi.mlabeledtr.mmultiscripts.mn.mo.mover.mpadded.mphantom.mroot.mrow.ms.mspace.msqrt.mstyle.msub.msup.msubsup.mtable.mtd.mtext.mtr.munder.munderover.mprescripts".split(".")), be = d([
	"maction",
	"maligngroup",
	"malignmark",
	"mlongdiv",
	"mscarries",
	"mscarry",
	"msgroup",
	"mstack",
	"msline",
	"msrow",
	"semantics",
	"annotation",
	"annotation-xml",
	"mprescripts",
	"none"
]), xe = d(["#text"]), Se = d(/* @__PURE__ */ "accept.action.align.alt.autocapitalize.autocomplete.autopictureinpicture.autoplay.background.bgcolor.border.capture.cellpadding.cellspacing.checked.cite.class.clear.color.cols.colspan.command.commandfor.controls.controlslist.coords.crossorigin.datetime.decoding.default.dir.disabled.disablepictureinpicture.disableremoteplayback.download.draggable.enctype.enterkeyhint.exportparts.face.for.headers.height.hidden.high.href.hreflang.id.inert.inputmode.integrity.ismap.kind.label.lang.list.loading.loop.low.max.maxlength.media.method.min.minlength.multiple.muted.name.nonce.noshade.novalidate.nowrap.open.optimum.part.pattern.placeholder.playsinline.popover.popovertarget.popovertargetaction.poster.preload.pubdate.radiogroup.readonly.rel.required.rev.reversed.role.rows.rowspan.spellcheck.scope.selected.shape.size.sizes.slot.span.srclang.start.src.srcset.step.style.summary.tabindex.title.translate.type.usemap.valign.value.width.wrap.xmlns".split(".")), Ce = d(/* @__PURE__ */ "accent-height.accumulate.additive.alignment-baseline.amplitude.ascent.attributename.attributetype.azimuth.basefrequency.baseline-shift.begin.bias.by.class.clip.clippathunits.clip-path.clip-rule.color.color-interpolation.color-interpolation-filters.color-profile.color-rendering.cx.cy.d.dx.dy.diffuseconstant.direction.display.divisor.dur.edgemode.elevation.end.exponent.fill.fill-opacity.fill-rule.filter.filterunits.flood-color.flood-opacity.font-family.font-size.font-size-adjust.font-stretch.font-style.font-variant.font-weight.fx.fy.g1.g2.glyph-name.glyphref.gradientunits.gradienttransform.height.href.id.image-rendering.in.in2.intercept.k.k1.k2.k3.k4.kerning.keypoints.keysplines.keytimes.lang.lengthadjust.letter-spacing.kernelmatrix.kernelunitlength.lighting-color.local.marker-end.marker-mid.marker-start.markerheight.markerunits.markerwidth.maskcontentunits.maskunits.max.mask.mask-type.media.method.mode.min.name.numoctaves.offset.operator.opacity.order.orient.orientation.origin.overflow.paint-order.path.pathlength.patterncontentunits.patterntransform.patternunits.points.preservealpha.preserveaspectratio.primitiveunits.r.rx.ry.radius.refx.refy.repeatcount.repeatdur.restart.result.rotate.scale.seed.shape-rendering.slope.specularconstant.specularexponent.spreadmethod.startoffset.stddeviation.stitchtiles.stop-color.stop-opacity.stroke-dasharray.stroke-dashoffset.stroke-linecap.stroke-linejoin.stroke-miterlimit.stroke-opacity.stroke.stroke-width.style.surfacescale.systemlanguage.tabindex.tablevalues.targetx.targety.transform.transform-origin.text-anchor.text-decoration.text-rendering.textlength.type.u1.u2.unicode.values.viewbox.visibility.version.vert-adv-y.vert-origin-x.vert-origin-y.width.word-spacing.wrap.writing-mode.xchannelselector.ychannelselector.x.x1.x2.xmlns.y.y1.y2.z.zoomandpan".split(".")), we = d(/* @__PURE__ */ "accent.accentunder.align.bevelled.close.columnalign.columnlines.columnspacing.columnspan.denomalign.depth.dir.display.displaystyle.encoding.fence.frame.height.href.id.largeop.length.linethickness.lquote.lspace.mathbackground.mathcolor.mathsize.mathvariant.maxsize.minsize.movablelimits.notation.numalign.open.rowalign.rowlines.rowspacing.rowspan.rspace.rquote.scriptlevel.scriptminsize.scriptsizemultiplier.selection.separator.separators.stretchy.subscriptshift.supscriptshift.symmetric.voffset.width.xmlns".split(".")), Te = d([
	"xlink:href",
	"xml:id",
	"xlink:title",
	"xml:space",
	"xmlns:xlink"
]), Ee = f(/{{[\w\W]*|^[\w\W]*}}/g), De = f(/<%[\w\W]*|^[\w\W]*%>/g), Oe = f(/\${[\w\W]*/g), ke = f(/^data-[\-\w.\u00B7-\uFFFF]+$/), Ae = f(/^aria-[\-\w]+$/), je = f(/^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i), Me = f(/^(?:\w+script|data):/i), Ne = f(/[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g), Pe = f(/^html$/i), Fe = f(/^[a-z][.\w]*(-[.\w]+)+$/i), A = {
	element: 1,
	text: 3,
	progressingInstruction: 7,
	comment: 8,
	document: 9
}, Ie = function() {
	return typeof window > "u" ? null : window;
}, Le = function(e, t) {
	if (typeof e != "object" || typeof e.createPolicy != "function") return null;
	let n = null, r = "data-tt-policy-suffix";
	t && t.hasAttribute(r) && (n = t.getAttribute(r));
	let i = "dompurify" + (n ? "#" + n : "");
	try {
		return e.createPolicy(i, {
			createHTML(e) {
				return e;
			},
			createScriptURL(e) {
				return e;
			}
		});
	} catch {
		return console.warn("TrustedTypes policy " + i + " could not be created."), null;
	}
}, Re = function() {
	return {
		afterSanitizeAttributes: [],
		afterSanitizeElements: [],
		afterSanitizeShadowDOM: [],
		beforeSanitizeAttributes: [],
		beforeSanitizeElements: [],
		beforeSanitizeShadowDOM: [],
		uponSanitizeAttribute: [],
		uponSanitizeElement: [],
		uponSanitizeShadowNode: []
	};
};
function ze() {
	let e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : Ie(), t = (e) => ze(e);
	if (t.version = "3.4.5", t.removed = [], !e || !e.document || e.document.nodeType !== A.document || !e.Element) return t.isSupported = !1, t;
	let n = e.document, r = n, i = r.currentScript, a = e.DocumentFragment, s = e.HTMLTemplateElement, c = e.Node, l = e.Element, u = e.NodeFilter, f = e.NamedNodeMap, ee = f === void 0 ? e.NamedNodeMap || e.MozNamedAttrMap : f, m = e.HTMLFormElement, te = e.DOMParser, b = e.trustedTypes, x = l.prototype, le = k(x, "cloneNode"), ue = k(x, "remove"), C = k(x, "nextSibling"), T = k(x, "childNodes"), E = k(x, "parentNode"), fe = c && c.prototype ? k(c.prototype, "nodeType") : null;
	if (typeof s == "function") {
		let e = n.createElement("template");
		e.content && e.content.ownerDocument && (n = e.content.ownerDocument);
	}
	let j, M = "", Be = n, Ve = Be.implementation, He = Be.createNodeIterator, Ue = Be.createDocumentFragment, We = Be.getElementsByTagName, Ge = r.importNode, N = Re();
	t.isSupported = typeof o == "function" && typeof E == "function" && Ve && Ve.createHTMLDocument !== void 0;
	let Ke = Ee, qe = De, Je = Oe, Ye = ke, Xe = Ae, Ze = Me, Qe = Ne, $e = Fe, et = je, P = null, tt = D({}, [
		...he,
		...ge,
		..._e,
		...ye,
		...xe
	]), F = null, nt = D({}, [
		...Se,
		...Ce,
		...we,
		...Te
	]), I = Object.seal(p(null, {
		tagNameCheck: {
			writable: !0,
			configurable: !1,
			enumerable: !0,
			value: null
		},
		attributeNameCheck: {
			writable: !0,
			configurable: !1,
			enumerable: !0,
			value: null
		},
		allowCustomizedBuiltInElements: {
			writable: !0,
			configurable: !1,
			enumerable: !0,
			value: !1
		}
	})), L = null, rt = null, R = Object.seal(p(null, {
		tagCheck: {
			writable: !0,
			configurable: !1,
			enumerable: !0,
			value: null
		},
		attributeCheck: {
			writable: !0,
			configurable: !1,
			enumerable: !0,
			value: null
		}
	})), it = !0, at = !0, ot = !1, st = !0, z = !1, B = !0, V = !1, ct = !1, lt = !1, H = !1, ut = !1, dt = !1, ft = !0, pt = !1, mt = "user-content-", ht = !0, U = !1, W = {}, G = null, gt = D({}, [
		"annotation-xml",
		"audio",
		"colgroup",
		"desc",
		"foreignobject",
		"head",
		"iframe",
		"math",
		"mi",
		"mn",
		"mo",
		"ms",
		"mtext",
		"noembed",
		"noframes",
		"noscript",
		"plaintext",
		"script",
		"style",
		"svg",
		"template",
		"thead",
		"title",
		"video",
		"xmp"
	]), _t = null, vt = D({}, [
		"audio",
		"video",
		"img",
		"source",
		"image",
		"track"
	]), yt = null, bt = D({}, [
		"alt",
		"class",
		"for",
		"id",
		"label",
		"name",
		"pattern",
		"placeholder",
		"role",
		"summary",
		"title",
		"value",
		"style",
		"xmlns"
	]), xt = "http://www.w3.org/1998/Math/MathML", St = "http://www.w3.org/2000/svg", K = "http://www.w3.org/1999/xhtml", q = K, Ct = !1, wt = null, Tt = D({}, [
		xt,
		St,
		K
	], ae), Et = D({}, [
		"mi",
		"mo",
		"mn",
		"ms",
		"mtext"
	]), Dt = D({}, ["annotation-xml"]), Ot = D({}, [
		"title",
		"style",
		"font",
		"a",
		"script"
	]), J = null, kt = ["application/xhtml+xml", "text/html"], Y = null, X = null, At = n.createElement("form"), jt = function(e) {
		return e instanceof RegExp || e instanceof Function;
	}, Mt = function() {
		let e = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
		if (X && X === e) return;
		(!e || typeof e != "object") && (e = {}), e = O(e), J = kt.indexOf(e.PARSER_MEDIA_TYPE) === -1 ? "text/html" : e.PARSER_MEDIA_TYPE, Y = J === "application/xhtml+xml" ? ae : v, P = S(e, "ALLOWED_TAGS") && _(e.ALLOWED_TAGS) ? D({}, e.ALLOWED_TAGS, Y) : tt, F = S(e, "ALLOWED_ATTR") && _(e.ALLOWED_ATTR) ? D({}, e.ALLOWED_ATTR, Y) : nt, wt = S(e, "ALLOWED_NAMESPACES") && _(e.ALLOWED_NAMESPACES) ? D({}, e.ALLOWED_NAMESPACES, ae) : Tt, yt = S(e, "ADD_URI_SAFE_ATTR") && _(e.ADD_URI_SAFE_ATTR) ? D(O(bt), e.ADD_URI_SAFE_ATTR, Y) : bt, _t = S(e, "ADD_DATA_URI_TAGS") && _(e.ADD_DATA_URI_TAGS) ? D(O(vt), e.ADD_DATA_URI_TAGS, Y) : vt, G = S(e, "FORBID_CONTENTS") && _(e.FORBID_CONTENTS) ? D({}, e.FORBID_CONTENTS, Y) : gt, L = S(e, "FORBID_TAGS") && _(e.FORBID_TAGS) ? D({}, e.FORBID_TAGS, Y) : O({}), rt = S(e, "FORBID_ATTR") && _(e.FORBID_ATTR) ? D({}, e.FORBID_ATTR, Y) : O({}), W = S(e, "USE_PROFILES") ? e.USE_PROFILES && typeof e.USE_PROFILES == "object" ? O(e.USE_PROFILES) : e.USE_PROFILES : !1, it = e.ALLOW_ARIA_ATTR !== !1, at = e.ALLOW_DATA_ATTR !== !1, ot = e.ALLOW_UNKNOWN_PROTOCOLS || !1, st = e.ALLOW_SELF_CLOSE_IN_ATTR !== !1, z = e.SAFE_FOR_TEMPLATES || !1, B = e.SAFE_FOR_XML !== !1, V = e.WHOLE_DOCUMENT || !1, H = e.RETURN_DOM || !1, ut = e.RETURN_DOM_FRAGMENT || !1, dt = e.RETURN_TRUSTED_TYPE || !1, lt = e.FORCE_BODY || !1, ft = e.SANITIZE_DOM !== !1, pt = e.SANITIZE_NAMED_PROPS || !1, ht = e.KEEP_CONTENT !== !1, U = e.IN_PLACE || !1, et = me(e.ALLOWED_URI_REGEXP) ? e.ALLOWED_URI_REGEXP : je, q = typeof e.NAMESPACE == "string" ? e.NAMESPACE : K, Et = S(e, "MATHML_TEXT_INTEGRATION_POINTS") && e.MATHML_TEXT_INTEGRATION_POINTS && typeof e.MATHML_TEXT_INTEGRATION_POINTS == "object" ? O(e.MATHML_TEXT_INTEGRATION_POINTS) : D({}, [
			"mi",
			"mo",
			"mn",
			"ms",
			"mtext"
		]), Dt = S(e, "HTML_INTEGRATION_POINTS") && e.HTML_INTEGRATION_POINTS && typeof e.HTML_INTEGRATION_POINTS == "object" ? O(e.HTML_INTEGRATION_POINTS) : D({}, ["annotation-xml"]);
		let t = S(e, "CUSTOM_ELEMENT_HANDLING") && e.CUSTOM_ELEMENT_HANDLING && typeof e.CUSTOM_ELEMENT_HANDLING == "object" ? O(e.CUSTOM_ELEMENT_HANDLING) : p(null);
		if (I = p(null), S(t, "tagNameCheck") && jt(t.tagNameCheck) && (I.tagNameCheck = t.tagNameCheck), S(t, "attributeNameCheck") && jt(t.attributeNameCheck) && (I.attributeNameCheck = t.attributeNameCheck), S(t, "allowCustomizedBuiltInElements") && typeof t.allowCustomizedBuiltInElements == "boolean" && (I.allowCustomizedBuiltInElements = t.allowCustomizedBuiltInElements), z && (at = !1), ut && (H = !0), W && (P = D({}, xe), F = p(null), W.html === !0 && (D(P, he), D(F, Se)), W.svg === !0 && (D(P, ge), D(F, Ce), D(F, Te)), W.svgFilters === !0 && (D(P, _e), D(F, Ce), D(F, Te)), W.mathMl === !0 && (D(P, ye), D(F, we), D(F, Te))), R.tagCheck = null, R.attributeCheck = null, S(e, "ADD_TAGS") && (typeof e.ADD_TAGS == "function" ? R.tagCheck = e.ADD_TAGS : _(e.ADD_TAGS) && (P === tt && (P = O(P)), D(P, e.ADD_TAGS, Y))), S(e, "ADD_ATTR") && (typeof e.ADD_ATTR == "function" ? R.attributeCheck = e.ADD_ATTR : _(e.ADD_ATTR) && (F === nt && (F = O(F)), D(F, e.ADD_ATTR, Y))), S(e, "ADD_URI_SAFE_ATTR") && _(e.ADD_URI_SAFE_ATTR) && D(yt, e.ADD_URI_SAFE_ATTR, Y), S(e, "FORBID_CONTENTS") && _(e.FORBID_CONTENTS) && (G === gt && (G = O(G)), D(G, e.FORBID_CONTENTS, Y)), S(e, "ADD_FORBID_CONTENTS") && _(e.ADD_FORBID_CONTENTS) && (G === gt && (G = O(G)), D(G, e.ADD_FORBID_CONTENTS, Y)), ht && (P["#text"] = !0), V && D(P, [
			"html",
			"head",
			"body"
		]), P.table && (D(P, ["tbody"]), delete L.tbody), e.TRUSTED_TYPES_POLICY) {
			if (typeof e.TRUSTED_TYPES_POLICY.createHTML != "function") throw de("TRUSTED_TYPES_POLICY configuration option must provide a \"createHTML\" hook.");
			if (typeof e.TRUSTED_TYPES_POLICY.createScriptURL != "function") throw de("TRUSTED_TYPES_POLICY configuration option must provide a \"createScriptURL\" hook.");
			j = e.TRUSTED_TYPES_POLICY, M = j.createHTML("");
		} else j === void 0 && (j = Le(b, i)), j !== null && typeof M == "string" && (M = j.createHTML(""));
		d && d(e), X = e;
	}, Nt = D({}, [
		...ge,
		..._e,
		...ve
	]), Pt = D({}, [...ye, ...be]), Ft = function(e) {
		let t = E(e);
		(!t || !t.tagName) && (t = {
			namespaceURI: q,
			tagName: "template"
		});
		let n = v(e.tagName), r = v(t.tagName);
		return wt[e.namespaceURI] ? e.namespaceURI === St ? t.namespaceURI === K ? n === "svg" : t.namespaceURI === xt ? n === "svg" && (r === "annotation-xml" || Et[r]) : !!Nt[n] : e.namespaceURI === xt ? t.namespaceURI === K ? n === "math" : t.namespaceURI === St ? n === "math" && Dt[r] : !!Pt[n] : e.namespaceURI === K ? t.namespaceURI === St && !Dt[r] || t.namespaceURI === xt && !Et[r] ? !1 : !Pt[n] && (Ot[n] || !Nt[n]) : !!(J === "application/xhtml+xml" && wt[e.namespaceURI]) : !1;
	}, Z = function(e) {
		g(t.removed, { element: e });
		try {
			E(e).removeChild(e);
		} catch {
			ue(e);
		}
	}, Q = function(e, n) {
		try {
			g(t.removed, {
				attribute: n.getAttributeNode(e),
				from: n
			});
		} catch {
			g(t.removed, {
				attribute: null,
				from: n
			});
		}
		if (n.removeAttribute(e), e === "is") if (H || ut) try {
			Z(n);
		} catch {}
		else try {
			n.setAttribute(e, "");
		} catch {}
	}, It = function(e) {
		let t = null, r = null;
		if (lt) e = "<remove></remove>" + e;
		else {
			let t = oe(e, /^[\r\n\t ]+/);
			r = t && t[0];
		}
		J === "application/xhtml+xml" && q === K && (e = "<html xmlns=\"http://www.w3.org/1999/xhtml\"><head></head><body>" + e + "</body></html>");
		let i = j ? j.createHTML(e) : e;
		if (q === K) try {
			t = new te().parseFromString(i, J);
		} catch {}
		if (!t || !t.documentElement) {
			t = Ve.createDocument(q, "template", null);
			try {
				t.documentElement.innerHTML = Ct ? M : i;
			} catch {}
		}
		let a = t.body || t.documentElement;
		return e && r && a.insertBefore(n.createTextNode(r), a.childNodes[0] || null), q === K ? We.call(t, V ? "html" : "body")[0] : V ? t.documentElement : a;
	}, Lt = function(e) {
		return He.call(e.ownerDocument || e, e, u.SHOW_ELEMENT | u.SHOW_COMMENT | u.SHOW_TEXT | u.SHOW_PROCESSING_INSTRUCTION | u.SHOW_CDATA_SECTION, null);
	}, Rt = function(e) {
		e.normalize();
		let t = He.call(e.ownerDocument || e, e, u.SHOW_TEXT | u.SHOW_COMMENT | u.SHOW_CDATA_SECTION | u.SHOW_PROCESSING_INSTRUCTION, null), n = t.nextNode();
		for (; n;) {
			let e = n.data;
			h([
				Ke,
				qe,
				Je
			], (t) => {
				e = y(e, t, " ");
			}), n.data = e, n = t.nextNode();
		}
	}, zt = function(e) {
		return e instanceof m && (typeof e.nodeName != "string" || typeof e.textContent != "string" || typeof e.removeChild != "function" || !(e.attributes instanceof ee) || typeof e.removeAttribute != "function" || typeof e.setAttribute != "function" || typeof e.namespaceURI != "string" || typeof e.insertBefore != "function" || typeof e.hasChildNodes != "function");
	}, Bt = function(e) {
		if (!fe || typeof e != "object" || !e) return !1;
		try {
			return typeof fe(e) == "number";
		} catch {
			return !1;
		}
	};
	function $(e, n, r) {
		h(e, (e) => {
			e.call(t, n, r, X);
		});
	}
	let Vt = function(e) {
		let n = null;
		if ($(N.beforeSanitizeElements, e, null), zt(e)) return Z(e), !0;
		let r = Y(e.nodeName);
		if ($(N.uponSanitizeElement, e, {
			tagName: r,
			allowedTags: P
		}), B && e.hasChildNodes() && !Bt(e.firstElementChild) && w(/<[/\w!]/g, e.innerHTML) && w(/<[/\w!]/g, e.textContent) || B && e.namespaceURI === K && r === "style" && Bt(e.firstElementChild) || e.nodeType === A.progressingInstruction || B && e.nodeType === A.comment && w(/<[/\w]/g, e.data)) return Z(e), !0;
		if (L[r] || !(R.tagCheck instanceof Function && R.tagCheck(r)) && !P[r]) {
			if (!L[r] && Wt(r) && (I.tagNameCheck instanceof RegExp && w(I.tagNameCheck, r) || I.tagNameCheck instanceof Function && I.tagNameCheck(r))) return !1;
			if (ht && !G[r]) {
				let t = E(e) || e.parentNode, n = T(e) || e.childNodes;
				if (n && t) {
					let r = n.length;
					for (let i = r - 1; i >= 0; --i) {
						let r = le(n[i], !0);
						t.insertBefore(r, C(e));
					}
				}
			}
			return Z(e), !0;
		}
		return e instanceof l && !Ft(e) || (r === "noscript" || r === "noembed" || r === "noframes") && w(/<\/no(script|embed|frames)/i, e.innerHTML) ? (Z(e), !0) : (z && e.nodeType === A.text && (n = e.textContent, h([
			Ke,
			qe,
			Je
		], (e) => {
			n = y(n, e, " ");
		}), e.textContent !== n && (g(t.removed, { element: e.cloneNode() }), e.textContent = n)), $(N.afterSanitizeElements, e, null), !1);
	}, Ht = function(e, t, r) {
		if (rt[t] || ft && (t === "id" || t === "name") && (r in n || r in At)) return !1;
		let i = F[t] || R.attributeCheck instanceof Function && R.attributeCheck(t, e);
		if (!(at && !rt[t] && w(Ye, t)) && !(it && w(Xe, t))) {
			if (!i || rt[t]) {
				if (!(Wt(e) && (I.tagNameCheck instanceof RegExp && w(I.tagNameCheck, e) || I.tagNameCheck instanceof Function && I.tagNameCheck(e)) && (I.attributeNameCheck instanceof RegExp && w(I.attributeNameCheck, t) || I.attributeNameCheck instanceof Function && I.attributeNameCheck(t, e)) || t === "is" && I.allowCustomizedBuiltInElements && (I.tagNameCheck instanceof RegExp && w(I.tagNameCheck, r) || I.tagNameCheck instanceof Function && I.tagNameCheck(r)))) return !1;
			} else if (!yt[t] && !w(et, y(r, Qe, "")) && !((t === "src" || t === "xlink:href" || t === "href") && e !== "script" && se(r, "data:") === 0 && _t[e]) && !(ot && !w(Ze, y(r, Qe, ""))) && r) return !1;
		}
		return !0;
	}, Ut = D({}, [
		"annotation-xml",
		"color-profile",
		"font-face",
		"font-face-format",
		"font-face-name",
		"font-face-src",
		"font-face-uri",
		"missing-glyph"
	]), Wt = function(e) {
		return !Ut[v(e)] && w($e, e);
	}, Gt = function(e) {
		$(N.beforeSanitizeAttributes, e, null);
		let n = e.attributes;
		if (!n || zt(e)) return;
		let r = {
			attrName: "",
			attrValue: "",
			keepAttr: !0,
			allowedAttributes: F,
			forceKeepAttr: void 0
		}, i = n.length;
		for (; i--;) {
			let a = n[i], o = a.name, s = a.namespaceURI, c = a.value, l = Y(o), u = c, d = o === "value" ? u : ce(u);
			if (r.attrName = l, r.attrValue = d, r.keepAttr = !0, r.forceKeepAttr = void 0, $(N.uponSanitizeAttribute, e, r), d = r.attrValue, pt && (l === "id" || l === "name") && se(d, mt) !== 0 && (Q(o, e), d = mt + d), B && w(/((--!?|])>)|<\/(style|script|title|xmp|textarea|noscript|iframe|noembed|noframes)/i, d)) {
				Q(o, e);
				continue;
			}
			if (l === "attributename" && oe(d, "href")) {
				Q(o, e);
				continue;
			}
			if (r.forceKeepAttr) continue;
			if (!r.keepAttr) {
				Q(o, e);
				continue;
			}
			if (!st && w(/\/>/i, d)) {
				Q(o, e);
				continue;
			}
			z && h([
				Ke,
				qe,
				Je
			], (e) => {
				d = y(d, e, " ");
			});
			let f = Y(e.nodeName);
			if (!Ht(f, l, d)) {
				Q(o, e);
				continue;
			}
			if (j && typeof b == "object" && typeof b.getAttributeType == "function" && !s) switch (b.getAttributeType(f, l)) {
				case "TrustedHTML":
					d = j.createHTML(d);
					break;
				case "TrustedScriptURL":
					d = j.createScriptURL(d);
					break;
			}
			if (d !== u) try {
				s ? e.setAttributeNS(s, o, d) : e.setAttribute(o, d), zt(e) ? Z(e) : re(t.removed);
			} catch {
				Q(o, e);
			}
		}
		$(N.afterSanitizeAttributes, e, null);
	}, Kt = function(e) {
		let t = null, n = Lt(e);
		for ($(N.beforeSanitizeShadowDOM, e, null); t = n.nextNode();) $(N.uponSanitizeShadowNode, t, null), Vt(t), Gt(t), t.content instanceof a && Kt(t.content);
		$(N.afterSanitizeShadowDOM, e, null);
	}, qt = function(e) {
		if (e.nodeType === A.element && e.shadowRoot instanceof a) {
			let t = e.shadowRoot;
			qt(t), Kt(t);
		}
		let t = e.childNodes;
		if (!t) return;
		let n = [];
		h(t, (e) => {
			g(n, e);
		});
		for (let e of n) qt(e);
	};
	return t.sanitize = function(e) {
		let n = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {}, i = null, o = null, s = null, c = null;
		if (Ct = !e, Ct && (e = "<!-->"), typeof e != "string" && !Bt(e) && (e = pe(e), typeof e != "string")) throw de("dirty is not a string, aborting");
		if (!t.isSupported) return e;
		if (ct || Mt(n), t.removed = [], typeof e == "string" && (U = !1), U) {
			let t = e.nodeName;
			if (typeof t == "string") {
				let e = Y(t);
				if (!P[e] || L[e]) throw de("root node is forbidden and cannot be sanitized in-place");
			}
			qt(e);
		} else if (Bt(e)) i = It("<!---->"), o = i.ownerDocument.importNode(e, !0), o.nodeType === A.element && o.nodeName === "BODY" || o.nodeName === "HTML" ? i = o : i.appendChild(o), qt(o);
		else {
			if (!H && !z && !V && e.indexOf("<") === -1) return j && dt ? j.createHTML(e) : e;
			if (i = It(e), !i) return H ? null : dt ? M : "";
		}
		i && lt && Z(i.firstChild);
		let l = Lt(U ? e : i);
		for (; s = l.nextNode();) Vt(s), Gt(s), s.content instanceof a && Kt(s.content);
		if (U) return z && Rt(e), e;
		if (H) {
			if (z && Rt(i), ut) for (c = Ue.call(i.ownerDocument); i.firstChild;) c.appendChild(i.firstChild);
			else c = i;
			return (F.shadowroot || F.shadowrootmode) && (c = Ge.call(r, c, !0)), c;
		}
		let u = V ? i.outerHTML : i.innerHTML;
		return V && P["!doctype"] && i.ownerDocument && i.ownerDocument.doctype && i.ownerDocument.doctype.name && w(Pe, i.ownerDocument.doctype.name) && (u = "<!DOCTYPE " + i.ownerDocument.doctype.name + ">\n" + u), z && h([
			Ke,
			qe,
			Je
		], (e) => {
			u = y(u, e, " ");
		}), j && dt ? j.createHTML(u) : u;
	}, t.setConfig = function() {
		Mt(arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {}), ct = !0;
	}, t.clearConfig = function() {
		X = null, ct = !1;
	}, t.isValidAttribute = function(e, t, n) {
		return X || Mt({}), Ht(Y(e), Y(t), n);
	}, t.addHook = function(e, t) {
		typeof t == "function" && g(N[e], t);
	}, t.removeHook = function(e, t) {
		if (t !== void 0) {
			let n = ne(N[e], t);
			return n === -1 ? void 0 : ie(N[e], n, 1)[0];
		}
		return re(N[e]);
	}, t.removeHooks = function(e) {
		N[e] = [];
	}, t.removeAllHooks = function() {
		N = Re();
	}, t;
}
var j = ze();
//#endregion
export { j as t };
