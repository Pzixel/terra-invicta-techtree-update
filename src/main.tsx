import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { HashRouter, Routes, Route } from "react-router";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
     <HashRouter>
        <Routes>
            <Route path="/" element={<App />} />
            <Route path=":id" element={<App />} />
        </Routes>
    </HashRouter>
  </StrictMode>,
)
