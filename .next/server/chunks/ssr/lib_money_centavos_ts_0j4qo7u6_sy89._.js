module.exports=[28695,a=>{"use strict";a.s(["f",0,function(a){let b=String(a).replace(/[₱,\s]/g,"").trim();if(!/^\d+(\.\d{1,2})?$/.test(b))throw Error("Enter a valid non-negative peso amount");let[c,d=""]=b.split(".");return 100*Number.parseInt(c,10)+Number.parseInt(d.padEnd(2,"0")||"0",10)}])}];

//# sourceMappingURL=lib_money_centavos_ts_0j4qo7u6_sy89._.js.map