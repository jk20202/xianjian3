import Phaser from 'phaser';
import { GameContext } from '../core/GameContext';
import { getStoryNode } from '../data/story';
import { getSkill } from '../data/skills';
import { ELEMENT_LABEL } from '../core/elements';

/** 对话/商店/暂停 场景(覆盖层) */
export class DialogScene extends Phaser.Scene {
  mode: 'story' | 'shop' | 'pause' = 'story';
  lines: { speaker: string; color: number; text: string }[] = [];
  lineIdx = 0;
  nodeId: string | null = null;
  shopType: 'weapon' | 'potion' = 'potion';
  customLines: { speaker: string; color: number; text: string }[] | null = null;

  constructor() { super('DialogScene'); }

  init(data: { mode: string; nodeId?: string; shopType?: string; customLines?: { speaker: string; color: number; text: string }[] }) {
    this.mode = data.mode as any;
    this.nodeId = data.nodeId ?? null;
    this.shopType = (data.shopType as any) ?? 'potion';
    this.customLines = data.customLines ?? null;
    this.lineIdx = 0;
  }

  create() {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, 0x000000, 0.4).setOrigin(0);

    if (this.mode === 'story') this.setupStory();
    else if (this.mode === 'shop') this.setupShop();
    else if (this.mode === 'pause') this.setupPause();

