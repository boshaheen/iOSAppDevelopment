/* خريطة تراخيص الشعيبة الصناعية - منطق التطبيق */
(function () {
  "use strict";

  const state = { search: "", area: "", status: "", sortKey: null, sortDir: 1 };

  const fmtNum = (n) =>
    typeof n === "number" ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : (n || "—");
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const plotsLabel = (lic) => {
    if (!lic.plots.length) return "—";
    const p = lic.plots[0];
    const first = `ق${p.block ?? "—"}/${p.plot ?? "—"}`;
    return lic.plots.length > 1 ? `${first} (+${lic.plots.length - 1})` : first;
  };

  // ---------- الإحصائيات ----------
  function renderStats() {
    const totalSize = LICENSES.reduce((s, l) => s + (l.totalSize || 0), 0);
    const active = LICENSES.filter((l) => l.status === "قائم").length;
    const cards = [
      { num: LICENSES.length.toLocaleString("en-US"), lbl: "إجمالي التراخيص" },
      { num: AREAS.length, lbl: "المناطق" },
      { num: active.toLocaleString("en-US"), lbl: "تراخيص قائمة" },
      { num: fmtNum(Math.round(totalSize)), lbl: "إجمالي المساحة (م²)" },
    ];
    document.getElementById("stats").innerHTML = cards
      .map((c) => `<div class="stat-card"><div class="num">${c.num}</div><div class="lbl">${c.lbl}</div></div>`)
      .join("");
  }

  // ---------- الخريطة ----------
  let map, markers = {};
  function initMap() {
    map = L.map("map", { scrollWheelZoom: false }).setView([29.05, 48.14], 11);
    // خلفية صور الأقمار الصناعية من Esri + طبقة أسماء الأماكن فوقها
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19, attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    }).addTo(map);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19, opacity: 0.9, attribution: "",
    }).addTo(map);

    const maxCount = Math.max(...AREAS.map((a) => a.count), 1);
    AREAS.forEach((a) => {
      const radius = 12 + (a.count / maxCount) * 22;
      const m = L.circleMarker([a.lat, a.lng], {
        radius, color: "#ffffff", weight: 2.5, fillColor: "#2bb673", fillOpacity: 0.85,
      }).addTo(map);
      m.bindTooltip(`${a.name} (${a.count})`, { direction: "top" });
      m.bindPopup(
        `<div class="map-popup"><b>${esc(a.name)}</b><br/>عدد التراخيص: ${a.count}<br/>
         إجمالي المساحة: ${fmtNum(a.totalSize)} م²<br/>
         <button data-area="${esc(a.name)}">عرض تراخيص المنطقة ↓</button></div>`);
      m.on("popupopen", (e) => {
        const btn = e.popup.getElement().querySelector("button[data-area]");
        if (btn) btn.addEventListener("click", () => {
          selectArea(a.name);
          document.querySelector(".table-section").scrollIntoView({ behavior: "smooth" });
        });
      });
      m.on("click", () => selectArea(a.name));
      markers[a.name] = m;
    });
  }

  function selectArea(name) {
    state.area = name;
    document.getElementById("areaFilter").value = name;
    const a = AREAS.find((x) => x.name === name);
    if (a && map) map.flyTo([a.lat, a.lng], 13, { duration: 0.6 });
    render();
  }

  // ---------- الفلترة + الترتيب ----------
  function matches(l) {
    if (state.area && l.area !== state.area) return false;
    if (state.status && l.status !== state.status) return false;
    if (!state.search) return true;
    const q = state.search.toLowerCase();
    const hay = [
      l.license, l.client, l.name, l.trade, l.area, l.activity, l.status, l.delivery,
      ...l.plots.flatMap((p) => [p.block, p.plot]),
      ...l.transfers.flatMap((t) => [t.from, t.to, t.reqNo, t.date]),
    ].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  }

  function sortRows(rows) {
    if (!state.sortKey) return rows;
    const k = state.sortKey;
    const val = (l) =>
      k === "trCount" ? l.transfers.length :
      k === "size" ? (l.totalSize || 0) :
      k === "plot" ? (l.plots[0] ? l.plots[0].plot : "") : l[k];
    return rows.slice().sort((a, b) => {
      let va = val(a), vb = val(b);
      if (k === "size" || k === "trCount") return ((va || 0) - (vb || 0)) * state.sortDir;
      const na = parseFloat(va), nb = parseFloat(vb);
      if (!isNaN(na) && !isNaN(nb)) return (na - nb) * state.sortDir;
      return String(va || "").localeCompare(String(vb || ""), "ar") * state.sortDir;
    });
  }

  // ---------- عرض الجدول ----------
  function render() {
    const rows = sortRows(LICENSES.filter(matches));
    const body = document.getElementById("licBody");
    body.innerHTML = rows.map((l, i) => {
      const tc = l.transfers.length;
      const badge = tc ? `<span class="badge">${tc}</span>` : `<span class="badge zero">0</span>`;
      return `
      <tr class="main-row" data-i="${i}">
        <td>${esc(l.license)}</td>
        <td>${esc(l.client)}</td>
        <td>${esc(l.area)}</td>
        <td>${esc(plotsLabel(l))}</td>
        <td>${fmtNum(l.totalSize)}</td>
        <td class="name-cell">${esc(l.name)}</td>
        <td class="name-cell">${esc(l.trade)}</td>
        <td><span class="status ${esc(l.status || "")}">${esc(l.status || "—")}</span></td>
        <td>${esc(l.end)}</td>
        <td>${esc(l.delivery)}</td>
        <td>${badge}</td>
      </tr>`;
    }).join("");

    body.querySelectorAll("tr.main-row").forEach((tr) =>
      tr.addEventListener("click", () => toggleDetail(tr, rows[+tr.dataset.i])));

    document.getElementById("resultCount").textContent =
      `عدد النتائج: ${rows.length.toLocaleString("en-US")}`;
    document.getElementById("emptyState").hidden = rows.length !== 0;

    Object.entries(markers).forEach(([name, m]) =>
      m.setStyle({ fillColor: state.area && name === state.area ? "#3a9ad9" : "#2bb673" }));
  }

  function toggleDetail(tr, l) {
    const next = tr.nextElementSibling;
    if (next && next.classList.contains("detail-row")) { next.remove(); tr.classList.remove("active"); return; }
    document.querySelectorAll(".detail-row").forEach((e) => e.remove());
    document.querySelectorAll("tr.main-row.active").forEach((e) => e.classList.remove("active"));
    tr.classList.add("active");

    const plots = l.plots.map((p) =>
      `<li>قطعة ${esc(p.block)} — قسيمة ${esc(p.plot)} — ${fmtNum(p.size)} م²` +
      (p.delivery ? ` — تاريخ التسليم: ${esc(p.delivery)}` : "") + `</li>`).join("");

    const transfers = l.transfers.length
      ? `<table class="hist-table">
           <thead><tr><th>تاريخ الطلب</th><th>رقم الطلب</th><th>متنازل</th><th>متنازل إليه</th></tr></thead>
           <tbody>${l.transfers.map((t) =>
             `<tr><td>${esc(t.date)}</td><td>${esc(t.reqNo)}</td><td>${esc(t.from)}</td><td>${esc(t.to)}</td></tr>`).join("")}</tbody>
         </table>`
      : `<p style="color:var(--muted);margin:0">لا توجد حركات تنازل لهذا الترخيص.</p>`;

    const row = document.createElement("tr");
    row.className = "detail-row";
    row.innerHTML = `<td colspan="11"><div class="detail-inner">
        <div class="detail-grid">
          <div><div class="k">الاسم الحالي للترخيص</div><div class="v">${esc(l.name)}</div></div>
          <div><div class="k">الاسم التجاري</div><div class="v">${esc(l.trade)}</div></div>
          <div><div class="k">حالة الترخيص</div><div class="v"><span class="status ${esc(l.status || "")}">${esc(l.status || "—")}</span></div></div>
          <div><div class="k">تاريخ البداية</div><div class="v">${esc(l.start)}</div></div>
          <div><div class="k">تاريخ النهاية</div><div class="v">${esc(l.end)}</div></div>
          <div><div class="k">تاريخ التسليم</div><div class="v">${esc(l.delivery)}</div></div>
          <div class="activity"><div class="k">النشاط</div><div class="v">${esc(l.activity)}</div></div>
        </div>
        <h4>القسائم (${l.plots.length})</h4>
        <ul class="plots-list">${plots}</ul>
        <h4 style="margin-top:12px">حركات التنازل (${l.transfers.length})</h4>
        ${transfers}
      </div></td>`;
    tr.after(row);
  }

  // ---------- عناصر التحكم ----------
  function initControls() {
    const areaSel = document.getElementById("areaFilter");
    AREAS.forEach((a) => {
      const o = document.createElement("option");
      o.value = a.name; o.textContent = `${a.name} (${a.count})`;
      areaSel.appendChild(o);
    });
    const statusSel = document.getElementById("statusFilter");
    [...new Set(LICENSES.map((l) => l.status).filter(Boolean))].forEach((st) => {
      const o = document.createElement("option");
      o.value = st; o.textContent = st;
      statusSel.appendChild(o);
    });

    let t;
    document.getElementById("search").addEventListener("input", (e) => {
      clearTimeout(t);
      t = setTimeout(() => { state.search = e.target.value.trim(); render(); }, 180);
    });
    areaSel.addEventListener("change", (e) => {
      state.area = e.target.value;
      if (state.area && markers[state.area]) {
        const a = AREAS.find((x) => x.name === state.area);
        if (map) map.flyTo([a.lat, a.lng], 13, { duration: 0.6 });
      }
      render();
    });
    statusSel.addEventListener("change", (e) => { state.status = e.target.value; render(); });
    document.getElementById("clearBtn").addEventListener("click", () => {
      state.search = ""; state.area = ""; state.status = "";
      document.getElementById("search").value = "";
      areaSel.value = ""; statusSel.value = "";
      if (map) map.flyTo([29.05, 48.14], 11, { duration: 0.6 });
      render();
    });
    document.querySelectorAll("thead th").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.key;
        if (!key) return;
        if (state.sortKey === key) state.sortDir *= -1;
        else { state.sortKey = key; state.sortDir = 1; }
        document.querySelectorAll("thead th").forEach((x) => x.classList.remove("sorted-asc", "sorted-desc"));
        th.classList.add(state.sortDir === 1 ? "sorted-asc" : "sorted-desc");
        render();
      });
    });
  }

  function showMapFallback(msg) {
    const el = document.getElementById("map");
    if (el) {
      el.style.display = "flex"; el.style.alignItems = "center"; el.style.justifyContent = "center";
      el.style.color = "var(--muted)";
      el.textContent = msg + " يمكنك استخدام البحث والجدول بالأسفل.";
    }
  }

  // ---------- المخططات + العارض المكبّر ----------
  function renderPlans() {
    const grid = document.getElementById("plansGrid");
    if (!grid || typeof PLANS === "undefined") return;
    grid.innerHTML = PLANS.map((p, i) => `
      <div class="plan-card" data-i="${i}">
        <img class="thumb" src="${p.thumb}" alt="${esc(p.title)}" loading="lazy" />
        <div class="meta">
          <div class="t">${esc(p.title)}</div>
          <div class="c">${esc(p.caption || "")}</div>
          <div class="open">عرض المخطط ⤢</div>
        </div>
      </div>`).join("");
    grid.querySelectorAll(".plan-card").forEach((c) =>
      c.addEventListener("click", () => openLightbox(PLANS[+c.dataset.i])));
  }

  const lb = { scale: 1, x: 0, y: 0, dragging: false, sx: 0, sy: 0, ox: 0, oy: 0 };
  function lbApply() {
    const img = document.getElementById("lbImg");
    img.style.transform = `translate(${lb.x}px, ${lb.y}px) scale(${lb.scale})`;
  }
  function openLightbox(plan) {
    const box = document.getElementById("lightbox");
    const img = document.getElementById("lbImg");
    document.getElementById("lbTitle").textContent = plan.title;
    const dl = document.getElementById("lbDownload");
    dl.href = plan.full; dl.setAttribute("download", plan.title + ".jpg");
    img.src = plan.full;
    box.hidden = false;
    img.onload = () => {
      const stage = document.getElementById("lbStage");
      const s = Math.min(stage.clientWidth / img.naturalWidth, stage.clientHeight / img.naturalHeight);
      lb.scale = s;
      lb.x = (stage.clientWidth - img.naturalWidth * s) / 2;
      lb.y = (stage.clientHeight - img.naturalHeight * s) / 2;
      lb._fit = s; lbApply();
    };
  }
  function closeLightbox() { document.getElementById("lightbox").hidden = true; document.getElementById("lbImg").src = ""; }
  function zoomAt(factor, cx, cy) {
    const stage = document.getElementById("lbStage");
    const r = stage.getBoundingClientRect();
    const px = (cx ?? r.width / 2), py = (cy ?? r.height / 2);
    const ns = Math.max((lb._fit || 0.05) * 0.8, Math.min(lb.scale * factor, 8));
    lb.x = px - (px - lb.x) * (ns / lb.scale);
    lb.y = py - (py - lb.y) * (ns / lb.scale);
    lb.scale = ns; lbApply();
  }
  function initLightbox() {
    const stage = document.getElementById("lbStage");
    if (!stage) return;
    document.getElementById("lbClose").addEventListener("click", closeLightbox);
    document.getElementById("lbZoomIn").addEventListener("click", () => zoomAt(1.3));
    document.getElementById("lbZoomOut").addEventListener("click", () => zoomAt(1 / 1.3));
    document.getElementById("lbReset").addEventListener("click", () => {
      lb.scale = lb._fit; const img = document.getElementById("lbImg");
      lb.x = (stage.clientWidth - img.naturalWidth * lb.scale) / 2;
      lb.y = (stage.clientHeight - img.naturalHeight * lb.scale) / 2; lbApply();
    });
    document.getElementById("lightbox").addEventListener("click", (e) => { if (e.target.id === "lightbox") closeLightbox(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !document.getElementById("lightbox").hidden) closeLightbox(); });
    stage.addEventListener("wheel", (e) => {
      e.preventDefault();
      const r = stage.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    stage.addEventListener("pointerdown", (e) => {
      lb.dragging = true; stage.classList.add("grabbing");
      lb.sx = e.clientX; lb.sy = e.clientY; lb.ox = lb.x; lb.oy = lb.y;
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener("pointermove", (e) => {
      if (!lb.dragging) return;
      lb.x = lb.ox + (e.clientX - lb.sx); lb.y = lb.oy + (e.clientY - lb.sy); lbApply();
    });
    const end = () => { lb.dragging = false; stage.classList.remove("grabbing"); };
    stage.addEventListener("pointerup", end);
    stage.addEventListener("pointercancel", end);
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderStats();
    renderPlans();
    initLightbox();
    try {
      if (typeof L !== "undefined") initMap();
      else showMapFallback("تعذّر تحميل مكتبة الخريطة.");
    } catch (e) { console.error(e); showMapFallback("تعذّر عرض الخريطة في هذه البيئة."); }
    initControls();
    render();
  });
})();
