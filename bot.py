import os
import re
import sqlite3
from datetime import datetime, timedelta, timezone

from telegram import Update, ChatPermissions, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.constants import ChatMemberStatus
from telegram.ext import (
    Application, CommandHandler, ContextTypes, MessageHandler,
    CallbackQueryHandler, filters
)

TOKEN = os.getenv("BOT_TOKEN", "").strip()
DB_FILE = "mobsar.db"

# ============================================================
# مبصر بازارچه IR - نسخه 2
# حالت هوشمند «فقط پست‌های مرتبط»
#
# تبلیغات عادی مجاز:
# عکس، ویدئو، متن طولانی، قیمت، شماره، لینک، هشتگ، ایموجی،
# فروش کالا، خدمات، استخدام، ملک، خودرو، آموزش، سفر و...
#
# ربات با «امتیاز ارتباط» کار می‌کند؛ یک کلمه به تنهایی باعث
# حذف آگهی نمی‌شود. برای حذف، چند نشانه نامرتبط/گفتگویی باید
# وجود داشته باشد یا پیام فاقد نشانه آگهی باشد.
# ============================================================

DEFAULTS = {
    "delete_service": 1,
    "smart_mode": 1,
    "anti_duplicate": 1,
    "filter_bad_words": 1,
    "link_lock": 0,
    "phone_lock": 0,
    "media_lock": 0,
    "max_warnings": 3,
}

# این فهرست عمداً محدود است؛ بعداً از پنل قابل توسعه است.
BAD_WORDS = {"فحش_نمونه_۱", "فحش_نمونه_۲"}

# نشانه‌های قوی/عمومی آگهی. وجود چند مورد، پیام را نجات می‌دهد.
AD_STRONG = {
    "فروش", "خرید", "اجاره", "رهن", "تهاتر", "قیمت", "تومان",
    "تخفیف", "فوری", "موجود", "سفارش", "ارسال", "تماس", "شماره",
    "خدمات", "سرویس", "تعمیر", "طراحی", "آموزش", "ثبت نام",
    "استخدام", "کارگر", "نیرو", "همکاری", "پروژه", "ویلا", "آپارتمان",
    "زمین", "باغ", "خانه", "ملک", "خودرو", "ماشین", "موتور",
    "لوازم", "لباس", "کفش", "موبایل", "لپتاپ", "کامپیوتر",
    "فروشگاه", "محصول", "کالا", "تولید", "پخش", "عمده", "خرده",
    "مشاوره", "تور", "سفر", "بلیط", "پرواز", "هتل", "مهاجرت",
    "تبلیغات", "ادمین", "اینستاگرام", "تلگرام", "واتساپ", "آموزشی",
}

AD_CATEGORIES = {
    "خودرو": {"خودرو","ماشین","سواری","کامیون","وانت","موتور","مدل","کارکرد"},
    "ملک": {"ملک","آپارتمان","اپارتمان","خانه","ویلا","زمین","باغ","مغازه","دفتر","رهن","اجاره"},
    "کالا": {"کالا","محصول","لوازم","لباس","کفش","کیف","موبایل","لپتاپ","هارد","تلویزیون","فروشگاه"},
    "خدمات": {"خدمات","تعمیر","طراحی","نصب","اجرا","ادمین","تبلیغات","باربری","نظافت","فنی"},
    "استخدام": {"استخدام","نیرو","کارگر","کارمند","همکاری","حقوق","دستمزد","شیفت"},
    "آموزش": {"آموزش","دوره","کلاس","استاد","دانشجو","زبان","آیلتس","آموزشی","ثبت نام"},
    "سفر": {"سفر","تور","بلیط","پرواز","هتل","مسافرت","ترانسفر"},
}

CHAT_WORDS = {
    "سلام","خوبی","خوبید","چه خبر","چطوری","مرسی","ممنون","خواهش میکنم",
    "لطفا","لطفاً","جواب بده","کجایی","هستی","کی هست","چرا","چی شد",
    "بگو","بگید","کمک","تست","تستش","اوکی","باشه","خوبه","عالیه",
    "میشه","میشود","میتونی","میتوانی","کسی هست","ادمین","مدیر گروه",
}

