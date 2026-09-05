import { defineConfig } from 'vitest/config'

// The Firestore rules suite only. Lives in its own config because the main
// `vitest.config.ts` scopes discovery to `src/**` — the rules test sits at the
// repo root next to `firestore.rules` and runs under the emulator via
// `npm run test:rules`, never in a plain `npm test`.
export default defineConfig({
  test: {
    include: ['firestore.rules.test.ts'],
    environment: 'node',
    // The emulator start-up plus the first-run jar download is well over the
    // default 5s per hook.
    hookTimeout: 60_000,
    testTimeout: 20_000,
  },
})
