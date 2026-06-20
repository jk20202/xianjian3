import Phaser from 'phaser';
import { GameContext } from '../core/GameContext';
import { getSkill } from '../data/skills';
import { ELEMENT_LABEL, ELEMENT_COLOR } from '../core/elements';

/** UI 场景:HUD(血量/气/神/技能栏/小地图提示) */
export class UIScene extends Phaser.Scene {
  bars!: { hp: Phaser.GameObjects.Rectangle; qi: Phaser.GameObjects.Rectangle; shen: Phaser.GameObjects.Rectangle };
  skillIcons: Phaser.GameObjects.Container[] = [];
  toastText!: Phaser.GameObjects.Text;
  questText!: Phaser.GameObjects.Text;
  moneyText!: Phaser.GameObjects.Text;

  constructor() { super('UIScene'); }

  create() {
    // 左上:角色状态
    const panel = this.add.rectangle(10, 10, 240, 90, 0x000000, 0.55).setStrokeStyle(1, 0xc9b072, 0.5).setOrigin(0);

    const leader = GameContext.leader;
    this.add.text(20, 16, `${leader.name}  Lv.${leader.level}`, {
      fontSize: '14px', color: '#e8d9a0',
    });
    this.add.text(20, 34, `${ELEMENT_LABEL[leader.element]}属性`, {
      fontSize: '11px', color: '#' + ELEMENT_COLOR[leader.element].toString(16).padStart(6, '0'),
    });

    // 三条资源条:精/气/神
    this.add.text(20, 50, '精', { fontSize: '11px', color: '#ff8888' });
    this.add.text(20, 64, '气', { fontSize: '11px', color: '#ffd97a' });
    this.add.text(20, 78, '神', { fontSize: '11px', color: '#88ccff' });

    const barX = 38, barW = 180, barH = 10;
    this.bars = {
      hp: this.add.rectangle(barX, 54, barW, barH, 0x440000).setOrigin(0).setStrokeStyle(1, 0x000000, 0.5),
      qi: this.add.rectangle(barX, 68, barW, barH, 0x442200).setOrigin(0).setStrokeStyle(1, 0x000000, 0.5),
      shen: this.add.rectangle(barX, 82, barW, barH, 0x002244).setOrigin(0).setStrokeStyle(1, 0x000000, 0.5),
    };
    // 填充层
    const hpFill = this.add.rectangle(barX, 54, barW, barH, 0xff5555).setOrigin(0);
    const qiFill = this.add.rectangle(barX, 68, barW, barH, 0xffd97a).setOrigin(0);
    const shenFill = this.add.rectangle(barX, 82, barW, barH, 0x66bbff).setOrigin(0);
    (this.bars as any).hpFill = hpFill; (this.bars as any).qiFill = qiFill; (this.bars as any).shenFill = shenFill;

    // 右上:金钱 + 任务
    this.moneyText = this.add.text(this.scale.width - 10, 14, '', {
      fontSize: '13px', color: '#ffd97a',
    }).setOrigin(1, 0);
    this.questText = this.add.text(this.scale.width - 10, 34, '', {
      fontSize: '11px', color: '#9a8a55', backgroundColor: '#00000066', padding: { x: 6, y: 2 },
    }).setOrigin(1, 0);

    // 底部:技能栏(5 个槽位)
    this.buildSkillBar();

    // 操作提示
    this.add.text(this.scale.width / 2, this.scale.height - 8,
      '左摇杆移动 · 攻键平A · 技能键 · Tab切换 · E/空格交互 · Esc菜单', {
      fontSize: '10px', color: '#665544',
    }).setOrigin(0.5, 1);

    // Toast
    this.toastText = this.add.text(this.scale.width / 2, 120, '', {
      fontSize: '14px', color: '#ffe9a0', backgroundColor: '#000000aa', padding: { x: 12, y: 4 },
    }).setOrigin(0.5).setAlpha(0);

    // 监听 WorldScene 事件
    const world = this.scene.get('WorldScene');
    world.events.on('ui-toast', (msg: string) => this.toast(msg));

    // 每帧刷新
    this.events.on('update', () => this.refresh());
    this.refresh();
  }

