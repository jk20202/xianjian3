// data/npcs.ts
// 第一章 NPC 定义

import type { VisualRef } from '../core/types';

/** NPC 外观配置 —— 定义视觉定制（衣服/肤色/发型/配饰/体型） */
export interface NpcAppearance {
  bodyColor: number;     // 衣服颜色
  skinColor: number;     // 肤色
  hairColor: number;     // 头发颜色
  hairStyle: 'short' | 'long' | 'bun' | 'bald' | 'hat';
  accessory?: 'beard' | 'glasses' | 'fan' | 'sword' | 'staff' | 'basket' | 'none';
  bodyType: 'slim' | 'normal' | 'old' | 'child';
}

/** NPC 定义 */
export interface NpcDef {
  id: string;
  name: string;
  sprite: VisualRef;
  defaultDialogue?: string;
  appearance?: NpcAppearance;
}

export const NPCS: Record<string, NpcDef> = {
  // 当铺老板 —— 杂货铺 + 主线起始（棕色长袍 + 帽子 + 胡子 + 老者体型）
  shop_owner: {
    id: 'shop_owner',
    name: '当铺老板',
    sprite: { kind: 'placeholder', shape: 'rect', color: 0x8b7355, size: 24, label: '当' },
    defaultDialogue: 'dlg_shop_owner',
    appearance: {
      bodyColor: 0x8b5a2b,      // 棕色长袍
      skinColor: 0xe8c39e,      // 老者肤色
      hairColor: 0x3a3a3a,      // 深灰头发
      hairStyle: 'hat',
      accessory: 'beard',
      bodyType: 'old',
    },
  },

  // 武器店老板（深色铠甲 + 光头 + 剑配饰 + 普通体型）
  weapon_merchant: {
    id: 'weapon_merchant',
    name: '武器店老板',
    sprite: { kind: 'placeholder', shape: 'rect', color: 0x7a6650, size: 24, label: '武' },
    appearance: {
      bodyColor: 0x3a3a4a,      // 深色铠甲
      skinColor: 0xf0c8a0,      // 古铜肤色
      hairColor: 0x2a2a2a,
      hairStyle: 'bald',
      accessory: 'sword',
      bodyType: 'normal',
    },
  },

  // 神秘客人（深色斗篷 + 长黑发 + 扇子 + 瘦削体型）
  mysterious_guest: {
    id: 'mysterious_guest',
    name: '神秘客人',
    sprite: { kind: 'placeholder', shape: 'triangle', color: 0x4a4a6a, size: 24, label: '客' },
    defaultDialogue: 'dlg_mysterious_guest',
    appearance: {
      bodyColor: 0x2a2a3a,      // 深色斗篷
      skinColor: 0xd8b890,      // 苍白肤色
      hairColor: 0x1a1a1a,      // 黑色长发
      hairStyle: 'long',
      accessory: 'fan',
      bodyType: 'slim',
    },
  },

  // 城中妇人（粉色衣裙 + 长发 + 篮子 + 瘦削体型）
  woman_npc: {
    id: 'woman_npc',
    name: '城中妇人',
    sprite: { kind: 'placeholder', shape: 'circle', color: 0xcc6699, size: 22, label: '妇' },
    defaultDialogue: 'dlg_woman_npc',
    appearance: {
      bodyColor: 0xcc6699,      // 粉色衣裙
      skinColor: 0xfad6b8,      // 白皙肤色
      hairColor: 0x4a2a1a,      // 棕黑长发
      hairStyle: 'long',
      accessory: 'basket',
      bodyType: 'slim',
    },
  },

  // 存档老人（蓝色长袍 + 光头 + 胡子 + 法杖 + 老者体型）
  save_keeper: {
    id: 'save_keeper',
    name: '存档老人',
    sprite: { kind: 'placeholder', shape: 'diamond', color: 0x99aacc, size: 22, label: '存' },
    defaultDialogue: 'dlg_save_keeper',
    appearance: {
      bodyColor: 0x4a6a9a,      // 蓝色长袍
      skinColor: 0xe8c39e,      // 老者肤色
      hairColor: 0xc0c0c0,      // 白发
      hairStyle: 'bald',
      accessory: 'staff',
      bodyType: 'old',
    },
  },

  // 紫萱 —— 教学辅助（紫色衣裙 + 长发 + 法杖 + 瘦削体型，治疗角色）
  zixuan: {
    id: 'zixuan',
    name: '紫萱',
    sprite: { kind: 'placeholder', shape: 'circle', color: 0xaa66cc, size: 24, label: '紫' },
    defaultDialogue: 'dlg_zixuan',
    appearance: {
      bodyColor: 0xaa66cc,      // 紫色衣裙
      skinColor: 0xfad6b8,      // 白皙肤色
      hairColor: 0x2a1a3a,      // 深紫长发
      hairStyle: 'long',
      accessory: 'staff',
      bodyType: 'slim',
    },
  },

  // 古道药农（绿色粗布衣 + 草帽 + 篮子 + 普通体型）
  herbalist: {
    id: 'herbalist',
    name: '古道药农',
    sprite: { kind: 'placeholder', shape: 'rect', color: 0x66aa66, size: 22, label: '药' },
    defaultDialogue: 'dlg_herbalist',
    appearance: {
      bodyColor: 0x66aa66,      // 绿色粗布衣
      skinColor: 0xd8a878,      // 风吹日晒肤色
      hairColor: 0x2a2a2a,
      hairStyle: 'hat',
      accessory: 'basket',
      bodyType: 'normal',
    },
  },

  // 雪见 —— 可加入队伍（土色衣裙 + 长发 + 瘦削体型）
  xuejian: {
    id: 'xuejian',
    name: '雪见',
    sprite: { kind: 'placeholder', shape: 'circle', color: 0xddaadd, size: 24, label: '雪' },
    defaultDialogue: 'dlg_xuejian',
    appearance: {
      bodyColor: 0xcc9966,      // 土色衣裙
      skinColor: 0xfad6b8,      // 白皙肤色
      hairColor: 0x4a2a1a,      // 棕黑长发
      hairStyle: 'long',
      accessory: 'none',
      bodyType: 'slim',
    },
  },
};
