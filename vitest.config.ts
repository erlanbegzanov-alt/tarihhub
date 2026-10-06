import { defineConfig } from 'vitest/config'

// Unit tests only — pure logic in `src/lib`. The Firestore rules suite
// (`firestore.rules.test.ts`, repo root) needs the emulator and runs from its
// own script (`npm run test:rules`), so it is deliberately outside this glob.
export default defineConfig({
  test: {
    // `api/` is in here as of the limiter work: the one piece of this project
    // that runs on a server had no tests at all, and the two-day outage of
    // 2026-10-01 was a single `catch` in it returning the wrong answer.
    include: ['src/**/*.test.ts', 'api/**/*.test.ts'],
    environment: 'node',
  },
})
