import React, { useEffect, useRef, useState } from 'react';
import { TextInput } from 'react-native';

// A text field for plan/day names that saves when you leave it (blur, the
// keyboard's done key, or navigating away) instead of on every keystroke.
// Clearing it out restores the previous name rather than saving a blank one.
export default function NameField({ value, onCommit, style, placeholder, placeholderTextColor }) {
  const [draft, setDraft] = useState(value);
  const draftRef = useRef(value);
  const committedRef = useRef(value);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  // Pick up outside changes (e.g. a reset) when the field isn't mid-edit.
  useEffect(() => {
    if (draftRef.current === committedRef.current) {
      setDraft(value);
      draftRef.current = value;
    }
    committedRef.current = value;
  }, [value]);

  const commit = () => {
    const name = draftRef.current.trim();
    if (!name) {
      setDraft(committedRef.current);
      draftRef.current = committedRef.current;
      return;
    }
    setDraft(name);
    draftRef.current = name;
    if (name !== committedRef.current) {
      committedRef.current = name;
      onCommitRef.current(name);
    }
  };

  // Save on the way out if the field still had focus.
  useEffect(() => () => commit(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TextInput
      style={style}
      value={draft}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
      onChangeText={(text) => {
        setDraft(text);
        draftRef.current = text;
      }}
      onEndEditing={commit}
      returnKeyType="done"
    />
  );
}
