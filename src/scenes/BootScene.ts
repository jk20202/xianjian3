import Phaser from 'phaser';
import { currentEnvironment } from '../core/StorageAdapter';

/** Boot:初始化系统,生成程序化纹理(无外部图片依赖) */
export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  create() {
    // 生成所有程序化纹理
    this.makeTextures();

    // 环境信息(调试)
    this.add.text(10, 10, `环境: ${currentEnvironment()}`, { fontSize: '10px', color: '#555' });

    this.scene.start('PreloadScene');
  }

  /** 程序化生成精灵纹理,避免外部资源依赖 */
  private makeTextures() {
    const g = this.add.graphics();

    // 玩家:景天(绿色风系)
    this.drawCharTexture(g, 'player_jingtian', 0x7fd87f, 0x2a5a2a);
    // 队友
    this.drawCharTexture(g, 'player_xuejian', 0xd9a85a, 0x5a3a1a);
    this.drawCharTexture(g, 'player_longkui', 0xb07fff, 0x3a1a5a);
    this.drawCharTexture(g, 'player_zixuan', 0x5fb8ff, 0x1a3a5a);
    this.drawCharTexture(g, 'player_changqing', 0xff7a4d, 0x5a1a1a);

    // 敌人通用纹理(按颜色)
    const enemyColors: Record<string, number> = {
      shu_yao: 0x6fae4f, yao_hua_wu_shi: 0xb8860b, pi_li_tang_di: 0xcc4422,
      xiao_yao: 0x8a9a5a, gui_hun: 0x9988bb, huo_gui: 0xff5522,
      bing_can: 0x66ccff, shi_jiang: 0x886644,
      gu_teng_jing: 0x4a7a3a, huang_quan_gui: 0x6a5a8a, huo_gui_bing: 0xcc3322,
      yan_jiang_yao: 0xff4422, bing_feng_ling: 0x88ddff, hai_di_shou: 0x3399cc,
      xie_qi_yao: 0xaa3344, jian_hun: 0xaaccbb,
      mo_pi_feng: 0x4a8a3a, tian_yao_huang: 0x7744aa,
      huo_gui_wang: 0xff3311,
      xie_jian_xian: 0xaa2233, chong_lou: 0x880022,
    };
    for (const [id, color] of Object.entries(enemyColors)) {
      this.drawEnemyTexture(g, `enemy_${id}`, color);
    }

    // NPC 通用(灰色人形)
    this.drawCharTexture(g, 'npc_generic', 0xc0c0c0, 0x404040, 14);

    // 瓦片
    this.drawTile(g, 'tile_floor', 0x2a3a2a, true);
    this.drawTile(g, 'tile_wall', 0x14141c, false);
    this.drawTile(g, 'tile_grass', 0x1f3a1f, true, 0x2f5a2f);
    this.drawTile(g, 'tile_shop', 0x3a2a1a, true, 0xc9a06a);
    this.drawTile(g, 'tile_story', 0x3a1a2a, true, 0xffd97a);

    // 投射物
    this.drawCircle(g, 'proj_wind', 6, 0x7fd87f);
    this.drawCircle(g, 'proj_fire', 6, 0xff7a4d);
    this.drawCircle(g, 'proj_thunder', 6, 0xb07fff);
    this.drawCircle(g, 'proj_water', 6, 0x5fb8ff);
    this.drawCircle(g, 'proj_earth', 6, 0xd9a85a);
    this.drawCircle(g, 'proj_basic', 5, 0xffffff);

    // 特效粒子
    this.drawCircle(g, 'spark', 4, 0xffffff);

    g.destroy();
  }

  private drawCharTexture(g: Phaser.GameObjects.Graphics, key: string, body: number, outline: number, size = 12) {
    g.clear();
    // 阴影
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(size, size * 2 - 1, size * 1.6, size * 0.6);
    // 身体
    g.lineStyle(2, outline, 1);
    g.fillStyle(body, 1);
    g.fillCircle(size, size, size);
    g.strokeCircle(size, size, size);
    // 眼睛
    g.fillStyle(0x000000, 1);
    g.fillRect(size - 4, size - 2, 2, 3);
    g.fillRect(size + 2, size - 2, 2, 3);
    g.generateTexture(key, size * 2, size * 2);
  }

  private drawEnemyTexture(g: Phaser.GameObjects.Graphics, key: string, color: number) {
    g.clear();
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(16, 30, 24, 8);
    g.lineStyle(2, 0x000000, 0.6);
    g.fillStyle(color, 1);
    g.fillCircle(16, 16, 14);
    g.strokeCircle(16, 16, 14);
    // 凶眼
    g.fillStyle(0xff3333, 1);
    g.fillRect(10, 13, 4, 3);
    g.fillRect(18, 13, 4, 3);
    g.generateTexture(key, 32, 32);
  }

  private drawTile(g: Phaser.GameObjects.Graphics, key: string, base: number, walkable: boolean, accent?: number) {
    g.clear();
    g.fillStyle(base, 1);
    g.fillRect(0, 0, 32, 32);
    if (!walkable) {
      // 墙:砖纹
      g.fillStyle(0x000000, 0.25);
      g.fillRect(0, 15, 32, 2);
      g.fillRect(15, 0, 2, 15);
      g.fillRect(7, 17, 2, 15);
      g.fillRect(23, 17, 2, 15);
    } else if (accent) {
      g.fillStyle(accent, 0.3);
      for (let i = 0; i < 4; i++) {
        const x = (i * 7 + 3) % 30, y = (i * 11 + 5) % 30;
        g.fillRect(x, y, 3, 3);
      }
    }
    g.lineStyle(1, 0x000000, 0.2);
    g.strokeRect(0, 0, 32, 32);
    g.generateTexture(key, 32, 32);
  }

  private drawCircle(g: Phaser.GameObjects.Graphics, key: string, r: number, color: number) {
    g.clear();
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(r, r, r);
    g.fillStyle(color, 1);
    g.fillCircle(r, r, r - 1);
    g.generateTexture(key, r * 2, r * 2);
  }
}
