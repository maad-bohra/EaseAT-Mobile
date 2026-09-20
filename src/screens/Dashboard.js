import React from 'react';
import { StyleSheet, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { colors, isBlockingType, radius } from '../theme';
import { addDays, formatDate, formatDateLong, greeting, todayStr } from '../utils/dates';
import { messageOf } from '../utils/errors';
import { useLoad } from '../hooks/useLoad';
import { bulkMark, updateSessionStatus } from '../services/session.service';
import { getAllPredictions, getSummary, getTodayAndUpcoming } from '../services/attendance.service';
import { listEvents } from '../services/calendar.service';
import { countUnread, refreshNotifications } from '../services/notification.service';
import { getSettings } from '../services/settings.service';
import { Button, Card, CardHead, Dot, Empty, ErrorNote, IconButton, Loading, Meter, Note, Pill, T } from '../components/Primitives';
import Ring from '../components/Ring';
import Screen from '../components/Screen';
import SessionRow from '../components/SessionRow';
import { useToast } from '../components/Toast';

function Stat({ icon, label, value }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statIcon}>
        <Feather name={icon} size={15} color={colors.sky} />
      </View>
      <View>
        <T variant="tiny" color="#9DBCDB">
          {label}
        </T>
        <T variant="h3" color="#fff" style={{ fontVariant: ['tabular-nums'] }}>
          {value}
        </T>
      </View>
    </View>
  );
}

