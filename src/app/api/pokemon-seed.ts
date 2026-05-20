import { PokemonListItem, PokemonStatName, PokemonType } from "./models";

type SeedRow = [
  number,
  string,
  number,
  number,
  PokemonType[],
  [number, number, number, number, number, number],
];

const STAT_NAMES: PokemonStatName[] = [
  "hp",
  "attack",
  "defense",
  "special-attack",
  "special-defense",
  "speed",
];

const SEED_ROWS: SeedRow[] = [
  [1, "bulbasaur", 7, 69, ["grass", "poison"], [45, 49, 49, 65, 65, 45]],
  [2, "ivysaur", 10, 130, ["grass", "poison"], [60, 62, 63, 80, 80, 60]],
  [3, "venusaur", 20, 1000, ["grass", "poison"], [80, 82, 83, 100, 100, 80]],
  [4, "charmander", 6, 85, ["fire"], [39, 52, 43, 60, 50, 65]],
  [5, "charmeleon", 11, 190, ["fire"], [58, 64, 58, 80, 65, 80]],
  [6, "charizard", 17, 905, ["fire", "flying"], [78, 84, 78, 109, 85, 100]],
  [7, "squirtle", 5, 90, ["water"], [44, 48, 65, 50, 64, 43]],
  [8, "wartortle", 10, 225, ["water"], [59, 63, 80, 65, 80, 58]],
  [9, "blastoise", 16, 855, ["water"], [79, 83, 100, 85, 105, 78]],
  [10, "caterpie", 3, 29, ["bug"], [45, 30, 35, 20, 20, 45]],
  [11, "metapod", 7, 99, ["bug"], [50, 20, 55, 25, 25, 30]],
  [12, "butterfree", 11, 320, ["bug", "flying"], [60, 45, 50, 90, 80, 70]],
  [13, "weedle", 3, 32, ["bug", "poison"], [40, 35, 30, 20, 20, 50]],
  [14, "kakuna", 6, 100, ["bug", "poison"], [45, 25, 50, 25, 25, 35]],
  [15, "beedrill", 10, 295, ["bug", "poison"], [65, 90, 40, 45, 80, 75]],
  [16, "pidgey", 3, 18, ["normal", "flying"], [40, 45, 40, 35, 35, 56]],
  [17, "pidgeotto", 11, 300, ["normal", "flying"], [63, 60, 55, 50, 50, 71]],
  [18, "pidgeot", 15, 395, ["normal", "flying"], [83, 80, 75, 70, 70, 101]],
  [19, "rattata", 3, 35, ["normal"], [30, 56, 35, 25, 35, 72]],
  [20, "raticate", 7, 185, ["normal"], [55, 81, 60, 50, 70, 97]],
];

/**
 * Local first-paint Pokemon seed data.
 * This makes the Pokedex visible instantly even when the public API or image CDN is slow.
 */
export const POKEMON_SEED: PokemonListItem[] = SEED_ROWS.map(
  ([id, name, height, weight, types, values]) => ({
    id,
    name,
    height,
    weight,
    types,
    stats: STAT_NAMES.map((statName, index) => ({
      name: statName,
      base_stat: values[index]!,
    })),
    spriteUrl: null,
  }),
);

