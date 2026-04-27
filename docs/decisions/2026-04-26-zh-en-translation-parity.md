# ZH strings aligned with EN for welcome and weight guard

## Context

`T.en` and `T.zh` already share the same key set (149 keys). A few user-facing strings diverged in tone or wording from their English counterparts, especially the welcome CTA and the new “total must equal 100” helper.

## Decision

- **Welcome CTA:** Change `zh.welcomeBtn` from English-mixed `Let's Go！` to **`好，開始探索！`** to mirror `en.welcomeBtn` (“Got it, let me explore!”) in intent and language.
- **Weight total label:** Use **`總計`** for `zh.weightsTotal` to align with `en` “Total” (counting sense) vs the vaguer `總和`.
- **Weight guard helper:** Reword `zh.weightsMustEqual100` to **`請把三個滑桿調到總計 100 才能繼續。`** so it matches the English instruction structure (“set sliders to total 100 to continue”).

## Alternatives considered

- Full rewrite of all ZH copy for literal parity with EN: deferred — large surface area; keys already matched; incremental parity on high-visibility flows is enough for now.

## Consequences

- **Primary file:** `src/translations.js`.
