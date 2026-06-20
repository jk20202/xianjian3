// combat/ai.ts
// AI 行为：队友 + 怪物的状态机
// 设计文档 3.4 节：
// - 战士/剑士：贴近平A + 冷却好就用近战技能
// - 法师：保持距离，敌人靠近就放法术后拉开
// - 治疗：血量最低队友 < 50% 时优先治疗，否则平A补刀
// - 怪物 melee: 追击玩家/队友，近距离平A
// - 怪物 ranged: 保持距离，放法术
// - 怪物 boss: 追击 + 技能轮换

import type { World } from '../ecs/world';
import type { Entity } from '../ecs/entity';
import { dist, angleTo, inRange } from '../core/math';
import { bus } from '../core/eventBus';
import { useSkill, canUseSkill } from './skills';
import { calculateDamage } from './damage';
import { CHARACTER_MAP } from '../data/characters';
import { SKILL_MAP } from '../data/skills';

/** 更新队友 AI */
export function updateTeammateAI(world: World, entity: Entity, dt: number): void {
  if (!entity.isAlive || !entity.ai) return;
  const dtSec = dt / 1000;

  // 获取角色定义判断职业
  const charDef = entity.characterId ? CHARACTER_MAP[entity.characterId] : null;
  if (!charDef) return;

  const role = charDef.role;
  const nearestEnemy = world.nearestEnemy(entity.position, 400);
  const player = world.player();

  // 跟随玩家
  if (player && !nearestEnemy) {
    const distToPlayer = dist(entity.position, player.position);
    if (distToPlayer > 80) {
      const angle = angleTo(entity.position, player.position);
      entity.velocity.x = Math.cos(angle) * entity.speed * 0.8;
      entity.velocity.y = Math.sin(angle) * entity.speed * 0.8;
      entity.facing = angle;
    } else {
      entity.velocity.x = 0;
      entity.velocity.y = 0;
    }
    return;
  }

  if (!nearestEnemy) {
    entity.velocity.x = 0;
    entity.velocity.y = 0;
    return;
  }

  const distToEnemy = dist(entity.position, nearestEnemy.position);

  switch (role) {
    case 'warrior':
    case 'swordsman':
      // 近战：贴近 → 平A / 技能
      if (distToEnemy > 50) {
        // 追击
        const angle = angleTo(entity.position, nearestEnemy.position);
        entity.velocity.x = Math.cos(angle) * entity.speed;
        entity.velocity.y = Math.sin(angle) * entity.speed;
        entity.facing = angle;
      } else {
        // 在攻击范围内
        entity.velocity.x = 0;
        entity.velocity.y = 0;
        entity.facing = angleTo(entity.position, nearestEnemy.position);
        entity.attackTimer -= dt;
        if (entity.attackTimer <= 0) {
          // 尝试用技能
          let usedSkill = false;
          for (const skillId of entity.skills) {
            const check = canUseSkill(entity, skillId);
            if (check.ok) {
              const skill = SKILL_MAP[skillId];
              if (skill && (skill.type === 'physical') && inRange(entity.position, nearestEnemy.position, skill.range)) {
                useSkill(world, entity, skillId);
                entity.attackTimer = skill.cooldown;
                usedSkill = true;
                break;
              }
            }
          }
          if (!usedSkill) {
            // 平A
            meleeAttack(world, entity, nearestEnemy);
            entity.attackTimer = entity.attackInterval;
          }
        }
      }
      break;

    case 'mage': {
      // 法师：保持距离，敌人靠近就放法术
      const idealRange = 200;
      if (distToEnemy < idealRange - 50) {
        // 太近，后撤
        const angle = angleTo(nearestEnemy.position, entity.position);
        entity.velocity.x = Math.cos(angle) * entity.speed;
        entity.velocity.y = Math.sin(angle) * entity.speed;
        entity.facing = angleTo(entity.position, nearestEnemy.position);
      } else if (distToEnemy > idealRange + 50) {
        // 太远，靠近
        const angle = angleTo(entity.position, nearestEnemy.position);
        entity.velocity.x = Math.cos(angle) * entity.speed * 0.8;
        entity.velocity.y = Math.sin(angle) * entity.speed * 0.8;
        entity.facing = angle;
      } else {
        // 在理想距离，施法
        entity.velocity.x = 0;
        entity.velocity.y = 0;
        entity.facing = angleTo(entity.position, nearestEnemy.position);
        entity.attackTimer -= dt;
        if (entity.attackTimer <= 0) {
          let usedSkill = false;
          for (const skillId of entity.skills) {
            const check = canUseSkill(entity, skillId);
            if (check.ok) {
              const skill = SKILL_MAP[skillId];
              if (skill && skill.type === 'magic' && inRange(entity.position, nearestEnemy.position, skill.range)) {
                useSkill(world, entity, skillId);
                entity.attackTimer = skill.cooldown;
                usedSkill = true;
                break;
              }
            }
          }
          if (!usedSkill) {
            meleeAttack(world, entity, nearestEnemy);
            entity.attackTimer = entity.attackInterval;
          }
        }
      }
      break;
    }

    case 'healer': {
      // 治疗：优先治疗血量最低队友
      const lowAlly = world.lowestHpAlly();
      if (lowAlly && lowAlly.hp / lowAlly.maxHp < 0.5) {
        // 尝试治疗技能
        entity.attackTimer -= dt;
        if (entity.attackTimer <= 0) {
          for (const skillId of entity.skills) {
            const skill = SKILL_MAP[skillId];
            if (skill && skill.type === 'heal') {
              const check = canUseSkill(entity, skillId);
              if (check.ok && inRange(entity.position, lowAlly.position, skill.range)) {
                useSkill(world, entity, skillId);
                entity.attackTimer = skill.cooldown;
                break;
              }
            }
          }
        }
      } else if (nearestEnemy && distToEnemy < 250) {
        // 没人需要治疗，补刀
        entity.facing = angleTo(entity.position, nearestEnemy.position);
        entity.attackTimer -= dt;
        if (entity.attackTimer <= 0) {
          meleeAttack(world, entity, nearestEnemy);
          entity.attackTimer = entity.attackInterval;
        }
      }
      // 跟随玩家
      if (player) {
        const distToPlayer = dist(entity.position, player.position);
        if (distToPlayer > 100) {
          const angle = angleTo(entity.position, player.position);
          entity.velocity.x = Math.cos(angle) * entity.speed * 0.8;
          entity.velocity.y = Math.sin(angle) * entity.speed * 0.8;
        } else {
          entity.velocity.x *= 0.5;
          entity.velocity.y *= 0.5;
        }
      }
      break;
    }
  }

  // 应用移动
  entity.position.x += entity.velocity.x * dtSec;
  entity.position.y += entity.velocity.y * dtSec;
}

