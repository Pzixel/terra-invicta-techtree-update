import { useId } from 'react';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import ScenarioBadge from './ScenarioBadge';
import {
  OrderedScenarios,
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
      <Box className="scenario-chip-group">
        {OrderedScenarios.map((scenario) => (
          <ScenarioBadge
            key={scenario.code}
            scenario={scenario.code}
            kind="identity"
            selected={scenario.code === value}
            size="small"
            label={displayName(scenario)}
            disabled={disabled}
            clickable
            aria-pressed={scenario.code === value}
            aria-disabled={disabled || undefined}
            onClick={() => {
              if (!disabled && scenario.code !== value) onScenarioChange(scenario);
            }}
          />
        ))}
      </Box>
    </FormControl>
  );
}

export default ScenarioSelector;
