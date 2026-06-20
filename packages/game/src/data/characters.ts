// data/characters.ts
// 5 位可玩角色定义：景天 / 长卿 / 雪见 / 龙葵 / 紫萱
// 属性按 1-30 级区间平衡，baseStats 为 1 级基础值，growth 为每级成长

import type { Element, VisualRef } from '../core/types';
import type { Stats } from './stats';
import type { NpcAppearance } from './npcs';

/** 角色定义 */
export interface CharacterDef {
  id: string;
  name: string;
  role: 'warrior' | 'swordsman' | 'mage' | 'healer';
  element: Element;
  baseStats: Stats;        // 1 级基础属性
  growth: Stats;            // 每级成长
  skills: string[];         // 可学技能 id 列表（按等级解锁）
  portrait: VisualRef;      // 立绘占位
  sprite: VisualRef;        // 战场精灵占位
  appearance?: NpcAppearance; // 视觉外观配置
}

/** 视觉占位快捷构造 */
const vis = (
  shape: 'circle' | 'rect' | 'triangle' | 'diamond',
  color: number,
  size: number,
  label?: string,
): VisualRef => ({ kind: 'placeholder', shape, color, size, label });

/** 全部可玩角色 */
export const CHARACTERS: CharacterDef[] = [
  // 景天 —— 主角，火属性战士，高血高防近战
  {
    id: 'jingtian',
    name: '景天',
    role: 'warrior',
    element: 'fire',
    baseStats: {
      hp: 220, mp: 40, atk: 18, def: 14, mag: 6, res: 6,
      spd: 3.0, crit: 0.08, critDmg: 1.5,
    },
    growth: {
      hp: 28, mp: 4, atk: 2.4, def: 1.8, mag: 0.4, res: 0.4,
      spd: 0.02, crit: 0.004, critDmg: 0.01,
    },
    skills: ['jt_qixing', 'jt_huoyan_zhan', 'jt_fentian', 'jt_feitian_daxue'],
    portrait: vis('rect', 0xff6644, 64, '景天'),
    sprite: vis('rect', 0xff6644, 32, '景'),
    appearance: {
      bodyColor: 0xff6644,      // 红橙色战士装
      skinColor: 0xf0c8a0,      // 古铜肤色
      hairColor: 0x1a1a1a,      // 黑色短发
      hairStyle: 'short',
      accessory: 'sword',
      bodyType: 'normal',
    },
  },

  // 长卿 —— 雷属性剑士，攻速快连击
  {
    id: 'changqing',
    name: '长卿',
    role: 'swordsman',
    element: 'thunder',
    baseStats: {
      hp: 170, mp: 60, atk: 16, def: 10, mag: 10, res: 8,
      spd: 4.2, crit: 0.12, critDmg: 1.6,
    },
    growth: {
      hp: 22, mp: 6, atk: 2.2, def: 1.3, mag: 1.0, res: 0.8,
      spd: 0.03, crit: 0.006, critDmg: 0.012,
    },
    skills: ['cq_leiting_jian', 'cq_lianshan', 'cq_shanying', 'cq_wanjian'],
    portrait: vis('triangle', 0xcc99ff, 64, '长卿'),
    sprite: vis('triangle', 0xcc99ff, 32, '卿'),
    appearance: {
      bodyColor: 0xeef2ff,      // 白蓝色剑士装
      skinColor: 0xfad6b8,      // 白皙肤色
      hairColor: 0x2a2a3a,      // 深色长发
      hairStyle: 'long',
      accessory: 'sword',
      bodyType: 'slim',
    },
  },

  // 雪见 —— 土属性法师，群体法术脆皮
  {
    id: 'xuejian',
    name: '雪见',
    role: 'mage',
    element: 'earth',
    baseStats: {
      hp: 120, mp: 100, atk: 8, def: 6, mag: 20, res: 10,
      spd: 3.0, crit: 0.05, critDmg: 1.5,
    },
    growth: {
      hp: 16, mp: 10, atk: 0.8, def: 0.6, mag: 2.6, res: 1.0,
      spd: 0.01, crit: 0.003, critDmg: 0.01,
    },
    skills: ['xj_luoshi', 'xj_dilie', 'xj_shifu', 'xj_yunshi'],
    portrait: vis('diamond', 0xcc9966, 64, '雪见'),
    sprite: vis('diamond', 0xcc9966, 32, '雪'),
    appearance: {
      bodyColor: 0xcc9966,      // 土色调法师袍
      skinColor: 0xfad6b8,      // 白皙肤色
      hairColor: 0x4a2a1a,      // 棕黑长发
      hairStyle: 'long',
      accessory: 'none',
      bodyType: 'slim',
    },
  },

  // 龙葵 —— 雷属性法师，单体高爆发
  {
    id: 'longkui',
    name: '龙葵',
    role: 'mage',
    element: 'thunder',
    baseStats: {
      hp: 110, mp: 110, atk: 8, def: 5, mag: 22, res: 9,
      spd: 3.2, crit: 0.1, critDmg: 1.7,
    },
    growth: {
      hp: 14, mp: 11, atk: 0.8, def: 0.5, mag: 2.8, res: 0.9,
      spd: 0.01, crit: 0.005, critDmg: 0.015,
    },
    skills: ['lk_leiji', 'lk_liansuo', 'lk_hunji', 'lk_leibao'],
    portrait: vis('diamond', 0x9966ff, 64, '龙葵'),
    sprite: vis('diamond', 0x9966ff, 32, '葵'),
    appearance: {
      bodyColor: 0x9966ff,      // 紫色雷系法师袍
      skinColor: 0xf0d8c0,      // 苍白肤色
      hairColor: 0x4a2a6a,      // 深紫长发
      hairStyle: 'long',
      accessory: 'none',
      bodyType: 'slim',
    },
  },

  // 紫萱 —— 水属性治疗，回复 + 增益
  {
    id: 'zixuan',
    name: '紫萱',
    role: 'healer',
    element: 'water',
    baseStats: {
      hp: 150, mp: 120, atk: 6, def: 8, mag: 16, res: 12,
      spd: 3.0, crit: 0.05, critDmg: 1.5,
    },
    growth: {
      hp: 20, mp: 12, atk: 0.6, def: 0.8, mag: 2.0, res: 1.2,
      spd: 0.01, crit: 0.002, critDmg: 0.005,
    },
    skills: ['zx_huichun', 'zx_jingshui', 'zx_shuijing', 'zx_pudu'],
    portrait: vis('circle', 0x6699ff, 64, '紫萱'),
    sprite: vis('circle', 0x6699ff, 32, '萱'),
    appearance: {
      bodyColor: 0x6699ff,      // 蓝色治疗袍
      skinColor: 0xfad6b8,      // 白皙肤色
      hairColor: 0x2a1a3a,      // 深紫长发
      hairStyle: 'long',
      accessory: 'staff',
      bodyType: 'slim',
    },
  },
];

/** 按 id 查角色 */
export const CHARACTER_MAP: Record<string, CharacterDef> = Object.fromEntries(
  CHARACTERS.map((c) => [c.id, c] as const),
);
