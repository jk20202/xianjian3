import Phaser from 'phaser';
import { SaveManager } from '../core/SaveManager';
import { GameContext } from '../core/GameContext';
import { currentEnvironment } from '../core/StorageAdapter';

/** 主菜单:新游戏 / 继续 / 存档管理 */
export class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.fadeIn(400, 0, 0, 0);

    // 背景
    this.add.rectangle(0, 0, width, height, 0x0a0a12).setOrigin(0);
    this.drawBgPattern();

    // 标题
    this.add.text(width / 2, 110, '仙 劍 奇 俠 傳', {
      fontFamily: 'serif', fontSize: '52px', color: '#e8d9a0',
      stroke: '#3a2a10', strokeThickness: 4,
    }).setOrigin(0.5).setShadow(0, 0, '#c9b072', 16, true, true);

    this.add.text(width / 2, 165, '同 人 篇 · 三 界 缘 起', {
      fontFamily: 'serif', fontSize: '18px', color: '#9a8a55',
    }).setOrigin(0.5);

    // 菜单按钮
    const cx = width / 2;
    const items = [
      { label: '新 游 戏', y: 260, act: () => this.newGame() },
      { label: '继 续 游 戏', y: 320, act: () => this.continueGame() },
      { label: '存 档 管 理', y: 380, act: () => this.openSaveMenu() },
      { label: '操 作 说 明', y: 440, act: () => this.showHelp() },
    ];

    for (const it of items) {
      const txt = this.add.text(cx, it.y, it.label, {
        fontFamily: 'serif', fontSize: '24px', color: '#c9b072',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      txt.on('pointerover', () => txt.setColor('#ffe9a0').setScale(1.06));
      txt.on('pointerout', () => txt.setColor('#c9b072').setScale(1));
      txt.on('pointerdown', () => it.act());
    }

    // 环境信息
    this.add.text(width - 10, height - 22, `运行环境: ${currentEnvironment()}  |  本地存档`, {
      fontSize: '11px', color: '#555544',
    }).setOrigin(1, 0);

    this.add.text(10, height - 22, 'v0.1 · Phaser3 + TS', {
      fontSize: '11px', color: '#444433',
    });
  }

  private drawBgPattern() {
    const g = this.add.graphics();
    g.fillStyle(0x14141c, 0.6);
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * this.scale.width;
      const y = Math.random() * this.scale.height;
      const r = Math.random() * 1.5 + 0.3;
      g.fillCircle(x, y, r);
    }
    // 远山剪影
    g.fillStyle(0x1a1428, 0.8);
    g.beginPath();
    g.moveTo(0, this.scale.height);
    for (let x = 0; x <= this.scale.width; x += 40) {
      const y = this.scale.height - 80 - Math.sin(x * 0.02) * 30 - Math.random() * 20;
      g.lineTo(x, y);
    }
    g.lineTo(this.scale.width, this.scale.height);
    g.closePath();
    g.fillPath();
  }

  private newGame() {
    GameContext.newGame();
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('WorldScene', { fromMenu: true });
      this.scene.launch('UIScene');
    });
  }

  private async continueGame() {
    // 优先自动存档,其次最新槽位
    const auto = await SaveManager.loadAutosave();
    if (auto) {
      GameContext.fromSaveData(auto.data);
      this.startWorld();
      return;
    }
    const slots = await SaveManager.listSlots();
    const exist = slots.filter(s => s.exists).sort((a, b) => b.updatedAt - a.updatedAt);
    if (exist.length === 0) {
      this.toast('暂无存档,请先开始新游戏');
      return;
    }
    const slot = await SaveManager.loadSlot(exist[0].slotId);
    if (slot) {
      GameContext.fromSaveData(slot.data);
      this.startWorld();
    }
  }

  private openSaveMenu() {
    this.scene.start('SaveScene', { mode: 'manage', returnScene: 'MenuScene' });
  }

  private showHelp() {
    const { width, height } = this.scale;
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.85).setOrigin(0).setInteractive();
    const panel = this.add.rectangle(width / 2, height / 2, 560, 380, 0x1a1428, 0.95).setStrokeStyle(2, 0xc9b072);
    const lines = [
      '【操作说明】',
      '',
      '移动:    W A S D / 方向键',
      '平A:     J / 鼠标左键',
      '技能:    K L U I O (对应技能栏1-5)',
      '切换角色: Tab',
      '交互:    E / 空格',
      '菜单:    Esc',
      '存档:    随时在菜单存档,自动生成回档快照',
      '',
      '【五灵相克】水→火→雷→风→土→水',
      '克制造成 +50% 伤害,被克 -40%',
      '',
      '草丛行走会触发遇敌(即时战斗)',
    ];
    const txt = this.add.text(width / 2, height / 2, lines.join('\n'), {
      fontFamily: 'serif', fontSize: '16px', color: '#e8d9a0', align: 'left',
      lineSpacing: 4,
    }).setOrigin(0.5);
    const close = this.add.text(width / 2, height / 2 + 165, '[ 点击关闭 ]', {
      fontSize: '14px', color: '#9a8a55',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => { overlay.destroy(); panel.destroy(); txt.destroy(); close.destroy(); });
  }

  private startWorld() {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('WorldScene', { fromMenu: true });
      this.scene.launch('UIScene');
    });
  }

  private toast(msg: string) {
    const t = this.add.text(this.scale.width / 2, this.scale.height / 2, msg, {
      fontSize: '16px', color: '#ffaaaa', backgroundColor: '#00000088',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setDepth(9999);
    this.time.delayedCall(1500, () => t.destroy());
  }
}
