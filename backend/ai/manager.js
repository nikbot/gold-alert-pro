import gemini from './gemini.js';
import openai from './openai.js';
import groq from './groq.js';
import fallback from './fallback.js';

const providers={
 Gemini:gemini,
 OpenAI:openai,
 Groq:groq
};

let activeProvider=null;

async function callProvider(name, fn, data){
 return await Promise.race([
   fn(data),
   new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),15000))
 ]);
}

export async function analyzeGold(data){

 const order=[];
 if(activeProvider && providers[activeProvider]) order.push(activeProvider);
 for(const p of Object.keys(providers)){
   if(!order.includes(p)) order.push(p);
 }

 for(const name of order){
   try{
     const result=await callProvider(name,providers[name],data);
     if(result){
       activeProvider=name;
       console.log(`AI active provider: ${name}`);
       return {provider:name,analysis:result};
     }
   }catch(e){
     console.warn(`AI ${name} failed: ${e.message}`);
   }
 }

 return {
   provider:'local',
   analysis:fallback(data)
 };
}

export function aiStatus(){
 return {activeProvider};
}
