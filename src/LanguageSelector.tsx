import { FormControl, MenuItem, Paper, Select, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { SelectChangeEvent } from '@mui/material/Select';
import type { MouseEvent } from 'react';
import { LanguageSelectorProps } from './types/props';
import { Languages } from './language';
import { GameVersions, OrderedGameVersions, isGameVersionCode } from './version';

export default function LanguageSelector({
  language,
  onLanguageChange,
  version,
  onVersionChange,
}: LanguageSelectorProps) {
  const handleLanguageChange = (event: SelectChangeEvent<string>) => {
    const newLang = event.target.value;
    if (newLang && newLang in Languages && newLang !== language.code) {
      onLanguageChange(Languages[newLang]);
    }
  };

  const handleVersionChange = (_event: MouseEvent<HTMLElement>, newVersionCode: string | null) => {
    if (!newVersionCode || newVersionCode === version.code) {
      return;
    }

    if (isGameVersionCode(newVersionCode)) {
      onVersionChange(GameVersions[newVersionCode]);
    }
  };

  return (
    <Paper
      elevation={3}
      className="preferences-selector"
      sx={{
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(4px)',
        borderRadius: 2,
        p: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        minWidth: 'fit-content',
      }}
    >
      <ToggleButtonGroup
        size="small"
        value={version.code}
        exclusive
        onChange={handleVersionChange}
        aria-label="Game version"
        fullWidth
        sx={{
          '& .MuiToggleButton-root': {
            textTransform: 'none',
            px: 1.5,
            fontWeight: 600,
          },
        }}
      >
        {OrderedGameVersions.map((gameVersion) => (
          <ToggleButton
            key={gameVersion.code}
            value={gameVersion.code}
            aria-label={gameVersion.name}
            title={gameVersion.description}
          >
            {gameVersion.shortLabel}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <FormControl size="small" fullWidth sx={{ minWidth: 70 }} className="language-selector">
        <Select
          fullWidth
          sx={{ backgroundColor: 'white' }}
          value={language.code}
          onChange={handleLanguageChange}
          renderValue={(selected) => {
            const selectedLang = selected && selected in Languages ? Languages[selected] : null;
            return <span style={{ fontSize: '1.2rem' }}>{selectedLang?.icon}</span>;
          }}
        >
          {Object.values(Languages).map((langOption) => (
            <MenuItem key={langOption.code} value={langOption.code} sx={{ backgroundColor: 'white' }}>
              <span style={{ fontSize: '1.2rem', marginRight: '8px' }}>{langOption.icon}</span>
              {langOption.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Paper>
  );
}