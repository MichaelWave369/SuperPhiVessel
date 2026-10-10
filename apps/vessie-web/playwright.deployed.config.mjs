import {defineConfig,devices} from '@playwright/test';

export default defineConfig({
  testDir:'./e2e',
  testMatch:'deployed-site.spec.mjs',
  fullyParallel:false,
  workers:1,
  retries:0,
  timeout:180000,
  expect:{timeout:25000},
  reporter:[['list'],['junit',{outputFile:'test-results/deployed-site.xml'}]],
  use:{
    ...devices['Desktop Chrome'],
    headless:true,
    baseURL:'https://michaelwave369.github.io/SuperPhiVessel/vessie/',
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    ignoreHTTPSErrors:false
  }
});
