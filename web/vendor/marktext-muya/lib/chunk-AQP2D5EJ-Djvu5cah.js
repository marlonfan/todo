const e=require(`./src-BrLQZsaB.js`),t=require(`./chunk-CSCIHK7Q-CBwzgd8G.js`),n=require(`./chunk-5ZQYHXKU-CaQ-1mD1.js`),r=require(`./chunk-55IACEB6-BMo1QSWR.js`),i=require(`./chunk-2J33WTMH-CMaWYJB1.js`),a=require(`./chunk-LZXEDZCA-BndFX9vt.js`);var o,s=(function(){var t=e.r(function(e,t,n,r){for(n=n||{},r=e.length;r--;n[e[r]]=t);return n},`o`),n=[1,2],r=[1,3],i=[1,4],a=[2,4],o=[1,9],s=[1,11],c=[1,16],l=[1,17],u=[1,18],d=[1,19],f=[1,33],p=[1,20],m=[1,21],h=[1,22],g=[1,23],_=[1,24],v=[1,26],y=[1,27],b=[1,28],x=[1,29],S=[1,30],C=[1,31],w=[1,32],T=[1,35],E=[1,36],D=[1,37],O=[1,38],k=[1,34],A=[1,4,5,16,17,19,21,22,24,25,26,27,28,29,33,35,37,38,41,45,48,51,52,53,54,57],j=[1,4,5,14,15,16,17,19,21,22,24,25,26,27,28,29,33,35,37,38,39,40,41,45,48,51,52,53,54,57],M=[4,5,16,17,19,21,22,24,25,26,27,28,29,33,35,37,38,41,45,48,51,52,53,54,57],N={trace:e.r(function(){},`trace`),yy:{},symbols_:{error:2,start:3,SPACE:4,NL:5,SD:6,document:7,line:8,statement:9,classDefStatement:10,styleStatement:11,cssClassStatement:12,idStatement:13,DESCR:14,"-->":15,HIDE_EMPTY:16,scale:17,WIDTH:18,COMPOSIT_STATE:19,STRUCT_START:20,STRUCT_STOP:21,STATE_DESCR:22,AS:23,ID:24,FORK:25,JOIN:26,CHOICE:27,CONCURRENT:28,note:29,notePosition:30,NOTE_TEXT:31,direction:32,acc_title:33,acc_title_value:34,acc_descr:35,acc_descr_value:36,acc_descr_multiline_value:37,CLICK:38,STRING:39,HREF:40,classDef:41,CLASSDEF_ID:42,CLASSDEF_STYLEOPTS:43,DEFAULT:44,style:45,STYLE_IDS:46,STYLEDEF_STYLEOPTS:47,class:48,CLASSENTITY_IDS:49,STYLECLASS:50,direction_tb:51,direction_bt:52,direction_rl:53,direction_lr:54,eol:55,";":56,EDGE_STATE:57,STYLE_SEPARATOR:58,left_of:59,right_of:60,$accept:0,$end:1},terminals_:{2:`error`,4:`SPACE`,5:`NL`,6:`SD`,14:`DESCR`,15:`-->`,16:`HIDE_EMPTY`,17:`scale`,18:`WIDTH`,19:`COMPOSIT_STATE`,20:`STRUCT_START`,21:`STRUCT_STOP`,22:`STATE_DESCR`,23:`AS`,24:`ID`,25:`FORK`,26:`JOIN`,27:`CHOICE`,28:`CONCURRENT`,29:`note`,31:`NOTE_TEXT`,33:`acc_title`,34:`acc_title_value`,35:`acc_descr`,36:`acc_descr_value`,37:`acc_descr_multiline_value`,38:`CLICK`,39:`STRING`,40:`HREF`,41:`classDef`,42:`CLASSDEF_ID`,43:`CLASSDEF_STYLEOPTS`,44:`DEFAULT`,45:`style`,46:`STYLE_IDS`,47:`STYLEDEF_STYLEOPTS`,48:`class`,49:`CLASSENTITY_IDS`,50:`STYLECLASS`,51:`direction_tb`,52:`direction_bt`,53:`direction_rl`,54:`direction_lr`,56:`;`,57:`EDGE_STATE`,58:`STYLE_SEPARATOR`,59:`left_of`,60:`right_of`},productions_:[0,[3,2],[3,2],[3,2],[7,0],[7,2],[8,2],[8,1],[8,1],[9,1],[9,1],[9,1],[9,1],[9,2],[9,3],[9,4],[9,1],[9,2],[9,1],[9,4],[9,3],[9,6],[9,1],[9,1],[9,1],[9,1],[9,4],[9,4],[9,1],[9,2],[9,2],[9,1],[9,5],[9,5],[10,3],[10,3],[11,3],[12,3],[32,1],[32,1],[32,1],[32,1],[55,1],[55,1],[13,1],[13,1],[13,3],[13,3],[30,1],[30,1]],performAction:e.r(function(e,t,n,r,i,a,o){var s=a.length-1;switch(i){case 3:return r.setRootDoc(a[s]),a[s];case 4:this.$=[];break;case 5:a[s]!=`nl`&&(a[s-1].push(a[s]),this.$=a[s-1]);break;case 6:case 7:this.$=a[s];break;case 8:this.$=`nl`;break;case 12:this.$=a[s];break;case 13:let e=a[s-1];e.description=r.trimColon(a[s]),this.$=e;break;case 14:this.$={stmt:`relation`,state1:a[s-2],state2:a[s]};break;case 15:let t=r.trimColon(a[s]);this.$={stmt:`relation`,state1:a[s-3],state2:a[s-1],description:t};break;case 19:this.$={stmt:`state`,id:a[s-3],type:`default`,description:``,doc:a[s-1]};break;case 20:var c=a[s],l=a[s-2].trim();if(a[s].match(`:`)){var u=a[s].split(`:`);c=u[0],l=[l,u[1]]}this.$={stmt:`state`,id:c,type:`default`,description:l};break;case 21:this.$={stmt:`state`,id:a[s-3],type:`default`,description:a[s-5],doc:a[s-1]};break;case 22:this.$={stmt:`state`,id:a[s],type:`fork`};break;case 23:this.$={stmt:`state`,id:a[s],type:`join`};break;case 24:this.$={stmt:`state`,id:a[s],type:`choice`};break;case 25:this.$={stmt:`state`,id:r.getDividerId(),type:`divider`};break;case 26:this.$={stmt:`state`,id:a[s-1].trim(),note:{position:a[s-2].trim(),text:a[s].trim()}};break;case 29:this.$=a[s].trim(),r.setAccTitle(this.$);break;case 30:case 31:this.$=a[s].trim(),r.setAccDescription(this.$);break;case 32:this.$={stmt:`click`,id:a[s-3],url:a[s-2],tooltip:a[s-1]};break;case 33:this.$={stmt:`click`,id:a[s-3],url:a[s-1],tooltip:``};break;case 34:case 35:this.$={stmt:`classDef`,id:a[s-1].trim(),classes:a[s].trim()};break;case 36:this.$={stmt:`style`,id:a[s-1].trim(),styleClass:a[s].trim()};break;case 37:this.$={stmt:`applyClass`,id:a[s-1].trim(),styleClass:a[s].trim()};break;case 38:r.setDirection(`TB`),this.$={stmt:`dir`,value:`TB`};break;case 39:r.setDirection(`BT`),this.$={stmt:`dir`,value:`BT`};break;case 40:r.setDirection(`RL`),this.$={stmt:`dir`,value:`RL`};break;case 41:r.setDirection(`LR`),this.$={stmt:`dir`,value:`LR`};break;case 44:case 45:this.$={stmt:`state`,id:a[s].trim(),type:`default`,description:``};break;case 46:this.$={stmt:`state`,id:a[s-2].trim(),classes:[a[s].trim()],type:`default`,description:``};break;case 47:this.$={stmt:`state`,id:a[s-2].trim(),classes:[a[s].trim()],type:`default`,description:``};break}},`anonymous`),table:[{3:1,4:n,5:r,6:i},{1:[3]},{3:5,4:n,5:r,6:i},{3:6,4:n,5:r,6:i},t([1,4,5,16,17,19,22,24,25,26,27,28,29,33,35,37,38,41,45,48,51,52,53,54,57],a,{7:7}),{1:[2,1]},{1:[2,2]},{1:[2,3],4:o,5:s,8:8,9:10,10:12,11:13,12:14,13:15,16:c,17:l,19:u,22:d,24:f,25:p,26:m,27:h,28:g,29:_,32:25,33:v,35:y,37:b,38:x,41:S,45:C,48:w,51:T,52:E,53:D,54:O,57:k},t(A,[2,5]),{9:39,10:12,11:13,12:14,13:15,16:c,17:l,19:u,22:d,24:f,25:p,26:m,27:h,28:g,29:_,32:25,33:v,35:y,37:b,38:x,41:S,45:C,48:w,51:T,52:E,53:D,54:O,57:k},t(A,[2,7]),t(A,[2,8]),t(A,[2,9]),t(A,[2,10]),t(A,[2,11]),t(A,[2,12],{14:[1,40],15:[1,41]}),t(A,[2,16]),{18:[1,42]},t(A,[2,18],{20:[1,43]}),{23:[1,44]},t(A,[2,22]),t(A,[2,23]),t(A,[2,24]),t(A,[2,25]),{30:45,31:[1,46],59:[1,47],60:[1,48]},t(A,[2,28]),{34:[1,49]},{36:[1,50]},t(A,[2,31]),{13:51,24:f,57:k},{42:[1,52],44:[1,53]},{46:[1,54]},{49:[1,55]},t(j,[2,44],{58:[1,56]}),t(j,[2,45],{58:[1,57]}),t(A,[2,38]),t(A,[2,39]),t(A,[2,40]),t(A,[2,41]),t(A,[2,6]),t(A,[2,13]),{13:58,24:f,57:k},t(A,[2,17]),t(M,a,{7:59}),{24:[1,60]},{24:[1,61]},{23:[1,62]},{24:[2,48]},{24:[2,49]},t(A,[2,29]),t(A,[2,30]),{39:[1,63],40:[1,64]},{43:[1,65]},{43:[1,66]},{47:[1,67]},{50:[1,68]},{24:[1,69]},{24:[1,70]},t(A,[2,14],{14:[1,71]}),{4:o,5:s,8:8,9:10,10:12,11:13,12:14,13:15,16:c,17:l,19:u,21:[1,72],22:d,24:f,25:p,26:m,27:h,28:g,29:_,32:25,33:v,35:y,37:b,38:x,41:S,45:C,48:w,51:T,52:E,53:D,54:O,57:k},t(A,[2,20],{20:[1,73]}),{31:[1,74]},{24:[1,75]},{39:[1,76]},{39:[1,77]},t(A,[2,34]),t(A,[2,35]),t(A,[2,36]),t(A,[2,37]),t(j,[2,46]),t(j,[2,47]),t(A,[2,15]),t(A,[2,19]),t(M,a,{7:78}),t(A,[2,26]),t(A,[2,27]),{5:[1,79]},{5:[1,80]},{4:o,5:s,8:8,9:10,10:12,11:13,12:14,13:15,16:c,17:l,19:u,21:[1,81],22:d,24:f,25:p,26:m,27:h,28:g,29:_,32:25,33:v,35:y,37:b,38:x,41:S,45:C,48:w,51:T,52:E,53:D,54:O,57:k},t(A,[2,32]),t(A,[2,33]),t(A,[2,21])],defaultActions:{5:[2,1],6:[2,2],47:[2,48],48:[2,49]},parseError:e.r(function(e,t){if(t.recoverable)this.trace(e);else{var n=Error(e);throw n.hash=t,n}},`parseError`),parse:e.r(function(t){var n=this,r=[0],i=[],a=[null],o=[],s=this.table,c=``,l=0,u=0,d=0,f=2,p=1,m=o.slice.call(arguments,1),h=Object.create(this.lexer),g={yy:{}};for(var _ in this.yy)Object.prototype.hasOwnProperty.call(this.yy,_)&&(g.yy[_]=this.yy[_]);h.setInput(t,g.yy),g.yy.lexer=h,g.yy.parser=this,h.yylloc===void 0&&(h.yylloc={});var v=h.yylloc;o.push(v);var y=h.options&&h.options.ranges;typeof g.yy.parseError==`function`?this.parseError=g.yy.parseError:this.parseError=Object.getPrototypeOf(this).parseError;function b(e){r.length-=2*e,a.length-=e,o.length-=e}e.r(b,`popStack`);function x(){var e=i.pop()||h.lex()||p;return typeof e!=`number`&&(e instanceof Array&&(i=e,e=i.pop()),e=n.symbols_[e]||e),e}e.r(x,`lex`);for(var S,C,w,T,E,D={},O,k,A,j;;){if(w=r[r.length-1],this.defaultActions[w]?T=this.defaultActions[w]:(S==null&&(S=x()),T=s[w]&&s[w][S]),T===void 0||!T.length||!T[0]){var M=``;for(O in j=[],s[w])this.terminals_[O]&&O>f&&j.push(`'`+this.terminals_[O]+`'`);M=h.showPosition?`Parse error on line `+(l+1)+`:
`+h.showPosition()+`
Expecting `+j.join(`, `)+`, got '`+(this.terminals_[S]||S)+`'`:`Parse error on line `+(l+1)+`: Unexpected `+(S==p?`end of input`:`'`+(this.terminals_[S]||S)+`'`),this.parseError(M,{text:h.match,token:this.terminals_[S]||S,line:h.yylineno,loc:v,expected:j})}if(T[0]instanceof Array&&T.length>1)throw Error(`Parse Error: multiple actions possible at state: `+w+`, token: `+S);switch(T[0]){case 1:r.push(S),a.push(h.yytext),o.push(h.yylloc),r.push(T[1]),S=null,C?(S=C,C=null):(u=h.yyleng,c=h.yytext,l=h.yylineno,v=h.yylloc,d>0&&d--);break;case 2:if(k=this.productions_[T[1]][1],D.$=a[a.length-k],D._$={first_line:o[o.length-(k||1)].first_line,last_line:o[o.length-1].last_line,first_column:o[o.length-(k||1)].first_column,last_column:o[o.length-1].last_column},y&&(D._$.range=[o[o.length-(k||1)].range[0],o[o.length-1].range[1]]),E=this.performAction.apply(D,[c,u,l,g.yy,T[1],a,o].concat(m)),E!==void 0)return E;k&&(r=r.slice(0,-1*k*2),a=a.slice(0,-1*k),o=o.slice(0,-1*k)),r.push(this.productions_[T[1]][0]),a.push(D.$),o.push(D._$),A=s[r[r.length-2]][r[r.length-1]],r.push(A);break;case 3:return!0}}return!0},`parse`)};N.lexer=(function(){return{EOF:1,parseError:e.r(function(e,t){if(this.yy.parser)this.yy.parser.parseError(e,t);else throw Error(e)},`parseError`),setInput:e.r(function(e,t){return this.yy=t||this.yy||{},this._input=e,this._more=this._backtrack=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match=``,this.conditionStack=[`INITIAL`],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges&&(this.yylloc.range=[0,0]),this.offset=0,this},`setInput`),input:e.r(function(){var e=this._input[0];return this.yytext+=e,this.yyleng++,this.offset++,this.match+=e,this.matched+=e,e.match(/(?:\r\n?|\n).*/g)?(this.yylineno++,this.yylloc.last_line++):this.yylloc.last_column++,this.options.ranges&&this.yylloc.range[1]++,this._input=this._input.slice(1),e},`input`),unput:e.r(function(e){var t=e.length,n=e.split(/(?:\r\n?|\n)/g);this._input=e+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-t),this.offset-=t;var r=this.match.split(/(?:\r\n?|\n)/g);this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),n.length-1&&(this.yylineno-=n.length-1);var i=this.yylloc.range;return this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:n?(n.length===r.length?this.yylloc.first_column:0)+r[r.length-n.length].length-n[0].length:this.yylloc.first_column-t},this.options.ranges&&(this.yylloc.range=[i[0],i[0]+this.yyleng-t]),this.yyleng=this.yytext.length,this},`unput`),more:e.r(function(){return this._more=!0,this},`more`),reject:e.r(function(){if(this.options.backtrack_lexer)this._backtrack=!0;else return this.parseError(`Lexical error on line `+(this.yylineno+1)+`. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).
`+this.showPosition(),{text:``,token:null,line:this.yylineno});return this},`reject`),less:e.r(function(e){this.unput(this.match.slice(e))},`less`),pastInput:e.r(function(){var e=this.matched.substr(0,this.matched.length-this.match.length);return(e.length>20?`...`:``)+e.substr(-20).replace(/\n/g,``)},`pastInput`),upcomingInput:e.r(function(){var e=this.match;return e.length<20&&(e+=this._input.substr(0,20-e.length)),(e.substr(0,20)+(e.length>20?`...`:``)).replace(/\n/g,``)},`upcomingInput`),showPosition:e.r(function(){var e=this.pastInput(),t=Array(e.length+1).join(`-`);return e+this.upcomingInput()+`
`+t+`^`},`showPosition`),test_match:e.r(function(e,t){var n,r,i;if(this.options.backtrack_lexer&&(i={yylineno:this.yylineno,yylloc:{first_line:this.yylloc.first_line,last_line:this.last_line,first_column:this.yylloc.first_column,last_column:this.yylloc.last_column},yytext:this.yytext,match:this.match,matches:this.matches,matched:this.matched,yyleng:this.yyleng,offset:this.offset,_more:this._more,_input:this._input,yy:this.yy,conditionStack:this.conditionStack.slice(0),done:this.done},this.options.ranges&&(i.yylloc.range=this.yylloc.range.slice(0))),r=e[0].match(/(?:\r\n?|\n).*/g),r&&(this.yylineno+=r.length),this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:r?r[r.length-1].length-r[r.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+e[0].length},this.yytext+=e[0],this.match+=e[0],this.matches=e,this.yyleng=this.yytext.length,this.options.ranges&&(this.yylloc.range=[this.offset,this.offset+=this.yyleng]),this._more=!1,this._backtrack=!1,this._input=this._input.slice(e[0].length),this.matched+=e[0],n=this.performAction.call(this,this.yy,this,t,this.conditionStack[this.conditionStack.length-1]),this.done&&this._input&&(this.done=!1),n)return n;if(this._backtrack){for(var a in i)this[a]=i[a];return!1}return!1},`test_match`),next:e.r(function(){if(this.done)return this.EOF;this._input||(this.done=!0);var e,t,n,r;this._more||(this.yytext=``,this.match=``);for(var i=this._currentRules(),a=0;a<i.length;a++)if(n=this._input.match(this.rules[i[a]]),n&&(!t||n[0].length>t[0].length)){if(t=n,r=a,this.options.backtrack_lexer){if(e=this.test_match(n,i[a]),e!==!1)return e;if(this._backtrack){t=!1;continue}else return!1}else if(!this.options.flex)break}return t?(e=this.test_match(t,i[r]),e===!1?!1:e):this._input===``?this.EOF:this.parseError(`Lexical error on line `+(this.yylineno+1)+`. Unrecognized text.
`+this.showPosition(),{text:``,token:null,line:this.yylineno})},`next`),lex:e.r(function(){return this.next()||this.lex()},`lex`),begin:e.r(function(e){this.conditionStack.push(e)},`begin`),popState:e.r(function(){return this.conditionStack.length-1>0?this.conditionStack.pop():this.conditionStack[0]},`popState`),_currentRules:e.r(function(){return this.conditionStack.length&&this.conditionStack[this.conditionStack.length-1]?this.conditions[this.conditionStack[this.conditionStack.length-1]].rules:this.conditions.INITIAL.rules},`_currentRules`),topState:e.r(function(e){return e=this.conditionStack.length-1-Math.abs(e||0),e>=0?this.conditionStack[e]:`INITIAL`},`topState`),pushState:e.r(function(e){this.begin(e)},`pushState`),stateStackSize:e.r(function(){return this.conditionStack.length},`stateStackSize`),options:{"case-insensitive":!0},performAction:e.r(function(t,n,r,i){function a(){let e=n.yytext.indexOf(`%%`);if(e===0)return!1;if(e>0){let r=n.yytext.slice(0,e),i=n.yytext.slice(e);i&&t.lexer.unput(i),n.yytext=r}return!0}switch(e.r(a,`processId`),r){case 0:return 38;case 1:return 40;case 2:return 39;case 3:return 44;case 4:return 51;case 5:return 52;case 6:return 53;case 7:return 54;case 8:return 5;case 9:break;case 10:break;case 11:break;case 12:break;case 13:return this.pushState(`SCALE`),17;case 14:return 18;case 15:this.popState();break;case 16:return this.begin(`acc_title`),33;case 17:return this.popState(),`acc_title_value`;case 18:return this.begin(`acc_descr`),35;case 19:return this.popState(),`acc_descr_value`;case 20:this.begin(`acc_descr_multiline`);break;case 21:this.popState();break;case 22:return`acc_descr_multiline_value`;case 23:return this.pushState(`CLASSDEF`),41;case 24:return this.popState(),this.pushState(`CLASSDEFID`),`DEFAULT_CLASSDEF_ID`;case 25:return this.popState(),this.pushState(`CLASSDEFID`),42;case 26:return this.popState(),43;case 27:return this.pushState(`CLASS`),48;case 28:return this.popState(),this.pushState(`CLASS_STYLE`),49;case 29:return this.popState(),50;case 30:return this.pushState(`STYLE`),45;case 31:return this.popState(),this.pushState(`STYLEDEF_STYLES`),46;case 32:return this.popState(),47;case 33:return this.pushState(`SCALE`),17;case 34:return 18;case 35:this.popState();break;case 36:this.pushState(`STATE`);break;case 37:return this.popState(),n.yytext=n.yytext.slice(0,-8).trim(),25;case 38:return this.popState(),n.yytext=n.yytext.slice(0,-8).trim(),26;case 39:return this.popState(),n.yytext=n.yytext.slice(0,-10).trim(),27;case 40:return this.popState(),n.yytext=n.yytext.slice(0,-8).trim(),25;case 41:return this.popState(),n.yytext=n.yytext.slice(0,-8).trim(),26;case 42:return this.popState(),n.yytext=n.yytext.slice(0,-10).trim(),27;case 43:return 51;case 44:return 52;case 45:return 53;case 46:return 54;case 47:this.pushState(`STATE_STRING`);break;case 48:return this.pushState(`STATE_ID`),`AS`;case 49:return a()?(this.popState(),`ID`):void 0;case 50:this.popState();break;case 51:return`STATE_DESCR`;case 52:return 19;case 53:this.popState();break;case 54:return this.popState(),this.pushState(`struct`),20;case 55:return this.popState(),21;case 56:break;case 57:return this.begin(`NOTE`),29;case 58:return this.popState(),this.pushState(`NOTE_ID`),59;case 59:return this.popState(),this.pushState(`NOTE_ID`),60;case 60:this.popState(),this.pushState(`FLOATING_NOTE`);break;case 61:return this.popState(),this.pushState(`FLOATING_NOTE_ID`),`AS`;case 62:break;case 63:return`NOTE_TEXT`;case 64:return a()?(this.popState(),`ID`):void 0;case 65:return a()?(this.popState(),this.pushState(`NOTE_TEXT`),24):void 0;case 66:return this.popState(),n.yytext=n.yytext.substr(2).trim(),31;case 67:return this.popState(),n.yytext=n.yytext.slice(0,-8).trim(),31;case 68:return 6;case 69:return 6;case 70:return 16;case 71:return 57;case 72:return a()?24:void 0;case 73:return n.yytext=n.yytext.trim(),14;case 74:return 15;case 75:return 28;case 76:return 58;case 77:return 5;case 78:return`INVALID`}},`anonymous`),rules:[/^(?:click\b)/i,/^(?:href\b)/i,/^(?:"[^"]*")/i,/^(?:default\b)/i,/^(?:.*direction\s+TB[^\n]*)/i,/^(?:.*direction\s+BT[^\n]*)/i,/^(?:.*direction\s+RL[^\n]*)/i,/^(?:.*direction\s+LR[^\n]*)/i,/^(?:[\n]+)/i,/^(?:[\s]+)/i,/^(?:((?!\n)\s)+)/i,/^(?:#[^\n]*)/i,/^(?:%%(?!\{)[^\n]*)/i,/^(?:scale\s+)/i,/^(?:\d+)/i,/^(?:\s+width\b)/i,/^(?:accTitle\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*\{\s*)/i,/^(?:[\}])/i,/^(?:[^\}]*)/i,/^(?:classDef\s+)/i,/^(?:DEFAULT\s+)/i,/^(?:\w+\s+)/i,/^(?:[^\n]*)/i,/^(?:class\s+)/i,/^(?:(\w+)+((,\s*\w+)*))/i,/^(?:[^\n]*)/i,/^(?:style\s+)/i,/^(?:[\w,]+\s+)/i,/^(?:[^\n]*)/i,/^(?:scale\s+)/i,/^(?:\d+)/i,/^(?:\s+width\b)/i,/^(?:state\s+)/i,/^(?:.*<<fork>>)/i,/^(?:.*<<join>>)/i,/^(?:.*<<choice>>)/i,/^(?:.*\[\[fork\]\])/i,/^(?:.*\[\[join\]\])/i,/^(?:.*\[\[choice\]\])/i,/^(?:.*direction\s+TB[^\n]*)/i,/^(?:.*direction\s+BT[^\n]*)/i,/^(?:.*direction\s+RL[^\n]*)/i,/^(?:.*direction\s+LR[^\n]*)/i,/^(?:["])/i,/^(?:\s*as\s+)/i,/^(?:[^\n\{]*)/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:[^\n\s\{]+)/i,/^(?:\n)/i,/^(?:\{)/i,/^(?:\})/i,/^(?:[\n])/i,/^(?:note\s+)/i,/^(?:left of\b)/i,/^(?:right of\b)/i,/^(?:")/i,/^(?:\s*as\s*)/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:[^\n]*)/i,/^(?:\s*[^:\n\s\-]+)/i,/^(?:\s*:[^:\n;]+)/i,/^(?:[\s\S]*?\n\s*end note\b)/i,/^(?:stateDiagram\s+)/i,/^(?:stateDiagram-v2\s+)/i,/^(?:hide empty description\b)/i,/^(?:\[\*\])/i,/^(?:[^:\n\s\-\{]+)/i,/^(?:\s*:(?:[^:\n;]|:[^:\n;])+)/i,/^(?:-->)/i,/^(?:--)/i,/^(?::::)/i,/^(?:$)/i,/^(?:.)/i],conditions:{LINE:{rules:[10,11,12],inclusive:!1},struct:{rules:[10,11,12,23,27,30,36,43,44,45,46,55,56,57,71,72,73,74,75,76],inclusive:!1},FLOATING_NOTE_ID:{rules:[64],inclusive:!1},FLOATING_NOTE:{rules:[61,62,63],inclusive:!1},NOTE_TEXT:{rules:[66,67],inclusive:!1},NOTE_ID:{rules:[65],inclusive:!1},NOTE:{rules:[58,59,60],inclusive:!1},STYLEDEF_STYLEOPTS:{rules:[],inclusive:!1},STYLEDEF_STYLES:{rules:[32],inclusive:!1},STYLE_IDS:{rules:[],inclusive:!1},STYLE:{rules:[31],inclusive:!1},CLASS_STYLE:{rules:[29],inclusive:!1},CLASS:{rules:[28],inclusive:!1},CLASSDEFID:{rules:[26],inclusive:!1},CLASSDEF:{rules:[24,25],inclusive:!1},acc_descr_multiline:{rules:[21,22],inclusive:!1},acc_descr:{rules:[19],inclusive:!1},acc_title:{rules:[17],inclusive:!1},SCALE:{rules:[14,15,34,35],inclusive:!1},ALIAS:{rules:[],inclusive:!1},STATE_ID:{rules:[49],inclusive:!1},STATE_STRING:{rules:[50,51],inclusive:!1},FORK_STATE:{rules:[],inclusive:!1},STATE:{rules:[10,11,12,37,38,39,40,41,42,47,48,52,53,54],inclusive:!1},ID:{rules:[10,11,12],inclusive:!1},INITIAL:{rules:[0,1,2,3,4,5,6,7,8,9,11,12,13,16,18,20,23,27,30,33,36,54,57,68,69,70,71,72,73,74,76,77,78],inclusive:!0}}}})();function P(){this.yy={}}return e.r(P,`Parser`),P.prototype=N,N.Parser=P,new P})();s.parser=s;var c=s,l=`TB`,u=`TB`,d=`dir`,f=`state`,p=`root`,m=`relation`,h=`classDef`,g=`style`,_=`applyClass`,v=`default`,y=`divider`,b=`fill:none`,x=`fill: #333`,S=`c`,C=`markdown`,w=`normal`,T=`rect`,E=`rectWithTitle`,D=`stateStart`,O=`stateEnd`,k=`divider`,A=`roundedWithTitle`,j=`note`,M=`noteGroup`,N=`statediagram`,P=`${N}-state`,F=`transition`,ee=`note`,te=`${F} note-edge`,ne=`${N}-${ee}`,re=`${N}-cluster`,ie=`${N}-cluster-alt`,I=`parent`,L=`note`,ae=`state`,R=`----`,z=`${R}${L}`,B=`${R}${I}`,V=e.r((e,t=u)=>{if(!e.doc)return t;let n=t;for(let t of e.doc)t.stmt===`dir`&&(n=t.value);return n},`getDir`),oe={getClasses:e.r(function(e,t){return t.db.getClasses()},`getClasses`),draw:e.r(async function(o,s,c,l){var u,d;e.i.info(`REF0:`),e.i.info(`Drawing state diagram (v2)`,s);let{securityLevel:f,state:p,layout:m}=t.x();l.db.extract(l.db.getRootDocV2());let h=l.db.getData(),g=r.t(s,f);h.type=l.type,h.layoutAlgorithm=m,h.nodeSpacing=(p==null?void 0:p.nodeSpacing)||50,h.rankSpacing=(p==null?void 0:p.rankSpacing)||50,t.x().look===`neo`?h.markers=[`barbNeo`]:h.markers=[`barb`],h.diagramId=s,await a.r(h,g);try{(typeof l.db.getLinks==`function`?l.db.getLinks():new Map).forEach((t,n)=>{var r;let i=typeof n==`string`?n:typeof(n==null?void 0:n.id)==`string`?n.id:``;if(!i){e.i.warn(`⚠️ Invalid or missing stateId from key:`,JSON.stringify(n));return}let a=(r=g.node())==null?void 0:r.querySelectorAll(`g`),o;if(a==null||a.forEach(e=>{var t;((t=e.textContent)==null?void 0:t.trim())===i&&(o=e)}),!o){e.i.warn(`⚠️ Could not find node matching text:`,i);return}let s=o.parentNode;if(!s){e.i.warn(`⚠️ Node has no parent, cannot wrap:`,i);return}let c=document.createElementNS(`http://www.w3.org/2000/svg`,`a`),l=t.url.replace(/^"+|"+$/g,``);if(c.setAttributeNS(`http://www.w3.org/1999/xlink`,`xlink:href`,l),c.setAttribute(`target`,`_blank`),t.tooltip){let e=t.tooltip.replace(/^"+|"+$/g,``);c.setAttribute(`title`,e)}s.replaceChild(c,o),c.appendChild(o),e.i.info(`🔗 Wrapped node in <a> tag for:`,i,t.url)})}catch(t){e.i.error(`❌ Error injecting clickable links:`,t)}n.g.insertTitle(g,`statediagramTitleText`,(u=p==null?void 0:p.titleTopMargin)==null?25:u,l.db.getDiagramTitle()),i.t(g,8,N,(d=p==null?void 0:p.useMaxWidth)==null?!0:d)},`draw`),getDir:V},H=new Map,U=0;function W(e=``,t=0,n=``,r=R){return`${ae}-${e}${n!==null&&n.length>0?`${r}${n}`:``}-${t}`}e.r(W,`stateDomId`);var se=e.r((n,r,i,a,o,s,c,l)=>{e.i.trace(`items`,r),r.forEach(e=>{switch(e.stmt){case f:Y(n,e,i,a,o,s,c,l);break;case v:Y(n,e,i,a,o,s,c,l);break;case m:{var r;Y(n,e.state1,i,a,o,s,c,l),Y(n,e.state2,i,a,o,s,c,l);let u=c===`neo`,d={id:`edge`+U,start:e.state1.id,end:e.state2.id,arrowhead:`normal`,arrowTypeEnd:u?`arrow_barb_neo`:`arrow_barb`,style:b,labelStyle:``,label:t.s.sanitizeText((r=e.description)==null?``:r,t.x()),arrowheadStyle:x,labelpos:S,labelType:C,thickness:w,classes:F,look:c};o.push(d),U++}break}})},`setupDoc`),G=e.r((e,t=u)=>{let n=t;if(e.doc)for(let t of e.doc)t.stmt===`dir`&&(n=t.value);return n},`getDir`);function K(e,t,n){if(!t.id||t.id===`</join></fork>`||t.id===`</choice>`)return;t.cssClasses&&(Array.isArray(t.cssCompiledStyles)||(t.cssCompiledStyles=[]),t.cssClasses.split(` `).forEach(e=>{let r=n.get(e);if(r){var i;t.cssCompiledStyles=[...(i=t.cssCompiledStyles)==null?[]:i,...r.styles]}}));let r=e.find(e=>e.id===t.id);r?Object.assign(r,t):e.push(t)}e.r(K,`insertOrUpdateNode`);function q(e){var t,n;return(t=e==null||(n=e.classes)==null?void 0:n.join(` `))==null?``:t}e.r(q,`getClassesFromDbInfo`);function J(e){var t;return(t=e==null?void 0:e.styles)==null?[]:t}e.r(J,`getStylesFromDbInfo`);var Y=e.r((n,r,i,a,o,s,c,l)=>{let u=r.id,d=i.get(u),f=q(d),p=J(d),m=t.x();if(e.i.info(`dataFetcher parsedItem`,r,d,p),u!==`root`){var h;let i=T;r.start===!0?i=D:r.start===!1&&(i=O),r.type!==v&&(i=r.type),H.get(u)||H.set(u,{id:u,shape:i,description:t.s.sanitizeText(u,m),cssClasses:`${f} ${P}`,cssStyles:p});let d=H.get(u);if(r.description){if(Array.isArray(d.description))d.shape=E,d.description.push(r.description);else{var g;(g=d.description)!=null&&g.length&&d.description.length>0?(d.shape=E,d.description===u?d.description=[r.description]:d.description=[d.description,r.description]):(d.shape=T,d.description=r.description)}d.description=t.s.sanitizeTextOrArray(d.description,m)}((h=d.description)==null?void 0:h.length)===1&&d.shape===E&&(d.type===`group`?d.shape=A:d.shape=T),!d.type&&r.doc&&(e.i.info(`Setting cluster for XCX`,u,G(r)),d.type=`group`,d.isGroup=!0,d.dir=G(r),d.shape=r.type===y?k:A,d.cssClasses=`${d.cssClasses} ${re} ${s?ie:``}`);let N={labelStyle:``,shape:d.shape,label:d.description,cssClasses:d.cssClasses,cssCompiledStyles:[],cssStyles:d.cssStyles,id:u,dir:d.dir,domId:W(u,U),type:d.type,isGroup:d.type===`group`,padding:8,rx:10,ry:10,look:c,labelType:`markdown`};if(N.shape===k&&(N.label=``),n&&n.id!==`root`&&(e.i.trace(`Setting node `,u,` to be child of its parent `,n.id),N.parentId=n.id),N.centerLabel=!0,r.note){var _;let e={labelStyle:``,shape:j,label:r.note.text,labelType:`markdown`,cssClasses:ne,cssStyles:[],cssCompiledStyles:[],id:u+z+`-`+U,domId:W(u,U,L),type:d.type,isGroup:d.type===`group`,padding:(_=m.flowchart)==null?void 0:_.padding,look:c,position:r.note.position},t=u+B,n={labelStyle:``,shape:M,label:r.note.text,cssClasses:d.cssClasses,cssStyles:[],id:u+B,domId:W(u,U,I),type:`group`,isGroup:!0,padding:16,look:c,position:r.note.position};U++,n.id=t,e.parentId=t,K(a,n,l),K(a,e,l),K(a,N,l);let i=u,s=e.id;r.note.position===`left of`&&(i=e.id,s=u),o.push({id:i+`-`+s,start:i,end:s,arrowhead:`none`,arrowTypeEnd:``,style:b,labelStyle:``,classes:te,arrowheadStyle:x,labelpos:S,labelType:C,thickness:w,look:c})}else K(a,N,l)}r.doc&&(e.i.trace(`Adding nodes children `),se(r,r.doc,i,a,o,!s,c,l))},`dataFetcher`),ce=e.r(()=>{H.clear(),U=0},`reset`),X={START_NODE:`[*]`,START_TYPE:`start`,END_NODE:`[*]`,END_TYPE:`end`,COLOR_KEYWORD:`color`,FILL_KEYWORD:`fill`,BG_FILL:`bgFill`,STYLECLASS_SEP:`,`},Z=e.r(()=>new Map,`newClassesList`),Q=e.r(()=>({relations:[],states:new Map,documents:{}}),`newDoc`),$=e.r(e=>JSON.parse(JSON.stringify(e)),`clone`),le=(o=class{constructor(e){this.version=e,this.nodes=[],this.edges=[],this.rootDoc=[],this.classes=Z(),this.documents={root:Q()},this.currentDocument=this.documents.root,this.startEndCount=0,this.dividerCnt=0,this.links=new Map,this.getAccTitle=t.y,this.setAccTitle=t.U,this.getAccDescription=t.v,this.setAccDescription=t.H,this.setDiagramTitle=t.K,this.getDiagramTitle=t.w,this.clear(),this.setRootDoc=this.setRootDoc.bind(this),this.getDividerId=this.getDividerId.bind(this),this.setDirection=this.setDirection.bind(this),this.trimColon=this.trimColon.bind(this)}extract(e){this.clear(!0);for(let t of Array.isArray(e)?e:e.doc)switch(t.stmt){case f:this.addState(t.id.trim(),t.type,t.doc,t.description,t.note);break;case m:this.addRelation(t.state1,t.state2,t.description);break;case h:this.addStyleClass(t.id.trim(),t.classes);break;case g:this.handleStyleDef(t);break;case _:this.setCssClass(t.id.trim(),t.styleClass);break;case`click`:this.addLink(t.id,t.url,t.tooltip);break}let n=this.getStates(),r=t.x();ce(),Y(void 0,this.getRootDocV2(),n,this.nodes,this.edges,!0,r.look,this.classes);for(let e of this.nodes)if(Array.isArray(e.label)){if(e.description=e.label.slice(1),e.isGroup&&e.description.length>0)throw Error(`Group nodes can only have label. Remove the additional description for node [${e.id}]`);e.label=e.label[0]}}handleStyleDef(e){let t=e.id.trim().split(`,`),n=e.styleClass.split(`,`);for(let e of t){let t=this.getState(e);if(!t){let n=e.trim();this.addState(n),t=this.getState(n)}t&&(t.styles=n.map(e=>{var t;return(t=e.replace(/;/g,``))==null?void 0:t.trim()}))}}setRootDoc(t){e.i.info(`Setting root doc`,t),this.rootDoc=t,this.version===1?this.extract(t):this.extract(this.getRootDocV2())}docTranslator(e,t,r){if(t.stmt===m){this.docTranslator(e,t.state1,!0),this.docTranslator(e,t.state2,!1);return}if(t.stmt===f&&(t.id===X.START_NODE?(t.id=e.id+(r?`_start`:`_end`),t.start=r):t.id=t.id.trim()),t.stmt!==p&&t.stmt!==f||!t.doc)return;let i=[],a=[];for(let e of t.doc)if(e.type===y){let t=$(e);t.doc=$(a),i.push(t),a=[]}else a.push(e);if(i.length>0&&a.length>0){let e={stmt:f,id:n.s(),type:`divider`,doc:$(a)};i.push($(e)),t.doc=i}t.doc.forEach(e=>this.docTranslator(t,e,!0))}getRootDocV2(){return this.docTranslator({id:p,stmt:p},{id:p,stmt:p,doc:this.rootDoc},!0),{id:p,doc:this.rootDoc}}addState(n,r=v,i=void 0,a=void 0,o=void 0,s=void 0,c=void 0,l=void 0){let u=n==null?void 0:n.trim();if(!this.currentDocument.states.has(u))e.i.info(`Adding state `,u,a),this.currentDocument.states.set(u,{stmt:f,id:u,descriptions:[],type:r,doc:i,note:o,classes:[],styles:[],textStyles:[]});else{let e=this.currentDocument.states.get(u);if(!e)throw Error(`State not found: ${u}`);e.doc||(e.doc=i),e.type||(e.type=r)}if(a&&(e.i.info(`Setting state description`,u,a),(Array.isArray(a)?a:[a]).forEach(e=>this.addDescription(u,e.trim()))),o){let e=this.currentDocument.states.get(u);if(!e)throw Error(`State not found: ${u}`);e.note=o,e.note.text=t.s.sanitizeText(e.note.text,t.x())}s&&(e.i.info(`Setting state classes`,u,s),(Array.isArray(s)?s:[s]).forEach(e=>this.setCssClass(u,e.trim()))),c&&(e.i.info(`Setting state styles`,u,c),(Array.isArray(c)?c:[c]).forEach(e=>this.setStyle(u,e.trim()))),l&&(e.i.info(`Setting state styles`,u,c),(Array.isArray(l)?l:[l]).forEach(e=>this.setTextStyle(u,e.trim())))}clear(e){this.nodes=[],this.edges=[],this.documents={root:Q()},this.currentDocument=this.documents.root,this.startEndCount=0,this.classes=Z(),e||(this.links=new Map,t.a())}getState(e){return this.currentDocument.states.get(e)}getStates(){return this.currentDocument.states}logDocuments(){e.i.info(`Documents = `,this.documents)}getRelations(){return this.currentDocument.relations}addLink(t,n,r){this.links.set(t,{url:n,tooltip:r}),e.i.warn(`Adding link`,t,n,r)}getLinks(){return this.links}startIdIfNeeded(e=``){return e===X.START_NODE?(this.startEndCount++,`${X.START_TYPE}${this.startEndCount}`):e}startTypeIfNeeded(e=``,t=v){return e===X.START_NODE?X.START_TYPE:t}endIdIfNeeded(e=``){return e===X.END_NODE?(this.startEndCount++,`${X.END_TYPE}${this.startEndCount}`):e}endTypeIfNeeded(e=``,t=v){return e===X.END_NODE?X.END_TYPE:t}addRelationObjs(e,n,r=``){let i=this.startIdIfNeeded(e.id.trim()),a=this.startTypeIfNeeded(e.id.trim(),e.type),o=this.startIdIfNeeded(n.id.trim()),s=this.startTypeIfNeeded(n.id.trim(),n.type);this.addState(i,a,e.doc,e.description,e.note,e.classes,e.styles,e.textStyles),this.addState(o,s,n.doc,n.description,n.note,n.classes,n.styles,n.textStyles),this.currentDocument.relations.push({id1:i,id2:o,relationTitle:t.s.sanitizeText(r,t.x())})}addRelation(e,n,r){if(typeof e==`object`&&typeof n==`object`)this.addRelationObjs(e,n,r);else if(typeof e==`string`&&typeof n==`string`){let i=this.startIdIfNeeded(e.trim()),a=this.startTypeIfNeeded(e),o=this.endIdIfNeeded(n.trim()),s=this.endTypeIfNeeded(n);this.addState(i,a),this.addState(o,s),this.currentDocument.relations.push({id1:i,id2:o,relationTitle:r?t.s.sanitizeText(r,t.x()):void 0})}}addDescription(e,n){var r;let i=this.currentDocument.states.get(e),a=n.startsWith(`:`)?n.replace(`:`,``).trim():n;i==null||(r=i.descriptions)==null||r.push(t.s.sanitizeText(a,t.x()))}cleanupLabel(e){return e.startsWith(`:`)?e.slice(2).trim():e.trim()}getDividerId(){return this.dividerCnt++,`divider-id-${this.dividerCnt}`}addStyleClass(e,t=``){this.classes.has(e)||this.classes.set(e,{id:e,styles:[],textStyles:[]});let n=this.classes.get(e);t&&n&&t.split(X.STYLECLASS_SEP).forEach(e=>{let t=e.replace(/([^;]*);/,`$1`).trim();if(RegExp(X.COLOR_KEYWORD).exec(e)){let e=t.replace(X.FILL_KEYWORD,X.BG_FILL).replace(X.COLOR_KEYWORD,X.FILL_KEYWORD);n.textStyles.push(e)}n.styles.push(t)})}getClasses(){return this.classes}setCssClass(e,t){e.split(`,`).forEach(e=>{var n;let r=this.getState(e);if(!r){let t=e.trim();this.addState(t),r=this.getState(t)}r==null||(n=r.classes)==null||n.push(t)})}setStyle(e,t){var n;(n=this.getState(e))==null||(n=n.styles)==null||n.push(t)}setTextStyle(e,t){var n;(n=this.getState(e))==null||(n=n.textStyles)==null||n.push(t)}getDirectionStatement(){return this.rootDoc.find(e=>e.stmt===d)}getDirection(){var e,t;return(e=(t=this.getDirectionStatement())==null?void 0:t.value)==null?l:e}setDirection(e){let t=this.getDirectionStatement();t?t.value=e:this.rootDoc.unshift({stmt:d,value:e})}trimColon(e){return e.startsWith(`:`)?e.slice(1).trim():e.trim()}getData(){let e=t.x();return{nodes:this.nodes,edges:this.edges,other:{},config:e,direction:V(this.getRootDocV2())}}getConfig(){return t.x().state}},e.r(o,`StateDB`),o.relationType={AGGREGATION:0,EXTENSION:1,COMPOSITION:2,DEPENDENCY:3},o),ue=e.r(e=>{var t;return`
defs [id$="-barbEnd"] {
    fill: ${e.transitionColor};
    stroke: ${e.transitionColor};
  }
g.stateGroup text {
  fill: ${e.nodeBorder};
  stroke: none;
  font-size: 10px;
}
g.stateGroup text {
  fill: ${e.textColor};
  stroke: none;
  font-size: 10px;

}
g.stateGroup .state-title {
  font-weight: bolder;
  fill: ${e.stateLabelColor};
}

g.stateGroup rect {
  fill: ${e.mainBkg};
  stroke: ${e.nodeBorder};
}

g.stateGroup line {
  stroke: ${e.lineColor};
  stroke-width: ${e.strokeWidth||1};
}

.transition {
  stroke: ${e.transitionColor};
  stroke-width: ${e.strokeWidth||1};
  fill: none;
}

.stateGroup .composit {
  fill: ${e.background};
  border-bottom: 1px
}

.stateGroup .alt-composit {
  fill: #e0e0e0;
  border-bottom: 1px
}

.state-note {
  stroke: ${e.noteBorderColor};
  fill: ${e.noteBkgColor};

  text {
    fill: ${e.noteTextColor};
    stroke: none;
    font-size: 10px;
  }
}

.stateLabel .box {
  stroke: none;
  stroke-width: 0;
  fill: ${e.mainBkg};
  opacity: 0.5;
}

.edgeLabel .label rect {
  fill: ${e.labelBackgroundColor};
  opacity: 0.5;
}
.edgeLabel {
  background-color: ${e.edgeLabelBackground};
  p {
    background-color: ${e.edgeLabelBackground};
  }
  rect {
    opacity: 0.5;
    background-color: ${e.edgeLabelBackground};
    fill: ${e.edgeLabelBackground};
  }
  text-align: center;
}
.edgeLabel .label text {
  fill: ${e.transitionLabelColor||e.tertiaryTextColor};
}
.label div .edgeLabel {
  color: ${e.transitionLabelColor||e.tertiaryTextColor};
}

.stateLabel text {
  fill: ${e.stateLabelColor};
  font-size: 10px;
  font-weight: bold;
}

.node circle.state-start {
  fill: ${e.specialStateColor};
  stroke: ${e.specialStateColor};
}

.node .fork-join {
  fill: ${e.specialStateColor};
  stroke: ${e.specialStateColor};
}

.node circle.state-end {
  fill: ${e.innerEndBackground};
  stroke: ${e.background};
  stroke-width: 1.5
}
.end-state-inner {
  fill: ${e.compositeBackground||e.background};
  // stroke: ${e.background};
  stroke-width: 1.5
}

.node rect {
  fill: ${e.stateBkg||e.mainBkg};
  stroke: ${e.stateBorder||e.nodeBorder};
  stroke-width: ${e.strokeWidth||1}px;
}
.node polygon {
  fill: ${e.mainBkg};
  stroke: ${e.stateBorder||e.nodeBorder};;
  stroke-width: ${e.strokeWidth||1}px;
}
[id$="-barbEnd"] {
  fill: ${e.lineColor};
}

.statediagram-cluster rect {
  fill: ${e.compositeTitleBackground};
  stroke: ${e.stateBorder||e.nodeBorder};
  stroke-width: ${e.strokeWidth||1}px;
}

.cluster-label, .nodeLabel {
  color: ${e.stateLabelColor};
  // line-height: 1;
}

.statediagram-cluster rect.outer {
  rx: 5px;
  ry: 5px;
}
.statediagram-state .divider {
  stroke: ${e.stateBorder||e.nodeBorder};
}

.statediagram-state .title-state {
  rx: 5px;
  ry: 5px;
}
.statediagram-cluster.statediagram-cluster .inner {
  fill: ${e.compositeBackground||e.background};
}
.statediagram-cluster.statediagram-cluster-alt .inner {
  fill: ${e.altBackground?e.altBackground:`#efefef`};
}

.statediagram-cluster .inner {
  rx:0;
  ry:0;
}

.statediagram-state rect.basic {
  rx: 5px;
  ry: 5px;
}
.statediagram-state rect.divider {
  stroke-dasharray: 10,10;
  fill: ${e.altBackground?e.altBackground:`#efefef`};
}

.note-edge {
  stroke-dasharray: 5;
}

.statediagram-note rect {
  fill: ${e.noteBkgColor};
  stroke: ${e.noteBorderColor};
  stroke-width: 1px;
  rx: 0;
  ry: 0;
}
.statediagram-note rect {
  fill: ${e.noteBkgColor};
  stroke: ${e.noteBorderColor};
  stroke-width: 1px;
  rx: 0;
  ry: 0;
}

.statediagram-note text {
  fill: ${e.noteTextColor};
}

.statediagram-note .nodeLabel {
  color: ${e.noteTextColor};
}
.statediagram .edgeLabel {
  color: red; // ${e.noteTextColor};
}

[id$="-dependencyStart"], [id$="-dependencyEnd"] {
  fill: ${e.lineColor};
  stroke: ${e.lineColor};
  stroke-width: ${e.strokeWidth||1};
}

.statediagramTitleText {
  text-anchor: middle;
  font-size: 18px;
  fill: ${e.textColor};
}

[data-look="neo"].statediagram-cluster rect {
  fill: ${e.mainBkg};
  stroke: ${e.useGradient?`url(`+e.svgId+`-gradient)`:e.stateBorder||e.nodeBorder};
  stroke-width: ${(t=e.strokeWidth)==null?1:t};
}
[data-look="neo"].statediagram-cluster rect.outer {
  rx: ${e.radius}px;
  ry: ${e.radius}px;
  filter: ${e.dropShadow?e.dropShadow.replace(`url(#drop-shadow)`,`url(${e.svgId}-drop-shadow)`):`none`}
}
`},`getStyles`);Object.defineProperty(exports,`i`,{enumerable:!0,get:function(){return ue}}),Object.defineProperty(exports,`n`,{enumerable:!0,get:function(){return c}}),Object.defineProperty(exports,`r`,{enumerable:!0,get:function(){return oe}}),Object.defineProperty(exports,`t`,{enumerable:!0,get:function(){return le}});