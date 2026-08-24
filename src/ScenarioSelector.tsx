import { useId } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import {
  OrderedScenarios,
  scenarioBadgeColor,
  scenarioDisplayName,
  type Scenario,
  type ScenarioCode,
} from './scenario';

export interface ScenarioSelectorProps {
  value: ScenarioCode;
  onScenarioChange: (scenario: Scenario) => void;
  label: string;
  scenarioLabels?: Partial<Record<ScenarioCode, string>>;
  dlcLabel?: string;
  disabled?: boolean;
  fullWidth?: boolean;
}

export function ScenarioSelector({
  value,
  onScenarioChange,
  label,
  scenarioLabels = {},
  dlcLabel,
  disabled = false,
  fullWidth = false,
}: ScenarioSelectorProps) {
  const id = useId();
  const labelId = `${id}-label`;

  const displayName = (scenario: Scenario) => scenarioDisplayName(scenario, scenarioLabels, dlcLabel);

  return (
    <FormControl
      className="scenario-selector"
      component="fieldset"
      size="small"
      fullWidth={fullWidth}
      disabled={disabled}
    >
      <FormLabel component="legend" id={labelId}>{label}</FormLabel>
      <Box className="scenario-chip-group" role="group" aria-labelledby={labelId}>
        {OrderedScenarios.map((scenario) => (
          <Chip
            key={scenario.code}
            size="small"
            color={scenarioBadgeColor(scenario.code)}
            variant={scenario.code === value ? 'filled' : 'outlined'}
            label={displayName(scenario)}
            disabled={disabled}
            clickable={!disabled}
            aria-pressed={scenario.code === value}
            onClick={() => {
              if (scenario.code !== value) onScenarioChange(scenario);
            }}
          />
        ))}
      </Box>
    </FormControl>
  );
}

export default ScenarioSelector;
