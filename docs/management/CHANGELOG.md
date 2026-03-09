# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **scripts**: `html-to-json.js` updated to process data from API payloads directly.
- **export**: Integrated robust ICS calendar file generation with proper UCAB semester dates.
- **share**: Added WhatsApp sharing integration with dynamic message generation.

### Changed
- **ui**: Complete UI rebuild based on Stitch prototype (Clean White / Light Mode).
- **component**: Merged new styling into `SubjectCard.js`, `FilterPanel.js`, `SectionSelector.js`, `SelectionPanel.js`, and `ScheduleResults.js`.
- **export**: Overhauled PDF layout into a schedule grid format instead of plain text list.
- **ui**: Migrated toast notifications from Bootstrap to Tailwind CSS.
- **export**: Replaced simple URL sharing button with ICS download and WhatsApp sharing.

### Fixed
- **export**: PNG generation fixes (resolved layout truncation by expanding `scrollHeight`, corrected blurry text from `backdrop-blur`, merged multi-hour blocks into single spanning cells).
- **export**: Fixed ICS date offset and time generation.
- **export**: Removed invalid font definitions in pdfMake configuration.

---

## [1.0.1] - 2026-02-28

### Changed
- **ui**: Update typography to DM Sans + IBM Plex Mono (PR #12)
- **ui**: Add prefers-reduced-motion for accessibility (PR #12)
- **ui**: Remove unnecessary pulse animations (PR #12)

### Fixed
- **a11y**: Fix WCAG contrast ratio for candidate badges (PR #12)
- **a11y**: Badge text now has sufficient contrast (#1a1a1a on #ffc107)

## [1.0.0] - 2026-02-28

### Added
- Initial release
- Subject selection with priority/candidate modes
- Schedule generation algorithm
- Campus filtering (Caracas, Valencia, San Cristóbal)
- Open sections only toggle
- Search/filter by code or name

---

## Template (for future use)

### [Version] - YYYY-MM-DD

### Added
- [Description]

### Changed
- [Description]

### Removed
- [Description]

### Fixed
- [Description]
