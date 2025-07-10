export default {
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.js'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts']
    }
  }
};
