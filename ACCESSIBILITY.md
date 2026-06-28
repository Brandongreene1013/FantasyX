# Accessibility

## Target

FantasyX targets WCAG 2.2 AA for the MVP user interface.

## Implemented hardening

- Semantic landmarks: `header`, named `nav`, `main`, and `footer`
- Skip-to-content link
- Visible keyboard focus ring for links, buttons, inputs, selects, and custom focus targets
- Accessible button groups for position and threshold filters using `aria-pressed`
- Trade modal uses `role="dialog"` and `aria-modal="true"`
- Trade modal has labelled title/description
- Trade modal traps keyboard focus
- Escape closes the trade modal
- Initial modal focus moves to the amount field
- Focus returns to the triggering element after modal close
- Trade and admin mutation feedback use `aria-live`
- Form controls include labels and helper/error text via `aria-describedby`
- Icon-only controls have accessible names
- Contrast-sensitive text utility classes were strengthened

## Automated checks

Run:

```bash
npm run test:a11y
```

The axe suite covers:

- Home page
- Markets page
- Trade modal
- Portfolio page
- Leaderboard page
- Admin page

Prerequisites:

```bash
docker compose up -d
npm run prisma:push
npm run prisma:seed
npm run dev
```

If Playwright browsers are not installed on a new machine, run:

```bash
npx playwright install
```

## Manual QA checklist

- Use `Tab` from the top of the page and confirm the skip link appears.
- Activate skip link and confirm focus moves to main content.
- Navigate all header and mobile nav links with keyboard only.
- On `/markets`, move through position and threshold filter button groups with keyboard.
- Open a trade modal from a Buy YES/NO button.
- Confirm focus starts in the Amount input.
- Press `Tab` and `Shift+Tab`; focus must remain inside the modal.
- Press `Escape`; modal must close and focus must return to the Buy button.
- Submit an invalid amount; error text must be announced and visually shown.
- Confirm all form labels are visible and meaningful.
- Confirm loading, empty, and error states are understandable without color alone.
- Confirm color contrast remains readable in normal and high-contrast display settings.
- Confirm zoom at 200% does not hide critical controls.
- Confirm reduced viewport/mobile navigation remains keyboard reachable.
