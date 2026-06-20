// save/SaveManager.ts
// 存档管理器：保存/加载/自动存档/章节快照/版本迁移
// 导出单例 saveManager 供全局使用

import { bus } from '../core/eventBus';
import { putSlot, getSlot, getAllSlots, deleteSlot as deleteSlotDB } from './indexedDB';
import type { GameState, SaveMeta, SaveSlot, SaveSnapshot } from './types';

/** 存档版本号（每次破坏性变更结构时递增） */
export const SAVE_VERSION = 1;

/** 自动存档槽位 ID */
const AUTO_SLOT_ID = 'auto';

class SaveManager {
  /** 内存中的章节快照栈（仅当前会话，不持久化） */
  private snapshots: SaveSnapshot[] = [];

  /** 从游戏状态提取元信息 */
  private extractMeta(state: GameState): SaveMeta {
    const level = state.party.length > 0
      ? Math.max(...state.party.map((m) => m.level))
      : 1;
    return {
      chapter: state.chapter,
      playtime: state.playtime,
      savedAt: Date.now(),
      location: state.currentMap,
      level,
    };
  }

  /** 保存到指定槽位 */
  async save(slotId: string, state: GameState): Promise<void> {
    const slot: SaveSlot = {
      slotId,
      meta: this.extractMeta(state),
      state,
    };
    await putSlot(slot);
    bus.emit('save:done', { slot: slotId });
  }

  /** 加载指定槽位，不存在或出错时返回 null */
  async load(slotId: string): Promise<GameState | null> {
    try {
      const slot = await getSlot(slotId);
      if (!slot) return null;
      const state = this.migrate(slot.state);
      bus.emit('save:loaded', { slot: slotId });
      return state;
    } catch {
      return null;
    }
  }

  /** 列出所有存档槽位的元信息 */
  async listSlots(): Promise<SaveMeta[]> {
    const slots = await getAllSlots();
    return slots.map((s) => s.meta);
  }

  /** 删除存档 */
  async deleteSlot(slotId: string): Promise<void> {
    await deleteSlotDB(slotId);
  }

  /** 自动存档（保存到 'auto' 槽位） */
  async autoSave(state: GameState): Promise<void> {
    await this.save(AUTO_SLOT_ID, state);
  }

  /** 创建章节快照（回档用，仅存内存，不持久化） */
  pushSnapshot(state: GameState, label: string): void {
    // 深拷贝避免后续状态修改影响快照
    const copy = this.deserialize(this.serialize(state));
    this.snapshots.push({
      timestamp: Date.now(),
      label,
      state: copy,
    });
  }

  /** 回到上一章节快照，无快照时返回 null */
  popSnapshot(): GameState | null {
    const snapshot = this.snapshots.pop();
    if (!snapshot) return null;
    // 返回深拷贝避免修改影响栈内数据
    return this.deserialize(this.serialize(snapshot.state));
  }

  /** 序列化（GameState 已是纯数据，无 Map 等不可直接 JSON 化结构） */
  serialize(state: GameState): string {
    return JSON.stringify(state);
  }

  /** 反序列化 */
  deserialize(json: string): GameState {
    return JSON.parse(json) as GameState;
  }

  /** 版本迁移：检查版本号并按需应用迁移函数 */
  migrate(state: GameState): GameState {
    let current = { ...state };
    const currentVersion = current.version ?? 1;
    // 版本迁移函数表（按目标版本升序）
    // 未来添加新版本迁移时，在此追加
    const migrations: Array<{ version: number; migrate: (s: GameState) => GameState }> = [
      // { version: 2, migrate: (s) => ({ ...s, newField: defaultValue }) },
    ];
    for (const m of migrations) {
      if (m.version > currentVersion) {
        current = m.migrate(current);
        current.version = m.version;
      }
    }
    current.version = SAVE_VERSION;
    return current;
  }
}

/** 存档管理器单例 */
export const saveManager = new SaveManager();
