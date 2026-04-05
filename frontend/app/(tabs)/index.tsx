import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { apiFetch } from '../../src/utils/api';
import { Colors, Spacing } from '../../src/constants/theme';

type ScheduleItem = { id: string; text: string; daily: boolean };
type ScheduleBlock = {
  id: string; time: string; block: string; title: string;
  icon: string; items: ScheduleItem[];
};

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  sunrise: 'sunny-outline',
  dumbbell: 'barbell-outline',
  sparkles: 'sparkles-outline',
  utensils: 'restaurant-outline',
  laptop: 'laptop-outline',
  salad: 'nutrition-outline',
  'book-open': 'book-outline',
  apple: 'leaf-outline',
  book: 'reader-outline',
  moon: 'moon-outline',
  target: 'flag-outline',
  bed: 'bed-outline',
  'cloud-moon': 'cloudy-night-outline',
};

function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function ProgressRing({ progress, size = 100 }: { progress: number; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ position: 'absolute' }}>
        <Text style={styles.progressPercent}>{Math.round(progress)}%</Text>
        <Text style={styles.progressLabel}>Done</Text>
      </View>
      {/* Simple visual ring using Views */}
      <View style={[styles.ringOuter, { width: size, height: size, borderRadius: size / 2 }]}>
        <View style={[styles.ringInner, { 
          width: size - strokeWidth * 2, 
          height: size - strokeWidth * 2, 
          borderRadius: (size - strokeWidth * 2) / 2 
        }]}>
        </View>
      </View>
      {/* Filled arc approximation */}
      <View style={[styles.ringFill, { 
        width: size, height: size, borderRadius: size / 2,
        borderWidth: strokeWidth,
        borderColor: Colors.success,
        borderTopColor: progress > 75 ? Colors.success : 'transparent',
        borderRightColor: progress > 50 ? Colors.success : 'transparent',
        borderBottomColor: progress > 25 ? Colors.success : 'transparent',
        borderLeftColor: progress > 0 ? Colors.success : 'transparent',
        transform: [{ rotate: '-90deg' }],
      }]} />
    </View>
  );
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [schedule, setSchedule] = useState<ScheduleBlock[]>([]);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [day, setDay] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  async function fetchSchedule() {
    try {
      const data = await apiFetch('/api/schedule');
      setSchedule(data.schedule);
      setCompletedTasks(data.completed_tasks);
      setTotalTasks(data.total_tasks);
      setDay(data.day);
      setDateStr(data.date);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      fetchSchedule();
    }, [])
  );

  async function handleToggle(taskId: string) {
    setToggling(taskId);
    // Optimistic update
    setCompletedTasks(prev =>
      prev.includes(taskId) ? prev.filter(t => t !== taskId) : [...prev, taskId]
    );
    try {
      const data = await apiFetch('/api/schedule/toggle', {
        method: 'POST',
        body: { task_id: taskId, date: dateStr },
      });
      setCompletedTasks(data.completed_tasks);
    } catch (e) {
      // Revert on error
      fetchSchedule();
    } finally {
      setToggling(null);
    }
  }

  const completedCount = completedTasks.length;
  const progress = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

  // Current time block detection
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  function getBlockMinutes(time: string) {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  function isCurrentBlock(block: ScheduleBlock, idx: number) {
    const blockMin = getBlockMinutes(block.time);
    const nextBlock = schedule[idx + 1];
    const nextMin = nextBlock ? getBlockMinutes(nextBlock.time) : 24 * 60;
    return currentMinutes >= blockMin && currentMinutes < nextMin;
  }

  if (loading) {
    return (
      <View style={[styles.loader, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        testID="dashboard-scroll"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSchedule(); }} tintColor={Colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.userName}>{user?.name || 'Sachin'}</Text>
          </View>
          <View style={styles.dayBadge}>
            <Text style={styles.dayText}>{day}</Text>
          </View>
        </View>

        {/* Progress Card */}
        <View testID="progress-card" style={styles.progressCard}>
          <View style={styles.progressLeft}>
            <Text style={styles.progressTitle}>Today's Progress</Text>
            <Text style={styles.progressSubtitle}>{completedCount} of {totalTasks} tasks done</Text>
            <View style={styles.progressBarOuter}>
              <View style={[styles.progressBarInner, { width: `${Math.min(progress, 100)}%` }]} />
            </View>
          </View>
          <View style={styles.progressRight}>
            <View style={styles.circleProgress}>
              <Text style={styles.circleText}>{Math.round(progress)}%</Text>
            </View>
          </View>
        </View>

        {/* Timeline */}
        <Text style={styles.sectionTitle}>Schedule</Text>
        {schedule.map((block, idx) => {
          const isCurrent = isCurrentBlock(block, idx);
          const blockCompleted = block.items.every(item => completedTasks.includes(item.id));
          const blockPartial = block.items.some(item => completedTasks.includes(item.id));
          const iconName = ICON_MAP[block.icon] || 'ellipse-outline';

          return (
            <View
              testID={`schedule-block-${block.id}`}
              key={block.id}
              style={[
                styles.timelineBlock,
                isCurrent && styles.currentBlock,
                blockCompleted && styles.completedBlock,
              ]}
            >
              {/* Timeline dot & line */}
              <View style={styles.timelineSide}>
                <View style={[
                  styles.timelineDot,
                  isCurrent && styles.currentDot,
                  blockCompleted && styles.completedDot,
                ]}>
                  {blockCompleted ? (
                    <Ionicons name="checkmark" size={12} color={Colors.surface} />
                  ) : (
                    <Ionicons name={iconName} size={12} color={isCurrent ? Colors.surface : Colors.textSecondary} />
                  )}
                </View>
                {idx < schedule.length - 1 && (
                  <View style={[styles.timelineLine, blockCompleted && styles.completedLine]} />
                )}
              </View>

              {/* Block content */}
              <View style={styles.blockContent}>
                <View style={styles.blockHeader}>
                  <Text style={[styles.blockTime, isCurrent && styles.currentText]}>
                    {formatTime(block.time)}
                  </Text>
                  {isCurrent && (
                    <View style={styles.nowBadge}>
                      <Text style={styles.nowText}>NOW</Text>
                    </View>
                  )}
                </View>
                <Text style={[
                  styles.blockTitle,
                  blockCompleted && styles.completedTitle,
                ]}>{block.title}</Text>

                {/* Task items */}
                {block.items.map((item) => {
                  const isDone = completedTasks.includes(item.id);
                  return (
                    <TouchableOpacity
                      testID={`task-checkbox-${item.id}`}
                      key={item.id}
                      style={styles.taskRow}
                      onPress={() => handleToggle(item.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.checkbox, isDone && styles.checkboxDone]}>
                        {isDone && <Ionicons name="checkmark" size={14} color={Colors.surface} />}
                      </View>
                      <Text style={[styles.taskText, isDone && styles.taskDoneText]}>
                        {item.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
  },
  greeting: { fontSize: 14, color: Colors.textSecondary },
  userName: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary, marginTop: 2 },
  dayBadge: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  dayText: { color: Colors.surface, fontWeight: '600', fontSize: 13 },

  // Progress Card
  progressCard: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg, marginTop: Spacing.md, borderRadius: 20,
    padding: Spacing.lg, shadowColor: '#000', shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 16, elevation: 3,
  },
  progressLeft: { flex: 1, marginRight: Spacing.md },
  progressTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  progressSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, marginBottom: 12 },
  progressBarOuter: {
    height: 8, backgroundColor: Colors.surfaceSecondary,
    borderRadius: 4, overflow: 'hidden',
  },
  progressBarInner: {
    height: '100%', backgroundColor: Colors.success, borderRadius: 4,
  },
  progressRight: { justifyContent: 'center', alignItems: 'center' },
  circleProgress: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.primary, justifyContent: 'center',
    alignItems: 'center',
  },
  circleText: { color: Colors.surface, fontSize: 18, fontWeight: '800' },

  // Progress Ring (unused but kept for reference)
  progressPercent: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  progressLabel: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center' },
  ringOuter: {
    position: 'absolute',
    borderWidth: 8, borderColor: Colors.surfaceSecondary,
    justifyContent: 'center', alignItems: 'center',
  },
  ringInner: { backgroundColor: Colors.surface },
  ringFill: { position: 'absolute' },

  // Section
  sectionTitle: {
    fontSize: 18, fontWeight: '700', color: Colors.textPrimary,
    paddingHorizontal: Spacing.lg, marginTop: Spacing.lg, marginBottom: Spacing.md,
  },

  // Timeline
  timelineBlock: {
    flexDirection: 'row', marginHorizontal: Spacing.lg,
    marginBottom: 0,
  },
  currentBlock: {},
  completedBlock: {},
  timelineSide: { width: 32, alignItems: 'center' },
  timelineDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.surfaceSecondary, justifyContent: 'center',
    alignItems: 'center', borderWidth: 2, borderColor: Colors.border,
    zIndex: 2,
  },
  currentDot: {
    backgroundColor: Colors.primary, borderColor: Colors.primary,
  },
  completedDot: {
    backgroundColor: Colors.success, borderColor: Colors.success,
  },
  timelineLine: {
    width: 2, flex: 1, backgroundColor: Colors.border,
    marginTop: -2,
  },
  completedLine: { backgroundColor: Colors.success },

  // Block content
  blockContent: {
    flex: 1, marginLeft: 12, paddingBottom: Spacing.lg,
    backgroundColor: Colors.surface, borderRadius: 16,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border + '60',
  },
  blockHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  blockTime: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, letterSpacing: 0.5 },
  currentText: { color: Colors.primary },
  nowBadge: {
    backgroundColor: Colors.accent, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8,
  },
  nowText: { color: Colors.surface, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  blockTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 10 },
  completedTitle: { color: Colors.textSecondary },

  // Tasks
  taskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  checkboxDone: {
    backgroundColor: Colors.success, borderColor: Colors.success,
  },
  taskText: { fontSize: 14, color: Colors.textPrimary, flex: 1 },
  taskDoneText: {
    color: Colors.textSecondary,
    textDecorationLine: 'line-through',
  },
});
