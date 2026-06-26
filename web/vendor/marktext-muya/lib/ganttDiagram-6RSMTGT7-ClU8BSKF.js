const e=require(`./cjs/index.js`),t=require(`./src-BrLQZsaB.js`),n=require(`./chunk-CSCIHK7Q-CBwzgd8G.js`),r=require(`./linear-B6vOEYwb.js`),i=require(`./time-CSt3jVTW.js`),a=require(`./step-DKrl6BU1.js`),o=require(`./chunk-5ZQYHXKU-CaQ-1mD1.js`),s=require(`./mermaid.core-D3PcpQA5.js`);function c(e){return e}var l=1,u=2,d=3,f=4,p=1e-6;function m(e){return`translate(`+e+`,0)`}function h(e){return`translate(0,`+e+`)`}function g(e){return t=>+e(t)}function _(e,t){return t=Math.max(0,e.bandwidth()-t*2)/2,e.round()&&(t=Math.round(t)),n=>+e(n)+t}function v(){return!this.__axis}function y(e,t){var n=[],r=null,i=null,a=6,o=6,s=3,y=typeof window<`u`&&window.devicePixelRatio>1?0:.5,b=e===l||e===f?-1:1,x=e===f||e===u?`x`:`y`,S=e===l||e===d?m:h;function C(m){var h=r==null?t.ticks?t.ticks.apply(t,n):t.domain():r,C=i==null?t.tickFormat?t.tickFormat.apply(t,n):c:i,w=Math.max(a,0)+s,T=t.range(),E=+T[0]+y,D=+T[T.length-1]+y,O=(t.bandwidth?_:g)(t.copy(),y),k=m.selection?m.selection():m,A=k.selectAll(`.domain`).data([null]),j=k.selectAll(`.tick`).data(h,t).order(),M=j.exit(),N=j.enter().append(`g`).attr(`class`,`tick`),P=j.select(`line`),F=j.select(`text`);A=A.merge(A.enter().insert(`path`,`.tick`).attr(`class`,`domain`).attr(`stroke`,`currentColor`)),j=j.merge(N),P=P.merge(N.append(`line`).attr(`stroke`,`currentColor`).attr(x+`2`,b*a)),F=F.merge(N.append(`text`).attr(`fill`,`currentColor`).attr(x,b*w).attr(`dy`,e===l?`0em`:e===d?`0.71em`:`0.32em`)),m!==k&&(A=A.transition(m),j=j.transition(m),P=P.transition(m),F=F.transition(m),M=M.transition(m).attr(`opacity`,p).attr(`transform`,function(e){return isFinite(e=O(e))?S(e+y):this.getAttribute(`transform`)}),N.attr(`opacity`,p).attr(`transform`,function(e){var t=this.parentNode.__axis;return S((t&&isFinite(t=t(e))?t:O(e))+y)})),M.remove(),A.attr(`d`,e===f||e===u?o?`M`+b*o+`,`+E+`H`+y+`V`+D+`H`+b*o:`M`+y+`,`+E+`V`+D:o?`M`+E+`,`+b*o+`V`+y+`H`+D+`V`+b*o:`M`+E+`,`+y+`H`+D),j.attr(`opacity`,1).attr(`transform`,function(e){return S(O(e)+y)}),P.attr(x+`2`,b*a),F.attr(x,b*w).text(C),k.filter(v).attr(`fill`,`none`).attr(`font-size`,10).attr(`font-family`,`sans-serif`).attr(`text-anchor`,e===u?`start`:e===f?`end`:`middle`),k.each(function(){this.__axis=O})}return C.scale=function(e){return arguments.length?(t=e,C):t},C.ticks=function(){return n=Array.from(arguments),C},C.tickArguments=function(e){return arguments.length?(n=e==null?[]:Array.from(e),C):n.slice()},C.tickValues=function(e){return arguments.length?(r=e==null?null:Array.from(e),C):r&&r.slice()},C.tickFormat=function(e){return arguments.length?(i=e,C):i},C.tickSize=function(e){return arguments.length?(a=o=+e,C):a},C.tickSizeInner=function(e){return arguments.length?(a=+e,C):a},C.tickSizeOuter=function(e){return arguments.length?(o=+e,C):o},C.tickPadding=function(e){return arguments.length?(s=+e,C):s},C.offset=function(e){return arguments.length?(y=+e,C):y},C}function b(e){return y(l,e)}function x(e){return y(d,e)}var S=e.t(((e,t)=>{(function(n,r){typeof e==`object`&&t!==void 0?t.exports=r():typeof define==`function`&&define.amd?define(r):(n=typeof globalThis<`u`?globalThis:n||self).dayjs_plugin_isoWeek=r()})(e,(function(){"use strict";var e=`day`;return function(t,n,r){var i=function(t){return t.add(4-t.isoWeekday(),e)},a=n.prototype;a.isoWeekYear=function(){return i(this).year()},a.isoWeek=function(t){if(!this.$utils().u(t))return this.add(7*(t-this.isoWeek()),e);var n,a,o,s,c=i(this),l=(n=this.isoWeekYear(),a=this.$u,o=(a?r.utc:r)().year(n).startOf(`year`),s=4-o.isoWeekday(),o.isoWeekday()>4&&(s+=7),o.add(s,e));return c.diff(l,`week`)+1},a.isoWeekday=function(e){return this.$utils().u(e)?this.day()||7:this.day(this.day()%7?e:e-7)};var o=a.startOf;a.startOf=function(e,t){var n=this.$utils(),r=!!n.u(t)||t;return n.p(e)===`isoweek`?r?this.date(this.date()-(this.isoWeekday()-1)).startOf(`day`):this.date(this.date()-1-(this.isoWeekday()-1)+7).endOf(`day`):o.bind(this)(e,t)}}}))})),C=e.t(((e,t)=>{(function(n,r){typeof e==`object`&&t!==void 0?t.exports=r():typeof define==`function`&&define.amd?define(r):(n=typeof globalThis<`u`?globalThis:n||self).dayjs_plugin_customParseFormat=r()})(e,(function(){"use strict";var e={LTS:`h:mm:ss A`,LT:`h:mm A`,L:`MM/DD/YYYY`,LL:`MMMM D, YYYY`,LLL:`MMMM D, YYYY h:mm A`,LLLL:`dddd, MMMM D, YYYY h:mm A`},t=/(\[[^[]*\])|([-_:/.,()\s]+)|(A|a|Q|YYYY|YY?|ww?|MM?M?M?|Do|DD?|hh?|HH?|mm?|ss?|S{1,3}|z|ZZ?)/g,n=/\d/,r=/\d\d/,i=/\d\d?/,a=/\d*[^-_:/,()\s\d]+/,o={},s=function(e){return(e=+e)+(e>68?1900:2e3)},c=function(e){return function(t){this[e]=+t}},l=[/[+-]\d\d:?(\d\d)?|Z/,function(e){(this.zone||(this.zone={})).offset=function(e){if(!e||e===`Z`)return 0;var t=e.match(/([+-]|\d\d)/g),n=60*t[1]+(+t[2]||0);return n===0?0:t[0]===`+`?-n:n}(e)}],u=function(e){var t=o[e];return t&&(t.indexOf?t:t.s.concat(t.f))},d=function(e,t){var n,r=o.meridiem;if(r){for(var i=1;i<=24;i+=1)if(e.indexOf(r(i,0,t))>-1){n=i>12;break}}else n=e===(t?`pm`:`PM`);return n},f={A:[a,function(e){this.afternoon=d(e,!1)}],a:[a,function(e){this.afternoon=d(e,!0)}],Q:[n,function(e){this.month=3*(e-1)+1}],S:[n,function(e){this.milliseconds=100*e}],SS:[r,function(e){this.milliseconds=10*e}],SSS:[/\d{3}/,function(e){this.milliseconds=+e}],s:[i,c(`seconds`)],ss:[i,c(`seconds`)],m:[i,c(`minutes`)],mm:[i,c(`minutes`)],H:[i,c(`hours`)],h:[i,c(`hours`)],HH:[i,c(`hours`)],hh:[i,c(`hours`)],D:[i,c(`day`)],DD:[r,c(`day`)],Do:[a,function(e){var t=o.ordinal,n=e.match(/\d+/);if(this.day=n[0],t)for(var r=1;r<=31;r+=1)t(r).replace(/\[|\]/g,``)===e&&(this.day=r)}],w:[i,c(`week`)],ww:[r,c(`week`)],M:[i,c(`month`)],MM:[r,c(`month`)],MMM:[a,function(e){var t=u(`months`),n=(u(`monthsShort`)||t.map((function(e){return e.slice(0,3)}))).indexOf(e)+1;if(n<1)throw Error();this.month=n%12||n}],MMMM:[a,function(e){var t=u(`months`).indexOf(e)+1;if(t<1)throw Error();this.month=t%12||t}],Y:[/[+-]?\d+/,c(`year`)],YY:[r,function(e){this.year=s(e)}],YYYY:[/\d{4}/,c(`year`)],Z:l,ZZ:l};function p(n){for(var r=n,i=o&&o.formats,a=(n=r.replace(/(\[[^\]]+])|(LTS?|l{1,4}|L{1,4})/g,(function(t,n,r){var a=r&&r.toUpperCase();return n||i[r]||e[r]||i[a].replace(/(\[[^\]]+])|(MMMM|MM|DD|dddd)/g,(function(e,t,n){return t||n.slice(1)}))}))).match(t),s=a.length,c=0;c<s;c+=1){var l=a[c],u=f[l],d=u&&u[0],p=u&&u[1];a[c]=p?{regex:d,parser:p}:l.replace(/^\[|\]$/g,``)}return function(e){for(var t={},n=0,r=0;n<s;n+=1){var i=a[n];if(typeof i==`string`)r+=i.length;else{var o=i.regex,c=i.parser,l=e.slice(r),u=o.exec(l)[0];c.call(t,u),e=e.replace(u,``)}}return function(e){var t=e.afternoon;if(t!==void 0){var n=e.hours;t?n<12&&(e.hours+=12):n===12&&(e.hours=0),delete e.afternoon}}(t),t}}return function(e,t,n){n.p.customParseFormat=!0,e&&e.parseTwoDigitYear&&(s=e.parseTwoDigitYear);var r=t.prototype,i=r.parse;r.parse=function(e){var t=e.date,r=e.utc,a=e.args;this.$u=r;var s=a[1];if(typeof s==`string`){var c=!0===a[2],l=!0===a[3],u=c||l,d=a[2];l&&(d=a[2]),o=this.$locale(),!c&&d&&(o=n.Ls[d]),this.$d=function(e,t,n,r){try{if([`x`,`X`].indexOf(t)>-1)return new Date((t===`X`?1e3:1)*e);var i=p(t)(e),a=i.year,o=i.month,s=i.day,c=i.hours,l=i.minutes,u=i.seconds,d=i.milliseconds,f=i.zone,m=i.week,h=new Date,g=s||(a||o?1:h.getDate()),_=a||h.getFullYear(),v=0;a&&!o||(v=o>0?o-1:h.getMonth());var y,b=c||0,x=l||0,S=u||0,C=d||0;return f?new Date(Date.UTC(_,v,g,b,x,S,C+60*f.offset*1e3)):n?new Date(Date.UTC(_,v,g,b,x,S,C)):(y=new Date(_,v,g,b,x,S,C),m&&(y=r(y).week(m).toDate()),y)}catch{return new Date(``)}}(t,s,r,n),this.init(),d&&!0!==d&&(this.$L=this.locale(d).$L),u&&t!=this.format(s)&&(this.$d=new Date(``)),o={}}else if(s instanceof Array)for(var f=s.length,m=1;m<=f;m+=1){a[1]=s[m-1];var h=n.apply(this,a);if(h.isValid()){this.$d=h.$d,this.$L=h.$L,this.init();break}m===f&&(this.$d=new Date(``))}else i.call(this,e)}}}))})),w=e.t(((e,t)=>{(function(n,r){typeof e==`object`&&t!==void 0?t.exports=r():typeof define==`function`&&define.amd?define(r):(n=typeof globalThis<`u`?globalThis:n||self).dayjs_plugin_advancedFormat=r()})(e,(function(){"use strict";return function(e,t){var n=t.prototype,r=n.format;n.format=function(e){var t=this,n=this.$locale();if(!this.isValid())return r.bind(this)(e);var i=this.$utils(),a=(e||`YYYY-MM-DDTHH:mm:ssZ`).replace(/\[([^\]]+)]|Q|wo|ww|w|WW|W|zzz|z|gggg|GGGG|Do|X|x|k{1,2}|S/g,(function(e){switch(e){case`Q`:return Math.ceil((t.$M+1)/3);case`Do`:return n.ordinal(t.$D);case`gggg`:return t.weekYear();case`GGGG`:return t.isoWeekYear();case`wo`:return n.ordinal(t.week(),`W`);case`w`:case`ww`:return i.s(t.week(),e===`w`?1:2,`0`);case`W`:case`WW`:return i.s(t.isoWeek(),e===`W`?1:2,`0`);case`k`:case`kk`:return i.s(String(t.$H===0?24:t.$H),e===`k`?1:2,`0`);case`X`:return Math.floor(t.$d.getTime()/1e3);case`x`:return t.$d.getTime();case`z`:return`[`+t.offsetName()+`]`;case`zzz`:return`[`+t.offsetName(`long`)+`]`;default:return e}}));return r.bind(this)(a)}}}))})),T=e.t(((e,t)=>{(function(n,r){typeof e==`object`&&t!==void 0?t.exports=r():typeof define==`function`&&define.amd?define(r):(n=typeof globalThis<`u`?globalThis:n||self).dayjs_plugin_duration=r()})(e,(function(){"use strict";var e,t,n=1e3,r=6e4,i=36e5,a=864e5,o=/\[([^\]]+)]|Y{1,4}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g,s=31536e6,c=2628e6,l=/^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/,u={years:s,months:c,days:a,hours:i,minutes:r,seconds:n,milliseconds:1,weeks:6048e5},d=function(e){return e instanceof v},f=function(e,t,n){return new v(e,n,t.$l)},p=function(e){return t.p(e)+`s`},m=function(e){return e<0},h=function(e){return m(e)?Math.ceil(e):Math.floor(e)},g=function(e){return Math.abs(e)},_=function(e,t){return e?m(e)?{negative:!0,format:``+g(e)+t}:{negative:!1,format:``+e+t}:{negative:!1,format:``}},v=function(){function m(e,t,n){var r=this;if(this.$d={},this.$l=n,e===void 0&&(this.$ms=0,this.parseFromMilliseconds()),t)return f(e*u[p(t)],this);if(typeof e==`number`)return this.$ms=e,this.parseFromMilliseconds(),this;if(typeof e==`object`)return Object.keys(e).forEach((function(t){r.$d[p(t)]=e[t]})),this.calMilliseconds(),this;if(typeof e==`string`){var i=e.match(l);if(i){var a=i.slice(2).map((function(e){return e==null?0:Number(e)}));return this.$d.years=a[0],this.$d.months=a[1],this.$d.weeks=a[2],this.$d.days=a[3],this.$d.hours=a[4],this.$d.minutes=a[5],this.$d.seconds=a[6],this.calMilliseconds(),this}}return this}var g=m.prototype;return g.calMilliseconds=function(){var e=this;this.$ms=Object.keys(this.$d).reduce((function(t,n){return t+(e.$d[n]||0)*u[n]}),0)},g.parseFromMilliseconds=function(){var e=this.$ms;this.$d.years=h(e/s),e%=s,this.$d.months=h(e/c),e%=c,this.$d.days=h(e/a),e%=a,this.$d.hours=h(e/i),e%=i,this.$d.minutes=h(e/r),e%=r,this.$d.seconds=h(e/n),e%=n,this.$d.milliseconds=e},g.toISOString=function(){var e=_(this.$d.years,`Y`),t=_(this.$d.months,`M`),n=+this.$d.days||0;this.$d.weeks&&(n+=7*this.$d.weeks);var r=_(n,`D`),i=_(this.$d.hours,`H`),a=_(this.$d.minutes,`M`),o=this.$d.seconds||0;this.$d.milliseconds&&(o+=this.$d.milliseconds/1e3,o=Math.round(1e3*o)/1e3);var s=_(o,`S`),c=e.negative||t.negative||r.negative||i.negative||a.negative||s.negative,l=i.format||a.format||s.format?`T`:``,u=(c?`-`:``)+`P`+e.format+t.format+r.format+l+i.format+a.format+s.format;return u===`P`||u===`-P`?`P0D`:u},g.toJSON=function(){return this.toISOString()},g.format=function(e){var n=e||`YYYY-MM-DDTHH:mm:ss`,r={Y:this.$d.years,YY:t.s(this.$d.years,2,`0`),YYYY:t.s(this.$d.years,4,`0`),M:this.$d.months,MM:t.s(this.$d.months,2,`0`),D:this.$d.days,DD:t.s(this.$d.days,2,`0`),H:this.$d.hours,HH:t.s(this.$d.hours,2,`0`),m:this.$d.minutes,mm:t.s(this.$d.minutes,2,`0`),s:this.$d.seconds,ss:t.s(this.$d.seconds,2,`0`),SSS:t.s(this.$d.milliseconds,3,`0`)};return n.replace(o,(function(e,t){return t||String(r[e])}))},g.as=function(e){return this.$ms/u[p(e)]},g.get=function(e){var t=this.$ms,n=p(e);return n===`milliseconds`?t%=1e3:t=n===`weeks`?h(t/u[n]):this.$d[n],t||0},g.add=function(e,t,n){var r;return r=t?e*u[p(t)]:d(e)?e.$ms:f(e,this).$ms,f(this.$ms+r*(n?-1:1),this)},g.subtract=function(e,t){return this.add(e,t,!0)},g.locale=function(e){var t=this.clone();return t.$l=e,t},g.clone=function(){return f(this.$ms,this)},g.humanize=function(t){return e().add(this.$ms,`ms`).locale(this.$l).fromNow(!t)},g.valueOf=function(){return this.asMilliseconds()},g.milliseconds=function(){return this.get(`milliseconds`)},g.asMilliseconds=function(){return this.as(`milliseconds`)},g.seconds=function(){return this.get(`seconds`)},g.asSeconds=function(){return this.as(`seconds`)},g.minutes=function(){return this.get(`minutes`)},g.asMinutes=function(){return this.as(`minutes`)},g.hours=function(){return this.get(`hours`)},g.asHours=function(){return this.as(`hours`)},g.days=function(){return this.get(`days`)},g.asDays=function(){return this.as(`days`)},g.weeks=function(){return this.get(`weeks`)},g.asWeeks=function(){return this.as(`weeks`)},g.months=function(){return this.get(`months`)},g.asMonths=function(){return this.as(`months`)},g.years=function(){return this.get(`years`)},g.asYears=function(){return this.as(`years`)},m}(),y=function(e,t,n){return e.add(t.years()*n,`y`).add(t.months()*n,`M`).add(t.days()*n,`d`).add(t.hours()*n,`h`).add(t.minutes()*n,`m`).add(t.seconds()*n,`s`).add(t.milliseconds()*n,`ms`)};return function(n,r,i){e=i,t=i().$utils(),i.duration=function(e,t){return f(e,{$l:i.locale()},t)},i.isDuration=d;var a=r.prototype.add,o=r.prototype.subtract;r.prototype.add=function(e,t){return d(e)?y(this,e,1):a.bind(this)(e,t)},r.prototype.subtract=function(e,t){return d(e)?y(this,e,-1):o.bind(this)(e,t)}}}))})),E=s.t(),D=e.r(t.o(),1),O=e.r(S(),1),k=e.r(C(),1),A=e.r(w(),1),j=e.r(T(),1),M=(function(){var e=t.r(function(e,t,n,r){for(n=n||{},r=e.length;r--;n[e[r]]=t);return n},`o`),n=[6,8,10,12,13,14,15,16,17,18,20,21,22,23,24,25,26,27,28,29,30,31,33,35,36,38,40],r=[1,26],i=[1,27],a=[1,28],o=[1,29],s=[1,30],c=[1,31],l=[1,32],u=[1,33],d=[1,34],f=[1,9],p=[1,10],m=[1,11],h=[1,12],g=[1,13],_=[1,14],v=[1,15],y=[1,16],b=[1,19],x=[1,20],S=[1,21],C=[1,22],w=[1,23],T=[1,25],E=[1,35],D={trace:t.r(function(){},`trace`),yy:{},symbols_:{error:2,start:3,gantt:4,document:5,EOF:6,line:7,SPACE:8,statement:9,NL:10,weekday:11,weekday_monday:12,weekday_tuesday:13,weekday_wednesday:14,weekday_thursday:15,weekday_friday:16,weekday_saturday:17,weekday_sunday:18,weekend:19,weekend_friday:20,weekend_saturday:21,dateFormat:22,inclusiveEndDates:23,topAxis:24,axisFormat:25,tickInterval:26,excludes:27,includes:28,todayMarker:29,title:30,acc_title:31,acc_title_value:32,acc_descr:33,acc_descr_value:34,acc_descr_multiline_value:35,section:36,clickStatement:37,taskTxt:38,taskData:39,click:40,callbackname:41,callbackargs:42,href:43,clickStatementDebug:44,$accept:0,$end:1},terminals_:{2:`error`,4:`gantt`,6:`EOF`,8:`SPACE`,10:`NL`,12:`weekday_monday`,13:`weekday_tuesday`,14:`weekday_wednesday`,15:`weekday_thursday`,16:`weekday_friday`,17:`weekday_saturday`,18:`weekday_sunday`,20:`weekend_friday`,21:`weekend_saturday`,22:`dateFormat`,23:`inclusiveEndDates`,24:`topAxis`,25:`axisFormat`,26:`tickInterval`,27:`excludes`,28:`includes`,29:`todayMarker`,30:`title`,31:`acc_title`,32:`acc_title_value`,33:`acc_descr`,34:`acc_descr_value`,35:`acc_descr_multiline_value`,36:`section`,38:`taskTxt`,39:`taskData`,40:`click`,41:`callbackname`,42:`callbackargs`,43:`href`},productions_:[0,[3,3],[5,0],[5,2],[7,2],[7,1],[7,1],[7,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[19,1],[19,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,2],[9,2],[9,1],[9,1],[9,1],[9,2],[37,2],[37,3],[37,3],[37,4],[37,3],[37,4],[37,2],[44,2],[44,3],[44,3],[44,4],[44,3],[44,4],[44,2]],performAction:t.r(function(e,t,n,r,i,a,o){var s=a.length-1;switch(i){case 1:return a[s-1];case 2:this.$=[];break;case 3:a[s-1].push(a[s]),this.$=a[s-1];break;case 4:case 5:this.$=a[s];break;case 6:case 7:this.$=[];break;case 8:r.setWeekday(`monday`);break;case 9:r.setWeekday(`tuesday`);break;case 10:r.setWeekday(`wednesday`);break;case 11:r.setWeekday(`thursday`);break;case 12:r.setWeekday(`friday`);break;case 13:r.setWeekday(`saturday`);break;case 14:r.setWeekday(`sunday`);break;case 15:r.setWeekend(`friday`);break;case 16:r.setWeekend(`saturday`);break;case 17:r.setDateFormat(a[s].substr(11)),this.$=a[s].substr(11);break;case 18:r.enableInclusiveEndDates(),this.$=a[s].substr(18);break;case 19:r.TopAxis(),this.$=a[s].substr(8);break;case 20:r.setAxisFormat(a[s].substr(11)),this.$=a[s].substr(11);break;case 21:r.setTickInterval(a[s].substr(13)),this.$=a[s].substr(13);break;case 22:r.setExcludes(a[s].substr(9)),this.$=a[s].substr(9);break;case 23:r.setIncludes(a[s].substr(9)),this.$=a[s].substr(9);break;case 24:r.setTodayMarker(a[s].substr(12)),this.$=a[s].substr(12);break;case 27:r.setDiagramTitle(a[s].substr(6)),this.$=a[s].substr(6);break;case 28:this.$=a[s].trim(),r.setAccTitle(this.$);break;case 29:case 30:this.$=a[s].trim(),r.setAccDescription(this.$);break;case 31:r.addSection(a[s].substr(8)),this.$=a[s].substr(8);break;case 33:r.addTask(a[s-1],a[s]),this.$=`task`;break;case 34:this.$=a[s-1],r.setClickEvent(a[s-1],a[s],null);break;case 35:this.$=a[s-2],r.setClickEvent(a[s-2],a[s-1],a[s]);break;case 36:this.$=a[s-2],r.setClickEvent(a[s-2],a[s-1],null),r.setLink(a[s-2],a[s]);break;case 37:this.$=a[s-3],r.setClickEvent(a[s-3],a[s-2],a[s-1]),r.setLink(a[s-3],a[s]);break;case 38:this.$=a[s-2],r.setClickEvent(a[s-2],a[s],null),r.setLink(a[s-2],a[s-1]);break;case 39:this.$=a[s-3],r.setClickEvent(a[s-3],a[s-1],a[s]),r.setLink(a[s-3],a[s-2]);break;case 40:this.$=a[s-1],r.setLink(a[s-1],a[s]);break;case 41:case 47:this.$=a[s-1]+` `+a[s];break;case 42:case 43:case 45:this.$=a[s-2]+` `+a[s-1]+` `+a[s];break;case 44:case 46:this.$=a[s-3]+` `+a[s-2]+` `+a[s-1]+` `+a[s];break}},`anonymous`),table:[{3:1,4:[1,2]},{1:[3]},e(n,[2,2],{5:3}),{6:[1,4],7:5,8:[1,6],9:7,10:[1,8],11:17,12:r,13:i,14:a,15:o,16:s,17:c,18:l,19:18,20:u,21:d,22:f,23:p,24:m,25:h,26:g,27:_,28:v,29:y,30:b,31:x,33:S,35:C,36:w,37:24,38:T,40:E},e(n,[2,7],{1:[2,1]}),e(n,[2,3]),{9:36,11:17,12:r,13:i,14:a,15:o,16:s,17:c,18:l,19:18,20:u,21:d,22:f,23:p,24:m,25:h,26:g,27:_,28:v,29:y,30:b,31:x,33:S,35:C,36:w,37:24,38:T,40:E},e(n,[2,5]),e(n,[2,6]),e(n,[2,17]),e(n,[2,18]),e(n,[2,19]),e(n,[2,20]),e(n,[2,21]),e(n,[2,22]),e(n,[2,23]),e(n,[2,24]),e(n,[2,25]),e(n,[2,26]),e(n,[2,27]),{32:[1,37]},{34:[1,38]},e(n,[2,30]),e(n,[2,31]),e(n,[2,32]),{39:[1,39]},e(n,[2,8]),e(n,[2,9]),e(n,[2,10]),e(n,[2,11]),e(n,[2,12]),e(n,[2,13]),e(n,[2,14]),e(n,[2,15]),e(n,[2,16]),{41:[1,40],43:[1,41]},e(n,[2,4]),e(n,[2,28]),e(n,[2,29]),e(n,[2,33]),e(n,[2,34],{42:[1,42],43:[1,43]}),e(n,[2,40],{41:[1,44]}),e(n,[2,35],{43:[1,45]}),e(n,[2,36]),e(n,[2,38],{42:[1,46]}),e(n,[2,37]),e(n,[2,39])],defaultActions:{},parseError:t.r(function(e,t){if(t.recoverable)this.trace(e);else{var n=Error(e);throw n.hash=t,n}},`parseError`),parse:t.r(function(e){var n=this,r=[0],i=[],a=[null],o=[],s=this.table,c=``,l=0,u=0,d=0,f=2,p=1,m=o.slice.call(arguments,1),h=Object.create(this.lexer),g={yy:{}};for(var _ in this.yy)Object.prototype.hasOwnProperty.call(this.yy,_)&&(g.yy[_]=this.yy[_]);h.setInput(e,g.yy),g.yy.lexer=h,g.yy.parser=this,h.yylloc===void 0&&(h.yylloc={});var v=h.yylloc;o.push(v);var y=h.options&&h.options.ranges;typeof g.yy.parseError==`function`?this.parseError=g.yy.parseError:this.parseError=Object.getPrototypeOf(this).parseError;function b(e){r.length-=2*e,a.length-=e,o.length-=e}t.r(b,`popStack`);function x(){var e=i.pop()||h.lex()||p;return typeof e!=`number`&&(e instanceof Array&&(i=e,e=i.pop()),e=n.symbols_[e]||e),e}t.r(x,`lex`);for(var S,C,w,T,E,D={},O,k,A,j;;){if(w=r[r.length-1],this.defaultActions[w]?T=this.defaultActions[w]:(S==null&&(S=x()),T=s[w]&&s[w][S]),T===void 0||!T.length||!T[0]){var M=``;for(O in j=[],s[w])this.terminals_[O]&&O>f&&j.push(`'`+this.terminals_[O]+`'`);M=h.showPosition?`Parse error on line `+(l+1)+`:
`+h.showPosition()+`
Expecting `+j.join(`, `)+`, got '`+(this.terminals_[S]||S)+`'`:`Parse error on line `+(l+1)+`: Unexpected `+(S==p?`end of input`:`'`+(this.terminals_[S]||S)+`'`),this.parseError(M,{text:h.match,token:this.terminals_[S]||S,line:h.yylineno,loc:v,expected:j})}if(T[0]instanceof Array&&T.length>1)throw Error(`Parse Error: multiple actions possible at state: `+w+`, token: `+S);switch(T[0]){case 1:r.push(S),a.push(h.yytext),o.push(h.yylloc),r.push(T[1]),S=null,C?(S=C,C=null):(u=h.yyleng,c=h.yytext,l=h.yylineno,v=h.yylloc,d>0&&d--);break;case 2:if(k=this.productions_[T[1]][1],D.$=a[a.length-k],D._$={first_line:o[o.length-(k||1)].first_line,last_line:o[o.length-1].last_line,first_column:o[o.length-(k||1)].first_column,last_column:o[o.length-1].last_column},y&&(D._$.range=[o[o.length-(k||1)].range[0],o[o.length-1].range[1]]),E=this.performAction.apply(D,[c,u,l,g.yy,T[1],a,o].concat(m)),E!==void 0)return E;k&&(r=r.slice(0,-1*k*2),a=a.slice(0,-1*k),o=o.slice(0,-1*k)),r.push(this.productions_[T[1]][0]),a.push(D.$),o.push(D._$),A=s[r[r.length-2]][r[r.length-1]],r.push(A);break;case 3:return!0}}return!0},`parse`)};D.lexer=(function(){return{EOF:1,parseError:t.r(function(e,t){if(this.yy.parser)this.yy.parser.parseError(e,t);else throw Error(e)},`parseError`),setInput:t.r(function(e,t){return this.yy=t||this.yy||{},this._input=e,this._more=this._backtrack=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match=``,this.conditionStack=[`INITIAL`],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges&&(this.yylloc.range=[0,0]),this.offset=0,this},`setInput`),input:t.r(function(){var e=this._input[0];return this.yytext+=e,this.yyleng++,this.offset++,this.match+=e,this.matched+=e,e.match(/(?:\r\n?|\n).*/g)?(this.yylineno++,this.yylloc.last_line++):this.yylloc.last_column++,this.options.ranges&&this.yylloc.range[1]++,this._input=this._input.slice(1),e},`input`),unput:t.r(function(e){var t=e.length,n=e.split(/(?:\r\n?|\n)/g);this._input=e+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-t),this.offset-=t;var r=this.match.split(/(?:\r\n?|\n)/g);this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),n.length-1&&(this.yylineno-=n.length-1);var i=this.yylloc.range;return this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:n?(n.length===r.length?this.yylloc.first_column:0)+r[r.length-n.length].length-n[0].length:this.yylloc.first_column-t},this.options.ranges&&(this.yylloc.range=[i[0],i[0]+this.yyleng-t]),this.yyleng=this.yytext.length,this},`unput`),more:t.r(function(){return this._more=!0,this},`more`),reject:t.r(function(){if(this.options.backtrack_lexer)this._backtrack=!0;else return this.parseError(`Lexical error on line `+(this.yylineno+1)+`. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).
`+this.showPosition(),{text:``,token:null,line:this.yylineno});return this},`reject`),less:t.r(function(e){this.unput(this.match.slice(e))},`less`),pastInput:t.r(function(){var e=this.matched.substr(0,this.matched.length-this.match.length);return(e.length>20?`...`:``)+e.substr(-20).replace(/\n/g,``)},`pastInput`),upcomingInput:t.r(function(){var e=this.match;return e.length<20&&(e+=this._input.substr(0,20-e.length)),(e.substr(0,20)+(e.length>20?`...`:``)).replace(/\n/g,``)},`upcomingInput`),showPosition:t.r(function(){var e=this.pastInput(),t=Array(e.length+1).join(`-`);return e+this.upcomingInput()+`
`+t+`^`},`showPosition`),test_match:t.r(function(e,t){var n,r,i;if(this.options.backtrack_lexer&&(i={yylineno:this.yylineno,yylloc:{first_line:this.yylloc.first_line,last_line:this.last_line,first_column:this.yylloc.first_column,last_column:this.yylloc.last_column},yytext:this.yytext,match:this.match,matches:this.matches,matched:this.matched,yyleng:this.yyleng,offset:this.offset,_more:this._more,_input:this._input,yy:this.yy,conditionStack:this.conditionStack.slice(0),done:this.done},this.options.ranges&&(i.yylloc.range=this.yylloc.range.slice(0))),r=e[0].match(/(?:\r\n?|\n).*/g),r&&(this.yylineno+=r.length),this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:r?r[r.length-1].length-r[r.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+e[0].length},this.yytext+=e[0],this.match+=e[0],this.matches=e,this.yyleng=this.yytext.length,this.options.ranges&&(this.yylloc.range=[this.offset,this.offset+=this.yyleng]),this._more=!1,this._backtrack=!1,this._input=this._input.slice(e[0].length),this.matched+=e[0],n=this.performAction.call(this,this.yy,this,t,this.conditionStack[this.conditionStack.length-1]),this.done&&this._input&&(this.done=!1),n)return n;if(this._backtrack){for(var a in i)this[a]=i[a];return!1}return!1},`test_match`),next:t.r(function(){if(this.done)return this.EOF;this._input||(this.done=!0);var e,t,n,r;this._more||(this.yytext=``,this.match=``);for(var i=this._currentRules(),a=0;a<i.length;a++)if(n=this._input.match(this.rules[i[a]]),n&&(!t||n[0].length>t[0].length)){if(t=n,r=a,this.options.backtrack_lexer){if(e=this.test_match(n,i[a]),e!==!1)return e;if(this._backtrack){t=!1;continue}else return!1}else if(!this.options.flex)break}return t?(e=this.test_match(t,i[r]),e===!1?!1:e):this._input===``?this.EOF:this.parseError(`Lexical error on line `+(this.yylineno+1)+`. Unrecognized text.
`+this.showPosition(),{text:``,token:null,line:this.yylineno})},`next`),lex:t.r(function(){return this.next()||this.lex()},`lex`),begin:t.r(function(e){this.conditionStack.push(e)},`begin`),popState:t.r(function(){return this.conditionStack.length-1>0?this.conditionStack.pop():this.conditionStack[0]},`popState`),_currentRules:t.r(function(){return this.conditionStack.length&&this.conditionStack[this.conditionStack.length-1]?this.conditions[this.conditionStack[this.conditionStack.length-1]].rules:this.conditions.INITIAL.rules},`_currentRules`),topState:t.r(function(e){return e=this.conditionStack.length-1-Math.abs(e||0),e>=0?this.conditionStack[e]:`INITIAL`},`topState`),pushState:t.r(function(e){this.begin(e)},`pushState`),stateStackSize:t.r(function(){return this.conditionStack.length},`stateStackSize`),options:{"case-insensitive":!0},performAction:t.r(function(e,t,n,r){switch(n){case 0:return this.begin(`open_directive`),`open_directive`;case 1:return this.begin(`acc_title`),31;case 2:return this.popState(),`acc_title_value`;case 3:return this.begin(`acc_descr`),33;case 4:return this.popState(),`acc_descr_value`;case 5:this.begin(`acc_descr_multiline`);break;case 6:this.popState();break;case 7:return`acc_descr_multiline_value`;case 8:break;case 9:break;case 10:break;case 11:return 10;case 12:break;case 13:break;case 14:this.begin(`href`);break;case 15:this.popState();break;case 16:return 43;case 17:this.begin(`callbackname`);break;case 18:this.popState();break;case 19:this.popState(),this.begin(`callbackargs`);break;case 20:return 41;case 21:this.popState();break;case 22:return 42;case 23:this.begin(`click`);break;case 24:this.popState();break;case 25:return 40;case 26:return 4;case 27:return 22;case 28:return 23;case 29:return 24;case 30:return 25;case 31:return 26;case 32:return 28;case 33:return 27;case 34:return 29;case 35:return 12;case 36:return 13;case 37:return 14;case 38:return 15;case 39:return 16;case 40:return 17;case 41:return 18;case 42:return 20;case 43:return 21;case 44:return`date`;case 45:return 30;case 46:return`accDescription`;case 47:return 36;case 48:return 38;case 49:return 39;case 50:return`:`;case 51:return 6;case 52:return`INVALID`}},`anonymous`),rules:[/^(?:%%\{)/i,/^(?:accTitle\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*\{\s*)/i,/^(?:[\}])/i,/^(?:[^\}]*)/i,/^(?:%%(?!\{)*[^\n]*)/i,/^(?:[^\}]%%*[^\n]*)/i,/^(?:%%*[^\n]*[\n]*)/i,/^(?:[\n]+)/i,/^(?:\s+)/i,/^(?:%[^\n]*)/i,/^(?:href[\s]+["])/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:call[\s]+)/i,/^(?:\([\s]*\))/i,/^(?:\()/i,/^(?:[^(]*)/i,/^(?:\))/i,/^(?:[^)]*)/i,/^(?:click[\s]+)/i,/^(?:[\s\n])/i,/^(?:[^\s\n]*)/i,/^(?:gantt\b)/i,/^(?:dateFormat\s[^#\n;]+)/i,/^(?:inclusiveEndDates\b)/i,/^(?:topAxis\b)/i,/^(?:axisFormat\s[^#\n;]+)/i,/^(?:tickInterval\s[^#\n;]+)/i,/^(?:includes\s[^#\n;]+)/i,/^(?:excludes\s[^#\n;]+)/i,/^(?:todayMarker\s[^\n;]+)/i,/^(?:weekday\s+monday\b)/i,/^(?:weekday\s+tuesday\b)/i,/^(?:weekday\s+wednesday\b)/i,/^(?:weekday\s+thursday\b)/i,/^(?:weekday\s+friday\b)/i,/^(?:weekday\s+saturday\b)/i,/^(?:weekday\s+sunday\b)/i,/^(?:weekend\s+friday\b)/i,/^(?:weekend\s+saturday\b)/i,/^(?:\d\d\d\d-\d\d-\d\d\b)/i,/^(?:title\s[^\n]+)/i,/^(?:accDescription\s[^#\n;]+)/i,/^(?:section\s[^\n]+)/i,/^(?:[^:\n]+)/i,/^(?::[^#\n;]+)/i,/^(?::)/i,/^(?:$)/i,/^(?:.)/i],conditions:{acc_descr_multiline:{rules:[6,7],inclusive:!1},acc_descr:{rules:[4],inclusive:!1},acc_title:{rules:[2],inclusive:!1},callbackargs:{rules:[21,22],inclusive:!1},callbackname:{rules:[18,19,20],inclusive:!1},href:{rules:[15,16],inclusive:!1},click:{rules:[24,25],inclusive:!1},INITIAL:{rules:[0,1,3,5,8,9,10,11,12,13,14,17,23,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52],inclusive:!0}}}})();function O(){this.yy={}}return t.r(O,`Parser`),O.prototype=D,D.Parser=O,new O})();M.parser=M;var N=M;D.default.extend(O.default),D.default.extend(k.default),D.default.extend(A.default);var P={friday:5,saturday:6},F=``,ee=``,te=void 0,I=``,L=[],R=[],ne=new Map,z=[],B=[],V=``,re=``,ie=[`active`,`done`,`crit`,`milestone`,`vert`],ae=[],H=``,U=!1,oe=!1,W=`sunday`,G=`saturday`,K=0,se=t.r(function(){z=[],B=[],V=``,ae=[],J=0,Ve=void 0,X=void 0,Z=[],F=``,ee=``,re=``,te=void 0,I=``,L=[],R=[],U=!1,oe=!1,K=0,ne=new Map,H=``,n.a(),W=`sunday`,G=`saturday`},`clear`),ce=t.r(function(e){H=e},`setDiagramId`),le=t.r(function(e){ee=e},`setAxisFormat`),ue=t.r(function(){return ee},`getAxisFormat`),de=t.r(function(e){te=e},`setTickInterval`),fe=t.r(function(){return te},`getTickInterval`),pe=t.r(function(e){I=e},`setTodayMarker`),me=t.r(function(){return I},`getTodayMarker`),he=t.r(function(e){F=e},`setDateFormat`),ge=t.r(function(){U=!0},`enableInclusiveEndDates`),_e=t.r(function(){return U},`endDatesAreInclusive`),ve=t.r(function(){oe=!0},`enableTopAxis`),ye=t.r(function(){return oe},`topAxisEnabled`),be=t.r(function(e){re=e},`setDisplayMode`),xe=t.r(function(){return re},`getDisplayMode`),Se=t.r(function(){return F},`getDateFormat`),Ce=t.r(function(e){L=e.toLowerCase().split(/[\s,]+/)},`setIncludes`),we=t.r(function(){return L},`getIncludes`),Te=t.r(function(e){R=e.toLowerCase().split(/[\s,]+/)},`setExcludes`),Ee=t.r(function(){return R},`getExcludes`),De=t.r(function(){return ne},`getLinks`),Oe=t.r(function(e){V=e,z.push(e)},`addSection`),ke=t.r(function(){return z},`getSections`),Ae=t.r(function(){let e=Ge(),t=0;for(;!e&&t<10;)e=Ge(),t++;return B=Z,B},`getTasks`),je=t.r(function(e,t,n,r){let i=e.format(t.trim()),a=e.format(`YYYY-MM-DD`);return r.includes(i)||r.includes(a)?!1:n.includes(`weekends`)&&(e.isoWeekday()===P[G]||e.isoWeekday()===P[G]+1)||n.includes(e.format(`dddd`).toLowerCase())?!0:n.includes(i)||n.includes(a)},`isInvalidDate`),Me=t.r(function(e){W=e},`setWeekday`),Ne=t.r(function(){return W},`getWeekday`),Pe=t.r(function(e){G=e},`setWeekend`),Fe=t.r(function(e,t,n,r){if(!n.length||e.manualEndTime)return;let i;i=e.startTime instanceof Date?(0,D.default)(e.startTime):(0,D.default)(e.startTime,t,!0),i=i.add(1,`d`);let a;a=e.endTime instanceof Date?(0,D.default)(e.endTime):(0,D.default)(e.endTime,t,!0);let[o,s]=Ie(i,a,t,n,r);e.endTime=o.toDate(),e.renderEndTime=s},`checkTaskDates`),Ie=t.r(function(e,t,n,r,i){let a=!1,o=null,s=t.add(1e4,`d`);for(;e<=t;){if(a||(o=t.toDate()),a=je(e,n,r,i),a&&(t=t.add(1,`d`),t>s))throw Error("Failed to find a valid date that was not excluded by `excludes` after 10,000 iterations.");e=e.add(1,`d`)}return[t,o]},`fixTaskDates`),q=t.r(function(e,n,r){if(r=r.trim(),t.r(e=>{let t=e.trim();return t===`x`||t===`X`},`isTimestampFormat`)(n)&&/^\d+$/.test(r))return new Date(Number(r));let i=/^after\s+(?<ids>[\d\w- ]+)/.exec(r);if(i!==null){let e=null;for(let t of i.groups.ids.split(` `)){let n=Q(t);n!==void 0&&(!e||n.endTime>e.endTime)&&(e=n)}if(e)return e.endTime;let t=new Date;return t.setHours(0,0,0,0),t}let a=(0,D.default)(r,n.trim(),!0);if(a.isValid())return a.toDate();{t.i.debug(`Invalid date:`+r),t.i.debug(`With date format:`+n.trim());let e=new Date(r);if(e===void 0||isNaN(e.getTime())||e.getFullYear()<-1e4||e.getFullYear()>1e4)throw Error(`Invalid date:`+r);return e}},`getStartDate`),Le=t.r(function(e){let t=/^(\d+(?:\.\d+)?)([Mdhmswy]|ms)$/.exec(e.trim());return t===null?[NaN,`ms`]:[Number.parseFloat(t[1]),t[2]]},`parseDuration`),Re=t.r(function(e,t,n,r=!1){n=n.trim();let i=/^until\s+(?<ids>[\d\w- ]+)/.exec(n);if(i!==null){let e=null;for(let t of i.groups.ids.split(` `)){let n=Q(t);n!==void 0&&(!e||n.startTime<e.startTime)&&(e=n)}if(e)return e.startTime;let t=new Date;return t.setHours(0,0,0,0),t}let a=(0,D.default)(n,t.trim(),!0);if(a.isValid())return r&&(a=a.add(1,`d`)),a.toDate();let o=(0,D.default)(e),[s,c]=Le(n);if(!Number.isNaN(s)){let e=o.add(s,c);e.isValid()&&(o=e)}return o.toDate()},`getEndDate`),J=0,Y=t.r(function(e){return e===void 0?(J+=1,`task`+J):e},`parseId`),ze=t.r(function(e,t){let n;n=t.substr(0,1)===`:`?t.substr(1,t.length):t;let r=n.split(`,`),i={};Ze(r,i,ie);for(let e=0;e<r.length;e++)r[e]=r[e].trim();let a=``;switch(r.length){case 1:i.id=Y(),i.startTime=e.endTime,a=r[0];break;case 2:i.id=Y(),i.startTime=q(void 0,F,r[0]),a=r[1];break;case 3:i.id=Y(r[0]),i.startTime=q(void 0,F,r[1]),a=r[2];break;default:}return a&&(i.endTime=Re(i.startTime,F,a,U),i.manualEndTime=(0,D.default)(a,`YYYY-MM-DD`,!0).isValid(),Fe(i,F,R,L)),i},`compileData`),Be=t.r(function(e,t){let n;n=t.substr(0,1)===`:`?t.substr(1,t.length):t;let r=n.split(`,`),i={};Ze(r,i,ie);for(let e=0;e<r.length;e++)r[e]=r[e].trim();switch(r.length){case 1:i.id=Y(),i.startTime={type:`prevTaskEnd`,id:e},i.endTime={data:r[0]};break;case 2:i.id=Y(),i.startTime={type:`getStartDate`,startData:r[0]},i.endTime={data:r[1]};break;case 3:i.id=Y(r[0]),i.startTime={type:`getStartDate`,startData:r[1]},i.endTime={data:r[2]};break;default:}return i},`parseData`),Ve,X,Z=[],He={},Ue=t.r(function(e,t){let n={section:V,type:V,processed:!1,manualEndTime:!1,renderEndTime:null,raw:{data:t},task:e,classes:[]},r=Be(X,t);n.raw.startTime=r.startTime,n.raw.endTime=r.endTime,n.id=r.id,n.prevTaskId=X,n.active=r.active,n.done=r.done,n.crit=r.crit,n.milestone=r.milestone,n.vert=r.vert,n.order=K,K++;let i=Z.push(n);X=n.id,He[n.id]=i-1},`addTask`),Q=t.r(function(e){let t=He[e];return Z[t]},`findTaskById`),We=t.r(function(e,t){let n={section:V,type:V,description:e,task:e,classes:[]},r=ze(Ve,t);n.startTime=r.startTime,n.endTime=r.endTime,n.id=r.id,n.active=r.active,n.done=r.done,n.crit=r.crit,n.milestone=r.milestone,n.vert=r.vert,Ve=n,B.push(n)},`addTaskOrg`),Ge=t.r(function(){let e=t.r(function(e){let t=Z[e],n=``;switch(Z[e].raw.startTime.type){case`prevTaskEnd`:t.startTime=Q(t.prevTaskId).endTime;break;case`getStartDate`:n=q(void 0,F,Z[e].raw.startTime.startData),n&&(Z[e].startTime=n);break}return Z[e].startTime&&(Z[e].endTime=Re(Z[e].startTime,F,Z[e].raw.endTime.data,U),Z[e].endTime&&(Z[e].processed=!0,Z[e].manualEndTime=(0,D.default)(Z[e].raw.endTime.data,`YYYY-MM-DD`,!0).isValid(),Fe(Z[e],F,R,L))),Z[e].processed},`compileTask`),n=!0;for(let[t,r]of Z.entries())e(t),n=n&&r.processed;return n},`compileTasks`),Ke=t.r(function(e,t){let r=t;n.x().securityLevel!==`loose`&&(r=(0,E.sanitizeUrl)(t)),e.split(`,`).forEach(function(e){Q(e)!==void 0&&(Ye(e,()=>{window.open(r,`_self`)}),ne.set(e,r))}),qe(e,`clickable`)},`setLink`),qe=t.r(function(e,t){e.split(`,`).forEach(function(e){let n=Q(e);n!==void 0&&n.classes.push(t)})},`setClass`),Je=t.r(function(e,t,r){if(n.x().securityLevel!==`loose`||t===void 0)return;let i=[];if(typeof r==`string`){i=r.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);for(let e=0;e<i.length;e++){let t=i[e].trim();t.startsWith(`"`)&&t.endsWith(`"`)&&(t=t.substr(1,t.length-2)),i[e]=t}}i.length===0&&i.push(e),Q(e)!==void 0&&Ye(e,()=>{o.g.runFunc(t,...i)})},`setClickFun`),Ye=t.r(function(e,t){ae.push(function(){let n=H?`${H}-${e}`:e,r=document.querySelector(`[id="${n}"]`);r!==null&&r.addEventListener(`click`,function(){t()})},function(){let n=H?`${H}-${e}`:e,r=document.querySelector(`[id="${n}-text"]`);r!==null&&r.addEventListener(`click`,function(){t()})})},`pushFun`),Xe={getConfig:t.r(()=>n.x().gantt,`getConfig`),clear:se,setDateFormat:he,getDateFormat:Se,enableInclusiveEndDates:ge,endDatesAreInclusive:_e,enableTopAxis:ve,topAxisEnabled:ye,setAxisFormat:le,getAxisFormat:ue,setTickInterval:de,getTickInterval:fe,setTodayMarker:pe,getTodayMarker:me,setAccTitle:n.U,getAccTitle:n.y,setDiagramTitle:n.K,getDiagramTitle:n.w,setDiagramId:ce,setDisplayMode:be,getDisplayMode:xe,setAccDescription:n.H,getAccDescription:n.v,addSection:Oe,getSections:ke,getTasks:Ae,addTask:Ue,findTaskById:Q,addTaskOrg:We,setIncludes:Ce,getIncludes:we,setExcludes:Te,getExcludes:Ee,setClickEvent:t.r(function(e,t,n){e.split(`,`).forEach(function(e){Je(e,t,n)}),qe(e,`clickable`)},`setClickEvent`),setLink:Ke,getLinks:De,bindFunctions:t.r(function(e){ae.forEach(function(t){t(e)})},`bindFunctions`),parseDuration:Le,isInvalidDate:je,setWeekday:Me,getWeekday:Ne,setWeekend:Pe};function Ze(e,t,n){let r=!0;for(;r;)r=!1,n.forEach(function(n){let i=`^\\s*`+n+`\\s*$`,a=new RegExp(i);e[0].match(a)&&(t[n]=!0,e.shift(1),r=!0)})}t.r(Ze,`getTaskTags`),D.default.extend(j.default);var Qe=t.r(function(){t.i.debug(`Something is calling, setConf, remove the call`)},`setConf`),$e={monday:i.h,tuesday:i.y,wednesday:i.b,thursday:i.v,friday:i.m,saturday:i.g,sunday:i._},et=t.r((e,t)=>{let n=[...e].map(()=>-1/0),r=[...e].sort((e,t)=>e.startTime-t.startTime||e.order-t.order),i=0;for(let e of r)for(let r=0;r<n.length;r++)if(e.startTime>=n[r]){n[r]=e.endTime,e.order=r+t,r>i&&(i=r);break}return i},`getMaxIntersections`),$,tt=1e4,nt={parser:N,db:Xe,renderer:{setConf:Qe,draw:t.r(function(e,o,s,c){let l=n.x().gantt;c.db.setDiagramId(o);let u=n.x().securityLevel,d;u===`sandbox`&&(d=t.t(`#i`+o));let f=u===`sandbox`?t.t(d.nodes()[0].contentDocument.body):t.t(`body`),p=u===`sandbox`?d.nodes()[0].contentDocument:document,m=p.getElementById(o);$=m.parentElement.offsetWidth,$===void 0&&($=1200),l.useWidth!==void 0&&($=l.useWidth);let h=c.db.getTasks(),g=[];for(let e of h)g.push(e.type);g=M(g);let _={},v=2*l.topPadding;if(c.db.getDisplayMode()===`compact`||l.displayMode===`compact`){let e={};for(let t of h)e[t.section]===void 0?e[t.section]=[t]:e[t.section].push(t);let t=0;for(let n of Object.keys(e)){let r=et(e[n],t)+1;t+=r,v+=r*(l.barHeight+l.barGap),_[n]=r}}else{v+=h.length*(l.barHeight+l.barGap);for(let e of g)_[e]=h.filter(t=>t.type===e).length}m.setAttribute(`viewBox`,`0 0 `+$+` `+v);let y=f.select(`[id="${o}"]`),S=i.n().domain([i.j(h,function(e){return e.startTime}),i.M(h,function(e){return e.endTime})]).rangeRound([0,$-l.leftPadding-l.rightPadding]);function C(e,t){let n=e.startTime,r=t.startTime,i=0;return n>r?i=1:n<r&&(i=-1),i}t.r(C,`taskCompare`),h.sort(C),w(h,$,v),n.c(y,v,$,l.useMaxWidth),y.append(`text`).text(c.db.getDiagramTitle()).attr(`x`,$/2).attr(`y`,l.titleTopMargin).attr(`class`,`titleText`);function w(e,t,n){let i=l.barHeight,o=i+l.barGap,s=l.topPadding,u=l.leftPadding,d=r.t().domain([0,g.length]).range([`#00B9FA`,`#F95002`]).interpolate(a.W);E(o,s,u,t,n,e,c.db.getExcludes(),c.db.getIncludes()),k(u,s,t,n),T(e,o,s,u,i,d,t,n),A(o,s,u,i,d),j(u,s,t,n)}t.r(w,`makeGantt`);function T(e,r,i,a,s,u,d){e.sort((e,t)=>e.vert===t.vert?0:e.vert?1:-1);let f=[...new Set(e.map(e=>e.order))].map(t=>e.find(e=>e.order===t));y.append(`g`).selectAll(`rect`).data(f).enter().append(`rect`).attr(`x`,0).attr(`y`,function(e,t){return t=e.order,t*r+i-2}).attr(`width`,function(){return d-l.rightPadding/2}).attr(`height`,r).attr(`class`,function(e){for(let[t,n]of g.entries())if(e.type===n)return`section section`+t%l.numberSectionStyles;return`section section0`}).enter();let p=y.append(`g`).selectAll(`rect`).data(e).enter(),m=c.db.getLinks();if(p.append(`rect`).attr(`id`,function(e){return o+`-`+e.id}).attr(`rx`,3).attr(`ry`,3).attr(`x`,function(e){return e.milestone?S(e.startTime)+a+.5*(S(e.endTime)-S(e.startTime))-.5*s:S(e.startTime)+a}).attr(`y`,function(e,t){return t=e.order,e.vert?l.gridLineStartPadding:t*r+i}).attr(`width`,function(e){return e.milestone?s:e.vert?.08*s:S(e.renderEndTime||e.endTime)-S(e.startTime)}).attr(`height`,function(e){return e.vert?h.length*(l.barHeight+l.barGap)+l.barHeight*2:s}).attr(`transform-origin`,function(e,t){return t=e.order,(S(e.startTime)+a+.5*(S(e.endTime)-S(e.startTime))).toString()+`px `+(t*r+i+.5*s).toString()+`px`}).attr(`class`,function(e){let t=``;e.classes.length>0&&(t=e.classes.join(` `));let n=0;for(let[t,r]of g.entries())e.type===r&&(n=t%l.numberSectionStyles);let r=``;return e.active?e.crit?r+=` activeCrit`:r=` active`:e.done?r=e.crit?` doneCrit`:` done`:e.crit&&(r+=` crit`),r.length===0&&(r=` task`),e.milestone&&(r=` milestone `+r),e.vert&&(r=` vert `+r),r+=n,r+=` `+t,`task`+r}),p.append(`text`).attr(`id`,function(e){return o+`-`+e.id+`-text`}).text(function(e){return e.task}).attr(`font-size`,l.fontSize).attr(`x`,function(e){let t=S(e.startTime),n=S(e.renderEndTime||e.endTime);if(e.milestone&&(t+=.5*(S(e.endTime)-S(e.startTime))-.5*s,n=t+s),e.vert)return S(e.startTime)+a;let r=this.getBBox().width;return r>n-t?n+r+1.5*l.leftPadding>d?t+a-5:n+a+5:(n-t)/2+t+a}).attr(`y`,function(e,t){return e.vert?l.gridLineStartPadding+h.length*(l.barHeight+l.barGap)+60:(t=e.order,t*r+l.barHeight/2+(l.fontSize/2-2)+i)}).attr(`text-height`,s).attr(`class`,function(e){let t=S(e.startTime),n=S(e.endTime);e.milestone&&(n=t+s);let r=this.getBBox().width,i=``;e.classes.length>0&&(i=e.classes.join(` `));let a=0;for(let[t,n]of g.entries())e.type===n&&(a=t%l.numberSectionStyles);let o=``;return e.active&&(o=e.crit?`activeCritText`+a:`activeText`+a),e.done?o=e.crit?o+` doneCritText`+a:o+` doneText`+a:e.crit&&(o=o+` critText`+a),e.milestone&&(o+=` milestoneText`),e.vert&&(o+=` vertText`),r>n-t?n+r+1.5*l.leftPadding>d?i+` taskTextOutsideLeft taskTextOutside`+a+` `+o:i+` taskTextOutsideRight taskTextOutside`+a+` `+o+` width-`+r:i+` taskText taskText`+a+` `+o+` width-`+r}),n.x().securityLevel===`sandbox`){let e;e=t.t(`#i`+o);let n=e.nodes()[0].contentDocument;p.filter(function(e){return m.has(e.id)}).each(function(e){var t=n.querySelector(`#`+CSS.escape(o+`-`+e.id)),r=n.querySelector(`#`+CSS.escape(o+`-`+e.id+`-text`));let i=t.parentNode;var a=n.createElement(`a`);a.setAttribute(`xlink:href`,m.get(e.id)),a.setAttribute(`target`,`_top`),i.appendChild(a),a.appendChild(t),a.appendChild(r)})}}t.r(T,`drawRects`);function E(e,n,r,i,a,s,u,d){if(u.length===0&&d.length===0)return;let f,p;for(let{startTime:e,endTime:t}of s)(f===void 0||e<f)&&(f=e),(p===void 0||t>p)&&(p=t);if(!f||!p)return;if((0,D.default)(p).diff((0,D.default)(f),`year`)>5){t.i.warn(`The difference between the min and max time is more than 5 years. This will cause performance issues. Skipping drawing exclude days.`);return}let m=c.db.getDateFormat(),h=[],g=null,_=(0,D.default)(f);for(;_.valueOf()<=p;)c.db.isInvalidDate(_,m,u,d)?g?g.end=_:g={start:_,end:_}:g&&(h.push(g),g=null),_=_.add(1,`d`);y.append(`g`).selectAll(`rect`).data(h).enter().append(`rect`).attr(`id`,e=>o+`-exclude-`+e.start.format(`YYYY-MM-DD`)).attr(`x`,e=>S(e.start.startOf(`day`))+r).attr(`y`,l.gridLineStartPadding).attr(`width`,e=>S(e.end.endOf(`day`))-S(e.start.startOf(`day`))).attr(`height`,a-n-l.gridLineStartPadding).attr(`transform-origin`,function(t,n){return(S(t.start)+r+.5*(S(t.end)-S(t.start))).toString()+`px `+(n*e+.5*a).toString()+`px`}).attr(`class`,`exclude-range`)}t.r(E,`drawExcludeDays`);function O(e,t,n,r){if(n<=0||e>t)return 1/0;let i=t-e,a=D.default.duration({[r==null?`day`:r]:n}).asMilliseconds();return a<=0?1/0:Math.ceil(i/a)}t.r(O,`getEstimatedTickCount`);function k(e,n,r,a){let o=c.db.getDateFormat(),s=c.db.getAxisFormat(),u;if(s)u=s;else if(o===`D`)u=`%d`;else{var d;u=(d=l.axisFormat)==null?`%Y-%m-%d`:d}let f=x(S).tickSize(-a+n+l.gridLineStartPadding).tickFormat(i.r(u)),p=/^([1-9]\d*)(millisecond|second|minute|hour|day|week|month)$/.exec(c.db.getTickInterval()||l.tickInterval);if(p!==null){let e=parseInt(p[1],10);if(isNaN(e)||e<=0)t.i.warn(`Invalid tick interval value: "${p[1]}". Skipping custom tick interval.`);else{let n=p[2],r=c.db.getWeekday()||l.weekday,a=S.domain(),o=a[0],s=a[1],u=O(o,s,e,n);if(u>tt)t.i.warn(`The tick interval "${e}${n}" would generate ${u} ticks, which exceeds the maximum allowed (${tt}). This may indicate an invalid date or time range. Skipping custom tick interval.`);else switch(n){case`millisecond`:f.ticks(i.k.every(e));break;case`second`:f.ticks(i.O.every(e));break;case`minute`:f.ticks(i.E.every(e));break;case`hour`:f.ticks(i.w.every(e));break;case`day`:f.ticks(i.S.every(e));break;case`week`:f.ticks($e[r].every(e));break;case`month`:f.ticks(i.f.every(e));break}}}if(y.append(`g`).attr(`class`,`grid`).attr(`transform`,`translate(`+e+`, `+(a-50)+`)`).call(f).selectAll(`text`).style(`text-anchor`,`middle`).attr(`fill`,`#000`).attr(`stroke`,`none`).attr(`font-size`,10).attr(`dy`,`1em`),c.db.topAxisEnabled()||l.topAxis){let r=b(S).tickSize(-a+n+l.gridLineStartPadding).tickFormat(i.r(u));if(p!==null){let e=parseInt(p[1],10);if(isNaN(e)||e<=0)t.i.warn(`Invalid tick interval value: "${p[1]}". Skipping custom tick interval.`);else{let t=p[2],n=c.db.getWeekday()||l.weekday,a=S.domain(),o=a[0],s=a[1];if(O(o,s,e,t)<=tt)switch(t){case`millisecond`:r.ticks(i.k.every(e));break;case`second`:r.ticks(i.O.every(e));break;case`minute`:r.ticks(i.E.every(e));break;case`hour`:r.ticks(i.w.every(e));break;case`day`:r.ticks(i.S.every(e));break;case`week`:r.ticks($e[n].every(e));break;case`month`:r.ticks(i.f.every(e));break}}}y.append(`g`).attr(`class`,`grid`).attr(`transform`,`translate(`+e+`, `+n+`)`).call(r).selectAll(`text`).style(`text-anchor`,`middle`).attr(`fill`,`#000`).attr(`stroke`,`none`).attr(`font-size`,10)}}t.r(k,`makeGrid`);function A(e,t){let r=0,i=Object.keys(_).map(e=>[e,_[e]]);y.append(`g`).selectAll(`text`).data(i).enter().append(function(e){let t=e[0].split(n.s.lineBreakRegex),r=-(t.length-1)/2,i=p.createElementNS(`http://www.w3.org/2000/svg`,`text`);i.setAttribute(`dy`,r+`em`);for(let[e,n]of t.entries()){let t=p.createElementNS(`http://www.w3.org/2000/svg`,`tspan`);t.setAttribute(`alignment-baseline`,`central`),t.setAttribute(`x`,`10`),e>0&&t.setAttribute(`dy`,`1em`),t.textContent=n,i.appendChild(t)}return i}).attr(`x`,10).attr(`y`,function(n,a){if(a>0)for(let o=0;o<a;o++)return r+=i[a-1][1],n[1]*e/2+r*e+t;else return n[1]*e/2+t}).attr(`font-size`,l.sectionFontSize).attr(`class`,function(e){for(let[t,n]of g.entries())if(e[0]===n)return`sectionTitle sectionTitle`+t%l.numberSectionStyles;return`sectionTitle`})}t.r(A,`vertLabels`);function j(e,t,n,r){let i=c.db.getTodayMarker();if(i===`off`)return;let a=y.append(`g`).attr(`class`,`today`),o=new Date,s=a.append(`line`);s.attr(`x1`,S(o)+e).attr(`x2`,S(o)+e).attr(`y1`,l.titleTopMargin).attr(`y2`,r-l.titleTopMargin).attr(`class`,`today`),i!==``&&s.attr(`style`,i.replace(/,/g,`;`))}t.r(j,`drawToday`);function M(e){let t={},n=[];for(let r=0,i=e.length;r<i;++r)Object.prototype.hasOwnProperty.call(t,e[r])||(t[e[r]]=!0,n.push(e[r]));return n}t.r(M,`checkUnique`)},`draw`)},styles:t.r(e=>`
  .mermaid-main-font {
        font-family: ${e.fontFamily};
  }

  .exclude-range {
    fill: ${e.excludeBkgColor};
  }

  .section {
    stroke: none;
    opacity: 0.2;
  }

  .section0 {
    fill: ${e.sectionBkgColor};
  }

  .section2 {
    fill: ${e.sectionBkgColor2};
  }

  .section1,
  .section3 {
    fill: ${e.altSectionBkgColor};
    opacity: 0.2;
  }

  .sectionTitle0 {
    fill: ${e.titleColor};
  }

  .sectionTitle1 {
    fill: ${e.titleColor};
  }

  .sectionTitle2 {
    fill: ${e.titleColor};
  }

  .sectionTitle3 {
    fill: ${e.titleColor};
  }

  .sectionTitle {
    text-anchor: start;
    font-family: ${e.fontFamily};
  }


  /* Grid and axis */

  .grid .tick {
    stroke: ${e.gridColor};
    opacity: 0.8;
    shape-rendering: crispEdges;
  }

  .grid .tick text {
    font-family: ${e.fontFamily};
    fill: ${e.textColor};
  }

  .grid path {
    stroke-width: 0;
  }


  /* Today line */

  .today {
    fill: none;
    stroke: ${e.todayLineColor};
    stroke-width: 2px;
  }


  /* Task styling */

  /* Default task */

  .task {
    stroke-width: 2;
  }

  .taskText {
    text-anchor: middle;
    font-family: ${e.fontFamily};
  }

  .taskTextOutsideRight {
    fill: ${e.taskTextDarkColor};
    text-anchor: start;
    font-family: ${e.fontFamily};
  }

  .taskTextOutsideLeft {
    fill: ${e.taskTextDarkColor};
    text-anchor: end;
  }


  /* Special case clickable */

  .task.clickable {
    cursor: pointer;
  }

  .taskText.clickable {
    cursor: pointer;
    fill: ${e.taskTextClickableColor} !important;
    font-weight: bold;
  }

  .taskTextOutsideLeft.clickable {
    cursor: pointer;
    fill: ${e.taskTextClickableColor} !important;
    font-weight: bold;
  }

  .taskTextOutsideRight.clickable {
    cursor: pointer;
    fill: ${e.taskTextClickableColor} !important;
    font-weight: bold;
  }


  /* Specific task settings for the sections*/

  .taskText0,
  .taskText1,
  .taskText2,
  .taskText3 {
    fill: ${e.taskTextColor};
  }

  .task0,
  .task1,
  .task2,
  .task3 {
    fill: ${e.taskBkgColor};
    stroke: ${e.taskBorderColor};
  }

  .taskTextOutside0,
  .taskTextOutside2
  {
    fill: ${e.taskTextOutsideColor};
  }

  .taskTextOutside1,
  .taskTextOutside3 {
    fill: ${e.taskTextOutsideColor};
  }


  /* Active task */

  .active0,
  .active1,
  .active2,
  .active3 {
    fill: ${e.activeTaskBkgColor};
    stroke: ${e.activeTaskBorderColor};
  }

  .activeText0,
  .activeText1,
  .activeText2,
  .activeText3 {
    fill: ${e.taskTextDarkColor} !important;
  }


  /* Completed task */

  .done0,
  .done1,
  .done2,
  .done3 {
    stroke: ${e.doneTaskBorderColor};
    fill: ${e.doneTaskBkgColor};
    stroke-width: 2;
  }

  .doneText0,
  .doneText1,
  .doneText2,
  .doneText3 {
    fill: ${e.taskTextDarkColor} !important;
  }

  /* Done task text displayed outside the bar sits against the diagram background,
     not against the done-task bar, so it must use the outside/contrast color. */
  .doneText0.taskTextOutsideLeft,
  .doneText0.taskTextOutsideRight,
  .doneText1.taskTextOutsideLeft,
  .doneText1.taskTextOutsideRight,
  .doneText2.taskTextOutsideLeft,
  .doneText2.taskTextOutsideRight,
  .doneText3.taskTextOutsideLeft,
  .doneText3.taskTextOutsideRight {
    fill: ${e.taskTextOutsideColor} !important;
  }


  /* Tasks on the critical line */

  .crit0,
  .crit1,
  .crit2,
  .crit3 {
    stroke: ${e.critBorderColor};
    fill: ${e.critBkgColor};
    stroke-width: 2;
  }

  .activeCrit0,
  .activeCrit1,
  .activeCrit2,
  .activeCrit3 {
    stroke: ${e.critBorderColor};
    fill: ${e.activeTaskBkgColor};
    stroke-width: 2;
  }

  .doneCrit0,
  .doneCrit1,
  .doneCrit2,
  .doneCrit3 {
    stroke: ${e.critBorderColor};
    fill: ${e.doneTaskBkgColor};
    stroke-width: 2;
    cursor: pointer;
    shape-rendering: crispEdges;
  }

  .milestone {
    transform: rotate(45deg) scale(0.8,0.8);
  }

  .milestoneText {
    font-style: italic;
  }
  .doneCritText0,
  .doneCritText1,
  .doneCritText2,
  .doneCritText3 {
    fill: ${e.taskTextDarkColor} !important;
  }

  /* Done-crit task text outside the bar \u2014 same reasoning as doneText above. */
  .doneCritText0.taskTextOutsideLeft,
  .doneCritText0.taskTextOutsideRight,
  .doneCritText1.taskTextOutsideLeft,
  .doneCritText1.taskTextOutsideRight,
  .doneCritText2.taskTextOutsideLeft,
  .doneCritText2.taskTextOutsideRight,
  .doneCritText3.taskTextOutsideLeft,
  .doneCritText3.taskTextOutsideRight {
    fill: ${e.taskTextOutsideColor} !important;
  }

  .vert {
    stroke: ${e.vertLineColor};
  }

  .vertText {
    font-size: 15px;
    text-anchor: middle;
    fill: ${e.vertLineColor} !important;
  }

  .activeCritText0,
  .activeCritText1,
  .activeCritText2,
  .activeCritText3 {
    fill: ${e.taskTextDarkColor} !important;
  }

  .titleText {
    text-anchor: middle;
    font-size: 18px;
    fill: ${e.titleColor||e.textColor};
    font-family: ${e.fontFamily};
  }
`,`getStyles`)};exports.diagram=nt;