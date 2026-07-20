/**
 * Component tests for LoginScreen
 * Uses react-test-renderer directly — no @testing-library/react-native bridge needed.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { mockDb } from '../__mocks__/expo-sqlite';
import { initDatabase } from '../../database/db';
import LoginScreen from '../../screens/LoginScreen';
import { AuthProvider } from '../../context/AuthContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildTree(ui) {
  let tree;
  act(() => { tree = renderer.create(<AuthProvider>{ui}</AuthProvider>); });
  return tree;
}

/** Recursively collect all string leaf nodes from a toJSON() tree */
function collectStrings(node) {
  if (!node) return [];
  if (typeof node === 'string') return [node];
  const results = [];
  for (const child of node.children ?? []) {
    results.push(...collectStrings(child));
  }
  return results;
}

/** Depth-first find first node matching predicate */
function findNode(node, predicate) {
  if (!node || typeof node === 'string') return null;
  if (predicate(node)) return node;
  for (const child of node.children ?? []) {
    const found = findNode(child, predicate);
    if (found) return found;
  }
  return null;
}

/** Collect all nodes matching predicate */
function findAll(node, predicate) {
  const results = [];
  function walk(n) {
    if (!n || typeof n === 'string') return;
    if (predicate(n)) results.push(n);
    (n.children ?? []).forEach(walk);
  }
  walk(node);
  return results;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

// Silence react-test-renderer deprecation notice
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('react-test-renderer is deprecated')) return;
    originalConsoleError(...args);
  };
});
afterAll(() => { console.error = originalConsoleError; });

beforeEach(async () => {
  mockDb._reset();
  jest.clearAllMocks();
  await initDatabase();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LoginScreen', () => {
  test('renders with "Log In" text and no "Create Account" text', () => {
    const tree = buildTree(<LoginScreen />);
    const strings = collectStrings(tree.toJSON());

    expect(strings).toContain('Log In');
    expect(strings).not.toContain('Create Account');
  });

  test('renders "Remind" app title', () => {
    const tree = buildTree(<LoginScreen />);
    const strings = collectStrings(tree.toJSON());

    expect(strings).toContain('Remind');
  });

  test('switches to Sign Up mode after pressing Sign Up', async () => {
    const tree = buildTree(<LoginScreen />);

    // Find the Sign Up toggle button by its text child
    const json = tree.toJSON();
    const signUpBtn = findNode(json, n =>
      typeof n === 'object' &&
      n.props?.onPress &&
      collectStrings(n).includes('Sign Up') &&
      !collectStrings(n).includes('Log In')
    );

    expect(signUpBtn).not.toBeNull();

    await act(async () => { signUpBtn.props.onPress(); });

    const updated = tree.toJSON();
    const updatedStrings = collectStrings(updated);
    expect(updatedStrings).toContain('Create Account');
  });

  test('has at least two text inputs in login mode', () => {
    const tree = buildTree(<LoginScreen />);
    const json = tree.toJSON();

    // RN renders TextInput as a node with props.placeholder
    const inputs = findAll(json, n =>
      typeof n === 'object' && n.props?.placeholder !== undefined && n.props?.onChangeText !== undefined
    );

    expect(inputs.length).toBeGreaterThanOrEqual(2);

    const placeholders = inputs.map(n => n.props.placeholder ?? '');
    expect(placeholders.some(p => String(p).includes('johndoe'))).toBe(true);
    expect(placeholders.some(p => String(p).includes('••••'))).toBe(true);
  });

  test('calling onChangeText on username input updates value', async () => {
    const tree = buildTree(<LoginScreen />);

    const usernameInput = findNode(tree.toJSON(), n =>
      typeof n === 'object' &&
      n.props?.onChangeText !== undefined &&
      String(n.props?.placeholder ?? '').includes('johndoe')
    );

    expect(usernameInput).not.toBeNull();

    await act(async () => { usernameInput.props.onChangeText('alice'); });

    const updated = findNode(tree.toJSON(), n =>
      typeof n === 'object' &&
      n.props?.onChangeText !== undefined &&
      String(n.props?.placeholder ?? '').includes('johndoe')
    );
    expect(updated?.props?.value).toBe('alice');
  });

  test('submitting with empty fields calls Alert.alert', async () => {
    // Spy on Alert from the real react-native module
    const RN = require('react-native');
    const alertSpy = jest.spyOn(RN.Alert, 'alert').mockImplementation(() => {});

    const tree = buildTree(<LoginScreen />);

    // Find submit button — it carries a `disabled` prop (the toggle buttons don't)
    const json = tree.toJSON();
    const submitBtn = findNode(json, n =>
      typeof n === 'object' &&
      n.props?.onPress &&
      'disabled' in (n.props ?? {}) &&
      collectStrings(n).join('') === 'Log In'
    );

    expect(submitBtn).not.toBeNull();

    await act(async () => { submitBtn.props.onPress(); });

    expect(alertSpy).toHaveBeenCalledWith('Required', 'Please fill in all fields.');
    alertSpy.mockRestore();
  });
});
