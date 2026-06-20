// combat/CombatSystem.ts
// 战斗协调器：整合技能、AI、投射物、Buff、死亡处理
// 由场景层每帧调用 update(dt)

import type { World } from '../ecs/world';
import type { Entity } from '../ecs/entity';
import type { InputState } from '../core/input';
import { bus } from '../core/eventBus';
import { angleTo, dist, inRange, clamp } from '../core/math';
import { calculateDamage } from './damage';
import { useSkill, canUseSkill, updateCooldowns } from './skills';
import { updateProjectiles } from './projectiles';
import { updateTeammateAI, updateMonsterAI } from './ai';
import { SKILL_MAP } from '../data/skills';
import { ECONOMY } from '../data/economy';

export class CombatSystem {
  private world: World;
  /** 回调：击杀怪物后给奖励 */
  onMonsterKilled?: (entity: Entity) => void;
  /** 回调：玩家死亡 */
  onPlayerDeath?: () => void;

  constructor(world: World) {
    this.world = world;
  }

  /** 每帧更新 */
  update(dt: number): void {
    // 更新冷却
    updateCooldowns(this.world, dt);

    // 更新投射物
    updateProjectiles(this.world, dt);

    // 更新 Buff
    this.updateBuffs(dt);

    // 更新无敌时间
    this.updateInvulnerability(dt);

    // 更新队友 AI
    for (const ally of this.world.teammates()) {
      updateTeammateAI(this.world, ally, dt);
    }

    // 更新怪物 AI
    for (const enemy of this.world.byType('monster')) {
      if (enemy.isAlive) {
        updateMonsterAI(this.world, enemy, dt);
      }
    }

    // 处理死亡
    this.handleDeaths();

    // 刷新实体队列
    this.world.flush();
  }

  /** 玩家平A：扇形判定 */
  playerAttack(): void {
    const player = this.world.player();
    if (!player || !player.isAlive) return;
    player.attackTimer -= 16; // 近似帧时间
    if (player.attackTimer > 0) return;

    const range = 60;
    const halfAngle = Math.PI / 4; // 45度半张角
    const enemies = this.world.enemiesInRange(player.position, range);

    let hit = false;
    for (const enemy of enemies) {
      const angle = angleTo(player.position, enemy.position);
      let delta = Math.abs(angle - player.facing);
      if (delta > Math.PI) delta = Math.PI * 2 - delta;
      if (delta <= halfAngle) {
        const result = calculateDamage(player, enemy, null);
        enemy.hp -= result.damage;
        bus.emit('entity:damaged', {
          target: enemy.id,
          source: player.id,
          amount: result.damage,
          crit: result.crit,
        });
        if (enemy.hp <= 0) {
          enemy.hp = 0;
          enemy.isAlive = false;
          bus.emit('entity:died', { entity: enemy.id });
        }
        hit = true;
      }
    }
    if (hit || true) {
      player.attackTimer = player.attackInterval;
    }
  }

  /** 玩家使用技能（slot 0-4） */
  playerUseSkill(slot: number): void {
    const player = this.world.player();
    if (!player || !player.isAlive) return;
    if (slot < 0 || slot >= player.skills.length) return;
    const skillId = player.skills[slot];
    if (!skillId) return;
    const check = canUseSkill(player, skillId);
    if (!check.ok) return;
    useSkill(this.world, player, skillId);
  }

  /** 玩家翻滚：短无敌 + 冲刺 */
  playerDodge(): void {
    const player = this.world.player();
    if (!player || !player.isAlive) return;
    if (player.dodgeTimer > 0) return;
    player.isInvulnerable = true;
    player.invulnerableTimer = 300; // 300ms 无敌
    player.dodgeTimer = 1000;       // 1s 冷却
    // 冲刺
    const dashDist = 80;
    player.position.x += Math.cos(player.facing) * dashDist;
    player.position.y += Math.sin(player.facing) * dashDist;
  }

  /** 更新 Buff */
  private updateBuffs(dt: number): void {
    for (const entity of this.world.all()) {
      if (entity.buffs.length === 0) continue;
      const expired: number[] = [];
      entity.buffs.forEach((buff, i) => {
        buff.remaining -= dt;
        if (buff.remaining <= 0) expired.push(i);
      });
      // 从后往前删除
      for (let i = expired.length - 1; i >= 0; i--) {
        entity.buffs.splice(expired[i], 1);
      }
    }
  }

  /** 更新无敌时间 */
  private updateInvulnerability(dt: number): void {
    for (const entity of this.world.all()) {
      if (entity.isInvulnerable) {
        entity.invulnerableTimer -= dt;
        if (entity.invulnerableTimer <= 0) {
          entity.isInvulnerable = false;
        }
      }
      if (entity.dodgeTimer > 0) {
        entity.dodgeTimer -= dt;
      }
    }
  }

  /** 处理死亡实体 */
  private handleDeaths(): void {
    for (const entity of this.world.all()) {
      if (entity.isAlive) continue;
      if (entity.type === 'monster' && !entity.hp) {
        // 怪物死亡：给奖励
        this.onMonsterKilled?.(entity);
        this.world.remove(entity.id);
      } else if (entity.type === 'player') {
        // 玩家死亡
        this.onPlayerDeath?.();
      }
    }
  }
}
