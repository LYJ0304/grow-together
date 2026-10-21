import * as SecureStore from 'expo-secure-store';
import type { TokenStorage } from './features/auth';

const key = 'growtogether.auth.v1';
export const tokenStorage: TokenStorage = {
  read: () => SecureStore.getItemAsync(key),
  write: (value) => SecureStore.setItemAsync(key, value),
  clear: () => SecureStore.deleteItemAsync(key),
};