/** 更新怪物 AI */
export function updateMonsterAI(world: World, entity: Entity, dt: number): void {
  if (!entity.isAlive || !entity.ai) return;
  const dtSec = dt / 1000;

  const nearestAlly = world.nearestAlly(entity.position, 400);
  if (!nearestAlly) {
    // 巡逻：缓慢移动
    entity.aiTimer = (entity.aiTimer ?? 0) - dt;
    if (entity.aiTimer <= 0) {
      // 随机改变方向
      entity.facing = Math.random() * Math.PI * 2;
      entity.aiTimer = 2000 + Math.random() * 2000;
    }
    entity.velocity.x = Math.cos(entity.facing) * entity.speed * 0.3;
    entity.velocity.y = Math.sin(entity.facing) * entity.speed * 0.3;
    entity.position.x += entity.velocity.x * dtSec;
    entity.position.y += entity.velocity.y * dtSec;
    return;
  }

  const distToTarget = dist(entity.position, nearestAlly.position);
  const monsterDef = entity.monsterId;
  const isBoss = entity.sprite.size >= 40; // Boss 体型大

  if (isBoss) {
    // Boss AI：追击 + 技能轮换
    if (distToTarget > 60) {
      const angle = angleTo(entity.position, nearestAlly.position);
      entity.velocity.x = Math.cos(angle) * entity.speed;
      entity.velocity.y = Math.sin(angle) * entity.speed;
      entity.facing = angle;
    } else {
      entity.velocity.x = 0;
      entity.velocity.y = 0;
      entity.facing = angleTo(entity.position, nearestAlly.position);
      entity.attackTimer -= dt;
      if (entity.attackTimer <= 0) {
        // 尝试用技能
        let usedSkill = false;
        for (const skillId of entity.skills) {
          const check = canUseSkill(entity, skillId);
          if (check.ok) {
            const skill = SKILL_MAP[skillId];
            if (skill && inRange(entity.position, nearestAlly.position, skill.range)) {
              useSkill(world, entity, skillId);
              entity.attackTimer = skill.cooldown;
              usedSkill = true;
              break;
            }
          }
        }
        if (!usedSkill) {
          meleeAttack(world, entity, nearestAlly);
          entity.attackTimer = entity.attackInterval;
        }
      }
    }
  } else {
    // 普通怪 AI
    const isRanged = entity.skills.some((id) => {
      const s = SKILL_MAP[id];
      return s && s.type === 'magic';
    });

    if (isRanged) {
      // 远程怪：保持距离
      const idealRange = 180;
      if (distToTarget < idealRange - 40) {
        const angle = angleTo(nearestAlly.position, entity.position);
        entity.velocity.x = Math.cos(angle) * entity.speed;
        entity.velocity.y = Math.sin(angle) * entity.speed;
      } else if (distToTarget > idealRange + 40) {
        const angle = angleTo(entity.position, nearestAlly.position);
        entity.velocity.x = Math.cos(angle) * entity.speed;
        entity.velocity.y = Math.sin(angle) * entity.speed;
      } else {
        entity.velocity.x = 0;
        entity.velocity.y = 0;
        entity.facing = angleTo(entity.position, nearestAlly.position);
        entity.attackTimer -= dt;
        if (entity.attackTimer <= 0) {
          let usedSkill = false;
          for (const skillId of entity.skills) {
            const check = canUseSkill(entity, skillId);
            if (check.ok) {
              const skill = SKILL_MAP[skillId];
              if (skill && inRange(entity.position, nearestAlly.position, skill.range)) {
                useSkill(world, entity, skillId);
                entity.attackTimer = skill.cooldown;
                usedSkill = true;
                break;
              }
            }
          }
          if (!usedSkill) {
            meleeAttack(world, entity, nearestAlly);
            entity.attackTimer = entity.attackInterval;
          }
        }
      }
    } else {
      // 近战怪：追击 + 平A
      if (distToTarget > 40) {
        const angle = angleTo(entity.position, nearestAlly.position);
        entity.velocity.x = Math.cos(angle) * entity.speed;
        entity.velocity.y = Math.sin(angle) * entity.speed;
        entity.facing = angle;
      } else {
        entity.velocity.x = 0;
        entity.velocity.y = 0;
        entity.facing = angleTo(entity.position, nearestAlly.position);
        entity.attackTimer -= dt;
        if (entity.attackTimer <= 0) {
          meleeAttack(world, entity, nearestAlly);
          entity.attackTimer = entity.attackInterval;
        }
      }
    }
  }

  // 应用移动
  entity.position.x += entity.velocity.x * dtSec;
  entity.position.y += entity.velocity.y * dtSec;
}

/** 近战平A */
function meleeAttack(_world: World, attacker: Entity, target: Entity): void {
  const result = calculateDamage(attacker, target, null);
  target.hp -= result.damage;
  bus.emit('entity:damaged', {
    target: target.id,
    source: attacker.id,
    amount: result.damage,
    crit: result.crit,
  });
  if (target.hp <= 0) {
    target.hp = 0;
    target.isAlive = false;
    bus.emit('entity:died', { entity: target.id });
  }
}
