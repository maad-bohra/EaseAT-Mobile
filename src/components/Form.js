import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { colors, fonts, radius } from '../theme';
import {
  dateStrToLocalDate,
  formatDateFull,
  isValidDate,
  localDateToDateStr,
  localDateToTimeStr,
  timeStrToLocalDate,
} from '../utils/dates';
import { InlinePicker, openPicker } from './nativePickers';
import { T } from './Primitives';

export function Field({ label, hint, error, children, style }) {
  // Give the control the field's label so screen readers announce it.
  const labelled = React.Children.map(children, (child) =>
    label && React.isValidElement(child) && child.props.accessibilityLabel === undefined
      ? React.cloneElement(child, { accessibilityLabel: label })
      : child,
  );
  return (
    <View style={[styles.field, style]}>
      {label ? <T variant="label">{label}</T> : null}
      {labelled}
      {error ? (
        <T variant="tiny" color={colors.absent}>
          {error}
        </T>
      ) : hint ? (
        <T variant="tiny">{hint}</T>
      ) : null}
    </View>
  );
}

export function TextField({ value, onChangeText, placeholder, multiline, style, ...rest }) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      multiline={multiline}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.input,
        multiline && { minHeight: 84, textAlignVertical: 'top', paddingTop: 12 },
        focused && styles.inputFocused,
        style,
      ]}
      {...rest}
    />
  );
}

/** Two fields side by side. */
export function FieldRow({ children }) {
  return (
    <View style={styles.fieldRow}>
      {React.Children.map(children, (child) => (
        <View style={{ flex: 1 }}>{child}</View>
      ))}
    </View>
  );
}

/** Tappable box that shows a value and a chevron. */
function PickerBox({ text, placeholder, onPress, open, icon = 'chevron-down', accessibilityLabel, color }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[styles.input, styles.pickerBox, open && styles.inputFocused]}
    >
      {color ? <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} /> : null}
      <Text
        numberOfLines={1}
        style={{ flex: 1, fontFamily: fonts.body, fontSize: 15, color: text ? colors.ink : colors.muted }}
      >
        {text || placeholder}
      </Text>
      <Feather name={open ? 'chevron-up' : icon} size={18} color={colors.muted} />
    </Pressable>
  );
}

/**
 * Dropdown that opens inline instead of in a second modal, which keeps it
 * reliable inside bottom sheets on both platforms.
 */
export function SelectField({ value, options, onChange, placeholder = 'Choose', accessibilityLabel }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View>
      <PickerBox
        text={selected?.label}
        placeholder={placeholder}
        color={selected?.color}
        open={open}
        onPress={() => setOpen((v) => !v)}
        accessibilityLabel={accessibilityLabel}
      />
      {open ? (
        <View style={styles.optionList}>
          {options.map((option) => {
            const active = option.value === value;
            return (
              <Pressable
                key={String(option.value)}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.skySoft }]}
              >
                {option.color ? (
                  <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: option.color }} />
                ) : null}
                <Text
                  style={{
                    flex: 1,
                    fontFamily: active ? fonts.bodySemi : fonts.body,
                    fontSize: 15,
                    color: colors.ink,
                  }}
                >
                  {option.label}
                </Text>
                {active ? <Feather name="check" size={17} color={colors.skyDeep} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function usePickerField({ mode, value, onChange, toValue, fromDate }) {
  const [open, setOpen] = useState(false);
  const current = toValue(value);

  function press() {
    if (Platform.OS === 'android') {
      openPicker({ mode, value: current, onPick: (date) => onChange(fromDate(date)) });
    } else {
      setOpen((v) => !v);
    }
  }
  const inline =
    open && Platform.OS !== 'android' ? (
      <View style={styles.inlinePicker}>
        <InlinePicker mode={mode} value={current} onPick={(date) => onChange(fromDate(date))} />
      </View>
    ) : null;
  return { open, press, inline, current };
}

/** value and onChange use "YYYY-MM-DD". */
export function DateField({ value, onChange, accessibilityLabel = 'Date' }) {
  const picker = usePickerField({
    mode: 'date',
    value,
    onChange,
    toValue: dateStrToLocalDate,
    fromDate: localDateToDateStr,
  });
  return (
    <View>
      <PickerBox
        text={isValidDate(value) ? formatDateFull(value) : ''}
        placeholder="Pick a date"
        icon="calendar"
        open={picker.open}
        onPress={picker.press}
        accessibilityLabel={accessibilityLabel}
      />
      {picker.inline}
    </View>
  );
}

/** value and onChange use 24-hour "HH:mm". */
export function TimeField({ value, onChange, accessibilityLabel = 'Time' }) {
  const picker = usePickerField({
    mode: 'time',
    value,
    onChange,
    toValue: timeStrToLocalDate,
    fromDate: localDateToTimeStr,
  });
  return (
    <View>
      <PickerBox
        text={value}
        placeholder="Pick a time"
        icon="clock"
        open={picker.open}
        onPress={picker.press}
        accessibilityLabel={accessibilityLabel}
      />
      {picker.inline}
    </View>
  );
}

export function ColorPicker({ value, onChange, colorsList }) {
  return (
    <View style={styles.swatches}>
      {colorsList.map((color) => {
        const active = value === color;
        return (
          <Pressable
            key={color}
            accessibilityRole="button"
            accessibilityLabel={`Use colour ${color}`}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(color)}
            style={[
              styles.swatch,
              { backgroundColor: color },
              active && { borderColor: colors.ink, borderWidth: 3 },
            ]}
          >
            {active ? <Feather name="check" size={16} color="#fff" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Row of selectable chips. Scrolls sideways when it does not fit. */
export function Chips({ options, value, onChange, style }) {
  return (
    <View style={[styles.chips, style]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text
              style={{
                fontFamily: active ? fonts.bodySemi : fonts.bodyMedium,
                fontSize: 14,
                color: active ? colors.navyDeep : colors.inkSoft,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SwitchRow({ label, hint, value, onValueChange }) {
  return (
    <View style={styles.switchRow}>
      <View style={{ flex: 1 }}>
        <T variant="strong">{label}</T>
        {hint ? <T variant="tiny">{hint}</T> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.lineStrong, true: colors.skyDeep }}
        thumbColor="#fff"
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6, marginBottom: 14 },
  fieldRow: { flexDirection: 'row', gap: 12 },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
  },
  inputFocused: { borderColor: colors.skyDeep, borderWidth: 1.5 },
  pickerBox: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionList: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  option: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  inlinePicker: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 4,
  },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.sky, borderColor: colors.sky },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
});
