/**
 * 游戏全局上下文 GameContext
 *
 * 持有运行时的队伍、背包、剧情状态等,并提供存档/读档的序列化。
 * 跨场景共享,避免 Phaser Registry 类型丢失。
 */

import type { PartyMember, SaveData } from '../types';
import { createCharacter, gainExp } from '../data/characters';
import { SaveManager } from './SaveManager';

type Listener = () => void;

class GameContextClass {
  party: PartyMember[] = [];
  inventory: Record<string, number> = {};
  money = 200;
  currentMap = 'yuzhou';
  playerX = 20 * 32;
  playerY = 15 * 32;
  storyFlags: Set<string> = new Set();
  completedNodes: Set<string> = new Set();
  currentChapter = 1;
  activeQuest: string | null = 'ch1_intro';
  skillCooldowns: Record<string, number> = {};
  playStartTime = Date.now();
  accumulatedPlayTime = 0;

  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() { this.listeners.forEach(fn => fn()); }

  /** 新游戏:初始化队伍(景天) */
  newGame(): void {
    this.party = [createCharacter('jingtian', 1)];
    this.inventory = { hp_potion: 3 };
    this.money = 200;
    this.currentMap = 'yuzhou';
    this.playerX = 20 * 32;
    this.playerY = 15 * 32;
    this.storyFlags = new Set();
    this.completedNodes = new Set();
    this.currentChapter = 1;
    this.activeQuest = 'ch1_intro';
    this.skillCooldowns = {};
    this.playStartTime = Date.now();
    this.accumulatedPlayTime = 0;
    this.emit();
  }

  /** 队伍中参战成员 */
  get activeParty(): PartyMember[] {
    return this.party.filter(p => p.inParty && p.hp > 0);
  }

  get leader(): PartyMember {
    return this.party.find(p => p.inParty) ?? this.party[0];
  }

  /** 角色加入队伍 */
  joinParty(id: string, level?: number): void {
    const existing = this.party.find(p => p.id === id);
    if (existing) { existing.inParty = true; this.emit(); return; }
    const c = createCharacter(id, level ?? this.leader.level);
    c.inParty = true;
    this.party.push(c);
    this.emit();
  }

  /** 获得经验(全员) */
  gainPartyExp(exp: number): { leveled: { name: string; skills: string[] }[] } {
    const leveled: { name: string; skills: string[] }[] = [];
    for (const m of this.party.filter(p => p.inParty)) {
      const r = gainExp(m, exp);
      if (r.leveledUp) leveled.push({ name: m.name, skills: r.newSkills });
    }
    this.emit();
    return { leveled };
  }

  /** 标记剧情节点完成 */
  completeNode(nodeId: string): void {
    this.completedNodes.add(nodeId);
    this.emit();
  }

  setFlag(flag: string): void {
    this.storyFlags.add(flag);
    this.emit();
  }

  hasFlag(flag: string): boolean {
    return this.storyFlags.has(flag);
  }

  /** 序列化为存档数据 */
  toSaveData(): SaveData {
    return {
      version: 1,
      party: JSON.parse(JSON.stringify(this.party)),
      inventory: { ...this.inventory },
      money: this.money,
      currentMap: this.currentMap,
      playerX: this.playerX,
      playerY: this.playerY,
      storyFlags: Array.from(this.storyFlags),
      completedNodes: Array.from(this.completedNodes),
      currentChapter: this.currentChapter,
      activeQuest: this.activeQuest,
      skillCooldowns: { ...this.skillCooldowns },
    };
  }

  /** 从存档数据恢复 */
  fromSaveData(data: SaveData): void {
    this.party = JSON.parse(JSON.stringify(data.party));
    this.inventory = { ...data.inventory };
    this.money = data.money;
    this.currentMap = data.currentMap;
    this.playerX = data.playerX;
    this.playerY = data.playerY;
    this.storyFlags = new Set(data.storyFlags);
    this.completedNodes = new Set(data.completedNodes);
    this.currentChapter = data.currentChapter;
    this.activeQuest = data.activeQuest;
    this.skillCooldowns = { ...data.skillCooldowns };
    this.playStartTime = Date.now();
    this.accumulatedPlayTime = 0;
    this.emit();
  }

  /** 保存到槽位 */
  async saveToSlot(slotId: number): Promise<void> {
    await SaveManager.saveSlot(slotId, this.toSaveData());
  }

  /** 自动存档 */
  async autosave(): Promise<void> {
    await SaveManager.autosave(this.toSaveData());
  }

  /** 游戏时长(秒) */
  getPlayTime(): number {
    return this.accumulatedPlayTime + Math.floor((Date.now() - this.playStartTime) / 1000);
  }
}

export const GameContext = new GameContextClass();
