import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { TouchableOpacity, StyleSheet, ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Auth screen
import LoginScreen from '../screens/LoginScreen';

// Main screens
import TodayScreen from '../screens/TodayScreen';
import AllTasksScreen from '../screens/AllTasksScreen';
import SomedayScreen from '../screens/SomedayScreen';
import AddEditTaskScreen from '../screens/AddEditTaskScreen';
import TaskDetailScreen from '../screens/TaskDetailScreen';

// Group screens
import GroupsScreen from '../screens/GroupsScreen';
import CreateGroupScreen from '../screens/CreateGroupScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';

// Profile screen
import ProfileScreen from '../screens/ProfileScreen';

import { useAuth } from '../context/AuthContext';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function TasksStack({ navigation }) {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="TasksToday"
        component={TodayScreen}
        options={{
          title: 'Today',
          headerLeft: () => (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => navigation.navigate('TasksAll')}
              testID="nav-all-tasks"
              accessibilityLabel="nav-all-tasks"
            >
              <Ionicons name="list-outline" size={26} color="#007AFF" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => navigation.navigate('AddEditTask')}
              testID="add-task-button"
              accessibilityLabel="add-task-button"
            >
              <Ionicons name="add-circle" size={32} color="#007AFF" />
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen
        name="TasksAll"
        component={AllTasksScreen}
        options={{
          title: 'All Tasks',
          headerLeft: () => (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => navigation.navigate('TasksSomeday')}
              testID="nav-someday"
              accessibilityLabel="nav-someday"
            >
              <Ionicons name="time-outline" size={26} color="#007AFF" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => navigation.navigate('AddEditTask')}
              testID="add-task-button"
              accessibilityLabel="add-task-button"
            >
              <Ionicons name="add-circle" size={32} color="#007AFF" />
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen
        name="TasksSomeday"
        component={SomedayScreen}
        options={{ title: 'Someday' }}
      />
    </Stack.Navigator>
  );
}

function GroupsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen name="GroupsList" component={GroupsScreen} options={{ title: 'Groups' }} />
      <Stack.Screen name="GroupCreate" component={CreateGroupScreen} options={{ title: 'New Group' }} />
      <Stack.Screen
        name="GroupDetail"
        component={GroupDetailScreen}
        options={({ route }) => ({ title: route.params?.groupName || 'Group' })}
      />
    </Stack.Navigator>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Tasks: focused ? 'today' : 'today-outline',
            Groups: focused ? 'people' : 'people-outline',
            Profile: focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        headerShown: false, // hides the tab navigator's own redundant header
      })}
    >
      <Tab.Screen name="Tasks" component={TasksStack} options={{ title: 'Tasks' }} />
      <Tab.Screen name="Groups" component={GroupsStack} options={{ title: 'Groups', headerShown: false }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile', headerShown: true }} />
    </Tab.Navigator>
  );
}

function RootStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Main"
        component={TabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AddEditTask"
        component={AddEditTaskScreen}
        options={({ route }) => ({
          title: route.params?.taskId ? 'Edit Task' : 'Add Task',
          presentation: 'modal',
        })}
      />
      <Stack.Screen
        name="TaskDetail"
        component={TaskDetailScreen}
        options={{ title: 'Task Details' }}
      />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
      </Stack.Navigator>
    );
  }

  return <RootStack />;
}

const styles = StyleSheet.create({
  addButton: { marginRight: 15 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
