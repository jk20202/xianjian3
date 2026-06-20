import Phaser from 'phaser';
import { SaveManager, type SlotMeta } from '../core/SaveManager';
import { GameContext } from '../core/GameContext';
import type { Snapshot } from '../types';
import { getMap } from '../data/maps';

/** 存档管理场景:存档/读档/回档快照 */
export class SaveScene extends Phaser.Scene {
  mode: 'save' | 'load' | 'manage' = 'manage';
  returnScene = 'MenuScene';
  slots: SlotMeta[] = [];
  viewingSnapshotsFor: number | null = null;

  constructor() { super('SaveScene'); }

  init(data: { mode: string; returnScene: string }) {
    this.mode = (data.mode as any) ?? 'manage';
    this.returnScene = data.returnScene ?? 'MenuScene';
    this.viewingSnapshotsFor = null;
  }

  async create() {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, 0x0a0a12, 0.97).setOrigin(0);

    this.add.text(width / 2, 40,
      this.mode === 'save' ? '— 存 档 —' : this.mode === 'load' ? '— 读 档 / 回 档 —' : '— 存 档 管 理 —', {
      fontFamily: 'serif', fontSize: '28px', color: '#e8d9a0',
    }).setOrigin(0.5);

    this.slots = await SaveManager.listSlots();
    this.renderSlots();

