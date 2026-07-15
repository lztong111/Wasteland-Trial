# 荒原试炼

基于 **React + TypeScript + Babylon.js + Havok Physics** 的三维动作 RPG 原型。

用于验证第三人称移动、战斗、成长、背包与本地存档组成的最小游戏闭环。

## 技术栈

| 类别 | 技术 |
| --- | --- |
| 界面 | React 19、TypeScript |
| 3D / 物理 | Babylon.js 9、Havok |
| 构建 | Vite 8 |
| 质量 | Vitest、Playwright、oxlint |

## 功能

- 第三人称镜头、相机相对移动、跳跃与物理碰撞
- 近战挥砍与远程投射物（真实时间驱动，非帧数）
- 敌人追击、攻击、受伤、死亡与经验奖励
- 程序化低多边形角色、怪物、武器与场景物件
- 等级、生命、体力、经验、背包与武器伤害
- 带版本与完整数据校验的浏览器本地存档
- 加载失败提示、资源释放与输入焦点隔离

## 环境要求

- Node.js `^20.19.0` 或 `>=22.12.0`
- npm 10+
- 支持 WebGL 2 与 WebAssembly 的现代浏览器

## 快速开始

```bash
npm install
npm run dev
```

开发服务器启动后，按终端提示在浏览器中打开页面。

## 操作

| 操作 | 按键 |
| --- | --- |
| 移动 | W / A / S / D |
| 跳跃 | 空格 |
| 近战攻击 | 鼠标左键 |
| 远程攻击 | 鼠标右键 |
| 打开 / 关闭背包 | I / Tab |
| 增加测试经验 | E |
| 转动镜头 | 移动鼠标（无需按住按键） |
| 释放鼠标锁定 | Esc |

键盘输入仅在游戏画布获得焦点时生效；点击背包不会触发攻击。

## 常用命令

```bash
npm run lint           # 静态检查
npm test               # 单元测试
npm run test:coverage  # 单元测试 + 覆盖率
npm run test:e2e       # Chromium 端到端测试
npm run build          # 类型检查 + 生产构建
npm run preview        # 预览生产产物
```

首次运行端到端测试前需安装浏览器：

```bash
npx playwright install chromium
```

## 目录结构

```text
src/
├── config/     游戏规则与数值配置
├── core/       引擎、场景与生命周期
├── data/       RPG 状态、类型与版本化存档
├── entities/   玩家实体与角色物理
├── models/     程序化网格（角色、敌人、武器等）
├── systems/    输入、战斗、敌人系统
├── ui/         React HUD 与背包界面
└── world/      场景环境模型
```

- 实时场景由 Babylon.js 驱动，React 只负责 UI
- `RPGManager` 为领域边界：只暴露冻结快照与校验后的修改方法
- 数值集中在 `src/config/gameConfig.ts`，改规则无需改系统实现

## 存档

- 存储：浏览器 `localStorage`
- 键名 / 版本：由 `gameConfig.save` 统一管理
- 校验：属性范围、背包容量、物品结构、重复编号、装备引用
- 无效或旧版本存档会被隔离，避免半损坏状态启动

## 当前限制

- 敌人使用轻量直线追击，无寻路与物理碰撞体
- 程序化低多边形美术，未接入外部骨骼动画、贴图与音频
- 仅单个本地存档槽位，无云存档与跨设备同步
- 端到端测试以 Chromium 为基线，移动端触控未实现

## License

Private prototype. 未开源授权时请勿对外分发。
