import type { StoryNode } from '../types';

/** 剧情节点表 - 基于仙剑3主线 */
export const STORY: Record<string, StoryNode> = {
  // ===== 第一章:携侣闯天涯 =====
  ch1_intro: {
    id: 'ch1_intro', chapter: 1, title: '缘起渝州',
    trigger: { map: 'yuzhou', auto: true },
    dialog: [
      { speaker: '旁白', color: 0xaaaaaa, text: '渝州城,永安当铺。夜色渐深,伙计景天正欲安寝……' },
      { speaker: '景天', color: 0x7fd87f, text: '呼——今天又收了几件好古董,改日定能卖个好价钱!' },
      { speaker: '雪见', color: 0xd9a85a, text: '喂!你!帮我修补这只紫砂壶,我重重有赏!' },
      { speaker: '景天', color: 0x7fd87f, text: '哎哟姑娘,深更半夜闯进当铺,成何体统……嘶,这壶倒是唐门之物?' },
      { speaker: '雪见', color: 0xd9a85a, text: '本女侠唐雪见!你修是不修?' },
      { speaker: '旁白', color: 0xaaaaaa, text: '雪见误以毒蒺藜伤及景天,二人约定竹林交换解药。一段缘分,就此展开。' },
    ],
    reward: { exp: 20, money: 50 },
    unlocks: ['ch1_bishan'],
    setFlag: 'met_xuejian',
  },
  ch1_zhao: {
    id: 'ch1_zhao', chapter: 1, title: '古董鉴定',
    trigger: { map: 'yuzhou', x: 6 * 32, y: 6 * 32 },
    condition: 'met_xuejian',
    dialog: [
      { speaker: '赵文昌', color: 0xc9a06a, text: '小景天,来来来,帮我鉴定这几件古董,成了有赏。' },
      { speaker: '景天', color: 0x7fd87f, text: '赵掌柜放心,这可是我的看家本领!' },
      { speaker: '赵文昌', color: 0xc9a06a, text: '好小子!这兽面纹爵、玉双龙首璜……果然是行家。赏!' },
    ],
    reward: { exp: 30, money: 100 },
    unlocks: [],
    setFlag: 'appraised',
  },
  ch1_bishan: {
    id: 'ch1_bishan', chapter: 1, title: '穿璧山',
    trigger: { map: 'bishan', auto: true },
    condition: 'met_xuejian',
    dialog: [
      { speaker: '景天', color: 0x7fd87f, text: '雪见姑娘,要去唐家堡,须得穿过这璧山。' },
      { speaker: '雪见', color: 0xd9a85a, text: '哼,本女侠才不怕这些山精野怪!' },
      { speaker: '旁白', color: 0xaaaaaa, text: '璧山林深路险,妖物出没。小心行事!(草丛中遇敌)' },
    ],
    reward: { exp: 40 },
    unlocks: ['ch1_tangjia'],
    setFlag: 'enter_bishan',
  },
  ch1_tangjia: {
    id: 'ch1_tangjia', chapter: 1, title: '唐门风波',
    trigger: { map: 'tangjiabao', auto: true },
    condition: 'enter_bishan',
    dialog: [
      { speaker: '唐门弟子', color: 0xc04040, text: '雪见!你已被逐出唐门,休要再回来!' },
      { speaker: '雪见', color: 0xd9a85a, text: '什么?!爷爷他……怎么会……' },
      { speaker: '景天', color: 0x7fd87f, text: '雪见姑娘,莫急,我们先弄清原委。' },
      { speaker: '旁白', color: 0xaaaaaa, text: '雪见被逐出唐门,二人决定前往蜀山寻求长卿帮助。' },
    ],
    reward: { exp: 60, money: 80 },
    unlocks: ['ch2_road'],
    setFlag: 'expelled_tang',
  },

  // ===== 第二章:蜀山问道 =====
  ch2_road: {
    id: 'ch2_road', chapter: 2, title: '蜀山故道',
    trigger: { map: 'shushan_road', auto: true },
    condition: 'expelled_tang',
    dialog: [
      { speaker: '景天', color: 0x7fd87f, text: '这蜀山故道螺旋而上,机关重重,当真难行。' },
      { speaker: '雪见', color: 0xd9a85a, text: '听说走错岔道便会迷失,要按"一四七三六二五"之序才行。' },
      { speaker: '旁白', color: 0xaaaaaa, text: '蜀山故道,妖魔渐强。提升实力,方能前行!' },
    ],
    reward: { exp: 80 },
    unlocks: ['ch2_shushan'],
    setFlag: 'enter_shushan_road',
  },
  ch2_shushan: {
    id: 'ch2_shushan', chapter: 2, title: '蜀山问道',
    trigger: { map: 'shushan', auto: true },
    condition: 'enter_shushan_road',
    dialog: [
      { speaker: '掌门清微', color: 0xe0e0e0, text: '景天,你前世乃神将飞蓬。这魔剑,与你渊源颇深。' },
      { speaker: '景天', color: 0x7fd87f, text: '前辈,我……前世?这魔剑夜里总追随于我……' },
      { speaker: '龙葵', color: 0xb07fff, text: '哥哥……我终于等到你了……(自魔剑中现身)' },
      { speaker: '景天', color: 0x7fd87f, text: '你、你是谁?为何唤我哥哥?' },
      { speaker: '龙葵', color: 0xb07fff, text: '我是龙葵,姜国公主。哥哥龙阳,便是你的前世。' },
      { speaker: '掌门清微', color: 0xe0e0e0, text: '锁妖塔封印将破,邪剑仙蠢蠢欲动。景天,蜀山需你之力。' },
      { speaker: '旁白', color: 0xaaaaaa, text: '龙葵加入队伍!前往锁妖塔,阻止邪剑仙。' },
    ],
    reward: { exp: 150, skill: 'gui_jiang' },
    unlocks: [],
    setFlag: 'longkui_joined',
  },

  // ===== 终章伏笔 =====
  ch3_locktower: {
    id: 'ch3_locktower', chapter: 3, title: '锁妖塔',
    trigger: { map: 'shushan', x: 27 * 32, y: 23 * 32 },
    condition: 'longkui_joined',
    dialog: [
      { speaker: '旁白', color: 0xaaaaaa, text: '锁妖塔十层,妖气冲天。天妖皇盘踞于此。' },
      { speaker: '天妖皇', color: 0x7744aa, text: '哈哈哈!区区凡人,也敢闯我锁妖塔!' },
      { speaker: '景天', color: 0x7fd87f, text: '妖皇受死!(BOSS战)' },
    ],
    reward: { exp: 500, money: 800 },
    unlocks: [],
    setFlag: 'beat_tianyao',
  },

  // ===== 第四章:六界纵横 =====
  ch4_gutenglin: {
    id: 'ch4_gutenglin', chapter: 4, title: '古藤林·飞龙探云手',
    trigger: { map: 'gutenglin', auto: true },
    condition: 'beat_tianyao',
    dialog: [
      { speaker: '旁白', color: 0xaaaaaa, text: '古藤林深处,藤蔓如蟒,妖气森森。' },
      { speaker: '精精', color: 0x7fae4f, text: '嘿嘿,小子,想学我飞龙探云手?先过我这关!' },
      { speaker: '景天', color: 0x7fd87f, text: '前辈神技,晚辈仰慕已久,还望成全!' },
      { speaker: '精精', color: 0x7fae4f, text: '好!看你骨骼清奇,传你便是。日后偷得宝物,莫忘老孙!' },
      { speaker: '旁白', color: 0xaaaaaa, text: '习得【飞龙探云手】!可偷取敌人金钱与物品。' },
    ],
    reward: { exp: 200, skill: 'fei_long_tan_yun' },
    unlocks: ['ch4_fengdu'],
    setFlag: 'learn_feilong',
  },
  ch4_fengdu: {
    id: 'ch4_fengdu', chapter: 4, title: '酆都鬼城',
    trigger: { map: 'fengdu', auto: true },
    condition: 'learn_feilong',
    dialog: [
      { speaker: '旁白', color: 0xaaaaaa, text: '酆都,鬼气森森之城。冶炼密室可铸神兵。' },
      { speaker: '冶炼师', color: 0xc98844, text: '客官,带尸块与矿石来,我可为你铸器。' },
      { speaker: '龙葵', color: 0xb07fff, text: '哥哥,前方熔岩地狱,火鬼王盘踞,小心火系妖物。' },
      { speaker: '景天', color: 0x7fd87f, text: '水克火,我们正好以水灵之力破之!' },
    ],
    reward: { exp: 150, money: 200 },
    unlocks: ['ch4_rongyan'],
    setFlag: 'enter_fengdu',
  },
  ch4_rongyan: {
    id: 'ch4_rongyan', chapter: 4, title: '熔岩地狱·火鬼王',
    trigger: { map: 'rongyan_diyu', x: (52 - 4) * 32, y: (48 - 4) * 32 },
    condition: 'enter_fengdu',
    dialog: [
      { speaker: '旁白', color: 0xaaaaaa, text: '熔岩地狱,烈焰滔天。火鬼王怒目而视。' },
      { speaker: '火鬼王', color: 0xff3311, text: '擅闯吾地者,化为灰烬!' },
      { speaker: '紫萱', color: 0x5fb8ff, text: '水灵珠之力,正可克制此獠。诸位,合力除魔!' },
      { speaker: '景天', color: 0x7fd87f, text: '火鬼王,你的末日到了!(BOSS战)' },
    ],
    reward: { exp: 1000, money: 1500 },
    unlocks: ['ch5_bingfenggu'],
    setFlag: 'beat_huoguiwang',
  },

  // ===== 第五章:灵珠有泪自千行 =====
  ch5_bingfenggu: {
    id: 'ch5_bingfenggu', chapter: 5, title: '冰风谷·雪见归魂',
    trigger: { map: 'bingfenggu', auto: true },
    condition: 'beat_huoguiwang',
    dialog: [
      { speaker: '旁白', color: 0xaaaaaa, text: '冰风谷,万里雪飘。邪剑仙盗走雪见肉身,众人追寻至此。' },
      { speaker: '景天', color: 0x7fd87f, text: '雪见!你一定要撑住……' },
      { speaker: '雪见', color: 0xd9a85a, text: '景天……本女侠才不会轻易认输……' },
      { speaker: '重楼', color: 0x880022, text: '哼,飞蓬转世,且接我这招——倾国银弹波!' },
      { speaker: '旁白', color: 0xaaaaaa, text: '重楼传授【倾国银弹波】!雪见灵魂回归肉身。' },
    ],
    reward: { exp: 600, skill: 'qing_guo_yin_dan_bo' },
    unlocks: ['ch5_haidicheng'],
    setFlag: 'xuejian_revived',
  },
  ch5_haidicheng: {
    id: 'ch5_haidicheng', chapter: 5, title: '海底城·溪风水碧',
    trigger: { map: 'haidicheng', auto: true },
    condition: 'xuejian_revived',
    dialog: [
      { speaker: '旁白', color: 0xaaaaaa, text: '海底城,五层幽深。魔将溪风与天将水碧在此相守。' },
      { speaker: '溪风', color: 0x4a8aaa, text: '诸位,我与水碧愿以镇火山镇压邪气,请速往剑冢!' },
      { speaker: '水碧', color: 0x5fb8ff, text: '邪剑仙已融合镇妖剑与魔剑,铸成邪剑,势不可挡。' },
      { speaker: '徐长卿', color: 0xff7a4d, text: '蜀山弟子,义不容辞!剑冢决死一战!' },
      { speaker: '景天', color: 0x7fd87f, text: '走!剑冢会邪剑仙!' },
    ],
    reward: { exp: 800, money: 1000 },
    unlocks: ['ch5_jianzhong'],
    setFlag: 'enter_haidicheng',
  },
  ch5_jianzhong: {
    id: 'ch5_jianzhong', chapter: 5, title: '剑冢·邪剑仙',
    trigger: { map: 'jianzhong', x: (48 - 4) * 32, y: (44 - 4) * 32 },
    condition: 'enter_haidicheng',
    dialog: [
      { speaker: '旁白', color: 0xaaaaaa, text: '剑冢,万剑插地,煞气冲霄。邪剑仙持邪剑而立。' },
      { speaker: '邪剑仙', color: 0xaa2233, text: '哈哈哈!镇妖剑、魔剑皆入我手,景天,你拿什么与我一战?' },
      { speaker: '龙葵', color: 0xb07fff, text: '哥哥……若需以身祭剑,龙葵甘愿!' },
      { speaker: '雪见', color: 0xd9a85a, text: '不!本女侠也愿……景天,你定要赢!' },
      { speaker: '景天', color: 0x7fd87f, text: '都别说了!邪剑仙,今日便是你的死期!(终战)' },
    ],
    reward: { exp: 2000, money: 3000 },
    unlocks: [],
    setFlag: 'beat_xiejianxian',
  },
};

export function getStoryNode(id: string): StoryNode {
  const n = STORY[id];
  if (!n) throw new Error(`未知剧情节点: ${id}`);
  return n;
}

/** 获取某地图自动触发的剧情节点 */
export function autoStoryFor(mapId: string): StoryNode | undefined {
  return Object.values(STORY).find(n => n.trigger.map === mapId && n.trigger.auto);
}
