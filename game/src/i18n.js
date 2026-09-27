/* i18n.js —— 界面语言（zh 默认 / en），集中字符串表与取用入口。
 *
 * 用法：
 *   import { t, setLang, getLang, applyI18n } from './i18n.js';
 *   - 静态元素：HTML 上加 data-i18n="key"（textContent）或 data-i18n-html="key"（innerHTML），
 *     由 applyI18n() 统一刷新（语言切换时重调）；
 *   - 动态文案：直接 t('key', {var: value})（{var} 占位符替换）；
 *   - 语言来源：URL ?lang=en|zh > localStorage('efly-lang') > 'zh'。
 * 术语与 TECH-NOTE 对齐：LIF、descending neurons、VNC、postsynaptic L1
 * normalization、heuristic high-pass readout。
 */

const STRINGS = {
  zh: {
    'title': '电子果蝇·香蕉大作战 — Digital Fruit Fly: Banana Quest',
    'hint.arena': '操作：点击果蝇 = 触摸惊吓 · 点击空白处 = 把香蕉放到那里',

    'hud.hunger': '饥饿度', 'hud.score': '得分', 'hud.behavior': '行为状态',
    'hud.active': '活跃神经元', 'hud.fired': '放电',
    'hud.tickms': '单 tick 耗时', 'hud.tickrate': '脑 tick 频率',
    'hud.statusInit': '初始化…',
    'block.status': '状态',

    'brain.title': '脑活动',
    'brain.legend': '{count} 功能组 · 蓝=感觉 紫=中枢 橙=驱动 绿=运动',

    'params.title': '参数（实时生效）',
    'params.threshold': '放电阈值', 'params.leak': '泄漏率',
    'params.gain': '输入增益', 'params.tickrate': '脑 tick 频率',

    'ops.title': '操作',
    'btn.banana': '放香蕉（喂食）', 'btn.poke': '触摸惊吓', 'btn.wind': '吹风',
    'btn.lightToDark': '关灯（黑暗）', 'btn.lightToLight': '开灯（光照）',
    'btn.resetBrain': '重置大脑', 'btn.resetGame': '重置游戏',

    'honesty.title': '科学诚实声明（必读）',
    'honesty.li1': '<b>真实：</b>连接组拓扑来自真实数据集（默认 <b>FlyWire FAFB v783</b>，139,255 神经元 / 2,698,236 条聚合连接；<code>?dataset=malecns</code> 时为 <b>MaleCNS v1.0</b> 雄性全中枢，176,422 神经元 / 6,287,749 条 ≥5 突触连接，含 VNC），行为由真实拓扑上的脉冲传播驱动。',
    'honesty.li2': '<b>近似：</b>LIF 动力学与权重归一化是简化模型。默认用 postsynaptic L1 归一化（本项目采用，非 Shiu 模型方案）；不是电导模型，无突触延迟与神经调质。归一化工作点因数据集而异（FlyWire 3.0 / MaleCNS 4.0，见 docs/malecns-probes.md）。',
    'honesty.li3': '<b>人工选取：</b>感觉映射（气味→触角 ORN 池左右拆分）与运动读出池是人工选取的，非解剖学精确（FlyWire 版按胞体 x 坐标切半，MaleCNS 版用原生 somaSide）；实测转向信号微弱（FlyWire 版还带结构偏置），已做基线校正。',
    'honesty.li4': '<b>缺失：</b>FlyWire 不含腹神经索（VNC）。真实果蝇的行走由 VNC 主导，本 demo 的"行走"只是下行神经元放电率的图形化映射（MaleCNS 虽含 VNC，本 demo 仍未模拟真实步态）。',
    'honesty.li5': '<b>边界：</b>本 demo 不代表"意识上传"。一只会动的果蝇本身并不证明生物保真度（此表述参照 awesome-fly 的免责声明精神）。',

    'footer': '连接组数据：FlyWire FAFB v783（Dorkenwald et al., 2024, <i>Nature</i>；CC BY-NC 4.0）· MaleCNS v1.0（Berg et al., 2026, <i>Cell</i>；CC BY 4.0）· 二进制整理与仿真参考：<a href="https://github.com/snedea/flybrain">snedea/flybrain</a>（MIT）与 <a href="https://github.com/blendi-remade/fly-brain-minecraft">fly-brain-minecraft</a>（MIT）· 详见 <a href="THIRD_PARTY_NOTICES.md">THIRD_PARTY_NOTICES.md</a>',

    'loading.init': '加载中…',
    'loading.connectome': '下载连接组二进制（{dataset}）…',
    'loading.worker': '启动仿真 Worker，解析 {edges}M 条突触连接…',
    'loading.pools': '加载神经元池…',
    'error.title': '出错了',
    'error.hint': '本游戏需要通过本地服务器访问：在 game/ 目录运行 <code>python -m http.server 8000</code> 后打开 http://localhost:8000',
    'error.initFailed': '初始化失败：{msg}。请确认通过本地服务器访问（见 README）。',
    'error.worker': 'Worker 错误：{msg}',
    'error.sim': '仿真错误：{msg}',

    'tagline': '{count} 个真实连接组神经元（{dataset}）正在驱动这只果蝇 · Eon 的闭环没开源，我们做一个浏览器里能跑的开源版 · 数据集：{dsName}',

    'status.escaping': '逃离（脑对惊吓的响应）',
    'status.eat': '进食！',
    'status.feeding': '味觉刺激中，等待进食指令…',
    'status.standby': '待机噪声（随机游走）',
    'status.forage': '脑驱动觅食中',

    'canvas.standby': '待机噪声（随机游走，非脑驱动）',
    'canvas.feeding': '味觉刺激中…等待脑进食指令',
    'canvas.eat': '进食！+1',
    'canvas.escaping': '逃离！',

    'ds.flywire': 'FlyWire FAFB v783（雌蝇全脑）',
    'ds.malecns': 'MaleCNS v1.0（雄蝇全中枢神经系，含 VNC）',

    'view.follow': '视角：跟随', 'view.overview': '视角：全景',
    'view.d3': '3D 视角', 'view.d2': '2D 视角',
  },

  en: {
    'title': 'Digital Fruit Fly: Banana Quest — 电子果蝇·香蕉大作战',
    'hint.arena': 'Controls: click the fly = startle · click anywhere else = place a banana there',

    'hud.hunger': 'Hunger', 'hud.score': 'Score', 'hud.behavior': 'Behavior',
    'hud.active': 'Active neurons', 'hud.fired': 'Firing',
    'hud.tickms': 'Per-tick time', 'hud.tickrate': 'Brain tick rate',
    'hud.statusInit': 'Initializing…',
    'block.status': 'Status',

    'brain.title': 'Brain activity',
    'brain.legend': '{count} functional groups · blue=sensory purple=central orange=drives green=motor',

    'params.title': 'Parameters (live)',
    'params.threshold': 'Firing threshold', 'params.leak': 'Leak rate',
    'params.gain': 'Input gain', 'params.tickrate': 'Brain tick rate',

    'ops.title': 'Controls',
    'btn.banana': 'Place banana (feed)', 'btn.poke': 'Startle (poke)', 'btn.wind': 'Wind puff',
    'btn.lightToDark': 'Lights off (dark)', 'btn.lightToLight': 'Lights on',
    'btn.resetBrain': 'Reset brain', 'btn.resetGame': 'Reset game',

    'honesty.title': 'Scientific honesty statement (please read)',
    'honesty.li1': '<b>Real:</b> the connectome topology comes from real datasets (default <b>FlyWire FAFB v783</b>, 139,255 neurons / 2,698,236 aggregated connections; with <code>?dataset=malecns</code>, <b>MaleCNS v1.0</b> male full CNS, 176,422 neurons / 6,287,749 connections at ≥5 synapses, with VNC); behavior is driven by spike propagation over this real topology.',
    'honesty.li2': '<b>Approximation:</b> LIF dynamics and weight normalization are simplified models. We use postsynaptic L1 normalization (adopted in this project, not Shiu et al.\'s scheme); no conductances, no synaptic delays, no neuromodulation. The working point is dataset-dependent (FlyWire 3.0 / MaleCNS 4.0, see docs/malecns-probes.md).',
    'honesty.li3': '<b>Hand-picked:</b> the sensory mapping (odor → left/right antennal ORN pools) and the motor readout pools are hand-designed, not anatomically precise (soma-x median split for FlyWire, native somaSide for MaleCNS); the steering signal is weak (and structurally biased for FlyWire), handled by a heuristic high-pass readout.',
    'honesty.li4': '<b>Missing:</b> FlyWire has no ventral nerve cord (VNC). Real fly walking is VNC-driven; the "walking" here is a graphical mapping of descending-neuron firing rates (MaleCNS includes the VNC, but this demo still does not simulate a real gait).',
    'honesty.li5': '<b>Boundary:</b> this demo does not represent "mind uploading". A moving fly does not by itself demonstrate biological fidelity (following the awesome-fly disclaimer).',

    'footer': 'Connectome data: FlyWire FAFB v783 (Dorkenwald et al., 2024, <i>Nature</i>; CC BY-NC 4.0) · MaleCNS v1.0 (Berg et al., 2026, <i>Cell</i>; CC BY 4.0) · binary packaging & simulator reference: <a href="https://github.com/snedea/flybrain">snedea/flybrain</a> (MIT) and <a href="https://github.com/blendi-remade/fly-brain-minecraft">fly-brain-minecraft</a> (MIT) · see <a href="THIRD_PARTY_NOTICES.md">THIRD_PARTY_NOTICES.md</a>',

    'loading.init': 'Loading…',
    'loading.connectome': 'Downloading connectome binary ({dataset})…',
    'loading.worker': 'Starting simulation worker, parsing {edges}M connections…',
    'loading.pools': 'Loading neuron pools…',
    'error.title': 'Something went wrong',
    'error.hint': 'This game needs a local server: run <code>python -m http.server 8000</code> in the game/ directory, then open http://localhost:8000',
    'error.initFailed': 'Initialization failed: {msg}. Please access via a local server (see README).',
    'error.worker': 'Worker error: {msg}',
    'error.sim': 'Simulation error: {msg}',

    'tagline': '{count} real connectome neurons ({dataset}) are driving this fly · Eon\'s closed loop is not open-source, so we built an open one that runs in a browser · dataset: {dsName}',

    'status.escaping': 'Escaping (brain startle response)',
    'status.eat': 'Eating!',
    'status.feeding': 'Gustatory input on, waiting for the feeding command…',
    'status.standby': 'Standby noise (random walk)',
    'status.forage': 'Brain-driven foraging',

    'canvas.standby': 'Standby noise (random walk, not brain-driven)',
    'canvas.feeding': 'Tasting… waiting for the brain\'s feeding command',
    'canvas.eat': 'Ate! +1',
    'canvas.escaping': 'Escape!',

    'ds.flywire': 'FlyWire FAFB v783 (female whole brain)',
    'ds.malecns': 'MaleCNS v1.0 (male full CNS, with VNC)',

    'view.follow': 'View: follow', 'view.overview': 'View: overview',
    'view.d3': '3D view', 'view.d2': '2D view',
  },
};

let current = detect();

function detect() {
  // 浏览器外（Node 工具链/测试 import 本模块计数或复用表时）无 location/localStorage
  if (typeof location === 'undefined' || typeof localStorage === 'undefined') return 'zh';
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'en' || q === 'zh') return q;
  const saved = localStorage.getItem('efly-lang');
  if (saved === 'en' || saved === 'zh') return saved;
  return 'zh';
}

export function getLang() { return current; }

/* 取字符串；{var} 占位符由 vars 替换 */
export function t(key, vars) {
  let s = (STRINGS[current] && STRINGS[current][key]) ?? STRINGS.zh[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export function setLang(lang) {
  current = (lang === 'en' || lang === 'zh') ? lang : 'zh';
  localStorage.setItem('efly-lang', current);
  applyI18n();
}

export function toggleLang() {
  setLang(current === 'zh' ? 'en' : 'zh');
  return current;
}

/* 刷新全部 data-i18n / data-i18n-html 静态元素与文档语言属性 */
export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  document.documentElement.lang = current === 'en' ? 'en' : 'zh-CN';
  document.title = t('title');
}

export { STRINGS };
