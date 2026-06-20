// ui/MobileControls.ts
// 手机端虚拟控制：摇杆 + 攻击/技能/闪避/交互按钮
// 自动检测触屏设备显示

import type { EngineApi } from '../core/engine';
import type { InputManager } from '../core/input';
import { Graphics, Container, Text } from 'pixi.js';

/** 检测是否为移动设备 */
export function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent)
    || ('ontouchstart' in window && window.innerWidth < 1024);
}

export class MobileControls {
  private api: EngineApi;
  private input: InputManager;
  private container: Container;
  // 摇杆
  private joystickBase: Graphics;
  private joystickKnob: Graphics;
  private joystickActive = false;
  private joystickTouchId: number | null = null;
  private joystickCenter = { x: 0, y: 0 };
  private readonly joystickRadius = 55;
  private readonly knobRadius = 26;
  // 按钮
  private buttons = new Map<string, { bg: Graphics; label: Text; action: string; radius: number }>();
  // 交互按钮
  private interactButton: Container | null = null;
  private interactVisible = false;

  constructor(api: EngineApi, input: InputManager) {
    this.api = api;
    this.input = input;
    this.container = new Container();
    this.container.eventMode = 'static';
    this.container.zIndex = 2000;
    this.container.visible = false;
    this.api.ui.addChild(this.container);

    // 创建摇杆
    this.joystickBase = new Graphics();
    this.joystickKnob = new Graphics();
    this.container.addChild(this.joystickBase, this.joystickKnob);

    // 创建按钮
    this.createButtons();
    this.createInteractButton();

    // 注册触摸事件
    this.setupTouchEvents();

    this.layout();
  }

  /** 创建动作按钮 */
  private createButtons(): void {
    const defs = [
      { action: 'atk', label: '攻', color: 0xcc3333, radius: 38 },
      { action: 'dodge', label: '闪', color: 0x3366cc, radius: 30 },
      { action: 'skill0', label: '1', color: 0x9944cc, radius: 26 },
      { action: 'skill1', label: '2', color: 0x9944cc, radius: 26 },
      { action: 'skill2', label: '3', color: 0x9944cc, radius: 26 },
      { action: 'skill3', label: '4', color: 0x9944cc, radius: 26 },
      { action: 'skill4', label: '5', color: 0x9944cc, radius: 26 },
    ];
    for (const def of defs) {
      const bg = new Graphics();
      bg.eventMode = 'static';
      bg.cursor = 'pointer';
      const label = new Text({
        text: def.label,
        style: { fontSize: def.radius > 30 ? 18 : 14, fill: 0xffffff, fontWeight: 'bold' },
      });
      label.anchor.set(0.5);
      bg.addChild(label);
      this.container.addChild(bg);
      this.buttons.set(def.action, { bg, label, action: def.action, radius: def.radius });
    }
  }

  /** 创建交互按钮（靠近 NPC 时显示） */
  private createInteractButton(): void {
    const container = new Container();
    container.eventMode = 'static';
    container.visible = false;
    const bg = new Graphics();
    bg.circle(0, 0, 28).fill({ color: 0x33aa44, alpha: 0.7 });
    bg.circle(0, 0, 28).stroke({ width: 2, color: 0xffffff, alpha: 0.6 });
    bg.eventMode = 'static';
    bg.cursor = 'pointer';
    const label = new Text({ text: 'E', style: { fontSize: 18, fill: 0xffffff, fontWeight: 'bold' } });
    label.anchor.set(0.5);
    bg.addChild(label);
    container.addChild(bg);
    this.container.addChild(container);
    this.interactButton = container;

    // 点击交互
    bg.on('pointerdown', () => {
      this.input.setVirtualButton('interact', true);
    });
    bg.on('pointerup', () => {
      this.input.setVirtualButton('interact', false);
    });
    bg.on('pointerupoutside', () => {
      this.input.setVirtualButton('interact', false);
    });
  }

  /** 设置触摸事件 */
  private setupTouchEvents(): void {
    // 摇杆触摸
    this.joystickBase.eventMode = 'static';
    this.joystickBase.on('pointerdown', (e: any) => {
      this.joystickActive = true;
      this.joystickTouchId = e.pointerId ?? 0;
      // e.global 是画布坐标，需转为 stage 局部坐标（横屏逻辑空间）
      const p = this.api.toStageLocal(e.global.x, e.global.y);
      this.updateJoystick(p.x, p.y);
    });
    // 使用全局 pointermove
    this.api.app.stage.on('pointermove', (e: any) => {
      if (!this.joystickActive) return;
      const p = this.api.toStageLocal(e.global.x, e.global.y);
      this.updateJoystick(p.x, p.y);
    });
    this.api.app.stage.on('pointerup', () => {
      if (this.joystickActive) {
        this.joystickActive = false;
        this.joystickTouchId = null;
        this.resetJoystick();
      }
    });
    this.api.app.stage.on('pointerupoutside', () => {
      if (this.joystickActive) {
        this.joystickActive = false;
        this.joystickTouchId = null;
        this.resetJoystick();
      }
    });

    // 按钮触摸
    for (const [, btn] of this.buttons) {
      btn.bg.on('pointerdown', () => {
        this.input.setVirtualButton(btn.action, true);
        btn.bg.scale.set(0.9);
      });
      btn.bg.on('pointerup', () => {
        this.input.setVirtualButton(btn.action, false);
        btn.bg.scale.set(1);
      });
      btn.bg.on('pointerupoutside', () => {
        this.input.setVirtualButton(btn.action, false);
        btn.bg.scale.set(1);
      });
    }
  }

