// core/engine.ts
// PixiJS 封装 + 游戏循环。
// 这是唯一接触 PixiJS 的地方，业务模块只拿到抽象的 EngineApi，便于：
// 1. 将来换皮/换引擎时代替替换
// 2. 单元测试时注入假 EngineApi 跑纯逻辑
// 3. 三端共用同一套渲染入口

import { Application, Container, Graphics, Text } from 'pixi.js';
import type { Vec2 } from './types';

/** 引擎对外暴露的抽象 API */
export interface EngineApi {
  app: Application;
  world: Container;        // 世界层（地图+实体，随相机移动）
  ui: Container;           // UI 层（HUD/菜单，固定屏幕坐标）
  stage: Container;
  graphics: () => Graphics;
  text: (content: string, style?: Partial<TextStyle>) => Text;
  centerCameraOn: (pos: Vec2) => void;
  screen: { width: number; height: number };
  /** 将画布坐标（clientX/clientY 或 e.global）转换为 stage 局部坐标（横屏逻辑空间） */
  toStageLocal: (x: number, y: number) => Vec2;
  /** 当前是否为竖屏（需要旋转） */
  isPortrait: () => boolean;
  destroy: () => void;
}

export interface TextStyle {
  fontFamily?: string;
  fontSize?: number;
  fill?: number;
  align?: string;
  fontWeight?: string;
}

/** 检测当前是否为竖屏 */
function isPortraitMode(): boolean {
  return window.innerHeight > window.innerWidth;
}

/**
 * 初始化 PixiJS 应用。返回 EngineApi 供场景使用。
 * 画布始终铺满全屏；竖屏时通过旋转 stage 强制横屏显示。
 * @param canvas 可选的 canvas 元素；不传则全屏自动创建
 */
export async function createEngine(canvas?: HTMLCanvasElement): Promise<EngineApi> {
  const app = new Application();

  // 画布尺寸始终 = 窗口尺寸（竖屏时也是竖屏尺寸，通过 stage 旋转来强制横屏）
  await app.init({
    canvas,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x0a0a12,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
  });

  // 手动设置 canvas CSS 铺满全屏（不用 autoDensity，避免 inline style 冲突）
  const cv = (canvas ?? app.canvas as HTMLCanvasElement);
  cv.style.width = '100vw';
  cv.style.height = '100vh';
  cv.style.display = 'block';
  cv.style.position = 'fixed';
  cv.style.top = '0';
  cv.style.left = '0';
  cv.style.touchAction = 'none';

  if (!canvas) {
    document.body.appendChild(app.canvas);
  }

  // 舞台事件模式 + 排序，保证子节点能接收交互事件
  app.stage.eventMode = 'static';
  app.stage.sortableChildren = true;

  const world = new Container();
  world.sortableChildren = true;
  world.eventMode = 'static';
  const ui = new Container();
  ui.sortableChildren = true;
  ui.eventMode = 'static';
  app.stage.addChild(world, ui);

  // 游戏逻辑尺寸（始终为横屏：宽 > 高）
  const screenObj = {
    width: isPortraitMode() ? window.innerHeight : window.innerWidth,
    height: isPortraitMode() ? window.innerWidth : window.innerHeight,
  };

  /** 应用/更新方向旋转 */
  function applyOrientation(): void {
    const portrait = isPortraitMode();
    if (portrait) {
      // 竖屏 → 旋转 stage -90° 强制横屏
      // 旋转后 stage 局部坐标系为横屏（宽=innerHeight, 高=innerWidth）
      screenObj.width = window.innerHeight;
      screenObj.height = window.innerWidth;
      app.stage.rotation = -Math.PI / 2;
      app.stage.x = 0;
      app.stage.y = window.innerHeight;
    } else {
      // 横屏 → 不旋转
      screenObj.width = window.innerWidth;
      screenObj.height = window.innerHeight;
      app.stage.rotation = 0;
      app.stage.x = 0;
      app.stage.y = 0;
    }
  }
  applyOrientation();

  /** 将画布坐标转换为 stage 局部坐标（横屏逻辑空间） */
  function toStageLocal(x: number, y: number): Vec2 {
    if (isPortraitMode()) {
      // stage 旋转 -90° 后：local_x = H - canvas_y, local_y = canvas_x
      return { x: window.innerHeight - y, y: x };
    }
    return { x, y };
  }

  /** 窗口尺寸变化处理 */
  function onResize(): void {
    app.renderer.resize(window.innerWidth, window.innerHeight);
    cv.style.width = '100vw';
    cv.style.height = '100vh';
    applyOrientation();
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 100));

  return {
    app,
    world,
    ui,
    stage: app.stage,
    graphics: () => new Graphics(),
    text: (content, style) =>
      new Text({
        text: content,
        style: {
          fontFamily: style?.fontFamily ?? 'sans-serif',
          fontSize: style?.fontSize ?? 14,
          fill: style?.fill ?? 0xffffff,
          align: style?.align as 'left' | 'center' | 'right' ?? 'left',
          fontWeight: style?.fontWeight ?? 'normal',
        },
      } as any),
    centerCameraOn: (pos) => {
      world.x = screenObj.width / 2 - pos.x;
      world.y = screenObj.height / 2 - pos.y;
    },
    screen: screenObj,
    toStageLocal,
    isPortrait: () => isPortraitMode(),
    destroy: () => {
      window.removeEventListener('resize', onResize);
      app.destroy(true);
    },
  };
}

/** 引擎尺寸变化时刷新缓存（供 UI 重排） */
export function watchResize(api: EngineApi, onResize: (w: number, h: number) => void): () => void {
  const handler = () => {
    // api.screen 已由 applyOrientation 实时更新，这里只触发回调
    onResize(api.screen.width, api.screen.height);
  };
  window.addEventListener('resize', handler);
  window.addEventListener('orientationchange', () => setTimeout(handler, 100));
  return () => {
    window.removeEventListener('resize', handler);
  };
}
