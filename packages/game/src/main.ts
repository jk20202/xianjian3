// main.ts
// 游戏入口：初始化 PixiJS、输入、场景、UI、手机控制，启动游戏循环

import { createEngine, watchResize } from './core/engine';
import type { EngineApi } from './core/engine';
import { InputManager } from './core/input';
import { World } from './ecs/world';
import { SceneManager } from './scene/SceneManager';
import { UIManager } from './ui/UIManager';
import { MobileControls, isMobile } from './ui/MobileControls';
import { dialogueManager } from './dialogue/DialogueManager';
import { shopManager } from './shop/ShopManager';

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

  // 设置坐标变换（竖屏旋转时将 clientX/clientY 转为 stage 局部坐标）
  input.setCoordinateTransform(api.toStageLocal);

  // 初始化手机控制
  const mobile = new MobileControls(api, input);
  const mobileMode = isMobile();

  // 将手机控制绑定到 UI（用于 show/hide）
  ui.setMobileControls(mobile);

  // 监听窗口尺寸变化
  watchResize(api, () => {
    mobile.layout();
  });
  window.addEventListener('resize', () => {
    mobile.layout();
  });

  // 游戏循环
  let lastTime = performance.now();

  function gameLoop(now: number): void {
    const elapsed = now - lastTime;
    lastTime = now;

    // 输入帧开始
    input.beginFrame();

    const screen = ui.screen;

    if (screen === 'game') {
      // 处理输入
      handleGameInput(api, input, scene, ui, mobile, mobileMode);

      // 更新场景（含战斗、AI、移动）
      scene.update(elapsed);

      // 更新 UI
      ui.update();

      // 更新手机控制
      mobile.update();
      // 交互按钮可见性
      mobile.setInteractVisible(scene.isNearNpc());
    } else if (screen === 'title') {
      // 标题界面：处理键盘输入
      ui.handleTitleInput(input.state);
      ui.update();
    }

    // 输入帧结束
    input.endFrame();

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
}

/** 处理游戏中的输入 */
function handleGameInput(
  api: EngineApi,
  input: InputManager,
  scene: SceneManager,
  ui: UIManager,
  mobile: MobileControls,
  mobileMode: boolean,
): void {
  const state = input.state;
  const player = scene.getPlayer();
  if (!player) return;

  // 对话中：确认键推进（点击由对话框自身 pointerdown 处理，避免重复推进）
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

  // 鼠标/触屏点击：屏幕坐标转世界坐标
  if (state.mouseClicked && !mobile.isOnControl(state.mousePos.x, state.mousePos.y)) {
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

  // 移动（键盘 + 虚拟摇杆）
  const moveX = state.move.x;
  const moveY = state.move.y;
  const moveSpeed = player.speed;
  if (moveX !== 0 || moveY !== 0) {
    player.velocity.x = moveX * moveSpeed;
    player.velocity.y = moveY * moveSpeed;
    player.facing = Math.atan2(moveY, moveX);
    // 有键盘/摇杆输入时清除点击目标
    scene.clearClickTarget();
  } else {
    // 无输入时清零 velocity，SceneManager 的点击移动逻辑会在有点击目标时覆盖
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
