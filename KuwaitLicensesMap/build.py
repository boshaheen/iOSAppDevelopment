#!/usr/bin/env python3
"""يبني ملف KuwaitLicensesMap_standalone.html بدمج كل الأجزاء في ملف واحد."""
import re, os
HERE = os.path.dirname(os.path.abspath(__file__))


def read(name):
    return open(os.path.join(HERE, name), encoding="utf-8").read()


def main():
    leaflet_css = re.sub(r"url\((images/[^)]+)\)", "none", read("vendor/leaflet.css"))
    leaflet_js = read("vendor/leaflet.js")
    xlsx_js = read("vendor/xlsx.full.min.js")
    assets_js = read("assets.js")
    style_css = read("style.css")
    data_js = read("data.js")
    plans_js = read("plans.js")
    app_js = read("app.js")

    html = f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>خريطة تراخيص الشعيبة الصناعية</title>
  <style>
{leaflet_css}
{style_css}
  </style>
</head>
<body>
  <div id="splash">
    <div class="splash-inner">
      <div class="gears" id="gears" aria-hidden="true"></div>
      <div class="logo-card">
        <img id="paiLogo" alt="الهيئة العامة للصناعة" />
      </div>
    </div>
    <div class="splash-hint">اضغط للدخول</div>
  </div>
  <div id="regions">
    <div class="regions-head">
      <img id="regLogo" class="reg-logo" alt="الهيئة العامة للصناعة" />
      <h1>المناطق الصناعية في دولة الكويت</h1>
      <p>اختر المنطقة لعرض تقريرها</p>
    </div>
    <div id="regionsMap"></div>
    <div class="region-cards" id="regionCards"></div>
  </div>
  <header class="site-header">
    <div class="header-inner">
      <button id="backRegions" class="back-regions" type="button">🗺️ المناطق</button>
      <h1>🏭 مصانع وتراخيص الشعيبة الصناعية</h1>
      <p class="subtitle">خريطة تفاعلية لمصانع وتراخيص الشعيبة (الغربية والشرقية) — مع حركات التنازل وتاريخ التسليم</p>
    </div>
  </header>
  <main>
    <section class="stats" id="stats"></section>
    <section class="map-section"><div id="map"></div></section>
    <section class="controls">
      <div class="control search-box">
        <input type="text" id="search" placeholder="🔍 ابحث برقم الترخيص، الاسم التجاري، المتنازل/المتنازل إليه، النشاط..." />
      </div>
      <div class="control"><select id="areaFilter"><option value="">كل المناطق</option></select></div>
      <div class="control"><select id="statusFilter"><option value="">كل الحالات</option></select></div>
      <div class="control"><button id="clearBtn" class="clear-btn" type="button">مسح ✕</button></div>
      <div class="control"><button id="printBtn" class="print-btn" type="button">🖨️ تصدير PDF</button></div>
      <div class="control"><button id="excelBtn" class="excel-btn" type="button">⬇ تصدير Excel</button></div>
      <div class="result-count" id="resultCount"></div>
    </section>
    <div id="printHeader" class="print-only"></div>
    <section class="table-section">
      <div class="table-wrap">
        <table id="licTable">
          <thead>
            <tr>
              <th data-key="license">رقم الترخيص</th>
              <th data-key="client">رقم العميل</th>
              <th data-key="clientPlots">قسائم العميل</th>
              <th data-key="area">المنطقة</th>
              <th data-key="plot">القسيمة</th>
              <th data-key="size">المساحة (م²)</th>
              <th data-key="name">الاسم الحالي للترخيص</th>
              <th data-key="trade">الاسم التجاري</th>
              <th data-key="status">حالة الترخيص</th>
              <th data-key="end">تاريخ النهاية</th>
              <th data-key="delivery">تاريخ التسليم</th>
              <th data-key="permanentDate">تاريخ صدور الدائم</th>
              <th data-key="trCount">حركات التنازل</th>
              <th data-key="boardCount">موافقة مجلس الإدارة</th>
            </tr>
          </thead>
          <tbody id="licBody"></tbody>
        </table>
      </div>
      <div id="emptyState" class="empty-state" hidden>لا توجد نتائج مطابقة لبحثك.</div>
    </section>
    <section class="plans-section">
      <h2 class="plans-title">🗺️ مخططات المناطق الصناعية</h2>
      <p class="plans-hint">اضغط على أي مخطط لعرضه بحجم كامل مع إمكانية التكبير والتحريك.</p>
      <div class="plans-grid" id="plansGrid"></div>
    </section>
  </main>
  <div id="lightbox" class="lightbox" hidden>
    <div class="lb-bar">
      <span class="lb-title" id="lbTitle"></span>
      <span class="lb-actions">
        <button type="button" id="lbZoomOut" title="تصغير">−</button>
        <button type="button" id="lbZoomIn" title="تكبير">+</button>
        <button type="button" id="lbReset" title="إعادة الضبط">⟲</button>
        <a id="lbDownload" download="مخطط.jpg" title="تحميل">⬇</a>
        <button type="button" id="lbClose" title="إغلاق">✕</button>
      </span>
    </div>
    <div class="lb-stage" id="lbStage"><img id="lbImg" alt="مخطط" draggable="false" /></div>
  </div>
  <footer class="site-footer">
    <p>البيانات مستخرجة من تقرير التراخيص الصناعية (كل ترخيص يظهر مرة واحدة، وتُعرض حركات التنازل عند فتح الصف). (خلفية الخريطة تحتاج اتصال إنترنت؛ الجدول والبحث يعملان بدونه.)</p>
  </footer>
  <script>
{leaflet_js}
  </script>
  <script>
{xlsx_js}
  </script>
  <script>
{assets_js}
  </script>
  <script>
{data_js}
  </script>
  <script>
{plans_js}
  </script>
  <script>
{app_js}
  </script>
</body>
</html>
"""
    out = os.path.join(HERE, "KuwaitLicensesMap_standalone.html")
    open(out, "w", encoding="utf-8").write(html)
    print("Wrote", out, os.path.getsize(out), "bytes")


if __name__ == "__main__":
    main()
