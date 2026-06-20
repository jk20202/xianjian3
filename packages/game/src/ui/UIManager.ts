// ui/UIManager.ts
// UI 管理：标题界面、战斗 HUD、菜单、对话框、商店界面
// 全部用 PixiJS 绘制几何占位（圆角矩形 + 文字）

import type { EngineApi } from '../core/engine';
import type { InputState } from '../core/input';
import { dialogueManager } from '../dialogue/DialogueManager';
import { shopManager } from '../shop/ShopManager';
import { questManager } from '../quest/QuestManager';
import { saveManager } from '../save/SaveManager';
import type { SceneManager } from '../scene/SceneManager';
import { Graphics, Container, Text } from 'pixi.js';

type UIScreen = 'title' | 'game' | 'menu' | 'dialogue' | 'shop' | 'save' | 'gameover';

export class UIManager {
  private api: EngineApi;
  private scene: SceneManager;
  private currentScreen: UIScreen = 'title';
  private uiContainer: Container;
  // HUD 元素
  private hpBar: Graphics | null = null;
  private mpBar: Graphics | null = null;
  private skillBar: Graphics | null = null;
  private questTracker: Text | null = null;
  private dialogueBox: Container | null = null;
  private dialogueText: Text | null = null;
  private dialogueChoices: Container | null = null;
  private shopContainer: Container | null = null;
  private menuContainer: Container | null = null;
  private titleContainer: Container | null = null;
  private messageText: Text | null = null;
  private messageTimer = 0;

  constructor(api: EngineApi, scene: SceneManager) {
    this.api = api;
    this.scene = scene;
    this.uiContainer = new Container();
    this.uiContainer.zIndex = 1000;
    this.api.ui.addChild(this.uiContainer);
    this.showTitle();
  }

  /** 显示标题界面 */
  showTitle(): void {
    this.clearUI();
    this.currentScreen = 'title';
    const container = new Container();

    // 背景
    const bg = new Graphics();
    bg.rect(0, 0, this.api.screen.width, this.api.screen.height).fill(0x0a0a12);

    // 标题
    const title = new Text({
      text: '仙剑奇侠传·叁',
      style: { fontSize: 48, fill: 0xffcc44, fontWeight: 'bold' },
    });
    title.anchor.set(0.5);
    title.x = this.api.screen.width / 2;
    title.y = this.api.screen.height * 0.3;

    const subtitle = new Text({
      text: 'PAL3-LITE ARPG',
      style: { fontSize: 16, fill: 0x888888 },
    });
    subtitle.anchor.set(0.5);
    subtitle.x = this.api.screen.width / 2;
    subtitle.y = this.api.screen.height * 0.3 + 50;

    // 菜单选项
    const items = ['新游戏', '继续游戏', '关于'];
    items.forEach((item, i) => {
      const txt = new Text({
        text: item,
        style: { fontSize: 24, fill: 0xffffff },
      });
      txt.anchor.set(0.5);
      txt.x = this.api.screen.width / 2;
      txt.y = this.api.screen.height * 0.55 + i * 40;
      txt.eventMode = 'static';
      txt.cursor = 'pointer';
      txt.on('pointerdown', () => this.handleTitleChoice(i));
      container.addChild(txt);
    });

    // 操作说明
    const help = new Text({
      text: 'WASD 移动 | J 平A | K/L/U/I/O 技能 | Space 翻滚 | E 交互 | Tab 菜单',
      style: { fontSize: 12, fill: 0x666666 },
    });
    help.anchor.set(0.5);
    help.x = this.api.screen.width / 2;
    help.y = this.api.screen.height - 30;

    container.addChild(bg, title, subtitle, help);
    this.uiContainer.addChild(container);
    this.titleContainer = container;
  }

  /** 处理标题选择 */
  private handleTitleChoice(index: number): void {
    switch (index) {
      case 0: // 新游戏
        this.scene.newGame();
        this.showGame();
        break;
      case 1: // 继续游戏
        this.showLoadScreen();
        break;
      case 2: // 关于
        this.showMessage('仙剑奇侠传3 风格 ARPG 小游戏 | MVP 版本');
        break;
    }
  }

