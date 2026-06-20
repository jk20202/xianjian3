// combat/damage.ts
// 伤害计算公式（设计文档 3.5 节）
// 基础伤害 = 攻击力 × 技能倍率
// 防御减免 = 基础 / (基础 + 防御力)  软防御
// 属性修正 = 克制 ×1.5 / 被克 ×0.75 / 无关 ×1.0
// 暴击 = 暴击率判定 ? × 暴击伤害 : ×1.0
// 波动 = ±10% 随机

import type { Entity } from '../ecs/entity';
import type { SkillDef } from '../data/skills';
import { elementModifier } from '../data/element';
import { chance, randFloat } from '../core/math';

/** 伤害计算结果 */
export interface DamageResult {
  damage: number;
  crit: boolean;
  elementMod: number;   // 1.5 / 0.75 / 1.0
  isHeal?: boolean;
}

/** 获取攻击力（物理 or 法术，取决于技能类型） */
function getAttackPower(attacker: Entity, skill: SkillDef | null): number {
  if (!skill) return attacker.stats.atk; // 平A = 物理
  if (skill.type === 'magic' || skill.type === 'heal') return attacker.stats.mag;
  return attacker.stats.atk;
}

/** 获取防御力（物理 or 法术） */
function getDefensePower(defender: Entity, skill: SkillDef | null): number {
  if (!skill) return defender.stats.def;
  if (skill.type === 'magic') return defender.stats.res;
  return defender.stats.def;
}

/**
 * 核心伤害公式
 * @param attacker 攻击者
 * @param defender 防御者
 * @param skill 使用的技能，null = 平A
 */
export function calculateDamage(
  attacker: Entity,
  defender: Entity,
  skill: SkillDef | null,
): DamageResult {
  const attackPower = getAttackPower(attacker, skill);
  const skillPower = skill ? skill.power : 1.0; // 平A倍率 1.0

  // 基础伤害
  const base = attackPower * skillPower;

  // 防御减免（软防御公式）
  const defense = getDefensePower(defender, skill);
  const defMod = base / (base + defense);

  // 属性修正
  const atkElement = skill?.element ?? attacker.element;
  const defElement = defender.element;
  const elementMod = elementModifier(atkElement, defElement);

  // 暴击判定
  const critRate = attacker.stats.crit;
  const isCrit = chance(critRate);
  const critMod = isCrit ? attacker.stats.critDmg : 1.0;

  // 波动 ±10%
  const fluctuation = randFloat(0.9, 1.1);

  // 最终伤害
  const damage = Math.round(base * defMod * elementMod * critMod * fluctuation);

  return { damage: Math.max(1, damage), crit: isCrit, elementMod };
}

/**
 * 治疗计算
 * @param healer 治疗者
 * @param target 治疗目标
 * @param skill 治疗技能
 */
export function calculateHeal(healer: Entity, _target: Entity, skill: SkillDef): number {
  const base = healer.stats.mag * skill.power;
  const fluctuation = randFloat(0.9, 1.1);
  return Math.round(base * fluctuation);
}
