import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  getTaskWithItems,
  updateTask,
  updateChecklistItem,
  deleteTask,
} from '../database/db';
import { cancelTaskNotifications } from '../utils/notificationScheduler';

export default function TaskDetailScreen({ route, navigation }) {
  const { taskId } = route.params;
  const [task, setTask] = useState(null);

  const loadTask = async () => {
    try {
      const taskData = await getTaskWithItems(taskId);
      if (taskData) {
        setTask(taskData);
      } else {
        Alert.alert('Error', 'Task not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading task:', error);
      Alert.alert('Error', 'Failed to load task');
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadTask();
    }, [taskId])
  );

  const handleToggleItem = async (item) => {
    try {
      await updateChecklistItem(item.id, { done: !item.done });
      await loadTask();
    } catch (error) {
      console.error('Error toggling item:', error);
      Alert.alert('Error', 'Failed to update item');
    }
  };

  const handleMarkAllDone = async () => {
    Alert.alert(
      'Mark All Done',
      'Mark all checklist items as done?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Done',
          onPress: async () => {
            try {
              if (task.items && task.items.length > 0) {
                for (const item of task.items) {
                  if (!item.done) {
                    await updateChecklistItem(item.id, { done: true });
                  }
                }
              }
              await updateTask(taskId, { status: 'done' });
              await cancelTaskNotifications(taskId);
              navigation.goBack();
            } catch (error) {
              console.error('Error marking all done:', error);
              Alert.alert('Error', 'Failed to mark task as done');
            }
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this task? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelTaskNotifications(taskId);
              await deleteTask(taskId);
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting task:', error);
              Alert.alert('Error', 'Failed to delete task');
            }
          },
        },
      ]
    );
  };

  const formatDeadline = (deadline) => {
    if (!deadline) return 'No deadline';
    const date = new Date(deadline);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (!task) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{task.title}</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('AddEditTask', { taskId: task.id })}
          >
            <Ionicons name="pencil" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="pricetag-outline" size={18} color="#666" />
          <Text style={styles.infoText}>{task.type}</Text>
        </View>

        {task.type === 'deadline' && task.default_deadline && (
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={18} color="#666" />
            <Text style={styles.infoText}>{formatDeadline(task.default_deadline)}</Text>
          </View>
        )}

        {task.type === 'recurring' && (
          <View style={styles.infoRow}>
            <Ionicons name="repeat-outline" size={18} color="#666" />
            <Text style={styles.infoText}>
              {task.recurrence_freq} at {task.recurrence_time}
              {task.recurrence_freq === 'weekly' && task.recurrence_days && (
                <Text> on {task.recurrence_days.join(', ')}</Text>
              )}
            </Text>
          </View>
        )}

        <View style={styles.infoRow}>
          <Ionicons name="flag-outline" size={18} color="#666" />
          <Text style={styles.infoText}>Status: {task.status}</Text>
        </View>

        {task.assigned_to && (
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={18} color="#666" />
            <Text style={styles.infoText}>
              Assigned to: {task.assigned_to_display_name || task.assigned_to_username || '—'}
            </Text>
          </View>
        )}
      </View>

      {task.items && task.items.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Checklist</Text>
          {task.items.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.checklistItem}
              onPress={() => handleToggleItem(item)}
            >
              <Ionicons
                name={item.done ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={item.done ? '#34C759' : '#666'}
              />
              <View style={styles.itemContent}>
                <Text style={[styles.itemText, item.done && styles.itemTextDone]}>
                  {item.text}
                </Text>
                {item.deadline && (
                  <Text style={styles.itemDeadline}>
                    <Ionicons name="alarm-outline" size={12} color="#666" />{' '}
                    {formatDeadline(item.deadline)}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        {task.status === 'pending' && (
          <TouchableOpacity style={styles.actionButton} onPress={handleMarkAllDone}>
            <Ionicons name="checkmark-done" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Mark All Done</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={handleDelete}
        >
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>Delete Task</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  editButton: {
    padding: 5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  infoText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 10,
    textTransform: 'capitalize',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 20,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemContent: {
    flex: 1,
    marginLeft: 12,
  },
  itemText: {
    fontSize: 16,
    color: '#000',
  },
  itemTextDone: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  itemDeadline: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  actions: {
    padding: 20,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

// Made with Bob
