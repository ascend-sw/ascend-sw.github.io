const fs = require('fs');
const path = require('path');

// ---- Helpers ----
function loadJson(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        console.error(`❌ Could not load ${filePath}:`, e.message);
        process.exit(1);
    }
}

// Map metrics to units
const metricUnits = {
    TTFB: 'ms',
    FCP: 'ms',
    LCP: 'ms',
    TBT: 'ms',
    speedIndex: 'ms',
    fullyLoaded: 'ms',
    CLS: '' // unitless score
};

function extractMetrics(json) {
    const googleWebVitals = json.statistics?.googleWebVitals || json.googleWebVitals || {};

    return {
        TTFB: googleWebVitals.ttfb?.median || googleWebVitals.ttfb || null,
        FCP: googleWebVitals.firstContentfulPaint?.median || googleWebVitals.firstContentfulPaint || null,
        LCP: googleWebVitals.largestContentfulPaint?.median || googleWebVitals.largestContentfulPaint || null,
        TBT: googleWebVitals.totalBlockingTime?.median || googleWebVitals.totalBlockingTime || null,
        CLS: googleWebVitals.cumulativeLayoutShift?.median || googleWebVitals.cumulativeLayoutShift || null
    };
}

function compareMetrics(before, after) {
    const results = [];
    Object.keys(before).forEach((metric) => {
        const b = before[metric];
        const a = after[metric];
        if (b == null || a == null) return;
        const diff = a - b;
        const pct = b === 0 ? null : (diff / b) * 100;
        results.push({ metric, before: b, after: a, diff, pct, unit: metricUnits[metric] || '' });
    });
    return results;
}

function formatValue(value, unit) {
    if (value == null) return '-';
    if (unit === 'ms') return `${Math.round(value)} ms`;
    return value.toFixed(3); // CLS or unitless
}

function formatPct(pct) {
    if (pct == null || isNaN(pct)) return 'N/A';
    const sign = pct > 0 ? '+' : '';
    return `${sign}${pct.toFixed(2)}%`;
}

function printConsole(results, section) {
    console.log(`\n📊 Performance Comparison: ${section}\n`);
    console.log(`Metric                   release-28       release-29        Δ             Δ%`);
    console.log('-----------------------------------------------------------------------');
    results.forEach(({ metric, before, after, diff, pct, unit }) => {
        const sign = diff > 0 ? '+' : '';
        console.log(
            `${metric.padEnd(22)} ${formatValue(before, unit).padEnd(12)} ${formatValue(after, unit).padEnd(12)} ${sign}${formatValue(diff, unit).padEnd(12)} ${formatPct(pct)}`
        );
    });
}

