import { useContext, useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import Divider from '@mui/material/Divider';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Tooltip from '@mui/material/Tooltip';
import MenuIcon from '@mui/icons-material/Menu';
import { alpha, useTheme } from '@mui/material/styles';
import { ColorModeContext } from './theme.tsx';
import LanguageSelector from './LanguageSelector';
import { LanguageSelectorProps } from './types/props';
import { Link } from "react-router";

export type SettingsMenuProps = LanguageSelectorProps;

export function SettingsMenu(props: SettingsMenuProps) {
  const { mode, setMode } = useContext(ColorModeContext);
  const theme = useTheme();
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
        <IconButton
          onClick={handleOpen}
          size="small"
          aria-label="Settings menu"
          sx={{
            alignSelf: 'flex-start',
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
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        keepMounted
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1.5, minWidth: 260 }}>
          <LanguageSelector {...props} variant="inline" />
          <Divider />
          <FormControlLabel
            control={<Switch checked={mode === 'dark'} onChange={handleThemeToggle} size="small" />}
            label="Dark mode"
          />
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
      </Menu>
    </>
  );
}
