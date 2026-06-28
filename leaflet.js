<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>خريطة القسائم الصناعية في الكويت</title>
  <link rel="stylesheet" href="vendor/leaflet.css" />
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <header class="site-header">
    <div class="header-inner">
      <h1>🗺️ خريطة القسائم الصناعية في الكويت</h1>
      <p class="subtitle">خريطة تفاعلية لكل منطقة صناعية والقسائم التابعة لها — اضغط على المنطقة لعرض قسائمها</p>
    </div>
  </header>

  <main>
    <!-- بطاقات الإحصائيات -->
    <section class="stats" id="stats"></section>

    <!-- الخريطة -->
    <section class="map-section">
      <div id="map"></div>
    </section>

    <!-- أدوات البحث -->
    <section class="controls">
      <div class="control search-box">
        <input type="text" id="search" placeholder="🔍 ابحث باسم المالك، رقم القسيمة، القطعة، رقم العميل، الرقم المدني..." />
      </div>
      <div class="control">
        <select id="areaFilter">
          <option value="">كل المناطق</option>
        </select>
      </div>
      <div class="control">
        <button id="clearBtn" class="clear-btn" type="button">مسح ✕</button>
      </div>
      <div class="result-count" id="resultCount"></div>
    </section>

    <!-- جدول القسائم -->
    <section class="table-section">
      <div class="table-wrap">
        <table id="plotsTable">
          <thead>
            <tr>
              <th data-key="client">رقم العميل</th>
              <th data-key="area">المنطقة</th>
              <th data-key="block">القطعة</th>
              <th data-key="plot">القسيمة</th>
              <th data-key="size">المساحة (م²)</th>
              <th data-key="owner">المالك الحالي</th>
              <th data-key="contractEnd">نهاية العقد</th>
              <th data-key="histCount">المالكون السابقون</th>
            </tr>
          </thead>
          <tbody id="plotsBody"></tbody>
        </table>
      </div>
      <div id="emptyState" class="empty-state" hidden>لا توجد نتائج مطابقة لبحثك.</div>
    </section>
  </main>

  <footer class="site-footer">
    <p>البيانات مستخرجة من جدول القسائم الصناعية. مواقع المناطق على الخريطة تقريبية ويمكن تعديلها.</p>
  </footer>

  <script src="vendor/leaflet.js"></script>
  <script src="data.js"></script>
  <script src="app.js"></script>
</body>
</html>
