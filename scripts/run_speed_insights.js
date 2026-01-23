#!/usr/bin/env node
/*
  Simple wrapper that runs @vercel/speed-insights CLI against one or more local pages
  Usage: node scripts/run_speed_insights.js [url1 url2 ...]
  By default it runs against http://localhost:3000/research-check and /analysis-reports
*/
const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')

const urls = process.argv.slice(2)
if (urls.length === 0) {
  urls.push('http://localhost:3000/research-check')
  urls.push('http://localhost:3000/analysis-reports')
}

async function runForUrl(url) {
  console.log('Running Speed Insights for', url)
  return new Promise((resolve, reject) => {
    // Use the installed package via npx to ensure proper binary resolution
    // Output JSON for easy parsing
    const cmd = `npx @vercel/speed-insights --output json --form json ${url}`
    exec(cmd, { maxBuffer: 1024 * 1024 * 5 }, (err, stdout, stderr) => {
      if (err) {
        return reject({ err, stderr: stderr && stderr.toString() })
      }

      try {
        const parsed = JSON.parse(stdout)
        const outDir = path.join(process.cwd(), 'tmp')
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
        const outFile = path.join(outDir, `speed-insights-${encodeURIComponent(url)}-${Date.now()}.json`)
        fs.writeFileSync(outFile, JSON.stringify(parsed, null, 2))
        console.log('Saved results to', outFile)
        resolve({ url, file: outFile, parsed })
      } catch (parseErr) {
        reject({ err: parseErr, raw: stdout })
      }
    })
  })
}

;(async () => {
  const results = []
  for (const url of urls) {
    try {
      const r = await runForUrl(url)
      // Print a short summary if available
      const lighthouse = r.parsed && r.parsed.lighthouseResult
      if (lighthouse && lighthouse.categories) {
        console.log('Summary for', url)
        for (const [key, val] of Object.entries(lighthouse.categories)) {
          console.log(`  ${key}: ${(val.score * 100).toFixed(0)}%`) 
        }
      }
      results.push(r)
    } catch (e) {
      console.error('Error running for', url, e.stderr || e.err || e.raw || e)
    }
  }

  console.log('\nCompleted. Parsed', results.length, 'results.')
})()
