import { PokemonStat, PokemonStatName } from "./models";

/**
 * Attempts to extract a reasonable sprite URL from the PokéAPI `sprites` JSON blob.
 * The schema returns it as a JSON string in `pokemon_v2_pokemonsprites.sprites`.
 *
 * @param spritesJson - JSON string from PokéAPI GraphQL
 * @returns Sprite URL or null if not found/parseable
 */
export function pickSpriteUrl(spritesJson: string | null | undefined): string | null {
  if (!spritesJson) {
    return null;
  }

  try {
    const sprites = JSON.parse(spritesJson) as any;

    return (
      sprites?.other?.["official-artwork"]?.front_default ??
      sprites?.other?.home?.front_default ??
      sprites?.front_default ??
      null
    );
  } catch {
    return null;
  }
}

/**
 * Computes total base stats for a Pokemon.
 *
 * @param stats - Array of Pokemon base stats
 * @returns Sum of base stats
 */
export function totalBaseStats(stats: PokemonStat[]): number {
  return stats.reduce((sum, s) => sum + s.base_stat, 0);
}

/**
 * Sort helper for the standard stat order used in charts.
 *
 * @param stats - Raw stats from the API
 * @returns New array sorted as: hp, attack, defense, special-attack, special-defense, speed
 */
export function sortStatsForRadar(stats: PokemonStat[]): PokemonStat[] {
  const order: PokemonStatName[] = [
    "hp",
    "attack",
    "defense",
    "special-attack",
    "special-defense",
    "speed",
  ];

  const byName = new Map(stats.map((s) => [s.name, s]));

  return order
    .map((n) => byName.get(n))
    .filter((s): s is PokemonStat => !!s);
}

