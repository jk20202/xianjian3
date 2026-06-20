import type { SkillDef } from '../types';

/** 全部技能定义表 */
export const SKILLS: Record<string, SkillDef> = {
  // ===== 基础平A =====
  basic_attack: {
    id: 'basic_attack', name: '平A·斩', type: 'skill', cost: 0, costType: 'qi',
    power: 1.0, range: 'single', cooldown: 350, castTime: 120,
    effectColor: 0xffffff, desc: '普通攻击,无消耗',
  },

  // ===== 五灵仙术(耗神) =====
  // 风系
  wind_blade: { id: 'wind_blade', name: '风咒', type: 'art', element: 'wind', cost: 6, costType: 'shen', power: 1.4, range: 'single', cooldown: 900, castTime: 300, projectile: true, effectColor: 0x7fd87f, desc: '风系初级单体仙术', learnLevel: 1 },
  xian_feng_yun_ti: { id: 'xian_feng_yun_ti', name: '仙风云体', type: 'art', element: 'wind', cost: 12, costType: 'shen', power: 0, range: 'self', cooldown: 6000, castTime: 400, buff: { spd: 8 }, effectColor: 0x9fe8af, desc: '提升自身速度', learnLevel: 8 },
  feng_juan_chen_sheng: { id: 'feng_juan_chen_sheng', name: '风卷尘生', type: 'art', element: 'wind', cost: 22, costType: 'shen', power: 1.6, range: 'all', cooldown: 2200, castTime: 500, effectColor: 0x7fd87f, desc: '风系全体攻击', learnLevel: 18 },
  gang_feng_jing_tian: { id: 'gang_feng_jing_tian', name: '罡风惊天', type: 'art', element: 'wind', cost: 38, costType: 'shen', power: 2.4, range: 'all', cooldown: 3500, castTime: 700, effectColor: 0x5fcf6f, desc: '风系高级全体,威力惊人', learnLevel: 36 },

  // 火系
  fire_burn: { id: 'fire_burn', name: '炎咒', type: 'art', element: 'fire', cost: 6, costType: 'shen', power: 1.4, range: 'single', cooldown: 900, castTime: 300, projectile: true, effectColor: 0xff7a4d, desc: '火系初级单体仙术', learnLevel: 1 },
  san_mei_zhen_huo: { id: 'san_mei_zhen_huo', name: '三昧真火', type: 'art', element: 'fire', cost: 24, costType: 'shen', power: 1.7, range: 'all', cooldown: 2400, castTime: 500, effectColor: 0xff5a2d, desc: '火系全体攻击', learnLevel: 20 },
  liu_xing_huo_yu: { id: 'liu_xing_huo_yu', name: '流星火雨', type: 'art', element: 'fire', cost: 32, costType: 'shen', power: 2.6, range: 'single', cooldown: 3000, castTime: 600, projectile: true, effectColor: 0xff8a3d, desc: '火系高级单体', learnLevel: 34 },
  lian_yu_huo_hai: { id: 'lian_yu_huo_hai', name: '炼狱火海', type: 'art', element: 'fire', cost: 42, costType: 'shen', power: 2.5, range: 'all', cooldown: 3800, castTime: 700, effectColor: 0xff3a1d, desc: '火系高级全体', learnLevel: 40 },

  // 雷系
  thunder_bolt: { id: 'thunder_bolt', name: '雷咒', type: 'art', element: 'thunder', cost: 6, costType: 'shen', power: 1.4, range: 'single', cooldown: 900, castTime: 300, projectile: true, effectColor: 0xb07fff, desc: '雷系初级单体仙术', learnLevel: 1 },
  jing_lei_shan: { id: 'jing_lei_shan', name: '惊雷闪', type: 'art', element: 'thunder', cost: 22, costType: 'shen', power: 1.6, range: 'all', cooldown: 2200, castTime: 500, effectColor: 0xb07fff, desc: '雷系全体攻击', learnLevel: 18 },
  tian_lei_kong_po: { id: 'tian_lei_kong_po', name: '天雷空破', type: 'art', element: 'thunder', cost: 34, costType: 'shen', power: 2.6, range: 'single', cooldown: 3000, castTime: 600, effectColor: 0x905fff, desc: '雷系高级单体', learnLevel: 34 },
  lei_dong_jiu_tian: { id: 'lei_dong_jiu_tian', name: '雷动九天', type: 'art', element: 'thunder', cost: 42, costType: 'shen', power: 2.5, range: 'all', cooldown: 3800, castTime: 700, effectColor: 0xc09fff, desc: '雷系高级全体', learnLevel: 40 },

  // 水系
  water_ice: { id: 'water_ice', name: '冰咒', type: 'art', element: 'water', cost: 6, costType: 'shen', power: 1.3, range: 'all', cooldown: 1000, castTime: 300, effectColor: 0x5fb8ff, desc: '水系初级全体仙术', learnLevel: 1 },
  yan_shui_huan_hun: { id: 'yan_shui_huan_hun', name: '烟水还魂', type: 'art', element: 'water', cost: 28, costType: 'shen', power: 0, range: 'self', heal: 0.5, cooldown: 5000, castTime: 500, effectColor: 0x6fd0ff, desc: '恢复自身精(按最大精比例)', learnLevel: 16 },
  wu_qi_lian_bo: { id: 'wu_qi_lian_bo', name: '五气连波', type: 'art', element: 'water', cost: 36, costType: 'shen', power: 0, range: 'self', heal: 0.8, cooldown: 6000, castTime: 600, effectColor: 0x8fe0ff, desc: '大量恢复精', learnLevel: 30 },

  // 土系
  earth_spike: { id: 'earth_spike', name: '土咒', type: 'art', element: 'earth', cost: 6, costType: 'shen', power: 1.3, range: 'all', cooldown: 1000, castTime: 300, effectColor: 0xd9a85a, desc: '土系初级全体仙术', learnLevel: 1 },
  fei_yan_shu: { id: 'fei_yan_shu', name: '飞岩术', type: 'art', element: 'earth', cost: 20, costType: 'shen', power: 1.6, range: 'all', cooldown: 2200, castTime: 500, effectColor: 0xd9a85a, desc: '土系全体攻击', learnLevel: 18 },
  tai_shan_ya_ding: { id: 'tai_shan_ya_ding', name: '泰山压顶', type: 'art', element: 'earth', cost: 34, costType: 'shen', power: 2.6, range: 'single', cooldown: 3000, castTime: 600, effectColor: 0xc9984a, desc: '土系高级单体', learnLevel: 34 },

  // ===== 角色特技(耗气) =====
  // 景天
  fei_long_tan_yun: { id: 'fei_long_tan_yun', name: '飞龙探云手', type: 'skill', cost: 2, costType: 'qi', power: 0.8, range: 'single', cooldown: 1500, castTime: 200, effectColor: 0xc9b072, desc: '偷取敌人金钱', learnLevel: 1 },
  sa_jin_jian: { id: 'sa_jin_jian', name: '洒金笺', type: 'skill', cost: 4, costType: 'qi', power: 0, range: 'self', heal: 0.3, cooldown: 4000, castTime: 300, effectColor: 0xffd97a, desc: '耗钱恢复精', learnLevel: 4 },
  bai_wu_jin_ji: { id: 'bai_wu_jin_ji', name: '百无禁忌', type: 'skill', cost: 20, costType: 'qi', power: 0, range: 'self', cooldown: 8000, castTime: 400, effectColor: 0xffffff, desc: '解除自身不良状态', learnLevel: 44 },
  qing_guo_yin_dan_bo: { id: 'qing_guo_yin_dan_bo', name: '倾国银弹波', type: 'skill', cost: 27, costType: 'qi', power: 2.8, range: 'all', cooldown: 5000, castTime: 600, effectColor: 0xffe07a, desc: '景天最强全体特技', learnLevel: 58 },

  // 雪见
  lv_bo_hong_lu: { id: 'lv_bo_hong_lu', name: '绿波红露斩', type: 'skill', cost: 5, costType: 'qi', power: 1.5, range: 'single', heal: 0.3, cooldown: 2000, castTime: 300, effectColor: 0x7fd87f, desc: '吸收敌人精', learnLevel: 1 },
  hui_sheng_zhao: { id: 'hui_sheng_zhao', name: '回生照', type: 'skill', cost: 12, costType: 'qi', power: 0, range: 'self', heal: 0.5, cooldown: 6000, castTime: 400, effectColor: 0xffd97a, desc: '恢复大量精', learnLevel: 15 },
  wu_du_gui_yuan: { id: 'wu_du_gui_yuan', name: '五毒归元', type: 'skill', cost: 15, costType: 'qi', power: 0, range: 'self', cooldown: 6000, castTime: 400, effectColor: 0x9fffaf, desc: '解除中毒', learnLevel: 20 },
  yu_lu_huan_jing: { id: 'yu_lu_huan_jing', name: '玉露还精', type: 'skill', cost: 30, costType: 'qi', power: 0, range: 'self', heal: 0.8, cooldown: 7000, castTime: 500, effectColor: 0xafe0bf, desc: '全体恢复精', learnLevel: 55 },
  tian_ling_qian_lie_po: { id: 'tian_ling_qian_lie_po', name: '天灵千裂破', type: 'skill', cost: 25, costType: 'qi', power: 2.4, range: 'single', cooldown: 3500, castTime: 500, effectColor: 0xd9a85a, desc: '雪见强力单体', learnLevel: 58 },

  // 龙葵
  gui_jiang: { id: 'gui_jiang', name: '鬼降', type: 'skill', cost: 5, costType: 'qi', power: 1.2, range: 'all', debuff: { confuse: 1 }, cooldown: 2500, castTime: 400, effectColor: 0xb07fff, desc: '全体攻击+混乱', learnLevel: 1 },
  huan_gui_san_die_sha: { id: 'huan_gui_san_die_sha', name: '幻鬼三叠杀', type: 'skill', cost: 13, costType: 'qi', power: 1.8, range: 'all', cooldown: 3000, castTime: 500, effectColor: 0xc09fff, desc: '全体鬼系攻击', learnLevel: 15 },
  gui_yu_huan_shen: { id: 'gui_yu_huan_shen', name: '鬼狱还神', type: 'skill', cost: 18, costType: 'qi', power: 1.0, range: 'single', heal: 0.4, cooldown: 3000, castTime: 400, effectColor: 0xb07fff, desc: '吸收敌人神', learnLevel: 20 },
  qian_kun_yi_zhi: { id: 'qian_kun_yi_zhi', name: '乾坤一掷', type: 'skill', cost: 25, costType: 'qi', power: 2.6, range: 'all', cooldown: 4000, castTime: 500, effectColor: 0xffd97a, desc: '耗钱全体攻击', learnLevel: 30 },

  // 紫萱
  meng_she_gu: { id: 'meng_she_gu', name: '梦蛇蛊', type: 'skill', cost: 12, costType: 'qi', power: 0.8, range: 'all', debuff: { sleep: 1 }, cooldown: 3000, castTime: 400, effectColor: 0x9fffaf, desc: '全体催眠', learnLevel: 13 },
  qian_shen_gu: { id: 'qian_shen_gu', name: '潜身蛊', type: 'skill', cost: 25, costType: 'qi', power: 0, range: 'self', buff: { def: 10 }, cooldown: 6000, castTime: 400, effectColor: 0xafe0bf, desc: '提升防御', learnLevel: 41 },
  wan_gu_shi_tian: { id: 'wan_gu_shi_tian', name: '万蛊蚀天', type: 'skill', cost: 35, costType: 'qi', power: 2.4, range: 'all', cooldown: 4500, castTime: 600, effectColor: 0x7fd87f, desc: '紫萱最强全体', learnLevel: 58 },

  // 徐长卿
  tian_shi_fu: { id: 'tian_shi_fu', name: '天师符', type: 'skill', cost: 25, costType: 'qi', power: 2.0, range: 'all', cooldown: 3000, castTime: 500, effectColor: 0xffd97a, desc: '蜀山符法全体攻击', learnLevel: 38 },
  jian_shen: { id: 'jian_shen', name: '剑神', type: 'skill', cost: 30, costType: 'qi', power: 2.6, range: 'all', cooldown: 4500, castTime: 600, effectColor: 0xffffff, desc: '召唤剑神全体攻击', learnLevel: 50 },
  mo_yan_shan_kong_zhan: { id: 'mo_yan_shan_kong_zhan', name: '魔焰闪空斩', type: 'skill', cost: 35, costType: 'qi', power: 3.0, range: 'single', cooldown: 4000, castTime: 500, effectColor: 0xff7a4d, desc: '长卿最强单体', learnLevel: 50 },
};

export function getSkill(id: string): SkillDef {
  const s = SKILLS[id];
  if (!s) throw new Error(`未知技能: ${id}`);
  return s;
}
