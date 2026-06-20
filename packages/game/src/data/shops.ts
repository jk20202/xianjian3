// data/shops.ts
// 渝州城商铺定义

/** 商店条目 */
export interface ShopItem {
  itemId: string;
  price: number;
  stock?: number;
}

/** 商店定义 */
export interface ShopDef {
  id: string;
  npcId: string;
  name: string;
  items: ShopItem[];
  buybackRate: number;
}

export const SHOPS: Record<string, ShopDef> = {
  // 杂货铺 —— 消耗品与材料
  shop_general: {
    id: 'shop_general',
    npcId: 'shop_owner',
    name: '杂货铺',
    items: [
      { itemId: 'hp_potion_s', price: 20 },
      { itemId: 'hp_potion_m', price: 50 },
      { itemId: 'mp_potion_s', price: 25 },
      { itemId: 'mp_potion_m', price: 60 },
      { itemId: 'herb', price: 5 },
    ],
    buybackRate: 0.5,
  },

  // 武器店 —— 基础装备
  shop_weapon: {
    id: 'shop_weapon',
    npcId: 'weapon_merchant',
    name: '武器店',
    items: [
      { itemId: 'iron_sword', price: 120 },
      { itemId: 'leather_armor', price: 80 },
      { itemId: 'jade_ring', price: 150 },
    ],
    buybackRate: 0.4,
  },
};
