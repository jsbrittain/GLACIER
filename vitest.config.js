import react from '@vitejs/plugin-react';

export default {
  test: {
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts']
    },
    projects: [
      {
        test: {
          name: 'backend',
          globals: true,
          environment: 'node',
          include: ['tests/unit/**/*.test.js'],
          setupFiles: ['tests/unit/backend/setup.js']
        }
      },
      {
        plugins: [react()],
        test: {
          name: 'frontend',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['tests/setup.js'],
          include: ['tests/unit/frontend/**/*.test.{js,ts,tsx}']
        }
      }
    ]
  }
};
