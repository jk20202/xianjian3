// dialogue/DialogueManager.ts
// 对话系统：管理对话树遍历、打字机效果、选项选择与节点动作执行。
// 通过回调钩子将动作委托给主游戏循环，不直接操作场景或 UI。

import { bus } from '../core/eventBus';
import { DIALOGUES } from '../data/dialogues';
import type { DialogueTree, DialogueNode, DialogueAction } from '../data/dialogues';

class DialogueManager {
  /** 当前对话树 */
  currentTree: DialogueTree | null = null;
  /** 当前节点 ID */
  currentNodeId: string | null = null;
  /** 打字机进度（0-1） */
  typewriterProgress: number = 0;
  /** 是否在等待选择 */
  waitingForChoice: boolean = false;

  // ─── 回调钩子（由主游戏循环设置） ─────────────────────────────

  /** 接取任务 */
  onGiveQuest?: (questId: string) => void;
  /** 完成任务 */
  onCompleteQuest?: (questId: string) => void;
  /** 给予物品 */
  onGiveItem?: (itemId: string) => void;
  /** 设置剧情标记 */
  onSetFlag?: (flag: string) => void;
  /** 角色加入队伍 */
  onJoinParty?: (characterId: string) => void;
  /** 治疗队伍 */
  onHeal?: () => void;
  /** 打开商店 */
  onOpenShop?: (shopId: string) => void;
  /** 存档 */
  onSaveGame?: () => void;

  /** 打字机速度（字符/秒） */
  private typewriterSpeed: number = 30;
  /** 当前节点 onEnd 是否已执行（防止重复触发） */
  private onEndExecuted: boolean = false;

  /**
   * 开始对话
   * @param dialogueId 对话树 ID
   */
  start(dialogueId: string): void {
    const tree = DIALOGUES[dialogueId];
    if (!tree) return;

    this.currentTree = tree;
    this.currentNodeId = tree.startNode;
    this.typewriterProgress = 0;
    this.onEndExecuted = false;

    // 检查起始节点是否有选项
    const startNode = tree.nodes[tree.startNode];
    this.waitingForChoice = !!(startNode && startNode.choices && startNode.choices.length > 0);

    bus.emit('dialogue:start', { dialogueId });
  }

  /**
   * 推进对话
   * - 打字机未完成时：补全文本
   * - 打字机已完成且节点有 next：执行 onEnd 并跳转下一节点
   * - 打字机已完成且无 next 无选项：执行 onEnd 并结束对话
   */
  advance(): void {
    if (!this.currentTree || !this.currentNodeId) return;
    const node = this.current;
    if (!node) return;

    // 打字机未完成 -> 补全文本
    if (this.typewriterProgress < 1) {
      this.typewriterProgress = 1;
      return;
    }

    // 等待选择时不可推进
    if (this.waitingForChoice) return;

    // 节点有 next -> 执行 onEnd 并跳转
    if (node.next) {
      this.executeNodeOnEnd(node);
      this.gotoNode(node.next);
      return;
    }

    // 无 next 且无选项 -> 执行 onEnd 并结束对话
    if (!node.choices || node.choices.length === 0) {
      this.executeNodeOnEnd(node);
      this.end();
    }
  }

  /**
   * 选择选项
   * @param choiceIndex 选项索引
   */
  choose(choiceIndex: number): void {
    if (!this.currentTree || !this.currentNodeId) return;
    const node = this.current;
    if (!node || !node.choices) return;

    const choice = node.choices[choiceIndex];
    if (!choice) return;

    // 设置剧情标记
    if (choice.setFlag) {
      this.onSetFlag?.(choice.setFlag);
    }

    // 执行当前节点的 onEnd
    this.executeNodeOnEnd(node);

    // 跳转到选项指向的节点
    this.gotoNode(choice.next);
  }

  /** 结束对话 */
  end(): void {
    if (!this.currentTree) return;
    bus.emit('dialogue:end', { dialogueId: this.currentTree.id });
    this.currentTree = null;
    this.currentNodeId = null;
    this.typewriterProgress = 0;
    this.waitingForChoice = false;
    this.onEndExecuted = false;
  }

  /**
   * 更新打字机进度
   * @param dt 帧间隔（秒）
   */
  update(dt: number): void {
    if (!this.currentTree || !this.currentNodeId) return;
    const node = this.current;
    if (!node) return;

    if (this.typewriterProgress < 1) {
      const textLength = node.text.length;
      if (textLength > 0) {
        this.typewriterProgress += (this.typewriterSpeed * dt) / textLength;
        if (this.typewriterProgress > 1) this.typewriterProgress = 1;
      } else {
        this.typewriterProgress = 1;
      }
    }
  }

  /** 获取当前节点 */
  get current(): DialogueNode | null {
    if (!this.currentTree || !this.currentNodeId) return null;
    return this.currentTree.nodes[this.currentNodeId] ?? null;
  }

  /** 是否在对话中 */
  get isActive(): boolean {
    return this.currentTree !== null;
  }

  // ─── 内部方法 ─────────────────────────────

  /**
   * 跳转到指定节点
   * 重置打字机进度，更新等待选择状态
   */
  private gotoNode(nodeId: string): void {
    if (!this.currentTree) return;
    const node = this.currentTree.nodes[nodeId];
    if (!node) {
      // 目标节点不存在，结束对话
      this.end();
      return;
    }
    this.currentNodeId = nodeId;
    this.typewriterProgress = 0;
    this.onEndExecuted = false;
    this.waitingForChoice = !!(node.choices && node.choices.length > 0);
  }

  /**
   * 执行节点的 onEnd 动作（仅执行一次）
   */
  private executeNodeOnEnd(node: DialogueNode): void {
    if (this.onEndExecuted) return;
    if (node.onEnd && node.onEnd.length > 0) {
      this.executeActions(node.onEnd);
    }
    this.onEndExecuted = true;
  }

  /**
   * 执行动作列表，调用对应的回调钩子
   */
  private executeActions(actions: DialogueAction[]): void {
    for (const action of actions) {
      switch (action.action) {
        case 'give_quest':
          if (action.target) this.onGiveQuest?.(action.target);
          break;
        case 'complete_quest':
          if (action.target) this.onCompleteQuest?.(action.target);
          break;
        case 'give_item':
          if (action.target) this.onGiveItem?.(action.target);
          break;
        case 'set_flag':
          if (action.target) this.onSetFlag?.(action.target);
          break;
        case 'join_party':
          if (action.target) this.onJoinParty?.(action.target);
          break;
        case 'heal':
          this.onHeal?.();
          break;
        case 'open_shop':
          if (action.target) this.onOpenShop?.(action.target);
          break;
        case 'save_game':
          this.onSaveGame?.();
          break;
      }
    }
  }
}

/** 对话系统单例 */
export const dialogueManager = new DialogueManager();
