// core/types.ts
// 全局共享类型定义。所有模块通过这些类型通信，不直接依赖 PixiJS 具体对象。

/** 五灵属性（仙剑系列设定）：风雷水火土循环相克 */
export type Element = 'wind' | 'thunder' | 'water' | 'fire' | 'earth';

/** 角色定位 */
export type Role = 'warrior' | 'swordsman' | 'mage' | 'healer';

/** 二维向量（像素坐标） */
export interface Vec2 {
  x: number;
  y: number;
}

/** 视觉资源引用 —— MVP 用几何占位代号，换皮时改这里即可 */
export interface VisualRef {
  kind: 'placeholder';
  shape: 'circle' | 'rect' | 'triangle' | 'diamond';
  color: number;       // 0xRRGGBB
  size: number;        // 直径或边长（像素）
  label?: string;
}

/** 技能类型 */
export type SkillType = 'physical' | 'magic' | 'heal' | 'buff';

/** 技能目标类型 */
export type TargetType = 'enemy' | 'ally' | 'self' | 'aoe_enemy' | 'aoe_ally';

/** 实体阵营 */
export type Faction = 'player' | 'enemy' | 'neutral';

/** 实体朝向（8 方向，用角度更通用） */
export type Facing = number; // 弧度

/** 战斗实体 ID */
export type EntityId = string;

/** 事件总线事件名 */
export type GameEvent =
  | 'player:damaged'
  | 'entity:damaged'
  | 'entity:died'
  | 'skill:used'
  | 'skill:cooldown'
  | 'level:up'
  | 'quest:accepted'
  | 'quest:progress'
  | 'quest:completed'
  | 'dialogue:start'
  | 'dialogue:end'
  | 'scene:change'
  | 'save:requested'
  | 'save:done'
  | 'save:loaded'
  | 'combat:start'
  | 'combat:end';

/** 事件载荷映射 */
export interface EventPayloadMap {
  'entity:damaged': { target: EntityId; source?: EntityId; amount: number; crit: boolean; element?: Element };
  'entity:died': { entity: EntityId };
  'skill:used': { caster: EntityId; skillId: string };
  'level:up': { entity: EntityId; level: number };
  'scene:change': { from: string; to: string };
  'save:done': { slot: string };
  'save:loaded': { slot: string };
  [key: string]: unknown;
}
