/* main.js —— 组装：加载数据 → 启动 worker → requestAnimationFrame 主循环。
 * 游戏时钟（rAF，约 60fps）与脑 tick（worker 内 setTimeout 节流，默认 10Hz）解耦。
 */
import { Pools } from './pools.js';
import { Game, ARENA } from './game.js';
import { Renderer } from './renderer.js';
import { BrainView } from './brain-view.js';
import { UI } from './ui.js';

const STIM_SEND_INTERVAL = 100;   // 持续刺激下发节流（ms）

let ui, game, renderer, brainView, pools, worker;
let tickHz = 10;                  // 当前脑 tick 频率（滑块可调）
let latestStats = null;
let lastStimSend = 0;
let lastFrame = 0;

async function boot() {
  ui = new UI({
    onBanana: () => game && game.placeBanana(),
    onPoke: doPoke,
    onWind: () => game && game.blowWind(),
    onLight: () => { if (game) ui.setLightButton(game.toggleLight()); },
    onResetBrain: () => worker && worker.postMessage({ type: 'reset' }),
    onResetGame: () => {
      if (!game) return;
      game.reset();
      game.placeBanana();
      worker && worker.postMessage({ type: 'reset' });
    },
    onParams: (p) => {
      if (p.tickRate !== undefined) tickHz = p.tickRate;
      worker && worker.postMessage({ type: 'setParams', ...p });
    },
    onGain: (v) => { if (game) game.inputGain = v; },
  });
  ui.setLoadingText('下载连接组二进制（12.4 MB）…');

  try {
    const [connResp, metaResp] = await Promise.all([
      fetch('data/connectome.bin.gz'),
      fetch('data/neuron_meta.json'),
    ]);
    if (!connResp.ok) throw new Error(`connectome.bin.gz 下载失败：HTTP ${connResp.status}`);
    if (!metaResp.ok) throw new Error(`neuron_meta.json 下载失败：HTTP ${metaResp.status}`);
    const buffer = await connResp.arrayBuffer();
    const meta = await metaResp.json();

    ui.setLoadingText('启动仿真 Worker，解析 269 万条突触连接…');
    worker = new Worker('src/sim-worker.js', { type: 'module' });
    worker.onerror = (e) => ui.showError(`Worker 错误：${e.message}`);

    const ready = await new Promise((resolve, reject) => {
      worker.onmessage = (e) => {
        if (e.data.type === 'ready') resolve(e.data);
        else if (e.data.type === 'error') reject(new Error(e.data.message));
      };
      worker.postMessage({ type: 'init', buffer }, [buffer]);
    });

    ui.setLoadingText('加载神经元池…');
    pools = await Pools.load('data/pools.json', ready.neuronCount);

    // 运行时按组选取的刺激池（MECH_JO 吹风、DRIVE_HUNGER 饥饿驱动）
    const extra = {
      mechJo: selectByGroup(ready.groupId, 11),
      driveHunger: selectByGroup(ready.groupId, 37),
    };

    brainView = new BrainView(
      document.getElementById('bar-canvas'),
      document.getElementById('raster-canvas'),
      meta, ready.groupId, ready.regionType);
    game = new Game(pools, extra);
    game.placeBanana();
    renderer = new Renderer(document.getElementById('arena-canvas'));
    bindArenaClick();

    // 接线 worker 消息
    worker.onmessage = (e) => {
      const d = e.data;
      if (d.type === 'tick') {
        const readout = pools.countReadout(d.firedIndices);
        game.onTick(readout, tickHz);
        brainView.onTick(d.firedIndices, d.groupSpikeCounts);
      } else if (d.type === 'stats') {
        latestStats = d;
      } else if (d.type === 'error') {
        ui.showError(`仿真错误：${d.message}`);
      }
    };
    worker.postMessage({ type: 'start' });

    ui.hideLoading();
    requestAnimationFrame(frame);
  } catch (err) {
    ui.showError(`初始化失败：${err.message}。请确认通过本地服务器访问（见 README）。`);
  }
}

function selectByGroup(groupId, gid) {
  const out = [];
  for (let i = 0; i < groupId.length; i++) if (groupId[i] === gid) out.push(i);
  return Uint32Array.from(out);
}

function doPoke() {
  if (!game || !worker) return;
  const burst = game.poke();
  worker.postMessage({ type: 'stimulate', indices: burst.indices, intensities: burst.intensities });
  renderer.triggerShockwave();
}

/* 点击竞技场：点在果蝇附近=触摸惊吓，点在别处=把香蕉放到那里 */
function bindArenaClick() {
  const canvas = document.getElementById('arena-canvas');
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (ARENA.w / rect.width);
    const y = (e.clientY - rect.top) * (ARENA.h / rect.height);
    if (Math.hypot(x - game.fly.x, y - game.fly.y) < 30) doPoke();
    else game.placeBanana(x, y);
  });
}

function frame(ts) {
  const dt = Math.min(0.1, (ts - lastFrame) / 1000 || 0.016);
  lastFrame = ts;

  // 节流下发持续刺激（worker 每 tick 施加最近一次 setInput）
  if (ts - lastStimSend >= STIM_SEND_INTERVAL) {
    lastStimSend = ts;
    const stim = game.buildStimulus();
    worker.postMessage({ type: 'setInput', indices: stim.indices, intensities: stim.intensities });
  }

  game.update(dt);
  renderer.draw(game, dt);
  brainView.draw();
  ui.update(game, latestStats);
  requestAnimationFrame(frame);
}

boot();
