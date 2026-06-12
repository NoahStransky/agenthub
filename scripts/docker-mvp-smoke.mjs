const controlPlaneUrl = (process.env.AGENTHUB_CP_URL || 'http://localhost:3000').replace(/\/$/, '');
const password = process.env.AGENTHUB_SMOKE_PASSWORD || 'AgentHub123!';
const email = `smoke-${Date.now()}@agenthub.test`;

let token;
let instanceId;

async function main() {
  await step('health', async () => {
    await request('/auth/me', { expected: [401, 403] });
  });

  await step('register', async () => {
    await request('/auth/register', {
      method: 'POST',
      body: {
        email,
        password,
        name: 'Smoke Test',
      },
    });
  });

  await step('login', async () => {
    const result = await request('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    token = result.access_token;
    assert(token, 'login did not return access_token');
  });

  await step('create Hermes instance', async () => {
    const instance = await request('/instances', {
      method: 'POST',
      token,
      body: {
        name: 'Smoke Hermes',
        runtimeType: 'docker',
        runtimeClass: 'runc',
      },
    });
    instanceId = instance.id;
    assert(instanceId, 'instance create did not return id');
  });

  await step('wait for running Hermes', async () => {
    await waitFor(async () => {
      const status = await request(`/instances/${instanceId}/status`, { token });
      return status.observedStatus === 'running' && status.health === 'healthy';
    }, 60_000, 'Hermes did not become running/healthy');
  });

  await step('open Hermes through AgentHub proxy', async () => {
    const response = await rawRequest(`/instances/${instanceId}/proxy/`, { token });
    const body = await response.text();
    assert(response.ok, `proxy returned HTTP ${response.status}: ${body.slice(0, 200)}`);
    assert(body.includes('Hermes MVP'), 'proxy did not return Hermes MVP page');
  });

  await step('stop Hermes instance', async () => {
    const stopped = await request(`/instances/${instanceId}/stop`, { method: 'POST', token });
    assert(['stopped', 'pending'].includes(stopped.observedStatus), `unexpected stop status ${stopped.observedStatus}`);
  });

  await step('delete Hermes instance', async () => {
    const deleted = await request(`/instances/${instanceId}`, { method: 'DELETE', token });
    assert(deleted.observedStatus === 'deleted', `unexpected delete status ${deleted.observedStatus}`);
    instanceId = undefined;
  });

  console.log(`Smoke test passed for ${email}`);
}

async function step(name, fn) {
  process.stdout.write(`- ${name}... `);
  await fn();
  console.log('ok');
}

async function request(path, options = {}) {
  const response = await rawRequest(path, options);
  const text = await response.text();
  const expected = options.expected || [200, 201];
  if (!expected.includes(response.status)) {
    throw new Error(`${path} returned HTTP ${response.status}: ${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : undefined;
}

async function rawRequest(path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  return fetch(`${controlPlaneUrl}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

async function waitFor(fn, timeoutMs, message) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      if (await fn()) {
        return;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(lastError ? `${message}: ${lastError.message}` : message);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch(async (error) => {
  console.error(error);
  if (token && instanceId) {
    await rawRequest(`/instances/${instanceId}`, { method: 'DELETE', token }).catch(() => undefined);
  }
  process.exitCode = 1;
});
