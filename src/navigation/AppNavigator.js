import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Import screens
import TodayScreen from '../screens/TodayScreen';
import AllTasksScreen from '../screens/AllTasksScreen';
import SomedayScreen from '../screens/SomedayScreen';
import AddEditTaskScreen from '../screens/AddEditTaskScreen';
import TaskDetailScreen from '../screens/TaskDetailScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function TabNavigator({ navigation }) {
  return (
    <>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === 'Today') {
              iconName = focused ? 'today' : 'today-outline';
            } else if (route.name === 'AllTasks') {
              iconName = focused ? 'list' : 'list-outline';
            } else if (route.name === 'Someday') {
              iconName = focused ? 'time' : 'time-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#007AFF',
          tabBarInactiveTintColor: 'gray',
          headerRight: () => (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => navigation.navigate('AddEditTask')}
            >
              <Ionicons name="add-circle" size={32} color="#007AFF" />
            </TouchableOpacity>
          ),
        })}
      >
        <Tab.Screen 
          name="Today" 
          component={TodayScreen}
          options={{ title: 'Today' }}
        />
        <Tab.Screen 
          name="AllTasks" 
          component={AllTasksScreen}
          options={{ title: 'All Tasks' }}
        />
        <Tab.Screen 
          name="Someday" 
          component={SomedayScreen}
          options={{ title: 'Someday' }}
        />
      </Tab.Navigator>
    </>
  );
}

export default function AppNavigator() {
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

const styles = StyleSheet.create({
  addButton: {
    marginRight: 15,
  },
});

// Made with Bob
