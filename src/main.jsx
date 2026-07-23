import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './App.css';
import { debug } from './utils/debug.js';

if (import.meta.env.DEV) {
  debug.log('App', 'Dev mode — debug logs enabled. Filter console by "[TypingStories]"');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
