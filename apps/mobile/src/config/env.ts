export const env = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '') ?? '',
} as const;
