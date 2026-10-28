import axios from 'axios';

import { getRequestLanguage } from '@/localization/preferences';
import { getAuthToken } from '@/storage/authToken';
import { useAuthStore, rotateSession } from '@/stores/authStore';
import { reportApiRequest } from '@/utils/reactotron';
import type { AxiosRequestConfig } from 'axios';
import type { ConsumerTokens } from '@workspace/api-client-react';

export const IDENTITY_BASE_URL = 'https://nero.tap-360.com/';
// The API base URL is fixed to this backend, so never redirect a custom backend to it.
export const HTTP_BASE_URL = 'https://nero.tap-360.com';

export const httpClient = axios.create({
  baseURL: HTTP_BASE_URL,
  timeout: 30_000,
});
// Isolated client avoids recursively intercepting the refresh request itself.
export const refreshClient = axios.create({
  baseURL: HTTP_BASE_URL,
  timeout: 30_000,
});
let rotation: Promise<void> | undefined;
const requestStartTimes = new WeakMap<object, number>();

function trackApiRequests(client: typeof httpClient): void {
  client.interceptors.request.use((config) => {
    requestStartTimes.set(config, Date.now());
    return config;
  });
  client.interceptors.response.use(
    (response) => {
      reportApiResult(response.config, response.status, undefined, {
        request: {
          data: sanitizeForLog(response.config.data),
          headers: sanitizeForLog(response.config.headers.toJSON()),
          params: sanitizeForLog(response.config.params),
        },
        response: {
          statusText: response.statusText,
          data: sanitizeForLog(response.data),
          headers: sanitizeForLog(response.headers),
        },
      });
      return response;
    },
    (error: unknown) => {
      if (axios.isAxiosError(error)) {
        reportApiResult(
          error.config,
          error.response?.status ?? null,
          error.code ??
            (error.response
              ? `HTTP ${error.response.status}`
              : 'Network request failed'),
          {
            code: error.code,
            message: error.message,
            request: {
              data: sanitizeForLog(error.config?.data),
              headers: sanitizeForLog(error.config?.headers?.toJSON?.()),
              params: sanitizeForLog(error.config?.params),
            },
            response: error.response
              ? {
                  statusText: error.response.statusText,
                  data: sanitizeForLog(error.response.data),
                  headers: sanitizeForLog(error.response.headers),
                }
              : undefined,
          },
        );
      }
      return Promise.reject(error);
    },
  );
}

function reportApiResult(
  config: AxiosRequestConfig | undefined,
  status: number | null,
  error?: string,
  diagnostics?: Record<string, unknown>,
): void {
  if (!config) return;

  const url = config.url?.split(/[?#]/, 1)[0] ?? '';
  const baseURL = config.baseURL?.replace(/\/+$/, '') ?? '';
  const endpoint = /^https?:\/\//i.test(url)
    ? url
    : `${baseURL}${url.startsWith('/') || !baseURL ? '' : '/'}${url}`;

  const details = {
    method: config.method?.toUpperCase() ?? 'UNKNOWN',
    endpoint,
    status,
    durationMs: Date.now() - (requestStartTimes.get(config) ?? Date.now()),
    ...(error ? { error } : {}),
    ...diagnostics,
  };

  if (error && typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('[API ERROR]', details);
  }
  reportApiRequest(details);
}

function sanitizeForLog(value: unknown, key = '', depth = 0): unknown {
  if (typeof FormData !== 'undefined' && value instanceof FormData)
    return '[MULTIPART DATA REDACTED]';
  if (value === null || typeof value === 'number' || typeof value === 'boolean')
    return value;
  if (typeof value === 'string') {
    if (value.length > 2_000) return `${value.slice(0, 2_000)}…`;
    if (depth < 5) {
      try {
        return sanitizeForLog(JSON.parse(value), '', depth + 1);
      } catch {
        return value;
      }
    }
    return value;
  }
  if (depth >= 5) return '[MAX DEPTH]';
  if (Array.isArray(value))
    return value.map((item) => sanitizeForLog(item, '', depth + 1));
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        sanitizeForLog(childValue, childKey, depth + 1),
      ]),
    );
  }
  return String(value);
}

