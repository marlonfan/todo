(function(e){var t={pattern:/^[;#].*/m,greedy:!0},n=`"(?:[^\r
"\\\\]|\\\\(?:[^\r]|\r
?))*"(?!\\S)`;e.languages.systemd={comment:t,section:{pattern:/^\[[^\n\r\[\]]*\](?=[ \t]*$)/m,greedy:!0,inside:{punctuation:/^\[|\]$/,"section-name":{pattern:/[\s\S]+/,alias:`selector`}}},key:{pattern:/^[^\s=]+(?=[ \t]*=)/m,greedy:!0,alias:`attr-name`},value:{pattern:RegExp(`(=[ 	]*(?!\\s))(?:`+n+`|(?=[^"\r
]))(?:[^\\s\\\\]|[ 	]+(?:(?![ 	"])|`+n+`)|\\\\[\r
]+(?:[#;].*[\r
]+)*(?![#;]))*`),lookbehind:!0,greedy:!0,alias:`attr-value`,inside:{comment:t,quoted:{pattern:RegExp(`(^|\\s)`+n),lookbehind:!0,greedy:!0},punctuation:/\\$/m,boolean:{pattern:/^(?:false|no|off|on|true|yes)$/,greedy:!0}}},punctuation:/=/}})(Prism);