import React from 'react';
import { Modal, View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { colors } from '../theme/colors';

export default function VideoModal({ visible, onClose, videoUri }) {
  if (!videoUri) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.playerWrap}>
          <Video
            source={videoUri}
            style={styles.video}
            resizeMode={ResizeMode.COVER}
            isLooping
            shouldPlay
            useNativeControls={false}
          />
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerWrap: { width: '85%', aspectRatio: 1, borderRadius: 16, overflow: 'hidden' },
  video: { width: '100%', height: '100%' },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  closeText: { color: colors.textPrimary },
});
