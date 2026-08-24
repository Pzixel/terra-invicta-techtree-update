import { useContext, useState, type MouseEvent } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import Divider from '@mui/material/Divider';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Tooltip from '@mui/material/Tooltip';
import MenuIcon from '@mui/icons-material/Menu';
import { alpha, useTheme } from '@mui/material/styles';
import { ColorModeContext } from './colorModeContext';
import LanguageSelector from './LanguageSelector';
import { LanguageSelectorProps } from './types/props';
import { Link } from "react-router";
import ScenarioSelector from './ScenarioSelector';
import {
  interpolateScenarioText,
  markScenarioMenuDiscovered,
  scenarioDisplayName,
  scenarioMenuNeedsDiscovery,
  Scenarios,
  type Scenario,
  type ScenarioCode,
} from './scenario';

export type SettingsMenuProps = LanguageSelectorProps & {
  onOpenDrives?: () => void;
  scenario: ScenarioCode;
  onScenarioChange: (scenario: Scenario) => void;
  scenarioLabels: Partial<Record<ScenarioCode, string>>;
  scenarioLabel: string;
  dlcLabel: string;
  isScenarioLoading: boolean;
};

export function SettingsMenu(props: SettingsMenuProps) {
  const { mode, setMode } = useContext(ColorModeContext);
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [showScenarioDiscovery, setShowScenarioDiscovery] = useState(() => {
    try {
      return scenarioMenuNeedsDiscovery(typeof window === 'undefined' ? null : window.localStorage);
    } catch {
      return true;
    }
  });
  const driveChartLabel = props.language.uiTexts.driveChartTitle;

  const open = Boolean(anchorEl);
  const activeScenarioName = scenarioDisplayName(
    Scenarios[props.scenario],
    props.scenarioLabels,
    props.dlcLabel,
  );
  const currentScenarioLabel = interpolateScenarioText(
    props.language.uiTexts.settingsCurrentScenario,
    { scenario: activeScenarioName },
  );
  const settingsButtonLabel = showScenarioDiscovery
    ? `${currentScenarioLabel}. ${props.language.uiTexts.scenarioSettingsDiscovery}`
    : currentScenarioLabel;

  const handleOpen = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    if (showScenarioDiscovery) {
      setShowScenarioDiscovery(false);
      try {
        markScenarioMenuDiscovered(typeof window === 'undefined' ? null : window.localStorage);
      } catch {
        // The in-memory state still dismisses the badge for this page.
      }
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleThemeToggle = () => {
    setMode(mode === 'light' ? 'dark' : 'light');
  };

  const handleScenarioChange = (scenario: Scenario) => {
    handleClose();
    props.onScenarioChange(scenario);
  };

  return (
    <>
      <Tooltip
        title={showScenarioDiscovery ? props.language.uiTexts.scenarioSettingsDiscovery : ''}
        open={showScenarioDiscovery}
        disableHoverListener
        disableFocusListener
        disableTouchListener
        placement="bottom-start"
        arrow={showScenarioDiscovery}
        slotProps={{
          tooltip: {
            sx: {
              backgroundColor: theme.palette.secondary.main,
              color: theme.palette.secondary.contrastText,
              boxShadow: 2,
              fontSize: '0.72rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            },
          },
          arrow: {
            sx: { color: theme.palette.secondary.main },
          },
          transition: {
            timeout: 0,
          },
        }}
      >
        <Box sx={{ alignSelf: 'flex-start', display: 'inline-flex' }}>
          <IconButton
            onClick={handleOpen}
            size="small"
            aria-label={settingsButtonLabel}
            aria-haspopup="dialog"
            aria-expanded={open ? 'true' : undefined}
            aria-controls={open ? 'settings-popover' : undefined}
            sx={{
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              boxShadow: 1,
              '&:hover': {
                backgroundColor: alpha(theme.palette.background.paper, 0.9),
              },
            }}
          >
            <MenuIcon />
          </IconButton>
        </Box>
      </Tooltip>
      <Popover
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        keepMounted
      >
        <Box
          id="settings-popover"
          role="dialog"
          aria-label={props.language.uiTexts.settingsMenuLabel}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            p: 1.5,
            width: 300,
            maxWidth: 'calc(100vw - 32px)',
            boxSizing: 'border-box',
          }}
        >
          <LanguageSelector {...props} variant="inline" />
          <Divider />
          <ScenarioSelector
            value={props.scenario}
            onScenarioChange={handleScenarioChange}
            label={props.scenarioLabel}
            scenarioLabels={props.scenarioLabels}
            dlcLabel={props.dlcLabel}
            disabled={props.isScenarioLoading}
            fullWidth
          />
          <Divider />
          <FormControlLabel
            control={<Switch checked={mode === 'dark'} onChange={handleThemeToggle} size="small" />}
            label="Dark mode"
          />
          <Divider />
          <button
            type="button"
            className="utility-link"
            style={{
              color: theme.palette.mode === 'dark' ? '#60a5fa' : '#0b4b87',
              textAlign: 'left',
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
            onClick={() => props.onOpenDrives?.()}
          >
            {driveChartLabel}
          </button>
          <Divider />
          <Link
            className="utility-link"
            to="/browse"
            target="_blank"
            style={{ color: theme.palette.mode === 'dark' ? '#60a5fa' : '#0b4b87' }}
          >
            {props.language.uiTexts.browseGamefiles}
          </Link>
          <Divider />
          <a
            className="utility-link"
            href="https://github.com/Pzixel/terra-invicta-techtree-update"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: theme.palette.mode === 'dark' ? '#60a5fa' : '#0b4b87' }}
          >
            {props.language.uiTexts.projectSourceCode}
          </a>
        </Box>
      </Popover>
    </>
  );
}
