import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BROWSER_INTENT_VERSION,
  normalizeExplicitBrowserIntent,
  dispatchExplicitBrowserIntent,
  inspectExplicitBrowserTask,
  controlExplicitBrowserTask
} from './browser-intent.mjs';

const manifest = Object.freeze({
  schema: 'browsallax.trusted-page-bridge.manifest.v1',
  capability: 'DEDICATED_BROWSER_TASK',
  connected: true,
  authority: {
    pageCanGrantAuthority: false,
    arbitraryTabAccess: false,
    bearerTokenExposed: false
  }
});
const request = { url: 'https://example.org/', goal: 'Read the public page' };
const task = { id: 'abcdef-1234', status: 'QUEUED', stepCount: 0 };

test('normalizes an explicit URL and bounded task without assigning authority', () => {
  const spec = normalizeExplicitBrowserIntent({
    ...request,
    constraints: ['  Read only  ', false, 'x'.repeat(500)],
    maxSteps: 999,
    maxDurationMs: 99999999,
    completeOnInitialAcceptance: true
  });
  assert.equal(spec.url, 'https://example.org/');
  assert.deepEqual(spec.constraints, ['Read only', 'x'.repeat(300)]);
  assert.equal(spec.maxSteps, 40);
  assert.equal(spec.maxDurationMs, 600000);
  assert.equal(spec.completeOnInitialAcceptance, true);
  assert.equal(spec.plannerRegistry, undefined);
});

test('rejects missing goals, unsafe URLs, and URL credentials before bridge contact', async () => {
  for (const bad of [
    { url: 'file:///etc/hosts', goal: 'Read' },
    { url: 'javascript:alert(1)', goal: 'Read' },
    { url: 'https://user:pass@example.org/', goal: 'Read' },
    { url: 'not-a-url', goal: 'Read' },
    { url: 'https://example.org', goal: '' },
    { url: 'https://example.org', goal: 'X'.repeat(4001) }
  ]) {
    let touched = false;
    const result = await dispatchExplicitBrowserIntent(bad, {
      operator: {
        manifest: () => { touched = true; },
        startTask: () => { touched = true; }
      }
    });
    assert.equal(result.ok, false);
    assert.equal(result.disposition, 'HELD');
    assert.equal(result.authority, 'NONE');
    assert.equal(touched, false);
  }
});

test('explicit browser intent runs directly through Browsallax, with no provider dependency', async () => {
  const calls = [];
  const operator = {
    manifest: async () => { calls.push('manifest'); return manifest; },
    startTask: async (spec) => {
      calls.push('startTask');
      assert.deepEqual(spec.url, request.url);
      assert.deepEqual(spec.goal, request.goal);
      return { ok: true, task };
    }
  };
  const result = await dispatchExplicitBrowserIntent(request, { operator });
  assert.deepEqual(calls, ['manifest', 'startTask']);
  assert.equal(result.ok, true);
  assert.equal(result.disposition, 'SUBMITTED');
  assert.equal(result.taskId, task.id);
  assert.equal(result.task.status, 'QUEUED');
  assert.equal(result.route, 'BROWSALLAX_TRUSTED_PAGE');
  assert.equal(result.version, BROWSER_INTENT_VERSION);
  assert.equal(result.authority, 'BROWSALLAX_POLICY_ENFORCED');
});

test('absent Desktop bridge fails closed without contacting any provider', async () => {
  const result = await dispatchExplicitBrowserIntent(request, { operator: {} });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'BROWSALLAX_DESKTOP_BRIDGE_UNAVAILABLE');
  assert.equal(result.taskId, null);
});

test('offline, forged, or privileged manifests cannot dispatch work', async () => {
  for (const data of [
    { ...manifest, connected: false },
    { ...manifest, schema: 'forged.bridge.v1' },
    { ...manifest, authority: { ...manifest.authority, pageCanGrantAuthority: true } },
    { ...manifest, authority: { ...manifest.authority, arbitraryTabAccess: true } },
    { ...manifest, authority: { ...manifest.authority, bearerTokenExposed: true } }
  ]) {
    let count = 0;
    const result = await dispatchExplicitBrowserIntent(request, {
      operator: { manifest: async () => data, startTask: async () => { count += 1; } }
    });
    assert.equal(result.ok, false);
    assert.equal(count, 0);
  }
});

test('unconfirmed task creation is HELD and does not trigger a retry', async () => {
  for (const response of [
    { ok: false },
    { ok: true },
    { ok: true, task: { status: 'QUEUED' } },
    { ok: true, task: { id: 'x', status: 'INVENTED_STATE' } }
  ]) {
    let count = 0;
    const result = await dispatchExplicitBrowserIntent(request, {
      operator: {
        manifest: async () => manifest,
        startTask: async () => { count += 1; return response; }
      }
    });
    assert.equal(result.reason, 'BROWSALLAX_TASK_CREATION_UNCONFIRMED');
    assert.equal(count, 1);
  }
});

