// quest/QuestManager.ts
// 任务系统：管理任务接取、进度追踪、交付与存档。
// 通过事件总线向外广播任务状态变更，不直接操作 UI 或场景。

import { bus } from '../core/eventBus';
import { QUESTS } from '../data/quests';
import type { QuestDef, Objective, QuestRewards } from '../data/quests';

/** 任务追踪条目（UI 用） */
export interface TrackedObjective {
  desc: string;
  current: number;
  target: number;
  done: boolean;
}

/** 任务追踪信息 */
export interface TrackedQuest {
  quest: QuestDef;
  objectives: TrackedObjective[];
}

/** 存档数据 */
export interface QuestSaveData {
  active: string[];
  done: string[];
  progress: Record<string, number[]>;
}

class QuestManager {
  /** 当前活跃任务 */
  active: string[] = [];
  /** 已完成任务 */
  done: string[] = [];
  /** 任务进度（每个 objective 的当前计数） */
  progress: Record<string, number[]> = {};

  /**
   * 接取任务
   * @returns 是否接取成功
   */
  accept(questId: string): boolean {
    if (!this.canAccept(questId)) return false;
    const quest = QUESTS[questId];
    if (!quest) return false;

    this.active.push(questId);
    // 初始化每个目标的进度为 0
    this.progress[questId] = quest.objectives.map(() => 0);

    bus.emit('quest:accepted', { questId });
    return true;
  }

  /**
   * 完成任务（交付）
   * @returns 任务奖励，若无法完成返回 null
   */
  complete(questId: string): QuestRewards | null {
    if (!this.canComplete(questId)) return null;
    const quest = QUESTS[questId];
    if (!quest) return null;

    // 从活跃列表移除
    this.active = this.active.filter((id) => id !== questId);
    this.done.push(questId);
    // 清理进度数据
    delete this.progress[questId];

    bus.emit('quest:completed', { questId, rewards: quest.rewards });
    return quest.rewards;
  }

  /**
   * 检查任务是否可接
   * 条件：任务存在、未在活跃/已完成列表中、所有前置任务已完成
   */
  canAccept(questId: string): boolean {
    const quest = QUESTS[questId];
    if (!quest) return false;
    if (this.active.includes(questId)) return false;
    if (this.done.includes(questId)) return false;
    // 检查所有前置任务是否已完成
    return quest.prerequisites.every((p) => this.done.includes(p));
  }

  /** 更新击杀进度 */
  onKill(monsterId: string): void {
    this.updateProgress((obj) => {
      if (obj.kind === 'kill' && obj.monsterId === monsterId) {
        return { match: true, increment: 1, max: obj.count };
      }
      return { match: false };
    });
  }

  /** 更新到达区域 */
  onReach(areaId: string): void {
    this.updateProgress((obj) => {
      if (obj.kind === 'reach' && obj.areaId === areaId) {
        return { match: true, increment: 1, max: 1 };
      }
      return { match: false };
    });
  }

  /** 更新对话 */
  onTalk(npcId: string): void {
    this.updateProgress((obj) => {
      if (obj.kind === 'talk' && obj.npcId === npcId) {
        return { match: true, increment: 1, max: 1 };
      }
      return { match: false };
    });
  }

  /** 更新收集 */
  onCollect(itemId: string, count: number): void {
    this.updateProgress((obj) => {
      if (obj.kind === 'collect' && obj.itemId === itemId) {
        return { match: true, increment: count, max: obj.count };
      }
      return { match: false };
    });
  }

  /**
   * 检查任务是否可交付
   * 条件：任务在活跃列表中、所有目标已完成
   */
  canComplete(questId: string): boolean {
    if (!this.active.includes(questId)) return false;
    const quest = QUESTS[questId];
    if (!quest) return false;
    const progress = this.progress[questId];
    if (!progress) return false;

    return quest.objectives.every((obj, i) => {
      const current = progress[i] ?? 0;
      return this.isObjectiveDone(obj, current);
    });
  }

  /**
   * 获取任务追踪信息（UI 用）
   * 返回所有活跃任务及其目标进度
   */
  getTrackedQuests(): TrackedQuest[] {
    return this.active.map((questId) => {
      const quest = QUESTS[questId];
      const progress = this.progress[questId] ?? [];
      const objectives: TrackedObjective[] = quest.objectives.map((obj, i) => {
        const current = progress[i] ?? 0;
        const target = this.getObjectiveTarget(obj);
        const done = this.isObjectiveDone(obj, current);
        return {
          desc: this.getObjectiveDesc(obj),
          current,
          target,
          done,
        };
      });
      return { quest, objectives };
    });
  }

  /** 序列化（存档用） */
  serialize(): QuestSaveData {
    return {
      active: [...this.active],
      done: [...this.done],
      progress: JSON.parse(JSON.stringify(this.progress)),
    };
  }

  /** 反序列化（读档用） */
  deserialize(data: QuestSaveData): void {
    this.active = [...data.active];
    this.done = [...data.done];
    this.progress = JSON.parse(JSON.stringify(data.progress));
  }

  // ─── 内部方法 ─────────────────────────────

  /**
   * 通用进度更新逻辑
   * 遍历所有活跃任务，匹配目标并更新进度
   */
  private updateProgress(
    matcher: (obj: Objective) => { match: boolean; increment?: number; max?: number },
  ): void {
    for (const questId of this.active) {
      const quest = QUESTS[questId];
      if (!quest) continue;
      const progress = this.progress[questId];
      if (!progress) continue;

      let changed = false;
      quest.objectives.forEach((obj, i) => {
        const result = matcher(obj);
        if (result.match && result.increment !== undefined && result.max !== undefined) {
          if (progress[i] < result.max) {
            progress[i] = Math.min(result.max, progress[i] + result.increment);
            changed = true;
          }
        }
      });

      if (changed) {
        bus.emit('quest:progress', { questId, progress: [...progress] });
      }
    }
  }

  /** 判断单个目标是否完成 */
  private isObjectiveDone(obj: Objective, current: number): boolean {
    return current >= this.getObjectiveTarget(obj);
  }

  /** 获取目标所需数量 */
  private getObjectiveTarget(obj: Objective): number {
    switch (obj.kind) {
      case 'kill':
        return obj.count;
      case 'collect':
        return obj.count;
      case 'reach':
        return 1;
      case 'talk':
        return 1;
    }
  }

  /** 生成目标描述文本 */
  private getObjectiveDesc(obj: Objective): string {
    switch (obj.kind) {
      case 'kill':
        return `击杀 ${obj.monsterId}`;
      case 'reach':
        return `到达 ${obj.areaId}`;
      case 'talk':
        return `与 ${obj.npcId} 对话`;
      case 'collect':
        return `收集 ${obj.itemId}`;
    }
  }
}

/** 任务系统单例 */
export const questManager = new QuestManager();