OFFTOPIC_PHRASES = {
    "صبح بخیر","شب بخیر","عصر بخیر","خسته نباشید","تبریک میگم",
    "تولدت مبارک","خوش آمدی","خوش اومدی","چه خبر بچه ها",
}

def db():
    c = sqlite3.connect(DB_FILE)
    c.row_factory = sqlite3.Row
    return c

def init_db():
    c = db()
    c.execute("""CREATE TABLE IF NOT EXISTS settings(
        chat_id INTEGER PRIMARY KEY,
        delete_service INTEGER DEFAULT 1,
        smart_mode INTEGER DEFAULT 1,
        anti_duplicate INTEGER DEFAULT 1,
        filter_bad_words INTEGER DEFAULT 1,
        link_lock INTEGER DEFAULT 0,
        phone_lock INTEGER DEFAULT 0,
        media_lock INTEGER DEFAULT 0,
        max_warnings INTEGER DEFAULT 3
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS warnings(
        chat_id INTEGER, user_id INTEGER, count INTEGER DEFAULT 0,
        PRIMARY KEY(chat_id,user_id)
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS recent(
        chat_id INTEGER, user_id INTEGER, text TEXT, created INTEGER
    )""")
    c.commit()
    c.close()

def ensure_settings(chat_id):
    c = db()
    c.execute("INSERT OR IGNORE INTO settings(chat_id) VALUES(?)", (chat_id,))
    c.commit()
    row = c.execute("SELECT * FROM settings WHERE chat_id=?", (chat_id,)).fetchone()
    c.close()
    return row

def setting(chat_id, name):
    return int(ensure_settings(chat_id)[name])

def set_setting(chat_id, name, value):
    c = db()
    c.execute(f"UPDATE settings SET {name}=? WHERE chat_id=?", (int(value), chat_id))
    c.commit()
    c.close()

async def is_admin(update, context):
    chat, user = update.effective_chat, update.effective_user
    if not chat or not user:
        return False
    try:
        m = await context.bot.get_chat_member(chat.id, user.id)
        return m.status in (ChatMemberStatus.ADMINISTRATOR, ChatMemberStatus.OWNER)
    except Exception:
        return False

async def bot_is_admin(update, context):
    try:
        me = await context.bot.get_me()
        m = await context.bot.get_chat_member(update.effective_chat.id, me.id)
        return m.status in (ChatMemberStatus.ADMINISTRATOR, ChatMemberStatus.OWNER)
    except Exception:
        return False

def norm(text):
    text = (text or "").lower()
    text = text.replace("ي","ی").replace("ك","ک").replace("\u200c"," ")
    text = re.sub(r"\s+", " ", text).strip()
    return text

def words(text):
    return set(re.findall(r"[\w\u0600-\u06ff@#.+-]+", norm(text)))

def ad_score(text, msg):
    t = norm(text)
    ws = words(t)
    score = 0
    reasons = []

    strong_hits = ws & AD_STRONG
    score += min(len(strong_hits), 5)
    if strong_hits:
        reasons.append("نشانه آگهی")

    category_hits = 0
    for vals in AD_CATEGORIES.values():
        if ws & vals:
            category_hits += 1
    score += min(category_hits, 3)

    # نشانه‌های تجاری بدون محدود کردن شماره/لینک
    if re.search(r"(?<!\d)(?:\+98|0098|0)?9\d{9}(?!\d)", t):
        score += 2
        reasons.append("شماره تماس")
    if re.search(r"(https?://|www\.|t\.me/|telegram\.me/|instagram\.com|wa\.me/)", t):
        score += 2
        reasons.append("لینک")
    if re.search(r"\b\d[\d,.\s]{2,}\s*(تومان|تومن|ریال|هزار|میلیون|میلیارد)?\b", t):
        score += 1
        reasons.append("عدد/قیمت")
    if "#" in t or "@" in t:
        score += 1
        reasons.append("هشتگ/شناسه")

    # رسانه همراه کپشن معمولاً آگهی است، ولی عکس خالی را خودکار قبول نمی‌کنیم.
    if (msg.photo or msg.document) and len(t) >= 12:
        score += 2
        reasons.append("رسانه + توضیح")

    return score, reasons

