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
import type { MobileControls } from './MobileControls';
import { Graphics, Container, Text } from 'pixi.js';
import { RARITY_COLOR, ITEM_MAP } from '../data/items';
import { ELEMENT_COLOR } from '../data/element';
import { CHARACTER_MAP } from '../data/characters';
import { statsAtLevel } from '../data/stats';

type UIScreen = 'title' | 'game' | 'menu' | 'dialogue' | 'shop' | 'save' | 'gameover';

/** 游戏版本号 */
const GAME_VERSION = 'v0.1.0';

/** 商店条目引用（用于刷新） */
interface ShopEntry {
  itemId: string;
  text: Text;
}

export class UIManager {
  private api: EngineApi;
  private scene: SceneManager;
  private currentScreen: UIScreen = 'title';
  private uiContainer: Container;

  // HUD 元素（持久化，避免每帧创建）
  private hpBar: Graphics | null = null;
  private mpBar: Graphics | null = null;
  private hpText: Text | null = null;
  private skillBar: Graphics | null = null;
  private skillKeyTexts: Text[] = [];
  private questTracker: Text | null = null;
  private hudBg: Graphics | null = null;
  private portrait: Graphics | null = null;
  private minimap: Graphics | null = null;
  private goldText: Text | null = null;
  private interactHint: Text | null = null;

  // 对话框元素
  private dialogueBox: Container | null = null;
  private dialogueText: Text | null = null;
  private dialogueChoices: Container | null = null;
  private dialogueHint: Text | null = null;
  private lastDialogueNodeId: string | null = null;

  // 商店元素
  private shopContainer: Container | null = null;
  private shopGoldText: Text | null = null;
  private shopFeedback: Text | null = null;
  private shopFeedbackTimer = 0;
  private shopBuyEntries: ShopEntry[] = [];
  private shopSellEntries: ShopEntry[] = [];

  // 菜单元素
  private menuContainer: Container | null = null;

  // 标题元素
  private titleContainer: Container | null = null;

  // 消息
  private messageText: Text | null = null;
  private messageTimer = 0;

  // 通用计时器
  private blinkTimer = 0;

  // 手机控制引用
  private mobileControls: MobileControls | null = null;

  constructor(api: EngineApi, scene: SceneManager) {
    this.api = api;
    this.scene = scene;
    this.uiContainer = new Container();
    this.uiContainer.zIndex = 1000;
    // uiContainer 设为 static 以接收事件，子元素按需设置
    this.uiContainer.eventMode = 'static';
    this.api.ui.addChild(this.uiContainer);
    this.showTitle();
  }

  /** 设置手机控制引用 */
  setMobileControls(mobile: MobileControls): void {
    this.mobileControls = mobile;
  }

