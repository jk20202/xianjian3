// data/economy.ts
// 经济系统全局配置：起始金钱、回收折扣、经验曲线、死亡惩罚

/** 经济参数集中配置，方便平衡调优 */
export const ECONOMY = {
  /** 新游戏起始金钱 */
  startingGold: 100,
  /** 商店回收折扣（卖价 = 原价 × buybackRate） */
  buybackRate: 0.5,
  /** 升到 level+1 所需经验（level 为当前等级） */
  expToLevel: (level: number): number => Math.floor(100 * level * level * 0.8),
  /** 死亡惩罚：扣除当前金钱的比例 */
  deathPenaltyGold: 0.1,
};
