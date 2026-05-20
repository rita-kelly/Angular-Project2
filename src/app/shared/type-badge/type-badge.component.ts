import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { PokemonType } from "../../api/models";
import { typeColor } from "../type-colors";

/**
 * Compact colored badge for a Pokemon type.
 */
@Component({
  selector: "app-type-badge",
  standalone: true,
  templateUrl: "./type-badge.component.html",
  styleUrl: "./type-badge.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypeBadgeComponent {
  public readonly type = input.required<PokemonType>();

  public readonly bg = computed(() => typeColor(this.type()));
}

