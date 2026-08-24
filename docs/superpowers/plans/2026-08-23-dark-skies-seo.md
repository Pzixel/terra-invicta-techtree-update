# Latest 1.0 + Dark Skies SEO Implementation Plan

> **Living plan:** Keep decisions and progress aligned with current evidence.
> Delegation and review apply only when their own triggers match.

**Goal:** Prepare a verified, deployable Terra Invicta 1.0 tech tree with Standard, Dark Skies 2003, and Broken Earth scenarios, scenario-safe state and URLs, crawlable DLC pages, and build-failing SEO metadata validation.

**Target scope:** This repository and its existing GitHub Pages artifact. `/Users/pzixel/Documents/Repos/pzixel.github.io` and search-console/webmaster mutations are outside the local implementation scope.

**Fixed constraints:** Standard is the default; `ver=stable|experimental` remains supported and both versions initially use one verified snapshot; scenario query values are `2003` and `broken-earth` and are omitted for Standard; imported base and DLC files must come from one Steam build; root title and description use the approved copy; canonical titles are 15–69 Unicode characters and descriptions are 50–155; tests remain only when they protect an observable repository-owned contract with an independent oracle and plausible regression.

**Authoritative references:** The user-approved release specification in this task; current root `AGENTS.md`; Steam app manifest `appmanifest_1176470.acf`; current repository build workflow and source.

**Current evidence:** On 2026-08-24, one successful authenticated Steam account session downloaded Windows public build `24479907`, base depot `1176471` manifest `3504609025059582964`, and Dark Skies depot `4713340` manifest `1117456866270863502`. The fail-closed importer validated and recorded 2,476 source hashes and 72 version/scenario/language tuples. The shared compiler reproduces Standard `149/718`, 2003 `152/748`, and Broken Earth `148/714`. The production build generates and validates 870 canonical pages plus 50 `noindex, follow` DLC-only entity route shells.

**Open gates:** Deployment and Google/Bing console submission remain outside local implementation scope and require separate authorization. The sibling `pzixel.github.io` host repository remains intentionally unchanged pending recrawl evaluation.

## Milestone 1: Verified source and scenario semantics

**Status:** Complete

**Depends on:** Installed source files and read-only inspection of the game loader/data.

**Scope:** Base Templates/Localization, Dark Skies scenario Templates/Localization, Steam manifest evidence, and technology/project graph fields.

**Work:** Trace scenario overlay, eligibility, alias resolution, and `altPrereqN` behavior. Enumerate added, replaced, removed, and excluded technology/project records for each scenario. Define source hashes over deterministic relative paths and file bytes. Check referenced icon coverage without regenerating unchanged categories.

**Acceptance:** One reproducible compiler model yields Standard `149/718`, 2003 `152/748`, and Broken Earth `148/714`; every exclusion is named; aliases resolve without missing targets or cycles; alternative prerequisite slots have a verified representation; source and depot provenance are recorded.

**Decision gate and fallback:** The mismatched Mac snapshot remains rejected. The exact authenticated Windows base and Dark Skies depots satisfy the pinned manifests, source hashes, alias/localization gates, prerequisite semantics, and all three required counts.

## Milestone 2: Imported snapshot and shared compiler

**Status:** Complete

**Depends on:** Milestone 1 acceptance.

**Scope:** Tracked stable/experimental raw data, imported Dark Skies overlays/localization, deterministic release metadata, and scenario/language bundles consumed by build-time and browser code.

**Constraints and interfaces:** Stage a complete copy before synchronizing tracked directories and deletions. One compiler owns replacement, tombstone, eligibility, aliases, DLC/variant annotations, and prerequisite slots. Stable and experimental remain distinct public version codes but share source evidence and effective counts.

**Acceptance:** A clean import from the exact installation reproduces tracked files and release hashes; compiler validation rejects malformed JSON, duplicate identifiers, missing/cyclic aliases, invalid references, wrong counts, and missing icons; generated bundles are keyed by version, scenario, and language.

## Milestone 3: Scenario-safe application behavior

**Status:** Complete locally

**Depends on:** Compiler bundle contract from Milestone 2.

**Scope:** Initial URL parsing, early graph boot, React data load/switch, selector beside search, graph/search/sidebar indicators, layout bundles, and research progress storage.

**Constraints and interfaces:** Standard omits `scenario`; invalid values normalize to Standard; `/dark-skies/2003/` and `/dark-skies/broken-earth/` load their corresponding scenario; a failed switch keeps the previously active data and URL; compatible node selection survives; legacy research progress migrates only to Standard and new storage is namespaced by version and scenario; DLC status has a non-color symbol and text.

**Acceptance:** Direct query/static routes select the correct compiled bundle; each successful switch updates URL and data together; failed loading does neither; category color and compatible selection remain stable; progress cannot cross version/scenario boundaries; added and replaced records carry the required accessible labeling.

## Milestone 4: Canonical SEO generation and validation

**Status:** Complete locally

**Depends on:** Scenario compiler output and route contract.

**Scope:** Root, utility, entity, and two Dark Skies landing pages; Open Graph/Twitter parity; canonical URLs; sitemap.

**Constraints and interfaces:** Approved root title/description are shared with visible lead content. Long entity titles first use `TI Tech Tree`, then Unicode-safe ellipsis on only the entity fragment. Query scenario URLs canonicalize to a static landing page; only canonical static URLs enter the sitemap.

**Acceptance:** The production build parses every generated canonical HTML file and proves exactly one title and meta description, title length 15–69, description length 50–155, uniqueness across indexable pages, correct canonical/OG/Twitter fields, full untruncated H1/entity body names, and both DLC landing URLs in the sitemap. DLC-only entity shells are physically addressable, scenario-bootstrap before app startup, canonicalize to their matching landing page, and remain excluded from the sitemap.

## Milestone 5: Release-boundary verification

**Status:** Complete locally; deployment not performed

**Depends on:** All implementation changes.

**Scope:** Fresh Node 20 unit tests with independent behavioral oracles, TypeScript, targeted lint, production build, generated artifact inspection, and local route smoke checks.

**Acceptance:** After the final relevant change, all 36 contract tests, `npm run tsc`, changed-file lint, and `npm run build` exit zero. Generated counts, release hashes, 870 canonical pages, 50 DLC route shells, sitemap, robots, and a representative direct DLC entity URL are verified. Deployment and Google/Bing console submission remain explicitly unclaimed unless separately authorized and observed.