def offtopic_score(text):
    t = norm(text)
    score = 0
    hits = []
    for p in OFFTOPIC_PHRASES:
        if p in t:
            score += 2
            hits.append(p)
    for p in CHAT_WORDS:
        if p in t:
            score += 1
            hits.append(p)
    return score, hits

def should_delete_smart(msg):
    text = msg.text or msg.caption or ""
    t = norm(text)

    # دستورات و فرمان‌ها هیچ‌وقت پست محسوب نمی‌شوند.
    if t.startswith("/") or re.match(r"^[.!؟]\s*\S+", t):
        return True, "دستور/فرمان"

    # ریپلای گفتگو، مگر اینکه خودش آگهی مشخصی باشد، حذف می‌شود.
    ad, ar = ad_score(t, msg)
    off, oh = offtopic_score(t)

    if msg.reply_to_message and ad < 2:
        return True, "گفتگوی ریپلای‌شده"

    # پیام‌های خیلی کوتاه بدون نشانه تجاری، مثل «سلام»، «اوکی»، «ممنون»
    if len(t.split()) <= 4 and ad == 0:
        return True, "پیام کوتاه و بدون نشانه آگهی"

    # اگر چند نشانه گفتگویی/نامرتبط وجود داشته باشد و نشانه آگهی کافی نباشد.
    if off >= 3 and ad < 2:
        return True, "چند نشانه گفتگوی نامرتبط"

    # متن متوسط که هیچ نشانه تجاری ندارد و حالت مکالمه دارد.
    if len(t.split()) >= 5 and ad == 0 and off >= 2:
        return True, "محتوای غیرتبلیغاتی"

    # اگر متن بسیار طولانی ولی کاملاً بدون نشانه آگهی است، حذف نکن:
    # برای جلوگیری از حذف اشتباه، فقط در صورت وجود چند نشانه گفتگویی حذف می‌شود.
    return False, "پست مرتبط/قابل قبول"

async def delete_with_notice(update, context, reason):
    msg = update.effective_message
    user = update.effective_user
    if not msg:
        return
    try:
        await msg.delete()
    except Exception:
        return

    # برای اینکه گروه با پیام‌های ربات شلوغ نشود، اعلان حذف پیش‌فرض خاموش است.
    # فقط اخطار در دیتابیس ثبت می‌شود.

async def warn_user(update, context, reason):
    msg, user, chat = update.effective_message, update.effective_user, update.effective_chat
    if not msg or not user or await is_admin(update, context):
        return

    c = db()
    c.execute("""INSERT INTO warnings(chat_id,user_id,count) VALUES(?,?,1)
                 ON CONFLICT(chat_id,user_id) DO UPDATE SET count=count+1""",
              (chat.id, user.id))
    row = c.execute("SELECT count FROM warnings WHERE chat_id=? AND user_id=?",
                    (chat.id, user.id)).fetchone()
    c.commit(); c.close()

    try:
        await msg.delete()
    except Exception:
        pass

    count, max_w = row["count"], setting(chat.id, "max_warnings")
    if count >= max_w:
        try:
            until = datetime.now(timezone.utc) + timedelta(minutes=60)
            await context.bot.restrict_chat_member(
                chat.id, user.id,
                permissions=ChatPermissions(can_send_messages=False),
                until_date=until
            )
        except Exception:
            pass

