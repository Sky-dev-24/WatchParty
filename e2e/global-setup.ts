/**
 * Global Setup for E2E Tests
 *
 * Runs once before all tests to verify environment and prepare test data.
 */

import { request, type FullConfig } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://simulive.cloudysky.xyz';

async function globalSetup(config: FullConfig): Promise<void> {
  console.log('\n========================================');
  console.log('E2E Test Suite - Global Setup');
  console.log('========================================\n');

  // Verify environment variables
  console.log('Environment Configuration:');
  console.log(`  BASE_URL: ${BASE_URL}`);
  console.log(`  ADMIN_PASSWORD: ${process.env.ADMIN_PASSWORD ? '***SET***' : 'NOT SET'}`);
  console.log('');

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
        console.log('Server is healthy:');
        console.log(`  Database: ${health.checks?.database ? 'OK' : 'FAIL'}`);
        console.log(`  Redis: ${health.checks?.redis ? 'OK' : 'FAIL'}`);
        console.log(`  Mux Credentials: ${health.checks?.mux_credentials ? 'OK' : 'FAIL'}`);

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

  await apiContext.dispose();

  console.log('\n========================================');
  console.log('Setup complete. Running tests...');
  console.log('========================================\n');
}

export default globalSetup;
