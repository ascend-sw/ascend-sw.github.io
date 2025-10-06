const fs = require('fs');
const path = require('path');

// ---- Helpers ----
function loadJson(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        console.error(`❌ Could not load ${filePath}:`, e.message);
        return {};
    }
}

const metricUnits = {
    TTFB: 'ms',
    FCP: 'ms',
    LCP: 'ms',
    TBT: 'ms',
    CLS: ''
};

function logNormalScore(value, median, podr) {
    if (value == null) return null;

    // Convert median + PODR into log-normal params
    const location = Math.log(median);
    const logRatio = Math.log(podr) - Math.log(median);
    const shape = Math.log(2) / logRatio; // σ
    const mu = location;                  // μ
    const sigma = shape;

    // Standardize
    const standardized = (Math.log(value) - mu) / sigma;

    // Φ(z): normal CDF
    const phi = 0.5 * (1 + erf(standardized / Math.sqrt(2)));

    // Clamp between 0–1 and invert (small is good → high score)
    return Math.round((1 - phi) * 100);
}

// Error function approximation for Φ
function erf(x) {
    // Abramowitz-Stegun approximation
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const a1 = 0.254829592,
        a2 = -0.284496736,
        a3 = 1.421413741,
        a4 = -1.453152027,
        a5 = 1.061405429,
        p  = 0.3275911;

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
}


function scoreMetric(value, good, poor, inverted = false) {
    if (value == null) return null;
    let score;
    if (inverted) {
        // for CLS, lower is better
        if (value <= good) return 100;
        if (value >= poor) return 0;
        score = ((poor - value) / (poor - good)) * 100;
    } else {
        // for ms metrics, lower is better
        if (value <= good) return 100;
        if (value >= poor) return 0;
        score = ((poor - value) / (poor - good)) * 100;
    }
    return Math.round(score);
}

function calculatePerfScore(metrics) {
    const scores = {
        FCP:  logNormalScore(metrics.FCP, 1800, 3000),
        LCP:  logNormalScore(metrics.LCP, 2500, 4000),
        TBT:  logNormalScore(metrics.TBT, 300, 600),
        CLS:  logNormalScore(metrics.CLS, 0.1, 0.25),
        TTFB: logNormalScore(metrics.TTFB, 800, 1800),
    };

    // Lighthouse weighting (v10+)
    const weights = { FCP: 0.1, LCP: 0.25, TBT: 0.3, CLS: 0.15, TTFB: 0.2 };
    let total = 0, weightSum = 0;

    for (const m in scores) {
        if (scores[m] != null) {
            total += scores[m] * weights[m];
            weightSum += weights[m];
        }
    }

    return Math.round(total / weightSum);
}


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

function compareReleases(metricsByRelease) {
    const releases = Object.keys(metricsByRelease);
    const results = {};

    releases.forEach((release, idx) => {
        results[release] = [];
        const metrics = metricsByRelease[release];
        const prevMetrics = idx > 0 ? metricsByRelease[releases[idx - 1]] : null;

        Object.keys(metrics).forEach(metric => {
            const value = metrics[metric];
            if (value == null) return;

            let diff = null, pct = null;
            if (prevMetrics && prevMetrics[metric] != null) {
                diff = value - prevMetrics[metric];
                pct = prevMetrics[metric] === 0 ? null : (diff / prevMetrics[metric]) * 100;
            }

            results[release].push({
                metric,
                value,
                unit: metricUnits[metric] || '',
                diff,
                pct
            });
        });
    });

    return { releases, results, metricsByRelease };
}

function formatValue(value, unit) {
    if (value == null) return '-';
    if (unit === 'ms') return `${Math.round(value)} ms`;
    return value.toFixed(3);
}

function formatPct(pct) {
    if (pct == null || isNaN(pct)) return 'N/A';
    const sign = pct > 0 ? '+' : '';
    return `${sign}${pct.toFixed(2)}%`;
}