async def moderate(update, context):
    msg = update.effective_message
    chat = update.effective_chat
    user = update.effective_user
    if not msg or not chat or not user or chat.type not in ("group","supergroup"):
        return
    if await is_admin(update, context):
        return

    # پیام‌های سرویس
    if setting(chat.id, "delete_service"):
        if msg.new_chat_members or msg.left_chat_member or msg.new_chat_title or msg.new_chat_photo:
            try: await msg.delete()
            except Exception: pass
            return

    # ویدئو همیشه ممنوع است؛ حتی اگر همراه متن آگهی باشد.
    if msg.video or msg.video_note:
        await warn_user(update, context, "ارسال ویدئو در بازارچه مجاز نیست")
        return

    # قفل‌های اختیاری
    text = norm(msg.text or msg.caption or "")
    if setting(chat.id, "media_lock") and (msg.photo or msg.video or msg.document or msg.animation or msg.sticker or msg.voice):
        await warn_user(update, context, "رسانه در حالت قفل")
        return
    if setting(chat.id, "link_lock") and re.search(r"(https?://|t\.me/|telegram\.me/|www\.)", text):
        await warn_user(update, context, "لینک در حالت قفل")
        return
    if setting(chat.id, "phone_lock") and re.search(r"(?<!\d)(?:\+98|0098|0)?9\d{9}(?!\d)", text):
        await warn_user(update, context, "شماره در حالت قفل")
        return

    # فیلتر کلمات
    if setting(chat.id, "filter_bad_words"):
        compact = text.replace(" ","")
        if any(w and w in compact for w in BAD_WORDS):
            await warn_user(update, context, "کلمه نامناسب")
            return

    # ضد تکرار
    if setting(chat.id, "anti_duplicate") and text:
        now = int(datetime.now(timezone.utc).timestamp())
        c = db()
        old = c.execute("""SELECT 1 FROM recent
                           WHERE chat_id=? AND user_id=? AND text=? AND created>?
                           LIMIT 1""",
                        (chat.id,user.id,text,now-90)).fetchone()
        c.execute("DELETE FROM recent WHERE created<?", (now-600,))
        c.execute("INSERT INTO recent VALUES(?,?,?,?)", (chat.id,user.id,text,now))
        c.commit(); c.close()
        if old:
            await warn_user(update, context, "پیام تکراری/اسپم")
            return

    # هوش محتوایی
    if setting(chat.id, "smart_mode"):
        delete, reason = should_delete_smart(msg)
        if delete:
            await delete_with_notice(update, context, reason)
            return

async def start(update, context):
    await update.message.reply_text(
        "🛡 مبصر بازارچه IR — نسخه ۲\n\n"
        "حالت هوشمند فعال است. پست‌های تبلیغاتی عادی مجازند و "
        "پیام‌های گفتگویی/نامرتبط شناسایی و حذف می‌شوند.\n\n"
        "پنل مدیریت: /panel"
    )

async def command_cleanup(update, context):
    # دستور را از گروه پاک می‌کند، سپس هیچ متن دیگری ارسال نمی‌کند.
    if update.effective_message and update.effective_chat.type in ("group","supergroup"):
        try:
            await update.effective_message.delete()
        except Exception:
            pass

async def panel(update, context):
    if not await is_admin(update, context):
        return
    chat_id = update.effective_chat.id
    r = ensure_settings(chat_id)
    def s(k): return "✅ روشن" if r[k] else "❌ خاموش"
    text = (
        "🛡 پنل مبصر\n\n"
        f"🧠 حالت هوشمند: {s('smart_mode')}\n"
        f"🧹 حذف سرویس‌ها: {s('delete_service')}\n"
        f"♻️ ضد پیام تکراری: {s('anti_duplicate')}\n"
        f"🚫 فیلتر کلمات: {s('filter_bad_words')}\n"
        f"🔗 قفل لینک: {s('link_lock')}\n"
        f"📞 قفل شماره: {s('phone_lock')}\n"
        f"🖼 قفل رسانه: {s('media_lock')}\n"
        f"⚠️ حداکثر اخطار: {r['max_warnings']}"
    )
    kb = [
        [InlineKeyboardButton("🧠 هوشمند", callback_data="toggle:smart_mode"),
         InlineKeyboardButton("🔗 لینک", callback_data="toggle:link_lock")],
        [InlineKeyboardButton("📞 شماره", callback_data="toggle:phone_lock"),
         InlineKeyboardButton("🖼 رسانه", callback_data="toggle:media_lock")],
        [InlineKeyboardButton("♻️ ضدتکرار", callback_data="toggle:anti_duplicate"),
         InlineKeyboardButton("🚫 کلمات", callback_data="toggle:filter_bad_words")],
        [InlineKeyboardButton("🧹 سرویس", callback_data="toggle:delete_service"),
         InlineKeyboardButton("🔄 بروزرسانی", callback_data="refresh")]
    ]
    await update.message.reply_text(text, reply_markup=InlineKeyboardMarkup(kb))

