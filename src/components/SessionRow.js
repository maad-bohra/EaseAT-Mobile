import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { STATUS_COLORS, colors, radius } from '../theme';
import { Button, Dot, Pill, StatusPill, T } from './Primitives';

/**
 * One class. With `onMark` and an unmarked class it shows quick Present /
 * Absent / Cancelled buttons; with `onPress` the whole row opens the class sheet.
 */
export default function SessionRow({ session, onPress, onMark }) {
  const tone = STATUS_COLORS[session.status] || STATUS_COLORS.PENDING;
  const quick = Boolean(onMark) && session.status === 'PENDING';

  const body = (
    <View
      style={[
        styles.row,
        { borderLeftColor: tone.fg },
        session.status === 'CANCELLED' && { opacity: 0.75 },
      ]}
    >
      <View style={styles.top}>
        <T variant="num" style={{ width: 50 }}>
          {session.startTime}
        </T>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.nameRow}>
            <Dot color={session.subject.color} />
            <T variant="strong" numberOfLines={1} style={{ flexShrink: 1 }}>
              {session.subject.name}
            </T>
            {session.isRescheduled ? <Pill label="Moved" outline /> : null}
          </View>
          <View style={styles.metaRow}>
            <T variant="tiny">
              {session.startTime}–{session.endTime}
            </T>
            {session.classroom ? <T variant="tiny">Room {session.classroom}</T> : null}
          </View>
          {session.notes ? (
            <T variant="tiny" numberOfLines={2}>
              {session.notes}
            </T>
          ) : null}
        </View>
        {!quick ? <StatusPill status={session.status} /> : null}
      </View>

      {quick ? (
        <View style={styles.actions}>
          <Button title="Present" variant="primary" size="sm" flex onPress={() => onMark(session, 'PRESENT')} />
          <Button title="Absent" variant="danger" size="sm" flex onPress={() => onMark(session, 'ABSENT')} />
          <Button title="Cancelled" size="sm" flex onPress={() => onMark(session, 'CANCELLED')} />
        </View>
      ) : null}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${session.subject.name} at ${session.startTime}, ${session.status.toLowerCase()}`}
      onPress={() => onPress(session)}
      style={({ pressed }) => pressed && { opacity: 0.85 }}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 4,
    borderRadius: radius.md,
    padding: 12,
    gap: 10,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  actions: { flexDirection: 'row', gap: 8 },
});