function generateHtml(allResults, releases, outputFile) {
    const sectionHtml = allResults.map(({ section, page, results, metricsByRelease }) => {
        const metrics = Object.keys(metricUnits);

        const lastRelease = releases[releases.length - 1];
        const prevRelease = releases.length > 1 ? releases[releases.length - 2] : null;

        const lastMetrics = metricsByRelease[lastRelease];
        const prevMetrics = prevRelease ? metricsByRelease[prevRelease] : null;

        const score = calculatePerfScore(lastMetrics) || 0;
        const prevScore = prevMetrics ? calculatePerfScore(prevMetrics) : null;
        let scoreDiff = null, scoreArrow = '→', scoreColorDiff = '#9ca3af';

        const scoreColor = score < 50 ? '#ef4444' : score < 90 ? '#f16626' : '#10b981';
        const scoreBg = score < 50 ? '#fecaca' : score < 90 ? '#ffd3a6' : '#bbf7d0';

        if (prevScore != null) {
            scoreDiff = score - prevScore;
            if (scoreDiff > 0) {
                scoreArrow = '↑';
                scoreColorDiff = '#10b981'; // green
            } else if (scoreDiff < 0) {
                scoreArrow = '↓';
                scoreColorDiff = '#ef4444'; // red
            }
        }


        const rows = metrics.map(metric => {
            const cols = releases.map((r, idx) => {
                const data = results[r].find(m => m.metric === metric);
                let cellValue = data ? formatValue(data.value, data.unit) : '-';

                // highlight only the last release cell
                if (idx === releases.length - 1 && data && data.value != null) {
                    let color = '', bg = '';

                    if (metric === 'CLS') {
                        // ✅ CLS uses thresholds (Web Vitals buckets)
                        if (data.value <= 0.1) { color = '#10b981'; }     // green
                        else if (data.value <= 0.25) { color = '#ff996b'; } // orange
                        else { color = '#ef4444'; }                        // red
                    } else {
                        // ✅ Other metrics use log-normal score
                        let score;
                        switch (metric) {
                            case 'FCP':  score = logNormalScore(data.value, 1800, 3000); break;
                            case 'LCP':  score = logNormalScore(data.value, 2500, 4000); break;
                            case 'TBT':  score = logNormalScore(data.value, 300, 600); break;
                            case 'TTFB': score = logNormalScore(data.value, 800, 1800); break;
                        }

                        if (score != null) {
                            if (score < 50) { color = '#ef4444'; }
                            else if (score < 90) { color = '#ff996b'; }
                            else { color = '#10b981'; }
                        }
                    }

                    cellValue = `<span style="display:inline-block;padding:4px 8px;border-radius:6px;background:${bg};color:${color};font-weight:bold;">${cellValue}</span>`;
                }

                return `<td>${cellValue}</td>`;
            }).join('');

            // compare last vs previous
            const last = results[releases[releases.length - 1]].find(m => m.metric === metric);
            const arrow = last?.diff < 0 ? '↓' : last?.diff > 0 ? '↑' : '→';
            const color = last?.diff < 0 ? '#10b981' : last?.diff > 0 ? '#ef4444' : '#9ca3af';

            return `
      <tr>
        <td>${metric}</td>
        ${cols}
        <td style="color:${color};font-weight:bold;">
          ${last?.diff != null ? formatValue(last.diff, last.unit) : '-'} ${arrow}
        </td>
        <td style="color:${color};font-weight:bold;">
          ${last?.pct != null ? formatPct(last.pct) : 'N/A'}
        </td>
      </tr>`;
        }).join('\n');

        // Chart.js dataset for each metric
        const charts = metrics.map((metric, i) => {
            const values = releases.map(r => {
                const data = results[r].find(m => m.metric === metric);
                return data?.value ?? 'null';
            });

            return `
      new Chart(document.getElementById('${section}_chart_${i}').getContext('2d'), {
        type: 'bar',
        data: {
          labels: ${JSON.stringify(releases)},
          datasets: [{
            label: '${metric}',
            data: [${values.join(',')}],
            backgroundColor: '#3b82f6'
          }]
        },
        options: { responsive: true, plugins:{ legend:{ display:false } } }
      });`;
        }).join('\n');

        const chartCanvases = metrics.map((m, i) => `
      <div class="panel"><h3>${m}</h3><canvas id="${section}_chart_${i}"></canvas></div>
    `).join('');

        return `
      <div class="panel">
        <div class="score-container">
            <div style="display: flex; align-items: center; gap: 16px;">
                <p class="score" style="border-color:${scoreColor}; background:${scoreBg}; color:${scoreColor};">${score}</p>
                <div>
                    <p style="color:${scoreColorDiff}; font-weight:bold; margin:0;">
                        ${scoreDiff != null ? `${scoreDiff > 0 ? '+' : ''}${scoreDiff} ${scoreArrow}` : '–'}
                    </p>
                </div>
            </div>
            <div class="score-metrics">
                <p>🔴 0-49</p>
                <p>🟠 50-89</p>
                <p>🟢 90-100</p>
            </div>
        </div>
        <h2><a href="${page}" target="_blank">${section}</a></h2>
        <table>
          <thead>
            <tr><th>Metric</th>${releases.map(r => `<th>${r}</th>`).join('')}<th>Δ</th><th>Δ%</th></tr>
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
  <title>Sitespeed.io Multi-Release Report</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family:sans-serif; margin:0; background:#1f2937; color:#f9fafb; }
    header { background:#111827; padding:1rem; text-align:center; border-bottom:1px solid #374151; }
    a { color:#f9fafb; text-decoration:none; display:block; margin-bottom:1rem; }
    .score-container { display: flex; justify-content: center; align-items: center; flex-direction: column; gap: 26px; }
    .score { background: darkgray; margin: 0; padding: 20px; font-size: 32px; font-weight: 600; border: 4px solid green; border-radius: 50%; }
    .score-metrics { display: flex; gap: 36px; p { margin: 0; } }
    .environment-config { display: flex; gap: 30px; justify-content: center; }
    .environment-config-column { display: flex; justify-content: center; align-items: flex-end; }
    .container { padding:2rem; display:grid; gap:2rem; max-width:1400px; margin:auto; }
    .panel { background:#111827; border:1px solid #374151; border-radius:10px; padding:1rem; }
    .panel-release { background:#111827; border:1px solid #374151; display: grid; grid-template-columns: 1fr 1fr; border-radius:10px; padding:1.5rem; box-shadow:0 2px 6px rgba(0,0,0,0.5); }
    table { width:100%; border-collapse:collapse; margin-top:1rem; }
    thead { background:#374151; }
    th,td { padding:8px; text-align:center; }
    td:first-child{ text-align:left; font-weight:500; }
    tr:nth-child(even){ background:#1f2937; }
    tr:nth-child(odd){ background:#111827; }
    .delta-grid{ display:grid; grid-template-columns:repeat(auto-fill, minmax(300px,1fr)); gap:1rem; }
  </style>
</head>
<body>
  <header>
    <h1>📊 Homerun - Release Performance Comparison</h1>
      <div class="environment-config">
          <div class="environment-config-column">
            <span class="text-2xl">📱</span>
            <span class="text-sm text-gray-400">Platform:&nbsp;</span>
            <span class="font-semibold">Mobile (avg)</span>
          </div>
          <div class="environment-config-column">
            <span class="text-2xl">🌐</span>
            <span class="text-sm text-gray-400">Network:&nbsp;</span>
            <span class="font-semibold">4G (average)</span>
          </div>
          <div class="environment-config-column">
            <span class="text-2xl">📋</span>
            <span class="text-sm text-gray-400">Executed Tests/Page:&nbsp;</span>
            <span class="font-semibold">10</span>
          </div>
    </div>
  </header>
  <div class="container">
    ${sectionHtml}
    <div class="panel-release">
        <div>
            <h2>Homerun - release reports</h2>
            <div>
                <a href="https://ascend-sw.github.io/homerun/release-30/" target="_blank"><b>release-30</b> (01.10.2025)</a>
                <a href="https://ascend-sw.github.io/homerun/release-29/" target="_blank"><b>release-29</b> (16.09.2025)</a>
                <a href="https://ascend-sw.github.io/homerun/release-28/" target="_blank"><b>release-28</b> (02.09.2025)</a>
            </div>
        </div>
        <div>
            <h2>Baristina - release reports</h2>
            <div>
                <a href="https://ascend-sw.github.io/baristina/release-30/" target="_blank"><b>release-30</b> (01.10.2025)</a>
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
</body>
</html>`;

    fs.writeFileSync(outputFile, html, 'utf8');
    console.log(`✅ Report saved: ${outputFile}`);
}

// ---- Main ----
if (process.argv.length < 4) {
    console.log('Usage: node compare-results.js <output.html> <baseDir>');
    process.exit(1);
}

const outputFile = process.argv[2];
const baseDir = process.argv[3];

const releases = fs.readdirSync(baseDir)
    .filter(f => f.startsWith('release-') && fs.statSync(path.join(baseDir, f)).isDirectory())
    .sort((a, b) => parseInt(a.split('-')[1]) - parseInt(b.split('-')[1]));

// Pages (same across releases)
const sections = [
    { name: 'GLOBAL Website Performance', page: '', file: 'data/browsertime.summary-total.json' },
    { name: 'HOMEPAGE', page: 'https://www.home-appliances.philips/pl/pl/', file: 'pages/www_home-appliances_philips/HOMEPAGE/data/browsertime.pageSummary.json' },
    { name: 'PLP', page: 'https://www.home-appliances.philips/pl/pl/home-life-products/coffee/philips-full-automatic-espresso/super-automatic-espresso-machines/c/SUPER_AUTOMATIC_ESPRESSO_SU', file: 'pages/www_home-appliances_philips/PLP/data/browsertime.pageSummary.json' },
    { name: 'PDP', page: 'https://www.home-appliances.philips/pl/pl/p/EP5546_70', file: 'pages/www_home-appliances_philips/PDP/data/browsertime.pageSummary.json' },
    { name: 'Category Page', page: 'https://www.home-appliances.philips/pl/pl/u/coffee-machines', file: 'pages/www_home-appliances_philips/Category_page/data/browsertime.pageSummary.json' },
    { name: 'Subcategory Page', page: 'https://www.home-appliances.philips/pl/pl/u/coffee-machines/philips-full-automatic-espresso', file: 'pages/www_home-appliances_philips/Subcategory_page/data/browsertime.pageSummary.json' },
    { name: 'Search Results Page', page: 'https://www.home-appliances.philips/pl/pl/search/coffee%20machine', file: 'pages/www_home-appliances_philips/Search_results_page/data/browsertime.pageSummary.json' },
    { name: 'Pre Purchase Page', page: 'https://www.home-appliances.philips/pl/pl/u/coffee-machines/philips-full-automatic-espresso/lattego', file: 'pages/www_home-appliances_philips/Pre_purchase_page/data/browsertime.pageSummary.json' }
];

const allResults = [];

sections.forEach(({ name, page, file }) => {
    const metricsByRelease = {};
    releases.forEach(r => {
        const filePath = path.join(baseDir, r, file);
        const json = loadJson(filePath);
        metricsByRelease[r] = extractMetrics(json);
    });
    const { results } = compareReleases(metricsByRelease);
    allResults.push({ section: name, page, results, metricsByRelease });
});

generateHtml(allResults, releases, outputFile);
