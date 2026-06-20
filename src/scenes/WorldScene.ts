import Phaser from 'phaser';
import type { MapDef, EnemyDef, PartyMember, SkillDef } from '../types';
import { getMap } from '../data/maps';
import { ENEMIES } from '../data/enemies';
import { getSkill } from '../data/skills';
import { GameContext } from '../core/GameContext';
import { SaveManager } from '../core/SaveManager';
import { elementMultiplier, ELEMENT_COLOR, ELEMENT_LABEL } from '../core/elements';
import { autoStoryFor, getStoryNode, STORY } from '../data/story';

interface EnemyState {
  def: EnemyDef;
  hp: number;
  maxHp: number;
  sprite: Phaser.Physics.Arcade.Sprite;
  lastAttack: number;
  vx: number; vy: number;
  hurtFlash: number;
}

interface Projectile {
  sprite: Phaser.GameObjects.Image;
  vx: number; vy: number;
  damage: number;
  element: string;
  fromPlayer: boolean;
  skill: SkillDef;
  life: number;
  aoe?: number;
}

/** 世界场景:地图 + 自由移动 + ARPG 即时战斗 */
export class WorldScene extends Phaser.Scene {
  map!: MapDef;
  tileLayer!: Phaser.GameObjects.Container;
  wallBodies!: Phaser.Physics.Arcade.StaticGroup;
  player!: Phaser.Physics.Arcade.Sprite;
  playerSpeed = 180;
  enemies: EnemyState[] = [];
  projectiles: Projectile[] = [];
  encounterCooldown = 0;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  skillKeys: string[] = [];
  activeMemberIdx = 0;
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  lastAutoSave = 0;
  paused = false;
  combatLockUntil = 0;

  constructor() { super('WorldScene'); }

  init(data: { fromMenu?: boolean }) {
    this.enemies = [];
    this.projectiles = [];
    this.encounterCooldown = 0;
    this.activeMemberIdx = 0;
  }

  create() {
    const mapId = GameContext.currentMap;
    this.map = getMap(mapId);
    this.buildMap();
    this.spawnPlayer();
    this.bindInput();
    this.spawnEnemies();
    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setZoom(1.1);

    // 地图名提示
    this.showMapTitle(this.map.name);

    // 进入地图自动剧情
    this.time.delayedCall(800, () => this.checkAutoStory());

    // 自动存档(每 30s)
    this.time.addEvent({ delay: 30000, loop: true, callback: () => this.doAutosave() });

    // 场景事件
    this.events.on('resume', () => { this.paused = false; });
    this.events.on('pause', () => { this.paused = true; });

    // 监听 UI 场景的存档/菜单请求
    this.sys.events.on('open-save', (mode: string) => {
      this.scene.pause().launch('SaveScene', { mode, returnScene: 'WorldScene' });
    });
    this.sys.events.on('resume-world', () => {
      this.scene.resume();
    });
  }

  // ===== 地图构建 =====
  private buildMap() {
    const m = this.map;
    // 背景
    this.cameras.main.setBackgroundColor(m.bg);
    this.add.rectangle(0, 0, m.width * m.tilesize, m.height * m.tilesize, m.bg).setOrigin(0);

    this.tileLayer = this.add.container(0, 0);
    this.wallBodies = this.physics.add.staticGroup();
    const TS = m.tilesize;

    for (let y = 0; y < m.height; y++) {
      for (let x = 0; x < m.width; x++) {
        const t = m.tiles[y][x];
        const px = x * TS, py = y * TS;
        let tex = 'tile_floor';
        if (t === 1) tex = 'tile_wall';
        else if (t === 2) tex = 'tile_grass';
        else if (t === 5) tex = 'tile_shop';
        else if (t === 6) tex = 'tile_story';
        const tile = this.add.image(px, py, tex).setOrigin(0);
        this.tileLayer.add(tile);
        if (t === 1) {
          // 障碍:添加物理碰撞体
          const body = this.add.rectangle(px + TS / 2, py + TS / 2, TS, TS, 0x000000, 0) as unknown as Phaser.GameObjects.Rectangle;
          this.wallBodies.add(body);
        }
      }
    }

    // 出口标记
    for (const ex of m.exits) {
      const ring = this.add.circle(ex.x, ex.y, 14, 0x000000, 0).setStrokeStyle(2, 0xc9b072, 0.7);
      this.tileLayer.add(ring);
    }

    // NPC
    for (const npc of m.npcs) {
      const sp = this.add.image(npc.x, npc.y, 'npc_generic').setTint(npc.color);
      const label = this.add.text(npc.x, npc.y - 22, npc.name, {
        fontSize: '11px', color: '#e8d9a0', backgroundColor: '#00000088', padding: { x: 4, y: 1 },
      }).setOrigin(0.5);
      sp.setInteractive({ useHandCursor: true });
      sp.on('pointerdown', () => this.interactNPC(npc.id));
      this.tileLayer.add(sp); this.tileLayer.add(label);
    }
  }

