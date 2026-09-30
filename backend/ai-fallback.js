// AI provider fallback manager
// Priority: Provider 1 -> Provider 2 -> Provider 3

async function runAI(providers,payload){
 for(const provider of providers){
  try{
   const result=await provider(payload);
   if(result) return result;
  }catch(e){
   console.error("AI_PROVIDER_FAILED",e.message);
  }
 }
 return {
  status:"offline",
  message:"AI providers unavailable"
 };
}

module.exports=runAI;
