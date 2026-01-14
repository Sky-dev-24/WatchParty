/**
 * Global Setup for E2E Tests
 *
 * Runs once before all tests to verify environment and prepare test data.
 */

import { request, type FullConfig } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://simulive.cloudysky.xyz';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SKIP_ADMIN_PASSWORD_CHECK =
  process.env.SKIP_ADMIN_PASSWORD_CHECK === 'true' ||
  process.env.SKIP_ADMIN_PASSWORD_CHECK === '1';

async function globalSetup(config: FullConfig): Promise<void> {
  console.log('\n========================================');
  console.log('E2E Test Suite - Global Setup');
  console.log('========================================\n');

  // Verify environment variables
  console.log('Environment Configuration:');
  console.log(`  BASE_URL: ${BASE_URL}`);
  console.log(
    `  ADMIN_PASSWORD: ${ADMIN_PASSWORD ? '***SET***' : 'NOT SET'}`
  );
  console.log(
    `  SKIP_ADMIN_PASSWORD_CHECK: ${SKIP_ADMIN_PASSWORD_CHECK ? 'true' : 'false'}`
  );
  console.log('');

  if (!SKIP_ADMIN_PASSWORD_CHECK && !ADMIN_PASSWORD) {
    console.error('ADMIN_PASSWORD is required for this test suite.');
    console.error('Set ADMIN_PASSWORD in e2e/.env or environment variables.');
    throw new Error('Missing ADMIN_PASSWORD');
  }

  // Wait for server to be ready
  console.log('Checking server availability...');

  const apiContext = await request.newContext({ baseURL: BASE_URL });

  let attempts = 0;
  const maxAttempts = 30;

  while (attempts < maxAttempts) {
    try {
      const response = await apiContext.get('/api/health', { timeout: 5000 });

      if (response.ok()) {
        const health = await response.json();
        const isCheckPass = (check: unknown) => {
          if (typeof check === 'boolean') return check;
          if (!check || typeof check !== 'object') return false;
          const status = (check as { status?: string }).status;
          return status === 'pass' || status === 'skip';
        };
        console.log('Server is healthy:');
        console.log(`  Database: ${isCheckPass(health.checks?.database) ? 'OK' : 'FAIL'}`);
        console.log(`  Redis: ${isCheckPass(health.checks?.redis) ? 'OK' : 'FAIL'}`);
        console.log(
          `  Mux Credentials: ${isCheckPass(health.checks?.mux_credentials) ? 'OK' : 'FAIL'}`
        );

        if (health.status !== 'healthy') {
          console.warn('\nWarning: Some services are not healthy. Tests may fail.');
        }

        break;
      }
    } catch (error) {
      // Server not ready yet
    }

    attempts++;
    if (attempts < maxAttempts) {
      console.log(`Waiting for server... (attempt ${attempts}/${maxAttempts})`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  if (attempts >= maxAttempts) {
    console.error('\nError: Server did not become available.');
    console.error('Make sure the server is running: npm run dev');
    throw new Error('Server not available');
  }

  if (!SKIP_ADMIN_PASSWORD_CHECK && ADMIN_PASSWORD) {
    console.log('Verifying admin login...');
    const loginResponse = await apiContext.post('/api/admin/login', {
      data: { password: ADMIN_PASSWORD },
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
    });

    if (!loginResponse.ok()) {
      let message = `Admin login failed with status ${loginResponse.status()}`;
      try {
        const body = await loginResponse.json();
        if (body?.error) {
          message += `: ${body.error}`;
        }
      } catch (error) {
        // Ignore JSON parse errors for error reporting.
      }
      throw new Error(message);
    }
  }

  await apiContext.dispose();

  console.log('\n========================================');
  console.log('Setup complete. Running tests...');
  console.log('========================================\n');
}

export default globalSetup;
