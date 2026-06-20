import type { MapDef } from '../types';

const TS = 32; // 瓦片大小

/** 生成空瓦片地图(全空地) */
function blank(w: number, h: number, fill = 0): number[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
}

/** 设置矩形区域为指定瓦片 */
function rect(tiles: number[][], x: number, y: number, w: number, h: number, v: number) {
  for (let j = y; j < y + h && j < tiles.length; j++) {
    for (let i = x; i < x + w && i < tiles[0].length; i++) {
      if (j >= 0 && i >= 0) tiles[j][i] = v;
    }
  }
}

/** 边框围墙 */
function border(tiles: number[][]) {
  const h = tiles.length, w = tiles[0].length;
  for (let i = 0; i < w; i++) { tiles[0][i] = 1; tiles[h - 1][i] = 1; }
  for (let j = 0; j < h; j++) { tiles[j][0] = 1; tiles[j][w - 1] = 1; }
}

/** 随机散布草丛(遇敌区) */
function scatterGrass(tiles: number[][], count: number, seed: number) {
  let s = seed;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const h = tiles.length, w = tiles[0].length;
  let placed = 0, tries = 0;
  while (placed < count && tries < count * 10) {
    tries++;
    const x = 2 + Math.floor(rand() * (w - 4));
    const y = 2 + Math.floor(rand() * (h - 4));
    if (tiles[y][x] === 0) { tiles[y][x] = 2; placed++; }
  }
}

// ===== 渝州城(主城) =====
function buildYuzhou(): MapDef {
  const w = 40, h = 30;
  const tiles = blank(w, h);
  border(tiles);
  // 建筑物(障碍)
  rect(tiles, 4, 4, 6, 4, 1);   // 永安当
  rect(tiles, 14, 4, 5, 3, 1);  // 武器店
  rect(tiles, 22, 4, 5, 3, 1);  // 药店
  rect(tiles, 30, 4, 6, 4, 1);  // 民居
  rect(tiles, 4, 22, 6, 4, 1);
  rect(tiles, 14, 23, 5, 3, 1);
  rect(tiles, 30, 22, 6, 4, 1);
  // 草丛(遇敌区)在城外区域
  scatterGrass(tiles, 30, 12345);
  // 商店/NPC 标记(tile 值含义见 types)
  tiles[6][6] = 5;   // 永安当入口(剧情点)
  tiles[6][16] = 5;  // 武器店
  tiles[6][24] = 5;  // 药店
  // NPC
  return {
    id: 'yuzhou', name: '渝州城', width: w, height: h, tilesize: TS, bg: 0x1a2a1a,
    tiles, encounters: ['xiao_yao', 'shu_yao'], encounterRate: 0.012,
    spawns: { x: 20 * TS, y: 15 * TS },
    exits: [
      { x: 20 * TS, y: (h - 1) * TS - 4, to: 'bishan', toSpawn: { x: 2 * TS, y: 10 * TS } },
    ],
    npcs: [
      { x: 7 * TS, y: 8 * TS, id: 'npc_zhao', color: 0xc9a06a, name: '赵文昌' },
      { x: 20 * TS, y: 18 * TS, id: 'npc_oldman', color: 0x8a8a8a, name: '老者' },
      { x: 16 * TS, y: 8 * TS, id: 'npc_shop_w', color: 0xb0b0c0, name: '武器商' },
      { x: 24 * TS, y: 8 * TS, id: 'npc_shop_p', color: 0xa0c0a0, name: '药商' },
    ],
  };
}

// ===== 璧山(迷宫) =====
function buildBishan(): MapDef {
  const w = 50, h = 40;
  const tiles = blank(w, h);
  border(tiles);
  // 迷宫墙
  for (let j = 4; j < h - 4; j += 4) {
    for (let i = 4; i < w - 4; i += 6) {
      if ((j / 4 + i / 6) % 2 === 0) rect(tiles, i, j, 3, 2, 1);
    }
  }
  scatterGrass(tiles, 80, 999);
  return {
    id: 'bishan', name: '璧山', width: w, height: h, tilesize: TS, bg: 0x15201a,
    tiles, encounters: ['shu_yao', 'xiao_yao', 'yao_hua_wu_shi'], encounterRate: 0.025,
    spawns: { x: 2 * TS, y: 10 * TS },
    exits: [
      { x: (w - 1) * TS - 4, y: 20 * TS, to: 'tangjiabao', toSpawn: { x: 2 * TS, y: 15 * TS } },
      { x: 2 * TS, y: 10 * TS, to: 'yuzhou', toSpawn: { x: 20 * TS, y: (30 - 2) * TS } },
    ],
    npcs: [],
  };
}

