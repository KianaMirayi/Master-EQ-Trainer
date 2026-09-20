# 🎧 Master Your EQ Listening (EQ 辨频听觉训练系统)

<p align="center">
  <b>面向音频工程师、混音师与音乐制作人的沉浸式、游戏化听音辨频训练平台。</b>
  <br />
  通过高保真实时频谱分析、A/B 盲听对比、M/S 混音处理与对数级视觉反馈，科学训练你的频谱听觉敏感度。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-blue?logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-6.2-646CFF?logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/TailwindCSS-4.0-38B2AC?logo=tailwind-css" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Web%20Audio%20API-Hardware%20Level-orange" alt="Web Audio API" />
</p>

---

## ✨ 核心特性

### 1. 🎮 游戏化关卡递进系统 (Level Progression)
- **100+ 梯度关卡**：从单频点基础识别、大增益宽 Q 值训练，逐步进阶到多节点、窄 Q 值、微小增益偏差及 Boss 关卡挑战。
- **智能评分与星级机制**：根据频率偏差（Frequency Error）、增益偏差（Gain Error）、Q 值拟合度综合计算得分与星级评定。
- **复习与测试模式**：支持自由选择关卡复习，针对低星关卡专项巩固。
- **双视图切换**：提供立体卡片轮播（Carousel View）与全局网格（Grid View）两种选关模式。

### 2. 🎛️ 专业级 Web Audio 处理引擎 (Audio Engine)
- **全格式双二阶滤波器 (Biquad Filter Graph)**：支持 Peaking（峰值滤波）、Low Shelf（低通搁架）、High Shelf（高通搁架）等多种滤波形态。
- **M/S (Mid/Side) 立体声分频处理**：
  - 支持将滤波器独立分配给 **Stereo（立体声）**、**Mid（中间/单声道信号）**、**Side（两侧立体声差信号）**。
  - 基于真实声学矩阵构建解码网络（$L' = Mid + Side, R' = Mid - Side$）。
- **实时 A/B 对比**：零延迟在目标频响曲线（Target）与用户调节曲线（User）之间瞬时切换试听。
- **带阻/带通独听 (Solo Band)** 与 **一键旁通 (Bypass)**。

### 3. 📊 高保真交互式 EQ 响应画布 (EQ Canvas)
- **对数刻度网格 (20Hz – 20kHz)**：贴合人耳听觉心理声学的非线性频率分布与精确到 0.1dB 的增益刻度。
- **动态曲线融合与辉光**：
  - 双层渐变辉光路径与平滑贝塞尔曲线插值。
  - M/S 模式下自动计算差值动态解耦渲染（Mid 绿调 / Side 蓝调高对比辨识）。
  - 扫频动画（Sweep Waveform）与结算差值可视化遮罩。
- **悬浮操作控制台 (Floating Panel)**：集成模拟硬件阻尼旋钮（Knob）、输入限制指示与快开开关。

### 4. 🌊 拟真低延迟实时频谱分析 (Smooth Spectrum)
- **频段自适应抗锯齿采样**：低频采用余弦插值（Cosine Interpolation）消除阶梯感，高频采用峰值保持（Max Hold）捕捉瞬态打击感。
- **形态学膨胀与高斯空间平滑**：滤除屏幕杂散噪点，呈现如同高端硬件分析仪般的平滑流动曲线。
- **非对称时间弹道包络**：快速 Attack（快速紧跟声音瞬态）与平缓 Release（提供舒适的视觉暂留）。

### 5. 🎚️ 广播级峰值/RMS 电平表 (Level Meter)
- 支持真峰值（True Peak）与有效值（RMS）双层指示。
- 具备 60 帧 Peak Hold 峰值保持与过载报警。

### 6. 📁 音频管理与离线存储
- 内置针对人声、鼓组、全频段粉噪（Pink Noise）等多种专业基准音轨。
- 支持拖拽上传自定义本地音轨，通过 IndexedDB（`idb-keyval`）进行浏览器本地持久化缓存。

---

## ⌨️ 常用快捷键 (Key Bindings)

| 快捷键 | 功能描述 |
| :--- | :--- |
| **`C`** | 切换监听模式（**User** 你的调整 vs **Target** 目标音色） |
| **`Z`** | 全局旁通（Bypass / 恢复所有 EQ 节点） |
| **`B`** | 针对当前选中节点的单点旁通切换 |
| **`S` 或 `L`** | （按住）**Solo 独听**当前选中的频段，松开恢复正常监听 |
| **鼠标滚轮** | 悬停或拖拽节点时快速调节 **Q 值（带宽）**（配合 `Shift` 可微调） |
| **`Alt` + 垂直拖拽** | 快速拉伸调节当前节点的 Q 值 |
| **双击节点** | 快速将该节点的增益重置为 0 dB |
| **Enter** | 提交当前答案 / 进入关卡结算 |
| **Space** | 播放 / 暂停音频 |

---

## 🛠️ 技术栈

* **核心框架**：React 19 + TypeScript
* **构建工具**：Vite 6.2
* **样式架构**：Tailwind CSS v4 + Motion / Framer Motion
* **音频与图形**：Web Audio API (AudioContext + AnalyserNode + BiquadFilterNode) + HTML5 2D Canvas
* **本地与云端存储**：IndexedDB (`idb-keyval`) + Firebase Firestore (可选排行榜与用户云同步)
* **图标库**：Lucide React

---

## 🚀 本地开发与启动

### 前置要求
- [Node.js](https://nodejs.org/) (建议 v18 及以上版本)
- [npm](https://www.npmjs.com/) 或 [pnpm](https://pnpm.io/)

### 安装与运行
```bash
# 1. 克隆本仓库
git clone <your-repo-url>
cd <your-repo-dir>

# 2. 安装项目依赖
npm install

# 3. 启动本地开发服务器
npm run dev
```

启动后在浏览器中访问：`http://localhost:3000` 即可开始训练。

### 生产打包
```bash
# 构建生产环境产物至 dist/ 目录
npm run build

# 本地预览打包后的产物
npm run preview
```

---

## 📂 项目目录结构概览

```text
├── public/                # 静态音轨与应用资源
├── src/
│   ├── components/        # UI 与核心业务组件
│   │   ├── EQCanvas.tsx           # EQ 对数坐标画布、交互节点与平滑频谱绘制
│   │   ├── GameView.tsx           # 关卡挑战核心主视图
│   │   ├── LevelMeter.tsx         # 硬件级 Peak / RMS 立体声动态电平表
│   │   ├── Knob.tsx               # 拟物拟音阻尼控制旋钮
│   │   ├── FreeTrainingView.tsx   # 自由练习模式
│   │   ├── DailyTrainingView.tsx  # 每日特色频段训练
│   │   └── ...
│   ├── lib/               # 核心逻辑与算法库
│   │   ├── AudioEngine.ts         # Web Audio API 滤波器图谱与 M/S 矩阵解码实现
│   │   ├── LevelManager.ts        # 关卡数据、规则解析与晋级判定
│   │   ├── ScoreCalculator.ts     # 听音辨频多维误差拟合打分算法
│   │   ├── TrackManager.ts        # 音频加载、缓存与代理调度
│   │   └── utils.ts               # 对数坐标/像素映射、颜色插值等数学工具
│   ├── App.tsx            # 应用全局状态、导航模式与顶层视图调度
│   └── main.tsx           # React 应用入口
├── vercel.json            # 单页应用路由重写规则
└── package.json           # 项目依赖与运行脚本
```

---

## 📄 许可证 (License)

本项目采用 [MIT License](LICENSE) 开源许可。