async def panel_callback(update, context):
    q = update.callback_query
    await q.answer()
    chat_id = q.message.chat.id
    try:
        m = await context.bot.get_chat_member(chat_id, q.from_user.id)
        if m.status not in (ChatMemberStatus.ADMINISTRATOR, ChatMemberStatus.OWNER):
            return
    except Exception:
        return
    if q.data.startswith("toggle:"):
        key = q.data.split(":",1)[1]
        set_setting(chat_id, key, 0 if setting(chat_id,key) else 1)
    r = ensure_settings(chat_id)
    def s(k): return "✅" if r[k] else "❌"
    text = (
        "🛡 پنل مبصر\n\n"
        f"🧠 حالت هوشمند: {s('smart_mode')}\n"
        f"🧹 سرویس: {s('delete_service')}\n"
        f"♻️ ضدتکرار: {s('anti_duplicate')}\n"
        f"🚫 کلمات: {s('filter_bad_words')}\n"
        f"🔗 لینک: {s('link_lock')}\n"
        f"📞 شماره: {s('phone_lock')}\n"
        f"🖼 رسانه: {s('media_lock')}"
    )
    kb = [
        [InlineKeyboardButton("🧠 هوشمند", callback_data="toggle:smart_mode"),
         InlineKeyboardButton("🔗 لینک", callback_data="toggle:link_lock")],
        [InlineKeyboardButton("📞 شماره", callback_data="toggle:phone_lock"),
         InlineKeyboardButton("🖼 رسانه", callback_data="toggle:media_lock")],
        [InlineKeyboardButton("♻️ ضدتکرار", callback_data="toggle:anti_duplicate"),
         InlineKeyboardButton("🚫 کلمات", callback_data="toggle:filter_bad_words")],
        [InlineKeyboardButton("🧹 سرویس", callback_data="toggle:delete_service"),
         InlineKeyboardButton("🔄 بروزرسانی", callback_data="refresh")]
    ]
    await q.edit_message_text(text, reply_markup=InlineKeyboardMarkup(kb))

async def kick(update, context):
    if not await is_admin(update, context): return
    msg = update.effective_message
    target = msg.reply_to_message.from_user if msg.reply_to_message else None
    if not target:
        return
    try:
        await context.bot.ban_chat_member(update.effective_chat.id,target.id)
        await context.bot.unban_chat_member(update.effective_chat.id,target.id)
    except Exception:
        pass

async def mute(update, context):
    if not await is_admin(update, context): return
    msg = update.effective_message
    target = msg.reply_to_message.from_user if msg.reply_to_message else None
    minutes = 60
    if context.args:
        try: minutes=max(1,min(10080,int(context.args[0])))
        except: pass
    if not target: return
    try:
        until=datetime.now(timezone.utc)+timedelta(minutes=minutes)
        await context.bot.restrict_chat_member(
            update.effective_chat.id,target.id,
            permissions=ChatPermissions(can_send_messages=False),until_date=until)
    except Exception:
        pass

async def delete_cmd(update, context):
    if not await is_admin(update, context): return
    if update.effective_message.reply_to_message:
        try: await update.effective_message.reply_to_message.delete()
        except Exception: pass
    try: await update.effective_message.delete()
    except Exception: pass

async def status(update, context):
    if not await is_admin(update, context): return
    ok=await bot_is_admin(update,context)
    await update.message.reply_text(
        "🛡 وضعیت مبصر\n"
        f"ربات ادمین: {'✅ بله' if ok else '❌ خیر'}\n"
        f"حالت هوشمند: {'✅' if setting(update.effective_chat.id,'smart_mode') else '❌'}\n"
        f"شناسه گروه: {update.effective_chat.id}"
    )

def main():
    if not TOKEN:
        print("ERROR: BOT_TOKEN تنظیم نشده است.")
        print("Termux: export BOT_TOKEN='توکن_خودت'")
        return
    init_db()
    app=Application.builder().token(TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("panel", panel))
    app.add_handler(CommandHandler("kick", kick))
    app.add_handler(CommandHandler("mute", mute))
    app.add_handler(CommandHandler("delete", delete_cmd))
    app.add_handler(CommandHandler("status", status))
    app.add_handler(CallbackQueryHandler(panel_callback))

    # دستورها را بعد از پردازش، در گروه حذف کن.
    app.add_handler(MessageHandler(filters.COMMAND, command_cleanup), group=1)
    app.add_handler(MessageHandler(filters.ALL, moderate), group=2)

    print("Mobsar v2 is running...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__=="__main__":
    main()
