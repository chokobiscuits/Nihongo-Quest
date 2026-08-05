// Prints the level cost curve. Read-only, no DB. Useful when retuning:
//   npx tsx scripts/curve-report.ts
import { xpForLevel, totalXpToReach, levelFromTotalXp } from "../src/services/xp/curve";

const MODEST_DAY = 685; // 5-item lesson batch + 20 reviews @ Apprentice II
const ACTIVE_DAY = 2925; // 10 lessons + 50 reviews @ Apprentice III

console.log("lvl |   cost | cumulative | days@modest | days@active | lvls/modest day");
for (const l of [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000]) {
  const cum = totalXpToReach(l);
  console.log(
    String(l).padStart(4) +
      " | " + String(xpForLevel(l)).padStart(6) +
      " | " + String(cum).padStart(10) +
      " | " + String(Math.ceil(cum / MODEST_DAY)).padStart(11) +
      " | " + String(Math.ceil(cum / ACTIVE_DAY)).padStart(11) +
      " | " + (MODEST_DAY / xpForLevel(l)).toFixed(2).padStart(15),
  );
}

console.log("\nsanity: levelFromTotalXp round-trips");
for (const l of [1, 10, 100, 1000]) {
  const xp = totalXpToReach(l);
  console.log(`  level ${l} at ${xp} xp -> ${levelFromTotalXp(xp)}`);
}