// ===== 唐家堡 =====
function buildTangjiabao(): MapDef {
  const w = 36, h = 28;
  const tiles = blank(w, h);
  border(tiles);
  rect(tiles, 6, 5, 8, 5, 1);   // 演武厅
  rect(tiles, 22, 5, 8, 5, 1);  // 百毒楼
  rect(tiles, 6, 18, 8, 5, 1);
  rect(tiles, 22, 18, 8, 5, 1);
  scatterGrass(tiles, 20, 777);
  return {
    id: 'tangjiabao', name: '唐家堡', width: w, height: h, tilesize: TS, bg: 0x2a1a1a,
    tiles, encounters: ['yao_hua_wu_shi', 'pi_li_tang_di'], encounterRate: 0.015,
    spawns: { x: 2 * TS, y: 15 * TS },
    exits: [
      { x: 2 * TS, y: 15 * TS, to: 'bishan', toSpawn: { x: (50 - 2) * TS, y: 20 * TS } },
      { x: 18 * TS, y: (h - 1) * TS - 4, to: 'shushan_road', toSpawn: { x: 2 * TS, y: 10 * TS } },
    ],
    npcs: [
      { x: 10 * TS, y: 11 * TS, id: 'npc_tang', color: 0xc04040, name: '唐门弟子' },
    ],
  };
}

// ===== 蜀山故道(迷宫) =====
function buildShushanRoad(): MapDef {
  const w = 50, h = 50;
  const tiles = blank(w, h);
  border(tiles);
  // 螺旋山道
  for (let j = 6; j < h - 6; j += 5) {
    rect(tiles, 4, j, w - 8, 1, 1);
  }
  scatterGrass(tiles, 100, 321);
  return {
    id: 'shushan_road', name: '蜀山故道', width: w, height: h, tilesize: TS, bg: 0x1a1a2a,
    tiles, encounters: ['gui_hun', 'shi_jiang', 'yao_hua_wu_shi'], encounterRate: 0.03,
    spawns: { x: 2 * TS, y: 10 * TS },
    exits: [
      { x: 2 * TS, y: 10 * TS, to: 'tangjiabao', toSpawn: { x: 18 * TS, y: (28 - 2) * TS } },
      { x: (w - 1) * TS - 4, y: (h - 4) * TS, to: 'shushan', toSpawn: { x: 20 * TS, y: 20 * TS } },
    ],
    npcs: [],
  };
}

// ===== 蜀山派 =====
function buildShushan(): MapDef {
  const w = 40, h = 32;
  const tiles = blank(w, h);
  border(tiles);
  rect(tiles, 8, 6, 10, 6, 1);   // 无极阁
  rect(tiles, 24, 6, 8, 6, 1);   // 剑楼
  rect(tiles, 8, 20, 8, 6, 1);   // 经楼
  rect(tiles, 24, 20, 8, 6, 1);  // 锁妖塔入口
  tiles[23][27] = 6; // 锁妖塔剧情点
  return {
    id: 'shushan', name: '蜀山派', width: w, height: h, tilesize: TS, bg: 0x1a2a2a,
    tiles, encounters: [], encounterRate: 0,
    spawns: { x: 20 * TS, y: 20 * TS },
    exits: [
      { x: 2 * TS, y: 16 * TS, to: 'shushan_road', toSpawn: { x: (50 - 2) * TS, y: (50 - 4) * TS } },
      { x: (w - 2) * TS, y: 16 * TS, to: 'gutenglin', toSpawn: { x: 3 * TS, y: 3 * TS } },
    ],
    npcs: [
      { x: 13 * TS, y: 13 * TS, id: 'npc_qingwei', color: 0xe0e0e0, name: '掌门清微' },
      { x: 28 * TS, y: 13 * TS, id: 'npc_disciple', color: 0xb0c0d0, name: '蜀山弟子' },
    ],
  };
}

