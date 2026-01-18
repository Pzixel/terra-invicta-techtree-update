import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from "react-router";
import App from './App'
import GamefilesBrowser from './GamefilesBrowser';
import { AppThemeProvider } from './theme.tsx';
import DrivesChart from './DrivesChart';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppThemeProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path=":id" element={<App />} />
          <Route path="/browse" element={<GamefilesBrowser />} />
          <Route path="/drives" element={<DrivesChart />} />
        </Routes>
      </HashRouter>
    </AppThemeProvider>
  </StrictMode>,
)
