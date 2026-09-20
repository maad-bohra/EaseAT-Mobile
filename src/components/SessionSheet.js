import React, { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { colors } from '../theme';
import { formatDateLong } from '../utils/dates';
import { messageOf } from '../utils/errors';
import { rescheduleClass } from '../services/actions';
import { deleteSession, updateSessionStatus } from '../services/session.service';
import { DateField, Field, FieldRow, TextField, TimeField } from './Form';
import { Button, ErrorNote, Note, T } from './Primitives';
import Sheet from './Sheet';
import { useToast } from './Toast';

const STATUS_TOAST = {
  PRESENT: 'Marked present',
  ABSENT: 'Marked absent',
  CANCELLED: 'Class cancelled',
  PENDING: 'Mark cleared',
};

/**
 * Everything you can do to one class: mark it, clear the mark, move it to
 * another time, or (for one-off and moved classes) remove it.
 */
export default function SessionSheet({ session, onClose, onChanged }) {
  const toast = useToast();
  const [mode, setMode] = useState('actions');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [move, setMove] = useState({ date: '', startTime: '', endTime: '', reason: '' });

  useEffect(() => {
    if (session) {
      setMode('actions');
      setError('');
      setMove({ date: session.date, startTime: session.startTime, endTime: session.endTime, reason: '' });
    }
  }, [session]);

  if (!session) return null;

  // Timetable classes come back on their own when the timetable is regenerated,
  // so cancelling is the right way to drop them. Only hand-made and moved
  // classes can be removed outright.
  const canRemove = !session.timetableEntryId || session.isRescheduled;

  async function mark(status) {
    setBusy(true);
    try {
      await updateSessionStatus(session.id, { status });
      toast(STATUS_TOAST[status]);
      onChanged?.();
      onClose();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  function confirmRemove() {
    Alert.alert('Remove this class?', `${session.subject.name} on ${formatDateLong(session.date)} will be deleted.`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSession(session.id);
            toast('Class removed');
            onChanged?.();
            onClose();
          } catch (err) {
            setError(messageOf(err));
          }
        },
      },
    ]);
  }

  async function submitMove() {
    setBusy(true);
    setError('');
    try {
      await rescheduleClass(session.id, move);
      toast('Class moved');
      onChanged?.();
      onClose();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  const subtitle = `${formatDateLong(session.date)}, ${session.startTime}–${session.endTime}`;

  if (mode === 'move') {
    return (
      <Sheet
        visible
        title={`Move ${session.subject.name}`}
        subtitle={subtitle}
        onClose={onClose}
        footer={
          <>
            <Button title="Back" flex onPress={() => setMode('actions')} />
            <Button title="Move class" variant="primary" flex loading={busy} onPress={submitMove} />
          </>
        }
      >
        <ErrorNote error={error} />
        <Note>The original class is marked cancelled and kept in your history. The new slot counts normally.</Note>
        <Field label="New date">
          <DateField value={move.date} onChange={(date) => setMove({ ...move, date })} accessibilityLabel="New date" />
        </Field>
        <FieldRow>
          <Field label="Starts">
            <TimeField value={move.startTime} onChange={(startTime) => setMove({ ...move, startTime })} accessibilityLabel="Start time" />
          </Field>
          <Field label="Ends">
            <TimeField value={move.endTime} onChange={(endTime) => setMove({ ...move, endTime })} accessibilityLabel="End time" />
          </Field>
        </FieldRow>
        <Field label="Reason (optional)">
          <TextField
            value={move.reason}
            onChangeText={(reason) => setMove({ ...move, reason })}
            placeholder="Faculty on leave"
            maxLength={200}
          />
        </Field>
      </Sheet>
    );
  }

  return (
    <Sheet visible title={session.subject.name} subtitle={subtitle} onClose={onClose}>
      <ErrorNote error={error} />
      <T variant="label" style={{ marginBottom: 8 }}>
        Mark this class
      </T>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <Button title="Present" variant="primary" flex disabled={busy} onPress={() => mark('PRESENT')} />
        <Button title="Absent" variant="danger" flex disabled={busy} onPress={() => mark('ABSENT')} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <Button title="Cancelled" flex disabled={busy} onPress={() => mark('CANCELLED')} />
        {session.status !== 'PENDING' ? (
          <Button title="Clear mark" flex disabled={busy} onPress={() => mark('PENDING')} />
        ) : null}
      </View>
      <View style={{ height: 1, backgroundColor: colors.line, marginBottom: 16 }} />
      <Button title="Move to another time" icon="corner-up-right" onPress={() => setMode('move')} style={{ marginBottom: 8 }} />
      {canRemove ? <Button title="Remove this class" icon="trash-2" variant="danger" onPress={confirmRemove} /> : null}
    </Sheet>
  );
}
