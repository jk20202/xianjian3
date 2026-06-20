# 仙剑奇侠传3 风格 ARPG 小游戏 — 设计文档

- **项目代号**：pal3-lite
- **文档日期**：2026-06-19
- **状态**：设计已与用户对齐，待实现
- **目标**：做一个仙剑奇侠传3 风味的单机 ARPG 小游戏，地图自由走动、实时平A/放技能、多角色组队、剧情线 + 任务推进、商店与安全区、本地存档可回档。先做 Web 端测试，预留 APP/小程序适配，最终可能部署 Vercel/Cloudflare 或云服务器。

---

## 0. 核心决策（与用户对齐结果）

| 维度 | 决策 |
|---|---|
| 游戏类型 | 单机 ARPG（俯视角、地图自由走动、实时战斗） |
| 美术风格 | MVP 用几何/简笔占位图先跑通逻辑，逻辑与美术解耦，后续可换皮 |
| 渲染引擎 | TypeScript + PixiJS 8 |
| Web 构建 | Vite（纯静态产物，Vercel/Cloudflare 零配置部署） |
| APP 打包 | Capacitor（Web 构建包成原生 APP，游戏代码零改动） |
| 小程序 | 阶段四做，预留适配层 |
| 战斗角色 | 主角单控（景天）+ AI 队友，战斗中预留 Tab 切换控制权 |
| 存档 | 本地缓存优先（IndexedDB / 文件），暂不做云端同步 |
| 三端共通 | 物理上需后端搬运数据，**分阶段**：阶段一~三纯本地，阶段四加轻量后端同步 |
| 架构 | 方案 A：模块化单体（`packages/game/` 单包 + `platforms/` 薄适配层） |

---

## 1. 技术栈与目录结构

### 1.1 技术栈

- **语言**：TypeScript 5（严格模式）
- **渲染引擎**：PixiJS 8（Web/APP 共用，2D 性能强、生态成熟）
- **Web 构建**：Vite（开发热更新快、产物是纯静态文件，Vercel/Cloudflare 零配置部署）
- **APP 打包**：Capacitor（把 Web 构建包成原生 APP，无需重写游戏代码）
- **小程序**：预留 `platforms/miniapp/` 适配层，MVP 不做（阶段四）
- **存档**：Web 用 IndexedDB（容量大、支持存档快照）；APP 用原生文件系统；都封装在 `save/` 抽象层后面，业务代码不直接碰存储 API
- **状态管理**：轻量自建（不引 Redux 这类重型库），用 EventEmitter + 不可变快照模式
- **测试**：Vitest（单元测试核心逻辑：伤害计算、任务触发、存档序列化）

### 1.2 目录结构

```
pal3-lite/
├── packages/
│   └── game/
│       ├── src/
│       │   ├── core/         游戏循环、输入、PixiJS 封装
│       │   ├── ecs/          实体组件系统（角色/怪物/投射物/可交互物）
│       │   ├── scene/        场景管理（场景切换、安全区/野外判定）
│       │   ├── combat/       战斗（平A、技能、伤害公式、AI队友、仇恨）
│       │   ├── quest/        任务系统（主线/支线、触发器、章节解锁）
│       │   ├── dialogue/     剧情对话（分支、立绘占位、表情）
│       │   ├── shop/         商店交易
│       │   ├── save/         存档/回档（IndexedDB 抽象层）
│       │   ├── data/         数据表：角色/技能/地图/怪物/剧情/商品（TS）
│       │   ├── ui/           HUD、菜单、对话框、商店界面
│       │   └── main.ts       入口：初始化 Pixi、加载首场景
│       ├── tests/            单元测试
│       └── index.html        Web 入口
├── platforms/
│   ├── web/                  Vite 配置 + 部署产物
│   ├── app/                  Capacitor（Android/iOS）
│   └── miniapp/              微信小程序适配（阶段四，先留空目录）
└── docs/
    └── superpowers/specs/    本设计文档存放处
```

### 1.3 模块依赖方向（单向，防循环耦合）

```
main.ts → ui, scene
ui      → 所有子系统（只读数据 + 发指令）
scene   → ecs, combat, dialogue, quest, shop, save
ecs     → core
combat  → ecs, core, data
quest   → data, save
dialogue→ data, quest
shop    → data, save
save    → data（序列化快照）
data    → （纯数据，无依赖，叶子层）
core    → （PixiJS 封装，叶子层）
```