function generateHtml(allResults, outputFile) {
    const sectionHtml = allResults.map(({ section, page, results }) => {
        const rows = results.map(({ metric, before, after, diff, pct, unit }) => {
            const sign = diff > 0 ? '+' : '';
            let arrow = '→';
            let arrowColor = '#9ca3af';
            if (diff < 0) { arrow = '↓'; arrowColor = '#10b981'; }
            else if (diff > 0) { arrow = '↑'; arrowColor = '#ef4444'; }
            return `
        <tr>
          <td>${metric}</td>
          <td>${formatValue(before, unit)}</td>
          <td>${formatValue(after, unit)}</td>
          <td style="color:${arrowColor};font-weight:bold;">
            ${sign}${formatValue(diff, unit)} ${arrow}
          </td>
          <td style="color:${arrowColor};font-weight:bold;">
            ${formatPct(pct)}
          </td>
        </tr>`;
        }).join('\n');

        const charts = results.map((r, i) => `
      new Chart(document.getElementById('${section}_chart_${i}').getContext('2d'), {
        type: 'bar',
        data: {
          labels: ['release-28', 'release-29'],
          datasets: [{
            label: '${r.metric} (${r.unit})',
            data: [${r.before}, ${r.after}],
            backgroundColor: ['#3b82f6', '#10b981']
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#f9fafb' }, grid: { color: '#374151' } },
            y: { ticks: { color: '#f9fafb' }, grid: { color: '#374151' } }
          }
        }
      });`).join('\n');

        const chartCanvases = results.map((r, i) => `
      <div class="panel">
        <h3>${r.metric}</h3>
        <canvas id="${section}_chart_${i}"></canvas>
      </div>
    `).join('');

        return `
      <div class="panel">
        <h2><a href="${page}" target="_blank">${section}</a></h2>
        <table>
          <thead>
            <tr><th>Metric</th><th>release-28</th><th>release-29</th><th>Δ</th><th>Δ%</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="delta-grid">${chartCanvases}</div>
      </div>
      <script>${charts}</script>
    `;
    }).join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sitespeed.io Comparison Report</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family:"Inter",sans-serif; margin:0; background:#1f2937; color:#f9fafb; }
    header { background:#111827; padding:1rem 2rem; text-align:center; border-bottom:1px solid #374151; }
    h1 { margin:0; font-size:1.75rem; font-weight:600; }
    a { color:#f9fafb; text-decoration:none; display:block; margin-bottom:1rem; }
    .container { display:grid; grid-template-columns:1fr; gap:2rem; padding:2rem; max-width:1400px; margin:auto; }
    .panel { background:#111827; border:1px solid #374151; border-radius:10px; padding:1.5rem; box-shadow:0 2px 6px rgba(0,0,0,0.5); }
    .panel-release { background:#111827; border:1px solid #374151; display: grid; grid-template-columns: 1fr 1fr; border-radius:10px; padding:1.5rem; box-shadow:0 2px 6px rgba(0,0,0,0.5); }
    table { width:100%; border-collapse:collapse; margin-top:1rem; }
    thead { background:#374151; }
    th, td { padding:12px 16px; text-align:center; }
    tr:nth-child(even){ background:#1f2937; }
    tr:nth-child(odd){ background:#111827; }
    td:first-child{ text-align:left; font-weight:500; }
    canvas{ max-width:100%; }
    .delta-grid{ display:grid; grid-template-columns:repeat(auto-fill, minmax(300px,1fr)); gap:1.5rem; }
    .footer{ text-align:center; margin-top:2rem; font-size:0.875rem; color:#9ca3af; }
  </style>
</head>
<body>
  <header><h1>📊 Homerun - Release Performance Comparison</h1></header>
  <div class="container">
    ${sectionHtml}
    <div class="panel-release">
        <div>
            <h2>Homerun - release reports</h2>
            <div>
                <a href="https://ascend-sw.github.io/homerun/release-30/" target="_blank"><b>release-30</b> (comming soon)</a>
                <a href="https://ascend-sw.github.io/homerun/release-29/" target="_blank"><b>release-29</b> (16.09.2025)</a>
                <a href="https://ascend-sw.github.io/homerun/release-28/" target="_blank"><b>release-28</b> (02.09.2025)</a>
            </div>
        </div>
        <div>
            <h2>Baristina - release reports</h2>
            <div>
                <a href="https://ascend-sw.github.io/baristina/release-30/" target="_blank"><b>release-30</b> (comming soon)</a>
                <a href="https://ascend-sw.github.io/baristina/release-29/" target="_blank"><b>release-29</b> (16.09.2025)</a>
                <a href="https://ascend-sw.github.io/baristina/release-28/" target="_blank"><b>release-28</b> (02.09.2025)</a>
            </div>
        </div>
    </div>
    <div class="panel">
        <h2>Metric Details</h2>
        <p><b>FCP (First Contentful Paint): </b>measures the time from navigation to the time when the browser renders the first bit of content from the DOM</p>
        <p><b>TBT (Total Blocking Time): </b>the blocking time of a given long task is its duration in excess of 50 ms. And the total blocking time for a page is the sum of the blocking time for each long task that happens after first contentful paint.</p>
        <p><b>LCP (Largest Contentful Paint): </b>this metric reports the render time of the largest content element visible in the viewport.</p>
        <p><b>CLS (Cumulative Layout Shift): </b>measures the sum total of all individual layout shift scores for unexpected layout shift that occur. The metric is measuring visual stability by quantify how often users experience unexpected layout shifts. It is one of Google Web Vitals.</p>
        <p><b>TTFB (Time To First Byte): </b>The time it takes for the network and the server to generate and start sending the HTML. Collected using the Navigation Timing API with the definition: responseStart - navigationStart</p>
    </div>
  </div>
  <div class="footer">Generated on ${new Date().toLocaleString()}</div>
</body>
</html>`;

    fs.writeFileSync(outputFile, html, 'utf8');
    console.log(`\n✅ HTML report saved to ${outputFile}`);
}

// ---- Main ----
// Usage: node compare-results.js output.html globalBefore.json globalAfter.json homepageBefore.json homepageAfter.json plpBefore.json plpAfter.json pdpBefore.json pdpAfter.json
if (process.argv.length < 6) {
    console.log('Usage: node compare-results.js <output.html> <globalBefore.json> <globalAfter.json> <homepageBefore.json> <homepageAfter.json> <plpBefore.json> <plpAfter.json> <pdpBefore.json> <pdpAfter.json>');
    process.exit(1);
}

const outputFile = process.argv[2];

const sections = [
    { name: 'GLOBAL Website Performance', page: '', before: process.argv[3], after: process.argv[4] },
    { name: 'HOMEPAGE', page: 'https://www.home-appliances.philips/pl/pl/', before: process.argv[5], after: process.argv[6] },
    { name: 'PLP', page: 'https://www.home-appliances.philips/pl/pl/home-life-products/coffee/philips-full-automatic-espresso/super-automatic-espresso-machines/c/SUPER_AUTOMATIC_ESPRESSO_SU', before: process.argv[7], after: process.argv[8] },
    { name: 'PDP', page: 'https://www.home-appliances.philips/pl/pl/p/EP5546_70', before: process.argv[9], after: process.argv[10] },
    { name: 'Category Page', page: 'https://www.home-appliances.philips/pl/pl/u/coffee-machines', before: process.argv[11], after: process.argv[12] },
    { name: 'Subcategory Page', page: 'https://www.home-appliances.philips/pl/pl/u/coffee-machines/philips-full-automatic-espresso', before: process.argv[13], after: process.argv[14] },
    { name: 'Search Results Page', page: 'https://www.home-appliances.philips/pl/pl/search/coffee%20machine', before: process.argv[15], after: process.argv[16] },
    { name: 'Pre Purchase Page', page: 'https://www.home-appliances.philips/pl/pl/u/coffee-machines/philips-full-automatic-espresso/lattego', before: process.argv[17], after: process.argv[18] },
];

const allResults = [];

sections.forEach(({ name, page, before, after }) => {
    if (!before || !after) return;
    const beforeJson = loadJson(path.resolve(before));
    const afterJson = loadJson(path.resolve(after));
    const beforeMetrics = extractMetrics(beforeJson);
    const afterMetrics = extractMetrics(afterJson);
    const results = compareMetrics(beforeMetrics, afterMetrics);
    // printConsole(results, name);
    allResults.push({ section: name, page: page, results });
});

generateHtml(allResults, outputFile);