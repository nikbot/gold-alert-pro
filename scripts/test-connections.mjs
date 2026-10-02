import fs from "node:fs";
if (fs.existsSync(".env")) {
  for (const line of fs.readFileSync(".env","utf8").split(/\\r?\\n/)) {
    const m=line.match(/^\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*=\\s*(.*)\\s*$/);
    if (m && process.env[m[1]]===undefined) process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
  }
}

const timeoutMs = Math.max(1500, Number(process.env.CONNECTION_TEST_TIMEOUT_MS || 6000));
const checks = [
  ["TGJU gold", process.env.TGJU_GOLD_URL || "https://www.tgju.org/profile/geram18"],
  ["TGJU dollar", process.env.TGJU_DOLLAR_URL || "https://www.tgju.org/profile/price_dollar_rl/today"],
  ["TGJU coin", process.env.TGJU_COIN_URL || "https://www.tgju.org/coin"],
  ["Servix", process.env.SERVIX_GOLD_URL || "https://servix.cc/api/v1/assets/GOLD_18_RLS"],
  ["Tindex", process.env.TINDEX_GOLD_URL || "https://tindex.app/api/public/indicators/precious-metals/GOLD-18K"],
  ["Gold API", "https://api.gold-api.com/price/XAU"],
  ["Yahoo gold", "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?interval=1m&range=1d"],
  ["Coinbase BTC", "https://api.coinbase.com/v2/prices/BTC-USD/spot"],
  ["Kraken BTC", "https://api.kraken.com/0/public/Ticker?pair=XBTUSD"],
  ["Binance BTC", "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"]
];

async function check(name,url){
  const started=Date.now();
  try{
    const r=await fetch(url,{redirect:"follow",signal:AbortSignal.timeout(timeoutMs),headers:{"User-Agent":"GoldAlertPro-ConnectionTest/85","Accept":"application/json,text/html,*/*"}});
    return {name,ok:r.ok,status:r.status,ms:Date.now()-started};
  }catch(e){
    return {name,ok:false,status:null,ms:Date.now()-started,error:e.name==="TimeoutError"?"timeout":String(e.message||e).slice(0,120)};
  }
}
const results=[];
for(const [name,url] of checks) results.push(await check(name,url));
const credentials={
  FORGOD_API_KEY:Boolean(process.env.FORGOD_API_KEY),
  SERVIX_API_KEY:Boolean(process.env.SERVIX_API_KEY),
  TINDEX_API_TOKEN:Boolean(process.env.TINDEX_API_TOKEN),
  GAPGPT_API_KEY:Boolean(process.env.GAPGPT_API_KEY),
  IPPANEL_API_KEY:Boolean(process.env.IPPANEL_API_KEY && process.env.IPPANEL_FROM)
};
console.log(JSON.stringify({checkedAt:new Date().toISOString(),results,credentials},null,2));
process.exitCode=results.some(x=>!x.ok)?1:0;
