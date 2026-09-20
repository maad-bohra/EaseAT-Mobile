import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../theme';
import { formatTimestamp } from '../utils/dates';
import { messageOf } from '../utils/errors';
import { useLoad } from '../hooks/useLoad';
import { deleteNotification, listNotifications, markAllRead, markRead, refreshNotifications } from '../services/notification.service';
import { Button, Card, Empty, ErrorNote, IconButton, Loading, T } from '../components/Primitives';
import Screen from '../components/Screen';
import { useToast } from '../components/Toast';

export default function Notifications() {
  const toast = useToast();
  const { data: items, error, loading, reload, refresh, refreshing } = useLoad(async () => {
    await refreshNotifications().catch(() => {});
    return listNotifications({ limit: 50 });
  });

  async function run(task, message) {
    try {
      await task();
      if (message) toast(message);
      reload();
    } catch (err) {
      toast(messageOf(err));
    }
  }

  const unread = (items || []).filter((n) => !n.read).length;

  return (
    <Screen edges={['bottom']} onRefresh={refresh} refreshing={refreshing}>
      <T variant="small">Attendance warnings, holidays, exams and classes still waiting to be marked.</T>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button title="Check now" icon="refresh-cw" flex onPress={() => run(async () => {}, 'Up to date')} />
        <Button
          title="Mark all read"
          icon="check"
          variant="primary"
          flex
          disabled={unread === 0}
          onPress={() => run(() => markAllRead(), 'All marked as read')}
        />
      </View>

      <ErrorNote error={error} />

      {loading ? (
        <Loading />
      ) : items?.length === 0 ? (
        <Card>
          <Empty icon="bell" title="Nothing to report">
            Warnings appear here as soon as a subject drifts towards the limit.
          </Empty>
        </Card>
      ) : (
        <Card style={{ padding: 0 }}>
          {items?.map((item, index) => (
            <View key={item.id} style={[styles.row, index > 0 && styles.rowBorder]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.title}. ${item.read ? 'Read' : 'Unread, tap to mark as read'}`}
                onPress={() => (item.read ? null : run(() => markRead(item.id)))}
                style={styles.main}
              >
                <View style={[styles.dot, item.read && { backgroundColor: 'transparent' }]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T variant="strong">{item.title}</T>
                  <T variant="small">{item.message}</T>
                  <T variant="tiny">{formatTimestamp(item.createdAt)}</T>
                </View>
              </Pressable>
              <IconButton
                icon="trash-2"
                label={`Delete ${item.title}`}
                size={40}
                onPress={() => run(() => deleteNotification(item.id))}
              />
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingRight: 8, paddingVertical: 4 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  main: { flex: 1, flexDirection: 'row', gap: 12, padding: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.skyDeep, marginTop: 8 },
});
