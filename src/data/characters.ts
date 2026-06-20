import type { PartyMember, SkillDef, Element } from '../types';
import { ELEMENT_LABEL } from '../core/elements';

/** 初始角色模板 */
const TEMPLATES: Record<string, Omit<PartyMember, 'level' | 'exp' | 'expToNext' | 'hp' | 'maxHp' | 'qi' | 'maxQi' | 'shen' | 'maxShen' | 'atk' | 'def' | 'spd' | 'luck' | 'skills' | 'learnedArts' | 'weapon' | 'inParty'>> = {
  jingtian: { id: 'jingtian', name: '景天', title: '永安当伙计', element: 'wind' },
  xuejian: { id: 'xuejian', name: '雪见', title: '唐门大小姐', element: 'earth' },
  longkui: { id: 'longkui', name: '龙葵', title: '姜国公主', element: 'thunder' },
  zixuan: { id: 'zixuan', name: '紫萱', title: '女娲族后裔', element: 'water' },
  changqing: { id: 'changqing', name: '徐长卿', title: '蜀山大弟子', element: 'fire' },
};

/** 各角色成长系数(每级提升) */
const GROWTH: Record<string, { hp: number; qi: number; shen: number; atk: number; def: number; spd: number; luck: number }> = {
  jingtian: { hp: 22, qi: 3, shen: 6, atk: 3.2, def: 1.8, spd: 2.4, luck: 2.0 },
  xuejian: { hp: 20, qi: 3, shen: 5, atk: 3.0, def: 2.0, spd: 2.6, luck: 2.2 },
  longkui: { hp: 18, qi: 4, shen: 7, atk: 2.8, def: 1.6, spd: 2.8, luck: 1.8 },
  zixuan: { hp: 16, qi: 3, shen: 9, atk: 2.4, def: 1.5, spd: 2.2, luck: 2.4 },
  changqing: { hp: 26, qi: 3, shen: 5, atk: 3.6, def: 2.2, spd: 2.0, luck: 1.6 },
};

/** 各角色初始自带技能 */
const STARTER_SKILLS: Record<string, string[]> = {
  jingtian: ['wind_blade', 'basic_attack'],
  xuejian: ['earth_spike', 'basic_attack'],
  longkui: ['thunder_bolt', 'gui_jiang', 'basic_attack'],
  zixuan: ['water_ice', 'basic_attack'],
  changqing: ['fire_burn', 'basic_attack'],
};

/** 各角色可学仙术系(不能学被自身克制的那系) */
const LEARNABLE_ARTS: Record<string, Element[]> = {
  jingtian: ['wind', 'water', 'fire', 'earth'],
  xuejian: ['earth', 'water', 'fire', 'thunder'],
  longkui: ['thunder', 'water', 'fire', 'earth'],
  zixuan: ['water', 'wind', 'thunder', 'earth'],
  changqing: ['fire', 'wind', 'thunder', 'earth'],
};

export function createCharacter(id: string, level = 1): PartyMember {
  const tpl = TEMPLATES[id];
  if (!tpl) throw new Error(`未知角色: ${id}`);
  const g = GROWTH[id];
  const lv = level - 1;
  const maxHp = Math.floor(80 + lv * g.hp);
  const maxQi = Math.floor(20 + lv * g.qi);
  const maxShen = Math.floor(40 + lv * g.shen);
  const member: PartyMember = {
    ...tpl,
    level,
    exp: 0,
    expToNext: expForLevel(level),
    maxHp,
    maxQi,
    maxShen,
    hp: maxHp,
    qi: maxQi,
    shen: maxShen,
    atk: Math.floor(12 + lv * g.atk),
    def: Math.floor(8 + lv * g.def),
    spd: Math.floor(10 + lv * g.spd),
    luck: Math.floor(8 + lv * g.luck),
    skills: [...STARTER_SKILLS[id]],
    learnedArts: [...LEARNABLE_ARTS[id]],
    weapon: null,
    inParty: id === 'jingtian',
  };
  return member;
}

export function expForLevel(level: number): number {
  return Math.floor(40 * Math.pow(level, 1.6));
}

/** 升级处理 */
export function gainExp(member: PartyMember, exp: number): { leveledUp: boolean; newSkills: string[] } {
  member.exp += exp;
  let leveledUp = false;
  const newSkills: string[] = [];
  while (member.exp >= member.expToNext) {
    member.exp -= member.expToNext;
    member.level += 1;
    leveledUp = true;
    const g = GROWTH[member.id];
    member.maxHp += g.hp;
    member.maxQi += g.qi;
    member.maxShen += g.shen;
    member.atk += Math.floor(g.atk);
    member.def += Math.floor(g.def);
    member.spd += Math.floor(g.spd);
    member.luck += Math.floor(g.luck);
    member.hp = member.maxHp;
    member.qi = member.maxQi;
    member.shen = member.maxShen;
    member.expToNext = expForLevel(member.level);
    // 检查升级学技能
    const learned = SKILLS_BY_LEVEL[member.id]?.[member.level];
    if (learned) {
      for (const sid of learned) {
        if (!member.skills.includes(sid)) {
          member.skills.push(sid);
          newSkills.push(sid);
        }
      }
    }
  }
  return { leveledUp, newSkills };
}

/** 升级习得技能表 */
export const SKILLS_BY_LEVEL: Record<string, Record<number, string[]>> = {
  jingtian: { 4: ['sa_jin_jian'], 44: ['bai_wu_jin_ji'], 58: ['qing_guo_yin_dan_bo'] },
  xuejian: { 15: ['hui_sheng_zhao'], 20: ['wu_du_gui_yuan'], 55: ['yu_lu_huan_jing'], 58: ['tian_ling_qian_lie_po'] },
  longkui: { 15: ['huan_gui_san_die_sha'], 20: ['gui_yu_huan_shen'] },
  zixuan: { 13: ['meng_she_gu'], 41: ['qian_shen_gu'], 58: ['wan_gu_shi_tian'] },
  changqing: { 38: ['tian_shi_fu'], 50: ['jian_shen', 'mo_yan_shan_kong_zhan'] },
};

export function characterDesc(id: string): string {
  const tpl = TEMPLATES[id];
  return tpl ? `${tpl.name}·${tpl.title}【${ELEMENT_LABEL[tpl.element]}】` : id;
}

// 引用避免未使用告警(SKILLS_BY_LEVEL 在外部使用)
export const _skillsByLevelRef = SKILLS_BY_LEVEL;
