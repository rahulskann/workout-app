import React, { useEffect, useState } from 'react';
import { Modal, View, TouchableOpacity, Text, Image, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { WebView } from 'react-native-webview';
import { useSettings } from '../context/SettingsContext';
import { getColors } from '../theme/colors';
import {
  parseYouTubeUrl,
  youTubeThumbnail,
  youTubeEmbedHtml,
  openInYouTube,
  EMBED_ORIGIN,
} from '../services/youtube';

const TAB_LABELS = { video: 'Video', youtube: 'YouTube', photo: 'Photo' };

// Full-screen viewer for an exercise's media: a video saved on the phone, a
// YouTube link, and/or a machine photo. With more than one, a switch along
// the bottom picks which is showing.
export default function MediaModal({ visible, onClose, videoUri, photoUri, videoUrl }) {
  const { settings } = useSettings();
  const colors = getColors(settings.themeMode);
  const styles = makeStyles(colors);
  const youtube = parseYouTubeUrl(videoUrl);
  const tabs = [videoUri && 'video', youtube && 'youtube', photoUri && 'photo'].filter(Boolean);
  const [tab, setTab] = useState(tabs[0]);

  // Start on the first tab each time it opens.
  useEffect(() => {
    if (visible) setTab(tabs[0]);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (tabs.length === 0) return null;
  const showing = tabs.includes(tab) ? tab : tabs[0];
  const playInApp = settings.youtubePlayback === 'inapp';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.frame}>
          {/* Players are only mounted while open, so cards don't each hold one. */}
          {visible && showing === 'video' && <VideoPane uri={videoUri} style={styles.media} />}
          {visible && showing === 'youtube' && playInApp && (
            <WebView
              style={styles.media}
              source={{ html: youTubeEmbedHtml(youtube), baseUrl: EMBED_ORIGIN }}
              allowsFullscreenVideo
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
            />
          )}
          {showing === 'youtube' && !playInApp && (
            <TouchableOpacity style={styles.media} onPress={() => openInYouTube(youtube)}>
              <Image source={{ uri: youTubeThumbnail(youtube) }} style={styles.media} resizeMode="contain" />
              <View style={styles.playOverlay}>
                <Text style={styles.playOverlayText}>▶</Text>
              </View>
            </TouchableOpacity>
          )}
          {showing === 'photo' && (
            <Image source={{ uri: photoUri }} style={styles.media} resizeMode="contain" />
          )}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>

        {showing === 'youtube' && (
          <TouchableOpacity style={styles.youtubeButton} onPress={() => openInYouTube(youtube)}>
            <Text style={styles.youtubeButtonText}>Open in YouTube</Text>
          </TouchableOpacity>
        )}

        {tabs.length > 1 && (
          <View style={styles.tabs}>
            {tabs.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.tab, showing === t && styles.tabActive]}
                onPress={() => setTab(t)}
              >
                <Text style={[styles.tabText, showing === t && styles.tabTextActive]}>
                  {TAB_LABELS[t]}
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
    playOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playOverlayText: {
      color: '#fff',
      fontSize: 34,
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingHorizontal: 22,
      paddingVertical: 10,
      borderRadius: 14,
      overflow: 'hidden',
    },
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
    youtubeButton: {
      marginTop: 14,
      backgroundColor: '#FF0033',
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 10,
    },
    youtubeButtonText: { color: '#fff', fontWeight: '700' },
    tabs: { flexDirection: 'row', gap: 10, marginTop: 16 },
    tab: {
      paddingHorizontal: 18,
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
