// tests/shop.test.ts
// 商店系统单元测试

import { describe, it, expect, beforeEach } from 'vitest';
import { shopManager } from '../src/shop/ShopManager';

describe('商店系统', () => {
  beforeEach(() => {
    shopManager.close();
    shopManager.gold = 1000;
    shopManager.inventory = {};
  });

  it('打开商店后可以购买物品', () => {
    shopManager.open('shop_general');
    expect(shopManager.isActive).toBe(true);
    const result = shopManager.buy('hp_potion_s', 1);
    expect(result.ok).toBe(true);
    expect(shopManager.gold).toBe(980); // 1000 - 20
    expect(shopManager.inventory['hp_potion_s']).toBe(1);
  });

  it('金钱不足时不能购买', () => {
    shopManager.open('shop_general');
    shopManager.gold = 10;
    const result = shopManager.buy('hp_potion_s', 1);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('金钱');
  });

  it('可以出售物品', () => {
    shopManager.open('shop_general');
    shopManager.inventory['herb'] = 5;
    shopManager.gold = 100;
    const result = shopManager.sell('herb', 2);
    expect(result.ok).toBe(true);
    // herb 原价 5, 回收率 0.5, 卖价 2/个
    expect(shopManager.gold).toBe(104); // 100 + 2*2
    expect(shopManager.inventory['herb']).toBe(3);
  });

  it('未打开商店时不能交易', () => {
    const result = shopManager.buy('hp_potion_s');
    expect(result.ok).toBe(false);
  });

  it('获取商店物品列表', () => {
    shopManager.open('shop_general');
    const items = shopManager.getShopItems();
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].item).toBeDefined();
    expect(items[0].price).toBeGreaterThan(0);
  });
});
