# 电子果蝇·香蕉大作战（Digital Fruit Fly: Banana Quest）

一只由**真实果蝇全脑连接组**（FlyWire FAFB v783：139,255 个神经元 / 2,698,236 条聚合
突触连接）上的 LIF 脉冲网络驱动的果蝇，在 2D 沙盒里靠嗅觉找香蕉吃。

> Eon 的闭环没开源，我们做一个浏览器里能跑的开源版。

零依赖、零构建：原生 ES modules + Canvas 2D + Web Worker，不装任何 npm 包。

## 运行

**在线试玩**：https://professorwang.github.io/flybrain-banana-quest/

本地运行（浏览器对 `fetch`/`Worker` 有同源限制，需要本地静态服务器）：

```bash
cd game
python -m http.server 8000
# 打开 http://localhost:8000
```

Windows / macOS / Linux 相同。首次加载需下载 12.4 MB 连接组二进制并解析
（约 1–3 秒），之后脑仿真在 Worker 里以 10 Hz 运行。

Node 烟雾测试（验证解析、组重排与"感觉→中枢"信号传播）：

```bash
node game/test/sim.test.mjs        # 退出码 0 为通过
```

无头闭环验证（不开浏览器，直接驱动脑+游戏跑 120s，应能吃到香蕉）：

```bash
node game/tools/headless_run.mjs 120
```

## 玩法

- 果蝇闻到香蕉气味（强度 ∝ 1/(1+距离)，按朝向分左右触角池）→ 电流注入
  连接组的嗅觉受体神经元 → 脉冲经触角神经叶、蘑菇体、侧角真实传播到下行
  神经元（GNG_DESC）→ 左右下行池放电率差驱动转向，总放电率 × 饥饿度驱动速度。
- 靠近香蕉后果蝇停下，甜味味觉受体（gus_sweet）被刺激；只有当脑中
  SEZ_FEED + 喙肌运动神经元池在 2 秒内放电超过阈值，香蕉才会被吃掉、得分 +1。
  **脑不点头，就吃不到。**
- 按钮：放香蕉（喂食）、触摸惊吓（点击果蝇同效）、吹风、光照切换、
  重置大脑/游戏；滑块实时调放电阈值、泄漏率、输入增益、脑 tick 频率。
- 放电太少时果蝇进入"待机噪声"随机游走——UI 会明确标注此时不是脑在驱动。

## 目录

```
game/
├── index.html              游戏入口（中文 UI）
├── css/style.css
├── data/
│   ├── connectome.bin.gz   FlyWire 连接组二进制（12.4 MB，snedea/flybrain 封装）
│   ├── neuron_meta.json    63 个功能组定义
│   └── pools.json          脑-游戏接口神经元池（tools/prepare_pools.py 生成）
├── src/
│   ├── sim-core.js         LIF 内核：解压/解析/CSR/组重排/tick（浏览器与 Node 共用）
│   ├── sim-worker.js       Worker 薄壳（init/start/stop/setInput/stimulate/setParams/reset）
│   ├── pools.js            池加载与读出位掩码
│   ├── game.js             游戏状态与感觉→脑→行为闭环
│   ├── renderer.js         Canvas 2D 竞技场渲染
│   ├── brain-view.js       63 组放电条形图 + 降采样 raster
│   ├── ui.js               HUD/滑块/按钮/科学诚实面板
│   └── main.js             组装与主循环（游戏时钟与脑 tick 解耦）
├── tools/
│   ├── prepare_pools.py    从 vendor 数据生成 pools.json（纯标准库）
│   └── headless_run.mjs    无头闭环验证
└── test/sim.test.mjs       Node 烟雾测试
```

## 科学说明（诚实清单）

**真实的部分**

- 连接组拓扑：FlyWire FAFB v783，139,255 神经元、2,698,236 条聚合连接，
  权重来自突触计数并带递质符号（GABA 抑制、其余兴奋）。
- 行为确实由这份拓扑上的脉冲传播驱动：没有手工行为层，转向/进食/逃离的
  每一步都先经过 13.9 万神经元的 LIF 网络。

**简化与人工选取的部分**

- LIF 是点神经元简化模型：无电导、无突触延迟、无神经调质、无可塑性。
- 权重按**突触后神经元总输入归一化**（`targetInput=3.0`，Shiu et al. 2024 思路）。
  调参记录：全局 max|w|→0.15（参考实现原样）在本数据上信号无法传出触角神经叶
  （个别 2405 的极端突触计数把中位数 8 的常规权重压到阈值千分之一以下）；
  每神经元归一化 1.0 只到蘑菇体，2.0 到不了下行神经元，3.0 全链路可通且
  无癫痫式饱和，4.0 全脑点燃。`sim-core.js` 保留 `normalization: 'global-max'`
  可切回参考实现行为。
- 感觉映射与运动读出是人工选取的：气味按果蝇朝向拆左右触角 ORN 池；
  GNG_DESC 按胞体 x 坐标切半当"左/右下行池"。实测该聚合数据存在结构偏置
  （任一侧刺激右池都更活跃，左右差仅约 1%），因此转向用对慢速 EMA 基线的
  偏差而非原始放电率——信号微弱且嘈杂本身就是科学事实的一部分。
- FlyWire 是脑（不含腹神经索 VNC）：真实果蝇的行走由 VNC 主导，这里的爬行
  只是下行神经元放电率的图形化映射，外加游戏层的减速-转身与墙壁反弹。
- 饥饿驱动是人工接线（饥饿度直接注入 DRIVE_HUNGER 组并放大嗅觉增益）。
- 本 demo 不代表"意识上传"。一只会动的果蝇本身并不证明生物保真度。

## 数据再生

`pools.json` 由以下命令重新生成（只读使用 `../vendor/snedea-flybrain/`）：

```bash
python game/tools/prepare_pools.py
```

池定义（全部索引为组排序后空间）：`olf_food_left/right`（组 6 按胞体 x 中位数
切半）、`olf_danger`（组 7）、`gus_sweet`（组 32）、`mech_bristle`（组 10）、
`vis_r1r6`（组 0 降采样 2000）、`desc_left/right`（组 35 按 x 切半）、
`feed_readout`（组 29 + 组 56）。坐标覆盖 100%，未使用 fallback。

## 许可

- 游戏代码：MIT（与上游 snedea/flybrain 保持一致）。
- 连接组数据：FlyWire，**CC BY-NC-SA 4.0**，仅限非商业用途。
- 详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
