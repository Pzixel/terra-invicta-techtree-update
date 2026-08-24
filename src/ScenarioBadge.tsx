import Chip, { type ChipProps } from '@mui/material/Chip';
import { alpha, darken, useTheme } from '@mui/material/styles';
import {
    scenarioBadgeColor,
    scenarioBadgeVariant,
    scenarioMarkerColor,
    type ScenarioBadgeKind,
    type ScenarioCode,
} from './scenario';

export type ScenarioBadgeProps = Omit<ChipProps, 'color' | 'variant' | 'sx'> & {
  scenario: ScenarioCode;
  kind: ScenarioBadgeKind;
  selected?: boolean;
};

export function ScenarioBadge({
  scenario,
  kind,
  selected = false,
  ...chipProps
}: ScenarioBadgeProps) {
  const theme = useTheme();
  const color = kind === 'identity'
    ? scenarioBadgeColor(scenario)
    : scenarioMarkerColor(kind, scenario);
  const palette = theme.palette[color];
  const variant = scenarioBadgeVariant(kind, selected);
  const filled = variant === 'filled';
  const lightAccent = color === 'warning' ? darken(palette.dark, 0.25) : palette.dark;
  const accent = theme.palette.mode === 'light' ? lightAccent : palette.light;
  const filledBackground = theme.palette.mode === 'light' ? lightAccent : palette.main;

  return (
    <Chip
      {...chipProps}
      color={color}
      variant={variant}
      sx={filled
        ? {
            backgroundColor: filledBackground,
            borderColor: filledBackground,
            color: theme.palette.getContrastText(filledBackground),
            '&:hover': {
              backgroundColor: filledBackground,
              filter: 'brightness(0.92)',
            },
            '&.Mui-focusVisible': {
              outline: `2px solid ${theme.palette.text.primary}`,
              outlineOffset: 2,
            },
          }
        : {
            backgroundColor: alpha(accent, theme.palette.mode === 'light' ? 0.06 : 0.1),
            borderColor: alpha(accent, 0.8),
            color: accent,
            '&:hover': {
              backgroundColor: alpha(accent, theme.palette.mode === 'light' ? 0.12 : 0.18),
            },
            '&.Mui-focusVisible': {
              outline: `2px solid ${theme.palette.text.primary}`,
              outlineOffset: 2,
            },
          }}
    />
  );
}

export default ScenarioBadge;
