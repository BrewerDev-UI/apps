import {
  siGithub, siDiscord, siReddit, siZoom, siDropbox, siCloudflare, siClaude, siAtlassian, siTwitch, siVercel,
  siSquare, siShopify, siNotion, siFigma, siDuolingo, siPinterest, siStrava, siCashapp, siCoinbase, siRobinhood,
  siEpicgames, siPatreon, siSquarespace, siTrello, siPerplexity, siProton, si1password, siVimeo, siCoursera,
  siNetflix, siGoogle, siApple, siMeta, siPlaystation,
} from 'simple-icons';

export type Service = {
  id: string;
  name: string;
  hex: string;          // brand color
  path?: string;        // Simple Icons path (24x24)
  mark?: string;        // lettermark when no logo is available
  host?: string;        // Statuspage host with JSON; missing = link only
  url: string;          // official status page
  kind: string;         // what people use it for, in plain words
  tips: string[];       // "meanwhile" ideas
  ripple?: string;      // note when trouble here can break other things
};

const sp = (host: string) => ({ host, url: `https://${host}` });

export const SERVICES: Service[] = [
  { id: 'github', name: 'GitHub', hex: siGithub.hex, path: siGithub.path, ...sp('www.githubstatus.com'), kind: 'Code hosting',
    tips: ['Keep working locally and commit. Push when it is back.', 'Pages sites usually stay up even when pushes fail.'],
    ripple: 'Sites and apps that deploy from GitHub may be stuck too.' },
  { id: 'discord', name: 'Discord', hex: siDiscord.hex, path: siDiscord.path, ...sp('discordstatus.com'), kind: 'Chat and voice',
    tips: ['Voice down but text fine? Switch the voice region in channel settings.', 'Do not reinstall. Your messages are safe on their side.'] },
  { id: 'reddit', name: 'Reddit', hex: siReddit.hex, path: siReddit.path, ...sp('www.redditstatus.com'), kind: 'Forums',
    tips: ['Try the website if the app fails, or the other way round.', 'Posts you wrote are not lost. Wait before posting twice.'] },
  { id: 'zoom', name: 'Zoom', hex: siZoom.hex, path: siZoom.path, ...sp('www.zoomstatus.com'), kind: 'Video calls',
    tips: ['Dial in by phone using the number in the invite.', 'Have a backup link ready: Google Meet or FaceTime.'] },
  { id: 'dropbox', name: 'Dropbox', hex: siDropbox.hex, path: siDropbox.path, ...sp('status.dropbox.com'), kind: 'File storage',
    tips: ['Files already synced to your device still open.', 'Keep saving. It will sync on its own later.'] },
  { id: 'cloudflare', name: 'Cloudflare', hex: siCloudflare.hex, path: siCloudflare.path, ...sp('www.cloudflarestatus.com'), kind: 'Internet plumbing',
    tips: ['Nothing to fix on your side. Many sites sit behind Cloudflare.', 'Using the 1.1.1.1 app? Turn it off for a while.'],
    ripple: 'A big share of the web runs through Cloudflare, so lots of unrelated sites can break at once.' },
  { id: 'claude', name: 'Claude', hex: siClaude.hex, path: siClaude.path, ...sp('status.claude.com'), kind: 'AI assistant',
    tips: ['Copy your message before retrying so you do not lose it.', 'Wait a few minutes. Retrying fast can make it slower.'] },
  { id: 'openai', name: 'OpenAI', hex: '101010', mark: 'AI', ...sp('status.openai.com'), kind: 'ChatGPT and API',
    tips: ['Copy your prompt before you refresh.', 'ChatGPT and the API can fail separately. Try the other one.'],
    ripple: 'Many apps use OpenAI behind the scenes, so their AI features may fail too.' },
  { id: 'twilio', name: 'Twilio', hex: 'F22F46', mark: 'tw', ...sp('status.twilio.com'), kind: 'Texts and sign-in codes',
    tips: ['Sign-in code not arriving? Wait, then ask for a call or email code.', 'Do not request many codes in a row. They arrive late and confuse.'],
    ripple: 'Many apps send their sign-in texts through Twilio, so codes from other companies may be late.' },
  { id: 'atlassian', name: 'Atlassian', hex: siAtlassian.hex, path: siAtlassian.path, ...sp('status.atlassian.com'), kind: 'Jira and Confluence',
    tips: ['Write updates in a note and paste them in later.'] },
  { id: 'twitch', name: 'Twitch', hex: siTwitch.hex, path: siTwitch.path, ...sp('status.twitch.com'), kind: 'Live streams',
    tips: ['Lower the video quality. It can work when full quality will not.', 'Chat and video fail separately. One may still work.'] },
  { id: 'vercel', name: 'Vercel', hex: siVercel.hex, path: siVercel.path, ...sp('www.vercel-status.com'), kind: 'Website hosting',
    tips: ['Live sites often stay up while new deploys are stuck.'],
    ripple: 'Websites hosted on Vercel may load slowly or fail.' },
  { id: 'm365', name: 'Microsoft 365', hex: 'D83B01', path: 'M0 0h11.4v11.4H0zM12.6 0H24v11.4H12.6zM0 12.6h11.4V24H0zM12.6 12.6H24V24H12.6z', url: 'https://status.cloud.microsoft', kind: 'Outlook, Teams, Office',
    tips: ['Outlook on the web and the phone app can fail separately. Try the other.', 'Urgent? Text or call instead of email.'] },
  { id: 'netflix', name: 'Netflix', hex: siNetflix.hex, path: siNetflix.path, url: 'https://help.netflix.com/en/is-netflix-down', kind: 'Streaming',
    tips: ['Downloads on your phone still play.', 'Sign out and in only after the status page says it is fixed.'] },
  { id: 'square', name: 'Square', hex: siSquare.hex, path: siSquare.path, ...sp('www.issquareup.com'), kind: 'Payments',
    tips: ['Turn on Offline Payments in the Square app to keep taking cards.', 'Have a cash float or a payment link as a backup.'] },
  { id: 'shopify', name: 'Shopify', hex: siShopify.hex, path: siShopify.path, ...sp('www.shopifystatus.com'), kind: 'Online stores',
    tips: ['Checkout and admin fail separately. Customers may still be able to buy.'] },
  { id: 'canva', name: 'Canva', hex: '00C4CC', mark: 'Ca', ...sp('www.canvastatus.com'), kind: 'Design',
    tips: ['Do not close the tab with unsaved work. Leave it open until it is back.'] },
  { id: 'notion', name: 'Notion', hex: siNotion.hex, path: siNotion.path, ...sp('www.notion-status.com'), kind: 'Notes and docs',
    tips: ['Pages you opened recently may still work offline in the app.'] },
  { id: 'figma', name: 'Figma', hex: siFigma.hex, path: siFigma.path, ...sp('status.figma.com'), kind: 'Design',
    tips: ['Keep the file open. Figma saves changes when it reconnects.'] },
  { id: 'duolingo', name: 'Duolingo', hex: siDuolingo.hex, path: siDuolingo.path, ...sp('status.duolingo.com'), kind: 'Language lessons',
    tips: ['Streak at risk? Duolingo often repairs streaks after an outage.'] },
  { id: 'pinterest', name: 'Pinterest', hex: siPinterest.hex, path: siPinterest.path, url: 'https://status.pinterest.com', kind: 'Ideas and pins',
    tips: ['Screenshots of pins you need today are a safe backup.'] },
  { id: 'strava', name: 'Strava', hex: siStrava.hex, path: siStrava.path, ...sp('status.strava.com'), kind: 'Run and ride tracking',
    tips: ['Your watch keeps the activity. It uploads once Strava is back.'] },
  { id: 'cashapp', name: 'Cash App', hex: siCashapp.hex, path: siCashapp.path, ...sp('status.cash.app'), kind: 'Money',
    tips: ['Do not send a payment twice. Check your activity once it is back.'] },
  { id: 'epic', name: 'Epic Games', hex: siEpicgames.hex, path: siEpicgames.path, ...sp('status.epicgames.com'), kind: 'Fortnite and store',
    tips: ['Login queues clear on their own. Leaving the queue puts you at the back.'] },
  { id: 'google', name: 'Google Workspace', hex: siGoogle.hex, path: siGoogle.path, url: 'https://www.google.com/appsstatus/dashboard/', kind: 'Gmail, Drive, Calendar',
    tips: ['Docs you marked for offline use still open.', 'Gmail on the phone can queue mail and send it later.'] },
  // Extras you can add
  { id: 'coinbase', name: 'Coinbase', hex: siCoinbase.hex, path: siCoinbase.path, ...sp('status.coinbase.com'), kind: 'Crypto', tips: ['Do not retry a trade or transfer until the status page clears.'] },
  { id: 'robinhood', name: 'Robinhood', hex: siRobinhood.hex, path: siRobinhood.path, ...sp('status.robinhood.com'), kind: 'Investing', tips: ['Check for doubled orders once it is back.'] },
  { id: 'patreon', name: 'Patreon', hex: siPatreon.hex, path: siPatreon.path, ...sp('status.patreon.com'), kind: 'Memberships', tips: ['Posts and payments fail separately. One may still work.'] },
  { id: 'squarespace', name: 'Squarespace', hex: siSquarespace.hex, path: siSquarespace.path, ...sp('status.squarespace.com'), kind: 'Websites', tips: ['Your live site may be fine even if the editor is not.'] },
  { id: 'trello', name: 'Trello', hex: siTrello.hex, path: siTrello.path, ...sp('trello.status.atlassian.com'), kind: 'Boards', tips: ['The phone app keeps changes and syncs later.'] },
  { id: 'perplexity', name: 'Perplexity', hex: siPerplexity.hex, path: siPerplexity.path, ...sp('status.perplexity.com'), kind: 'AI search', tips: ['Copy your question before retrying.'] },
  { id: 'proton', name: 'Proton', hex: siProton.hex, path: siProton.path, ...sp('status.proton.me'), kind: 'Mail and VPN', tips: ['VPN acting up? Switch to another server.'] },
  { id: '1password', name: '1Password', hex: si1password.hex, path: si1password.path, ...sp('status.1password.com'), kind: 'Passwords', tips: ['Your vault still opens on your device without their servers.'] },
  { id: 'vimeo', name: 'Vimeo', hex: siVimeo.hex, path: siVimeo.path, ...sp('status.vimeo.com'), kind: 'Video', tips: ['Lower the playback quality and try again.'] },
  { id: 'coursera', name: 'Coursera', hex: siCoursera.hex, path: siCoursera.path, ...sp('status.coursera.org'), kind: 'Courses', tips: ['Downloaded lectures still play in the app.'] },
  { id: 'apple', name: 'Apple', hex: siApple.hex, path: siApple.path, url: 'https://www.apple.com/support/systemstatus/', kind: 'iCloud, App Store', tips: ['iMessage down? Texts fall back to green SMS if you allow it in Settings.'] },
  { id: 'meta', name: 'Meta', hex: siMeta.hex, path: siMeta.path, url: 'https://metastatus.com', kind: 'Instagram, WhatsApp', tips: ['Do not reset your password. Outages often look like being logged out.'] },
  { id: 'slack', name: 'Slack', hex: '4A154B', mark: 'sl', url: 'https://slack-status.com', kind: 'Work chat', tips: ['Agree on a backup now: email or a group text.'] },
  { id: 'playstation', name: 'PlayStation', hex: siPlaystation.hex, path: siPlaystation.path, url: 'https://status.playstation.com', kind: 'PSN', tips: ['Disc and downloaded games still play offline.'] },
];

