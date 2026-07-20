// Mock for expo-modules-core and other Expo native packages
module.exports = {
  NativeModulesProxy: {},
  EventEmitter: class {
    addListener() { return { remove: () => {} }; }
    removeAllListeners() {}
    emit() {}
  },
  requireNativeModule: jest.fn(() => ({})),
  requireOptionalNativeModule: jest.fn(() => null),
  registerWebModule: jest.fn(m => m),
  createPermissionHook: jest.fn(() => jest.fn()),
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
  Platform: { OS: 'android', select: (obj) => obj.android ?? obj.default },
  UnavailabilityError: class extends Error {},
  CodedError: class extends Error {
    constructor(code, msg) { super(msg); this.code = code; }
  },
};
