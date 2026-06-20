import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { WorldScene } from './scenes/WorldScene';
import { UIScene } from './scenes/UIScene';
import { DialogScene } from './scenes/DialogScene';
import { SaveScene } from './scenes/SaveScene';

const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  backgroundColor: '#0a0a12',
  pixelArt: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  input: {
    keyboard: true,
    mouse: true,
    touch: true,
    gamepad: false,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false, gravity: { x: 0, y: 0 } },
  },
  render: { antialias: true, roundPixels: false },
  scene: [BootScene, PreloadScene, MenuScene, WorldScene, UIScene, DialogScene, SaveScene],
};

// 尝试锁定横屏(支持的环境)
if (screen.orientation && (screen.orientation as any).lock) {
  (screen.orientation as any).lock('landscape').catch(() => {});
}

// 移除 loading 占位
const loading = document.getElementById('loading');
if (loading) loading.remove();

const game = new Phaser.Game(config);

// 暴露调试入口(开发用)
(window as any).GAME = game;
(window as any).CTX = () => import('./core/GameContext').then(m => m.GameContext);

// 注册 Service Worker(PWA 离线缓存,生产环境启用)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // SW 注册失败不影响游戏运行
    });
  });
}

export { game };