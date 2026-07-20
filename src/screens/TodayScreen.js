import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getTodayTasks, getChecklistItems, updateTask, updateChecklistItem } from '../database/db';
import { useAuth } from '../context/AuthContext';

export default function TodayScreen({ navigation }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState({ overdue: [], dueSoon: [], dueToday: [], recurring: [] });
  const [refreshing, setRefreshing] = useState(false);

  const loadTasks = async () => {
    try {
      const todayData = await getTodayTasks(user.id);
      const now = new Date();
      const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      const categorized = {
        overdue: [],
        dueSoon: [],
        dueToday: [],
        recurring: todayData.recurring,
      };

      for (const task of todayData.deadline) {
        const items = await getChecklistItems(task.id);
        const taskWithItems = { ...task, items };
        
        const deadline = task.default_deadline ? new Date(task.default_deadline) : null;
        
        if (deadline) {
          if (deadline < now) {
            categorized.overdue.push(taskWithItems);
          } else if (deadline < twoHoursFromNow) {
            categorized.dueSoon.push(taskWithItems);
          } else {
            categorized.dueToday.push(taskWithItems);
          }
        }
      }

      setTasks(categorized);
    } catch (error) {
      console.error('Error loading today tasks:', error);
      Alert.alert('Error', 'Failed to load tasks');
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTasks();
    setRefreshing(false);
  };

  const handleMarkDone = async (task) => {
    try {
      await updateTask(task.id, { status: 'done' });
      await loadTasks();
    } catch (error) {
      console.error('Error marking task done:', error);
      Alert.alert('Error', 'Failed to mark task as done');
    }
  };

  const formatDeadline = (deadline) => {
    if (!deadline) return '';
    const date = new Date(deadline);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const getChecklistProgress = (items) => {
    if (!items || items.length === 0) return null;
    const done = items.filter(item => item.done).length;
    return `${done}/${items.length}`;
  };

  const renderTask = (task, color = '#000') => (
    <TouchableOpacity
      style={styles.taskCard}
      onPress={() => navigation.navigate('TaskDetail', { taskId: task.id })}
    >
      <View style={styles.taskContent}>
        <View style={styles.taskHeader}>
          <Text style={[styles.taskTitle, { color }]}>{task.title}</Text>
          {task.items && task.items.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{getChecklistProgress(task.items)}</Text>
            </View>
          )}
        </View>
        <View style={styles.taskFooter}>
          {task.default_deadline && (
            <Text style={[styles.deadline, { color }]}>
              <Ionicons name="time-outline" size={14} color={color} /> {formatDeadline(task.default_deadline)}
            </Text>
          )}
          {task.type === 'recurring' && (
            <Text style={styles.recurring}>
              <Ionicons name="repeat-outline" size={14} color="#666" /> {task.recurrence_freq}
            </Text>
          )}
        </View>
      </View>
      <TouchableOpacity
        style={styles.checkButton}
        onPress={() => handleMarkDone(task)}
      >
        <Ionicons name="checkmark-circle-outline" size={28} color="#34C759" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderSection = (title, data, color = '#000') => {
    if (data.length === 0) return null;
    
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
        {data.map(task => (
          <View key={task.id}>
            {renderTask(task, color)}
          </View>
        ))}
      </View>
    );
  };

  const hasAnyTasks = tasks.overdue.length > 0 || tasks.dueSoon.length > 0 || 
                      tasks.dueToday.length > 0 || tasks.recurring.length > 0;

  return (
    <View style={styles.container}>
      <FlatList
        data={[{ key: 'content' }]}
        renderItem={() => (
          <View>
            {!hasAnyTasks ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-done-circle-outline" size={64} color="#ccc" />
                <Text style={styles.emptyText}>No tasks for today!</Text>
                <Text style={styles.emptySubtext}>Tap + to add a new task</Text>
              </View>
            ) : (
              <>
                {renderSection('Overdue', tasks.overdue, '#FF3B30')}
                {renderSection('Due Soon', tasks.dueSoon, '#FF9500')}
                {renderSection('Due Today', tasks.dueToday, '#007AFF')}
                {renderSection('Recurring', tasks.recurring, '#666')}
              </>
            )}
          </View>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  taskContent: {
    flex: 1,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  badge: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  taskFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deadline: {
    fontSize: 14,
    marginRight: 10,
  },
  recurring: {
    fontSize: 14,
    color: '#666',
  },
  checkButton: {
    marginLeft: 10,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#999',
    marginTop: 10,
  },
});

// Made with Bob
