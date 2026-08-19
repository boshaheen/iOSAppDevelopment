/* خريطة تراخيص الشعيبة الصناعية - منطق التطبيق */
(function () {
  "use strict";

  const state = { search: "", area: "", status: "", type: "", sortKey: null, sortDir: 1 };

  // بيانات المنطقة الحالية (تتغيّر عند اختيار المنطقة)
  let AREAS = [], LICENSES = [], PLANS = [], ALLOCATIONS = [], currentRegionName = "";

  const fmtNum = (n) =>
    typeof n === "number" ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : (n || "—");
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // عدد القسائم المميّزة لكل عميل (تُحسب لكل منطقة عند تحميلها) — رقم العميل على مستوى القسيمة
  let clientPlotCount = {};
  function computeClientPlots() {
    const groups = {};
    LICENSES.forEach((l) => {
      l.plots.forEach((p) => {
        const key = (p.client != null && p.client !== "") ? p.client : (l.client || ("__lic_" + l.license));
        (groups[key] = groups[key] || new Set());
        groups[key].add(`${l.area}|${p.block}|${p.plot}`);
      });
    });
    clientPlotCount = {};
    Object.keys(groups).forEach((k) => { clientPlotCount[k] = groups[k].size; });
  }
  const clientPlotsOf = (l) => clientPlotCount[l.client || ("__lic_" + l.license)] ?? l.plots.length;

  // أرقام العملاء لترخيص واحد: كل قسيمة لها رقم عميل، فنعرض الأرقام المميّزة لكل قسائم الترخيص
  const clientNums = (l) => {
    const set = [];
    (l.plots || []).forEach((p) => { if (p.client != null && p.client !== "" && !set.includes(p.client)) set.push(p.client); });
    if (!set.length && l.client != null && l.client !== "") set.push(l.client);
    return set;
  };

  // ---------- تحميل المنطقة ----------
  function loadRegion(name) {
    const d = (typeof REGION_DATA !== "undefined") ? REGION_DATA[name] : null;
    if (!d) return;
    AREAS = d.areas || [];
    LICENSES = d.licenses || [];
    PLANS = (typeof REGION_PLANS !== "undefined" && REGION_PLANS[name]) ? REGION_PLANS[name] : [];
    ALLOCATIONS = (typeof REGION_ALLOCATIONS !== "undefined" && REGION_ALLOCATIONS[name]) ? REGION_ALLOCATIONS[name] : [];
    currentRegionName = name;
    state.search = ""; state.area = ""; state.status = ""; state.type = "";
    state.sortKey = null; state.sortDir = 1;
    const si = document.getElementById("search"); if (si) si.value = "";
    document.querySelectorAll("thead th").forEach((x) => x.classList.remove("sorted-asc", "sorted-desc"));
    computeClientPlots();
    updateHeader(name);
    populateFilters();
    drawAreas();
    renderStats();
    renderPlans();
    renderAllocations();
    render();
  }

  function updateHeader(name) {
    const h1 = document.querySelector(".site-header h1");
    if (h1) h1.textContent = `🏭 تراخيص ${name}`;
    const sub = document.querySelector(".site-header .subtitle");
    if (sub) sub.textContent = `خريطة تفاعلية لتراخيص ${name}`;
  }

  const blockLabel = (l) => {
    const blocks = [...new Set(l.plots.map((p) => p.block).filter((b) => b != null && b !== ""))];
    return blocks.length ? blocks.join("، ") : "—";
  };
  const plotLabel = (l) => {
    if (!l.plots.length) return "—";
    const first = l.plots[0].plot ?? "—";
    return l.plots.length > 1 ? `${first} (+${l.plots.length - 1})` : `${first}`;
  };

  // ---------- الإحصائيات ----------
  function renderStats() {
    const totalSize = LICENSES.reduce((s, l) => s + (l.totalSize || 0), 0);
    const active = LICENSES.filter((l) => l.status === "قائم").length;
    const mortgaged = LICENSES.filter((l) => l.status && l.status.includes("مرهون")).length;
    const cards = [
      { num: LICENSES.length.toLocaleString("en-US"), lbl: "إجمالي التراخيص" },
      { num: active.toLocaleString("en-US"), lbl: "قائمة" },
      { num: mortgaged.toLocaleString("en-US"), lbl: "مرهونة" },
      { num: fmtNum(Math.round(totalSize)), lbl: "إجمالي المساحة (م²)" },
    ];
    document.getElementById("stats").innerHTML = cards
      .map((c) => `<div class="stat-card"><div class="num">${c.num}</div><div class="lbl">${c.lbl}</div></div>`)
      .join("");
  }

  // ---------- الخريطة ----------
  let map, markers = {};
  function initMap() {
    map = L.map("map", { scrollWheelZoom: false }).setView([29.15, 48.0], 10);
    // خلفية صور الأقمار الصناعية من Esri + طبقة أسماء الأماكن فوقها
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19, attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    }).addTo(map);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19, opacity: 0.9, attribution: "",
    }).addTo(map);
  }

  // رسم علامات المنطقة الحالية (يُستدعى عند تحميل المنطقة)
  function drawAreas() {
    if (!map) return;
    Object.values(markers).forEach((m) => map.removeLayer(m));
    markers = {};
    if (!AREAS.length) return;
    const maxCount = Math.max(...AREAS.map((a) => a.count), 1);
    AREAS.forEach((a) => {
      const radius = 12 + (a.count / maxCount) * 22;
      const m = L.circleMarker([a.lat, a.lng], {
        radius, color: "#ffffff", weight: 2.5, fillColor: "#2bb673", fillOpacity: 0.85,
      }).addTo(map);
      m.bindTooltip(`${a.name} (${a.count})`, { direction: "top" });
      m.bindPopup(
        `<div class="map-popup"><b>${esc(a.name)}</b><br/>عدد السجلات: ${a.count}<br/>
         إجمالي المساحة: ${fmtNum(a.totalSize)} م²<br/>
         <button data-area="${esc(a.name)}">عرض سجلات المنطقة ↓</button></div>`);
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
    // ضبط العرض على مركز المنطقة
    if (AREAS.length === 1) map.setView([AREAS[0].lat, AREAS[0].lng], 12);
    else {
      const b = L.latLngBounds(AREAS.map((a) => [a.lat, a.lng]));
      map.fitBounds(b.pad(0.4));
    }
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
    if (state.status) {
      if (state.status === "__transfer__") { if (!l.transfers || !l.transfers.length) return false; }
      else if (l.status !== state.status) return false;
    }
    if (!state.search) return true;
    const q = state.search.toLowerCase();
    const hay = [
      l.license, ...clientNums(l), l.name, l.trade, l.area, l.activity, l.status, l.delivery, ...(l.permanentDate || []),
      ...l.plots.flatMap((p) => [p.block, p.plot]),
      ...l.transfers.flatMap((t) => [t.from, t.to, t.reqNo, t.date]),
      ...(l.board || []).flatMap((bd) => [bd.decision, bd.subject, bd.minutes, bd.occupant]),
    ].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  }

  function sortRows(rows) {
    if (!state.sortKey) return rows;
    const k = state.sortKey;
    const val = (l) =>
      k === "trCount" ? l.transfers.length :
      k === "boardCount" ? (l.board ? l.board.length : 0) :
      k === "allocCount" ? allocsOf(l).length :
      k === "clientPlots" ? clientPlotsOf(l) :
      k === "size" ? (l.totalSize || 0) :
      k === "block" ? (l.plots[0] ? l.plots[0].block : "") :
      k === "plot" ? (l.plots[0] ? l.plots[0].plot : "") : l[k];
    return rows.slice().sort((a, b) => {
      let va = val(a), vb = val(b);
      if (k === "size" || k === "trCount" || k === "clientPlots" || k === "boardCount" || k === "allocCount") return ((va || 0) - (vb || 0)) * state.sortDir;
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
        <td>${clientNums(l).length ? clientNums(l).map(esc).join("<br>") : "—"}</td>
        <td>${clientPlotsOf(l)}</td>
        <td>${esc(l.area)}</td>
        <td>${esc(blockLabel(l))}</td>
        <td>${esc(plotLabel(l))}</td>
        <td>${fmtNum(l.totalSize)}</td>
        <td class="name-cell">${esc(l.name)}</td>
        <td class="name-cell">${esc(l.trade)}</td>
        <td><span class="status ${esc(l.status || "")}">${esc(l.status || "—")}</span></td>
        <td>${esc(l.end)}</td>
        <td>${esc(l.delivery)}</td>
        <td>${(l.permanentDate && l.permanentDate.length) ? l.permanentDate.map(esc).join("<br>") : "—"}</td>
        <td>${badge}</td>
        <td>${(l.board && l.board.length) ? `<span class="badge board">${l.board.length}</span>` : `<span class="badge zero">—</span>`}</td>
        <td>${allocsOf(l).length ? `<span class="badge alloc">${allocsOf(l).length}</span>` : `<span class="badge zero">—</span>`}</td>
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
      ((p.client != null && p.client !== "") ? ` — رقم العميل: ${esc(p.client)}` : "") +
      (p.delivery ? ` — تاريخ التسليم: ${esc(p.delivery)}` : "") + `</li>`).join("");

    const transfers = l.transfers.length
      ? `<table class="hist-table">
           <thead><tr><th>تاريخ الطلب</th><th>رقم الطلب</th><th>متنازل</th><th>متنازل إليه</th></tr></thead>
           <tbody>${l.transfers.map((t) =>
             `<tr><td>${esc(t.date)}</td><td>${esc(t.reqNo)}</td><td>${esc(t.from)}</td><td>${esc(t.to)}</td></tr>`).join("")}</tbody>
         </table>`
      : `<p style="color:var(--muted);margin:0">لا توجد حركات تنازل لهذا الترخيص.</p>`;

    const board = (l.board && l.board.length)
      ? `<table class="hist-table">
           <thead><tr><th>المحضر</th><th>التاريخ</th><th>الموضوع</th><th>مستغل القسيمة</th><th>الموقع</th><th>القرار</th></tr></thead>
           <tbody>${l.board.map((bd) =>
             `<tr><td>${esc(bd.minutes)}</td><td>${esc(bd.date)}</td><td>${esc(bd.subject)}</td><td>${esc(bd.occupant)}</td><td>${esc(bd.location)}</td><td>${esc(bd.decision)}${bd.note ? `<div class="board-note">📝 ${esc(bd.note)}</div>` : ""}</td></tr>`).join("")}</tbody>
         </table>`
      : `<p style="color:var(--muted);margin:0">لا توجد موافقات مجلس إدارة مرتبطة بهذا السجل.</p>`;

    const licAllocs = allocsOf(l);
    const alloc = licAllocs.length
      ? `<table class="hist-table">
           <thead><tr><th>السنة</th><th>المحضر</th><th>نوع القرار</th><th>الموضوع</th><th>القطعة/القسيمة</th><th>المساحة</th><th>نص القرار</th></tr></thead>
           <tbody>${licAllocs.map((a) =>
             `<tr><td>${esc(a.year)}</td><td>${esc(a.minutes)}</td><td><span class="rec-type">${esc(a.type)}</span></td><td>${esc(a.subject)}</td><td>${esc(a.plot || "—")}</td><td>${a.size != null && a.size !== "" ? fmtNum(a.size) : "—"}</td><td>${esc(a.text)}</td></tr>`).join("")}</tbody>
         </table>`
      : "";

    const row = document.createElement("tr");
    row.className = "detail-row";
    row.innerHTML = `<td colspan="16"><div class="detail-inner">
        <div class="detail-grid">
          <div><div class="k">الاسم الحالي للترخيص</div><div class="v">${esc(l.name)}</div></div>
          <div><div class="k">الاسم التجاري</div><div class="v">${esc(l.trade)}</div></div>
          ${clientNums(l).length > 1 ? `<div><div class="k">أرقام العملاء</div><div class="v">${clientNums(l).map(esc).join("، ")}</div></div>` : ""}
          <div><div class="k">عدد قسائم العميل</div><div class="v">${clientPlotsOf(l)}</div></div>
          <div><div class="k">الحالة</div><div class="v"><span class="status ${esc(l.status || "")}">${esc(l.status || "—")}</span></div></div>
          ${l.contractType ? `<div><div class="k">طبيعة العقد</div><div class="v">${esc(l.contractType)}</div></div>` : ""}
          ${l.kind ? `<div><div class="k">خدمي/صناعي</div><div class="v">${esc(l.kind)}</div></div>` : ""}
          <div><div class="k">تاريخ البداية</div><div class="v">${esc(l.start)}</div></div>
          <div><div class="k">تاريخ النهاية</div><div class="v">${esc(l.end)}</div></div>
          <div><div class="k">تاريخ التسليم</div><div class="v">${esc(l.delivery)}</div></div>
          <div><div class="k">تاريخ صدور الدائم</div><div class="v">${(l.permanentDate && l.permanentDate.length) ? l.permanentDate.map(esc).join("<br>") : "—"}</div></div>
          ${l.purpose ? `<div><div class="k">غرض التخصيص</div><div class="v">${esc(l.purpose)}</div></div>` : ""}
          <div class="activity"><div class="k">النشاط</div><div class="v">${esc(l.activity)}</div></div>
        </div>
        <h4>القسائم (${l.plots.length})</h4>
        <ul class="plots-list">${plots}</ul>
        <h4 style="margin-top:12px">حركات التنازل (${l.transfers.length})</h4>
        ${transfers}
        <h4 style="margin-top:12px">موافقات مجلس الإدارة (${l.board ? l.board.length : 0})</h4>
        ${board}
        ${licAllocs.length ? `<h4 style="margin-top:12px">قرارات لجنة التخصيص (${licAllocs.length})</h4>${alloc}` : ""}
      </div></td>`;
    tr.after(row);
  }

  // ---------- عناصر التحكم ----------
  // تعبئة القوائم المنسدلة حسب المنطقة الحالية
  function populateFilters() {
    const areaSel = document.getElementById("areaFilter");
    if (areaSel) {
      areaSel.innerHTML = `<option value="">كل المناطق</option>` +
        AREAS.map((a) => `<option value="${esc(a.name)}">${esc(a.name)} (${a.count})</option>`).join("");
    }
    const statusSel = document.getElementById("statusFilter");
    if (statusSel) {
      statusSel.innerHTML = `<option value="">كل الحالات</option>` +
        [...new Set(LICENSES.map((l) => l.status).filter(Boolean))].map((st) => `<option value="${esc(st)}">${esc(st)}</option>`).join("") +
        `<option value="__transfer__">— تنازلات —</option>`;
    }
  }

  // ربط المستمعات مرة واحدة
  function bindControls() {
    const areaSel = document.getElementById("areaFilter");
    const statusSel = document.getElementById("statusFilter");

    let t;
    document.getElementById("search").addEventListener("input", (e) => {
      clearTimeout(t);
      t = setTimeout(() => { state.search = e.target.value.trim(); render(); }, 180);
    });
    if (areaSel) areaSel.addEventListener("change", (e) => {
      state.area = e.target.value;
      if (state.area && markers[state.area]) {
        const a = AREAS.find((x) => x.name === state.area);
        if (map) map.flyTo([a.lat, a.lng], 13, { duration: 0.6 });
      }
      render();
    });
    if (statusSel) statusSel.addEventListener("change", (e) => { state.status = e.target.value; render(); });
    document.getElementById("clearBtn").addEventListener("click", () => {
      state.search = ""; state.area = ""; state.status = "";
      document.getElementById("search").value = "";
      if (areaSel) areaSel.value = ""; if (statusSel) statusSel.value = "";
      if (map && AREAS.length === 1) map.flyTo([AREAS[0].lat, AREAS[0].lng], 12, { duration: 0.6 });
      render();
    });
    const back = document.getElementById("backRegions");
    if (back) back.addEventListener("click", () => {
      const reg = document.getElementById("regions");
      if (reg) { reg.style.display = ""; reg.classList.remove("hide"); window.scrollTo(0, 0); setTimeout(() => { if (regMap) regMap.invalidateSize(); }, 60); }
    });
    const printBtn = document.getElementById("printBtn");
    if (printBtn) printBtn.addEventListener("click", () => { buildPrintHeader(); window.print(); });
    window.addEventListener("beforeprint", buildPrintHeader);
    const excelBtn = document.getElementById("excelBtn");
    if (excelBtn) excelBtn.addEventListener("click", exportExcel);

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

  // ---------- تصدير Excel (حسب الفلتر المختار) ----------
  function exportExcel() {
    if (typeof XLSX === "undefined") { alert("تعذّر تحميل مكتبة Excel."); return; }
    // نصدّر نفس السجلات الظاهرة حالياً (بعد تطبيق البحث/المنطقة/الحالة والترتيب)
    const EXP = sortRows(LICENSES.filter(matches));
    const isFiltered = !!(state.search || state.area || state.status);
    const wb = XLSX.utils.book_new();
    const rtl = (ws, widths) => { ws["!views"] = [{ RTL: true }]; if (widths) ws["!cols"] = widths.map((w) => ({ wch: w })); return ws; };

    // دمج خلايا عمودياً: رقم الترخيص والحقول العامة تظهر مرة واحدة لكل ترخيص متعدّد القسائم
    const mergeVertical = (ws, spans, cols) => {
      ws["!merges"] = ws["!merges"] || [];
      spans.forEach(([s, e]) => cols.forEach((c) => ws["!merges"].push({ s: { r: s + 1, c }, e: { r: e + 1, c } })));
      return ws;
    };
    const cliOf = (l, p) => (p.client != null && p.client !== "") ? p.client : (l.client || "");
    // تجميع قسائم الترخيص حسب رقم العميل: كل عميل مجموعة واحدة (بترتيب أول ظهور)
    const groupByClient = (l) => {
      const order = []; const map = {};
      const plots = (l.plots && l.plots.length) ? l.plots : [{}];
      plots.forEach((p) => { const c = cliOf(l, p); if (!(c in map)) { map[c] = []; order.push(c); } map[c].push(p); });
      return order.map((c) => ({ client: c, plots: map[c] }));
    };
    const blocksJoin = (ps) => [...new Set(ps.map((p) => p.block).filter((b) => b != null && b !== ""))].join("، ");
    const plotsJoin = (ps) => ps.map((p) => p.plot).filter((p) => p != null && p !== "").join("، ");
    const delivJoin = (ps) => [...new Set(ps.map((p) => p.delivery).filter(Boolean))].join("، ");
    const sizeSum = (ps) => ps.reduce((s, p) => s + (p.size || 0), 0);

    // ورقة 1: السجلات — صفٌّ لكل رقم عميل (قسائمه مجمّعة)، ورقم الترخيص (والحقول العامة) مدمج عمودياً
    const boardText = (l) => (l.board || []).map((b) => `${b.minutes} (${b.date}): ${b.decision}`).join(" | ");
    const transferFrom = (l) => (l.transfers || []).map((t) => `${t.date ? t.date + ": " : ""}${t.from || "—"}`).join(" | ");
    const transferTo = (l) => (l.transfers || []).map((t) => `${t.to || "—"}`).join(" | ");
    const allocText = (l) => allocsOf(l).map((a) => `${a.type || ""}${a.minutes ? " (" + a.minutes + ")" : ""}: ${a.subject || a.text || ""}`).join(" | ");
    const licHead = ["رقم الترخيص", "رقم العميل", "المنطقة", "القطعة", "رقم القسيمة", "مساحة القسائم (م²)", "تاريخ التسليم",
      "الاسم", "الاسم التجاري", "النشاط", "غرض التخصيص", "الحالة",
      "تاريخ البداية", "تاريخ النهاية", "تاريخ صدور الدائم", "المتنازِل", "المتنازَل إليه", "قرار مجلس الإدارة", "قرار لجنة التخصيص"];
    const licRows = []; const licSpans = [];
    EXP.forEach((l) => {
      const start = licRows.length;
      groupByClient(l).forEach((g) => licRows.push([l.license, g.client, l.area, blocksJoin(g.plots), plotsJoin(g.plots), sizeSum(g.plots), delivJoin(g.plots),
        l.name, l.trade, l.activity, l.purpose, l.status, l.start, l.end, (l.permanentDate || []).join(" / "), transferFrom(l), transferTo(l), boardText(l), allocText(l)]));
      if (licRows.length - start > 1) licSpans.push([start, licRows.length - 1]);
    });
    const licSheet = rtl(XLSX.utils.aoa_to_sheet([licHead, ...licRows]), [12, 11, 22, 10, 14, 15, 15, 30, 30, 50, 14, 12, 13, 13, 13, 34, 34, 50, 50]);
    mergeVertical(licSheet, licSpans, [0, 2, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
    XLSX.utils.book_append_sheet(wb, licSheet, "السجلات");

    // ورقة 2: القسائم — صفٌّ لكل رقم عميل (قسائمه مجمّعة) مع دمج خلية رقم الترخيص والمنطقة
    const plotHead = ["رقم الترخيص", "رقم العميل", "المنطقة", "القطعة", "القسيمة", "المساحة (م²)", "تاريخ التسليم"];
    const plotRows = []; const plotSpans = [];
    EXP.forEach((l) => {
      const start = plotRows.length;
      groupByClient(l).forEach((g) => plotRows.push([l.license, g.client, l.area, blocksJoin(g.plots), plotsJoin(g.plots), sizeSum(g.plots), delivJoin(g.plots)]));
      if (plotRows.length - start > 1) plotSpans.push([start, plotRows.length - 1]);
    });
    const plotSheet = rtl(XLSX.utils.aoa_to_sheet([plotHead, ...plotRows]), [12, 11, 22, 10, 14, 14, 15]);
    mergeVertical(plotSheet, plotSpans, [0, 2]);
    XLSX.utils.book_append_sheet(wb, plotSheet, "القسائم");

    // ورقة 3: حركات التنازل
    const trHead = ["رقم الترخيص", "الاسم التجاري", "تاريخ الطلب", "رقم الطلب", "متنازل", "متنازل إليه"];
    const trRows = [];
    EXP.forEach((l) => l.transfers.forEach((t) => trRows.push([l.license, l.trade, t.date, t.reqNo, t.from, t.to])));
    XLSX.utils.book_append_sheet(wb,
      rtl(XLSX.utils.aoa_to_sheet([trHead, ...trRows]), [12, 30, 13, 12, 34, 34]),
      "حركات التنازل");

    // ورقة 4: موافقات مجلس الإدارة (المرتبطة بالسجلات، بدون سحب/إلغاء)
    const bHead = ["رقم الترخيص", "رقم العميل", "الاسم التجاري", "المحضر", "التاريخ", "الموضوع", "مستغل القسيمة", "الموقع", "القرار", "ملاحظة"];
    const bRows = [];
    EXP.forEach((l) => (l.board || []).forEach((bd) =>
      bRows.push([l.license, l.client, l.trade || l.name, bd.minutes, bd.date, bd.subject, bd.occupant, bd.location, bd.decision, bd.note || ""])));
    XLSX.utils.book_append_sheet(wb,
      rtl(XLSX.utils.aoa_to_sheet([bHead, ...bRows]), [12, 11, 28, 10, 12, 24, 28, 32, 46, 30]),
      "موافقات مجلس الإدارة");

    // ورقة 5: قرارات لجنة التخصيص (كل القرارات للمنطقة)
    if (ALLOCATIONS && ALLOCATIONS.length) {
      const aHead = ["السنة", "المحضر", "الجهة / الشركة", "نوع القرار", "الموضوع", "المنطقة", "القطعة / القسيمة", "المساحة (م²)", "الترخيص المطابق", "نص القرار", "المصدر"];
      const aRows = ALLOCATIONS.map((a) => [a.year, a.minutes, a.company, a.type, a.subject, a.area, a.plot, a.size,
        a.license || "غير مسجّل", a.text, a.source]);
      XLSX.utils.book_append_sheet(wb,
        rtl(XLSX.utils.aoa_to_sheet([aHead, ...aRows]), [8, 12, 30, 16, 30, 16, 18, 12, 14, 60, 14]),
        "قرارات لجنة التخصيص");
    }

    XLSX.writeFile(wb, `تراخيص_${currentRegionName || "المنطقة"}${isFiltered ? "_مُصفّى" : ""}.xlsx`);
  }

  function buildPrintHeader() {
    const el = document.getElementById("printHeader");
    if (!el) return;
    const shown = document.querySelectorAll("#licBody tr.main-row").length;
    const today = new Date().toLocaleDateString("ar-KW-u-nu-latn");
    const filters = [];
    if (state.area) filters.push(`المنطقة: ${state.area}`);
    if (state.status) filters.push(state.status === "__transfer__" ? "تنازلات" : `الحالة: ${state.status}`);
    if (state.search) filters.push(`بحث: ${state.search}`);
    const fTxt = filters.length ? filters.join(" — ") : "بدون تصفية (كل السجلات)";
    el.innerHTML =
      `<h2>تقرير مصانع وتراخيص ${esc(currentRegionName || "")}</h2>
       <div class="meta">
         <span>تاريخ التصدير: ${esc(today)}</span>
         <span>عدد التراخيص: ${shown}</span>
         <span>${esc(fTxt)}</span>
       </div>`;
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
    const sec = document.querySelector(".plans-section");
    if (sec) sec.style.display = (PLANS && PLANS.length) ? "" : "none";
    if (!grid || !PLANS || !PLANS.length) { if (grid) grid.innerHTML = ""; return; }
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

  // ---------- قرارات لجنة التخصيص ----------
  const allocsOf = (l) => ALLOCATIONS.filter((a) => a.license && String(a.license) === String(l.license));
  function renderAllocations() {
    const sec = document.querySelector(".allocations-section");
    const body = document.getElementById("allocBody");
    const has = ALLOCATIONS && ALLOCATIONS.length;
    if (sec) sec.style.display = has ? "" : "none";
    if (!body) return;
    if (!has) { body.innerHTML = ""; return; }
    body.innerHTML = ALLOCATIONS.map((a) => `
      <tr>
        <td>${esc(a.year || "")}</td>
        <td>${esc(a.minutes || "")}</td>
        <td class="name-cell">${esc(a.company || "")}</td>
        <td><span class="rec-type">${esc(a.type || "")}</span></td>
        <td class="name-cell">${esc(a.subject || "")}</td>
        <td>${esc(a.area || "")}</td>
        <td>${esc(a.plot || "—")}</td>
        <td>${a.size != null && a.size !== "" ? fmtNum(a.size) : "—"}</td>
        <td>${a.license ? `<a href="#" class="alloc-lic" data-lic="${esc(a.license)}">${esc(a.license)}</a>` : '<span class="muted">غير مسجّل</span>'}</td>
        <td class="alloc-text">${esc(a.text || "")}</td>
      </tr>`).join("");
    body.querySelectorAll(".alloc-lic").forEach((el) =>
      el.addEventListener("click", (e) => {
        e.preventDefault();
        const q = el.dataset.lic;
        const si = document.getElementById("search");
        if (si) { si.value = q; state.search = q.toLowerCase(); }
        render();
        document.querySelector(".table-section").scrollIntoView({ behavior: "smooth" });
      }));
    const cnt = document.getElementById("allocCount");
    if (cnt) {
      const matched = ALLOCATIONS.filter((a) => a.license).length;
      cnt.textContent = `${ALLOCATIONS.length} قرار (${matched} مرتبط بترخيص مسجّل)`;
    }
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

  // ---------- صفحة اختيار المناطق ----------
  const REGIONS = [
    { name: "الشعيبة الصناعية", lat: 29.02, lng: 48.13, active: true },
    { name: "صبحان الصناعية", lat: 29.2309026, lng: 48.0035053, active: true },
    { name: "أمغرة الصناعية", lat: 29.352, lng: 47.782, active: true },
    { name: "الشويخ الصناعية", lat: 29.338, lng: 47.93 },
    { name: "الري", lat: 29.302, lng: 47.925 },
    { name: "جنوب أمغرة", lat: 29.322, lng: 47.802 },
    { name: "الصليبية الصناعية", lat: 29.262, lng: 47.86 },
    { name: "المرقاب الصناعية", lat: 29.366, lng: 47.984 },
    { name: "النعايم", lat: 29.285, lng: 47.229 },
    { name: "الفحيحيل", lat: 29.082, lng: 48.13 },
    { name: "شرق الأحمدي", lat: 29.06, lng: 48.11 },
    { name: "ميناء عبدالله الصناعية", lat: 29.02, lng: 48.16 },
  ];
  let regMap;
  function enterApp(name) {
    if (name) loadRegion(name);
    const reg = document.getElementById("regions");
    if (!reg || reg.classList.contains("hide")) return;
    reg.classList.add("hide");
    setTimeout(() => { reg.style.display = "none"; }, 750);
    setTimeout(() => { if (map) { map.invalidateSize(); if (AREAS.length === 1) map.setView([AREAS[0].lat, AREAS[0].lng], 12); } }, 350);
    window.scrollTo(0, 0);
  }
  function initRegions() {
    const el = document.getElementById("regionsMap");
    const logo = document.getElementById("regLogo");
    if (logo && typeof PAI_LOGO !== "undefined") logo.src = PAI_LOGO;
    if (el && typeof L !== "undefined") {
      try {
        regMap = L.map("regionsMap", { scrollWheelZoom: false }).setView([29.28, 47.85], 8);
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Imagery © Esri" }).addTo(regMap);
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, opacity: 0.9 }).addTo(regMap);
        REGIONS.forEach((r) => {
          const m = L.circleMarker([r.lat, r.lng], {
            radius: r.active ? 14 : 9, color: "#fff", weight: 2.5,
            fillColor: r.active ? "#2bb673" : "#8595a8", fillOpacity: r.active ? 0.92 : 0.6,
          }).addTo(regMap);
          m.bindTooltip(r.name + (r.active ? "" : " — قريباً"), { direction: "top" });
          if (r.active) {
            m.bindPopup(`<div class="map-popup"><b>${esc(r.name)}</b><br/>متاح الآن<br/><button data-enter="1">افتح التقرير ↦</button></div>`);
            m.on("popupopen", (e) => { const b = e.popup.getElement().querySelector("button[data-enter]"); if (b) b.addEventListener("click", () => enterApp(r.name)); });
            m.on("click", () => enterApp(r.name));
          } else {
            m.bindPopup(`<div class="map-popup"><b>${esc(r.name)}</b><br/>قريباً</div>`);
          }
        });
      } catch (e) { console.error("regions map failed", e); }
    }
    const cards = document.getElementById("regionCards");
    if (cards) {
      cards.innerHTML = REGIONS.map((r) =>
        `<div class="region-card ${r.active ? "active" : "soon"}" data-name="${esc(r.name)}">
           <div class="rc-name">${esc(r.name)}</div>
           <div class="rc-status">${r.active ? "متاح الآن ✓" : "قريباً"}</div>
         </div>`).join("");
      cards.querySelectorAll(".region-card.active").forEach((c) => c.addEventListener("click", () => enterApp(c.dataset.name)));
    }
  }

  // ---------- صفحة الافتتاح (Splash) ----------
  function gearPath(teeth, outer, inner, cx, cy) {
    const t = (2 * Math.PI) / teeth, tw = t * 0.20, gv = t * 0.06, pts = [];
    const P = (r, a) => `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
    for (let i = 0; i < teeth; i++) {
      const a = i * t;
      pts.push(P(inner, a - tw - gv), P(outer, a - tw), P(outer, a + tw), P(inner, a + tw + gv));
    }
    return "M" + pts.join(" L ") + " Z";
  }
  function initSplash() {
    const splash = document.getElementById("splash");
    if (!splash) return;
    const logo = document.getElementById("paiLogo");
    if (logo && typeof PAI_LOGO !== "undefined") logo.src = PAI_LOGO;
    const gears = document.getElementById("gears");
    if (gears) {
      const g = (cls, teeth, color) =>
        `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true">
           <path d="${gearPath(teeth, 48, 33, 50, 50)}" fill="${color}"/>
           <circle cx="50" cy="50" r="13" fill="none" stroke="${color}" stroke-width="7"/></svg>`;
      gears.innerHTML =
        g("gear-a", 14, "rgba(43,182,115,.16)") +
        g("gear-b", 12, "rgba(226,85,85,.15)") +
        g("gear-c", 10, "rgba(230,168,53,.17)");
    }
    let done = false;
    const close = () => {
      if (done) return; done = true;
      splash.classList.add("hide");
      setTimeout(() => { splash.style.display = "none"; }, 900);
      setTimeout(() => { if (regMap) regMap.invalidateSize(); }, 400);
    };
    splash.addEventListener("click", close);
    setTimeout(close, 3800);
  }

  document.addEventListener("DOMContentLoaded", () => {
    initSplash();
    initRegions();
    initLightbox();
    try {
      if (typeof L !== "undefined") initMap();
      else showMapFallback("تعذّر تحميل مكتبة الخريطة.");
    } catch (e) { console.error(e); showMapFallback("تعذّر عرض الخريطة في هذه البيئة."); }
    bindControls();
    // تحميل أول منطقة متاحة افتراضياً (يظهر التقرير بعد اختيار المنطقة)
    const first = REGIONS.find((r) => r.active);
    if (first) loadRegion(first.name);
  });
})();
