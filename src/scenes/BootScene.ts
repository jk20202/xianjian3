import Phaser from 'phaser';
import { currentEnvironment } from '../core/StorageAdapter';

/** Boot:初始化系统,生成程序化精美纹理(无外部图片依赖) */
export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  create() {
    this.makeTextures();
    this.add.text(10, 10, `环境: ${currentEnvironment()}`, { fontSize: '10px', color: '#555' });
    this.scene.start('PreloadScene');
  }

  /** 程序化生成所有精灵纹理 */
  private makeTextures() {
    const g = this.add.graphics();

    // ===== 角色(精细人形 32x40,有头身手脚发饰武器) =====
    this.drawHero(g, 'player_jingtian', { skin: 0xf2d0a0, hair: 0x2a2a2a, cloth: 0x4a9a5a, trim: 0xc9b072, accent: 0x7fd87f });
    this.drawHero(g, 'player_xuejian', { skin: 0xf8d8b0, hair: 0x3a2a1a, cloth: 0xd9a85a, trim: 0xff9a6a, accent: 0xffd97a });
    this.drawHero(g, 'player_longkui', { skin: 0xe8d0c0, hair: 0x1a1a3a, cloth: 0x7a5aaa, trim: 0xb07fff, accent: 0xc09fff });
    this.drawHero(g, 'player_zixuan', { skin: 0xf0d0b0, hair: 0x1a1a2a, cloth: 0x3a7aaa, trim: 0x5fb8ff, accent: 0x8fe0ff });
    this.drawHero(g, 'player_changqing', { skin: 0xe8c8a0, hair: 0x2a1a1a, cloth: 0xaa3a2a, trim: 0xff7a4d, accent: 0xff9a6a });

    // ===== 敌人 =====
    this.drawEnemyBeast(g, 'enemy_shu_yao', 0x4a7a3a, 0x2a4a1a);
    this.drawEnemyBeast(g, 'enemy_xiao_yao', 0x8a9a5a, 0x4a5a2a);
    this.drawEnemyBeast(g, 'enemy_yao_hua_wu_shi', 0xb8860b, 0x5a3a0a);
    this.drawEnemyBeast(g, 'enemy_pi_li_tang_di', 0xcc4422, 0x6a1a0a);
    this.drawEnemyBeast(g, 'enemy_shi_jiang', 0x886644, 0x3a2a14);
    this.drawEnemyBeast(g, 'enemy_huo_gui_bing', 0xcc3322, 0x661100);
    this.drawEnemyBeast(g, 'enemy_yan_jiang_yao', 0xff4422, 0x881100);
    this.drawEnemyBeast(g, 'enemy_xie_qi_yao', 0xaa3344, 0x551122);
    this.drawEnemyGhost(g, 'enemy_gui_hun', 0x9988bb, 0x4a3a6a);
    this.drawEnemyGhost(g, 'enemy_huang_quan_gui', 0x6a5a8a, 0x2a1a4a);
    this.drawEnemyGhost(g, 'enemy_jian_hun', 0xaaccbb, 0x4a6a5a);
    this.drawEnemyBug(g, 'enemy_bing_can', 0x66ccff, 0x2a5a8a);
    this.drawEnemyBug(g, 'enemy_huo_gui', 0xff5522, 0x881100);
    this.drawEnemyBug(g, 'enemy_gu_teng_jing', 0x4a7a3a, 0x1a3a1a);
    this.drawEnemyBug(g, 'enemy_bing_feng_ling', 0x88ddff, 0x2a5a8a);
    this.drawEnemyBug(g, 'enemy_hai_di_shou', 0x3399cc, 0x1a4a6a);
    this.drawEnemyBoss(g, 'enemy_mo_pi_feng', 0x4a8a3a, 0x1a3a1a, '魔');
    this.drawEnemyBoss(g, 'enemy_tian_yao_huang', 0x7744aa, 0x3a1a5a, '妖');
    this.drawEnemyBoss(g, 'enemy_huo_gui_wang', 0xff3311, 0x881100, '火');
    this.drawEnemyBoss(g, 'enemy_xie_jian_xian', 0xaa2233, 0x551122, '邪');
    this.drawEnemyBoss(g, 'enemy_chong_lou', 0x880022, 0x330011, '尊');

    // NPC
    this.drawHero(g, 'npc_generic', { skin: 0xe0c8a0, hair: 0x4a4a4a, cloth: 0x8a8a9a, trim: 0xc0c0c0, accent: 0xc9b072 });

    // ===== 瓦片 =====
    this.drawTileFloor(g);
    this.drawTileWall(g);
    this.drawTileGrass(g);
    this.drawTileShop(g);
    this.drawTileStory(g);
    this.drawTileWater(g);
    this.drawTilePath(g);

    // ===== 装饰物 =====
    this.drawTree(g, 'deco_tree', 0x2a5a2a, 0x3a2a14);
    this.drawTree(g, 'deco_tree_pine', 0x1a4a2a, 0x2a1a0a, true);
    this.drawMountain(g, 'deco_mountain', 0x3a4a5a);
    this.drawRock(g, 'deco_rock', 0x6a6a6a);
    this.drawBush(g, 'deco_bush', 0x2a6a3a);
    this.drawFlower(g, 'deco_flower', 0xff6699);
    this.drawLantern(g, 'deco_lantern', 0xff5522);
    this.drawWell(g, 'deco_well', 0x6a6a6a);
    this.drawTorch(g, 'deco_torch', 0xff7722);

    // ===== 投射物 =====
    this.drawProj(g, 'proj_wind', 7, 0x7fd87f);
    this.drawProj(g, 'proj_fire', 7, 0xff7a4d);
    this.drawProj(g, 'proj_thunder', 7, 0xb07fff);
    this.drawProj(g, 'proj_water', 7, 0x5fb8ff);
    this.drawProj(g, 'proj_earth', 7, 0xd9a85a);
    this.drawProj(g, 'proj_basic', 6, 0xffffff);
    this.drawCircle(g, 'spark', 4, 0xffffff);

    g.destroy();
  }

  // ==================== 精细人形角色(32x40) ====================
  private drawHero(g: Phaser.GameObjects.Graphics, key: string,
    c: { skin: number; hair: number; cloth: number; trim: number; accent: number }) {
    const W = 32, H = 40;
    g.clear();

    // -- 阴影(脚下椭圆) --
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(W / 2, H - 2, 20, 6);

    // -- 腿(裤) --
    g.fillStyle(0x2a2a38, 1);
    g.fillRect(W / 2 - 7, H - 14, 5, 12);
    g.fillRect(W / 2 + 2, H - 14, 5, 12);

    // -- 鞋 --
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(W / 2 - 7, H - 4, 5, 3);
    g.fillRect(W / 2 + 2, H - 4, 5, 3);

    // -- 身体(衣袍) --
    g.fillStyle(c.cloth, 1);
    g.fillRect(W / 2 - 8, H - 26, 16, 14);
    // 衣袍下摆(三角)
    g.fillTriangle(W / 2, H - 12, W / 2 - 9, H - 14, W / 2 - 7, H - 4);
    g.fillTriangle(W / 2, H - 12, W / 2 + 9, H - 14, W / 2 + 7, H - 4);

    // -- 腰带(配色) --
    g.fillStyle(c.trim, 1);
    g.fillRect(W / 2 - 8, H - 15, 16, 2);

    // -- 护肩 --
    g.fillStyle(c.trim, 1);
    g.fillRect(W / 2 - 10, H - 26, 4, 4);
    g.fillRect(W / 2 + 6, H - 26, 4, 4);

    // -- 手臂 --
    g.fillStyle(c.cloth, 1);
    g.fillRect(W / 2 - 10, H - 24, 3, 10);
    g.fillRect(W / 2 + 7, H - 24, 3, 10);

    // -- 手 --
    g.fillStyle(c.skin, 1);
    g.fillCircle(W / 2 - 8, H - 14, 2.5);
    g.fillCircle(W / 2 + 8, H - 14, 2.5);

    // -- 脖子 --
    g.fillStyle(c.skin, 1);
    g.fillRect(W / 2 - 2, H - 30, 4, 4);

    // -- 头(椭圆) --
    g.fillStyle(c.skin, 1);
    g.fillEllipse(W / 2, H - 34, 13, 15);

    // -- 头发(覆盖头顶及两侧) --
    const hairDark = Phaser.Display.Color.IntegerToColor(c.hair).darken(20).color;
    g.fillStyle(c.hair, 1);
    g.fillEllipse(W / 2, H - 37, 14, 11);
    g.fillRect(W / 2 - 7, H - 35, 14, 6);
    // 鬓发
    g.fillRect(W / 2 - 9, H - 33, 3, 6);
    g.fillRect(W / 2 + 6, H - 33, 3, 6);
    // 后发
    g.fillStyle(hairDark, 1);
    g.fillRect(W / 2 - 6, H - 30, 12, 3);

    // -- 发饰/头冠(配色点缀) --
    g.fillStyle(c.accent, 1);
    g.fillRect(W / 2 - 2, H - 40, 4, 4);
    g.fillStyle(c.trim, 0.7);
    g.fillRect(W / 2 - 3, H - 41, 6, 1);

    // -- 眼睛(白底+瞳孔) --
    g.fillStyle(0xffffff, 1);
    g.fillRect(W / 2 - 5, H - 35, 3, 3);
    g.fillRect(W / 2 + 2, H - 35, 3, 3);
    g.fillStyle(0x111111, 1);
    g.fillRect(W / 2 - 4, H - 34, 2, 2);
    g.fillRect(W / 2 + 3, H - 34, 2, 2);
    // 眉毛
    g.fillStyle(c.hair, 1);
    g.fillRect(W / 2 - 5, H - 37, 3, 1);
    g.fillRect(W / 2 + 2, H - 37, 3, 1);

    // -- 鼻子 --
    g.fillStyle(0xc09070, 1);
    g.fillRect(W / 2, H - 33, 1, 1);

    // -- 嘴 --
    g.fillStyle(0xcc6666, 1);
    g.fillRect(W / 2 - 1, H - 31, 3, 1);

    // -- 武器(背后佩剑,金色剑柄+银色剑身) --
    g.fillStyle(0x888888, 1);
    g.fillRect(W / 2 + 6, H - 40, 2, 18);
    g.fillStyle(0xcccccc, 0.6);
    g.fillRect(W / 2 + 7, H - 40, 1, 18);
    // 剑格
    g.fillStyle(0xc9b072, 1);
    g.fillRect(W / 2 + 4, H - 30, 6, 2);
    // 剑柄
    g.fillStyle(0x5a3a1a, 1);
    g.fillRect(W / 2 + 6, H - 22, 2, 4);

    g.generateTexture(key, W, H);
  }

  // ==================== 敌人绘制(保持不变,已足够好) ====================
  private drawEnemyBeast(g: Phaser.GameObjects.Graphics, key: string, body: number, dark: number) {
    g.clear();
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(16, 30, 22, 7);
    g.fillStyle(dark, 1);
    g.fillEllipse(16, 22, 22, 14);
    g.fillStyle(body, 1);
    g.fillEllipse(16, 20, 20, 12);
    g.fillStyle(body, 1);
    g.fillCircle(16, 12, 9);
    g.fillStyle(dark, 1);
    g.fillCircle(16, 13, 7);
    g.fillStyle(body, 1);
    g.fillTriangle(8, 8, 11, 4, 13, 9);
    g.fillTriangle(24, 8, 21, 4, 19, 9);
    g.fillStyle(0xff3333, 1);
    g.fillCircle(12, 12, 2);
    g.fillCircle(20, 12, 2);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(12, 11, 1);
    g.fillCircle(20, 11, 1);
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(13, 16, 14, 19, 15, 16);
    g.fillTriangle(19, 16, 18, 19, 17, 16);
    g.fillStyle(0xeeeeee, 1);
    g.fillRect(6, 26, 2, 3);
    g.fillRect(26, 26, 2, 3);
    g.generateTexture(key, 32, 32);
  }

  private drawEnemyGhost(g: Phaser.GameObjects.Graphics, key: string, body: number, dark: number) {
    g.clear();
    g.fillStyle(body, 0.2);
    g.fillCircle(16, 16, 16);
    g.fillStyle(body, 0.85);
    g.fillCircle(16, 12, 10);
    g.fillRect(6, 12, 20, 14);
    for (let i = 0; i < 4; i++) g.fillCircle(8 + i * 6, 26, 3);
    g.fillStyle(dark, 0.6);
    g.fillCircle(16, 14, 8);
    g.fillStyle(0x000000, 1);
    g.fillEllipse(12, 11, 3, 5);
    g.fillEllipse(20, 11, 3, 5);
    g.fillStyle(0x66ddff, 0.9);
    g.fillCircle(12, 11, 1.5);
    g.fillCircle(20, 11, 1.5);
    g.generateTexture(key, 32, 32);
  }

  private drawEnemyBug(g: Phaser.GameObjects.Graphics, key: string, body: number, dark: number) {
    g.clear();
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(16, 28, 24, 6);
    g.fillStyle(dark, 1);
    g.fillEllipse(16, 18, 24, 14);
    g.fillStyle(body, 1);
    g.fillEllipse(16, 17, 22, 12);
    g.fillStyle(dark, 0.5);
    g.fillRect(8, 14, 16, 1);
    g.fillRect(8, 20, 16, 1);
    g.fillStyle(dark, 1);
    for (let i = 0; i < 3; i++) {
      g.fillRect(6 + i * 4, 22, 1, 6);
      g.fillRect(25 - i * 4, 22, 1, 6);
    }
    g.fillStyle(body, 1);
    g.fillCircle(16, 13, 6);
    g.fillStyle(0xffff00, 1);
    g.fillCircle(13, 12, 1.5);
    g.fillCircle(19, 12, 1.5);
    g.fillStyle(0x000000, 1);
    g.fillCircle(13, 12, 0.8);
    g.fillCircle(19, 12, 0.8);
    g.fillStyle(dark, 1);
    g.fillRect(12, 6, 1, 4);
    g.fillRect(19, 6, 1, 4);
    g.generateTexture(key, 32, 32);
  }

  private drawEnemyBoss(g: Phaser.GameObjects.Graphics, key: string, body: number, dark: number, _mark: string) {
    g.clear();
    const W = 48, H = 48;
    g.fillStyle(body, 0.15);
    g.fillCircle(W / 2, H / 2, 24);
    g.fillStyle(body, 0.25);
    g.fillCircle(W / 2, H / 2, 20);
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(W / 2, H - 4, 32, 8);
    g.fillStyle(dark, 1);
    g.fillEllipse(W / 2, H / 2 + 4, 32, 28);
    g.fillStyle(body, 1);
    g.fillEllipse(W / 2, H / 2 + 2, 28, 24);
    g.fillStyle(body, 1);
    g.fillCircle(W / 2, H / 2 - 10, 12);
    g.fillStyle(dark, 0.7);
    g.fillCircle(W / 2, H / 2 - 9, 10);
    g.fillStyle(dark, 1);
    g.fillTriangle(W / 2 - 10, H / 2 - 18, W / 2 - 14, H / 2 - 26, W / 2 - 6, H / 2 - 20);
    g.fillTriangle(W / 2 + 10, H / 2 - 18, W / 2 + 14, H / 2 - 26, W / 2 + 6, H / 2 - 20);
    g.fillStyle(0xff0000, 1);
    g.fillCircle(W / 2 - 5, H / 2 - 11, 2.5);
    g.fillCircle(W / 2 + 5, H / 2 - 11, 2.5);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(W / 2 - 5, H / 2 - 12, 1);
    g.fillCircle(W / 2 + 5, H / 2 - 12, 1);
    g.fillStyle(0xffd97a, 0.9);
    g.fillCircle(W / 2, H / 2 + 6, 4);
    g.generateTexture(key, W, H);
  }

  // ==================== 瓦片 ====================
  private drawTileFloor(g: Phaser.GameObjects.Graphics) {
    g.clear();
    g.fillStyle(0x2a2a32, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x3a3a44, 1);
    g.fillRect(1, 1, 30, 14);
    g.fillRect(1, 17, 14, 14);
    g.fillRect(17, 17, 14, 14);
    g.fillStyle(0x1a1a22, 1);
    g.fillRect(0, 15, 32, 2);
    g.fillRect(15, 0, 2, 32);
    g.fillStyle(0x4a4a55, 0.5);
    for (let i = 0; i < 8; i++) g.fillRect(Math.random() * 30, Math.random() * 30, 1, 1);
    g.generateTexture('tile_floor', 32, 32);
  }

  private drawTilePath(g: Phaser.GameObjects.Graphics) {
    g.clear();
    g.fillStyle(0x4a3a2a, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x5a4a3a, 1);
    g.fillRect(2, 2, 28, 28);
    g.fillStyle(0x3a2a1a, 0.6);
    g.fillRect(0, 10, 32, 1);
    g.fillRect(0, 21, 32, 1);
    g.fillRect(10, 0, 1, 10);
    g.fillRect(21, 11, 1, 10);
    g.fillRect(15, 22, 1, 10);
    g.generateTexture('tile_path', 32, 32);
  }

  private drawTileWall(g: Phaser.GameObjects.Graphics) {
    g.clear();
    g.fillStyle(0x1a1a24, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x2a2a36, 1);
    g.fillRect(1, 1, 14, 9);
    g.fillRect(17, 1, 14, 9);
    g.fillRect(1, 12, 30, 9);
    g.fillRect(1, 23, 14, 8);
    g.fillRect(17, 23, 14, 8);
    g.fillStyle(0x3a3a48, 0.6);
    g.fillRect(1, 1, 14, 1);
    g.fillRect(17, 1, 14, 1);
    g.fillRect(1, 12, 30, 1);
    g.fillStyle(0x3a5a2a, 0.4);
    g.fillRect(3, 9, 4, 2);
    g.fillRect(20, 20, 5, 2);
    g.generateTexture('tile_wall', 32, 32);
  }

  private drawTileGrass(g: Phaser.GameObjects.Graphics) {
    g.clear();
    g.fillStyle(0x1a3a1a, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x2a5a2a, 1);
    for (let i = 0; i < 12; i++) {
      const x = Math.random() * 30, y = Math.random() * 30;
      g.fillRect(x, y, 2, 3);
    }
    g.fillStyle(0x3a7a3a, 0.8);
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * 30, y = Math.random() * 30;
      g.fillRect(x, y, 1, 2);
    }
    g.fillStyle(0xff6699, 0.7);
    g.fillCircle(8, 10, 1);
    g.fillCircle(24, 20, 1);
    g.fillStyle(0xffdd44, 0.7);
    g.fillCircle(18, 6, 1);
    g.generateTexture('tile_grass', 32, 32);
  }

  private drawTileShop(g: Phaser.GameObjects.Graphics) {
    g.clear();
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0xc9a06a, 0.4);
    g.fillRect(2, 2, 28, 28);
    g.fillStyle(0xffd97a, 1);
    g.fillCircle(16, 16, 6);
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(15, 12, 2, 8);
    g.generateTexture('tile_shop', 32, 32);
  }

  private drawTileStory(g: Phaser.GameObjects.Graphics) {
    g.clear();
    g.fillStyle(0x3a1a2a, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0xffd97a, 0.3);
    g.fillCircle(16, 16, 12);
    g.fillStyle(0xffd97a, 0.6);
    g.fillCircle(16, 16, 8);
    g.fillStyle(0xffe9a0, 1);
    g.fillCircle(16, 16, 4);
    g.generateTexture('tile_story', 32, 32);
  }

  private drawTileWater(g: Phaser.GameObjects.Graphics) {
    g.clear();
    g.fillStyle(0x1a3a5a, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x2a5a8a, 1);
    g.fillRect(1, 1, 30, 30);
    g.fillStyle(0x5fb8ff, 0.6);
    g.fillRect(4, 8, 10, 1);
    g.fillRect(18, 16, 8, 1);
    g.fillRect(6, 22, 12, 1);
    g.fillStyle(0x8fe0ff, 0.4);
    g.fillRect(8, 6, 6, 1);
    g.fillRect(20, 20, 6, 1);
    g.generateTexture('tile_water', 32, 32);
  }

  // ==================== 装饰物 ====================
  private drawTree(g: Phaser.GameObjects.Graphics, key: string, leaf: number, trunk: number, pine = false) {
    g.clear();
    const W = 40, H = 56;
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(W / 2, H - 2, 24, 6);
    g.fillStyle(trunk, 1);
    g.fillRect(W / 2 - 3, H - 18, 6, 16);
    g.fillStyle(0x000000, 0.2);
    g.fillRect(W / 2 - 3, H - 18, 2, 16);
    if (pine) {
      g.fillStyle(leaf, 1);
      g.fillTriangle(W / 2, 4, 6, 28, W - 6, 28);
      g.fillTriangle(W / 2, 16, 8, 38, W - 8, 38);
      g.fillStyle(0x000000, 0.15);
      g.fillTriangle(W / 2, 4, 6, 28, W / 2, 28);
    } else {
      g.fillStyle(leaf, 1);
      g.fillCircle(W / 2, 20, 16);
      g.fillCircle(W / 2 - 8, 26, 10);
      g.fillCircle(W / 2 + 8, 26, 10);
      g.fillStyle(0xffffff, 0.15);
      g.fillCircle(W / 2 - 4, 16, 6);
    }
    g.generateTexture(key, W, H);
  }

  private drawMountain(g: Phaser.GameObjects.Graphics, key: string, color: number) {
    g.clear();
    const W = 80, H = 60;
    g.fillStyle(color, 1);
    g.fillTriangle(W / 2, 4, 4, H - 4, W - 4, H - 4);
    g.fillStyle(0xe8e8f0, 1);
    g.fillTriangle(W / 2, 4, W / 2 - 10, 20, W / 2 + 10, 20);
    g.fillStyle(0x000000, 0.25);
    g.fillTriangle(W / 2, 4, W / 2, H - 4, W / 2 + 24, H - 4);
    g.generateTexture(key, W, H);
  }

  private drawRock(g: Phaser.GameObjects.Graphics, key: string, color: number) {
    g.clear();
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(16, 30, 24, 6);
    g.fillStyle(color, 1);
    g.fillEllipse(16, 22, 28, 18);
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(22, 24, 14, 10);
    g.fillStyle(0xffffff, 0.15);
    g.fillEllipse(10, 16, 10, 6);
    g.generateTexture(key, 32, 32);
  }

  private drawBush(g: Phaser.GameObjects.Graphics, key: string, color: number) {
    g.clear();
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(16, 30, 24, 5);
    g.fillStyle(color, 1);
    g.fillCircle(10, 22, 8);
    g.fillCircle(22, 22, 8);
    g.fillCircle(16, 18, 9);
    g.fillStyle(0xffffff, 0.12);
    g.fillCircle(12, 16, 4);
    g.generateTexture(key, 32, 32);
  }

  private drawFlower(g: Phaser.GameObjects.Graphics, key: string, color: number) {
    g.clear();
    g.fillStyle(0x2a6a2a, 1);
    g.fillRect(15, 16, 2, 16);
    g.fillEllipse(10, 24, 8, 4);
    g.fillEllipse(22, 20, 8, 4);
    g.fillStyle(color, 1);
    g.fillCircle(12, 12, 4);
    g.fillCircle(20, 12, 4);
    g.fillCircle(16, 8, 4);
    g.fillCircle(16, 16, 4);
    g.fillStyle(0xffdd44, 1);
    g.fillCircle(16, 12, 2);
    g.generateTexture(key, 32, 32);
  }

  private drawLantern(g: Phaser.GameObjects.Graphics, key: string, color: number) {
    g.clear();
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(15, 0, 2, 8);
    g.fillStyle(color, 1);
    g.fillEllipse(16, 18, 14, 16);
    g.fillStyle(0xffe9a0, 0.5);
    g.fillEllipse(16, 18, 10, 12);
    g.fillStyle(0x2a1a1a, 1);
    g.fillRect(10, 10, 12, 3);
    g.fillStyle(0xffd97a, 1);
    g.fillRect(15, 26, 2, 4);
    g.generateTexture(key, 32, 32);
  }

  private drawWell(g: Phaser.GameObjects.Graphics, key: string, color: number) {
    g.clear();
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(16, 30, 24, 6);
    g.fillStyle(color, 1);
    g.fillEllipse(16, 22, 24, 14);
    g.fillStyle(0x1a3a5a, 1);
    g.fillEllipse(16, 20, 16, 8);
    g.fillStyle(0x5fb8ff, 0.5);
    g.fillEllipse(16, 19, 12, 5);
    g.fillStyle(0x5a3a1a, 1);
    g.fillRect(4, 4, 2, 18);
    g.fillRect(26, 4, 2, 18);
    g.fillRect(2, 4, 28, 2);
    g.generateTexture(key, 32, 32);
  }

  private drawTorch(g: Phaser.GameObjects.Graphics, key: string, color: number) {
    g.clear();
    g.fillStyle(0x3a2a1a, 1);
    g.fillRect(15, 12, 2, 20);
    g.fillStyle(color, 1);
    g.fillEllipse(16, 8, 8, 10);
    g.fillStyle(0xffe9a0, 0.8);
    g.fillEllipse(16, 6, 5, 6);
    g.fillStyle(0xffffff, 0.6);
    g.fillEllipse(16, 4, 2, 3);
    g.generateTexture(key, 32, 32);
  }

  // ==================== 投射物 ====================
  private drawProj(g: Phaser.GameObjects.Graphics, key: string, r: number, color: number) {
    g.clear();
    g.fillStyle(color, 0.3);
    g.fillCircle(r, r, r + 2);
    g.fillStyle(color, 1);
    g.fillCircle(r, r, r);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(r - 1, r - 1, r / 2);
    g.generateTexture(key, r * 2 + 4, r * 2 + 4);
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