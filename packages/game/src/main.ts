// main.ts
// 游戏入口：初始化 PixiJS、输入、场景、UI，启动游戏循环

import { createEngine, watchResize } from './core/engine';
import type { EngineApi } from './core/engine';
import { InputManager } from './core/input';
import { World } from './ecs/world';
import { SceneManager } from './scene/SceneManager';
import { UIManager } from './ui/UIManager';
import { dialogueManager } from './dialogue/DialogueManager';
import { shopManager } from './shop/ShopManager';
import { bus } from './core/eventBus';
import { angleTo } from './core/math';

async function main(): Promise<void> {
  // 初始化引擎
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  const api: EngineApi = await createEngine(canvas ?? undefined);

  // 初始化输入
  const input = new InputManager();

  // 初始化世界
  const world = new World();

  // 初始化场景
  const scene = new SceneManager(api, world);

  // 初始化 UI
  const ui = new UIManager(api, scene);

  // 监听窗口尺寸变化，确保 screen 实时更新（renderer 已自动更新 screenObj，
  // 这里注册回调以便将来扩展 UI 重排逻辑）
  watchResize(api, () => {
    // UI 重排可在此触发，当前由 ui.update() 每帧读取 api.screen 自动适配
  });

  // 游戏循环
  let lastTime = performance.now();
  const FIXED_DT = 1000 / 60; // 60Hz 逻辑

  function gameLoop(now: number): void {
    const elapsed = now - lastTime;
    lastTime = now;

    // 输入帧开始
    input.beginFrame();

    const screen = ui.screen;

    if (screen === 'game') {
      // 处理输入
      handleGameInput(api, input, scene, ui);

      // 更新场景（含战斗、AI、移动）
      scene.update(elapsed);

      // 更新 UI
      ui.update();
    } else if (screen === 'title') {
      // 标题界面：处理键盘输入（Enter/Space/J 开始新游戏）
      ui.handleTitleInput(input.state);
      // 更新 UI
      ui.update();
    }

    // 输入帧结束
    input.endFrame();

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
}

/** 处理游戏中的输入 */
function handleGameInput(api: EngineApi, input: InputManager, scene: SceneManager, ui: UIManager): void {
  const state = input.state;
  const player = scene.getPlayer();
  if (!player) return;

  // 对话中：确认键推进
  if (dialogueManager.isActive) {
    if (state.confirm) {
      dialogueManager.advance();
    }
    // 数字键选择
    if (state.skillPressed[0]) dialogueManager.choose(0);
    if (state.skillPressed[1]) dialogueManager.choose(1);
    if (state.skillPressed[2]) dialogueManager.choose(2);
    return;
  }

  // 商店中：E/Escape 关闭
  if (shopManager.isActive) {
    if (state.interact || state.menuToggle) {
      shopManager.close();
    }
    return;
  }

  // 菜单打开时
  if (ui.isMenuOpen) {
    if (state.menuToggle) {
      ui.hideMenu();
    }
    return;
  }

  // 菜单切换
  if (state.menuToggle) {
    ui.showMenu();
    return;
  }

  // 鼠标点击：屏幕坐标转世界坐标，优先检测 NPC 交互，否则设为移动目标
  if (state.mouseClicked) {
    const worldX = state.mousePos.x - api.world.x;
    const worldY = state.mousePos.y - api.world.y;
    // 先尝试点击 NPC 交互，未命中则设为移动目标
    if (!scene.tryInteractAtNpc({ x: worldX, y: worldY })) {
      scene.setClickTarget({ x: worldX, y: worldY });
    }
  }

  // 交互
  if (state.interact) {
    scene.interactWithNpc();
    return;
  }

  // 移动（键盘输入）
  const moveSpeed = player.speed;
  if (state.move.x !== 0 || state.move.y !== 0) {
    player.velocity.x = state.move.x * moveSpeed;
    player.velocity.y = state.move.y * moveSpeed;
    // 更新朝向
    if (state.move.x !== 0 || state.move.y !== 0) {
      player.facing = Math.atan2(state.move.y, state.move.x);
    }
  } else {
    // 无键盘输入时清零 velocity，SceneManager 的点击移动逻辑会在有点击目标时覆盖
    player.velocity.x = 0;
    player.velocity.y = 0;
  }

  // 平A
  if (state.attackPressed) {
    scene.getCombat().playerAttack();
  }

  // 技能
  for (let i = 0; i < 5; i++) {
    if (state.skillPressed[i]) {
      scene.getCombat().playerUseSkill(i);
    }
  }

  // 翻滚
  if (state.dodgePressed) {
    scene.getCombat().playerDodge();
  }
}

// 启动
main().catch((err) => {
  console.error('游戏启动失败:', err);
  document.body.innerHTML = '<div style="color:white;text-align:center;padding:50px;">游戏加载失败，请刷新重试。</div>';
});
