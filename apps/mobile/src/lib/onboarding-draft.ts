import { validPersonalization, type OnboardingProfile } from './onboarding';
export type OnboardingDraft = {
  profile: OnboardingProfile;
  step: number;
  mode: 'create' | 'edit';
  savedAt: number;
};
export type DraftStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
const ttl = 24 * 60 * 60 * 1000;
export function createDraftStore(storage: DraftStorage) {
  let queue = Promise.resolve();
  const owners = new Set<string>();
  const revisions = new Map<string, number>();
  const key = (owner: string) => {
    if (!owner) throw new Error('계정을 확인하지 못했어요.');
    return (
      'growtogether.onboarding.v1.' +
      Array.from(owner)
        .map((c) => c.codePointAt(0)!.toString(16))
        .join('-')
    );
  };
  const run = <T>(work: () => Promise<T>) => {
    const next = queue.catch(() => {}).then(work);
    queue = next.then(
      () => {},
      () => {},
    );
    return next;
  };
  const clear = (owner: string) => {
    revisions.set(owner, (revisions.get(owner) ?? 0) + 1);
    return run(async () => {
      await storage.removeItem(key(owner));
      owners.delete(owner);
    });
  };
  return {
    async read(
      owner: string,
      now = Date.now(),
    ): Promise<OnboardingDraft | null> {
      owners.add(owner);
      return run(async () => {
        let raw: string | null;
        try {
          raw = await storage.getItem(key(owner));
        } catch {
          throw new Error(
            '임시 입력을 읽지 못했어요. 다시 시도하거나 새로 시작해주세요.',
          );
        }
        if (!raw) return null;
        try {
          const d = JSON.parse(raw) as OnboardingDraft;
          if (
            !Number.isFinite(d.savedAt) ||
            d.savedAt > now ||
            d.savedAt <= now - ttl
          ) {
            await storage.removeItem(key(owner));
            return null;
          }
          if (
            !Number.isInteger(d.step) ||
            d.step < 0 ||
            d.step > 4 ||
            !['create', 'edit'].includes(d.mode) ||
            typeof d.profile?.name !== 'string' ||
            d.profile.name.length > 50 ||
            typeof d.profile.birthday !== 'string' ||
            d.profile.birthday.length > 10 ||
            !validPersonalization(d.profile.personalization)
          )
            throw new Error('Invalid draft');
          return d;
        } catch {
          await storage.removeItem(key(owner));
          throw new Error(
            '임시 입력을 읽지 못해 안전하게 비웠어요. 다시 입력해주세요.',
          );
        }
      });
    },
    write(owner: string, draft: OnboardingDraft) {
      owners.add(owner);
      const revision = revisions.get(owner) ?? 0;
      return run(async () => {
        if ((revisions.get(owner) ?? 0) === revision) {
          owners.add(owner);
          await storage.setItem(key(owner), JSON.stringify(draft));
        }
      });
    },
    clear,
    clearAll(owner?: string) {
      if (owner && owner !== 'preview') owners.add(owner);
      return Promise.all([...owners].map(clear));
    },
  };
}
