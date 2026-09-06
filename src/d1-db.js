// بک‌اند دیتابیس برای Cloudflare Workers (D1). همان امضای توابع local-db.js را دارد
// تا db.js بتونه بین این دو بک‌اند سوییچ کنه بدون تغییر بقیه‌ی کد.
let ENV = null;
export function setEnv(env) { ENV = env; }
function db() {
  if (!ENV?.DB) throw new Error('D1 binding (env.DB) پیکربندی نشده — wrangler.toml را بررسی کنید.');
  return ENV.DB;
}
const now = () => Date.now();

export async function resetCache() { /* بدون کش داخلی؛ برای سازگاری با local-db.js */ }

export async function registerGroup(chatId, title) {
  await db().prepare('INSERT INTO groups (chat_id,title,registered_at) VALUES (?,?,?) ON CONFLICT(chat_id) DO UPDATE SET title=excluded.title')
    .bind(chatId, title, now()).run();
}
export async function isGroupRegistered(chatId) {
  const r = await db().prepare('SELECT 1 FROM groups WHERE chat_id=?').bind(chatId).first();
  return !!r;
}
export async function setLock(chatId, type, v) {
  await db().prepare('INSERT INTO locks (chat_id,lock_type,is_locked) VALUES (?,?,?) ON CONFLICT(chat_id,lock_type) DO UPDATE SET is_locked=excluded.is_locked')
    .bind(chatId, type, v ? 1 : 0).run();
}
export async function isLocked(chatId, type) {
  const r = await db().prepare('SELECT is_locked FROM locks WHERE chat_id=? AND lock_type=?').bind(chatId, type).first();
  return r?.is_locked === 1;
}
export async function getAllLocks(chatId) {
  const r = await db().prepare('SELECT chat_id,lock_type,is_locked FROM locks WHERE chat_id=?').bind(chatId).all();
  return r.results || [];
}
export async function addToWhitelist(chatId, userId) {
  await db().prepare('INSERT OR IGNORE INTO whitelist (chat_id,user_id) VALUES (?,?)').bind(chatId, userId).run();
}
export async function removeFromWhitelist(chatId, userId) {
  await db().prepare('DELETE FROM whitelist WHERE chat_id=? AND user_id=?').bind(chatId, userId).run();
}
export async function clearWhitelist(chatId) {
  await db().prepare('DELETE FROM whitelist WHERE chat_id=?').bind(chatId).run();
}
export async function isWhitelisted(chatId, userId) {
  const r = await db().prepare('SELECT 1 FROM whitelist WHERE chat_id=? AND user_id=?').bind(chatId, userId).first();
  return !!r;
}
export async function addWarning(chatId, userId) {
  const cur = await db().prepare('SELECT count FROM warnings WHERE chat_id=? AND user_id=?').bind(chatId, userId).first();
  const n = (cur?.count || 0) + 1;
  await db().prepare('INSERT INTO warnings (chat_id,user_id,count,last_warning_at) VALUES (?,?,?,?) ON CONFLICT(chat_id,user_id) DO UPDATE SET count=excluded.count, last_warning_at=excluded.last_warning_at')
    .bind(chatId, userId, n, now()).run();
  return n;
}
export async function resetWarnings(chatId, userId) {
  await db().prepare('DELETE FROM warnings WHERE chat_id=? AND user_id=?').bind(chatId, userId).run();
}
export async function getWarning(chatId, userId) {
  const r = await db().prepare('SELECT count FROM warnings WHERE chat_id=? AND user_id=?').bind(chatId, userId).first();
  return r?.count || 0;
}
export async function schedulePendingDeletion(chatId, messageId, delayMs) {
  await db().prepare('INSERT INTO pending_deletions (chat_id,message_id,delete_at) VALUES (?,?,?) ON CONFLICT(chat_id,message_id) DO UPDATE SET delete_at=excluded.delete_at')
    .bind(chatId, messageId, now() + delayMs).run();
}
export async function getExpiredDeletions() {
  const r = await db().prepare('SELECT chat_id,message_id,delete_at FROM pending_deletions WHERE delete_at<=?').bind(now()).all();
  return r.results || [];
}
export async function removePendingDeletion(chatId, messageId) {
  await db().prepare('DELETE FROM pending_deletions WHERE chat_id=? AND message_id=?').bind(chatId, messageId).run();
}
export async function getSetting(chatId, key, def = null) {
  const r = await db().prepare('SELECT value FROM settings WHERE chat_id=? AND key=?').bind(chatId, key).first();
  if (r?.value === undefined || r?.value === null) return def;
  try { return JSON.parse(r.value); } catch { return r.value; }
}
export async function setSetting(chatId, key, value) {
  await db().prepare('INSERT INTO settings (chat_id,key,value,updated_at) VALUES (?,?,?,?) ON CONFLICT(chat_id,key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at')
    .bind(chatId, key, JSON.stringify(value), now()).run();
}
export async function addFilter(chatId, word) {
  await db().prepare('INSERT OR IGNORE INTO filters (chat_id,word) VALUES (?,?)').bind(chatId, word.toLowerCase()).run();
}
export async function removeFilter(chatId, word) {
  await db().prepare('DELETE FROM filters WHERE chat_id=? AND word=?').bind(chatId, word.toLowerCase()).run();
}
export async function listFilters(chatId) {
  const r = await db().prepare('SELECT word FROM filters WHERE chat_id=?').bind(chatId).all();
  return (r.results || []).map(x => x.word);
}
export async function incStat(chatId, userId, key, amount = 1) {
  const cur = await db().prepare('SELECT value FROM stats WHERE chat_id=? AND user_id=? AND key=?').bind(chatId, userId, key).first();
  const n = (cur?.value || 0) + amount;
  await db().prepare('INSERT INTO stats (chat_id,user_id,key,value) VALUES (?,?,?,?) ON CONFLICT(chat_id,user_id,key) DO UPDATE SET value=excluded.value')
    .bind(chatId, userId, key, n).run();
  return n;
}
export async function getStat(chatId, userId, key) {
  const r = await db().prepare('SELECT value FROM stats WHERE chat_id=? AND user_id=? AND key=?').bind(chatId, userId, key).first();
  return r?.value || 0;
}
export async function saveMessageHash(chatId, hash, ts) {
  await db().prepare('INSERT INTO messages (chat_id,hash,ts) VALUES (?,?,?)').bind(chatId, hash, ts).run();
  await db().prepare('DELETE FROM messages WHERE chat_id=? AND ts<?').bind(chatId, ts - 86400000).run();
}
export async function countMessageHash(chatId, hash, windowMs) {
  const r = await db().prepare('SELECT COUNT(*) AS c FROM messages WHERE chat_id=? AND hash=? AND ts>?')
    .bind(chatId, hash, now() - windowMs).first();
  return r?.c || 0;
}
export async function createBusiness(userId, data) {
  const id = `B${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const ts = now();
  await db().prepare('INSERT INTO businesses (id,user_id,status,data,created_at,updated_at) VALUES (?,?,?,?,?,?)')
    .bind(id, userId, 'pending', JSON.stringify(data || {}), ts, ts).run();
  return { id, user_id: userId, status: 'pending', created_at: ts, ...data };
}
export async function updateBusiness(id, patch) {
  const cur = await getBusiness(id);
  if (!cur) return null;
  const merged = { ...cur, ...patch, updated_at: now() };
  const { id: _id, user_id, status, created_at, updated_at, ...rest } = merged;
  await db().prepare('UPDATE businesses SET status=?,data=?,updated_at=? WHERE id=?')
    .bind(status, JSON.stringify(rest), updated_at, id).run();
  return merged;
}
export async function getBusiness(id) {
  const r = await db().prepare('SELECT * FROM businesses WHERE id=?').bind(id).first();
  if (!r) return null;
  let extra = {}; try { extra = JSON.parse(r.data || '{}'); } catch { /* ignore */ }
  return { id: r.id, user_id: r.user_id, status: r.status, created_at: r.created_at, updated_at: r.updated_at, ...extra };
}
export async function getPendingBusinesses() {
  const r = await db().prepare("SELECT id FROM businesses WHERE status='pending'").all();
  const out = [];
  for (const row of r.results || []) out.push(await getBusiness(row.id));
  return out;
}
export async function setUserState(userId, state) {
  if (state === null) { await db().prepare('DELETE FROM user_states WHERE user_id=?').bind(userId).run(); return; }
  await db().prepare('INSERT INTO user_states (user_id,state,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET state=excluded.state, updated_at=excluded.updated_at')
    .bind(userId, JSON.stringify(state), now()).run();
}
export async function getUserState(userId) {
  const r = await db().prepare('SELECT state FROM user_states WHERE user_id=?').bind(userId).first();
  if (!r?.state) return null;
  try { return JSON.parse(r.state); } catch { return null; }
}
