import { createRoot } from 'react-dom/client';
import inter from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?inline';
import tight from '@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2?inline';
import './styles.css';
import App from './App';

// Fonts ride inside the page so the app looks right offline.
const f = document.createElement('style');
f.textContent = `@font-face{font-family:"Inter";src:url(${inter}) format("woff2");font-weight:100 900;font-display:swap}@font-face{font-family:"Inter Tight";src:url(${tight}) format("woff2");font-weight:100 900;font-display:swap}`;
document.head.appendChild(f);

createRoot(document.getElementById('root')!).render(<App />);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}
