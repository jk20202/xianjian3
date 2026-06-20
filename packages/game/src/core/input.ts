// core/input.ts
// 输入系统：键盘 + 鼠标 + 触屏 + 虚拟摇杆（移动端）。
// 把原始按键事件抽象成"意图"，战斗/移动模块只读意图，三端共用。

import type { Vec2 } from './types';

export interface InputState {
  /** 移动意图向量（归一化），x/y ∈ [-1,1] */
  move: { x: number; y: number };
  /** 平A按下（本帧边沿触发） */
  attackPressed: boolean;
  /** 平A持续按住 */
  attackHeld: boolean;
  /** 技能按键 0-4 边沿触发 */
  skillPressed: [boolean, boolean, boolean, boolean, boolean];
  /** 翻滚 */
  dodgePressed: boolean;
  /** 菜单切换 */
  menuToggle: boolean;
  /** 确认/对话推进 */
  confirm: boolean;
  /** 交互（拾取/对话） */
  interact: boolean;
  /** 鼠标/触屏位置（stage 局部坐标，横屏逻辑空间） */
  mousePos: Vec2;
  /** 鼠标/触屏点击（本帧边沿触发） */
  mouseClicked: boolean;
}

export class InputManager {
  private keys = new Set<string>();
  private pressedThisFrame = new Set<string>();
  state: InputState = {
    move: { x: 0, y: 0 },
    attackPressed: false,
    attackHeld: false,
    skillPressed: [false, false, false, false, false],
    dodgePressed: false,
    menuToggle: false,
    confirm: false,
    interact: false,
    mousePos: { x: 0, y: 0 },
    mouseClicked: false,
  };

  // 鼠标/触屏位置（stage 局部坐标），由事件实时更新
  mousePos: Vec2 = { x: 0, y: 0 };
  // 鼠标/触屏点击标记，每帧消费一次
  private mouseDownThisFrame = false;

  // 虚拟摇杆（移动端），由 UI 层设置
  virtualMove: { x: number; y: number } = { x: 0, y: 0 };
  private virtualButtons = new Set<string>();

  // 坐标变换函数（由引擎设置，用于竖屏旋转时将 clientX/clientY 转为 stage 局部坐标）
  private coordTransform: ((x: number, y: number) => Vec2) | null = null;

  private boundDown: (e: KeyboardEvent) => void;
  private boundUp: (e: KeyboardEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;
  private boundMouseDown: (e: MouseEvent) => void;
  private boundTouchStart: (e: TouchEvent) => void;
  private boundTouchMove: (e: TouchEvent) => void;

  constructor() {
    this.boundDown = (e) => {
      const k = e.key.toLowerCase();
      if (!this.keys.has(k)) this.pressedThisFrame.add(k);
      this.keys.add(k);
      // 阻止方向键/空格滚屏
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) {
        e.preventDefault();
      }
    };
    this.boundUp = (e) => {
      this.keys.delete(e.key.toLowerCase());
    };
    this.boundMouseMove = (e) => {
      this.setPointerPos(e.clientX, e.clientY);
    };
    this.boundMouseDown = () => {
      this.mouseDownThisFrame = true;
    };
    // 触屏支持
    this.boundTouchStart = (e) => {
      if (e.touches.length > 0) {
        const t = e.touches[0];
        this.setPointerPos(t.clientX, t.clientY);
        this.mouseDownThisFrame = true;
      }
    };
    this.boundTouchMove = (e) => {
      if (e.touches.length > 0) {
        const t = e.touches[0];
        this.setPointerPos(t.clientX, t.clientY);
      }
    };
    window.addEventListener('keydown', this.boundDown);
    window.addEventListener('keyup', this.boundUp);
    window.addEventListener('mousemove', this.boundMouseMove);
    window.addEventListener('mousedown', this.boundMouseDown);
    window.addEventListener('touchstart', this.boundTouchStart, { passive: true });
    window.addEventListener('touchmove', this.boundTouchMove, { passive: true });
  }

  /** 设置坐标变换函数（由引擎调用，用于竖屏旋转） */
  setCoordinateTransform(fn: (x: number, y: number) => Vec2): void {
    this.coordTransform = fn;
  }

