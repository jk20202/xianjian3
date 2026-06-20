/**
 * 存档管理器 SaveManager
 *
 * 功能:
 * - 多槽位存档(默认 4 个槽位)
 * - 自动存档
 * - 快照系统(回档):每次存档自动生成快照,可回档到任意历史节点
 * - 本地缓存,无云端同步
 *
 * 数据流:SaveData -> 槽位(SaveSlot) -> 快照历史(Snapshot[])
 */

import type { SaveData, SaveSlot, Snapshot } from '../types';
import { getStore } from './StorageAdapter';

const SAVE_VERSION = 1;
const SLOT_COUNT = 4;
const MAX_SNAPSHOTS = 20; // 每槽位最多保留快照数

const K_SLOT = (i: number) => `save_slot_${i}`;
const K_SNAPSHOTS = (i: number) => `save_snapshots_${i}`;
const K_AUTOSAVE = 'save_autosave';
const K_META = 'save_meta';

export interface SlotMeta {
  slotId: number;
  exists: boolean;
  chapter: number;
  level: number;
  money: number;
  playTime: number;
  updatedAt: number;
  mapName: string;
}

class SaveManagerClass {
  /** 读取某槽位存档 */
  async loadSlot(slotId: number): Promise<SaveSlot | null> {
    const store = await getStore();
    const slot = await store.get<SaveSlot>(K_SLOT(slotId));
    if (slot && slot.data && slot.data.version === SAVE_VERSION) return slot;
    return null;
  }

  /** 写入槽位存档(同时生成快照) */
  async saveSlot(slotId: number, data: SaveData): Promise<void> {
    const store = await getStore();
    const now = Date.now();
    const existing = await this.loadSlot(slotId);
    const slot: SaveSlot = {
      slotId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      playTime: (existing?.playTime ?? 0) + (data ? 0 : 0),
      data: { ...data, version: SAVE_VERSION },
    };
    // 生成快照(回档用)
    await this.pushSnapshot(slotId, data, existing ? '覆盖前' : '新建');
    await store.set(K_SLOT(slotId), slot);
    await this.refreshMeta();
  }

  /** 自动存档 */
  async autosave(data: SaveData): Promise<void> {
    const store = await getStore();
    const slot: SaveSlot = {
      slotId: -1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      playTime: 0,
      data: { ...data, version: SAVE_VERSION },
    };
    await store.set(K_AUTOSAVE, slot);
  }

  async loadAutosave(): Promise<SaveSlot | null> {
    const store = await getStore();
    return await store.get<SaveSlot>(K_AUTOSAVE);
  }

  /** 删除槽位存档(保留快照供回档) */
  async deleteSlot(slotId: number): Promise<void> {
    const store = await getStore();
    await store.remove(K_SLOT(slotId));
    await this.refreshMeta();
  }

  /** 列出所有槽位元信息 */
  async listSlots(): Promise<SlotMeta[]> {
    const store = await getStore();
    const meta = await store.get<SlotMeta[]>(K_META);
    if (meta) return meta;
    // 兜底:逐个读取
    const result: SlotMeta[] = [];
    for (let i = 0; i < SLOT_COUNT; i++) {
      const slot = await this.loadSlot(i);
      result.push(this.toMeta(i, slot));
    }
    return result;
  }

  private toMeta(slotId: number, slot: SaveSlot | null): SlotMeta {
    if (!slot) return { slotId, exists: false, chapter: 0, level: 0, money: 0, playTime: 0, updatedAt: 0, mapName: '' };
    const lead = slot.data.party.find(p => p.inParty) ?? slot.data.party[0];
    return {
      slotId,
      exists: true,
      chapter: slot.data.currentChapter,
      level: lead?.level ?? 0,
      money: slot.data.money,
      playTime: slot.playTime,
      updatedAt: slot.updatedAt,
      mapName: slot.data.currentMap,
    };
  }

  private async refreshMeta(): Promise<void> {
    const store = await getStore();
    const meta: SlotMeta[] = [];
    for (let i = 0; i < SLOT_COUNT; i++) {
      const slot = await this.loadSlot(i);
      meta.push(this.toMeta(i, slot));
    }
    await store.set(K_META, meta);
  }

  // ===== 快照(回档)系统 =====
  async pushSnapshot(slotId: number, data: SaveData, label: string): Promise<void> {
    const store = await getStore();
    const list = (await store.get<Snapshot[]>(K_SNAPSHOTS(slotId))) ?? [];
    const snap: Snapshot = {
      id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      slotId,
      createdAt: Date.now(),
      label,
      data: JSON.parse(JSON.stringify(data)),
    };
    list.push(snap);
    // 保留最近 MAX_SNAPSHOTS 个
    if (list.length > MAX_SNAPSHOTS) list.splice(0, list.length - MAX_SNAPSHOTS);
    await store.set(K_SNAPSHOTS(slotId), list);
  }

  async listSnapshots(slotId: number): Promise<Snapshot[]> {
    const store = await getStore();
    return (await store.get<Snapshot[]>(K_SNAPSHOTS(slotId))) ?? [];
  }

  /** 回档到指定快照(将快照数据写回槽位) */
  async rollbackTo(slotId: number, snapshotId: string): Promise<SaveData | null> {
    const store = await getStore();
    const list = (await store.get<Snapshot[]>(K_SNAPSHOTS(slotId))) ?? [];
    const snap = list.find(s => s.id === snapshotId);
    if (!snap) return null;
    // 回档前,先把当前状态也存为快照(防止误操作)
    const current = await this.loadSlot(slotId);
    if (current) await this.pushSnapshot(slotId, current.data, '回档前');
    // 写回
    await this.saveSlot(slotId, snap.data);
    return JSON.parse(JSON.stringify(snap.data));
  }

  async deleteSnapshot(slotId: number, snapshotId: string): Promise<void> {
    const store = await getStore();
    const list = (await store.get<Snapshot[]>(K_SNAPSHOTS(slotId))) ?? [];
    const filtered = list.filter(s => s.id !== snapshotId);
    await store.set(K_SNAPSHOTS(slotId), filtered);
  }

  /** 创建初始存档数据 */
  createInitialData(): SaveData {
    return {
      version: SAVE_VERSION,
      party: [], // 由 GameContext 注入
      inventory: {},
      money: 200,
      currentMap: 'yuzhou',
      playerX: 20 * 32,
      playerY: 15 * 32,
      storyFlags: [],
      completedNodes: [],
      currentChapter: 1,
      activeQuest: 'ch1_intro',
      skillCooldowns: {},
    };
  }

  get slotCount() { return SLOT_COUNT; }
}

export const SaveManager = new SaveManagerClass();
export { SAVE_VERSION };
