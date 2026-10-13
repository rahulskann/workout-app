import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import MediaModal from './MediaModal';

// The square on the left of each exercise card: the machine photo if there
// is one, otherwise a play icon. A small ▶ badge means there's a video.
// Tapping opens the media; with nothing attached it's just decoration.
export default function ExerciseThumb({ exercise, colors }) {
  const styles = makeStyles(colors);
  const [open, setOpen] = useState(false);
  const { photoUri, videoUri } = exercise;
  const hasMedia = Boolean(photoUri || videoUri);

  return (
    <>
      <TouchableOpacity style={styles.thumb} onPress={() => setOpen(true)} disabled={!hasMedia}>
        {photoUri ? (
          <>
            <Image source={{ uri: photoUri }} style={styles.photo} />
            {videoUri && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>▶</Text>
              </View>
            )}
          </>
        ) : (
          <Text style={[styles.icon, !hasMedia && styles.iconEmpty]}>▶</Text>
        )}
      </TouchableOpacity>
      {hasMedia && (
        <MediaModal
          visible={open}
          onClose={() => setOpen(false)}
          videoUri={videoUri}
          photoUri={photoUri}
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
    photo: { width: '100%', height: '100%' },
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