  /** 更新摇杆位置 */
  private updateJoystick(globalX: number, globalY: number): void {
    const dx = globalX - this.joystickCenter.x;
    const dy = globalY - this.joystickCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = this.joystickRadius;
    let knobX = this.joystickCenter.x;
    let knobY = this.joystickCenter.y;
    if (dist > 0) {
      const clampedDist = Math.min(dist, maxDist);
      knobX = this.joystickCenter.x + (dx / dist) * clampedDist;
      knobY = this.joystickCenter.y + (dy / dist) * clampedDist;
      // 设置移动方向（归一化）
      const nx = dx / dist;
      const ny = dy / dist;
      const intensity = Math.min(dist / maxDist, 1);
      this.input.setVirtualMove(nx * intensity, ny * intensity);
    }
    this.joystickKnob.position.set(knobX, knobY);
  }

  /** 重置摇杆 */
  private resetJoystick(): void {
    this.joystickKnob.position.set(this.joystickCenter.x, this.joystickCenter.y);
    this.input.setVirtualMove(0, 0);
  }

  /** 布局：根据屏幕尺寸调整位置 */
  layout(): void {
    const w = this.api.screen.width;
    const h = this.api.screen.height;

    // 摇杆位置（左下角）
    this.joystickCenter.x = 90;
    this.joystickCenter.y = h - 90;

    // 摇杆底座
    this.joystickBase.clear();
    this.joystickBase.circle(this.joystickCenter.x, this.joystickCenter.y, this.joystickRadius)
      .fill({ color: 0x222233, alpha: 0.4 });
    this.joystickBase.circle(this.joystickCenter.x, this.joystickCenter.y, this.joystickRadius)
      .stroke({ width: 2, color: 0xffffff, alpha: 0.3 });
    // 内圈
    this.joystickBase.circle(this.joystickCenter.x, this.joystickCenter.y, this.joystickRadius * 0.6)
      .stroke({ width: 1, color: 0xffffff, alpha: 0.15 });

    // 摇杆旋钮
    this.joystickKnob.clear();
    this.joystickKnob.circle(0, 0, this.knobRadius).fill({ color: 0x6688cc, alpha: 0.6 });
    this.joystickKnob.circle(0, 0, this.knobRadius).stroke({ width: 2, color: 0xffffff, alpha: 0.5 });
    this.joystickKnob.position.set(this.joystickCenter.x, this.joystickCenter.y);

    // 攻击按钮（右下角）
    const atkBtn = this.buttons.get('atk');
    if (atkBtn) {
      atkBtn.bg.clear();
      atkBtn.bg.circle(0, 0, atkBtn.radius).fill({ color: 0xcc3333, alpha: 0.65 });
      atkBtn.bg.circle(0, 0, atkBtn.radius).stroke({ width: 2, color: 0xffffff, alpha: 0.5 });
      atkBtn.bg.position.set(w - 70, h - 70);
    }

    // 闪避按钮
    const dodgeBtn = this.buttons.get('dodge');
    if (dodgeBtn) {
      dodgeBtn.bg.clear();
      dodgeBtn.bg.circle(0, 0, dodgeBtn.radius).fill({ color: 0x3366cc, alpha: 0.65 });
      dodgeBtn.bg.circle(0, 0, dodgeBtn.radius).stroke({ width: 2, color: 0xffffff, alpha: 0.5 });
      dodgeBtn.bg.position.set(w - 130, h - 100);
    }

    // 技能按钮（攻击上方弧形排列）
    const skillStartX = w - 70;
    const skillBaseY = h - 140;
    for (let i = 0; i < 5; i++) {
      const btn = this.buttons.get(`skill${i}`);
      if (btn) {
        btn.bg.clear();
        btn.bg.circle(0, 0, btn.radius).fill({ color: 0x9944cc, alpha: 0.6 });
        btn.bg.circle(0, 0, btn.radius).stroke({ width: 2, color: 0xffffff, alpha: 0.4 });
        // 弧形排列
        const angle = -Math.PI / 2 + (i - 2) * 0.35;
        const sx = skillStartX + Math.cos(angle) * 60;
        const sy = skillBaseY + Math.sin(angle) * 60;
        btn.bg.position.set(sx, sy);
      }
    }

    // 交互按钮（攻击按钮左侧）
    if (this.interactButton) {
      this.interactButton.position.set(w - 180, h - 60);
    }
  }

  /** 显示手机控制 */
  show(): void {
    this.container.visible = true;
  }

  /** 隐藏手机控制 */
  hide(): void {
    this.container.visible = false;
    this.input.setVirtualMove(0, 0);
  }

  /** 设置交互按钮可见性 */
  setInteractVisible(visible: boolean): void {
    if (this.interactButton) {
      this.interactButton.visible = visible;
      this.interactVisible = visible;
    }
  }

  /** 检查屏幕坐标是否在控制按钮上 */
  isOnControl(screenX: number, screenY: number): boolean {
    if (!this.container.visible) return false;
    // 检查摇杆区域
    const jdx = screenX - this.joystickCenter.x;
    const jdy = screenY - this.joystickCenter.y;
    if (Math.sqrt(jdx * jdx + jdy * jdy) < this.joystickRadius + 10) return true;
    // 检查按钮区域
    for (const [, btn] of this.buttons) {
      const bdx = screenX - btn.bg.position.x;
      const bdy = screenY - btn.bg.position.y;
      if (Math.sqrt(bdx * bdx + bdy * bdy) < btn.radius + 5) return true;
    }
    // 交互按钮
    if (this.interactVisible && this.interactButton) {
      const idx = screenX - this.interactButton.position.x;
      const idy = screenY - this.interactButton.position.y;
      if (Math.sqrt(idx * idx + idy * idy) < 33) return true;
    }
    return false;
  }

  /** 更新（每帧调用，更新交互按钮可见性等） */
  update(): void {
    // 交互按钮可见性由外部设置
  }
}
