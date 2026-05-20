import { Injectable, inject } from "@angular/core";
import { Apollo } from "apollo-angular";
import { gql } from "apollo-angular";
import { map, Observable, retry, timer } from "rxjs";
import {
  PokemonAbility,
  PokemonDetails,
  PokemonListItem,
  PokemonMove,
  PokemonStat,
  PokemonType,
} from "./models";
import { pickSpriteUrl } from "./pokeapi.util";

const GET_POKEMON_PAGE = gql`
  query GetPokemon($limit: Int, $offset: Int) {
    pokemon_v2_pokemon(limit: $limit, offset: $offset, order_by: { id: asc }) {
      id
      name
      height
      weight
      pokemon_v2_pokemontypes(order_by: { slot: asc }) {
        pokemon_v2_type {
          name
        }
      }
      pokemon_v2_pokemonstats {
        base_stat
        pokemon_v2_stat {
          name
        }
      }
    }
  }
`;

const GET_POKEMON_DETAILS = gql`
  query GetPokemonDetails($id: Int!) {
    pokemon_v2_pokemon_by_pk(id: $id) {
      id
      name
      height
      weight
      pokemon_v2_pokemontypes(order_by: { slot: asc }) {
        pokemon_v2_type {
          name
        }
      }
      pokemon_v2_pokemonstats {
        base_stat
        pokemon_v2_stat {
          name
        }
      }
      pokemon_v2_pokemonsprites(limit: 1) {
        sprites
      }
      pokemon_v2_pokemonabilities(order_by: { slot: asc }) {
        is_hidden
        pokemon_v2_ability {
          name
          pokemon_v2_abilityeffecttexts(where: { language_id: { _eq: 9 } }, limit: 1) {
            effect
            short_effect
          }
        }
      }
      pokemon_v2_pokemonmoves(limit: 50) {
        pokemon_v2_move {
          name
        }
      }
      pokemon_v2_pokemonspecy {
        pokemon_v2_evolutionchain {
          pokemon_v2_pokemonspecies(order_by: { order: asc }) {
            id
            name
            order
          }
        }
      }
    }
  }
`;

const GET_TYPES = gql`
  query GetTypes {
    pokemon_v2_type(order_by: { id: asc }) {
      id
      name
      pokemon_v2_typeefficacies {
        damage_factor
        pokemonV2TypeByTargetTypeId {
          name
        }
      }
    }
  }
`;

export interface TypeEfficacyRow {
  sourceType: PokemonType;
  targetType: PokemonType;
  damageFactor: number;
}

/**
 * GraphQL API wrapper for the public PokéAPI endpoint.
 *
 * All calls are queries-only and use retry-with-delay (per assessment spec).
 */
@Injectable({ providedIn: "root" })
export class PokemonApiService {
  private readonly apollo = inject(Apollo).use("pokeapi");

  /**
   * Fetches paginated Pokemon from the PokéAPI GraphQL endpoint.
   * Results are intended to be cached in the PokemonStore to avoid redundant network calls.
   *
   * @param limit - Number of Pokemon to fetch per page
   * @param offset - Starting index for pagination
   * @returns Observable<PokemonListItem[]> - Stream of Pokemon list items
   */
  public getPokemonPage(limit: number, offset: number): Observable<PokemonListItem[]> {
    return this.apollo
      .query<{
        pokemon_v2_pokemon: Array<{
          id: number;
          name: string;
          height: number;
          weight: number;
          pokemon_v2_pokemontypes: Array<{ pokemon_v2_type: { name: string } }>;
          pokemon_v2_pokemonstats: Array<{
            base_stat: number;
            pokemon_v2_stat: { name: string };
          }>;
        }>;
      }>({
        query: GET_POKEMON_PAGE,
        variables: { limit, offset },
        fetchPolicy: "network-only",
      })
      .pipe(
        retry({ count: 3, delay: (_err, retryIndex) => timer(300 * (retryIndex + 1)) }),
        map((res) => (res.data?.pokemon_v2_pokemon ?? []).map((p) => this.mapListItem(p))),
      );
  }

