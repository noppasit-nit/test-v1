/* Malee vs Tipco dashboard v2 - plain JS, no build step. Data: data/*.csv (relative paths) or published Google Sheets. */
(function () {
  'use strict';
  var CFG = window.DASHBOARD_CONFIG || {};
  var FILES = ['skus', 'listings', 'prices', 'targets', 'promotions', 'cases'];
  var REFRESH_DAYS = { daily: 1, weekly: 7, monthly: 30 };
  var B = CFG.BASE_BRAND || 'Malee', C = CFG.COMPETITOR_BRAND || 'Tipco';
  var RET = CFG.RETAILERS || ["Lotus's", 'Big C'];
  var charts = {};
  var MOCK = '<span class="mock">MOCKUP</span>', REAL = '<span class="real">REAL</span>';

  // ---------- helpers ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }
  function fmt(n, d) { return n == null ? '-' : n.toFixed(d == null ? 1 : d); }
  function pct(n, d) { return n == null ? '-' : (n > 0 ? '+' : '') + n.toFixed(d == null ? 1 : d) + '%'; }
  function thb(n) { return n == null ? '-' : 'THB ' + (Math.round(n * 100) / 100).toString(); }
  function link(url, label) { return url ? '<a class="src" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(label || 'source') + ' ↗</a>' : '<span class="muted">-</span>'; }
  function hostOf(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return 'source'; } }
  function brandTag(b) { return '<span class="brand ' + esc(b) + '">' + esc(b) + '</span>'; }
  function tagFor(status) { return status === 'REAL' ? REAL : MOCK; }
  function isTrue(v) { return String(v).trim().toUpperCase() === 'TRUE'; }
  function d2(iso) { return new Date(iso + 'T00:00:00Z'); }
  function addDays(iso, n) { return new Date(d2(iso).getTime() + n * 86400000).toISOString().slice(0, 10); }
  function fmtDate(iso, short) {
    if (!iso) return '-'; var d = d2(iso); if (isNaN(d)) return iso;
    var o = { day: 'numeric', month: 'short', timeZone: 'UTC' }; if (!short) o.year = 'numeric';
    return d.toLocaleDateString('en-GB', o);
  }
  function round(n) { return Math.round(n); }

  // ---------- loading ----------
  function cacheKey() { return Math.floor(Date.now() / ((REFRESH_DAYS[CFG.REFRESH] || 7) * 86400000)); }
  function urlFor(f) {
    var base = CFG.DATA_SOURCE === 'sheets' ? (CFG.SHEET_CSV_URLS || {})[f] : 'data/' + f + '.csv'; // relative: works under /test-v1/
    if (!base || base.indexOf('PASTE_') === 0) throw new Error('No CSV URL set for "' + f + '" in config.js');
    return base + (base.indexOf('?') > -1 ? '&' : '?') + 'v=' + cacheKey();
  }
  function loadCSV(f) {
    return fetch(urlFor(f)).then(function (r) { if (!r.ok) throw new Error('Could not load ' + f + ' (HTTP ' + r.status + ')'); return r.text(); })
      .then(function (t) { return Papa.parse(t, { header: true, skipEmptyLines: true, transformHeader: function (h) { return h.trim(); } }).data; });
  }

  // ---------- model ----------
  function build(d) {
    var M = { skus: {}, pairs: [], dates: [], obs: {}, listings: {}, targets: {}, d: d };
    d.skus.forEach(function (s) { M.skus[s.sku_id] = s; });
    d.listings.forEach(function (l) { M.listings[l.retailer + '|' + l.sku_id] = l; });
    d.targets.forEach(function (t) { M.targets[t.pair_id] = { lo: 100 + num(t.malee_gap_min_pct), hi: 100 + num(t.malee_gap_max_pct), label: t.target_position, why: t.rationale, status: t.data_status || 'MOCKUP' }; });
    var ds = {};
    d.prices.forEach(function (p) {
      ds[p.date] = 1;
      var cap = isTrue(p.captured), reg = num(p.regular_price_thb), shelf = num(p.shelf_price_thb);
      var size = num((M.skus[p.sku_id] || {}).size_ml) || 1000;
      M.obs[p.retailer + '|' + p.sku_id + '|' + p.date] = {
        row: p, cap: cap && shelf != null, reg: reg, shelf: shelf, type: p.promo_type || 'none',
        promo: cap && (p.promo_type === 'discount' || p.promo_type === 'buy3pay2'),
        depth: cap && reg ? (reg - shelf) / reg * 100 : null, p100: cap && shelf != null ? shelf / size * 100 : null,
        r100: cap && reg != null ? reg / size * 100 : null, status: p.data_status || (isTrue(p.is_mockup) ? 'MOCKUP' : 'REAL')
      };
    });
    M.dates = Object.keys(ds).sort();
    M.last = M.dates[M.dates.length - 1];
    var pr = {};
    d.skus.forEach(function (s) { (pr[s.pair_id] = pr[s.pair_id] || { id: s.pair_id, name: s.pair_name, category: s.category })[s.brand] = s; });
    M.pairs = Object.keys(pr).sort().map(function (k) { return pr[k]; });
    return M;
  }
  function ob(M, r, sku, date) { return M.obs[r + '|' + sku + '|' + date] || null; }
  function idx(M, pair, r, date) {
    var a = ob(M, r, pair[B].sku_id, date), b = ob(M, r, pair[C].sku_id, date);
    return a && b && a.cap && b.cap ? a.p100 / b.p100 * 100 : null;
  }
  function idxReg(M, pair, r, date) {
    var a = ob(M, r, pair[B].sku_id, date), b = ob(M, r, pair[C].sku_id, date);
    return a && b && a.cap && b.cap ? a.r100 / b.r100 * 100 : null;
  }
  function lastCaptured(M, pair, r) { for (var i = M.dates.length - 1; i >= 0; i--) if (idx(M, pair, r, M.dates[i]) != null) return M.dates[i]; return null; }
  function skuName(M, id) { var s = M.skus[id]; return s ? s.brand + ' ' + s.pair_name.replace(/ 100%.*| 1L/, '') : id; }
  function shortName(p) { return p.name.replace(/ 100%.*$/, '').replace(/ 1L$/, ''); }

  // promo runs from daily history (consecutive promo days; not-captured days in between do not break a run)
  function runs(M) {
    var out = [];
    RET.forEach(function (r) {
      M.pairs.forEach(function (p) {
        [p[B], p[C]].forEach(function (s) {
          var cur = null;
          M.dates.forEach(function (dt, i) {
            var o = ob(M, r, s.sku_id, dt);
            if (o && o.promo) {
              if (!cur) cur = { retailer: r, sku: s, brand: s.brand, pair: p, start: dt, end: dt, days: 0, depthSum: 0, type: o.type, reg: o.reg, shelf: o.shelf, statuses: {}, endDate: '' };
              cur.end = dt; cur.days++; cur.depthSum += o.depth; cur.statuses[o.status] = 1; cur.shelf = o.shelf; if (o.row.promo_end_date) cur.endDate = o.row.promo_end_date;
            }
            var gap = (!o || !o.cap) && i < M.dates.length - 1; // not captured: keep the run open, decide on the next captured day
            if (!gap && (!o || !o.promo || i === M.dates.length - 1) && cur) {
              cur.depth = cur.depthSum / cur.days; cur.ongoing = cur.end === M.last; cur.atStart = cur.start === M.dates[0];
              out.push(cur); cur = null;
            }
          });
        });
      });
    });
    return out;
  }

  // ---------- header ----------
  function renderHeader(M) {
    document.title = CFG.TITLE || document.title;
    document.getElementById('title').textContent = CFG.TITLE || document.title;
    document.getElementById('tz').textContent = CFG.TIMEZONE_LABEL || '';
    var days = REFRESH_DAYS[CFG.REFRESH] || 7;
    document.getElementById('updated').textContent = 'Last updated: ' + fmtDate(M.last);
    document.getElementById('refresh').textContent = 'Refresh: ' + (CFG.REFRESH || 'weekly');
    var next = addDays(M.last, days), due = document.getElementById('due');
    due.textContent = 'Next update due: ' + fmtDate(next);
    if (new Date() > d2(next)) { due.classList.add('due'); due.textContent += ' (overdue)'; }
    document.getElementById('source').textContent = 'Data: ' + (CFG.DATA_SOURCE === 'sheets' ? 'Google Sheets' : 'CSV files');
    Array.prototype.forEach.call(document.querySelectorAll('.rangeTxt'), function (e) { e.textContent = fmtDate(M.dates[0], 1) + ' - ' + fmtDate(M.last); });
  }

  // ---------- action cards (data rules) ----------
  // Rule: for each pair, use the primary retailer's latest captured day (fallback: next retailer).
  // Compare the Malee index with the target band. Priority = distance outside the band.
  function actionCards(M, R) {
    var weekStart = addDays(M.last, -(CFG.WEEK_DAYS || 7) + 1);
    var order = [CFG.PRIMARY_RETAILER].concat(RET.filter(function (x) { return x !== CFG.PRIMARY_RETAILER; }));
    var cards = M.pairs.map(function (p) {
      var r = null, dt = null;
      for (var i = 0; i < order.length; i++) { dt = lastCaptured(M, p, order[i]); if (dt) { r = order[i]; break; } }
      var t = M.targets[p.id] || { lo: 97, hi: 103, label: 'Parity +/-3%' };
      var x = idx(M, p, r, dt), m = ob(M, r, p[B].sku_id, dt), c = ob(M, r, p[C].sku_id, dt);
      var dist = x < t.lo ? t.lo - x : x > t.hi ? x - t.hi : 0;
      // what changed this week (promo starts/ends at this retailer, both brands)
      var changes = R.filter(function (u) { return u.retailer === r && u.pair === p && (u.start >= weekStart || (u.end >= weekStart && !u.ongoing)); })
        .map(function (u) {
          var d = u.type === 'buy3pay2' ? 'buy 3 pay 2' : '-' + fmt(u.depth, 0) + '% (' + thb(u.reg) + ' → ' + thb(u.shelf) + ')';
          return u.brand + ' ' + (u.start >= weekStart ? 'started a promo on ' + fmtDate(u.start, 1) + ': ' + d : 'promo ended ' + fmtDate(u.end, 1));
        });
      if (!changes.length) changes.push('No promo start or end for this pair at ' + r + ' this week.');
      var other = RET.filter(function (q) { return q !== r; }).map(function (q) {
        var od = lastCaptured(M, p, q); return od ? q + ' index ' + fmt(idx(M, p, q, od), 1) + ' (' + fmtDate(od, 1) + ')' : q + ': pair not captured';
      }).join('; ');
      var gapTxt = x < 100 ? 'Malee is ' + fmt(100 - x, 1) + '% cheaper than Tipco' : x > 100 ? 'Malee is ' + fmt(x - 100, 1) + '% more expensive than Tipco' : 'Malee is at parity with Tipco';
      var why = gapTxt + ' per 100 ml at ' + r + ' (index ' + fmt(x, 1) + ' vs MOCKUP target ' + fmt(t.lo, 0) + '-' + fmt(t.hi, 0) + ', ' + t.label + '). ';
      if (dist === 0) why += 'Inside the target band.';
      else if (x < t.lo) why += 'Below the band: Malee is giving away more margin than the target needs.';
      else why += 'Above the band: Malee risks losing shoppers to Tipco on shelf.';
      if (c.promo && c.row.promo_end_date) why += ' Tipco promo runs until ' + fmtDate(c.row.promo_end_date, 1) + '.';
      why += ' Other retailer: ' + other + '.';
      // recommended Malee shelf price range that lands inside the band
      var lo = c.shelf * t.lo / 100, hi = c.shelf * t.hi / 100, move;
      if (dist === 0) move = 'Hold. Keep Malee at ' + thb(m.shelf) + '; re-check when the current promo ends.';
      else if (x < t.lo) {
        if (m.promo && m.reg >= lo && m.reg <= hi) move = 'End the Malee promo (back to regular ' + thb(m.reg) + ', index ' + fmt(m.reg / c.shelf * 100, 1) + ') - this lands inside the band.';
        else if (m.promo && m.reg < lo) move = 'Stop discounting: even at regular ' + thb(m.reg) + ' Malee is below the band. In-band shelf price would be ' + thb(Math.ceil(lo)) + '-' + Math.floor(hi) + '; review the regular price with Sales.';
        else if (m.promo) move = 'Make the Malee promo shallower: shelf price ' + thb(Math.ceil(lo)) + '-' + Math.floor(Math.min(hi, m.reg)) + ' keeps Malee inside the band.';
        else move = 'No promo needed. Malee regular is below the band; in-band price would be ' + thb(Math.ceil(lo)) + '-' + Math.floor(hi) + '.';
      } else {
        var targetP = Math.floor(hi);
        move = (dist < 1 ? 'Watch (only ' + fmt(dist, 1) + ' pts outside the band), or move' : 'Move') + ' Malee shelf price to ' + thb(targetP) + ' (' + pct((targetP - m.reg) / m.reg * 100, 0) + ' vs regular) at ' + r + (c.promo ? ' until the Tipco promo ends' : '') + ', or defend with a non-price offer (bundle, display).';
      }
      var status = [m.status, c.status].indexOf('MOCKUP') > -1 ? 'MOCKUP' : 'REAL';
      return { pair: p, retailer: r, date: dt, x: x, dist: dist, sev: dist > 5 ? 'high' : dist > 0 ? 'med' : 'low', changes: changes, why: why, move: move, status: status, hist: 'MOCKUP' };
    });
    cards.sort(function (a, b) { return b.dist - a.dist; });
    return cards.slice(0, 3);
  }

  function alerts(M, R) {
    var wk = CFG.WEEK_DAYS || 7, weekStart = addDays(M.last, -wk + 1), out = [];
    var gapLim = CFG.GAP_ALERT_PCT || 5, moveLim = CFG.PRICE_MOVE_ALERT_PCT || 3;
    R.forEach(function (u) {
      if (u.brand === C && u.start >= weekStart) out.push({ date: u.start, sev: 'high', type: 'New Tipco promo', text: skuName(M, u.sku.sku_id) + ' at ' + u.retailer + ': ' + (u.type === 'buy3pay2' ? 'buy 3 pay 2' : thb(u.reg) + ' → ' + thb(u.shelf) + ' (-' + fmt(u.depth, 0) + '%)') + (u.endDate ? ', until ' + fmtDate(u.endDate, 1) : ''), status: u.statuses.REAL && !u.statuses.MOCKUP ? 'REAL' : 'MOCKUP' });
    });
    RET.forEach(function (r) {
      M.pairs.forEach(function (p) {
        var dt = lastCaptured(M, p, r); if (!dt) return;
        var x = idx(M, p, r, dt), t = M.targets[p.id];
        if (t && Math.abs(x - 100) <= gapLim && (x < t.lo || x > t.hi)) out.push({ date: dt, sev: 'med', type: 'Outside target band', text: shortName(p) + ' at ' + r + ': Malee index ' + fmt(x, 1) + ' vs MOCKUP target ' + fmt(t.lo, 0) + '-' + fmt(t.hi, 0), status: ob(M, r, p[B].sku_id, dt).status });
        if (Math.abs(x - 100) > gapLim) out.push({ date: dt, sev: 'med', type: 'Gap > ' + gapLim + '%', text: shortName(p) + ' at ' + r + ': Malee index ' + fmt(x, 1) + ' (' + pct(x - 100) + ' vs Tipco)' + (t && (x < t.lo || x > t.hi) ? ' - outside MOCKUP target ' + fmt(t.lo, 0) + '-' + fmt(t.hi, 0) : ''), status: ob(M, r, p[B].sku_id, dt).status });
        [p[B], p[C]].forEach(function (s) {
          var prev = null;
          M.dates.forEach(function (d) {
            var o = ob(M, r, s.sku_id, d); if (!o || !o.cap) return;
            if (prev && d >= weekStart) {
              var ch = (o.shelf - prev.shelf) / prev.shelf * 100;
              var isNewTipcoPromo = s.brand === C && o.promo && !prev.promo;
              if (Math.abs(ch) >= moveLim && !isNewTipcoPromo) out.push({ date: d, sev: s.brand === C ? 'med' : 'info', type: 'Price move', text: skuName(M, s.sku_id) + ' at ' + r + ': ' + thb(prev.shelf) + ' → ' + thb(o.shelf) + ' (' + pct(ch, 0) + ')', status: o.status });
            }
            prev = o;
          });
        });
      });
      var miss = M.dates.filter(function (d) { return d >= weekStart && M.pairs.some(function (p) { var o = ob(M, r, p[B].sku_id, d), o2 = ob(M, r, p[C].sku_id, d); return (o && !o.cap) || (o2 && !o2.cap); }); });
      if (miss.length) out.push({ date: miss[miss.length - 1], sev: 'info', type: 'Data gap', text: r + ': at least one SKU not captured on ' + miss.map(function (d) { return fmtDate(d, 1); }).join(', '), status: 'MOCKUP' });
    });
    var rank = { high: 0, med: 1, info: 2, low: 3 };
    out.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : rank[a.sev] - rank[b.sev]; });
    return out;
  }

  function renderSummary(M, R) {
    var wk = CFG.WEEK_DAYS || 7;
    document.getElementById('alertDays').textContent = wk;
    document.getElementById('weekNote').innerHTML = 'Week ' + fmtDate(addDays(M.last, -wk + 1), 1) + ' - ' + fmtDate(M.last) + '. Cards are generated by rules: Malee index vs MOCKUP target band per pair at ' + esc(CFG.PRIMARY_RETAILER) + ' (fallback: other retailer), sorted by how far outside the band. Latest day uses ' + REAL + ' prices; history is ' + MOCK + '.';
    var cards = actionCards(M, R);
    M.cards = cards;
    document.getElementById('actions').innerHTML = cards.map(function (c, i) {
      return '<div class="action sev-' + c.sev + '"><h3>' + (i + 1) + '. ' + esc(shortName(c.pair)) + ' · ' + esc(c.retailer) + ' <span class="sev ' + c.sev + '">' + (c.sev === 'high' ? 'ACT' : c.sev === 'med' ? 'REVIEW' : 'OK') + '</span></h3>' +
        '<div class="muted">Prices ' + fmtDate(c.date) + ' ' + tagFor(c.status) + ' · history and band ' + MOCK + '</div>' +
        '<div class="lbl">What changed</div>' + c.changes.map(function (t) { return '<p>• ' + esc(t) + '</p>'; }).join('') +
        '<div class="lbl">Why it matters</div><p>' + esc(c.why) + '</p>' +
        '<div class="lbl">Recommended move</div><p class="move">' + esc(c.move) + '</p></div>';
    }).join('');

    // KPI strip
    var checks = 0, inBand = 0, idxs = [];
    RET.forEach(function (r) { M.pairs.forEach(function (p) { var dt = lastCaptured(M, p, r); if (!dt) return; var x = idx(M, p, r, dt), t = M.targets[p.id]; checks++; if (x >= t.lo && x <= t.hi) inBand++; if (r === CFG.PRIMARY_RETAILER) idxs.push(x); }); });
    var tipOn = 0, tipTot = 0, malOn = 0;
    RET.forEach(function (r) { M.pairs.forEach(function (p) { var o = ob(M, r, p[C].sku_id, M.last), o2 = ob(M, r, p[B].sku_id, M.last); if (o && o.cap) { tipTot++; if (o.promo) tipOn++; } if (o2 && o2.promo) malOn++; }); });
    var share = function (brand) { var on = 0, cap = 0; RET.forEach(function (r) { M.pairs.forEach(function (p) { M.dates.forEach(function (d) { var o = ob(M, r, p[brand].sku_id, d); if (o && o.cap) { cap++; if (o.promo) on++; } }); }); }); return cap ? on / cap * 100 : null; };
    var avgIdx = idxs.length ? idxs.reduce(function (a, b) { return a + b; }, 0) / idxs.length : null;
    var capB = 0, totB = 0; M.d.prices.forEach(function (p) { if (p.retailer === 'Big C') { totB++; if (isTrue(p.captured)) capB++; } });
    var k = [
      ['Pairs inside target band', inBand + ' / ' + checks, 'Latest captured day, both retailers', MOCK],
      ['Avg Malee index · ' + CFG.PRIMARY_RETAILER, fmt(avgIdx, 1), 'Tipco = 100; below 100 = Malee cheaper', REAL],
      ['Tipco SKUs on promo today', tipOn + ' / ' + tipTot, 'Malee on promo today: ' + malOn + ' SKUs', REAL],
      ['Days on promo (30 days)', 'M ' + fmt(share(B), 0) + '% · T ' + fmt(share(C), 0) + '%', 'Malee vs Tipco, all captured SKU-days', MOCK],
      ['Big C capture rate', totB ? fmt(capB / totB * 100, 0) + '%' : '-', 'SKU-days with a price found', MOCK]
    ];
    document.getElementById('kpis').innerHTML = k.map(function (x) { return '<div class="card kpi"><div class="label">' + esc(x[0]) + ' ' + x[3] + '</div><div class="value">' + esc(x[1]) + '</div><div class="note">' + esc(x[2]) + '</div></div>'; }).join('');

    var al = alerts(M, R);
    document.getElementById('alerts').innerHTML = '<tr><th>Date</th><th>Level</th><th>Alert</th><th>Detail</th><th>Data</th></tr>' + (al.length ? al.map(function (a) {
      return '<tr><td>' + fmtDate(a.date, 1) + '</td><td><span class="sev ' + a.sev + '">' + (a.sev === 'high' ? 'HIGH' : a.sev === 'med' ? 'MEDIUM' : 'INFO') + '</span></td><td>' + esc(a.type) + '</td><td>' + esc(a.text) + '</td><td>' + tagFor(a.status) + '</td></tr>';
    }).join('') : '<tr><td colspan="5" class="muted">No alerts this week.</td></tr>');
  }

  // ---------- promo patterns ----------
  function renderPatterns(M, R) {
    var rows = [];
    [B, C].forEach(function (brand) {
      RET.forEach(function (r) {
        var cap = 0, on = 0, dsum = 0;
        M.pairs.forEach(function (p) { M.dates.forEach(function (d) { var o = ob(M, r, p[brand].sku_id, d); if (o && o.cap) { cap++; if (o.promo) { on++; dsum += o.depth; } } }); });
        var rr = R.filter(function (u) { return u.brand === brand && u.retailer === r; });
        var dur = rr.length ? rr.reduce(function (a, u) { return a + u.days; }, 0) / rr.length : null;
        rows.push('<tr><td>' + brandTag(brand) + '</td><td>' + esc(r) + '</td><td class="num">' + cap + '</td><td class="num">' + on + '</td><td class="num"><b>' + (cap ? fmt(on / cap * 100, 0) + '%' : '-') + '</b></td><td class="num">' + (on ? fmt(dsum / on, 1) + '%' : '-') + '</td><td class="num">' + rr.length + '</td><td class="num">' + (dur == null ? '-' : fmt(dur, 1) + ' days') + '</td><td class="num">' + rr.filter(function (u) { return u.type === 'buy3pay2'; }).length + '</td></tr>');
      });
    });
    document.getElementById('patternTable').innerHTML = '<tr><th>Brand</th><th>Retailer</th><th class="num">Captured SKU-days</th><th class="num">Promo SKU-days</th><th class="num">Days on promo</th><th class="num">Avg depth</th><th class="num">Promo runs</th><th class="num">Avg duration</th><th class="num">Buy 3 pay 2 runs</th></tr>' + rows.join('');

    // heatmap
    var h = '<tr><th class="lab">Retailer · SKU</th>' + M.dates.map(function (d) { var x = d2(d); return '<th>' + x.getUTCDate() + (x.getUTCDate() === 1 || d === M.dates[0] ? '<br>' + x.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }) : '') + '</th>'; }).join('') + '</tr>';
    RET.forEach(function (r) {
      M.pairs.forEach(function (p) {
        [p[B], p[C]].forEach(function (s) {
          h += '<tr><td class="lab">' + esc(r) + ' · ' + brandTag(s.brand) + ' ' + esc(shortName(p)) + '</td>' + M.dates.map(function (d) {
            var o = ob(M, r, s.sku_id, d), cls = 'c d0', txt = '', tip = fmtDate(d) + ' ';
            if (!o || !o.cap) { cls = 'c nc'; tip += 'not captured'; }
            else if (o.type === 'buy3pay2') { cls = 'c b3'; txt = '3:2'; tip += 'buy 3 pay 2'; }
            else if (o.promo) { cls = 'c ' + (o.depth < 7 ? 'd1' : o.depth < 12 ? 'd2' : 'd3'); txt = fmt(o.depth, 0); tip += 'THB ' + o.shelf + ' (-' + fmt(o.depth, 1) + '%)'; }
            else tip += 'THB ' + o.shelf + ' regular';
            if (o && o.status === 'REAL') { cls += ' realc'; tip += ' [REAL]'; } else tip += ' [MOCKUP]';
            return '<td class="' + cls + '" title="' + esc(tip) + '">' + txt + '</td>';
          }).join('') + '</tr>';
        });
      });
    });
    document.getElementById('heatmap').innerHTML = h;

    // trend selectors
    var sp = document.getElementById('trendPair'), sr = document.getElementById('trendRetailer');
    sp.innerHTML = M.pairs.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>'; }).join('');
    sr.innerHTML = RET.map(function (r) { return '<option>' + esc(r) + '</option>'; }).join('');
    function draw() {
      var p = M.pairs.filter(function (x) { return x.id === sp.value; })[0], r = sr.value;
      var ds = [];
      [[B, '#1f7a4d'], [C, '#e07a1f']].forEach(function (bc) {
        var s = p[bc[0]];
        ds.push({ label: bc[0] + ' shelf', data: M.dates.map(function (d) { var o = ob(M, r, s.sku_id, d); return o && o.cap ? +o.p100.toFixed(2) : null; }), borderColor: bc[1], backgroundColor: bc[1], stepped: true, spanGaps: false, pointRadius: 2, borderWidth: 2.5 });
        ds.push({ label: bc[0] + ' regular', data: M.dates.map(function (d) { var o = ob(M, r, s.sku_id, d); return o && o.cap ? +o.r100.toFixed(2) : null; }), borderColor: bc[1], borderDash: [5, 4], pointRadius: 0, borderWidth: 1.2, stepped: true, spanGaps: false });
      });
      if (charts.trend) charts.trend.destroy();
      charts.trend = new Chart(document.getElementById('trendChart'), { type: 'line', data: { labels: M.dates.map(function (d) { return fmtDate(d, 1); }), datasets: ds },
        options: { maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false }, plugins: { title: { display: true, text: 'THB per 100 ml - ' + p.name + ' at ' + r + ' (MOCKUP history; ' + fmtDate(M.last, 1) + ' REAL)' } }, scales: { y: { title: { display: true, text: 'THB per 100 ml' } } } } });
    }
    sp.onchange = draw; sr.onchange = draw; draw();
  }

  // ---------- price index ----------
  function renderIndex(M) {
    var lo = 80, hi = 120, pos = function (v) { return Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100)); };
    var rows = [];
    M.pairs.forEach(function (p) {
      var t = M.targets[p.id];
      RET.forEach(function (r) {
        var dt = lastCaptured(M, p, r), x = dt ? idx(M, p, r, dt) : null, xr = dt ? idxReg(M, p, r, dt) : null;
        var inb = x != null && x >= t.lo && x <= t.hi;
        var bar = x == null ? '<span class="muted">not captured</span>' : '<div class="bandbar"><div class="band" style="left:' + pos(t.lo) + '%;width:' + (pos(t.hi) - pos(t.lo)) + '%"></div><div class="mid" style="left:' + pos(100) + '%"></div><div class="dot' + (inb ? '' : ' out') + '" style="left:' + pos(x) + '%" title="' + fmt(x, 1) + '"></div></div>';
        var st = x == null ? '-' : inb ? '<span class="st-in">In band</span>' : x < t.lo ? '<span class="st-out">Below band (Malee too cheap)</span>' : '<span class="st-out">Above band (Malee too expensive)</span>';
        rows.push('<tr><td>' + esc(p.name) + '</td><td>' + esc(r) + '</td><td>' + (dt ? fmtDate(dt, 1) + ' ' + tagFor(ob(M, r, p[B].sku_id, dt).status) : '-') + '</td><td class="num"><b>' + fmt(x, 1) + '</b></td><td class="num">' + fmt(xr, 1) + '</td><td>' + esc(t.label) + ' (' + fmt(t.lo, 0) + '-' + fmt(t.hi, 0) + ') ' + MOCK + '</td><td>' + bar + '</td><td>' + st + '</td></tr>');
      });
    });
    document.getElementById('bandTable').innerHTML = '<tr><th>Pair</th><th>Retailer</th><th>Date</th><th class="num">Index (shelf)</th><th class="num">Index (regular)</th><th>Target position</th><th>Position (scale 80-120)</th><th>Status</th></tr>' + rows.join('');

    var sel = document.getElementById('idxPair');
    sel.innerHTML = M.pairs.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>'; }).join('');
    function draw() {
      var p = M.pairs.filter(function (x) { return x.id === sel.value; })[0], t = M.targets[p.id], lab = M.dates.map(function (d) { return fmtDate(d, 1); });
      var cols = ['#1d4ed8', '#be185d', '#0f766e'];
      var ds = [
        { label: 'Target low (MOCKUP)', data: M.dates.map(function () { return t.lo; }), borderColor: 'rgba(22,163,74,.5)', borderDash: [4, 4], pointRadius: 0, borderWidth: 1, fill: false },
        { label: 'Target high (MOCKUP)', data: M.dates.map(function () { return t.hi; }), borderColor: 'rgba(22,163,74,.5)', borderDash: [4, 4], pointRadius: 0, borderWidth: 1, fill: '-1', backgroundColor: 'rgba(34,197,94,.15)' }
      ];
      RET.forEach(function (r, i) { ds.push({ label: 'Malee index · ' + r, data: M.dates.map(function (d) { var x = idx(M, p, r, d); return x == null ? null : +x.toFixed(1); }), borderColor: cols[i], backgroundColor: cols[i], spanGaps: false, pointRadius: 2, borderWidth: 2.5 }); });
      if (charts.idx) charts.idx.destroy();
      charts.idx = new Chart(document.getElementById('idxChart'), { type: 'line', data: { labels: lab, datasets: ds },
        options: { maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false }, plugins: { title: { display: true, text: 'Malee price index (Tipco = 100) - ' + p.name + ' (MOCKUP history; ' + fmtDate(M.last, 1) + ' REAL)' } }, scales: { y: { suggestedMin: 85, suggestedMax: 115, title: { display: true, text: 'Index' } } } } });
    }
    sel.onchange = draw; draw();

    // latest real snapshot
    var lr = [];
    RET.forEach(function (r) {
      M.pairs.forEach(function (p) {
        [p[B], p[C]].forEach(function (s) {
          var o = ob(M, r, s.sku_id, M.last), l = M.listings[r + '|' + s.sku_id] || {};
          lr.push('<tr><td>' + esc(r) + '</td><td>' + brandTag(s.brand) + '</td><td>' + esc(l.listing_name || s.product_name) + (isTrue(l.is_variant) ? ' <span class="tag">variant</span>' : '') + '</td><td class="num">' + (o && o.cap ? o.reg : '-') + '</td><td class="num">' + (o && o.cap ? o.shelf : '-') + '</td><td class="num">' + (o && o.cap ? fmt(o.p100, 2) : '-') + '</td><td>' + (o ? esc(o.row.promo_end_date ? 'Promo until ' + fmtDate(o.row.promo_end_date, 1) : o.cap ? (o.promo ? 'Promo (end date not shown)' : 'No promo') : o.row.notes) : '-') + '</td><td>' + (o ? tagFor(o.status) : '') + '</td><td>' + link(o && o.row.source_url, o && o.row.source_url ? hostOf(o.row.source_url) : '') + '</td></tr>');
        });
      });
    });
    document.getElementById('latestTable').innerHTML = '<tr><th>Retailer</th><th>Brand</th><th>Listing</th><th class="num">Regular</th><th class="num">Shelf</th><th class="num">THB/100 ml</th><th>Promo</th><th>Data</th><th>Source</th></tr>' + lr.join('');
  }

  // ---------- promotions log ----------
  function renderLog(M, R) {
    var rr = R.slice().sort(function (a, b) { return a.start < b.start ? 1 : -1; });
    document.getElementById('runsTable').innerHTML = '<tr><th>Start</th><th>End</th><th class="num">Days</th><th>Brand</th><th>Retailer</th><th>SKU</th><th>Mechanic</th><th class="num">Regular</th><th class="num">Promo / unit</th><th class="num">Depth</th><th>Data</th></tr>' + rr.map(function (u) {
      var end = u.ongoing ? (u.endDate ? 'until ' + fmtDate(u.endDate, 1) : 'ongoing') : fmtDate(u.end, 1);
      var st = u.statuses.REAL ? MOCK + ' + ' + REAL + ' (17 Nov)' : MOCK;
      return '<tr><td>' + fmtDate(u.start, 1) + (u.atStart ? ' or earlier' : '') + '</td><td>' + end + '</td><td class="num">' + u.days + (u.ongoing ? '+' : '') + '</td><td>' + brandTag(u.brand) + '</td><td>' + esc(u.retailer) + '</td><td>' + esc(shortName(u.pair)) + '</td><td>' + (u.type === 'buy3pay2' ? 'Buy 3 pay 2' : 'Price cut') + '</td><td class="num">' + u.reg + '</td><td class="num">' + (Math.round(u.shelf * 100) / 100) + '</td><td class="num">-' + fmt(u.depth, 0) + '%</td><td>' + st + '</td></tr>';
    }).join('');
    var promos = M.d.promotions.filter(function (p) { return /price/i.test(p.type); }), camps = M.d.promotions.filter(function (p) { return !/price/i.test(p.type); });
    document.getElementById('promoTable').innerHTML = '<tr><th>Checked</th><th>Brand</th><th>Item</th><th>Retailer</th><th class="num">Regular</th><th class="num">Shelf</th><th class="num">Off</th><th>Ends</th><th>Notes</th><th>Source</th></tr>' + promos.map(function (p) {
      var reg = num(p.regular_price_thb), pr = num(p.promo_price_thb), off = reg && pr != null ? (reg - pr) / reg * 100 : null;
      return '<tr><td>' + fmtDate(p.date_checked, 1) + '</td><td>' + brandTag(p.brand) + '</td><td>' + esc(p.item) + '</td><td>' + esc(p.retailer) + '</td><td class="num">' + (reg == null ? '-' : reg) + '</td><td class="num">' + (pr == null ? '-' : pr) + '</td><td class="num">' + (off ? '-' + fmt(off, 0) + '%' : 'none') + '</td><td>' + (p.end_date ? fmtDate(p.end_date, 1) : '<span class="muted">not shown</span>') + '</td><td class="muted">' + esc(p.notes) + '</td><td>' + link(p.source_url, hostOf(p.source_url)) + '</td></tr>';
    }).join('');
    document.getElementById('campaignTable').innerHTML = '<tr><th>Date</th><th>Brand</th><th>What</th><th>Channel</th><th>Details</th><th>Source</th></tr>' + camps.map(function (p) {
      return '<tr><td>' + fmtDate(p.event_date, 1) + '</td><td>' + brandTag(p.brand) + '</td><td>' + esc(p.item) + '</td><td>' + esc(p.retailer) + '</td><td>' + esc(p.description) + (p.notes ? '<div class="muted">' + esc(p.notes) + '</div>' : '') + '</td><td>' + link(p.source_url, hostOf(p.source_url)) + '</td></tr>';
    }).join('');
  }

  function renderCases(M) {
    var f = [['what_happened', 'What happened'], ['what_worked', 'What worked'], ['what_didnt', "What didn't"], ['why', 'Why'], ['suggestion_for_malee', 'Suggestion for Malee']];
    document.getElementById('casesWrap').innerHTML = M.d.cases.map(function (c) {
      var srcs = (c.source_urls || '').split('|').filter(Boolean).map(function (u) { return link(u, hostOf(u)); }).join(' · ');
      return '<div class="card case">' + brandTag(c.brand) + ' <span class="muted">' + esc(c.period) + '</span><h3>' + esc(c.title) + '</h3><dl>' +
        f.map(function (x) { return '<dt>' + x[1] + '</dt><dd>' + esc(c[x[0]]) + '</dd>'; }).join('') +
        '<dt>Confidence</dt><dd>' + esc(c.confidence) + '</dd><dt>Sources</dt><dd>' + srcs + '</dd></dl>' +
        (c.test_next_month ? '<div class="test"><b>Test Malee could run next month:</b> ' + esc(c.test_next_month.replace(/^Test Malee could run next month:\s*/i, '')) + '</div>' : '') + '</div>';
    }).join('');
  }

  function tabs() {
    var btns = document.querySelectorAll('nav button');
    Array.prototype.forEach.call(btns, function (b) {
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(btns, function (x) { x.classList.toggle('active', x === b); });
        Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) { t.classList.toggle('active', t.id === 'tab-' + b.dataset.tab); });
        history.replaceState(null, '', '#' + b.dataset.tab);
        Object.keys(charts).forEach(function (k) { charts[k] && charts[k].resize(); });
      });
    });
  }

  function start() {
    tabs();
    var h = (location.hash || '').slice(1), b = h && document.querySelector('nav button[data-tab="' + h + '"]'); if (b) b.click();
    var loaded = {};
    Promise.all(FILES.map(function (f) { return loadCSV(f).then(function (rows) { loaded[f] = rows; }); })).then(function () {
      var M = build(loaded), R = runs(M);
      window.__DASH = M;
      renderHeader(M); renderSummary(M, R); renderPatterns(M, R); renderIndex(M); renderLog(M, R); renderCases(M);
      document.body.setAttribute('data-ready', '1');
    }).catch(function (e) {
      document.getElementById('errors').innerHTML = '<div class="error"><b>Could not load data.</b> ' + esc(e.message) + '<br>If you opened index.html straight from your disk, browsers block CSV loading; use GitHub Pages or a local web server (see GUIDE.md).</div>';
      document.body.setAttribute('data-ready', 'error');
      console.error(e);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
