// Web preview only (NEXO_WEB_PREVIEW=1): stands in for the phone keystore so the UI can be
// exercised in a browser. Never used in Android/iOS builds.
const mem = new Map();
const store = typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage : null;
const get = (k) => (store ? store.getItem(k) : mem.has(k) ? mem.get(k) : null);
const set = (k, v) => (store ? store.setItem(k, v) : mem.set(k, v));
const del = (k) => (store ? store.removeItem(k) : mem.delete(k));
module.exports = {
  WHEN_UNLOCKED: 0,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  AFTER_FIRST_UNLOCK: 2,
  getItemAsync: async (k) => get(k),
  setItemAsync: async (k, v) => set(k, v),
  deleteItemAsync: async (k) => del(k),
  isAvailableAsync: async () => true,
};