  /** 显示标题界面 */
  showTitle(): void {
    this.clearUI();
    this.currentScreen = 'title';
    // 标题界面隐藏手机控制
    this.mobileControls?.hide();
    const container = new Container();
    const W = this.api.screen.width;
    const H = this.api.screen.height;

    // 渐变背景（多层矩形叠加不同透明度）
    const bg = new Graphics();
    bg.eventMode = 'none';
    const layers = 24;
    for (let i = 0; i < layers; i++) {
      const alpha = 0.03 + (i / layers) * 0.07;
      bg.rect(0, (H / layers) * i, W, H / layers + 1).fill({ color: 0x1a1a3a, alpha });
    }
    container.addChild(bg);

    // 标题装饰边框
    const border = new Graphics();
    border.eventMode = 'none';
    const bw = 440, bh = 110;
    const bx = W / 2 - bw / 2, by = H * 0.3 - 35;
    border.roundRect(bx, by, bw, bh, 12).stroke({ width: 2, color: 0xffcc44 });
    border.roundRect(bx + 6, by + 6, bw - 12, bh - 12, 8).stroke({ width: 1, color: 0xffcc44, alpha: 0.4 });
    container.addChild(border);

    // 标题
    const title = new Text({
      text: '仙剑奇侠传·叁',
      style: { fontSize: 48, fill: 0xffcc44, fontWeight: 'bold' },
    });
    title.anchor.set(0.5);
    title.x = W / 2;
    title.y = H * 0.3 + 10;
    container.addChild(title);

    const subtitle = new Text({
      text: 'PAL3-LITE ARPG',
      style: { fontSize: 16, fill: 0x888888 },
    });
    subtitle.anchor.set(0.5);
    subtitle.x = W / 2;
    subtitle.y = H * 0.3 + 52;
    container.addChild(subtitle);

    // 菜单选项（带 hover 效果）
    const items = ['新游戏', '继续游戏', '关于'];
    items.forEach((item, i) => {
      const txt = new Text({
        text: item,
        style: { fontSize: 24, fill: 0xffffff },
      });
      txt.anchor.set(0.5);
      txt.x = W / 2;
      txt.y = H * 0.55 + i * 40;
      txt.eventMode = 'static';
      txt.cursor = 'pointer';
      txt.on('pointerdown', () => this.handleTitleChoice(i));
      // hover 效果：移入变色，移出恢复
      txt.on('pointerover', () => { txt.style.fill = 0xffcc44; });
      txt.on('pointerout', () => { txt.style.fill = 0xffffff; });
      container.addChild(txt);
    });

    // 操作说明
    const help = new Text({
      text: 'WASD 移动 | J 平A | K/L/U/I/O 技能 | Space 翻滚 | E 交互 | Tab 菜单',
      style: { fontSize: 12, fill: 0x666666 },
    });
    help.anchor.set(0.5);
    help.x = W / 2;
    help.y = H - 50;
    container.addChild(help);

    // 版本号
    const version = new Text({
      text: GAME_VERSION,
      style: { fontSize: 10, fill: 0x444444 },
    });
    version.anchor.set(0.5);
    version.x = W / 2;
    version.y = H - 20;
    container.addChild(version);

    // 消息文本（中央，用于"关于"等提示）
    this.messageText = new Text({
      text: '',
      style: { fontSize: 18, fill: 0xffffff },
    });
    this.messageText.anchor.set(0.5);
    this.messageText.x = W / 2;
    this.messageText.y = H / 2;
    this.messageText.visible = false;
    container.addChild(this.messageText);

    this.uiContainer.addChild(container);
    this.titleContainer = container;
  }

  /** 处理标题界面键盘输入 */
  handleTitleInput(state: InputState): void {
    if (this.currentScreen !== 'title') return;
    // Enter/Space/E 或 J 键开始新游戏
    if (state.confirm || state.attackPressed) {
      this.scene.newGame();
      this.showGame();
    }
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

    // HUD 半透明背景
    this.hudBg = new Graphics();
    this.hudBg.eventMode = 'none';
    this.uiContainer.addChild(this.hudBg);

    // HP/MP 条
    this.hpBar = new Graphics();
    this.mpBar = new Graphics();
    this.uiContainer.addChild(this.hpBar, this.mpBar);

    // HP/MP 文字（持久化，仅更新 .text）
    this.hpText = new Text({
      text: '',
      style: { fontSize: 10, fill: 0xffffff },
    });
    this.hpText.x = 12;
    this.hpText.y = 55;
    this.uiContainer.addChild(this.hpText);

    // 角色头像占位（元素色圆形）
    this.portrait = new Graphics();
    this.portrait.eventMode = 'none';
    this.uiContainer.addChild(this.portrait);

    // 技能栏
    this.skillBar = new Graphics();
    this.uiContainer.addChild(this.skillBar);

    // 技能按键标签（持久化，最多 5 个）
    this.skillKeyTexts = [];
    for (let i = 0; i < 5; i++) {
      const txt = new Text({
        text: '',
        style: { fontSize: 10, fill: 0xffcc44 },
      });
      this.skillKeyTexts.push(txt);
      this.uiContainer.addChild(txt);
    }

    // 金钱显示（持久化）
    this.goldText = new Text({
      text: '',
      style: { fontSize: 12, fill: 0xffcc44 },
    });
    this.goldText.x = 12;
    this.goldText.y = 75;
    this.uiContainer.addChild(this.goldText);

    // 交互提示（持久化）
    this.interactHint = new Text({
      text: 'E 交互',
      style: { fontSize: 12, fill: 0xffff44 },
    });
    this.interactHint.anchor.set(0.5);
    this.interactHint.x = this.api.screen.width / 2;
    this.interactHint.y = this.api.screen.height - 80;
    this.interactHint.visible = false;
    this.uiContainer.addChild(this.interactHint);

    // 小地图占位
    this.minimap = new Graphics();
    this.minimap.eventMode = 'none';
    this.uiContainer.addChild(this.minimap);

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

    // 游戏界面显示手机控制
    this.mobileControls?.show();

    this.updateHUD();
  }

