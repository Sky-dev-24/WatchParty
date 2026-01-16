import { test, expect } from '@playwright/test';
import { cleanupTestStreams } from '../lib/cleanup';
import { config } from '../lib/config';

test('Pre-rate-limit cleanup', async () => {
  const result = await cleanupTestStreams({
    baseUrl: config.baseUrl,
    adminPassword: config.adminPassword,
  });

  expect(result.skipped, result.reason || 'Cleanup was skipped').toBe(false);
  console.log(`Pre-rate-limit cleanup removed ${result.deletedCount} stream(s)`);
});
