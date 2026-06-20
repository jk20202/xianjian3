/**
 * 三端存储抽象层 StorageAdapter
 *
 * 统一封装 Web / APP / 小程序 的本地存储,使上层存档逻辑无需关心运行环境。
 * - Web:        IndexedDB(主存储,容量大)+ localStorage(元数据)
 * - APP(Capacitor): Preferences 插件(运行时自动检测)
 * - 小程序:      wx.setStorage / wx.getStorage(运行时自动检测)
 *
 * 三端数据共通:同一套 SaveData 结构,仅持久化介质不同。
 */

export interface KVStore {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
}

// ============ Web IndexedDB 实现 ============
class IndexedDBStore implements KVStore {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private dbName = 'xianjian_save_db';
  private store = 'kv';

  private open(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.store)) db.createObjectStore(this.store);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.dbPromise;
  }

  async get<T>(key: string): Promise<T | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.store, 'readonly');
      const req = tx.objectStore(this.store).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async set<T>(key: string, value: T): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.store, 'readwrite');
      tx.objectStore(this.store).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async remove(key: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.store, 'readwrite');
      tx.objectStore(this.store).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async keys(): Promise<string[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.store, 'readonly');
      const req = tx.objectStore(this.store).getAllKeys();
      req.onsuccess = () => resolve(req.result as string[]);
      req.onerror = () => reject(req.error);
    });
  }

  async clear(): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.store, 'readwrite');
      tx.objectStore(this.store).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

// ============ localStorage 兜底实现 ============
class LocalStorageStore implements KVStore {
  async get<T>(key: string): Promise<T | null> {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }
  async set<T>(key: string, value: T): Promise<void> {
    localStorage.setItem(key, JSON.stringify(value));
  }
  async remove(key: string): Promise<void> {
    localStorage.removeItem(key);
  }
  async keys(): Promise<string[]> {
    return Object.keys(localStorage);
  }
  async clear(): Promise<void> {
    localStorage.clear();
  }
}

// ============ 微信小程序实现 ============
class WxMiniprogramStore implements KVStore {
  private wx: any;
  constructor(wx: any) { this.wx = wx; }
  async get<T>(key: string): Promise<T | null> {
    try {
      const v = this.wx.getStorageSync(key);
      return v === '' ? null : (v as T);
    } catch { return null; }
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.wx.setStorageSync(key, value);
  }
  async remove(key: string): Promise<void> {
    this.wx.removeStorageSync(key);
  }
  async keys(): Promise<string[]> {
    return this.wx.getStorageInfoSync().keys as string[];
  }
  async clear(): Promise<void> {
    this.wx.clearStorageSync();
  }
}

// ============ Capacitor Preferences 实现(APP) ============
class CapacitorStore implements KVStore {
  private pref: any;
  constructor(pref: any) { this.pref = pref; }
  async get<T>(key: string): Promise<T | null> {
    const { value } = await this.pref.get({ key });
    return value ? (JSON.parse(value) as T) : null;
  }
  async set<T>(key: string, value: T): Promise<void> {
    await this.pref.set({ key, value: JSON.stringify(value) });
  }
  async remove(key: string): Promise<void> {
    await this.pref.remove({ key });
  }
  async keys(): Promise<string[]> {
    const { keys } = await this.pref.keys();
    return keys;
  }
  async clear(): Promise<void> {
    await this.pref.clear();
  }
}

/** 运行环境检测 */
function detectEnvironment(): 'web' | 'wx' | 'capacitor' | 'node' {
  try {
    const g: any = globalThis as any;
    if (typeof g.wx !== 'undefined' && g.wx.setStorageSync) return 'wx';
    if (typeof g.Capacitor !== 'undefined') return 'capacitor';
    if (typeof indexedDB !== 'undefined') return 'web';
    if (typeof localStorage !== 'undefined') return 'web';
  } catch { /* ignore */ }
  return 'node';
}

/** 懒加载 Capacitor Preferences 插件(可选依赖,仅 APP 端安装)
 *  用 Function 构造动态 import,使 bundler 无法静态分析,
 *  从而 web 端打包/dev 都不会尝试解析该可选模块。 */
async function tryLoadCapacitorPrefs(): Promise<any | null> {
  try {
    const dynImport = new Function('m', 'return import(m)') as (m: string) => Promise<any>;
    const mod = await dynImport('@capacitor/preferences');
    return mod.Preferences ?? mod.default?.Preferences ?? null;
  } catch { return null; }
}

let _store: KVStore | null = null;
let _env: string | null = null;

/** 获取当前存储实例(单例,自动适配三端) */
export async function getStore(): Promise<KVStore> {
  if (_store) return _store;
  const env = detectEnvironment();
  _env = env;
  switch (env) {
    case 'wx':
      _store = new WxMiniprogramStore((globalThis as any).wx);
      break;
    case 'capacitor': {
      const prefs = await tryLoadCapacitorPrefs();
      _store = prefs ? new CapacitorStore(prefs) : new LocalStorageStore();
      break;
    }
    case 'web':
      _store = (typeof indexedDB !== 'undefined')
        ? new IndexedDBStore()
        : new LocalStorageStore();
      break;
    default:
      _store = new LocalStorageStore();
  }
  return _store;
}

/** 当前运行环境(调试用) */
export function currentEnvironment(): string {
  return _env ?? detectEnvironment();
}
