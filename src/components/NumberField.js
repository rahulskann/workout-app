import React, { useEffect, useState } from 'react';
import { TextInput } from 'react-native';
import { parseTyped } from '../utils/numbers';

// A number the −/+ buttons beside it nudge, or that you tap to type.
// Tapping clears it (the old value stays as the placeholder) and typed
// numbers apply as you go, so tapping Log never misses the last edit.
export default function NumberField({ value, onChange, decimal = false, style, placeholderTextColor }) {
  const [draft, setDraft] = useState(null); // null while not being edited

  // The buttons can change the value mid-edit; show their result rather
  // than the stale typed text.
  useEffect(() => {
    setDraft((d) => (d !== null && d !== '' && parseTyped(d) !== value ? String(value) : d));
  }, [value]);

  return (
    <TextInput
      style={style}
      value={draft ?? String(value)}
      placeholder={String(value)}
      placeholderTextColor={placeholderTextColor}
      onFocus={() => setDraft('')}
      onBlur={() => setDraft(null)}
      onChangeText={(text) => {
        setDraft(text);
        const n = parseTyped(text);
        if (n !== null) onChange(n);
      }}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      returnKeyType="done"
      maxLength={6}
      underlineColorAndroid="transparent"
    />
  );
}
