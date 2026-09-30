const fs = require("fs");
const path = "./database/tenants.json";

function load(){
 try{
  if(!fs.existsSync(path)) fs.writeFileSync(path,"[]");
  return JSON.parse(fs.readFileSync(path,"utf8"));
 }catch(e){
  console.error("tenant storage error", e.message);
  return [];
 }
}

function save(data){
 try{
  fs.writeFileSync(path, JSON.stringify(data,null,2));
 }catch(e){
  console.error("tenant save error", e.message);
 }
}

module.exports={
 getTenants:load,
 createTenant(data){
  const items=load();
  const tenant={id:String(Date.now()),...data};
  items.push(tenant);
  save(items);
  return tenant;
 }
};
