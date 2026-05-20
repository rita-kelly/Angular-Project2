import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ChartConfiguration, ChartData } from "chart.js";
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from "ng2-charts";
import { Battle, BattleLogEntry, BattleResult, Team } from "../../api/models";
import { TrainerStore } from "../../state/trainer.store";

/**
 * Battle analytics route with mutation form, animated chart, and simulated live battle feed.
 */
@Component({
  selector: "app-battles-page",
  standalone: true,
  imports: [ReactiveFormsModule, BaseChartDirective, DatePipe],
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
  public readonly statusMessage = signal<string | null>(null);

  public readonly form = new FormGroup({
    opponentName: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(40)],
    }),
    teamId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    result: new FormControl<BattleResult>("win", { nonNullable: true }),
    date: new FormControl(this.today(), { nonNullable: true, validators: [Validators.required] }),
    scoreTrainer: new FormControl(3, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(6)],
    }),
    scoreOpponent: new FormControl(1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(6)],
    }),
  });

  public readonly wins = computed(() => this.state().battles.filter((battle) => battle.result === "win").length);
  public readonly losses = computed(() => this.state().battles.filter((battle) => battle.result === "loss").length);
  public readonly winRate = computed(() => {
    const total = this.wins() + this.losses();
    return total ? Math.round((this.wins() / total) * 100) : 0;
  });
  public readonly latestFeed = computed(() => [...this.state().liveBattleFeed].reverse().slice(0, 10));
  public readonly chartData = computed<ChartData<"bar", number[], string>>(() => {
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

  public readonly chartOptions: ChartConfiguration<"bar">["options"] = {
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

    effect(() => {
      const firstTeam = this.state().teams[0]?.id ?? null;
      if (!this.form.controls.teamId.value && firstTeam) {
        this.form.controls.teamId.setValue(firstTeam, { emitEvent: false });
      }
    });
  }

  /**
   * Logs a new battle result through the local GraphQL mutation.
   */
  public logBattle(): void {
    this.statusMessage.set(null);

    if (this.form.invalid || !this.form.controls.teamId.value) {
      this.form.markAllAsTouched();
      this.statusMessage.set("Complete the battle form before saving.");
      return;
    }

    const trainerId = this.state().currentTrainerId ?? 1;
    const value = this.form.getRawValue();

    this.trainerStore
      .logBattle({
        trainer_id: trainerId,
        opponent_name: value.opponentName.trim(),
        team_id: Number(value.teamId),
        result: value.result,
        date: value.date,
        score_trainer: Number(value.scoreTrainer),
        score_opponent: Number(value.scoreOpponent),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((battle) => {
        if (battle) {
          this.statusMessage.set(`Logged ${battle.result} vs ${battle.opponent_name}.`);
          this.form.patchValue({ opponentName: "", date: this.today() });
          this.form.controls.opponentName.markAsPristine();
          this.form.controls.opponentName.markAsUntouched();
        }
      });
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

  /**
   * Returns today's date in HTML date-input format.
   *
   * @returns YYYY-MM-DD string
   */
  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
