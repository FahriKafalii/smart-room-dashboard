const POLL_MS = 1000;
const RENDER_FPS = 30;
const RENDER_MS = Math.round(1000 / RENDER_FPS);
const WINDOW_SEC = 60;
const HISTORY_SEC = 30 * 60;
const DEVICES = ["fan", "heater", "light", "motor"];

const els = {
  healthDot: document.getElementById("health-dot"),
  healthText: document.getElementById("health-text"),
  lastUpdate: document.getElementById("last-update"),
  legendTags: document.getElementById("legend-tags"),
  liveBtn: document.getElementById("btn-live"),
  slider: document.getElementById("time-slider"),
  scrubberTime: document.getElementById("scrubber-time"),
};

const SERIES = [
  { key: "temperature", label: "Sıcaklık (°C)", color: "#f87171", axis: "yLeft" },
  { key: "humidity",    label: "Nem (%)",       color: "#38bdf8", axis: "yLeft" },
  { key: "vibration",   label: "Titreşim (g)",  color: "#a78bfa", axis: "yLeft" },
  { key: "energy",      label: "Enerji (W)",    color: "#fbbf24", axis: "yRight" },
  { key: "light_level", label: "Işık (lx)",     color: "#34d399", axis: "yRight" },
];

const chartCanvas = document.getElementById("temp-chart");
const chartCtx = chartCanvas.getContext("2d");

const chart = new Chart(chartCtx, {
  type: "line",
  data: {
    datasets: SERIES.map(s => ({
      label: s.label,
      data: [],
      borderColor: s.color,
      backgroundColor: s.color + "26",
      borderWidth: 2.4,
      tension: 0.55,
      cubicInterpolationMode: "default",
      stepped: false,
      fill: false,
      pointRadius: 0,
      pointHoverRadius: 0,
      borderJoinStyle: "round",
      borderCapStyle: "round",
      yAxisID: s.axis,
      spanGaps: true,
      hidden: false,
    })),
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    resizeDelay: 120,
    animation: false,
    transitions: {
      active: { animation: { duration: 0 } },
      resize: { animation: { duration: 0 } },
    },
    interaction: { mode: "nearest", axis: "x", intersect: false },
    layout: { padding: { left: 4, right: 4, top: 4, bottom: 0 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: "nearest",
        axis: "x",
        intersect: false,
        backgroundColor: "rgba(11,18,32,0.92)",
        borderColor: "rgba(148,163,184,0.18)",
        borderWidth: 1,
        titleColor: "#e6ecf5",
        bodyColor: "#cbd5e1",
        padding: 10,
        boxPadding: 4,
        callbacks: {
          title: (items) => {
            if (!items.length) return "";
            const d = new Date(items[0].parsed.x);
            return d.toLocaleTimeString("tr-TR", { hour12: false });
          },
        },
      },
    },
    scales: {
      x: {
        type: "linear",
        ticks: {
          color: "#7a8499",
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 6,
          font: { family: "JetBrains Mono, monospace", size: 11 },
          callback: (value) => {
            const d = new Date(value);
            return d.toLocaleTimeString("tr-TR", { hour12: false });
          },
        },
        grid: { color: "rgba(148,163,184,0.06)" },
        border: { color: "rgba(148,163,184,0.12)" },
      },
      yLeft: {
        type: "linear",
        position: "left",
        ticks: { color: "#7a8499", font: { size: 11 } },
        grid: { color: "rgba(148,163,184,0.06)" },
        border: { color: "rgba(148,163,184,0.12)" },
        title: { display: true, text: "C / % / g", color: "#7a8499", font: { size: 11 } },
      },
      yRight: {
        type: "linear",
        position: "right",
        ticks: { color: "#7a8499", font: { size: 11 } },
        grid: { drawOnChartArea: false },
        border: { color: "rgba(148,163,184,0.12)" },
        title: { display: true, text: "W / lx", color: "#7a8499", font: { size: 11 } },
      },
    },
  },
});

const history = [];
let liveMode = true;
let scrubT = null;

let lastReal = null;
let lastLocalT = null;

function nowDataT() {
  if (lastReal === null) return Date.now();
  return lastReal + (performance.now() - lastLocalT);
}

const EMA_ALPHA = 0.45;
const NO_SMOOTH = new Set(["light_level", "vibration"]);
const emaState = {};
function smooth(key, raw) {
  if (NO_SMOOTH.has(key)) return raw;
  if (emaState[key] === undefined) {
    emaState[key] = raw;
    return raw;
  }
  emaState[key] = EMA_ALPHA * raw + (1 - EMA_ALPHA) * emaState[key];
  return emaState[key];
}

