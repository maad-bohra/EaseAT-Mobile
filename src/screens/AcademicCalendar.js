import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { CALENDAR_TYPE_LABELS, colors, radius } from '../theme';
import { DAY_SHORT, MONTH_NAMES, dayOfWeek, todayStr } from '../utils/dates';
import { messageOf } from '../utils/errors';
import { useLoad } from '../hooks/useLoad';
import { createEvent, createEventRange, deleteEvent, listEvents, updateEvent } from '../services/calendar.service';
import { DateField, Field, SelectField, SwitchRow, TextField } from '../components/Form';
import { Button, Card, Empty, ErrorNote, IconButton, Loading, T, TypePill } from '../components/Primitives';
import Screen from '../components/Screen';
import Sheet from '../components/Sheet';
import { useToast } from '../components/Toast';

const TYPE_OPTIONS = Object.entries(CALENDAR_TYPE_LABELS).map(([value, label]) => ({ value, label }));

const TYPE_HINTS = {
  HOLIDAY: 'Unmarked classes on this date are removed and no class is counted.',
  VACATION: 'Unmarked classes on these dates are removed and no class is counted.',
  WORKING_DAY: 'Classes run on this date even if it is also marked as a holiday.',
  SEMESTER_END: 'No classes are generated on or after this date.',
  EXAM: 'Shown on the dashboard and calendar. Classes still run.',
};

const blank = () => ({ date: todayStr(), until: todayStr(), several: false, type: 'HOLIDAY', title: '' });

export default function AcademicCalendar() {
  const toast = useToast();
  const { data: events, error, loading, reload, refresh, refreshing } = useLoad(() => listEvents());
  const [editing, setEditing] = useState(null); // 'new' | event
  const [form, setForm] = useState(blank);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  function openNew() {
    setForm(blank());
    setFormError('');
    setEditing('new');
  }

  function openEdit(event) {
    setForm({ date: event.date, until: event.date, several: false, type: event.type, title: event.title || '' });
    setFormError('');
    setEditing(event);
  }

  async function save() {
    setBusy(true);
    setFormError('');
    try {
      if (editing === 'new') {
        if (form.several) {
          const result = await createEventRange({ from: form.date, to: form.until, type: form.type, title: form.title });
          toast(result.skipped ? `${result.created} dates added, ${result.skipped} already there` : `${result.created} dates added`);
        } else {
          await createEvent({ date: form.date, type: form.type, title: form.title });
          toast('Date added');
        }
      } else {
        await updateEvent(editing.id, { date: form.date, type: form.type, title: form.title });
        toast('Date updated');
      }
      setEditing(null);
      reload();
    } catch (err) {
      setFormError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  function confirmRemove(event) {
    Alert.alert('Delete this date?', `${event.title || CALENDAR_TYPE_LABELS[event.type]} on ${event.date}`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteEvent(event.id);
            toast('Entry deleted');
            setEditing(null);
            reload();
          } catch (err) {
            toast(messageOf(err));
          }
        },
      },
    ]);
  }

  // Group by month, keeping date order.
  const months = [];
  for (const event of events || []) {
    const key = event.date.slice(0, 7);
    let group = months[months.length - 1];
    if (!group || group.key !== key) {
      group = { key, label: `${MONTH_NAMES[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`, items: [] };
      months.push(group);
    }
    group.items.push(event);
  }

  return (
    <Screen edges={['bottom']} onRefresh={refresh} refreshing={refreshing}>
      <T variant="small">
        Add holidays, exams and compensatory working days. Until you do, every timetabled class is generated.
      </T>
      <Button title="Add a date" icon="plus" variant="primary" onPress={openNew} />

      <ErrorNote error={error} />

      {loading ? (
        <Loading />
      ) : months.length === 0 ? (
        <Card>
          <Empty icon="calendar" title="Nothing added yet">
            Add holidays by hand and your classes adjust around them.
          </Empty>
        </Card>
      ) : (
        months.map((month) => (
          <View key={month.key} style={{ gap: 8 }}>
            <T variant="h3">{month.label}</T>
            <Card style={{ padding: 0 }}>
              {month.items.map((event, index) => (
                <View key={event.id} style={[styles.row, index > 0 && styles.rowBorder]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${event.title || CALENDAR_TYPE_LABELS[event.type]} on ${event.date}`}
                    onPress={() => openEdit(event)}
                    style={({ pressed }) => [styles.rowMain, pressed && { opacity: 0.7 }]}
                  >
                    <View style={styles.dateBlock}>
                      <T variant="h3" style={{ textAlign: 'center' }}>
                        {Number(event.date.slice(8, 10))}
                      </T>
                      <T variant="tiny" style={{ textAlign: 'center' }}>
                        {DAY_SHORT[dayOfWeek(event.date)]}
                      </T>
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <T variant="strong" numberOfLines={2}>
                        {event.title || CALENDAR_TYPE_LABELS[event.type]}
                      </T>
                      <TypePill type={event.type} />
                    </View>
                  </Pressable>
                  <IconButton icon="trash-2" label={`Delete ${event.title || CALENDAR_TYPE_LABELS[event.type]}`} size={40} onPress={() => confirmRemove(event)} />
                </View>
              ))}
            </Card>
          </View>
        ))
      )}

      <Sheet
        visible={editing !== null}
        title={editing === 'new' ? 'Add a calendar date' : 'Edit calendar date'}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button title="Cancel" flex onPress={() => setEditing(null)} />
            <Button title={editing === 'new' ? 'Add date' : 'Save changes'} variant="primary" flex loading={busy} onPress={save} />
          </>
        }
      >
        <ErrorNote error={formError} />
        <Field label={form.several && editing === 'new' ? 'First day' : 'Date'}>
          <DateField
            value={form.date}
            onChange={(date) => setForm({ ...form, date, until: form.until < date ? date : form.until })}
          />
        </Field>
        {editing === 'new' ? (
          <SwitchRow
            label="Several days in a row"
            hint="For a vacation or exam week."
            value={form.several}
            onValueChange={(several) => setForm({ ...form, several, until: form.until < form.date ? form.date : form.until })}
          />
        ) : null}
        {editing === 'new' && form.several ? (
          <Field label="Last day">
            <DateField value={form.until} onChange={(until) => setForm({ ...form, until })} accessibilityLabel="Last day" />
          </Field>
        ) : null}
        <Field label="Type" hint={TYPE_HINTS[form.type]}>
          <SelectField value={form.type} options={TYPE_OPTIONS} onChange={(type) => setForm({ ...form, type })} />
        </Field>
        <Field label="Name (optional)" hint="Gandhi Jayanti, Internal assessment I, and so on.">
          <TextField value={form.title} onChangeText={(title) => setForm({ ...form, title })} maxLength={120} />
        </Field>
        {editing && editing !== 'new' ? (
          <Button title="Delete this date" icon="trash-2" variant="danger" onPress={() => confirmRemove(editing)} />
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingRight: 8 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12 },
  dateBlock: {
    width: 46,
    paddingVertical: 4,
    borderRadius: radius.md,
    backgroundColor: colors.skySoft,
  },
});
