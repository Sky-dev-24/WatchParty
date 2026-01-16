/**
 * Suite 12: Real-Time Updates Tests
 *
 * Purpose: Verify SSE delivers real-time stop/resume notifications to viewers.
 * Priority: High - Critical for force-stop feature
 */

import { test, expect } from '@playwright/test';
import * as api from '../lib/api-helpers';
import * as helpers from '../lib/test-helpers';
import { config } from '../lib/config';

test.describe('Suite 12: Real-Time Updates', () => {
  test.beforeAll(async () => {
    await api.login(config.adminPassword);
  });

  test.afterAll(async () => {
    await api.disposeApiContext();
  });

  test('12.1: Stop event received by viewer in real-time', async ({ page }) => {
    // Step 1: Get Mux assets for creating test stream
    const assets = await api.getMuxAssets({ limit: 1 });

    if (!assets.length || !assets[0].playback_ids?.length) {
      test.skip(true, 'No Mux assets available');
      return;
    }

    // Step 2: Create a live test stream
    const slug = `e2e-sse-stop-${Date.now()}`;
    const result = await api.createStream({
      title: 'E2E SSE Stop Test',
      slug,
      assetIds: [assets[0].id],
      scheduledStart: helpers.getPastDate(1).toISOString(), // Started 1 hour ago
    });

    if (!result.stream) {
      throw new Error(`Failed to create test stream: ${result.error}`);
    }

    // Activate the stream
    await api.updateStream(result.stream.id, { isActive: true });

    try {
      // Step 3: Navigate to watch page
      await page.goto(`${config.baseUrl}/watch/${slug}`);
      await page.waitForSelector('mux-player', { timeout: 15000 });

      // Wait for SSE connection to establish
      await page.waitForTimeout(2000);

      // Step 4: Stop stream via API
      console.log('Stopping stream via API...');
      const stopResult = await api.stopStream(result.stream.id);
      expect(stopResult.success).toBe(true);

      // Step 5: Wait for SSE to propagate
      await page.waitForTimeout(5000);

      // Step 6: Check for stopped indicator
      const pageText = await page.locator('body').innerText();
      const showsStopped =
        pageText.toLowerCase().includes('stopped') || pageText.toLowerCase().includes('ended');

      console.log(`Shows stopped indicator: ${showsStopped}`);
      expect(showsStopped).toBe(true);
    } finally {
      // Cleanup
      await api.deleteStream(result.stream.id).catch(() => {});
    }
  });

  test('12.2: Multiple viewers receive stop event simultaneously', async ({ browser }) => {
    // Step 1: Get Mux assets
    const assets = await api.getMuxAssets({ limit: 1 });

    if (!assets.length || !assets[0].playback_ids?.length) {
      test.skip(true, 'No Mux assets available');
      return;
    }

    // Step 2: Create a live test stream
    const slug = `e2e-multi-viewer-${Date.now()}`;
    const result = await api.createStream({
      title: 'E2E Multi-Viewer Test',
      slug,
      assetIds: [assets[0].id],
      scheduledStart: helpers.getPastDate(1).toISOString(),
    });

    if (!result.stream) {
      throw new Error(`Failed to create test stream: ${result.error}`);
    }

    // Activate the stream
    await api.updateStream(result.stream.id, { isActive: true });

    // Step 3: Create 3 separate browser contexts (3 viewers)
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);

    const pages = await Promise.all(contexts.map((ctx) => ctx.newPage()));

    try {
      // Step 4: All viewers navigate to watch page
      console.log('Navigating 3 viewers to watch page...');
      await Promise.all(pages.map((p) => p.goto(`${config.baseUrl}/watch/${slug}`)));

      // Wait for all players to load
      await Promise.all(
        pages.map((p) => p.waitForSelector('mux-player', { timeout: 15000 }).catch(() => null))
      );

      // Wait for SSE connections to establish
      await Promise.all(pages.map((p) => p.waitForTimeout(2000)));

      // Step 5: Stop stream via API
      console.log('Stopping stream...');
      const stopResult = await api.stopStream(result.stream.id);
      expect(stopResult.success).toBe(true);

      // Step 6: Wait for SSE propagation
      await Promise.all(pages.map((p) => p.waitForTimeout(5000)));

      // Step 7: Check all viewers received stop notification
      const results = await Promise.all(
        pages.map(async (p) => {
          const text = await p.locator('body').innerText();
          return text.toLowerCase().includes('stopped') || text.toLowerCase().includes('ended');
        })
      );

      console.log(`Viewers received stop: ${results.map((r) => (r ? 'YES' : 'NO')).join(', ')}`);

      // Expected Result: All viewers should have received notification
      const allReceived = results.every((r) => r);
      expect(allReceived).toBe(true);
    } finally {
      // Cleanup contexts
      await Promise.all(contexts.map((ctx) => ctx.close()));
      // Cleanup stream
      await api.deleteStream(result.stream.id).catch(() => {});
    }
  });
});
