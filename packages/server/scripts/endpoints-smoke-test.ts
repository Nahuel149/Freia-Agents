import axios, { AxiosRequestConfig } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  requiresAuth?: boolean;
  body?: any;
}

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const REPORT_PATH = path.resolve(__dirname, '../../../docs/endpoints_test_report.md');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@freia.ai';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function getToken(): Promise<string | undefined> {
  try {
    const res = await axios.post(`${BASE_URL}/api/v1/auth/login`, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    return res.data?.token || res.data?.accessToken;
  } catch (err: any) {
    console.error('Login failed, protected endpoints will be skipped');
    return undefined;
  }
}

const endpoints: Endpoint[] = [
  { method: 'GET', path: '/api/v1/ping' },
  { method: 'GET', path: '/api/v1/agent-dashboard/health' },
  { method: 'GET', path: '/api/v1/user', requiresAuth: true },
  { method: 'PUT', path: '/api/v1/user', requiresAuth: true, body: {} },
  { method: 'GET', path: '/api/v1/sales', requiresAuth: true },
  { method: 'GET', path: '/api/v1/sales/stats', requiresAuth: true },
  { method: 'GET', path: '/api/v1/sales/recent', requiresAuth: true },
  // add more as needed
];

function icon(statusCode?: number): string {
  if (!statusCode) return '❌';
  if (statusCode >= 200 && statusCode < 300) return '✅';
  if (statusCode >= 400 && statusCode < 600) return '⚠️';
  return '❌';
}

async function main() {
  let token = process.argv.includes('--token') ? process.argv[process.argv.indexOf('--token') + 1] : undefined;
  if (!token) {
    token = await getToken();
  }

  const results: Record<string, { status: string; code?: number; msg: string }> = {};

  for (const ep of endpoints) {
    if (ep.requiresAuth && !token) {
      results[ep.path] = { status: '⏳', msg: 'Skipped (no token)' };
      continue;
    }

    const cfg: AxiosRequestConfig = {
      method: ep.method,
      url: `${BASE_URL}${ep.path}`,
      validateStatus: () => true,
    };
    if (ep.body) cfg.data = ep.body;
    if (token) cfg.headers = { Authorization: `Bearer ${token}` };

    try {
      const res = await axios(cfg);
      results[ep.path] = { status: icon(res.status), code: res.status, msg: (res.data && JSON.stringify(res.data).slice(0, 80)) || '' };
    } catch (e: any) {
      results[ep.path] = { status: '❌', msg: e.message };
    }
  }

  // update markdown
  const markdown = fs.readFileSync(REPORT_PATH, 'utf-8').split(/\r?\n/);
  const updated = markdown.map((line) => {
    const match = line.match(/\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|\s*`(.*?)`\s*\|/);
    if (match) {
      const method = match[1];
      const route = match[2];
      const epRes = results[route];
      if (epRes) {
        return line.replace(/\|\s*[✅⚠️❌⏳]\s*\|/, `| ${epRes.status} |`);
      }
    }
    return line;
  });

  fs.writeFileSync(REPORT_PATH, updated.join('\n'), 'utf-8');
  console.log('Report updated');
}

main();