export type GameVersionCode = 'stable' | 'experimental';

export interface GameVersion {
  code: GameVersionCode;
  name: string;
  shortLabel: string;
  description?: string;
  emoji: string;
}

export const GameVersions: Record<GameVersionCode, GameVersion> = {
  stable: {
    code: 'stable',
    name: 'Stable',
    shortLabel: 'Stable',
    description: '1.0',
    emoji: '⚖️'
  },
  experimental: {
    code: 'experimental',
    name: 'Experimental',
    shortLabel: 'Experimental',
    description: '1.0', // both codes resolve to one verified snapshot for this release
    emoji: '🔬'
  }
};

export const DefaultVersion = GameVersions.stable;

export const OrderedGameVersions: GameVersion[] = [
  GameVersions.stable,
  GameVersions.experimental,
];

export function isGameVersionCode(value: string | null | undefined): value is GameVersionCode {
  return !!value && value in GameVersions;
}
