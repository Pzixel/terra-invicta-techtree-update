import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { HashRouter, Routes, Route } from "react-router";
import GamefilesBrowser from './GamefilesBrowser';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
     <HashRouter>
        <Routes>
            <Route path="/" element={<App />} />
            <Route path=":id" element={<App />} />
            <Route path="/browse" element={<GamefilesBrowser />} />
        </Routes>
    </HashRouter>
  </StrictMode>,
)
