import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { colors, radius } from '../theme';
import { useLoad } from '../hooks/useLoad';
import { countUnread } from '../services/notification.service';
import { getSettings } from '../services/settings.service';
import { Card, PageHeader, T } from '../components/Primitives';
import Screen from '../components/Screen';

const ITEMS = [
  { route: 'Subjects', icon: 'book-open', title: 'Subjects', text: 'Colours, credits and requirements' },
  { route: 'AcademicCalendar', icon: 'flag', title: 'Academic calendar', text: 'Holidays, exams and working days' },
  { route: 'Notifications', icon: 'bell', title: 'Notifications', text: 'Warnings and reminders', badge: true },
  { route: 'Profile', icon: 'user', title: 'Profile', text: 'Your details and default requirement' },
];

export default function More({ navigation }) {
  const { data } = useLoad(async () => ({ unread: await countUnread(), settings: await getSettings() }));
  const name = data?.settings.name.trim();

  return (
    <Screen>
      <PageHeader title="More" subtitle={name ? `EaseAT for ${name}` : 'EaseAT attendance tracker'} />
      <Card style={{ padding: 0 }}>
        {ITEMS.map((item, index) => (
          <Pressable
            key={item.route}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            onPress={() => navigation.navigate(item.route)}
            style={({ pressed }) => [styles.row, index > 0 && styles.rowBorder, pressed && { backgroundColor: colors.skySoft }]}
          >
            <View style={styles.icon}>
              <Feather name={item.icon} size={20} color={colors.navy} />
            </View>
            <View style={{ flex: 1 }}>
              <T variant="strong">{item.title}</T>
              <T variant="tiny">{item.text}</T>
            </View>
            {item.badge && data?.unread ? (
              <View style={styles.badge}>
                <T variant="smallStrong" color={colors.navyDeep}>
                  {data.unread}
                </T>
              </View>
            ) : null}
            <Feather name="chevron-right" size={20} color={colors.muted} />
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, minHeight: 68 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  icon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.skySoftStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 7,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
