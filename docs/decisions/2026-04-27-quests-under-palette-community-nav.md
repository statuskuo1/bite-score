# Context

Quests had a dedicated bottom-nav tab and root view; community discovery lived under My Log as a fourth sub-tab. Product goal: consolidate **quests with My Taste** (palette) and give **Community** its own obvious entry point.

## Decision

- Bottom nav: **My Log · My Taste · Add · Community · FAQ** (removed **Quests** nav item).
- **`st.view==="community"`** renders the former My Log community feed (sub-tabs + skeleton + rows); **`useEffect`** loads community visits when **`st.view === "community"`**.
- Extract **`QuestsPaletteSection`**: full A–Z + cuisine quest UI placed on **My Taste → Restaurants** after **Cuisine breakdown**, with divider + section label **`cuisineQuestsSection`** (“Cuisine Quests”), then stat cards.
- **`SuggestView`** back navigation returns to **`palette`**; copy keys **`backToMyTaste`**, **`regionsNote`** updated for scroll-based discovery.

## Alternatives considered

- Keep community under Log only — rejected; conflicts with explicit five-item nav spec.

## Consequences

- **`src/App.jsx`**, **`src/components/PaletteView.jsx`**, **`src/components/QuestsPaletteSection.jsx`**, **`src/translations.js`**, **`src/components/SuggestView.jsx`**; **`st.view==="quests"`** removed.
