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
    const googleWebVitals = json.googleWebVitals || {};

    return {
        TTFB: googleWebVitals.ttfb?.median || null,
        FCP: googleWebVitals.firstContentfulPaint?.median || null,
        LCP: googleWebVitals.largestContentfulPaint?.median || null,
        TBT: googleWebVitals.totalBlockingTime?.median || null,
        CLS: googleWebVitals.cumulativeLayoutShift?.median || null
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

function printConsole(results) {
    console.log('\n📊 Performance Comparison\n');
    console.log(`Metric                   Before       After        Δ             Δ%`);
    console.log('-----------------------------------------------------------------------');
    results.forEach(({ metric, before, after, diff, pct, unit }) => {
        const sign = diff > 0 ? '+' : '';
        console.log(
            `${metric.padEnd(22)} ${formatValue(before, unit).padEnd(12)} ${formatValue(after, unit).padEnd(12)} ${sign}${formatValue(diff, unit).padEnd(12)} ${formatPct(pct)}`
        );
    });
}

function generateHtml(results, outputFile) {
    // Table rows
    const rows = results
        .map(({ metric, before, after, diff, pct, unit }) => {
            const sign = diff > 0 ? '+' : '';
            let arrow = '→';
            let arrowColor = '#9ca3af'; // gray
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

    // Mini Before vs After charts per metric
    const beforeAfterCharts = results.map((r,i) => `
    <div class="panel">
      <h3>${r.metric}</h3>
      <canvas id="beforeAfter_${i}"></canvas>
    </div>
  `).join('');

    // Mini Delta charts per metric
    const deltaCharts = results.map((r,i) => `
    <div class="panel">
      <h3>${r.metric} Δ</h3>
      <canvas id="deltaChart_${i}"></canvas>
    </div>
  `).join('');

    // Chart scripts
    const beforeAfterChartScripts = results.map((r,i) => `
    new Chart(document.getElementById('beforeAfter_${i}').getContext('2d'), {
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
    });
  `).join('\n');

    // HTML template
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
    .container { display:grid; grid-template-columns:1fr; gap:2rem; padding:2rem; max-width:1400px; margin:auto; }
    .panel { background:#111827; border:1px solid #374151; border-radius:10px; padding:1.5rem; box-shadow:0 2px 6px rgba(0,0,0,0.5); }
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
  <header><h1>📊 Release Performance Comparison</h1></header>
  <div class="container">
    <div class="panel">
      <h2>Metrics Table</h2>
      <table>
        <thead>
          <tr><th>Metric</th><th>release-28</th><th>release-29</th><th>Δ</th><th>Δ%</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="panel">
      <h2>release-28 vs release-29 per Metric</h2>
      <div class="delta-grid">${beforeAfterCharts}</div>
    </div>
  </div>
  <div class="footer">Generated on ${new Date().toLocaleString()}</div>
  <script>
    ${beforeAfterChartScripts}
  </script>
</body>
</html>`;

    fs.writeFileSync(outputFile, html, 'utf8');
    console.log(`\n✅ HTML report saved to ${outputFile}`);
}

// ---- Main ----
if (process.argv.length < 4) {
    console.log('Usage: node compare-results.js <before.json> <after.json> [output.html]');
    process.exit(1);
}

const beforeFile = path.resolve(process.argv[2]);
const afterFile = path.resolve(process.argv[3]);
const outputFile = process.argv[4] || 'comparison-report.html';

const beforeJson = loadJson(beforeFile);
const afterJson = loadJson(afterFile);

const beforeMetrics = extractMetrics(beforeJson);
const afterMetrics = extractMetrics(afterJson);

const results = compareMetrics(beforeMetrics, afterMetrics);
printConsole(results);
generateHtml(results, outputFile);
