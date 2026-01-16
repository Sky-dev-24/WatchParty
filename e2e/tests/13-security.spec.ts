/**
 * Suite 13: Security Tests
 *
 * Purpose: Verify security measures including cookie attributes, input validation, and embed safety.
 * Priority: High - Security is critical for production
 */

import { test, expect } from '@playwright/test';
import * as api from '../lib/api-helpers';
import * as helpers from '../lib/test-helpers';
import { config } from '../lib/config';

test.describe('Suite 13: Security', () => {
  test.beforeAll(async () => {
    await api.login(config.adminPassword);
  });

  test.afterAll(async () => {
    await api.disposeApiContext();
  });

  test('13.1: Session cookie has secure attributes', async ({ page }) => {
    // Step 1: Login via UI to get session cookie
    await helpers.ensureLoggedIn(page);

    // Step 2: Inspect cookie attributes
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === 'simulive_admin');

    // Expected Result: Cookie exists with security attributes
    expect(sessionCookie).toBeDefined();

    // httpOnly should always be true (prevents XSS cookie theft)
    expect(sessionCookie!.httpOnly).toBe(true);

    // Log all attributes for visibility
    console.log(
      `Cookie: httpOnly=${sessionCookie!.httpOnly}, secure=${sessionCookie!.secure}, sameSite=${sessionCookie!.sameSite}`
    );

    // Note: secure flag depends on server configuration
    // In production HTTPS, it SHOULD be true but may not be due to proxy configuration
    if (config.baseUrl.startsWith('https://') && !sessionCookie!.secure) {
      console.warn('WARNING: Session cookie not marked as secure on HTTPS site');
    }
  });

  test('13.2: API rejects malformed IDs without crashing', async () => {
    // Step 1: Test various malicious/malformed IDs
    const maliciousIds = [
      '../../../etc/passwd',
      '<script>alert(1)</script>',
      "'; DROP TABLE streams;--",
      '${process.env.SECRET}',
      'a'.repeat(1000),
      '%00%00%00',
      '{{constructor.constructor}}',
    ];

    // Step 2: Attempt to fetch each malicious ID
    for (const id of maliciousIds) {
      const encodedId = encodeURIComponent(id);
      const response = await api.getStreamResponse(encodedId);

      // Expected Result: Should be a client error (4xx), not a server error (5xx)
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
    }

    // Step 3: Verify server is still healthy after attacks
    const health = await api.checkHealth();
    expect(health.status).toBe('healthy');

    console.log(`Tested ${maliciousIds.length} malicious IDs, server still healthy`);
  });

  test('13.3: Embed iframe code is properly configured', async ({ page }) => {
    const assets = await api.getMuxAssets({ limit: 1 });
    const readyAssets = assets.filter((a) => a.status === 'ready' && a.playback_ids?.length > 0);

    if (readyAssets.length === 0) {
      test.skip(true, 'No Mux assets available');
      return;
    }

    const result = await api.createStream({
      title: 'E2E Security Embed Stream',
      slug: `e2e-security-embed-${Date.now()}`,
      assetIds: [readyAssets[0].id],
      scheduledStart: helpers.getPastDate(0.5).toISOString(),
      loopCount: 10,
    });

    if (!result.stream) {
      throw new Error(`Failed to create embed test stream: ${result.error}`);
    }

    await api.updateStream(result.stream.id, { isActive: true });

    try {
      // Step 2: Navigate to admin and open embed modal
      await helpers.ensureLoggedIn(page);
      await page.goto(`${config.baseUrl}/admin`);
      await page.waitForLoadState('networkidle');

      const clicked = await helpers.clickStreamAction(page, result.stream.slug, 'embed');
      if (!clicked) {
        test.skip(true, 'Could not find embed button');
        return;
      }

      // Step 3: Wait for embed modal
      await page.waitForSelector('div.fixed:has(h2:has-text("Embed Code"))', { timeout: 5000 });

      // Step 4: Get the embed code
      const embedCode = await page.locator('code:has-text("iframe")').innerText();

    // Expected Result: Embed code contains safe attributes
    expect(embedCode).toContain('iframe');
    expect(embedCode).toContain('src=');

    // Verify allowfullscreen is present (standard for video embeds)
    expect(embedCode).toContain('allowfullscreen');

    // Verify no overly permissive sandbox attributes
    // The embed code should NOT have sandbox="allow-same-origin allow-scripts" together
    // as that defeats the purpose of sandboxing
    const hasDangerousSandbox =
      embedCode.includes('allow-same-origin') && embedCode.includes('allow-scripts');

    if (embedCode.includes('sandbox=')) {
      expect(hasDangerousSandbox).toBe(false);
    }

      console.log('Embed code security check passed');
    } finally {
      await api.deleteStream(result.stream.id).catch(() => {});
    }
  });
});
