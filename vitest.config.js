export default {
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'tests/',
        'dist/',
        'eslint.config.js',
        'vitest.config.js',
        'vite.config.js',
        'src/preload/**',
        'src/renderer/**',
        'src/main/ipc-handlers.js',
        'public/**'
      ]
    }
  }
};
