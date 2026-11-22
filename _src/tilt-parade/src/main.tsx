import { createRoot } from 'react-dom/client';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import '@astryxdesign/theme-neutral/theme.css';
import './styles.css';
import display from '@fontsource/bagel-fat-one/files/bagel-fat-one-latin-400-normal.woff2?inline';
import body from '@fontsource/nunito/files/nunito-latin-700-normal.woff2?inline';
import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import App from './App';

const st = document.createElement('style');
st.textContent = `@font-face{font-family:"TP Display";src:url(${display}) format("woff2");font-display:block}
@font-face{font-family:"TP Body";src:url(${body}) format("woff2");font-weight:400 900;font-display:block}`;
document.head.appendChild(st);

createRoot(document.getElementById('root')!).render(<Theme theme={neutralTheme} mode="light"><App /></Theme>);

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => { });
