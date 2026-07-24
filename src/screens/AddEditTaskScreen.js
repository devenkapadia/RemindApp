import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import {
  createTask,
  getTaskWithItems,
  updateTask,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  getGroupMembers,
} from '../database/supabaseDb';
import {
  scheduleTaskNotifications,
  cancelTaskNotifications,
  scheduleRecurringTaskNotification
} from '../utils/notificationScheduler';
import { useAuth } from '../context/AuthContext';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function AddEditTaskScreen({ route, navigation }) {
  const { taskId, promoteToDeadline, groupId: routeGroupId } = route.params || {};
  const isEditing = !!taskId;
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [taskType, setTaskType] = useState('deadline');
  const [deadline, setDeadline] = useState(() => { const d = new Date(); d.setHours(d.getHours() + 1); return d; });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  // Recurring task fields
  const [recurrenceFreq, setRecurrenceFreq] = useState('daily');
  const [recurrenceTime, setRecurrenceTime] = useState('09:00');
  const [recurrenceDays, setRecurrenceDays] = useState([]);
  const [showRecurrenceTimePicker, setShowRecurrenceTimePicker] = useState(false);
  
  // Checklist items
  const [checklistItems, setChecklistItems] = useState([]);
  const [newItemText, setNewItemText] = useState('');

  // Assignee (group tasks only)
  const [groupMembers, setGroupMembers] = useState([]);
  const [assignedTo, setAssignedTo] = useState(null); // user id
  
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEditing) {
      loadTask();
    } else if (promoteToDeadline) {
      setTaskType('deadline');
    }
    if (routeGroupId) {
      loadGroupMembers();
    }
  }, [taskId]);

  const loadGroupMembers = async () => {
    try {
      const members = await getGroupMembers(routeGroupId);
      setGroupMembers(members);
    } catch (e) {
      console.error('Error loading group members:', e);
    }
  };

  const loadTask = async () => {
    try {
      const taskData = await getTaskWithItems(taskId);
      if (taskData) {
        setTitle(taskData.title);
        setTaskType(taskData.type);
        
        if (taskData.default_deadline) {
          setDeadline(new Date(taskData.default_deadline));
        }
        
        if (taskData.type === 'recurring') {
          setRecurrenceFreq(taskData.recurrence_freq || 'daily');
          setRecurrenceTime(taskData.recurrence_time || '09:00');
          if (taskData.recurrence_days) {
            setRecurrenceDays(taskData.recurrence_days);
          }
        }
        
        if (taskData.items) {
          setChecklistItems(taskData.items);
        }

        if (taskData.assigned_to) {
          setAssignedTo(taskData.assigned_to);
          // Also load members if this is a group task being edited
          if (taskData.group_id) {
            const members = await getGroupMembers(taskData.group_id);
            setGroupMembers(members);
          }
        }
      }
    } catch (error) {
      console.error('Error loading task:', error);
      Alert.alert('Error', 'Failed to load task');
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a task title');
      return;
    }

    if (taskType === 'deadline' && deadline < new Date()) {
      Alert.alert('Error', 'Deadline cannot be in the past');
      return;
    }

    if (taskType === 'recurring' && recurrenceFreq === 'weekly' && recurrenceDays.length === 0) {
      Alert.alert('Error', 'Please select at least one day for weekly recurrence');
      return;
    }

    // Bug 1 fix: re-verify the user is still a member of the group before saving
    if (routeGroupId && !isEditing) {
      const { isUserInGroup } = require('../database/supabaseDb');
      const stillMember = await isUserInGroup(routeGroupId, user.id);
      if (!stillMember) {
        Alert.alert('Not a member', 'You are no longer a member of this group and cannot add tasks to it.');
        return;
      }
    }

    setSaving(true);

    try {
      const taskData = {
        title: title.trim(),
        type: taskType,
        default_deadline: taskType === 'deadline' ? deadline.toISOString() : null,
        recurrence_freq: taskType === 'recurring' ? recurrenceFreq : null,
        recurrence_time: taskType === 'recurring' ? recurrenceTime : null,
        recurrence_days: taskType === 'recurring' && recurrenceFreq === 'weekly' ? recurrenceDays : null,
        user_id: user.id,
        group_id: routeGroupId || null,
        assigned_to: assignedTo || null,
      };

      let finalTaskId;

      if (isEditing) {
        // Update existing task
        await updateTask(taskId, taskData);
        finalTaskId = taskId;

        // Update checklist items
        const existingItemIds = checklistItems.filter(item => item.id).map(item => item.id);
        
        for (const item of checklistItems) {
          if (item.id) {
            // Update existing item
            await updateChecklistItem(item.id, {
              text: item.text,
              deadline: item.deadline || null,
              sort_order: item.sort_order || 0,
            });
          } else {
            // Create new item
            await createChecklistItem({
              task_id: taskId,
              text: item.text,
              deadline: item.deadline || null,
              sort_order: item.sort_order || 0,
            });
          }
        }

        // Cancel old notifications
        await cancelTaskNotifications(taskId);
      } else {
        // Create new task
        finalTaskId = await createTask(taskData);

        // Create checklist items
        for (const item of checklistItems) {
          await createChecklistItem({
            task_id: finalTaskId,
            text: item.text,
            deadline: item.deadline || null,
            sort_order: item.sort_order || 0,
          });
        }
      }

      // Schedule notifications based on task type
      if (taskType === 'deadline') {
        await scheduleTaskNotifications(finalTaskId);
      } else if (taskType === 'recurring') {
        await scheduleRecurringTaskNotification(finalTaskId);
      }

      navigation.goBack();
    } catch (error) {
      console.error('Error saving task:', error);
      Alert.alert('Error', 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const handleAddChecklistItem = () => {
    if (!newItemText.trim()) return;

    setChecklistItems([
      ...checklistItems,
      {
        text: newItemText.trim(),
        done: false,
        deadline: null,
        sort_order: checklistItems.length,
      },
    ]);
    setNewItemText('');
  };

  const handleRemoveChecklistItem = (index) => {
    const newItems = [...checklistItems];
    newItems.splice(index, 1);
    setChecklistItems(newItems);
  };

  const handleSetItemDeadline = (index, date) => {
    const newItems = [...checklistItems];
    newItems[index].deadline = date ? date.toISOString() : null;
    setChecklistItems(newItems);
  };

  const toggleRecurrenceDay = (day) => {
    if (recurrenceDays.includes(day)) {
      setRecurrenceDays(recurrenceDays.filter(d => d !== day));
    } else {
      setRecurrenceDays([...recurrenceDays, day]);
    }
  };

  const formatTime = (timeString) => {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter task title"
          value={title}
          onChangeText={setTitle}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Type</Text>
        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[styles.typeButton, taskType === 'deadline' && styles.typeButtonActive]}
            onPress={() => setTaskType('deadline')}
          >
            <Text style={[styles.typeText, taskType === 'deadline' && styles.typeTextActive]}>
              Deadline
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, taskType === 'recurring' && styles.typeButtonActive]}
            onPress={() => setTaskType('recurring')}
          >
            <Text style={[styles.typeText, taskType === 'recurring' && styles.typeTextActive]}>
              Recurring
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, taskType === 'someday' && styles.typeButtonActive]}
            onPress={() => setTaskType('someday')}
          >
            <Text style={[styles.typeText, taskType === 'someday' && styles.typeTextActive]}>
              Someday
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {taskType === 'deadline' && (
        <View style={styles.section}>
          <Text style={styles.label}>Deadline</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color="#007AFF" />
            <Text style={styles.dateText}>
              {deadline.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowTimePicker(true)}
          >
            <Ionicons name="time-outline" size={20} color="#007AFF" />
            <Text style={styles.dateText}>
              {deadline.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={deadline}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (selectedDate) {
                  setDeadline(selectedDate);
                }
              }}
            />
          )}

          {showTimePicker && (
            <DateTimePicker
              value={deadline}
              mode="time"
              display="default"
              onChange={(event, selectedDate) => {
                setShowTimePicker(Platform.OS === 'ios');
                if (selectedDate) {
                  setDeadline(selectedDate);
                }
              }}
            />
          )}
        </View>
      )}

      {taskType === 'recurring' && (
        <>
          <View style={styles.section}>
            <Text style={styles.label}>Frequency</Text>
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[styles.typeButton, recurrenceFreq === 'daily' && styles.typeButtonActive]}
                onPress={() => setRecurrenceFreq('daily')}
              >
                <Text style={[styles.typeText, recurrenceFreq === 'daily' && styles.typeTextActive]}>
                  Daily
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeButton, recurrenceFreq === 'weekly' && styles.typeButtonActive]}
                onPress={() => setRecurrenceFreq('weekly')}
              >
                <Text style={[styles.typeText, recurrenceFreq === 'weekly' && styles.typeTextActive]}>
                  Weekly
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {recurrenceFreq === 'weekly' && (
            <View style={styles.section}>
              <Text style={styles.label}>Days of Week</Text>
              <View style={styles.daysSelector}>
                {DAYS_OF_WEEK.map((day) => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayButton,
                      recurrenceDays.includes(day) && styles.dayButtonActive,
                    ]}
                    onPress={() => toggleRecurrenceDay(day)}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        recurrenceDays.includes(day) && styles.dayTextActive,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.label}>Time</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowRecurrenceTimePicker(true)}
            >
              <Ionicons name="time-outline" size={20} color="#007AFF" />
              <Text style={styles.dateText}>{formatTime(recurrenceTime)}</Text>
            </TouchableOpacity>

            {showRecurrenceTimePicker && (
              <DateTimePicker
                value={new Date(`2000-01-01T${recurrenceTime}:00`)}
                mode="time"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowRecurrenceTimePicker(Platform.OS === 'ios');
                  if (selectedDate) {
                    const hours = selectedDate.getHours().toString().padStart(2, '0');
                    const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
                    setRecurrenceTime(`${hours}:${minutes}`);
                  }
                }}
              />
            )}
          </View>
        </>
      )}

      {groupMembers.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.label}>Assign To</Text>
          <View style={styles.memberList}>
            {/* Unassigned option */}
            <TouchableOpacity
              style={[styles.memberChip, assignedTo === null && styles.memberChipActive]}
              onPress={() => setAssignedTo(null)}
            >
              <Ionicons name="person-outline" size={14} color={assignedTo === null ? '#fff' : '#555'} />
              <Text style={[styles.memberChipText, assignedTo === null && styles.memberChipTextActive]}>
                Unassigned
              </Text>
            </TouchableOpacity>
            {groupMembers.map(m => (
              <TouchableOpacity
                key={m.user_id}
                style={[styles.memberChip, assignedTo === m.user_id && styles.memberChipActive]}
                onPress={() => setAssignedTo(m.user_id)}
              >
                <Text style={[styles.memberChipText, assignedTo === m.user_id && styles.memberChipTextActive]}>
                  {m.display_name || m.username}
                  {m.user_id === user.id ? ' (you)' : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.label}>Checklist Items (Optional)</Text>
        {checklistItems.map((item, index) => (
          <View key={index} style={styles.checklistItemContainer}>
            <Text style={styles.checklistItemText}>{item.text}</Text>
            <View style={styles.checklistItemActions}>
              {item.deadline && (
                <Text style={styles.itemDeadlineText}>
                  {new Date(item.deadline).toLocaleDateString()}
                </Text>
              )}
              <TouchableOpacity onPress={() => handleRemoveChecklistItem(index)}>
                <Ionicons name="close-circle" size={24} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
        <View style={styles.addItemContainer}>
          <TextInput
            style={styles.addItemInput}
            placeholder="Add checklist item"
            value={newItemText}
            onChangeText={setNewItemText}
            onSubmitEditing={handleAddChecklistItem}
          />
          <TouchableOpacity onPress={handleAddChecklistItem}>
            <Ionicons name="add-circle" size={28} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>
          {saving ? 'Saving...' : isEditing ? 'Update Task' : 'Create Task'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  typeSelector: {
    flexDirection: 'row',
  },
  memberList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f5f5f5',
  },
  memberChipActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  memberChipText: {
    fontSize: 14,
    color: '#555',
  },
  memberChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  typeButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginRight: 10,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  typeText: {
    fontSize: 14,
    color: '#666',
  },
  typeTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 10,
  },
  dateText: {
    fontSize: 16,
    marginLeft: 10,
    color: '#333',
  },
  daysSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayButton: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
    minWidth: 50,
    alignItems: 'center',
  },
  dayButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  dayText: {
    fontSize: 14,
    color: '#666',
  },
  dayTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  checklistItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
  },
  checklistItemText: {
    fontSize: 16,
    flex: 1,
  },
  checklistItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemDeadlineText: {
    fontSize: 12,
    color: '#666',
    marginRight: 10,
  },
  addItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  addItemInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginRight: 10,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    margin: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#999',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

// Made with Bob