function pushSample(payload) {
  const t = Date.now();
  const values = {};
  for (const s of SERIES) {
    values[s.key] = smooth(s.key, payload[s.key]);
  }
  history.push({ t, values });
  const cutoff = t - HISTORY_SEC * 1000;
  while (history.length && history[0].t < cutoff) history.shift();
  lastReal = t;
  lastLocalT = performance.now();
}

function syncDatasetsToWindow(centerT) {
  const start = centerT - WINDOW_SEC * 1000;
  const end = centerT;
  let firstIdx = 0;
  for (let i = 0; i < history.length; i++) {
    if (history[i].t >= start) { firstIdx = Math.max(0, i - 1); break; }
    firstIdx = i;
  }
  let lastIdx = history.length - 1;
  for (let i = firstIdx; i < history.length; i++) {
    if (history[i].t > end) { lastIdx = i; break; }
  }
  for (let i = 0; i < SERIES.length; i++) {
    const arr = chart.data.datasets[i].data;
    arr.length = 0;
    const key = SERIES[i].key;
    for (let j = firstIdx; j <= lastIdx; j++) {
      const s = history[j];
      arr.push({ x: s.t, y: s.values[key] });
    }
  }
  chart.options.scales.x.min = start;
  chart.options.scales.x.max = end;
}

function tickRender() {
  if (lastReal === null) return;
  const center = liveMode ? nowDataT() : scrubT;
  if (center === null) return;
  syncDatasetsToWindow(center);
  if (liveMode) {
    els.slider.value = "100";
    els.scrubberTime.textContent = "CANLI";
  }
  chart.update("none");
}
setInterval(tickRender, RENDER_MS);

function setLiveMode(on) {
  liveMode = on;
  els.liveBtn.classList.toggle("is-active", on);
  if (on) {
    scrubT = null;
    els.slider.value = "100";
  }
}

els.liveBtn.addEventListener("click", () => setLiveMode(true));

els.slider.addEventListener("input", () => {
  if (history.length < 2) return;
  const pct = Number(els.slider.value);
  if (pct >= 99) {
    setLiveMode(true);
    return;
  }
  liveMode = false;
  els.liveBtn.classList.remove("is-active");
  const oldest = history[0].t;
  const newest = nowDataT();
  const minCenter = oldest + (WINDOW_SEC * 1000) / 2;
  const maxCenter = newest;
  scrubT = minCenter + (maxCenter - minCenter) * (pct / 100);
  const d = new Date(scrubT);
  els.scrubberTime.textContent = d.toLocaleTimeString("tr-TR", { hour12: false });
});

function buildLegend() {
  els.legendTags.innerHTML = "";
  SERIES.forEach((s, i) => {
    const tag = document.createElement("button");
    tag.type = "button";
    tag.className = "legend-tag";
    tag.dataset.idx = String(i);
    tag.innerHTML = `<span class="swatch" style="background:${s.color}"></span><span>${s.label}</span>`;
    tag.addEventListener("click", () => {
      const ds = chart.data.datasets[i];
      ds.hidden = !ds.hidden;
      tag.classList.toggle("is-hidden", ds.hidden);
      chart.update("none");
    });
    els.legendTags.appendChild(tag);
  });
}
buildLegend();

function setHealth(ok) {
  els.healthDot.classList.toggle("ok", ok);
  els.healthDot.classList.toggle("bad", !ok);
  els.healthText.textContent = ok ? "Bağlandı" : "Bağlantı yok";
}