    this.input.keyboard!.on('keydown-ESC', () => this.close());
  }

  // ===== 剧情 =====
  private setupStory() {
    if (this.customLines && this.customLines.length) {
      this.lines = this.customLines;
      this.showLine();
      this.input.on('pointerdown', () => this.advance());
      this.input.keyboard!.on('keydown-SPACE', () => this.advance());
      this.input.keyboard!.on('keydown-E', () => this.advance());
      return;
    }
    if (!this.nodeId) return this.close();
    const node = getStoryNode(this.nodeId);
    this.lines = node.dialog;
    this.showLine();

    this.input.on('pointerdown', () => this.advance());
    this.input.keyboard!.on('keydown-SPACE', () => this.advance());
    this.input.keyboard!.on('keydown-E', () => this.advance());
  }

  private showLine() {
    const { width, height } = this.scale;
    const line = this.lines[this.lineIdx];
    if (!line) return;

    // 清除上一行
    this.children.removeAll(true);

    // 章节标题(仅剧情节点)
    if (this.nodeId) {
      const node = getStoryNode(this.nodeId);
      this.add.text(width / 2, 60, `第${'一二三四五'[node.chapter - 1]}章 · ${node.title}`, {
        fontFamily: 'serif', fontSize: '20px', color: '#c9b072',
      }).setOrigin(0.5);
    }

    // 对话框
    const boxH = 160;
    const box = this.add.rectangle(width / 2, height - boxH / 2 - 10, width - 80, boxH, 0x1a1428, 0.95)
      .setStrokeStyle(2, 0xc9b072);
    this.add.existing(box);

    // 说话者
    this.add.text(60, height - boxH - 5, line.speaker, {
      fontFamily: 'serif', fontSize: '18px', color: '#' + line.color.toString(16).padStart(6, '0'),
      backgroundColor: '#1a1428', padding: { x: 10, y: 4 },
    });

    // 文字(逐字效果)
    const txt = this.add.text(width / 2, height - boxH / 2 - 5, '', {
      fontFamily: 'serif', fontSize: '17px', color: '#e8d9a0', align: 'left',
      wordWrap: { width: width - 140 }, lineSpacing: 6,
    }).setOrigin(0.5);

    this.typewriter(txt, line.text);

    // 提示
    this.add.text(width - 60, height - 20, '[ 空格/点击 继续 ]', {
      fontSize: '11px', color: '#665544',
    }).setOrigin(1, 0.5);
  }

  private typewriter(txt: Phaser.GameObjects.Text, full: string) {
    let i = 0;
    this.time.addEvent({
      delay: 35, loop: true,
      callback: () => {
        i++; txt.setText(full.slice(0, i));
        if (i >= full.length) this.time.removeAllEvents();
      },
    });
  }

  private advance() {
    if (this.lineIdx < this.lines.length - 1) {
      this.lineIdx++;
      this.showLine();
    } else {
      if (this.customLines) this.close();
      else this.finishStory();
    }
  }

  private finishStory() {
    const world = this.scene.get('WorldScene') as any;
    if (this.nodeId) {
      const node = getStoryNode(this.nodeId);
      world.handleStoryComplete(this.nodeId);
      // 显示奖励
      if (node.reward) {
        const parts: string[] = [];
        if (node.reward.exp) parts.push(`经验+${node.reward.exp}`);
        if (node.reward.money) parts.push(`银两+${node.reward.money}`);
        if (node.reward.skill) parts.push(`习得【${getSkill(node.reward.skill).name}】`);
        if (parts.length) this.showReward(parts.join('  '));
        return;
      }
    }
    this.close();
  }

  private showReward(text: string) {
    const { width, height } = this.scale;
    const t = this.add.text(width / 2, height / 2, text, {
      fontSize: '18px', color: '#ffd97a', backgroundColor: '#000000cc', padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setDepth(9999);
    this.tweens.add({ targets: t, alpha: 0, delay: 1800, duration: 500, onComplete: () => this.close() });
  }

  // ===== 商店 =====
  private setupShop() {
    const { width, height } = this.scale;
    const panel = this.add.rectangle(width / 2, height / 2, 520, 360, 0x1a1428, 0.97).setStrokeStyle(2, 0xc9b072);
    this.add.text(width / 2, height / 2 - 150, this.shopType === 'weapon' ? '武器铺' : '药铺', {
      fontFamily: 'serif', fontSize: '24px', color: '#e8d9a0',
    }).setOrigin(0.5);
    this.add.text(width / 2, height / 2 - 120, `银两:${GameContext.money}`, {
      fontSize: '13px', color: '#ffd97a',
    }).setOrigin(0.5);

    const items = this.shopType === 'weapon'
      ? [
          { id: 'w1', name: '木剑', desc: '攻击+5', price: 100, apply: () => this.equipAtk(5) },
          { id: 'w2', name: '青铜剑', desc: '攻击+12', price: 350, apply: () => this.equipAtk(12) },
          { id: 'w3', name: '镇妖剑', desc: '攻击+30', price: 1500, apply: () => this.equipAtk(30) },
        ]
      : [
          { id: 'p1', name: '金创药', desc: '恢复精200', price: 50, apply: () => this.buyPotion('hp_potion', 200) },
          { id: 'p2', name: '还魂丹', desc: '恢复精800', price: 200, apply: () => this.buyPotion('hp_potion_big', 800) },
          { id: 'p3', name: '神行丹', desc: '恢复神100', price: 80, apply: () => this.buyPotion('shen_potion', 100) },
        ];

    items.forEach((it, i) => {
      const y = height / 2 - 60 + i * 56;
      this.add.text(width / 2 - 220, y, it.name, { fontSize: '16px', color: '#e8d9a0' });
      this.add.text(width / 2 - 100, y, it.desc, { fontSize: '13px', color: '#9a8a55' });
      this.add.text(width / 2 + 60, y, `${it.price}两`, { fontSize: '14px', color: '#ffd97a' });
      const btn = this.add.text(width / 2 + 150, y, '购买', {
        fontSize: '14px', color: '#7fd87f', backgroundColor: '#00000088', padding: { x: 8, y: 3 },
      }).setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => {
        if (GameContext.money >= it.price) {
          GameContext.money -= it.price;
          (it as any).apply();
          this.refreshShop();
          this.toast(`购得 ${it.name}`);
        } else this.toast('银两不足');
      });
    });

    const close = this.add.text(width / 2, height / 2 + 150, '[ 离开 ]', {
      fontSize: '15px', color: '#9a8a55',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => {
      const world = this.scene.get('WorldScene') as any;
      world.handleShopClose();
      this.close();
    });
  }

  private refreshShop() {
    // 简化:重建商店界面
    this.children.removeAll(true);
    this.setupShop();
  }

  private equipAtk(bonus: number) {
    const leader = GameContext.leader;
    leader.atk += bonus;
  }

  private buyPotion(id: string, _heal: number) {
    GameContext.inventory[id] = (GameContext.inventory[id] ?? 0) + 1;
  }

  // ===== 暂停菜单 =====
  private setupPause() {
    const { width, height } = this.scale;
    this.add.text(width / 2, 120, '— 暂 停 —', {
      fontFamily: 'serif', fontSize: '32px', color: '#e8d9a0',
    }).setOrigin(0.5);

    const items = [
      { label: '继续游戏', y: 200, act: () => { (this.scene.get('WorldScene') as any).handlePauseResume(); this.close(); } },
      { label: '存档', y: 260, act: () => { this.scene.stop().launch('SaveScene', { mode: 'save', returnScene: 'WorldScene' }); } },
      { label: '读档(回档)', y: 320, act: () => { this.scene.stop().launch('SaveScene', { mode: 'load', returnScene: 'WorldScene' }); } },
      { label: '返回主菜单', y: 380, act: () => { this.scene.stop('UIScene'); this.scene.stop('WorldScene'); this.scene.start('MenuScene'); } },
    ];
    for (const it of items) {
      const t = this.add.text(width / 2, it.y, it.label, {
        fontFamily: 'serif', fontSize: '22px', color: '#c9b072',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on('pointerover', () => t.setColor('#ffe9a0'));
      t.on('pointerout', () => t.setColor('#c9b072'));
      t.on('pointerdown', () => it.act());
    }

    // 队伍信息
    const partyY = 440;
    GameContext.party.filter(p => p.inParty).forEach((m, i) => {
      this.add.text(80 + i * 200, partyY,
        `${m.name} Lv${m.level} ${ELEMENT_LABEL[m.element]}\n精${m.hp}/${m.maxHp} 气${m.qi} 神${m.shen}`, {
        fontSize: '12px', color: '#9a8a55', lineSpacing: 3,
      });
    });
  }

  // ===== 通用 =====
  private toast(msg: string) {
    const t = this.add.text(this.scale.width / 2, this.scale.height / 2, msg, {
      fontSize: '14px', color: '#ffaaaa', backgroundColor: '#000000cc', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setDepth(9999);
    this.tweens.add({ targets: t, alpha: 0, delay: 1200, duration: 400, onComplete: () => t.destroy() });
  }

  private close() {
    this.scene.stop();
    if (this.scene.isActive('WorldScene')) this.scene.resume('WorldScene');
  }
}
