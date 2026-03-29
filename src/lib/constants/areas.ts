// Areas are now stored in the DB (see schema.ts → areas table).
// This file provides:
//   1. COLOR_OPTIONS — the fixed palette users pick from
//   2. colorClasses() — maps a color key to Tailwind classes
//   3. INITIAL_AREAS — used to seed the DB on first run
//
// Tailwind's purge scanner detects classes from string literals in this file,
// so all color classes stay in the production CSS even though they're dynamic.

export interface ColorOption {
	key: string;
	label: string;
	bg: string;
	text: string;
	solid: string; // solid bg for filled elements like progress bars: bg-xxx-400
	border: string;
	ring: string;
}

export const COLOR_OPTIONS: ColorOption[] = [
	{ key: 'blue',   label: 'Blue',   bg: 'bg-blue-500/10',   text: 'text-blue-400',   solid: 'bg-blue-400',   border: 'border-blue-500',   ring: 'ring-blue-500'   },
	{ key: 'purple', label: 'Purple', bg: 'bg-purple-500/10', text: 'text-purple-400', solid: 'bg-purple-400', border: 'border-purple-500', ring: 'ring-purple-500' },
	{ key: 'green',  label: 'Green',  bg: 'bg-green-500/10',  text: 'text-green-400',  solid: 'bg-green-400',  border: 'border-green-500',  ring: 'ring-green-500'  },
	{ key: 'orange', label: 'Orange', bg: 'bg-orange-500/10', text: 'text-orange-400', solid: 'bg-orange-400', border: 'border-orange-500', ring: 'ring-orange-500' },
	{ key: 'rose',   label: 'Rose',   bg: 'bg-rose-500/10',   text: 'text-rose-400',   solid: 'bg-rose-400',   border: 'border-rose-500',   ring: 'ring-rose-500'   },
	{ key: 'amber',  label: 'Amber',  bg: 'bg-amber-500/10',  text: 'text-amber-400',  solid: 'bg-amber-400',  border: 'border-amber-500',  ring: 'ring-amber-500'  },
	{ key: 'teal',   label: 'Teal',   bg: 'bg-teal-500/10',   text: 'text-teal-400',   solid: 'bg-teal-400',   border: 'border-teal-500',   ring: 'ring-teal-500'   },
	{ key: 'pink',   label: 'Pink',   bg: 'bg-pink-500/10',   text: 'text-pink-400',   solid: 'bg-pink-400',   border: 'border-pink-500',   ring: 'ring-pink-500'   },
	{ key: 'red',    label: 'Red',    bg: 'bg-red-500/10',    text: 'text-red-400',    solid: 'bg-red-400',    border: 'border-red-500',    ring: 'ring-red-500'    },
	{ key: 'indigo', label: 'Indigo', bg: 'bg-indigo-500/10', text: 'text-indigo-400', solid: 'bg-indigo-400', border: 'border-indigo-500', ring: 'ring-indigo-500' },
];

const COLOR_MAP = Object.fromEntries(COLOR_OPTIONS.map((c) => [c.key, c]));

/** Returns Tailwind color classes for a color key. Falls back to purple. */
export function colorClasses(colorKey: string): ColorOption {
	return COLOR_MAP[colorKey] ?? COLOR_MAP['purple'];
}

// ── DB row type (matches schema.ts areas table) ───────────────────────────────
export type AreaRow = {
	id: string;
	userId: string;
	key: string;
	label: string;
	emoji: string;
	color: string;
	suspended: boolean;
	sortOrder: number;
	createdAt: Date;
};

/** Find an area by key from a list. Returns undefined if not found. */
export function areaFor(key: string | null | undefined, areaList: AreaRow[]): AreaRow | undefined {
	if (!key) return undefined;
	return areaList.find((a) => a.key === key);
}

// ── Initial seed data — matches the original 6 hardcoded areas ───────────────
// Used in +layout.server.ts to populate the DB on first run.
export const INITIAL_AREAS = [
	{ key: 'job',      label: 'Lumeglobal', emoji: '💼', color: 'blue',   sortOrder: 0 },
	{ key: 'getfly',   label: 'Getfly',     emoji: '🚀', color: 'purple', sortOrder: 1 },
	{ key: 'mirai',    label: 'Mirai',      emoji: '⚡', color: 'green',  sortOrder: 2 },
	{ key: 'vamoss',   label: 'Vamoss',     emoji: '🔥', color: 'orange', sortOrder: 3 },
	{ key: 'fitness',  label: 'Fitness',    emoji: '💪', color: 'rose',   sortOrder: 4 },
	{ key: 'personal', label: 'Personal',   emoji: '🌱', color: 'amber',  sortOrder: 5 },
];
