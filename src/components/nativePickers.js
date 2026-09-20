import React from 'react';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

/**
 * Thin seam over the native date/time picker so the form fields do not care
 * which platform they are on.
 *
 * Android opens the system dialog. iOS shows the picker inline under the field.
 */
export function openPicker({ mode, value, onPick }) {
  DateTimePickerAndroid.open({
    mode,
    value,
    is24Hour: true,
    onValueChange: (_event, date) => onPick(date),
  });
}

export function InlinePicker({ mode, value, onPick }) {
  return (
    <DateTimePicker
      value={value}
      mode={mode}
      display={mode === 'date' ? 'inline' : 'spinner'}
      onValueChange={(_event, date) => onPick(date)}
    />
  );
}
