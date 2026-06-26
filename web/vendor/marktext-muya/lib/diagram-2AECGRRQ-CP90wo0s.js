const e=require(`./mermaid-parser.core-BhBKl0Mt.js`),t=require(`./src-BrLQZsaB.js`),n=require(`./chunk-CSCIHK7Q-CBwzgd8G.js`),r=require(`./chunk-5ZQYHXKU-CaQ-1mD1.js`),i=require(`./chunk-WU5MYG2G-DosPOlSR.js`),a=require(`./chunk-4BX2VUAB-Bs3LahZp.js`);var o={showLegend:!0,ticks:5,max:null,min:0,graticule:`circle`},s={axes:[],curves:[],options:o},c=structuredClone(s),l=n.f.radar,u=t.r(()=>r.i({...l,...n.b().radar}),`getConfig`),d=t.r(()=>c.axes,`getAxes`),f=t.r(()=>c.curves,`getCurves`),p=t.r(()=>c.options,`getOptions`),m=t.r(e=>{c.axes=e.map(e=>{var t;return{name:e.name,label:(t=e.label)==null?e.name:t}})},`setAxes`),h=t.r(e=>{c.curves=e.map(e=>{var t;return{name:e.name,label:(t=e.label)==null?e.name:t,entries:g(e.entries)}})},`setCurves`),g=t.r(e=>{if(e[0].axis==null)return e.map(e=>e.value);let t=d();if(t.length===0)throw Error(`Axes must be populated before curves for reference entries`);return t.map(t=>{let n=e.find(e=>{var n;return((n=e.axis)==null?void 0:n.$refText)===t.name});if(n===void 0)throw Error(`Missing entry for axis `+t.label);return n.value})},`computeCurveEntries`),_={getAxes:d,getCurves:f,getOptions:p,setAxes:m,setCurves:h,setOptions:t.r(e=>{var t,n,r,i,a,s,l,u,d,f;let p=e.reduce((e,t)=>(e[t.name]=t,e),{});c.options={showLegend:(t=(n=p.showLegend)==null?void 0:n.value)==null?o.showLegend:t,ticks:(r=(i=p.ticks)==null?void 0:i.value)==null?o.ticks:r,max:(a=(s=p.max)==null?void 0:s.value)==null?o.max:a,min:(l=(u=p.min)==null?void 0:u.value)==null?o.min:l,graticule:(d=(f=p.graticule)==null?void 0:f.value)==null?o.graticule:d}},`setOptions`),getConfig:u,clear:t.r(()=>{n.a(),c=structuredClone(s)},`clear`),setAccTitle:n.U,getAccTitle:n.y,setDiagramTitle:n.K,getDiagramTitle:n.w,getAccDescription:n.v,setAccDescription:n.H},v=t.r(e=>{a.t(e,_);let{axes:t,curves:n,options:r}=e;_.setAxes(t),_.setCurves(n),_.setOptions(r)},`populate`),y={parse:t.r(async n=>{let r=await e.t(`radar`,n);t.i.debug(r),v(r)},`parse`)},b=t.r((e,t,n,r)=>{var a;let o=r.db,s=o.getAxes(),c=o.getCurves(),l=o.getOptions(),u=o.getConfig(),d=o.getDiagramTitle(),f=x(i.t(t),u),p=(a=l.max)==null?Math.max(...c.map(e=>Math.max(...e.entries))):a,m=l.min,h=Math.min(u.width,u.height)/2;S(f,s,h,l.ticks,l.graticule),C(f,s,h,u),w(f,s,c,m,p,l.graticule,u),D(f,c,l.showLegend,u),f.append(`text`).attr(`class`,`radarTitle`).text(d).attr(`x`,0).attr(`y`,-u.height/2-u.marginTop)},`draw`),x=t.r((e,t)=>{var r;let i=t.width+t.marginLeft+t.marginRight,a=t.height+t.marginTop+t.marginBottom,o={x:t.marginLeft+t.width/2,y:t.marginTop+t.height/2};return n.c(e,a,i,(r=t.useMaxWidth)==null?!0:r),e.attr(`viewBox`,`0 0 ${i} ${a}`),e.append(`g`).attr(`transform`,`translate(${o.x}, ${o.y})`)},`drawFrame`),S=t.r((e,t,n,r,i)=>{if(i===`circle`)for(let t=0;t<r;t++){let i=n*(t+1)/r;e.append(`circle`).attr(`r`,i).attr(`class`,`radarGraticule`)}else if(i===`polygon`){let i=t.length;for(let a=0;a<r;a++){let o=n*(a+1)/r,s=t.map((e,t)=>{let n=2*t*Math.PI/i-Math.PI/2;return`${o*Math.cos(n)},${o*Math.sin(n)}`}).join(` `);e.append(`polygon`).attr(`points`,s).attr(`class`,`radarGraticule`)}}},`drawGraticule`),C=t.r((e,t,n,r)=>{let i=t.length;for(let a=0;a<i;a++){let o=t[a].label,s=2*a*Math.PI/i-Math.PI/2;e.append(`line`).attr(`x1`,0).attr(`y1`,0).attr(`x2`,n*r.axisScaleFactor*Math.cos(s)).attr(`y2`,n*r.axisScaleFactor*Math.sin(s)).attr(`class`,`radarAxisLine`),e.append(`text`).text(o).attr(`x`,n*r.axisLabelFactor*Math.cos(s)).attr(`y`,n*r.axisLabelFactor*Math.sin(s)).attr(`class`,`radarAxisLabel`)}},`drawAxes`);function w(e,t,n,r,i,a,o){let s=t.length,c=Math.min(o.width,o.height)/2;n.forEach((t,n)=>{if(t.entries.length!==s)return;let l=t.entries.map((e,t)=>{let n=2*Math.PI*t/s-Math.PI/2,a=T(e,r,i,c);return{x:a*Math.cos(n),y:a*Math.sin(n)}});a===`circle`?e.append(`path`).attr(`d`,E(l,o.curveTension)).attr(`class`,`radarCurve-${n}`):a===`polygon`&&e.append(`polygon`).attr(`points`,l.map(e=>`${e.x},${e.y}`).join(` `)).attr(`class`,`radarCurve-${n}`)})}t.r(w,`drawCurves`);function T(e,t,n,r){return r*(Math.min(Math.max(e,t),n)-t)/(n-t)}t.r(T,`relativeRadius`);function E(e,t){let n=e.length,r=`M${e[0].x},${e[0].y}`;for(let i=0;i<n;i++){let a=e[(i-1+n)%n],o=e[i],s=e[(i+1)%n],c=e[(i+2)%n],l={x:o.x+(s.x-a.x)*t,y:o.y+(s.y-a.y)*t},u={x:s.x-(c.x-o.x)*t,y:s.y-(c.y-o.y)*t};r+=` C${l.x},${l.y} ${u.x},${u.y} ${s.x},${s.y}`}return`${r} Z`}t.r(E,`closedRoundCurve`);function D(e,t,n,r){if(!n)return;let i=(r.width/2+r.marginRight)*3/4,a=-(r.height/2+r.marginTop)*3/4;t.forEach((t,n)=>{let r=e.append(`g`).attr(`transform`,`translate(${i}, ${a+n*20})`);r.append(`rect`).attr(`width`,12).attr(`height`,12).attr(`class`,`radarLegendBox-${n}`),r.append(`text`).attr(`x`,16).attr(`y`,0).attr(`class`,`radarLegendText`).text(t.label)})}t.r(D,`drawLegend`);var O={draw:b},k=t.r((e,t)=>{let n=``;for(let r=0;r<e.THEME_COLOR_LIMIT;r++){let i=e[`cScale${r}`];n+=`
		.radarCurve-${r} {
			color: ${i};
			fill: ${i};
			fill-opacity: ${t.curveOpacity};
			stroke: ${i};
			stroke-width: ${t.curveStrokeWidth};
		}
		.radarLegendBox-${r} {
			fill: ${i};
			fill-opacity: ${t.curveOpacity};
			stroke: ${i};
		}
		`}return n},`genIndexStyles`),A=t.r(e=>{let t=r.i(n.D(),n.b().themeVariables);return{themeVariables:t,radarOptions:r.i(t.radar,e)}},`buildRadarStyleOptions`),j={parser:y,db:_,renderer:O,styles:t.r(({radar:e}={})=>{let{themeVariables:t,radarOptions:n}=A(e);return`
	.radarTitle {
		font-size: ${t.fontSize};
		color: ${t.titleColor};
		dominant-baseline: hanging;
		text-anchor: middle;
	}
	.radarAxisLine {
		stroke: ${n.axisColor};
		stroke-width: ${n.axisStrokeWidth};
	}
	.radarAxisLabel {
		dominant-baseline: middle;
		text-anchor: middle;
		font-size: ${n.axisLabelFontSize}px;
		color: ${n.axisColor};
	}
	.radarGraticule {
		fill: ${n.graticuleColor};
		fill-opacity: ${n.graticuleOpacity};
		stroke: ${n.graticuleColor};
		stroke-width: ${n.graticuleStrokeWidth};
	}
	.radarLegendText {
		text-anchor: start;
		font-size: ${n.legendFontSize}px;
		dominant-baseline: hanging;
	}
	${k(t,n)}
	`},`styles`)};exports.diagram=j;