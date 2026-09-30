import fs from "node:fs/promises";import path from "node:path";
const FILE=path.join(process.env.DATA_DIR||"/data/gold-alert-pro","theme-settings.json");
const themes={"gold-light":{name:"Gold Pro Light",className:"theme-gold-light"},"gold-dark":{name:"Gold Trader Dark",className:"theme-gold-dark"},"enterprise":{name:"Enterprise Blue",className:"theme-enterprise"}};
async function read(){try{return JSON.parse(await fs.readFile(FILE,"utf8"));}catch{return {active:"gold-light"};}}
async function save(x){await fs.mkdir(path.dirname(FILE),{recursive:true});await fs.writeFile(FILE,JSON.stringify(x,null,2));}
export async function getTheme(){const s=await read();return {active:s.active||"gold-light",themes};}
export async function setTheme(name){if(!themes[name])throw new Error("پوسته نامعتبر است");await save({active:name,updatedAt:new Date().toISOString()});return getTheme();}