  private spawnPlayer() {
    const leader = GameContext.leader;
    const tex = `player_${leader.id}`;
    this.player = this.physics.add.sprite(GameContext.playerX, GameContext.playerY, tex);
    this.player.setCircle(12, 8, 12);
    this.player.setCollideWorldBounds(true);
    this.physics.world.setBounds(0, 0, this.map.width * this.map.tilesize, this.map.height * this.map.tilesize);
    this.physics.add.collider(this.player, this.wallBodies);
  }

  private bindInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
      J: Phaser.Input.Keyboard.KeyCodes.J,
      K: Phaser.Input.Keyboard.KeyCodes.K,
      L: Phaser.Input.Keyboard.KeyCodes.L,
      U: Phaser.Input.Keyboard.KeyCodes.U,
      I: Phaser.Input.Keyboard.KeyCodes.I,
      O: Phaser.Input.Keyboard.KeyCodes.O,
      E: Phaser.Input.Keyboard.KeyCodes.E,
      TAB: Phaser.Input.Keyboard.KeyCodes.TAB,
      ESC: Phaser.Input.Keyboard.KeyCodes.ESC,
      SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
    }) as Record<string, Phaser.Input.Keyboard.Key>;

    // 鼠标平A
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.leftButtonDown() && !this.paused) this.doBasicAttack();
    });

    // 技能键
    this.skillKeys = ['K', 'L', 'U', 'I', 'O'];
    for (const k of this.skillKeys) {
      this.keys[k].on('down', () => this.tryCastSkill(this.skillKeys.indexOf(k)));
    }
    this.keys.TAB.on('down', () => this.switchMember());
    this.keys.E.on('down', () => this.interactNearby());
    this.keys.SPACE.on('down', () => this.interactNearby());
    this.keys.ESC.on('down', () => this.openPauseMenu());
  }

  // ===== 敌人 =====
  private spawnEnemies() {
    const m = this.map;
    if (m.encounters.length === 0) return;
    // 初始散布若干敌人
    const count = m.id === 'yuzhou' ? 3 : 6;
    for (let i = 0; i < count; i++) this.spawnOneEnemy();
  }

  private spawnOneEnemy(near?: { x: number; y: number }) {
    const m = this.map;
    if (m.encounters.length === 0) return;
    const id = m.encounters[Math.floor(Math.random() * m.encounters.length)];
    const def = ENEMIES[id];
    if (!def) return;
    const TS = m.tilesize;
    let x: number, y: number, tries = 0;
    do {
      if (near) {
        const a = Math.random() * Math.PI * 2, d = 200 + Math.random() * 150;
        x = near.x + Math.cos(a) * d; y = near.y + Math.sin(a) * d;
      } else {
        x = (2 + Math.floor(Math.random() * (m.width - 4))) * TS;
        y = (2 + Math.floor(Math.random() * (m.height - 4))) * TS;
      }
      tries++;
    } while ((m.tiles[Math.floor(y / TS)]?.[Math.floor(x / TS)] === 1) && tries < 20);

    const sprite = this.physics.add.sprite(x, y, `enemy_${id}`);
    sprite.setCircle(def.radius, 16 - def.radius, 16 - def.radius);
    sprite.setCollideWorldBounds(true);
    this.physics.add.collider(sprite, this.wallBodies);

    const state: EnemyState = {
      def, hp: def.hp, maxHp: def.hp, sprite, lastAttack: 0, vx: 0, vy: 0, hurtFlash: 0,
    };
    this.enemies.push(state);

    // 血条
    const hpbar = this.add.rectangle(x, y - def.radius - 8, def.radius * 2, 4, 0x440000).setOrigin(0.5);
    const hpfill = this.add.rectangle(x, y - def.radius - 8, def.radius * 2, 4, 0xff5555).setOrigin(0.5);
    sprite.setData('hpbar', hpbar); sprite.setData('hpfill', hpfill);
  }

  // ===== 主循环 =====
  update(time: number, delta: number) {
    if (this.paused) return;
    this.handleMovement(delta);
    this.updateEnemies(time, delta);
    this.updateProjectiles(delta);
    this.updateHpBars();
    this.checkExits();
    this.checkEncounterSpawn(time);
    this.updateSkillCooldowns(delta);
  }

  private handleMovement(delta: number) {
    let vx = 0, vy = 0;
    if (this.keys.A.isDown || this.cursors.left.isDown) vx -= 1;
    if (this.keys.D.isDown || this.cursors.right.isDown) vx += 1;
    if (this.keys.W.isDown || this.cursors.up.isDown) vy -= 1;
    if (this.keys.S.isDown || this.cursors.down.isDown) vy += 1;
    const len = Math.hypot(vx, vy) || 1;
    const leader = GameContext.leader;
    const spd = this.playerSpeed * (1 + (leader.spd - 10) * 0.01);
    this.player.setVelocity((vx / len) * spd, (vy / len) * spd);

    // 朝向(用于攻击方向)
    if (vx !== 0 || vy !== 0) {
      this.player.setData('facing', { x: vx / len, y: vy / len });
    }

    // 记录位置到 context
    GameContext.playerX = this.player.x;
    GameContext.playerY = this.player.y;
  }

  // ===== 战斗:平A =====
  private doBasicAttack() {
    const now = this.time.now;
    if (now < this.combatLockUntil) return;
    const leader = GameContext.leader;
    const basic = getSkill('basic_attack');
    this.combatLockUntil = now + basic.castTime;
    const facing = (this.player.getData('facing') as { x: number; y: number }) ?? { x: 1, y: 0 };
    this.spawnProjectile(leader, basic, facing, this.player.x, this.player.y);
    this.flashPlayer(ELEMENT_COLOR[leader.element]);
  }

  // ===== 战斗:技能 =====
  private tryCastSkill(slot: number) {
    const now = this.time.now;
    if (now < this.combatLockUntil) return;
    const leader = GameContext.leader;
    // 技能栏:取已学技能中前 5 个(排除平A)
    const skills = leader.skills.filter(s => s !== 'basic_attack').slice(0, 5);
    if (slot >= skills.length) return;
    const skillId = skills[slot];
    const skill = getSkill(skillId);

    // 冷却
    const cdKey = `${leader.id}:${skillId}`;
    const lastCd = GameContext.skillCooldowns[cdKey] ?? 0;
    if (now < lastCd) return;

    // 消耗
    if (!this.consumeCost(leader, skill)) {
      this.toastUI('资源不足');
      return;
    }

    GameContext.skillCooldowns[cdKey] = now + skill.cooldown;
    this.combatLockUntil = now + skill.castTime;

    // 朝向:鼠标方向,否则 facing
    const facing = this.getAimDirection();

    if (skill.range === 'self') {
      this.castSelfSkill(leader, skill);
    } else if (skill.range === 'all') {
      // 全体:直接对所有敌人造成伤害(范围爆发)
      this.castAoeSkill(leader, skill);
    } else {
      // 单体/投射物
      this.spawnProjectile(leader, skill, facing, this.player.x, this.player.y);
    }
    this.flashPlayer(skill.effectColor);
    this.emitSkillFx(skill, this.player.x, this.player.y, facing);
  }

  private consumeCost(member: PartyMember, skill: SkillDef): boolean {
    switch (skill.costType) {
      case 'shen': if (member.shen < skill.cost) return false; member.shen -= skill.cost; return true;
      case 'qi': if (member.qi < skill.cost) return false; member.qi -= skill.cost; return true;
      case 'hp': if (member.hp < skill.cost) return false; member.hp -= skill.cost; return true;
      case 'money':
        if (GameContext.money < skill.cost) return false;
        GameContext.money -= skill.cost; return true;
    }
  }

  private getAimDirection(): { x: number; y: number } {
    const ptr = this.input.activePointer;
    const wx = this.cameras.main.scrollX + ptr.x;
    const wy = this.cameras.main.scrollY + ptr.y;
    const dx = wx - this.player.x, dy = wy - this.player.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  private castSelfSkill(member: PartyMember, skill: SkillDef) {
    if (skill.heal) {
      const heal = Math.floor(member.maxHp * skill.heal);
      member.hp = Math.min(member.maxHp, member.hp + heal);
      this.spawnHealFx(this.player.x, this.player.y, skill.effectColor, heal);
    }
    if (skill.buff) {
      // 简化:临时记录到 sprite data(持续 8s)
      const buffs = (this.player.getData('buffs') as Record<string, number>) ?? {};
      for (const [k, v] of Object.entries(skill.buff)) buffs[k] = this.time.now + 8000;
      this.player.setData('buffs', buffs);
    }
  }

  private castAoeSkill(member: PartyMember, skill: SkillDef) {
    // 以玩家为中心的范围爆发
    const radius = 220;
    for (const e of this.enemies) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.sprite.x, e.sprite.y);
      if (d <= radius) {
        this.damageEnemy(e, member, skill, d);
      }
    }
    // 视觉:范围圆
    const ring = this.add.circle(this.player.x, this.player.y, 10, skill.effectColor, 0.3);
    this.tweens.add({ targets: ring, radius: radius, alpha: 0, duration: 400, onComplete: () => ring.destroy() });
  }

  private spawnProjectile(member: PartyMember, skill: SkillDef, dir: { x: number; y: number }, x: number, y: number) {
    const tex = skill.element ? `proj_${skill.element}` : 'proj_basic';
    const img = this.add.image(x + dir.x * 18, y + dir.y * 18, tex);
    const speed = 420;
    const p: Projectile = {
      sprite: img, vx: dir.x * speed, vy: dir.y * speed,
      damage: this.computePower(member, skill), element: skill.element ?? member.element,
      fromPlayer: true, skill, life: 1500,
    };
    this.projectiles.push(p);
  }

  private computePower(member: PartyMember, skill: SkillDef): number {
    let base = member.atk * skill.power;
    const buffs = (this.player.getData('buffs') as Record<string, number>) ?? {};
    if (buffs.atk && this.time.now < buffs.atk) base *= 1.2;
    return Math.floor(base);
  }

  // ===== 敌人 AI =====
  private updateEnemies(time: number, delta: number) {
    const toRemove: EnemyState[] = [];
    for (const e of this.enemies) {
      if (e.hp <= 0) { toRemove.push(e); continue; }
      const dist = Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, this.player.x, this.player.y);
      const leader = GameContext.leader;

      if (dist < e.def.detectRange) {
        // 朝玩家移动
        const dx = this.player.x - e.sprite.x, dy = this.player.y - e.sprite.y;
        const len = Math.hypot(dx, dy) || 1;
        const spd = 60 + e.def.spd * 6;
        if (e.def.ai === 'ranged') {
          // 远程:保持距离
          if (dist > e.def.attackRange * 0.8) {
            e.sprite.setVelocity((dx / len) * spd, (dy / len) * spd);
          } else if (dist < e.def.attackRange * 0.4) {
            e.sprite.setVelocity(-(dx / len) * spd, -(dy / len) * spd);
          } else {
            e.sprite.setVelocity(0, 0);
          }
          // 远程攻击
          if (dist < e.def.attackRange && time - e.lastAttack > 1800) {
            e.lastAttack = time;
            this.enemyRangedAttack(e, leader);
          }
        } else if (e.def.ai === 'charger') {
          // 冲锋:快速接近
          e.sprite.setVelocity((dx / len) * spd * 1.4, (dy / len) * spd * 1.4);
          if (dist < e.def.attackRange && time - e.lastAttack > 1200) {
            e.lastAttack = time;
            this.enemyMeleeAttack(e, leader);
          }
        } else if (e.def.ai === 'boss') {
          // BOSS:移动 + 周期技能
          e.sprite.setVelocity((dx / len) * spd * 0.8, (dy / len) * spd * 0.8);
          if (dist < e.def.attackRange && time - e.lastAttack > 1500) {
            e.lastAttack = time;
            this.enemyBossAttack(e, leader);
          }
        } else {
          // 近战
          e.sprite.setVelocity((dx / len) * spd, (dy / len) * spd);
          if (dist < e.def.attackRange && time - e.lastAttack > 1400) {
            e.lastAttack = time;
            this.enemyMeleeAttack(e, leader);
          }
        }
      } else {
        e.sprite.setVelocity(0, 0);
      }

      // 受击闪烁
      if (e.hurtFlash > 0) {
        e.hurtFlash -= delta;
        e.sprite.setTint(0xffffff);
        if (e.hurtFlash <= 0) e.sprite.clearTint();
      }
    }
    for (const e of toRemove) this.killEnemy(e);
  }

  private enemyMeleeAttack(e: EnemyState, target: PartyMember) {
    this.damagePlayer(target, e.def.atk, e.def.element);
    this.spawnHitFx(this.player.x, this.player.y, ELEMENT_COLOR[e.def.element]);
  }

  private enemyRangedAttack(e: EnemyState, target: PartyMember) {
    const dx = this.player.x - e.sprite.x, dy = this.player.y - e.sprite.y;
    const len = Math.hypot(dx, dy) || 1;
    const tex = `proj_${e.def.element}`;
    const img = this.add.image(e.sprite.x, e.sprite.y, tex);
    const speed = 300;
    this.projectiles.push({
      sprite: img, vx: (dx / len) * speed, vy: (dy / len) * speed,
      damage: e.def.atk, element: e.def.element, fromPlayer: false, skill: getSkill('basic_attack'), life: 2000,
    });
  }

  private enemyBossAttack(e: EnemyState, target: PartyMember) {
    // BOSS 随机:普攻 / 全体技能
    const skills = e.def.skills.filter(s => s !== 'basic_attack');
    if (skills.length && Math.random() < 0.5) {
      const sid = skills[Math.floor(Math.random() * skills.length)];
      const skill = getSkill(sid);
      // 全体技能:范围爆发
      const radius = 260;
      this.damagePlayer(target, Math.floor(e.def.atk * skill.power), skill.element ?? e.def.element);
      const ring = this.add.circle(e.sprite.x, e.sprite.y, 10, skill.effectColor, 0.4);
      this.tweens.add({ targets: ring, radius, alpha: 0, duration: 500, onComplete: () => ring.destroy() });
      this.spawnHitFx(this.player.x, this.player.y, skill.effectColor);
    } else {
      this.enemyRangedAttack(e, target);
    }
  }

  // ===== 伤害结算 =====
  private damageEnemy(e: EnemyState, member: PartyMember, skill: SkillDef, dist = 0) {
    let dmg = this.computePower(member, skill);
    const mult = skill.element ? elementMultiplier(skill.element, e.def.element) : 1;
    dmg = Math.floor(dmg * mult * (1 - e.def.def * 0.01));
    dmg = Math.max(1, dmg);
    e.hp -= dmg;
    e.hurtFlash = 120;
    // 击退
    const dx = e.sprite.x - this.player.x, dy = e.sprite.y - this.player.y;
    const len = Math.hypot(dx, dy) || 1;
    e.sprite.x += (dx / len) * 6; e.sprite.y += (dy / len) * 6;

    this.spawnDamageText(e.sprite.x, e.sprite.y - e.def.radius, dmg, mult > 1 ? 0xffd97a : 0xffffff, mult > 1);
    if (mult > 1) this.toastUI(`${ELEMENT_LABEL[skill.element!]}克${ELEMENT_LABEL[e.def.element]}!`);

    // 吸血/治疗类
    if (skill.heal) {
      const heal = Math.floor(member.maxHp * skill.heal);
      member.hp = Math.min(member.maxHp, member.hp + heal);
    }

    if (e.hp <= 0) {
      // 击杀奖励
      const exp = e.def.exp;
      const money = e.def.money;
      GameContext.money += money;
      const { leveled } = GameContext.gainPartyExp(exp);
      this.spawnDamageText(e.sprite.x, e.sprite.y - 30, `+${exp}EXP`, 0x7fd87f, false);
      if (leveled.length) {
        for (const lv of leveled) {
          this.toastUI(`${lv.name} 升级!${lv.skills.length ? '习得:' + lv.skills.map(s => getSkill(s).name).join(',') : ''}`);
        }
      }
    }
  }

  private damagePlayer(member: PartyMember, rawDmg: number, element: string) {
    let dmg = rawDmg;
    const mult = elementMultiplier(element as any, member.element);
    dmg = Math.floor(dmg * mult * (1 - member.def * 0.012));
    dmg = Math.max(1, dmg);
    member.hp -= dmg;
    this.cameras.main.shake(80, 0.004);
    this.spawnDamageText(this.player.x, this.player.y - 20, dmg, 0xff5555, false);
    this.player.setTint(0xff8888);
    this.time.delayedCall(120, () => this.player.clearTint());

    if (member.hp <= 0) {
      member.hp = 0;
      this.onPlayerDown();
    }
  }

  private onPlayerDown() {
    // 简化:全员阵亡 -> 回城复活
    const anyAlive = GameContext.party.some(p => p.inParty && p.hp > 0);
    if (!anyAlive) {
      this.paused = true;
      this.toastUI('全员阵亡…传送回渝州城');
      this.time.delayedCall(1500, () => {
        for (const m of GameContext.party) { m.hp = Math.floor(m.maxHp * 0.5); m.inParty = true; }
        GameContext.currentMap = 'yuzhou';
        GameContext.playerX = 20 * 32; GameContext.playerY = 15 * 32;
        this.scene.restart();
      });
    } else {
      this.switchMember();
    }
  }

  private killEnemy(e: EnemyState) {
    e.sprite.getData('hpbar')?.destroy();
    e.sprite.getData('hpfill')?.destroy();
    e.sprite.destroy();
    this.enemies = this.enemies.filter(x => x !== e);
  }

  // ===== 投射物 =====
  private updateProjectiles(delta: number) {
    const TS = this.map.tilesize;
    const toRemove: Projectile[] = [];
    for (const p of this.projectiles) {
      p.sprite.x += p.vx * delta / 1000;
      p.sprite.y += p.vy * delta / 1000;
      p.life -= delta;
      // 出界/超时
      if (p.life <= 0 || p.sprite.x < 0 || p.sprite.y < 0 ||
          p.sprite.x > this.map.width * TS || p.sprite.y > this.map.height * TS) {
        toRemove.push(p); continue;
      }
      // 撞墙
      const tx = Math.floor(p.sprite.x / TS), ty = Math.floor(p.sprite.y / TS);
      if (this.map.tiles[ty]?.[tx] === 1) { toRemove.push(p); continue; }

      if (p.fromPlayer) {
        for (const e of this.enemies) {
          if (Phaser.Math.Distance.Between(p.sprite.x, p.sprite.y, e.sprite.x, e.sprite.y) < e.def.radius + 6) {
            const leader = GameContext.leader;
            this.damageEnemy(e, leader, p.skill);
            toRemove.push(p);
            this.spawnHitFx(p.sprite.x, p.sprite.y, p.skill.effectColor);
            break;
          }
        }
      } else {
        if (Phaser.Math.Distance.Between(p.sprite.x, p.sprite.y, this.player.x, this.player.y) < 16) {
          this.damagePlayer(GameContext.leader, p.damage, p.element);
          toRemove.push(p);
          this.spawnHitFx(p.sprite.x, p.sprite.y, ELEMENT_COLOR[p.element as keyof typeof ELEMENT_COLOR] ?? 0xffffff);
        }
      }
    }
    for (const p of toRemove) { p.sprite.destroy(); this.projectiles = this.projectiles.filter(x => x !== p); }
  }

  // ===== 视觉特效 =====
  private spawnDamageText(x: number, y: number, value: number | string, color: number, crit: boolean) {
    const t = this.add.text(x, y, String(value), {
      fontSize: crit ? '20px' : '15px', color: '#' + color.toString(16).padStart(6, '0'),
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);
    this.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }

  private spawnHitFx(x: number, y: number, color: number) {
    for (let i = 0; i < 6; i++) {
      const s = this.add.image(x, y, 'spark').setTint(color);
      const a = Math.random() * Math.PI * 2, d = 20 + Math.random() * 30;
      this.tweens.add({ targets: s, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, duration: 300, onComplete: () => s.destroy() });
    }
  }

  private spawnHealFx(x: number, y: number, color: number, amount: number) {
    this.spawnDamageText(x, y - 20, `+${amount}`, 0x7fff7f, false);
    const ring = this.add.circle(x, y, 8, color, 0.4);
    this.tweens.add({ targets: ring, radius: 40, alpha: 0, duration: 500, onComplete: () => ring.destroy() });
  }

  private emitSkillFx(skill: SkillDef, x: number, y: number, dir: { x: number; y: number }) {
    const ring = this.add.circle(x, y, 6, skill.effectColor, 0.5);
    this.tweens.add({ targets: ring, radius: 24, alpha: 0, duration: 250, onComplete: () => ring.destroy() });
  }

  private flashPlayer(color: number) {
    this.player.setTint(color);
    this.time.delayedCall(80, () => this.player.clearTint());
  }

  private updateHpBars() {
    for (const e of this.enemies) {
      const bar = e.sprite.getData('hpbar') as Phaser.GameObjects.Rectangle;
      const fill = e.sprite.getData('hpfill') as Phaser.GameObjects.Rectangle;
      if (bar && fill) {
        bar.x = e.sprite.x; bar.y = e.sprite.y - e.def.radius - 8;
        fill.y = e.sprite.y - e.def.radius - 8;
        fill.width = (e.hp / e.maxHp) * e.def.radius * 2;
        fill.x = e.sprite.x - e.def.radius;
      }
    }
  }

  private updateSkillCooldowns(delta: number) {
    // 冷却由 GameContext.skillCooldowns 时间戳管理,UI 场景读取显示
  }

  // ===== 遇敌刷新 =====
  private checkEncounterSpawn(time: number) {
    // 保持地图敌人数量
    const target = this.map.id === 'yuzhou' ? 3 : 6;
    if (this.enemies.length < target && time > this.encounterCooldown) {
      this.spawnOneEnemy({ x: this.player.x, y: this.player.y });
      this.encounterCooldown = time + 4000;
    }
  }

  // ===== 出口传送 =====
  private checkExits() {
    for (const ex of this.map.exits) {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, ex.x, ex.y) < 20) {
        this.transitionMap(ex.to, ex.toSpawn);
        return;
      }
    }
  }

  private transitionMap(toMapId: string, toSpawn?: { x: number; y: number }) {
    const target = getMap(toMapId);
    const spawn = toSpawn ?? target.spawns;
    GameContext.currentMap = toMapId;
    GameContext.playerX = spawn.x;
    GameContext.playerY = spawn.y;
    this.doAutosave();
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.restart());
  }

  // ===== 交互 =====
  private interactNearby() {
    // 检查附近 NPC / 剧情点
    for (const npc of this.map.npcs) {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y) < 40) {
        this.interactNPC(npc.id); return;
      }
    }
    // 剧情点(tile=6)
    const TS = this.map.tilesize;
    const tx = Math.floor(this.player.x / TS), ty = Math.floor(this.player.y / TS);
    for (const node of Object.values(STORY)) {
      if (node.trigger.map === this.map.id && !node.trigger.auto &&
          node.trigger.x != null && node.trigger.y != null) {
        const nx = Math.floor(node.trigger.x / TS), ny = Math.floor(node.trigger.y / TS);
        if (Math.abs(nx - tx) <= 1 && Math.abs(ny - ty) <= 1) {
          this.triggerStory(node.id); return;
        }
      }
    }
  }

  private interactNPC(npcId: string) {
    // 简单 NPC 对话
    if (npcId === 'npc_zhao' && !GameContext.hasFlag('appraised')) {
      this.triggerStory('ch1_zhao'); return;
    }
    if (npcId === 'npc_shop_w') { this.openShop('weapon'); return; }
    if (npcId === 'npc_shop_p') { this.openShop('potion'); return; }
    if (npcId === 'npc_qingwei' && !GameContext.hasFlag('longkui_joined')) {
      this.triggerStory('ch2_shushan'); return;
    }
    if (npcId === 'npc_qingwei' && GameContext.hasFlag('longkui_joined') && !GameContext.hasFlag('beat_tianyao')) {
      this.triggerStory('ch3_locktower'); return;
    }
    // 蜀山掌门:击败天妖皇后引导去古藤林
    if (npcId === 'npc_qingwei' && GameContext.hasFlag('beat_tianyao') && !GameContext.hasFlag('learn_feilong')) {
      this.runCustomDialog('掌门清微', 0xe0e0e0,
        '天妖皇已除,甚好。然邪剑仙未灭,须寻五灵珠之力。古藤林中有异人精精,可传你飞龙探云手,速往!');
      return;
    }
    // 古藤林精精
    if (npcId === 'npc_jingjing' && !GameContext.hasFlag('learn_feilong')) {
      this.triggerStory('ch4_gutenglin'); return;
    }
    // 酆都冶炼师(商店)
    if (npcId === 'npc_yelian') { this.openShop('weapon'); return; }
    // 酆都鬼卒
    if (npcId === 'npc_ghost') {
      this.runCustomDialog('鬼卒', 0x8888aa, '前方熔岩地狱,火鬼王凶悍,水灵之力方可克制。');
      return;
    }
    // 默认闲聊
    const npc = this.map.npcs.find(n => n.id === npcId);
    if (npc) {
      this.runCustomDialog(npc.name, 0xc9b072, '江湖路远,少侠保重。');
    }
  }

  private runCustomDialog(speaker: string, color: number, text: string) {
    this.paused = true;
    this.scene.pause().launch('DialogScene', {
      mode: 'story', nodeId: null, customLines: [{ speaker, color, text }],
    });
  }

  private openShop(type: 'weapon' | 'potion') {
    this.paused = true;
    this.scene.pause().launch('DialogScene', {
      mode: 'shop', shopType: type,
    });
  }

  // ===== 剧情 =====
  private checkAutoStory() {
    const node = autoStoryFor(this.map.id);
    if (node && !GameContext.completedNodes.has(node.id)) {
      // 检查前置条件
      if (node.condition && !GameContext.hasFlag(node.condition)) return;
      this.triggerStory(node.id);
    }
  }

  private triggerStory(nodeId: string) {
    const node = getStoryNode(nodeId);
    if (GameContext.completedNodes.has(node.id)) return;
    if (node.condition && !GameContext.hasFlag(node.condition)) {
      this.toastUI('条件未达成'); return;
    }
    this.paused = true;
    this.scene.pause().launch('DialogScene', { mode: 'story', nodeId: node.id });
  }

  // ===== 切换角色 =====
  private switchMember() {
    const party = GameContext.party.filter(p => p.inParty && p.hp > 0);
    if (party.length <= 1) return;
    this.activeMemberIdx = (this.activeMemberIdx + 1) % party.length;
    const m = party[this.activeMemberIdx];
    this.player.setTexture(`player_${m.id}`);
    this.toastUI(`操控:${m.name}【${ELEMENT_LABEL[m.element]}】`);
  }

  // ===== 暂停菜单 =====
  private openPauseMenu() {
    this.paused = true;
    this.scene.pause().launch('DialogScene', { mode: 'pause' });
  }

  private doAutosave() {
    GameContext.autosave();
  }

  // ===== UI 反馈 =====
  private toastUI(msg: string) {
    this.events.emit('ui-toast', msg);
  }

  private showMapTitle(name: string) {
    const t = this.add.text(this.scale.width / 2, 80, `— ${name} —`, {
      fontFamily: 'serif', fontSize: '26px', color: '#e8d9a0',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1000).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 400, hold: 1500, yoyo: true, onComplete: () => t.destroy() });
  }

  // 供 DialogScene 回调
  handleStoryComplete(nodeId: string) {
    const node = getStoryNode(nodeId);
    GameContext.completeNode(node.id);
    if (node.setFlag) GameContext.setFlag(node.setFlag);
    if (node.reward) {
      if (node.reward.exp) GameContext.gainPartyExp(node.reward.exp);
      if (node.reward.money) GameContext.money += node.reward.money;
      if (node.reward.skill) {
        const leader = GameContext.leader;
        if (!leader.skills.includes(node.reward.skill)) leader.skills.push(node.reward.skill);
      }
    }
    if (node.id === 'ch2_shushan') {
      GameContext.joinParty('longkui', GameContext.leader.level);
    }
    // 第4章酆都:紫萱加入
    if (node.id === 'ch4_fengdu') {
      GameContext.joinParty('zixuan', GameContext.leader.level);
    }
    // 第5章冰风谷:雪见归魂加入;长卿同行
    if (node.id === 'ch5_bingfenggu') {
      GameContext.joinParty('xuejian', GameContext.leader.level);
      GameContext.joinParty('changqing', GameContext.leader.level);
    }
    GameContext.activeQuest = node.unlocks?.[0] ?? null;
    this.paused = false;
    this.scene.resume();
    this.doAutosave();
  }

  handleShopClose() {
    this.paused = false;
    this.scene.resume();
  }

  handlePauseResume() {
    this.paused = false;
    this.scene.resume();
  }
}
