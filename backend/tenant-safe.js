const fs=require("fs");
const file="./database/tenants.json";

function read(){
 try{
  if(!fs.existsSync(file)) fs.writeFileSync(file,"[]");
  const data=JSON.parse(fs.readFileSync(file,"utf8"));
  return Array.isArray(data)?data:[];
 }catch(e){
  console.error("TENANT_READ_ERROR",e.message);
  return [];
 }
}

module.exports={
 all:read,
 create(input){
  const list=read();
  const item={id:Date.now(),...input};
  list.push(item);
  try{
   fs.writeFileSync(file,JSON.stringify(list,null,2));
  }catch(e){
   console.error("TENANT_WRITE_ERROR",e.message);
  }
  return item;
 }
};
