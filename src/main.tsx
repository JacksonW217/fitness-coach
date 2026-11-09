import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { loadCustomExercises, requestPersistence } from './db';
import './styles.css';

registerSW({ immediate: true });
requestPersistence();

// Custom exercises must be in the catalog before any screen resolves exercise ids.
loadCustomExercises().finally(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  ),
);
