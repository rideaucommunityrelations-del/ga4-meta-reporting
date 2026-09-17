const bootLog = document.getElementById("boot-log");
const bootScreen = document.getElementById("boot-screen");
const dashboard = document.getElementById("dashboard");

const bootLines = [
  "Authenticating with Google Analytics 4...",
  "Authenticating with Meta Marketing API...",
  "Authenticating with Search Console...",
  "Pulling 30-day performance data...",
  "Computing period-over-period comparisons...",
  "Merging datasets...",
];

function addBootLine(text, delay, ok = false) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const li = document.createElement("li");
      li.textContent = (ok ? "✓ " : "› ") + text;
      if (ok) li.classList.add("ok");
      bootLog.appendChild(li);
      resolve();
    }, delay);
  });
}

async function runBootSequence() {
  for (let i = 0; i < bootLines.length; i++) {
    await addBootLine(bootLines[i], 200);
  }
}

function revealDashboard() {
  bootScreen.classList.add("fade-out");
  dashboard.classList.remove("hidden");
  setTimeout(() => bootScreen.remove(), 700);
}

function fmtNumber(n) {
  return new Intl.NumberFormat("en-US").format(Math.round(n || 0));
}
function fmtCurrency(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
}
function fmtPct(n) {
  return `${n}%`;
}

function badgeHTML(pct) {
  if (pct === null || pct === undefined) return "";
  const up = pct >= 0;
  return `<span class="badge ${up ? "up" : "down"}">${up ? "▲" : "▼"} ${Math.abs(pct)}%</span>`;
}

function kpiCard(label, value, source, delay, comparisonPct) {
  const div = document.createElement("div");
  div.className = `kpi-card ${source}`;
  div.style.animationDelay = `${delay}ms`;
  div.innerHTML = `
    <div class="label">${label}</div>
    <div class="value-row">
      <div class="value">${value}</div>
      ${badgeHTML(comparisonPct)}
    </div>`;
  return div;
}

function renderKPIs(ga4, meta) {
  const grid = document.getElementById("kpi-grid");
  grid.innerHTML = "";
  let d = 0;
  const step = 60;
  const gc = ga4.comparison || {};
  const mc = meta.comparison || {};

  if (!ga4.error) {
    grid.appendChild(kpiCard("Sessions", fmtNumber(ga4.sessions), "ga4", (d += step), gc.sessions));
    grid.appendChild(kpiCard("Active Users", fmtNumber(ga4.activeUsers), "ga4", (d += step), gc.activeUsers));
    grid.appendChild(kpiCard("GA4 Conversions", fmtNumber(ga4.conversions), "ga4", (d += step), gc.conversions));
    grid.appendChild(kpiCard("Engagement Rate", fmtPct(ga4.engagementRate), "ga4", (d += step)));
  }
  if (!meta.error) {
    grid.appendChild(kpiCard("Ad Spend", fmtCurrency(meta.spend), "meta", (d += step), mc.spend));
    grid.appendChild(kpiCard("Clicks", fmtNumber(meta.clicks), "meta", (d += step), mc.clicks));
    grid.appendChild(kpiCard("CTR", fmtPct(meta.ctr), "meta", (d += step)));
    grid.appendChild(kpiCard("CPC", fmtCurrency(meta.cpc), "meta", (d += step)));
    grid.appendChild(kpiCard("Frequency", meta.frequency, "meta", (d += step)));
  }
}

