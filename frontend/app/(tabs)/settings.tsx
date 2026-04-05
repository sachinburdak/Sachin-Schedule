import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { Colors, Spacing } from '../../src/constants/theme';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  function handleLogout() {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>Settings</Text>
        <Text style={styles.screenSubtitle}>Manage your preferences</Text>

        {/* Profile Card */}
        <View testID="profile-card" style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.name || 'S').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || 'User'}</Text>
            <Text style={styles.profileEmail}>{user?.email || ''}</Text>
          </View>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{user?.role || 'user'}</Text>
          </View>
        </View>

        {/* Preferences */}
        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBox, { backgroundColor: Colors.success + '20' }]}>
                <Ionicons name="notifications-outline" size={18} color={Colors.success} />
              </View>
              <Text style={styles.settingText}>Push Notifications</Text>
            </View>
            <Switch
              testID="notifications-toggle"
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: Colors.border, true: Colors.success + '60' }}
              thumbColor={notificationsEnabled ? Colors.success : Colors.surfaceSecondary}
            />
          </View>
        </View>

        {/* About */}
        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBox, { backgroundColor: Colors.primary + '20' }]}>
                <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
              </View>
              <Text style={styles.settingText}>App Version</Text>
            </View>
            <Text style={styles.settingValue}>1.0.0</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBox, { backgroundColor: Colors.accent + '20' }]}>
                <Ionicons name="heart-outline" size={18} color={Colors.accent} />
              </View>
              <Text style={styles.settingText}>Made for Sachin</Text>
            </View>
            <Ionicons name="leaf" size={16} color={Colors.success} />
          </View>
        </View>

        {/* Schedule Info */}
        <Text style={styles.sectionLabel}>SCHEDULE INFO</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Schedule Type</Text>
            <Text style={styles.infoValue}>Daily Fixed Routine</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Wake Up</Text>
            <Text style={styles.infoValue}>5:30 AM</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Sleep</Text>
            <Text style={styles.infoValue}>11:00 PM</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Day Variations</Text>
            <Text style={styles.infoValue}>Sunday, Thursday</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Sync</Text>
            <Text style={[styles.infoValue, { color: Colors.success }]}>Enabled</Text>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity
          testID="logout-button"
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  screenTitle: {
    fontSize: 28, fontWeight: '700', color: Colors.textPrimary,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md,
  },
  screenSubtitle: {
    fontSize: 14, color: Colors.textSecondary,
    paddingHorizontal: Spacing.lg, marginTop: 4, marginBottom: Spacing.lg,
  },
  profileCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, marginHorizontal: Spacing.lg,
    borderRadius: 20, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border + '40',
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.primary, justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '700', color: Colors.surface },
  profileInfo: { flex: 1, marginLeft: 14 },
  profileName: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  profileEmail: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  roleBadge: {
    backgroundColor: Colors.surfaceSecondary, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  roleText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase' },

  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: Colors.textSecondary,
    letterSpacing: 1, paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg, marginBottom: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.surface, marginHorizontal: Spacing.lg,
    borderRadius: 16, padding: 4,
    borderWidth: 1, borderColor: Colors.border + '40',
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 14,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconBox: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  settingText: { fontSize: 15, fontWeight: '500', color: Colors.textPrimary },
  settingValue: { fontSize: 14, color: Colors.textSecondary },
  divider: { height: 1, backgroundColor: Colors.border + '40', marginHorizontal: 14 },

  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  infoLabel: { fontSize: 14, color: Colors.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: Spacing.lg, marginTop: Spacing.xl,
    backgroundColor: Colors.error + '10', borderRadius: 14,
    paddingVertical: 16, gap: 8,
    borderWidth: 1, borderColor: Colors.error + '30',
  },
  logoutText: { fontSize: 16, fontWeight: '600', color: Colors.error },
});