  /** 显示读档界面 */
  private async showLoadScreen(): Promise<void> {
    const slots = await saveManager.listSlots();
    if (slots.length === 0) {
      this.showMessage('没有存档');
      return;
    }
    // 加载第一个存档
    const state = await saveManager.load('auto');
    if (state) {
      this.scene.loadFromSave(state);
      this.showGame();
    } else {
      this.showMessage('加载失败');
    }
  }

  /** 显示游戏 HUD */
  showGame(): void {
    this.clearUI();
    this.currentScreen = 'game';

    // HP/MP 条（左上）
    this.hpBar = new Graphics();
    this.mpBar = new Graphics();
    this.uiContainer.addChild(this.hpBar, this.mpBar);

    // 技能栏（底部）
    this.skillBar = new Graphics();
    this.uiContainer.addChild(this.skillBar);

    // 任务追踪（右侧）
    this.questTracker = new Text({
      text: '',
      style: { fontSize: 12, fill: 0xffcc44 },
    });
    this.questTracker.x = this.api.screen.width - 200;
    this.questTracker.y = 10;
    this.uiContainer.addChild(this.questTracker);

    // 消息文本（中央）
    this.messageText = new Text({
      text: '',
      style: { fontSize: 18, fill: 0xffffff },
    });
    this.messageText.anchor.set(0.5);
    this.messageText.x = this.api.screen.width / 2;
    this.messageText.y = this.api.screen.height / 2;
    this.messageText.visible = false;
    this.uiContainer.addChild(this.messageText);

    this.updateHUD();
  }

  /** 更新 HUD */
  updateHUD(): void {
    if (this.currentScreen !== 'game') return;
    const player = this.scene.getPlayer();
    if (!player) return;

    // HP 条
    if (this.hpBar) {
      this.hpBar.clear();
      const x = 10, y = 10, w = 200, h = 20;
      this.hpBar.rect(x, y, w, h).fill(0x330000);
      this.hpBar.rect(x, y, w * (player.hp / player.maxHp), h).fill(0xff0000);
      this.hpBar.rect(x, y, w, h).stroke({ width: 1, color: 0xffffff });
    }

    // MP 条
    if (this.mpBar) {
      this.mpBar.clear();
      const x = 10, y = 35, w = 200, h = 16;
      this.mpBar.rect(x, y, w, h).fill(0x000033);
      this.mpBar.rect(x, y, w * (player.mp / player.maxMp), h).fill(0x0066ff);
      this.mpBar.rect(x, y, w, h).stroke({ width: 1, color: 0xffffff });
    }

    // HP/MP 文字
    const hpText = new Text({
      text: `HP ${Math.ceil(player.hp)}/${player.maxHp}  MP ${Math.ceil(player.mp)}/${player.maxMp}  Lv.${player.level}`,
      style: { fontSize: 10, fill: 0xffffff },
    });
    hpText.x = 12;
    hpText.y = 55;
    // 移除旧的文字并添加新的
    if (this.uiContainer.children.length > 5) {
      const old = this.uiContainer.children[5];
      if (old instanceof Text) {
        this.uiContainer.removeChild(old);
        old.destroy();
      }
    }
    this.uiContainer.addChild(hpText);

    // 技能栏
    if (this.skillBar) {
      this.skillBar.clear();
      const skillCount = Math.min(player.skills.length, 5);
      const slotSize = 44;
      const startX = this.api.screen.width / 2 - (skillCount * (slotSize + 4)) / 2;
      const y = this.api.screen.height - slotSize - 10;
      const skillKeys = ['K', 'L', 'U', 'I', 'O'];
      for (let i = 0; i < skillCount; i++) {
        const x = startX + i * (slotSize + 4);
        this.skillBar.rect(x, y, slotSize, slotSize).fill(0x222233);
        this.skillBar.rect(x, y, slotSize, slotSize).stroke({ width: 1, color: 0x666688 });
        // 冷却覆盖
        const cd = player.skillCooldowns.get(player.skills[i]);
        if (cd && cd > 0) {
          const maxCd = 5000; // 估算
          const cdRatio = Math.min(1, cd / maxCd);
          this.skillBar.rect(x, y, slotSize, slotSize * cdRatio).fill({ color: 0x000000, alpha: 0.6 });
        }
        // 按键标签
        const keyText = new Text({
          text: skillKeys[i],
          style: { fontSize: 10, fill: 0xffcc44 },
        });
        keyText.x = x + 2;
        keyText.y = y + 2;
        this.uiContainer.addChild(keyText);
      }
    }

    // 任务追踪
    if (this.questTracker) {
      const tracked = questManager.getTrackedQuests();
      if (tracked.length > 0) {
        let text = '【任务追踪】\n';
        for (const t of tracked) {
          text += `${t.quest.title}\n`;
          for (const obj of t.objectives) {
            text += `  ${obj.desc} ${obj.current}/${obj.target}${obj.done ? ' ✓' : ''}\n`;
          }
        }
        this.questTracker.text = text;
      } else {
        this.questTracker.text = '暂无活跃任务';
      }
    }

    // 消息计时
    if (this.messageTimer > 0) {
      this.messageTimer--;
      if (this.messageTimer <= 0 && this.messageText) {
        this.messageText.visible = false;
      }
    }
  }

