// save/types.ts
// 存档系统类型定义：槽位、元信息、完整游戏状态、队伍成员、快照

/** 存档元信息（用于槽位列表展示，不包含完整状态） */
export interface SaveMeta {
  chapter: number;
  playtime: number;
  savedAt: number;
  location: string;
  level: number;
}

/** 完整游戏状态（可被 JSON 序列化的纯数据结构） */
export interface GameState {
  version: number;
  flags: Record<string, boolean | number>;
  party: PartyMemberState[];
  inventory: Record<string, number>; // itemId -> 数量
  gold: number;
  quests: { active: string[]; done: string[] };
  currentMap: string;
  position: { x: number; y: number };
  playtime: number;
  chapter: number;
  history: SaveSnapshot[]; // 回档用
}

/** 队伍成员存档状态 */
export interface PartyMemberState {
  characterId: string;
  level: number;
  exp: number;
  hp: number;
  mp: number;
  skills: string[];
  equipment: { weapon?: string; armor?: string; accessory?: string };
}

/** 存档快照（章节回档用） */
export interface SaveSnapshot {
  timestamp: number;
  label: string; // 如 '章节1起点'
  state: GameState;
}

/** 存档槽位（完整存档单元） */
export interface SaveSlot {
  slotId: string; // '0', '1', '2', 'auto'
  meta: SaveMeta;
  state: GameState;
}
