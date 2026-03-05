/*─── Theme──────────────────────────────────────────────────────*/
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute("data-theme") === "dark";
  html.setAttribute("data-theme", isDark ? "light" : "dark");
  document.getElementById("theme-btn").textContent = isDark ? "🌙" : "☀️";
  if (feedingChart) {
    updateChartColors();
  }
}

/*─── Notification bell ──────────────────────────────────────────*/
function toggleNotif(btn) {
  const badge = document.getElementById("notif-badge");
  badge.style.display = badge.style.display === "none" ? "" : "none";
}

/*─── Gauge ───────────────────────────────────────────────────────*/
const CIRCUMFERENCE = 2 * Math.PI * 80; // 502.65
function setGauge(pct) {
  const circle = document.getElementById("gauge-circle");
  const text = document.getElementById("gauge-text");
  const badge = document.getElementById("gauge-status-badge");
  const prog = document.getElementById("food-prog");
  const fl = document.getElementById("food-level");
  const heroLv = document.getElementById("hero-level");

  const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;
  circle.style.strokeDashoffset = offset;

  let color, statusText, statusStyle;
  if (pct > 50) {
    color = "#22c55e";
    statusText = "✅ Good";
    statusStyle = "background:rgba(34,197,94,.12);color:var(--green)";
  } else if (pct > 20) {
    color = "#f59e0b";
    statusText = "⚠️ Moderate";
    statusStyle = "background:rgba(245,158,11,.12);color:var(--amber)";
  } else {
    color = "#ef4444";
    statusText = "🔴 Refill Now";
    statusStyle = "background:rgba(239,68,68,.12);color:var(--red)";
  }
  circle.style.stroke = color;
  text.textContent = pct + "%";
  text.style.fill = color;
  badge.textContent = statusText;
  badge.setAttribute(
    "style",
    statusStyle +
      ";font-size:.78rem;font-weight:600;padding:4px 14px;border-radius:99px;",
  );
  prog.style.width = pct + "%";
  prog.style.background = `linear-gradient(90deg,${color},${color}88)`;
  fl.textContent = pct + "%";
  heroLv.textContent = pct + "%";
  document.getElementById("stat-avg").textContent = pct + "%";
}

/*─── Water ───────────────────────────────────────────────────────*/
function setWater(pct) {
  document.getElementById("water-fill").style.height = pct + "%";
  document.getElementById("water-label").textContent = pct + "%";
}

