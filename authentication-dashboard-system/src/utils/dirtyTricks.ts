// Dirty Tricks utility - PvP attack system definitions and formulas

export type TrickType =
  | 'graffiti'
  | 'smoke_bomb'
  | 'stink_bomb'
  | 'cluster_bomb'
  | 'fire_bomb'
  | 'destruction_bomb';

export interface DirtyTrick {
  id: TrickType;
  name: string;
  description: string;
  cost: number;
  damage: number;
  policeCatchRate: number; // Base rate (0-1)
  securityCatchRate: number; // Base rate (0-1)
  levelRequired: number;
  icon: string;
}

export const DIRTY_TRICKS: Record<TrickType, DirtyTrick> = {
  graffiti: {
    id: 'graffiti',
    name: 'Graffiti',
    description: 'Spray paint their building. Low damage, low risk.',
    cost: 500,
    damage: 5,
    policeCatchRate: 0.10,
    securityCatchRate: 0.15,
    levelRequired: 1,
    icon: '🎨'
  },
  smoke_bomb: {
    id: 'smoke_bomb',
    name: 'Smoke Bomb',
    description: 'Fill the building with smoke. Moderate damage.',
    cost: 1500,
    damage: 15,
    policeCatchRate: 0.20,
    securityCatchRate: 0.25,
    levelRequired: 1,
    icon: '💨'
  },
  stink_bomb: {
    id: 'stink_bomb',
    name: 'Stink Bomb',
    description: 'Make it uninhabitable. Good damage.',
    cost: 3000,
    damage: 25,
    policeCatchRate: 0.30,
    securityCatchRate: 0.35,
    levelRequired: 2,
    icon: '🦨'
  },
  cluster_bomb: {
    id: 'cluster_bomb',
    name: 'Cluster Bomb',
    description: 'Multiple small explosives. High damage, high risk.',
    cost: 6000,
    damage: 35,
    policeCatchRate: 0.40,
    securityCatchRate: 0.45,
    levelRequired: 3,
    icon: '💣'
  },
  fire_bomb: {
    id: 'fire_bomb',
    name: 'Fire Bomb',
    description: 'Set the building ablaze. Very high damage + fire spread.',
    cost: 10000,
    damage: 40,
    policeCatchRate: 0.50,
    securityCatchRate: 0.55,
    levelRequired: 4,
    icon: '🔥'
  },
  destruction_bomb: {
    id: 'destruction_bomb',
    name: 'Destruction Bomb',
    description: 'Maximum devastation. Extreme damage, extreme risk.',
    cost: 20000,
    damage: 60,
    policeCatchRate: 0.70,
    securityCatchRate: 0.75,
    levelRequired: 5,
    icon: '💥'
  }
};

// Location multipliers for fine calculation
export const LOCATION_MULTIPLIERS: Record<string, number> = {
  town: 1.0,
  city: 1.5,
  capital: 2.0
};

// Security system bonuses (additive with base security catch rate)
export const SECURITY_BONUSES = {
  cameras: 0.10,
  guard_dogs: 0.15,
  security_guards: 0.25
};

/**
 * Calculate total catch rate including security systems
 */
export function calculateSecurityCatchRate(
  baseCatchRate: number,
  hasCameras: boolean,
  hasGuardDogs: boolean,
  hasSecurityGuards: boolean
): number {
  let totalRate = baseCatchRate;

  if (hasCameras) totalRate += SECURITY_BONUSES.cameras;
  if (hasGuardDogs) totalRate += SECURITY_BONUSES.guard_dogs;
  if (hasSecurityGuards) totalRate += SECURITY_BONUSES.security_guards;

  return Math.min(totalRate, 1.0); // Cap at 100%
}

/**
 * Calculate fine amount based on trick cost and location
 */
export function calculateFine(
  trickCost: number,
  locationType: string
): number {
  const multiplier = LOCATION_MULTIPLIERS[locationType] || 1.0;
  return Math.floor(trickCost * 3 * multiplier);
}

/**
 * Check if police are on strike today
 */
export function isPoliceStrike(policeStrikeDay: number | null): boolean {
  if (policeStrikeDay === null) return false;
  const today = new Date().getDay(); // 0 = Sunday, 6 = Saturday
  return today === policeStrikeDay;
}

/**
 * Get available tricks for a given company level
 */
export function getAvailableTricks(companyLevel: number): DirtyTrick[] {
  return Object.values(DIRTY_TRICKS).filter(
    trick => trick.levelRequired <= companyLevel
  );
}

/**
 * Format attack result for display
 */
export function formatAttackResult(
  trickType: TrickType,
  damageDealt: number,
  wasCaught: boolean,
  caughtBy: string | null,
  fineAmount: number | null
): string {
  const trick = DIRTY_TRICKS[trickType];

  let result = `${trick.icon} ${trick.name} attack dealt ${damageDealt}% damage!`;

  if (wasCaught) {
    result += `\n\n🚨 Caught by ${caughtBy}! Fine: $${fineAmount?.toLocaleString()}`;
  } else {
    result += '\n\n✅ Escaped successfully!';
  }

  return result;
}
