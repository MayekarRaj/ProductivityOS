// ─── Default weekly schedule ─────────────────────────────────────────────────
// Applied when creating a new day row for the first time.
// User can override per-day via the Week view.
export const DEFAULT_SCHEDULE: Record<string, string> = {
	Mon: 'getfly',
	Tue: 'mirai',
	Wed: 'getfly',
	Thu: 'vamoss',
	Fri: 'getfly',
	Sat: 'personal',
	Sun: 'fitness'
};

// ─── MVD hints ───────────────────────────────────────────────────────────────
// "Minimum Viable Day" — the bare minimum to count the day as a win.
// Shown as a callout on the Today view, linked to the day's home base area.
export const MVD_HINTS: Record<string, string> = {
	job: 'Ship one thing',
	getfly: '20 min of thinking / planning',
	mirai: 'Review one task or push one commit',
	vamoss: 'Review one task or push one commit',
	fitness: '15 min walk or stretch',
	personal: 'Open the project once'
};

// ─── Starter habits ──────────────────────────────────────────────────────────
// Pre-populated for new users. All are deletable.
export type Frequency = 'daily' | 'weekdays' | '3x' | 'custom';

export const STARTER_HABITS: Array<{
	name: string;
	area: string;
	frequency: Frequency;
}> = [
	{ name: 'Workout', area: 'fitness', frequency: 'daily' },
	{ name: 'Read / Study (AWS prep)', area: 'personal', frequency: 'daily' },
	{ name: 'Morning routine', area: 'personal', frequency: 'daily' },
	{ name: 'Drink water', area: 'fitness', frequency: 'daily' },
	{ name: 'Wind down / no screens', area: 'personal', frequency: 'daily' }
];

// ─── Day names ───────────────────────────────────────────────────────────────
export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type DayName = (typeof DAY_NAMES)[number];

// ─── Energy levels ───────────────────────────────────────────────────────────
// Maps the emoji label to a numeric value used in the Stats charts.
export const ENERGY_LEVELS = [
	{ key: 'drained', emoji: '😴', label: 'Drained', value: 1 },
	{ key: 'okay', emoji: '😐', label: 'Okay', value: 2 },
	{ key: 'charged', emoji: '⚡', label: 'Charged', value: 3 },
	{ key: 'peak', emoji: '🔥', label: 'Peak', value: 4 }
] as const;

export type EnergyKey = 'drained' | 'okay' | 'charged' | 'peak';