  private buildSkillBar() {
    const slots = 5;
    const size = 44, gap = 6;
    const totalW = slots * size + (slots - 1) * gap;
    const startX = (this.scale.width - totalW) / 2;
    const y = this.scale.height - 60;
    const keys = ['K', 'L', 'U', 'I', 'O'];

    for (let i = 0; i < slots; i++) {
      const x = startX + i * (size + gap);
      const bg = this.add.rectangle(x, y, size, size, 0x000000, 0.6).setStrokeStyle(1, 0xc9b072, 0.5).setOrigin(0);
      const icon = this.add.text(x + size / 2, y + 10, '', { fontSize: '11px', color: '#e8d9a0' }).setOrigin(0.5);
      const name = this.add.text(x + size / 2, y + 26, '', { fontSize: '9px', color: '#9a8a55' }).setOrigin(0.5);
      const keyLabel = this.add.text(x + 3, y + 2, keys[i], { fontSize: '9px', color: '#665544' });
      const cdMask = this.add.rectangle(x, y, size, size, 0x000000, 0.6).setOrigin(0).setVisible(false);
      const cdText = this.add.text(x + size / 2, y + size / 2, '', { fontSize: '12px', color: '#ffaaaa' }).setOrigin(0.5).setVisible(false);
      const c = this.add.container(0, 0, [bg, icon, name, keyLabel, cdMask, cdText]);
      this.skillIcons.push(c);
    }
  }

  private refresh() {
    const leader = GameContext.leader;
    if (!leader) return;
    const fills = this.bars as any;
    fills.hpFill.width = (leader.hp / leader.maxHp) * 180;
    fills.qiFill.width = (leader.qi / leader.maxQi) * 180;
    fills.shenFill.width = (leader.shen / leader.maxShen) * 180;

    this.moneyText.setText(`银两 ${GameContext.money}`);
    this.questText.setText(GameContext.activeQuest ? `当前:${this.questLabel(GameContext.activeQuest)}` : '');

    // 技能栏
    const skills = leader.skills.filter(s => s !== 'basic_attack').slice(0, 5);
    const now = this.time.now;
    for (let i = 0; i < 5; i++) {
      const c = this.skillIcons[i];
      const icon = c.getAt(1) as Phaser.GameObjects.Text;
      const name = c.getAt(2) as Phaser.GameObjects.Text;
      const cdMask = c.getAt(4) as Phaser.GameObjects.Rectangle;
      const cdText = c.getAt(5) as Phaser.GameObjects.Text;
      if (i < skills.length) {
        const sk = getSkill(skills[i]);
        icon.setText(sk.element ? ELEMENT_LABEL[sk.element] : '技');
        icon.setColor('#' + sk.effectColor.toString(16).padStart(6, '0'));
        name.setText(sk.name);
        const cdKey = `${leader.id}:${sk.id}`;
        const cdEnd = GameContext.skillCooldowns[cdKey] ?? 0;
        if (now < cdEnd) {
          const remain = Math.ceil((cdEnd - now) / 1000);
          cdMask.setVisible(true); cdText.setVisible(true).setText(`${remain}`);
        } else {
          cdMask.setVisible(false); cdText.setVisible(false);
        }
      } else {
        icon.setText(''); name.setText(''); cdMask.setVisible(false); cdText.setVisible(false);
      }
    }
  }

  private questLabel(id: string): string {
    try {
      // 简单映射
      const map: Record<string, string> = {
        ch1_intro: '缘起渝州', ch1_zhao: '古董鉴定', ch1_bishan: '穿璧山',
        ch1_tangjia: '唐门风波', ch2_road: '蜀山故道', ch2_shushan: '蜀山问道',
        ch3_locktower: '锁妖塔',
        ch4_gutenglin: '古藤林·飞龙探云手', ch4_fengdu: '酆都鬼城', ch4_rongyan: '熔岩地狱·火鬼王',
        ch5_bingfenggu: '冰风谷·雪见归魂', ch5_haidicheng: '海底城·溪风水碧', ch5_jianzhong: '剑冢·邪剑仙',
      };
      return map[id] ?? id;
    } catch { return id; }
  }

  private toast(msg: string) {
    this.toastText.setText(msg).setAlpha(1);
    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: 1500, duration: 400 });
  }
}
