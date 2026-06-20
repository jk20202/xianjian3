// tests/damage.test.ts
// 伤害计算单元测试

import { describe, it, expect } from 'vitest';
import { calculateDamage } from '../src/combat/damage';
import type { Entity } from '../src/ecs/entity';
import type { SkillDef } from '../src/data/skills';

// 创建测试用实体
function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: 'test',
    type: 'player',
    position: { x: 0, y: 0 },
    facing: 0,
    velocity: { x: 0, y: 0 },
    speed: 100,
    faction: 'player',
    element: 'fire',
    stats: {
      hp: 100, mp: 50, atk: 20, def: 10, mag: 15, res: 8,
      spd: 3, crit: 0.1, critDmg: 1.5,
    },
    hp: 100,
    maxHp: 100,
    mp: 50,
    maxMp: 50,
    level: 1,
    sprite: { kind: 'placeholder', shape: 'circle', color: 0xff0000, size: 20 },
    name: '测试',
    skills: [],
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
    ...overrides,
  };
}

const basicSkill: SkillDef = {
  id: 'test_skill',
  name: '测试技能',
  type: 'physical',
  targetType: 'enemy',
  range: 100,
  mpCost: 5,
  cooldown: 1000,
  power: 1.5,
  learnLevel: 1,
  effect: { kind: 'placeholder', shape: 'circle', color: 0xffffff, size: 20 },
};

describe('伤害计算', () => {
  it('平A应该造成伤害', () => {
    const attacker = makeEntity();
    const defender = makeEntity({ faction: 'enemy', element: 'earth' });
    const result = calculateDamage(attacker, defender, null);
    expect(result.damage).toBeGreaterThan(0);
    expect(result.damage).toBeLessThan(100);
  });

  it('技能应该造成伤害', () => {
    const attacker = makeEntity();
    const defender = makeEntity({ faction: 'enemy', element: 'earth' });
    const result = calculateDamage(attacker, defender, basicSkill);
    expect(result.damage).toBeGreaterThan(0);
  });

  it('属性克制应该增加伤害', () => {
    // 火克土
    const attacker = makeEntity({ element: 'fire' });
    const defender = makeEntity({ faction: 'enemy', element: 'earth' });
    const result = calculateDamage(attacker, defender, null);
    expect(result.elementMod).toBe(1.5);
  });

  it('属性被克应该减少伤害', () => {
    // 土被火克（火克土，所以土攻击火是被克）
    const attacker = makeEntity({ element: 'earth' });
    const defender = makeEntity({ faction: 'enemy', element: 'fire' });
    const result = calculateDamage(attacker, defender, null);
    expect(result.elementMod).toBe(0.75);
  });

  it('无属性关系应该正常伤害', () => {
    // 火与雷互不克制
    const attacker = makeEntity({ element: 'fire' });
    const defender = makeEntity({ faction: 'enemy', element: 'thunder' });
    const result = calculateDamage(attacker, defender, null);
    expect(result.elementMod).toBe(1);
  });
});
