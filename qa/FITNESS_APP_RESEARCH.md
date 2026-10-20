# Fitness app interaction research

Atlas Fit should feel like a training companion that opens directly into the next useful action. The comparison below uses first-party product pages and help documentation for Gymverse, Hevy, Fitbod, JEFIT, Strong, Apple Fitness+, and Strava.

## Patterns that transfer to Atlas Fit

- **Today is the launchpad.** Gymverse describes opening into a planned workout, while Apple Fitness+ puts personalised plans and recommendations at the centre of the experience. Atlas Fit should keep the next session, duration, target, and one start/resume action above secondary metrics.
- **An active workout is its own mode.** Gymverse and Hevy keep the current movement and logging controls in focus. Atlas Fit already hides the main navigation during an active session; the floating resume path preserves that context after leaving it.
- **Fast logging beats browsing.** Hevy and JEFIT call out previous values, quick set entry, rest timers, notes, set types, and effort tracking. Atlas Fit's editable set rows, rest timer, warm-ups, and effort controls support the same flow.
- **Demonstrations belong at the point of use.** Gymverse and Hevy pair exercise demonstrations with cues and filters. Atlas Fit now resolves the Appwrite GIF by exact RepDB exercise name in the exercise view and falls back to the licensed RepDB illustration when a safe match is unavailable.
- **Progress closes the loop.** Gymverse promotes summaries, badges, personal records, and measurements; Hevy and JEFIT expose history, volume, and strength trends; Strava demonstrates the value of a chronological activity log with goals. Atlas Fit's history, strength, calendar, and muscle views should stay reachable from the primary navigation.
- **Onboarding should ask only what shapes the plan.** Fitbod and Gymverse use goal, experience, schedule, duration, equipment, recovery, and limitations. Atlas Fit collects the equivalent inputs before generating a plan preview.

## Design decision for this pass

The highest-value loop is **Today → Start workout → focused logging → recap → Progress**. The primary navigation therefore exposes Today, Plan, Library, and Progress. Settings remains reachable from Today, and the active workout continues to use its own immersive header and bottom action bar.

## Sources

- [Gymverse official site](https://gymverse.app/)
- [Gymverse App Store listing](https://apps.apple.com/us/app/gymverse-gym-workout-planner/id1048454034)
- [Hevy features](https://www.hevyapp.com/features/)
- [Hevy exercise library](https://help.hevyapp.com/hc/en-us/articles/35688251991575-Hevy-Exercise-Library-400-Exercises-and-Custom-Exercises)
- [Fitbod: how it works](https://help.fitbod.me/hc/en-us/sections/360001078993-Understanding-Fitbod-How-It-Works)
- [Fitbod features and integrations](https://help.fitbod.me/hc/en-us/categories/1500000286421-Features-and-Integrations)
- [JEFIT workout logging](https://www.jefit.com/use-case/workout-logging-app)
- [Strong App Store listing](https://apps.apple.com/us/app/strong-workout-tracker-gym-log/id464254577)
- [Apple Fitness+](https://www.apple.com/apple-fitness-plus/)
- [Strava training features](https://support.strava.com/en-us/articles/15402044-what-features-are-included-in-a-strava-subscription)
