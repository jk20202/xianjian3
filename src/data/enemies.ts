import type { EnemyDef } from '../types';

/** 敌人定义表 */
export const ENEMIES: Record<string, EnemyDef> = {
  // ===== 杂兵 =====
  shu_yao: { id: 'shu_yao', name: '树妖', element: 'wind', hp: 60, atk: 14, def: 6, spd: 8, exp: 18, money: 30, skills: ['basic_attack'], color: 0x6fae4f, radius: 16, ai: 'melee', detectRange: 180, attackRange: 36 },
  yao_hua_wu_shi: { id: 'yao_hua_wu_shi', name: '妖化武士', element: 'earth', hp: 120, atk: 22, def: 10, spd: 10, exp: 35, money: 60, skills: ['basic_attack', 'earth_spike'], color: 0xb8860b, radius: 18, ai: 'melee', detectRange: 200, attackRange: 40 },
  pi_li_tang_di: { id: 'pi_li_tang_di', name: '霹雳堂弟子', element: 'fire', hp: 90, atk: 20, def: 8, spd: 12, exp: 30, money: 50, skills: ['basic_attack', 'fire_burn'], color: 0xcc4422, radius: 16, ai: 'ranged', detectRange: 240, attackRange: 200 },
  xiao_yao: { id: 'xiao_yao', name: '小妖', element: 'wind', hp: 45, atk: 12, def: 5, spd: 14, exp: 12, money: 20, skills: ['basic_attack'], color: 0x8a9a5a, radius: 14, ai: 'charger', detectRange: 220, attackRange: 34 },
  gui_hun: { id: 'gui_hun', name: '鬼魂', element: 'thunder', hp: 70, atk: 18, def: 4, spd: 13, exp: 25, money: 40, skills: ['basic_attack', 'thunder_bolt'], color: 0x9988bb, radius: 15, ai: 'ranged', detectRange: 220, attackRange: 180 },
  huo_gui: { id: 'huo_gui', name: '火鬼', element: 'fire', hp: 110, atk: 24, def: 7, spd: 11, exp: 40, money: 70, skills: ['basic_attack', 'fire_burn', 'san_mei_zhen_huo'], color: 0xff5522, radius: 17, ai: 'charger', detectRange: 240, attackRange: 38 },
  bing_can: { id: 'bing_can', name: '冰蚕', element: 'water', hp: 80, atk: 16, def: 9, spd: 9, exp: 28, money: 45, skills: ['basic_attack', 'water_ice'], color: 0x66ccff, radius: 15, ai: 'ranged', detectRange: 220, attackRange: 190 },
  shi_jiang: { id: 'shi_jiang', name: '尸将', element: 'earth', hp: 160, atk: 28, def: 14, spd: 7, exp: 55, money: 90, skills: ['basic_attack', 'fei_yan_shu'], color: 0x886644, radius: 18, ai: 'melee', detectRange: 200, attackRange: 42 },

  // ===== 第四章:六界纵横 =====
  gu_teng_jing: { id: 'gu_teng_jing', name: '古藤精', element: 'wind', hp: 200, atk: 32, def: 12, spd: 11, exp: 65, money: 110, skills: ['basic_attack', 'feng_juan_chen_sheng'], color: 0x4a7a3a, radius: 18, ai: 'ranged', detectRange: 240, attackRange: 210 },
  huang_quan_gui: { id: 'huang_quan_gui', name: '黄泉鬼', element: 'thunder', hp: 180, atk: 34, def: 10, spd: 14, exp: 70, money: 120, skills: ['basic_attack', 'thunder_bolt', 'gui_jiang'], color: 0x6a5a8a, radius: 16, ai: 'charger', detectRange: 260, attackRange: 38 },
  huo_gui_bing: { id: 'huo_gui_bing', name: '火鬼兵', element: 'fire', hp: 220, atk: 38, def: 13, spd: 12, exp: 80, money: 140, skills: ['basic_attack', 'fire_burn', 'san_mei_zhen_huo'], color: 0xcc3322, radius: 17, ai: 'charger', detectRange: 260, attackRange: 40 },
  yan_jiang_yao: { id: 'yan_jiang_yao', name: '岩浆妖', element: 'fire', hp: 280, atk: 42, def: 18, spd: 8, exp: 95, money: 160, skills: ['basic_attack', 'lian_yu_huo_hai'], color: 0xff4422, radius: 19, ai: 'melee', detectRange: 220, attackRange: 44 },

  // ===== 第五章:灵珠有泪 =====
  bing_feng_ling: { id: 'bing_feng_ling', name: '冰风灵', element: 'water', hp: 240, atk: 40, def: 15, spd: 13, exp: 90, money: 150, skills: ['basic_attack', 'water_ice'], color: 0x88ddff, radius: 17, ai: 'ranged', detectRange: 250, attackRange: 220 },
  hai_di_shou: { id: 'hai_di_shou', name: '海底兽', element: 'water', hp: 320, atk: 46, def: 20, spd: 10, exp: 110, money: 180, skills: ['basic_attack', 'water_ice', 'wu_qi_lian_bo'], color: 0x3399cc, radius: 20, ai: 'melee', detectRange: 230, attackRange: 46 },
  xie_qi_yao: { id: 'xie_qi_yao', name: '邪气妖', element: 'fire', hp: 360, atk: 50, def: 22, spd: 12, exp: 130, money: 220, skills: ['basic_attack', 'san_mei_zhen_huo', 'liu_xing_huo_yu'], color: 0xaa3344, radius: 19, ai: 'charger', detectRange: 280, attackRange: 42 },
  jian_hun: { id: 'jian_hun', name: '剑魂', element: 'wind', hp: 300, atk: 52, def: 18, spd: 16, exp: 140, money: 240, skills: ['basic_attack', 'gang_feng_jing_tian'], color: 0xaaccbb, radius: 18, ai: 'ranged', detectRange: 270, attackRange: 230 },

  // ===== BOSS =====
  mo_pi_feng: { id: 'mo_pi_feng', name: '魔披风', element: 'wind', hp: 600, atk: 30, def: 12, spd: 12, exp: 200, money: 300, skills: ['basic_attack', 'feng_juan_chen_sheng', 'wind_blade'], color: 0x4a8a3a, radius: 28, ai: 'boss', detectRange: 400, attackRange: 220 },
  tian_yao_huang: { id: 'tian_yao_huang', name: '天妖皇', element: 'thunder', hp: 1200, atk: 38, def: 16, spd: 14, exp: 500, money: 800, skills: ['basic_attack', 'lei_dong_jiu_tian', 'tian_lei_kong_po'], color: 0x7744aa, radius: 32, ai: 'boss', detectRange: 500, attackRange: 240 },
  huo_gui_wang: { id: 'huo_gui_wang', name: '火鬼王', element: 'fire', hp: 1800, atk: 44, def: 18, spd: 13, exp: 800, money: 1200, skills: ['basic_attack', 'lian_yu_huo_hai', 'liu_xing_huo_yu', 'san_mei_zhen_huo'], color: 0xff3311, radius: 33, ai: 'boss', detectRange: 550, attackRange: 250 },
  xie_jian_xian: { id: 'xie_jian_xian', name: '邪剑仙', element: 'fire', hp: 2400, atk: 48, def: 20, spd: 15, exp: 1200, money: 2000, skills: ['basic_attack', 'lian_yu_huo_hai', 'liu_xing_huo_yu', 'san_mei_zhen_huo'], color: 0xaa2233, radius: 34, ai: 'boss', detectRange: 600, attackRange: 260 },
  chong_lou: { id: 'chong_lou', name: '魔尊重楼', element: 'fire', hp: 4000, atk: 60, def: 25, spd: 18, exp: 3000, money: 5000, skills: ['basic_attack', 'lian_yu_huo_hai', 'mo_yan_shan_kong_zhan'], color: 0x880022, radius: 36, ai: 'boss', detectRange: 700, attackRange: 280 },
};

export function getEnemy(id: string): EnemyDef {
  const e = ENEMIES[id];
  if (!e) throw new Error(`未知敌人: ${id}`);
  return e;
}
