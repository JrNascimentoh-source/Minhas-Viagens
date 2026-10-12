import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Trip } from './types';
import { brl, formatBR } from './dates';
import { REMINDER_HOURS } from './trips';

const CHANNEL_ID = 'lembretes';
const ID_KEY = (tripId: string) => `reminder:${tripId}`;
const ENABLED_KEY = 'reminders_enabled';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function setupNotifications(): Promise<boolean> {
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Lembretes de viagens', importance: Notifications.AndroidImportance.HIGH,
  });
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}
export async function remindersEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(ENABLED_KEY)) !== '0';
}
export async function setRemindersEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(ENABLED_KEY, enabled ? '1' : '0');
  if (!enabled) await Notifications.cancelAllScheduledNotificationsAsync();
}
export async function scheduleReminder(trip: Trip): Promise<void> {
  if (!(await remindersEnabled())) return;
  await cancelReminder(trip.id);
  const id = await Notifications.scheduleNotificationAsync({
    content: { title: 'Confirmar viagem', body: `A viagem de ${formatBR(trip.trip_date)} (${brl(Number(trip.amount))}) foi concluída? Já recebeu?`, data: { tripId: trip.id }, sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: REMINDER_HOURS * 3600, repeats: true, channelId: CHANNEL_ID },
  });
  await AsyncStorage.setItem(ID_KEY(trip.id), id);
}
export async function cancelReminder(tripId: string): Promise<void> {
  const id = await AsyncStorage.getItem(ID_KEY(tripId));
  if (id) { await Notifications.cancelScheduledNotificationAsync(id); await AsyncStorage.removeItem(ID_KEY(tripId)); }
}
export async function syncReminders(openTrips: Trip[]): Promise<void> {
  if (!(await remindersEnabled())) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const activeIds = new Set(scheduled.map((n) => n.identifier));
  for (const trip of openTrips) {
    const stored = await AsyncStorage.getItem(ID_KEY(trip.id));
    if (!stored || !activeIds.has(stored)) await scheduleReminder(trip);
  }
}
