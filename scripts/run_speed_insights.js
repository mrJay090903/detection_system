#!/usr/bin/env node
/*
  NOTE: @vercel/speed-insights is a client-side library (it injects a script tag to collect vitals).
  There is no dedicated CLI provided by the package to run Lighthouse from Node in this version.

  This helper prints quick instructions for using Speed Insights and verifying the injection.
  Usage: node scripts/run_speed_insights.js
*/

console.log('Speed Insights helper')
console.log('1) The app has a client component that injects the Speed Insights script into pages:')
console.log('   -> src/components/SpeedInsights.tsx is included in src/app/layout.tsx')
console.log('2) To see it in action:')
console.log('   - Start the dev server: npm run dev')
console.log('   - Open a page (e.g., http://localhost:3000/research-check)')
console.log('   - Open DevTools -> Console and look for "[Speed Insights] injected script"')
console.log('   - In network tab, you may see requests to va.vercel-scripts.com when the script runs')
console.log('3) To collect Lighthouse reports programmatically, use Lighthouse (npm i -D lighthouse) or a separate runner.')
console.log('\nThis helper intentionally does not attempt a CLI run because @vercel/speed-insights is a browser sdk.')
