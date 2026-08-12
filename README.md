# Stark Wayne — website

Marketing site for Stark Wayne. **Prototype** — static HTML/CSS, built to visualise the copy and brand
before design/build proper.

## View it

Open `index.html` in a browser (no build step, no dependencies). Fonts load from Google Fonts, so keep
online for correct type.

## Pages

| File | Page |
|---|---|
| `index.html` | Home |
| `how-we-work.html` | How we work |
| `proof.html` | Proof (CB Heating / EDF case study) |
| `about.html` | About |
| `contact.html` | Contact — the booking form (with a light JS demo of the within-the-hour flow) |

`assets/styles.css` — the whole design system. `assets/*.png` — Stark Wayne logos.

## Design system

Per the brand guidelines (v1.1): accent **Brass** `#9C7C4E`, headline **Cormorant 600**, body **Inter**,
hairlines over boxes, restraint. Source of truth for copy + brand lives in the marketing workspace
(`BrAIns/marketing/website/` and `BrAIns/brand/`), not in this repo.

## Prototype caveats / before launch

- Phone: **01785 508060** (the Stark Wayne line).
- Stand up the **hello@starkwayne.co.uk** inbox.
- **Booking form is a visual demo** — no data is sent. The real flow: request → Simon notified → he confirms
  with one tap → customer gets an SMS (see `booking-form.md` in the marketing workspace).
- **Client logos** are shown as text; real logo artwork to be added (permission cleared, MPX/SW only).
- **Imagery** not yet placed (brand direction: B&W editorial, real people over stock).
- Proof leans on the one client voice we have on record (Courtney / CB Heating).
