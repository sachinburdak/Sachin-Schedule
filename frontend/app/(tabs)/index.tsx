import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl, Modal, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { apiFetch } from '../../src/utils/api';
import { Colors, Spacing } from '../../src/constants/theme';

type ScheduleItem = { id: string; text: string };
type ScheduleBlock = {
  id: string; time: string; end_time: string; block: string;
  title: string; icon: string; items: ScheduleItem[];
};

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  sunrise: 'sunny-outline', dumbbell: 'barbell-outline', sparkles: 'sparkles-outline',
  utensils: 'restaurant-outline', laptop: 'laptop-outline', salad: 'nutrition-outline',
  'book-open': 'book-outline', apple: 'leaf-outline', book: 'reader-outline',
  moon: 'moon-outline', target: 'flag-outline', bed: 'bed-outline', 'cloud-moon': 'cloudy-night-outline',
};

function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function TimePickerModal({ visible, onClose, onSelect, taskId }: any) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const mins = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  const [selH, setSelH] = useState(new Date().getHours());
  const [selM, setSelM] = useState(Math.round(new Date().getMinutes() / 5) * 5);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={tpStyles.overlay}>
        <View style={tpStyles.sheet}>
          <View style={tpStyles.header}>
            <Text style={tpStyles.title}>Set Actual Start Time</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={Colors.textPrimary} /></TouchableOpacity>
          </View>
          <View style={tpStyles.pickerRow}>
            <ScrollView style={tpStyles.col} showsVerticalScrollIndicator={false}>
              {hours.map(h => (
                <TouchableOpacity key={h} onPress={() => setSelH(h)} style={[tpStyles.cell, selH === h && tpStyles.cellActive]}>
                  <Text style={[tpStyles.cellText, selH === h && tpStyles.cellTextActive]}>{h.toString().padStart(2, '0')}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={tpStyles.sep}>:</Text>
            <ScrollView style={tpStyles.col} showsVerticalScrollIndicator={false}>
              {mins.map(m => (
                <TouchableOpacity key={m} onPress={() => setSelM(m)} style={[tpStyles.cell, selM === m && tpStyles.cellActive]}>
                  <Text style={[tpStyles.cellText, selM === m && tpStyles.cellTextActive]}>{m.toString().padStart(2, '0')}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <Text style={tpStyles.preview}>{formatTime(`${selH.toString().padStart(2, '0')}:${selM.toString().padStart(2, '0')}`)}</Text>
          <TouchableOpacity
            testID="confirm-time-btn"
            style={tpStyles.confirmBtn}
            onPress={() => { onSelect(taskId, `${selH.toString().padStart(2, '0')}:${selM.toString().padStart(2, '0')}`); onClose(); }}
          >
            <Text style={tpStyles.confirmText}>Confirm Time</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [schedule, setSchedule] = useState<ScheduleBlock[]>([]);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [taskTimings, setTaskTimings] = useState<Record<string, string>>({});
  const [totalTasks, setTotalTasks] = useState(0);
  const [day, setDay] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeModalVisible, setTimeModalVisible] = useState(false);
  const [timeModalTaskId, setTimeModalTaskId] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const blockPositions = useRef<Record<string, number>>({});

  async function fetchSchedule() {
    try {
      const data = await apiFetch('/api/schedule');
      setSchedule(data.schedule);
      setCompletedTasks(data.completed_tasks);
      setTaskTimings(data.task_timings || {});
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

  useFocusEffect(useCallback(() => { fetchSchedule(); }, []));

  // Auto-scroll to current block after data loads
  const handleContentSizeChange = useCallback(() => {
    if (schedule.length === 0) return;
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    let targetIdx = 0;
    for (let i = 0; i < schedule.length; i++) {
      const [h, m] = schedule[i].time.split(':').map(Number);
      if (currentMin >= h * 60 + m) targetIdx = i;
    }
    const pos = blockPositions.current[schedule[targetIdx]?.id];
    if (pos !== undefined && scrollRef.current) {
      setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, pos - 120), animated: true }), 300);
    }
  }, [schedule]);

  async function handleToggle(taskId: string) {
    setCompletedTasks(prev => prev.includes(taskId) ? prev.filter(t => t !== taskId) : [...prev, taskId]);
    try {
      const data = await apiFetch('/api/schedule/toggle', { method: 'POST', body: { task_id: taskId, date: dateStr } });
      setCompletedTasks(data.completed_tasks);
    } catch { fetchSchedule(); }
  }

  async function handleSetTime(taskId: string, time: string) {
    setTaskTimings(prev => ({ ...prev, [taskId]: time }));
    try {
      await apiFetch('/api/schedule/set-time', { method: 'POST', body: { task_id: taskId, date: dateStr, actual_time: time } });
    } catch { fetchSchedule(); }
  }

  const completedCount = completedTasks.length;
  const progress = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;
  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();

  function getBlockMin(time: string) {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  function isCurrentBlock(block: ScheduleBlock, idx: number) {
    const bm = getBlockMin(block.time);
    const next = schedule[idx + 1];
    const nm = next ? getBlockMin(next.time) : 24 * 60;
    return currentMin >= bm && currentMin < nm;
  }

  function isPastBlock(block: ScheduleBlock, idx: number) {
    const next = schedule[idx + 1];
    const nm = next ? getBlockMin(next.time) : 24 * 60;
    return currentMin >= nm;
  }

  if (loading) {
    return <View style={[styles.loader, { paddingTop: insets.top }]}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';
  const formattedDate = dateStr ? new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        ref={scrollRef}
        testID="dashboard-scroll"
        showsVerticalScrollIndicator={false}
        onContentSizeChange={handleContentSizeChange}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSchedule(); }} tintColor={Colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.userName}>{user?.name || 'Sachin'}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.dateText}>{formattedDate}</Text>
            <View style={styles.dayBadge}><Text style={styles.dayText}>{day}</Text></View>
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
          <View style={styles.circleProgress}>
            <Text style={styles.circleText}>{Math.round(progress)}%</Text>
          </View>
        </View>

        {/* Schedule Timeline */}
        <Text style={styles.sectionTitle}>Schedule</Text>
        {schedule.map((block, idx) => {
          const isCurrent = isCurrentBlock(block, idx);
          const isPast = isPastBlock(block, idx);
          const blockDone = block.items.every(item => completedTasks.includes(item.id));
          const iconName = ICON_MAP[block.icon] || 'ellipse-outline';

          return (
            <View
              testID={`schedule-block-${block.id}`}
              key={block.id}
              style={[styles.timelineBlock, isPast && !isCurrent && styles.pastBlock]}
              onLayout={(e) => { blockPositions.current[block.id] = e.nativeEvent.layout.y; }}
            >
              <View style={styles.timelineSide}>
                <View style={[styles.timelineDot, isCurrent && styles.currentDot, blockDone && styles.completedDot]}>
                  {blockDone ? <Ionicons name="checkmark" size={12} color={Colors.surface} /> :
                    <Ionicons name={iconName} size={12} color={isCurrent ? Colors.surface : Colors.textSecondary} />}
                </View>
                {idx < schedule.length - 1 && <View style={[styles.timelineLine, blockDone && styles.completedLine]} />}
              </View>

              <View style={[styles.blockContent, isCurrent && styles.currentBlockContent]}>
                <View style={styles.blockHeader}>
                  <Text style={[styles.blockTime, isCurrent && { color: Colors.primary }]}>
                    {formatTime(block.time)} - {formatTime(block.end_time)}
                  </Text>
                  {isCurrent && <View style={styles.nowBadge}><Text style={styles.nowText}>NOW</Text></View>}
                </View>
                <Text style={[styles.blockTitle, blockDone && { color: Colors.textSecondary }]}>{block.title}</Text>

                {block.items.map((item) => {
                  const isDone = completedTasks.includes(item.id);
                  const actualTime = taskTimings[item.id];
                  return (
                    <View key={item.id} style={styles.taskRow}>
                      <TouchableOpacity
                        testID={`task-checkbox-${item.id}`}
                        style={styles.taskLeft}
                        onPress={() => handleToggle(item.id)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.checkbox, isDone && styles.checkboxDone]}>
                          {isDone && <Ionicons name="checkmark" size={14} color={Colors.surface} />}
                        </View>
                        <Text style={[styles.taskText, isDone && styles.taskDoneText]}>{item.text}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        testID={`task-time-${item.id}`}
                        style={[styles.timeBtn, actualTime ? styles.timeBtnSet : null]}
                        onPress={() => { setTimeModalTaskId(item.id); setTimeModalVisible(true); }}
                      >
                        <Ionicons name="time-outline" size={16} color={actualTime ? Colors.success : Colors.textSecondary} />
                        {actualTime ? <Text style={styles.timeValue}>{formatTime(actualTime)}</Text> : null}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
        <View style={{ height: 100 }} />
      </ScrollView>

      <TimePickerModal
        visible={timeModalVisible}
        onClose={() => setTimeModalVisible(false)}
        onSelect={handleSetTime}
        taskId={timeModalTaskId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  greeting: { fontSize: 14, color: Colors.textSecondary },
  userName: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary, marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  dateText: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  dayBadge: { backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6 },
  dayText: { color: Colors.surface, fontWeight: '600', fontSize: 13 },
  progressCard: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg, marginTop: Spacing.md, borderRadius: 20,
    padding: Spacing.lg, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border + '40',
  },
  progressLeft: { flex: 1, marginRight: Spacing.md },
  progressTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  progressSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, marginBottom: 12 },
  progressBarOuter: { height: 8, backgroundColor: Colors.surfaceSecondary, borderRadius: 4, overflow: 'hidden' },
  progressBarInner: { height: '100%', backgroundColor: Colors.success, borderRadius: 4 },
  circleProgress: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  circleText: { color: Colors.surface, fontSize: 18, fontWeight: '800' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, paddingHorizontal: Spacing.lg, marginTop: Spacing.lg, marginBottom: Spacing.md },
  timelineBlock: { flexDirection: 'row', marginHorizontal: Spacing.lg },
  pastBlock: { opacity: 0.55 },
  timelineSide: { width: 32, alignItems: 'center' },
  timelineDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.surfaceSecondary, justifyContent: 'center',
    alignItems: 'center', borderWidth: 2, borderColor: Colors.border, zIndex: 2,
  },
  currentDot: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  completedDot: { backgroundColor: Colors.success, borderColor: Colors.success },
  timelineLine: { width: 2, flex: 1, backgroundColor: Colors.border, marginTop: -2 },
  completedLine: { backgroundColor: Colors.success },
  blockContent: {
    flex: 1, marginLeft: 12, paddingBottom: Spacing.lg,
    backgroundColor: Colors.surface, borderRadius: 16,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border + '60',
  },
  currentBlockContent: { borderColor: Colors.primary + '50', borderWidth: 2 },
  blockHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  blockTime: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, letterSpacing: 0.3 },
  nowBadge: { backgroundColor: Colors.accent, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
  nowText: { color: Colors.surface, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  blockTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  taskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  taskLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  checkboxDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  taskText: { fontSize: 14, color: Colors.textPrimary, flex: 1 },
  taskDoneText: { color: Colors.textSecondary, textDecorationLine: 'line-through' },
  timeBtn: { padding: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeBtnSet: { backgroundColor: Colors.success + '15' },
  timeValue: { fontSize: 11, color: Colors.success, fontWeight: '600' },
});

const tpStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 180 },
  col: { width: 70, maxHeight: 180 },
  sep: { fontSize: 28, fontWeight: '700', color: Colors.textPrimary, marginHorizontal: 12 },
  cell: { paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  cellActive: { backgroundColor: Colors.primary },
  cellText: { fontSize: 18, color: Colors.textPrimary },
  cellTextActive: { color: Colors.surface, fontWeight: '700' },
  preview: { textAlign: 'center', fontSize: 16, fontWeight: '600', color: Colors.textSecondary, marginVertical: 12 },
  confirmBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  confirmText: { color: Colors.surface, fontSize: 16, fontWeight: '700' },
});
