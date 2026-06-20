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
  destroy: () => void;
}

export interface TextStyle {
  fontFamily?: string;
  fontSize?: number;
  fill?: number;
  align?: string;
  fontWeight?: string;
}

/**
 * 初始化 PixiJS 应用。返回 EngineApi 供场景使用。
 * @param canvas 可选的 canvas 元素；不传则全屏自动创建
 */
export async function createEngine(canvas?: HTMLCanvasElement): Promise<EngineApi> {
  const app = new Application();

  await app.init({
    canvas,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x0a0a12,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    resizeTo: canvas ? undefined : window,
  });

  if (!canvas) {
    document.body.appendChild(app.canvas);
  }

  const world = new Container();
  world.sortableChildren = true;
  const ui = new Container();
  ui.sortableChildren = true;
  app.stage.addChild(world, ui);

  const screen = () => ({ width: app.screen.width, height: app.screen.height });

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
      const s = screen();
      world.x = s.width / 2 - pos.x;
      world.y = s.height / 2 - pos.y;
    },
    screen: screen() as { width: number; height: number },
    destroy: () => app.destroy(true),
  };
}

/** 引擎尺寸变化时刷新缓存（供 UI 重排） */
export function watchResize(api: EngineApi, onResize: (w: number, h: number) => void): () => void {
  const handler = () => {
    api.screen.width = window.innerWidth;
    api.screen.height = window.innerHeight;
    onResize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}
