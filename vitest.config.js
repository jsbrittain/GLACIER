export default {
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'tests/',
        'vitest.config.js',
        'src/preload/**',
        'src/renderer/**',
        'src/main/ipc-handlers.js'
      ]
    }
  }
};