  /** 更新 HUD */
  updateHUD(): void {
    if (this.currentScreen !== 'game') return;
    const player = this.scene.getPlayer();
    if (!player) return;

    // HUD 半透明背景
    if (this.hudBg) {
      this.hudBg.clear();
      this.hudBg.roundRect(5, 5, 230, 85, 6).fill({ color: 0x000000, alpha: 0.5 });
    }

    // 角色头像（元素色圆形）
    if (this.portrait) {
      this.portrait.clear();
      const px = 22, py = 32, pr = 14;
      const elemColor = ELEMENT_COLOR[player.element] ?? 0xffffff;
      this.portrait.circle(px, py, pr).fill(elemColor);
      this.portrait.circle(px, py, pr).stroke({ width: 2, color: 0xffffff });
    }

    // HP 条
    if (this.hpBar) {
      this.hpBar.clear();
      const x = 44, y = 16, w = 180, h = 14;
      this.hpBar.rect(x, y, w, h).fill(0x330000);
      this.hpBar.rect(x, y, w * (player.hp / player.maxHp), h).fill(0xff0000);
      this.hpBar.rect(x, y, w, h).stroke({ width: 1, color: 0xffffff });
    }

    // MP 条
    if (this.mpBar) {
      this.mpBar.clear();
      const x = 44, y = 36, w = 180, h = 12;
      this.mpBar.rect(x, y, w, h).fill(0x000033);
      this.mpBar.rect(x, y, w * (player.mp / player.maxMp), h).fill(0x0066ff);
      this.mpBar.rect(x, y, w, h).stroke({ width: 1, color: 0xffffff });
    }

    // HP/MP 文字（更新 .text 属性，不创建新对象）
    if (this.hpText) {
      this.hpText.text = `HP ${Math.ceil(player.hp)}/${player.maxHp}  MP ${Math.ceil(player.mp)}/${player.maxMp}  Lv.${player.level}`;
    }

    // 金钱显示
    if (this.goldText) {
      this.goldText.text = `金钱: ${this.scene.runState.gold}`;
    }

    // 交互提示
    if (this.interactHint) {
      this.interactHint.visible = this.scene.isNearNpc();
    }

    // 小地图
    if (this.minimap) {
      this.minimap.clear();
      const mmW = 100, mmH = 80;
      const mmX = this.api.screen.width - mmW - 10;
      const mmY = this.api.screen.height - mmH - 10;
      this.minimap.rect(mmX, mmY, mmW, mmH).fill({ color: 0x000000, alpha: 0.6 });
      this.minimap.rect(mmX, mmY, mmW, mmH).stroke({ width: 1, color: 0x666688 });
      // 玩家位置点
      const mapSize = this.scene.mapPixelSize;
      if (mapSize && mapSize.width > 0 && mapSize.height > 0) {
        const dotX = mmX + (player.position.x / mapSize.width) * mmW;
        const dotY = mmY + (player.position.y / mapSize.height) * mmH;
        this.minimap.circle(dotX, dotY, 3).fill(0xff4444);
      }
    }

    // 技能栏
    if (this.skillBar) {
      this.skillBar.clear();
      const skillCount = Math.min(player.skills.length, 5);
      const slotSize = 44;
      const startX = this.api.screen.width / 2 - (skillCount * (slotSize + 4)) / 2;
      const y = this.api.screen.height - slotSize - 10;
      const skillKeys = ['K', 'L', 'U', 'I', 'O'];
      for (let i = 0; i < 5; i++) {
        const txt = this.skillKeyTexts[i];
        if (!txt) continue;
        if (i < skillCount) {
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
          // 更新按键标签位置和文本（不创建新对象）
          txt.text = skillKeys[i];
          txt.x = x + 2;
          txt.y = y + 2;
          txt.visible = true;
        } else {
          txt.visible = false;
        }
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
  }

  /** 显示对话界面 */
  showDialogue(): void {
    if (this.dialogueBox) return;
    const node = dialogueManager.current;
    if (!node) return;

    const container = new Container();
    const boxW = this.api.screen.width - 100;
    const boxH = 180;
    const boxX = 50;
    const boxY = this.api.screen.height - boxH - 20;

    // 对话框背景（可点击推进对话）
    const bg = new Graphics();
    bg.eventMode = 'static';
    bg.cursor = 'pointer';
    bg.roundRect(boxX, boxY, boxW, boxH, 8).fill({ color: 0x000000, alpha: 0.85 });
    bg.roundRect(boxX, boxY, boxW, boxH, 8).stroke({ width: 2, color: 0xffcc44 });
    bg.on('pointerdown', () => {
      dialogueManager.advance();
    });
    container.addChild(bg);

    // 左侧头像区域（彩色圆形 + 说话者名字）
    const portraitG = new Graphics();
    portraitG.eventMode = 'none';
    const px = boxX + 50, py = boxY + 55, pr = 28;
    portraitG.circle(px, py, pr).fill({ color: 0x2a2a4a, alpha: 0.8 });
    portraitG.circle(px, py, pr).stroke({ width: 2, color: 0xffcc44 });
    // 头像内文字（说话者首字）
    const portraitLabel = new Text({
      text: node.speaker.charAt(0),
      style: { fontSize: 20, fill: 0xffcc44, fontWeight: 'bold' },
    });
    portraitLabel.anchor.set(0.5);
    portraitLabel.x = px;
    portraitLabel.y = py;
    container.addChild(portraitG);
    container.addChild(portraitLabel);

    // 说话者名字
    const speaker = new Text({
      text: node.speaker,
      style: { fontSize: 16, fill: 0xffcc44, fontWeight: 'bold' },
    });
    speaker.x = boxX + 95;
    speaker.y = boxY + 15;
    container.addChild(speaker);

    // 分隔线
    const divider = new Graphics();
    divider.eventMode = 'none';
    divider.rect(boxX + 95, boxY + 40, boxW - 115, 1).fill({ color: 0xffcc44, alpha: 0.3 });
    container.addChild(divider);

    // 对话文本（打字机效果）—— 更大更易读
    const text = new Text({
      text: '',
      style: { fontSize: 16, fill: 0xffffff, wordWrap: true, wordWrapWidth: boxW - 130, lineHeight: 24 },
    });
    text.x = boxX + 95;
    text.y = boxY + 50;
    container.addChild(text);
    this.dialogueText = text;

    // 闪烁的"▼"提示（等待输入时显示）
    const hint = new Text({
      text: '▼',
      style: { fontSize: 14, fill: 0xffcc44 },
    });
    hint.x = boxX + boxW - 30;
    hint.y = boxY + boxH - 25;
    hint.visible = false;
    container.addChild(hint);
    this.dialogueHint = hint;

    // 选项
    if (node.choices && dialogueManager.typewriterProgress >= 1) {
      const choicesContainer = new Container();
      node.choices.forEach((choice, i) => {
        const choiceText = new Text({
          text: `${i + 1}. ${choice.text}`,
          style: { fontSize: 14, fill: 0x88ccff },
        });
        choiceText.x = boxX + boxW - 220;
        choiceText.y = boxY + 55 + i * 25;
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

    this.uiContainer.addChild(container);
    this.dialogueBox = container;

    // 初始化文本
    this.updateDialogueText();
  }

  /** 更新对话显示（仅节点变化时重建） */
  updateDialogue(): void {
    if (!dialogueManager.isActive) {
      this.hideDialogue();
      this.lastDialogueNodeId = null;
      return;
    }
    const currentNodeId = dialogueManager.currentNodeId;
    if (currentNodeId !== this.lastDialogueNodeId) {
      // 节点变化，重建对话框
      this.hideDialogue();
      this.showDialogue();
      this.lastDialogueNodeId = currentNodeId;
    } else {
      // 节点未变化，仅更新文本（打字机效果）
      this.updateDialogueText();
    }
  }

  /** 仅更新对话文本（打字机效果 + 闪烁提示） */
  private updateDialogueText(): void {
    if (!this.dialogueText || !this.dialogueBox) return;
    const node = dialogueManager.current;
    if (!node) return;

    // 更新打字机文本
    const fullText = node.text;
    const visibleChars = Math.floor(fullText.length * dialogueManager.typewriterProgress);
    this.dialogueText.text = fullText.substring(0, visibleChars);

    // 更新闪烁"▼"提示
    if (this.dialogueHint) {
      const shouldShow = dialogueManager.typewriterProgress >= 1 && (!node.choices || node.choices.length === 0);
      if (shouldShow) {
        // 每 30 帧切换一次可见性（约 0.5 秒）
        this.dialogueHint.visible = Math.floor(this.blinkTimer / 30) % 2 === 0;
      } else {
        this.dialogueHint.visible = false;
      }
    }
  }

  /** 隐藏对话 */
  hideDialogue(): void {
    if (this.dialogueBox) {
      this.uiContainer.removeChild(this.dialogueBox);
      this.dialogueBox.destroy();
      this.dialogueBox = null;
      this.dialogueText = null;
      this.dialogueChoices = null;
      this.dialogueHint = null;
    }
  }

  /** 显示商店界面 */
  showShop(): void {
    if (!shopManager.isActive) return;
    this.hideShop();
    const container = new Container();
    const items = shopManager.getShopItems();
    const sellable = shopManager.getSellableItems();

    const boxW = 660;
    const boxH = 420;
    const boxX = (this.api.screen.width - boxW) / 2;
    const boxY = (this.api.screen.height - boxH) / 2;

    const bg = new Graphics();
    bg.eventMode = 'none';
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

    // 金钱显示（持久化引用，用于刷新）
    const goldText = new Text({
      text: `金钱: ${shopManager.gold}`,
      style: { fontSize: 14, fill: 0xffcc44 },
    });
    goldText.x = boxX + boxW - 120;
    goldText.y = boxY + 15;
    container.addChild(goldText);
    this.shopGoldText = goldText;

    // 左列：购买
    const buyTitle = new Text({
      text: '── 购买 ──',
      style: { fontSize: 14, fill: 0x88ccff },
    });
    buyTitle.x = boxX + 20;
    buyTitle.y = boxY + 50;
    container.addChild(buyTitle);

    this.shopBuyEntries = [];
    items.forEach((entry, i) => {
      const rowY = boxY + 75 + i * 28;
      // 物品图标（稀有度色方块）
      const icon = new Graphics();
      icon.eventMode = 'none';
      const iconColor = RARITY_COLOR[entry.item.rarity] ?? 0xcccccc;
      icon.rect(boxX + 20, rowY, 18, 18).fill(iconColor);
      icon.rect(boxX + 20, rowY, 18, 18).stroke({ width: 1, color: 0xffffff, alpha: 0.5 });
      container.addChild(icon);

      const itemText = new Text({
        text: `${entry.item.name}  ${entry.price}金`,
        style: { fontSize: 12, fill: 0xffffff },
      });
      itemText.x = boxX + 45;
      itemText.y = rowY + 2;
      itemText.eventMode = 'static';
      itemText.cursor = 'pointer';
      itemText.on('pointerdown', () => {
        const result = shopManager.buy(entry.item.id);
        if (result.ok) {
          this.showShopFeedback(`购买了 ${entry.item.name}`);
        } else {
          this.showShopFeedback(result.reason ?? '购买失败');
        }
        this.refreshShop();
      });
      container.addChild(itemText);
      this.shopBuyEntries.push({ itemId: entry.item.id, text: itemText });
    });

    // 右列：出售
    const sellTitle = new Text({
      text: '── 出售 ──',
      style: { fontSize: 14, fill: 0x88ccff },
    });
    sellTitle.x = boxX + boxW / 2;
    sellTitle.y = boxY + 50;
    container.addChild(sellTitle);

    this.shopSellEntries = [];
    sellable.forEach((entry, i) => {
      const rowY = boxY + 75 + i * 28;
      // 物品图标（稀有度色方块）
      const icon = new Graphics();
      icon.eventMode = 'none';
      const iconColor = RARITY_COLOR[entry.item.rarity] ?? 0xcccccc;
      icon.rect(boxX + boxW / 2, rowY, 18, 18).fill(iconColor);
      icon.rect(boxX + boxW / 2, rowY, 18, 18).stroke({ width: 1, color: 0xffffff, alpha: 0.5 });
      container.addChild(icon);

      const itemText = new Text({
        text: `${entry.item.name} x${entry.count}  ${entry.sellPrice}金`,
        style: { fontSize: 12, fill: 0xcccc88 },
      });
      itemText.x = boxX + boxW / 2 + 25;
      itemText.y = rowY + 2;
      itemText.eventMode = 'static';
      itemText.cursor = 'pointer';
      itemText.on('pointerdown', () => {
        const result = shopManager.sell(entry.item.id);
        if (result.ok) {
          this.showShopFeedback(`出售了 ${entry.item.name}`);
        } else {
          this.showShopFeedback(result.reason ?? '出售失败');
        }
        this.refreshShop();
      });
      container.addChild(itemText);
      this.shopSellEntries.push({ itemId: entry.item.id, text: itemText });
    });

    // 反馈文本（购买/出售确认）
    const feedback = new Text({
      text: '',
      style: { fontSize: 14, fill: 0x66ff66 },
    });
    feedback.anchor.set(0.5);
    feedback.x = boxX + boxW / 2;
    feedback.y = boxY + boxH - 50;
    feedback.visible = false;
    container.addChild(feedback);
    this.shopFeedback = feedback;

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

  /** 刷新商店界面（仅更新金钱和物品数量，不重建 UI） */
  refreshShop(): void {
    // 更新金钱
    if (this.shopGoldText) {
      this.shopGoldText.text = `金钱: ${shopManager.gold}`;
    }
    // 更新购买项库存显示
    for (const entry of this.shopBuyEntries) {
      const shopItem = shopManager.currentShop?.items.find((i) => i.itemId === entry.itemId);
      const item = ITEM_MAP[entry.itemId];
      if (item && shopItem) {
        const stockText = shopItem.stock !== undefined ? ` (库存:${shopItem.stock})` : '';
        entry.text.text = `${item.name}  ${shopItem.price}金${stockText}`;
      }
    }
    // 更新出售项数量
    for (const entry of this.shopSellEntries) {
      const count = shopManager.inventory[entry.itemId] ?? 0;
      const item = ITEM_MAP[entry.itemId];
      if (item) {
        if (count > 0) {
          const sellPrice = Math.floor(item.price * (shopManager.currentShop?.buybackRate ?? 0.5));
          entry.text.text = `${item.name} x${count}  ${sellPrice}金`;
          entry.text.style.fill = 0xcccc88;
        } else {
          entry.text.text = `${item.name}  已售完`;
          entry.text.style.fill = 0x666666;
        }
      }
    }
  }

  /** 显示商店反馈消息 */
  private showShopFeedback(msg: string): void {
    if (this.shopFeedback) {
      this.shopFeedback.text = msg;
      this.shopFeedback.visible = true;
      this.shopFeedbackTimer = 90; // 约 1.5 秒
    }
  }

  /** 隐藏商店 */
  hideShop(): void {
    if (this.shopContainer) {
      this.uiContainer.removeChild(this.shopContainer);
      this.shopContainer.destroy();
      this.shopContainer = null;
      this.shopGoldText = null;
      this.shopFeedback = null;
      this.shopFeedbackTimer = 0;
      this.shopBuyEntries = [];
      this.shopSellEntries = [];
    }
  }

  /** 显示菜单 */
  showMenu(): void {
    if (this.menuContainer) return;
    const container = new Container();
    const boxW = 480;
    const boxH = 460;
    const boxX = (this.api.screen.width - boxW) / 2;
    const boxY = (this.api.screen.height - boxH) / 2;

    const bg = new Graphics();
    bg.eventMode = 'none';
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

    // 角色信息区
    const charTitle = new Text({
      text: '── 角色 ──',
      style: { fontSize: 14, fill: 0x88ccff },
    });
    charTitle.x = boxX + 20;
    charTitle.y = boxY + 45;
    container.addChild(charTitle);

    const party = this.scene.runState.party;
    let charY = boxY + 70;
    for (const member of party) {
      const def = CHARACTER_MAP[member.characterId];
      if (!def) continue;
      const stats = statsAtLevel(def.baseStats, def.growth, member.level);
      const elemName = ['风', '雷', '水', '火', '土'];
      const elemIdx = ['wind', 'thunder', 'water', 'fire', 'earth'].indexOf(def.element);
      const elemLabel = elemIdx >= 0 ? elemName[elemIdx] : '?';

      const charText = new Text({
        text: `${def.name}  Lv.${member.level}  ${elemLabel}属性`,
        style: { fontSize: 13, fill: 0xffffff, fontWeight: 'bold' },
      });
      charText.x = boxX + 20;
      charText.y = charY;
      container.addChild(charText);

      const statsText = new Text({
        text: `HP:${member.hp}/${stats.hp}  MP:${member.mp}/${stats.mp}\nATK:${stats.atk} DEF:${stats.def} MAG:${stats.mag} RES:${stats.res} SPD:${stats.spd.toFixed(1)}`,
        style: { fontSize: 11, fill: 0xaaaaaa, lineHeight: 16 },
      });
      statsText.x = boxX + 20;
      statsText.y = charY + 18;
      container.addChild(statsText);

      charY += 50;
    }

    // 背包区
    const invTitle = new Text({
      text: '── 背包 ──',
      style: { fontSize: 14, fill: 0x88ccff },
    });
    invTitle.x = boxX + 20;
    invTitle.y = charY + 10;
    container.addChild(invTitle);

    const inventory = this.scene.runState.inventory;
    const invEntries = Object.entries(inventory).filter(([, count]) => count > 0);
    if (invEntries.length > 0) {
      invEntries.forEach(([itemId, count], i) => {
        const item = ITEM_MAP[itemId];
        const name = item?.name ?? itemId;
        const invText = new Text({
          text: `${name} x${count}`,
          style: { fontSize: 11, fill: 0xcccc88 },
        });
        invText.x = boxX + 20 + (i % 2) * 220;
        invText.y = charY + 35 + Math.floor(i / 2) * 18;
        container.addChild(invText);
      });
    } else {
      const emptyText = new Text({
        text: '背包空空如也',
        style: { fontSize: 11, fill: 0x666666 },
      });
      emptyText.x = boxX + 20;
      emptyText.y = charY + 35;
      container.addChild(emptyText);
    }

    // 菜单项
    const menuItems = ['继续游戏', '存档', '读档', '返回标题'];
    const menuStartY = boxY + boxH - 130;
    menuItems.forEach((item, i) => {
      const txt = new Text({
        text: item,
        style: { fontSize: 16, fill: 0xffffff },
      });
      txt.x = boxX + 20;
      txt.y = menuStartY + i * 28;
      txt.eventMode = 'static';
      txt.cursor = 'pointer';
      txt.on('pointerdown', () => this.handleMenuChoice(i));
      txt.on('pointerover', () => { txt.style.fill = 0xffcc44; });
      txt.on('pointerout', () => { txt.style.fill = 0xffffff; });
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
    const removed = this.uiContainer.removeChildren();
    for (const child of removed) {
      child.destroy();
    }
    this.hpBar = null;
    this.mpBar = null;
    this.hpText = null;
    this.skillBar = null;
    this.skillKeyTexts = [];
    this.questTracker = null;
    this.hudBg = null;
    this.portrait = null;
    this.minimap = null;
    this.goldText = null;
    this.interactHint = null;
    this.dialogueBox = null;
    this.dialogueText = null;
    this.dialogueChoices = null;
    this.dialogueHint = null;
    this.lastDialogueNodeId = null;
    this.shopContainer = null;
    this.shopGoldText = null;
    this.shopFeedback = null;
    this.shopFeedbackTimer = 0;
    this.shopBuyEntries = [];
    this.shopSellEntries = [];
    this.menuContainer = null;
    this.titleContainer = null;
    this.messageText = null;
    this.messageTimer = 0;
  }

  /** 每帧更新 */
  update(): void {
    // 通用计时器（所有屏幕通用）
    if (this.messageTimer > 0) {
      this.messageTimer--;
      if (this.messageTimer <= 0 && this.messageText) {
        this.messageText.visible = false;
      }
    }
    if (this.shopFeedbackTimer > 0) {
      this.shopFeedbackTimer--;
      if (this.shopFeedbackTimer <= 0 && this.shopFeedback) {
        this.shopFeedback.visible = false;
      }
    }
    this.blinkTimer++;

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
