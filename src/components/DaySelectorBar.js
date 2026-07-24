import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';

// Always-visible day selector. Tapping a day just changes what's on screen
// (no confirmation needed -- browsing/logging any day is fine). Making a
// day the "active" one (the one Finish Day advances from) is a separate,
// confirmed action handled by the parent screen.
//
// Renders as a button row when there are 6 or fewer days, and collapses
// into a dropdown once there are more -- built with custom user-added
// days in mind for later.
export default function DaySelectorBar({ routines, viewedIndex, activeIndex, onSelect, colors }) {
  const styles = makeStyles(colors);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (routines.length <= 6) {
    return (
      <View style={styles.row}>
        {routines.map((r) => {
          const selected = r.id === viewedIndex;
          const isActive = r.id === activeIndex;
          return (
            <TouchableOpacity
              key={r.id}
              style={[styles.button, selected && styles.buttonSelected]}
              onPress={() => onSelect(r.id)}
            >
              <Text style={[styles.buttonText, selected && styles.buttonTextSelected]} numberOfLines={1}>
                {shortLabel(r.name)}
              </Text>
              {isActive && <View style={styles.activeDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  // Dropdown for 7+ days
  const viewedRoutine = routines[viewedIndex];
  return (
    <>
      <TouchableOpacity style={styles.dropdownTrigger} onPress={() => setDropdownOpen(true)}>
        <Text style={styles.dropdownTriggerText}>{viewedRoutine.name}</Text>
        <Text style={styles.dropdownCaret}>▾</Text>
      </TouchableOpacity>

      <Modal visible={dropdownOpen} transparent animationType="fade" onRequestClose={() => setDropdownOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setDropdownOpen(false)}>
          <View style={styles.dropdownCard}>
            <ScrollView style={{ maxHeight: 320 }}>
              {routines.map((r) => {
                const selected = r.id === viewedIndex;
                const isActive = r.id === activeIndex;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.dropdownRow, selected && styles.dropdownRowSelected]}
                    onPress={() => {
                      onSelect(r.id);
                      setDropdownOpen(false);
                    }}
                  >
                    <Text style={[styles.dropdownRowText, selected && styles.dropdownRowTextSelected]}>
                      {r.name}
                    </Text>
                    {isActive && <Text style={styles.activeTag}>Active</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function shortLabel(name) {
  // "Day 1 · Legs" -> "Day 1"
  return name.split('·')[0].trim();
}

function makeStyles(colors) {
  return StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginTop: 12 },
    button: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      flexDirection: 'row',
      alignItems: 'center',
    },
    buttonSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
    buttonText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
    buttonTextSelected: { color: colors.accent },
    activeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.success,
      marginLeft: 6,
    },

    dropdownTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 20,
      marginTop: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      alignSelf: 'flex-start',
    },
    dropdownTriggerText: { color: colors.textPrimary, fontSize: 15, fontWeight: '600', marginRight: 8 },
    dropdownCaret: { color: colors.textSecondary },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    dropdownCard: {
      width: '82%',
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 12,
    },
    dropdownRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: 10,
    },
    dropdownRowSelected: { backgroundColor: colors.accentSoft },
    dropdownRowText: { color: colors.textPrimary, fontSize: 15 },
    dropdownRowTextSelected: { color: colors.accent, fontWeight: '700' },
    activeTag: { color: colors.success, fontSize: 11, fontWeight: '600' },
  });
}
