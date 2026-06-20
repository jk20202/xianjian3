// data/maps.ts
// 第一章地图定义：渝州城、渝州郊外、古道。
// 瓦片值：0=空地(地板) 1=墙 2=草地 3=水 4=树 5=道路 6=桥

/** 怪物刷新点定义 */
export interface SpawnDef {
  monsterId: string;
  x: number;
  y: number;
  count: number;
  respawnMs: number;
}

/** NPC 放置点 */
export interface NpcPlacement {
  npcId: string;
  x: number;
  y: number;
  name: string;
  role: 'quest_giver' | 'shop' | 'dialogue' | 'save_point';
  shopId?: string;
  dialogueId?: string;
}

/** 地图出口 */
export interface ExitDef {
  toMapId: string;
  x: number;
  y: number; // 本地图上的出口位置
  targetX: number;
  targetY: number; // 目标地图上的出生位置
  locked?: boolean;
  lockReason?: string;
}

/** 地图定义 */
export interface MapDef {
  id: string;
  name: string;
  tiles: number[][];
  width: number;
  height: number;
  tileSize: number;
  isSafeZone: boolean;
  spawns: SpawnDef[];
  npcs: NpcPlacement[];
  exits: ExitDef[];
  shops?: string[];
  bgColor: number;
}

// ─── 瓦片生成辅助函数 ───────────────────────────────

/** 简单确定性随机数生成器（mulberry32），保证地图每次生成一致 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 创建填满指定值的二维瓦片数组 */
function createTiles(width: number, height: number, fill: number): number[][] {
  const tiles: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) row.push(fill);
    tiles.push(row);
  }
  return tiles;
}

/** 设置边界为指定值（默认墙） */
function addBorder(tiles: number[][], value = 1): void {
  const h = tiles.length;
  const w = tiles[0].length;
  for (let x = 0; x < w; x++) {
    tiles[0][x] = value;
    tiles[h - 1][x] = value;
  }
  for (let y = 0; y < h; y++) {
    tiles[y][0] = value;
    tiles[y][w - 1] = value;
  }
}

/** 填充矩形区域 */
function fillRect(tiles: number[][], x: number, y: number, w: number, h: number, value: number): void {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const px = x + dx;
      const py = y + dy;
      if (py >= 0 && py < tiles.length && px >= 0 && px < tiles[0].length) {
        tiles[py][px] = value;
      }
    }
  }
}

/** 散布随机瓦片（跳过墙、道路、桥等不可覆盖类型） */
function scatter(tiles: number[][], count: number, value: number, rng: () => number, avoid = [1, 5, 6]): void {
  const h = tiles.length;
  const w = tiles[0].length;
  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < count * 10) {
    attempts++;
    const x = Math.floor(rng() * w);
    const y = Math.floor(rng() * h);
    if (!avoid.includes(tiles[y][x])) {
      tiles[y][x] = value;
      placed++;
    }
  }
}

/** 画一条 L 形路径（先水平后垂直） */
function drawPath(tiles: number[][], x1: number, y1: number, x2: number, y2: number, value = 5): void {
  let x = x1;
  while (x !== x2) {
    tiles[y1][x] = value;
    x += x < x2 ? 1 : -1;
  }
  let y = y1;
  while (y !== y2) {
    tiles[y][x2] = value;
    y += y < y2 ? 1 : -1;
  }
  tiles[y2][x2] = value;
}

// ─── 各地图生成 ─────────────────────────────────────

/** 渝州城：安全区，石板路与建筑 */
function genYuzhouCity(): number[][] {
  const W = 40;
  const H = 30;
  const tiles = createTiles(W, H, 0); // 石板地
  addBorder(tiles, 1); // 城墙
  // 主路：十字交叉
  drawPath(tiles, 0, 15, 39, 15, 5); // 东西主街
  drawPath(tiles, 20, 0, 20, 29, 5); // 南北主街
  // 建筑物（墙块占位）
  fillRect(tiles, 8, 5, 6, 3, 1); // 杂货铺
  fillRect(tiles, 8, 17, 6, 3, 1); // 武器店
  fillRect(tiles, 26, 6, 5, 3, 1); // 民居
  fillRect(tiles, 26, 20, 5, 3, 1); // 民居
  fillRect(tiles, 16, 3, 4, 3, 1); // 当铺
  // 装饰树木
  const rng = mulberry32(20240601);
  scatter(tiles, 18, 4, rng);
  return tiles;
}

/** 渝州郊外：草地为主，有水域与树林 */
function genYuzhouSuburb(): number[][] {
  const W = 50;
  const H = 40;
  const tiles = createTiles(W, H, 2); // 草地
  addBorder(tiles, 1); // 山体边界
  // 东西向道路
  drawPath(tiles, 0, 15, 49, 15, 5);
  // 南北向小径
  drawPath(tiles, 25, 0, 25, 39, 5);
  // 水域
  fillRect(tiles, 10, 25, 8, 6, 3);
  fillRect(tiles, 35, 5, 6, 5, 3);
  // 桥（跨水）
  fillRect(tiles, 13, 24, 2, 1, 6);
  // 树林
  const rng = mulberry32(20240602);
  scatter(tiles, 40, 4, rng);
  return tiles;
}

