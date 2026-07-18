import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getAllTasks, getChecklistItems, updateTask } from '../database/db';

export default function AllTasksScreen({ navigation }) {
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, deadline, recurring, someday
  const [filterStatus, setFilterStatus] = useState('pending'); // pending, done, archived
  const [refreshing, setRefreshing] = useState(false);

  const loadTasks = async () => {
    try {
      const allTasks = await getAllTasks({ status: filterStatus });
      
      // Load checklist items for each task
      const tasksWithItems = await Promise.all(
        allTasks.map(async (task) => {
          const items = await getChecklistItems(task.id);
          return { ...task, items };
        })
      );
      
      setTasks(tasksWithItems);
      applyFilters(tasksWithItems, searchQuery, filterType);
    } catch (error) {
      console.error('Error loading tasks:', error);
      Alert.alert('Error', 'Failed to load tasks');
    }
  };

  const applyFilters = (taskList, query, type) => {
    let filtered = taskList;

    // Filter by type
    if (type !== 'all') {
      filtered = filtered.filter(task => task.type === type);
    }

    // Filter by search query
    if (query) {
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(query.toLowerCase())
      );
    }

    setFilteredTasks(filtered);
  };

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [filterStatus])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTasks();
    setRefreshing(false);
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
    applyFilters(tasks, text, filterType);
  };

  const handleFilterType = (type) => {
    setFilterType(type);
    applyFilters(tasks, searchQuery, type);
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
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getChecklistProgress = (items) => {
    if (!items || items.length === 0) return null;
    const done = items.filter(item => item.done).length;
    return `${done}/${items.length}`;
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'deadline':
        return 'alarm-outline';
      case 'recurring':
        return 'repeat-outline';
      case 'someday':
        return 'time-outline';
      default:
        return 'document-outline';
    }
  };

  const renderTask = (task) => (
    <TouchableOpacity
      style={styles.taskCard}
      onPress={() => navigation.navigate('TaskDetail', { taskId: task.id })}
    >
      <View style={styles.taskContent}>
        <View style={styles.taskHeader}>
          <Ionicons name={getTypeIcon(task.type)} size={20} color="#007AFF" />
          <Text style={styles.taskTitle}>{task.title}</Text>
          {task.items && task.items.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{getChecklistProgress(task.items)}</Text>
            </View>
          )}
        </View>
        <View style={styles.taskFooter}>
          <Text style={styles.taskType}>{task.type}</Text>
          {task.default_deadline && (
            <Text style={styles.deadline}>
              <Ionicons name="time-outline" size={14} color="#666" /> {formatDeadline(task.default_deadline)}
            </Text>
          )}
          {task.type === 'recurring' && task.recurrence_freq && (
            <Text style={styles.recurring}>
              {task.recurrence_freq} @ {task.recurrence_time}
            </Text>
          )}
        </View>
      </View>
      {filterStatus === 'pending' && (
        <TouchableOpacity
          style={styles.checkButton}
          onPress={() => handleMarkDone(task)}
        >
          <Ionicons name="checkmark-circle-outline" size={28} color="#34C759" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search tasks..."
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filterType === 'all' && styles.filterButtonActive]}
          onPress={() => handleFilterType('all')}
        >
          <Text style={[styles.filterText, filterType === 'all' && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filterType === 'deadline' && styles.filterButtonActive]}
          onPress={() => handleFilterType('deadline')}
        >
          <Text style={[styles.filterText, filterType === 'deadline' && styles.filterTextActive]}>
            Deadline
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filterType === 'recurring' && styles.filterButtonActive]}
          onPress={() => handleFilterType('recurring')}
        >
          <Text style={[styles.filterText, filterType === 'recurring' && styles.filterTextActive]}>
            Recurring
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filterType === 'someday' && styles.filterButtonActive]}
          onPress={() => handleFilterType('someday')}
        >
          <Text style={[styles.filterText, filterType === 'someday' && styles.filterTextActive]}>
            Someday
          </Text>
        </TouchableOpacity>
      </View>

      {/* Status Filter */}
      <View style={styles.statusContainer}>
        <TouchableOpacity
          style={[styles.statusButton, filterStatus === 'pending' && styles.statusButtonActive]}
          onPress={() => setFilterStatus('pending')}
        >
          <Text style={[styles.statusText, filterStatus === 'pending' && styles.statusTextActive]}>
            Pending
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statusButton, filterStatus === 'done' && styles.statusButtonActive]}
          onPress={() => setFilterStatus('done')}
        >
          <Text style={[styles.statusText, filterStatus === 'done' && styles.statusTextActive]}>
            Done
          </Text>
        </TouchableOpacity>
      </View>

      {/* Task List */}
      <FlatList
        data={filteredTasks}
        renderItem={({ item }) => renderTask(item)}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No tasks found</Text>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 15,
    marginBottom: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  filterButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  statusContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  statusButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  statusButtonActive: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  statusText: {
    fontSize: 14,
    color: '#666',
  },
  statusTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 15,
    paddingBottom: 20,
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
    marginLeft: 8,
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
    marginLeft: 28,
  },
  taskType: {
    fontSize: 12,
    color: '#999',
    textTransform: 'capitalize',
    marginRight: 10,
  },
  deadline: {
    fontSize: 12,
    color: '#666',
    marginRight: 10,
  },
  recurring: {
    fontSize: 12,
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
    fontSize: 18,
    color: '#999',
    marginTop: 20,
  },
});

// Made with Bob
