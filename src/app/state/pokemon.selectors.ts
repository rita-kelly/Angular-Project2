import {
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
} from "rxjs";
import { PokemonListItem, PokemonType } from "../api/models";
import { TypeEfficacyRow } from "../api/pokemon-api.service";

/**
 * Creates a debounced Pokemon search stream from a raw search-term observable.
 *
 * The assessment explicitly requires:
 * debounceTime(300) → distinctUntilChanged() → switchMap(...)
 *
 * @param searchTerm$ - Raw search term stream (e.g. FormControl.valueChanges)
 * @param pokemonList$ - Cached Pokemon list stream
 * @returns Observable<PokemonListItem[]> - Stream of matching Pokemon
 */
export function pokemonSearchResults$(
  searchTerm$: Observable<string>,
  pokemonList$: Observable<PokemonListItem[]>,
): Observable<PokemonListItem[]> {
  return combineLatest([
    searchTerm$.pipe(debounceTime(300), distinctUntilChanged()),
    pokemonList$,
  ]).pipe(
    switchMap(([term, list]) => {
      const q = (term ?? "").trim().toLowerCase();
      if (!q) {
        return of(list);
      }
      return of(list.filter((p) => p.name.toLowerCase().includes(q)));
    }),
    distinctUntilChanged((a, b) => JSON.stringify(a.map((x) => x.id)) === JSON.stringify(b.map((x) => x.id))),
  );
}

/**
 * Filters a Pokemon list by a selected type.
 *
 * @param pokemonList$ - Pokemon list stream
 * @param type$ - Selected type stream (null for no filter)
 * @returns Observable<PokemonListItem[]> - Filtered list stream
 */
export function pokemonFilterByType$(
  pokemonList$: Observable<PokemonListItem[]>,
  type$: Observable<PokemonType | null>,
): Observable<PokemonListItem[]> {
  return combineLatest([pokemonList$, type$]).pipe(
    map(([list, type]) => {
      if (!type) return list;
      const t = String(type).toLowerCase();
      return list.filter((p) => p.types.some((x) => String(x).toLowerCase() === t));
    }),
    distinctUntilChanged((a, b) => a.length === b.length && a.every((x, i) => x.id === b[i]?.id)),
  );
}

/**
 * Builds a lookup map of type efficacy multipliers, keyed by source->target.
 * Use `shareReplay(1)` because it can be used by multiple computed streams.
 *
 * @param rows$ - Type efficacy rows stream
 * @returns Observable<Record<string, Record<string, number>>> - Lookup map
 */
export function typeEffectivenessMap$(
  rows$: Observable<TypeEfficacyRow[] | null>,
): Observable<Record<string, Record<string, number>>> {
  return rows$.pipe(
    map((rows) => rows ?? []),
    map((rows) => {
      const mapBySource: Record<string, Record<string, number>> = {};
      for (const row of rows) {
        const src = String(row.sourceType).toLowerCase();
        const tgt = String(row.targetType).toLowerCase();
        mapBySource[src] = mapBySource[src] ?? {};
        mapBySource[src][tgt] = row.damageFactor / 100;
      }
      return mapBySource;
    }),
    shareReplay(1),
  );
}