export default function Dashboard({ navigation }) {
  const toast = useToast();
  const { data, error, loading, refresh, refreshing, reload } = useLoad(async () => {
    const today = todayStr();
    await refreshNotifications().catch(() => {});
    const [settings, summary, schedule, predictions, calendar, unread] = await Promise.all([
      getSettings(),
      getSummary(),
      getTodayAndUpcoming(),
      getAllPredictions(),
      listEvents({ from: today, to: addDays(today, 21) }),
      countUnread(),
    ]);
    return { settings, summary, schedule, predictions, calendar, unread };
  });

  async function mark(session, status) {
    try {
      await updateSessionStatus(session.id, { status });
      toast(status === 'PRESENT' ? 'Marked present' : status === 'ABSENT' ? 'Marked absent' : 'Class cancelled');
      reload();
    } catch (err) {
      toast(messageOf(err));
    }
  }

  async function markAllPresent(sessions) {
    try {
      await bulkMark(sessions.map((s) => s.id), 'PRESENT');
      toast(`${sessions.length} classes marked present`);
      reload();
    } catch (err) {
      toast(messageOf(err));
    }
  }

  if (loading) {
    return (
      <Screen>
        <Loading rows={4} />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen onRefresh={refresh} refreshing={refreshing}>
        <ErrorNote error={error} />
      </Screen>
    );
  }

  const { settings, summary, schedule, predictions, calendar, unread } = data;
  const today = todayStr();
  const tomorrow = addDays(today, 1);
  const holidayTomorrow = calendar.find((e) => e.date === tomorrow && isBlockingType(e.type));
  const nextHoliday = calendar.find((e) => isBlockingType(e.type));
  const nextExam = calendar.find((e) => e.type === 'EXAM');
  const pendingToday = schedule.today.filter((s) => s.status === 'PENDING');
  const overall = summary.overall;
  const firstName = settings.name.trim().split(/\s+/)[0];

  const standing =
    overall.totalCounted === 0
      ? 'Nothing counted yet. Mark your first class to see this move.'
      : overall.percentage >= overall.required
        ? `You are ${(overall.percentage - overall.required).toFixed(1)} points above the requirement.`
        : `You are ${(overall.required - overall.percentage).toFixed(1)} points short of the requirement.`;

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <T variant="h1">{firstName ? `${greeting()}, ${firstName}` : greeting()}</T>
          <T variant="small">{formatDateLong(today)}</T>
          <T variant="small">
            {schedule.today.length > 0
              ? `${schedule.today.length} ${schedule.today.length === 1 ? 'class' : 'classes'} today`
              : 'No classes today'}
          </T>
        </View>
        <IconButton icon="bell" label="Notifications" badge={unread} onPress={() => navigation.navigate('Notifications')} />
      </View>

      <ErrorNote error={error} />

      <View style={styles.headline}>
        <View style={styles.headlineTop}>
          <Ring value={overall.percentage} />
          <View style={{ flex: 1, gap: 14 }}>
            <Stat icon="users" label="Attended" value={overall.attended} />
            <Stat icon="x-circle" label="Missed" value={overall.missed} />
          </View>
        </View>
        <View style={styles.headlineStats}>
          <Stat icon="clipboard" label="Counted" value={overall.totalCounted} />
          <Stat icon="slash" label="Cancelled" value={overall.cancelled} />
          <Stat icon="target" label="Required" value={`${overall.required}%`} />
        </View>
        <T variant="small" color="#9DBCDB">
          {standing}
        </T>
      </View>

      <Card>
        <CardHead
          title="Today"
          right={<Button title="All classes" variant="ghost" size="sm" onPress={() => navigation.navigate('Attendance')} />}
        />
        {schedule.today.length === 0 ? (
          <Empty icon="calendar" title={holidayTomorrow ? 'Nothing scheduled' : 'No classes today'}>
            Enjoy it, or add a one-off class from the Attendance tab.
          </Empty>
        ) : (
          <View style={{ gap: 8 }}>
            {schedule.today.map((session) => (
              <SessionRow key={session.id} session={session} onMark={mark} />
            ))}
            {pendingToday.length > 1 ? (
              <Button
                title={`Mark all ${pendingToday.length} present`}
                icon="check-circle"
                size="sm"
                onPress={() => markAllPresent(pendingToday)}
                style={{ marginTop: 4 }}
              />
            ) : null}
          </View>
        )}
      </Card>

      {summary.warnings.length > 0 ? (
        <Card>
          <CardHead title="Needs attention" icon="alert-triangle" iconTone="amber" />
          <View style={{ gap: 12 }}>
            {summary.warnings.map((w) => {
              const prediction = predictions.find((p) => p.subject.id === w.subjectId);
              const below = w.status === 'BELOW';
              return (
                <View key={w.subjectId}>
                  <View style={styles.spread}>
                    <T variant="strong" style={{ flex: 1 }} numberOfLines={1}>
                      {w.name}
                    </T>
                    <Pill
                      label={`${w.percentage}%`}
                      fg={below ? colors.absent : colors.pending}
                      bg={below ? colors.absentSoft : colors.pendingSoft}
                    />
                  </View>
                  {prediction ? <T variant="small">{prediction.message}</T> : null}
                </View>
              );
            })}
          </View>
        </Card>
      ) : null}

      <Card>
        <CardHead title="Subjects" right={<T variant="tiny">Marker shows the requirement</T>} />
        {summary.subjects.length === 0 ? (
          <Empty
            icon="book-open"
            title="No subjects yet"
            action={<Button title="Add your first subject" variant="primary" onPress={() => navigation.navigate('Subjects')} />}
          >
            Add subjects, then build the weekly timetable from them.
          </Empty>
        ) : (
          <View>
            {summary.subjects.map((s, i) => (
              <View key={s.subjectId} style={[styles.subjectRow, i > 0 && styles.rowBorder]}>
                <View style={styles.spread}>
                  <View style={styles.nameRow}>
                    <Dot color={s.color} />
                    <T variant="strong" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {s.name}
                    </T>
                    {s.code ? <T variant="tiny">{s.code}</T> : null}
                  </View>
                  <T variant="small" style={{ fontVariant: ['tabular-nums'] }}>
                    <T variant="smallStrong">{s.percentage}%</T>
                    {'  '}
                    {s.present}/{s.counted}
                  </T>
                </View>
                <Meter value={s.percentage} required={s.required} />
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card tint="sky">
        <CardHead title="How many can you miss?" icon="users" />
        {predictions.length === 0 ? (
          <T variant="small">Mark a few classes and this fills in.</T>
        ) : (
          <View>
            <View style={styles.tableRow}>
              <T variant="tiny" style={{ flex: 1 }}>
                Subject
              </T>
              <T variant="tiny" style={styles.colNow}>
                Now
              </T>
              <T variant="tiny" style={styles.colMiss}>
                Can miss
              </T>
              <T variant="tiny" style={styles.colOne}>
                Miss one
              </T>
            </View>
            {predictions.map((p) => (
              <View key={p.subject.id} style={[styles.tableRow, styles.rowBorder]}>
                <T variant="small" color={colors.ink} style={{ flex: 1 }} numberOfLines={1}>
                  {p.subject.name}
                </T>
                <T variant="smallStrong" style={[styles.colNow, styles.num]}>
                  {p.current}%
                </T>
                <T variant="smallStrong" style={[styles.colMiss, styles.num]}>
                  {p.canMiss === null ? '—' : p.canMiss}
                </T>
                <T variant="small" style={[styles.colOne, styles.num]}>
                  {p.projections.ifMissNext1}%
                </T>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card tint="cream">
        <CardHead
          title="Coming up"
          icon="calendar"
          iconTone="amber"
          right={<Button title="Calendar" variant="ghost" size="sm" onPress={() => navigation.navigate('Calendar')} />}
        />
        {holidayTomorrow ? (
          <Note>
            Tomorrow is a college holiday{holidayTomorrow.title ? `, ${holidayTomorrow.title}` : ''}. No classes will be
            counted.
          </Note>
        ) : null}
        <View style={{ gap: 8 }}>
          {nextHoliday ? (
            <View style={styles.spread}>
              <T variant="small" color={colors.ink} style={{ flex: 1 }}>
                {nextHoliday.title || 'Holiday'}
              </T>
              <T variant="small">{formatDate(nextHoliday.date)}</T>
            </View>
          ) : null}
          {nextExam ? (
            <View style={styles.spread}>
              <T variant="small" color={colors.ink} style={{ flex: 1 }}>
                {nextExam.title || 'Exam'}
              </T>
              <T variant="small">{formatDate(nextExam.date)}</T>
            </View>
          ) : null}
          {schedule.upcoming.slice(0, 4).map((session) => (
            <View key={session.id} style={styles.spread}>
              <T variant="small" color={colors.ink} style={{ flex: 1 }} numberOfLines={1}>
                {session.subject.name} at {session.startTime}
              </T>
              <T variant="small">{formatDate(session.date)}</T>
            </View>
          ))}
          {!nextHoliday && !nextExam && schedule.upcoming.length === 0 ? (
            <T variant="small">Nothing scheduled in the next week.</T>
          ) : null}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headline: {
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    padding: 20,
    gap: 16,
    overflow: 'hidden',
  },
  headlineTop: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  headlineStats: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  subjectRow: { paddingVertical: 12, gap: 8 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 6 },
  colNow: { width: 52, textAlign: 'right' },
  colMiss: { width: 66, textAlign: 'right' },
  colOne: { width: 66, textAlign: 'right' },
  num: { fontVariant: ['tabular-nums'] },
});