// ===== 古藤林(第4章迷宫) =====
function buildGutenglin(): MapDef {
  const w = 50, h = 45;
  const tiles = blank(w, h);
  border(tiles);
  // 藤蔓墙
  for (let j = 5; j < h - 5; j += 3) {
    for (let i = 4; i < w - 4; i += 4) {
      if (Math.random() > 0.4) rect(tiles, i, j, 2, 1, 1);
    }
  }
  scatterGrass(tiles, 110, 2024);
  tiles[40][45] = 6; // 精精传授剧情点
  return {
    id: 'gutenglin', name: '古藤林', width: w, height: h, tilesize: TS, bg: 0x15281a,
    tiles, encounters: ['gu_teng_jing', 'shu_yao', 'xiao_yao'], encounterRate: 0.03,
    spawns: { x: 3 * TS, y: 3 * TS },
    exits: [
      { x: 3 * TS, y: 3 * TS, to: 'shushan', toSpawn: { x: 20 * TS, y: 20 * TS } },
      { x: (w - 2) * TS, y: (h - 2) * TS, to: 'fengdu', toSpawn: { x: 3 * TS, y: 3 * TS } },
    ],
    npcs: [{ x: 45 * TS, y: 40 * TS, id: 'npc_jingjing', color: 0x7fae4f, name: '精精' }],
  };
}

// ===== 酆都(鬼城,第4章城镇) =====
function buildFengdu(): MapDef {
  const w = 38, h = 30;
  const tiles = blank(w, h);
  border(tiles);
  rect(tiles, 5, 5, 7, 4, 1);   // 冶炼密室
  rect(tiles, 26, 5, 7, 4, 1);  // 民居
  rect(tiles, 5, 21, 7, 4, 1);
  rect(tiles, 26, 21, 7, 4, 1);
  tiles[7][8] = 5; // 商店
  scatterGrass(tiles, 25, 88);
  return {
    id: 'fengdu', name: '酆都·鬼城', width: w, height: h, tilesize: TS, bg: 0x1a1a22,
    tiles, encounters: ['huang_quan_gui', 'gui_hun'], encounterRate: 0.018,
    spawns: { x: 3 * TS, y: 3 * TS },
    exits: [
      { x: 3 * TS, y: 3 * TS, to: 'gutenglin', toSpawn: { x: (50 - 2) * TS, y: (45 - 2) * TS } },
      { x: (w - 2) * TS, y: 15 * TS, to: 'rongyan_diyu', toSpawn: { x: 3 * TS, y: 3 * TS } },
    ],
    npcs: [
      { x: 8 * TS, y: 10 * TS, id: 'npc_yelian', color: 0xc98844, name: '冶炼师' },
      { x: 20 * TS, y: 15 * TS, id: 'npc_ghost', color: 0x8888aa, name: '鬼卒' },
    ],
  };
}

// ===== 熔岩地狱(第4章迷宫,火鬼王BOSS) =====
function buildRongyanDiyu(): MapDef {
  const w = 52, h = 48;
  const tiles = blank(w, h);
  border(tiles);
  // 熔岩裂隙
  for (let j = 6; j < h - 6; j += 5) {
    rect(tiles, 4, j, w - 8, 1, 1);
    if (j + 2 < h) rect(tiles, 8 + Math.floor(Math.random() * 10), j + 2, 6, 1, 1);
  }
  scatterGrass(tiles, 120, 555);
  tiles[h - 4][w - 4] = 6; // 火鬼王BOSS剧情点
  return {
    id: 'rongyan_diyu', name: '熔岩地狱', width: w, height: h, tilesize: TS, bg: 0x2a1410,
    tiles, encounters: ['huo_gui_bing', 'yan_jiang_yao', 'huo_gui'], encounterRate: 0.035,
    spawns: { x: 3 * TS, y: 3 * TS },
    exits: [
      { x: 3 * TS, y: 3 * TS, to: 'fengdu', toSpawn: { x: (38 - 2) * TS, y: 15 * TS } },
      { x: (w - 2) * TS, y: (h - 2) * TS, to: 'bingfenggu', toSpawn: { x: 3 * TS, y: 3 * TS } },
    ],
    npcs: [],
  };
}

