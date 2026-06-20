// scene/SceneManager.ts
// 场景管理：地图加载、瓦片渲染、实体放置、相机跟随、出口检测
// 这是连接 ECS、战斗、对话、任务、商店的中间层

import type { EngineApi } from '../core/engine';
import type { Vec2 } from '../core/types';
import { World } from '../ecs/world';
import { MAPS } from '../data/maps';
import type { MapDef, ExitDef } from '../data/maps';
import { createPlayerEntity, createMonsterEntity, createNpcEntity, createTeammateEntity } from '../ecs/entity';
import type { Entity } from '../ecs/entity';
import { CombatSystem } from '../combat/CombatSystem';
import { bus } from '../core/eventBus';
import { dist, clamp } from '../core/math';
import { questManager } from '../quest/QuestManager';
import { dialogueManager } from '../dialogue/DialogueManager';
import { shopManager } from '../shop/ShopManager';
import { saveManager } from '../save/SaveManager';
import type { GameState, PartyMemberState } from '../save/types';
import { ECONOMY } from '../data/economy';
import { CHARACTER_MAP } from '../data/characters';
import { statsAtLevel } from '../data/stats';
import { ITEM_MAP } from '../data/items';
import { addStats } from '../data/stats';
import { ELEMENT_COLOR } from '../data/element';
import { Graphics, Container, Text } from 'pixi.js';

/** 瓦片颜色 */
const TILE_COLORS: Record<number, number> = {
  0: 0x3a3a4a,  // 空地
  1: 0x2a2a3a,  // 墙
  2: 0x4a6a3a,  // 草地
  3: 0x3a5a8a,  // 水
  4: 0x2a4a2a,  // 树
  5: 0x5a5a4a,  // 道路
  6: 0x8a7a5a,  // 桥
};