export const BY_ID: Record<string, Service> = Object.fromEntries(SERVICES.map(s => [s.id, s]));

export const DEFAULT_STACK = ['github', 'discord', 'reddit', 'zoom', 'dropbox', 'cloudflare', 'claude', 'openai', 'twilio', 'atlassian',
  'twitch', 'vercel', 'm365', 'netflix', 'square', 'shopify', 'canva', 'notion', 'figma', 'duolingo', 'pinterest', 'strava', 'cashapp', 'epic', 'google'];

/** true when white art reads better than ink on this brand color */
export function lightOn(hex: string): boolean {
  const n = parseInt(hex, 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) < 170;
}

export const GLOSSARY: [string, string][] = [
  ['Investigating', 'They know something is wrong and are looking for the cause.'],
  ['Identified', 'They found the cause and are working on the fix.'],
  ['Monitoring', 'A fix is in. They are watching to make sure it holds.'],
  ['Resolved', 'Fixed. Things should work again.'],
  ['Degraded performance', 'It works, but slowly or with hiccups.'],
  ['Partial outage', 'Broken for some people or some features.'],
  ['Major outage', 'Broken for most people.'],
  ['Maintenance', 'Planned work. Short interruptions are expected.'],
  ['Postmortem', 'The write-up afterward explaining what went wrong.'],
];
