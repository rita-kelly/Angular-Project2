import { Directive, computed, input } from "@angular/core";
import { PokemonType } from "../api/models";

type HighlightState = "super" | "weak" | "neutral";

const SUPER_EFFECTIVE: Record<string, string[]> = {
  normal: [],
  fire: ["grass", "ice", "bug", "steel"],
  water: ["fire", "ground", "rock"],
  electric: ["water", "flying"],
  grass: ["water", "ground", "rock"],
  ice: ["grass", "ground", "flying", "dragon"],
  fighting: ["normal", "ice", "rock", "dark", "steel"],
  poison: ["grass", "fairy"],
  ground: ["fire", "electric", "poison", "rock", "steel"],
  flying: ["grass", "fighting", "bug"],
  psychic: ["fighting", "poison"],
  bug: ["grass", "psychic", "dark"],
  rock: ["fire", "ice", "flying", "bug"],
  ghost: ["psychic", "ghost"],
  dragon: ["dragon"],
  dark: ["psychic", "ghost"],
  steel: ["ice", "rock", "fairy"],
  fairy: ["fighting", "dragon", "dark"],
};

/**
 * Highlights a Pokemon row based on type matchup for the selected attacking type.
 */
@Directive({
  selector: "[appTypeHighlight]",
  standalone: true,
  host: {
    "[class.type-highlight-super]": "highlightState() === 'super'",
    "[class.type-highlight-weak]": "highlightState() === 'weak'",
  },
})
export class TypeHighlightDirective {
  public readonly attackingType = input<PokemonType | null>(null, { alias: "appTypeHighlight" });
  public readonly targetTypes = input<PokemonType[]>([], { alias: "appTypeHighlightTarget" });

  public readonly highlightState = computed<HighlightState>(() => {
    const attackType = this.normalize(this.attackingType());
    const targets = this.targetTypes().map((type) => this.normalize(type));

    if (!attackType || targets.length === 0) {
      return "neutral";
    }

    if (targets.some((target) => !!target && SUPER_EFFECTIVE[attackType]?.includes(target))) {
      return "super";
    }

    if (targets.some((target) => !!target && SUPER_EFFECTIVE[target]?.includes(attackType))) {
      return "weak";
    }

    return "neutral";
  });

  /**
   * Normalizes a Pokemon type value for lookup-map access.
   *
   * @param type - Pokemon type or null
   * @returns Lowercase type string or null
   */
  private normalize(type: PokemonType | null): string | null {
    return type ? String(type).toLowerCase() : null;
  }
}
