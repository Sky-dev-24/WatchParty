/**
 * Global Teardown for E2E Tests
 *
 * Runs once after all tests to clean up test data.
 */

import type { FullConfig } from '@playwright/test';
import { cleanupTestStreams } from './lib/cleanup';

const BASE_URL = process.env.BASE_URL || 'https://simulive.cloudysky.xyz';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

async function globalTeardown(config: FullConfig): Promise<void> {
  console.log('\n========================================');
  console.log('E2E Test Suite - Global Teardown');
  console.log('========================================\n');

  try {
    const result = await cleanupTestStreams({
      baseUrl: BASE_URL,
      adminPassword: ADMIN_PASSWORD,
      verbose: true,
    });

    if (result.skipped) {
      const reason = result.reason ? ` (${result.reason})` : '';
      console.log(`Cleanup skipped${reason}`);
    } else if (result.deletedCount > 0) {
      console.log(`\nCleaned up ${result.deletedCount} test stream(s)`);
    } else {
      console.log('No test streams to clean up');
    }
  } catch (error) {
    console.log('Cleanup skipped (server may not be available)');
  }

  console.log('\n========================================');
  console.log('Teardown complete');
  console.log('========================================\n');
}

export default globalTeardown;
