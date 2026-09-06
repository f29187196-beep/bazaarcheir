-- گروه‌های ثبت‌شده
CREATE TABLE IF NOT EXISTS groups (
  chat_id INTEGER PRIMARY KEY,
  title TEXT,
  registered_at INTEGER
);

-- تنظیمات قفل هر گروه (هر ردیف = یک نوع قفل برای یک گروه)
CREATE TABLE IF NOT EXISTS locks (
  chat_id INTEGER,
  lock_type TEXT,          -- link, forward, photo, video, file, gif, sticker, emoji, phone, location, text, poll, forward_channel
  is_locked INTEGER DEFAULT 0,  -- 0 = آزاد, 1 = قفل
  PRIMARY KEY (chat_id, lock_type)
);

-- لیست سفید (کاربرانی که از قوانین معاف هستند)
CREATE TABLE IF NOT EXISTS whitelist (
  chat_id INTEGER,
  user_id INTEGER,
  PRIMARY KEY (chat_id, user_id)
);

-- هشدارهای کاربران
CREATE TABLE IF NOT EXISTS warnings (
  chat_id INTEGER,
  user_id INTEGER,
  count INTEGER DEFAULT 0,
  last_warning_at INTEGER,
  PRIMARY KEY (chat_id, user_id)
);

-- پیام‌های هشداری که باید بعد از چند ثانیه خودکار حذف بشن
CREATE TABLE IF NOT EXISTS pending_deletions (
  chat_id INTEGER,
  message_id INTEGER,
  delete_at INTEGER,     -- زمان (میلی‌ثانیه) که باید حذف بشه
  PRIMARY KEY (chat_id, message_id)
);

-- تنظیمات آزاد هر گروه (مقدار به‌صورت JSON ذخیره می‌شه)
CREATE TABLE IF NOT EXISTS settings (
  chat_id INTEGER,
  key TEXT,
  value TEXT,
  updated_at INTEGER,
  PRIMARY KEY (chat_id, key)
);

-- کلمات فیلترشده‌ی هر گروه
CREATE TABLE IF NOT EXISTS filters (
  chat_id INTEGER,
  word TEXT,
  PRIMARY KEY (chat_id, word)
);

-- آمار کاربران (مثلاً تعداد پیام‌ها)
CREATE TABLE IF NOT EXISTS stats (
  chat_id INTEGER,
  user_id INTEGER,
  key TEXT,
  value INTEGER DEFAULT 0,
  PRIMARY KEY (chat_id, user_id, key)
);

-- هش پیام‌های اخیر، برای تشخیص پیام تکراری
CREATE TABLE IF NOT EXISTS messages (
  chat_id INTEGER,
  hash TEXT,
  ts INTEGER
);
CREATE INDEX IF NOT EXISTS idx_messages_chat_hash_ts ON messages(chat_id, hash, ts);

-- آگهی‌های ثبت‌شده توسط کاربران
CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  user_id INTEGER,
  status TEXT,
  data TEXT,          -- سایر فیلدها به‌صورت JSON
  created_at INTEGER,
  updated_at INTEGER
);

-- وضعیت گفتگوی جاری هر کاربر (برای فرم‌های چندمرحله‌ای)
CREATE TABLE IF NOT EXISTS user_states (
  user_id INTEGER PRIMARY KEY,
  state TEXT,          -- JSON
  updated_at INTEGER
);
