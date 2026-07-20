import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator, Alert
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username.trim() || !password) {
      Alert.alert('Required', 'Please fill in all fields.');
      return;
    }
    setLoading(true);
    const result = mode === 'login'
      ? await signIn(username, password)
      : await signUp(username, password, displayName);
    setLoading(false);
    if (!result.success) Alert.alert('Error', result.error);
    // On success the AuthContext sets user → navigator switches automatically
  };

  const isSignup = mode === 'signup';

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.appName}>Remind</Text>
        <Text style={styles.tagline}>Your tasks, your team</Text>

        {/* Mode toggle */}
        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, !isSignup && styles.toggleActive]}
            onPress={() => setMode('login')}
          >
            <Text style={[styles.toggleText, !isSignup && styles.toggleTextActive]}>Log In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, isSignup && styles.toggleActive]}
            onPress={() => setMode('signup')}
          >
            <Text style={[styles.toggleText, isSignup && styles.toggleTextActive]}>Sign Up</Text>
          </TouchableOpacity>
        </View>

        {isSignup && (
          <>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Your name (optional)"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              maxLength={40}
              returnKeyType="next"
            />
          </>
        )}

        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. johndoe"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={30}
          returnKeyType="next"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          maxLength={64}
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>{isSignup ? 'Create Account' : 'Log In'}</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { setMode(isSignup ? 'login' : 'signup'); setPassword(''); }}>
          <Text style={styles.switchText}>
            {isSignup ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    color: '#007AFF',
    textAlign: 'center',
    marginBottom: 6,
  },
  tagline: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    marginBottom: 36,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#f2f2f7',
    borderRadius: 10,
    padding: 3,
    marginBottom: 28,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleActive: { backgroundColor: '#fff' },
  toggleText: { fontSize: 15, fontWeight: '600', color: '#888' },
  toggleTextActive: { color: '#1c1c1e' },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
    marginLeft: 2,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#d1d1d6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    backgroundColor: '#f9f9fb',
    color: '#1c1c1e',
    marginBottom: 16,
  },
  btn: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 18,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  switchText: {
    textAlign: 'center',
    color: '#007AFF',
    fontSize: 14,
  },
});
