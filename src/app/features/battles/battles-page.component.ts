import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { ChartConfiguration, ChartData } from "chart.js";
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from "ng2-charts";
import { Battle, BattleLogEntry, Team } from "../../api/models";
import { TrainerStore } from "../../state/trainer.store";

/**
 * Battle analytics route with animated chart and simulated live battle feed.
 * Display-only implementation with battle selection feature.
 */
@Component({
  selector: "app-battles-page",
  standalone: true,
  imports: [BaseChartDirective, DatePipe],
  providers: [provideCharts(withDefaultRegisterables())],
  templateUrl: "./battles-page.component.html",
  styleUrl: "./battles-page.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BattlesPageComponent {
  private readonly trainerStore = inject(TrainerStore);
  private readonly destroyRef = inject(DestroyRef);

  public readonly state = toSignal(this.trainerStore.state$, {
    initialValue: this.trainerStore.getSnapshot(),
  });

  // Selected battle for detailed view
  public readonly selectedBattle = signal<Battle | null>(null);

  public readonly wins = computed(() => this.state().battles.filter((battle) => battle.result === "win").length);
  public readonly losses = computed(() => this.state().battles.filter((battle) => battle.result === "loss").length);
  public readonly winRate = computed(() => {
    const total = this.wins() + this.losses();
    return total ? Math.round((this.wins() / total) * 100) : 0;
  });
  // Win count - shows actual win score when battle is selected
  public readonly displayWins = computed(() => {
    const selected = this.selectedBattle();
    const calculatedScores = this.calculatedScores();
    
    // If a battle is selected, show the win score from the battle
    if (selected && calculatedScores) {
      return calculatedScores.trainer;
    }
    
    // Otherwise show overall win count
    return this.wins();
  });
  
  // Loss count - shows actual loss score when battle is selected
  public readonly displayLosses = computed(() => {
    const selected = this.selectedBattle();
    const calculatedScores = this.calculatedScores();
    
    // If a battle is selected, show the loss score from the battle
    if (selected && calculatedScores) {
      return calculatedScores.opponent;
    }
    
    // Otherwise show overall loss count
    return this.losses();
  });
  
  // Win percentage - calculated from selected battle score or overall
  public readonly winPercentage = computed(() => {
    const selected = this.selectedBattle();
    const calculatedScores = this.calculatedScores();
    
    // If a battle is selected, calculate percentage from score
    if (selected && calculatedScores) {
      const winScore = calculatedScores.trainer;
      const lossScore = calculatedScores.opponent;
      const totalScore = winScore + lossScore;
      return Math.round((winScore / totalScore) * 100);
    }
    
    // Otherwise show overall percentage
    const total = this.wins() + this.losses();
    return total ? Math.round((this.wins() / total) * 100) : 50;
  });
  
  // Loss percentage - calculated from selected battle score or overall
  public readonly lossPercentage = computed(() => {
    const selected = this.selectedBattle();
    const calculatedScores = this.calculatedScores();
    
    // If a battle is selected, calculate percentage from score
    if (selected && calculatedScores) {
      const winScore = calculatedScores.trainer;
      const lossScore = calculatedScores.opponent;
      const totalScore = winScore + lossScore;
      return Math.round((lossScore / totalScore) * 100);
    }
    
    // Otherwise show overall percentage
    const total = this.wins() + this.losses();
    return total ? Math.round((this.losses() / total) * 100) : 50;
  });
  
  public readonly selectedWinRate = computed(() => {
    return this.winRate();
  });

  // Calculate win percentage from selected battle score
  public readonly scoreWinPercentage = computed(() => {
    const selected = this.selectedBattle();
    const calculatedScores = this.calculatedScores();
    
    if (!selected || !calculatedScores) {
      return null;
    }
    
    const winScore = calculatedScores.trainer;
    const lossScore = calculatedScores.opponent;
    const totalScore = winScore + lossScore;
    
    if (selected.result === "win") {
      return Math.round((winScore / totalScore) * 100);
    } else {
      return Math.round((lossScore / totalScore) * 100);
    }
  });

  // Get scores from selected battle
  public readonly calculatedScores = computed(() => {
    const selected = this.selectedBattle();
    
    if (!selected) {
      return null;
    }
    
    // Use actual scores from the battle data
    return { trainer: selected.score_trainer, opponent: selected.score_opponent };
  });
  public readonly latestFeed = computed(() => [...this.state().liveBattleFeed].reverse().slice(0, 10));
  // Pie chart data for win/loss distribution
  public readonly pieChartData = computed<ChartData<"pie", number[], string>>(() => {
    const selected = this.selectedBattle();
    const calculatedScores = this.calculatedScores();
    
    // If a battle is selected AND we have calculated scores, show score-based percentages
    if (selected && calculatedScores) {
      const winScore = calculatedScores.trainer;
      const lossScore = calculatedScores.opponent;
      const totalScore = winScore + lossScore;
      
      // Calculate percentages from the score
      const winPercentage = Math.round((winScore / totalScore) * 100);
      const lossPercentage = 100 - winPercentage; // Ensure sum is 100%
      
      const winLabel = selected.result === "win" ? `Win: ${winScore}-${lossScore}` : `Win`;
      const lossLabel = selected.result === "loss" ? `Loss: ${lossScore}-${winScore}` : `Loss`;
      
      return {
        labels: [winLabel, lossLabel],
        datasets: [{
          data: [winPercentage, lossPercentage],
          backgroundColor: [
            "rgba(34, 197, 94, 0.72)",
            "rgba(248, 113, 113, 0.72)"
          ],
          borderColor: [
            "rgba(134, 239, 172, 0.9)",
            "rgba(254, 202, 202, 0.9)"
          ],
          borderWidth: 1,
        }]
      };
    }
    
    // Otherwise show overall win/loss percentages
    const wins = this.wins();
    const losses = this.losses();
    const total = wins + losses;
    
    // Calculate percentages
    let winPercentage, lossPercentage;
    
    if (total === 0) {
      // Default 50/50 split if no battles
      winPercentage = 50;
      lossPercentage = 50;
    } else {
      // Calculate actual percentages
      winPercentage = Math.round((wins / total) * 100);
      lossPercentage = Math.round((losses / total) * 100);
      
      // Ensure they sum to 100% (rounding might cause 99% or 101%)
      if (winPercentage + lossPercentage !== 100) {
        lossPercentage = 100 - winPercentage;
      }
    }
    
    return {
      labels: ["Wins", "Losses"],
      datasets: [{
        data: [winPercentage, lossPercentage],
        backgroundColor: [
          "rgba(34, 197, 94, 0.72)",
          "rgba(248, 113, 113, 0.72)"
        ],
        borderColor: [
          "rgba(134, 239, 172, 0.9)",
          "rgba(254, 202, 202, 0.9)"
        ],
        borderWidth: 1,
      }]
    };
  });

  public readonly pieChartOptions: ChartConfiguration<"pie">["options"] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%', // Donut chart style
    plugins: {
      legend: {
        display: false, // Hide legend since we have center label
      },
      tooltip: {
        backgroundColor: 'rgba(12, 20, 36, 0.95)',
        titleColor: '#e7eefc',
        bodyColor: '#e7eefc',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const percentage = context.raw as number;
            
            // Show percentage in tooltip
            return `${label}: ${percentage}%`;
          }
        }
      }
    },
    animation: {
      animateScale: true,
      animateRotate: true,
      duration: 800,
      easing: 'easeOutQuart'
    },
  };

  // Bar chart for monthly results (kept from original)
  public readonly barChartData = computed<ChartData<"bar", number[], string>>(() => {
    const buckets = new Map<string, { wins: number; losses: number }>();

    for (const battle of this.state().battles) {
      const label = this.monthLabel(battle.date);
      const bucket = buckets.get(label) ?? { wins: 0, losses: 0 };
      if (battle.result === "win") {
        bucket.wins += 1;
      } else {
        bucket.losses += 1;
      }
      buckets.set(label, bucket);
    }

    const labels = Array.from(buckets.keys()).reverse();
    const values = labels.map((label) => buckets.get(label)!);

    return {
      labels: labels.length ? labels : ["No battles"],
      datasets: [
        {
          label: "Wins",
          data: values.length ? values.map((v) => v.wins) : [0],
          backgroundColor: "rgba(34, 197, 94, 0.72)",
          borderColor: "rgba(134, 239, 172, 0.9)",
          borderWidth: 1,
          borderRadius: 6,
        },
        {
          label: "Losses",
          data: values.length ? values.map((v) => v.losses) : [0],
          backgroundColor: "rgba(248, 113, 113, 0.72)",
          borderColor: "rgba(254, 202, 202, 0.9)",
          borderWidth: 1,
          borderRadius: 6,
        },
      ],
    };
  });

  public readonly barChartOptions: ChartConfiguration<"bar">["options"] = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 650, easing: "easeOutQuart" },
    plugins: {
      legend: {
        labels: { color: "#e7eefc", boxWidth: 12, boxHeight: 12 },
      },
    },
    scales: {
      x: {
        ticks: { color: "rgba(231, 238, 252, 0.72)" },
        grid: { color: "rgba(255, 255, 255, 0.06)" },
      },
      y: {
        beginAtZero: true,
        ticks: { color: "rgba(231, 238, 252, 0.72)", precision: 0 },
        grid: { color: "rgba(255, 255, 255, 0.06)" },
      },
    },
  };

  /**
   * Loads battle data and starts the simulated real-time battle-log feed.
   */
  public constructor() {
    const trainerId = this.state().currentTrainerId ?? 1;
    this.trainerStore.loadTrainerDashboard(trainerId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    this.trainerStore.connectLiveBattleLogFeed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  /**
   * Selects a battle to show detailed view.
   *
   * @param battle - Battle to select
   */
  public selectBattle(battle: Battle): void {
    this.selectedBattle.set(battle);
  }

  /**
   * Clears the selected battle.
   */
  public clearSelection(): void {
    this.selectedBattle.set(null);
  }

  /**
   * Checks if a battle is currently selected.
   *
   * @param battle - Battle to check
   * @returns True if the battle is selected
   */
  public isSelected(battle: Battle): boolean {
    return this.selectedBattle()?.id === battle.id;
  }

  /**
   * Looks up a team name for a battle row.
   *
   * @param teamId - Team id
   * @returns Team name or fallback label
   */
  public teamName(teamId: number): string {
    return this.state().teams.find((team) => team.id === teamId)?.name ?? `Team #${teamId}`;
  }

  /**
   * Returns a readable severity class for battle-log entries.
   *
   * @param entry - Battle log entry
   * @returns CSS class suffix
   */
  public severityClass(entry: BattleLogEntry): string {
    return `severity-${entry.severity}`;
  }

  /**
   * Returns a track id for battle rows.
   *
   * @param battle - Battle row
   * @returns Battle id
   */
  public battleId(battle: Battle): number {
    return battle.id;
  }

  /**
   * Returns a track id for teams.
   *
   * @param team - Team row
   * @returns Team id
   */
  public teamId(team: Team): number {
    return team.id;
  }

  /**
   * Formats a battle date into a month bucket.
   *
   * @param date - ISO date string
   * @returns Month label
   */
  private monthLabel(date: string): string {
    const parsed = new Date(`${date}T00:00:00`);
    return parsed.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }
}
