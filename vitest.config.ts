import { defineConfig } from 'vitest/config';

// Void の Vite プラグインを通さず、Node で純粋なロジックだけをテストする
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
});
