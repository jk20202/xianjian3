// combat/projectiles.ts
// 投射物更新：移动、碰撞、命中、过期清理

import type { World } from '../ecs/world';
import type { Entity } from '../ecs/entity';
import { dist, inRange } from '../core/math';
import { bus } from '../core/eventBus';
import { calculateDamage } from './damage';
import { SKILL_MAP } from '../data/skills';

/** 更新所有投射物 */
export function updateProjectiles(world: World, dt: number): void {
  const dtSec = dt / 1000;
  for (const proj of world.projectiles()) {
    if (!proj.projectile) continue;

    // 移动
    proj.position.x += proj.velocity.x * dtSec;
    proj.position.y += proj.velocity.y * dtSec;

    // 减少生命期
    proj.projectile.lifetime -= dt;
    if (proj.projectile.lifetime <= 0) {
      proj.isAlive = false;
      continue;
    }

    // 检查碰撞
    const ownerId = proj.projectile.ownerId;
    const owner = world.get(ownerId);
    if (!owner) {
      proj.isAlive = false;
      continue;
    }

    const skill = SKILL_MAP[proj.projectile.skillId];
    if (!skill) {
      proj.isAlive = false;
      continue;
    }

    // 检查命中敌方
    const hitRadius = 16; // 命中判定半径
    for (const enemy of world.enemies()) {
      if (dist(proj.position, enemy.position) <= hitRadius) {
        // 命中
        applyProjectileDamage(owner, enemy, proj);
        // AOE 命中
        if (proj.projectile.aoeRadius && proj.projectile.aoeRadius > 0) {
          for (const aoeTarget of world.enemies()) {
            if (aoeTarget.id === enemy.id) continue;
            if (inRange(proj.position, aoeTarget.position, proj.projectile.aoeRadius)) {
              applyProjectileDamage(owner, aoeTarget, proj);
            }
          }
        }
        proj.isAlive = false;
        break;
      }
    }
  }
}

/** 投射物造成伤害 */
function applyProjectileDamage(attacker: Entity, defender: Entity, proj: Entity): void {
  if (!proj.projectile) return;
  const skill = SKILL_MAP[proj.projectile.skillId];
  if (!skill) return;
  const result = calculateDamage(attacker, defender, skill);
  defender.hp -= result.damage;
  bus.emit('entity:damaged', {
    target: defender.id,
    source: attacker.id,
    amount: result.damage,
    crit: result.crit,
    element: proj.projectile.element,
  });
  if (defender.hp <= 0) {
    defender.hp = 0;
    defender.isAlive = false;
    bus.emit('entity:died', { entity: defender.id });
  }
}
