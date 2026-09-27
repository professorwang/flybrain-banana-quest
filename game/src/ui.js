/* ui.js —— HUD、参数滑块、按钮与科学诚实面板的状态管理。DOM 结构见 index.html。
 * 动态文案统一从 i18n 取（静态标签由 index.html 的 data-i18n 属性承担）。 */
import { t } from './i18n.js';

export class UI {
  /**
   * callbacks: { onBanana, onPoke, onWind, onLight, onResetBrain, onResetGame,
   *              onParams({leakRate?, threshold?, tickRate?}), onGain(v) }
   */
  constructor(callbacks) {
    this.cb = callbacks;
    const $ = (id) => document.getElementById(id);
    this.el = {
      hungerFill: $('hud-hunger-fill'), hungerText: $('hud-hunger-text'),
      score: $('hud-score'), status: $('hud-status'),
      active: $('hud-active'), fired: $('hud-fired'),
      tickms: $('hud-tickms'), tickrate: $('hud-tickrate'),
      threshold: $('slider-threshold'), leak: $('slider-leak'),
      gain: $('slider-gain'), tickrateSlider: $('slider-tickrate'),
      thresholdVal: $('slider-threshold-val'), leakVal: $('slider-leak-val'),
      gainVal: $('slider-gain-val'), tickrateVal: $('slider-tickrate-val'),
      btnLight: $('btn-light'),
      honesty: $('honesty'),
    };

    // 按钮
    $('btn-banana').onclick = () => this.cb.onBanana();
    $('btn-poke').onclick = () => this.cb.onPoke();
    $('btn-wind').onclick = () => this.cb.onWind();
    this.el.btnLight.onclick = () => this.cb.onLight();
    $('btn-reset-brain').onclick = () => this.cb.onResetBrain();
    $('btn-reset-game').onclick = () => this.cb.onResetGame();

    // 滑块：实时下发参数
    this.el.threshold.oninput = () => {
      const v = Number(this.el.threshold.value);
      this.el.thresholdVal.textContent = v.toFixed(2);
      this.cb.onParams({ threshold: v });
    };
    this.el.leak.oninput = () => {
      const v = Number(this.el.leak.value);
      this.el.leakVal.textContent = v.toFixed(2);
      this.cb.onParams({ leakRate: v });
    };
    this.el.gain.oninput = () => {
      const v = Number(this.el.gain.value);
      this.el.gainVal.textContent = v.toFixed(2);
      this.cb.onGain(v);
    };
    this.el.tickrateSlider.oninput = () => {
      const v = Number(this.el.tickrateSlider.value);
      this.el.tickrateVal.textContent = `${v} Hz`;
      this.cb.onParams({ tickRate: v });
    };

    // 科学诚实面板：默认展开一次，之后记住用户选择
    const saved = localStorage.getItem('efly-honesty-open');
    this.el.honesty.open = saved === null ? true : saved === '1';
    this.el.honesty.addEventListener('toggle', () => {
      localStorage.setItem('efly-honesty-open', this.el.honesty.open ? '1' : '0');
    });
  }

  setLightButton(light) {
    this.el.btnLight.textContent = light ? t('btn.lightToDark') : t('btn.lightToLight');
  }

  /* 每渲染帧刷新 HUD */
  update(game, stats) {
    const e = this.el;
    e.hungerFill.style.width = `${Math.round(game.hunger * 100)}%`;
    e.hungerText.textContent = `${Math.round(game.hunger * 100)}%`;
    e.score.textContent = String(game.score);

    let status;
    if (game.escaping > 0) status = t('status.escaping');
    else if (game.eatAnim > 0) status = t('status.eat');
    else if (game.feeding) status = t('status.feeding');
    else if (game.standby) status = t('status.standby');
    else status = t('status.forage');
    e.status.textContent = status;

    if (stats) {
      e.active.textContent = `${stats.activeNeurons.toLocaleString()} / ${stats.totalNeurons.toLocaleString()}`;
      e.fired.textContent = `${stats.firedNeurons.toLocaleString()} spikes/tick`;
      e.tickms.textContent = `${stats.avgTickMs.toFixed(1)} ms`;
      e.tickrate.textContent = `${stats.tickRate} Hz`;
    }
  }

  showError(msg) {
    const div = document.getElementById('error-overlay');
    div.hidden = false;
    div.querySelector('p').textContent = msg;
  }

  hideLoading() {
    document.getElementById('loading').hidden = true;
  }

  setLoadingText(t) {
    document.getElementById('loading-text').textContent = t;
  }
}
