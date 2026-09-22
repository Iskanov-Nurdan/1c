/* =============================================================================
   ГРАФИКИ — инлайновый SVG без внешних библиотек
   Единая палитра: --c1…--c8 из tokens.css, поэтому графики выглядят
   согласованно в светлой и тёмной теме.
   ========================================================================== */
(function (App) {
  'use strict';

  const U = App.U;
  const NS = 'http://www.w3.org/2000/svg';
  const PALETTE = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--c7)', 'var(--c8)'];

  function s(tag, attrs, children) {
    const n = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (attrs[k] === null || attrs[k] === undefined) return;
      n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  /* --- Подсказка ----------------------------------------------------------- */
  let tipEl = null;
  function showTip(evt, html) {
    if (!tipEl) {
      tipEl = U.el('div.chart-tip');
      document.body.appendChild(tipEl);
    }
    tipEl.innerHTML = html;
    tipEl.style.display = 'block';
    const x = Math.min(evt.clientX + 14, window.innerWidth - tipEl.offsetWidth - 8);
    tipEl.style.left = x + 'px';
    tipEl.style.top = Math.max(8, evt.clientY - 36) + 'px';
  }
  function hideTip() { if (tipEl) tipEl.style.display = 'none'; }

  /** Округление «красивого» шага шкалы: 1, 2, 2.5, 5, 10 × 10ⁿ */
  function niceNum(v) {
    if (v <= 0) return 1;
    const mag = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / mag;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return step * mag;
  }

  /**
   * Шкала с круглыми подписями: границы кратны шагу, ноль всегда попадает на линию.
   * niceScale(-4300, 47800) → {min: -10000, max: 50000, step: 10000}
   */
  function niceScale(min, max, ticks) {
    const t = ticks || 4;
    if (max <= min) max = min + 1;
    const step = niceNum((max - min) / t);
    return {
      min: Math.floor(min / step) * step,
      max: Math.ceil(max / step) * step,
      step: step
    };
  }

  function fmtAxis(v) {
    const a = Math.abs(v);
    if (a >= 1e9) return U.num(v / 1e9, 1) + ' млрд';
    if (a >= 1e6) return U.num(v / 1e6, 1) + ' млн';
    if (a >= 1e3) return U.num(v / 1e3, 0) + ' тыс';
    return U.num(v, 0);
  }

  /* =========================================================================
     ЛИНЕЙНЫЙ / ПЛОЩАДНОЙ ГРАФИК
     ====================================================================== */
  function line(cfg) {
    const labels = cfg.labels || [];
    const series = (cfg.series || []).map(function (se, i) {
      return { name: se.name, values: se.values || [], color: se.color || PALETTE[i % PALETTE.length], area: se.area !== false, dashed: se.dashed };
    });
    const W = 720, H = cfg.height || 240;
    const pad = { t: 12, r: 12, b: 26, l: 54 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;

    let dataMax = 0, dataMin = 0;
    series.forEach(function (se) {
      se.values.forEach(function (v) { dataMax = Math.max(dataMax, v || 0); dataMin = Math.min(dataMin, v || 0); });
    });
    const scale = niceScale(dataMin, dataMax || 1, 4);
    const min = scale.min, max = scale.max;

    const xStep = labels.length > 1 ? iw / (labels.length - 1) : 0;
    const X = function (i) { return pad.l + i * xStep; };
    const Y = function (v) { return pad.t + ih - ((v - min) / (max - min || 1)) * ih; };

    const grid = [];
    const ticks = Math.max(1, Math.round((max - min) / scale.step));
    for (let i = 0; i <= ticks; i++) {
      const v = min + scale.step * i;
      const y = Y(v);
      grid.push(s('line', { x1: pad.l, y1: y, x2: W - pad.r, y2: y }));
      grid.push(s('text', { x: pad.l - 8, y: y + 3.5, 'text-anchor': 'end', class: 'axis-t' }, [txt(fmtAxis(v))]));
    }

    const parts = [s('g', { class: 'chart__grid' }, grid.filter(function (n) { return n.tagName === 'line'; }))];
    parts.push(s('g', { class: 'chart__axis' }, grid.filter(function (n) { return n.tagName === 'text'; })));

    // подписи оси X (прореживаем на узких экранах)
    const skip = Math.ceil(labels.length / 12);
    const xl = labels.map(function (l, i) {
      if (i % skip !== 0 && i !== labels.length - 1) return null;
      return s('text', { x: X(i), y: H - 8, 'text-anchor': 'middle' }, [txt(l)]);
    }).filter(Boolean);
    parts.push(s('g', { class: 'chart__axis' }, xl));

    series.forEach(function (se, si) {
      const pts = se.values.map(function (v, i) { return X(i) + ',' + Y(v || 0); });
      if (!pts.length) return;
      if (se.area) {
        const gid = 'grad-' + si + '-' + Math.round(Math.random() * 1e6);
        const defs = s('defs', null, [
          s('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, [
            s('stop', { offset: '0%', 'stop-color': se.color, 'stop-opacity': .28 }),
            s('stop', { offset: '100%', 'stop-color': se.color, 'stop-opacity': 0 })
          ])
        ]);
        parts.push(defs);
        parts.push(s('path', {
          d: 'M' + pts.join(' L') + ' L' + X(se.values.length - 1) + ',' + Y(min) + ' L' + X(0) + ',' + Y(min) + ' Z',
          fill: 'url(#' + gid + ')'
        }));
      }
      parts.push(s('polyline', {
        points: pts.join(' '), fill: 'none', stroke: se.color,
        'stroke-width': 2.2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
        'stroke-dasharray': se.dashed ? '5 4' : null
      }));
      se.values.forEach(function (v, i) {
        const c = s('circle', { cx: X(i), cy: Y(v || 0), r: 3.4, fill: 'var(--surface)', stroke: se.color, 'stroke-width': 2 });
        c.addEventListener('mouseenter', function (e) {
          showTip(e, '<b>' + U.escapeHtml(labels[i] || '') + '</b> · ' + U.escapeHtml(se.name) + ': ' + U.num(v, 0));
        });
        c.addEventListener('mouseleave', hideTip);
        parts.push(c);
      });
    });

    return wrap(cfg, W, H, parts, series);
  }

  /* =========================================================================
     СТОЛБЧАТЫЙ ГРАФИК (группированный / с накоплением)
     ====================================================================== */
  function bars(cfg) {
    const labels = cfg.labels || [];
    const series = (cfg.series || []).map(function (se, i) {
      return { name: se.name, values: se.values || [], color: se.color || PALETTE[i % PALETTE.length] };
    });
    const W = 720, H = cfg.height || 240;
    const pad = { t: 12, r: 12, b: 26, l: 54 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const stacked = !!cfg.stacked;

    let dataMax = 0, dataMin = 0;
    labels.forEach(function (_, i) {
      if (stacked) {
        const pos = U.sum(series, function (se) { return Math.max(0, se.values[i] || 0); });
        const neg = U.sum(series, function (se) { return Math.min(0, se.values[i] || 0); });
        dataMax = Math.max(dataMax, pos); dataMin = Math.min(dataMin, neg);
      } else {
        series.forEach(function (se) { dataMax = Math.max(dataMax, se.values[i] || 0); dataMin = Math.min(dataMin, se.values[i] || 0); });
      }
    });
    const scale = niceScale(dataMin, dataMax || 1, 4);
    const min = scale.min, max = scale.max;

    const Y = function (v) { return pad.t + ih - ((v - min) / (max - min || 1)) * ih; };
    const zero = Y(0);
    const slot = iw / (labels.length || 1);
    const groupW = slot * 0.68;
    const barW = stacked ? groupW : groupW / (series.length || 1);

    const parts = [];
    const grid = [], axis = [];
    const ticks = Math.max(1, Math.round((max - min) / scale.step));
    for (let i = 0; i <= ticks; i++) {
      const v = min + scale.step * i;
      const y = Y(v);
      grid.push(s('line', { x1: pad.l, y1: y, x2: W - pad.r, y2: y }));
      axis.push(s('text', { x: pad.l - 8, y: y + 3.5, 'text-anchor': 'end' }, [txt(fmtAxis(v))]));
    }
    parts.push(s('g', { class: 'chart__grid' }, grid));
    parts.push(s('g', { class: 'chart__axis' }, axis));

    labels.forEach(function (l, i) {
      const x0 = pad.l + slot * i + (slot - groupW) / 2;
      let accPos = 0, accNeg = 0;
      series.forEach(function (se, si) {
        const v = se.values[i] || 0;
        let x, y, h;
        if (stacked) {
          x = x0;
          if (v >= 0) { y = Y(accPos + v); h = Y(accPos) - Y(accPos + v); accPos += v; }
          else { y = Y(accNeg); h = Y(accNeg + v) - Y(accNeg); accNeg += v; }
        } else {
          x = x0 + si * barW;
          y = v >= 0 ? Y(v) : zero;
          h = Math.abs(Y(v) - zero);
        }
        const r = s('rect', {
          x: x + (stacked ? 0 : 1), y: y, width: Math.max(1, barW - (stacked ? 0 : 2)), height: Math.max(1, h),
          rx: 3, fill: se.color, class: 'chart__bar'
        });
        r.addEventListener('mouseenter', function (e) {
          showTip(e, '<b>' + U.escapeHtml(l) + '</b> · ' + U.escapeHtml(se.name) + ': ' + U.num(v, 0));
        });
        r.addEventListener('mouseleave', hideTip);
        parts.push(r);
      });
      parts.push(s('text', {
        x: pad.l + slot * i + slot / 2, y: H - 8, 'text-anchor': 'middle',
        style: 'fill:var(--text-3);font-size:10px'
      }, [txt(l)]));
    });

    parts.push(s('line', { x1: pad.l, y1: zero, x2: W - pad.r, y2: zero, stroke: 'var(--line-strong)', 'stroke-width': 1 }));

    return wrap(cfg, W, H, parts, series);
  }

  /* =========================================================================
     КОЛЬЦЕВАЯ ДИАГРАММА
     ====================================================================== */
  function donut(cfg) {
    const items = (cfg.items || []).filter(function (x) { return (x.value || 0) > 0; })
      .map(function (x, i) { return { name: x.name, value: x.value, color: x.color || PALETTE[i % PALETTE.length] }; });
    const size = cfg.size || 200;
    const total = U.sum(items, function (x) { return x.value; });
    const R = size / 2, r = R * (cfg.thickness || 0.62);
    const parts = [];

    if (!total) {
      parts.push(s('circle', { cx: R, cy: R, r: (R + r) / 2, fill: 'none', stroke: 'var(--surface-3)', 'stroke-width': R - r }));
    } else {
      let a0 = -Math.PI / 2;
      items.forEach(function (it) {
        const a1 = a0 + (it.value / total) * Math.PI * 2;
        const large = (a1 - a0) > Math.PI ? 1 : 0;
        const p = [
          'M', R + R * Math.cos(a0), R + R * Math.sin(a0),
          'A', R, R, 0, large, 1, R + R * Math.cos(a1), R + R * Math.sin(a1),
          'L', R + r * Math.cos(a1), R + r * Math.sin(a1),
          'A', r, r, 0, large, 0, R + r * Math.cos(a0), R + r * Math.sin(a0),
          'Z'
        ].join(' ');
        const path = s('path', { d: p, fill: it.color, class: 'chart__bar' });
        path.addEventListener('mouseenter', function (e) {
          showTip(e, '<b>' + U.escapeHtml(it.name) + '</b>: ' + U.num(it.value, 0) + ' (' + U.num(it.value / total * 100, 1) + '%)');
        });
        path.addEventListener('mouseleave', hideTip);
        parts.push(path);
        a0 = a1;
      });
    }

    if (cfg.centerTop || cfg.centerBottom) {
      parts.push(s('text', {
        x: R, y: R - 2, 'text-anchor': 'middle',
        style: 'fill:var(--text);font-size:16px;font-weight:700'
      }, [txt(cfg.centerTop || '')]));
      parts.push(s('text', {
        x: R, y: R + 16, 'text-anchor': 'middle',
        style: 'fill:var(--text-3);font-size:11px'
      }, [txt(cfg.centerBottom || '')]));
    }

    const svg = s('svg', {
      viewBox: '0 0 ' + size + ' ' + size, width: size, height: size,
      role: 'img', 'aria-label': cfg.title || 'Круговая диаграмма'
    }, parts);

    const box = U.el('div', { style: { display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' } }, [svg]);
    if (cfg.legend !== false) box.appendChild(legend(items, total));
    return box;
  }

  /* =========================================================================
     СПАРКЛАЙН
     ====================================================================== */
  function spark(values, opts) {
    const o = opts || {};
    const W = o.width || 120, H = o.height || 32;
    const vals = values && values.length ? values : [0, 0];
    const max = Math.max.apply(null, vals), min = Math.min.apply(null, vals);
    const range = (max - min) || 1;
    const step = vals.length > 1 ? W / (vals.length - 1) : W;
    const pts = vals.map(function (v, i) { return (i * step).toFixed(1) + ',' + (H - 2 - ((v - min) / range) * (H - 4)).toFixed(1); });
    const color = o.color || (vals[vals.length - 1] >= vals[0] ? 'var(--c2)' : 'var(--c4)');
    return s('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, class: 'spark', 'aria-hidden': 'true' }, [
      s('polyline', { points: pts.join(' '), fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
    ]);
  }

  /* --- Горизонтальные полосы (рейтинги, топ-N) ----------------------------- */
  function hbars(cfg) {
    const items = cfg.items || [];
    const max = Math.max.apply(null, items.map(function (i) { return i.value || 0; }).concat([1]));
    const fmt = cfg.format || function (v) { return U.moneyShort(v); };
    return U.el('div.col', { style: { gap: '10px' } }, items.map(function (it, i) {
      return U.el('div.meter', null, [
        U.el('div.meter__top', null, [
          U.el('span.truncate', { text: it.name }),
          U.el('b', { text: fmt(it.value) })
        ]),
        U.el('div.progress', null, [
          U.el('div.progress__bar', {
            style: {
              width: Math.max(2, (it.value / max) * 100) + '%',
              background: it.color || PALETTE[i % PALETTE.length]
            }
          })
        ])
      ]);
    }));
  }

  /* --- Общее --------------------------------------------------------------- */
  function txt(t) { return document.createTextNode(String(t)); }

  function legend(items, total) {
    return U.el('div.chart-legend', null, items.map(function (it) {
      return U.el('div.chart-legend__item', null, [
        U.el('span.chart-legend__swatch', { style: { background: it.color } }),
        U.el('span', { text: it.name }),
        total ? U.el('b', { text: ' ' + U.num(it.value / total * 100, 0) + '%' }) : null
      ]);
    }));
  }

  function wrap(cfg, W, H, parts, series) {
    const svg = s('svg', {
      viewBox: '0 0 ' + W + ' ' + H, class: 'chart',
      preserveAspectRatio: 'none', role: 'img',
      style: 'height:' + H + 'px',
      'aria-label': cfg.title || 'График'
    }, parts);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    const box = U.el('div', null, [svg]);
    if (cfg.legend !== false && series && series.length > 1) {
      box.appendChild(legend(series.map(function (se) { return { name: se.name, color: se.color }; })));
    }
    return box;
  }

  App.Charts = {
    line: line, bars: bars, donut: donut, spark: spark, hbars: hbars,
    legend: legend, palette: PALETTE, fmtAxis: fmtAxis
  };
})(window.App);