  /** 显示对话界面 */
  showDialogue(): void {
    if (this.dialogueBox) return;
    const node = dialogueManager.current;
    if (!node) return;

    const container = new Container();
    const boxW = this.api.screen.width - 100;
    const boxH = 150;
    const boxX = 50;
    const boxY = this.api.screen.height - boxH - 20;

    // 对话框背景
    const bg = new Graphics();
    bg.roundRect(boxX, boxY, boxW, boxH, 8).fill({ color: 0x000000, alpha: 0.85 });
    bg.roundRect(boxX, boxY, boxW, boxH, 8).stroke({ width: 2, color: 0xffcc44 });
    container.addChild(bg);

    // 说话者名字
    const speaker = new Text({
      text: node.speaker,
      style: { fontSize: 16, fill: 0xffcc44, fontWeight: 'bold' },
    });
    speaker.x = boxX + 20;
    speaker.y = boxY + 10;
    container.addChild(speaker);

    // 对话文本（打字机效果）
    const fullText = node.text;
    const visibleChars = Math.floor(fullText.length * dialogueManager.typewriterProgress);
    const displayText = fullText.substring(0, visibleChars);
    const text = new Text({
      text: displayText,
      style: { fontSize: 14, fill: 0xffffff, wordWrap: true, wordWrapWidth: boxW - 40 },
    });
    text.x = boxX + 20;
    text.y = boxY + 40;
    container.addChild(text);
    this.dialogueText = text;

    // 选项
    if (node.choices && dialogueManager.typewriterProgress >= 1) {
      const choicesContainer = new Container();
      node.choices.forEach((choice, i) => {
        const choiceText = new Text({
          text: `${i + 1}. ${choice.text}`,
          style: { fontSize: 14, fill: 0x88ccff },
        });
        choiceText.x = boxX + boxW - 200;
        choiceText.y = boxY + 40 + i * 25;
        choiceText.eventMode = 'static';
        choiceText.cursor = 'pointer';
        choiceText.on('pointerdown', () => {
          dialogueManager.choose(i);
          this.hideDialogue();
        });
        choicesContainer.addChild(choiceText);
      });
      container.addChild(choicesContainer);
      this.dialogueChoices = choicesContainer;
    }

    // 提示
    if (!node.choices && dialogueManager.typewriterProgress >= 1) {
      const hint = new Text({
        text: '按 E/空格 继续',
        style: { fontSize: 10, fill: 0x888888 },
      });
      hint.x = boxX + boxW - 100;
      hint.y = boxY + boxH - 20;
      container.addChild(hint);
    }

    this.uiContainer.addChild(container);
    this.dialogueBox = container;
  }

