// data/items.ts
// 物品数据表：消耗品 / 装备 / 材料
// 装备稀有度颜色：白(普通) 绿(精良) 蓝(稀有) 紫(史诗)

import type { VisualRef } from '../core/types';
import type { Stats } from './stats';

/** 物品定义 */
export interface ItemDef {
  id: string;
  name: string;
  type: 'consumable' | 'equipment' | 'material';
  subType?: 'weapon' | 'armor' | 'accessory';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic';
  price: number;
  description: string;
  effect?: {
    kind: 'heal_hp' | 'heal_mp' | 'heal_both' | 'buff_atk' | 'buff_def';
    value: number;
    duration?: number;
  };
  statsBonus?: Partial<Stats>;
  icon: VisualRef;
}

/** 视觉占位快捷构造 */
const vis = (
  shape: 'circle' | 'rect' | 'triangle' | 'diamond',
  color: number,
  size: number,
  label?: string,
): VisualRef => ({ kind: 'placeholder', shape, color, size, label });

/** 稀有度颜色（边框/底色） */
export const RARITY_COLOR: Record<ItemDef['rarity'], number> = {
  common: 0xcccccc,    // 白
  uncommon: 0x66cc66,  // 绿
  rare: 0x6699ff,      // 蓝
  epic: 0xcc66cc,      // 紫
};

/** 全部物品表 */
export const ITEMS: ItemDef[] = [
  // ===== 消耗品 =====
  {
    id: 'hp_potion_s',
    name: '金创药（小）',
    type: 'consumable',
    rarity: 'common',
    price: 20,
    description: '回复 50 点生命值。',
    effect: { kind: 'heal_hp', value: 50 },
    icon: vis('circle', 0xff6666, 20, '药'),
  },
  {
    id: 'hp_potion_m',
    name: '金创药（中）',
    type: 'consumable',
    rarity: 'common',
    price: 50,
    description: '回复 120 点生命值。',
    effect: { kind: 'heal_hp', value: 120 },
    icon: vis('circle', 0xff4444, 24, '药'),
  },
  {
    id: 'mp_potion_s',
    name: '灵泉露（小）',
    type: 'consumable',
    rarity: 'common',
    price: 25,
    description: '回复 30 点真气值。',
    effect: { kind: 'heal_mp', value: 30 },
    icon: vis('circle', 0x6699ff, 20, '露'),
  },
  {
    id: 'mp_potion_m',
    name: '灵泉露（中）',
    type: 'consumable',
    rarity: 'common',
    price: 60,
    description: '回复 80 点真气值。',
    effect: { kind: 'heal_mp', value: 80 },
    icon: vis('circle', 0x4477ff, 24, '露'),
  },
  {
    id: 'elixir',
    name: '还魂丹',
    type: 'consumable',
    rarity: 'uncommon',
    price: 150,
    description: '同时回复 100 点生命与真气。',
    effect: { kind: 'heal_both', value: 100 },
    icon: vis('diamond', 0xffcc44, 24, '丹'),
  },

  // ===== 装备·武器 =====
  {
    id: 'iron_sword',
    name: '铁剑',
    type: 'equipment',
    subType: 'weapon',
    rarity: 'common',
    price: 120,
    description: '普通的铁剑，聊胜于无。',
    statsBonus: { atk: 5 },
    icon: vis('triangle', 0xcccccc, 26, '铁'),
  },
  {
    id: 'jingtian_sword',
    name: '镇妖剑',
    type: 'equipment',
    subType: 'weapon',
    rarity: 'rare',
    price: 300,
    description: '景天专属佩剑，剑身蕴含烈火之力。',
    statsBonus: { atk: 10, crit: 0.03 },
    icon: vis('triangle', 0x6699ff, 28, '镇'),
  },
  {
    id: 'changqing_blade',
    name: '紫青剑',
    type: 'equipment',
    subType: 'weapon',
    rarity: 'rare',
    price: 280,
    description: '长卿佩剑，出鞘如雷鸣。',
    statsBonus: { atk: 8, spd: 0.2 },
    icon: vis('triangle', 0x6699ff, 28, '紫'),
  },
  {
    id: 'xuejian_staff',
    name: '翠玉杖',
    type: 'equipment',
    subType: 'weapon',
    rarity: 'uncommon',
    price: 250,
    description: '雪见法杖，翠玉凝聚地灵。',
    statsBonus: { mag: 12 },
    icon: vis('rect', 0x66cc66, 28, '翠'),
  },
  {
    id: 'longkui_wand',
    name: '雷灵珠',
    type: 'equipment',
    subType: 'weapon',
    rarity: 'rare',
    price: 290,
    description: '龙葵法器，封印雷灵之力。',
    statsBonus: { mag: 14, critDmg: 0.1 },
    icon: vis('diamond', 0x6699ff, 28, '雷'),
  },
  {
    id: 'zixuan_rod',
    name: '净瓶',
    type: 'equipment',
    subType: 'weapon',
    rarity: 'uncommon',
    price: 240,
    description: '紫萱法器，净瓶甘露润泽万物。',
    statsBonus: { mag: 10, res: 3 },
    icon: vis('rect', 0x66cc66, 28, '净'),
  },

  // ===== 装备·防具/饰品 =====
  {
    id: 'leather_armor',
    name: '粗布衣',
    type: 'equipment',
    subType: 'armor',
    rarity: 'common',
    price: 80,
    description: '普通粗布衣衫，聊胜于无。',
    statsBonus: { def: 5, hp: 20 },
    icon: vis('rect', 0xcccccc, 28, '布'),
  },
  {
    id: 'jade_ring',
    name: '翡翠环',
    type: 'equipment',
    subType: 'accessory',
    rarity: 'uncommon',
    price: 150,
    description: '翡翠雕琢的环饰，提升灵巧。',
    statsBonus: { crit: 0.05, spd: 0.1 },
    icon: vis('circle', 0x66cc66, 22, '翠'),
  },

  // ===== 材料 =====
  {
    id: 'herb',
    name: '草药',
    type: 'material',
    rarity: 'common',
    price: 5,
    description: '野外采集的草药，炼丹基础材料。',
    icon: vis('triangle', 0x66cc66, 18, '草'),
  },
  {
    id: 'monster_core',
    name: '妖核',
    type: 'material',
    rarity: 'uncommon',
    price: 30,
    description: '妖物体内凝结的核心，蕴含灵力。',
    icon: vis('diamond', 0xcc66cc, 20, '核'),
  },
  {
    id: 'ancient_fragment',
    name: '古剑碎片',
    type: 'material',
    rarity: 'rare',
    price: 100,
    description: '神秘古剑的碎片，似乎隐藏着某种力量。',
    icon: vis('triangle', 0x6699ff, 22, '碎'),
  },
  {
    id: 'jade_pendant',
    name: '祖传玉佩',
    type: 'material',
    rarity: 'rare',
    price: 200,
    description: '城中妇人祖传的玉佩，温润如脂。',
    icon: vis('circle', 0x66ccaa, 22, '佩'),
  },
  {
    id: 'ancient_sword',
    name: '神秘古剑',
    type: 'equipment',
    subType: 'weapon',
    rarity: 'epic',
    price: 0,
    description: '妖气森森的古剑，剑身刻有古老符文，似乎封印着某种力量。',
    statsBonus: { atk: 15, mag: 10, crit: 0.05 },
    icon: vis('triangle', 0xcc66cc, 32, '古'),
  },
];

/** 按 id 查物品 */
export const ITEM_MAP: Record<string, ItemDef> = Object.fromEntries(
  ITEMS.map((i) => [i.id, i] as const),
);
