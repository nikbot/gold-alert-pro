module.exports=function safeModule(loader,fallback){
 try{
   return loader();
 }catch(e){
   console.error("SAFE_MODULE_ERROR:",e.message);
   return fallback;
 }
};
