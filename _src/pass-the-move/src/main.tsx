import { createRoot } from 'react-dom/client';
import display from '@fontsource/unbounded/files/unbounded-latin-800-normal.woff2?inline';
import body from '@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2?inline';
import './styles.css';
import App from './App';

// Fonts ride inside the page so the app looks right offline, and so the share clip can draw with them.
const f = document.createElement('style');
f.textContent = `@font-face{font-family:"PM Display";src:url(${display}) format("woff2");font-weight:800;font-display:block}@font-face{font-family:"PM Body";src:url(${body}) format("woff2");font-weight:100 1000;font-display:swap}`;
document.head.appendChild(f);

createRoot(document.getElementById('root')!).render(<App />);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}
