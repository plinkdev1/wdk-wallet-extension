# View screenshot harness

Renders the real popup surfaces — the full `MainView` (the tabbed Home shell) and
the flow views (Swap / Lending / Bridge / Buy / SmartAccount) — in isolation so
their imagery regenerates without loading the unpacked extension. The SW client
`send()` is stubbed and the theme comes from wdk-ui's `WdkThemeProvider`.

```bash
# from apps/extension
./node_modules/.bin/vite build -c screenshots/vite.config.ts   # → screenshots/dist
python3 -m http.server -d screenshots/dist 8898
# then headless-capture screenshots/dist/{main,swap,lending,bridge,buy,smart-account}.html
```

A `resolveId` plugin redirects `../lib/sw-client.js` to `stubs/sw-client.ts`; the
stub answers the Home read messages (address / balance / token balances / price)
with sample data so `main.html` renders a populated shell.
Build output (`dist/`, incl. @web3icons chunks) is git-ignored; captured PNGs
live in `media/screenshots/*-view.png`.
