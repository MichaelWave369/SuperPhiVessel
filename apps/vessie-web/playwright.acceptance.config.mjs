import {defineConfig,devices} from '@playwright/test';

export default defineConfig({
 testDir:'./e2e',
 testMatch:'*.spec.mjs',
 fullyParallel:false,
 retries:0,
 workers:1,
 timeout:90000,
 expect:{timeout:12000},
 reporter:[['list'],['junit',{outputFile:'test-results/browser-acceptance.xml'}]],
 use:{
  ...devices['Desktop Chrome'],
  baseURL:'http://127.0.0.1:4173/SuperPhiVessel/vessie/',
  headless:true,
  acceptDownloads:true,
  trace:'retain-on-failure',
  screenshot:'only-on-failure'
 },
 webServer:{
  command:'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
  url:'http://127.0.0.1:4173/SuperPhiVessel/vessie/',
  reuseExistingServer:!process.env.CI,
  timeout:90000
 }
});
