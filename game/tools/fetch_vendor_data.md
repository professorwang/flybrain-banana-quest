# 上游数据固定获取与校验（reproduce from scratch）

本文件保证：新克隆仓库的人按下述步骤可重建 `game/data/` 全部数据（含符号变体）。
vendor/ 目录不入库（.gitignore），需自行获取以下两个上游仓库并核对哈希。

## 1. FlyWire 数据：snedea/flybrain（MIT）

```bash
git clone https://github.com/snedea/flybrain vendor/snedea-flybrain
cd vendor/snedea-flybrain && git checkout 9191824d17871b7851645782d53d23f213ddb938
```

数据许可证：FlyWire 连接组本体 CC BY-NC-SA 4.0（Dorkenwald et al. 2024, *Nature*）。

| 文件 | SHA-256 |
|---|---|
| `data/connectome.bin.gz` | `fbf8d440ca1207c7573e1acdd2366f9d0beb9b533c1710f21681264f81b1cc49` |
| `data/neurons.csv.gz` | `6a6b3759e635f0f35a677d169052362131ec61d95f55919298b55c43fce4e719` |
| `data/classification.csv.gz` | `e946b552f4056dfc977707be0674609832c3f64332a22d69dc0d9615e7aae663` |
| `data/connections.csv.gz` | `d49dd692e59e153aa3c83f5257bfc0eff51247b86d7bb183386c6d1622c70fc9` |
| `data/coordinates.csv.gz` | `14337121f451f98c2576cee72c24409ada5aaf7948b7c7ca8de9040296840e05` |
| `data/neuron_meta.json` | `a0d04cc964e23ebba476a9298bafe04387957c0cbbe2cb5edea5ecfcb2c47902` |

游戏用到的 `game/data/connectome.bin.gz` 与 `game/data/neuron_meta.json` 即上表两个
文件的**逐字节拷贝**（校验方法：`python -c "import hashlib;print(hashlib.sha256(open(p,'rb').read()).hexdigest())"`）。

## 2. MaleCNS 数据：blendi-remade/fly-brain-minecraft（MIT）

```bash
git clone https://github.com/blendi-remade/fly-brain-minecraft vendor/fly-brain-minecraft
cd vendor/fly-brain-minecraft && git checkout 6cfa30175003ef25da68a237d5eda958f8047b82
```

| 文件 | SHA-256 |
|---|---|
| `src/main/resources/connectome/malecns-v1.0.flyb.gz` | `e33df182bed7a6f3ea279daf4790a82b05706d3d41e819a6a80c0473e8c559f3` |

该哈希与上游 `PROVENANCE.md` §5 公布值一致。底层数据 neuPrint male-cns:v1.0 为
CC BY 4.0（Berg et al. 2026, *Cell*）；上游转换记录见 `PROVENANCE.md` §3
（≥5 突触阈值、自突触丢弃、ntSign 规则、FLYB v1 格式规范见 §4）。

## 3. 重建 game/data/ 全部产物

```bash
# FlyWire 池定义（复用 vendor 只读数据）
python game/tools/prepare_pools.py

# MaleCNS 三件套（connectome-malecns.bin.gz + neuron_meta_malecns.json + pools_malecns.json）
python game/tools/flyb_to_bin.py

# 符号变体（符号实验用，可不建）
python game/tools/flyb_to_bin.py --glut-excitatory   # MaleCNS glut 兴奋版
python game/tools/build_flywire_variant.py           # FlyWire glut 抑制版（含等价性自检）
```

重建后即可运行全部探针与测试：

```bash
node game/test/sim.test.mjs
node game/tools/probe_flywire.mjs
node game/tools/probe_malecns.mjs
node game/tools/probe_gain.mjs
node game/tools/probe_signflip.mjs
```