**核心原则**：`data/` 是纯数据叶子层，没有任何依赖；所有逻辑模块只读 `data/` 定义的结构，通过事件总线（EventEmitter）通信。换皮（改 `data/` 美术资源引用）不动逻辑。

---

## 2. 数据模型（角色 / 技能 / 五灵属性）

### 2.1 五灵属性系统

风、雷、水、火、土，循环相克：风→雷→水→火→土→风。攻击克制方 +50% 伤害，被克方 -25%。每个角色/怪物有一个主属性，部分技能带属性。

```ts
type Element = 'wind' | 'thunder' | 'water' | 'fire' | 'earth';
// 克制表：key 克制 value
const COUNTERS: Record<Element, Element> = {
  wind: 'thunder', thunder: 'water', water: 'fire', fire: 'earth', earth: 'wind',
};
```

### 2.2 角色定位（贴合仙剑3 队友）

| 定位 | 代表角色 | 主属性 | 攻击距离 | 特点 |
|---|---|---|---|---|
| 战士 | 景天（主角） | 火 | 近 | 高血高防，平A为主 |
| 剑士 | 长卿 | 雷 | 近-中 | 攻速快，连击技能 |
| 法师 | 雪见 | 土 | 远 | 群体法术，脆皮 |
| 法师 | 龙葵 | 雷 | 远 | 单体高爆发 |
| 治疗 | 紫萱 | 水 | 远 | 回复 + 增益 |

### 2.3 角色数据结构（`data/characters.ts`）

```ts
interface CharacterDef {
  id: string;              // 'jingtian'
  name: string;            // '景天'
  role: 'warrior' | 'swordsman' | 'mage' | 'healer';
  element: Element;
  baseStats: Stats;        // 力/灵/体/速/运
  growth: Stats;           // 每级成长
  skills: string[];        // 可学技能 id 列表（按等级解锁）
  portrait: VisualRef;     // 立绘占位（几何色块代号）
  sprite: VisualRef;       // 战场精灵占位
}

interface Stats {
  hp: number; mp: number;
  atk: number; def: number;   // 物理
  mag: number; res: number;   // 法术
  spd: number;                 // 决定出手顺序与移动速度
  crit: number; critDmg: number;
}
```

### 2.4 技能数据结构（`data/skills.ts`）

```ts
interface SkillDef {
  id: string;              // 'feitian_daxue'
  name: string;            // '飞天龙女'
  element?: Element;       // 无属性 = 物理
  type: 'physical' | 'magic' | 'heal' | 'buff';
  targetType: 'enemy' | 'ally' | 'self' | 'aoe_enemy' | 'aoe_ally';
  range: number;           // 像素
  aoeRadius?: number;
  mpCost: number;
  cooldown: number;        // 毫秒
  power: number;           // 倍率（× 攻击力）
  learnLevel: number;      // 几级可学
  effect: VisualRef;       // 技能特效占位
}
```

---

## 3. 战斗系统（实时 ARPG）

### 3.1 核心循环

固定步长（60Hz 逻辑 + PixiJS 渲染插值）。所有战斗逻辑在 `combat/` 内，与渲染解耦——便于换皮/单元测试。

### 3.2 输入与操作（主角）

- WASD/方向键 移动（8 方向，自由走动）
- J = 平A（无冷却，按攻速间隔限频）
- K/L/U/I/O = 5 个技能槽（带冷却 UI）
- Space = 翻滚（短无敌帧）
- Tab = 战斗中切换"主动控制的目标"（在队友间切换，预留接口）

### 3.3 平A与技能

- **平A**：朝向扇形判定，物理伤害，有轻微硬直和击退。
- **技能**：按 `SkillDef` 生成投射物/范围圈/瞬时判定，命中结算伤害、消耗 MP、进冷却。AOE 画扩散圈命中范围内所有敌人。

### 3.4 AI 队友（行为树简化版）

每个队友一个轻量状态机：`巡逻 / 追击 / 攻击 / 施法 / 后撤治疗`，按职业自动选行为：
- 战士/剑士：贴近平A + 冷却好就用近战技能
- 法师：保持距离，敌人靠近就放法术后拉开
- 治疗：血量最低队友 < 50% 时优先治疗，否则平A补刀

