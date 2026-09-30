// Multi tenant foundation
const tenants = [];
module.exports = {
 getTenants(){ return tenants; },
 createTenant(data){
   const tenant={id:Date.now().toString(),...data};
   tenants.push(tenant);
   return tenant;
 }
};
