import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';
import { usePlans } from '../context/PlanContext';
import { getColors } from '../theme/colors';
import { makeScreenStyles } from '../theme/screenStyles';
import NameField from '../components/NameField';
import MoveButtons from '../components/MoveButtons';
import { newId } from '../storage/plans';
import { renamePlan, addDay, moveDay } from '../storage/planEdits';

// Edit a plan: its name and its list of days. Tapping a day opens it.
export default function PlanEditorScreen({ navigation, route }) {
  const { settings } = useSettings();
  const colors = getColors(settings.themeMode);
  const styles = makeScreenStyles(colors);
  const { plans, activePlan, activeDayIndex, editPlan } = usePlans();
  const { planId } = route.params;
  const plan = plans.find((p) => p.id === planId);

  if (!plan) return null; // deleted while open

  const handleAddDay = async () => {
    const dayId = newId('day');
    await editPlan(planId, (p) => addDay(p, { id: dayId, name: `Day ${p.days.length + 1}` }));
    navigation.navigate('DayEditor', { planId, dayId });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Plan</Text>
        </View>

        <Text style={styles.label}>Plan name</Text>
        <NameField
          style={styles.input}
          value={plan.name}
          onCommit={(name) => editPlan(planId, (p) => renamePlan(p, name))}
          placeholder="Plan name"
          placeholderTextColor={colors.textSecondary}
        />

        <Text style={styles.label}>Days, in cycle order</Text>
        {plan.days.length === 0 && (
          <Text style={styles.empty}>No days yet. Add your first one below.</Text>
        )}
        {plan.days.map((day, i) => {
          const isActive = plan.id === activePlan?.id && i === activeDayIndex;
          const count = day.exercises.length;
          return (
            <TouchableOpacity
              key={day.id}
              style={styles.listRow}
              onPress={() => navigation.navigate('DayEditor', { planId, dayId: day.id })}
            >
              <View style={styles.listRowMain}>
                <Text style={styles.listRowTitle}>{day.name}</Text>
                <Text style={styles.listRowSub}>
                  {count} {count === 1 ? 'exercise' : 'exercises'}
                  {isActive ? ' · active day' : ''}
                </Text>
              </View>
              <MoveButtons
                styles={styles}
                index={i}
                count={plan.days.length}
                onMove={(delta) => editPlan(planId, (p) => moveDay(p, day.id, delta))}
              />
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity style={styles.primaryButton} onPress={handleAddDay}>
          <Text style={styles.primaryButtonText}>+ Add day</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>
          The cycle runs through the days top to bottom, then starts over. Use the arrows to
          change the order.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
