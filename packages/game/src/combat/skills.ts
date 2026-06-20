// combat/skills.ts
// 技能执行：检查可用性、消耗 MP、设置冷却、生成投射物/范围判定

import type { Entity } from '../ecs/entity';
import type { World } from '../ecs/world';
import type { SkillDef } from '../data/skills';
import { SKILL_MAP } from '../data/skills';
import { bus } from '../core/eventBus';
import { inRange, dist, angleTo } from '../core/math';
import { createProjectileEntity } from '../ecs/entity';
import { calculateDamage, calculateHeal } from './damage';

/** 检查技能是否可用 */
export function canUseSkill(caster: Entity, skillId: string): { ok: boolean; reason?: string } {
  const skill = SKILL_MAP[skillId];
  if (!skill) return { ok: false, reason: '技能不存在' };
  if (!caster.skills.includes(skillId)) return { ok: false, reason: '未学会该技能' };
  if (caster.mp < skill.mpCost) return { ok: false, reason: '真气不足' };
  const cd = caster.skillCooldowns.get(skillId);
  if (cd && cd > 0) return { ok: false, reason: '冷却中' };
  return { ok: true };
}

/** 执行技能，返回是否成功施放 */
export function useSkill(world: World, caster: Entity, skillId: string): boolean {
  const skill = SKILL_MAP[skillId];
  if (!skill) return false;
  const check = canUseSkill(caster, skillId);
  if (!check.ok) return false;

  // 消耗 MP
  caster.mp -= skill.mpCost;
  // 设置冷却
  caster.skillCooldowns.set(skillId, skill.cooldown);
  // 广播技能使用事件
  bus.emit('skill:used', { caster: caster.id, skillId });

  // 根据技能类型执行
  switch (skill.type) {
    case 'physical':
      executePhysicalSkill(world, caster, skill);
      break;
    case 'magic':
      executeMagicSkill(world, caster, skill);
      break;
    case 'heal':
      executeHealSkill(world, caster, skill);
      break;
    case 'buff':
      executeBuffSkill(world, caster, skill);
      break;
  }
  return true;
}

/** 物理技能：近战扇形判定或投射物 */
function executePhysicalSkill(world: World, caster: Entity, skill: SkillDef): void {
  if (skill.targetType === 'aoe_enemy') {
    // AOE 物理技能：范围伤害
    const range = skill.range;
    const aoeRadius = skill.aoeRadius ?? 60;
    const enemies = world.enemiesInRange(caster.position, range);
    for (const enemy of enemies) {
      if (inRange(caster.position, enemy.position, aoeRadius)) {
        applyDamage(caster, enemy, skill);
      }
    }
  } else {
    // 单体物理：扇形判定
    const range = skill.range;
    const enemies = world.enemiesInRange(caster.position, range);
    // 选最近的
    const target = enemies.reduce<{ entity: Entity; d: number } | null>((best, e) => {
      const d = dist(caster.position, e.position);
      if (!best || d < best.d) return { entity: e, d };
      return best;
    }, null);
    if (target) {
      // 朝向目标
      caster.facing = angleTo(caster.position, target.entity.position);
      applyDamage(caster, target.entity, skill);
    }
  }
}

/** 法术技能：投射物或范围 */
function executeMagicSkill(world: World, caster: Entity, skill: SkillDef): void {
  if (skill.targetType === 'aoe_enemy') {
    // AOE 法术：直接在范围内造成伤害
    const range = skill.range;
    const aoeRadius = skill.aoeRadius ?? 80;
    const enemies = world.enemiesInRange(caster.position, range);
    for (const enemy of enemies) {
      if (inRange(caster.position, enemy.position, aoeRadius)) {
        applyDamage(caster, enemy, skill);
      }
    }
  } else {
    // 单体法术：发射投射物
    const target = world.nearestEnemy(caster.position, skill.range);
    if (target) {
      caster.facing = angleTo(caster.position, target.position);
      const baseDamage = caster.stats.mag * skill.power;
      const proj = createProjectileEntity(
        caster.id,
        skill.id,
        { ...caster.position },
        caster.facing,
        baseDamage,
        skill.element,
        target.id,
      );
      world.add(proj);
    }
  }
}

/** 治疗技能 */
function executeHealSkill(world: World, caster: Entity, skill: SkillDef): void {
  if (skill.targetType === 'aoe_ally') {
    // 群体治疗
    const aoeRadius = skill.aoeRadius ?? 150;
    const allies = world.alliesInRange(caster.position, aoeRadius);
    for (const ally of allies) {
      const heal = calculateHeal(caster, ally, skill);
      ally.hp = Math.min(ally.maxHp, ally.hp + heal);
      bus.emit('entity:damaged', {
        target: ally.id,
        source: caster.id,
        amount: -heal,
        crit: false,
      });
    }
  } else {
    // 单体治疗：治疗血量最低的队友
    const target = world.lowestHpAlly(caster.id) ?? caster;
    const heal = calculateHeal(caster, target, skill);
    target.hp = Math.min(target.maxHp, target.hp + heal);
    bus.emit('entity:damaged', {
      target: target.id,
      source: caster.id,
      amount: -heal,
      crit: false,
    });
  }
}

/** Buff 技能 */
function executeBuffSkill(world: World, caster: Entity, skill: SkillDef): void {
  const target = skill.targetType === 'self' ? caster : (world.lowestHpAlly(caster.id) ?? caster);
  target.buffs.push({
    id: `${skill.id}_${Date.now()}`,
    name: skill.name,
    kind: 'buff_def',
    value: skill.power || 0.1,
    remaining: 10000,
    total: 10000,
  });
}

/** 应用伤害到目标 */
function applyDamage(attacker: Entity, defender: Entity, skill: SkillDef): void {
  const result = calculateDamage(attacker, defender, skill);
  defender.hp -= result.damage;
  bus.emit('entity:damaged', {
    target: defender.id,
    source: attacker.id,
    amount: result.damage,
    crit: result.crit,
    element: skill.element,
  });
  if (defender.hp <= 0) {
    defender.hp = 0;
    defender.isAlive = false;
    bus.emit('entity:died', { entity: defender.id });
  }
}

/** 更新所有实体的技能冷却 */
export function updateCooldowns(world: World, dt: number): void {
  for (const entity of world.all()) {
    if (entity.skillCooldowns.size === 0) continue;
    const expired: string[] = [];
    for (const [skillId, remaining] of entity.skillCooldowns) {
      const newCd = remaining - dt;
      if (newCd <= 0) {
        expired.push(skillId);
      } else {
        entity.skillCooldowns.set(skillId, newCd);
      }
    }
    for (const id of expired) {
      entity.skillCooldowns.delete(id);
    }
  }
}
