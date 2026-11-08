import { configDefaults, defineConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default defineConfig(async configEnv => {
  const base = await viteConfig(configEnv);
  return {
    ...base,
    test: {
      exclude: [...configDefaults.exclude, 'tests/**/*.spec.ts'],
    },
  };
});
