import {setLock,getAllLocks,addToWhitelist,removeFromWhitelist,clearWhitelist,resetWarnings,setSetting,getSetting,addFilter,removeFilter,listFilters,incStat,getStat,registerGroup} from './db.js';
import {sendMessage,deleteMessage,isAdmin,banChatMember,restrictChatMember,unbanChatMember,getChat,getChatAdministrators,getChatMember,setChatPermissions} from './telegram.js';
import {LOCK_LABELS} from './filters.js';
const MAP={'لینک':'link','آیدی':'id','منشن':'id','سایت':'site','مستهجن':'obscene','هشتگ':'hashtag','متن':'text','فوروارد':'forward','فوروارد از کانال':'forward_channel','عکس':'photo','فیلم':'video','استیکر':'sticker','لوکیشن':'location','شماره تلفن':'phone','صدای ضبط شده':'voice','فایل':'file','نرم افزار':'software','گیف':'gif','نظرسنجی':'poll','اسلش':'slash','بدون متن':'no_text','ایموجی خالی':'emoji_empty','ایموجی':'emoji','گیم':'game','انگلیسی':'english','فارسی و عربی':'persian_arabic','پاسخگویی':'reply','پاسخگویی به چتهای دیگر':'reply_other','گروه':'group','ورود و خروج':'joinleave'};
const punishmentWords=new Set(['حذف','اخراج','سایلنت','ساکت']);
function esc(s=''){return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}
function replyUser(m){return m.reply_to_message?.from?.id||null}
async function targetId(env,m){return replyUser(m)}
async function punish(env,m,userId,action,minutes=0){if(!userId)return;const c=m.chat.id;try{if(action==='حذف'){await deleteMessage(env,c,m.reply_to_message?.message_id||m.message_id)}else if(action==='اخراج'){await banChatMember(env,c,userId,minutes?{until_date:Math.floor(Date.now()/1000)+minutes*60}:{});await unbanChatMember(env,c,userId)}else if(action==='سایلنت'||action==='ساکت'){const until=minutes>=1000?0:Math.floor(Date.now()/1000)+(minutes||60)*60;const perms={can_send_messages:false,can_send_audios:false,can_send_documents:false,can_send_photos:false,can_send_videos:false,can_send_video_notes:false,can_send_voice_notes:false,can_send_polls:false,can_send_other_messages:false,can_add_web_page_previews:false};await restrictChatMember(env,c,userId,perms,until||undefined)}}catch(e){console.error('punish:',e.message)}}
export async function handleTextCommand(env,m){const raw=m.text?.trim();if(!raw||!['!','.'].includes(raw[0]))return false;const c=m.chat.id,u=m.from.id;if(!(await isAdmin(env,c,u))){await sendMessage(env,c,'⛔️ فقط مدیران گروه به دستورات مدیریتی دسترسی دارند.');return true}let body=raw.slice(1).trim();if(!body)return true;
 const lower=body.toLowerCase();
 if(lower==='فقط آگهی فعال'||lower==='فقط آگهی غیرفعال'){
   const enabled=lower.endsWith('فعال');
   await setSetting(c,'ad_only',enabled);
   if(enabled){
     await setSetting(c,'delete_joinleave',true);
     await setSetting(c,'welcome',false);
     await setChatPermissions(env,c,{can_send_messages:true,can_send_audios:false,can_send_documents:false,can_send_photos:true,can_send_videos:false,can_send_video_notes:false,can_send_voice_notes:false,can_send_polls:false,can_send_other_messages:false,can_add_web_page_previews:true}).catch(()=>{});
   } else {
     await setChatPermissions(env,c,{can_send_messages:true,can_send_audios:true,can_send_documents:true,can_send_photos:true,can_send_videos:true,can_send_video_notes:true,can_send_voice_notes:true,can_send_polls:true,can_send_other_messages:true,can_add_web_page_previews:true}).catch(()=>{});
   }
   await sendMessage(env,c,enabled?'✅ حالت فقط آگهی فعال شد. فقط متن تبلیغاتی یا عکس همراه متن تبلیغاتی برای اعضا مجاز است.':'🔓 حالت فقط آگهی غیرفعال شد.');
   return true;
 }
 if(lower==='آزاد') { const t=replyUser(m); if(!t){await sendMessage(env,c,'↩️ روی پیام کاربر ریپلای کن.');return true} await unbanChatMember(env,c,t); await restrictChatMember(env,c,t,{can_send_messages:true,can_send_audios:true,can_send_documents:true,can_send_photos:true,can_send_videos:true,can_send_video_notes:true,can_send_voice_notes:true,can_send_polls:true,can_send_other_messages:true,can_add_web_page_previews:true},undefined).catch(()=>{}); await sendMessage(env,c,'🔓 کاربر آزاد شد.'); return true }
 let manual=lower.match(/^(اخراج|ساکت)\s+(\d+)$/); if(manual){const t=replyUser(m);if(!t){await sendMessage(env,c,'↩️ روی پیام کاربر ریپلای کن.');return true}const mins=Number(manual[2]); if(manual[1]==='اخراج'){await banChatMember(env,c,t,mins>=1000?{}:{until_date:Math.floor(Date.now()/1000)+mins*60});await sendMessage(env,c,mins>=1000?'⛔️ کاربر دائمی اخراج شد.':`⛔️ کاربر به مدت ${mins} دقیقه اخراج شد.`)}else{const until=mins>=1000?undefined:Math.floor(Date.now()/1000)+mins*60;await restrictChatMember(env,c,t,{can_send_messages:false,can_send_audios:false,can_send_documents:false,can_send_photos:false,can_send_videos:false,can_send_video_notes:false,can_send_voice_notes:false,can_send_polls:false,can_send_other_messages:false,can_add_web_page_previews:false},until);await sendMessage(env,c,mins>=1000?'🔇 کاربر دائمی ساکت شد.':`🔇 کاربر ${mins} دقیقه ساکت شد.`)}return true}

 if(lower==='پیکربندی'){const admins=await getChatAdministrators(env,c);await sendMessage(env,c,`⚙️ مدیران شناسایی شدند: <b>${admins.result?.length||0}</b>`);return true}
 if(lower==='حذف کل لیست سفید'){await clearWhitelist(c);await sendMessage(env,c,'✅ لیست سفید پاک شد.');return true}
 if(lower==='اضافه به لیست سفید'||lower==='حذف از لیست سفید'){const t=await targetId(env,m);if(!t){await sendMessage(env,c,'↩️ این دستور را روی پیام کاربر ریپلای کن.');return true}if(lower.startsWith('اضافه'))await addToWhitelist(c,t);else await removeFromWhitelist(c,t);await sendMessage(env,c,lower.startsWith('اضافه')?'✅ کاربر به لیست سفید اضافه شد.':'✅ کاربر از لیست سفید حذف شد.');return true}
 if(lower==='ریست'){const t=await targetId(env,m);if(!t){await sendMessage(env,c,'↩️ روی پیام کاربر ریپلای کن.');return true}await resetWarnings(c,t);await sendMessage(env,c,'✅ هشدارهای کاربر ریست شد.');return true}
 if(lower==='شارژ'){await sendMessage(env,c,'💳 برای تمدید اعتبار، این بخش در نسخه فعلی باید به پنل/درگاه متصل شود.');return true}
 if(lower==='اعتبار'){const until=await getSetting(c,'expiry','نامحدود');await sendMessage(env,c,`⏳ اعتبار ربات: <b>${esc(until)}</b>`);return true}
 if(lower==='لینک قفل'||lower==='لینک آزاد'){await setLock(c,'link',lower.endsWith('قفل'));await sendMessage(env,c,lower.endsWith('قفل')?'🔒 لینک تلگرام قفل شد.':'🔓 لینک تلگرام آزاد شد.');return true}
 let match=body.match(/^(.*?)\s+(قفل|آزاد)(?:\s+از ساعت\s+([0-9:]+)\s+تا\s+([0-9:]+))?$/);if(match){const label=match[1].trim(),act=match[2],type=MAP[label];if(type){await setLock(c,type,act==='قفل');if(match[3])await setSetting(c,`schedule:${type}`,{from:match[3],to:match[4],enabled:act==='قفل'});await sendMessage(env,c,act==='قفل'?`🔒 ${esc(LOCK_LABELS[type]||label)} قفل شد.`:`🔓 ${esc(LOCK_LABELS[type]||label)} آزاد شد.`);return true}}
 match=body.match(/^(.*?)\s+(اخراج|حذف|سایلنت|ساکت)$/);if(match&&MAP[match[1]]){await setSetting(c,`punish:${MAP[match[1]]}`,match[2]);await sendMessage(env,c,`⚖️ مجازات «${esc(LOCK_LABELS[MAP[match[1]]]||match[1])}» روی «${match[2]}» تنظیم شد.`);return true}
 match=body.match(/^محدودیت تعداد پیام\s+(\d+|غیرفعال)$/);if(match){await setSetting(c,'rate_limit',match[1]==='غیرفعال'?0:Number(match[1]));await sendMessage(env,c,`✅ محدودیت تعداد پیام: ${match[1]}`);return true}
 match=body.match(/^درهر\s+(\d+)\s*(دقیقه|ساعت|روز)/);if(match){const n=Number(match[1])*({دقیقه:60000,ساعت:3600000,روز:86400000}[match[2]]);await setSetting(c,'rate_window',n);await sendMessage(env,c,'✅ بازه شمارش پیام تنظیم شد.');return true}
 match=body.match(/^تکراری(?: در هر)?\s+(\d+|غیرفعال)\s*(دقیقه|ساعت|روز)?$/);if(match){await setSetting(c,'duplicate_limit',match[1]==='غیرفعال'?0:Number(match[1]));if(match[2])await setSetting(c,'duplicate_window',{دقیقه:60000,ساعت:3600000,روز:86400000}[match[2]]);await sendMessage(env,c,'✅ تنظیم تکراری ذخیره شد.');return true}
 match=body.match(/^حداقل تعداد کلمات\s+(\d+|غیرفعال)$/);if(match){await setSetting(c,'min_words',match[1]==='غیرفعال'?0:Number(match[1]));await sendMessage(env,c,'✅ حداقل کلمات تنظیم شد.');return true}
 match=body.match(/^حداکثر تعداد کلمات\s+(\d+|غیرفعال)$/);if(match){await setSetting(c,'max_words',match[1]==='غیرفعال'?0:Number(match[1]));await sendMessage(env,c,'✅ حداکثر کلمات تنظیم شد.');return true}
 match=body.match(/^فیلتر\s+(.+)$/);if(match){await addFilter(c,match[1].trim());await sendMessage(env,c,`✅ «${esc(match[1].trim())}» فیلتر شد.`);return true}
 match=body.match(/^آنفیلتر\s+(.+)$/);if(match){await removeFilter(c,match[1].trim());await sendMessage(env,c,'✅ کلمه از فیلتر حذف شد.');return true}
 if(lower==='لیست فیلتر'){const a=await listFilters(c);await sendMessage(env,c,a.length?`🚫 کلمات فیلترشده:\n${a.map(esc).join('\n')}`:'لیست فیلتر خالی است.');return true}
 match=body.match(/^اداجباری\s+(\d+|غیرفعال)$/);if(match){await setSetting(c,'add_required',match[1]==='غیرفعال'?0:Number(match[1]));await sendMessage(env,c,'✅ اد اجباری تنظیم شد.');return true}
 if(lower==='اداجباری معاف همه'||lower==='اداجباری فعال همه'){await setSetting(c,'add_required_old_exempt',lower.includes('معاف'));await sendMessage(env,c,'✅ تنظیم اد اجباری به‌روزرسانی شد.');return true}
 match=body.match(/^join\s+(@[\w_]+)$/i);if(match){await setSetting(c,'join_channel',match[1]);await sendMessage(env,c,`📢 عضویت اجباری روی ${esc(match[1])} فعال شد.`);return true}
 if(lower==='کانال غیرفعال'){await setSetting(c,'join_channel','');await sendMessage(env,c,'🔓 عضویت اجباری کانال غیرفعال شد.');return true}
 if(lower==='ربات قفل'||lower==='ربات آزاد'){await setSetting(c,'bot_lock',lower.endsWith('قفل'));await sendMessage(env,c,lower.endsWith('قفل')?'🤖 قفل ربات فعال شد.':'🤖 قفل ربات غیرفعال شد.');return true}
 if(lower==='تبچی اخراج'||lower==='تبچی سایلنت'||lower==='تبچی آزاد'){await setSetting(c,'tabchi_action',lower==='تبچی آزاد'?'none':lower.split(' ')[1]);await sendMessage(env,c,'✅ تنظیم تبچی ذخیره شد.');return true}
 match=body.match(/^خاموشی (اول|دوم|سوم) از ساعت ([0-9:]+) تا ([0-9:]+)$/);if(match){await setSetting(c,`quiet:${match[1]}`,{from:match[2],to:match[3]});await sendMessage(env,c,'🌙 ساعت خاموشی ذخیره شد.');return true}
 match=body.match(/^خاموشی (اول|دوم|سوم) غیرفعال$/);if(match){await setSetting(c,`quiet:${match[1]}`,null);await sendMessage(env,c,'🌙 ساعت خاموشی غیرفعال شد.');return true}
 if(lower==='گروه قفل'||lower==='گروه آزاد'){await setLock(c,'group',lower.endsWith('قفل'));await sendMessage(env,c,lower.endsWith('قفل')?'🔒 گروه قفل شد.':'🔓 گروه آزاد شد.');return true}
 if(lower==='فعال خوش'||lower==='غیرفعال خوش'){await setSetting(c,'welcome',lower==='فعال خوش');await sendMessage(env,c,'👋 تنظیم خوش‌آمد ذخیره شد.');return true}
 if(lower==='فعال قوانین'||lower==='غیرفعال قوانین'){await setSetting(c,'rules',lower==='فعال قوانین');await sendMessage(env,c,'📜 تنظیم قوانین ذخیره شد.');return true}
 if(lower==='تذکر فعال'||lower==='تذکر غیرفعال'){await setSetting(c,'notice',lower.endsWith('فعال'));await sendMessage(env,c,'🔔 تنظیم تذکر ذخیره شد.');return true}
 if(lower==='اخطار خودکار فعال'||lower==='اخطار خودکار غیرفعال'){await setSetting(c,'auto_warning',lower.endsWith('فعال'));await sendMessage(env,c,'⚠️ اخطار خودکار تنظیم شد.');return true}
 match=body.match(/^زمان نگه داری اخطار\s+(\d+)$/);if(match){await setSetting(c,'warning_days',Number(match[1]));await sendMessage(env,c,'✅ زمان نگهداری اخطار ذخیره شد.');return true}
 match=body.match(/^حداکثر اخطارها\s+(\d+)$/);if(match){await setSetting(c,'warning_max',Number(match[1]));await sendMessage(env,c,'✅ سقف اخطار تنظیم شد.');return true}
 if(lower==='دستورات عمومی قفل'||lower==='دستورات عمومی آزاد'){await setSetting(c,'public_commands',lower.endsWith('آزاد'));await sendMessage(env,c,'✅ دستورات عمومی تنظیم شد.');return true}
 if(lower==='مدیران قفل'||lower==='مدیران آزاد'){await setSetting(c,'admin_rules',lower.endsWith('قفل'));await sendMessage(env,c,'✅ محاسبه تخلفات مدیران تنظیم شد.');return true}
 if(lower==='ورود و خروج را حذف کن'||lower==='ورود و خروج را ازاد کن'){await setSetting(c,'delete_joinleave',lower.includes('حذف'));await sendMessage(env,c,'✅ تنظیم ورود و خروج ذخیره شد.');return true}
 if(lower==='حذف خودکار پیام فعال'||lower==='حذف خودکار پیام غیرفعال'){await setSetting(c,'auto_delete_bot',lower.endsWith('فعال'));await sendMessage(env,c,'✅ حذف خودکار پیام ربات تنظیم شد.');return true}
 match=body.match(/^زمان حذف خودکار\s+(\d+)$/);if(match){await setSetting(c,'auto_delete_seconds',Number(match[1])*60*1000);await sendMessage(env,c,'✅ زمان حذف خودکار تنظیم شد.');return true}
 if(lower==='پاکسازی رباتها'){await sendMessage(env,c,'ℹ️ پاکسازی ربات‌ها از طریق رویداد عضویت انجام می‌شود.');return true}
 if(lower.startsWith('پاکسازی ')){await sendMessage(env,c,'🧹 برای پاکسازی گسترده، ربات باید مدیر گروه با دسترسی حذف پیام باشد. این قابلیت در نسخه بعدی با تاریخچه تلگرام تکمیل می‌شود.');return true}
 if(lower==='کیا بیشتر از همه اد کردند؟'||lower.match(/^در .+ گذشته کیا بیشتر از همه اد کردند\؟$/)){await sendMessage(env,c,'📊 آمار دعوت در این نسخه برای رویدادهای قابل مشاهده تلگرام ثبت می‌شود.');return true}
 return false}
