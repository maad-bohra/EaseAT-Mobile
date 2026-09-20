import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { colors } from '../theme';
import { messageOf } from '../utils/errors';
import { useLoad } from '../hooks/useLoad';
import { SUBJECT_COLORS, createSubject, deleteSubject, listSubjects, updateSubject } from '../services/subject.service';
import { ColorPicker, Field, FieldRow, TextField } from '../components/Form';
import { Button, Card, Empty, ErrorNote, Loading, T } from '../components/Primitives';
import Screen from '../components/Screen';
import Sheet from '../components/Sheet';
import { useToast } from '../components/Toast';

const blank = { name: '', code: '', faculty: '', credits: '', color: SUBJECT_COLORS[0], requiredAttendance: '' };

export default function Subjects() {
  const toast = useToast();
  const { data: subjects, error, loading, reload, refresh, refreshing } = useLoad(() => listSubjects());
  const [editing, setEditing] = useState(null); // 'new' | subject
  const [form, setForm] = useState(blank);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  function openNew() {
    setForm(blank);
    setFormError('');
    setEditing('new');
  }

  function openEdit(subject) {
    setForm({
      name: subject.name,
      code: subject.code || '',
      faculty: subject.faculty || '',
      credits: subject.credits == null ? '' : String(subject.credits),
      color: subject.color,
      requiredAttendance: subject.requiredAttendance == null ? '' : String(subject.requiredAttendance),
    });
    setFormError('');
    setEditing(subject);
  }

  async function save() {
    setBusy(true);
    setFormError('');
    try {
      if (editing === 'new') {
        await createSubject(form);
        toast('Subject added');
      } else {
        await updateSubject(editing.id, form);
        toast('Subject updated');
      }
      setEditing(null);
      reload();
    } catch (err) {
      setFormError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(subject) {
    Alert.alert(
      `Delete ${subject.name}?`,
      `This removes its timetable slots and ${subject.sessionCount} attendance ${subject.sessionCount === 1 ? 'record' : 'records'}. It cannot be undone.`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSubject(subject.id);
              toast('Subject deleted');
              reload();
            } catch (err) {
              toast(messageOf(err));
            }
          },
        },
      ],
    );
  }

  return (
    <Screen edges={['bottom']} onRefresh={refresh} refreshing={refreshing}>
      <T variant="small">Each subject carries its own colour and can override the attendance requirement.</T>
      <Button title="Add subject" icon="plus" variant="primary" onPress={openNew} />

      <ErrorNote error={error} />

      {loading ? (
        <Loading />
      ) : subjects?.length === 0 ? (
        <Card>
          <Empty icon="book-open" title="No subjects yet">
            Start with the subjects on your semester card. Timetable slots attach to them.
          </Empty>
        </Card>
      ) : (
        subjects?.map((subject) => (
          <Card key={subject.id} style={{ gap: 12 }}>
            <View style={styles.top}>
              <View style={[styles.swatch, { backgroundColor: subject.color }]} />
              <View style={{ flex: 1 }}>
                <T variant="h3" numberOfLines={2}>
                  {subject.name}
                </T>
                {subject.code || subject.faculty ? (
                  <T variant="small" numberOfLines={1}>
                    {[subject.code, subject.faculty].filter(Boolean).join(', ')}
                  </T>
                ) : null}
              </View>
            </View>
            <View style={styles.facts}>
              <View style={styles.fact}>
                <T variant="tiny">Credits</T>
                <T variant="num">{subject.credits ?? '—'}</T>
              </View>
              <View style={styles.fact}>
                <T variant="tiny">Required</T>
                <T variant="num">{subject.requiredAttendance ? `${subject.requiredAttendance}%` : 'Default'}</T>
              </View>
              <View style={styles.fact}>
                <T variant="tiny">Weekly classes</T>
                <T variant="num">{subject.weeklyClasses}</T>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title="Edit" icon="edit-2" size="sm" flex onPress={() => openEdit(subject)} />
              <Button title="Delete" icon="trash-2" variant="danger" size="sm" flex onPress={() => confirmDelete(subject)} />
            </View>
          </Card>
        ))
      )}

      <Sheet
        visible={editing !== null}
        title={editing === 'new' ? 'Add subject' : `Edit ${editing?.name ?? ''}`}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button title="Cancel" flex onPress={() => setEditing(null)} />
            <Button title="Save subject" variant="primary" flex loading={busy} onPress={save} />
          </>
        }
      >
        <ErrorNote error={formError} />
        <Field label="Name">
          <TextField value={form.name} onChangeText={(name) => setForm({ ...form, name })} maxLength={80} autoCapitalize="words" />
        </Field>
        <FieldRow>
          <Field label="Code">
            <TextField value={form.code} onChangeText={(code) => setForm({ ...form, code })} placeholder="CS301" maxLength={20} autoCapitalize="characters" />
          </Field>
          <Field label="Credits">
            <TextField value={form.credits} onChangeText={(credits) => setForm({ ...form, credits })} keyboardType="number-pad" maxLength={2} />
          </Field>
        </FieldRow>
        <Field label="Faculty">
          <TextField value={form.faculty} onChangeText={(faculty) => setForm({ ...form, faculty })} maxLength={80} autoCapitalize="words" />
        </Field>
        <Field label="Required attendance %" hint="Leave blank to use your default from Profile.">
          <TextField
            value={form.requiredAttendance}
            onChangeText={(requiredAttendance) => setForm({ ...form, requiredAttendance })}
            keyboardType="decimal-pad"
            maxLength={5}
          />
        </Field>
        <Field label="Colour">
          <ColorPicker value={form.color} onChange={(color) => setForm({ ...form, color })} colorsList={SUBJECT_COLORS} />
        </Field>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  swatch: { width: 14, alignSelf: 'stretch', minHeight: 40, borderRadius: 5 },
  facts: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: 10,
  },
  fact: { flex: 1, gap: 2 },
});
