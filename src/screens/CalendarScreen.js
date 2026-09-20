import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CALENDAR_TYPE_LABELS, STATUS_COLORS, STATUS_LABELS, colors, fonts, isBlockingType } from '../theme';
import { DAY_SHORT, formatDateLong, formatMonthYear, monthMatrix, shiftMonth, todayStr } from '../utils/dates';
import { useLoad } from '../hooks/useLoad';
import { listEvents } from '../services/calendar.service';
import { listSessions } from '../services/session.service';
import { Button, Card, Empty, ErrorNote, IconButton, Loading, PageHeader, T, TypePill } from '../components/Primitives';
import Screen from '../components/Screen';
import SessionRow from '../components/SessionRow';
import SessionSheet from '../components/SessionSheet';

const startCursor = () => {
  const today = todayStr();
  return { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
};

export default function CalendarScreen() {
  const today = todayStr();
  const [cursor, setCursor] = useState(startCursor);
  const [selected, setSelected] = useState(today);
  const [openSession, setOpenSession] = useState(null);

  const cells = useMemo(() => monthMatrix(cursor.year, cursor.month), [cursor.year, cursor.month]);

  const { data, error, loading, reload, refresh, refreshing } = useLoad(async () => {
    const from = cells[0].iso;
    const to = cells[cells.length - 1].iso;
    const [sessions, events] = await Promise.all([listSessions({ from, to }), listEvents({ from, to })]);
    return { sessions, events };
  }, [cursor.year, cursor.month]);

  function go(next) {
    setCursor(next);
    const first = `${next.year}-${String(next.month).padStart(2, '0')}-01`;
    const currentMonth = `${today.slice(0, 7)}` === first.slice(0, 7);
    setSelected(currentMonth ? today : first);
  }

  const byDate = {};
  const eventsByDate = {};
  for (const s of data?.sessions || []) (byDate[s.date] = byDate[s.date] || []).push(s);
  for (const e of data?.events || []) (eventsByDate[e.date] = eventsByDate[e.date] || []).push(e);

  const dayEvents = eventsByDate[selected] || [];
  const daySessions = byDate[selected] || [];
  const dayIsHoliday = dayEvents.some((e) => isBlockingType(e.type));

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <PageHeader title={formatMonthYear(cursor.year, cursor.month)} />
      <View style={styles.nav}>
        <IconButton icon="chevron-left" label="Previous month" onPress={() => go(shiftMonth(cursor.year, cursor.month, -1))} />
        <Button title="Today" size="sm" onPress={() => { setCursor(startCursor()); setSelected(today); }} />
        <IconButton icon="chevron-right" label="Next month" onPress={() => go(shiftMonth(cursor.year, cursor.month, 1))} />
      </View>

      <ErrorNote error={error} />

      <Card style={{ padding: 10 }}>
        {loading ? (
          <Loading rows={2} />
        ) : (
          <>
            <View style={styles.weekHead}>
              {DAY_SHORT.map((d) => (
                <Text key={d} style={styles.weekHeadText}>
                  {d}
                </Text>
              ))}
            </View>
            <View style={styles.grid}>
              {cells.map((cell) => {
                const events = eventsByDate[cell.iso] || [];
                const holiday = events.some((e) => isBlockingType(e.type));
                const exam = events.some((e) => e.type === 'EXAM');
                const sessions = byDate[cell.iso] || [];
                const isSelected = cell.iso === selected;
                const isToday = cell.iso === today;
                return (
                  <View key={cell.iso} style={styles.cellWrap}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${formatDateLong(cell.iso)}, ${sessions.length} ${sessions.length === 1 ? 'class' : 'classes'}${holiday ? ', holiday' : ''}`}
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => setSelected(cell.iso)}
                      style={[
                        styles.cell,
                        !cell.inMonth && { opacity: 0.4 },
                        holiday && { backgroundColor: colors.holidaySoft },
                        isSelected && styles.cellSelected,
                      ]}
                    >
                      <View style={[styles.numBox, isToday && { backgroundColor: colors.navy }]}>
                        <Text style={[styles.num, isToday && { color: '#fff' }]}>{Number(cell.iso.slice(8, 10))}</Text>
                      </View>
                      <View style={styles.marks}>
                        {sessions.slice(0, 6).map((s) => (
                          <View key={s.id} style={[styles.mark, { backgroundColor: STATUS_COLORS[s.status]?.fg }]} />
                        ))}
                      </View>
                      {holiday ? <View style={[styles.bar, { backgroundColor: colors.holiday }]} /> : null}
                      {exam ? <View style={[styles.bar, { backgroundColor: colors.amberDeep }]} /> : null}
                    </Pressable>
                  </View>
                );
              })}
            </View>

            <View style={styles.legend}>
              {['PRESENT', 'ABSENT', 'PENDING', 'CANCELLED'].map((status) => (
                <View key={status} style={styles.legendItem}>
                  <View style={[styles.mark, { backgroundColor: STATUS_COLORS[status].fg }]} />
                  <T variant="tiny">{STATUS_LABELS[status]}</T>
                </View>
              ))}
              <View style={styles.legendItem}>
                <View style={[styles.legendBar, { backgroundColor: colors.holiday }]} />
                <T variant="tiny">Holiday</T>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendBar, { backgroundColor: colors.amberDeep }]} />
                <T variant="tiny">Exam</T>
              </View>
            </View>
          </>
        )}
      </Card>

      <Card>
        <T variant="h3" style={{ marginBottom: 12 }}>
          {formatDateLong(selected)}
        </T>
        {dayEvents.length > 0 ? (
          <View style={{ gap: 8, marginBottom: 12 }}>
            {dayEvents.map((event) => (
              <View key={event.id} style={styles.eventRow}>
                <T variant="small" color={colors.ink} style={{ flex: 1 }}>
                  {event.title || CALENDAR_TYPE_LABELS[event.type]}
                </T>
                <TypePill type={event.type} />
              </View>
            ))}
          </View>
        ) : null}
        {daySessions.length === 0 ? (
          <Empty icon="calendar" title="No classes">
            {dayIsHoliday ? 'A holiday, so nothing is counted for this day.' : 'Nothing was scheduled on this date.'}
          </Empty>
        ) : (
          <View style={{ gap: 8 }}>
            {daySessions.map((session) => (
              <SessionRow key={session.id} session={session} onPress={setOpenSession} />
            ))}
          </View>
        )}
      </Card>

      <SessionSheet session={openSession} onClose={() => setOpenSession(null)} onChanged={reload} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekHead: { flexDirection: 'row', marginBottom: 4 },
  weekHeadText: { flex: 1, textAlign: 'center', fontFamily: fonts.bodySemi, fontSize: 12, color: colors.muted, paddingVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cellWrap: { width: `${100 / 7}%`, padding: 2 },
  cell: {
    minHeight: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#fff',
    padding: 4,
    alignItems: 'center',
    gap: 3,
  },
  cellSelected: { borderColor: colors.skyDeep, borderWidth: 2 },
  numBox: { minWidth: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  num: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.ink, fontVariant: ['tabular-nums'] },
  marks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 3, maxWidth: 34 },
  mark: { width: 6, height: 6, borderRadius: 2 },
  bar: { position: 'absolute', bottom: 3, left: 6, right: 6, height: 3, borderRadius: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10, paddingHorizontal: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendBar: { width: 12, height: 3, borderRadius: 2 },
  eventRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
});
