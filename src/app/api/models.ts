/**
 * Shared domain models used by stores, components and API services.
 */

export type Id = string;

export type BattleResult = "win" | "loss";

export interface Trainer {
  id: number;
  name: string;
  badge_count: number;
  region: string;
  avatar_url: string;
  rank: string;
}

export interface Team {
  id: number;
  trainer_id: number;
  name: string;
  pokemon_ids: number[];
  created_at: string;
}

export interface Battle {
  id: number;
  trainer_id: number;
  opponent_name: string;
  team_id: number;
  result: BattleResult;
  date: string;
  score_trainer: number;
  score_opponent: number;
}

export type BattleLogSeverity = "success" | "info" | "danger" | "warning";

export interface BattleLogEntry {
  id: number;
  battle_id: number;
  timestamp: string;
  message: string;
  severity: BattleLogSeverity;
}

export type PokemonType =
  | "normal"
  | "fire"
  | "water"
  | "electric"
  | "grass"
  | "ice"
  | "fighting"
  | "poison"
  | "ground"
  | "flying"
  | "psychic"
  | "bug"
  | "rock"
  | "ghost"
  | "dragon"
  | "dark"
  | "steel"
  | "fairy"
  | (string & {});

export type PokemonStatName =
  | "hp"
  | "attack"
  | "defense"
  | "special-attack"
  | "special-defense"
  | "speed"
  | (string & {});

export interface PokemonStat {
  name: PokemonStatName;
  base_stat: number;
}

export interface PokemonListItem {
  id: number;
  name: string;
  height: number;
  weight: number;
  types: PokemonType[];
  stats: PokemonStat[];
  spriteUrl: string | null;
}

export interface PokemonAbility {
  name: string;
  isHidden: boolean;
  effect: string;
  shortEffect: string;
}

export interface PokemonMove {
  name: string;
}

export interface PokemonDetails extends PokemonListItem {
  abilities: PokemonAbility[];
  moves: PokemonMove[];
  evolutionChain: { id: number; name: string }[];
  officialArtworkUrl: string | null;
}

