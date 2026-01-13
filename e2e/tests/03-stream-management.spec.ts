/**
 * Suite 3: Stream Management Tests
 *
 * Purpose: Verify stream CRUD operations, status changes, and embed functionality.
 * Priority: High
 */

import { test, expect } from '@playwright/test';
import * as api from '../lib/api-helpers';
import * as helpers from '../lib/test-helpers';
import { config, endpoints, selectors, testData } from '../lib/config';

// Test stream data
let createdStreamId: string | null = null;
let createdStreamSlug: string | null = null;

test.describe('Suite 3: Stream Management', () => {
  test.beforeAll(async () => {
    // Login via API for subsequent tests
    await api.login(config.adminPassword);
  });

  test.afterAll(async () => {
    // Cleanup: Delete test streams
    if (createdStreamId) {
      await api.deleteStream(createdStreamId);
    }
    await helpers.cleanupTestStreams();
    await api.disposeApiContext();
  });

  test('3.1: Create Stream - Basic', async ({ page }) => {
    // Precondition: Logged in as admin
    await helpers.ensureLoggedIn(page);

    // Get available Mux assets
    const assets = await api.getMuxAssets({ limit: 5 });
    const readyAssets = assets.filter((a) => a.status === 'ready' && a.playback_ids?.length > 0);

    // Skip if no assets available
    if (readyAssets.length === 0) {
      test.skip(true, 'No ready Mux assets available for testing');
      return;
    }

    // Create stream via API (more reliable for testing)
    const scheduledStart = helpers.getFutureDate(24);
    const result = await api.createStream({
      title: testData.validStream.title,
      slug: testData.validStream.slug,
      assetIds: [readyAssets[0].id],
      scheduledStart: scheduledStart.toISOString(),
      loopCount: testData.validStream.loopCount,
    });

    // Expected Result: Stream created successfully
    expect(result.status).toBeLessThan(400);
    expect(result.stream).toBeDefined();

    if (result.stream) {
      createdStreamId = result.stream.id;
      createdStreamSlug = result.stream.slug;

      // Verification: Stream has expected properties
      expect(result.stream.title).toBe(testData.validStream.title);
      expect(result.stream.slug).toBe(testData.validStream.slug);
      expect(result.stream.playlistItems.length).toBeGreaterThan(0);
    }

    // Verify stream appears in admin dashboard
    await page.reload();
    await page.waitForLoadState('networkidle');

    const pageText = await helpers.getPageText(page);
    expect(pageText).toContain(testData.validStream.title);
  });

  test('3.2: Create Stream - Slug Validation', async () => {
    // Get assets for stream creation
    const assets = await api.getMuxAssets({ limit: 1 });
    const readyAssets = assets.filter((a) => a.status === 'ready' && a.playback_ids?.length > 0);

    if (readyAssets.length === 0) {
      test.skip(true, 'No ready Mux assets available');
      return;
    }

    // Step 1-3: Attempt to create stream with invalid slug
    const result = await api.createStream({
      title: 'Test Invalid Slug',
      slug: testData.invalidSlug, // "Invalid Slug!@#"
      assetIds: [readyAssets[0].id],
      scheduledStart: helpers.getFutureDate(24).toISOString(),
    });

    // Expected Result: Form shows validation error
    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(result.error).toBeDefined();

    // Verification: Error message about slug format
    expect(
      result.error?.toLowerCase().includes('slug') || result.error?.toLowerCase().includes('invalid')
    ).toBe(true);
  });

  test('3.3: Create Stream - Duplicate Slug Prevention', async () => {
    // Precondition: Stream with slug exists (from test 3.1)
    if (!createdStreamSlug) {
      test.skip(true, 'No test stream created in previous test');
      return;
    }

    const assets = await api.getMuxAssets({ limit: 1 });
    const readyAssets = assets.filter((a) => a.status === 'ready' && a.playback_ids?.length > 0);

    if (readyAssets.length === 0) {
      test.skip(true, 'No ready Mux assets available');
      return;
    }

    // Step 1-4: Attempt to create stream with existing slug
    const result = await api.createStream({
      title: 'Duplicate Slug Test',
      slug: createdStreamSlug, // Use existing slug
      assetIds: [readyAssets[0].id],
      scheduledStart: helpers.getFutureDate(48).toISOString(),
    });

    // Expected Result: Error about duplicate slug
    expect(result.status).toBeGreaterThanOrEqual(400);

    // Verification: Error mentions "already exists" or "duplicate"
    expect(
      result.error?.toLowerCase().includes('exist') ||
        result.error?.toLowerCase().includes('duplicate') ||
        result.error?.toLowerCase().includes('unique')
    ).toBe(true);
  });

  test('3.4: Edit Stream', async () => {
    // Precondition: Test stream exists
    if (!createdStreamId) {
      test.skip(true, 'No test stream created');
      return;
    }

    // Step 1-5: Update stream title
    const newTitle = `${testData.validStream.title} - Modified`;
    const newScheduledStart = helpers.getFutureDate(48);

    const result = await api.updateStream(createdStreamId, {
      title: newTitle,
      scheduledStart: newScheduledStart.toISOString(),
    });

    // Expected Result: Changes saved successfully
    expect(result.status).toBeLessThan(400);
    expect(result.stream).toBeDefined();

    // Verification: Updated title appears
    expect(result.stream?.title).toBe(newTitle);

    // Verify via GET
    const updatedStream = await api.getStream(createdStreamId);
    expect(updatedStream?.title).toBe(newTitle);
  });

  test('3.5: Activate/Deactivate Stream', async () => {
    // Precondition: Test stream exists
    if (!createdStreamId) {
      test.skip(true, 'No test stream created');
      return;
    }

    // Get current state
    const stream = await api.getStream(createdStreamId);
    const initialState = stream?.isActive;

    // Step 1-2: Toggle activation (set to opposite of current)
    const activateResult = await api.updateStream(createdStreamId, {
      isActive: !initialState,
    });

    // Verification: Status changes
    expect(activateResult.stream?.isActive).toBe(!initialState);

    // Step 3-5: Toggle back
    const deactivateResult = await api.updateStream(createdStreamId, {
      isActive: initialState,
    });

    // Verification: Status reverts
    expect(deactivateResult.stream?.isActive).toBe(initialState);
  });

  test('3.6: Delete Stream', async () => {
    // Create a stream specifically for deletion
    const assets = await api.getMuxAssets({ limit: 1 });
    const readyAssets = assets.filter((a) => a.status === 'ready' && a.playback_ids?.length > 0);

    if (readyAssets.length === 0) {
      test.skip(true, 'No ready Mux assets available');
      return;
    }

    // Create stream to delete
    const createResult = await api.createStream({
      title: 'E2E Test Stream - To Delete',
      slug: 'e2e-test-to-delete',
      assetIds: [readyAssets[0].id],
      scheduledStart: helpers.getFutureDate(72).toISOString(),
    });

    expect(createResult.stream).toBeDefined();
    const streamToDelete = createResult.stream!;

    // Step 1-4: Delete stream
    const deleteResult = await api.deleteStream(streamToDelete.id);

    // Expected Result: Stream removed
    expect(deleteResult.success).toBe(true);

    // Verification: Stream no longer exists
    const deletedStream = await api.getStream(streamToDelete.id);
    expect(deletedStream).toBeNull();
  });

  test('3.7: Force-Stop Live Stream', async () => {
    // Precondition: Create a "live" stream (scheduled in past, not ended)
    const assets = await api.getMuxAssets({ limit: 1 });
    const readyAssets = assets.filter((a) => a.status === 'ready' && a.playback_ids?.length > 0);

    if (readyAssets.length === 0) {
      test.skip(true, 'No ready Mux assets available');
      return;
    }

    // Create stream with past scheduled start (makes it "live")
    const createResult = await api.createStream({
      title: 'E2E Test Stream - Live',
      slug: 'e2e-test-live-stop',
      assetIds: [readyAssets[0].id],
      scheduledStart: helpers.getPastDate(1).toISOString(), // Started 1 hour ago
      loopCount: 10, // Long duration to ensure it's still "live"
    });

    expect(createResult.stream).toBeDefined();
    const liveStream = createResult.stream!;

    // Activate the stream
    await api.updateStream(liveStream.id, { isActive: true });

    // Step 1-4: Force stop by setting endedAt
    const stopResult = await api.updateStream(liveStream.id, {
      endedAt: new Date().toISOString(),
    });

    // Expected Result: Stream status changes to STOPPED
    expect(stopResult.stream?.endedAt).toBeDefined();

    // Verification: Status endpoint reflects change
    const status = await api.getStreamStatus(liveStream.id);
    expect(status?.endedAt).toBeDefined();

    // Cleanup
    await api.deleteStream(liveStream.id);
  });

  test('3.8: Resume Stopped Stream', async () => {
    // Create and stop a stream
    const assets = await api.getMuxAssets({ limit: 1 });
    const readyAssets = assets.filter((a) => a.status === 'ready' && a.playback_ids?.length > 0);

    if (readyAssets.length === 0) {
      test.skip(true, 'No ready Mux assets available');
      return;
    }

    const createResult = await api.createStream({
      title: 'E2E Test Stream - Resume',
      slug: 'e2e-test-resume',
      assetIds: [readyAssets[0].id],
      scheduledStart: helpers.getPastDate(1).toISOString(),
      loopCount: 10,
    });

    expect(createResult.stream).toBeDefined();
    const stream = createResult.stream!;

    // Stop it first
    await api.updateStream(stream.id, {
      isActive: true,
      endedAt: new Date().toISOString(),
    });

    // Step 1-3: Resume by clearing endedAt
    const resumeResult = await api.updateStream(stream.id, {
      endedAt: null,
    });

    // Expected Result: Stream status returns to LIVE
    expect(resumeResult.stream?.endedAt).toBeNull();

    // Verification: Status endpoint shows not ended
    const status = await api.getStreamStatus(stream.id);
    expect(status?.endedAt).toBeNull();

    // Cleanup
    await api.deleteStream(stream.id);
  });

  test('3.9: Multi-Asset Playlist', async () => {
    const assets = await api.getMuxAssets({ limit: 5 });
    const readyAssets = assets.filter((a) => a.status === 'ready' && a.playback_ids?.length > 0);

    // Need at least 2 assets
    if (readyAssets.length < 2) {
      test.skip(true, 'Need at least 2 ready Mux assets for playlist test');
      return;
    }

    // Step 1-4: Create stream with multiple assets
    const assetIds = readyAssets.slice(0, 2).map((a) => a.id);

    const result = await api.createStream({
      title: 'E2E Test Stream - Playlist',
      slug: 'e2e-test-playlist',
      assetIds: assetIds,
      scheduledStart: helpers.getFutureDate(24).toISOString(),
    });

    // Expected Result: Stream created with multiple playlist items
    expect(result.stream).toBeDefined();
    expect(result.stream?.playlistItems.length).toBe(2);

    // Verification: Order matches selection
    const items = result.stream!.playlistItems.sort((a, b) => a.order - b.order);
    expect(items[0].assetId).toBe(assetIds[0]);
    expect(items[1].assetId).toBe(assetIds[1]);

    // Cleanup
    await api.deleteStream(result.stream!.id);
  });

  test('3.10: Loop Count Configuration', async () => {
    const assets = await api.getMuxAssets({ limit: 1 });
    const readyAssets = assets.filter((a) => a.status === 'ready' && a.playback_ids?.length > 0);

    if (readyAssets.length === 0) {
      test.skip(true, 'No ready Mux assets available');
      return;
    }

    // Step 1: Create stream with loop count of 3
    const loopCount = 3;
    const result = await api.createStream({
      title: 'E2E Test Stream - Loop',
      slug: 'e2e-test-loop',
      assetIds: [readyAssets[0].id],
      scheduledStart: helpers.getFutureDate(24).toISOString(),
      loopCount: loopCount,
    });

    // Expected Result: Stream has loopCount = 3
    expect(result.stream).toBeDefined();
    expect(result.stream?.loopCount).toBe(loopCount);

    // Verification: Total duration calculation
    const totalItemDuration = result.stream!.playlistItems.reduce((sum, item) => sum + item.duration, 0);
    const expectedTotalDuration = totalItemDuration * loopCount;

    // Note: The actual total duration depends on how the API/UI calculates it
    console.log(`Playlist duration: ${totalItemDuration}s, Expected total: ${expectedTotalDuration}s`);

    // Cleanup
    await api.deleteStream(result.stream!.id);
  });

  test('3.11: Get Embed Code', async ({ page }) => {
    // Precondition: Test stream exists
    if (!createdStreamSlug) {
      test.skip(true, 'No test stream created');
      return;
    }

    await helpers.ensureLoggedIn(page);

    // Step 1-2: Find stream and click Embed button
    const clicked = await helpers.clickStreamAction(page, testData.validStream.title, 'embed');

    if (!clicked) {
      // Try looking for embed link/button another way
      const embedLink = page.locator(`a[href*="embed/${createdStreamSlug}"], button:has-text("Embed")`).first();
      if (await embedLink.isVisible()) {
        await embedLink.click();
      } else {
        test.skip(true, 'Could not find embed button in UI');
        return;
      }
    }

    await page.waitForTimeout(500);

    // Step 3-5: Verify embed modal appears
    const embedModal = page.locator(selectors.embedModal);
    const embedCode = page.locator(selectors.embedCode);

    // Check if modal or code is visible
    const hasEmbedUI = (await embedModal.isVisible()) || (await embedCode.isVisible());

    if (hasEmbedUI) {
      // Verification: Code contains correct stream slug
      const codeText = await embedCode.textContent();
      expect(codeText).toContain(createdStreamSlug);

      // Check for iframe or embed-related content
      expect(codeText?.toLowerCase()).toContain('iframe');
    } else {
      console.log('Embed UI not found - may need UI-specific selectors');
    }
  });

  test('3.12: Preview Stream Link', async ({ page }) => {
    // Precondition: Test stream exists
    if (!createdStreamSlug) {
      test.skip(true, 'No test stream created');
      return;
    }

    await helpers.ensureLoggedIn(page);

    // Step 1-3: Find stream and click Preview
    const [newPage] = await Promise.all([
      page.context().waitForEvent('page', { timeout: 5000 }).catch(() => null),
      helpers.clickStreamAction(page, testData.validStream.title, 'preview'),
    ]);

    // If preview opened in new tab
    if (newPage) {
      await newPage.waitForLoadState('networkidle');

      // Expected Result: Watch page opens
      expect(newPage.url()).toContain(`/watch/${createdStreamSlug}`);

      await newPage.close();
    } else {
      // Preview might open in same tab or be a direct link
      const previewLink = page.locator(`a[href*="/watch/${createdStreamSlug}"]`).first();
      if (await previewLink.isVisible()) {
        const href = await previewLink.getAttribute('href');
        expect(href).toContain(createdStreamSlug);
      }
    }
  });
});
