import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { CdkDragDrop, DragDropModule } from "@angular/cdk/drag-drop";
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { startWith } from "rxjs";
import { PokemonListItem } from "../../api/models";
import { totalBaseStats } from "../../api/pokeapi.util";
import { PokemonStore } from "../../state/pokemon.store";
import { TrainerStore } from "../../state/trainer.store";
import { TeamDraftService } from "../../shared/team-draft.service";
import { TypeBadgeComponent } from "../../shared/type-badge/type-badge.component";
import { evTotalValidator, teamNameUniqueValidator } from "./team-builder.validators";

const HELD_ITEMS = ["Leftovers", "Choice Scarf", "Focus Sash", "Life Orb", "Sitrus Berry"];
const TIERS = ["OU", "UU", "RU", "NU"];

/**
 * Advanced Team Builder form with async validation, FormArray member rows, and CDK drag/drop.
 */
@Component({
  selector: "app-team-builder-page",
  standalone: true,
  imports: [ReactiveFormsModule, DragDropModule, TypeBadgeComponent],
  templateUrl: "./team-builder-page.component.html",
  styleUrl: "./team-builder-page.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamBuilderPageComponent {
  private readonly pokemonStore = inject(PokemonStore);
  private readonly trainerStore = inject(TrainerStore);
  private readonly draft = inject(TeamDraftService);
  private readonly destroyRef = inject(DestroyRef);

  public readonly searchControl = new FormControl<string>("", { nonNullable: true });
  public readonly selectedIds = signal<number[]>([]);
  public readonly saveMessage = signal<string | null>(null);

  public readonly pokemonState = toSignal(this.pokemonStore.state$, {
    initialValue: this.pokemonStore.getSnapshot(),
  });
  public readonly trainerState = toSignal(this.trainerStore.state$, {
    initialValue: this.trainerStore.getSnapshot(),
  });
  public readonly searchTerm = toSignal(this.searchControl.valueChanges.pipe(startWith("")), {
    initialValue: "",
  });

  public readonly form = new FormGroup({
    teamName: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(30)],
      asyncValidators: [teamNameUniqueValidator(() => this.trainerStore.getSnapshot().teams)],
    }),
    competitiveMode: new FormControl(false, { nonNullable: true }),
    tier: new FormControl("OU", { nonNullable: true }),
    members: new FormArray<FormGroup>([]),
  });

  public readonly heldItems = HELD_ITEMS;
  public readonly tiers = TIERS;

  public readonly allPokemon = computed(() =>
    this.pokemonState().pokemonIds
      .map((id) => this.pokemonState().pokemonById[id])
      .filter(Boolean),
  );

  public readonly suggestions = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const selected = new Set(this.selectedIds());

    return this.allPokemon()
      .filter((p) => !selected.has(p.id))
      .filter((p) => !term || p.name.includes(term))
      .slice(0, 8);
  });

  public readonly selectedPokemon = computed(() => {
    const byId = this.pokemonState().pokemonById;
    return this.selectedIds().map((id) => byId[id]).filter(Boolean);
  });

  public readonly teamTotalBaseStats = computed(() =>
    this.selectedPokemon().reduce((sum, p) => sum + totalBaseStats(p.stats), 0),
  );

  /**
   * Computes a Pokemon's base stat total for display.
   *
   * @param pokemon - Pokemon row
   * @returns Base stat total
   */
  public pokemonTotalBaseStats(pokemon: PokemonListItem): number {
    return totalBaseStats(pokemon.stats);
  }

  public readonly typeAdvisory = computed(() => {
    const types = new Set(this.selectedPokemon().flatMap((p) => p.types.map(String)));
    const missingCounters = ["electric", "grass", "ice"].filter((t) => !types.has(t));

    if (this.selectedPokemon().length === 0) {
      return null;
    }

    if (missingCounters.length) {
      return `Advisory: this team has no clear ${missingCounters.join("/")} coverage yet.`;
    }

    return "Coverage looks balanced for common Water/Flying/Ground threats.";
  });

  /**
   * Initializes the page with trainer data and any Pokédex draft selections.
   */
  public constructor() {
    const trainerId = this.trainerState().currentTrainerId ?? 1;
    this.trainerStore.loadTrainerDashboard(trainerId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    this.setSelectedIds(this.draft.pokemonIds());
  }

  /**
   * Gets the dynamic member FormArray.
   *
   * @returns FormArray of member form groups
   */
  public members(): FormArray<FormGroup> {
    return this.form.controls.members;
  }

  /**
   * Adds a Pokemon to the team selection.
   *
   * @param pokemon - Pokemon to add
   */
  public addPokemon(pokemon: PokemonListItem): void {
    if (this.selectedIds().includes(pokemon.id) || this.selectedIds().length >= 6) {
      return;
    }

    this.setSelectedIds([...this.selectedIds(), pokemon.id]);
  }

  /**
   * Removes a Pokemon from the team selection.
   *
   * @param id - Pokemon id
   */
  public removePokemon(id: number): void {
    this.setSelectedIds(this.selectedIds().filter((pokemonId) => pokemonId !== id));
  }

  /**
   * Handles a CDK drag/drop event from search suggestions into team slots.
   *
   * @param event - CDK drag/drop event with Pokemon data
   */
  public dropPokemon(event: CdkDragDrop<unknown>): void {
    const pokemon = event.item.data as PokemonListItem | undefined;
    if (pokemon) {
      this.addPokemon(pokemon);
    }
  }

  /**
   * Saves the form as a new team through the optimistic trainer store mutation.
   */
  public saveTeam(): void {
    this.saveMessage.set(null);

    if (this.selectedIds().length < 1 || this.selectedIds().length > 6) {
      this.saveMessage.set("Choose between 1 and 6 Pokemon before saving.");
      return;
    }

    if (this.form.invalid || this.members().invalid) {
      this.form.markAllAsTouched();
      this.saveMessage.set("Fix the highlighted fields before saving.");
      return;
    }

    const trainerId = this.trainerState().currentTrainerId ?? 1;
    const teamName = this.form.controls.teamName.value.trim();

    this.trainerStore
      .createTeamOptimistic({
        trainer_id: trainerId,
        name: teamName,
        pokemon_ids: this.selectedIds(),
        created_at: new Date().toISOString(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((team) => {
        if (team) {
          this.saveMessage.set(`Saved ${team.name}.`);
          this.draft.clear();
        }
      });
  }

  /**
   * Gets a typed EV FormGroup from a member row.
   *
   * @param member - Member form group
   * @returns EV form group
   */
  public evGroup(member: FormGroup): FormGroup {
    return member.get("evs") as FormGroup;
  }

  /**
   * Computes an EV total for display.
   *
   * @param member - Member form group
   * @returns Sum of EV values
   */
  public evTotal(member: FormGroup): number {
    const evs = this.evGroup(member).value as Record<string, number>;
    return Object.values(evs).reduce((sum, v) => sum + Number(v ?? 0), 0);
  }

  /**
   * Returns true when a control should show validation feedback.
   *
   * @param control - Form control
   * @returns Whether the control is invalid and user-touched
   */
  public showError(control: AbstractControl | null): boolean {
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  /**
   * Replaces selected ids and keeps the member FormArray aligned.
   *
   * @param ids - Selected Pokemon ids
   */
  private setSelectedIds(ids: number[]): void {
    const next = Array.from(new Set(ids)).slice(0, 6);
    this.selectedIds.set(next);
    this.draft.set(next);
    this.syncMemberForms(next);
  }

  /**
   * Aligns member sub-forms with selected Pokemon ids.
   *
   * @param ids - Selected Pokemon ids
   */
  private syncMemberForms(ids: number[]): void {
    const existing = new Map(this.members().controls.map((group) => [group.get("pokemonId")?.value, group]));
    this.members().clear();
    for (const id of ids) {
      this.members().push(existing.get(id) ?? this.createMemberForm(id));
    }
  }

  /**
   * Creates a dynamic member sub-form for a selected Pokemon.
   *
   * @param pokemonId - Pokemon id
   * @returns FormGroup for member metadata
   */
  private createMemberForm(pokemonId: number): FormGroup {
    return new FormGroup({
      pokemonId: new FormControl(pokemonId, { nonNullable: true }),
      nickname: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(20)] }),
      heldItem: new FormControl(HELD_ITEMS[0], { nonNullable: true }),
      evs: new FormGroup(
        {
          hp: new FormControl(0, { nonNullable: true, validators: [Validators.min(0), Validators.max(252)] }),
          attack: new FormControl(0, { nonNullable: true, validators: [Validators.min(0), Validators.max(252)] }),
          defense: new FormControl(0, { nonNullable: true, validators: [Validators.min(0), Validators.max(252)] }),
          specialAttack: new FormControl(0, { nonNullable: true, validators: [Validators.min(0), Validators.max(252)] }),
          specialDefense: new FormControl(0, { nonNullable: true, validators: [Validators.min(0), Validators.max(252)] }),
          speed: new FormControl(0, { nonNullable: true, validators: [Validators.min(0), Validators.max(252)] }),
        },
        { validators: [evTotalValidator()] },
      ),
    });
  }
}
