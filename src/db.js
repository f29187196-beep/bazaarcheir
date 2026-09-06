// db.js انتخاب‌گر بک‌اند است: روی Cloudflare Workers (وقتی env.DB موجوده) از D1
// استفاده می‌کنه و روی Termux/Node از فایل JSON محلی (local-db.js).
import * as local from './local-db.js';
import * as d1 from './d1-db.js';
let backend = local;
export function selectBackend(env) {
  if (env?.DB) { d1.setEnv(env); backend = d1; } else { backend = local; }
  return backend === d1 ? 'd1' : 'local';
}
export const resetCache = (...a) => backend.resetCache(...a);
export const registerGroup = (...a) => backend.registerGroup(...a);
export const isGroupRegistered = (...a) => backend.isGroupRegistered(...a);
export const setLock = (...a) => backend.setLock(...a);
export const isLocked = (...a) => backend.isLocked(...a);
export const getAllLocks = (...a) => backend.getAllLocks(...a);
export const addToWhitelist = (...a) => backend.addToWhitelist(...a);
export const removeFromWhitelist = (...a) => backend.removeFromWhitelist(...a);
export const clearWhitelist = (...a) => backend.clearWhitelist(...a);
export const isWhitelisted = (...a) => backend.isWhitelisted(...a);
export const addWarning = (...a) => backend.addWarning(...a);
export const resetWarnings = (...a) => backend.resetWarnings(...a);
export const getWarning = (...a) => backend.getWarning(...a);
export const schedulePendingDeletion = (...a) => backend.schedulePendingDeletion(...a);
export const getExpiredDeletions = (...a) => backend.getExpiredDeletions(...a);
export const removePendingDeletion = (...a) => backend.removePendingDeletion(...a);
export const getSetting = (...a) => backend.getSetting(...a);
export const setSetting = (...a) => backend.setSetting(...a);
export const addFilter = (...a) => backend.addFilter(...a);
export const removeFilter = (...a) => backend.removeFilter(...a);
export const listFilters = (...a) => backend.listFilters(...a);
export const incStat = (...a) => backend.incStat(...a);
export const getStat = (...a) => backend.getStat(...a);
export const saveMessageHash = (...a) => backend.saveMessageHash(...a);
export const countMessageHash = (...a) => backend.countMessageHash(...a);
export const createBusiness = (...a) => backend.createBusiness(...a);
export const updateBusiness = (...a) => backend.updateBusiness(...a);
export const getBusiness = (...a) => backend.getBusiness(...a);
export const getPendingBusinesses = (...a) => backend.getPendingBusinesses(...a);
export const setUserState = (...a) => backend.setUserState(...a);
export const getUserState = (...a) => backend.getUserState(...a);
