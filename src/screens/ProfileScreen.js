import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ScrollView, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

export default function ProfileScreen() {
  const { user, signOut, updateUserProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const result = await updateUserProfile({ display_name: displayName.trim() || null });
    setSaving(false);
    if (result.success) {
      setEditing(false);
    } else {
      Alert.alert('Error', result.error);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut }
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarWrap}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {(user?.display_name || user?.username || '?')[0].toUpperCase()}
        </Text>
      </View>
        {!editing && (
          <TouchableOpacity style={styles.editIcon} onPress={() => setEditing(true)}>
            <Ionicons name="pencil" size={16} color="#007AFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Display name */}
      <View style={styles.section}>
        <Text style={styles.label}>DISPLAY NAME</Text>
        {editing ? (
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            autoFocus
            maxLength={40}
          />
        ) : (
          <Text style={styles.value}>{user?.display_name || '—'}</Text>
        )}
      </View>

      {/* Phone */}
      <View style={styles.section}>
        <Text style={styles.label}>USERNAME</Text>
        <Text style={styles.value}>{user?.username}</Text>
      </View>

      {/* Member since */}
      <View style={styles.section}>
        <Text style={styles.label}>MEMBER SINCE</Text>
        <Text style={styles.value}>{user?.created_at?.slice(0, 10) || '—'}</Text>
      </View>

      {editing ? (
        <View style={styles.editBtns}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => { setEditing(false); setDisplayName(user?.display_name || ''); }}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save</Text>}
          </TouchableOpacity>
        </View>
      ) : null}

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color="#ff3b30" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  content: { padding: 24, paddingTop: 32 },
  avatarWrap: { alignItems: 'center', marginBottom: 32 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 36, fontWeight: '700' },
  editIcon: {
    marginTop: 10,
    backgroundColor: '#e5f0ff',
    borderRadius: 20,
    padding: 8,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  label: { fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 0.6, marginBottom: 6 },
  value: { fontSize: 16, color: '#1c1c1e' },
  input: {
    fontSize: 16,
    color: '#1c1c1e',
    borderBottomWidth: 1.5,
    borderBottomColor: '#007AFF',
    paddingVertical: 4,
  },
  editBtns: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#d1d1d6',
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: { fontSize: 16, color: '#3a3a3c', fontWeight: '600' },
  saveBtn: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  saveText: { fontSize: 16, color: '#fff', fontWeight: '700' },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  signOutText: { fontSize: 16, color: '#ff3b30', fontWeight: '600' },
});
