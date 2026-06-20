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

/** 世界场景:地图 + 自由移动 + ARPG 即时战斗 + 虚拟摇杆 + 屏幕按钮 */
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

  // 虚拟摇杆
  private joyBase!: Phaser.GameObjects.Arc;
  private joyThumb!: Phaser.GameObjects.Arc;
  private joyCenter = { x: 0, y: 0 };
  private joyActive = false;
  private joyPointerId = -1;
  private joyDir = { x: 0, y: 0 };
  private joyMaxDist = 38;

  // UI 按钮引用
  private btnAttack!: Phaser.GameObjects.Arc;
  private skillBtns: Phaser.GameObjects.Arc[] = [];
  private skillLabels: Phaser.GameObjects.Text[] = [];

  constructor() { super('WorldScene'); }

  init(_data: { fromMenu?: boolean }) {
    this.enemies = [];
    this.projectiles = [];
    this.encounterCooldown = 0;
    this.activeMemberIdx = 0;
    this.joyActive = false;
    this.joyDir = { x: 0, y: 0 };
    this.joyPointerId = -1;
    this.skillBtns = [];
    this.skillLabels = [];
  }

  create() {
    const mapId = GameContext.currentMap;
    this.map = getMap(mapId);
    this.buildMap();
    this.spawnPlayer();
    this.bindInput();
    this.createVirtualJoystick();
    this.createAttackButton();
    this.createSkillButtons();
    this.spawnEnemies();
    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setZoom(1.1);

    this.showMapTitle(this.map.name);
    this.time.delayedCall(800, () => this.checkAutoStory());
    this.time.addEvent({ delay: 30000, loop: true, callback: () => this.doAutosave() });

    this.events.on('resume', () => { this.paused = false; });
    this.events.on('pause', () => { this.paused = true; });

    this.sys.events.on('open-save', (_mode: string) => {
      this.scene.pause().launch('SaveScene', { mode: _mode, returnScene: 'WorldScene' });
    });
    this.sys.events.on('resume-world', () => {
      this.scene.resume();
    });
  }

  // ===== 地图构建 =====
  private buildMap() {
    const m = this.map;
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
          const wall = this.add.image(px + TS / 2, py + TS / 2, 'tile_wall').setVisible(false);
          this.physics.add.existing(wall, true);
          this.wallBodies.add(wall);
        }
      }
    }

    this.scatterDecorations();

    for (const ex of m.exits) {
      const ring = this.add.circle(ex.x, ex.y, 16, 0xc9b072, 0.15).setStrokeStyle(2, 0xffe9a0, 0.8);
      this.tweens.add({ targets: ring, alpha: 0.4, yoyo: true, repeat: -1, duration: 800 });
      this.tileLayer.add(ring);
    }

    for (const npc of m.npcs) {
      const sp = this.add.image(npc.x, npc.y, 'npc_generic').setTint(npc.color);
      const label = this.add.text(npc.x, npc.y - 24, npc.name, {
        fontSize: '11px', color: '#e8d9a0', backgroundColor: '#000000aa', padding: { x: 5, y: 2 },
      }).setOrigin(0.5);
      const bubble = this.add.text(npc.x, npc.y - 40, '!', {
        fontSize: '14px', color: '#ffd97a', fontStyle: 'bold',
      }).setOrigin(0.5);
      this.tweens.add({ targets: bubble, y: npc.y - 44, yoyo: true, repeat: -1, duration: 600 });
      sp.setInteractive({ useHandCursor: true });
      sp.on('pointerdown', () => this.interactNPC(npc.id));
      this.tileLayer.add(sp); this.tileLayer.add(label); this.tileLayer.add(bubble);
    }
  }

  private scatterDecorations() {
    const m = this.map;
    const TS = m.tilesize;
    let seed = 0;
    for (let i = 0; i < m.id.length; i++) seed = (seed * 31 + m.id.charCodeAt(i)) | 0;
    const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

    const isWalkable = (px: number, py: number) => {
      const tx = Math.floor(px / TS), ty = Math.floor(py / TS);
      return m.tiles[ty]?.[tx] === 0 || m.tiles[ty]?.[tx] === 2;
    };

    const isTown = ['yuzhou', 'tangjiabao', 'fengdu'].includes(m.id);
    const isForest = ['bishan', 'gutenglin'].includes(m.id);
    const isMountain = ['shushan_road', 'shushan'].includes(m.id);
    const isFire = ['rongyan_diyu'].includes(m.id);
    const isIce = ['bingfenggu', 'haidicheng'].includes(m.id);
    const isGhost = ['fengdu', 'jianzhong'].includes(m.id);

    if (isMountain || isForest) {
      for (let i = 0; i < 4; i++) {
        const x = 100 + rand() * (m.width * TS - 200);
        const y = 60 + rand() * 40;
        const mt = this.add.image(x, y, 'deco_mountain').setAlpha(0.4).setScale(0.8 + rand() * 0.4);
        this.tileLayer.add(mt);
      }
    }

    const treeCount = isForest ? 40 : isTown ? 12 : isMountain ? 20 : 15;
    for (let i = 0; i < treeCount; i++) {
      let x: number, y: number, tries = 0;
      do {
        x = (2 + rand() * (m.width - 4)) * TS;
        y = (2 + rand() * (m.height - 4)) * TS;
        tries++;
      } while (!isWalkable(x, y) && tries < 10);
      if (tries >= 10) continue;
      const pine = isMountain || isIce;
      const tex = pine ? 'deco_tree_pine' : 'deco_tree';
      const tree = this.add.image(x, y + 16, tex).setScale(0.8 + rand() * 0.4);
      this.tileLayer.add(tree);
    }

    if (isForest || isTown) {
      for (let i = 0; i < 25; i++) {
        const x = (2 + rand() * (m.width - 4)) * TS;
        const y = (2 + rand() * (m.height - 4)) * TS;
        if (!isWalkable(x, y)) continue;
        const bush = this.add.image(x, y, 'deco_bush').setScale(0.7 + rand() * 0.5);
        this.tileLayer.add(bush);
      }
    }

    if (isTown || isForest) {
      for (let i = 0; i < 20; i++) {
        const x = (2 + rand() * (m.width - 4)) * TS;
        const y = (2 + rand() * (m.height - 4)) * TS;
        if (!isWalkable(x, y)) continue;
        const flower = this.add.image(x, y, 'deco_flower').setScale(0.6 + rand() * 0.4);
        this.tileLayer.add(flower);
      }
    }

    if (isMountain || isFire || isIce) {
      for (let i = 0; i < 18; i++) {
        const x = (2 + rand() * (m.width - 4)) * TS;
        const y = (2 + rand() * (m.height - 4)) * TS;
        if (!isWalkable(x, y)) continue;
        const rock = this.add.image(x, y, 'deco_rock').setScale(0.6 + rand() * 0.6).setTint(
          isIce ? 0xaaccee : isFire ? 0x884422 : 0xffffff
        );
        this.tileLayer.add(rock);
      }
    }

    if (isTown) {
      for (let i = 0; i < 8; i++) {
        const x = (3 + rand() * (m.width - 6)) * TS;
        const y = (3 + rand() * (m.height - 6)) * TS;
        if (!isWalkable(x, y)) continue;
        const lantern = this.add.image(x, y - 16, 'deco_lantern');
        this.tweens.add({ targets: lantern, alpha: 0.7, yoyo: true, repeat: -1, duration: 1200 + rand() * 800 });
        this.tileLayer.add(lantern);
      }
    }

    if (isTown) {
      const wellX = (m.width / 2) | 0;
      const wellY = (m.height / 2) | 0;
      if (m.tiles[wellY]?.[wellX] === 0) {
        const well = this.add.image(wellX * TS + TS / 2, wellY * TS + TS / 2, 'deco_well');
        this.tileLayer.add(well);
      }
    }

    if (isGhost || isFire) {
      for (let i = 0; i < 10; i++) {
        const x = (2 + rand() * (m.width - 4)) * TS;
        const y = (2 + rand() * (m.height - 4)) * TS;
        if (!isWalkable(x, y)) continue;
        const torch = this.add.image(x, y, 'deco_torch');
        this.tweens.add({ targets: torch, scaleX: 1.1, scaleY: 0.95, yoyo: true, repeat: -1, duration: 200 + rand() * 200 });
        this.tileLayer.add(torch);
      }
    }
  }

  private spawnPlayer() {
    const leader = GameContext.leader;
    const tex = `player_${leader.id}`;
    this.player = this.physics.add.sprite(GameContext.playerX, GameContext.playerY, tex);
    // 纹理 32x40,碰撞体贴合脚部
    this.player.body!.setSize(16, 12);
    this.player.body!.setOffset(8, 28);
    this.player.setCollideWorldBounds(true);
    this.physics.world.setBounds(0, 0, this.map.width * this.map.tilesize, this.map.height * this.map.tilesize);
    this.physics.add.collider(this.player, this.wallBodies);
  }

  // ===== 键盘输入 =====
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

    this.keys.J.on('down', () => { if (!this.paused) this.doBasicAttack(); });
    this.skillKeys = ['K', 'L', 'U', 'I', 'O'];
    for (const k of this.skillKeys) {
      this.keys[k].on('down', () => this.tryCastSkill(this.skillKeys.indexOf(k)));
    }
    this.keys.TAB.on('down', () => this.switchMember());
    this.keys.E.on('down', () => this.interactNearby());
    this.keys.SPACE.on('down', () => this.interactNearby());
    this.keys.ESC.on('down', () => this.openPauseMenu());
  }

  // ===== 虚拟摇杆(圆形方向盘) =====
  private createVirtualJoystick() {
    const joyX = 100, joyY = this.scale.height - 130;
    const baseRadius = 52;
    this.joyCenter = { x: joyX, y: joyY };
    this.joyMaxDist = baseRadius - 14;

    // 底盘(半透明圆环)
    this.joyBase = this.add.circle(joyX, joyY, baseRadius, 0x000000, 0.3)
      .setStrokeStyle(2, 0xc9b072, 0.5)
      .setScrollFactor(0)
      .setDepth(1000);

    // 摇杆头
    this.joyThumb = this.add.circle(joyX, joyY, 20, 0xc9b072, 0.55)
      .setStrokeStyle(2, 0xe8d9a0, 0.8)
      .setScrollFactor(0)
      .setDepth(1001);

    // 方向指示线(十字准星)
    const crossH = this.add.rectangle(joyX, joyY, baseRadius * 2, 1, 0xc9b072, 0.2).setScrollFactor(0).setDepth(999);
    const crossV = this.add.rectangle(joyX, joyY, 1, baseRadius * 2, 0xc9b072, 0.2).setScrollFactor(0).setDepth(999);

    // 触摸区域
    const hitArea = this.add.zone(joyX, joyY, baseRadius * 2.5, baseRadius * 2.5)
      .setScrollFactor(0).setDepth(1002).setInteractive();

    hitArea.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.joyActive = true;
      this.joyPointerId = p.id;
      this.updateJoystick(p);
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.joyActive && p.id === this.joyPointerId) {
        this.updateJoystick(p);
      }
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.id === this.joyPointerId) {
        this.joyActive = false;
        this.joyPointerId = -1;
        this.joyThumb.setPosition(this.joyCenter.x, this.joyCenter.y);
        this.joyDir = { x: 0, y: 0 };
      }
    });
  }

  private updateJoystick(pointer: Phaser.Input.Pointer) {
    const dx = pointer.x - this.joyCenter.x;
    const dy = pointer.y - this.joyCenter.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 8) {
      this.joyThumb.setPosition(this.joyCenter.x, this.joyCenter.y);
      this.joyDir = { x: 0, y: 0 };
      return;
    }

    const angle = Math.atan2(dy, dx);
    const clamped = Math.min(dist, this.joyMaxDist);
    this.joyThumb.setPosition(
      this.joyCenter.x + Math.cos(angle) * clamped,
      this.joyCenter.y + Math.sin(angle) * clamped
    );
    this.joyDir = {
      x: Math.cos(angle) * (clamped / this.joyMaxDist),
      y: Math.sin(angle) * (clamped / this.joyMaxDist),
    };
  }

  // ===== 攻击按钮(右下大红圆) =====
  private createAttackButton() {
    const btnX = this.scale.width - 100, btnY = this.scale.height - 130;
    const r = 48;

    this.btnAttack = this.add.circle(btnX, btnY, r, 0xcc2222, 0.7)
      .setStrokeStyle(3, 0xff5555, 0.9)
      .setScrollFactor(0).setDepth(1000)
      .setInteractive({ useHandCursor: true });

    // 文字"攻"
    this.add.text(btnX, btnY, '攻', {
      fontSize: '24px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);

    // 脉冲动画
    this.tweens.add({
      targets: this.btnAttack, scaleX: 1.05, scaleY: 1.05,
      yoyo: true, repeat: -1, duration: 600,
    });

    this.btnAttack.on('pointerdown', (p: Phaser.Input.Pointer) => {
      // 不跟摇杆抢同一个pointer
      if (p.id === this.joyPointerId) return;
      if (!this.paused) this.doBasicAttack();
    });
  }

  // ===== 技能按钮(底部中央5个) =====
  private createSkillButtons() {
    const slots = 5;
    const btnR = 22;
    const gap = 10;
    const totalW = slots * btnR * 2 + (slots - 1) * gap;
    const startX = (this.scale.width - totalW) / 2 + btnR;
    const btnY = this.scale.height - 50;

    for (let i = 0; i < slots; i++) {
      const x = startX + i * (btnR * 2 + gap);
      const btn = this.add.circle(x, btnY, btnR, 0x000000, 0.55)
        .setStrokeStyle(2, 0xc9b072, 0.6)
        .setScrollFactor(0).setDepth(1000)
        .setInteractive({ useHandCursor: true });

      const label = this.add.text(x, btnY, '', {
        fontSize: '11px', color: '#e8d9a0',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);

      const idx = i;
      btn.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (p.id === this.joyPointerId) return;
        if (!this.paused) this.tryCastSkill(idx);
      });

      this.skillBtns.push(btn);
      this.skillLabels.push(label);
    }
  }

  // 刷新技能按钮文字
  private refreshSkillButtons() {
    const leader = GameContext.leader;
    const skills = leader.skills.filter(s => s !== 'basic_attack').slice(0, 5);
    for (let i = 0; i < 5; i++) {
      const lbl = this.skillLabels[i];
      const btn = this.skillBtns[i];
      if (!lbl || !btn) continue;
      if (i < skills.length) {
        const sk = getSkill(skills[i]);
        lbl.setText(sk.name.length > 2 ? sk.name.slice(0, 2) : sk.name);
        lbl.setColor('#' + sk.effectColor.toString(16).padStart(6, '0'));
        // 冷却遮罩
        const cdKey = `${leader.id}:${sk.id}`;
        const cdEnd = GameContext.skillCooldowns[cdKey] ?? 0;
        if (this.time.now < cdEnd) {
          btn.setAlpha(0.35);
          lbl.setAlpha(0.5);
        } else {
          btn.setAlpha(1);
          lbl.setAlpha(1);
        }
      } else {
        lbl.setText('');
        btn.setAlpha(0.3);
      }
    }
  }

  // ===== 敌人 =====
  private spawnEnemies() {
    const m = this.map;
    if (m.encounters.length === 0) return;
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
    this.refreshSkillButtons();
  }

  private handleMovement(_delta: number) {
    let vx = 0, vy = 0;

    // 优先虚拟摇杆
    if (this.joyActive && (this.joyDir.x !== 0 || this.joyDir.y !== 0)) {
      vx = this.joyDir.x;
      vy = this.joyDir.y;
    } else {
      // 键盘
      if (this.keys.A.isDown || this.cursors.left.isDown) vx -= 1;
      if (this.keys.D.isDown || this.cursors.right.isDown) vx += 1;
      if (this.keys.W.isDown || this.cursors.up.isDown) vy -= 1;
      if (this.keys.S.isDown || this.cursors.down.isDown) vy += 1;
    }

    const len = Math.hypot(vx, vy) || 1;
    const leader = GameContext.leader;
    const spd = this.playerSpeed * (1 + (leader.spd - 10) * 0.01);
    this.player.setVelocity((vx / len) * spd, (vy / len) * spd);

    if (vx !== 0 || vy !== 0) {
      this.player.setData('facing', { x: vx / len, y: vy / len });
    }

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
    const skills = leader.skills.filter(s => s !== 'basic_attack').slice(0, 5);
    if (slot >= skills.length) return;
    const skillId = skills[slot];
    const skill = getSkill(skillId);

    const cdKey = `${leader.id}:${skillId}`;
    const lastCd = GameContext.skillCooldowns[cdKey] ?? 0;
    if (now < lastCd) return;

    if (!this.consumeCost(leader, skill)) {
      this.toastUI('资源不足');
      return;
    }

    GameContext.skillCooldowns[cdKey] = now + skill.cooldown;
    this.combatLockUntil = now + skill.castTime;

    const facing = this.getAimDirection();

    if (skill.range === 'self') {
      this.castSelfSkill(leader, skill);
    } else if (skill.range === 'all') {
      this.castAoeSkill(leader, skill);
    } else {
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
    // 优先:摇杆方向(如果正在用摇杆但不移动,则用 facing)
    if (this.joyActive && (this.joyDir.x !== 0 || this.joyDir.y !== 0)) {
      return this.joyDir;
    }
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
      const buffs = (this.player.getData('buffs') as Record<string, number>) ?? {};
      for (const [k, v] of Object.entries(skill.buff)) buffs[k] = this.time.now + 8000;
      this.player.setData('buffs', buffs);
    }
  }

  private castAoeSkill(member: PartyMember, skill: SkillDef) {
    const radius = 220;
    for (const e of this.enemies) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.sprite.x, e.sprite.y);
      if (d <= radius) {
        this.damageEnemy(e, member, skill, d);
      }
    }
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
        const dx = this.player.x - e.sprite.x, dy = this.player.y - e.sprite.y;
        const len = Math.hypot(dx, dy) || 1;
        const spd = 60 + e.def.spd * 6;
        if (e.def.ai === 'ranged') {
          if (dist > e.def.attackRange * 0.8) {
            e.sprite.setVelocity((dx / len) * spd, (dy / len) * spd);
          } else if (dist < e.def.attackRange * 0.4) {
            e.sprite.setVelocity(-(dx / len) * spd, -(dy / len) * spd);
          } else {
            e.sprite.setVelocity(0, 0);
          }
          if (dist < e.def.attackRange && time - e.lastAttack > 1800) {
            e.lastAttack = time;
            this.enemyRangedAttack(e, leader);
          }
        } else if (e.def.ai === 'charger') {
          e.sprite.setVelocity((dx / len) * spd * 1.4, (dy / len) * spd * 1.4);
          if (dist < e.def.attackRange && time - e.lastAttack > 1200) {
            e.lastAttack = time;
            this.enemyMeleeAttack(e, leader);
          }
        } else if (e.def.ai === 'boss') {
          e.sprite.setVelocity((dx / len) * spd * 0.8, (dy / len) * spd * 0.8);
          if (dist < e.def.attackRange && time - e.lastAttack > 1500) {
            e.lastAttack = time;
            this.enemyBossAttack(e, leader);
          }
        } else {
          e.sprite.setVelocity((dx / len) * spd, (dy / len) * spd);
          if (dist < e.def.attackRange && time - e.lastAttack > 1400) {
            e.lastAttack = time;
            this.enemyMeleeAttack(e, leader);
          }
        }
      } else {
        e.sprite.setVelocity(0, 0);
      }

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
    const skills = e.def.skills.filter(s => s !== 'basic_attack');
    if (skills.length && Math.random() < 0.5) {
      const sid = skills[Math.floor(Math.random() * skills.length)];
      const skill = getSkill(sid);
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
  private damageEnemy(e: EnemyState, member: PartyMember, skill: SkillDef, _dist = 0) {
    let dmg = this.computePower(member, skill);
    const mult = skill.element ? elementMultiplier(skill.element, e.def.element) : 1;
    dmg = Math.floor(dmg * mult * (1 - e.def.def * 0.01));
    dmg = Math.max(1, dmg);
    e.hp -= dmg;
    e.hurtFlash = 120;
    const dx = e.sprite.x - this.player.x, dy = e.sprite.y - this.player.y;
    const len = Math.hypot(dx, dy) || 1;
    e.sprite.x += (dx / len) * 6; e.sprite.y += (dy / len) * 6;

    this.spawnDamageText(e.sprite.x, e.sprite.y - e.def.radius, dmg, mult > 1 ? 0xffd97a : 0xffffff, mult > 1);
    if (mult > 1) this.toastUI(`${ELEMENT_LABEL[skill.element!]}克${ELEMENT_LABEL[e.def.element]}!`);

    if (skill.heal) {
      const heal = Math.floor(member.maxHp * skill.heal);
      member.hp = Math.min(member.maxHp, member.hp + heal);
    }

    if (e.hp <= 0) {
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
      if (p.life <= 0 || p.sprite.x < 0 || p.sprite.y < 0 ||
          p.sprite.x > this.map.width * TS || p.sprite.y > this.map.height * TS) {
        toRemove.push(p); continue;
      }
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

  private emitSkillFx(skill: SkillDef, x: number, y: number, _dir: { x: number; y: number }) {
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

  // ===== 遇敌刷新 =====
  private checkEncounterSpawn(time: number) {
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
    for (const npc of this.map.npcs) {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y) < 40) {
        this.interactNPC(npc.id); return;
      }
    }
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
    if (npcId === 'npc_qingwei' && GameContext.hasFlag('beat_tianyao') && !GameContext.hasFlag('learn_feilong')) {
      this.runCustomDialog('掌门清微', 0xe0e0e0,
        '天妖皇已除,甚好。然邪剑仙未灭,须寻五灵珠之力。古藤林中有异人精精,可传你飞龙探云手,速往!');
      return;
    }
    if (npcId === 'npc_jingjing' && !GameContext.hasFlag('learn_feilong')) {
      this.triggerStory('ch4_gutenglin'); return;
    }
    if (npcId === 'npc_yelian') { this.openShop('weapon'); return; }
    if (npcId === 'npc_ghost') {
      this.runCustomDialog('鬼卒', 0x8888aa, '前方熔岩地狱,火鬼王凶悍,水灵之力方可克制。');
      return;
    }
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
    this.scene.pause().launch('DialogScene', { mode: 'shop', shopType: type });
  }

  // ===== 剧情 =====
  private checkAutoStory() {
    const node = autoStoryFor(this.map.id);
    if (node && !GameContext.completedNodes.has(node.id)) {
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

  private switchMember() {
    const party = GameContext.party.filter(p => p.inParty && p.hp > 0);
    if (party.length <= 1) return;
    this.activeMemberIdx = (this.activeMemberIdx + 1) % party.length;
    const m = party[this.activeMemberIdx];
    this.player.setTexture(`player_${m.id}`);
    this.toastUI(`操控:${m.name}【${ELEMENT_LABEL[m.element]}】`);
  }

  private openPauseMenu() {
    this.paused = true;
    this.scene.pause().launch('DialogScene', { mode: 'pause' });
  }

  private doAutosave() {
    GameContext.autosave();
  }

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
    if (node.id === 'ch4_fengdu') {
      GameContext.joinParty('zixuan', GameContext.leader.level);
    }
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