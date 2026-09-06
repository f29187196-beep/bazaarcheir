import fs from 'node:fs/promises';
import path from 'node:path';
const DATA_DIR='./data'; const DB_FILE=path.join(DATA_DIR,'sheypoorak.json');
const EMPTY={groups:{},locks:{},whitelist:{},warnings:{},pending_deletions:[],businesses:{},user_states:{},settings:{},filters:{},stats:{},messages:{}}; let cache;
async function load(){if(cache)return cache; await fs.mkdir(DATA_DIR,{recursive:true}); try{cache=JSON.parse(await fs.readFile(DB_FILE,'utf8')); for(const k of Object.keys(EMPTY)) if(cache[k]===undefined) cache[k]=structuredClone(EMPTY[k]);}catch{cache=structuredClone(EMPTY);await save()} return cache}
async function save(){await fs.writeFile(DB_FILE,JSON.stringify(cache,null,2),'utf8')}
const k=(a,b)=>`${a}:${b}`;
export async function resetCache(){cache=undefined}
export async function registerGroup(chatId,title){const d=await load();d.groups[String(chatId)]={chat_id:chatId,title,registered_at:Date.now()};await save()}
export async function isGroupRegistered(chatId){return !!(await load()).groups[String(chatId)]}
export async function setLock(chatId,type,v){const d=await load();d.locks[k(chatId,type)]={chat_id:chatId,lock_type:type,is_locked:v?1:0};await save()}
export async function isLocked(chatId,type){return (await load()).locks[k(chatId,type)]?.is_locked===1}
export async function getAllLocks(chatId){return Object.values((await load()).locks).filter(x=>String(x.chat_id)===String(chatId))}
export async function addToWhitelist(chatId,userId){const d=await load();d.whitelist[k(chatId,userId)]={chat_id:chatId,user_id:userId};await save()}
export async function removeFromWhitelist(chatId,userId){const d=await load();delete d.whitelist[k(chatId,userId)];await save()}
export async function clearWhitelist(chatId){const d=await load();for(const key of Object.keys(d.whitelist))if(key.startsWith(String(chatId)+':'))delete d.whitelist[key];await save()}
export async function isWhitelisted(chatId,userId){return !!(await load()).whitelist[k(chatId,userId)]}
export async function addWarning(chatId,userId){const d=await load(), key=k(chatId,userId), n=(d.warnings[key]?.count||0)+1;d.warnings[key]={chat_id:chatId,user_id:userId,count:n,last_warning_at:Date.now()};await save();return n}
export async function resetWarnings(chatId,userId){const d=await load();delete d.warnings[k(chatId,userId)];await save()}
export async function getWarning(chatId,userId){return (await load()).warnings[k(chatId,userId)]?.count||0}
export async function schedulePendingDeletion(chatId,messageId,delayMs){const d=await load();d.pending_deletions=d.pending_deletions.filter(x=>!(String(x.chat_id)===String(chatId)&&String(x.message_id)===String(messageId)));d.pending_deletions.push({chat_id:chatId,message_id:messageId,delete_at:Date.now()+delayMs});await save()}
export async function getExpiredDeletions(){return (await load()).pending_deletions.filter(x=>x.delete_at<=Date.now())}
export async function removePendingDeletion(chatId,messageId){const d=await load();d.pending_deletions=d.pending_deletions.filter(x=>!(String(x.chat_id)===String(chatId)&&String(x.message_id)===String(messageId)));await save()}
export async function getSetting(chatId,key,def=null){return (await load()).settings[k(chatId,key)]?.value ?? def}
export async function setSetting(chatId,key,value){const d=await load();d.settings[k(chatId,key)]={chat_id:chatId,key,value,updated_at:Date.now()};await save()}
export async function addFilter(chatId,word){const d=await load();d.filters[k(chatId,word.toLowerCase())]={chat_id:chatId,word};await save()}
export async function removeFilter(chatId,word){const d=await load();delete d.filters[k(chatId,word.toLowerCase())];await save()}
export async function listFilters(chatId){return Object.values((await load()).filters).filter(x=>String(x.chat_id)===String(chatId)).map(x=>x.word)}
export async function incStat(chatId,userId,key,amount=1){const d=await load(),id=k(chatId,userId);d.stats[id]??={};d.stats[id][key]=(d.stats[id][key]||0)+amount;await save();return d.stats[id][key]}
export async function getStat(chatId,userId,key){return (await load()).stats[k(chatId,userId)]?.[key]||0}
export async function saveMessageHash(chatId,hash,ts){const d=await load(),id=String(chatId);d.messages[id]??=[];d.messages[id].push({hash,ts});d.messages[id]=d.messages[id].filter(x=>ts-x.ts<=86400000).slice(-500);await save()}
export async function countMessageHash(chatId,hash,windowMs){const d=await load(),arr=d.messages[String(chatId)]||[],now=Date.now();return arr.filter(x=>x.hash===hash&&now-x.ts<=windowMs).length}
export async function createBusiness(userId,data){const d=await load(); const id=`B${Date.now()}${Math.floor(Math.random()*1000)}`; d.businesses[id]={id,user_id:userId,status:'pending',created_at:Date.now(),...data}; await save(); return d.businesses[id]}
export async function updateBusiness(id,patch){const d=await load(); if(!d.businesses[id]) return null; d.businesses[id]={...d.businesses[id],...patch,updated_at:Date.now()}; await save(); return d.businesses[id]}
export async function getBusiness(id){return (await load()).businesses[id]||null}
export async function getPendingBusinesses(){return Object.values((await load()).businesses).filter(x=>x.status==='pending')}
export async function setUserState(userId,state){const d=await load(); if(state===null) delete d.user_states[String(userId)]; else d.user_states[String(userId)]=state; await save()}
export async function getUserState(userId){return (await load()).user_states[String(userId)]||null}