### 3.5 伤害公式

```
基础伤害 = 攻击力(物理 atk 或法术 mag) × 技能倍率
防御减免 = 基础 / (基础 + 防御力)      // 软防御，不会出现"打不动"
属性修正 = 克制 ? ×1.5 : 被克 ? ×0.75 : ×1.0
暴击     = 暴击率判定 ? × 暴击伤害 : ×1.0
波动     = ±10% 随机
最终伤害 = round(基础 × 防御 × 属性 × 暴击 × 波动)
```

数值在 `data/` 集中可调，方便平衡。

### 3.6 死亡与复活

- 主角 HP 归 0 = 战斗失败（回到城镇、扣少量金钱）
- 队友倒地后战斗结束自动复活，或紫萱治疗可救起

---

## 4. 剧情 / 对话 / 任务系统

### 4.1 对话系统（`dialogue/`）

数据驱动的对话树，每段对话是节点，支持立绘 + 文字 + 打字机效果、选项分支（影响后续任务/好感度，MVP 先做线性 + 少量二选一）、对话结束触发任务推进事件。

```ts
interface DialogueNode {
  speaker: string;          // 角色 id
  portrait: string;         // 表情代号
  text: string;
  choices?: { text: string; next: string; setFlag?: string }[];
  next?: string;            // 无选项时的下一节点
  onEnd?: Action[];         // 完成时触发动作（给任务、给道具、改好感）
}
```

### 4.2 任务系统（`quest/`）

主线 + 支线，统一数据结构：

```ts
interface QuestDef {
  id: string;
  type: 'main' | 'side';
  chapter: number;
  giver: string;            // NPC id（null = 自动触发）
  title: string;
  desc: string;
  objectives: Objective[];  // 多目标（杀 N 个怪/到达地点/对话/收集）
  rewards: Rewards;         // 经验/金钱/道具/技能解锁
  unlocks: string[];        // 完成后解锁：下一任务/地图区域/技能
  prerequisites: string[];  // 前置任务
  isChapterGate?: boolean;  // 章节门任务
}

type Objective =
  | { kind: 'kill'; monsterId: string; count: number }
  | { kind: 'reach'; areaId: string }
  | { kind: 'talk'; npcId: string }
  | { kind: 'collect'; itemId: string; count: number };
```

### 4.3 章节门

每章结尾一个 `isChapterGate: true` 的主线任务，完成后 `unlocks` 下一章初始区域，地图上解锁新区域入口。未解锁区域入口显示"封印/迷雾"占位，靠近提示需要推进剧情。

### 4.4 任务派发流程

NPC 头顶 `?`（可接）/ `!`（进行中回交）/ `✓`（可交付）。对话接取 → HUD 任务追踪栏显示当前目标 → 完成回 NPC 交付 → 触发奖励与解锁。

---

## 5. 地图 / 场景 / 商店 / 安全区

### 5.1 地图系统（`scene/`）

基于瓦片的俯视地图，每张地图一个 `MapDef`：

```ts
interface MapDef {
  id: string;               // 'yuzhou_city'
  name: string;             // '渝州城'
  tiles: number[][];        // 瓦片 id（0 空地/1 墙/2 草/3 水...）
  width: number; height: number;
  isSafeZone: boolean;      // true = 城镇，无怪、可补给
  spawns: SpawnDef[];       // 怪物刷新点（安全区为空）
  npcs: NpcPlacement[];     // NPC 位置
  exits: ExitDef[];         // 出口（连接其他地图）
  shops?: ShopDef[];        // 商店（安全区才有）
}
```

### 5.2 渐进开放

- **相邻出口**：第一章区域内自由走动（渝州城 ↔ 渝州郊外 ↔ 古道）
- **章节门出口**：通往下一章区域，被"未完成章节任务"锁住，靠近显示提示。

### 5.3 场景类型

- **城镇/安全区**（渝州城）：无敌对怪；有商店、任务 NPC、存档点（发光的水晶/石碑占位）、传送点；进入即自动存档。
- **野外/迷宫**（渝州郊外、古道、锁妖塔外围）：**明雷**（地图上看得见的怪，碰到触发战斗），比暗雷体验好、实现简单。

### 5.4 遇敌方式

