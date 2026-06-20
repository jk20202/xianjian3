// ecs/entity.ts
// 实体定义：角色 / 怪物 / NPC / 投射物统一用 Entity 描述
// 采用"胖实体"模式而非严格 ECS，适合本项目规模，代码更直观

import type { Element, Faction, Vec2, VisualRef } from '../core/types';
import type { Stats } from '../data/stats';
import type { CharacterDef } from '../data/characters';
import type { MonsterDef } from '../data/monsters';
import type { NpcDef } from '../data/npcs';
import { CHARACTER_MAP } from '../data/characters';
import { MONSTER_MAP } from '../data/monsters';
import { NPCS } from '../data/npcs';
import { SKILL_MAP } from '../data/skills';
import { statsAtLevel } from '../data/stats';

/** 实体类型 */
export type EntityType = 'player' | 'teammate' | 'monster' | 'npc' | 'projectile';

/** AI 状态机 */
export type AIState = 'idle' | 'patrol' | 'chase' | 'attack' | 'cast' | 'retreat' | 'heal' | 'dead';

/** Buff/Debuff */
export interface Buff {
  id: string;
  name: string;
  kind: 'buff_atk' | 'buff_def' | 'buff_spd' | 'shield' | 'dot' | 'hot';
  value: number;
  remaining: number;   // 毫秒
  total: number;        // 总时长
}

/** 装备槽 */
export interface Equipment {
  weapon?: string;
  armor?: string;
  accessory?: string;
}

/** 技能冷却信息 */
export interface SkillCooldown {
  skillId: string;
  remaining: number;  // 剩余毫秒
}

/** 游戏实体 —— 统一描述角色、怪物、NPC、投射物 */
export interface Entity {
  id: string;
  type: EntityType;
  // 位置与移动
  position: Vec2;
  facing: number;       // 弧度
  velocity: Vec2;
  speed: number;        // 像素/秒
  // 阵营
  faction: Faction;
  // 战斗属性
  element: Element;
  stats: Stats;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  level: number;
  // 视觉
  sprite: VisualRef;
  name: string;
  // 技能
  skills: string[];
  skillCooldowns: Map<string, number>;
  // AI
  ai?: AIState;
  aiTargetId?: string;
  aiTimer?: number;
  // 装备
  equipment: Equipment;
  // Buff
  buffs: Buff[];
  // NPC 专用
  npcId?: string;
  dialogueId?: string;
  // 投射物专用
  projectile?: {
    ownerId: string;
    skillId: string;
    damage: number;
    element?: Element;
    targetId?: string;
    aoeRadius?: number;
    lifetime: number;
  };
  // 标记
  isAlive: boolean;
  isInvulnerable: boolean;
  invulnerableTimer: number;
  // 攻击间隔
  attackTimer: number;
  attackInterval: number;
  // 翻滚
  dodgeTimer: number;
  isDodging: boolean;
  // 经验/金钱（怪物用）
  expReward?: number;
  goldReward?: number;
  drops?: { itemId: string; chance: number }[];
  // 角色定义 ID（玩家/队友用）
  characterId?: string;
  // 怪物定义 ID
  monsterId?: string;
}

/** 生成唯一实体 ID */
let _entityCounter = 0;
export function genEntityId(prefix = 'e'): string {
  _entityCounter++;
  return `${prefix}_${_entityCounter}`;
}

/** 从角色定义创建玩家实体 */
export function createPlayerEntity(characterId: string, position: Vec2, level: number): Entity {
  const def: CharacterDef | undefined = CHARACTER_MAP[characterId];
  if (!def) throw new Error(`角色不存在: ${characterId}`);
  const stats = statsAtLevel(def.baseStats, def.growth, level);
  const learnedSkills = def.skills.filter((id) => {
    const skill = SKILL_MAP[id];
    return skill && skill.learnLevel <= level;
  });
  return {
    id: genEntityId('player'),
    type: 'player',
    position: { ...position },
    facing: 0,
    velocity: { x: 0, y: 0 },
    speed: 120 + stats.spd * 10,
    faction: 'player',
    element: def.element,
    stats,
    hp: stats.hp,
    maxHp: stats.hp,
    mp: stats.mp,
    maxMp: stats.mp,
    level,
    sprite: def.sprite,
    name: def.name,
    skills: learnedSkills,
    skillCooldowns: new Map(),
    equipment: {},
    buffs: [],
    isAlive: true,
    isInvulnerable: false,
    invulnerableTimer: 0,
    attackTimer: 0,
    attackInterval: 500,
    dodgeTimer: 0,
    isDodging: false,
    characterId,
  };
}

