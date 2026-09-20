import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';
import { addDays, formatDateLong, todayStr } from '../utils/dates';
import { messageOf } from '../utils/errors';
import { useLoad } from '../hooks/useLoad';
import { getSubjectPrediction } from '../services/attendance.service';
import { createSession, listSessions, updateSessionStatus } from '../services/session.service';
import { listSubjects } from '../services/subject.service';
import { DateField, Field, FieldRow, SelectField, TextField, TimeField } from '../components/Form';
import { Button, Card, CardHead, Empty, ErrorNote, Loading, Meter, Note, PageHeader, T } from '../components/Primitives';
import Screen from '../components/Screen';
import SessionRow from '../components/SessionRow';
import SessionSheet from '../components/SessionSheet';
import Sheet from '../components/Sheet';
import { useToast } from '../components/Toast';

const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  { value: 'PENDING', label: 'Not marked' },
  { value: 'PRESENT', label: 'Present' },
  { value: 'ABSENT', label: 'Absent' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const blankClass = () => ({ subjectId: '', date: todayStr(), startTime: '09:00', endTime: '10:00', notes: '' });

export default function Attendance() {
  const toast = useToast();
  const [filters, setFilters] = useState(() => ({
    from: addDays(todayStr(), -14),
    to: addDays(todayStr(), 14),
    subjectId: '',
    status: '',
  }));
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(blankClass);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);
  const anchorY = useRef(null);
  const scrolledFor = useRef('');

  const { data, error, loading, reload, refresh, refreshing } = useLoad(async () => {
    const [sessions, subjects, prediction] = await Promise.all([
      listSessions({
        from: filters.from,
        to: filters.to,
        subjectId: filters.subjectId || undefined,
        status: filters.status || undefined,
      }),
      listSubjects(),
      filters.subjectId ? getSubjectPrediction(filters.subjectId) : Promise.resolve(null),
    ]);
    return { sessions, subjects, prediction };
  }, [filters]);

  const subjectOptions = (data?.subjects || []).map((s) => ({ value: s.id, label: s.name, color: s.color }));

  async function quickMark(session, status) {
    try {
      await updateSessionStatus(session.id, { status });
      toast(`${session.subject.name} at ${session.startTime} marked ${status.toLowerCase()}`);
      reload();
    } catch (err) {
      toast(messageOf(err));
    }
  }

  function openAdd() {
    setForm({ ...blankClass(), subjectId: filters.subjectId || data?.subjects?.[0]?.id || '' });
    setFormError('');
    setAdding(true);
  }

  async function saveClass() {
    setBusy(true);
    setFormError('');
    try {
      await createSession({
        subjectId: form.subjectId,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        notes: form.notes,
      });
      toast('Class added');
      setAdding(false);
      reload();
    } catch (err) {
      setFormError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  const grouped = (data?.sessions || []).reduce((acc, session) => {
    (acc[session.date] = acc[session.date] || []).push(session);
    return acc;
  }, {});
  const days = Object.keys(grouped).sort();
  // The list starts two weeks back; open it at today, or the next day with classes.
  const anchorDate = days.find((d) => d >= todayStr());

  useEffect(() => {
    const key = `${filters.from}|${filters.to}|${filters.subjectId}|${filters.status}`;
    if (!data || scrolledFor.current === key) return;
    scrolledFor.current = key;
    const id = setTimeout(() => {
      if (anchorY.current != null) scrollRef.current?.scrollTo({ y: Math.max(0, anchorY.current - 8), animated: false });
    }, 60);
    return () => clearTimeout(id);
  }, [data, filters]);
  const filterCount = (filters.subjectId ? 1 : 0) + (filters.status ? 1 : 0);
  const prediction = data?.prediction;
  const need85 = prediction?.targets.find((t) => t.target === 85)?.classesNeeded;

  return (
    <Screen ref={scrollRef} onRefresh={refresh} refreshing={refreshing}>
      <PageHeader
        title="Attendance"
        subtitle="Every row is one class. Cancelled classes stay in the history but never touch the percentage."
      />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button
          title={showFilters ? 'Hide filters' : filterCount ? `Filters (${filterCount})` : 'Filters'}
          icon="sliders"
          flex
          onPress={() => setShowFilters((v) => !v)}
        />
        <Button title="Add class" icon="plus" variant="primary" flex onPress={openAdd} disabled={!data || data.subjects.length === 0} />
      </View>

      {showFilters ? (
        <Card>
          <FieldRow>
            <Field label="From">
              <DateField value={filters.from} onChange={(from) => setFilters({ ...filters, from })} accessibilityLabel="From date" />
            </Field>
            <Field label="To">
              <DateField value={filters.to} onChange={(to) => setFilters({ ...filters, to })} accessibilityLabel="To date" />
            </Field>
          </FieldRow>
          <Field label="Subject">
            <SelectField
              value={filters.subjectId}
              options={[{ value: '', label: 'All subjects' }, ...subjectOptions]}
              onChange={(subjectId) => setFilters({ ...filters, subjectId })}
            />
          </Field>
          <Field label="Status" style={{ marginBottom: 0 }}>
            <SelectField
              value={filters.status}
              options={STATUS_OPTIONS}
              onChange={(status) => setFilters({ ...filters, status })}
            />
          </Field>
        </Card>
      ) : null}

      <ErrorNote error={error} />

      {prediction ? (
        <Card>
          <CardHead title={prediction.subject.name} right={<T variant="num">{prediction.current}%</T>} />
          <T variant="tiny" style={{ marginBottom: 6 }}>
            {prediction.counted} counted classes
          </T>
          <Meter value={prediction.current} required={prediction.required} />
          <T variant="body" style={{ marginVertical: 10 }}>
            {prediction.message}
          </T>
          <View style={styles.projections}>
            <View style={styles.projection}>
              <T variant="tiny">If you miss the next class</T>
              <T variant="num">{prediction.projections.ifMissNext1}%</T>
            </View>
            <View style={styles.projection}>
              <T variant="tiny">If you attend the next 3</T>
              <T variant="num">{prediction.projections.ifAttendNext3}%</T>
            </View>
            <View style={styles.projection}>
              <T variant="tiny">To reach 85%</T>
              <T variant="num">{need85 == null ? '—' : `${need85} classes`}</T>
            </View>
          </View>
        </Card>
      ) : null}

      {loading ? (
        <Loading />
      ) : days.length === 0 ? (
        <Card>
          <Empty icon="calendar" title="No classes in this range">
            {data?.subjects.length === 0
              ? 'Add a subject and a timetable first, then your classes appear here.'
              : 'Adjust the dates, or generate classes from the Timetable tab.'}
          </Empty>
        </Card>
      ) : (
        days.map((date) => {
          const rows = grouped[date];
          const present = rows.filter((r) => r.status === 'PRESENT').length;
          const absent = rows.filter((r) => r.status === 'ABSENT').length;
          return (
            <View
              key={date}
              style={{ gap: 8 }}
              onLayout={date === anchorDate ? (e) => { anchorY.current = e.nativeEvent.layout.y; } : undefined}
            >
              <View style={styles.dayHead}>
                <T variant="h3">{formatDateLong(date)}</T>
                {present + absent > 0 ? (
                  <T variant="tiny">
                    {present} present, {absent} absent
                  </T>
                ) : null}
              </View>
              {rows.map((session) => (
                <SessionRow key={session.id} session={session} onPress={setSelected} onMark={quickMark} />
              ))}
            </View>
          );
        })
      )}

      <SessionSheet session={selected} onClose={() => setSelected(null)} onChanged={reload} />

      <Sheet
        visible={adding}
        title="Add a one-off class"
        onClose={() => setAdding(false)}
        footer={
          <>
            <Button title="Cancel" flex onPress={() => setAdding(false)} />
            <Button title="Add class" variant="primary" flex loading={busy} onPress={saveClass} />
          </>
        }
      >
        <ErrorNote error={formError} />
        <Note>For an extra lab or a make-up class that is not on the weekly timetable.</Note>
        <Field label="Subject">
          <SelectField
            value={form.subjectId}
            options={subjectOptions}
            placeholder="Choose a subject"
            onChange={(subjectId) => setForm({ ...form, subjectId })}
          />
        </Field>
        <Field label="Date">
          <DateField value={form.date} onChange={(date) => setForm({ ...form, date })} />
        </Field>
        <FieldRow>
          <Field label="Starts">
            <TimeField value={form.startTime} onChange={(startTime) => setForm({ ...form, startTime })} />
          </Field>
          <Field label="Ends">
            <TimeField value={form.endTime} onChange={(endTime) => setForm({ ...form, endTime })} />
          </Field>
        </FieldRow>
        <Field label="Note (optional)">
          <TextField
            value={form.notes}
            onChangeText={(notes) => setForm({ ...form, notes })}
            placeholder="Extra lab"
            maxLength={300}
          />
        </Field>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  projections: { gap: 10 },
  projection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 10,
  },
  dayHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 },
});
