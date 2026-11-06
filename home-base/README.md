# Home Base for iPhone

Home Base is one app over your Household Manager, Back of House, Daily Line and Library Shelf. This folder is the saved version you can put on your iPhone home screen. Your four original apps are untouched.

## What's in here

- `index.html` is the whole app.
- `manifest.json`, `sw.js` and the icons make it install and open like a real app, even with no signal.
- `data.json` is a copy of your chores, pantry, recipes, meals, books, review cards and learning streak. The app loads it the first time it opens, then keeps your changes on the phone.

## Put it on your home screen

1. The phone has to open the app from a web address, so put this folder online first. The easiest free way: go to app.netlify.com/drop on your computer and drag this whole folder onto the page. It gives you a link.
2. Open that link in Safari on your iPhone.
3. Tap Share, then Add to Home Screen, then Add.
4. Open Home Base from the new icon, go to Settings and tap Allow next to Phone notifications.

Keep the link to yourself, because `data.json` holds your data. You can delete `data.json` from the online copy after the first open, since the phone keeps its own copy from then on.

## The Brain on its own icon

The folder also has `brain.html`, which opens straight into the Brain. After step 2 above, open the same link with `brain.html` on the end in Safari, then tap Share, Add to Home Screen. You get a second icon called Brain that shares the same data as Home Base.

Inside Claude, the Brain's link is your Home Base link with `#brain` on the end. Settings in the app shows it with a Copy button.

## Connect your house and the Brain

Inside Claude, Home Base uses your Claude connectors. The saved version can't, so it has its own settings:

- Home Assistant: in Settings, add your Home Assistant address (for example your Nabu Casa link) and a long-lived access token (Home Assistant, your profile, Security, Create token). Home Assistant also has to allow the app's address: add it under `http:` as `cors_allowed_origins` in `configuration.yaml`, then restart Home Assistant.
- The Brain: add an Anthropic API key in Settings (console.anthropic.com). It stays on the phone and is only sent to Anthropic.

Your calendar shows up only inside Claude for now.

## Moving data between Claude and the phone

In either version, Settings has Download for "Just my data" and Import data. Download from one and import into the other to bring them in line.

## Making it a real App Store style app later

When you want it in Xcode, wrap this folder with Capacitor:

```
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init "Home Base" com.yourname.homebase --web-dir .
npx cap add ios
npx cap open ios
```

That needs a Mac with Xcode, and an Apple Developer account to install it on your phone for more than a week.
