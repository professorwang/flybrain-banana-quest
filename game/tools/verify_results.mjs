/* verify_results.mjs —— 一条命令复核：重跑全部符号干预实验，与 docs/results/ 里的归档逐字比对。
 *
 * 运行（仓库根目录；前置：vendor 数据与变体已按 tools/fetch_vendor_data.md 准备好）：
 *   node game/tools/verify_results.mjs            # 全部（约 20–40 分钟，视机器）
 *   node game/tools/verify_results.mjs --quick    # 只做导出统计 + 符号翻转八行（约 2 分钟）
 *
 * 比对规则：
 *   export_sign_tables.txt  python game/tools/export_sign_tables.py 重跑后逐字相同
 *   probe_signflip.txt      忽略 avgTick(ms) 列（受机器负载影响，其余放电计数逐位稳定）
 *   probe_controls.txt      逐字相同（不含计时字段）；controls_runs.csv 同
 *   probe_linear.txt        逐字相同
 * 比对前统一换行符（Windows 检出可能是 CRLF）。全部一致退出码 0，否则 1 并打印首个差异行。
 * 本脚本不修改 docs/results/ 下任何归档文件（controls 的 CSV 经 CONTROLS_CSV_OUT 写到临时目录）。
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const quick = process.argv.includes('--quick');
const py = process.platform === 'win32' ? 'python' : 'python3';
const tmp = mkdtempSync(join(tmpdir(), 'verify-'));
const norm = (s) => s.replace(/\r\n/g, '\n').replace(/\n+$/, '\n');
const read = (rel) => norm(readFileSync(join(root, rel), 'utf-8'));
const results = [];

function run(cmd, args, env = {}) {
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf-8', maxBuffer: 1 << 28, env: { ...process.env, PYTHONIOENCODING: 'utf-8', ...env } });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} 退出码 ${r.status}\n${r.stderr?.slice(-800)}`);
  return { out: norm(r.stdout || ''), secs: ((Date.now() - t0) / 1000).toFixed(0) };
}

function firstDiff(a, b) {
  const x = a.split('\n'), y = b.split('\n');
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if (x[i] !== y[i]) return `第 ${i + 1} 行\n    归档: ${x[i]}\n    重跑: ${y[i]}`;
  }
  return '';
}

function check(name, archived, fresh, secs) {
  const ok = archived === fresh;
  results.push({ name, ok, secs });
  console.log(`${ok ? '✔' : '✘'} ${name}（${secs}s）`);
  if (!ok) console.log('  首个差异：' + firstDiff(archived, fresh));
}

const dropAvgTick = (txt) => txt.split('\n').map((l) => {
  if (!l.startsWith('|')) return l;
  const cells = l.split('|');
  return cells.length === 9 ? [...cells.slice(0, 6), ...cells.slice(7)].join('|') : l; // 7 列表（split 后 9 段）：去掉第 6 列 avgTick
}).join('\n');

// 1) 导出统计（同时确认中间表可重建）
{
  const before = read('game/docs/results/export_sign_tables.txt');
  const { secs } = run(py, ['game/tools/export_sign_tables.py']);
  check('export_sign_tables.txt', before, read('game/docs/results/export_sign_tables.txt'), secs);
}
// 2) 符号翻转八行
{
  const { out, secs } = run('node', ['game/tools/probe_signflip.mjs']);
  check('probe_signflip.txt（忽略 avgTick 列）', dropAvgTick(read('game/docs/results/probe_signflip.txt')), dropAvgTick(out), secs);
}
if (!quick) {
  // 3) 对照实验（E0b/E1/E1b/E2）
  {
    const csvOut = join(tmp, 'controls_runs.csv');
    const { out, secs } = run('node', ['game/tools/probe_controls.mjs'], { CONTROLS_CSV_OUT: csvOut });
    check('probe_controls.txt', read('game/docs/results/probe_controls.txt'), out, secs);
    check('controls_runs.csv', read('game/docs/results/controls_runs.csv'), norm(readFileSync(csvOut, 'utf-8')), 0);
  }
  // 4) 每突触固定系数方案（E3/E3b/E3c）
  {
    const { out, secs } = run('node', ['game/tools/probe_linear.mjs']);
    check('probe_linear.txt', read('game/docs/results/probe_linear.txt'), out, secs);
  }
}
const bad = results.filter((r) => !r.ok).length;
console.log(`\n${bad === 0 ? '全部一致 ✔' : `有 ${bad} 项不一致 ✘`}（${results.length} 项${quick ? '，--quick 模式未含 controls/linear' : ''}）`);
process.exit(bad === 0 ? 0 : 1);
