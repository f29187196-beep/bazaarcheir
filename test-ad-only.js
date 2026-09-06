import {isAllowedAdMessage} from './src/filters.js';
const base={chat:{id:-100},from:{id:42}};
const cases=[
  ['متن تبلیغاتی', {...base,text:'فروش خودرو، تماس 09120000000'} ,true],
  ['عکس+متن', {...base,photo:[{file_unique_id:'p'}],caption:'فروش آپارتمان، تماس 09120000000'},true],
  ['فقط عکس', {...base,photo:[{file_unique_id:'p'}]},false],
  ['متن بدون لینک', {...base,text:'اجاره مغازه ۴۰ متری، تماس تلفنی'},true],
  ['ویدئو', {...base,video:{file_unique_id:'v'},caption:'تبلیغ'},false],
  ['فوروارد متنی', {...base,forward_from_chat:{id:-200},text:'تبلیغ'},true],
  ['فوروارد عکس+متن', {...base,forward_from_chat:{id:-200},photo:[{file_unique_id:'fp'}],caption:'تبلیغ'},true],
  ['استیکر', {...base,sticker:{file_unique_id:'s'}},false],
  ['نظرسنجی', {...base,poll:{id:'p'},question:'نظر؟'},false],
  ['ریپلای', {...base,text:'تبلیغ',reply_to_message:{from:{id:9},chat:{id:-100}}},false],
  ['آلبوم', {...base,photo:[{file_unique_id:'p'}],caption:'تبلیغ',media_group_id:'g1'},false],
  ['فایل', {...base,document:{file_unique_id:'d'},caption:'تبلیغ'},false],
  ['پیام صوتی', {...base,voice:{file_unique_id:'v'}},false],
];
for(const [name,m,expected] of cases){const got=isAllowedAdMessage(m);if(got!==expected)throw new Error(`${name}: expected ${expected}, got ${got}`)}
console.log(`✅ تست حالت فقط آگهی: ${cases.length} سناریو موفق`);
