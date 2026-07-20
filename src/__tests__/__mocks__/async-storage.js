// In-memory mock for @react-native-async-storage/async-storage
const store = {};

module.exports = {
  getItem: jest.fn(async (key) => store[key] ?? null),
  setItem: jest.fn(async (key, value) => { store[key] = String(value); }),
  removeItem: jest.fn(async (key) => { delete store[key]; }),
  clear: jest.fn(async () => { Object.keys(store).forEach(k => delete store[k]); }),
  getAllKeys: jest.fn(async () => Object.keys(store)),
};