const THRESHOLDS = {
  temperature: {
    warn:  (v) => v >= 38 || v <= 14,
    crit:  (v) => v >= 42 || v <= 11,
    msg: (v) => {
      if (v >= 42) return `KRİTİK: Sıcaklık ${v}°C - sensör sınırına (45°C) çok yakın. Heater'ı kapatın.`;
      if (v <= 11) return `KRİTİK: Sıcaklık ${v}°C - alt sensör sınırına (10°C) yaklaşıyor.`;
      if (v >= 38) return `UYARI: Sıcaklık ${v}°C yüksek. 45°C üst sınıra yaklaşıyor.`;
      if (v <= 14) return `UYARI: Sıcaklık ${v}°C düşük. 10°C alt sınıra yaklaşıyor.`;
      return "";
    },
  },
  humidity: {
    warn:  (v) => v >= 80 || v <= 28,
    crit:  (v) => v >= 87 || v <= 23,
    msg: (v) => {
      if (v >= 87) return `KRİTİK: Nem %${v} - 90% üst sınırına çok yakın.`;
      if (v <= 23) return `KRİTİK: Nem %${v} - 20% alt sınırına yaklaşıyor (aşırı kuru).`;
      if (v >= 80) return `UYARI: Nem %${v} yüksek. Konfor dışı.`;
      if (v <= 28) return `UYARI: Nem %${v} düşük. Hava kuru.`;
      return "";
    },
  },
  energy: {
    warn:  (v) => v >= 1500,
    crit:  (v) => v >= 1700,
    msg: (v) => {
      if (v >= 1700) return `KRİTİK: Toplam tüketim ${v}W - çok yüksek. Cihazları azaltın.`;
      if (v >= 1500) return `UYARI: Tüketim ${v}W. Heater tek başına ~1500W çekiyor.`;
      return "";
    },
  },
  light_level: {
    warn:  (v) => v >= 950,
    crit:  (v) => v >= 990,
    msg: (v) => {
      if (v >= 990) return `KRİTİK: Işık ${v} lx - sensör sınırında (1000 lx).`;
      if (v >= 950) return `UYARI: Işık ${v} lx çok parlak. Göz yorgunluğu olabilir.`;
      return "";
    },
  },
  vibration: {
    warn:  (v) => v >= 3.5,
    crit:  (v) => v >= 4.5,
    msg: (v) => {
      if (v >= 4.5) return `KRİTİK: Titreşim ${v}g - sensör sınırına (5g) yaklaşıyor. Motor arızası olabilir.`;
      if (v >= 3.5) return `UYARI: Titreşim ${v}g yüksek. ISO 10816 ev sınıfı için kabul edilemez.`;
      return "";
    },
  },
};

function applyAlerts(data) {
  for (const key of Object.keys(THRESHOLDS)) {
    const v = data[key];
    const t = THRESHOLDS[key];
    const card = document.querySelector(`.card[data-metric="${key}"]`);
    const badge = document.getElementById(`a-${key}`);
    if (!card || !badge) continue;
    const isCrit = t.crit(v);
    const isWarn = !isCrit && t.warn(v);
    card.classList.toggle("is-critical", isCrit);
    card.classList.toggle("is-warn", isWarn);
    if (isCrit || isWarn) badge.setAttribute("data-tip", t.msg(v));
    else badge.setAttribute("data-tip", "");
  }
}

function renderMetrics(data) {
  document.getElementById("m-temperature").textContent = data.temperature;
  document.getElementById("m-humidity").textContent = data.humidity;
  document.getElementById("m-energy").textContent = data.energy;
  document.getElementById("m-light_level").textContent = data.light_level;
  document.getElementById("m-vibration").textContent = data.vibration;
  els.lastUpdate.textContent = data.timestamp || "--:--:--";
  applyAlerts(data);
}

function renderDevices(devices) {
  for (const d of DEVICES) {
    const stateText = devices[d] || "OFF";
    const card = document.querySelector(`.device[data-device="${d}"]`);
    if (!card) continue;
    const pill = document.getElementById(`s-${d}`);
    pill.textContent = stateText;
    pill.classList.toggle("on", stateText === "ON");
    card.classList.toggle("is-on", stateText === "ON");
    card.setAttribute("aria-pressed", stateText === "ON" ? "true" : "false");
  }
}

async function fetchData() {
  try {
    const res = await fetch("/api/data", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    setHealth(true);
    renderMetrics(json.data);
    renderDevices(json.devices);
    pushSample(json.data);
  } catch (err) {
    setHealth(false);
    console.error("/api/data hatası:", err.message);
  }
}

async function sendControl(device, state) {
  try {
    const res = await fetch("/api/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device, state }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`/api/control hatası (${res.status}):`, json.error || "bilinmiyor");
      return;
    }
    if (json.devices) renderDevices(json.devices);
  } catch (err) {
    console.error("/api/control istek hatası:", err.message);
  }
}

document.addEventListener("click", (e) => {
  const card = e.target.closest(".device[data-device]");
  if (!card) return;
  const device = card.dataset.device;
  const isOn = card.classList.contains("is-on");
  sendControl(device, isOn ? "OFF" : "ON");
});

fetchData();
setInterval(fetchData, POLL_MS);
