import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/data/RPGManager.ts', 'src/data/SaveManager.ts'],
            reporter: ['text', 'html'],
            thresholds: {
                lines: 80,
                functions: 80,
                statements: 80,
                branches: 75
            }
        }
    }
});
