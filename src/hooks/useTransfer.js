import { useState } from 'react';
import { Alert } from 'react-native';
import { usePlans } from '../context/PlanContext';
import { useSettings } from '../context/SettingsContext';
import { sharePlan, pickJsonFile, backUpEverything, restoreBackup } from '../services/transfer';
import { planFromShareFile, parseBackup, summarizeBackup } from '../storage/transferFormat';

// The share / import / back up / restore flows, with their confirmations and
// error messages, used from the Plans, Settings and Welcome screens.
// busy is the name of the flow in progress, so screens can disable buttons.
export function useTransfer() {
  const { plans, addImportedPlan, reloadPlans } = usePlans();
  const { reloadSettings } = useSettings();
  const [busy, setBusy] = useState(null);

  const run = async (name, failTitle, task) => {
    if (busy) return;
    setBusy(name);
    try {
      await task();
    } catch (e) {
      Alert.alert(failTitle, e?.message || 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  const share = (plan) => run('share', "Couldn't share the plan", () => sharePlan(plan));

  const importPlan = () =>
    run('import', "Couldn't import that", async () => {
      const data = await pickJsonFile();
      if (!data) return;
      const plan = planFromShareFile(data, plans.map((p) => p.name));
      await addImportedPlan(plan);
      const days = plan.days.length;
      Alert.alert(
        'Plan imported',
        `"${plan.name}" (${days} ${days === 1 ? 'day' : 'days'}) is now your active plan. You can switch back any time on the Plans screen.`
      );
    });

  const backUp = () => run('backup', "Couldn't make a backup", backUpEverything);

  const restore = () =>
    run('restore', "Couldn't restore that", async () => {
      const data = await pickJsonFile();
      if (!data) return;
      const backup = parseBackup(data);
      const summary = summarizeBackup(backup);
      const when = summary.exportedAt ? new Date(summary.exportedAt).toLocaleString() : 'an unknown date';
      const confirmed = await new Promise((resolve) =>
        Alert.alert(
          'Restore this backup?',
          `From ${when}: ${summary.planCount} ${summary.planCount === 1 ? 'plan' : 'plans'}, ` +
            `${summary.loggedExercises} exercises with history, ${summary.photoCount} photos.\n\n` +
            'This replaces all plans, logged history and settings on this phone. It can\'t be undone.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Restore', style: 'destructive', onPress: () => resolve(true) },
          ],
          { cancelable: true, onDismiss: () => resolve(false) }
        )
      );
      if (!confirmed) return;
      await restoreBackup(backup);
      await reloadSettings();
      await reloadPlans();
      Alert.alert(
        'Backup restored',
        'Everything from the backup is back. If you use Google Sheets, sign in again in Settings.'
      );
    });

  return { busy, share, importPlan, backUp, restore };
}
