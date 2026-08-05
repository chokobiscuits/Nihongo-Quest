# Sound assets

The 13 files here back the sound ids in `src/lib/sound/manifest.ts`. They are
Kenney CC0 assets, converted and level-matched — see `CREDITS.md` for the
source of each file and the exact processing applied.

A missing file is not an error: `SoundManager` warns once in the console for
that id and stays silent, so removing one degrades rather than breaks.

## What plays when

| File | Plays when | Character |
| --- | --- | --- |
| `ui-click.webm` | nav / button press | short interface tick |
| `ui-hover.webm` | nav item hover | very soft, throttled to 60 ms |
| `answer-correct.webm` | correct answer | bright confirmation; pitch climbs a semitone per streak hit, capped at +5 |
| `answer-wrong.webm` | wrong answer | soft, low, quieter than the correct sound |
| `review-pass.webm` | review session where an item moved up an SRS stage | light glass chime |
| `review-fail.webm` | review session where an item lost a stage (wins over a pass) | muted error tone |
| `session-complete.webm` | session with no stinger and no SRS movement | short resolving jingle |
| `celebrate-levelup.webm` | level up | warm steel-drum flourish |
| `celebrate-promotion.webm` | rank promotion | brassy sax lift |
| `celebrate-newrank.webm` | new rank tier | chiptune fanfare, the biggest moment in the app |
| `celebrate-demotion.webm` | rank demotion | brief pizzicato fall, dignified rather than comic |
| `celebrate-achievement.webm` | achievement unlocked | short stab |
| `streak-extend.webm` | day streak extended | warm bell |

Exactly one sound closes a session: a celebration stinger if one is queued,
otherwise a review pass/fail if any item changed SRS stage, otherwise
`session-complete`. They never stack.

An "almost" or wrong-type answer is deliberately silent — that branch
re-prompts without advancing, so it is not a failure.

`ui.click` and `ui.hover` have assets and ids but are not yet wired to the
nav — only the settings Test button plays `ui.click` today.

## Replacing a sound

Drop in a file with the same name and it goes live; no code change is needed.
Match the existing format and level so the kit stays coherent:

```
ffmpeg -i input.wav -ac 1 -ar 48000 -af "volume=<adj>dB" \
       -c:a libopus -b:a 64k <name>.webm
```

Check the result with `ffmpeg -i <file> -af volumedetect -f null -` and aim
for a mean around -20 dB for UI blips and -13 to -16 dB for stingers, keeping
the true peak below 0 dBFS. For small balance tweaks, prefer adjusting that
sound's `gain` in `src/lib/sound/manifest.ts` over re-encoding.

Keep the whole kit well under ~400 KB; it is currently ~82 KB.
