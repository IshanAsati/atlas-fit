# Local reference analysis

MiMo inspected `http://localhost:5173/` read-only on 12 October 2026.

The server showed an older Atlas Fit interface, not a separate competitor:
five tabs (Today, Plan, Workout, Library, Muscles), roughly 36 equipment choices,
and the earlier eleven-step onboarding. These observations are not a description
of the current four-tab working tree.

## Useful patterns retained

- Location-specific equipment inventories with search, category chips, selected
  counts and a location-scoped reset. The new Settings inventory follows this
  pattern rather than requiring users to scan every checkbox.
- Broad muscle groups plus specific muscles in browsing. Planning preferences
  now expose individual muscle selection with Abs/core and Legs presets.
- Reversible exercise avoidance and compatible alternatives. Planning now also
  separates equipment avoidance from equipment availability.
- Collapsible plan explanations and exercise-level reasons. New reasons explain
  focus, weekly balance, equipment exclusions and limited options.

The reference's medical-sounding substitution language, five-tab navigation and
simple automatic regeneration were not adopted. Current app navigation, guarded
plan previews, history preservation and factual filtering language take priority.

Screenshots and detailed observation logs are under:
`C:\Users\Ishan\AppData\Local\Temp\opencode\localhost5173`.

The reference analysis used desktop only. Its muscle-region drill-down and
restriction effects after regeneration were not verified. Current feature
behaviour is independently checked by `qa/preferences_check.py` across mobile
and desktop widths and through saved IndexedDB records.
