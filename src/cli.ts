// CLI : scanne les sessions et imprime un résumé arcade dans le terminal.
import { runScan } from "./scan.ts";
import type { AchievementResult, ScanResult } from "./types.ts";

const C = {
  reset: "\x1b[0m", dim: "\x1b[2m", bold: "\x1b[1m",
  gold: "\x1b[38;5;220m", cyan: "\x1b[38;5;51m", gray: "\x1b[38;5;245m",
  green: "\x1b[38;5;120m", mag: "\x1b[38;5;213m",
};

function bar(progress: number, width = 16): string {
  const filled = Math.round(progress * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function printHeader(r: ScanResult): void {
  const s = r.score;
  console.log(`\n${C.gold}${C.bold}  CLAUDE ARCADE${C.reset}  ${C.dim}— ${r.sessionCount} sessions scannées${C.reset}`);
  const sep = `   ${C.gray}|${C.reset}  `;
  const rank = `${C.cyan}Rang : ${C.bold}${s.rank}${C.reset}`;
  const pts = `Score : ${C.bold}${s.totalPoints}${C.reset} pts`;
  const unl = `Débloqués : ${C.bold}${s.unlockedCount}/${s.totalCount}${C.reset}`;
  console.log(`  ${rank}${sep}${pts}${sep}${unl}\n`);
}

function printCategories(r: ScanResult): void {
  console.log(`${C.bold}  Par catégorie${C.reset}`);
  for (const [cat, v] of Object.entries(r.score.byCategory)) {
    console.log(`  ${C.gray}•${C.reset} ${cat.padEnd(18)} ${C.green}${v.unlocked}/${v.total}${C.reset}  ${C.dim}${v.points} pts${C.reset}`);
  }
  console.log();
}

function printUnlocked(results: AchievementResult[]): void {
  const unlocked = results.filter((a) => a.state === "unlocked").sort((a, b) => b.tierIndex - a.tierIndex);
  console.log(`${C.bold}  Achievements débloqués${C.reset}`);
  for (const a of unlocked) {
    const next = a.nextThreshold ? `${C.dim}→ ${a.value}/${a.nextThreshold}${C.reset}` : `${C.gold}MAX${C.reset}`;
    console.log(`  ${C.gold}★${C.reset} ${C.bold}${a.name.padEnd(28)}${C.reset} ${C.mag}${a.tierName}${C.reset}  ${next}`);
  }
  console.log();
}

function printClosest(results: AchievementResult[]): void {
  const discovered = results.filter((a) => a.state === "discovered" && a.nextThreshold)
    .sort((a, b) => b.progress - a.progress).slice(0, 6);
  if (!discovered.length) return;
  console.log(`${C.bold}  Les plus proches${C.reset}`);
  for (const a of discovered) {
    console.log(`  ${C.cyan}${bar(a.progress)}${C.reset} ${a.name.padEnd(26)} ${C.dim}${a.value}/${a.nextThreshold}${C.reset}`);
  }
  console.log();
}

const result = await runScan();
printHeader(result);
printCategories(result);
printUnlocked(result.achievements);
printClosest(result.achievements);