  /**
   * Fetches a single Pokemon by id including abilities, moves and evolution-chain info.
   *
   * @param id - Pokemon id
   * @returns Observable<PokemonDetails> - Stream of a fully shaped Pokemon details model
   */
  public getPokemonDetails(id: number): Observable<PokemonDetails> {
    return this.apollo
      .query<{
        pokemon_v2_pokemon_by_pk: any;
      }>({
        query: GET_POKEMON_DETAILS,
        variables: { id },
        fetchPolicy: "network-only",
      })
      .pipe(
        retry({ count: 3, delay: (_err, retryIndex) => timer(300 * (retryIndex + 1)) }),
        map((res) => this.mapDetails(res.data?.pokemon_v2_pokemon_by_pk)),
      );
  }

  /**
   * Fetches type efficacy relations (damage factors) for matchup calculations.
   * This is a good candidate for `shareReplay(1)` at the selector layer.
   *
   * @returns Observable<TypeEfficacyRow[]> - Flattened list of efficacy relations
   */
  public getTypeEfficacies(): Observable<TypeEfficacyRow[]> {
    return this.apollo
      .query<{
        pokemon_v2_type: Array<{
          name: string;
          pokemon_v2_typeefficacies: Array<{
            damage_factor: number;
            pokemonV2TypeByTargetTypeId: { name: string };
          }>;
        }>;
      }>({
        query: GET_TYPES,
        fetchPolicy: "cache-first",
      })
      .pipe(
        retry({ count: 3, delay: (_err, retryIndex) => timer(300 * (retryIndex + 1)) }),
        map((res) =>
          (res.data?.pokemon_v2_type ?? []).flatMap((t) =>
            t.pokemon_v2_typeefficacies.map((e) => ({
              sourceType: t.name,
              targetType: e.pokemonV2TypeByTargetTypeId.name,
              damageFactor: e.damage_factor,
            })),
          ),
        ),
      );
  }

  /**
   * Maps the PokéAPI list row into our PokemonListItem model.
   *
   * @param p - Raw PokéAPI row
   * @returns PokemonListItem
   */
  private mapListItem(p: any): PokemonListItem {
    const stats: PokemonStat[] = p.pokemon_v2_pokemonstats.map((s: any) => ({
      name: s.pokemon_v2_stat.name,
      base_stat: s.base_stat,
    }));

    return {
      id: p.id,
      name: p.name,
      height: p.height,
      weight: p.weight,
      types: p.pokemon_v2_pokemontypes.map((t: any) => t.pokemon_v2_type.name),
      stats,
      // Keep list rows image-free so first paint is not blocked by external sprite CDNs.
      spriteUrl: null,
    };
  }

  /**
   * Maps the PokéAPI details response into our PokemonDetails model.
   *
   * @param p - Raw details object from PokéAPI
   * @returns PokemonDetails
   */
  private mapDetails(p: any): PokemonDetails {
    if (!p) {
      // Should be unreachable in healthy responses, but keeps strict-mode safe.
      return {
        id: -1,
        name: "",
        height: 0,
        weight: 0,
        types: [],
        stats: [],
        spriteUrl: null,
        abilities: [],
        moves: [],
        evolutionChain: [],
        officialArtworkUrl: null,
      };
    }
    const base = this.mapListItem(p);
    const spriteJson = p.pokemon_v2_pokemonsprites?.[0]?.sprites ?? null;
    const officialArtworkUrl = (() => {
      if (!spriteJson) return null;
      try {
        const sprites = JSON.parse(spriteJson);
        return sprites?.other?.["official-artwork"]?.front_default ?? null;
      } catch {
        return null;
      }
    })();

    const abilities: PokemonAbility[] = (p.pokemon_v2_pokemonabilities ?? []).map((a: any) => {
      const text = a.pokemon_v2_ability?.pokemon_v2_abilityeffecttexts?.[0] ?? null;
      return {
        name: a.pokemon_v2_ability?.name ?? "",
        isHidden: !!a.is_hidden,
        effect: text?.effect ?? "",
        shortEffect: text?.short_effect ?? "",
      };
    });

    const moves: PokemonMove[] = (p.pokemon_v2_pokemonmoves ?? []).map((m: any) => ({
      name: m.pokemon_v2_move?.name ?? "",
    }));

    const evolutionChain: { id: number; name: string }[] =
      p.pokemon_v2_pokemonspecy?.pokemon_v2_evolutionchain?.pokemon_v2_pokemonspecies?.map(
        (s: any) => ({ id: s.id, name: s.name }),
      ) ?? [];

    return {
      ...base,
      abilities,
      moves,
      evolutionChain,
      officialArtworkUrl,
    };
  }
}
