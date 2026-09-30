function safeRequire(path, fallback){
  try{
    return require(path);
  }catch(err){
    console.error("Optional module load failed:", path, err.message);
    return fallback;
  }
}

module.exports = safeRequire;
