import { test, expect } from '@playwright/test';

test('Vessie Browser Tasks remains offline in an ordinary Chromium tab', async ({ page }) => {
  const outgoing = [];
  page.on('request', request => {
    if (request.url().includes('127.0.0.1:3697') || request.url().includes('127.0.0.1:3698')) {
      outgoing.push(request.url());
    }
  });
  await page.goto('.');
  await page.getByRole('button', { name: /BROWSER TASKS/ }).click();
  await expect(page.getByRole('heading', { name: /Browser Tasks/ })).toBeVisible();
  await page.getByRole('button', { name: 'CHECK CONNECTION' }).click();
  await expect(page.getByText('UNAVAILABLE', { exact: true })).toBeVisible();
  await page.getByLabel('PUBLIC TARGET URL').fill('https://www.nasa.gov/');
  await page.getByLabel('TASK GOAL').fill('Read the homepage');
  await page.getByLabel(/I am requesting this public research task/).check();
  await page.getByRole('button', { name: /START GOVERNED TASK/ }).click();
  await expect(page.getByRole('status')).toContainText('BROWSALLAX_DESKTOP_BRIDGE_UNAVAILABLE');
  expect(outgoing).toEqual([]);
});

test('manual start and inspection work through a synthetic trusted bridge without retries', async ({ page }) => {
  await page.addInitScript(() => {
    window.__browsallaxCalls = [];
    window.browsallaxOperator = {
      status: async () => ({ ok: true, connected: true }),
      manifest: async () => {
        window.__browsallaxCalls.push('manifest');
        return {
          schema: 'browsallax.trusted-page-bridge.manifest.v1',
          capability: 'DEDICATED_BROWSER_TASK',
          connected: true,
          authority: {
            pageCanGrantAuthority: false,
            arbitraryTabAccess: false,
            bearerTokenExposed: false
          }
        };
      },
      startTask: async spec => {
        window.__browsallaxCalls.push(['start', spec.url, spec.goal]);
        return { ok: true, task: { id: 'test-task-123', status: 'QUEUED', stepCount: 0 } };
      },
      getTask: async id => {
        window.__browsallaxCalls.push(['get', id]);
        return { ok: true, task: { id, status: 'COMPLETE', stepCount: 1 } };
      }
    };
  });
  await page.goto('.');
  await page.getByRole('button', { name: /BROWSER TASKS/ }).click();
  await page.getByRole('button', { name: 'CHECK CONNECTION' }).click();
  await expect(page.getByText('READY', { exact: true })).toBeVisible();
  await page.getByLabel(/I am requesting this public research task/).check();
  await page.getByRole('button', { name: /START GOVERNED TASK/ }).click();
  await expect(page.getByRole('status')).toContainText('SUBMITTED');
  const beforeRefresh = await page.evaluate(() => window.__browsallaxCalls);
  expect(beforeRefresh).toEqual([
    'manifest',
    ['start', 'https://www.nasa.gov/', 'Find the main research topics on this public page.']
  ]);
  await page.getByRole('button', { name: 'REFRESH TASK STATUS' }).click();
  await expect(page.getByRole('status')).toContainText('COMPLETE');
  await page.getByRole('button', { name: 'NEW REQUEST' }).click();
  await expect(page.getByLabel(/I am requesting this public research task/)).not.toBeChecked();
  const after = await page.evaluate(() => window.__browsallaxCalls);
  expect(after.filter(x => Array.isArray(x) && x[0] === 'start')).toHaveLength(1);
});

test('ambiguous response prevents automated or accidental duplicate browser work', async ({ page }) => {
  await page.addInitScript(() => {
    window.__attemptCount = 0;
    window.browsallaxOperator = {
      manifest: async () => ({
        schema: 'browsallax.trusted-page-bridge.manifest.v1',
        capability: 'DEDICATED_BROWSER_TASK',
        connected: true,
        authority: { pageCanGrantAuthority: false, arbitraryTabAccess: false, bearerTokenExposed: false }
      }),
      startTask: async () => {
        window.__attemptCount += 1;
        throw new Error('UNKNOWN_AFTER_SEND');
      }
    };
  });
  await page.goto('.');
  await page.getByRole('button', { name: /BROWSER TASKS/ }).click();
  await page.getByLabel(/I am requesting this public research task/).check();
  await page.getByRole('button', { name: /START GOVERNED TASK/ }).click();
  await expect(page.getByRole('alert')).toContainText('OUTCOME UNKNOWN');
  await expect(page.getByRole('button', { name: /START GOVERNED TASK/ })).toBeDisabled();
  expect(await page.evaluate(() => window.__attemptCount)).toBe(1);
});
