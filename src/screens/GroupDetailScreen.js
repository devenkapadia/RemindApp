import React, { useState, useCallback } from 'react'; // useCallback kept for useFocusEffect
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Alert, TextInput, Modal,
  KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import {
  getGroupMembers, addGroupMember, removeGroupMember,
  getUserByUsername, getAllTasks
} from '../database/supabaseDb';

export default function GroupDetailScreen({ route, navigation }) {
  const { groupId, groupName } = route.params;
  const { user } = useAuth();

  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [invitePhone, setInvitePhone] = useState('');
  const [inviting, setInviting] = useState(false);

  const isOwner = members.some(m => m.user_id === user.id && m.role === 'owner');

  const loadData = async () => {
    setLoadingMembers(true);
    try {
      const [m, t] = await Promise.all([
        getGroupMembers(groupId),
        getAllTasks({ group_id: groupId })
      ]);
      setMembers(m);
      setTasks(t);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMembers(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [groupId])
  );

  const handleInvite = async () => {
    const phone = invitePhone.trim();
    if (!phone) return;
    setInviting(true);
    try {
      const found = await getUserByUsername(phone.trim().toLowerCase());
      if (!found) {
        Alert.alert('Not found', 'No user with that username has signed up yet.');
        setInviting(false);
        return;
      }
      if (members.some(m => m.user_id === found.id)) {
        Alert.alert('Already a member', 'This person is already in the group.');
        setInviting(false);
        return;
      }
      await addGroupMember(groupId, found.id);
      setInvitePhone('');
      setShowInvite(false);
      loadData();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = (member) => {
    if (!isOwner && member.user_id !== user.id) {
      Alert.alert('Permission denied', 'Only the owner can remove members.');
      return;
    }
    Alert.alert(
      'Remove Member',
      `Remove ${member.display_name || member.username} from the group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            await removeGroupMember(groupId, member.user_id);
            loadData();
          }
        }
      ]
    );
  };

  const renderMember = ({ item }) => (
    <View style={styles.memberRow}>
      <View style={styles.memberAvatar}>
        <Text style={styles.avatarText}>
          {(item.display_name || item.username || '?')[0].toUpperCase()}
        </Text>
      </View>
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.display_name || item.username}</Text>
        {item.display_name ? <Text style={styles.memberPhone}>{item.username}</Text> : null}
        <Text style={[styles.memberRole, item.role === 'owner' && styles.roleOwner]}>
          {item.role === 'owner' ? 'Owner' : 'Member'}
        </Text>
      </View>
      {(isOwner && item.user_id !== user.id) || item.user_id === user.id ? (
        <TouchableOpacity onPress={() => handleRemoveMember(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name={item.user_id === user.id ? 'exit-outline' : 'person-remove-outline'} size={20} color="#ff3b30" />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const renderTask = ({ item }) => (
    <TouchableOpacity
      style={styles.taskRow}
      onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })}
    >
      <Ionicons
        name={item.status === 'done' ? 'checkmark-circle' : 'ellipse-outline'}
        size={20}
        color={item.status === 'done' ? '#34c759' : '#007AFF'}
        style={{ marginRight: 10 }}
      />
      <View style={{ flex: 1 }}>
        <Text style={[styles.taskTitle, item.status === 'done' && styles.taskDone]}>
          {item.title}
        </Text>
        {item.assigned_to_username || item.assigned_to_display_name ? (
          <Text style={styles.taskAssignee}>
            → {item.assigned_to_display_name || item.assigned_to_username}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  if (loadingMembers) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={[]}
        ListHeaderComponent={
          <>
            {/* Members section */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>MEMBERS ({members.length})</Text>
              {isOwner && (
                <TouchableOpacity style={styles.inviteBtn} onPress={() => setShowInvite(true)}>
                  <Ionicons name="person-add-outline" size={16} color="#007AFF" />
                  <Text style={styles.inviteBtnText}>Invite</Text>
                </TouchableOpacity>
              )}
            </View>
            {members.map(m => <View key={m.id}>{renderMember({ item: m })}</View>)}

            {/* Tasks section */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>GROUP TASKS ({tasks.length})</Text>
              <TouchableOpacity
                style={styles.inviteBtn}
                onPress={() => navigation.navigate('AddEditTask', { groupId })}
              >
                <Ionicons name="add" size={16} color="#007AFF" />
                <Text style={styles.inviteBtnText}>Add Task</Text>
              </TouchableOpacity>
            </View>
            {tasks.length === 0 && (
              <Text style={styles.emptyTasks}>No tasks yet. Add one!</Text>
            )}
            {tasks.map(t => <View key={t.id}>{renderTask({ item: t })}</View>)}
          </>
        }
        renderItem={null}
        keyExtractor={() => 'header'}
      />

      {/* Invite Modal */}
      <Modal visible={showInvite} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Invite by Username</Text>
            <TextInput
              style={styles.usernameInput}
              placeholder="their username"
              autoCapitalize="none"
              autoCorrect={false}
              value={invitePhone}
              onChangeText={setInvitePhone}
              autoFocus
              maxLength={30}
            />
            <Text style={styles.modalHint}>They must have already signed up on Remind.</Text>
            <TouchableOpacity
              style={[styles.btn, (!invitePhone.trim() || inviting) && styles.btnDisabled]}
              onPress={handleInvite}
              disabled={!invitePhone.trim() || inviting}
            >
              {inviting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Add to Group</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowInvite(false); setInvitePhone(''); }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#888', letterSpacing: 0.6 },
  inviteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  inviteBtnText: { color: '#007AFF', fontSize: 14, fontWeight: '600' },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '600', color: '#1c1c1e' },
  memberPhone: { fontSize: 13, color: '#888', marginTop: 1 },
  memberRole: { fontSize: 12, color: '#888', marginTop: 2 },
  roleOwner: { color: '#ff9500', fontWeight: '600' },
  taskAssignee: { fontSize: 12, color: '#007AFF', marginTop: 2 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 14,
  },
  taskTitle: { fontSize: 15, color: '#1c1c1e', flex: 1 },
  taskDone: { textDecorationLine: 'line-through', color: '#aaa' },
  emptyTasks: { fontSize: 14, color: '#aaa', textAlign: 'center', paddingVertical: 16 },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1c1c1e', marginBottom: 18 },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#d1d1d6',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    backgroundColor: '#f9f9fb',
  },
  countryCode: {
    fontSize: 16,
    color: '#1c1c1e',
    marginRight: 8,
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: '#d1d1d6',
  },
  phoneInput: { flex: 1, fontSize: 17, paddingVertical: 14, color: '#1c1c1e' },
  usernameInput: {
    borderWidth: 1.5,
    borderColor: '#d1d1d6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    backgroundColor: '#f9f9fb',
    color: '#1c1c1e',
    marginBottom: 8,
  },
  modalHint: { fontSize: 13, color: '#888', marginBottom: 20 },
  btn: { backgroundColor: '#007AFF', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelText: { color: '#ff3b30', fontSize: 15 },
});
