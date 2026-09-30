import gemini from './gemini.js';
import openai from './openai.js';
import groq from './groq.js';
import fallback from './fallback.js';

const providers={Gemini:gemini,OpenAI:openai,Groq:groq};
let activeProvider=null;
const stats={};

async function callWithTimeout(fn,data,ms=15000){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),ms);
 try{return await fn({...data,signal:controller.signal});}
 finally{clearTimeout(timer);}
}

async function call(name,fn,data){
 const start=Date.now();
 try{
  const result=await callWithTimeout(fn,data,15000);
  stats[name]={ok:true,latency:Date.now()-start,updated:new Date().toISOString()};
  return result;
 }catch(e){
  stats[name]={ok:false,error:String(e.message||e),latency:Date.now()-start,updated:new Date().toISOString()};
  throw e;
 }
}

export async function analyzeGold(data={}){
 const order=[activeProvider,...Object.keys(providers)].filter((v,i,a)=>v&&a.indexOf(v)===i);
 for(const name of order){
  if(!providers[name]) continue;
  try{
   const result=await call(name,providers[name],data);
   activeProvider=name;
   return {provider:name,analysis:result};
  }catch(e){}
 }
 return {provider:'local-fallback',analysis:fallback(data)};
}

export async function aiHealth(){
 return {
  ok:true,
  activeProvider,
  providers:Object.fromEntries(Object.entries(providers).map(([k])=>[k,{configured:Boolean(process.env[k.toUpperCase()+'_API_KEY']),...(stats[k]||{})}]))
 };
}