  /** 更新对话显示 */
  updateDialogue(): void {
    if (!dialogueManager.isActive) {
      this.hideDialogue();
      return;
    }
    // 重新渲染对话
    this.hideDialogue();
    this.showDialogue();
  }

  /** 隐藏对话 */
  hideDialogue(): void {
    if (this.dialogueBox) {
      this.uiContainer.removeChild(this.dialogueBox);
      this.dialogueBox.destroy();
      this.dialogueBox = null;
      this.dialogueText = null;
      this.dialogueChoices = null;
    }
  }

  /** 显示商店界面 */
  showShop(): void {
    if (!shopManager.isActive) return;
    this.hideShop();
    const container = new Container();
    const items = shopManager.getShopItems();
    const sellable = shopManager.getSellableItems();

    const boxW = 600;
    const boxH = 400;
    const boxX = (this.api.screen.width - boxW) / 2;
    const boxY = (this.api.screen.height - boxH) / 2;

    const bg = new Graphics();
    bg.roundRect(boxX, boxY, boxW, boxH, 8).fill({ color: 0x000000, alpha: 0.9 });
    bg.roundRect(boxX, boxY, boxW, boxH, 8).stroke({ width: 2, color: 0xffcc44 });
    container.addChild(bg);

    // 标题
    const title = new Text({
      text: shopManager.currentShop?.name ?? '商店',
      style: { fontSize: 20, fill: 0xffcc44, fontWeight: 'bold' },
    });
    title.x = boxX + 20;
    title.y = boxY + 10;
    container.addChild(title);

    // 金钱
    const goldText = new Text({
      text: `金钱: ${shopManager.gold}`,
      style: { fontSize: 14, fill: 0xffcc44 },
    });
    goldText.x = boxX + boxW - 120;
    goldText.y = boxY + 15;
    container.addChild(goldText);

    // 购买列表
    const buyTitle = new Text({
      text: '── 购买 ──',
      style: { fontSize: 14, fill: 0x88ccff },
    });
    buyTitle.x = boxX + 20;
    buyTitle.y = boxY + 50;
    container.addChild(buyTitle);

    items.forEach((entry, i) => {
      const itemText = new Text({
        text: `${entry.item.name}  ${entry.price}金  ${entry.item.description}`,
        style: { fontSize: 12, fill: 0xffffff },
      });
      itemText.x = boxX + 20;
      itemText.y = boxY + 75 + i * 20;
      itemText.eventMode = 'static';
      itemText.cursor = 'pointer';
      itemText.on('pointerdown', () => {
        const result = shopManager.buy(entry.item.id);
        if (result.ok) {
          this.showMessage(`购买了 ${entry.item.name}`);
        } else {
          this.showMessage(result.reason ?? '购买失败');
        }
        this.showShop(); // 刷新
      });
      container.addChild(itemText);
    });

    // 出售列表
    const sellTitle = new Text({
      text: '── 出售 ──',
      style: { fontSize: 14, fill: 0x88ccff },
    });
    sellTitle.x = boxX + 20;
    sellTitle.y = boxY + 200;
    container.addChild(sellTitle);

    sellable.forEach((entry, i) => {
      const itemText = new Text({
        text: `${entry.item.name} x${entry.count}  ${entry.sellPrice}金`,
        style: { fontSize: 12, fill: 0xcccc88 },
      });
      itemText.x = boxX + 20;
      itemText.y = boxY + 225 + i * 20;
      itemText.eventMode = 'static';
      itemText.cursor = 'pointer';
      itemText.on('pointerdown', () => {
        const result = shopManager.sell(entry.item.id);
        if (result.ok) {
          this.showMessage(`出售了 ${entry.item.name}`);
        } else {
          this.showMessage(result.reason ?? '出售失败');
        }
        this.showShop();
      });
      container.addChild(itemText);
    });

    // 关闭按钮
    const closeBtn = new Text({
      text: '[ 关闭 ]',
      style: { fontSize: 14, fill: 0xff6666 },
    });
    closeBtn.x = boxX + boxW - 80;
    closeBtn.y = boxY + boxH - 30;
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointerdown', () => {
      shopManager.close();
      this.hideShop();
    });
    container.addChild(closeBtn);

    this.uiContainer.addChild(container);
    this.shopContainer = container;
  }

  /** 隐藏商店 */
  hideShop(): void {
    if (this.shopContainer) {
      this.uiContainer.removeChild(this.shopContainer);
      this.shopContainer.destroy();
      this.shopContainer = null;
    }
  }

  /** 显示菜单 */
  showMenu(): void {
    if (this.menuContainer) return;
    const container = new Container();
    const boxW = 400;
    const boxH = 300;
    const boxX = (this.api.screen.width - boxW) / 2;
    const boxY = (this.api.screen.height - boxH) / 2;

    const bg = new Graphics();
    bg.roundRect(boxX, boxY, boxW, boxH, 8).fill({ color: 0x000000, alpha: 0.9 });
    bg.roundRect(boxX, boxY, boxW, boxH, 8).stroke({ width: 2, color: 0xffcc44 });
    container.addChild(bg);

    const title = new Text({
      text: '菜单',
      style: { fontSize: 20, fill: 0xffcc44, fontWeight: 'bold' },
    });
    title.x = boxX + 20;
    title.y = boxY + 10;
    container.addChild(title);

    const items = ['继续游戏', '存档', '读档', '返回标题'];
    items.forEach((item, i) => {
      const txt = new Text({
        text: item,
        style: { fontSize: 16, fill: 0xffffff },
      });
      txt.x = boxX + 20;
      txt.y = boxY + 50 + i * 30;
      txt.eventMode = 'static';
      txt.cursor = 'pointer';
      txt.on('pointerdown', () => this.handleMenuChoice(i));
      container.addChild(txt);
    });

    this.uiContainer.addChild(container);
    this.menuContainer = container;
  }

  /** 处理菜单选择 */
  private handleMenuChoice(index: number): void {
    switch (index) {
      case 0: // 继续
        this.hideMenu();
        break;
      case 1: // 存档
        this.scene.autoSave();
        this.showMessage('已存档');
        break;
      case 2: // 读档
        this.showLoadScreen();
        break;
      case 3: // 返回标题
        this.hideMenu();
        this.showTitle();
        break;
    }
  }

  /** 隐藏菜单 */
  hideMenu(): void {
    if (this.menuContainer) {
      this.uiContainer.removeChild(this.menuContainer);
      this.menuContainer.destroy();
      this.menuContainer = null;
    }
  }

  /** 显示消息 */
  showMessage(msg: string): void {
    if (this.messageText) {
      this.messageText.text = msg;
      this.messageText.visible = true;
      this.messageTimer = 120; // 约 2 秒
    }
  }

  /** 清空 UI */
  private clearUI(): void {
    this.uiContainer.removeChildren();
    this.hpBar = null;
    this.mpBar = null;
    this.skillBar = null;
    this.questTracker = null;
    this.dialogueBox = null;
    this.dialogueText = null;
    this.dialogueChoices = null;
    this.shopContainer = null;
    this.menuContainer = null;
    this.titleContainer = null;
    this.messageText = null;
  }

  /** 每帧更新 */
  update(): void {
    switch (this.currentScreen) {
      case 'game':
        this.updateHUD();
        // 对话界面
        if (dialogueManager.isActive) {
          this.updateDialogue();
        } else {
          this.hideDialogue();
        }
        // 商店界面
        if (shopManager.isActive) {
          if (!this.shopContainer) this.showShop();
        } else {
          this.hideShop();
        }
        break;
    }
  }

  /** 获取当前屏幕 */
  get screen(): UIScreen {
    return this.currentScreen;
  }

  /** 设置当前屏幕 */
  setScreen(screen: UIScreen): void {
    this.currentScreen = screen;
  }

  /** 菜单是否打开 */
  get isMenuOpen(): boolean {
    return this.menuContainer !== null;
  }
}
