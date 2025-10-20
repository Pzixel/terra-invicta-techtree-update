import { FormControl, MenuItem, Paper, Select, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import { SelectChangeEvent } from '@mui/material/Select';
import type { MouseEvent } from 'react';
import { LanguageSelectorProps } from './types/props';
import { DefaultLanguage, Languages } from './language';
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
      const nextVersion = GameVersions[newVersionCode];
      onVersionChange(nextVersion);

      if (!language.availableVersions.includes(nextVersion.code)) {
        const fallbackLanguage = Object.values(Languages).find((langOption) =>
          langOption.availableVersions.includes(nextVersion.code)
        ) ?? DefaultLanguage;

        if (fallbackLanguage.code !== language.code) {
          onLanguageChange(fallbackLanguage);
        }
      }
    }
  };

  const availableLanguages = Object.values(Languages).filter((langOption) =>
    langOption.availableVersions.includes(version.code)
  );

  const isLanguageAvailable = language.availableVersions.includes(version.code);
  const selectLanguages = isLanguageAvailable
    ? availableLanguages
    : [...availableLanguages, language];

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
          >
            <Tooltip
              title={
                <span>
                  <strong>{gameVersion.name}</strong>
                  {gameVersion.description ? (
                    <>
                      <br />
                      {gameVersion.description}
                    </>
                  ) : null}
                </span>
              }
              arrow
              enterDelay={200}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                    width: '100%',
                    height: '100%',
                  fontSize: '1.5rem',
                  lineHeight: 1,
                }}
              >
                {gameVersion.emoji}
              </span>
            </Tooltip>
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
            const selectedCode = typeof selected === 'string' ? selected : language.code;
            const selectedLang = selectedCode && selectedCode in Languages ? Languages[selectedCode] : language;
            return <span style={{ fontSize: '1.2rem' }}>{selectedLang.icon}</span>;
          }}
        >
          {selectLanguages.map((langOption) => (
            <MenuItem
              key={langOption.code}
              value={langOption.code}
              sx={{ backgroundColor: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              disabled={!langOption.availableVersions.includes(version.code)}
            >
              <span style={{ fontSize: '1.2rem', marginRight: '8px' }}>{langOption.icon}</span>
              <span>{langOption.name}</span>
              {!langOption.availableVersions.includes('stable') && (
                <span style={{ marginLeft: 'auto', color: '#6c757d', fontSize: '0.8rem' }}>Experimental</span>
              )}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Paper>
  );
}