/** 调整颜色亮度（factor > 1 变亮，< 1 变暗） */
function adjustBrightness(color: number, factor: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

/** 基于瓦片坐标的确定性随机数（0-255），用于纹理变化 */
function tileVariation(x: number, y: number): number {
  return ((x * 73856093) ^ (y * 19349663)) & 0xff;
}

/** 游戏状态（运行时，非存档） */
export interface GameRunState {
  party: PartyMemberState[];
  inventory: Record<string, number>;
  gold: number;
  flags: Record<string, boolean | number>;
  currentMap: string;
  chapter: number;
  playtime: number;
}

export class SceneManager {
  private api: EngineApi;
  private world: World;
  private combat: CombatSystem;
  private mapGraphics: Graphics | null = null;
  /** 实体图形引用：container 主体容器，hpBar 血条，body 身体，direction 方向指示器 */
  private entityGraphics = new Map<string, {
    container: Container;
    hpBar: Graphics;
    body: Graphics;
    direction: Graphics;
  }>();
  private currentMapDef: MapDef | null = null;
  private player: Entity | null = null;
  /** 点击移动目标（世界坐标），null 表示无目标 */
  private clickTarget: Vec2 | null = null;
  /** 游戏运行时状态 */
  runState: GameRunState;
  /** 是否暂停（对话/菜单时） */
  paused = false;

  constructor(api: EngineApi, world: World) {
    this.api = api;
    this.world = world;
    this.combat = new CombatSystem(world);
    this.runState = {
      party: [],
      inventory: {},
      gold: ECONOMY.startingGold,
      flags: {},
      currentMap: 'yuzhou_city',
      chapter: 1,
      playtime: 0,
    };

    // 设置战斗回调
    this.combat.onMonsterKilled = (entity) => this.handleMonsterKilled(entity);
    this.combat.onPlayerDeath = () => this.handlePlayerDeath();

    // 设置对话回调
    this.setupDialogueCallbacks();

    // 设置商店引用
    shopManager.gold = this.runState.gold;
    shopManager.inventory = this.runState.inventory;
  }

  /** 设置对话系统的回调 */
  private setupDialogueCallbacks(): void {
    dialogueManager.onGiveQuest = (questId) => {
      questManager.accept(questId);
    };
    dialogueManager.onCompleteQuest = (questId) => {
      const rewards = questManager.complete(questId);
      if (rewards) {
        if (rewards.exp) this.giveExp(rewards.exp);
        if (rewards.gold) this.runState.gold += rewards.gold;
        if (rewards.items) {
          for (const itemId of rewards.items) {
            this.addItem(itemId);
          }
        }
        if (rewards.skillId) {
          // 技能解锁：加到主角技能列表
          this.player?.skills.push(rewards.skillId);
        }
      }
    };
    dialogueManager.onGiveItem = (itemId) => {
      this.addItem(itemId);
    };
    dialogueManager.onSetFlag = (flag) => {
      this.runState.flags[flag] = true;
    };
    dialogueManager.onJoinParty = (characterId) => {
      this.addPartyMember(characterId);
    };
    dialogueManager.onHeal = () => {
      this.healParty();
    };
    dialogueManager.onOpenShop = (shopId) => {
      shopManager.open(shopId);
    };
    dialogueManager.onSaveGame = () => {
      this.autoSave();
    };
  }

  /** 开始新游戏 */
  newGame(): void {
    // 初始化队伍：只有景天
    this.runState.party = [{
      characterId: 'jingtian',
      level: 1,
      exp: 0,
      hp: CHARACTER_MAP['jingtian'].baseStats.hp,
      mp: CHARACTER_MAP['jingtian'].baseStats.mp,
      skills: [...CHARACTER_MAP['jingtian'].skills],
      equipment: {},
    }];
    this.runState.gold = ECONOMY.startingGold;
    this.runState.inventory = {};
    this.runState.flags = {};
    this.runState.chapter = 1;
    this.runState.currentMap = 'yuzhou_city';
    this.runState.playtime = 0;
    questManager.deserialize({ active: [], done: [], progress: {} });

    this.loadMap('yuzhou_city', { x: 20 * 32, y: 15 * 32 });
  }

  /** 从存档加载 */
  loadFromSave(state: GameState): void {
    this.runState.party = state.party.map((p) => ({ ...p, equipment: { ...p.equipment } }));
    this.runState.inventory = { ...state.inventory };
    this.runState.gold = state.gold;
    this.runState.flags = { ...state.flags };
    this.runState.chapter = state.chapter;
    this.runState.currentMap = state.currentMap;
    this.runState.playtime = state.playtime;
    questManager.deserialize({
      active: state.quests.active,
      done: state.quests.done,
      progress: {},
    });

    this.loadMap(state.currentMap, state.position);
  }

  /** 加载地图 */
  loadMap(mapId: string, playerPos: Vec2): void {
    const mapDef = MAPS[mapId];
    if (!mapDef) return;

    // 清空旧地图
    this.world.clear();
    this.clearMapGraphics();

    this.currentMapDef = mapDef;
    this.runState.currentMap = mapId;

    // 渲染地图瓦片
    this.renderMap(mapDef);

    // 创建玩家实体
    const playerState = this.runState.party[0];
    if (playerState) {
      this.player = createPlayerEntity(playerState.characterId, playerPos, playerState.level);
      // 恢复 HP/MP
      this.player.hp = playerState.hp;
      this.player.mp = playerState.mp;
      // 恢复技能
      this.player.skills = [...playerState.skills];
      // 应用装备
      this.player.equipment = { ...playerState.equipment };
      this.applyEquipmentStats(this.player);
      this.world.add(this.player);

      // 创建队友实体
      for (let i = 1; i < this.runState.party.length; i++) {
        const member = this.runState.party[i];
        const allyPos = { x: playerPos.x + (i * 30), y: playerPos.y + 20 };
        const ally = createTeammateEntity(member.characterId, allyPos, member.level);
        ally.hp = member.hp;
        ally.mp = member.mp;
        ally.skills = [...member.skills];
        ally.equipment = { ...member.equipment };
        this.applyEquipmentStats(ally);
        this.world.add(ally);
      }
    }

    // 创建怪物
    for (const spawn of mapDef.spawns) {
      for (let i = 0; i < spawn.count; i++) {
        const offset = { x: spawn.x * 32 + (Math.random() - 0.5) * 60, y: spawn.y * 32 + (Math.random() - 0.5) * 60 };
        const monster = createMonsterEntity(spawn.monsterId, offset);
        this.world.add(monster);
      }
    }

    // 创建 NPC
    for (const npc of mapDef.npcs) {
      const npcEntity = createNpcEntity(npc.npcId, { x: npc.x * 32, y: npc.y * 32 }, npc.dialogueId);
      this.world.add(npcEntity);
    }

    // 刷新世界
    this.world.flush();

    // 渲染实体
    this.renderEntities();

    // 相机居中到玩家
    if (this.player) {
      this.api.centerCameraOn(this.player.position);
    }

    // 安全区自动存档
    if (mapDef.isSafeZone) {
      this.autoSave();
    }

    // 触发到达事件
    questManager.onReach(mapId);

    bus.emit('scene:change', { from: '', to: mapId });
  }

  /** 渲染地图瓦片 */
  private renderMap(mapDef: MapDef): void {
    const g = new Graphics();
    const ts = mapDef.tileSize;

    for (let y = 0; y < mapDef.height; y++) {
      for (let x = 0; x < mapDef.width; x++) {
        const tile = mapDef.tiles[y][x];
        const px = x * ts;
        const py = y * ts;
        // 确定性纹理变化
        const v = tileVariation(x, y);
        const brightness = 0.9 + (v / 255) * 0.2; // 0.9 ~ 1.1
        const baseColor = TILE_COLORS[tile] ?? 0x3a3a4a;

        switch (tile) {
          case 0: {
            // 空地（石板地）：带细微裂纹
            g.rect(px, py, ts, ts).fill({ color: adjustBrightness(baseColor, brightness) });
            if (v % 3 === 0) {
              g.moveTo(px + ts * 0.2, py + ts * 0.3).lineTo(px + ts * 0.5, py + ts * 0.6)
                .stroke({ width: 1, color: 0x2a2a3a, alpha: 0.3 });
            }
            break;
          }
          case 1: {
            // 墙：高度感（底部暗、顶部亮、边框）
            g.rect(px, py, ts, ts).fill({ color: adjustBrightness(baseColor, brightness * 0.7) });
            g.rect(px, py, ts, ts * 0.35).fill({ color: adjustBrightness(baseColor, brightness * 1.15) });
            g.rect(px, py, ts, ts).stroke({ width: 1, color: 0x1a1a2a });
            // 顶部高光
            g.rect(px, py, ts, 2).fill({ color: 0x4a4a5a, alpha: 0.6 });
            break;
          }
          case 2: {
            // 草地：带草叶纹理
            g.rect(px, py, ts, ts).fill({ color: adjustBrightness(baseColor, brightness) });
            const bladeColor = adjustBrightness(baseColor, brightness * 1.3);
            if (v % 2 === 0) {
              g.moveTo(px + ts * 0.3, py + ts * 0.7).lineTo(px + ts * 0.35, py + ts * 0.5)
                .stroke({ width: 1, color: bladeColor });
            }
            if (v % 3 === 1) {
              g.moveTo(px + ts * 0.6, py + ts * 0.8).lineTo(px + ts * 0.65, py + ts * 0.6)
                .stroke({ width: 1, color: bladeColor });
            }
            break;
          }
          case 3: {
            // 水：深蓝底 + 浅色波纹高光
            g.rect(px, py, ts, ts).fill({ color: adjustBrightness(baseColor, brightness) });
            const highlight = adjustBrightness(baseColor, brightness * 1.4);
            g.ellipse(px + ts * 0.3, py + ts * 0.4, ts * 0.15, ts * 0.06).fill({ color: highlight, alpha: 0.5 });
            if (v % 2 === 0) {
              g.ellipse(px + ts * 0.7, py + ts * 0.7, ts * 0.12, ts * 0.05).fill({ color: highlight, alpha: 0.4 });
            }
            break;
          }
          case 4: {
            // 树：地面 + 棕色树干 + 绿色树冠
            g.rect(px, py, ts, ts).fill({ color: adjustBrightness(0x2a4a2a, brightness) });
            // 树干
            g.rect(px + ts * 0.42, py + ts * 0.45, ts * 0.16, ts * 0.45).fill({ color: 0x6b4226 });
            g.rect(px + ts * 0.42, py + ts * 0.45, ts * 0.16, ts * 0.45).stroke({ width: 1, color: 0x3a2210, alpha: 0.6 });
            // 树冠（多层圆模拟立体感）
            const canopyColor = adjustBrightness(0x2d5a1f, brightness);
            g.circle(px + ts * 0.5, py + ts * 0.35, ts * 0.38).fill({ color: canopyColor });
            g.circle(px + ts * 0.5, py + ts * 0.35, ts * 0.38).stroke({ width: 1, color: 0x1a3a0f, alpha: 0.7 });
            // 树冠高光
            g.circle(px + ts * 0.4, py + ts * 0.25, ts * 0.12).fill({ color: adjustBrightness(canopyColor, 1.2), alpha: 0.6 });
            break;
          }
          case 5: {
            // 道路：略带边框的石路
            g.rect(px, py, ts, ts).fill({ color: adjustBrightness(baseColor, brightness) });
            g.rect(px, py, ts, ts).stroke({ width: 1, color: 0x4a4a3a, alpha: 0.4 });
            break;
          }
          case 6: {
            // 桥：木板 + 横向板缝
            g.rect(px, py, ts, ts).fill({ color: adjustBrightness(baseColor, brightness) });
            g.moveTo(px, py + ts * 0.33).lineTo(px + ts, py + ts * 0.33)
              .stroke({ width: 1, color: 0x6a5a3a, alpha: 0.7 });
            g.moveTo(px, py + ts * 0.66).lineTo(px + ts, py + ts * 0.66)
              .stroke({ width: 1, color: 0x6a5a3a, alpha: 0.7 });
            g.rect(px, py, ts, ts).stroke({ width: 1, color: 0x5a4a2a, alpha: 0.5 });
            break;
          }
          default: {
            g.rect(px, py, ts, ts).fill({ color: adjustBrightness(baseColor, brightness) });
            break;
          }
        }
      }
    }

    // 出口标记 —— 多层光晕传送门
    for (const exit of mapDef.exits) {
      const cx = exit.x * ts + ts / 2;
      const cy = exit.y * ts + ts / 2;
      const portalColor = exit.locked ? 0xff3333 : 0x33ff66;
      // 外层光晕
      g.circle(cx, cy, ts * 0.7).fill({ color: portalColor, alpha: 0.1 });
      g.circle(cx, cy, ts * 0.55).fill({ color: portalColor, alpha: 0.2 });
      g.circle(cx, cy, ts * 0.4).fill({ color: portalColor, alpha: 0.35 });
      g.circle(cx, cy, ts * 0.25).fill({ color: portalColor, alpha: 0.55 });
      // 中心亮点
      g.circle(cx, cy, ts * 0.1).fill({ color: 0xffffff, alpha: 0.85 });
      // 锁定标记
      if (exit.locked) {
        g.rect(cx - 2, cy - ts * 0.2, 4, ts * 0.3).fill({ color: 0x000000, alpha: 0.6 });
        g.circle(cx, cy - ts * 0.2, 4).fill({ color: 0x000000, alpha: 0.6 });
      }
    }

    // 极淡网格线（alpha 0.05）
    for (let x = 0; x <= mapDef.width; x++) {
      g.moveTo(x * ts, 0).lineTo(x * ts, mapDef.height * ts)
        .stroke({ width: 1, color: 0xffffff, alpha: 0.05 });
    }
    for (let y = 0; y <= mapDef.height; y++) {
      g.moveTo(0, y * ts).lineTo(mapDef.width * ts, y * ts)
        .stroke({ width: 1, color: 0xffffff, alpha: 0.05 });
    }

    this.api.world.addChild(g);
    this.mapGraphics = g;
  }

  /** 清除地图图形 */
  private clearMapGraphics(): void {
    if (this.mapGraphics) {
      this.api.world.removeChild(this.mapGraphics);
      this.mapGraphics.destroy();
      this.mapGraphics = null;
    }
    for (const [, gfx] of this.entityGraphics) {
      this.api.world.removeChild(gfx.container);
      gfx.container.destroy();
    }
    this.entityGraphics.clear();
  }

  /** 渲染所有实体 */
  renderEntities(): void {
    for (const entity of this.world.all()) {
      this.renderEntity(entity);
    }
  }

  /** 渲染单个实体 */
  private renderEntity(entity: Entity): void {
    if (this.entityGraphics.has(entity.id)) return;

    const container = new Container();
    const size = entity.sprite.size;
    const elementColor = ELEMENT_COLOR[entity.element] ?? 0xffffff;
    const skinColor = 0xffdab9; // 肤色

    // === 阴影 ===
    const shadowG = new Graphics();
    shadowG.ellipse(0, size * 0.4, size * 0.5, size * 0.18).fill({ color: 0x000000, alpha: 0.35 });
    container.addChild(shadowG);

    // === 主体 ===
    const bodyG = new Graphics();

    if (entity.type === 'player' || entity.type === 'teammate') {
      // 角色：身体 + 头 + 头发 + 武器 + 眼睛
      const bodyColor = entity.sprite.color;
      // 身体（圆角矩形）
      bodyG.roundRect(-size * 0.3, -size * 0.1, size * 0.6, size * 0.5, 4).fill(bodyColor);
      bodyG.roundRect(-size * 0.3, -size * 0.1, size * 0.6, size * 0.5, 4).stroke({ width: 1, color: 0x000000, alpha: 0.4 });
      // 头部
      bodyG.circle(0, -size * 0.3, size * 0.22).fill(skinColor);
      bodyG.circle(0, -size * 0.3, size * 0.22).stroke({ width: 1, color: 0x000000, alpha: 0.4 });
      // 头发（元素色）
      bodyG.circle(0, -size * 0.38, size * 0.14).fill(elementColor);
      // 武器（元素色发光长条）
      bodyG.rect(size * 0.3, -size * 0.2, 3, size * 0.4).fill(elementColor);
      bodyG.rect(size * 0.3, -size * 0.2, 3, size * 0.4).stroke({ width: 1, color: 0xffffff, alpha: 0.5 });
      // 眼睛
      bodyG.circle(-size * 0.07, -size * 0.3, 1.5).fill(0x000000);
      bodyG.circle(size * 0.07, -size * 0.3, 1.5).fill(0x000000);
    } else if (entity.type === 'monster') {
      // 怪物：身体 + 眼睛 + 嘴
      const bodyColor = entity.sprite.color;
      // 身体（圆形）
      bodyG.circle(0, 0, size * 0.4).fill(bodyColor);
      bodyG.circle(0, 0, size * 0.4).stroke({ width: 2, color: 0x000000, alpha: 0.5 });
      // 眼白
      bodyG.circle(-size * 0.12, -size * 0.08, size * 0.09).fill(0xffffff);
      bodyG.circle(size * 0.12, -size * 0.08, size * 0.09).fill(0xffffff);
      // 瞳孔（元素色）
      bodyG.circle(-size * 0.12, -size * 0.08, size * 0.045).fill(elementColor);
      bodyG.circle(size * 0.12, -size * 0.08, size * 0.045).fill(elementColor);
      // 嘴/獠牙
      bodyG.moveTo(-size * 0.1, size * 0.12).lineTo(0, size * 0.22).lineTo(size * 0.1, size * 0.12)
        .stroke({ width: 1, color: 0x000000 });
    } else if (entity.type === 'npc') {
      // NPC：身体 + 头 + 眼睛 + 感叹号标记
      const bodyColor = 0x8a8a9a;
      // 身体
      bodyG.roundRect(-size * 0.25, -size * 0.1, size * 0.5, size * 0.5, 4).fill(bodyColor);
      bodyG.roundRect(-size * 0.25, -size * 0.1, size * 0.5, size * 0.5, 4).stroke({ width: 1, color: 0x000000, alpha: 0.4 });
      // 头部
      bodyG.circle(0, -size * 0.3, size * 0.2).fill(skinColor);
      bodyG.circle(0, -size * 0.3, size * 0.2).stroke({ width: 1, color: 0x000000, alpha: 0.4 });
      // 眼睛
      bodyG.circle(-size * 0.06, -size * 0.32, 1.5).fill(0x000000);
      bodyG.circle(size * 0.06, -size * 0.32, 1.5).fill(0x000000);
      // 感叹号（任务标记）
      bodyG.rect(-1.5, -size * 0.65, 3, size * 0.18).fill(0xffdd00);
      bodyG.circle(0, -size * 0.7, 2.5).fill(0xffdd00);
    } else if (entity.type === 'projectile') {
      // 投射物：拖尾 + 发光球
      bodyG.circle(-size * 0.5, 0, size * 0.2).fill({ color: elementColor, alpha: 0.2 });
      bodyG.circle(-size * 0.3, 0, size * 0.3).fill({ color: elementColor, alpha: 0.4 });
      bodyG.circle(0, 0, size * 0.5).fill({ color: elementColor, alpha: 0.6 });
      bodyG.circle(0, 0, size * 0.3).fill(0xffffff);
    }
    container.addChild(bodyG);

    // === 方向指示器（小三角，朝向 facing） ===
    const dirG = new Graphics();
    dirG.moveTo(size * 0.55, 0).lineTo(size * 0.4, -size * 0.1).lineTo(size * 0.4, size * 0.1).closePath()
      .fill({ color: elementColor, alpha: 0.8 });
    container.addChild(dirG);

    // === 血条 ===
    const hpBar = new Graphics();
    container.addChild(hpBar);

    // === 名字标签 ===
    const label = new Text({
      text: entity.name,
      style: { fontSize: 10, fill: 0xffffff },
    });
    label.anchor.set(0.5, 0);
    label.y = size * 0.5 + 4;
    container.addChild(label);

    container.x = entity.position.x;
    container.y = entity.position.y;
    container.zIndex = entity.position.y;
    this.api.world.addChild(container);
    this.entityGraphics.set(entity.id, { container, hpBar, body: bodyG, direction: dirG });
  }

  /** 每帧更新 */
  update(dt: number): void {
    if (this.paused) return;

    this.runState.playtime += dt / 1000;

    // 更新战斗系统
    this.combat.update(dt);

    // 更新玩家移动
    this.updatePlayerMovement(dt);

    // 更新实体图形位置
    this.updateEntityGraphics();

    // 相机跟随
    if (this.player) {
      this.api.centerCameraOn(this.player.position);
    }

    // 检查出口
    this.checkExits();

    // 检查 NPC 交互
    this.checkNpcInteraction();

    // 更新对话
    if (dialogueManager.isActive) {
      dialogueManager.update(dt / 1000);
    }
  }

  /** 更新玩家移动 */
  private updatePlayerMovement(dt: number): void {
    if (!this.player || !this.player.isAlive) return;
    if (dialogueManager.isActive || shopManager.isActive) return;

    const dtSec = dt / 1000;

    // 键盘输入优先：有键盘移动时清除点击目标
    if (this.player.velocity.x !== 0 || this.player.velocity.y !== 0) {
      this.clickTarget = null;
    }

    // 点击移动：朝目标点移动，到达后停止
    if (this.clickTarget) {
      const dx = this.clickTarget.x - this.player.position.x;
      const dy = this.clickTarget.y - this.player.position.y;
      const d = Math.hypot(dx, dy);
      const stopRadius = 4; // 到达阈值（像素）
      if (d <= stopRadius) {
        this.player.velocity.x = 0;
        this.player.velocity.y = 0;
        this.clickTarget = null;
      } else {
        const moveSpeed = this.player.speed;
        this.player.velocity.x = (dx / d) * moveSpeed;
        this.player.velocity.y = (dy / d) * moveSpeed;
        this.player.facing = Math.atan2(dy, dx);
      }
    }

    // 移动由外部设置 velocity（通过 InputManager 或点击目标）
    // 这里只做位置更新 + 边界检测
    this.player.position.x += this.player.velocity.x * dtSec;
    this.player.position.y += this.player.velocity.y * dtSec;

    // 地图边界
    if (this.currentMapDef) {
      const map = this.currentMapDef;
      const ts = map.tileSize;
      this.player.position.x = clamp(this.player.position.x, ts, map.width * ts - ts);
      this.player.position.y = clamp(this.player.position.y, ts, map.height * ts - ts);

      // 瓦片碰撞检测（墙/水/树不可通过）
      const tx = Math.floor(this.player.position.x / ts);
      const ty = Math.floor(this.player.position.y / ts);
      if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
        const tile = map.tiles[ty][tx];
        if (tile === 1 || tile === 3 || tile === 4) {
          // 回退
          this.player.position.x -= this.player.velocity.x * dtSec;
          this.player.position.y -= this.player.velocity.y * dtSec;
        }
      }
    }
  }

  /** 更新实体图形 */
  private updateEntityGraphics(): void {
    for (const entity of this.world.all()) {
      let gfx = this.entityGraphics.get(entity.id);
      if (!gfx) {
        this.renderEntity(entity);
        gfx = this.entityGraphics.get(entity.id);
        if (!gfx) continue;
      }
      // 更新位置和可见性
      gfx.container.x = entity.position.x;
      gfx.container.y = entity.position.y;
      gfx.container.zIndex = entity.position.y;
      gfx.container.visible = entity.isAlive;

      // 更新方向指示器朝向
      gfx.direction.rotation = entity.facing;

      // 更新血条（非 NPC/投射物）
      if (entity.type !== 'npc' && entity.type !== 'projectile') {
        gfx.hpBar.clear();
        const barW = Math.max(entity.sprite.size, 30);
        const hpRatio = Math.max(0, Math.min(1, entity.hp / entity.maxHp));
        const barY = -entity.sprite.size * 0.5 - 8;
        // 背景
        gfx.hpBar.roundRect(-barW / 2, barY, barW, 4, 2).fill({ color: 0x330000, alpha: 0.8 });
        // 填充
        const hpColor = entity.faction === 'player' ? 0x33ff33 : 0xff3333;
        gfx.hpBar.roundRect(-barW / 2, barY, barW * hpRatio, 4, 2).fill(hpColor);
        // 边框
        gfx.hpBar.roundRect(-barW / 2, barY, barW, 4, 2).stroke({ width: 1, color: 0x000000, alpha: 0.5 });
      }
    }
  }

  /** 检查出口 */
  private checkExits(): void {
    if (!this.player || !this.currentMapDef) return;
    const ts = this.currentMapDef.tileSize;
    for (const exit of this.currentMapDef.exits) {
      const exitPos = { x: exit.x * ts, y: exit.y * ts };
      if (dist(this.player.position, exitPos) < ts * 0.8) {
        if (exit.locked) {
          // 锁定出口，不切换
          return;
        }
        // 切换地图
        this.loadMap(exit.toMapId, { x: exit.targetX * ts, y: exit.targetY * ts });
        return;
      }
    }
  }

  /** 检查 NPC 交互 */
  private checkNpcInteraction(): void {
    // 交互由输入系统触发，这里只提供查询
  }

  /** 与最近的 NPC 交互 */
  interactWithNpc(): void {
    if (!this.player || dialogueManager.isActive) return;
    const npcs = this.world.npcs();
    let nearest: Entity | null = null;
    let nearestDist = 50; // 交互距离
    for (const npc of npcs) {
      const d = dist(this.player.position, npc.position);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = npc;
      }
    }
    if (nearest && nearest.dialogueId) {
      dialogueManager.start(nearest.dialogueId);
      // 触发对话事件
      if (nearest.npcId) {
        questManager.onTalk(nearest.npcId);
      }
    }
  }

  /** 设置鼠标点击移动目标（世界坐标） */
  setClickTarget(pos: Vec2): void {
    this.clickTarget = { x: pos.x, y: pos.y };
  }

  /** 清除点击移动目标 */
  clearClickTarget(): void {
    this.clickTarget = null;
  }

  /**
   * 尝试与指定世界坐标处的 NPC 交互。
   * @returns true 表示点中了 NPC 并开始对话，false 表示未点中
   */
  tryInteractAtNpc(pos: Vec2): boolean {
    if (dialogueManager.isActive) return false;
    const npcs = this.world.npcs();
    const clickRadius = 24; // 点击命中半径
    for (const npc of npcs) {
      if (dist(pos, npc.position) <= clickRadius) {
        if (npc.dialogueId) {
          dialogueManager.start(npc.dialogueId);
          if (npc.npcId) {
            questManager.onTalk(npc.npcId);
          }
          return true;
        }
      }
    }
    return false;
  }

  /** 获取屏幕坐标处的 NPC（用于点击交互） */
  getNpcAtScreenPos(screenPos: Vec2): Entity | null {
    // 屏幕坐标转世界坐标
    const worldX = screenPos.x - this.api.world.x;
    const worldY = screenPos.y - this.api.world.y;
    for (const npc of this.world.npcs()) {
      if (dist({ x: worldX, y: worldY }, npc.position) < 30) {
        return npc;
      }
    }
    return null;
  }

  /** 处理怪物被击杀 */
  private handleMonsterKilled(entity: Entity): void {
    // 给经验
    if (entity.expReward) {
      this.giveExp(entity.expReward);
    }
    // 给金钱
    if (entity.goldReward) {
      this.runState.gold += entity.goldReward;
    }
    // 掉落
    if (entity.drops) {
      for (const drop of entity.drops) {
        if (Math.random() < drop.chance) {
          this.addItem(drop.itemId);
        }
      }
    }
    // 任务进度
    if (entity.monsterId) {
      questManager.onKill(entity.monsterId);
    }
  }

  /** 处理玩家死亡 */
  private handlePlayerDeath(): void {
    // 回到城镇，扣金钱
    const penalty = Math.floor(this.runState.gold * ECONOMY.deathPenaltyGold);
    this.runState.gold -= penalty;
    // 恢复 HP/MP
    if (this.player) {
      this.player.hp = this.player.maxHp;
      this.player.mp = this.player.maxMp;
      this.player.isAlive = true;
    }
    // 回到渝州城
    this.loadMap('yuzhou_city', { x: 20 * 32, y: 15 * 32 });
  }

  /** 给经验 */
  private giveExp(exp: number): void {
    if (!this.player) return;
    const member = this.runState.party[0];
    if (!member) return;
    member.exp += exp;
    // 检查升级
    const expNeeded = ECONOMY.expToLevel(member.level);
    while (member.exp >= expNeeded) {
      member.exp -= expNeeded;
      member.level++;
      // 更新属性
      const def = CHARACTER_MAP[member.characterId];
      const newStats = statsAtLevel(def.baseStats, def.growth, member.level);
      member.hp = newStats.hp;
      member.mp = newStats.mp;
      // 解锁技能
      for (const skillId of def.skills) {
        if (!member.skills.includes(skillId)) {
          // 检查是否到了学习等级
          // 这里简化：直接加
        }
      }
      bus.emit('level:up', { entity: this.player.id, level: member.level });
    }
  }

  /** 添加物品 */
  private addItem(itemId: string): void {
    this.runState.inventory[itemId] = (this.runState.inventory[itemId] ?? 0) + 1;
    // 任务进度
    questManager.onCollect(itemId, 1);
  }

  /** 添加队友 */
  private addPartyMember(characterId: string): void {
    // 检查是否已在队伍中
    if (this.runState.party.some((p) => p.characterId === characterId)) return;
    const def = CHARACTER_MAP[characterId];
    if (!def) return;
    const member: PartyMemberState = {
      characterId,
      level: 1,
      exp: 0,
      hp: def.baseStats.hp,
      mp: def.baseStats.mp,
      skills: def.skills.filter((id) => {
        // 只保留 1 级可学的技能
        return true; // 简化：全部加入
      }),
      equipment: {},
    };
    this.runState.party.push(member);
    // 在世界中创建队友实体
    if (this.player) {
      const ally = createTeammateEntity(characterId, {
        x: this.player.position.x + 30,
        y: this.player.position.y + 20,
      }, member.level);
      ally.hp = member.hp;
      ally.mp = member.mp;
      this.world.add(ally);
      this.world.flush();
    }
  }

  /** 治疗队伍 */
  private healParty(): void {
    for (const member of this.runState.party) {
      const def = CHARACTER_MAP[member.characterId];
      if (def) {
        const stats = statsAtLevel(def.baseStats, def.growth, member.level);
        member.hp = stats.hp;
        member.mp = stats.mp;
      }
    }
    // 更新世界中的实体
    for (const ally of this.world.allies()) {
      ally.hp = ally.maxHp;
      ally.mp = ally.maxMp;
    }
  }

  /** 应用装备属性加成 */
  private applyEquipmentStats(entity: Entity): void {
    const eq = entity.equipment;
    let bonus = { atk: 0, def: 0, mag: 0, res: 0, hp: 0, mp: 0, spd: 0, crit: 0, critDmg: 0 };
    for (const itemId of [eq.weapon, eq.armor, eq.accessory]) {
      if (!itemId) continue;
      const item = ITEM_MAP[itemId];
      if (item?.statsBonus) {
        bonus = addStats(bonus, item.statsBonus);
      }
    }
    entity.stats.atk += bonus.atk;
    entity.stats.def += bonus.def;
    entity.stats.mag += bonus.mag;
    entity.stats.res += bonus.res;
    entity.stats.hp += bonus.hp;
    entity.maxHp += bonus.hp;
    entity.stats.mp += bonus.mp;
    entity.maxMp += bonus.mp;
    entity.stats.spd += bonus.spd;
    entity.stats.crit += bonus.crit;
    entity.stats.critDmg += bonus.critDmg;
  }

  /** 自动存档 */
  autoSave(): void {
    const state = this.serializeState();
    saveManager.autoSave(state);
  }

  /** 序列化当前状态 */
  serializeState(): GameState {
    // 同步实体 HP/MP 到 party
    const player = this.world.player();
    if (player && this.runState.party[0]) {
      this.runState.party[0].hp = player.hp;
      this.runState.party[0].mp = player.mp;
    }
    const teammates = this.world.teammates();
    for (let i = 1; i < this.runState.party.length; i++) {
      const ally = teammates[i - 1];
      if (ally) {
        this.runState.party[i].hp = ally.hp;
        this.runState.party[i].mp = ally.mp;
      }
    }

    const questData = questManager.serialize();
    return {
      version: 1,
      flags: { ...this.runState.flags },
      party: this.runState.party.map((p) => ({ ...p, equipment: { ...p.equipment }, skills: [...p.skills] })),
      inventory: { ...this.runState.inventory },
      gold: this.runState.gold,
      quests: { active: questData.active, done: questData.done },
      currentMap: this.runState.currentMap,
      position: this.player ? { ...this.player.position } : { x: 0, y: 0 },
      playtime: this.runState.playtime,
      chapter: this.runState.chapter,
      history: [],
    };
  }

  /** 获取战斗系统 */
  getCombat(): CombatSystem {
    return this.combat;
  }

  /** 获取玩家实体 */
  getPlayer(): Entity | null {
    return this.player;
  }

  /** 检查玩家是否靠近 NPC（用于交互提示） */
  isNearNpc(): boolean {
    if (!this.player) return false;
    const npcs = this.world.npcs();
    for (const npc of npcs) {
      if (dist(this.player.position, npc.position) < 50) {
        return true;
      }
    }
    return false;
  }

  /** 获取当前地图像素尺寸（用于小地图） */
  get mapPixelSize(): { width: number; height: number } | null {
    if (!this.currentMapDef) return null;
    const ts = this.currentMapDef.tileSize;
    return {
      width: this.currentMapDef.width * ts,
      height: this.currentMapDef.height * ts,
    };
  }
}