export async function handleSlashCommand(env,m){const t=m.text?.trim();if(!t?.startsWith('/'))return false;const c=m.chat.id,u=m.from.id,cmd=t.split(/\s+/)[0].split('@')[0];if(cmd==='/start'){await sendMessage(env,c,'🤖 <b>مبصر شیپورک</b>\n\nبرای راهنما /help را بفرست.\nتنظیمات گروه با ! یا . انجام می‌شود.');return true}if(cmd==='/help'){await sendMessage(env,c,'📚 راهنمای سریع:\n!لینک قفل / !لینک آزاد\n!عکس قفل / !عکس آزاد\n!فوروارد حذف\n!اضافه به لیست سفید (ریپلای)\n!ریست (ریپلای)\n!فیلتر کلمه\n!لیست فیلتر\n!محدودیت تعداد پیام 5\n!حداقل تعداد کلمات 3\n!پیکربندی\n\nدستورات عمومی: لینک گروه را بفرست، گزارش، اطلاعات');return true}if(cmd==='/id'){await sendMessage(env,c,`🆔 چت: <code>${c}</code>\n🆔 کاربر: <code>${u}</code>`);return true}
if(cmd==='/ثبت'){if(m.chat.type==='private'){await sendMessage(env,c,'⚠️ این دستور فقط داخل گروه کاربرد دارد.');return true}if(!(await isAdmin(env,c,u))){await sendMessage(env,c,'⛔️ فقط مدیران گروه می‌توانند گروه را ثبت کنند.');return true}await registerGroup(c,m.chat.title||'');await sendMessage(env,c,'✅ گروه با موفقیت در ربات ثبت شد.');return true}
if(cmd==='/قفلها'){if(m.chat.type==='private'){await sendMessage(env,c,'⚠️ این دستور فقط داخل گروه کاربرد دارد.');return true}const locks=(await getAllLocks(c)).filter(x=>x.is_locked===1);await sendMessage(env,c,locks.length?`🔒 قفل‌های فعال این گروه:\n${locks.map(x=>'• '+esc(LOCK_LABELS[x.lock_type]||x.lock_type)).join('\n')}`:'🔓 در حال حاضر هیچ قفلی در این گروه فعال نیست.');return true}
return false}
export async function handleCallback(){return false}
