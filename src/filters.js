import {isLocked,getSetting,listFilters} from './db.js';
import {getChatMember} from './telegram.js';
const URL=/(https?:\/\/|www\.|t\.me\/|telegram\.me\/)/i;
const PHONE=/(?:\+?98|0)?9\d{9}|(?:\+?\d[\d\s-]{7,}\d)/;
const EMOJI=/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+$/u;
const PERSIAN=/[\u0600-\u06FF]/u, ENGLISH=/[A-Za-z]/u;
const BAD=['sex','porn','fuck','سکس','پورن','فحش'];
function textOf(m){return [m.text,m.caption].filter(Boolean).join(' ')}
async function detect(env,chatId,m){const t=textOf(m),types=[];if(m.forward_from||m.forward_from_chat){types.push('forward');if(m.forward_from_chat?.type==='channel')types.push('forward_channel')}if(m.photo)types.push('photo');if(m.video)types.push('video');if(m.video_note)types.push('video');if(m.voice)types.push('voice');if(m.document){types.push('file');if((m.document.file_name||'').match(/\.(apk|exe|msi|ipa|xapk)$/i))types.push('software')}if(m.animation)types.push('gif');if(m.game)types.push('game');if(m.sticker)types.push('sticker');if(m.location||m.venue)types.push('location');if(m.contact||PHONE.test(t))types.push('phone');if(m.poll)types.push('poll');if(m.text||m.caption)types.push('text');if(URL.test(t)){types.push('site');if(/(?:t\.me\/|telegram\.me\/|@[\w_]+)/i.test(t))types.push('link')}if(/@[\w_]{3,}/.test(t))types.push('id');if(/#[\p{L}\d_]+/u.test(t))types.push('hashtag');if(m.text?.startsWith('/'))types.push('slash');if(EMOJI.test(t))types.push('emoji_empty');if(/[\p{Extended_Pictographic}]/u.test(t))types.push('emoji');if(ENGLISH.test(t))types.push('english');if(PERSIAN.test(t))types.push('persian_arabic');if((m.photo||m.video||m.animation)&&!m.caption)types.push('no_text');if(m.reply_to_message){if(m.reply_to_message.chat?.id!==m.chat?.id)types.push('reply_other');else {try{const cm=await getChatMember(env,chatId,m.reply_to_message.from.id);if(!['administrator','creator'].includes(cm.result?.status))types.push('reply')}catch{}}}types.push('group');if(BAD.some(x=>t.toLowerCase().includes(x)))types.push('obscene');return [...new Set(types)]}
export const LOCK_LABELS={link:'لینک تلگرام',id:'آیدی',site:'سایت',obscene:'مستهجن',hashtag:'هشتگ',text:'متن',forward:'فوروارد',forward_channel:'فوروارد از کانال',photo:'عکس',video:'فیلم',sticker:'استیکر',location:'لوکیشن',phone:'شماره تلفن',voice:'صدای ضبط شده',file:'فایل',software:'نرم افزار',gif:'گیف',poll:'نظرسنجی',slash:'اسلش کامند',no_text:'بدون متن',emoji_empty:'ایموجی خالی',emoji:'ایموجی',game:'گیم',english:'انگلیسی',persian_arabic:'فارسی و عربی',reply:'پاسخگویی',reply_other:'پاسخگویی به چتهای دیگر',group:'گروه'};

const AD_WORDS=[
  'فروش','فروشی','خرید','خریدار','قیمت','تومان','تخفیف','موجود',
  'آگهی','عرضه','سفارش','فروشگاه','فروشنده','خدمات','ارائه',
  'اجاره','رهن','منزل','آپارتمان','ویلا','زمین','خودرو','ماشین',
  'موتور','موبایل','گوشی','لپ تاپ','لپ‌تاپ','کالا','محصول',
  'دست دوم','دست‌دوم','کارکرده','نو','سالم','معاوضه','ارسال',
  'تحویل','تماس','شماره تماس','واتساپ','تلگرام','رزرو',
  'ثبت سفارش','مشاوره','استخدام','همکاری','نمایندگی','تولید','پخش'
];

const CHAT_WORDS=[
  'سلام','درود','ممنون','مرسی','تشکر','سپاس','خواهش می کنم',
  'خواهش می‌کنم','خوبی','چطوری','چه خبر','باشه','اوکی','بله',
  'خیر','نه','چی','کجایی','هستم','جواب بده','لطفا','لطفاً'
];

function looksLikeAd(t){
  const s=t.trim().toLowerCase();
  if(!s)return false;

  if(CHAT_WORDS.some(x=>s===x || s.startsWith(x+' ') || s.endsWith(' '+x)))return false;

  const hasAdWord=AD_WORDS.some(x=>s.includes(x));
  const hasPhone=PHONE.test(s);
  const hasPrice=/(\d[\d,.\s]*(?:تومان|هزار|میلیون|میلیارد|ریال)|(?:تومان|ریال)\s*\d)/i.test(s);
  const hasUrl=URL.test(s);

  return hasAdWord || hasPrice || (hasPhone && s.split(/\s+/).length>=4) || (hasUrl && s.split(/\s+/).length>=4);
}

export function isAllowedAdMessage(m){
  const t=textOf(m).trim();
  if(!t)return false;
  if(m.video||m.video_note||m.voice||m.document||m.animation||m.sticker||m.poll||m.location||m.venue||m.contact||m.game)return false;
  if(m.reply_to_message||m.media_group_id)return false;
  // تبلیغ مجاز: متن تنها، یا یک عکس همراه با کپشن/متن. فوروارد هم مجاز است.
  if(m.photo){
    // آلبوم/چندعکس در پیام واحد تلگرام از طریق media_group_id مشخص می‌شود؛
    // برای تمیزی گروه آن را به عنوان پست مجاز نگه می‌داریم تا هر عکس با کپشن بررسی شود.
    if(!m.caption?.trim()) return false;
    return m.forward_from || m.forward_from_chat
      ? true
      : looksLikeAd(m.caption);
  }

  if(m.forward_from || m.forward_from_chat){
    return !!m.text?.trim();
  }

  return !!m.text?.trim() && looksLikeAd(m.text);
}

export async function checkMessage(env,chatId,m){const t=textOf(m),types=await detect(env,chatId,m);const custom=await listFilters(chatId);if(custom.some(w=>t.toLowerCase().includes(w.toLowerCase())))return 'filter';for(const type of types)if(await isLocked(chatId,type))return type;const min=await getSetting(chatId,'min_words',0),max=await getSetting(chatId,'max_words',0);const wc=t.trim()?t.trim().split(/\s+/).length:0;if(min&&wc<min)return 'min_words';if(max&&wc>max)return 'max_words';return null}
export function messageHash(m){const t=textOf(m);if(t)return t.replace(/\s+/g,' ').trim().toLowerCase();const media=m.photo?.[m.photo.length-1]||m.video||m.document||m.animation||m.sticker||m.voice||m.video_note;return media?.file_unique_id?`media:${media.file_unique_id}`:''}
