import { Injectable, effect, signal } from "@angular/core";

const STORAGE_KEY = "pokedex_team_draft_ids";

/**
 * Small shared state container for "draft team" Pokemon ids.
 * Used to support bulk "Add to Team" actions from the Pokédex.
 */
@Injectable({ providedIn: "root" })
export class TeamDraftService {
  public readonly pokemonIds = signal<number[]>(this.readFromStorage());

  /**
   * Adds ids to the draft (deduped, max 6).
   *
   * @param ids - Pokemon ids
   */
  public add(ids: number[]): void {
    this.set([...this.pokemonIds(), ...ids]);
  }

  /**
   * Replaces the draft with a normalized set of ids.
   *
   * @param ids - Pokemon ids
   */
  public set(ids: number[]): void {
    const next = Array.from(new Set(ids)).slice(0, 6);
    this.pokemonIds.set(next);
  }

  /**
   * Removes an id from the draft.
   *
   * @param id - Pokemon id
   */
  public remove(id: number): void {
    this.pokemonIds.set(this.pokemonIds().filter((x) => x !== id));
  }

  /**
   * Clears the draft.
   */
  public clear(): void {
    this.pokemonIds.set([]);
  }

  /**
   * Persists the draft to localStorage.
   */
  public readonly persistEffect = effect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.pokemonIds()));
  });

  /**
   * Reads initial draft state from localStorage.
   *
   * @returns Pokemon id array
   */
  private readFromStorage(): number[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      return Array.isArray(parsed) ? parsed.filter((n) => Number.isFinite(n)).map((n) => Number(n)) : [];
    } catch {
      return [];
    }
  }
}
