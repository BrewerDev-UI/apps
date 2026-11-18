import { createRoot } from 'react-dom/client';
import display from '@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2?inline';
import body from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?inline';
import mono from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?inline';
import './styles.css';
import App from './App';

// Fonts ride inside the page so the app looks right offline, and so the story canvas can draw with them.
const f = document.createElement('style');
f.textContent = `@font-face{font-family:"RR Display";src:url(${display}) format("woff2");font-weight:200 800;font-display:block}@font-face{font-family:"RR Body";src:url(${body}) format("woff2");font-weight:100 900;font-display:swap}@font-face{font-family:"RR Mono";src:url(${mono}) format("woff2");font-weight:100 800;font-display:swap}`;
document.head.appendChild(f);

createRoot(document.getElementById('root')!).render(<App />);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}
