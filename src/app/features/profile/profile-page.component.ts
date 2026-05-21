import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { Trainer } from "../../api/models";
import { TrainerStore } from "../../state/trainer.store";

/**
 * Trainer profile route with profile editing for the current trainer.
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
    avatarUrl: new FormControl("", { nonNullable: true }),
    rank: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(30)],
    }),
  });

  public readonly avatarPreview = signal<string | null>(null);

  public readonly currentTrainer = computed(() => this.state().trainer);
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
   * Loads trainer profile for the current trainer (ID 1).
   */
  public constructor() {
    this.trainerStore.loadTrainerDashboard(1).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();

    effect(() => {
      const trainer = this.currentTrainer();
      if (trainer) {
        this.patchForm(trainer);
      }
    });
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

    const trainer = this.currentTrainer();
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
          // Clear avatar preview after successful save
          this.avatarPreview.set(null);
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
    const trainer = this.currentTrainer();
    if (!trainer) {
      return "TR";
    }

    return trainer.name
      .split(" ")
      .filter(Boolean)
      .map((part: string) => part[0]?.toUpperCase())
      .join("")
      .slice(0, 2);
  }

  /**
   * Handles file selection for avatar upload.
   *
   * @param event - File input change event
   */
  public onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
      this.statusMessage.set('Please select an image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      this.statusMessage.set('Image size should be less than 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      
      // Check if data URL is too long (rough estimate for GraphQL/DB limits)
      if (dataUrl.length > 1000000) { // ~1MB character limit
        this.statusMessage.set('Image is too large. Please select a smaller image.');
        return;
      }
      
      this.avatarPreview.set(dataUrl);
      this.form.controls.avatarUrl.setValue(dataUrl);
      this.form.markAsDirty();
      this.statusMessage.set(null);
    };
    reader.readAsDataURL(file);
  }

  /**
   * Removes the uploaded avatar.
   */
  public removeAvatar(): void {
    this.avatarPreview.set(null);
    this.form.controls.avatarUrl.setValue('');
    this.form.markAsDirty();
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
    
    // Set avatar preview if avatar_url is a data URL
    if (trainer.avatar_url && trainer.avatar_url.startsWith('data:image/')) {
      this.avatarPreview.set(trainer.avatar_url);
    } else {
      this.avatarPreview.set(null);
    }
  }
}
