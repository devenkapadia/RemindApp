// Global test setup — runs before each test file

// Required for react-test-renderer's act() to work in a non-browser environment
global.IS_REACT_ACT_ENVIRONMENT = true;

// Silence noisy logs during tests
global.console.log = jest.fn();
global.console.warn = jest.fn();

// Suppress react-test-renderer deprecation notice from @testing-library/react-native internals
const originalError = global.console.error.bind(global.console);
global.console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('react-test-renderer is deprecated')) return;
  if (typeof args[0] === 'string' && args[0].includes('not wrapped in act')) return;
  originalError(...args);
};
