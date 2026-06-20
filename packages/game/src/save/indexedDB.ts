// save/indexedDB.ts
// IndexedDB 封装：存档槽位的持久化存储
// 数据库 'pal3-lite-save'，对象仓库 'slots'（主键 slotId）
// 当 IndexedDB 不可用时（如 Node 测试环境），回退到内存 Map

import type { SaveSlot } from './types';

const DB_NAME = 'pal3-lite-save';
const DB_VERSION = 1;
const STORE_NAME = 'slots';

/** 内存回退存储（IndexedDB 不可用或操作失败时使用） */
const memoryStore = new Map<string, SaveSlot>();

/** 检测 IndexedDB 是否可用，返回工厂实例或 null */
function getIndexedDB(): IDBFactory | null {
  try {
    const idb = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
    return idb ?? null;
  } catch {
    return null;
  }
}

/** 数据库连接缓存（单例） */
let dbPromise: Promise<IDBDatabase> | null = null;

/** 打开/创建数据库，失败时重置缓存以便后续重试 */
function openDB(): Promise<IDBDatabase> {
  const idb = getIndexedDB();
  if (!idb) {
    return Promise.reject(new Error('IndexedDB 不可用'));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = idb.open(DB_NAME, DB_VERSION);
    request.onerror = () => {
      dbPromise = null; // 重置缓存以便重试
      reject(request.error);
    };
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'slotId' });
      }
    };
  });
  return dbPromise;
}

/** 写入存档槽位 */
export async function putSlot(slot: SaveSlot): Promise<void> {
  const idb = getIndexedDB();
  if (!idb) {
    memoryStore.set(slot.slotId, slot);
    return;
  }
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(slot);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    // 出错时回退到内存存储
    memoryStore.set(slot.slotId, slot);
  }
}

/** 读取存档槽位，不存在或出错时返回 null */
export async function getSlot(slotId: string): Promise<SaveSlot | null> {
  const idb = getIndexedDB();
  if (!idb) {
    return memoryStore.get(slotId) ?? null;
  }
  try {
    const db = await openDB();
    return await new Promise<SaveSlot | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(slotId);
      request.onsuccess = () => resolve((request.result as SaveSlot) ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return memoryStore.get(slotId) ?? null;
  }
}

/** 读取所有存档槽位，出错时返回内存中的数据 */
export async function getAllSlots(): Promise<SaveSlot[]> {
  const idb = getIndexedDB();
  if (!idb) {
    return [...memoryStore.values()];
  }
  try {
    const db = await openDB();
    return await new Promise<SaveSlot[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve((request.result as SaveSlot[]) ?? []);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [...memoryStore.values()];
  }
}

/** 删除存档槽位 */
export async function deleteSlot(slotId: string): Promise<void> {
  const idb = getIndexedDB();
  if (!idb) {
    memoryStore.delete(slotId);
    return;
  }
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(slotId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    // 出错时回退到内存存储
    memoryStore.delete(slotId);
  }
}
