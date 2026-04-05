import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../src/utils/api';
import { Colors, Spacing } from '../../src/constants/theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function getMonthDays(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay();
}

function getColor(percentage: number) {
  if (percentage === 0) return Colors.surfaceSecondary;
  if (percentage < 25) return Colors.chart[4];
  if (percentage < 50) return Colors.chart[3];
  if (percentage < 75) return Colors.chart[2];
  if (percentage < 100) return Colors.chart[1];
  return Colors.chart[0];
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [days, setDays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<any>(null);

  async function fetchHistory() {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/history?month=${month}&year=${year}`);
      setDays(data.days);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
      setSelectedDay(null);
    }, [month, year])
  );

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  }

  const daysInMonth = getMonthDays(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const dayMap: Record<string, any> = {};
  days.forEach(d => {
    const dayNum = parseInt(d.date.split('-')[2], 10);
    dayMap[dayNum] = d;
  });

  // Stats
  const totalDaysTracked = days.length;
  const avgCompletion = totalDaysTracked > 0
    ? Math.round(days.reduce((s, d) => s + (d.completion_percentage || 0), 0) / totalDaysTracked)
    : 0;
  const perfectDays = days.filter(d => d.completion_percentage >= 100).length;

  // Calendar grid
  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarCells.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarCells.push(i);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>History</Text>
        <Text style={styles.screenSubtitle}>Track your consistency over time</Text>

        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity testID="prev-month-btn" onPress={prevMonth} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.monthText}>{MONTHS[month - 1]} {year}</Text>
          <TouchableOpacity testID="next-month-btn" onPress={nextMonth} style={styles.navBtn}>
            <Ionicons name="chevron-forward" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalDaysTracked}</Text>
            <Text style={styles.statLabel}>Days Tracked</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{avgCompletion}%</Text>
            <Text style={styles.statLabel}>Avg Completion</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.success }]}>{perfectDays}</Text>
            <Text style={styles.statLabel}>Perfect Days</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Calendar Grid */}
            <View style={styles.calendarCard}>
              {/* Day labels */}
              <View style={styles.calendarRow}>
                {DAYS_LABELS.map((label, i) => (
                  <View key={i} style={styles.calendarCell}>
                    <Text style={styles.dayLabel}>{label}</Text>
                  </View>
                ))}
              </View>

              {/* Calendar days */}
              {Array.from({ length: Math.ceil(calendarCells.length / 7) }).map((_, rowIdx) => (
                <View key={rowIdx} style={styles.calendarRow}>
                  {calendarCells.slice(rowIdx * 7, rowIdx * 7 + 7).map((dayNum, cellIdx) => {
                    if (dayNum === null) {
                      return <View key={cellIdx} style={styles.calendarCell} />;
                    }
                    const dayData = dayMap[dayNum];
                    const pct = dayData?.completion_percentage || 0;
                    const isSelected = selectedDay?.date?.endsWith(`-${String(dayNum).padStart(2, '0')}`);
                    const isToday = dayNum === new Date().getDate() && month === new Date().getMonth() + 1 && year === new Date().getFullYear();

                    return (
                      <TouchableOpacity
                        testID={`calendar-day-${dayNum}`}
                        key={cellIdx}
                        style={styles.calendarCell}
                        onPress={() => setSelectedDay(dayData || null)}
                      >
                        <View style={[
                          styles.dayCircle,
                          { backgroundColor: dayData ? getColor(pct) : Colors.surfaceSecondary },
                          isToday && styles.todayCircle,
                          isSelected && styles.selectedCircle,
                        ]}>
                          <Text style={[
                            styles.dayNum,
                            dayData && pct >= 50 && { color: Colors.surface },
                            isToday && { fontWeight: '800' },
                          ]}>{dayNum}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>

            {/* Selected Day Detail */}
            {selectedDay ? (
              <View style={styles.detailCard}>
                <Text style={styles.detailTitle}>{selectedDay.date}</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Tasks Completed</Text>
                  <Text style={styles.detailValue}>
                    {selectedDay.completed_tasks?.length || 0} / {selectedDay.total_tasks || 0}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Completion</Text>
                  <Text style={[styles.detailValue, { color: Colors.success }]}>
                    {selectedDay.completion_percentage || 0}%
                  </Text>
                </View>
                <View style={styles.progressBarOuter}>
                  <View style={[styles.progressBarInner, { width: `${selectedDay.completion_percentage || 0}%` }]} />
                </View>
              </View>
            ) : (
              <View style={styles.detailCard}>
                <Text style={styles.hintText}>Tap a day to see details</Text>
              </View>
            )}

            {/* Legend */}
            <View style={styles.legend}>
              <Text style={styles.legendLabel}>Less</Text>
              {[Colors.surfaceSecondary, Colors.chart[4], Colors.chart[3], Colors.chart[2], Colors.chart[1], Colors.chart[0]].map((color, i) => (
                <View key={i} style={[styles.legendBox, { backgroundColor: color }]} />
              ))}
              <Text style={styles.legendLabel}>More</Text>
            </View>
          </>
        )}

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
    paddingHorizontal: Spacing.lg, marginTop: 4, marginBottom: Spacing.md,
  },
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
  },
  navBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.surface, justifyContent: 'center',
    alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  monthText: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },

  // Stats
  statsRow: {
    flexDirection: 'row', marginHorizontal: Spacing.lg,
    gap: 10, marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 14,
    padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border + '40',
  },
  statValue: { fontSize: 22, fontWeight: '800', color: Colors.primary },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },

  // Calendar
  calendarCard: {
    backgroundColor: Colors.surface, marginHorizontal: Spacing.lg,
    borderRadius: 20, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border + '40',
  },
  calendarRow: { flexDirection: 'row' },
  calendarCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  dayLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4 },
  dayCircle: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  todayCircle: { borderWidth: 2, borderColor: Colors.primary },
  selectedCircle: { borderWidth: 2, borderColor: Colors.accent },
  dayNum: { fontSize: 13, fontWeight: '500', color: Colors.textPrimary },

  // Detail
  detailCard: {
    backgroundColor: Colors.surface, marginHorizontal: Spacing.lg,
    marginTop: Spacing.md, borderRadius: 16, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border + '40',
  },
  detailTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  detailLabel: { fontSize: 14, color: Colors.textSecondary },
  detailValue: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  progressBarOuter: {
    height: 8, backgroundColor: Colors.surfaceSecondary,
    borderRadius: 4, overflow: 'hidden', marginTop: 8,
  },
  progressBarInner: { height: '100%', backgroundColor: Colors.success, borderRadius: 4 },
  hintText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },

  // Legend
  legend: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: Spacing.md, marginBottom: Spacing.md,
  },
  legendBox: { width: 16, height: 16, borderRadius: 4 },
  legendLabel: { fontSize: 11, color: Colors.textSecondary },
});