/** 从角色定义创建队友实体 */
export function createTeammateEntity(characterId: string, position: Vec2, level: number): Entity {
  const entity = createPlayerEntity(characterId, position, level);
  entity.id = genEntityId('ally');
  entity.type = 'teammate';
  entity.ai = 'idle';
  entity.aiTimer = 0;
  return entity;
}

/** 从怪物定义创建怪物实体 */
export function createMonsterEntity(monsterId: string, position: Vec2): Entity {
  const def: MonsterDef | undefined = MONSTER_MAP[monsterId];
  if (!def) throw new Error(`怪物不存在: ${monsterId}`);
  return {
    id: genEntityId('enemy'),
    type: 'monster',
    position: { ...position },
    facing: 0,
    velocity: { x: 0, y: 0 },
    speed: 80 + def.stats.spd * 10,
    faction: 'enemy',
    element: def.element,
    stats: { ...def.stats },
    hp: def.stats.hp,
    maxHp: def.stats.hp,
    mp: def.stats.mp,
    maxMp: def.stats.mp,
    level: def.level,
    sprite: def.sprite,
    name: def.name,
    skills: [...def.skills],
    skillCooldowns: new Map(),
    ai: 'patrol',
    aiTimer: 0,
    equipment: {},
    buffs: [],
    isAlive: true,
    isInvulnerable: false,
    invulnerableTimer: 0,
    attackTimer: 0,
    attackInterval: def.ai === 'boss' ? 1500 : 1000,
    dodgeTimer: 0,
    isDodging: false,
    expReward: def.expReward,
    goldReward: def.goldReward,
    drops: def.drops,
    monsterId,
  };
}

/** 创建 NPC 实体 */
export function createNpcEntity(npcId: string, position: Vec2, dialogueId?: string): Entity {
  const def: NpcDef | undefined = NPCS[npcId];
  if (!def) throw new Error(`NPC 不存在: ${npcId}`);
  return {
    id: genEntityId('npc'),
    type: 'npc',
    position: { ...position },
    facing: 0,
    velocity: { x: 0, y: 0 },
    speed: 0,
    faction: 'neutral',
    element: 'wind',
    stats: { hp: 1, mp: 0, atk: 0, def: 0, mag: 0, res: 0, spd: 0, crit: 0, critDmg: 1 },
    hp: 1,
    maxHp: 1,
    mp: 0,
    maxMp: 0,
    level: 1,
    sprite: def.sprite,
    name: def.name,
    skills: [],
    skillCooldowns: new Map(),
    equipment: {},
    buffs: [],
    isAlive: true,
    isInvulnerable: true,
    invulnerableTimer: 0,
    attackTimer: 0,
    attackInterval: 0,
    dodgeTimer: 0,
    isDodging: false,
    npcId,
    dialogueId: dialogueId ?? def.defaultDialogue,
  };
}

/** 创建投射物实体 */
export function createProjectileEntity(
  ownerId: string,
  skillId: string,
  position: Vec2,
  facing: number,
  damage: number,
  element: Element | undefined,
  targetId?: string,
  aoeRadius?: number,
): Entity {
  const speed = 400;
  return {
    id: genEntityId('proj'),
    type: 'projectile',
    position: { ...position },
    facing,
    velocity: {
      x: Math.cos(facing) * speed,
      y: Math.sin(facing) * speed,
    },
    speed,
    faction: 'neutral',
    element: element ?? 'wind',
    stats: { hp: 1, mp: 0, atk: 0, def: 0, mag: 0, res: 0, spd: 0, crit: 0, critDmg: 1 },
    hp: 1,
    maxHp: 1,
    mp: 0,
    maxMp: 0,
    level: 1,
    sprite: { kind: 'placeholder', shape: 'circle', color: 0xffff88, size: 8 },
    name: '投射物',
    skills: [],
    skillCooldowns: new Map(),
    equipment: {},
    buffs: [],
    isAlive: true,
    isInvulnerable: false,
    invulnerableTimer: 0,
    attackTimer: 0,
    attackInterval: 0,
    dodgeTimer: 0,
    isDodging: false,
    projectile: {
      ownerId,
      skillId,
      damage,
      element,
      targetId,
      aoeRadius,
      lifetime: 3000,
    },
  };
}
