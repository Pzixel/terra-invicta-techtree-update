import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from "react-router";
import App from './App'
import { AppThemeProvider } from './theme.tsx';
import { BASE_PATH } from './utils';

const GamefilesBrowser = lazy(() => import('./GamefilesBrowser'));
const DrivesChart = lazy(() => import('./DrivesChart'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppThemeProvider>
      <BrowserRouter basename={BASE_PATH.replace(/\/$/, '') || '/'}>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path=":id" element={<App />} />
          <Route path="/browse" element={<Suspense fallback={<div id="loading">Loading</div>}><GamefilesBrowser /></Suspense>} />
          <Route path="/drives" element={<Suspense fallback={<div id="loading">Loading</div>}><DrivesChart /></Suspense>} />
        </Routes>
      </BrowserRouter>
    </AppThemeProvider>
  </StrictMode>,
)
