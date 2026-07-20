// Minimal @react-navigation mock for Jest
const React = require('react');

const useNavigation = jest.fn(() => ({
  navigate: jest.fn(),
  goBack: jest.fn(),
  replace: jest.fn(),
  push: jest.fn(),
}));

const useRoute = jest.fn(() => ({ params: {} }));

const useFocusEffect = jest.fn((cb) => {
  // Call the callback once synchronously so screens load data in tests
  const cleanup = cb();
  if (typeof cleanup === 'function') cleanup();
});

const NavigationContainer = ({ children }) => children;
const createBottomTabNavigator = () => ({
  Navigator: ({ children }) => children,
  Screen: () => null,
});
const createStackNavigator = () => ({
  Navigator: ({ children }) => children,
  Screen: () => null,
});

module.exports = {
  useNavigation,
  useRoute,
  useFocusEffect,
  NavigationContainer,
  createBottomTabNavigator,
  createStackNavigator,
};
