import { PaletteMode, ThemeProvider, createTheme } from '@mui/material';
import { deepmerge } from '@mui/utils';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { ColorModeContext, type ColorModeContextValue } from './colorModeContext';

export { ColorModeContext };

const lightPalette = {
  palette: {
    mode: 'light' as const,
    background: {
      default: '#d3e7f5',
      paper: '#ffffff',
    },
  },
};

const darkPalette = {
  palette: {
    mode: 'dark' as const,
    background: {
      default: '#0f172a',
      paper: '#111827',
    },
  },
};

const THEME_STORAGE_KEY = 'terraInvictaThemeMode';

function storedThemeMode(): PaletteMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    return null;
  }
}

function persistThemeMode(mode: PaletteMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Theme selection remains active for this page when persistence is unavailable.
  }
}

const baseComponents = {
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          transition: 'background-color 150ms ease, color 150ms ease, border-color 150ms ease',
        },
      },
    },
    MuiTooltip: {
      defaultProps: {
        arrow: true,
        enterDelay: 200,
      },
    },
  },
};

function buildTheme(mode: PaletteMode) {
  const palette = mode === 'dark' ? darkPalette : lightPalette;
  return createTheme(deepmerge({ palette: { mode } }, deepmerge(baseComponents, palette)));
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<PaletteMode>(() => {
    if (typeof window === 'undefined') return 'light';
    const stored = storedThemeMode();
    if (stored === 'light' || stored === 'dark') return stored;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    return media.matches ? 'dark' : 'light';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      const stored = storedThemeMode();
      if (stored === 'light' || stored === 'dark') {
        return;
      }
      setMode(event.matches ? 'dark' : 'light');
    };

    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    persistThemeMode(mode);
  }, [mode]);

  const colorMode = useMemo<ColorModeContextValue>(() => ({
    mode,
    setMode,
    toggleMode: () => setMode((prev) => (prev === 'light' ? 'dark' : 'light')),
  }), [mode]);

  const theme = useMemo(() => buildTheme(mode), [mode]);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
