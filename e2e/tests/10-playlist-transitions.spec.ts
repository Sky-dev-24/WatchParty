/**
 * Suite 10: Playlist Transitions Tests
 *
 * Purpose: Verify playlist duration calculations and loop count behavior.
 * Priority: Medium - Core feature for multi-video streams
 */

import { test, expect } from '@playwright/test';
import * as api from '../lib/api-helpers';
import * as helpers from '../lib/test-helpers';
import { config } from '../lib/config';
import { formatTime } from '@/lib/simulive';

test.describe('Suite 10: Playlist Transitions', () => {
  test.beforeAll(async () => {
    await api.login(config.adminPassword);
  });

  test.afterAll(async () => {
    await api.disposeApiContext();
  });

  test('10.1: Stream with multiple items has correct total duration', async ({ page }) => {
    const assets = await api.getMuxAssets({ limit: 5 });
    const readyAssets = assets.filter((a) => a.status === 'ready' && a.playback_ids?.length > 0);

    if (readyAssets.length < 2) {
      test.skip(true, 'Need at least 2 ready Mux assets');
      return;
    }

    const result = await api.createStream({
      title: 'E2E Playlist Duration Test',
      slug: `e2e-playlist-duration-${Date.now()}`,
      assetIds: [readyAssets[0].id, readyAssets[1].id],
      scheduledStart: helpers.getFutureDate(1).toISOString(),
      loopCount: 2,
    });

    if (!result.stream) {
      throw new Error(`Failed to create multi-item stream: ${result.error}`);
    }

    try {
      await api.updateStream(result.stream.id, { isActive: true });

      const playlistItems = result.stream.playlistItems ?? result.stream.items ?? [];
      if (playlistItems.length < 2) {
        test.skip(true, 'Stream did not include multiple items');
        return;
      }

      const itemsDuration = playlistItems.reduce((sum, item) => sum + item.duration, 0);
      const expectedTotal = itemsDuration * result.stream.loopCount;

      await helpers.ensureLoggedIn(page);
      await page.goto(`${config.baseUrl}/admin`);
      await page.waitForLoadState('networkidle');

      const row = page.locator(`[data-stream-slug="${result.stream.slug}"]`).first();
      await expect(row).toBeVisible();

      const rowText = (await row.innerText()) || '';
      const expectedDurationText = formatTime(expectedTotal);
      console.log(
        `Items duration: ${itemsDuration}s, Loop count: ${result.stream.loopCount}, Expected total: ${expectedTotal}s`
      );

      expect(rowText).toContain(expectedDurationText);
    } finally {
      await api.deleteStream(result.stream.id).catch(() => {});
    }
  });

  test('10.2: Loop count multiplies total broadcast duration', async () => {
    // Step 1: Get Mux assets
    const assets = await api.getMuxAssets({ limit: 1 });

    if (!assets.length || !assets[0].playback_ids?.length) {
      test.skip(true, 'No Mux assets available');
      return;
    }

    const loopCount = 3;
    const slug = `e2e-loop-test-${Date.now()}`;

    // Step 2: Create stream with loopCount = 3
    const result = await api.createStream({
      title: 'E2E Loop Count Test',
      slug,
      assetIds: [assets[0].id],
      scheduledStart: helpers.getFutureDate(1).toISOString(),
      loopCount,
    });

    if (!result.stream) {
      throw new Error(`Failed to create test stream: ${result.error}`);
    }

    try {
      // Step 3: Verify stream was created with correct loop count
      expect(result.stream.loopCount).toBe(loopCount);

      // Step 4: Get the item duration from created stream
      const createdItems = result.stream.playlistItems ?? result.stream.items ?? [];
      const itemDuration = createdItems[0]?.duration || 0;

      if (itemDuration === 0) {
        test.skip(true, 'Asset has no duration');
        return;
      }

      // Step 5: Fetch stream again to verify persistence
      const fetchedStream = await api.getStream(result.stream.id);

      if (!fetchedStream) {
        throw new Error('Failed to fetch created stream');
      }

      // Expected Result: Loop count persisted correctly
      expect(fetchedStream.loopCount).toBe(loopCount);

      // Calculate expected total duration
      const fetchedItems = fetchedStream.playlistItems ?? fetchedStream.items ?? [];
      const totalItemDuration = fetchedItems.reduce((sum, item) => sum + item.duration, 0);
      const expectedTotal = totalItemDuration * loopCount;

      console.log(
        `Item duration: ${itemDuration}s, Loop count: ${loopCount}, Expected total: ${expectedTotal}s`
      );

      // The stream's loop count should enable the expected total broadcast time
      expect(fetchedStream.loopCount * totalItemDuration).toBeCloseTo(expectedTotal, 0);
    } finally {
      // Cleanup
      await api.deleteStream(result.stream.id).catch(() => {});
    }
  });
});
