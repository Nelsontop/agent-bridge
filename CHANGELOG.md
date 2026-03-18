# Changelog

All notable changes to this project will be documented in this file.

## [0.1.1.0] - 2026-03-18

### Added
- Introduced provider contracts and registries for both CLI and channel layers, including runnable CLI providers (`codex`, `claude-code`, `opencode`, `kimi-cli`).
- Added generic CLI runner infrastructure with stream parsing and provider-specific adapters.
- Added `health-payload` builder and coverage for transport/metrics normalization.
- Added ADR and migration plan docs for the core-plugin boundary and provider V1 migration.

### Changed
- Refactored runtime structure into clearer layers (`application`, `domain`, `infrastructure`, `core`, `providers`).
- Updated health reporting to use channel adapter transport metadata instead of inferred values.
- Updated task execution flow so non-resumable providers do not reuse historical sessions and skip context compaction.
- Rewrote README for faster setup and provider-focused operations guidance.

### Fixed
- Strengthened channel adapter contract checks by requiring `getTransport()`.
- Added regression tests for non-resume provider session handling and compaction behavior.
- Expanded contract and registry test coverage across channel/CLI provider wiring.