function renderBars(containerId, items, labelKey, valueKey, formatter) {
  const el = document.getElementById(containerId);
  el.innerHTML = "";
  if (!items || items.length === 0) {
    el.innerHTML = `<p style="color:var(--muted); font-size:12px;">No data available.</p>`;
    return;
  }
  const max = Math.max(...items.map((i) => i[valueKey]));
  items.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <div class="bar-label"><span>${item[labelKey]}</span><span>${formatter(item[valueKey])}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:0%"></div></div>
    `;
    el.appendChild(row);
    const fill = row.querySelector(".bar-fill");
    const pct = max ? (item[valueKey] / max) * 100 : 0;
    setTimeout(() => (fill.style.width = pct + "%"), 100 + idx * 80);
  });
}

function renderList(containerId, items, rowFn) {
  const el = document.getElementById(containerId);
  el.innerHTML = "";
  if (!items || items.length === 0) {
    el.innerHTML = `<li>No data available.</li>`;
    return;
  }
  items.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = rowFn(item);
    el.appendChild(li);
  });
}

// Draws two normalized polylines (sessions, spend) on the trend SVG
function renderTrendChart(ga4Trend, metaTrend) {
  const svg = document.getElementById("trend-chart");
  svg.innerHTML = "";
  if ((!ga4Trend || ga4Trend.length === 0) && (!metaTrend || metaTrend.length === 0)) {
    svg.innerHTML = `<text x="10" y="80" fill="#7d8794" font-size="12">No trend data available.</text>`;
    return;
  }

  const W = 800, H = 160, PAD = 10;

  function toPoints(series, key) {
    if (!series || series.length === 0) return "";
    const values = series.map((d) => d[key]);
    const max = Math.max(...values, 1);
    const min = 0;
    const stepX = (W - PAD * 2) / Math.max(series.length - 1, 1);
    return series
      .map((d, i) => {
        const x = PAD + i * stepX;
        const y = H - PAD - ((d[key] - min) / (max - min || 1)) * (H - PAD * 2);
        return `${x},${y}`;
      })
      .join(" ");
  }

  const sessionsPoints = toPoints(ga4Trend, "sessions");
  const spendPoints = toPoints(metaTrend, "spend");

  const ns = "http://www.w3.org/2000/svg";

  if (sessionsPoints) {
    const poly = document.createElementNS(ns, "polyline");
    poly.setAttribute("points", sessionsPoints);
    poly.setAttribute("fill", "none");
    poly.setAttribute("stroke", "#f9ab00");
    poly.setAttribute("stroke-width", "2");
    svg.appendChild(poly);
  }
  if (spendPoints) {
    const poly = document.createElementNS(ns, "polyline");
    poly.setAttribute("points", spendPoints);
    poly.setAttribute("fill", "none");
    poly.setAttribute("stroke", "#1877f2");
    poly.setAttribute("stroke-width", "2");
    svg.appendChild(poly);
  }
}

async function loadReport() {
  const res = await fetch("/api/report");
  const report = await res.json();

  const ga4 = report.ga4 || {};
  const meta = report.meta || {};
  const gsc = report.gsc || {};

  document.getElementById("range-label").textContent =
    (ga4.range || meta.range || "Last 30 days") + (report.cached ? " · cached" : " · live");

  if (report.summary) {
    document.getElementById("ai-summary-text").textContent = report.summary;
    document.getElementById("ai-summary").classList.remove("hidden");
  }

  renderKPIs(ga4, meta);
  renderTrendChart(ga4.dailyTrend, meta.dailyTrend);

  renderBars("channels-bars", ga4.topChannels, "channel", "sessions", fmtNumber);
  renderBars("campaigns-bars", meta.campaigns, "name", "spend", fmtCurrency);
  renderBars("device-bars", ga4.deviceBreakdown, "device", "sessions", fmtNumber);
  renderBars("nvr-bars", ga4.newVsReturning, "type", "sessions", fmtNumber);

  renderList("pages-list", ga4.topPages, (p) => `<span>${p.page}</span><span>${fmtNumber(p.sessions)} sessions</span>`);
  renderList("geo-list", ga4.topCountries, (c) => `<span>${c.country}</span><span>${fmtNumber(c.sessions)} sessions</span>`);
  renderList("ads-list", meta.topAds, (a) => `<span>${a.name}</span><span>${fmtCurrency(a.spend)}</span>`);

  if (report.gsc) {
    renderList(
      "queries-list",
      gsc.topQueries,
      (q) => `<span>${q.query}</span><span>${fmtNumber(q.clicks)} clicks · pos ${q.position}</span>`
    );
  } else {
    document.getElementById("queries-panel").innerHTML =
      `<h2>Top Search Queries <span class="tag gsc">GSC</span></h2><p style="color:var(--muted); font-size:12px;">Not configured — add GSC_SITE_URL to .env to enable.</p>`;
  }

  if (ga4.error) {
    document.getElementById("channels-panel").innerHTML = `<div class="error-note">GA4 error: ${ga4.error}</div>`;
  }
  if (meta.error) {
    document.getElementById("campaigns-panel").innerHTML = `<div class="error-note">Meta error: ${meta.error}</div>`;
  }
  if (report.gsc && gsc.error) {
    document.getElementById("queries-panel").innerHTML = `<div class="error-note">Search Console error: ${gsc.error}</div>`;
  }
}

(async function init() {
  const bootPromise = runBootSequence();
  const dataPromise = loadReport().catch((err) => {
    addBootLine(`Error: ${err.message}`, 0);
  });

  await Promise.all([bootPromise, dataPromise]);
  await addBootLine("All systems connected.", 300, true);
  setTimeout(revealDashboard, 500);
})();
