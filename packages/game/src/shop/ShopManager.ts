// shop/ShopManager.ts
// 商店系统：管理商店开启/关闭、购买/出售物品。
// gold 和 inventory 由外部引用设置，ShopManager 直接操作这些引用。

import { SHOPS } from '../data/shops';
import type { ShopDef } from '../data/shops';
import { ITEM_MAP } from '../data/items';
import type { ItemDef } from '../data/items';

/** 购买/出售结果 */
export interface ShopResult {
  ok: boolean;
  reason?: string;
}

/** 商店物品条目 */
export interface ShopItemEntry {
  item: ItemDef;
  price: number;
  stock?: number;
}

/** 可出售物品条目 */
export interface SellableItemEntry {
  item: ItemDef;
  sellPrice: number;
  count: number;
}

class ShopManager {
  /** 当前商店 */
  currentShop: ShopDef | null = null;
  /** 玩家金钱（引用，由外部设置） */
  gold: number = 0;
  /** 玩家背包（引用，由外部设置） */
  inventory: Record<string, number> = {};

  /**
   * 打开商店
   * @param shopId 商店 ID
   */
  open(shopId: string): void {
    const shop = SHOPS[shopId];
    if (!shop) return;
    this.currentShop = shop;
  }

  /** 关闭商店 */
  close(): void {
    this.currentShop = null;
  }

  /**
   * 购买物品
   * @param itemId 物品 ID
   * @param count 购买数量
   */
  buy(itemId: string, count: number = 1): ShopResult {
    if (!this.currentShop) return { ok: false, reason: '商店未开启' };

    const shopItem = this.currentShop.items.find((i) => i.itemId === itemId);
    if (!shopItem) return { ok: false, reason: '物品不在商店中' };

    // 检查库存
    if (shopItem.stock !== undefined) {
      if (shopItem.stock < count) return { ok: false, reason: '库存不足' };
    }

    // 检查金钱
    const totalPrice = shopItem.price * count;
    if (this.gold < totalPrice) return { ok: false, reason: '金钱不足' };

    // 扣除金钱
    this.gold -= totalPrice;

    // 增加背包物品
    this.inventory[itemId] = (this.inventory[itemId] ?? 0) + count;

    // 扣减库存
    if (shopItem.stock !== undefined) {
      shopItem.stock -= count;
    }

    return { ok: true };
  }

  /**
   * 出售物品
   * @param itemId 物品 ID
   * @param count 出售数量
   */
  sell(itemId: string, count: number = 1): ShopResult {
    if (!this.currentShop) return { ok: false, reason: '商店未开启' };

    // 检查背包数量
    const have = this.inventory[itemId] ?? 0;
    if (have < count) return { ok: false, reason: '物品数量不足' };

    // 获取物品定义
    const item = ITEM_MAP[itemId];
    if (!item) return { ok: false, reason: '物品不存在' };

    // 计算出售价格（单价 = 原价 × 回收折扣）
    const unitSellPrice = Math.floor(item.price * this.currentShop.buybackRate);
    const totalSellPrice = unitSellPrice * count;

    // 扣减背包
    const remaining = have - count;
    if (remaining > 0) {
      this.inventory[itemId] = remaining;
    } else {
      delete this.inventory[itemId];
    }

    // 增加金钱
    this.gold += totalSellPrice;

    return { ok: true };
  }

  /**
   * 获取商店物品列表（含价格）
   */
  getShopItems(): ShopItemEntry[] {
    if (!this.currentShop) return [];
    const result: ShopItemEntry[] = [];
    for (const si of this.currentShop.items) {
      const item = ITEM_MAP[si.itemId];
      if (!item) continue;
      result.push({
        item,
        price: si.price,
        stock: si.stock,
      });
    }
    return result;
  }

  /**
   * 获取玩家可出售物品
   * 返回背包中所有有定义的物品及其回收价格
   */
  getSellableItems(): SellableItemEntry[] {
    if (!this.currentShop) return [];
    const result: SellableItemEntry[] = [];
    for (const [itemId, count] of Object.entries(this.inventory)) {
      if (count <= 0) continue;
      const item = ITEM_MAP[itemId];
      if (!item) continue;
      const sellPrice = Math.floor(item.price * this.currentShop.buybackRate);
      result.push({ item, sellPrice, count });
    }
    return result;
  }

  /** 当前是否在商店 */
  get isActive(): boolean {
    return this.currentShop !== null;
  }
}

/** 商店系统单例 */
export const shopManager = new ShopManager();
