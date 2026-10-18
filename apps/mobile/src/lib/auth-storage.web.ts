import type { TokenStorage } from './api/client';

const key = 'growtogether.auth.v1';
// shortcut: tab-scoped storage is accessible to page scripts; use an HttpOnly-cookie
// API contract if persistent browser sessions or stronger XSS isolation are needed.
export const tokenStorage: TokenStorage = {
  read: async () => window.sessionStorage.getItem(key),
  write: async (value) => window.sessionStorage.setItem(key, value),
  clear: async () => window.sessionStorage.removeItem(key),
};
