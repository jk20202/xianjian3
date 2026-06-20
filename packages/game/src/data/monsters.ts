// data/monsters.ts
// 怪物数据表：渝州郊外 / 古道 普通怪 + 第一章 Boss
// 明雷遇敌，碰到触发就地战斗

import type { Element, VisualRef } from '../core/types';
import type { Stats } from './stats';

/** 怪物定义 */
export interface MonsterDef {
  id: string;
  name: string;
  element: Element;
  level: number;
  stats: Stats;
  skills: string[];
  ai: 'melee' | 'ranged' | 'boss';
  sprite: VisualRef;
  expReward: number;
  goldReward: number;
  drops?: { itemId: string; chance: number }[];
}

/** 视觉占位快捷构造 */
const vis = (
  shape: 'circle' | 'rect' | 'triangle' | 'diamond',
  color: number,
  size: number,
  label?: string,
): VisualRef => ({ kind: 'placeholder', shape, color, size, label });

/** 全部怪物表 */
export const MONSTERS: MonsterDef[] = [
  // ===== 渝州郊外普通怪 =====
  {
    id: 'slime_green',
    name: '青泥怪',
    element: 'earth',
    level: 2,
    stats: {
      hp: 60, mp: 0, atk: 8, def: 4, mag: 2, res: 2,
      spd: 2.5, crit: 0.05, critDmg: 1.3,
    },
    skills: ['m_bite'],
    ai: 'melee',
    sprite: vis('circle', 0x66cc66, 24, '泥'),
    expReward: 15,
    goldReward: 8,
    drops: [{ itemId: 'herb', chance: 0.3 }],
  },
  {
    id: 'slime_red',
    name: '赤泥怪',
    element: 'fire',
    level: 3,
    stats: {
      hp: 80, mp: 0, atk: 10, def: 5, mag: 4, res: 3,
      spd: 2.6, crit: 0.05, critDmg: 1.3,
    },
    skills: ['m_bite', 'm_claw'],
    ai: 'melee',
    sprite: vis('circle', 0xff6666, 26, '泥'),
    expReward: 22,
    goldReward: 12,
    drops: [{ itemId: 'hp_potion_s', chance: 0.2 }],
  },
  {
    id: 'wild_wolf',
    name: '山野孤狼',
    element: 'wind',
    level: 4,
    stats: {
      hp: 90, mp: 0, atk: 14, def: 5, mag: 3, res: 3,
      spd: 4.0, crit: 0.15, critDmg: 1.4,
    },
    skills: ['m_claw'],
    ai: 'melee',
    sprite: vis('triangle', 0x999999, 28, '狼'),
    expReward: 30,
    goldReward: 15,
    drops: [{ itemId: 'monster_core', chance: 0.15 }],
  },
  {
    id: 'bat_demon',
    name: '夜行蝠妖',
    element: 'wind',
    level: 5,
    stats: {
      hp: 70, mp: 20, atk: 8, def: 4, mag: 12, res: 6,
      spd: 3.5, crit: 0.1, critDmg: 1.4,
    },
    skills: ['m_dark_bolt'],
    ai: 'ranged',
    sprite: vis('triangle', 0x6644aa, 26, '蝠'),
    expReward: 35,
    goldReward: 18,
    drops: [{ itemId: 'mp_potion_s', chance: 0.2 }],
  },
  {
    id: 'stone_golem',
    name: '石头人',
    element: 'earth',
    level: 6,
    stats: {
      hp: 180, mp: 0, atk: 16, def: 14, mag: 4, res: 8,
      spd: 2.0, crit: 0.05, critDmg: 1.3,
    },
    skills: ['m_rock_throw', 'm_earthquake'],
    ai: 'melee',
    sprite: vis('rect', 0xcc9966, 32, '石'),
    expReward: 50,
    goldReward: 25,
    drops: [{ itemId: 'monster_core', chance: 0.3 }],
  },

  // ===== 古道普通怪 =====
  {
    id: 'gudao_bandit',
    name: '古道山贼',
    element: 'wind',
    level: 8,
    stats: {
      hp: 160, mp: 10, atk: 22, def: 10, mag: 6, res: 6,
      spd: 3.8, crit: 0.12, critDmg: 1.4,
    },
    skills: ['m_claw'],
    ai: 'melee',
    sprite: vis('triangle', 0xcc8844, 30, '贼'),
    expReward: 70,
    goldReward: 35,
    drops: [
      { itemId: 'hp_potion_m', chance: 0.2 },
      { itemId: 'leather_armor', chance: 0.05 },
    ],
  },
  {
    id: 'gudao_specter',
    name: '幽魂',
    element: 'water',
    level: 9,
    stats: {
      hp: 140, mp: 50, atk: 10, def: 8, mag: 22, res: 12,
      spd: 3.0, crit: 0.1, critDmg: 1.5,
    },
    skills: ['m_dark_bolt'],
    ai: 'ranged',
    sprite: vis('diamond', 0xaaaadd, 28, '魂'),
    expReward: 80,
    goldReward: 40,
    drops: [
      { itemId: 'mp_potion_m', chance: 0.2 },
      { itemId: 'jade_ring', chance: 0.05 },
    ],
  },

  // ===== 第一章 Boss =====
  {
    id: 'jiaowai_yaoshou',
    name: '郊外妖首',
    element: 'earth',
    level: 10,
    stats: {
      hp: 600, mp: 100, atk: 28, def: 18, mag: 20, res: 14,
      spd: 3.0, crit: 0.15, critDmg: 1.6,
    },
    skills: ['m_claw', 'm_earthquake', 'm_heal_self'],
    ai: 'boss',
    sprite: vis('rect', 0x884422, 48, '妖首'),
    expReward: 300,
    goldReward: 200,
    drops: [
      { itemId: 'ancient_fragment', chance: 1.0 },
      { itemId: 'hp_potion_m', chance: 0.5 },
      { itemId: 'jingtian_sword', chance: 0.1 },
    ],
  },
];

/** 按 id 查怪物 */
export const MONSTER_MAP: Record<string, MonsterDef> = Object.fromEntries(
  MONSTERS.map((m) => [m.id, m] as const),
);
