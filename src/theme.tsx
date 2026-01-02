import { CssBaseline, PaletteMode, ThemeProvider, createTheme, responsiveFontSizes } from '@mui/material';
import { deepmerge } from '@mui/utils';
import { createContext, ReactNode, useEffect, useMemo, useState } from 'react';

export type ColorModeContextValue = {
  mode: PaletteMode;
  setMode: (mode: PaletteMode) => void;
  toggleMode: () => void;
};

export const ColorModeContext = createContext<ColorModeContextValue>({
  mode: 'light',
  setMode: () => undefined,
  toggleMode: () => undefined,
});

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
  const theme = createTheme(deepmerge({ palette: { mode } }, deepmerge(baseComponents, palette)));
  return responsiveFontSizes(theme);
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<PaletteMode>('light');

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    setMode(media.matches ? 'dark' : 'light');

    const handleChange = (event: MediaQueryListEvent) => {
      setMode(event.matches ? 'dark' : 'light');
    };

    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const colorMode = useMemo<ColorModeContextValue>(() => ({
    mode,
    setMode,
    toggleMode: () => setMode((prev) => (prev === 'light' ? 'dark' : 'light')),
  }), [mode]);

  const theme = useMemo(() => buildTheme(mode), [mode]);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
