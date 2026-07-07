import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import HubButton from './components/HubButton';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <HubButton />
  </StrictMode>,
);
