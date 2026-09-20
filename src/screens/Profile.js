import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { messageOf } from '../utils/errors';
import { useLoad } from '../hooks/useLoad';
import { eraseAllData, getSettings, updateSettings } from '../services/settings.service';
import { Field, FieldRow, TextField } from '../components/Form';
import { Button, Card, CardHead, ErrorNote, Loading, T } from '../components/Primitives';
import Screen from '../components/Screen';
import { useToast } from '../components/Toast';

export default function Profile() {
  const toast = useToast();
  const { data: settings, loading, reload } = useLoad(() => getSettings());
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        name: settings.name,
        collegeName: settings.collegeName,
        semester: settings.semester == null ? '' : String(settings.semester),
        year: settings.year == null ? '' : String(settings.year),
        requiredAttendance: String(settings.requiredAttendance),
      });
    }
  }, [settings]);

  async function save() {
    setBusy(true);
    setError('');
    try {
      await updateSettings(form);
      toast('Profile saved');
      reload();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  function confirmErase() {
    Alert.alert(
      'Erase all data?',
      'This deletes every subject, timetable slot, attendance record and calendar date on this phone. It cannot be undone.',
      [
        { text: 'Keep my data', style: 'cancel' },
        {
          text: 'Erase everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await eraseAllData();
              toast('All data erased');
              reload();
            } catch (err) {
              toast(messageOf(err));
            }
          },
        },
      ],
    );
  }

  if (loading || !form) {
    return (
      <Screen edges={['bottom']}>
        <Loading rows={3} />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <T variant="small">Your default attendance requirement applies to every subject that does not set its own.</T>

      <Card>
        <CardHead title="Details" />
        <ErrorNote error={error} />
        <Field label="Name">
          <TextField value={form.name} onChangeText={(name) => setForm({ ...form, name })} maxLength={80} autoCapitalize="words" />
        </Field>
        <FieldRow>
          <Field label="Semester">
            <TextField value={form.semester} onChangeText={(semester) => setForm({ ...form, semester })} keyboardType="number-pad" maxLength={2} />
          </Field>
          <Field label="Year">
            <TextField value={form.year} onChangeText={(year) => setForm({ ...form, year })} keyboardType="number-pad" maxLength={1} />
          </Field>
        </FieldRow>
        <Field label="College">
          <TextField value={form.collegeName} onChangeText={(collegeName) => setForm({ ...form, collegeName })} maxLength={120} autoCapitalize="words" />
        </Field>
        <Field label="Required attendance %">
          <TextField
            value={form.requiredAttendance}
            onChangeText={(requiredAttendance) => setForm({ ...form, requiredAttendance })}
            keyboardType="decimal-pad"
            maxLength={5}
          />
        </Field>
        <Button title="Save changes" variant="primary" loading={busy} onPress={save} />
      </Card>

      <Card>
        <CardHead title="Your data" icon="layers" />
        <T variant="small" style={{ marginBottom: 12 }}>
          Everything is stored only on this phone and works without internet. There is no account and nothing is
          uploaded. Uninstalling the app deletes your data.
        </T>
        <Button title="Erase all data" icon="trash-2" variant="danger" onPress={confirmErase} />
      </Card>
    </Screen>
  );
}
