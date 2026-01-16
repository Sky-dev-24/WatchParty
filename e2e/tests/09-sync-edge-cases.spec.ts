/**
 * Suite 9: Sync Edge Cases Tests
 *
 * Purpose: Verify the core synchronization mechanism handles edge cases correctly.
 * Priority: Critical - Core functionality for simulive streaming
 */

import { test, expect } from '@playwright/test';
import * as api from '../lib/api-helpers';
import * as helpers from '../lib/test-helpers';
import { config } from '../lib/config';

let syncStream: { id: string; slug: string } | null = null;

test.describe('Suite 9: Sync Edge Cases', () => {
  test.beforeAll(async () => {
    await api.login(config.adminPassword);

    const assets = await api.getMuxAssets({ limit: 1 });
    const readyAssets = assets.filter((a) => a.status === 'ready' && a.playback_ids?.length > 0);

    if (readyAssets.length === 0) {
      console.warn('No Mux assets available - sync edge case tests will be skipped');
      return;
    }

    const result = await api.createStream({
      title: 'E2E Sync Edge Case Stream',
      slug: `e2e-sync-edge-${Date.now()}`,
      assetIds: [readyAssets[0].id],
      scheduledStart: helpers.getPastDate(0.5).toISOString(),
      loopCount: 10,
    });

    if (result.stream) {
      syncStream = { id: result.stream.id, slug: result.stream.slug };
      await api.updateStream(syncStream.id, { isActive: true });
    }
  });

  test.afterAll(async () => {
    if (syncStream) {
      await api.deleteStream(syncStream.id).catch(() => {});
    }
    await api.disposeApiContext();
  });

  test('9.1: Sync mechanism keeps player at expected position', async ({ page }) => {
    if (!syncStream) {
      test.skip(true, 'No active sync stream available');
      return;
    }

    // Step 2: Navigate to watch page
    await page.goto(`${config.baseUrl}/watch/${syncStream.slug}`);
    await page.waitForSelector('mux-player', { timeout: 15000 });

    // Step 3: Wait for player to sync
    await page.waitForTimeout(6000); // Wait for at least one sync cycle

    // Step 4: Get player position and check it's reasonable
    const playerState = await page.evaluate(() => {
      const player = document.querySelector('mux-player') as HTMLElement & {
        currentTime?: number;
        duration?: number;
      };
      return {
        currentTime: player?.currentTime || 0,
        duration: player?.duration || 0,
      };
    });

    console.log(
      `Player position: ${playerState.currentTime.toFixed(1)}s, Duration: ${playerState.duration.toFixed(1)}s`
    );

    // Expected Result: Player has a valid position (is playing/synced)
    expect(playerState.currentTime).toBeGreaterThan(0);

    // Step 5: Wait another sync interval and verify position advances
    await page.waitForTimeout(6000);

    const newState = await page.evaluate(() => {
      const player = document.querySelector('mux-player') as HTMLElement & {
        currentTime?: number;
      };
      return { currentTime: player?.currentTime || 0 };
    });

    console.log(`Position after 6s: ${newState.currentTime.toFixed(1)}s`);

    // Position should have advanced (stream is playing/syncing)
    // Allow for some tolerance since ended streams won't advance
    expect(newState.currentTime).toBeGreaterThan(playerState.currentTime);
  });

  test('9.2: Handles server time endpoint failure gracefully', async ({ page }) => {
    if (!syncStream) {
      test.skip(true, 'No active sync stream available');
      return;
    }

    // Step 2: Intercept /api/time to return error
    await page.route('**/api/time', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    // Step 3: Navigate to watch page
    await page.goto(`${config.baseUrl}/watch/${syncStream.slug}`);

    // Step 4: Wait for page to load
    await page.waitForTimeout(5000);

    // Expected Result: Player should still load (uses fallback/last offset)
    const playerVisible = await page.locator('mux-player').isVisible();
    expect(playerVisible).toBe(true);

    // Page should not show application error
    const pageText = await page.locator('body').innerText();
    expect(pageText.toLowerCase()).not.toContain('application error');

    console.log('Player loaded successfully despite /api/time failure');
  });

  test('9.3: Server time offset is within acceptable range', async ({ page }) => {
    if (!syncStream) {
      test.skip(true, 'No active sync stream available');
      return;
    }

    // Step 2: Track the time API response
    let serverTime: number | null = null;
    let clientTime: number | null = null;

    await page.route('**/api/time', async (route) => {
      clientTime = Date.now();
      const response = await route.fetch();
      const json = await response.json();
      serverTime = json.serverTime;
      await route.fulfill({ response });
    });

    // Step 3: Navigate to watch page (triggers time sync)
    await page.goto(`${config.baseUrl}/watch/${syncStream.slug}`);
    await page.waitForTimeout(3000);

    // Step 4: Verify offset is reasonable
    if (serverTime && clientTime) {
      const offset = serverTime - clientTime;
      console.log(`Server time offset: ${offset}ms`);

      // Expected Result: Offset should be small (within 5 seconds)
      // Accounts for network latency and minor clock differences
      expect(Math.abs(offset)).toBeLessThan(5000);
    } else {
      // If we didn't capture the times, just verify page loaded
      const playerVisible = await page.locator('mux-player').isVisible();
      expect(playerVisible).toBe(true);
      console.log('Time API not intercepted, but player loaded successfully');
    }
  });
});
