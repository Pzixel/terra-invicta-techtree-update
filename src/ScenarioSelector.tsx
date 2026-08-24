import { useId } from 'react';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import {
  OrderedScenarios,
  Scenarios,
  isScenarioCode,
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

  const handleChange = (event: SelectChangeEvent<ScenarioCode>) => {
    const nextCode = event.target.value;
    if (isScenarioCode(nextCode) && nextCode !== value) {
      onScenarioChange(Scenarios[nextCode]);
    }
  };

  return (
    <FormControl className="scenario-selector" size="small" fullWidth={fullWidth} disabled={disabled}>
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select<ScenarioCode>
        labelId={labelId}
        value={value}
        label={label}
        onChange={handleChange}
        renderValue={(selected) => displayName(Scenarios[selected])}
      >
        {OrderedScenarios.map((scenario) => (
          <MenuItem key={scenario.code} value={scenario.code}>
            {displayName(scenario)}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export default ScenarioSelector;
