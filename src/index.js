import crypto from 'node:crypto';
import {checkMessage,messageHash,LOCK_LABELS,isAllowedAdMessage} from './filters.js';
import {sendMessage,deleteMessage,isAdmin,getChatMember,banChatMember,unbanChatMember,restrictChatMember} from './telegram.js';
import {selectBackend,addWarning,isWhitelisted,schedulePendingDeletion,getExpiredDeletions,removePendingDeletion,getUserState,getSetting,setSetting,incStat,countMessageHash,saveMessageHash} from './db.js';
import {handleTextCommand,handleSlashCommand} from './commands.js';
const DEFAULT_PERMS={can_send_messages:true,can_send_audios:true,can_send_documents:true,can_send_photos:true,can_send_videos:true,can_send_video_notes:true,can_send_voice_notes:true,can_send_polls:true,can_send_other_messages:true,can_add_web_page_previews:true};
const AD_ONLY_PERMS={can_send_messages:true,can_send_audios:false,can_send_documents:false,can_send_photos:true,can_send_videos:false,can_send_video_notes:false,can_send_voice_notes:false,can_send_polls:false,can_send_other_messages:false,can_add_web_page_previews:true};
function text(m){return [m.text,m.caption].filter(Boolean).join(' ')}
function esc(s=''){return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}
async function punishment(env,m,type){const action=await getSetting(m.chat.id,`punish:${type}`,'حذف');const u=m.from.id;try{if(action==='اخراج'){await banChatMember(env,m.chat.id,u);await unbanChatMember(env,m.chat.id,u);}else if(action==='سایلنت'||action==='ساکت'){const minutes=Number(await getSetting(m.chat.id,`mute:${type}`,60));await restrictChatMember(env,m.chat.id,u,{...DEFAULT_PERMS,can_send_messages:false},Math.floor(Date.now()/1000)+minutes*60)}else await deleteMessage(env,m.chat.id,m.message_id)}catch(e){console.error('⚠️ مجازات:',e.message)}}
async function joinRequired(env,m){const channel=await getSetting(m.chat.id,'join_channel','');if(!channel)return false;try{const cm=await getChatMember(env,channel,m.from.id);if(['member','administrator','creator'].includes(cm.result.status))return false}catch{}await deleteMessage(env,m.chat.id,m.message_id).catch(()=>{});await sendMessage(env,m.chat.id,`⛔️ ${esc(m.from.first_name||'کاربر')} عزیز، ابتدا در ${esc(channel)} عضو شوید و سپس پیام ارسال کنید.`).catch(()=>{});return true}
async function rateLimited(env,m){const c=m.chat.id,u=m.from.id;const lim=Number(await getSetting(c,'rate_limit',0));if(!lim)return false;const windowMs=Number(await getSetting(c,'rate_window',3600000));const key=`rate:${c}:${u}`;const now=Date.now();let arr=globalThis.__rates?.get(key)||[];arr=arr.filter(x=>now-x<windowMs);arr.push(now);globalThis.__rates??=new Map();globalThis.__rates.set(key,arr);return arr.length>lim}
async function duplicateLimited(m){const c=m.chat.id,limit=Number(await getSetting(c,'duplicate_limit',0));if(!limit)return false;const hash=crypto.createHash('sha1').update(messageHash(m)).digest('hex');const win=Number(await getSetting(c,'duplicate_window',3600000));const n=await countMessageHash(c,hash,win);await saveMessageHash(c,hash,Date.now());return n>=limit}
async function publicCommand(env,m){const t=text(m).trim().toLowerCase();const enabled=await getSetting(m.chat.id,'public_commands',true);if(!enabled)return false;if(t==='لینک گروه را بفرست'){await sendMessage(env,m.chat.id,'🔗 لینک گروه: در صورت عمومی بودن گروه قابل دریافت است.');return true}if(t==='این گروه برای چیه؟'){await sendMessage(env,m.chat.id,'ℹ️ این گروه برای خرید، فروش و معرفی آگهی‌هاست.');return true}if(t==='گزارش'){await sendMessage(env,m.chat.id,'🚨 گزارش شما برای مدیران ثبت شد.');return true}if(t==='پیام من چرا حذف شد؟'){await sendMessage(env,m.chat.id,'ℹ️ اگر پیام شما حذف شده، احتمالاً یکی از قوانین فعال گروه را نقض کرده است.');return true}return false}
export async function processPendingDeletions(env){selectBackend(env);for(const x of await getExpiredDeletions()){try{await deleteMessage(env,x.chat_id,x.message_id)}catch{}await removePendingDeletion(x.chat_id,x.message_id)}}
export async function handleUpdate(env,u){
 selectBackend(env);
 if(u.my_chat_member){const cm=u.my_chat_member;if(cm.new_chat_member?.user?.is_bot){const lock=await getSetting(cm.chat.id,'bot_lock',false);if(lock&&cm.new_chat_member.status!=='left'&&cm.new_chat_member.status!=='kicked'){try{await banChatMember(env,cm.chat.id,cm.new_chat_member.user.id)}catch{}}}return}
 if(u.callback_query)return;
 const m=u.message||u.edited_message;if(!m?.from)return;console.log('📩 پیام دریافت شد:',m.chat?.id,m.message_id,m.text||m.caption||'[media]');const c=m.chat.id,uId=m.from.id;
 const adOnly=await getSetting(c,'ad_only',false);
 if(m.new_chat_members){
   for(const member of m.new_chat_members){
     if(member.is_bot&&await getSetting(c,'bot_lock',false)){await banChatMember(env,c,member.id).catch(()=>{})}
     if(!adOnly&&await getSetting(c,'welcome',false)){await sendMessage(env,c,`👋 به گروه خوش آمدی ${esc(member.first_name||'دوست عزیز')}!`).catch(()=>{})}
   }
   // در حالت فقط آگهی هیچ پیام خوش‌آمدی تولید نمی‌شود و پیام سرویس ورود حذف می‌شود.
   if(adOnly){await deleteMessage(env,c,m.message_id).catch(()=>{})}
   return
 }
 if(m.left_chat_member&&(adOnly||await getSetting(c,'delete_joinleave',false))){await deleteMessage(env,c,m.message_id).catch(e=>console.error('❌ حذف پیام:',e.message));return}
 if(m.chat.type==='private'){await handleSlashCommand(env,m);return}
 const admin=await isAdmin(env,c,uId);const adminRules=await getSetting(c,'admin_rules',false);
 // در حالت فقط آگهی، عضو عادی حتی نباید دستورات عمومی ربات را فعال کند؛ پیام غیرآگهی حذف می‌شود.
 if(adOnly && !admin && !(await isWhitelisted(c,uId))){
   if(!isAllowedAdMessage(m)){await deleteMessage(env,c,m.message_id).catch(e=>console.error('❌ حذف پیام:',e.message));return}
   return
 }
 if(m.text?.startsWith('/')&&await handleSlashCommand(env,m))return;
 if(m.text?.startsWith('!')||m.text?.startsWith('.')){const handled=await handleTextCommand(env,m);if(handled)return}
 if(await publicCommand(env,m))return;
 if((admin&&!adminRules)||await isWhitelisted(c,uId))return;
 if(await joinRequired(env,m))return;
 if(adOnly){
   if(!isAllowedAdMessage(m)){await deleteMessage(env,c,m.message_id).catch(e=>console.error('❌ حذف پیام:',e.message));return}
   return;
 }
 if(await rateLimited(env,m)){await punishment(env,m,'rate_limit');return}
 if(await duplicateLimited(m)){await punishment(env,m,'duplicate');return}
 const violation=await checkMessage(env,c,m);if(!violation)return;
 await punishment(env,m,violation);
 const autoWarn=await getSetting(c,'auto_warning',true);if(autoWarn){const n=await addWarning(c,uId);const max=Number(await getSetting(c,'warning_max',10));if(n>=max){await restrictChatMember(env,c,uId,{...DEFAULT_PERMS,can_send_messages:false},Math.floor(Date.now()/1000)+12*3600).catch(()=>{});}}
 if(await getSetting(c,'notice',true)){const label=LOCK_LABELS[violation]||violation;const w=await sendMessage(env,c,`⚠️ ${esc(m.from.first_name||'کاربر')} عزیز، پیام شما به دلیل «${esc(label)}» با قانون گروه مغایرت داشت.`).catch(()=>null);if(w?.result?.message_id&&await getSetting(c,'auto_delete_bot',false)){await schedulePendingDeletion(c,w.result.message_id,Number(await getSetting(c,'auto_delete_seconds',120000)))}}

}

// نقطه‌ی ورود Cloudflare Workers: wrangler.toml با main=src/index.js این export را به‌عنوان هندلر وب‌هوک/کرون استفاده می‌کند
export default {
 async fetch(request,env){
  selectBackend(env);
  if(request.method!=='POST')return new Response('🤖 مبصر شیپورک روشن است.');
  let update;
  try{update=await request.json()}catch{return new Response('bad request',{status:400})}
  try{await handleUpdate(env,update)}catch(e){console.error('⚠️ webhook:',e.message)}
  return new Response('OK');
 },
 async scheduled(_event,env){
  selectBackend(env);
  try{await processPendingDeletions(env)}catch(e){console.error('⚠️ cron:',e.message)}
 }
};
