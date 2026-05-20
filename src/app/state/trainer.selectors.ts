import { combineLatest, distinctUntilChanged, map, Observable, shareReplay } from "rxjs";
import { Battle, BattleResult, Team } from "../api/models";

export interface WinRate {
  wins: number;
  losses: number;
  total: number;
  winRate: number;
}

/**
 * Computes win/loss totals and win-rate.
 *
 * @param battles$ - Battles stream
 * @returns Observable<WinRate>
 */
export function winRate$(battles$: Observable<Battle[]>): Observable<WinRate> {
  return battles$.pipe(
    map((battles) => {
      const wins = battles.filter((b) => b.result === "win").length;
      const losses = battles.filter((b) => b.result === "loss").length;
      const total = wins + losses;
      return { wins, losses, total, winRate: total ? wins / total : 0 };
    }),
    distinctUntilChanged((a, b) => a.wins === b.wins && a.losses === b.losses),
    shareReplay(1),
  );
}

export interface MonthlyBattleResults {
  labels: string[];
  wins: number[];
  losses: number[];
}

/**
 * Aggregates battles into monthly win/loss counts for charting.
 *
 * @param battles$ - Battles stream
 * @returns Observable<MonthlyBattleResults>
 */
export function battleResultsPerMonth$(
  battles$: Observable<Battle[]>,
): Observable<MonthlyBattleResults> {
  return battles$.pipe(
    map((battles) => {
      const byMonth = new Map<string, { win: number; loss: number }>();
      for (const b of battles) {
        const month = b.date.slice(0, 7); // YYYY-MM
        const row = byMonth.get(month) ?? { win: 0, loss: 0 };
        row[b.result as BattleResult] += 1;
        byMonth.set(month, row);
      }

      const labels = Array.from(byMonth.keys()).sort();
      return {
        labels,
        wins: labels.map((m) => byMonth.get(m)!.win),
        losses: labels.map((m) => byMonth.get(m)!.loss),
      };
    }),
    shareReplay(1),
  );
}

/**
 * Computes simple team stats derived from the teams list.
 *
 * @param teams$ - Teams stream
 * @returns Observable<{ teamCount: number; averageTeamSize: number }>
 */
export function teamStats$(
  teams$: Observable<Team[]>,
): Observable<{ teamCount: number; averageTeamSize: number }> {
  return teams$.pipe(
    map((teams) => {
      const teamCount = teams.length;
      const totalMembers = teams.reduce((sum, t) => sum + (t.pokemon_ids?.length ?? 0), 0);
      const averageTeamSize = teamCount ? totalMembers / teamCount : 0;
      return { teamCount, averageTeamSize };
    }),
    distinctUntilChanged((a, b) => a.teamCount === b.teamCount && a.averageTeamSize === b.averageTeamSize),
    shareReplay(1),
  );
}

