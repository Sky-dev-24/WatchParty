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
  playlistItems?: PlaylistItem[];
  items?: PlaylistItem[];
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
  duration?: number | null;
  playbackId?: string | null;
  playbackPolicy?: string | null;
  playback_ids?: Array<{
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
  timestamp?: string;
  createdAt?: string;
}

export type HealthCheckResult = {
  status: 'pass' | 'fail' | 'skip';
  error?: string;
};

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  checks: {
    database: boolean | HealthCheckResult;
    redis: boolean | HealthCheckResult;
    mux_credentials: boolean | HealthCheckResult;
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
