# The Dive: how the bottle textures are made

The Dive (dive.html, assets/dive.js) draws the bottle from the brand's own hero render, cut out and re-lit
so the glass lets the scene behind it through. Nothing here is published (Jekyll skips `_agent/`).

Source picture: the hero render, 633×951 (`git show e91c127:sales-assets/4c862b4a-0fcd-4610-8b80-1f9dfa81fe4c.png`).

1. `swift lift.swift hero-orig.png hero-mask.png` — macOS Vision lifts the bottle's silhouette.
2. `python3 make_bottle.py` (paths at the top of the file) — divides the photo by the studio backdrop, so glass
   becomes "how much light it lets through" and the label and cap become their own colour; writes
   `bottle-n.png` (colour, ×0.75 headroom) and `bottle-m.png` (R silhouette, G label and cap, B glass rim),
   both 512×2048, and prints the numbers used in the shader (`B_UV`, `B_ASP`).
3. Export: `bottle-n.webp` (cwebp -q 86) and `bottle-n.jpg` (fallback), `bottle-m.png`, `bottle-cut.webp`
   (plain cut-out for the no-WebGL page).

`vis-resin.jpg` and `vis-spring.jpg` are 768×1024 crops of `assets/origin-crop.jpg` and `assets/craft-spring.jpg`.
`assets/og-dive.jpg` is the first screen of the Dive without its copy, 1200×630.

A larger bottle render would make the label sharper: replace the source picture and run the three steps again.
