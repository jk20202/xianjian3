// data/quests.ts
// 第一章任务定义：主线 4 条 + 支线 2 条

/** 任务目标 */
export type Objective =
  | { kind: 'kill'; monsterId: string; count: number }
  | { kind: 'reach'; areaId: string }
  | { kind: 'talk'; npcId: string }
  | { kind: 'collect'; itemId: string; count: number };

/** 任务奖励 */
export interface QuestRewards {
  exp?: number;
  gold?: number;
  items?: string[];
  skillId?: string;
}

/** 任务定义 */
export interface QuestDef {
  id: string;
  type: 'main' | 'side';
  chapter: number;
  giver: string;
  title: string;
  desc: string;
  objectives: Objective[];
  rewards: QuestRewards;
  unlocks: string[];
  prerequisites: string[];
  isChapterGate?: boolean;
}

export const QUESTS: Record<string, QuestDef> = {
  // ─── 主线 ─────────────────────────────

  // 教学任务：当铺异变
  q_main_pawnshop: {
    id: 'q_main_pawnshop',
    type: 'main',
    chapter: 1,
    giver: 'shop_owner',
    title: '当铺异变',
    desc: '当铺来了位神秘客人，带来一柄古剑。景天前去搭话，并清除剑中逸出的妖物。',
    objectives: [
      { kind: 'talk', npcId: 'mysterious_guest' },
      { kind: 'kill', monsterId: 'slime_green', count: 1 },
    ],
    rewards: { exp: 50, gold: 100, items: ['hp_potion_s'] },
    unlocks: ['q_main_track'],
    prerequisites: [],
  },

  // 追踪妖物
  q_main_track: {
    id: 'q_main_track',
    type: 'main',
    chapter: 1,
    giver: 'shop_owner',
    title: '追踪妖物',
    desc: '妖物逃往渝州郊外。前往郊外，清剿逃窜的狼妖。',
    objectives: [
      { kind: 'reach', areaId: 'yuzhou_suburb' },
      { kind: 'kill', monsterId: 'wild_wolf', count: 3 },
    ],
    rewards: { exp: 120, gold: 150 },
    unlocks: ['q_main_rescue'],
    prerequisites: ['q_main_pawnshop'],
  },

  // 救援雪见
  q_main_rescue: {
    id: 'q_main_rescue',
    type: 'main',
    chapter: 1,
    giver: 'shop_owner',
    title: '救援雪见',
    desc: '据闻有人被困于古道深处。前往古道，寻到雪见并击退围困她的山贼。',
    objectives: [
      { kind: 'reach', areaId: 'ancient_path' },
      { kind: 'talk', npcId: 'xuejian' },
      { kind: 'kill', monsterId: 'gudao_bandit', count: 3 },
    ],
    rewards: { exp: 200, gold: 200, skillId: 'jt_huoyan_zhan' },
    unlocks: ['q_main_sword'],
    prerequisites: ['q_main_track'],
  },

  // 调查古剑（章节门）
  q_main_sword: {
    id: 'q_main_sword',
    type: 'main',
    chapter: 1,
    giver: 'xuejian',
    title: '调查古剑',
    desc: '古道尽头有一柄古剑，妖气森森。击败剑中土灵，取回古剑，开启下一章。',
    objectives: [
      { kind: 'kill', monsterId: 'jiaowai_yaoshou', count: 1 },
      { kind: 'collect', itemId: 'ancient_sword', count: 1 },
    ],
    rewards: { exp: 500, gold: 500 },
    unlocks: [],
    prerequisites: ['q_main_rescue'],
    isChapterGate: true,
  },

  // ─── 支线 ─────────────────────────────

  // 丢失的玉佩
  q_side_jade: {
    id: 'q_side_jade',
    type: 'side',
    chapter: 1,
    giver: 'woman_npc',
    title: '丢失的玉佩',
    desc: '城中妇人在郊外遗失了祖传玉佩，疑似被野狼叼走。帮她寻回。',
    objectives: [
      { kind: 'collect', itemId: 'jade_pendant', count: 1 },
    ],
    rewards: { exp: 80, gold: 120, items: ['hp_potion_s', 'mp_potion_s'] },
    unlocks: [],
    prerequisites: ['q_main_pawnshop'],
  },

  // 古道采药
  q_side_herb: {
    id: 'q_side_herb',
    type: 'side',
    chapter: 1,
    giver: 'herbalist',
    title: '古道采药',
    desc: '古道药农不敢深入，托你采集五株草药。灵草生于古道两侧。',
    objectives: [
      { kind: 'reach', areaId: 'ancient_path' },
      { kind: 'collect', itemId: 'herb', count: 5 },
    ],
    rewards: { exp: 100, gold: 100, items: ['mp_potion_s'] },
    unlocks: [],
    prerequisites: ['q_main_track'],
  },
};