trackApiRequests(httpClient);
trackApiRequests(refreshClient);

function isPublicAuth(url?: string) {
  const path = url?.split('?')[0];
  return (
    path?.startsWith('/v1/identity/consumer/auth/') ||
    path === '/v1/identity/auth/refresh'
  );
}
async function refreshSession(): Promise<void> {
  if (!rotation) {
    const previous = useAuthStore.getState().tokens;
    if (!previous) throw new Error('INVALID_SESSION');
    rotation = (async () => {
      try {
        const response = await refreshClient.post<ConsumerTokens>(
          '/v1/identity/auth/refresh',
          {
            refreshToken: previous.refreshToken,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Accept-Language': await getRequestLanguage(),
            },
          },
        );
        await rotateSession(response.data, previous.refreshToken);
      } catch (error) {
        const status = axios.isAxiosError(error)
          ? error.response?.status
          : undefined;
        // Network/5xx failures are retryable. Invalid/revoked tokens are not.
        if (
          ([400, 401, 403].includes(status ?? 0) ||
            (error instanceof Error && error.message === 'INVALID_SESSION')) &&
          useAuthStore.getState().tokens?.refreshToken === previous.refreshToken
        ) {
          await useAuthStore.getState().clearSession();
        }
        throw error;
      }
    })();
    void rotation
      .finally(() => {
        rotation = undefined;
      })
      .catch(() => undefined);
  }
  return rotation;
}

/**
 * Revokes this device's session on the server (POST /v1/identity/auth/logout). Uses the
 * interceptor-free client so a 401 never triggers a refresh that would mint a token after logout.
 */
export async function revokeSession(): Promise<void> {
  if (rotation) await rotation.catch(() => undefined);
  // An expired access token is rejected, so rotate first; the body must carry the current refresh token.
  if (useAuthStore.getState().tokens && useAuthStore.getState().expiresAt <= Date.now() + 30_000) {
    await refreshSession().catch(() => undefined);
  }
  const tokens = useAuthStore.getState().tokens;
  if (!tokens) return;
  await refreshClient.post(
    '/v1/identity/auth/logout',
    { refreshToken: tokens.refreshToken },
    {
      timeout: 10_000,
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': await getRequestLanguage(),
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    },
  );
}

httpClient.interceptors.request.use(
  async (config) => {
    if (
      typeof __DEV__ !== 'undefined' &&
      !__DEV__ &&
      IDENTITY_BASE_URL.startsWith('http:')
    ) {
      throw new Error('IDENTITY_HTTPS_REQUIRED');
    }
    const isMultipart =
      typeof FormData !== 'undefined' && config.data instanceof FormData;
    if (isMultipart) config.headers.delete('Content-Type');
    else config.headers.set('Content-Type', 'application/json');
    config.headers.set('Accept-Language', await getRequestLanguage());

    // Read on each request so a login, token update, or logout takes effect immediately.
    const publicRequest = isPublicAuth(config.url);
    if (!publicRequest && rotation) await rotation;
    let token = publicRequest ? null : await getAuthToken();
    if (
      !publicRequest &&
      token &&
      useAuthStore.getState().expiresAt <= Date.now() + 30_000
    ) {
      await refreshSession();
      token = await getAuthToken();
    }
    if (token) config.headers.set('Authorization', `Bearer ${token}`);
    else config.headers.delete('Authorization');

    return config;
  },
  (error: unknown) => Promise.reject(error),
);

httpClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (
      !axios.isAxiosError(error) ||
      error.response?.status !== 401 ||
      !error.config ||
      isPublicAuth(error.config.url)
    )
      throw error;
    const config = error.config as typeof error.config & {
      _identityRetried?: boolean;
    };
    if (config._identityRetried || !useAuthStore.getState().tokens) throw error;
    config._identityRetried = true;
    const sent = config.headers.get('Authorization');
    if (rotation) await rotation;
    const current = await getAuthToken();
    // Another concurrent request may already have rotated this token.
    if (sent === `Bearer ${current}`) await refreshSession();
    if (!useAuthStore.getState().tokens) throw error;
    return httpClient.request(config);
  },
);

export default httpClient;
