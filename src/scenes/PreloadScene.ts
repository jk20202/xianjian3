import Phaser from 'phaser';

/** Preload:进度展示(资源已在 Boot 程序化生成,这里仅过渡) */
export class PreloadScene extends Phaser.Scene {
  constructor() { super('PreloadScene'); }

  preload() {
    const { width, height } = this.scale;
    const barW = 320, barH = 14;
    const barX = (width - barW) / 2, barY = height / 2;

    this.add.text(width / 2, barY - 40, '仙劍奇俠傳 · 同人篇', {
      fontFamily: 'serif', fontSize: '28px', color: '#e8d9a0',
    }).setOrigin(0.5);

    const bg = this.add.rectangle(barX, barY, barW, barH, 0x222230).setStrokeStyle(1, 0x555544);
    const fill = this.add.rectangle(barX, barY, 0, barH, 0xc9b072).setOrigin(0, 0.5);
    fill.x = barX; fill.y = barY;

    this.add.text(width / 2, barY + 30, '载入中…', { fontSize: '12px', color: '#8a7a55' }).setOrigin(0.5);

    this.load.on('progress', (v: number) => {
      fill.width = barW * v;
    });
    this.load.on('complete', () => {
      bg.destroy(); fill.destroy();
    });

    // 模拟一帧加载(无外部资源)
    this.load.start();
  }

  create() {
    this.scene.start('MenuScene');
  }
}
