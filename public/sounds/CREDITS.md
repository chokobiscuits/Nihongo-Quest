# Sound credits

Every file in this directory is derived from a **Kenney** asset pack, all of
which are released under **CC0 1.0 Universal** (public domain dedication). No
attribution is legally required; this record exists so provenance does not
have to be re-derived later.

- Source: <https://kenney.nl/assets> — Interface Sounds, UI Audio, Music Jingles
- Licence: CC0 1.0 — <https://creativecommons.org/publicdomain/zero/1.0/>

## Mapping

| Shipped file | Kenney source | Pack |
| --- | --- | --- |
| `ui-click.webm` | `click_002.ogg` | Interface Sounds |
| `ui-hover.webm` | `rollover3.ogg` | UI Audio |
| `answer-correct.webm` | `confirmation_001.ogg` | Interface Sounds |
| `answer-wrong.webm` | `error_004.ogg` | Interface Sounds |
| `review-pass.webm` | `glass_002.ogg` | Interface Sounds |
| `review-fail.webm` | `error_008.ogg` | Interface Sounds |
| `session-complete.webm` | `jingles_STEEL09.ogg` | Music Jingles |
| `celebrate-levelup.webm` | `jingles_STEEL01.ogg` | Music Jingles |
| `celebrate-promotion.webm` | `jingles_SAX03.ogg` | Music Jingles |
| `celebrate-newrank.webm` | `jingles_NES13.ogg` | Music Jingles |
| `celebrate-demotion.webm` | `jingles_PIZZI09.ogg` | Music Jingles |
| `celebrate-achievement.webm` | `jingles_HIT09.ogg` | Music Jingles |
| `streak-extend.webm` | `jingles_STEEL10.ogg` | Music Jingles |

## Processing

Each source was converted to mono 48 kHz WebM/Opus at 64 kbps, with a
per-file `volume` adjustment applied first to bring its **mean** level onto a
common target — roughly -20 dB for UI blips, -19 dB for answer feedback, and
-13 to -16 dB for jingles and stingers.

This normalisation step matters: the raw Kenney packs are internally
consistent but differ sharply *between* packs. The SAX jingles peak around
-10 dBFS while the interface clicks peak near -1 dBFS, so shipping them
untouched would have made the promotion stinger sound broken next to a
button click.

```
ffmpeg -i <source>.ogg -ac 1 -ar 48000 -af "volume=<adj>dB" \
       -c:a libopus -b:a 64k <target>.webm
```

All 13 files decode below 0 dBFS true peak, with a flat factor of 0 (no
clipped or flat-topped samples). Remaining per-sound balance is handled by
the `gain` field in `src/lib/sound/manifest.ts` rather than by re-encoding.

Total size: ~82 KB.
