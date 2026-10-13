import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

// Up/down arrows for reordering a row in the plan editor. styles comes from
// makeScreenStyles; onMove gets -1 (up) or 1 (down).
export default function MoveButtons({ styles, index, count, onMove }) {
  const canUp = index > 0;
  const canDown = index < count - 1;
  return (
    <View style={{ flexDirection: 'row' }}>
      <TouchableOpacity
        style={styles.moveButton}
        onPress={() => onMove(-1)}
        disabled={!canUp}
        accessibilityLabel="Move up"
      >
        <Text style={[styles.moveButtonText, !canUp && styles.moveButtonDisabled]}>↑</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.moveButton}
        onPress={() => onMove(1)}
        disabled={!canDown}
        accessibilityLabel="Move down"
      >
        <Text style={[styles.moveButtonText, !canDown && styles.moveButtonDisabled]}>↓</Text>
      </TouchableOpacity>
    </View>
  );
}
