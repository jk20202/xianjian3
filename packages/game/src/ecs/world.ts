// ecs/world.ts
// 世界管理器：实体存储、查询、更新
// 所有实体都在 World 中注册，战斗/场景模块通过 World 查询和操作实体

import type { Entity, EntityType } from './entity';
import type { Faction, Vec2 } from '../core/types';
import { dist, inRange } from '../core/math';

export class World {
  /** 所有实体，按 id 索引 */
  private entities = new Map<string, Entity>();
  /** 待添加队列（避免遍历中修改） */
  private pendingAdd: Entity[] = [];
  /** 待移除队列 */
  private pendingRemove = new Set<string>();

  /** 添加实体 */
  add(entity: Entity): void {
    this.pendingAdd.push(entity);
  }

  /** 移除实体 */
  remove(id: string): void {
    this.pendingRemove.add(id);
  }

  /** 按 id 获取实体 */
  get(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  /** 获取所有实体 */
  all(): Entity[] {
    return [...this.entities.values()];
  }

  /** 按类型查询 */
  byType(type: EntityType): Entity[] {
    return this.all().filter((e) => e.type === type);
  }

  /** 按阵营查询 */
  byFaction(faction: Faction): Entity[] {
    return this.all().filter((e) => e.faction === faction && e.isAlive);
  }

  /** 获取存活实体 */
  alive(): Entity[] {
    return this.all().filter((e) => e.isAlive);
  }

  /** 获取玩家阵营（玩家+队友） */
  allies(): Entity[] {
    return this.all().filter((e) => e.faction === 'player' && e.isAlive);
  }

  /** 获取敌方阵营 */
  enemies(): Entity[] {
    return this.all().filter((e) => e.faction === 'enemy' && e.isAlive);
  }

  /** 获取玩家实体 */
  player(): Entity | undefined {
    return this.all().find((e) => e.type === 'player');
  }

  /** 获取队友实体 */
  teammates(): Entity[] {
    return this.all().filter((e) => e.type === 'teammate' && e.isAlive);
  }

  /** 获取 NPC 实体 */
  npcs(): Entity[] {
    return this.all().filter((e) => e.type === 'npc');
  }

  /** 获取投射物 */
  projectiles(): Entity[] {
    return this.all().filter((e) => e.type === 'projectile' && e.isAlive);
  }

  /** 查找距离 pos 最近的敌方 */
  nearestEnemy(pos: Vec2, maxRange = Infinity): Entity | undefined {
    let best: Entity | undefined;
    let bestDist = maxRange;
    for (const e of this.enemies()) {
      const d = dist(pos, e.position);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  /** 查找距离 pos 最近的友方（含玩家） */
  nearestAlly(pos: Vec2, maxRange = Infinity, excludeId?: string): Entity | undefined {
    let best: Entity | undefined;
    let bestDist = maxRange;
    for (const e of this.allies()) {
      if (e.id === excludeId) continue;
      const d = dist(pos, e.position);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  /** 查找血量最低的友方 */
  lowestHpAlly(excludeId?: string): Entity | undefined {
    let best: Entity | undefined;
    let bestRatio = 1.1;
    for (const e of this.allies()) {
      if (e.id === excludeId) continue;
      const ratio = e.hp / e.maxHp;
      if (ratio < bestRatio) {
        bestRatio = ratio;
        best = e;
      }
    }
    return best;
  }

  /** 范围内的敌方 */
  enemiesInRange(pos: Vec2, range: number): Entity[] {
    return this.enemies().filter((e) => inRange(pos, e.position, range));
  }

  /** 范围内的友方 */
  alliesInRange(pos: Vec2, range: number, excludeId?: string): Entity[] {
    return this.allies().filter((e) => e.id !== excludeId && inRange(pos, e.position, range));
  }

  /** 刷新队列：处理待添加/移除 */
  flush(): void {
    for (const entity of this.pendingAdd) {
      this.entities.set(entity.id, entity);
    }
    this.pendingAdd = [];
    for (const id of this.pendingRemove) {
      this.entities.delete(id);
    }
    this.pendingRemove.clear();
  }

  /** 清空所有实体 */
  clear(): void {
    this.entities.clear();
    this.pendingAdd = [];
    this.pendingRemove.clear();
  }

  /** 获取实体数量 */
  get size(): number {
    return this.entities.size;
  }
}
