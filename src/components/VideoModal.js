import React, { useEffect } from 'react';
import { Modal, View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSettings } from '../context/SettingsContext';
import { getColors } from '../theme/colors';

export default function VideoModal({ visible, onClose, videoUri }) {
  const { settings } = useSettings();
  const colors = getColors(settings.themeMode);
  const styles = makeStyles(colors);

  // Hooks must run every render regardless of videoUri/visible, so this is
  // created unconditionally and just left idle if there's no source yet.
  const player = useVideoPlayer(videoUri || null, (p) => {
    p.loop = true;
  });

  useEffect(() => {
    if (!player) return;
    if (visible) {
      player.play();
    } else {
      player.pause();
    }
  }, [visible, player]);

  if (!videoUri) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.playerWrap}>
          <VideoView
            style={styles.video}
            player={player}
            nativeControls={false}
            contentFit="cover"
          />
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
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
}