test('bridge failure after dispatch has unknown outcome and is never blindly retried', async () => {
  let count = 0;
  const result = await dispatchExplicitBrowserIntent(request, {
    operator: {
      manifest: async () => manifest,
      startTask: async () => {
        count += 1;
        throw new Error('secret_token=PRIVATE');
      }
    }
  });
  assert.equal(result.reason, 'BROWSALLAX_TASK_OUTCOME_UNKNOWN_NO_RETRY');
  assert.equal(count, 1);
  assert.doesNotMatch(JSON.stringify(result), /secret_token|PRIVATE/);
});

test('task lookup returns bounded failure diagnostics without sensitive data', async () => {
  const result = await inspectExplicitBrowserTask(task.id, {
    operator: {
      getTask: async () => ({
        ok: true,
        task: {
          id: task.id,
          status: 'FAILED',
          stepCount: 0,
          error: 'NO_LOCAL_REGISTRY_APPROVED_PLANNER_MODEL',
          failureDiagnostics: {
            provider: 'OLLAMA_LOCAL',
            model: 'qwen3:4b',
            validationError: 'REGISTRY_NO_MODEL',
            brainRegistryRoute: { selectionBasis: 'NO_LOCAL_REGISTRY_APPROVED_PLANNER_MODEL' },
            rawResponse: 'SENSITIVE_PAGE_CONTENT',
            prompt: 'DO_NOT_COPY'
          }
        }
      })
    }
  });
  assert.equal(result.ok, true);
  assert.equal(result.disposition, 'FAILED');
  assert.equal(result.task.error, 'NO_LOCAL_REGISTRY_APPROVED_PLANNER_MODEL');
  assert.equal(result.task.failureDiagnostics.selectionBasis, 'NO_LOCAL_REGISTRY_APPROVED_PLANNER_MODEL');
  assert.doesNotMatch(JSON.stringify(result), /SENSITIVE_PAGE_CONTENT|DO_NOT_COPY/);
});

test('bad task IDs and mismatched lookup identity fail closed', async () => {
  const invalid = await inspectExplicitBrowserTask('../other-task', {
    operator: { getTask: () => { throw new Error('SHOULD_NOT_CALL'); } }
  });
  assert.equal(invalid.reason, 'BROWSALLAX_TASK_ID_INVALID');
  const mismatched = await inspectExplicitBrowserTask(task.id, {
    operator: { getTask: async () => ({ ok: true, task: { ...task, id: 'wrong' } }) }
  });
  assert.equal(mismatched.reason, 'BROWSALLAX_TASK_LOOKUP_UNCONFIRMED');
});


test('human-triggered resume stays in the owned Browsallax task lane', async () => {
  let calls = 0;
  const result = await controlExplicitBrowserTask(task.id, 'RESUME', {
    operator: {
      resumeTask: async (id) => {
        calls += 1;
        assert.equal(id, task.id);
        return { ok: true, task: { ...task, status: 'RUNNING' } };
      }
    }
  });
  assert.equal(calls, 1);
  assert.equal(result.ok, true);
  assert.equal(result.disposition, 'RUNNING');
});

test('human-triggered cancel uses bounded reason and never calls resume', async () => {
  let calls = 0;
  const result = await controlExplicitBrowserTask(task.id, 'CANCEL', {
    operator: {
      resumeTask: () => { throw new Error('MUST_NOT_RESUME'); },
      cancelTask: async (id, reason) => {
        calls += 1;
        assert.equal(id, task.id);
        assert.equal(reason, 'VESSIE_EXPLICIT_CANCELLED');
        return { ok: true, task: { ...task, status: 'CANCELLED' } };
      }
    }
  });
  assert.equal(calls, 1);
  assert.equal(result.disposition, 'CANCELLED');
});

test('task control rejects invalid actions and does not automatically retry ambiguous IPC', async () => {
  let calls = 0;
  const operator = {
    resumeTask: async () => {
      calls += 1;
      throw new Error('TRANSIENT_UNKNOWN');
    }
  };
  assert.equal(
    (await controlExplicitBrowserTask(task.id, 'GRANT', { operator })).reason,
    'BROWSALLAX_CONTROL_ACTION_NOT_ALLOWED'
  );
  assert.equal(
    (await controlExplicitBrowserTask('../bad', 'RESUME', { operator })).reason,
    'BROWSALLAX_TASK_ID_INVALID'
  );
  const outcome = await controlExplicitBrowserTask(task.id, 'RESUME', { operator });
  assert.equal(outcome.reason, 'BROWSALLAX_CONTROL_OUTCOME_UNKNOWN_NO_RETRY');
  assert.equal(calls, 1);
});
