import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

/**
 * React entry point. Universal across every per-niche template.
 * Module 2D copies this file verbatim into templates/{niche-slug}/src/main.jsx.
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
