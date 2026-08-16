import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from "react-router";
import App from './App'
import GamefilesBrowser from './GamefilesBrowser';
import { AppThemeProvider } from './theme.tsx';
import DrivesChart from './DrivesChart';
import { BASE_PATH } from './utils';

// Legacy HashRouter links (/#/SomeTech?x=y) — rewrite to real paths before the router reads the URL
if (window.location.hash.startsWith('#/')) {
  const [hashPath, hashQuery] = window.location.hash.slice(2).split('?');
  const search = new URLSearchParams(window.location.search);
  if (hashQuery) {
    new URLSearchParams(hashQuery).forEach((value, key) => search.set(key, value));
  }
  const query = search.toString();
  window.history.replaceState(null, '', BASE_PATH + hashPath + (query ? `?${query}` : ''));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppThemeProvider>
      <BrowserRouter basename={BASE_PATH.replace(/\/$/, '') || '/'}>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path=":id" element={<App />} />
          <Route path="/browse" element={<GamefilesBrowser />} />
          <Route path="/drives" element={<DrivesChart />} />
        </Routes>
      </BrowserRouter>
    </AppThemeProvider>
  </StrictMode>,
)
