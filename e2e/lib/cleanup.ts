import { request } from '@playwright/test';

type StreamSummary = {
  id: string;
  slug?: string | null;
  title?: string | null;
};

export type CleanupResult = {
  deletedCount: number;
  skipped: boolean;
  reason?: string;
};

type CleanupOptions = {
  baseUrl: string;
  adminPassword?: string;
  verbose?: boolean;
};

function shouldDeleteStream(stream: StreamSummary): boolean {
  const title = stream.title ?? '';
  const slug = stream.slug ?? '';
  return (
    title.includes('E2E') ||
    slug.includes('e2e-') ||
    title.includes('Test')
  );
}

export async function cleanupTestStreams({
  baseUrl,
  adminPassword,
  verbose = false,
}: CleanupOptions): Promise<CleanupResult> {
  const apiContext = await request.newContext({ baseURL: baseUrl });

  try {
    if (!adminPassword) {
      return { deletedCount: 0, skipped: true, reason: 'ADMIN_PASSWORD not set' };
    }

    const loginResponse = await apiContext.post('/api/admin/login', {
      data: { password: adminPassword },
      headers: { 'Content-Type': 'application/json' },
    });

    if (!loginResponse.ok()) {
      const status = loginResponse.status();
      const reason =
        status === 429
          ? 'Rate limited'
          : `Login failed with status ${status}`;
      return { deletedCount: 0, skipped: true, reason };
    }

    const cookies = loginResponse.headers()['set-cookie'];
    const streamsResponse = await apiContext.get('/api/streams');
    if (!streamsResponse.ok()) {
      return {
        deletedCount: 0,
        skipped: true,
        reason: `Failed to list streams (status ${streamsResponse.status()})`,
      };
    }

    const payload: unknown = await streamsResponse.json();
    const streams = Array.isArray(payload) ? (payload as StreamSummary[]) : [];

    let deletedCount = 0;
    for (const stream of streams) {
      if (!shouldDeleteStream(stream)) continue;

      try {
        await apiContext.delete(`/api/streams/${stream.id}`, {
          headers: cookies ? { Cookie: cookies } : {},
        });
        deletedCount++;
        if (verbose && stream.slug) {
          console.log(`  Deleted test stream: ${stream.slug}`);
        }
      } catch (error) {
        if (verbose && stream.slug) {
          console.log(`  Failed to delete: ${stream.slug}`);
        }
      }
    }

    return { deletedCount, skipped: false };
  } catch (error) {
    return {
      deletedCount: 0,
      skipped: true,
      reason: 'Cleanup skipped (server may not be available)',
    };
  } finally {
    await apiContext.dispose();
  }
}