明雷触发后进入**就地战斗**（不切场景，地图上的怪直接进入 AI 战斗状态），主角与队友在当前地图上实时打。最自由、最贴合"地图上随意走动打斗"。Boss 战同理，体型更大、血更厚、有特殊技能。

### 5.5 商店（`shop/`）

安全区 NPC 经营，UI 列表式（占位几何按钮）：

```ts
interface ShopDef {
  npcId: string;
  items: { itemId: string; price: number; stock?: number }[];  // stock=undefined 无限
  buybackRate: number;   // 回收折扣，默认 0.5
}
```

商品分：消耗品（回复药）、装备（武器/防具，颜色区分品质）、材料。买卖改库存与金钱，操作进存档。

---

## 6. 成长 / 装备 / 经济

- **经验与升级**：杀怪/完成任务给经验，升级提升属性（按 `growth`），到 `learnLevel` 自动习得新技能。
- **装备**：武器/衣服/饰品槽，占位几何图标。加属性，稀有度用边框颜色区分（白/绿/蓝/紫）。MVP 装备掉落 + 商店购买两条获取线。
- **经济**：金钱来自战斗掉落 + 卖道具；消耗于商店购买。数值在 `data/economy.ts` 集中调。

---

## 7. 存档与回档

### 7.1 存档模型（`save/`）

IndexedDB（Web）/ 文件（APP）存"游戏状态快照"。多槽位 + 自动存档 + 回档历史三层：

```ts
interface SaveSlot {
  slotId: number;            // 0-2 手动槽 + 'auto' 自动槽
  meta: { chapter: number; playtime: number; savedAt: number; location: string; level: number };
  state: GameState;          // 完整游戏状态（角色/物品/任务/标记/位置）
}

interface GameState {
  version: number;           // 存档版本号，方便后续迁移
  flags: Record<string, boolean | number>;   // 任务/剧情标记
  party: PartyState;         // 队伍：等级/属性/技能/装备/位置
  inventory: InventoryState; // 背包
  quests: { active: string[]; done: string[] };
  currentMap: string;
  position: { x: number; y: number };
  gold: number;
  history: SaveSnapshot[];   // 回档用：关键节点的快照栈
}
```

### 7.2 自动存档

每次进入安全区、完成任务、章节切换时，写入 `auto` 槽。

### 7.3 回档

- **手动回档**：标题菜单"读取存档"可选任意槽位（含自动槽），加载即回。
- **章节回溯**（增强）：每章开始时存一个"章节起点快照"压入 `history`，玩家可从菜单"回到上一章起点"，损失当前章节进度但不丢之前的。

### 7.4 存档抽象层

`save/` 暴露 `load(slot)`/`save(slot)`/`listSlots()`，内部按平台走 IndexedDB 或原生文件。业务代码（quest/shop/combat）只通过事件触发"请求存档"，不碰存储 API，三端切换零改动。

### 7.5 回档安全

每次写存档前先校验 `version` 并做 schema 迁移；加载失败时回退到上一个可用快照并在 UI 提示。

---

## 8. UI / HUD

- **标题界面**：开始新游戏 / 继续游戏（存档槽列表）/ 设置。
- **战斗 HUD**：左上队伍血条 + MP 条；下方技能栏（5 技能 + 冷却覆盖 + MP 消耗）；右上小地图占位；中央伤害飘字、暴击/克制提示。
- **菜单**：状态（属性）、背包、技能、任务日志、地图、存档、设置。Tab 切换。
- **对话框**：底部，立绘在左，打字机文字，选项按钮在右。
- **商店界面**：左右分栏（买/卖），中间金钱显示。
- 全部用 PixiJS 绘制几何占位（圆角矩形 + 文字），保证 MVP 速度；预留主题色便于换皮。

---

## 9. 第一章剧本设计（渝州风云）

### 9.1 背景

贴合仙剑3 开场。主角景天是渝州城当铺小伙计，一日当铺来了一位神秘客人典当古剑，引发异变。景天卷入其中，结识雪见，开始冒险。

### 9.2 第一章流程（主线 + 2 个支线）

