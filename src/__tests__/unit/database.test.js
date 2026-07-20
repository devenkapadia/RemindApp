/**
 * Unit tests for database CRUD operations.
 * All tests run against the in-memory mock SQLite.
 */

import { mockDb } from '../__mocks__/expo-sqlite';
import {
  initDatabase,
  createUser, getUserByUsername, getUser, updateUser,
  createTask, getTask, getAllTasks, updateTask, deleteTask,
  createChecklistItem, getChecklistItems, updateChecklistItem, deleteChecklistItem,
  createTaskGroup, getUserTaskGroups, addGroupMember, getGroupMembers, removeGroupMember,
  getTaskWithItems,
} from '../../database/db';

beforeEach(async () => {
  mockDb._reset();
  jest.clearAllMocks();
  await initDatabase();
});

// ─── Users ────────────────────────────────────────────────────────────────────

describe('User CRUD', () => {
  test('createUser + getUserByUsername round-trips', async () => {
    await createUser({ username: 'eve', password: 'pass123', display_name: 'Eve' });
    const user = await getUserByUsername('eve');

    expect(user).not.toBeNull();
    expect(user.username).toBe('eve');
    expect(user.display_name).toBe('Eve');
  });

  test('getUserByUsername returns null for unknown user', async () => {
    const user = await getUserByUsername('ghost');
    expect(user).toBeNull();
  });

  test('updateUser patches display_name', async () => {
    await createUser({ username: 'frank', password: 'pass123' });
    const user = await getUserByUsername('frank');

    await updateUser(user.id, { display_name: 'Frank Updated' });
    const updated = await getUser(user.id);

    expect(updated.display_name).toBe('Frank Updated');
  });
});

// ─── Tasks ────────────────────────────────────────────────────────────────────

describe('Task CRUD', () => {
  let userId;

  beforeEach(async () => {
    await createUser({ username: 'grace', password: 'pass123' });
    const u = await getUserByUsername('grace');
    userId = u.id;
  });

  test('createTask + getTask round-trips', async () => {
    const id = await createTask({
      title: 'Buy milk',
      type: 'deadline',
      default_deadline: new Date(Date.now() + 3600000).toISOString(),
      user_id: userId,
    });

    const task = await getTask(id);
    expect(task.title).toBe('Buy milk');
    expect(task.type).toBe('deadline');
    expect(task.status).toBe('pending');
  });

  test('getAllTasks filters by user_id', async () => {
    await createTask({ title: 'T1', type: 'someday', user_id: userId });
    await createTask({ title: 'T2', type: 'someday', user_id: 999 }); // different user

    const tasks = await getAllTasks({ user_id: userId });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('T1');
  });

  test('getAllTasks filters by status', async () => {
    await createTask({ title: 'Pending', type: 'someday', user_id: userId, status: 'pending' });
    await createTask({ title: 'Done',    type: 'someday', user_id: userId, status: 'done' });

    const pending = await getAllTasks({ user_id: userId, status: 'pending' });
    expect(pending).toHaveLength(1);
    expect(pending[0].title).toBe('Pending');
  });

  test('getAllTasks personal tasks only (group_id IS NULL)', async () => {
    await createTask({ title: 'Personal', type: 'someday', user_id: userId, group_id: null });
    await createTask({ title: 'Group',    type: 'someday', user_id: userId, group_id: 1 });

    const personal = await getAllTasks({ user_id: userId, group_id: null });
    expect(personal.every(t => t.group_id === null || t.group_id === undefined)).toBe(true);
  });

  test('updateTask changes title and status', async () => {
    const id = await createTask({ title: 'Old', type: 'someday', user_id: userId });
    await updateTask(id, { title: 'New', status: 'done' });

    const task = await getTask(id);
    expect(task.title).toBe('New');
    expect(task.status).toBe('done');
  });

  test('deleteTask removes the row', async () => {
    const id = await createTask({ title: 'Delete me', type: 'someday', user_id: userId });
    await deleteTask(id);

    const task = await getTask(id);
    expect(task).toBeNull();
  });

  test('getTaskWithItems includes items array', async () => {
    const taskId = await createTask({ title: 'With items', type: 'deadline', user_id: userId });
    await createChecklistItem({ task_id: taskId, text: 'Step 1', sort_order: 0 });
    await createChecklistItem({ task_id: taskId, text: 'Step 2', sort_order: 1 });

    const task = await getTaskWithItems(taskId);
    expect(task.items).toHaveLength(2);
    expect(task.items[0].text).toBe('Step 1');
  });
});

// ─── Checklist Items ──────────────────────────────────────────────────────────

describe('Checklist Item CRUD', () => {
  let taskId;

  beforeEach(async () => {
    await createUser({ username: 'hank', password: 'pass123' });
    const u = await getUserByUsername('hank');
    taskId = await createTask({ title: 'T', type: 'someday', user_id: u.id });
  });

  test('createChecklistItem + getChecklistItems', async () => {
    await createChecklistItem({ task_id: taskId, text: 'Item A', sort_order: 0 });
    await createChecklistItem({ task_id: taskId, text: 'Item B', sort_order: 1 });

    const items = await getChecklistItems(taskId);
    expect(items).toHaveLength(2);
    expect(items[0].done).toBe(false);
  });

  test('updateChecklistItem marks done', async () => {
    const id = await createChecklistItem({ task_id: taskId, text: 'Item', sort_order: 0 });
    await updateChecklistItem(id, { done: true });

    const items = await getChecklistItems(taskId);
    expect(items[0].done).toBe(true);
  });

  test('deleteChecklistItem removes item', async () => {
    const id = await createChecklistItem({ task_id: taskId, text: 'Gone', sort_order: 0 });
    await deleteChecklistItem(id);

    const items = await getChecklistItems(taskId);
    expect(items).toHaveLength(0);
  });
});

// ─── Task Groups ──────────────────────────────────────────────────────────────

describe('Task Group operations', () => {
  let userId;

  beforeEach(async () => {
    await createUser({ username: 'iris', password: 'pass123' });
    const u = await getUserByUsername('iris');
    userId = u.id;
  });

  test('createTaskGroup auto-adds owner as member', async () => {
    const groupId = await createTaskGroup({ name: 'Team Alpha', owner_id: userId });
    const members = await getGroupMembers(groupId);

    expect(members.length).toBeGreaterThanOrEqual(1);
    expect(members.some(m => m.role === 'owner')).toBe(true);
  });

  test('getUserTaskGroups returns groups for user', async () => {
    await createTaskGroup({ name: 'G1', owner_id: userId });
    await createTaskGroup({ name: 'G2', owner_id: userId });

    const groups = await getUserTaskGroups(userId);
    expect(groups.length).toBeGreaterThanOrEqual(2);
  });

  test('addGroupMember + removeGroupMember', async () => {
    const groupId = await createTaskGroup({ name: 'G', owner_id: userId });

    await createUser({ username: 'jack', password: 'pass123' });
    const jack = await getUserByUsername('jack');

    await addGroupMember(groupId, jack.id);
    const before = await getGroupMembers(groupId);
    const hasMember = before.some(m => m.user_id === jack.id);
    expect(hasMember).toBe(true);

    await removeGroupMember(groupId, jack.id);
    const after = await getGroupMembers(groupId);
    const stillHas = after.some(m => m.user_id === jack.id);
    expect(stillHas).toBe(false);
  });
});
