import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Each test file gets its own VM context — required for mongodb-memory-server
    // because it mutates mongoose.connection state globally.
    isolate: true,
    // Tests run sequentially within a file to avoid race conditions on shared
    // in-memory MongoDB state between beforeEach/afterAll hooks.
    // pool + forks settings are top-level in Vitest 4+
    singleThread: false,
    // Give each test generous time — mongodb-memory-server binary download
    // can take several minutes on first run; subsequent runs use the cache.
    testTimeout: 120000,
    hookTimeout: 120000,
    globals: true, // expose describe/it/expect/vi etc globally (like Jest)
    environment: "node",
  },
});