| 步骤 | 内容 | 玩法 | 解锁 |
|---|---|---|---|
| 1 | 渝州城·当铺：景天遇神秘客人典当古剑，触发异象 | 对话 + 教学（移动/平A） | 城内自由活动 |
| 2 | 城中骚动，妖物入侵当铺 | 第一场战斗教学（平A + 1 技能） | 紫萱短暂助阵后离队 |
| 3 | 追踪妖物到渝州郊外 | 明雷野外战斗，学第 2 技能 | 郊外区域开放 |
| 4 | 郊外遇雪见（被妖物围攻），救援 | Boss 战：郊外妖首（土属性） | 雪见入队（法师） |
| 5 | 雪见带景天回城找当铺老板问古剑来历 | 对话 + 接主线"调查古剑" | 解锁古道入口 |
| 6 | **章节门**：完成"调查古剑"主线（古道清怪 + 找线索 NPC） | 古道野外 + 支线触发 | 完成后解锁第二章入口 |

### 9.3 两个支线

- **支线A「丢失的玉佩」**：城内妇人 NPC，找回被小妖偷走的玉佩 → 奖励金钱 + 回复药。
- **支线B「古道采药」**：古道 NPC，采集 3 株草药 → 奖励材料 + 经验。

### 9.4 第一章产出

可走动 3 张地图（渝州城/郊外/古道）、2 种以上普通怪 + 1 Boss、4-5 个技能、商店、存档/回档、完整剧情对话与任务流程。玩完能清楚感受到"仙剑3 风味的 ARPG 第一章"。

---

## 10. 分阶段交付路线

| 阶段 | 目标 | 产出 |
|---|---|---|
| **MVP-1** | 核心可玩循环 | 战斗（平A+2技能）、1张野外地图、明雷、存档基础、能从标题玩到打完一场战斗 |
| **MVP-2** | 第一章剧情闭环 | 渝州城+郊外+古道、对话系统、任务系统、雪见入队、Boss战、商店、自动+手动存档、回档 |
| **阶段三** | 丰富化 | 更多技能、装备掉落、支线、平衡调优、音效占位 |
| **阶段四** | 三端 | Capacitor 打 APP；小程序适配层；最后才加云存档同步 |

**当前先做 MVP-1 → MVP-2**（即第一章），跑通后再扩展。

---

## 11. 非目标（YAGNI）

明确**不在 MVP-2 范围**，避免范围蔓延：

- ❌ 云端账号 / 三端数据同步（阶段四）
- ❌ 精修美术（像素/手绘）—— MVP 用几何占位
- ❌ 小程序端实际运行 —— 阶段四
- ❌ 多人联机 —— 不做，单机
- ❌ 副本/成就/排行榜 —— 不做
- ❌ 全语音 / BGM —— MVP 用占位静音或单段音效
- ❌ 战斗中切场景的回合制 —— 明确是 ARPG 就地战斗

---

## 12. 风险与缓解

| 风险 | 缓解 |
|---|---|
| ARPG 实时战斗的手感打磨耗时 | 先用数值 + 简单动画跑通，手感迭代放到阶段三 |
| 几何占位观感差、影响判断"好不好玩" | 用清晰的颜色编码 + 文字标签 + 流畅动效弥补，确保可玩性判断不受阻 |
| 小程序对 PixiJS/WebGL 兼容性不确定 | 阶段四先做可行性验证（spike），不行则小程序端走 Canvas 2D 适配层 |
| 存档 schema 后续变更导致旧档失效 | `GameState.version` + 迁移函数，加载时自动迁移 |
| 三端共通与本地缓存看似矛盾 | 物理分离：本地缓存先做满，云端同步是阶段四加法 |

---

## 13. 验收标准（MVP-2 = 第一章）

一个玩家从零开始：

1. 打开 Web 端，看到标题界面，能新建游戏或读取存档。
2. 进入渝州城，能用 WASD 自由走动，与 NPC 对话接取主线。
3. 触发当铺战斗教学，能平A + 放技能击杀妖物（含暴击/属性克制反馈）。
4. 紫萱短暂 AI 助战，体验组队感。
5. 走到郊外，明雷触发野外战斗，习得新技能。
6. 击败郊外妖首 Boss，雪见入队。
7. 回城在商店买卖物品。
8. 完成古道章节门任务，解锁第二章入口提示。
9. 任何时候可手动存档；进入安全区自动存档；可从菜单回档（含章节回溯）。
10. 关闭浏览器再打开，存档仍在，可继续。

满足以上 10 条 = MVP-2 完成。
