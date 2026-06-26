const e=require(`./mermaid-parser.core-BhBKl0Mt.js`),t=require(`./src-BrLQZsaB.js`),n=require(`./chunk-CSCIHK7Q-CBwzgd8G.js`),r=require(`./ordinal-CzRHIkGf.js`),i=require(`./step-DKrl6BU1.js`),a=require(`./arc-C5Oifxlt.js`),o=require(`./chunk-5ZQYHXKU-CaQ-1mD1.js`),s=require(`./chunk-WU5MYG2G-DosPOlSR.js`),c=require(`./chunk-4BX2VUAB-Bs3LahZp.js`);function l(e,t){return t<e?-1:t>e?1:t>=e?0:NaN}function u(e){return e}function d(){var e=u,t=l,n=null,r=i.L(0),a=i.L(i.I),o=i.L(0);function s(s){var c,l=(s=i.S(s)).length,u,d,f=0,p=Array(l),m=Array(l),h=+r.apply(this,arguments),g=Math.min(i.I,Math.max(-i.I,a.apply(this,arguments)-h)),_,v=Math.min(Math.abs(g)/l,o.apply(this,arguments)),y=v*(g<0?-1:1),b;for(c=0;c<l;++c)(b=m[p[c]=c]=+e(s[c],c,s))>0&&(f+=b);for(t==null?n!=null&&p.sort(function(e,t){return n(s[e],s[t])}):p.sort(function(e,n){return t(m[e],m[n])}),c=0,d=f?(g-l*y)/f:0;c<l;++c,h=_)u=p[c],b=m[u],_=h+(b>0?b*d:0)+y,m[u]={data:s[u],index:c,value:b,startAngle:h,endAngle:_,padAngle:v};return m}return s.value=function(t){return arguments.length?(e=typeof t==`function`?t:i.L(+t),s):e},s.sortValues=function(e){return arguments.length?(t=e,n=null,s):t},s.sort=function(e){return arguments.length?(n=e,t=null,s):n},s.startAngle=function(e){return arguments.length?(r=typeof e==`function`?e:i.L(+e),s):r},s.endAngle=function(e){return arguments.length?(a=typeof e==`function`?e:i.L(+e),s):a},s.padAngle=function(e){return arguments.length?(o=typeof e==`function`?e:i.L(+e),s):o},s}var f=n.f.pie,p={sections:new Map,showData:!1,config:f},m=p.sections,h=p.showData,g=structuredClone(f),_={getConfig:t.r(()=>structuredClone(g),`getConfig`),clear:t.r(()=>{m=new Map,h=p.showData,n.a()},`clear`),setDiagramTitle:n.K,getDiagramTitle:n.w,setAccTitle:n.U,getAccTitle:n.y,setAccDescription:n.H,getAccDescription:n.v,addSection:t.r(({label:e,value:n})=>{if(n<0)throw Error(`"${e}" has invalid value: ${n}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);m.has(e)||(m.set(e,n),t.i.debug(`added new section: ${e}, with value: ${n}`))},`addSection`),getSections:t.r(()=>m,`getSections`),setShowData:t.r(e=>{h=e},`setShowData`),getShowData:t.r(()=>h,`getShowData`)},v=t.r((e,t)=>{c.t(e,t),t.setShowData(e.showData),e.sections.map(t.addSection)},`populateDb`),y={parse:t.r(async n=>{let r=await e.t(`pie`,n);t.i.debug(r),v(r,_)},`parse`)},b=t.r(e=>`
  .pieCircle{
    stroke: ${e.pieStrokeColor};
    stroke-width : ${e.pieStrokeWidth};
    opacity : ${e.pieOpacity};
  }
  .pieOuterCircle{
    stroke: ${e.pieOuterStrokeColor};
    stroke-width: ${e.pieOuterStrokeWidth};
    fill: none;
  }
  .pieTitleText {
    text-anchor: middle;
    font-size: ${e.pieTitleTextSize};
    fill: ${e.pieTitleTextColor};
    font-family: ${e.fontFamily};
  }
  .slice {
    font-family: ${e.fontFamily};
    fill: ${e.pieSectionTextColor};
    font-size:${e.pieSectionTextSize};
    // fill: white;
  }
  .legend text {
    fill: ${e.pieLegendTextColor};
    font-family: ${e.fontFamily};
    font-size: ${e.pieLegendTextSize};
  }
`,`getStyles`),x=t.r(e=>{let t=[...e.values()].reduce((e,t)=>e+t,0),n=[...e.entries()].map(([e,t])=>({label:e,value:t})).filter(e=>e.value/t*100>=1);return d().value(e=>e.value).sort(null)(n)},`createPieArcs`),S={parser:y,db:_,renderer:{draw:t.r((e,i,c,l)=>{var u,d;t.i.debug(`rendering pie chart
`+e);let f=l.db,p=n.x(),m=o.i(f.getConfig(),p.pie),h=s.t(i),g=h.append(`g`);g.attr(`transform`,`translate(225,225)`);let{themeVariables:_}=p,[v]=o.p(_.pieOuterStrokeWidth);v!=null||(v=2);let y=m.textPosition,b=a.t().innerRadius(0).outerRadius(185),S=a.t().innerRadius(185*y).outerRadius(185*y);g.append(`circle`).attr(`cx`,0).attr(`cy`,0).attr(`r`,185+v/2).attr(`class`,`pieOuterCircle`);let C=f.getSections(),w=x(C),T=[_.pie1,_.pie2,_.pie3,_.pie4,_.pie5,_.pie6,_.pie7,_.pie8,_.pie9,_.pie10,_.pie11,_.pie12],E=0;C.forEach(e=>{E+=e});let D=w.filter(e=>(e.data.value/E*100).toFixed(0)!==`0`),O=r.n(T).domain([...C.keys()]);g.selectAll(`mySlices`).data(D).enter().append(`path`).attr(`d`,b).attr(`fill`,e=>O(e.data.label)).attr(`class`,`pieCircle`),g.selectAll(`mySlices`).data(D).enter().append(`text`).text(e=>(e.data.value/E*100).toFixed(0)+`%`).attr(`transform`,e=>`translate(`+S.centroid(e)+`)`).style(`text-anchor`,`middle`).attr(`class`,`slice`);let k=g.append(`text`).text(f.getDiagramTitle()).attr(`x`,0).attr(`y`,-400/2).attr(`class`,`pieTitleText`),A=[...C.entries()].map(([e,t])=>({label:e,value:t})),j=g.selectAll(`.legend`).data(A).enter().append(`g`).attr(`class`,`legend`).attr(`transform`,(e,t)=>{let n=22*A.length/2;return`translate(216,`+(t*22-n)+`)`});j.append(`rect`).attr(`width`,18).attr(`height`,18).style(`fill`,e=>O(e.label)).style(`stroke`,e=>O(e.label)),j.append(`text`).attr(`x`,22).attr(`y`,14).text(e=>f.getShowData()?`${e.label} [${e.value}]`:e.label);let M=512+Math.max(...j.selectAll(`text`).nodes().map(e=>{var t;return(t=e==null?void 0:e.getBoundingClientRect().width)==null?0:t})),N=(u=(d=k.node())==null?void 0:d.getBoundingClientRect().width)==null?0:u,P=450/2-N/2,F=450/2+N/2,I=Math.min(0,P),L=Math.max(M,F)-I;h.attr(`viewBox`,`${I} 0 ${L} 450`),n.c(h,450,L,m.useMaxWidth)},`draw`)},styles:b};exports.diagram=S;