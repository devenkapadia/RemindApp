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
import { getAllTasks, getChecklistItems, updateTask } from '../database/supabaseDb';
import { useAuth } from '../context/AuthContext';

export default function SomedayScreen({ navigation }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadTasks = async () => {
    try {
      const somedayTasks = await getAllTasks({ type: 'someday', status: 'pending', user_id: user.id });
      
      // Load checklist items for each task
      const tasksWithItems = await Promise.all(
        somedayTasks.map(async (task) => {
          const items = await getChecklistItems(task.id);
          return { ...task, items };
        })
      );
      
      setTasks(tasksWithItems);
    } catch (error) {
      console.error('Error loading someday tasks:', error);
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

  const handlePromoteToDeadline = (task) => {
    Alert.alert(
      'Set Deadline',
      'This will convert the task to a deadline task. You can set the deadline in the edit screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            navigation.navigate('AddEditTask', { taskId: task.id, promoteToDeadline: true });
          },
        },
      ]
    );
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

  const getChecklistProgress = (items) => {
    if (!items || items.length === 0) return null;
    const done = items.filter(item => item.done).length;
    return `${done}/${items.length}`;
  };

  const renderTask = (task) => (
    <TouchableOpacity
      style={styles.taskCard}
      onPress={() => navigation.navigate('TaskDetail', { taskId: task.id })}
    >
      <View style={styles.taskContent}>
        <View style={styles.taskHeader}>
          <Text style={styles.taskTitle}>{task.title}</Text>
          {task.items && task.items.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{getChecklistProgress(task.items)}</Text>
            </View>
          )}
        </View>
        <View style={styles.taskActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handlePromoteToDeadline(task)}
          >
            <Ionicons name="alarm-outline" size={16} color="#007AFF" />
            <Text style={styles.actionText}>Set Deadline</Text>
          </TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity
        style={styles.checkButton}
        onPress={() => handleMarkDone(task)}
        testID={`task-done-${task.title.toLowerCase().replace(/\s+/g, '-')}`}
        accessibilityLabel={`task-done-${task.title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <Ionicons name="checkmark-circle-outline" size={28} color="#34C759" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>
          Tasks without deadlines. Set a deadline when you're ready to work on them.
        </Text>
      </View>
      
      <FlatList
        data={tasks}
        renderItem={({ item }) => renderTask(item)}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No someday tasks</Text>
            <Text style={styles.emptySubtext}>
              Add tasks here when you want to remember them but don't have a deadline yet
            </Text>
          </View>
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
  header: {
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  listContent: {
    padding: 15,
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
    marginBottom: 8,
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
  taskActions: {
    flexDirection: 'row',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  actionText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 4,
    fontWeight: '500',
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
    fontSize: 14,
    color: '#999',
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

// Made with Bob
