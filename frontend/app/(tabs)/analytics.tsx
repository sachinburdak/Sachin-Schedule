import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../src/utils/api';
import { Colors, Spacing } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState(30);

  async function fetchAnalytics() {
    try {
      const result = await apiFetch(`/api/analytics?days=${period}`);
      setData(result);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }

  useFocusEffect(useCallback(() => { setLoading(true); fetchAnalytics(); }, [period]));

  if (loading) {
    return <View style={[styles.loader, { paddingTop: insets.top }]}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  const noData = !data || data.total_days_tracked === 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAnalytics(); }} tintColor={Colors.primary} />}
      >
        <Text style={styles.screenTitle}>Analytics</Text>
        <Text style={styles.screenSubtitle}>Insights to help you improve</Text>

        {/* Period Selector */}
        <View style={styles.periodRow}>
          {[7, 14, 30].map(p => (
            <TouchableOpacity
              testID={`period-${p}`}
              key={p}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>{p}D</Text>
            </TouchableOpacity>
          ))}
        </View>

        {noData ? (
          <View style={styles.emptyCard}>
            <Ionicons name="analytics-outline" size={48} color={Colors.textSecondary} />
            <Text style={styles.emptyTitle}>No data yet</Text>
            <Text style={styles.emptyText}>Complete tasks on the Today tab to see analytics here</Text>
          </View>
        ) : (
          <>
            {/* Summary Cards */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Ionicons name="flame" size={24} color={Colors.accent} />
                <Text style={styles.statValue}>{data.streak}</Text>
                <Text style={styles.statLabel}>Day Streak</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="pie-chart" size={24} color={Colors.primary} />
                <Text style={styles.statValue}>{data.avg_completion}%</Text>
                <Text style={styles.statLabel}>Avg Completion</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="star" size={24} color={Colors.warning} />
                <Text style={styles.statValue}>{data.perfect_days}</Text>
                <Text style={styles.statLabel}>Perfect Days</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="calendar" size={24} color={Colors.success} />
                <Text style={styles.statValue}>{data.total_days_tracked}</Text>
                <Text style={styles.statLabel}>Days Tracked</Text>
              </View>
            </View>

            {/* Personalized Message */}
            <View style={styles.messageCard}>
              <Ionicons name="chatbubble-ellipses" size={20} color={Colors.primary} />
              <Text style={styles.messageText}>
                {data.avg_completion >= 80
                  ? `Great job ${user?.name || 'Sachin'}! You're averaging ${data.avg_completion}% completion. Keep crushing it!`
                  : data.avg_completion >= 50
                  ? `Hey ${user?.name || 'Sachin'}, you're at ${data.avg_completion}% avg. Focus on the missed tasks below to push higher!`
                  : `Hey ${user?.name || 'Sachin'}, you're at ${data.avg_completion}% avg. Let's work on building consistency. Start with the basics!`}
              </Text>
            </View>

            {/* Delay Insights */}
            {data.delay_insights?.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="alarm-outline" size={20} color={Colors.accent} />
                  <Text style={styles.sectionTitle}>Delay Insights</Text>
                </View>
                <Text style={styles.sectionSubtitle}>Tasks you tend to start late</Text>
                {data.delay_insights.map((d: any, i: number) => (
                  <View testID={`delay-item-${i}`} key={i} style={styles.insightRow}>
                    <View style={styles.insightLeft}>
                      <View style={[styles.insightDot, { backgroundColor: Colors.accent }]} />
                      <View style={styles.insightInfo}>
                        <Text style={styles.insightTask}>{d.text}</Text>
                        <Text style={styles.insightDetail}>Scheduled: {formatTime(d.scheduled_time)} | Tracked {d.times_tracked}x</Text>
                      </View>
                    </View>
                    <View style={styles.delayBadge}>
                      <Text style={styles.delayText}>+{d.avg_delay_minutes}m late</Text>
                    </View>
                  </View>
                ))}
                <View style={styles.tipCard}>
                  <Ionicons name="bulb-outline" size={16} color={Colors.warning} />
                  <Text style={styles.tipText}>
                    Hey {user?.name || 'Sachin'}, you're late by {data.delay_insights[0]?.avg_delay_minutes || 0} min on avg on "{data.delay_insights[0]?.text}". Try setting an alarm 5 min before!
                  </Text>
                </View>
              </View>
            )}

            {/* Most Missed Tasks */}
            {data.most_missed_tasks?.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="alert-circle-outline" size={20} color={Colors.error} />
                  <Text style={styles.sectionTitle}>Needs Improvement</Text>
                </View>
                <Text style={styles.sectionSubtitle}>Tasks you miss most often</Text>
                {data.most_missed_tasks.slice(0, 5).map((t: any, i: number) => (
                  <View testID={`missed-item-${i}`} key={i} style={styles.insightRow}>
                    <View style={styles.insightLeft}>
                      <View style={[styles.insightDot, { backgroundColor: Colors.error }]} />
                      <View style={styles.insightInfo}>
                        <Text style={styles.insightTask}>{t.text}</Text>
                        <Text style={styles.insightDetail}>Missed {t.missed_count} of {t.total_days} days</Text>
                      </View>
                    </View>
                    <Text style={styles.missRate}>{Math.round((t.missed_count / t.total_days) * 100)}%</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Best Tasks */}
            {data.best_tasks?.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="trophy-outline" size={20} color={Colors.success} />
                  <Text style={styles.sectionTitle}>Doing Great</Text>
                </View>
                <Text style={styles.sectionSubtitle}>Tasks you complete most consistently</Text>
                {data.best_tasks.slice(0, 5).map((t: any, i: number) => (
                  <View testID={`best-item-${i}`} key={i} style={styles.insightRow}>
                    <View style={styles.insightLeft}>
                      <View style={[styles.insightDot, { backgroundColor: Colors.success }]} />
                      <View style={styles.insightInfo}>
                        <Text style={styles.insightTask}>{t.text}</Text>
                        <Text style={styles.insightDetail}>Completed {t.completed_count} of {t.total_days} days</Text>
                      </View>
                    </View>
                    <Text style={[styles.missRate, { color: Colors.success }]}>{Math.round((t.completed_count / t.total_days) * 100)}%</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  screenTitle: { fontSize: 28, fontWeight: '700', color: Colors.textPrimary, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  screenSubtitle: { fontSize: 14, color: Colors.textSecondary, paddingHorizontal: Spacing.lg, marginTop: 4, marginBottom: Spacing.md },
  periodRow: { flexDirection: 'row', marginHorizontal: Spacing.lg, gap: 10, marginBottom: Spacing.md },
  periodBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.surface, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  periodBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  periodText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  periodTextActive: { color: Colors.surface },
  emptyCard: { alignItems: 'center', paddingVertical: 60, marginHorizontal: Spacing.lg, backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border + '40' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginTop: 12 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: Spacing.lg, gap: 10, marginBottom: Spacing.md },
  statCard: { width: '47%', backgroundColor: Colors.surface, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.border + '40' },
  statValue: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, marginTop: 8 },
  statLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  messageCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: Colors.primary + '10', marginHorizontal: Spacing.lg, borderRadius: 16, padding: 16, gap: 10, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.primary + '20' },
  messageText: { flex: 1, fontSize: 14, color: Colors.primary, lineHeight: 20, fontWeight: '500' },
  section: { marginHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  sectionSubtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 12 },
  insightRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border + '30' },
  insightLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  insightDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  insightInfo: { flex: 1 },
  insightTask: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  insightDetail: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  delayBadge: { backgroundColor: Colors.accent + '15', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  delayText: { fontSize: 12, fontWeight: '700', color: Colors.accent },
  missRate: { fontSize: 16, fontWeight: '800', color: Colors.error },
  tipCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: Colors.warning + '10', borderRadius: 12, padding: 12, gap: 8, marginTop: 8, borderWidth: 1, borderColor: Colors.warning + '20' },
  tipText: { flex: 1, fontSize: 13, color: Colors.textPrimary, lineHeight: 18 },
});