    // 返回
    const back = this.add.text(40, 40, '← 返回', {
      fontSize: '14px', color: '#9a8a55',
    }).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.goBack());
  }

  private renderSlots() {
    const { width, height } = this.scale;
    // 清除槽位区
    this.children.list.filter(o => o.getData('slotUI')).forEach(o => o.destroy());

    const startY = 90;
    const rowH = 78;
    for (let i = 0; i < SaveManager.slotCount; i++) {
      const meta = this.slots[i];
      const y = startY + i * rowH;
      const card = this.add.rectangle(width / 2, y, width - 120, rowH - 8, 0x14141c, 0.9)
        .setStrokeStyle(1, 0x555544).setInteractive({ useHandCursor: true });
      card.setData('slotUI', true);

      this.add.text(80, y - 22, `槽位 ${i + 1}`, { fontSize: '15px', color: '#c9b072' }).setData('slotUI', true);
      if (meta?.exists) {
        const mapName = (() => { try { return getMap(meta.mapName).name; } catch { return meta.mapName; } })();
        const time = new Date(meta.updatedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        this.add.text(80, y - 2,
          `第${meta.chapter}章 · ${mapName} · Lv${meta.level} · ${meta.money}两`, {
          fontSize: '13px', color: '#e8d9a0',
        }).setData('slotUI', true);
        this.add.text(80, y + 16, `存于 ${time} · 时长 ${Math.floor(meta.playTime / 60)}分`, {
          fontSize: '11px', color: '#665544',
        }).setData('slotUI', true);
      } else {
        this.add.text(80, y, '— 空 —', { fontSize: '14px', color: '#444433' }).setData('slotUI', true);
      }

      // 操作按钮
      const btnX = width - 200;
      if (this.mode === 'save') {
        const saveBtn = this.add.text(btnX, y, '存档到此', {
          fontSize: '14px', color: '#7fd87f', backgroundColor: '#00000088', padding: { x: 8, y: 4 },
        }).setInteractive({ useHandCursor: true }).setOrigin(0.5).setData('slotUI', true);
        saveBtn.on('pointerdown', () => this.saveTo(i));
      } else if (this.mode === 'load' || this.mode === 'manage') {
        if (meta?.exists) {
          const loadBtn = this.add.text(btnX - 30, y, '读取', {
            fontSize: '14px', color: '#ffd97a', backgroundColor: '#00000088', padding: { x: 8, y: 4 },
          }).setInteractive({ useHandCursor: true }).setOrigin(0.5).setData('slotUI', true);
          loadBtn.on('pointerdown', () => this.loadFrom(i));

          const rollBtn = this.add.text(btnX + 50, y, '回档', {
            fontSize: '14px', color: '#b07fff', backgroundColor: '#00000088', padding: { x: 8, y: 4 },
          }).setInteractive({ useHandCursor: true }).setOrigin(0.5).setData('slotUI', true);
          rollBtn.on('pointerdown', () => this.showSnapshots(i));
        }
        if (this.mode === 'manage' && meta?.exists) {
          const delBtn = this.add.text(btnX + 130, y, '删', {
            fontSize: '14px', color: '#ff7777', backgroundColor: '#00000088', padding: { x: 8, y: 4 },
          }).setInteractive({ useHandCursor: true }).setOrigin(0.5).setData('slotUI', true);
          delBtn.on('pointerdown', () => this.deleteSlot(i));
        }
      }
    }
  }

  private async saveTo(slot: number) {
    await GameContext.saveToSlot(slot);
    this.slots = await SaveManager.listSlots();
    this.toast(`已存档至槽位 ${slot + 1}`);
    this.renderSlots();
  }

  private async loadFrom(slot: number) {
    const data = await SaveManager.loadSlot(slot);
    if (!data) { this.toast('存档不存在'); return; }
    GameContext.fromSaveData(data.data);
    this.toast('读档成功');
    this.time.delayedCall(500, () => {
      this.scene.stop('UIScene');
      this.scene.stop('WorldScene');
      this.scene.start('WorldScene', { fromMenu: true });
      this.scene.launch('UIScene');
    });
  }

  private async showSnapshots(slot: number) {
    this.viewingSnapshotsFor = slot;
    const snaps = await SaveManager.listSnapshots(slot);
    const { width, height } = this.scale;
    this.children.list.filter(o => o.getData('snapUI')).forEach(o => o.destroy());

    // 遮罩面板
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.85).setOrigin(0).setData('snapUI', true).setInteractive();
    this.add.text(width / 2, 50, `槽位 ${slot + 1} · 回档快照`, {
      fontFamily: 'serif', fontSize: '24px', color: '#e8d9a0',
    }).setOrigin(0.5).setData('snapUI', true);

    if (snaps.length === 0) {
      this.add.text(width / 2, height / 2, '暂无快照', { fontSize: '16px', color: '#665544' }).setOrigin(0.5).setData('snapUI', true);
    } else {
      snaps.slice().reverse().forEach((s, i) => {
        const y = 100 + i * 46;
        const time = new Date(s.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const mapName = (() => { try { return getMap(s.data.currentMap).name; } catch { return s.data.currentMap; } })();
        this.add.text(80, y, `${time} · ${s.label} · ${mapName} · 第${s.data.currentChapter}章`, {
          fontSize: '13px', color: '#c9b072',
        }).setData('snapUI', true);
        const btn = this.add.text(width - 120, y, '回档到此', {
          fontSize: '13px', color: '#b07fff', backgroundColor: '#00000088', padding: { x: 8, y: 3 },
        }).setInteractive({ useHandCursor: true }).setOrigin(0.5).setData('snapUI', true);
        btn.on('pointerdown', () => this.rollback(slot, s));
      });
    }

    const close = this.add.text(width / 2, height - 40, '[ 关闭 ]', {
      fontSize: '14px', color: '#9a8a55',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setData('snapUI', true);
    close.on('pointerdown', () => {
      this.children.list.filter(o => o.getData('snapUI')).forEach(o => o.destroy());
      this.viewingSnapshotsFor = null;
    });
  }

  private async rollback(slot: number, snap: Snapshot) {
    const data = await SaveManager.rollbackTo(slot, snap.id);
    if (!data) { this.toast('回档失败'); return; }
    GameContext.fromSaveData(data);
    this.toast('回档成功');
    this.time.delayedCall(500, () => {
      this.scene.stop('UIScene');
      this.scene.stop('WorldScene');
      this.scene.start('WorldScene', { fromMenu: true });
      this.scene.launch('UIScene');
    });
  }

  private async deleteSlot(slot: number) {
    await SaveManager.deleteSlot(slot);
    this.slots = await SaveManager.listSlots();
    this.toast('已删除(快照保留,可回档)');
    this.renderSlots();
  }

  private goBack() {
    if (this.returnScene === 'WorldScene') {
      this.scene.stop();
      this.scene.resume('WorldScene');
      this.scene.resume('UIScene');
    } else {
      this.scene.start(this.returnScene);
    }
  }

  private toast(msg: string) {
    const t = this.add.text(this.scale.width / 2, this.scale.height - 80, msg, {
      fontSize: '14px', color: '#ffe9a0', backgroundColor: '#000000cc', padding: { x: 14, y: 6 },
    }).setOrigin(0.5).setDepth(9999);
    this.tweens.add({ targets: t, alpha: 0, delay: 1500, duration: 400, onComplete: () => t.destroy() });
  }
}
