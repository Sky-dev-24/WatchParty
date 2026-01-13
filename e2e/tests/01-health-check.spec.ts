/**
 * Suite 1: Health Check Tests
 *
 * Purpose: Verify all backend services are operational before running other tests.
 * Priority: Critical - Stop suite if health check fails
 */

import { test, expect } from '@playwright/test';
import * as api from '../lib/api-helpers';
import type { HealthCheckResponse } from '../lib/types';

test.describe('Suite 1: Health Check', () => {
  test.afterAll(async () => {
    await api.disposeApiContext();
  });

  test('1.1: System Health Verification', async () => {
    // Step 1: Call health endpoint
    const health: HealthCheckResponse = await api.checkHealth();

    // Step 2: Verify overall status
    expect(health.status).toBe('healthy');

    // Step 3: Verify individual checks
    expect(health.checks).toBeDefined();
    expect(health.checks.database).toBe(true);
    expect(health.checks.redis).toBe(true);
    expect(health.checks.mux_credentials).toBe(true);

    // Log results for debugging
    console.log('Health Check Results:', JSON.stringify(health, null, 2));

    // Failure action: If any check fails, report which service is down
    if (health.status !== 'healthy') {
      const failedServices = Object.entries(health.checks)
        .filter(([, status]) => !status)
        .map(([service]) => service);

      throw new Error(`Health check failed. Down services: ${failedServices.join(', ')}`);
    }
  });
});
