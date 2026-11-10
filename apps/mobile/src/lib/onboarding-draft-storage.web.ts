import { createDraftStore } from './onboarding-draft';
export const onboardingDrafts = createDraftStore({
  getItem: async (key) => window.sessionStorage.getItem(key),
  setItem: async (key, value) => window.sessionStorage.setItem(key, value),
  removeItem: async (key) => window.sessionStorage.removeItem(key),
});
