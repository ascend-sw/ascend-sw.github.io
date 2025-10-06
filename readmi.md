# **📖 README – Homerun E2E Speed Test Workflow**

This script automates performance testing using sitespeed.io
and generates a comparison report between releases.
It runs sitespeed tests, organizes the results, cleans up unnecessary files, and produces an HTML summary report.



## 🚀 What the script does
```node scripts/homerun-e2e-speed.js <release-name>```

The workflow is:
1. Clean up old release folder 
   - Removes any existing results for the given <release-name>.
2. Run sitespeed.io
   - Executes sitespeed.io with:
     - URLs listed in scripts/homerun_urls.txt
     - Config file: scripts/config.json
   - Saves results in a folder named after <release-name>.
3. Move results
   - Moves the generated results into homerun/<release-name>.
4. Generate comparison report
   - Runs scripts/compare-results.js to build comparison-report.html, comparing the new results with past runs in homerun/.
5. Clean up unnecessary files
   - Deletes large/unused result files:
     - .har.gz
     - most .json files (except browsertime.pageSummary.json and browsertime.summary-total.json).
6. ✅ Done – you now have a cleaned-up homerun/<release-name> with essential JSONs and a new comparison-report.html.



## 📦 Requirements
- Node.js (v20+ recommended)
- sitespeed.io installed globally or available via npm/yarn
  -  ```npm install -g sitespeed.io```
- URLs to test defined in:
  - ```scripts/homerun_urls.txt```
- Config file with sitespeed settings:
  - ```scripts/config.json```


## 🛠️ Usage
1. Update compare-results.js script by adding the current release in the release reports history. This will be needed to open the details report for the release.
   - search by ```<div class="panel-release">```
   - add a new anchor corresponding to the current testing release (e.g. 29)
   - ```<a href="https://ascend-sw.github.io/homerun/release-29/" target="_blank"><b>release-29</b> (16.09.2025)</a>```
2. Run performance test for a release (e.g. release-29)
   - ```node scripts/homerun-e2e-speed.js release-29```



This will:
- Run sitespeed.io on all URLs in scripts/homerun_urls.txt
- Store results in homerun/release-29
- Generate/Update comparison-report.html
- Clean up unnecessary files



## 📂 Project structure after run

Example after running for release-29:

homerun/<br>
├── release-28/<br>
│   ├── pages/browsertime.pageSummary.json<br>
│   ├── data/browsertime.summary-total.json<br>
│   ├── index.html<br>
│   └── (other cleaned files)<br>
├── release-29/<br>
│   ├── pages/browsertime.pageSummary.json<br>
│   ├── data/browsertime.summary-total.json<br>
│   ├── index.html<br>
│   └── (other cleaned files)<br>
comparison-report.html



## 📊 Report
Open comparison-report.html in a browser to see performance results across releases.
- homerun/<release>/ → contains cleaned performance results for that release
- comparison-report.html → aggregated performance dashboard



## 📊 About compare-results.js
The script scripts/compare-results.js takes all releases stored under homerun/ and generates a single HTML file (comparison-report.html) that compares metrics over time.

**Key features:**
- Reads summary JSONs (browsertime.pageSummary.json, browsertime.summary-total.json) from each release.
- Extracts core performance metrics:
    - FCP (First Contentful Paint)
    - LCP (Largest Contentful Paint)
    - TBT (Total Blocking Time)
    - CLS (Cumulative Layout Shift)
    - TTFB (Time To First Byte)
- Computes Lighthouse-style scores using log-normal curves.
- Shows trend arrows (↑ worse, ↓ better, → unchanged).
- Generates a colored HTML table:
  - 🟩 Green → Good 
  - 🟧 Orange → Needs improvement 
  - 🟥 Red → Poor
- Highlights the latest release values with colored badges.
- Builds an overall Performance Score (0–100) per release, weighted by metric importance.

Open **comparison-report.html** in your browser to explore performance trends across releases.