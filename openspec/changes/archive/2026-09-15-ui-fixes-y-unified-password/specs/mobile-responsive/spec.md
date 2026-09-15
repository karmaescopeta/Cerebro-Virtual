## ADDED Requirements

### Requirement: Responsive layout
The app SHALL be fully usable on mobile viewports (<=768px) with no page-level horizontal scrolling, and on desktop the main content SHALL fit the viewport without a horizontal scrollbar.

#### Scenario: Mobile viewport
- **GIVEN** a 375px-wide viewport
- **WHEN** any tab is opened
- **THEN** all content fits the viewport width with no page-level horizontal scroll and the bottom nav is usable

#### Scenario: Desktop fullscreen
- **GIVEN** a 1440px-wide viewport
- **WHEN** any tab is opened
- **THEN** no horizontal scrollbar appears at the bottom of the page
