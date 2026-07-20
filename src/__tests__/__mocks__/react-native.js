/**
 * react-native mock for Jest.
 *
 * We provide real React function components so react-test-renderer can render
 * them, inspect props, and trigger event handlers. Alert is a plain jest.fn()
 * object so tests can spy on it without touching native modules.
 */

const React = require('react');

// Generic passthrough host component factory
const mockComponent = (name) => {
  const Comp = ({ children, ...props }) =>
    React.createElement(name, props, children);
  Comp.displayName = name;
  return Comp;
};

const Alert = {
  alert: jest.fn(),
};

const StyleSheet = {
  create: (styles) => styles,
  flatten: (style) => (Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style ?? {}),
  hairlineWidth: 1,
  absoluteFill: {},
};

const Platform = {
  OS: 'android',
  Version: 30,
  select: (obj) => (obj.android !== undefined ? obj.android : obj.default),
  isPad: false,
  isTV: false,
};

const Dimensions = {
  get: () => ({ width: 390, height: 844, scale: 2, fontScale: 1 }),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
};

const Keyboard = {
  dismiss: jest.fn(),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
};

const Animated = {
  Value: class {
    constructor(v) { this._value = v; }
    setValue(v) { this._value = v; }
    interpolate() { return this; }
  },
  View: mockComponent('View'),
  Text: mockComponent('Text'),
  timing: () => ({ start: (cb) => cb?.({ finished: true }) }),
  spring: () => ({ start: (cb) => cb?.({ finished: true }) }),
  parallel: (arr) => ({ start: (cb) => cb?.({ finished: true }) }),
  sequence: (arr) => ({ start: (cb) => cb?.({ finished: true }) }),
};

const NativeModules = {};
const NativeEventEmitter = class {
  addListener() { return { remove: jest.fn() }; }
  removeAllListeners() {}
};

module.exports = {
  // Components
  View: mockComponent('View'),
  Text: mockComponent('Text'),
  TextInput: mockComponent('TextInput'),
  TouchableOpacity: mockComponent('TouchableOpacity'),
  TouchableHighlight: mockComponent('TouchableHighlight'),
  TouchableWithoutFeedback: mockComponent('TouchableWithoutFeedback'),
  Pressable: mockComponent('Pressable'),
  ScrollView: mockComponent('ScrollView'),
  FlatList: mockComponent('FlatList'),
  SectionList: mockComponent('SectionList'),
  Image: mockComponent('Image'),
  ImageBackground: mockComponent('ImageBackground'),
  Modal: mockComponent('Modal'),
  ActivityIndicator: mockComponent('ActivityIndicator'),
  Switch: mockComponent('Switch'),
  KeyboardAvoidingView: mockComponent('KeyboardAvoidingView'),
  SafeAreaView: mockComponent('SafeAreaView'),
  StatusBar: mockComponent('StatusBar'),
  // Utilities
  Alert,
  StyleSheet,
  Platform,
  Dimensions,
  Keyboard,
  Animated,
  NativeModules,
  NativeEventEmitter,
  // Misc
  AppRegistry: { registerComponent: jest.fn() },
  BackHandler: { addEventListener: jest.fn(() => ({ remove: jest.fn() })), removeEventListener: jest.fn() },
  Linking: { openURL: jest.fn(), addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
  PixelRatio: { get: () => 2, roundToNearestPixel: (n) => n },
  useColorScheme: jest.fn(() => 'light'),
  useWindowDimensions: jest.fn(() => ({ width: 390, height: 844, scale: 2, fontScale: 1 })),
};
