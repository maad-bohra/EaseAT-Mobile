import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../theme';
import { DAY_NAMES, DAY_SHORT, addDays, dayOfWeek, todayStr } from '../utils/dates';
import { messageOf } from '../utils/errors';
import { useLoad } from '../hooks/useLoad';
import { generateSessions } from '../services/session.service';
import { listSubjects } from '../services/subject.service';
import { createEntry, deleteEntry, getWeeklyTimetable, updateEntry } from '../services/timetable.service';
import { Chips, DateField, Field, FieldRow, SelectField, TextField, TimeField } from '../components/Form';
import { Button, Card, Dot, Empty, ErrorNote, IconButton, Loading, Note, PageHeader, T } from '../components/Primitives';
import Screen from '../components/Screen';
import Sheet from '../components/Sheet';
import { useToast } from '../components/Toast';

// Monday first, the way a college week reads.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_OPTIONS = WEEK_ORDER.map((d) => ({ value: d, label: DAY_SHORT[d] }));

const blank = (dayOfWeek = 1, subjectId = '') => ({
  subjectId,
  dayOfWeek,
  startTime: '09:00',
  endTime: '10:00',
  classroom: '',
  faculty: '',
});

export default function Timetable({ navigation }) {
  const toast = useToast();
  const [day, setDay] = useState(() => dayOfWeek(todayStr()));
  const [editing, setEditing] = useState(null); // 'new' | entry
  const [form, setForm] = useState(blank());
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [range, setRange] = useState({ from: todayStr(), to: addDays(todayStr(), 60) });
  const [genError, setGenError] = useState('');

  const { data, error, loading, reload, refresh, refreshing } = useLoad(async () => {
    const [week, subjects] = await Promise.all([getWeeklyTimetable(), listSubjects()]);
    return { week, subjects };
  });

  const subjects = data?.subjects || [];
  const subjectOptions = subjects.map((s) => ({ value: s.id, label: s.code ? `${s.name} (${s.code})` : s.name, color: s.color }));
  const entriesFor = (d) => data?.week.find((w) => w.dayOfWeek === d)?.entries || [];

  function openNew() {
    setForm(blank(day, subjects[0]?.id || ''));
    setFormError('');
    setEditing('new');
  }

  function openEdit(entry) {
    setForm({
      subjectId: entry.subjectId,
      dayOfWeek: entry.dayOfWeek,
      startTime: entry.startTime,
      endTime: entry.endTime,
      classroom: entry.classroom || '',
      faculty: entry.faculty || '',
    });
    setFormError('');
    setEditing(entry);
  }

  async function save() {
    setBusy(true);
    setFormError('');
    try {
      if (editing === 'new') {
        await createEntry(form);
        toast('Class added to the timetable');
      } else {
        await updateEntry(editing.id, form);
        toast('Class slot updated');
      }
      setDay(Number(form.dayOfWeek));
      setEditing(null);
      reload();
    } catch (err) {
      setFormError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  function confirmRemove(entry) {
    Alert.alert(
      `Remove ${entry.subject.name} at ${entry.startTime}?`,
      'Unmarked future classes go with it. Your marked history stays.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEntry(entry.id);
              toast('Class slot removed');
              reload();
            } catch (err) {
              toast(messageOf(err));
            }
          },
        },
      ],
    );
  }

  async function generate() {
    setBusy(true);
    setGenError('');
    try {
      const result = await generateSessions(range.from, range.to);
      toast(result.created > 0 ? `${result.created} classes created` : 'Everything is already up to date');
      setGenerating(false);
    } catch (err) {
      setGenError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  const entries = entriesFor(day);

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <PageHeader
        title="Weekly timetable"
        subtitle="Add each class separately. The same subject twice in one day is normal and gives two attendance sessions."
      />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button
          title="Generate"
          icon="refresh-cw"
          flex
          onPress={() => {
            setRange({ from: todayStr(), to: addDays(todayStr(), 60) });
            setGenError('');
            setGenerating(true);
          }}
        />
        <Button title="Add class" icon="plus" variant="primary" flex onPress={openNew} disabled={subjects.length === 0} />
      </View>

      <ErrorNote error={error} />

      {loading ? (
        <Loading />
      ) : subjects.length === 0 ? (
        <Card>
          <Empty
            icon="book-open"
            title="Add subjects first"
            action={<Button title="Go to subjects" variant="primary" onPress={() => navigation.navigate('Subjects')} />}
          >
            Timetable slots point at a subject, so start there.
          </Empty>
        </Card>
      ) : (
        <>
          <View style={styles.dayRow}>
            {WEEK_ORDER.map((d) => {
              const active = d === day;
              const count = entriesFor(d).length;
              return (
                <Pressable
                  key={d}
                  accessibilityRole="button"
                  accessibilityLabel={`${DAY_NAMES[d]}, ${count} ${count === 1 ? 'class' : 'classes'}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => setDay(d)}
                  style={[styles.dayChip, active && styles.dayChipActive]}
                >
                  <Text style={[styles.dayLabel, active && { color: colors.navyDeep, fontFamily: fonts.bodySemi }]}>
                    {DAY_SHORT[d]}
                  </Text>
                  <Text style={[styles.dayCount, active && { color: colors.navyDeep }]}>{count > 0 ? count : '–'}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ gap: 10 }}>
            <T variant="h2">{DAY_NAMES[day]}</T>
            {entries.length === 0 ? (
              <Card>
                <Empty icon="clock" title={`Nothing on ${DAY_NAMES[day]}`}>
                  Add the classes you have that day.
                </Empty>
              </Card>
            ) : (
              entries.map((entry) => (
                <View key={entry.id} style={[styles.slot, { borderLeftColor: entry.subject.color }]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T variant="num">
                      {entry.startTime}–{entry.endTime}
                    </T>
                    <View style={styles.nameRow}>
                      <Dot color={entry.subject.color} />
                      <T variant="strong" numberOfLines={1} style={{ flexShrink: 1 }}>
                        {entry.subject.name}
                      </T>
                    </View>
                    {entry.classroom || entry.faculty ? (
                      <View style={styles.metaRow}>
                        {entry.classroom ? <T variant="tiny">Room {entry.classroom}</T> : null}
                        {entry.faculty ? <T variant="tiny">{entry.faculty}</T> : null}
                      </View>
                    ) : null}
                  </View>
                  <IconButton icon="edit-2" label={`Edit ${entry.subject.name} at ${entry.startTime}`} size={40} onPress={() => openEdit(entry)} />
                  <IconButton icon="trash-2" label={`Remove ${entry.subject.name} at ${entry.startTime}`} size={40} onPress={() => confirmRemove(entry)} />
                </View>
              ))
            )}
            <Button title={`Add a class on ${DAY_NAMES[day]}`} icon="plus" onPress={openNew} />
          </View>
        </>
      )}

      <Sheet
        visible={editing !== null}
        title={editing === 'new' ? 'Add class' : 'Edit class'}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button title="Cancel" flex onPress={() => setEditing(null)} />
            <Button title="Save class" variant="primary" flex loading={busy} onPress={save} />
          </>
        }
      >
        <ErrorNote error={formError} />
        <Field label="Subject">
          <SelectField
            value={form.subjectId}
            options={subjectOptions}
            placeholder="Choose a subject"
            onChange={(subjectId) => setForm({ ...form, subjectId })}
          />
        </Field>
        <Field label="Day">
          <Chips options={DAY_OPTIONS} value={Number(form.dayOfWeek)} onChange={(d) => setForm({ ...form, dayOfWeek: d })} />
        </Field>
        <FieldRow>
          <Field label="Starts">
            <TimeField value={form.startTime} onChange={(startTime) => setForm({ ...form, startTime })} accessibilityLabel="Start time" />
          </Field>
          <Field label="Ends">
            <TimeField value={form.endTime} onChange={(endTime) => setForm({ ...form, endTime })} accessibilityLabel="End time" />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Room">
            <TextField value={form.classroom} onChangeText={(classroom) => setForm({ ...form, classroom })} maxLength={40} />
          </Field>
          <Field label="Faculty">
            <TextField value={form.faculty} onChangeText={(faculty) => setForm({ ...form, faculty })} maxLength={80} />
          </Field>
        </FieldRow>
      </Sheet>

      <Sheet
        visible={generating}
        title="Generate classes"
        onClose={() => setGenerating(false)}
        footer={
          <>
            <Button title="Cancel" flex onPress={() => setGenerating(false)} />
            <Button title="Generate" variant="primary" flex loading={busy} onPress={generate} />
          </>
        }
      >
        <ErrorNote error={genError} />
        <Note>
          The next 60 days are created automatically each time you open the app. Use this to fill in earlier weeks, for
          example from the start of the semester. Marks you already made are never changed, and holidays are skipped.
        </Note>
        <Field label="From">
          <DateField value={range.from} onChange={(from) => setRange({ ...range, from })} accessibilityLabel="From date" />
        </Field>
        <Field label="To" hint="Up to 400 days at a time.">
          <DateField value={range.to} onChange={(to) => setRange({ ...range, to })} accessibilityLabel="To date" />
        </Field>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dayRow: { flexDirection: 'row', gap: 6 },
  dayChip: {
    flex: 1,
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dayChipActive: { backgroundColor: colors.sky, borderColor: colors.sky },
  dayLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkSoft },
  dayCount: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.muted },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 4,
    borderRadius: radius.md,
    padding: 12,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
});
