import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { CALENDAR_TYPE_LABELS, STATUS_COLORS, STATUS_LABELS, colors, fonts, radius, shadow } from '../theme';

/* ------------------------------ text ------------------------------ */

const textVariants = {
  h1: { fontFamily: fonts.display, fontSize: 28, lineHeight: 36, color: colors.ink, letterSpacing: -0.2 },
  h2: { fontFamily: fonts.display, fontSize: 21, lineHeight: 28, color: colors.ink },
  h3: { fontFamily: fonts.display, fontSize: 17, lineHeight: 24, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink },
  strong: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 22, color: colors.ink },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.inkSoft },
  smallStrong: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 19, color: colors.ink },
  tiny: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.muted },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  num: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 22, color: colors.ink, fontVariant: ['tabular-nums'] },
};

export function T({ variant = 'body', color, style, children, ...rest }) {
  return (
    <Text style={[textVariants[variant], color ? { color } : null, style]} {...rest}>
      {children}
    </Text>
  );
}

/* ------------------------------ layout ------------------------------ */

export function Card({ tint, style, children }) {
  return (
    <View
      style={[
        styles.card,
        tint === 'sky' && { backgroundColor: colors.skySoft, borderColor: colors.skySoftStrong },
        tint === 'cream' && { backgroundColor: colors.cream, borderColor: colors.creamLine },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function CardHead({ title, right, icon, iconTone = 'sky', level = 'h3' }) {
  return (
    <View style={styles.cardHead}>
      <View style={styles.cardHeadLeft}>
        {icon ? (
          <View style={[styles.cardIcon, { backgroundColor: iconTone === 'amber' ? colors.amberSoft : colors.skySoftStrong }]}>
            <Feather name={icon} size={19} color={colors.navy} />
          </View>
        ) : null}
        <T variant={level} style={{ flexShrink: 1 }}>
          {title}
        </T>
      </View>
      {right}
    </View>
  );
}

export function PageHeader({ title, subtitle, right }) {
  return (
    <View style={styles.pageHead}>
      <View style={{ flex: 1 }}>
        <T variant="h1">{title}</T>
        {subtitle ? (
          <T variant="small" style={{ marginTop: 2 }}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function Divider({ style }) {
  return <View style={[{ height: 1, backgroundColor: colors.line }, style]} />;
}

/* ------------------------------ buttons ------------------------------ */

const buttonVariants = {
  default: { bg: '#fff', border: colors.lineStrong, fg: colors.ink },
  primary: { bg: colors.present, border: colors.present, fg: '#fff' },
  navy: { bg: colors.navy, border: colors.navy, fg: '#fff' },
  danger: { bg: '#fff', border: '#F2CDC6', fg: colors.absent },
  ghost: { bg: 'transparent', border: 'transparent', fg: colors.navy },
  amber: { bg: colors.amber, border: colors.amberDeep, fg: colors.navyDeep },
};

export function Button({ title, onPress, variant = 'default', size = 'md', icon, disabled, loading, style, flex }) {
  const v = buttonVariants[variant];
  const small = size === 'sm';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
      disabled={disabled || loading}
      onPress={onPress}
      hitSlop={small ? { top: 6, bottom: 6, left: 2, right: 2 } : undefined}
      style={({ pressed }) => [
        styles.button,
        {
          minHeight: small ? 36 : 46,
          paddingHorizontal: small ? 14 : 20,
          backgroundColor: v.bg,
          borderColor: v.border,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        flex ? { flex: 1 } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.fg} />
      ) : icon ? (
        <Feather name={icon} size={small ? 15 : 17} color={v.fg} />
      ) : null}
      <Text style={{ fontFamily: fonts.bodySemi, fontSize: small ? 13 : 15, color: v.fg }} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, badge, tone = 'default', size = 44 }) {
  const dark = tone === 'dark';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { width: size, height: size, borderRadius: size / 2 },
        dark ? { backgroundColor: colors.navy, borderColor: colors.navy } : null,
        pressed && { opacity: 0.8 },
      ]}
    >
      <Feather name={icon} size={20} color={dark ? '#fff' : colors.navy} />
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/* ------------------------------ pills ------------------------------ */

export function Pill({ label, fg = colors.inkSoft, bg = 'transparent', outline }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }, outline && { borderColor: colors.lineStrong }]}>
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: fg }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function StatusPill({ status }) {
  const tone = STATUS_COLORS[status] || STATUS_COLORS.PENDING;
  return <Pill label={STATUS_LABELS[status] || status} fg={tone.fg} bg={tone.bg} />;
}

export function TypePill({ type }) {
  const blocking = type === 'HOLIDAY' || type === 'VACATION';
  const label = CALENDAR_TYPE_LABELS[type] || type;
  return blocking ? (
    <Pill label={label} fg={colors.holiday} bg={colors.holidaySoft} />
  ) : (
    <Pill label={label} outline />
  );
}

export function Dot({ color, size = 10 }) {
  return <View style={{ width: size, height: size, borderRadius: 3, backgroundColor: color, flexShrink: 0 }} />;
}

/* ------------------------------ meter ------------------------------ */

/** Attendance bar with a marker at the required percentage. */
export function Meter({ value, required }) {
  const pct = Math.min(100, Math.max(0, value));
  const tone = value < required ? colors.absent : value < required + 5 ? colors.pending : colors.skyDeep;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${value}% attended, ${required}% required`}
      style={styles.meter}
    >
      <View style={{ width: `${pct}%`, height: '100%', borderRadius: 999, backgroundColor: tone }} />
      <View style={[styles.threshold, { left: `${Math.min(100, Math.max(0, required))}%` }]} />
    </View>
  );
}

/* ------------------------------ states ------------------------------ */

export function Empty({ icon = 'inbox', title, children, action }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Feather name={icon} size={24} color={colors.skyDeep} />
      </View>
      <T variant="h3" style={{ textAlign: 'center' }}>
        {title}
      </T>
      {children ? (
        <T variant="small" style={{ textAlign: 'center', marginTop: 4, maxWidth: 280 }}>
          {children}
        </T>
      ) : null}
      {action ? <View style={{ marginTop: 14 }}>{action}</View> : null}
    </View>
  );
}

export function Note({ tone = 'info', children }) {
  const palette = {
    info: { bg: colors.skySoft, border: '#BDEAF7', fg: '#145174' },
    error: { bg: colors.absentSoft, border: '#F0CDC4', fg: '#7D3320' },
    success: { bg: colors.presentSoft, border: '#C7E9D4', fg: '#1F6C46' },
  }[tone];
  return (
    <View style={[styles.note, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: palette.fg }}>{children}</Text>
    </View>
  );
}

export function ErrorNote({ error }) {
  if (!error) return null;
  return <Note tone="error">{error}</Note>;
}

export function Loading({ rows = 3 }) {
  return (
    <View accessibilityLabel="Loading" style={{ gap: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.skeleton} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 16,
    ...shadow,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  cardHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  cardIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pageHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.pill,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.navyDeep, lineHeight: 14 },
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'transparent',
    alignSelf: 'flex-start',
  },
  meter: { height: 8, borderRadius: 999, backgroundColor: colors.line, marginVertical: 3 },
  threshold: { position: 'absolute', top: -3, width: 2, height: 14, backgroundColor: colors.ink, opacity: 0.45 },
  empty: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 12 },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.skySoftStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  note: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 12 },
  skeleton: { height: 84, borderRadius: radius.md, backgroundColor: '#EEF1F5' },
});
