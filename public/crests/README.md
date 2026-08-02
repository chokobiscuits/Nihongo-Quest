# Rank crest images

Drop nine transparent PNGs here, named exactly:

    iron.png  bronze.png  silver.png  gold.png  platinum.png
    diamond.png  master.png  grandmaster.png  challenger.png

`RankCrest` prefers `/crests/{tier}.png` and falls back to its inline SVG
when a file is missing, so adding them requires no code change.

Requirements:
  - transparent background (real alpha, not a dark fill)
  - square, subject centered, minimal padding
  - 512px or larger; the celebration modal renders at 200px on retina

Suggested generation prompt (swap the bracketed parts per tier):

    ornate faceted [TIER] rank emblem, League of Legends ranked badge style,
    [MATERIAL] shield with [WING] flanking wings, centered symmetrical
    composition, dramatic rim lighting, high detail game UI icon, isolated
    on plain black background, no text, no letters

    iron         dark iron, rough pitted metal          small blunt
    bronze       bronze, warm burnished copper          short bronze
    silver       silver, polished steel                 swept silver
    gold         gold, gleaming polished gold           large ornate gold
    platinum     platinum, pale teal crystal            crystalline teal
    diamond      diamond, brilliant blue faceted gem    sharp blue crystal
    master       master, deep purple amethyst           flared purple crystal
    grandmaster  grandmaster, crimson red crystal       jagged red
    challenger   challenger, gold and blue, crowned     massive gold and blue

Say "plain black background" rather than "transparent" -- image models cannot
emit alpha, and a flat field cuts out far more cleanly in remove.bg than a
busy scene.

Do NOT crop these out of Assets/Assets.png. Each crest there sits on its own
rounded dark panel; luminance keying cannot separate near-black artwork from
a near-black background, and the panel edge survives as a visible rectangle.
That was tried and reverted.
