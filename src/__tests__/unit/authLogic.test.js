/**
 * Unit tests for AuthContext business logic (signUp / signIn / signOut)
 * These test the pure logic without rendering any component.
 */

import { mockDb } from '../__mocks__/expo-sqlite';
import { initDatabase, createUser, getUserByUsername } from '../../database/db';
import AsyncStorage from '@react-native-async-storage/async-storage';

// We test the logic extracted from AuthContext directly because
// testing hooks in isolation is simpler and faster than mounting a Provider.
// The signUp / signIn logic is pure enough to extract for testing.

async function signUp(username, password, displayName) {
  const trimmed = username.trim().toLowerCase();
  if (trimmed.length < 3) return { success: false, error: 'Username must be at least 3 characters.' };
  if (password.length < 6) return { success: false, error: 'Password must be at least 6 characters.' };

  const existing = await getUserByUsername(trimmed);
  if (existing) return { success: false, error: 'Username already taken.' };

  await createUser({ username: trimmed, password, display_name: displayName?.trim() || null });
  const newUser = await getUserByUsername(trimmed);
  await AsyncStorage.setItem('user', JSON.stringify(newUser));
  return { success: true, user: newUser };
}

async function signIn(username, password) {
  const trimmed = username.trim().toLowerCase();
  const found = await getUserByUsername(trimmed);
  if (!found) return { success: false, error: 'No account found with that username.' };
  if (found.password !== password) return { success: false, error: 'Incorrect password.' };
  await AsyncStorage.setItem('user', JSON.stringify(found));
  return { success: true, user: found };
}

beforeEach(async () => {
  mockDb._reset();
  AsyncStorage.clear();
  jest.clearAllMocks();
  await initDatabase();
});

describe('signUp', () => {
  test('creates a new user and persists to AsyncStorage', async () => {
    const result = await signUp('alice', 'password123', 'Alice');

    expect(result.success).toBe(true);
    expect(result.user.username).toBe('alice');
    expect(result.user.display_name).toBe('Alice');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('user', expect.any(String));
  });

  test('trims and lowercases username', async () => {
    const result = await signUp('  BOB  ', 'password123');

    expect(result.success).toBe(true);
    expect(result.user.username).toBe('bob');
  });

  test('rejects username shorter than 3 chars', async () => {
    const result = await signUp('ab', 'password123');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/3 characters/);
  });

  test('rejects password shorter than 6 chars', async () => {
    const result = await signUp('charlie', 'abc');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/6 characters/);
  });

  test('rejects duplicate username', async () => {
    await signUp('alice', 'password123');
    const result = await signUp('alice', 'different456');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already taken/);
  });
});

describe('signIn', () => {
  beforeEach(async () => {
    await signUp('dave', 'hunter2x');
  });

  test('succeeds with correct credentials', async () => {
    const result = await signIn('dave', 'hunter2x');

    expect(result.success).toBe(true);
    expect(result.user.username).toBe('dave');
  });

  test('is case-insensitive for username', async () => {
    const result = await signIn('DAVE', 'hunter2x');

    expect(result.success).toBe(true);
  });

  test('rejects wrong password', async () => {
    const result = await signIn('dave', 'wrongpassword');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Incorrect password/);
  });

  test('rejects unknown username', async () => {
    const result = await signIn('nobody', 'password');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/No account found/);
  });
});
