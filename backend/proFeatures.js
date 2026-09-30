import crypto from 'node:crypto';

export function riskPositionSize({capital,riskPct,entry,stop}) {
  for (const [k,v] of Object.entries({capital,riskPct,entry,stop})) if (!Number.isFinite(Number(v))) throw new Error(`${k} must be numeric`);
  capital=Number(capital); riskPct=Number(riskPct); entry=Number(entry); stop=Number(stop);
  if(capital<=0||riskPct<=0||riskPct>10||entry<=0||stop<=0||entry===stop) throw new Error('Invalid risk parameters');
  const riskAmount=capital*riskPct/100, unitRisk=Math.abs(entry-stop);
  return {riskAmount,unitRisk,quantity:riskAmount/unitRisk,notional:riskAmount/unitRisk*entry, riskPct};
}
export function detectRegime(prices=[]) {
  const p=prices.map(Number).filter(x=>Number.isFinite(x)&&x>0).slice(-60);
  if(p.length<10) return {regime:'insufficient_data',samples:p.length,changePct:null,volatilityPct:null};
  const changePct=(p.at(-1)/p[0]-1)*100;
  const rets=p.slice(1).map((x,i)=>(x/p[i]-1)*100);
  const mean=rets.reduce((a,b)=>a+b,0)/rets.length;
  const volatilityPct=Math.sqrt(rets.reduce((s,x)=>s+(x-mean)**2,0)/rets.length);
  let regime='range';
  if(volatilityPct>=1.2) regime='high_volatility';
  else if(changePct>=1.5) regime='uptrend';
  else if(changePct<=-1.5) regime='downtrend';
  else if(volatilityPct<0.2) regime='low_volatility';
  return {regime,samples:p.length,changePct,volatilityPct};
}
export function evaluateAlertRule(rule, snapshot) {
  const value=Number(snapshot?.[rule?.field]), threshold=Number(rule?.threshold);
  if(!['price','rsi','changePct','volatilityPct'].includes(rule?.field)||!['above','below'].includes(rule?.operator)||!Number.isFinite(value)||!Number.isFinite(threshold)) return {valid:false,triggered:false};
  return {valid:true,triggered:rule.operator==='above'?value>=threshold:value<=threshold,field:rule.field,value,threshold};
}
export function createPaperTrade(input={}) {
  const side=String(input.side||'').toLowerCase(), entry=Number(input.entry), quantity=Number(input.quantity), stop=input.stop==null?null:Number(input.stop), target=input.target==null?null:Number(input.target);
  if(!['buy','sell'].includes(side)||!Number.isFinite(entry)||entry<=0||!Number.isFinite(quantity)||quantity<=0) throw new Error('Invalid paper trade');
  if(stop!==null&&(!Number.isFinite(stop)||stop<=0)||(target!==null&&(!Number.isFinite(target)||target<=0))) throw new Error('Invalid stop or target');
  return {id:crypto.randomUUID(),side,entry,quantity,stop,target,status:'open',createdAt:new Date().toISOString(),closedAt:null,exit:null,pnl:null};
}
export function closePaperTrade(trade, exit) {
  exit=Number(exit); if(!trade||trade.status!=='open'||!Number.isFinite(exit)||exit<=0) throw new Error('Invalid trade or exit');
  const pnl=(trade.side==='buy'?exit-trade.entry:trade.entry-exit)*trade.quantity;
  return {...trade,status:'closed',exit,pnl,closedAt:new Date().toISOString()};
}
