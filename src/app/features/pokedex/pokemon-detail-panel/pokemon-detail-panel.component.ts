import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from "@angular/core";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTabsModule } from "@angular/material/tabs";
import { BaseChartDirective } from "ng2-charts";
import { ChartConfiguration } from "chart.js";
import { provideCharts, withDefaultRegisterables } from "ng2-charts";
import { PokemonStore } from "../../../state/pokemon.store";
import { sortStatsForRadar, totalBaseStats } from "../../../api/pokeapi.util";
import { PokemonDetails } from "../../../api/models";
import { TypeBadgeComponent } from "../../../shared/type-badge/type-badge.component";
import { distinctUntilChanged, map } from "rxjs";

const YOUTUBE_BY_POKEMON_ID: Record<number, string> = {
  1: "https://www.youtube.com/embed/S2y9Qw1lH3Q",
  4: "https://www.youtube.com/embed/ZVTLsQ8iNCM",
  7: "https://www.youtube.com/embed/8aW6zYp8D7A",
  25: "https://www.youtube.com/embed/2sj2iQyBTQs",
};

/**
 * Slide-in Pokemon detail panel: full info, animated radar chart, and video/audio.
 */
@Component({
  selector: "app-pokemon-detail-panel",
  standalone: true,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    BaseChartDirective,
    TypeBadgeComponent,
  ],
  providers: [provideCharts(withDefaultRegisterables())],
  templateUrl: "./pokemon-detail-panel.component.html",
  styleUrl: "./pokemon-detail-panel.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PokemonDetailPanelComponent {
  private readonly store = inject(PokemonStore);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);

  public readonly pokemonId = input<number | null>(null);

  private readonly routePokemonId = toSignal(
    this.route.paramMap.pipe(
      map((pm) => {
        const raw = pm.get("id");
        const id = raw ? Number(raw) : null;
        return Number.isFinite(id) ? id : null;
      }),
      distinctUntilChanged(),
    ),
    { initialValue: null },
  );

  public readonly effectivePokemonId = computed(() => this.pokemonId() ?? this.routePokemonId());

  public readonly activeTab = signal<"overview" | "moves" | "evolution">("overview");
  public readonly videoOpen = signal(false);

  public readonly state = toSignal(this.store.state$, { initialValue: this.store.getSnapshot() });

  public readonly details = computed<PokemonDetails | null>(() => {
    const id = this.effectivePokemonId();
    if (!id) return null;
    return this.state().detailsById[id] ?? null;
  });

  public readonly loading = computed(() => this.state().loadingDetails);

  public readonly total = computed(() => {
    const d = this.details();
    if (!d) return 0;
    return totalBaseStats(d.stats);
  });

  public readonly cryUrl = computed(() => {
    const id = this.effectivePokemonId();
    if (!id) return null;
    return `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${id}.ogg`;
  });

  public readonly safeVideoUrl = computed<SafeResourceUrl | null>(() => {
    const id = this.effectivePokemonId();
    if (!id) return null;
    const base = YOUTUBE_BY_POKEMON_ID[id] ?? "https://www.youtube.com/embed/4xKJ7b9nq8c";
    const url = this.videoOpen() ? `${base}?autoplay=1&mute=0` : base;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  public readonly radarType = "radar" as const;

  public readonly radarData = computed<ChartConfiguration<"radar">["data"]>(() => {
    const d = this.details();
    const stats = d ? sortStatsForRadar(d.stats) : [];
    return {
      labels: stats.map((s) => s.name),
      datasets: [
        {
          data: stats.map((s) => s.base_stat),
          label: "Base Stats",
          fill: true,
          borderColor: "rgba(120, 182, 255, 0.9)",
          backgroundColor: "rgba(120, 182, 255, 0.15)",
          pointBackgroundColor: "rgba(255, 255, 255, 0.8)",
          pointBorderColor: "rgba(120, 182, 255, 0.9)",
        },
      ],
    };
  });

  public readonly radarOptions = computed<ChartConfiguration<"radar">["options"]>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 500 },
    scales: {
      r: {
        suggestedMin: 0,
        suggestedMax: 200,
        grid: { color: "rgba(255,255,255,0.08)" },
        angleLines: { color: "rgba(255,255,255,0.08)" },
        pointLabels: { color: "rgba(255,255,255,0.75)" },
        ticks: { display: false },
      },
    },
    plugins: { legend: { display: false } },
  }));

  /**
   * Loads details when the selected Pokemon id changes.
   */
  public readonly loadEffect = effect(() => {
    const id = this.effectivePokemonId();
    if (!id) return;
    this.store.loadPokemonDetails(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    // Simple analytics log (per assessment requirement).
    // In a real app this would go to an analytics service.
    console.info("[analytics] pokemon_view", { id });
  });

  /**
   * Toggles whether the embedded video should autoplay.
   */
  public toggleVideo(): void {
    this.videoOpen.update((v) => !v);
  }
}
