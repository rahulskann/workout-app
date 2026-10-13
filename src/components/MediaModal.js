import React, { useEffect, useState } from 'react';
import { Modal, View, TouchableOpacity, Text, Image, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSettings } from '../context/SettingsContext';
import { getColors } from '../theme/colors';

// Full-screen viewer for an exercise's video and/or machine photo. With both,
// a Video | Photo switch picks which one is showing.
export default function MediaModal({ visible, onClose, videoUri, photoUri }) {
  const { settings } = useSettings();
  const colors = getColors(settings.themeMode);
  const styles = makeStyles(colors);
  const [tab, setTab] = useState(videoUri ? 'video' : 'photo');

  // Start on the video each time it opens.
  useEffect(() => {
    if (visible) setTab(videoUri ? 'video' : 'photo');
  }, [visible, videoUri]);

  if (!videoUri && !photoUri) return null;
  const showing = tab === 'video' && videoUri ? 'video' : 'photo';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.frame}>
          {/* Only mounted while open, so cards don't each hold a video player. */}
          {visible && showing === 'video' && <VideoPane uri={videoUri} style={styles.media} />}
          {showing === 'photo' && (
            <Image source={{ uri: photoUri }} style={styles.media} resizeMode="contain" />
          )}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>

        {videoUri && photoUri && (
          <View style={styles.tabs}>
            {['video', 'photo'].map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.tab, showing === t && styles.tabActive]}
                onPress={() => setTab(t)}
              >
                <Text style={[styles.tabText, showing === t && styles.tabTextActive]}>
                  {t === 'video' ? 'Video' : 'Photo'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

function VideoPane({ uri, style }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });
  return <VideoView style={style} player={player} nativeControls={false} contentFit="contain" />;
}

function makeStyles(colors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.9)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    frame: {
      width: '90%',
      aspectRatio: 3 / 4,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: '#000',
    },
    media: { width: '100%', height: '100%' },
    closeButton: {
      position: 'absolute',
      top: 10,
      right: 10,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    closeText: { color: colors.textPrimary, fontWeight: '600' },
    tabs: { flexDirection: 'row', gap: 10, marginTop: 16 },
    tab: {
      paddingHorizontal: 22,
      paddingVertical: 8,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    tabActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
    tabText: { color: colors.textSecondary, fontWeight: '600' },
    tabTextActive: { color: colors.accent },
  });
}