// ===== 冰风谷(第5章迷宫) =====
function buildBingfenggu(): MapDef {
  const w = 50, h = 45;
  const tiles = blank(w, h);
  border(tiles);
  // 冰柱障碍
  for (let j = 5; j < h - 5; j += 4) {
    for (let i = 4; i < w - 4; i += 5) {
      if (Math.random() > 0.5) rect(tiles, i, j, 1, 2, 1);
    }
  }
  scatterGrass(tiles, 100, 77);
  tiles[h - 5][w - 5] = 6; // 雪见回肉身剧情点
  return {
    id: 'bingfenggu', name: '冰风谷', width: w, height: h, tilesize: TS, bg: 0x1a2233,
    tiles, encounters: ['bing_feng_ling', 'bing_can', 'hai_di_shou'], encounterRate: 0.032,
    spawns: { x: 3 * TS, y: 3 * TS },
    exits: [
      { x: 3 * TS, y: 3 * TS, to: 'rongyan_diyu', toSpawn: { x: (52 - 2) * TS, y: (48 - 2) * TS } },
      { x: (w - 2) * TS, y: (h - 2) * TS, to: 'haidicheng', toSpawn: { x: 3 * TS, y: 3 * TS } },
    ],
    npcs: [],
  };
}

// ===== 海底城(第5章迷宫) =====
function buildHaidicheng(): MapDef {
  const w = 52, h = 50;
  const tiles = blank(w, h);
  border(tiles);
  // 水晶柱
  for (let j = 6; j < h - 6; j += 6) {
    rect(tiles, 4, j, w - 8, 1, 1);
  }
  scatterGrass(tiles, 130, 314);
  tiles[h - 4][w / 2 | 0] = 6; // 溪风水碧剧情点
  return {
    id: 'haidicheng', name: '海底城', width: w, height: h, tilesize: TS, bg: 0x102233,
    tiles, encounters: ['hai_di_shou', 'bing_feng_ling', 'xie_qi_yao'], encounterRate: 0.035,
    spawns: { x: 3 * TS, y: 3 * TS },
    exits: [
      { x: 3 * TS, y: 3 * TS, to: 'bingfenggu', toSpawn: { x: (50 - 2) * TS, y: (45 - 2) * TS } },
      { x: (w - 2) * TS, y: (h - 2) * TS, to: 'jianzhong', toSpawn: { x: 3 * TS, y: 3 * TS } },
    ],
    npcs: [],
  };
}

// ===== 剑冢(第5章终幕,邪剑仙BOSS) =====
function buildJianzhong(): MapDef {
  const w = 48, h = 44;
  const tiles = blank(w, h);
  border(tiles);
  // 剑冢:密集剑柱
  for (let j = 5; j < h - 5; j += 3) {
    for (let i = 4; i < w - 4; i += 3) {
      if (Math.random() > 0.45) rect(tiles, i, j, 1, 1, 1);
    }
  }
  scatterGrass(tiles, 90, 9999);
  tiles[h - 4][w - 4] = 6; // 邪剑仙BOSS剧情点
  return {
    id: 'jianzhong', name: '剑冢', width: w, height: h, tilesize: TS, bg: 0x1a1a1a,
    tiles, encounters: ['jian_hun', 'xie_qi_yao', 'huang_quan_gui'], encounterRate: 0.038,
    spawns: { x: 3 * TS, y: 3 * TS },
    exits: [
      { x: 3 * TS, y: 3 * TS, to: 'haidicheng', toSpawn: { x: (52 - 2) * TS, y: (50 - 2) * TS } },
    ],
    npcs: [],
  };
}

export const MAPS: Record<string, MapDef> = {
  yuzhou: buildYuzhou(),
  bishan: buildBishan(),
  tangjiabao: buildTangjiabao(),
  shushan_road: buildShushanRoad(),
  shushan: buildShushan(),
  gutenglin: buildGutenglin(),
  fengdu: buildFengdu(),
  rongyan_diyu: buildRongyanDiyu(),
  bingfenggu: buildBingfenggu(),
  haidicheng: buildHaidicheng(),
  jianzhong: buildJianzhong(),
};

export function getMap(id: string): MapDef {
  const m = MAPS[id];
  if (!m) throw new Error(`未知地图: ${id}`);
  return m;
}
