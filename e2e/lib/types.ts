// E2E Test Types

export interface TestResult {
  testId: string;
  testName: string;
  suite: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  error?: string;
  screenshots?: string[];
  logs?: string[];
}

export interface TestSuiteResult {
  suite: string;
  tests: TestResult[];
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}

export interface Stream {
  id: string;
  slug: string;
  title: string;
  scheduledStart: string;
  isActive: boolean;
  endedAt: string | null;
  loopCount: number;
  syncInterval: number;
  driftTolerance: number;
  playlistItems: PlaylistItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistItem {
  id: string;
  streamId: string;
  assetId: string;
  playbackId: string;
  playbackPolicy: string;
  duration: number;
  order: number;
}

export interface MuxAsset {
  id: string;
  status: string;
  duration: number;
  playback_ids: Array<{
    id: string;
    policy: string;
  }>;
}

export interface AuditLog {
  id: string;
  event: string;
  severity: string;
  ipAddress: string;
  userAgent: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  checks: {
    database: boolean;
    redis: boolean;
    mux_credentials: boolean;
  };
}

export interface StreamStatusResponse {
  endedAt: string | null;
  isActive: boolean;
}

export interface LoginResponse {
  success: boolean;
  error?: string;
}

export interface AuditLogResponse {
  logs: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

export interface TestConfig {
  baseUrl: string;
  adminPassword: string;
  timeout: number;
  retries: number;
}
