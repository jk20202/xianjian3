/**
 * 全局类型定义 - 仙剑奇侠传同人篇
 */

/** 五灵属性:风雷水火土,循环相克(水→火→雷→风→土→水) */
export type Element = 'wind' | 'thunder' | 'water' | 'fire' | 'earth';

/** 角色在队伍中的状态 */
export interface PartyMember {
  id: string;
  name: string;
  title: string;
  element: Element;
  level: number;
  exp: number;
  expToNext: number;
  hp: number;
  maxHp: number;
  qi: number; // 气(特技)
  maxQi: number;
  shen: number; // 神(仙术)
  maxShen: number;
  atk: number;
  def: number;
  spd: number;
  luck: number;
  skills: string[]; // 已学技能 id
  learnedArts: Element[]; // 已学仙术系
  weapon: string | null;
  inParty: boolean;
}

/** 技能定义 */
export interface SkillDef {
  id: string;
  name: string;
  type: 'art' | 'skill' | 'combo'; // 仙术 / 特技 / 合击
  element?: Element;
  cost: number; // 消耗(神或气)
  costType: 'shen' | 'qi' | 'hp' | 'money';
  power: number; // 威力基数
  range: 'single' | 'row' | 'column' | 'all' | 'self';
  heal?: number; // 治疗量
  buff?: Partial<Record<BuffType, number>>; // 增益
  debuff?: Partial<Record<BuffType, number>>;
  cooldown: number; // 冷却(ms)
  castTime: number; // 施法时间(ms)
  projectile?: boolean; // 是否投射物
  effectColor: number; // 视觉特效颜色
  desc: string;
  learnLevel?: number;
}

export type BuffType =
  | 'atk' | 'def' | 'spd' | 'luck'
  | 'poison' | 'confuse' | 'sleep' | 'stun' | 'silence' | 'bind';

/** 敌人定义 */
export interface EnemyDef {
  id: string;
  name: string;
  element: Element;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  exp: number;
  money: number;
  skills: string[];
  color: number;
  radius: number;
  ai: 'melee' | 'ranged' | 'charger' | 'boss';
  detectRange: number;
  attackRange: number;
}

/** 地图定义 */
export interface MapDef {
  id: string;
  name: string;
  width: number; // 瓦片数
  height: number;
  tilesize: number;
  bg: number; // 背景色
  tiles: number[][]; // 0=空地 1=障碍 2=草丛(遇敌) 3=传送点 4=NPC 5=商店 6=剧情点
  encounters: string[]; // 遇敌敌人 id 池
  encounterRate: number; // 0-1
  spawns: { x: number; y: number }; // 玩家出生点(像素)
  exits: { x: number; y: number; to: string; toSpawn?: { x: number; y: number } }[];
  npcs: { x: number; y: number; id: string; color: number; name: string }[];
}

/** 剧情节点 */
export interface StoryNode {
  id: string;
  chapter: number;
  title: string;
  trigger: { map: string; x?: number; y?: number; auto?: boolean };
  condition?: string; // 前置条件(已完成某节点)
  dialog: DialogLine[];
  reward?: { exp?: number; money?: number; skill?: string; item?: string };
  unlocks?: string[]; // 解锁后续节点
  setFlag?: string;
}

export interface DialogLine {
  speaker: string;
  color: number;
  text: string;
  emotion?: 'normal' | 'happy' | 'sad' | 'angry';
}

/** 存档数据结构 */
export interface SaveSlot {
  slotId: number;
  createdAt: number;
  updatedAt: number;
  playTime: number; // 秒
  data: SaveData;
}

export interface SaveData {
  version: number;
  party: PartyMember[];
  inventory: Record<string, number>;
  money: number;
  currentMap: string;
  playerX: number;
  playerY: number;
  storyFlags: string[];
  completedNodes: string[];
  currentChapter: number;
  activeQuest: string | null;
  skillCooldowns: Record<string, number>; // 技能id -> 剩余ms(存档时)
  cameraX?: number;
  cameraY?: number;
}

/** 快照(回档用) */
export interface Snapshot {
  id: string;
  slotId: number;
  createdAt: number;
  label: string;
  data: SaveData;
}
