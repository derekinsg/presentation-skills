# Style Selection Guide

Use this guide with `styles/style-catalog.json` when the user wants a brand-inspired visual direction instead of only a generic adjective like "modern" or "serious".

## How To Choose

1. Match the audience and deck purpose first.
2. Pick a source style from the catalog.
3. Map it to the nearest PPT layout family:
   - `product-launch`
   - `warm-editorial`
   - `executive-report`
   - `consulting-report`
   - `dark-tooling`
   - `minimal-monochrome`
   - `luxury-brand`
   - `playful-consumer`
   - `cinematic-dark`
4. Use the source style's resolved tokens for color, typography bias, radius, and depth.
5. Keep the HTML output to one final resolved style. Do not embed the whole catalog into the deck.

## Strong Matches

- Product capability, tools, founder demos:
  `apple`, `stripe`, `vercel`, `linear.app`, `supabase`, `cursor`
- Warm onboarding, teaching, approachable explainers:
  `airbnb`, `notion`, `intercom`, `miro`, `starbucks`
- Executive updates, serious enterprise narratives:
  `hashicorp`, `ibm`, `mongodb`, `sentry`, `wise`
- Consulting and report-heavy decks:
  `clickhouse`, `coinbase`, `kraken`, `revolut`, `vodafone`
- Premium brand, campaign, vision decks:
  `apple`, `tesla`, `ferrari`, `bugatti`, `nike`
- Dark cinematic or media-rich launches:
  `elevenlabs`, `runwayml`, `spotify`, `raycast`

## Translation Rules

- Do not mechanically copy homepage layout into a PPT.
- Many websites are navigation-heavy or marketing-page-heavy; translate them into slide systems, not full-page clones.
- For dense analysis decks, prefer styles with restrained borders, stable grids, and chart-friendly contrast.
- For speech decks, prefer styles that leave room for large type and visible emphasis, not only browser UI chrome.
- If a chosen source style is beautiful but too decorative for the deck, keep the tone, palette, and typography bias while reducing flourish.

## Fallback Strategy

- If the user names a specific site, honor it when possible.
- If the user gives only a mood, pick from the catalog and record the chosen source style in the deck's resolved theme payload.
- If the chosen source style is a bad fit for charts or dense proof, keep the source color/typography cues but fall back to `executive-report` or `consulting-report` layout structure.
