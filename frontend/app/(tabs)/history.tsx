import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../src/utils/api';
import { Colors, Spacing } from '../../src/constants/theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function getMonthDays(y: number, m: number) { return new Date(y, m, 0).getDate(); }
function getFirstDay(y: number, m: number) { return new Date(y, m - 1, 1).getDay(); }
function getColor(p: number) {
  if (p === 0) return Colors.surfaceSecondary;
  if (p < 25) return Colors.chart[4];
  if (p < 50) return Colors.chart[3];
  if (p < 75) return Colors.chart[2];
  if (p < 100) return Colors.chart[1];
  return Colors.chart[0];
}
function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [days, setDays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dayDetail, setDayDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  async function fetchHistory() {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/history?month=${month}&year=${year}`);
      setDays(data.days);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useFocusEffect(useCallback(() => { fetchHistory(); }, [month, year]));

  async function openDayDetail(dayNum: number) {
    const ds = `${year}-${month.toString().padStart(2, '0')}-${dayNum.toString().padStart(2, '0')}`;
    setDetailLoading(true);
    setShowDetail(true);
    try {
      const data = await apiFetch(`/api/history/day/${ds}`);
      setDayDetail(data);
    } catch (e) { console.error(e); }
    finally { setDetailLoading(false); }
  }

  const daysInMonth = getMonthDays(year, month);
  const firstDay = getFirstDay(year, month);
  const dayMap: Record<number, any> = {};
  days.forEach(d => { dayMap[parseInt(d.date.split('-')[2], 10)] = d; });

  const totalTracked = days.length;
  const avgComp = totalTracked > 0 ? Math.round(days.reduce((s, d) => s + (d.completion_percentage || 0), 0) / totalTracked) : 0;
  const perfectDays = days.filter(d => d.completion_percentage >= 100).length;

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>History</Text>
        <Text style={styles.screenSubtitle}>Track your consistency over time</Text>

        <View style={styles.monthNav}>
          <TouchableOpacity testID="prev-month-btn" onPress={() => { if (month === 1) { setMonth(12); setYear(year - 1); } else setMonth(month - 1); }} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.monthText}>{MONTHS[month - 1]} {year}</Text>
          <TouchableOpacity testID="next-month-btn" onPress={() => { if (month === 12) { setMonth(1); setYear(year + 1); } else setMonth(month + 1); }} style={styles.navBtn}>
            <Ionicons name="chevron-forward" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}><Text style={styles.statValue}>{totalTracked}</Text><Text style={styles.statLabel}>Days Tracked</Text></View>
          <View style={styles.statCard}><Text style={styles.statValue}>{avgComp}%</Text><Text style={styles.statLabel}>Avg Completion</Text></View>
          <View style={styles.statCard}><Text style={[styles.statValue, { color: Colors.success }]}>{perfectDays}</Text><Text style={styles.statLabel}>Perfect Days</Text></View>
        </View>

        {loading ? <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} /> : (
          <>
            <View style={styles.calendarCard}>
              <View style={styles.calendarRow}>
                {DAYS_LABELS.map((l, i) => <View key={i} style={styles.calendarCell}><Text style={styles.dayLabel}>{l}</Text></View>)}
              </View>
              {Array.from({ length: Math.ceil(cells.length / 7) }).map((_, ri) => (
                <View key={ri} style={styles.calendarRow}>
                  {cells.slice(ri * 7, ri * 7 + 7).map((dn, ci) => {
                    if (dn === null) return <View key={ci} style={styles.calendarCell} />;
                    const dd = dayMap[dn];
                    const pct = dd?.completion_percentage || 0;
                    const isToday = dn === new Date().getDate() && month === new Date().getMonth() + 1 && year === new Date().getFullYear();
                    return (
                      <TouchableOpacity testID={`cal-day-${dn}`} key={ci} style={styles.calendarCell} onPress={() => openDayDetail(dn)}>
                        <View style={[styles.dayCircle, { backgroundColor: dd ? getColor(pct) : Colors.surfaceSecondary }, isToday && styles.todayCircle]}>
                          <Text style={[styles.dayNum, dd && pct >= 50 && { color: Colors.surface }, isToday && { fontWeight: '800' }]}>{dn}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>

            <View style={styles.legend}>
              <Text style={styles.legendLabel}>Less</Text>
              {[Colors.surfaceSecondary, Colors.chart[4], Colors.chart[3], Colors.chart[2], Colors.chart[1], Colors.chart[0]].map((c, i) => (
                <View key={i} style={[styles.legendBox, { backgroundColor: c }]} />
              ))}
              <Text style={styles.legendLabel}>More</Text>
            </View>
            <Text style={styles.hintText}>Tap any day to see details</Text>
          </>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Day Detail Modal */}
      <Modal visible={showDetail} transparent animationType="slide">
        <View style={mdStyles.overlay}>
          <View style={mdStyles.sheet}>
            <View style={mdStyles.header}>
              <Text style={mdStyles.title}>{dayDetail?.day}, {dayDetail?.date}</Text>
              <TouchableOpacity testID="close-detail-btn" onPress={() => setShowDetail(false)}><Ionicons name="close" size={24} color={Colors.textPrimary} /></TouchableOpacity>
            </View>
            {detailLoading ? <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 40 }} /> : dayDetail ? (
              <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
                <View style={mdStyles.summaryRow}>
                  <Text style={mdStyles.summaryText}>Completed: {dayDetail.completed_count}/{dayDetail.total_tasks}</Text>
                  <Text style={[mdStyles.summaryText, { color: Colors.success }]}>{dayDetail.completion_percentage}%</Text>
                </View>
                <View style={mdStyles.progressBar}><View style={[mdStyles.progressFill, { width: `${dayDetail.completion_percentage}%` }]} /></View>

                {dayDetail.incomplete_details?.length > 0 && (
                  <>
                    <Text style={mdStyles.sectionTitle}>
                      <Ionicons name="close-circle" size={16} color={Colors.error} /> Missed Tasks ({dayDetail.incomplete_details.length})
                    </Text>
                    {dayDetail.incomplete_details.map((t: any) => (
                      <View key={t.id} style={mdStyles.taskRow}>
                        <Ionicons name="close-circle" size={16} color={Colors.error} />
                        <View style={mdStyles.taskInfo}>
                          <Text style={mdStyles.taskText}>{t.text}</Text>
                          <Text style={mdStyles.taskBlock}>{t.block} - {formatTime(t.scheduled_time)}</Text>
                        </View>
                      </View>
                    ))}
                  </>
                )}

                {dayDetail.completed_details?.length > 0 && (
                  <>
                    <Text style={mdStyles.sectionTitle}>
                      <Ionicons name="checkmark-circle" size={16} color={Colors.success} /> Completed ({dayDetail.completed_details.length})
                    </Text>
                    {dayDetail.completed_details.map((t: any) => (
                      <View key={t.id} style={mdStyles.taskRow}>
                        <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                        <View style={mdStyles.taskInfo}>
                          <Text style={[mdStyles.taskText, { color: Colors.textSecondary }]}>{t.text}</Text>
                          <Text style={mdStyles.taskBlock}>
                            {t.block} - {formatTime(t.scheduled_time)}
                            {t.actual_time ? ` (Done at ${formatTime(t.actual_time)})` : ''}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </ScrollView>
            ) : <Text style={mdStyles.noData}>No data for this day</Text>}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  screenTitle: { fontSize: 28, fontWeight: '700', color: Colors.textPrimary, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  screenSubtitle: { fontSize: 14, color: Colors.textSecondary, paddingHorizontal: Spacing.lg, marginTop: 4, marginBottom: Spacing.md },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: Spacing.lg, marginBottom: Spacing.md },
  navBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  monthText: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  statsRow: { flexDirection: 'row', marginHorizontal: Spacing.lg, gap: 10, marginBottom: Spacing.md },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border + '40' },
  statValue: { fontSize: 22, fontWeight: '800', color: Colors.primary },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },
  calendarCard: { backgroundColor: Colors.surface, marginHorizontal: Spacing.lg, borderRadius: 20, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border + '40' },
  calendarRow: { flexDirection: 'row' },
  calendarCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  dayLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4 },
  dayCircle: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  todayCircle: { borderWidth: 2, borderColor: Colors.primary },
  dayNum: { fontSize: 13, fontWeight: '500', color: Colors.textPrimary },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: Spacing.md },
  legendBox: { width: 16, height: 16, borderRadius: 4 },
  legendLabel: { fontSize: 11, color: Colors.textSecondary },
  hintText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginTop: 8 },
});

const mdStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, paddingBottom: 40, maxHeight: '80%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryText: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  progressBar: { height: 8, backgroundColor: Colors.surfaceSecondary, borderRadius: 4, overflow: 'hidden', marginBottom: 16 },
  progressFill: { height: '100%', backgroundColor: Colors.success, borderRadius: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginTop: 12, marginBottom: 8 },
  taskRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6, gap: 10 },
  taskInfo: { flex: 1 },
  taskText: { fontSize: 14, color: Colors.textPrimary },
  taskBlock: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  noData: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', paddingVertical: 40 },
});
