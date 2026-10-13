import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import MediaModal from './MediaModal';
import { useSettings } from '../context/SettingsContext';
import { parseYouTubeUrl, youTubeThumbnail, openInYouTube } from '../services/youtube';

// The square on the left of each exercise card: the machine photo if there
// is one, else the YouTube video's thumbnail, else a play icon. A small ▶
// badge means there's a video to watch. Tapping opens the media; with
// nothing attached it's just decoration.
export default function ExerciseThumb({ exercise, colors }) {
  const styles = makeStyles(colors);
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const { photoUri, videoUri, videoUrl } = exercise;
  const youtube = parseYouTubeUrl(videoUrl);
  const hasVideo = Boolean(videoUri || youtube);
  const hasMedia = Boolean(photoUri || hasVideo);
  const image = photoUri || (youtube && youTubeThumbnail(youtube));

  const handlePress = () => {
    // A YouTube link on its own, set to open in the YouTube app: skip the
    // viewer and go straight there.
    if (youtube && !photoUri && !videoUri && settings.youtubePlayback !== 'inapp') {
      openInYouTube(youtube);
    } else {
      setOpen(true);
    }
  };

  return (
    <>
      <TouchableOpacity style={styles.thumb} onPress={handlePress} disabled={!hasMedia}>
        {/* The icon sits underneath, so it still shows if a YouTube thumbnail can't load offline. */}
        <Text style={[styles.icon, !hasMedia && styles.iconEmpty]}>▶</Text>
        {image && <Image source={{ uri: image }} style={styles.photo} />}
        {image && hasVideo && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>▶</Text>
          </View>
        )}
      </TouchableOpacity>
      {hasMedia && (
        <MediaModal
          visible={open}
          onClose={() => setOpen(false)}
          videoUri={videoUri}
          photoUri={photoUri}
          videoUrl={videoUrl}
        />
      )}
    </>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    thumb: {
      width: 48,
      height: 48,
      borderRadius: 10,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      overflow: 'hidden',
    },
    photo: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
    icon: { color: colors.accent, fontSize: 16 },
    iconEmpty: { opacity: 0.35 },
    badge: {
      position: 'absolute',
      right: 3,
      bottom: 3,
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: 8,
      width: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: { color: '#fff', fontSize: 8 },
  });
}