/** 古道：荒路为主，有山贼出没 */
function genAncientPath(): number[][] {
  const W = 50;
  const H = 40;
  const tiles = createTiles(W, H, 5); // 荒路
  addBorder(tiles, 1); // 山壁
  // 主路
  drawPath(tiles, 0, 20, 49, 20, 5);
  drawPath(tiles, 25, 0, 25, 39, 5);
  // 草地斑块
  fillRect(tiles, 5, 5, 10, 8, 2);
  fillRect(tiles, 30, 25, 12, 10, 2);
  // 乱石（墙）
  fillRect(tiles, 15, 10, 3, 3, 1);
  fillRect(tiles, 35, 30, 3, 3, 1);
  // 枯树
  const rng = mulberry32(20240603);
  scatter(tiles, 25, 4, rng);
  return tiles;
}

// ─── 地图数据 ───────────────────────────────────────

export const MAPS: Record<string, MapDef> = {
  // 渝州城 —— 第一章起始安全区
  yuzhou_city: {
    id: 'yuzhou_city',
    name: '渝州城',
    tiles: genYuzhouCity(),
    width: 40,
    height: 30,
    tileSize: 32,
    isSafeZone: true,
    spawns: [],
    npcs: [
      { npcId: 'shop_owner', x: 12, y: 9, name: '当铺老板', role: 'quest_giver', shopId: 'shop_general', dialogueId: 'dlg_shop_owner' },
      { npcId: 'weapon_merchant', x: 12, y: 21, name: '武器店老板', role: 'shop', shopId: 'shop_weapon' },
      { npcId: 'mysterious_guest', x: 22, y: 6, name: '神秘客人', role: 'quest_giver', dialogueId: 'dlg_mysterious_guest' },
      { npcId: 'woman_npc', x: 28, y: 15, name: '城中妇人', role: 'quest_giver', dialogueId: 'dlg_woman_npc' },
      { npcId: 'save_keeper', x: 6, y: 6, name: '存档老人', role: 'save_point', dialogueId: 'dlg_save_keeper' },
      { npcId: 'zixuan', x: 18, y: 9, name: '紫萱', role: 'dialogue', dialogueId: 'dlg_zixuan' },
    ],
    exits: [
      { toMapId: 'yuzhou_suburb', x: 39, y: 15, targetX: 1, targetY: 15 },
    ],
    shops: ['shop_general', 'shop_weapon'],
    bgColor: 0xd4c9a8,
  },

  // 渝州郊外 —— 初级战斗区
  yuzhou_suburb: {
    id: 'yuzhou_suburb',
    name: '渝州郊外',
    tiles: genYuzhouSuburb(),
    width: 50,
    height: 40,
    tileSize: 32,
    isSafeZone: false,
    spawns: [
      { monsterId: 'slime_green', x: 15, y: 10, count: 3, respawnMs: 30000 },
      { monsterId: 'wild_wolf', x: 30, y: 28, count: 2, respawnMs: 45000 },
    ],
    npcs: [],
    exits: [
      { toMapId: 'yuzhou_city', x: 0, y: 15, targetX: 38, targetY: 15 },
      { toMapId: 'ancient_path', x: 49, y: 20, targetX: 1, targetY: 20 },
    ],
    bgColor: 0x88aa66,
  },

  // 古道 —— 高难度区，章节 BOSS 所在地
  ancient_path: {
    id: 'ancient_path',
    name: '古道',
    tiles: genAncientPath(),
    width: 50,
    height: 40,
    tileSize: 32,
    isSafeZone: false,
    spawns: [
      { monsterId: 'wild_wolf', x: 15, y: 15, count: 3, respawnMs: 45000 },
      { monsterId: 'gudao_bandit', x: 30, y: 25, count: 2, respawnMs: 60000 },
      { monsterId: 'jiaowai_yaoshou', x: 42, y: 20, count: 1, respawnMs: 120000 },
    ],
    npcs: [
      { npcId: 'herbalist', x: 6, y: 20, name: '古道药农', role: 'quest_giver', dialogueId: 'dlg_herbalist' },
      { npcId: 'xuejian', x: 36, y: 16, name: '雪见', role: 'quest_giver', dialogueId: 'dlg_xuejian' },
    ],
    exits: [
      { toMapId: 'yuzhou_suburb', x: 0, y: 20, targetX: 48, targetY: 20 },
      { toMapId: 'ch2_prologue', x: 49, y: 20, targetX: 1, targetY: 15, locked: true, lockReason: '需完成章节任务「调查古剑」方可通行' },
    ],
    bgColor: 0xb0a080,
  },
};
