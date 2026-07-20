import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createUser, getUserByUsername, updateUser } from '../database/db';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) setUser(JSON.parse(userData));
    } catch (e) {
      console.error('Error loading user:', e);
    } finally {
      setLoading(false);
    }
  };

  const saveUser = async (userData) => {
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const signUp = async (username, password, displayName) => {
    const trimmed = username.trim().toLowerCase();
    if (trimmed.length < 3) return { success: false, error: 'Username must be at least 3 characters.' };
    if (password.length < 6) return { success: false, error: 'Password must be at least 6 characters.' };

    try {
      const existing = await getUserByUsername(trimmed);
      if (existing) return { success: false, error: 'Username already taken.' };

      await createUser({ username: trimmed, password, display_name: displayName?.trim() || null });
      const newUser = await getUserByUsername(trimmed);
      await saveUser(newUser);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const signIn = async (username, password) => {
    const trimmed = username.trim().toLowerCase();
    try {
      const found = await getUserByUsername(trimmed);
      if (!found) return { success: false, error: 'No account found with that username.' };
      if (found.password !== password) return { success: false, error: 'Incorrect password.' };

      await saveUser(found);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const signOut = async () => {
    await AsyncStorage.removeItem('user');
    setUser(null);
  };

  const updateUserProfile = async (updates) => {
    try {
      await updateUser(user.id, updates);
      const updated = { ...user, ...updates };
      await saveUser(updated);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut, updateUserProfile, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export default AuthContext;
