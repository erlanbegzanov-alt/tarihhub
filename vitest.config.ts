import { defineConfig } from 'vitest/config'

// Unit tests only — pure logic in `src/lib`. The Firestore rules suite
// (`firestore.rules.test.ts`, repo root) needs the emulator and runs from its
// own script (`npm run test:rules`), so it is deliberately outside this glob.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
