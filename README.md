:root {
  --bg: #0f1722;
  --panel: #18222f;
  --panel-2: #1f2c3c;
  --line: #2a3a4d;
  --text: #e7eef6;
  --muted: #93a4b8;
  --accent: #2bb673;
  --accent-2: #3a9ad9;
  --danger: #e25555;
  --shadow: 0 6px 22px rgba(0, 0, 0, .35);
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--text);
  font-family: "Segoe UI", Tahoma, "Noto Kufi Arabic", Arial, sans-serif;
  line-height: 1.5;
}

.site-header {
  background: linear-gradient(135deg, #16324f, #0f1722);
  border-bottom: 1px solid var(--line);
  padding: 22px 16px;
}
.header-inner { max-width: 1200px; margin: 0 auto; }
.site-header h1 { margin: 0 0 6px; font-size: 1.7rem; }
.subtitle { margin: 0; color: var(--muted); font-size: .95rem; }

main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 18px 16px 40px;
}

/* الإحصائيات */
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}
.stat-card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: var(--shadow);
}
.stat-card .num { font-size: 1.6rem; font-weight: 700; color: var(--accent); }
.stat-card .lbl { color: var(--muted); font-size: .85rem; }

/* الخريطة */
.map-section { margin-bottom: 18px; }
#map {
  height: 460px;
  width: 100%;
  border-radius: 14px;
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
  z-index: 1;
}

/* أدوات التحكم */
.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.control { display: flex; }
.search-box { flex: 1 1 320px; }
#search, #areaFilter {
  width: 100%;
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 11px 14px;
  font-size: .95rem;
  font-family: inherit;
}
#search:focus, #areaFilter:focus {
  outline: none;
  border-color: var(--accent-2);
}
#areaFilter { min-width: 200px; cursor: pointer; }
.clear-btn {
  background: var(--panel-2);
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 11px 16px;
  cursor: pointer;
  font-family: inherit;
  font-size: .9rem;
}
.clear-btn:hover { border-color: var(--danger); color: var(--danger); }
.result-count { color: var(--muted); font-size: .9rem; margin-inline-start: auto; }

/* الجدول */
.table-section {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: var(--shadow);
}
.table-wrap { overflow-x: auto; max-height: 70vh; overflow-y: auto; }
table { width: 100%; border-collapse: collapse; font-size: .9rem; }
thead th {
  position: sticky;
  top: 0;
  background: var(--panel-2);
  color: var(--text);
  text-align: right;
  padding: 12px 14px;
  border-bottom: 2px solid var(--line);
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
}
thead th:hover { color: var(--accent); }
thead th.sorted-asc::after { content: " ▲"; color: var(--accent); }
thead th.sorted-desc::after { content: " ▼"; color: var(--accent); }
tbody td {
  padding: 11px 14px;
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
}
tbody tr.plot-row { cursor: pointer; transition: background .12s; }
tbody tr.plot-row:hover { background: var(--panel-2); }
tbody tr.plot-row.active { background: #223347; }

.badge {
  display: inline-block;
  background: var(--accent-2);
  color: #fff;
  border-radius: 20px;
  padding: 2px 10px;
  font-size: .8rem;
}
.badge.zero { background: var(--line); color: var(--muted); }
.owner-cell { white-space: normal; min-width: 220px; }

/* صف السجل (المالكون السابقون) */
.history-row > td {
  background: #131c27;
  padding: 0;
}
.history-inner { padding: 12px 18px; }
.history-inner h4 { margin: 0 0 8px; color: var(--accent-2); font-size: .95rem; }
.history-table { width: 100%; font-size: .85rem; }
.history-table th, .history-table td {
  padding: 7px 10px;
  border-bottom: 1px solid var(--line);
  white-space: normal;
}
.history-table th { color: var(--muted); text-align: right; }

.empty-state { padding: 30px; text-align: center; color: var(--muted); }

/* تذييل */
.site-footer {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px 16px 40px;
  color: var(--muted);
  font-size: .82rem;
  text-align: center;
}

/* نافذة الخريطة المنبثقة */
.leaflet-popup-content { font-family: inherit; direction: rtl; text-align: right; }
.map-popup b { color: #16324f; }
.map-popup button {
  margin-top: 8px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
  font-family: inherit;
}

@media (max-width: 640px) {
  #map { height: 340px; }
  .site-header h1 { font-size: 1.3rem; }
  .result-count { margin-inline-start: 0; width: 100%; }
}