/*─── Socket.io ───────────────────────────────────────────────────
  Connects to the Express/Socket.io server that served this page.
  If the server is not running (e.g. opening index.html directly)
  the catch block drops into demo-simulation mode automatically.
────────────────────────────────────────────────────────────────*/
let socket;
try {
  socket = io({ transports: ["websocket", "polling"] });

  socket.on("connect", () => {
    console.log("[Socket.io] Connected —", socket.id);
    setConnectionStatus(true);
  });
  socket.on("disconnect", () => {
    console.warn("[Socket.io] Disconnected");
    setConnectionStatus(false);
  });
  socket.on("connect_error", () => setConnectionStatus(false));

  /* Live sensor data pushed from hardware via MQTT → server → here */
  socket.on("status", (data) => {
    if (data.food_level != null) setGauge(data.food_level);
    if (data.water_level != null) setWater(data.water_level);
    if (data.temperature != null) {
      document.getElementById("room-temp").innerHTML =
        `${parseFloat(data.temperature).toFixed(1)}<span class="temp-unit">°C</span>`;
      document.getElementById("hero-temp").textContent =
        parseFloat(data.temperature).toFixed(1) + "°";
    }
    const alertBox = document.getElementById("jam-alert-box");
    const alertTxt = document.getElementById("jam-alert");
    const badge = document.getElementById("alert-count-badge");
    if (data.jammed) {
      alertBox.className = "alert-box alert-err";
      alertTxt.textContent = "⚠️ MECHANICAL JAM — please inspect immediately!";
      badge.textContent = "1 Alert";
      badge.style.cssText =
        "background:rgba(239,68,68,.12);color:var(--red);font-size:.72rem;";
      appendLog("err", "⚠️ Mechanical jam detected!");
      document.getElementById("notif-badge").style.display = "";
    } else {
      alertBox.className = "alert-box alert-ok";
      alertTxt.textContent = "System operating normally — no issues detected.";
      badge.textContent = "All Clear";
      badge.style.cssText =
        "background:rgba(34,197,94,.12);color:var(--green);font-size:.72rem;";
    }
  });

  /* Server confirms a dispense completed (manual or scheduled) */
  socket.on("feeding_done", (data) => {
    const btn = document.getElementById("feed-btn");
    btn.classList.remove("feeding");
    btn.disabled = false;
    btn.innerHTML = "🥣 Dispense Food Now";
    feedCount++;
    document.getElementById("stat-today").textContent = feedCount;
    document.getElementById("hero-feedings").textContent = feedCount;
    const t = new Date(data.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    document.getElementById("stat-last").textContent = t;
    const label = data.type === "scheduled" ? "Scheduled" : "Manual";
    appendLog("ok", `🥣 ${label} dispense — ${data.portion_g}g at ${t}`);
    if (feedingChart) {
      const last = feedingChart.data.datasets[0].data;
      last[last.length - 1] = (last[last.length - 1] || 0) + 1;
      feedingChart.update();
    }
  });

  /* Server-pushed alert (low food, jam) */
  socket.on("alert", (data) => {
    appendLog(
      data.level === "error" ? "err" : "warn",
      (data.level === "error" ? "🚨 " : "⚠️ ") + data.message,
    );
    document.getElementById("notif-badge").style.display = "";
  });

  /* Today's feed count pushed immediately after connect */
  socket.on("feedings_today", (data) => {
    if (data.count != null) {
      feedCount = data.count;
      document.getElementById("stat-today").textContent = feedCount;
      document.getElementById("hero-feedings").textContent = feedCount;
    }
  });
} catch (_) {
  console.info("[PawFeed] Socket.io unavailable — running in demo mode");
  startDemoSimulation();
}

function setConnectionStatus(online) {
  const pill = document.querySelector(".pill-online");
  const dot = document.querySelector(".pill-dot");
  if (!pill) return;
  pill.style.background = online
    ? "rgba(34,197,94,.15)"
    : "rgba(239,68,68,.12)";
  pill.style.color = online ? "var(--green)" : "var(--red)";
  dot.style.background = online ? "var(--green)" : "var(--red)";
  // update text node (last child after the dot span)
  const nodes = [...pill.childNodes].filter((n) => n.nodeType === 3);
  if (nodes.length)
    nodes[nodes.length - 1].textContent = online ? " Online" : " Offline";
}

/*─── Feed ────────────────────────────────────────────────────────*/
let feedCount = 3;
function feedPet(portion) {
  const btn = document.getElementById("feed-btn");
  btn.classList.add("feeding");
  btn.disabled = true;
  btn.innerHTML = "⏳ Dispensing…";

  if (socket && socket.connected) {
    /* Real path — server handles MQTT + DB + confirms via feeding_done */
    socket.emit("feed", { portion: portion || 80, type: "manual" });
  } else {
    /* Fallback: REST call + local UI update */
    fetch("/feed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portion: portion || 80 }),
    }).catch(() => {});
    setTimeout(() => {
      btn.classList.remove("feeding");
      btn.disabled = false;
      btn.innerHTML = "🥣 Dispense Food Now";
      feedCount++;
      document.getElementById("stat-today").textContent = feedCount;
      document.getElementById("hero-feedings").textContent = feedCount;
      const t = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      document.getElementById("stat-last").textContent = t;
      appendLog("ok", `🥣 Manual dispense — ${portion || 80}g at ${t}`);
    }, 1800);
  }
}
function dispenseHalf() {
  feedPet(40);
}
function dispenseDouble() {
  feedPet(160);
}

/*─── Simulate refill ────────────────────────────────────────────*/
function simulateRefill() {
  setGauge(98);
  appendLog("ok", "🔋 Hopper refilled to 100%");
}
function simulateWater() {
  setWater(95);
  appendLog("ok", "💧 Water reservoir refilled");
}

/*─── Activity log ────────────────────────────────────────────────*/
function appendLog(type, msg) {
  const list = document.getElementById("log-list");
  const now = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const item = document.createElement("div");
  item.className = `log-item log-${type}`;
  item.innerHTML = `<span class="log-time">${now}</span><span class="log-msg">${msg}</span>`;
  list.insertBefore(item, list.firstChild);
  if (list.children.length > 20) list.removeChild(list.lastChild);
}
function clearLog() {
  document.getElementById("log-list").innerHTML = "";
}

