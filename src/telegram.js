const API='https://api.telegram.org/bot';
async function call(env,method,payload={}){const r=await fetch(`${API}${env.BOT_TOKEN}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const d=await r.json();if(!d.ok)throw new Error(d.description||method+' failed');return d}
export const sendMessage=(e,c,t,o={})=>call(e,'sendMessage',{chat_id:c,text:t,parse_mode:'HTML',...o});
export const sendPhoto=(e,c,p,o={})=>call(e,'sendPhoto',{chat_id:c,photo:p,parse_mode:'HTML',...o});
export const deleteMessage=(e,c,m)=>call(e,'deleteMessage',{chat_id:c,message_id:m});
export const getChatMember=(e,c,u)=>call(e,'getChatMember',{chat_id:c,user_id:u});
export const getChat=(e,c)=>call(e,'getChat',{chat_id:c});
export const getChatAdministrators=(e,c)=>call(e,'getChatAdministrators',{chat_id:c});
export const banChatMember=(e,c,u,d={})=>call(e,'banChatMember',{chat_id:c,user_id:u,...d});
export const unbanChatMember=(e,c,u)=>call(e,'unbanChatMember',{chat_id:c,user_id:u,only_if_banned:true});
export const restrictChatMember=(e,c,u,permissions,until_date)=>call(e,'restrictChatMember',{chat_id:c,user_id:u,permissions,until_date});
export const getMe=e=>call(e,'getMe');
export const deleteWebhook=e=>call(e,'deleteWebhook',{drop_pending_updates:false});
export const getUpdates=(e,o)=>call(e,'getUpdates',{offset:o,timeout:25,allowed_updates:['message','callback_query','my_chat_member','chat_member']});
export const answerCallbackQuery=(e,id,t='')=>call(e,'answerCallbackQuery',{callback_query_id:id,text:t});
export const editMessageText=(e,c,m,t,o={})=>call(e,'editMessageText',{chat_id:c,message_id:m,text:t,parse_mode:'HTML',...o});

export const isAdmin=async(e,c,u)=>{const r=await getChatMember(e,c,u);return ['administrator','creator'].includes(r.result?.status)};
export const setChatPermissions=(e,c,p)=>call(e,'setChatPermissions',{chat_id:c,permissions:p});
