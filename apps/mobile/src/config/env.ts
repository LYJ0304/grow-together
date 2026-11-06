const appEnv = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';

if (!['development', 'staging', 'production'].includes(appEnv)) {
  throw new Error(
    'EXPO_PUBLIC_APP_ENV must be development, staging, or production',
  );
}

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const apiBaseUrl = apiUrl?.replace(/\/+$/, '') || undefined;
if (!apiBaseUrl && appEnv !== 'staging') {
  throw new Error('EXPO_PUBLIC_API_URL is not configured');
}

const authBypassSetting = process.env.EXPO_PUBLIC_ENABLE_AUTH_BYPASS;

export const env = {
  appEnv,
  apiBaseUrl,
  canPreview:
    appEnv !== 'production' &&
    (authBypassSetting === undefined || authBypassSetting === 'true'),
} as const;
