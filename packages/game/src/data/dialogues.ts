// data/dialogues.ts
// 第一章 NPC 对话树

/** 对话结束动作 */
export interface DialogueAction {
  action: 'give_quest' | 'complete_quest' | 'give_item' | 'set_flag' | 'join_party' | 'heal' | 'open_shop' | 'save_game';
  target?: string;
}

/** 对话选项 */
export interface DialogueChoice {
  text: string;
  next: string;
  setFlag?: string;
}

/** 对话节点 */
export interface DialogueNode {
  speaker: string;
  portrait: string;
  text: string;
  choices?: DialogueChoice[];
  next?: string;
  onEnd?: DialogueAction[];
}

/** 对话树 */
export interface DialogueTree {
  id: string;
  startNode: string;
  nodes: Record<string, DialogueNode>;
}

export const DIALOGUES: Record<string, DialogueTree> = {
  // 当铺老板 —— 主线起始 + 杂货铺
  dlg_shop_owner: {
    id: 'dlg_shop_owner',
    startNode: 'n_start',
    nodes: {
      n_start: {
        speaker: '当铺老板',
        portrait: 'shop_owner',
        text: '景天啊，今日当铺来了位神秘客人，带着一柄古剑，老朽看着心惊。你去搭搭话？',
        choices: [
          { text: '我这就去', next: 'n_give_quest', setFlag: 'talked_shop_owner' },
          { text: '看看店里的货', next: 'n_shop' },
        ],
      },
      n_give_quest: {
        speaker: '当铺老板',
        portrait: 'shop_owner',
        text: '那古剑上妖气隐隐，怕是要生事。你小心些，先清掉逸出的妖物。',
        onEnd: [{ action: 'give_quest', target: 'q_main_pawnshop' }],
        next: 'n_after',
      },
      n_after: {
        speaker: '当铺老板',
        portrait: 'shop_owner',
        text: '需要什么便来店里看看。',
        choices: [
          { text: '打开杂货铺', next: 'n_shop' },
          { text: '告辞', next: 'n_exit' },
        ],
      },
      n_shop: {
        speaker: '当铺老板',
        portrait: 'shop_owner',
        text: '欢迎光临，随便看看。',
        onEnd: [{ action: 'open_shop', target: 'shop_general' }],
      },
      n_exit: {
        speaker: '当铺老板',
        portrait: 'shop_owner',
        text: '慢走。',
      },
    },
  },

  // 神秘客人 —— 触发主线事件
  dlg_mysterious_guest: {
    id: 'dlg_mysterious_guest',
    startNode: 'n_start',
    nodes: {
      n_start: {
        speaker: '神秘客人',
        portrait: 'mysterious_guest',
        text: '这柄剑……封印松动了。你，身上有灵根。',
        choices: [{ text: '你是谁？', next: 'n_explain' }],
      },
      n_explain: {
        speaker: '神秘客人',
        portrait: 'mysterious_guest',
        text: '我不过是过客。这剑中妖物即将苏醒，你若不想渝州城遭殃，便接下它。',
        choices: [
          { text: '接下古剑', next: 'n_accept', setFlag: 'accepted_sword' },
          { text: '容我想想', next: 'n_think' },
        ],
      },
      n_accept: {
        speaker: '神秘客人',
        portrait: 'mysterious_guest',
        text: '好胆识。妖物若现，斩之便是。',
        onEnd: [{ action: 'set_flag', target: 'sword_accepted' }],
        next: 'n_leave',
      },
      n_think: {
        speaker: '神秘客人',
        portrait: 'mysterious_guest',
        text: '也罢，我在此等你回话。',
      },
      n_leave: {
        speaker: '神秘客人',
        portrait: 'mysterious_guest',
        text: '（神秘客人飘然而去，古剑留于案上）',
        onEnd: [{ action: 'set_flag', target: 'mysterious_guest_left' }],
      },
    },
  },

  // 城中妇人 —— 支线「丢失的玉佩」
  dlg_woman_npc: {
    id: 'dlg_woman_npc',
    startNode: 'n_start',
    nodes: {
      n_start: {
        speaker: '城中妇人',
        portrait: 'woman_npc',
        text: '哎呀，我的玉佩不见了！那可是祖传之物……',
        choices: [{ text: '玉佩在哪丢的？', next: 'n_detail' }],
      },
      n_detail: {
        speaker: '城中妇人',
        portrait: 'woman_npc',
        text: '方才在郊外采花，回来便没了。定是落在郊外，或是被什么野物叼走了。',
        choices: [
          { text: '我帮你找找', next: 'n_give_quest' },
          { text: '抱歉帮不上忙', next: 'n_exit' },
        ],
      },
      n_give_quest: {
        speaker: '城中妇人',
        portrait: 'woman_npc',
        text: '多谢多谢！找回玉佩，必有重谢。',
        onEnd: [{ action: 'give_quest', target: 'q_side_jade' }],
      },
      n_exit: {
        speaker: '城中妇人',
        portrait: 'woman_npc',
        text: '唉……',
      },
    },
  },

  // 古道药农 —— 支线「古道采药」
  dlg_herbalist: {
    id: 'dlg_herbalist',
    startNode: 'n_start',
    nodes: {
      n_start: {
        speaker: '古道药农',
        portrait: 'herbalist',
        text: '这位少侠，古道之上生有灵草，我却不敢深入，怕遇山贼。',
        choices: [{ text: '需要我帮忙？', next: 'n_detail' }],
      },
      n_detail: {
        speaker: '古道药农',
        portrait: 'herbalist',
        text: '若能替我采来五株草药，我愿以丹药相谢。灵草生于古道两侧。',
        choices: [
          { text: '我这就去', next: 'n_give_quest' },
          { text: '改日再说', next: 'n_exit' },
        ],
      },
      n_give_quest: {
        speaker: '古道药农',
        portrait: 'herbalist',
        text: '拜托了！山贼凶狠，千万小心。',
        onEnd: [{ action: 'give_quest', target: 'q_side_herb' }],
      },
      n_exit: {
        speaker: '古道药农',
        portrait: 'herbalist',
        text: '也好，小心行事。',
      },
    },
  },

  // 雪见 —— 救援对话，加入队伍
  dlg_xuejian: {
    id: 'dlg_xuejian',
    startNode: 'n_start',
    nodes: {
      n_start: {
        speaker: '雪见',
        portrait: 'xuejian',
        text: '你……你是来救我的？',
        choices: [
          { text: '正是，快跟我走', next: 'n_rescue' },
          { text: '你为何在此？', next: 'n_story' },
        ],
      },
      n_story: {
        speaker: '雪见',
        portrait: 'xuejian',
        text: '我被妖物掳来此地，困于古道。那妖物首领就在前方古剑处，多谢相救！',
        choices: [{ text: '一起走吧', next: 'n_join' }],
      },
      n_rescue: {
        speaker: '雪见',
        portrait: 'xuejian',
        text: '多谢！我会一些医术，能助你一臂之力。',
        onEnd: [{ action: 'join_party', target: 'xuejian' }],
        next: 'n_after',
      },
      n_join: {
        speaker: '雪见',
        portrait: 'xuejian',
        text: '好，我们并肩作战！',
        onEnd: [
          { action: 'join_party', target: 'xuejian' },
          { action: 'heal' },
        ],
        next: 'n_after',
      },
      n_after: {
        speaker: '雪见',
        portrait: 'xuejian',
        text: '前方那柄古剑妖气森森，我们小心。',
      },
    },
  },

  // 紫萱 —— 教学辅助，赠剑后离去
  dlg_zixuan: {
    id: 'dlg_zixuan',
    startNode: 'n_start',
    nodes: {
      n_start: {
        speaker: '紫萱',
        portrait: 'zixuan',
        text: '景天，你灵根初醒，我教你几手基础剑式。',
        choices: [{ text: '多谢紫萱姑娘', next: 'n_teach' }],
      },
      n_teach: {
        speaker: '紫萱',
        portrait: 'zixuan',
        text: '记住，遇敌莫慌，先斩弱者。这柄铁剑你先用着，伤势我也替你理一理。',
        onEnd: [
          { action: 'give_item', target: 'iron_sword' },
          { action: 'heal' },
        ],
        next: 'n_leave',
      },
      n_leave: {
        speaker: '紫萱',
        portrait: 'zixuan',
        text: '我尚有要事，先走一步。保重。',
        onEnd: [{ action: 'set_flag', target: 'zixuan_left' }],
      },
    },
  },

  // 存档老人 —— 存档点
  dlg_save_keeper: {
    id: 'dlg_save_keeper',
    startNode: 'n_start',
    nodes: {
      n_start: {
        speaker: '存档老人',
        portrait: 'save_keeper',
        text: '少侠，要在此歇脚记录行迹吗？',
        choices: [
          { text: '存档', next: 'n_save' },
          { text: '休息治疗', next: 'n_heal' },
          { text: '告辞', next: 'n_exit' },
        ],
      },
      n_save: {
        speaker: '存档老人',
        portrait: 'save_keeper',
        text: '已为你记下行迹。',
        onEnd: [{ action: 'save_game' }],
      },
      n_heal: {
        speaker: '存档老人',
        portrait: 'save_keeper',
        text: '歇歇脚，伤势便好了。',
        onEnd: [{ action: 'heal' }],
      },
      n_exit: {
        speaker: '存档老人',
        portrait: 'save_keeper',
        text: '一路平安。',
      },
    },
  },
};
