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
import { NPCS } from '../data/npcs';
import type { NpcAppearance } from '../data/npcs';
import { MONSTER_MAP } from '../data/monsters';
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

  /** 渲染地图瓦片 —— 真实风格多层渲染 */
  private renderMap(mapDef: MapDef): void {
    const g = new Graphics();
    const ts = mapDef.tileSize;

    // 先画整体背景色
    g.rect(0, 0, mapDef.width * ts, mapDef.height * ts).fill(mapDef.bgColor);

    for (let y = 0; y < mapDef.height; y++) {
      for (let x = 0; x < mapDef.width; x++) {
        const tile = mapDef.tiles[y][x];
        const px = x * ts;
        const py = y * ts;
        const v = tileVariation(x, y);
        const brightness = 0.88 + (v / 255) * 0.24;
        const baseColor = TILE_COLORS[tile] ?? 0x3a3a4a;

        switch (tile) {
          case 0: this.drawFloor(g, px, py, ts, v, brightness, baseColor); break;
          case 1: this.drawWall(g, px, py, ts, v, brightness, baseColor); break;
          case 2: this.drawGrass(g, px, py, ts, v, brightness, baseColor); break;
          case 3: this.drawWater(g, px, py, ts, v, brightness, baseColor); break;
          case 4: this.drawTree(g, px, py, ts, v, brightness); break;
          case 5: this.drawPath(g, px, py, ts, v, brightness, baseColor); break;
          case 6: this.drawBridge(g, px, py, ts, v, brightness, baseColor); break;
          default:
            g.rect(px, py, ts, ts).fill({ color: adjustBrightness(baseColor, brightness) });
            break;
        }
      }
    }

    // 出口传送门 —— 螺旋光晕
    for (const exit of mapDef.exits) {
      const cx = exit.x * ts + ts / 2;
      const cy = exit.y * ts + ts / 2;
      const portalColor = exit.locked ? 0xff3333 : 0x33ff66;
      // 多层光晕
      for (let i = 5; i >= 1; i--) {
        g.circle(cx, cy, ts * 0.15 * i).fill({ color: portalColor, alpha: 0.08 * i });
      }
      g.circle(cx, cy, ts * 0.12).fill({ color: 0xffffff, alpha: 0.9 });
      // 粒子点
      for (let i = 0; i < 6; i++) {
        const seed = tileVariation(exit.x * 7 + i, exit.y * 11 + i);
        const a = (seed / 255) * Math.PI * 2;
        const r = ts * 0.5 + (seed / 255) * ts * 0.2;
        g.circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2).fill({ color: portalColor, alpha: 0.6 });
      }
      if (exit.locked) {
        // 锁图标
        g.roundRect(cx - 5, cy - 4, 10, 8, 2).fill({ color: 0x000000, alpha: 0.7 });
        g.circle(cx, cy - 4, 4).fill({ color: 0x000000, alpha: 0.0 });
        g.arc(cx, cy - 5, 4, Math.PI, 0).stroke({ width: 1.5, color: 0x000000, alpha: 0.7 });
      }
    }

    this.api.world.addChild(g);
    this.mapGraphics = g;
  }

  /** 石板地 */
  private drawFloor(g: Graphics, px: number, py: number, ts: number, v: number, br: number, base: number): void {
    g.rect(px, py, ts, ts).fill({ color: adjustBrightness(base, br) });
    // 石板缝隙
    g.rect(px, py, ts, 1).fill({ color: 0x1a1a24, alpha: 0.4 });
    g.rect(px, py, 1, ts).fill({ color: 0x1a1a24, alpha: 0.4 });
    // 随机小石子
    if (v % 4 === 0) g.circle(px + ts * 0.3 + (v % 7), py + ts * 0.5, 1).fill({ color: 0x555566, alpha: 0.5 });
    if (v % 5 === 2) g.circle(px + ts * 0.7, py + ts * 0.3 + (v % 6), 1).fill({ color: 0x555566, alpha: 0.4 });
    // 裂纹
    if (v % 7 === 0) {
      g.moveTo(px + ts * 0.2, py + ts * 0.3).lineTo(px + ts * 0.5, py + ts * 0.6).lineTo(px + ts * 0.7, py + ts * 0.4)
        .stroke({ width: 0.5, color: 0x222230, alpha: 0.4 });
    }
  }

  /** 城墙/建筑 —— 3D 立体方块 */
  private drawWall(g: Graphics, px: number, py: number, ts: number, v: number, br: number, base: number): void {
    // 前面（主色，底部偏暗）
    g.rect(px, py + ts * 0.2, ts, ts * 0.8).fill({ color: adjustBrightness(base, br * 0.65) });
    // 顶面（亮色，模拟光照）
    g.rect(px, py, ts, ts * 0.25).fill({ color: adjustBrightness(base, br * 1.2) });
    // 顶面高光
    g.rect(px, py, ts, 2).fill({ color: adjustBrightness(base, br * 1.4), alpha: 0.7 });
    // 砖块纹路
    g.rect(px, py + ts * 0.35, ts, 1).fill({ color: 0x1a1a2a, alpha: 0.5 });
    g.rect(px, py + ts * 0.6, ts, 1).fill({ color: 0x1a1a2a, alpha: 0.5 });
    // 竖向砖缝（错位）
    const offset = (v % 2) * (ts * 0.5);
    g.rect(px + offset, py + ts * 0.2, 1, ts * 0.4).fill({ color: 0x1a1a2a, alpha: 0.4 });
    g.rect(px + (offset === 0 ? ts * 0.5 : 0), py + ts * 0.6, 1, ts * 0.4).fill({ color: 0x1a1a2a, alpha: 0.4 });
    // 边框
    g.rect(px, py, ts, ts).stroke({ width: 1, color: 0x0a0a14 });
  }

  /** 草地 —— 草叶+花朵 */
  private drawGrass(g: Graphics, px: number, py: number, ts: number, v: number, br: number, base: number): void {
    g.rect(px, py, ts, ts).fill({ color: adjustBrightness(base, br) });
    // 草叶（4 根，用 v 做确定性偏移）
    const bladeColors = [adjustBrightness(base, br * 1.3), adjustBrightness(base, br * 1.15), adjustBrightness(base, br * 0.85)];
    const positions = [
      [0.2, 0.3], [0.5, 0.6], [0.75, 0.25], [0.35, 0.75],
    ];
    for (let i = 0; i < 4; i++) {
      const bx = px + ts * positions[i][0];
      const by = py + ts * positions[i][1];
      const bh = 3 + (v % 4);
      g.moveTo(bx, by + bh).lineTo(bx + 1, by).stroke({ width: 1, color: bladeColors[i % 3] });
    }
    // 小花朵
    if (v % 13 === 0) {
      const flowerColors = [0xffee44, 0xffaaaa, 0xffeeff, 0xff8844];
      g.circle(px + ts * 0.4, py + ts * 0.5, 1.5).fill({ color: flowerColors[v % 4] });
    }
    if (v % 17 === 3) {
      g.circle(px + ts * 0.7, py + ts * 0.3, 1.5).fill({ color: 0xffee44 });
    }
  }

  /** 水域 —— 波纹+倒影 */
  private drawWater(g: Graphics, px: number, py: number, ts: number, v: number, br: number, base: number): void {
    g.rect(px, py, ts, ts).fill({ color: adjustBrightness(base, br * 0.8) });
    // 深水渐变（底部更深）
    g.rect(px, py + ts * 0.6, ts, ts * 0.4).fill({ color: adjustBrightness(base, br * 0.5), alpha: 0.4 });
    // 波纹椭圆
    const hl = adjustBrightness(base, br * 1.5);
    g.ellipse(px + ts * 0.3, py + ts * 0.35, ts * 0.18, ts * 0.05).fill({ color: hl, alpha: 0.45 });
    g.ellipse(px + ts * 0.7, py + ts * 0.65, ts * 0.14, ts * 0.04).fill({ color: hl, alpha: 0.35 });
    if (v % 2 === 0) {
      g.ellipse(px + ts * 0.5, py + ts * 0.5, ts * 0.1, ts * 0.03).fill({ color: 0xffffff, alpha: 0.25 });
    }
    // 荷叶（偶尔）
    if (v % 23 === 0) {
      g.circle(px + ts * 0.3, py + ts * 0.4, ts * 0.12).fill({ color: 0x2d6a2d, alpha: 0.7 });
      g.circle(px + ts * 0.3, py + ts * 0.4, ts * 0.06).fill({ color: 0x4a8a4a, alpha: 0.5 });
    }
  }

  /** 树木 —— 树干+多层树冠 */
  private drawTree(g: Graphics, px: number, py: number, ts: number, v: number, br: number): void {
    // 地面
    g.rect(px, py, ts, ts).fill({ color: adjustBrightness(0x3a5a2a, br) });
    // 树干
    const trunkW = ts * 0.14;
    const trunkH = ts * 0.5;
    const trunkX = px + ts * 0.43;
    const trunkY = py + ts * 0.4;
    g.rect(trunkX, trunkY, trunkW, trunkH).fill({ color: adjustBrightness(0x6b4226, br) });
    // 树皮纹理
    g.rect(trunkX + trunkW * 0.3, trunkY, 1, trunkH).fill({ color: 0x4a2a16, alpha: 0.5 });
    g.rect(trunkX + trunkW * 0.6, trunkY, 1, trunkH * 0.7).fill({ color: 0x4a2a16, alpha: 0.4 });
    // 树冠（3-4 层重叠圆）
    const cx = px + ts * 0.5;
    const cy = py + ts * 0.3;
    const r = ts * 0.36;
    const c1 = adjustBrightness(0x1d4a0f, br);
    const c2 = adjustBrightness(0x2d6a1f, br);
    const c3 = adjustBrightness(0x3d8a2f, br);
    // 底层（暗）
    g.circle(cx, cy + 2, r).fill({ color: c1 });
    g.circle(cx, cy + 2, r).stroke({ width: 1, color: 0x0a2a05, alpha: 0.6 });
    // 中层
    g.circle(cx - 2, cy, r * 0.85).fill({ color: c2 });
    // 高光层
    g.circle(cx - 4, cy - 3, r * 0.5).fill({ color: c3, alpha: 0.7 });
    g.circle(cx - 6, cy - 5, r * 0.2).fill({ color: adjustBrightness(c3, 1.3), alpha: 0.5 });
    // 小枝
    if (v % 3 === 0) {
      g.moveTo(cx + r * 0.5, cy).lineTo(cx + r * 0.8, cy + 4).stroke({ width: 1, color: 0x4a2a16 });
    }
  }

  /** 道路 —— 泥土+石子 */
  private drawPath(g: Graphics, px: number, py: number, ts: number, v: number, br: number, base: number): void {
    g.rect(px, py, ts, ts).fill({ color: adjustBrightness(base, br) });
    // 边缘提亮
    g.rect(px, py, ts, 1).fill({ color: adjustBrightness(base, br * 1.2), alpha: 0.4 });
    // 石子
    if (v % 3 === 0) g.circle(px + ts * 0.25, py + ts * 0.4, 1).fill({ color: 0x6a6a5a, alpha: 0.5 });
    if (v % 4 === 1) g.circle(px + ts * 0.7, py + ts * 0.6, 1).fill({ color: 0x6a6a5a, alpha: 0.4 });
    // 脚印
    if (v % 11 === 0) {
      g.ellipse(px + ts * 0.3, py + ts * 0.5, 2, 1).fill({ color: 0x4a4a3a, alpha: 0.3 });
      g.ellipse(px + ts * 0.5, py + ts * 0.6, 2, 1).fill({ color: 0x4a4a3a, alpha: 0.3 });
    }
  }

  /** 桥 —— 木板+纹理 */
  private drawBridge(g: Graphics, px: number, py: number, ts: number, v: number, br: number, base: number): void {
    g.rect(px, py, ts, ts).fill({ color: adjustBrightness(base, br) });
    // 3 块木板
    const plankH = ts / 3;
    for (let i = 0; i < 3; i++) {
      const py2 = py + i * plankH;
      g.rect(px, py2, ts, plankH - 1).fill({ color: adjustBrightness(base, br * (0.9 + i * 0.05)) });
      // 木纹
      g.moveTo(px + 2, py2 + plankH * 0.5).lineTo(px + ts - 2, py2 + plankH * 0.5)
        .stroke({ width: 0.5, color: 0x5a3a1a, alpha: 0.4 });
      // 板缝
      g.rect(px, py2 + plankH - 1, ts, 1).fill({ color: 0x3a2a0a, alpha: 0.6 });
    }
    // 钉子
    g.circle(px + 3, py + 3, 1).fill({ color: 0x4a3a2a });
    g.circle(px + ts - 3, py + 3, 1).fill({ color: 0x4a3a2a });
    g.circle(px + 3, py + ts - 3, 1).fill({ color: 0x4a3a2a });
    g.circle(px + ts - 3, py + ts - 3, 1).fill({ color: 0x4a3a2a });
    // 边框
    g.rect(px, py, ts, ts).stroke({ width: 1, color: 0x4a3a1a, alpha: 0.5 });
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

    // === 阴影（脚下椭圆） ===
    const shadowG = new Graphics();
    shadowG.ellipse(0, size * 0.4, size * 0.5, size * 0.18).fill({ color: 0x000000, alpha: 0.35 });
    container.addChild(shadowG);

    // === 主体 ===
    const bodyG = new Graphics();

    if (entity.type === 'player' || entity.type === 'teammate') {
      // 玩家/队友：从角色定义读取外观配置
      const charDef = entity.characterId ? CHARACTER_MAP[entity.characterId] : undefined;
      const appearance: NpcAppearance = charDef?.appearance ?? {
        bodyColor: entity.sprite.color,
        skinColor: 0xffdab9,
        hairColor: elementColor,
        hairStyle: 'short',
        accessory: 'none',
        bodyType: 'normal',
      };
      this.drawHumanoid(bodyG, appearance, size, elementColor, entity.facing);
    } else if (entity.type === 'npc') {
      // NPC：从 NPCS 表读取外观配置，无则用默认
      const npcDef = entity.npcId ? NPCS[entity.npcId] : undefined;
      const appearance: NpcAppearance = npcDef?.appearance ?? {
        bodyColor: 0x8a8a9a,
        skinColor: 0xffdab9,
        hairColor: 0x3a3a3a,
        hairStyle: 'short',
        accessory: 'none',
        bodyType: 'normal',
      };
      this.drawHumanoid(bodyG, appearance, size, elementColor, entity.facing);
      // NPC 任务标记（感叹号）
      bodyG.rect(-1.5, -size * 0.75, 3, size * 0.18).fill(0xffdd00);
      bodyG.circle(0, -size * 0.8, 2.5).fill(0xffdd00);
    } else if (entity.type === 'monster') {
      // 怪物：按怪物 id 绘制不同形态
      this.drawMonster(bodyG, entity, size, elementColor);
    } else if (entity.type === 'projectile') {
      // 投射物：发光球 + 粒子拖尾
      this.drawProjectile(bodyG, size, elementColor);
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

  /**
   * 绘制人形角色（玩家/队友/NPC 通用）
   * 包含：腿、身体、腰带、手臂、头、头发、眼睛、嘴、武器、元素光晕
   */
  private drawHumanoid(
    g: Graphics,
    app: NpcAppearance,
    size: number,
    elementColor: number,
    _facing: number,
  ): void {
    // 体型缩放：slim 瘦、normal 标准、old 驼背略小、child 矮小
    const bodyScale = app.bodyType === 'slim' ? 0.85
      : app.bodyType === 'old' ? 0.9
      : app.bodyType === 'child' ? 0.7
      : 1.0;
    const bw = size * 0.6 * bodyScale;   // 身体宽度
    const bh = size * 0.5 * bodyScale;   // 身体高度
    const legColor = adjustBrightness(app.bodyColor, 0.6);
    const armColor = adjustBrightness(app.bodyColor, 0.85);
    const beltColor = adjustBrightness(app.bodyColor, 0.4);

    // 1. 腿部（两条小矩形，深色）
    const legW = bw * 0.25;
    const legH = size * 0.2;
    g.rect(-bw * 0.3, size * 0.25, legW, legH).fill(legColor);
    g.rect(bw * 0.05, size * 0.25, legW, legH).fill(legColor);
    g.rect(-bw * 0.3, size * 0.25, legW, legH).stroke({ width: 1, color: 0x000000, alpha: 0.3 });
    g.rect(bw * 0.05, size * 0.25, legW, legH).stroke({ width: 1, color: 0x000000, alpha: 0.3 });

    // 2. 身体/躯干（圆角矩形 + 腰带线）
    const bodyY = -size * 0.1;
    g.roundRect(-bw / 2, bodyY, bw, bh, 4).fill(app.bodyColor);
    g.roundRect(-bw / 2, bodyY, bw, bh, 4).stroke({ width: 1, color: 0x000000, alpha: 0.4 });
    // 腰带
    g.rect(-bw / 2, bodyY + bh * 0.65, bw, 2).fill(beltColor);

    // 3. 手臂（两侧小矩形）
    const armW = bw * 0.18;
    const armH = bh * 0.7;
    g.rect(-bw / 2 - armW, bodyY + 2, armW, armH).fill(armColor);
    g.rect(bw / 2, bodyY + 2, armW, armH).fill(armColor);
    g.rect(-bw / 2 - armW, bodyY + 2, armW, armH).stroke({ width: 1, color: 0x000000, alpha: 0.3 });
    g.rect(bw / 2, bodyY + 2, armW, armH).stroke({ width: 1, color: 0x000000, alpha: 0.3 });

    // 4. 头部（圆形，肤色）
    const headR = size * 0.22 * bodyScale;
    const headY = bodyY - headR + 2;
    g.circle(0, headY, headR).fill(app.skinColor);
    g.circle(0, headY, headR).stroke({ width: 1, color: 0x000000, alpha: 0.4 });

    // 5. 头发（按 hairStyle 绘制）
    this.drawHair(g, app.hairStyle, app.hairColor, headR, headY);

    // 6. 眼睛（两个小黑点）
    g.circle(-headR * 0.35, headY, Math.max(1, headR * 0.12)).fill(0x000000);
    g.circle(headR * 0.35, headY, Math.max(1, headR * 0.12)).fill(0x000000);

    // 7. 嘴（小横线）
    g.moveTo(-headR * 0.25, headY + headR * 0.45)
      .lineTo(headR * 0.25, headY + headR * 0.45)
      .stroke({ width: 1, color: 0x000000, alpha: 0.6 });

    // 8. 配饰（胡子/眼镜/武器等）
    this.drawAccessory(g, app.accessory, app, size, headR, headY, bodyY, bh);

    // 9. 元素光晕（武器后方小圆，alpha 0.3）
    g.circle(size * 0.35, bodyY + bh * 0.3, size * 0.12).fill({ color: elementColor, alpha: 0.3 });
  }

  /** 按发型绘制头发 */
  private drawHair(
    g: Graphics,
    style: NpcAppearance['hairStyle'],
    hairColor: number,
    headR: number,
    headY: number,
  ): void {
    switch (style) {
      case 'short':
        // 短发：头顶小弧
        g.circle(0, headY - headR * 0.4, headR * 0.85).fill(hairColor);
        g.rect(-headR * 0.9, headY - headR * 0.4, headR * 1.8, headR * 0.5).fill(hairColor);
        break;
      case 'long':
        // 长发：头顶 + 两侧下垂矩形
        g.circle(0, headY - headR * 0.4, headR * 0.85).fill(hairColor);
        g.rect(-headR * 1.05, headY - headR * 0.5, headR * 0.4, headR * 2.2).fill(hairColor);
        g.rect(headR * 0.65, headY - headR * 0.5, headR * 0.4, headR * 2.2).fill(hairColor);
        break;
      case 'bun':
        // 发髻：头顶圆球 + 底层头发
        g.circle(0, headY - headR * 0.4, headR * 0.85).fill(hairColor);
        g.circle(0, headY - headR * 1.1, headR * 0.35).fill(hairColor);
        g.circle(0, headY - headR * 1.1, headR * 0.35).stroke({ width: 1, color: 0x000000, alpha: 0.3 });
        break;
      case 'bald':
        // 光头：不画头发
        break;
      case 'hat':
        // 帽子：头顶矩形 + 帽檐
        g.rect(-headR * 1.1, headY - headR * 1.0, headR * 2.2, headR * 0.6).fill(hairColor);
        g.rect(-headR * 1.3, headY - headR * 0.5, headR * 2.6, headR * 0.2).fill(adjustBrightness(hairColor, 0.7));
        break;
    }
  }

  /** 绘制配饰（胡子/眼镜/武器等） */
  private drawAccessory(
    g: Graphics,
    accessory: NpcAppearance['accessory'],
    app: NpcAppearance,
    size: number,
    headR: number,
    headY: number,
    bodyY: number,
    bh: number,
  ): void {
    const bw = size * 0.6;
    switch (accessory) {
      case 'beard':
        // 胡子：下巴下方小三角
        g.moveTo(-headR * 0.3, headY + headR * 0.6)
          .lineTo(0, headY + headR * 1.2)
          .lineTo(headR * 0.3, headY + headR * 0.6)
          .closePath().fill(app.hairColor);
        break;
      case 'glasses':
        // 眼镜：两个圆框
        g.circle(-headR * 0.35, headY, headR * 0.22).stroke({ width: 1, color: 0x000000 });
        g.circle(headR * 0.35, headY, headR * 0.22).stroke({ width: 1, color: 0x000000 });
        g.moveTo(-headR * 0.13, headY).lineTo(headR * 0.13, headY).stroke({ width: 1, color: 0x000000 });
        break;
      case 'sword':
        // 剑：身体右侧斜线 + 剑柄
        g.moveTo(bw * 0.55, bodyY + bh * 0.1)
          .lineTo(bw * 0.85, bodyY - bh * 0.6)
          .stroke({ width: 2, color: 0xcccccc });
        g.rect(bw * 0.5, bodyY + bh * 0.05, bw * 0.12, bh * 0.12).fill(0x8b5a2b);
        break;
      case 'staff':
        // 法杖：身体右侧竖线 + 顶端宝石
        g.rect(bw * 0.55, bodyY - bh * 0.5, 2, bh * 1.3).fill(0x8b5a2b);
        g.circle(bw * 0.56, bodyY - bh * 0.55, 3).fill(ELEMENT_COLOR[app.bodyColor === 0xaa66cc ? 'thunder' : 'water'] ?? 0x66ccff);
        break;
      case 'fan':
        // 扇子：身体右侧小三角
        g.moveTo(bw * 0.55, bodyY + bh * 0.2)
          .lineTo(bw * 0.9, bodyY - bh * 0.1)
          .lineTo(bw * 0.55, bodyY - bh * 0.3)
          .closePath().fill(0xddcc88);
        g.moveTo(bw * 0.55, bodyY + bh * 0.2)
          .lineTo(bw * 0.9, bodyY - bh * 0.1)
          .lineTo(bw * 0.55, bodyY - bh * 0.3)
          .closePath().stroke({ width: 1, color: 0x000000, alpha: 0.4 });
        break;
      case 'basket':
        // 篮子：身体左侧小矩形 + 提手
        g.rect(-bw * 0.85, bodyY + bh * 0.3, bw * 0.25, bh * 0.3).fill(0x8b5a2b);
        g.rect(-bw * 0.85, bodyY + bh * 0.3, bw * 0.25, bh * 0.3).stroke({ width: 1, color: 0x000000, alpha: 0.4 });
        g.moveTo(-bw * 0.8, bodyY + bh * 0.3)
          .lineTo(-bw * 0.72, bodyY + bh * 0.1)
          .lineTo(-bw * 0.65, bodyY + bh * 0.3)
          .stroke({ width: 1, color: 0x8b5a2b });
        break;
      case 'none':
      default:
        break;
    }
  }

  /** 绘制怪物（按怪物 id 区分形态） */
  private drawMonster(g: Graphics, entity: Entity, size: number, elementColor: number): void {
    const monsterDef = entity.monsterId ? MONSTER_MAP[entity.monsterId] : undefined;
    const bodyColor = entity.sprite.color;
    const ai = monsterDef?.ai ?? 'melee';
    const id = entity.monsterId ?? '';

    // 元素光晕背景
    g.circle(0, 0, size * 0.5).fill({ color: elementColor, alpha: 0.15 });

    if (id.startsWith('slime_')) {
      // 史莱姆：水滴形 + 眼睛 + 波浪底
      g.ellipse(0, 0, size * 0.4, size * 0.35).fill(bodyColor);
      g.ellipse(0, 0, size * 0.4, size * 0.35).stroke({ width: 2, color: 0x000000, alpha: 0.5 });
      // 波浪底
      g.moveTo(-size * 0.35, size * 0.3)
        .lineTo(-size * 0.2, size * 0.4).lineTo(-size * 0.05, size * 0.3)
        .lineTo(size * 0.1, size * 0.4).lineTo(size * 0.25, size * 0.3)
        .lineTo(size * 0.35, size * 0.35)
        .stroke({ width: 1, color: 0x000000, alpha: 0.4 });
      // 眼白
      g.circle(-size * 0.12, -size * 0.08, size * 0.09).fill(0xffffff);
      g.circle(size * 0.12, -size * 0.08, size * 0.09).fill(0xffffff);
      // 瞳孔（元素色）
      g.circle(-size * 0.12, -size * 0.08, size * 0.045).fill(elementColor);
      g.circle(size * 0.12, -size * 0.08, size * 0.045).fill(elementColor);
      // 嘴
      g.moveTo(-size * 0.08, size * 0.1).lineTo(size * 0.08, size * 0.1)
        .stroke({ width: 1, color: 0x000000 });
    } else if (id === 'wild_wolf' || id === 'bat_demon') {
      // 狼/蝠：拉长身体 + 尖耳 + 尾巴 + 腿
      g.ellipse(0, 0, size * 0.45, size * 0.25).fill(bodyColor);
      g.ellipse(0, 0, size * 0.45, size * 0.25).stroke({ width: 2, color: 0x000000, alpha: 0.5 });
      // 尖耳
      g.moveTo(-size * 0.25, -size * 0.2).lineTo(-size * 0.15, -size * 0.4).lineTo(-size * 0.1, -size * 0.2)
        .closePath().fill(bodyColor);
      g.moveTo(size * 0.25, -size * 0.2).lineTo(size * 0.15, -size * 0.4).lineTo(size * 0.1, -size * 0.2)
        .closePath().fill(bodyColor);
      // 尾巴
      g.moveTo(size * 0.4, 0).lineTo(size * 0.6, -size * 0.15).lineTo(size * 0.55, size * 0.05)
        .closePath().fill(bodyColor);
      // 腿
      g.rect(-size * 0.25, size * 0.2, size * 0.1, size * 0.15).fill(adjustBrightness(bodyColor, 0.7));
      g.rect(size * 0.15, size * 0.2, size * 0.1, size * 0.15).fill(adjustBrightness(bodyColor, 0.7));
      // 发光眼睛
      g.circle(-size * 0.15, -size * 0.05, size * 0.05).fill(elementColor);
      g.circle(size * 0.15, -size * 0.05, size * 0.05).fill(elementColor);
      g.circle(-size * 0.15, -size * 0.05, size * 0.025).fill(0xffffff);
      g.circle(size * 0.15, -size * 0.05, size * 0.025).fill(0xffffff);
    } else if (id === 'gudao_bandit') {
      // 山贼：人形 + 深色衣服 + 武器
      g.roundRect(-size * 0.3, -size * 0.1, size * 0.6, size * 0.5, 4).fill(bodyColor);
      g.roundRect(-size * 0.3, -size * 0.1, size * 0.6, size * 0.5, 4).stroke({ width: 1, color: 0x000000, alpha: 0.5 });
      g.circle(0, -size * 0.3, size * 0.2).fill(0xe8c39e);
      g.circle(0, -size * 0.3, size * 0.2).stroke({ width: 1, color: 0x000000, alpha: 0.4 });
      // 蒙面布
      g.rect(-size * 0.18, -size * 0.28, size * 0.36, size * 0.12).fill(0x2a2a2a);
      // 凶恶眼睛
      g.circle(-size * 0.07, -size * 0.32, 1.5).fill(0xff3333);
      g.circle(size * 0.07, -size * 0.32, 1.5).fill(0xff3333);
      // 武器（弯刀）
      g.moveTo(size * 0.3, -size * 0.1).lineTo(size * 0.5, -size * 0.3).lineTo(size * 0.45, -size * 0.05)
        .closePath().fill(0xcccccc);
    } else if (ai === 'boss' || id === 'jiaowai_yaoshou') {
      // Boss：更大身体 + 多眼 + 威慑光环
      g.circle(0, 0, size * 0.55).fill({ color: elementColor, alpha: 0.2 });
      g.circle(0, 0, size * 0.45).fill(bodyColor);
      g.circle(0, 0, size * 0.45).stroke({ width: 3, color: 0x000000, alpha: 0.6 });
      // 多只眼睛（3 只）
      g.circle(-size * 0.18, -size * 0.1, size * 0.08).fill(0xffffff);
      g.circle(0, -size * 0.15, size * 0.08).fill(0xffffff);
      g.circle(size * 0.18, -size * 0.1, size * 0.08).fill(0xffffff);
      g.circle(-size * 0.18, -size * 0.1, size * 0.04).fill(elementColor);
      g.circle(0, -size * 0.15, size * 0.04).fill(elementColor);
      g.circle(size * 0.18, -size * 0.1, size * 0.04).fill(elementColor);
      // 獠牙嘴
      g.moveTo(-size * 0.15, size * 0.1).lineTo(-size * 0.08, size * 0.25).lineTo(-size * 0.02, size * 0.1)
        .lineTo(size * 0.04, size * 0.25).lineTo(size * 0.1, size * 0.1).lineTo(size * 0.15, size * 0.22)
        .stroke({ width: 1.5, color: 0x000000 });
      // 角
      g.moveTo(-size * 0.3, -size * 0.3).lineTo(-size * 0.45, -size * 0.55).lineTo(-size * 0.2, -size * 0.35)
        .closePath().fill(adjustBrightness(bodyColor, 0.5));
      g.moveTo(size * 0.3, -size * 0.3).lineTo(size * 0.45, -size * 0.55).lineTo(size * 0.2, -size * 0.35)
        .closePath().fill(adjustBrightness(bodyColor, 0.5));
    } else {
      // 默认怪物形态：圆形 + 眼睛 + 嘴
      g.circle(0, 0, size * 0.4).fill(bodyColor);
      g.circle(0, 0, size * 0.4).stroke({ width: 2, color: 0x000000, alpha: 0.5 });
      g.circle(-size * 0.12, -size * 0.08, size * 0.09).fill(0xffffff);
      g.circle(size * 0.12, -size * 0.08, size * 0.09).fill(0xffffff);
      g.circle(-size * 0.12, -size * 0.08, size * 0.045).fill(elementColor);
      g.circle(size * 0.12, -size * 0.08, size * 0.045).fill(elementColor);
      g.moveTo(-size * 0.1, size * 0.12).lineTo(0, size * 0.22).lineTo(size * 0.1, size * 0.12)
        .stroke({ width: 1, color: 0x000000 });
    }
  }

  /** 绘制投射物（发光球 + 粒子拖尾） */
  private drawProjectile(g: Graphics, size: number, elementColor: number): void {
    // 4 个递减 alpha 的拖尾圆
    g.circle(-size * 0.6, 0, size * 0.15).fill({ color: elementColor, alpha: 0.15 });
    g.circle(-size * 0.4, 0, size * 0.22).fill({ color: elementColor, alpha: 0.3 });
    g.circle(-size * 0.2, 0, size * 0.3).fill({ color: elementColor, alpha: 0.45 });
    // 主体发光球
    g.circle(0, 0, size * 0.5).fill({ color: elementColor, alpha: 0.6 });
    g.circle(0, 0, size * 0.3).fill(0xffffff);
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
