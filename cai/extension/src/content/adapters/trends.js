/**
 * Google Trends: không trích DOM biểu đồ (dễ vỡ). Người dùng bấm nút ⬇ Export CSV của Trends
 * rồi import trong Side Panel. Adapter chỉ cung cấp tham số trang (geo, thời gian, từ khóa).
 */
(() => {
  const CAI = window.__CAI;
  CAI.register({
    source: 'GOOGLE_TRENDS',
    label: 'Google Trends',
    noCards: true,
    matches: (loc) => /^trends\.google\./.test(loc.hostname) && loc.pathname.includes('/explore'),
    findCards: () => [],
    pageMeta() {
      const p = new URLSearchParams(location.search);
      return {
        geo: p.get('geo') || '',
        timeframe: p.get('date') || 'today 12-m',
        keywords: (p.get('q') || '').split(',').map((s) => s.trim()).filter(Boolean),
        source_url: location.href
      };
    }
  });
})();
