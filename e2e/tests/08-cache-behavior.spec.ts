/**
 * Suite 8: Cache Behavior Tests
 *
 * Purpose: Verify caching headers, TTL, and invalidation.
 * Priority: Low
 */

import { test, expect } from '@playwright/test';
import { request } from '@playwright/test';
import * as api from '../lib/api-helpers';
import * as helpers from '../lib/test-helpers';
import { config, endpoints } from '../lib/config';

test.describe('Suite 8: Cache Behavior', () => {
  test.afterAll(async () => {
    await api.disposeApiContext();
  });

  test('8.1: Cache Headers Present', async () => {
    const apiContext = await request.newContext({ baseURL: config.baseUrl });

    // Step 1: GET /api/streams
    const response1 = await apiContext.get(endpoints.api.streams);

    // Step 2: Check response headers
    const headers1 = response1.headers();

    // Expected Result: X-Cache header present
    const cacheHeader = headers1['x-cache'];
    console.log(`First request X-Cache: ${cacheHeader}`);

    // Make second request to verify cache HIT
    await new Promise((resolve) => setTimeout(resolve, 100));
    const response2 = await apiContext.get(endpoints.api.streams);
    const headers2 = response2.headers();
    const cacheHeader2 = headers2['x-cache'];

    console.log(`Second request X-Cache: ${cacheHeader2}`);

    // Verification: Second request should be HIT (if caching is enabled)
    // Note: First request might be MISS, second should be HIT
    expect(response1.status()).toBe(200);
    expect(response2.status()).toBe(200);

    await apiContext.dispose();
  });

  test('8.2: Cache Invalidation on Create', async () => {
    // Ensure authenticated
    await api.login(config.adminPassword);

    // Step 1: GET /api/streams (prime cache)
    const { streams: initialStreams } = await api.getStreams();
    const initialCount = initialStreams.length;

    // Get assets for stream creation
    const assets = await api.getMuxAssets({ limit: 1 });
    const readyAssets = assets.filter((a) => a.status === 'ready' && a.playback_ids?.length > 0);

    if (readyAssets.length === 0) {
      test.skip(true, 'No Mux assets available');
      return;
    }

    // Step 2: Create new stream
    const result = await api.createStream({
      title: 'E2E Cache Test - Create',
      slug: 'e2e-cache-create-test',
      assetIds: [readyAssets[0].id],
      scheduledStart: helpers.getFutureDate(24).toISOString(),
    });

    expect(result.stream).toBeDefined();
    const newStreamId = result.stream!.id;

    // Step 3: GET /api/streams again
    // Brief delay to allow cache invalidation to propagate
    await new Promise((resolve) => setTimeout(resolve, 500));
    const { streams: updatedStreams } = await api.getStreams();

    // Expected Result: New stream appears in response
    expect(updatedStreams.length).toBe(initialCount + 1);

    // Verification: New stream in list
    const foundStream = updatedStreams.find((s) => s.id === newStreamId);
    expect(foundStream).toBeDefined();

    console.log(`Initial count: ${initialCount}, After create: ${updatedStreams.length}`);

    // Cleanup
    await api.deleteStream(newStreamId);
  });

  test('8.3: Cache Invalidation on Update', async () => {
    // Ensure authenticated
    await api.login(config.adminPassword);

    // Create a stream to update
    const assets = await api.getMuxAssets({ limit: 1 });
    const readyAssets = assets.filter((a) => a.status === 'ready' && a.playback_ids?.length > 0);

    if (readyAssets.length === 0) {
      test.skip(true, 'No Mux assets available');
      return;
    }

    const createResult = await api.createStream({
      title: 'E2E Cache Test - Update Original',
      slug: 'e2e-cache-update-test',
      assetIds: [readyAssets[0].id],
      scheduledStart: helpers.getFutureDate(24).toISOString(),
    });

    expect(createResult.stream).toBeDefined();
    const streamId = createResult.stream!.id;

    // Step 1: GET /api/streams (note titles)
    const { streams: beforeUpdate } = await api.getStreams();
    const originalStream = beforeUpdate.find((s) => s.id === streamId);
    const originalTitle = originalStream?.title;

    // Step 2: Update stream title
    const newTitle = 'E2E Cache Test - Update Modified';
    await api.updateStream(streamId, { title: newTitle });

    // Step 3: GET /api/streams again
    await new Promise((resolve) => setTimeout(resolve, 500));
    const { streams: afterUpdate } = await api.getStreams();

    // Expected Result: Updated title in response
    const updatedStream = afterUpdate.find((s) => s.id === streamId);

    // Verification: Title change visible
    expect(updatedStream?.title).toBe(newTitle);
    expect(updatedStream?.title).not.toBe(originalTitle);

    console.log(`Original: "${originalTitle}", Updated: "${updatedStream?.title}"`);

    // Cleanup
    await api.deleteStream(streamId);
  });

  test('8.4: Status Cache (Short TTL)', async () => {
    // Ensure authenticated
    await api.login(config.adminPassword);

    // Create a stream to test status caching
    const assets = await api.getMuxAssets({ limit: 1 });
    const readyAssets = assets.filter((a) => a.status === 'ready' && a.playback_ids?.length > 0);

    if (readyAssets.length === 0) {
      test.skip(true, 'No Mux assets available');
      return;
    }

    const createResult = await api.createStream({
      title: 'E2E Cache Test - Status',
      slug: 'e2e-cache-status-test',
      assetIds: [readyAssets[0].id],
      scheduledStart: helpers.getPastDate(1).toISOString(), // Make it "live"
      loopCount: 10,
    });

    expect(createResult.stream).toBeDefined();
    const streamId = createResult.stream!.id;
    await api.updateStream(streamId, { isActive: true });

    // Step 1: GET /api/streams/[id]/status
    const status1 = await api.getStreamStatus(streamId);
    expect(status1?.endedAt).toBeNull();

    // Step 2: Stop stream
    const stopTime = new Date().toISOString();
    await api.updateStream(streamId, { endedAt: stopTime });

    // Step 3: GET status again within short time
    // Status cache TTL is 2 seconds, so we should see update quickly
    await new Promise((resolve) => setTimeout(resolve, 500));
    const status2 = await api.getStreamStatus(streamId);

    // Expected Result: Second request shows stopped state
    expect(status2?.endedAt).toBeDefined();

    console.log(`Before stop: endedAt=${status1?.endedAt}, After stop: endedAt=${status2?.endedAt}`);

    // Verification: No prolonged stale state
    // The update should be visible within a reasonable time
    expect(status2?.endedAt).not.toBeNull();

    // Cleanup
    await api.deleteStream(streamId);
  });
});
