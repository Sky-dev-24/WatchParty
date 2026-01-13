/**
 * Global Teardown for E2E Tests
 *
 * Runs once after all tests to clean up test data.
 */

import { request, type FullConfig } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://simulive.cloudysky.xyz';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-password';

async function globalTeardown(config: FullConfig): Promise<void> {
  console.log('\n========================================');
  console.log('E2E Test Suite - Global Teardown');
  console.log('========================================\n');

  const apiContext = await request.newContext({ baseURL: BASE_URL });

  try {
    // Login to clean up test data
    const loginResponse = await apiContext.post('/api/admin/login', {
      data: { password: ADMIN_PASSWORD },
      headers: { 'Content-Type': 'application/json' },
    });

    if (!loginResponse.ok()) {
      console.log('Could not authenticate for cleanup (this is OK if no test data was created)');
      await apiContext.dispose();
      return;
    }

    const cookies = loginResponse.headers()['set-cookie'];

    // Get all streams
    const streamsResponse = await apiContext.get('/api/streams');
    const streams = await streamsResponse.json();

    // Find and delete test streams
    let deletedCount = 0;

    for (const stream of streams) {
      if (
        stream.title?.includes('E2E') ||
        stream.slug?.includes('e2e-') ||
        stream.title?.includes('Test')
      ) {
        try {
          await apiContext.delete(`/api/streams/${stream.id}`, {
            headers: cookies ? { Cookie: cookies } : {},
          });
          deletedCount++;
          console.log(`  Deleted test stream: ${stream.slug}`);
        } catch (error) {
          console.log(`  Failed to delete: ${stream.slug}`);
        }
      }
    }

    if (deletedCount > 0) {
      console.log(`\nCleaned up ${deletedCount} test stream(s)`);
    } else {
      console.log('No test streams to clean up');
    }
  } catch (error) {
    console.log('Cleanup skipped (server may not be available)');
  }

  await apiContext.dispose();

  console.log('\n========================================');
  console.log('Teardown complete');
  console.log('========================================\n');
}

export default globalTeardown;
