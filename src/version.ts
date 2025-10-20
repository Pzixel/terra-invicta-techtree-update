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
    description: '0.4.90',
    emoji: '⚖️'
  },
  experimental: {
    code: 'experimental',
    name: 'Experimental',
    shortLabel: 'Experimental',
    description: '0.4.105',
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
