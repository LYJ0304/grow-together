import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const source = (name) =>
  readFileSync(new URL('../' + name, import.meta.url), 'utf8');
assert(!source('src/lib/features/auth/session.ts').includes("'preview'"));
assert(!source('src/components/auth-screen.tsx').includes('canPreview'));
assert(!source('src/config/env.ts').includes('ENABLE_AUTH_BYPASS'));
assert(
  source('app/_layout.tsx').includes(
    "const hasAccess = status === 'authenticated'",
  ),
);
assert(!existsSync(new URL('../src/lib/diary-storage.ts', import.meta.url)));
assert(!source('src/lib/child-profile.ts').includes('AsyncStorage'));
for (const name of ['src/lib/use-records.ts', 'src/lib/use-child-profile.ts']) {
  assert(!source(name).includes("'preview'"));
  assert(!source(name).includes('readDiary'));
  assert(!source(name).includes('readChildProfile'));
}
console.log('PASS no preview state, entry, flag or local storage fallback');
