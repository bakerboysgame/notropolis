// Achievement system constants

export const RARITY_COLORS = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
} as const;

export const RARITY_BG_COLORS = {
  common: 'bg-gray-500/20',
  uncommon: 'bg-green-500/20',
  rare: 'bg-blue-500/20',
  epic: 'bg-purple-500/20',
  legendary: 'bg-amber-500/20',
} as const;

export const RARITY_BORDER_COLORS = {
  common: 'border-gray-500',
  uncommon: 'border-green-500',
  rare: 'border-blue-500',
  epic: 'border-purple-500',
  legendary: 'border-amber-500',
} as const;

export const RARITY_TEXT_COLORS = {
  common: 'text-gray-400',
  uncommon: 'text-green-400',
  rare: 'text-blue-400',
  epic: 'text-purple-400',
  legendary: 'text-amber-400',
} as const;

export const ACHIEVEMENT_CATEGORIES = [
  { id: 'all', name: 'All', icon: '🏅' },
  { id: 'hero', name: 'Hero', icon: '🦸' },
  { id: 'wealth', name: 'Wealth', icon: '💰' },
  { id: 'combat', name: 'Combat', icon: '⚔️' },
  { id: 'social', name: 'Social', icon: '🤝' },
  { id: 'collection', name: 'Collection', icon: '📦' },
] as const;

export type Rarity = keyof typeof RARITY_COLORS;
export type AchievementCategory = (typeof ACHIEVEMENT_CATEGORIES)[number]['id'];