  /** 将 clientX/clientY 转换为 stage 局部坐标并存储 */
  private setPointerPos(clientX: number, clientY: number): void {
    if (this.coordTransform) {
      const p = this.coordTransform(clientX, clientY);
      this.mousePos.x = p.x;
      this.mousePos.y = p.y;
    } else {
      this.mousePos.x = clientX;
      this.mousePos.y = clientY;
    }
  }

  /** 每帧开头调用：把本帧边沿事件压入 state */
  beginFrame(): void {
    const has = (k: string) => this.keys.has(k) || this.virtualButtons.has(k);
    const just = (k: string) => this.pressedThisFrame.has(k) || this.virtualButtons.has(`__vbtn_${k}`) && false;

    // 移动意图
    let mx = 0, my = 0;
    if (has('a') || has('arrowleft')) mx -= 1;
    if (has('d') || has('arrowright')) mx += 1;
    if (has('w') || has('arrowup')) my -= 1;
    if (has('s') || has('arrowdown')) my += 1;
    // 键盘优先，没按则用虚拟摇杆
    if (mx === 0 && my === 0) {
      mx = this.virtualMove.x;
      my = this.virtualMove.y;
    } else {
      const len = Math.hypot(mx, my) || 1;
      mx /= len; my /= len;
    }
    this.state.move.x = mx;
    this.state.move.y = my;

    // 平A：J
    this.state.attackPressed = this.pressedThisFrame.has('j') || this.virtualButtons.has('__atk_');
    this.state.attackHeld = has('j') || this.virtualButtons.has('atk');

    // 技能：K L U I O
    const skillKeys = ['k', 'l', 'u', 'i', 'o'];
    this.state.skillPressed = [
      false, false, false, false, false,
    ].map((_, i) =>
      this.pressedThisFrame.has(skillKeys[i]) || this.virtualButtons.has(`skill${i}`)
    ) as InputState['skillPressed'];

    this.state.dodgePressed = this.pressedThisFrame.has(' ') || this.virtualButtons.has('__dodge_');
    this.state.menuToggle = this.pressedThisFrame.has('tab') || this.pressedThisFrame.has('escape');
    this.state.confirm = this.pressedThisFrame.has('e') || this.pressedThisFrame.has('enter') || this.pressedThisFrame.has(' ');
    this.state.interact = this.pressedThisFrame.has('e') || this.pressedThisFrame.has('f') || this.virtualButtons.has('__interact_');

    // 鼠标/触屏位置 + 点击边沿
    this.state.mousePos.x = this.mousePos.x;
    this.state.mousePos.y = this.mousePos.y;
    this.state.mouseClicked = this.mouseDownThisFrame;
  }

  /** 每帧结尾调用：清空边沿事件 */
  endFrame(): void {
    this.pressedThisFrame.clear();
    this.mouseDownThisFrame = false;
    // 清除虚拟按钮的边沿标记（__前缀的是单帧触发的）
    for (const key of [...this.virtualButtons]) {
      if (key.startsWith('__')) {
        this.virtualButtons.delete(key);
      }
    }
  }

  /** 虚拟按键（移动端 UI 调用） */
  setVirtualButton(name: string, pressed: boolean): void {
    if (pressed) {
      this.virtualButtons.add(name);
      // 边沿触发标记（__前缀表示单帧）
      this.virtualButtons.add(`__${name}_`);
      this.pressedThisFrame.add(`__vbtn_${name}`);
    } else {
      this.virtualButtons.delete(name);
      this.virtualButtons.delete(`__${name}_`);
    }
  }

  setVirtualMove(x: number, y: number): void {
    this.virtualMove.x = x;
    this.virtualMove.y = y;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.boundDown);
    window.removeEventListener('keyup', this.boundUp);
    window.removeEventListener('mousemove', this.boundMouseMove);
    window.removeEventListener('mousedown', this.boundMouseDown);
    window.removeEventListener('touchstart', this.boundTouchStart);
    window.removeEventListener('touchmove', this.boundTouchMove);
  }
}
