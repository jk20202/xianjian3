// data/stats.ts
// 角色属性结构 + 升级计算

export interface Stats {
  hp: number;
  mp: number;
  atk: number;   // 物理攻击
  def: number;   // 物理防御
  mag: number;   // 法术攻击
  res: number;   // 法术防御
  spd: number;   // 速度（影响移动速度与出手）
  crit: number;  // 暴击率 0-1
  critDmg: number; // 暴击伤害倍率
}

export const EMPTY_STATS: Stats = {
  hp: 0, mp: 0, atk: 0, def: 0, mag: 0, res: 0, spd: 0, crit: 0, critDmg: 1.5,
};

export function addStats(a: Stats, b: Partial<Stats>): Stats {
  return {
    hp: a.hp + (b.hp ?? 0),
    mp: a.mp + (b.mp ?? 0),
    atk: a.atk + (b.atk ?? 0),
    def: a.def + (b.def ?? 0),
    mag: a.mag + (b.mag ?? 0),
    res: a.res + (b.res ?? 0),
    spd: a.spd + (b.spd ?? 0),
    crit: a.crit + (b.crit ?? 0),
    critDmg: a.critDmg + (b.critDmg ?? 0),
  };
}

/** 按成长计算某一级的属性（1 级为 base，每级加 growth） */
export function statsAtLevel(base: Stats, growth: Stats, level: number): Stats {
  const d = level - 1;
  return {
    hp: Math.round(base.hp + growth.hp * d),
    mp: Math.round(base.mp + growth.mp * d),
    atk: Math.round(base.atk + growth.atk * d),
    def: Math.round(base.def + growth.def * d),
    mag: Math.round(base.mag + growth.mag * d),
    res: Math.round(base.res + growth.res * d),
    spd: base.spd + growth.spd * d,
    crit: Math.min(0.95, base.crit + growth.crit * d),
    critDmg: base.critDmg + growth.critDmg * d,
  };
}
