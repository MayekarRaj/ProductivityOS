// The 6 fixed life/work areas. Everything in the app (tasks, events, habits)
// belongs to one of these. Colors must match Tailwind's palette.

export type AreaKey = 'job' | 'getfly' | 'mirai' | 'vamoss' | 'fitness' | 'personal';

export interface Area {
	key: AreaKey;
	label: string;
	emoji: string;
	color: {
		bg: string; // e.g. "bg-purple-500/10"  — card/badge background
		text: string; // e.g. "text-purple-400"  — text and icons
		border: string; // e.g. "border-purple-500" — borders and accents
		ring: string; // e.g. "ring-purple-500"   — focus rings
	};
}

export const AREAS: Area[] = [
	{
		key: 'job',
		label: 'Lumeglobal',
		emoji: '💼',
		color: {
			bg: 'bg-blue-500/10',
			text: 'text-blue-400',
			border: 'border-blue-500',
			ring: 'ring-blue-500'
		}
	},
	{
		key: 'getfly',
		label: 'Getfly',
		emoji: '🚀',
		color: {
			bg: 'bg-purple-500/10',
			text: 'text-purple-400',
			border: 'border-purple-500',
			ring: 'ring-purple-500'
		}
	},
	{
		key: 'mirai',
		label: 'Mirai',
		emoji: '⚡',
		color: {
			bg: 'bg-green-500/10',
			text: 'text-green-400',
			border: 'border-green-500',
			ring: 'ring-green-500'
		}
	},
	{
		key: 'vamoss',
		label: 'Vamoss',
		emoji: '🔥',
		color: {
			bg: 'bg-orange-500/10',
			text: 'text-orange-400',
			border: 'border-orange-500',
			ring: 'ring-orange-500'
		}
	},
	{
		key: 'fitness',
		label: 'Fitness',
		emoji: '💪',
		color: {
			bg: 'bg-rose-500/10',
			text: 'text-rose-400',
			border: 'border-rose-500',
			ring: 'ring-rose-500'
		}
	},
	{
		key: 'personal',
		label: 'Personal',
		emoji: '🌱',
		color: {
			bg: 'bg-amber-500/10',
			text: 'text-amber-400',
			border: 'border-amber-500',
			ring: 'ring-amber-500'
		}
	}
];

// Map for O(1) lookups by key — use this instead of .find() everywhere
export const AREAS_MAP = Object.fromEntries(
	AREAS.map((a) => [a.key, a])
) as Record<AreaKey, Area>;
