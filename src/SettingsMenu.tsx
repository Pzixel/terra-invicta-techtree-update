import { useContext, useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import Divider from '@mui/material/Divider';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Tooltip from '@mui/material/Tooltip';
import SettingsIcon from '@mui/icons-material/Settings';
import { ColorModeContext } from './theme';
import LanguageSelector from './LanguageSelector';
import { LanguageSelectorProps } from './types/props';

export type SettingsMenuProps = LanguageSelectorProps;

export function SettingsMenu(props: SettingsMenuProps) {
  const { mode, setMode } = useContext(ColorModeContext);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const open = Boolean(anchorEl);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleThemeToggle = () => {
    setMode(mode === 'light' ? 'dark' : 'light');
  };

  return (
    <>
      <Tooltip title="Settings">
        <IconButton onClick={handleOpen} size="small" aria-label="Settings menu">
          <SettingsIcon />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        keepMounted
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1.5, minWidth: 260 }}>
          <LanguageSelector {...props} variant="inline" />
          <Divider />
          <FormControlLabel
            control={<Switch checked={mode === 'dark'} onChange={handleThemeToggle} size="small" />}
            label="Dark mode"
          />
        </Box>
      </Menu>
    </>
  );
}
