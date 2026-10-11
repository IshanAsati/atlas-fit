import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './design/tokens.css';
import { App } from './app/App';

// Service worker: prompt on update (never mid-workout). §10.3 — an update
// must not interrupt or discard an active session; safe to wait for confirm.
registerSW({
  immediate: true,
  onNeedRefresh() {
    if (window.confirm('Atlas Fit has an update. Reload now? Your saved data is safe.')) {
      window.location.reload();
    }
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
