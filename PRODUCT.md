# Atlas Fit

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Personal-use strength trainee using an iPhone, training at home, at a gym, and while travelling. Development happens on Windows.

## Product Purpose

Make it easy to start an appropriate workout, understand its exercises, record actual performance, and adapt subsequent training to available time and equipment.

## Capabilities and Constraints

- React, TypeScript, and Vite installable PWA; offline-first and local-first.
- No required accounts, backend, or paid APIs.
- Equipment-aware, explainable deterministic planning with restriction filters.
- Preserve completed history and provide export/import backups.
- Licensed exercise illustrations, written cues, and original independently tappable front/back cartoon muscle artwork.
- Activity estimates describe logged training, not measured recovery or muscle activation.
- Preserve the local planning catalogue. The user subsequently requested the ExerciseDB OSS documentation: its free API is an optional personal/non-commercial browse source, not an unreviewed automatic planner input. It requires AscendAPI attribution and has strict rate limits and 180p GIF media.

## Current Priorities

The user selected training flow as the priority and authorised implementation: faster logging, useful exercise images, equipment-aware swaps, reusable routines, and clear progression. The implemented direction is matte forest, chalk text, and soft lime actions, with independent rose/lavender muscle classifications. This records the implementation direction, not final artwork or on-device user acceptance.

## Evidence on Hand

- `../ATLAS_FIT_SPEC.md`: product requirements and original constraints. The user's new-color request supersedes its original brand palette, not automatically its muscle classification semantics.
- `src/`: current implementation; it differs substantially from earlier conversation snapshots.
- `qa/` and root screenshots: historical evidence, not verification of the current implementation.

## Accessibility & Inclusion

iPhone-first, safe-area-aware controls, comfortable touch targets, readable contrast, reduced-motion support, and accessible alternatives to small muscle regions. Avoid body-comparison pressure and never encourage training through pain.

## Open Decisions

Original artwork and final device-level acceptance remain for the user. Production Chromium checks pass at mobile and desktop widths, including offline app reload/logging/completion, downloaded exercise images, routines, canonical kg storage with kg/lb display, single exercise dialogs, and guarded backup restore. ExerciseDB browser-flow checks use a documented-response fixture; live API/CORS and sample GIF availability were checked separately. Actual iPhone Safari, installation, VoiceOver, and storage eviction have not been verified. The build still warns about its catalogue-heavy JavaScript bundle.
