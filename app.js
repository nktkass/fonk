/* ============================================================
   fonk — front-end interactions
   Home terminal simulation · fee calculator · docs scrollspy
   ============================================================ */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const usd = (n, d = 2) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const usd0 = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const now = () => new Date().toLocaleTimeString('en-US', { hour12: false });
  // Memecoin watchlist (simulated quotes)
  const TICKERS = ['WIF', 'BONK', 'PEPE', 'DOGE', 'POPCAT', 'MOG', 'BRETT', 'MEW', 'PNUT', 'GOAT', 'FARTCOIN', 'FLOKI'];
  const MEME_BASE = {
    WIF: 1.85, BONK: 0.000018, PEPE: 0.0000095, DOGE: 0.16, POPCAT: 0.42,
    MOG: 0.0000018, BRETT: 0.085, MEW: 0.0065, PNUT: 0.28, GOAT: 0.12,
    FARTCOIN: 0.55, FLOKI: 0.00014,
  };
  const memePrice = (t) => {
    const base = MEME_BASE[t] != null ? MEME_BASE[t] : 0.01 + Math.random() * 2;
    const jitter = base * (0.7 + Math.random() * 0.6);
    if (jitter < 0.0001) return +jitter.toFixed(8);
    if (jitter < 0.01) return +jitter.toFixed(6);
    if (jitter < 1) return +jitter.toFixed(4);
    return +jitter.toFixed(2);
  };
  const fmtPrice = (n) => {
    const v = Number(n);
    if (v < 0.0001) return '$' + v.toFixed(8);
    if (v < 0.01) return '$' + v.toFixed(6);
    if (v < 1) return '$' + v.toFixed(4);
    return usd(v);
  };

  /* ---------- top ticker ---------- */
  const topticker = $('#topticker');
  if (topticker) {
    const base = {};
    TICKERS.forEach((t) => (base[t] = memePrice(t)));
    const build = () =>
      TICKERS.map((t) => {
        const chg = (Math.random() * 18 - 8);
        const arrow = chg >= 0 ? '▲' : '▼';
        return `<span>${t} <b>${fmtPrice(base[t])}</b> <em style="color:${chg >= 0 ? 'var(--green)' : 'var(--red)'};font-style:normal">${arrow}${Math.abs(chg).toFixed(2)}%</em></span>`;
      }).join('');
    topticker.innerHTML = build() + build();
  }

  /* ---------- animated count-up for hero + stats ---------- */
  function countUp(el) {
    const raw = el.textContent.trim();
    const m = raw.match(/^([^\d]*)([\d,.]+)([^\d]*)$/);
    if (!m) return;
    const prefix = m[1], suffix = m[3];
    const target = parseFloat(m[2].replace(/,/g, ''));
    const decimals = (m[2].split('.')[1] || '').length;
    let cur = 0;
    const steps = 55;
    const inc = target / steps;
    const tick = () => {
      cur += inc;
      if (cur >= target) cur = target;
      el.textContent = prefix + cur.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
      if (cur < target) requestAnimationFrame(tick);
    };
    tick();
  }
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries, ob) => {
        entries.forEach((e) => { if (e.isIntersecting) { countUp(e.target); ob.unobserve(e.target); } });
      }, { threshold: 0.4 })
    : null;
  $$('.stat b, .hero-badges b').forEach((el) => { if (io) io.observe(el); else countUp(el); });

  /* ============================================================
     WALLET — Bankr-style trading book + simulated agent trades
     Starts: 1,000 USDC, 0 positions. Trades every 15–30s.
     ============================================================ */
  const wallet = $('#wallet');
  if (wallet) {
    const INCEPTION = 1000;
    const TRADE_TICKERS = ['WIF', 'BONK', 'PEPE', 'DOGE', 'POPCAT', 'BRETT', 'PNUT', 'GOAT', 'FARTCOIN', 'MEW'];
    const MIN_CASH_RESERVE = 40;
    const FEE_RATE = 0.001; // 0.1% per trade
    const STORAGE_KEY = 'fonk-wallet-state';
    const STORAGE_VERSION = 3; // v3: fonk memecoin book

    const prices = {};
    TRADE_TICKERS.forEach((t) => { prices[t] = memePrice(t); });

    function createFreshState() {
      return {
        cash: INCEPTION,
        positions: {},
        orders: [],
        activity: [],
        tradeCount: 0,
        live: false,
        orderSeq: 0,
        openedTickers: new Set(),
      };
    }

    const state = createFreshState();

    function serializeWalletState() {
      return {
        version: STORAGE_VERSION,
        lastSavedAt: new Date().toISOString(),
        cash: state.cash,
        positions: state.positions,
        orders: state.orders,
        activity: state.activity,
        tradeCount: state.tradeCount,
        live: state.live,
        orderSeq: state.orderSeq,
        openedTickers: [...state.openedTickers],
        prices: { ...prices },
      };
    }

    function loadWalletState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (!data || data.version !== STORAGE_VERSION) return false;

        state.cash = typeof data.cash === 'number' ? data.cash : INCEPTION;
        state.positions = data.positions && typeof data.positions === 'object' ? data.positions : {};
        state.orders = Array.isArray(data.orders) ? data.orders : [];
        state.activity = Array.isArray(data.activity) ? data.activity : [];
        state.tradeCount = typeof data.tradeCount === 'number' ? data.tradeCount : 0;
        state.live = !!data.live;
        state.orderSeq = typeof data.orderSeq === 'number' ? data.orderSeq : 0;
        state.openedTickers = new Set(Array.isArray(data.openedTickers) ? data.openedTickers : []);

        if (data.prices && typeof data.prices === 'object') {
          TRADE_TICKERS.forEach((t) => {
            if (typeof data.prices[t] === 'number' && data.prices[t] > 0) prices[t] = data.prices[t];
          });
        }
        return true;
      } catch (err) {
        console.warn('[fonk-wallet] Failed to load persisted state:', err);
        return false;
      }
    }

    function saveWalletState() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeWalletState()));
      } catch (err) {
        console.warn('[fonk-wallet] Failed to save state (continuing in-memory):', err);
      }
    }

    const restored = loadWalletState();

    // DOM refs
    const pfVal = $('#pfVal'), pfUsd = $('#pfUsd'), pfChg = $('#pfChg');
    const bkBalanceLg = $('#bkBalanceLg');
    const venueUsdc = $('#venueUsdc'), venueEq = $('#venueEq');
    const holdings = $('#holdings');
    const eqEmpty = $('#eqEmpty'), eqTableWrap = $('#eqTableWrap'), eqHoldings = $('#eqHoldings');
    const eqCount = $('#eqCount'), navEqCount = $('#navEqCount'), tradeCountEl = $('#tradeCount');
    const phaseBadge = $('#phaseBadge');
    const ordersEmpty = $('#ordersEmpty'), ordersTableWrap = $('#ordersTableWrap'), ordersBody = $('#ordersBody');
    const ordersMeta = $('#ordersMeta'), ordersFilter = $('#ordersFilter');
    const positionsEmpty = $('#positionsEmpty'), positionsTableWrap = $('#positionsTableWrap'), positionsBody = $('#positionsBody');
    const positionsMeta = $('#positionsMeta'), positionsFilter = $('#positionsFilter');
    const activityEmpty = $('#activityEmpty'), activityList = $('#activityList');
    const activityMeta = $('#activityMeta'), activityFilter = $('#activityFilter');

    const fmtQty = (n) => {
      const v = Number(n);
      if (v >= 1e6) return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
      if (v >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
      return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    };
    const fmtPx = (n) => fmtPrice(n);
    const fmtPct = (n) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
    const ts = () => new Date().toLocaleTimeString('en-US', { hour12: false });
    const tsFull = () => new Date().toLocaleString('en-US', { hour12: false, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const rand = (a, b) => a + Math.random() * (b - a);
    const pickTrade = (a) => a[Math.floor(Math.random() * a.length)];

    function memeBookValue() {
      let v = 0;
      for (const t in state.positions) {
        const p = state.positions[t];
        if (p.qty > 0.0001) v += p.qty * (prices[t] || p.avgEntry);
      }
      return v;
    }

    function portfolioValue() { return state.cash + memeBookValue(); }

    function inceptionPnL() {
      const v = portfolioValue();
      const abs = v - INCEPTION;
      const pct = INCEPTION > 0 ? (abs / INCEPTION) * 100 : 0;
      return { abs, pct, total: v };
    }

    function openPositions() {
      return Object.entries(state.positions)
        .filter(([, p]) => p.qty > 0.0001)
        .map(([ticker, p]) => ({ ticker, ...p }));
    }

    function nextActivityId() {
      return state.activity.reduce((max, a) => Math.max(max, a.id || 0), 0) + 1;
    }

    function logActivity(type, message) {
      state.activity.unshift({ time: tsFull(), type, message, id: nextActivityId() });
      if (state.activity.length > 200) state.activity.pop();
    }

    function applyPhaseBadge() {
      if (!phaseBadge) return;
      if (state.live) {
        phaseBadge.textContent = 'TRADING';
        phaseBadge.classList.add('live');
        phaseBadge.hidden = false;
        phaseBadge.classList.remove('bk-hidden');
      } else {
        phaseBadge.textContent = '';
        phaseBadge.classList.remove('live');
        phaseBadge.hidden = true;
        phaseBadge.classList.add('bk-hidden');
      }
    }

    function markLive() {
      if (state.live) return;
      state.live = true;
      applyPhaseBadge();
      logActivity('info', 'Trading session started');
      renderActivity(true);
      saveWalletState();
    }

    function executeBuy(ticker, notional) {
      const px = prices[ticker];
      if (!px || notional <= 0) return false;
      const fee = notional * FEE_RATE;
      const total = notional + fee;
      if (total > state.cash - MIN_CASH_RESERVE) {
        notional = Math.max(0, state.cash - MIN_CASH_RESERVE - fee);
        if (notional < 15) return false;
      }
      const qtyDigits = px < 0.001 ? 0 : px < 0.1 ? 2 : 4;
      const qty = +((notional / px).toFixed(qtyDigits));
      if (qty <= 0) return false;
      const actualNotional = qty * px;
      const actualFee = actualNotional * FEE_RATE;
      const actualTotal = actualNotional + actualFee;
      if (actualTotal > state.cash) return false;

      state.cash -= actualTotal;
      const prev = state.positions[ticker] || { qty: 0, avgEntry: 0, costBasis: 0 };
      const newQty = prev.qty + qty;
      const newCost = prev.costBasis + actualNotional;
      state.positions[ticker] = { qty: newQty, avgEntry: newCost / newQty, costBasis: newCost };

      state.orderSeq += 1;
      const order = { id: state.orderSeq, time: ts(), side: 'BUY', ticker, qty, price: px, notional: actualNotional, status: 'filled' };
      state.orders.unshift(order);
      state.tradeCount += 1;

      logActivity('buy', `BUY <strong>${fmtQty(qty)} ${ticker}</strong> @ ${fmtPx(px)} · ${usd(actualNotional)}`);
      if (actualFee >= 0.01) logActivity('fee', `Trading fee <strong>${usd(actualFee)}</strong> on ${ticker} buy`);

      if (!state.openedTickers.has(ticker)) {
        logActivity('info', `Position opened · <strong>${ticker}</strong>`);
        state.openedTickers.add(ticker);
      }

      markLive();
      saveWalletState();
      return true;
    }

    function executeSell(ticker, sellPct) {
      const pos = state.positions[ticker];
      if (!pos || pos.qty <= 0.0001) return false;
      const px = prices[ticker];
      const qtyDigits = px < 0.001 ? 0 : px < 0.1 ? 2 : 4;
      let qty = +((pos.qty * sellPct).toFixed(qtyDigits));
      if (qty <= 0) return false;
      if (qty >= pos.qty * 0.95) qty = pos.qty;

      const notional = qty * px;
      const fee = notional * FEE_RATE;
      const proceeds = notional - fee;
      const costSold = (pos.costBasis / pos.qty) * qty;
      const realized = proceeds - costSold;

      state.cash += proceeds;
      pos.qty -= qty;
      pos.costBasis -= costSold;
      if (pos.qty <= 0.0001) {
        delete state.positions[ticker];
        state.openedTickers.delete(ticker);
        logActivity('info', `Position closed · <strong>${ticker}</strong>`);
      } else {
        pos.avgEntry = pos.costBasis / pos.qty;
      }

      state.orderSeq += 1;
      const order = { id: state.orderSeq, time: ts(), side: 'SELL', ticker, qty, price: px, notional, status: 'filled' };
      state.orders.unshift(order);
      state.tradeCount += 1;

      const pnlCls = realized >= 0 ? 'g' : 'r';
      logActivity('sell', `SELL <strong>${fmtQty(qty)} ${ticker}</strong> @ ${fmtPx(px)} · realized <strong class="${pnlCls}">${realized >= 0 ? '+' : ''}${usd(realized)}</strong>`);
      if (fee >= 0.01) logActivity('fee', `Trading fee <strong>${usd(fee)}</strong> on ${ticker} sell`);

      markLive();
      saveWalletState();
      return true;
    }

    function maybeTrade() {
      const positions = openPositions();
      const canBuy = state.cash > MIN_CASH_RESERVE + 20;
      const canSell = positions.length > 0;

      if (!canBuy && !canSell) return;

      let action;
      if (!canSell) action = 'buy';
      else if (!canBuy) action = 'sell';
      else {
        const deployRatio = memeBookValue() / portfolioValue();
        if (deployRatio < 0.15) action = 'buy';
        else if (deployRatio > 0.75 && Math.random() < 0.55) action = 'sell';
        else action = Math.random() < 0.62 ? 'buy' : 'sell';
      }

      if (action === 'buy') {
        const ticker = pickTrade(TRADE_TICKERS);
        const maxSpend = Math.min(rand(20, 80), state.cash - MIN_CASH_RESERVE);
        if (maxSpend >= 15) executeBuy(ticker, maxSpend);
      } else {
        const pos = pickTrade(positions);
        executeSell(pos.ticker, rand(0.2, 0.55));
      }

      renderAll(true);
    }

    function scheduleTrade() {
      const delay = rand(15000, 30000);
      setTimeout(() => { maybeTrade(); scheduleTrade(); }, delay);
    }

    // First trade after a short warm-up (18–28s)
    setTimeout(() => { maybeTrade(); scheduleTrade(); }, rand(18000, 28000));

    // Memecoin price drift — higher vol than equities
    let lastPriceSave = 0;
    setInterval(() => {
      TRADE_TICKERS.forEach((t) => {
        const next = Math.max(1e-10, prices[t] * (1 + (Math.random() - 0.48) / 80));
        prices[t] = next < 0.0001 ? +next.toFixed(8) : next < 0.01 ? +next.toFixed(6) : next < 1 ? +next.toFixed(4) : +next.toFixed(2);
      });
      renderAll(false);
      const nowMs = Date.now();
      if (nowMs - lastPriceSave >= 5000) {
        saveWalletState();
        lastPriceSave = nowMs;
      }
    }, 1500);

    // --- rendering ---
    function renderBalance() {
      const { abs, pct, total } = inceptionPnL();
      const eq = memeBookValue();
      if (bkBalanceLg) bkBalanceLg.textContent = usd(total);
      if (pfUsd) pfUsd.textContent = usd(total);
      if (pfVal) pfVal.textContent = total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USDC';
      if (venueUsdc) venueUsdc.textContent = usd(state.cash);
      if (venueEq) venueEq.textContent = usd(eq);
      if (pfChg) {
        pfChg.className = 'chg' + (abs > 0.005 ? ' g' : abs < -0.005 ? ' r' : '');
        pfChg.textContent = `${abs >= 0 ? '+' : ''}${abs.toFixed(2)} (${fmtPct(pct)})`;
      }
      if (tradeCountEl) tradeCountEl.textContent = String(state.tradeCount);
    }

    function renderHoldings(animate) {
      if (!holdings) return;
      const rows = [];
      rows.push(`<tr${animate ? ' class="bk-row-new"' : ''}>
        <td><div class="bk-tok"><span class="bk-tok-ic">$</span><span class="bk-tok-sym">USDC</span></div></td>
        <td class="num">${state.cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="num">${usd(state.cash)}</td>
        <td class="num bk-tok-pnl">—</td></tr>`);

      openPositions().sort((a, b) => a.ticker.localeCompare(b.ticker)).forEach((p) => {
        const px = prices[p.ticker] || p.avgEntry;
        const val = p.qty * px;
        const pnl = val - p.costBasis;
        const pnlPct = p.costBasis > 0 ? (pnl / p.costBasis) * 100 : 0;
        const cls = pnl >= 0 ? 'g' : 'r';
        rows.push(`<tr${animate ? ' class="bk-row-new"' : ''}>
          <td><div class="bk-tok"><span class="bk-tok-ic">${p.ticker.slice(0, 1)}</span><span class="bk-tok-sym">${p.ticker}</span></div></td>
          <td class="num">${fmtQty(p.qty)}</td>
          <td class="num">${usd(val)}</td>
          <td class="num bk-tok-pnl ${cls}">${pnl >= 0 ? '+' : ''}${usd(pnl)} (${fmtPct(pnlPct)})</td></tr>`);
      });
      holdings.innerHTML = rows.join('');

      const count = openPositions().length;
      if (eqCount) eqCount.textContent = String(count);
      if (navEqCount) navEqCount.textContent = String(count);

      if (eqEmpty && eqTableWrap && eqHoldings) {
        if (count === 0) {
          eqEmpty.classList.remove('bk-hidden');
          eqTableWrap.classList.add('bk-hidden');
        } else {
          eqEmpty.classList.add('bk-hidden');
          eqTableWrap.classList.remove('bk-hidden');
          eqHoldings.innerHTML = openPositions().sort((a, b) => a.ticker.localeCompare(b.ticker)).map((p) => {
            const px = prices[p.ticker] || p.avgEntry;
            const val = p.qty * px;
            const pnl = val - p.costBasis;
            const pnlPct = p.costBasis > 0 ? (pnl / p.costBasis) * 100 : 0;
            const cls = pnl >= 0 ? 'g' : 'r';
            return `<tr><td><strong>${p.ticker}</strong></td><td class="num">${fmtQty(p.qty)}</td><td class="num">${fmtPx(p.avgEntry)}</td><td class="num">${fmtPx(px)}</td><td class="num">${usd(val)}</td><td class="num ${cls}">${pnl >= 0 ? '+' : ''}${usd(pnl)} (${fmtPct(pnlPct)})</td></tr>`;
          }).join('');
        }
      }
    }

    function renderOrders(animate) {
      const q = (ordersFilter && ordersFilter.value || '').trim().toLowerCase();
      const filtered = state.orders.filter((o) => !q || o.ticker.toLowerCase().includes(q) || o.side.toLowerCase().includes(q) || o.status.includes(q));
      if (ordersMeta) ordersMeta.textContent = `${state.orders.length} order${state.orders.length !== 1 ? 's' : ''}`;
      if (!ordersEmpty || !ordersTableWrap || !ordersBody) return;
      if (state.orders.length === 0) {
        ordersEmpty.classList.remove('bk-hidden');
        ordersTableWrap.classList.add('bk-hidden');
        return;
      }
      ordersEmpty.classList.add('bk-hidden');
      ordersTableWrap.classList.remove('bk-hidden');
      ordersBody.innerHTML = filtered.map((o, i) => {
        const sideCls = o.side === 'BUY' ? 'bk-side-buy' : 'bk-side-sell';
        const anim = animate && i === 0 ? ' bk-row-new' : '';
        return `<tr class="${anim.trim()}"><td class="mono">${o.time}</td><td class="${sideCls}">${o.side}</td><td><strong>${o.ticker}</strong></td><td class="num">${fmtQty(o.qty)}</td><td class="num">${fmtPx(o.price)}</td><td class="num">${usd(o.notional)}</td><td><span class="bk-status filled">${o.status}</span></td></tr>`;
      }).join('');
    }

    function renderPositions(animate) {
      const positions = openPositions();
      const eq = memeBookValue();
      const total = portfolioValue();
      if (positionsMeta) positionsMeta.textContent = `${positions.length} open · ${usd(eq)} deployed`;
      const q = (positionsFilter && positionsFilter.value || '').trim().toLowerCase();
      const filtered = positions.filter((p) => !q || p.ticker.toLowerCase().includes(q));
      if (!positionsEmpty || !positionsTableWrap || !positionsBody) return;
      if (positions.length === 0) {
        positionsEmpty.classList.remove('bk-hidden');
        positionsTableWrap.classList.add('bk-hidden');
        return;
      }
      positionsEmpty.classList.add('bk-hidden');
      positionsTableWrap.classList.remove('bk-hidden');
      positionsBody.innerHTML = filtered.sort((a, b) => a.ticker.localeCompare(b.ticker)).map((p, i) => {
        const px = prices[p.ticker] || p.avgEntry;
        const val = p.qty * px;
        const pnl = val - p.costBasis;
        const alloc = total > 0 ? (val / total) * 100 : 0;
        const cls = pnl >= 0 ? 'g' : 'r';
        const anim = animate && i === 0 ? ' bk-row-new' : '';
        return `<tr class="${anim.trim()}"><td><strong>${p.ticker}</strong></td><td class="num">${fmtQty(p.qty)}</td><td class="num">${fmtPx(p.avgEntry)}</td><td class="num">${fmtPx(px)}</td><td class="num ${cls}">${pnl >= 0 ? '+' : ''}${usd(pnl)}</td><td class="num">${alloc.toFixed(1)}%</td></tr>`;
      }).join('');
    }

    function renderActivity(animate) {
      if (activityMeta) activityMeta.textContent = `${state.activity.length} event${state.activity.length !== 1 ? 's' : ''}`;
      const q = (activityFilter && activityFilter.value || '').trim().toLowerCase();
      const filtered = state.activity.filter((a) => !q || a.message.toLowerCase().includes(q) || a.type.includes(q));
      if (!activityEmpty || !activityList) return;
      if (state.activity.length === 0) {
        activityEmpty.classList.remove('bk-hidden');
        activityList.classList.add('bk-hidden');
        return;
      }
      activityEmpty.classList.add('bk-hidden');
      activityList.classList.remove('bk-hidden');
      activityList.innerHTML = filtered.map((a, i) => {
        const anim = animate && i === 0 ? ' bk-row-new' : '';
        return `<div class="bk-act-row-item${anim}"><span class="bk-act-time">${a.time.split(', ').pop() || a.time}</span><span class="bk-act-type ${a.type}">${a.type}</span><span class="bk-act-msg">${a.message}</span></div>`;
      }).join('');
    }

    function renderAll(animate) {
      renderBalance();
      renderHoldings(animate);
      renderOrders(animate);
      renderPositions(animate);
      renderActivity(animate);
    }

    applyPhaseBadge();
    renderAll(false);
    if (restored) saveWalletState();

    // Main tab switching
    $$('.bk-top-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const name = tab.dataset.tab;
        $$('.bk-top-tab').forEach((t) => {
          const on = t.dataset.tab === name;
          t.classList.toggle('active', on);
          t.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        $$('.bk-main-pane').forEach((p) => {
          const on = p.id === 'pane-' + name;
          p.classList.toggle('active', on);
          if (on) p.removeAttribute('hidden'); else p.setAttribute('hidden', '');
        });
      });
    });

    // Portfolio sub-tabs (Stablecoins / Memecoins)
    $$('.bk-sub-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        $$('.bk-sub-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        const pane = tab.dataset.subtab === 'memecoins' || tab.dataset.subtab === 'equities'
          ? '#pane-memecoins'
          : '#pane-tokens';
        $$('#pane-portfolio .bk-tab-pane').forEach((p) => p.classList.remove('active'));
        const el = $(pane);
        if (el) el.classList.add('active');
      });
    });

    // Explorer filters
    [ordersFilter, positionsFilter, activityFilter].forEach((el) => {
      if (el) el.addEventListener('input', () => renderAll(false));
    });
  }

  /* ============================================================
     FEES — interactive calculator
     ============================================================ */
  const amt = $('#amt');
  if (amt) {
    const feeRate = $('#feeRate'), ret = $('#ret'), split = $('#split');
    const feeRateLbl = $('#feeRateLbl'), retLbl = $('#retLbl'), splitLbl = $('#splitLbl');
    const oFee = $('#oFee'), oCap = $('#oCap'), oProfit = $('#oProfit'),
      oKeep = $('#oKeep'), oDrop = $('#oDrop'), oRebate = $('#oRebate');

    function calc() {
      const A = Math.max(0, parseFloat(amt.value) || 0);
      const fr = parseFloat(feeRate.value) / 100;
      const rr = parseFloat(ret.value) / 100;
      const sp = parseFloat(split.value) / 100;

      const fee = A * fr;
      const capital = fee;
      const profit = capital * rr;
      const drop = Math.max(0, profit) * sp;
      const keep = Math.max(0, profit) - drop;
      const rebate = fee > 0 ? (drop / fee) * 100 : 0;

      feeRateLbl.textContent = (fr * 100).toFixed(2).replace(/\.00$/, '.0') + '%';
      retLbl.textContent = (rr * 100).toFixed(1) + '%';
      splitLbl.textContent = Math.round(sp * 100) + '%';

      oFee.textContent = usd(fee);
      oCap.textContent = usd(capital);
      oProfit.textContent = (profit < 0 ? '−' : '') + usd(Math.abs(profit));
      oProfit.style.color = profit < 0 ? 'var(--red)' : '';
      oKeep.textContent = usd(keep);
      oDrop.textContent = usd(drop);
      oRebate.textContent = rebate.toFixed(1) + '%';
    }
    [amt, feeRate, ret, split].forEach((el) => el.addEventListener('input', calc));
    calc();
  }

  /* ============================================================
     TERMINAL — interactive console
     ============================================================ */
  const screen = $('#screen');
  if (screen) {
    const input = $('#input');
    const form = $('#form');
    const consoleEl = $('#console');
    const bootTime = Date.now();

    // --- shared state (standby) ---
    // book funded with 1,000 USDC, agent not trading yet → no positions, no P&L.
    const prices = {};
    const day = {};
    TICKERS.forEach((t) => { prices[t] = memePrice(t); day[t] = +(Math.random() * 18 - 8).toFixed(2); });
    const held = []; // no open positions yet
    const TREASURY = 1000; // USDC
    // memecoin quotes still move (for `price`); the treasury does not — nothing is trading.
    setInterval(() => {
      TICKERS.forEach((t) => {
        const next = Math.max(1e-10, prices[t] * (1 + (Math.random() - 0.48) / 80));
        prices[t] = next < 0.0001 ? +next.toFixed(8) : next < 0.01 ? +next.toFixed(6) : next < 1 ? +next.toFixed(4) : +next.toFixed(2);
      });
    }, 1500);

    // --- printing ---
    function print(html, cls) {
      const div = document.createElement('div');
      div.className = 'row' + (cls ? ' ' + cls : '');
      div.innerHTML = html;
      screen.appendChild(div);
      screen.scrollTop = screen.scrollHeight;
      return div;
    }
    const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
    function printLines(lines) { lines.forEach((l) => print(l)); }
    function echo(cmd) { print(`<span class="prompt">fonk@core:~$</span> <span class="cmd">${esc(cmd)}</span>`); }

    function sessionTime() {
      const s = Math.floor((Date.now() - bootTime) / 1000);
      return `${Math.floor(s / 60)}m ${s % 60}s`;
    }
    const money = (n, d = 2) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    const usdc = (n, d = 2) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' USDC';

    // --- commands ---
    const COMMANDS = {
      help() {
        printLines([
          '<span class="hd">available commands</span>',
          '  <span class="cmd">status</span>            live portfolio value, day P&amp;L and uptime',
          '  <span class="cmd">positions</span>         open positions in the book',
          '  <span class="cmd">orders</span>            recent order flow',
          '  <span class="cmd">airdrop</span>           current cycle airdrop &amp; countdown',
          '  <span class="cmd">fees &lt;amount&gt;</span>     estimate fee, capital &amp; airdrop rebate',
          '  <span class="cmd">price &lt;token&gt;</span>      quote for a memecoin',
          '  <span class="cmd">about</span>             what fonk is',
          '  <span class="cmd">docs</span>              open the documentation',
          '  <span class="cmd">clear</span>             clear the screen',
        ]);
      },
      status() {
        printLines([
          '<span class="hd">book status</span>',
          `  phase             <span class="muted">standby</span> <span class="muted">— not trading yet</span>`,
          `  treasury value    <span class="cmd">${usdc(TREASURY)}</span>`,
          `  venue             <span class="cmd">Solana DEXs</span>`,
          `  since inception   <span class="cmd">0.00  (0.00%)</span>`,
          `  open positions    <span class="cmd">0</span>`,
          `  trades executed   <span class="cmd">0</span>`,
          `  win rate          <span class="muted">— (no history yet)</span>`,
          `  session           <span class="cmd">${sessionTime()}</span>`,
        ]);
      },
      positions() {
        print('<span class="hd">open memecoin positions</span>');
        print('  <span class="muted">no open positions — the agent hasn\'t started trading yet.</span>');
      },
      orders() {
        print('<span class="hd">order flow</span>');
        print('  <span class="muted">no swaps yet — first memecoin trades execute at go-live.</span>');
      },
      airdrop() {
        printLines([
          '<span class="hd">airdrop</span>',
          `  status               <span class="warn">no airdrops yet</span>`,
          `  first cycle          <span class="muted">begins after launch</span>`,
          `  split (at launch)    <span class="cmd">80% holders / 20% treasury</span>`,
          `  <span class="muted">tip: your share will be pro-rata to your holdings at snapshot.</span>`,
        ]);
      },
      fees(args) {
        const amt = parseFloat((args[0] || '').replace(/[^0-9.]/g, ''));
        if (!amt || amt <= 0) { print('<span class="err">usage: fees &lt;amount&gt;   e.g. fees 10000</span>'); return; }
        const fee = amt * 0.01, cap = fee, profit = cap * 0.06, drop = profit * 0.8, rebate = (drop / fee) * 100;
        printLines([
          `<span class="hd">fee estimate · ${money(amt)}</span>`,
          `  fee (1%)             <span class="cmd">${money(fee)}</span>`,
          `  deployed as capital  <span class="cmd">${money(cap)}</span>  <span class="muted">(100%)</span>`,
          `  projected profit     <span class="up">${money(profit)}</span>  <span class="muted">(@6% cycle)</span>`,
          `  airdropped to you     <span class="ok">${money(drop)}</span>  <span class="muted">(80%)</span>`,
          `  effective rebate     <span class="cmd">${rebate.toFixed(1)}%</span>`,
          `  <span class="muted">illustrative · returns not guaranteed. see fees.html</span>`,
        ]);
      },
      price(args) {
        const t = (args[0] || '').toUpperCase();
        if (!t) { print('<span class="err">usage: price &lt;token&gt;   e.g. price WIF</span>'); return; }
        if (prices[t] == null) prices[t] = memePrice(t);
        const chg = day[t] != null ? day[t] : +(Math.random() * 18 - 8).toFixed(2);
        const up = chg >= 0;
        print(`  ${pad(t, 10)} <span class="cmd">${fmtPrice(prices[t])}</span>  <span class="${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${Math.abs(chg).toFixed(2)}%</span>  <span class="muted">· via Jupiter</span>`);
      },
      about() {
        printLines([
          '<span class="cmd">fonk</span> — an autonomous AI memecoin trading agent.',
          'will trade memecoins on Solana DEXs 24/7 and airdrop the profits back to holders.',
          'fees fund the book · the agent apes the book · profits go to the people holding.',
          '<span class="muted">treasury seeded with 1,000 USDC · trading not active yet.</span>',
        ]);
      },
      docs() { print('opening docs → <a href="docs.html">docs.html</a>'); setTimeout(() => (window.location.href = 'docs.html'), 600); },
      whoami() { print('holder · <span class="muted">gm. hold to eat.</span>'); },
      clear() { screen.innerHTML = ''; },
    };
    const ALIASES = { positions: ['pos', 'book'], help: ['?', 'commands', 'ls'], clear: ['cls'], status: ['stat'], airdrop: ['drop', 'airdrops'], price: ['quote'], docs: ['doc', 'documentation'] };
    const resolve = (name) => {
      if (COMMANDS[name]) return name;
      for (const k in ALIASES) if (ALIASES[k].includes(name)) return k;
      return null;
    };

    function run(raw) {
      const line = raw.trim();
      if (!line) return;
      echo(line);
      let parts = line.split(/\s+/);
      if (parts[0].toLowerCase() === 'fonk') parts = parts.slice(1); // allow "fonk status"
      const name = (parts[0] || '').toLowerCase().replace(/^--/, '');
      const args = parts.slice(1).filter((a) => !/^--/.test(a)); // ignore flags like --estimate/--status
      const cmd = resolve(name);
      if (cmd) COMMANDS[cmd](args);
      else print(`<span class="err">command not found: ${esc(name)}</span> <span class="muted">— type </span><span class="cmd">help</span>`);
    }

    // --- history ---
    const hist = [];
    let hi = -1;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value;
      if (v.trim()) { hist.push(v); hi = hist.length; }
      run(v);
      input.value = '';
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') { e.preventDefault(); if (hi > 0) { hi--; input.value = hist[hi]; } }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (hi < hist.length - 1) { hi++; input.value = hist[hi]; } else { hi = hist.length; input.value = ''; } }
    });
    consoleEl.addEventListener('click', () => input.focus());
    $$('#chipbar button').forEach((b) => b.addEventListener('click', () => { input.value = b.dataset.cmd; input.focus(); run(b.dataset.cmd); input.value = ''; }));

    // --- boot ---
    printLines([
      '<span class="muted">fonk core v1.0 — autonomous memecoin agent</span>',
      '<span class="muted">● treasury 1,000.00 USDC · Solana DEXs · standby</span>',
      'type <span class="cmd">help</span> to see commands.',
      '&nbsp;',
    ]);
    input.focus();
  }

  /* ============================================================
     DOCS — scrollspy sidebar
     ============================================================ */
  const docnav = $('#docnav');
  if (docnav) {
    const links = $$('a', docnav);
    const map = {};
    links.forEach((a) => { const id = a.getAttribute('href').slice(1); const s = document.getElementById(id); if (s) map[id] = a; });
    const sections = Object.keys(map).map((id) => document.getElementById(id));
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          links.forEach((l) => l.classList.remove('active'));
          const a = map[e.target.id];
          if (a) a.classList.add('active');
        }
      });
    }, { rootMargin: '-80px 0px -70% 0px', threshold: 0 });
    sections.forEach((s) => spy.observe(s));
  }
})();
