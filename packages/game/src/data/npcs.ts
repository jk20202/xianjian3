// data/npcs.ts
// 第一章 NPC 定义

import type { VisualRef } from '../core/types';

/** NPC 定义 */
export interface NpcDef {
  id: string;
  name: string;
  sprite: VisualRef;
  defaultDialogue?: string;
}

export const NPCS: Record<string, NpcDef> = {
  // 当铺老板 —— 杂货铺 + 主线起始
  shop_owner: {
    id: 'shop_owner',
    name: '当铺老板',
    sprite: { kind: 'placeholder', shape: 'rect', color: 0x8b7355, size: 24, label: '当' },
    defaultDialogue: 'dlg_shop_owner',
  },

  // 武器店老板
  weapon_merchant: {
    id: 'weapon_merchant',
    name: '武器店老板',
    sprite: { kind: 'placeholder', shape: 'rect', color: 0x7a6650, size: 24, label: '武' },
  },

  // 神秘客人
  mysterious_guest: {
    id: 'mysterious_guest',
    name: '神秘客人',
    sprite: { kind: 'placeholder', shape: 'triangle', color: 0x4a4a6a, size: 24, label: '客' },
    defaultDialogue: 'dlg_mysterious_guest',
  },

  // 城中妇人
  woman_npc: {
    id: 'woman_npc',
    name: '城中妇人',
    sprite: { kind: 'placeholder', shape: 'circle', color: 0xcc6699, size: 22, label: '妇' },
    defaultDialogue: 'dlg_woman_npc',
  },

  // 存档老人
  save_keeper: {
    id: 'save_keeper',
    name: '存档老人',
    sprite: { kind: 'placeholder', shape: 'diamond', color: 0x99aacc, size: 22, label: '存' },
    defaultDialogue: 'dlg_save_keeper',
  },

  // 紫萱 —— 教学辅助
  zixuan: {
    id: 'zixuan',
    name: '紫萱',
    sprite: { kind: 'placeholder', shape: 'circle', color: 0xaa66cc, size: 24, label: '紫' },
    defaultDialogue: 'dlg_zixuan',
  },

  // 古道药农
  herbalist: {
    id: 'herbalist',
    name: '古道药农',
    sprite: { kind: 'placeholder', shape: 'rect', color: 0x66aa66, size: 22, label: '药' },
    defaultDialogue: 'dlg_herbalist',
  },

  // 雪见 —— 可加入队伍
  xuejian: {
    id: 'xuejian',
    name: '雪见',
    sprite: { kind: 'placeholder', shape: 'circle', color: 0xddaadd, size: 24, label: '雪' },
    defaultDialogue: 'dlg_xuejian',
  },
};
