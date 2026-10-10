import {defineConfig,devices} from '@playwright/test';

export default defineConfig({
 testDir:'./e2e',
 testMatch:'two-app-thinktank-roundtrip.spec.mjs',
 fullyParallel:false,
 retries:0,
 workers:1,
 timeout:180000,
 expect:{timeout:25000},
 reporter:[['list'],['junit',{outputFile:'test-results/two-app-thinktank-roundtrip.xml'}]],
 use:{
  ...devices['Desktop Chrome'],
  baseURL:'http://127.0.0.1:4173/SuperPhiVessel/vessie/',
  headless:true,
  acceptDownloads:true,
  trace:'retain-on-failure',
  screenshot:'only-on-failure'
 },
 webServer:[
  {
   command:'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
   url:'http://127.0.0.1:4173/SuperPhiVessel/vessie/',
   reuseExistingServer:!process.env.CI,
   timeout:120000
  },
  {
   command:'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
   cwd:'../../think-tank',
   url:'http://127.0.0.1:5173/',
   reuseExistingServer:!process.env.CI,
   timeout:120000
  }
 ]
});
