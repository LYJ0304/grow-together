import * as SecureStore from 'expo-secure-store';
import { createDraftStore } from './onboarding-draft';
export const onboardingDrafts = createDraftStore({
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
});
