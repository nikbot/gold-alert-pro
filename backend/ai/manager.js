import gemini from './gemini.js';
import openai from './openai.js';
import groq from './groq.js';
import fallback from './fallback.js';

const providers={Gemini:gemini,OpenAI:openai,Groq:groq};
let activeProvider=null;
const stats={};

async function call(name,fn,data){
 const start=Date.now();
 const timer=new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),15000));
 const result=await Promise.race([fn(data),timer]);
 stats[name]={ok:true,latency:Date.now()-start,updated:new Date().toISOString()};
 return result;
}

export async function analyzeGold(data){
 const order=[activeProvider,...Object.keys(providers)].filter((v,i,a)=>v&&a.indexOf(v)===i);
 for(const name of order){
  try{
   const result=await call(name,providers[name],data);
   activeProvider=name;
   return {provider:name,analysis:result};
  }catch(e){
   stats[name]={ok:false,error:e.message,updated:new Date().toISOString()};
  }
 }
 return {provider:'local',analysis:fallback(data)};
}

export async function aiHealth(){
 return {ok:true,activeProvider,providers:Object.fromEntries(Object.entries(providers).map(([k])=>[k,{configured:Boolean(process.env[k.toUpperCase()+'_API_KEY']),...(stats[k]||{})}]))};
}
