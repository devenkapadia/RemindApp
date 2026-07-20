// Mock for expo-notifications
const SchedulableTriggerInputTypes = {
  DATE: 'date',
  DAILY: 'daily',
  WEEKLY: 'weekly',
};

module.exports = {
  setNotificationHandler: jest.fn(),
  setNotificationCategoryAsync: jest.fn(async () => {}),
  scheduleNotificationAsync: jest.fn(async () => 'mock-notification-id'),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  SchedulableTriggerInputTypes,
};