/*─── Schedule mock ──────────────────────────────────────────────*/
function addSchedulePrompt() {
  const t = prompt("Enter time (e.g. 08:00 AM):");
  if (!t) return;
  const list = document.getElementById("schedule-list");
  const item = document.createElement("div");
  item.className = "schedule-item";
  item.innerHTML = `
        <div>
            <div class="schedule-time">${t}</div>
            <div class="schedule-info">Custom • 80g • Every day</div>
        </div>
        <label class="toggle-switch"><input type="checkbox" checked><span class="toggle-thumb"></span></label>`;
  list.appendChild(item);
  appendLog("ok", `📅 New schedule added: ${t}`);
}

/*─── Charts ──────────────────────────────────────────────────────*/
Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
Chart.defaults.color = "#6b7280";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const feedData = [3, 3, 4, 3, 3, 4, 3];

let feedingChart, levelChart, mealChart;

function buildCharts() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const gridColor = isDark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)";

  // Feeding bar chart
  feedingChart = new Chart(document.getElementById("feedingChart"), {
    type: "bar",
    data: {
      labels: days,
      datasets: [
        {
          label: "Feedings",
          data: feedData,
          backgroundColor: "rgba(108,99,255,.75)",
          borderRadius: 8,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: gridColor }, ticks: { font: { size: 11 } } },
        y: {
          grid: { color: gridColor },
          ticks: { stepSize: 1 },
          min: 0,
          max: 6,
        },
      },
    },
  });

  // Level line chart
  levelChart = new Chart(document.getElementById("levelChart"), {
    type: "line",
    data: {
      labels: days,
      datasets: [
        {
          label: "Food Level %",
          data: [95, 72, 88, 60, 80, 55, 72],
          borderColor: "#22c55e",
          backgroundColor: "rgba(34,197,94,.12)",
          fill: true,
          tension: 0.45,
          pointBackgroundColor: "#22c55e",
          pointRadius: 4,
          pointHoverRadius: 7,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: gridColor } },
        y: {
          grid: { color: gridColor },
          min: 0,
          max: 100,
          ticks: { callback: (v) => v + "%" },
        },
      },
    },
  });

  // Meal doughnut
  mealChart = new Chart(document.getElementById("mealChart"), {
    type: "doughnut",
    data: {
      labels: ["Morning", "Afternoon", "Evening", "Manual"],
      datasets: [
        {
          data: [33, 33, 27, 7],
          backgroundColor: ["#6c63ff", "#22c55e", "#f59e0b", "#ff6584"],
          borderWidth: 0,
          hoverOffset: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed}%` },
        },
      },
      cutout: "68%",
    },
  });
}

function updateChartColors() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const gridColor = isDark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)";
  [feedingChart, levelChart].forEach((c) => {
    if (!c) return;
    c.options.scales.x.grid.color = gridColor;
    c.options.scales.y.grid.color = gridColor;
    c.update();
  });
}

/*─── Demo simulation (only runs when Socket.io is unavailable) ───
  Mimics live hardware data so the dashboard looks alive when
  opened directly as a file without the Node.js server.
────────────────────────────────────────────────────────────────*/
function startDemoSimulation() {
  let mockLevel = 72;
  setInterval(() => {
    mockLevel = Math.max(
      5,
      Math.min(100, mockLevel + (Math.random() > 0.7 ? -1 : 0)),
    );
    setGauge(mockLevel);
    const temp = (21 + Math.random() * 3).toFixed(1);
    document.getElementById("room-temp").innerHTML =
      `${temp}<span class="temp-unit">°C</span>`;
    document.getElementById("hero-temp").textContent = temp + "°";
  }, 4000);
}

/*─── Init ────────────────────────────────────────────────────────*/
window.addEventListener("DOMContentLoaded", async () => {
  // Fallback defaults (shown until real data arrives)
  setGauge(72);
  setWater(65);
  buildCharts();

  // ── Load real data from the server ──────────────────────────
  try {
    // Today's feeding count
    const todayRes = await fetch("/feedings/today");
    if (todayRes.ok) {
      const today = await todayRes.json();
      if (today.count != null) {
        feedCount = today.count;
        document.getElementById("stat-today").textContent = feedCount;
        document.getElementById("hero-feedings").textContent = feedCount;
      }
    }

    // Weekly feeding bar chart
    const weekRes = await fetch("/feedings/weekly");
    if (weekRes.ok && feedingChart) {
      const weekData = await weekRes.json(); // [{dow,day,count,total_g}]
      if (weekData.length) {
        // Map server results onto the last-7-days labels
        const today = new Date();
        const dayLabels = [];
        const counts = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const iso = d.toISOString().slice(0, 10);
          const match = weekData.find((r) => r.day === iso);
          dayLabels.push(d.toLocaleDateString("en-US", { weekday: "short" }));
          counts.push(match ? match.count : 0);
        }
        feedingChart.data.labels = dayLabels;
        feedingChart.data.datasets[0].data = counts;
        feedingChart.update();
      }
    }

    // Food level trend line chart
    const sensorRes = await fetch("/sensor/history");
    if (sensorRes.ok && levelChart) {
      const sensorData = await sensorRes.json(); // [{day,avg_food,avg_temp}]
      if (sensorData.length) {
        levelChart.data.labels = sensorData.map((r) => r.day.slice(5));
        levelChart.data.datasets[0].data = sensorData.map((r) => r.avg_food);
        levelChart.update();
      }
    }

    // Latest sensor snapshot
    const statusRes = await fetch("/status");
    if (statusRes.ok) {
      const s = await statusRes.json();
      setGauge(s.food_level);
      setWater(s.water_level);
      if (s.temperature) {
        document.getElementById("room-temp").innerHTML =
          `${parseFloat(s.temperature).toFixed(1)}<span class="temp-unit">°C</span>`;
        document.getElementById("hero-temp").textContent =
          parseFloat(s.temperature).toFixed(1) + "°";
      }
    }

    // Schedules
    const schedRes = await fetch("/schedules");
    if (schedRes.ok) {
      const schedules = await schedRes.json();
      renderSchedules(schedules);
    }
  } catch (_) {
    // Server not reachable — defaults already shown, demo mode active
    startDemoSimulation();
  }

  // Uptime counter
  let minutes = 12 * 60;
  setInterval(() => {
    minutes++;
    const h = Math.floor(minutes / 60);
    document.getElementById("hero-uptime").textContent = h + "h";
  }, 60000);
});

/*─── Render schedules from server data ───────────────────────────*/
function renderSchedules(schedules) {
  if (!schedules || !schedules.length) return;
  const list = document.getElementById("schedule-list");
  list.innerHTML = "";
  schedules.forEach((s) => {
    // Convert 24-h HH:MM to 12-h display
    const [hh, mm] = s.time.split(":").map(Number);
    const ampm = hh >= 12 ? "PM" : "AM";
    const h12 = (hh % 12 || 12).toString().padStart(2, "0");
    const displayTime = `${h12}:${mm.toString().padStart(2, "0")} ${ampm}`;

    const item = document.createElement("div");
    item.className = "schedule-item";
    item.dataset.id = s.id;
    item.innerHTML = `
            <div>
                <div class="schedule-time">${displayTime}</div>
                <div class="schedule-info">${s.label} • ${s.portion_g}g • ${s.days.charAt(0).toUpperCase() + s.days.slice(1)}</div>
            </div>
            <label class="toggle-switch">
                <input type="checkbox" ${s.enabled ? "checked" : ""}
                    onchange="toggleSchedule(${s.id}, this.checked)">
                <span class="toggle-thumb"></span>
            </label>`;
    list.appendChild(item);
  });
}

function toggleSchedule(id, enabled) {
  fetch(`/schedules/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  }).catch(() => {});
}

// Override addSchedulePrompt to persist to the server
function addSchedulePrompt() {
  const t = prompt("Enter time (e.g. 08:00 AM):");
  if (!t) return;
  const label = prompt("Label (e.g. Snack):") || "Custom";
  // Convert to 24-h
  const match = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
  let time24 = t;
  if (match) {
    let h = parseInt(match[1]);
    const m = match[2];
    const p = match[3].toUpperCase();
    if (p === "PM" && h !== 12) h += 12;
    if (p === "AM" && h === 12) h = 0;
    time24 = `${h.toString().padStart(2, "0")}:${m}`;
  }
  fetch("/schedules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, time: time24, portion_g: 80, days: "daily" }),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((s) => {
      if (s) renderSchedules([s]);
    })
    .catch(() => {});
  appendLog("ok", `📅 New schedule added: ${t}`);
}
