import { supabase } from './supabase';
import { Trip } from './types';
import { daysInMonth, monthRange, periodOf, toISODate } from './dates';

export const REMINDER_HOURS = 9;
const reminderDate = () => new Date(Date.now() + REMINDER_HOURS * 3600 * 1000).toISOString();

export async function createTrip(input: { tripDate: string; amount: number; description: string }): Promise<Trip> {
  const now = new Date();
  const { data, error } = await supabase.from('trips').insert({
    trip_date: input.tripDate, amount: input.amount, description: input.description,
    departed_at: now.toISOString(), period: periodOf(now), status: 'open', next_reminder_at: reminderDate(),
  }).select().single();
  if (error) throw error;
  return data as Trip;
}

export async function getTrip(id: string): Promise<Trip | null> {
  const { data, error } = await supabase.from('trips').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as Trip) ?? null;
}

export async function listOpenTrips(): Promise<Trip[]> {
  const { data, error } = await supabase.from('trips').select('*').eq('status', 'open').order('departed_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Trip[];
}

export async function listTripsByMonth(year: number, month0: number): Promise<Trip[]> {
  const { start, end } = monthRange(year, month0);
  const { data, error } = await supabase.from('trips').select('*').gte('trip_date', start).lte('trip_date', end)
    .order('trip_date', { ascending: false }).order('departed_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Trip[];
}

export async function confirmTrip(id: string, answers: { completed: boolean; paid: boolean }): Promise<Trip> {
  const patch = answers.completed ? {
    status: 'registered', completed: true, paid: answers.paid,
    registered_at: new Date().toISOString(), next_reminder_at: null,
  } : { next_reminder_at: reminderDate() };
  const { data, error } = await supabase.from('trips').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data as Trip;
}

export async function snoozeTrip(id: string): Promise<void> {
  const { error } = await supabase.from('trips').update({ next_reminder_at: reminderDate() }).eq('id', id);
  if (error) throw error;
}
export async function markPaid(id: string): Promise<void> {
  const { error } = await supabase.from('trips').update({ paid: true }).eq('id', id);
  if (error) throw error;
}
export async function deleteTrip(id: string): Promise<void> {
  const { error } = await supabase.from('trips').delete().eq('id', id);
  if (error) throw error;
}

export type DayStatus = 'worked' | 'open' | 'none' | 'today' | 'future';
export function groupByDate(trips: Trip[]): Record<string, Trip[]> {
  const map: Record<string, Trip[]> = {};
  for (const t of trips) (map[t.trip_date] ||= []).push(t);
  return map;
}
export function dayStatus(iso: string, byDate: Record<string, Trip[]>, todayISO: string): DayStatus {
  const list = byDate[iso] ?? [];
  if (list.some((t) => t.status === 'registered')) return 'worked';
  if (list.some((t) => t.status === 'open')) return 'open';
  if (iso > todayISO) return 'future';
  if (iso === todayISO) return 'today';
  return 'none';
}
export type MonthStats = {
  workedDays: number; notWorkedDays: number; openDays: number;
  totalReceived: number; totalPending: number; percentWorked: number;
};
export function monthStats(trips: Trip[], year: number, month0: number, now = new Date()): MonthStats {
  const byDate = groupByDate(trips);
  const todayISO = toISODate(now);
  let workedDays = 0, notWorkedDays = 0, openDays = 0;
  for (let d = 1; d <= daysInMonth(year, month0); d++) {
    const iso = toISODate(new Date(year, month0, d));
    const s = dayStatus(iso, byDate, todayISO);
    if (s === 'worked') workedDays++;
    else if (s === 'open') openDays++;
    else if (s === 'none') notWorkedDays++;
  }
  const registered = trips.filter((t) => t.status === 'registered');
  const totalReceived = registered.filter((t) => t.paid).reduce((sum, t) => sum + Number(t.amount), 0);
  const totalPending = registered.filter((t) => !t.paid).reduce((sum, t) => sum + Number(t.amount), 0);
  const base = workedDays + notWorkedDays;
  return { workedDays, notWorkedDays, openDays, totalReceived, totalPending, percentWorked: base === 0 ? 0 : Math.round((workedDays / base) * 100) };
}
