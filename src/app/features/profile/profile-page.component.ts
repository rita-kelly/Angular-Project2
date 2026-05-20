import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from "@angular/core";
import { takeUntilDestroyed, toObservable, toSignal } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { distinctUntilChanged, switchMap } from "rxjs";
import { Trainer } from "../../api/models";
import { TrainerStore } from "../../state/trainer.store";

const SELECTED_TRAINER_KEY = "pokedex_selected_trainer_id";

/**
 * Trainer profile route with trainer selection, profile editing, and persisted active trainer.
 */
@Component({
  selector: "app-profile-page",
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: "./profile-page.component.html",
  styleUrl: "./profile-page.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePageComponent {
  private readonly trainerStore = inject(TrainerStore);
  private readonly destroyRef = inject(DestroyRef);

  public readonly state = toSignal(this.trainerStore.state$, {
    initialValue: this.trainerStore.getSnapshot(),
  });
  public readonly currentTrainerId = signal<number>(this.readSelectedTrainerId());
  public readonly statusMessage = signal<string | null>(null);

  public readonly form = new FormGroup({
    name: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(40)],
    }),
    badgeCount: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(16)],
    }),
    region: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(24)],
    }),
    avatarUrl: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(300)] }),
    rank: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(30)],
    }),
  });

  public readonly selectedTrainer = computed(() => this.state().trainer);
  public readonly battleRecord = computed(() => {
    const wins = this.state().battles.filter((battle) => battle.result === "win").length;
    const losses = this.state().battles.filter((battle) => battle.result === "loss").length;
    return { wins, losses };
  });
  public readonly winRate = computed(() => {
    const record = this.battleRecord();
    const total = record.wins + record.losses;
    return total ? Math.round((record.wins / total) * 100) : 0;
  });

  /**
   * Loads trainer choices, watches selected trainer changes, and persists the choice.
   */
  public constructor() {
    this.trainerStore.loadTrainers().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();

    toObservable(this.currentTrainerId)
      .pipe(
        distinctUntilChanged(),
        switchMap((trainerId) => this.trainerStore.loadTrainerDashboard(trainerId)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    effect(() => {
      localStorage.setItem(SELECTED_TRAINER_KEY, String(this.currentTrainerId()));
      this.trainerStore.setCurrentTrainerId(this.currentTrainerId());
    });

    effect(() => {
      const trainer = this.selectedTrainer();
      if (trainer) {
        this.patchForm(trainer);
      }
    });
  }

  /**
   * Updates the selected trainer id from a native select change.
   *
   * @param event - Select change event
   */
  public selectTrainer(event: Event): void {
    const trainerId = Number((event.target as HTMLSelectElement).value);
    if (Number.isFinite(trainerId)) {
      this.currentTrainerId.set(trainerId);
      this.statusMessage.set(null);
    }
  }

  /**
   * Saves trainer profile changes through the local GraphQL mutation.
   */
  public saveProfile(): void {
    this.statusMessage.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.statusMessage.set("Fix the highlighted profile fields before saving.");
      return;
    }

    const trainer = this.selectedTrainer();
    if (!trainer) {
      this.statusMessage.set("No trainer is loaded.");
      return;
    }

    const value = this.form.getRawValue();
    this.trainerStore
      .updateTrainer(trainer.id, {
        name: value.name.trim(),
        badge_count: Number(value.badgeCount),
        region: value.region.trim(),
        avatar_url: value.avatarUrl.trim(),
        rank: value.rank.trim(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((updated) => {
        if (updated) {
          this.statusMessage.set(`Saved ${updated.name}.`);
        }
      });
  }

  /**
   * Returns true when a form control should show validation feedback.
   *
   * @param name - Form control name
   * @returns Whether the control is invalid and user-touched
   */
  public showError(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.dirty || control.touched);
  }

  /**
   * Returns initials for the current trainer avatar fallback.
   *
   * @returns Two-letter initials
   */
  public initials(): string {
    const trainer = this.selectedTrainer();
    if (!trainer) {
      return "TR";
    }

    return trainer.name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase())
      .join("")
      .slice(0, 2);
  }

  /**
   * Tracks trainers by id.
   *
   * @param trainer - Trainer row
   * @returns Trainer id
   */
  public trainerId(trainer: Trainer): number {
    return trainer.id;
  }

  /**
   * Patches the profile form from a loaded trainer.
   *
   * @param trainer - Loaded trainer
   */
  private patchForm(trainer: Trainer): void {
    this.form.patchValue(
      {
        name: trainer.name,
        badgeCount: trainer.badge_count,
        region: trainer.region,
        avatarUrl: trainer.avatar_url,
        rank: trainer.rank,
      },
      { emitEvent: false },
    );
    this.form.markAsPristine();
  }

  /**
   * Reads the persisted selected trainer id from localStorage.
   *
   * @returns Trainer id
   */
  private readSelectedTrainerId(): number {
    const parsed = Number(localStorage.getItem(SELECTED_TRAINER_KEY));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }
}
