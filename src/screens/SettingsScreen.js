import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { getColors } from '../theme/colors';

export default function SettingsScreen({ onBack }) {
  const { settings, updateSettings } = useSettings();
  const colors = getColors(settings.themeMode);
  const styles = makeStyles(colors);

  const [urlDraft, setUrlDraft] = useState(settings.sheetsWebhookUrl || '');

  const saveUrl = () => {
    updateSettings({ sheetsWebhookUrl: urlDraft.trim() });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        {/* Google Sheets sync */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Google Sheets Sync</Text>
          <Text style={styles.sectionSub}>
            Paste your Google Apps Script Web App URL below. Sessions get sent here
            automatically once they roll out of the 2-session local history.
            Full Google login/OAuth is on the roadmap -- this is the manual version for now.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="https://script.google.com/macros/s/.../exec"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            value={urlDraft}
            onChangeText={setUrlDraft}
          />
          <TouchableOpacity style={styles.saveButton} onPress={saveUrl}>
            <Text style={styles.saveButtonText}>Save URL</Text>
          </TouchableOpacity>
          {settings.sheetsWebhookUrl ? (
            <Text style={styles.statusText}>✓ Connected</Text>
          ) : (
            <Text style={styles.statusTextMuted}>Not connected yet</Text>
          )}
        </View>

        {/* Color mode */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.toggleRow}>
            <ToggleOption
              label="Dark"
              active={settings.themeMode === 'dark'}
              colors={colors}
              onPress={() => updateSettings({ themeMode: 'dark' })}
            />
            <ToggleOption
              label="Light"
              active={settings.themeMode === 'light'}
              colors={colors}
              onPress={() => updateSettings({ themeMode: 'light' })}
            />
          </View>
        </View>

        {/* Log form preference */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Logging Style</Text>
          <Text style={styles.sectionSub}>
            Choose whether the weight/reps form is always visible on each card, or
            hidden behind the pencil icon until you tap it.
          </Text>
          <View style={styles.toggleRow}>
            <ToggleOption
              label="Tap to edit"
              active={settings.logFormMode === 'expand'}
              colors={colors}
              onPress={() => updateSettings({ logFormMode: 'expand' })}
            />
            <ToggleOption
              label="Always show"
              active={settings.logFormMode === 'always'}
              colors={colors}
              onPress={() => updateSettings({ logFormMode: 'always' })}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ToggleOption({ label, active, onPress, colors }) {
  const styles = makeStyles(colors);
  return (
    <TouchableOpacity
      style={[styles.toggleOption, active && styles.toggleOptionActive]}
      onPress={onPress}
    >
      <Text style={[styles.toggleOptionText, active && styles.toggleOptionTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingBottom: 60 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 24,
      paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) + 8 : 8,
    },
    backButton: { marginRight: 12 },
    backButtonText: { color: colors.accent, fontSize: 16, fontWeight: '600' },
    headerTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
    section: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 16,
      marginBottom: 16,
    },
    sectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 6 },
    sectionSub: { color: colors.textSecondary, fontSize: 12, marginBottom: 12, lineHeight: 17 },
    input: {
      backgroundColor: colors.background,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      color: colors.textPrimary,
      paddingHorizontal: 10,
      paddingVertical: 10,
      marginBottom: 10,
    },
    saveButton: {
      backgroundColor: colors.accent,
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: 'center',
    },
    saveButtonText: { color: '#0A0A0A', fontWeight: '700' },
    statusText: { color: colors.success, fontSize: 12, marginTop: 8 },
    statusTextMuted: { color: colors.textSecondary, fontSize: 12, marginTop: 8 },
    toggleRow: { flexDirection: 'row', gap: 10 },
    toggleOption: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: 'center',
    },
    toggleOptionActive: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accent,
    },
    toggleOptionText: { color: colors.textSecondary, fontWeight: '600' },
    toggleOptionTextActive: { color: colors.accent },
  });
}
