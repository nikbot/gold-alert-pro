process.on("uncaughtException",(err)=>{
 console.error("UNCAUGHT_EXCEPTION:",err.stack || err);
});

process.on("unhandledRejection",(err)=>{
 console.error("UNHANDLED_REJECTION:",err);
});
