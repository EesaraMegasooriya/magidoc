import { spawn, type ChildProcess } from 'node:child_process';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { openWorkspace, register, uniqueEmail } from './helpers';

// The agent listens on a fixed port, so these tests run one at a time.
test.describe.configure({ mode: 'serial' });

const AGENT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'magidoc-agent.mjs');
let plainApi: http.Server; // a typical local API: no CORS headers
let corsApi: http.Server; // a local API that allows any origin
let agent: ChildProcess | undefined;
const port = (s: http.Server) => (s.address() as AddressInfo).port;

function listen(handler: http.RequestListener) {
  return new Promise<http.Server>((resolve) => {
    const s = http.createServer(handler);
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
}

test.beforeAll(async () => {
  plainApi = await listen((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ hello: 'from my laptop', method: req.method, path: req.url }));
  });
  corsApi = await listen((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.writeHead(204);
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ cors: true }));
  });
});

test.afterAll(async () => {
  agent?.kill();
  plainApi?.close();
  corsApi?.close();
});

async function send(page: Page, url: string) {
  await page.getByRole('button', { name: /New request/ }).first().click();
  await page.getByLabel('Request URL').fill(url);
  await page.getByRole('button', { name: 'Send' }).click();
}

test('without the agent, a localhost API that allows CORS is called straight from the browser', async ({ page }) => {
  await register(page, 'Cora Cors', uniqueEmail('cors'));
  await openWorkspace(page);
  await send(page, `http://localhost:${port(corsApi)}/ping`);
  await expect(page.getByText('200 OK')).toBeVisible();
  await expect(page.getByText('via browser')).toBeVisible();
});

test('without the agent, a localhost API without CORS explains how to set up the agent', async ({ page, baseURL }) => {
  await register(page, 'Nora NoAgent', uniqueEmail('noagent'));
  await openWorkspace(page);
  await send(page, `http://localhost:${port(plainApi)}/hello`);
  await expect(page.getByText(/Couldn’t reach localhost:\d+/)).toBeVisible();
  await page.getByRole('button', { name: 'Set up Local Agent' }).click();
  const dialog = page.getByRole('dialog', { name: 'Send requests to localhost' });
  await expect(dialog.getByText(`node magidoc-agent.mjs --origin ${new URL(baseURL!).origin}`)).toBeVisible();
  await expect(dialog.getByRole('link', { name: /Download magidoc-agent\.mjs/ })).toHaveAttribute('href', '/magidoc-agent.mjs');
  await dialog.getByRole('button', { name: 'Check connection' }).click();
  await expect(dialog.getByRole('status')).toHaveText('Not connected');
});

test('with the agent running, localhost requests are sent from the user’s computer', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  agent = spawn(process.execPath, [AGENT, '--origin', origin], { stdio: 'ignore' });
  await expect
    .poll(async () => {
      try {
        return (await fetch('http://127.0.0.1:47321/health', { headers: { Origin: origin } })).status;
      } catch {
        return 0;
      }
    }, { timeout: 10_000 })
    .toBe(200);

  await register(page, 'Ada Agent', uniqueEmail('agent'));
  await openWorkspace(page);
  const url = `http://localhost:${port(plainApi)}/users?active=true`;
  await page.getByRole('button', { name: /New request/ }).first().click();
  await page.getByLabel('Request URL').fill(url);
  await expect(page.getByRole('button', { name: /sent from your computer/ })).toBeVisible();
  await page.getByRole('button', { name: 'Send' }).click();

  await expect(page.getByText('200 OK')).toBeVisible();
  await expect(page.getByText('via Local Agent')).toBeVisible();
  await expect(page.getByText('"from my laptop"')).toBeVisible();
  await expect(page.getByText('"/users?active=true"')).toBeVisible();

  // Recorded in history like server-sent requests
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByTitle(url)).toBeVisible();

  // Toolbar indicator reflects the live agent
  await page.getByRole('button', { name: 'Local agent connected' }).click();
  await expect(page.getByRole('dialog', { name: 'Send requests to localhost' }).getByRole('status')).toContainText('Connected');
});
