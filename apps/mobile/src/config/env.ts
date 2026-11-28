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

export const env = { appEnv, apiBaseUrl } as const;
