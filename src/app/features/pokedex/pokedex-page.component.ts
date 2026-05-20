import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { BehaviorSubject, filter, startWith } from "rxjs";
import { PokemonStore } from "../../state/pokemon.store";
import { pokemonSearchResults$ } from "../../state/pokemon.selectors";
import { totalBaseStats } from "../../api/pokeapi.util";
import { PokemonListItem, PokemonType } from "../../api/models";
import { TypeBadgeComponent } from "../../shared/type-badge/type-badge.component";
import { TeamDraftService } from "../../shared/team-draft.service";
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from "@angular/router";
import { TypeHighlightDirective } from "../../shared/type-highlight.directive";

type SortKey =
  | "id"
  | "name"
  | "hp"
  | "attack"
  | "defense"
  | "special-attack"
  | "special-defense"
  | "speed"
  | "total";

/**
 * Pokédex route shell.
 * Full table/grid, filtering, selection, and detail panel are implemented in later passes.
 */
@Component({
  selector: "app-pokedex-page",
  standalone: true,
  imports: [ReactiveFormsModule, TypeBadgeComponent, TypeHighlightDirective, RouterOutlet],
  templateUrl: "./pokedex-page.component.html",
  styleUrl: "./pokedex-page.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PokedexPageComponent {
  private readonly store = inject(PokemonStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly teamDraft = inject(TeamDraftService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  public readonly searchControl = new FormControl<string>("", { nonNullable: true });

  private readonly limit = 20;
  private readonly offsetSubject = new BehaviorSubject<number>(20);

  public readonly state = toSignal(this.store.state$, { initialValue: this.store.getSnapshot() });
  public readonly pokemonList$ = this.store.selectPokemonList();

  public readonly searchResults$ = pokemonSearchResults$(
    this.searchControl.valueChanges.pipe(startWith(this.searchControl.value)),
    this.pokemonList$,
  );

  public readonly visiblePokemon = toSignal(this.searchResults$, { initialValue: [] });

  public readonly loading = computed(() => this.state().loadingList || this.state().loadingTypes);
  public readonly error = computed(() => this.state().error);

  public readonly mode = signal<"paged" | "virtual">("paged");
  public readonly pageSize = signal<10 | 25 | 50>(25);
  public readonly pageIndex = signal(0);

  public readonly selectedType = signal<PokemonType | null>(null);
  public readonly highlightType = signal<PokemonType | null>("fire");
  public readonly minTotal = signal(0);
  public readonly maxTotal = signal(800);

  public readonly sortKey = signal<SortKey>("id");
  public readonly sortDir = signal<"asc" | "desc">("asc");

  public readonly selectedPokemonId = signal<number | null>(null);

  /**
   * Syncs the selected Pokemon id from the current child route (/:id).
   */
  public readonly routeSyncEffect = effect(() => {
    // Subscribe once by leveraging the fact this effect is created during construction.
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        startWith(null),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        const raw = this.route.firstChild?.snapshot.paramMap.get("id") ?? null;
        const id = raw ? Number(raw) : null;
        this.selectedPokemonId.set(Number.isFinite(id) ? id : null);
      });
  });
  public readonly selectedIds = signal<number[]>([]);

  /**
   * Updates the selected type from a native select value.
   *
   * @param value - Native select value
   */
  public setTypeFromValue(value: string): void {
    this.selectedType.set(value ? (value as PokemonType) : null);
    this.pageIndex.set(0);
  }

  /**
   * Updates the attacking type used by row matchup highlighting.
   *
   * @param value - Native select value
   */
  public setHighlightTypeFromValue(value: string): void {
    this.highlightType.set(value ? (value as PokemonType) : null);
  }

  /**
   * Updates page size from a native select value.
   *
   * @param value - Native select value
   */
  public setPageSize(value: string): void {
    const size = Number(value);
    if (size === 10 || size === 25 || size === 50) {
      this.pageSize.set(size);
      this.pageIndex.set(0);
    }
  }

  /**
   * Updates the minimum total-stat filter.
   *
   * @param target - Input event target
   */
  public setMinTotal(target: EventTarget | null): void {
    this.minTotal.set(this.numberFromTarget(target, 0));
    this.pageIndex.set(0);
  }

  /**
   * Updates the maximum total-stat filter.
   *
   * @param target - Input event target
   */
  public setMaxTotal(target: EventTarget | null): void {
    this.maxTotal.set(this.numberFromTarget(target, 800));
    this.pageIndex.set(0);
  }

  /**
   * Reads a number from a native input target.
   *
   * @param target - Input event target
   * @param fallback - Fallback value
   * @returns Parsed number or fallback
   */
  private numberFromTarget(target: EventTarget | null, fallback: number): number {
    const input = target as HTMLInputElement | null;
    const value = input?.valueAsNumber;
    return Number.isFinite(value) ? value! : fallback;
  }

  public readonly availableTypes = computed(() => {
    const list = this.state().pokemonIds.map((id) => this.state().pokemonById[id]).filter(Boolean) as PokemonListItem[];
    const set = new Set<string>();
    for (const p of list) {
      for (const t of p.types) set.add(String(t));
    }
    return Array.from(set).sort();
  });

  public readonly filteredSorted = computed(() => {
    const list = this.visiblePokemon();
    const type = this.selectedType();
    const minT = this.minTotal();
    const maxT = this.maxTotal();
    const key = this.sortKey();
    const dir = this.sortDir();

    const filtered = list.filter((p) => {
      const total = totalBaseStats(p.stats);
      const typeOk = !type || p.types.some((t) => String(t).toLowerCase() === String(type).toLowerCase());
      return typeOk && total >= minT && total <= maxT;
    });

    const stat = (p: PokemonListItem, statName: string) =>
      p.stats.find((s) => s.name === statName)?.base_stat ?? 0;

    const sorted = [...filtered].sort((a, b) => {
      const mul = dir === "asc" ? 1 : -1;
      if (key === "id") return (a.id - b.id) * mul;
      if (key === "name") return a.name.localeCompare(b.name) * mul;
      if (key === "total") return (totalBaseStats(a.stats) - totalBaseStats(b.stats)) * mul;
      return (stat(a, key) - stat(b, key)) * mul;
    });

    return sorted;
  });

  public readonly pagedRows = computed(() => {
    const list = this.filteredSorted();
    const size = this.pageSize();
    const idx = this.pageIndex();
    return list.slice(idx * size, idx * size + size);
  });

  /**
   * Moves to the previous page (paged mode only).
   */
  public prevPage(): void {
    this.pageIndex.update((i) => Math.max(0, i - 1));
  }

  /**
   * Moves to the next page (paged mode only).
   */
  public nextPage(): void {
    this.pageIndex.update((i) => i + 1);
  }

  /**
   * Reads a single stat value by name.
   *
   * @param p - Pokemon row
   * @param statName - Stat name
   * @returns Base stat value (0 when missing)
   */
  public stat(p: PokemonListItem, statName: string): number {
    return p.stats.find((s) => s.name === statName)?.base_stat ?? 0;
  }

  /**
   * Loads initial data for the page.
   */
  public readonly initEffect = effect(() => {
    if (this.state().pokemonIds.length) return;
    this.loadMore();
  });

  /**
   * Loads the next page of Pokemon into the cache.
   */
  public loadMore(): void {
    const offset = this.offsetSubject.getValue();
    this.store.loadPokemonPage(this.limit, offset).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    this.offsetSubject.next(offset + this.limit);
  }

  /**
   * Updates sorting state.
   *
   * @param key - Sort key
   */
  public setSort(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.update((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    this.sortKey.set(key);
    this.sortDir.set("asc");
  }

  /**
   * TrackBy function for Pokemon rows.
   *
   * @param _index - Row index
   * @param p - Pokemon
   * @returns Pokemon id
   */
  public trackById(_index: number, p: PokemonListItem): number {
    return p.id;
  }

  /**
   * Toggles selection of a Pokemon row.
   *
   * @param id - Pokemon id
   * @param checked - Selection state
   */
  public toggleSelected(id: number, checked: boolean): void {
    const current = new Set(this.selectedIds());
    if (checked) current.add(id);
    else current.delete(id);
    this.selectedIds.set(Array.from(current));
  }

  /**
   * Clears row selection.
   */
  public clearSelection(): void {
    this.selectedIds.set([]);
  }

  /**
   * Adds selected Pokemon ids into the Team Draft (max 6).
   */
  public addSelectedToTeam(): void {
    this.teamDraft.add(this.selectedIds());
    this.clearSelection();
  }

  /**
   * Opens the slide-in detail panel for a Pokemon.
   *
   * @param id - Pokemon id
   */
  public openDetails(id: number): void {
    this.router.navigate([id], { relativeTo: this.route });
  }

  /**
   * Closes the slide-in detail panel.
   */
  public closeDetails(): void {
    this.router.navigate(["/pokedex"]);
  }

  /**
   * Computes total base stats for a Pokemon row.
   *
   * @param stats - Pokemon stats array
   * @returns Total base stats
   */
  public total(stats: { base_stat: number }[]): number {
    return totalBaseStats(stats as any);
  }
}
