import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { Trainer, Team, PokemonListItem, PokemonStat } from "../../api/models";
import { TrainerStore } from "../../state/trainer.store";
import { PokemonStore } from "../../state/pokemon.store";

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
  private readonly pokemonStore = inject(PokemonStore);
  private readonly destroyRef = inject(DestroyRef);

  public readonly state = toSignal(this.trainerStore.state$, {
    initialValue: this.trainerStore.getSnapshot(),
  });
  public readonly statusMessage = signal<string | null>(null);
  public readonly toastMessage = signal<{message: string, type: 'error' | 'success' | 'warning'} | null>(null);

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
      validators: [Validators.required],
    }),
  });

  public readonly avatarPreview = signal<string | null>(null);
  public readonly brokenAvatarUrls = signal<Set<string>>(new Set());
  public readonly selectedTeam = signal<Team | null>(null);
  public readonly showTeamModal = signal(false);

  public readonly rankOptions = [
    { value: "Novice", label: "Novice" },
    { value: "Rookie", label: "Rookie" },
    { value: "Ace Trainer", label: "Ace Trainer" },
    { value: "Gym Leader", label: "Gym Leader" },
    { value: "Elite Four", label: "Elite Four" },
    { value: "Champion", label: "Champion" },
    { value: "Master", label: "Master" },
    { value: "Professor", label: "Professor" },
  ];

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
   * Returns teams with members (non-empty teams).
   *
   * @returns Array of teams with at least one member
   */
  public readonly teamsWithMembers = computed(() => {
    return this.state().teams.filter(team => team.pokemon_ids.length > 0);
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
      this.showToast('Please select an image file.', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      this.showToast('Image size should be less than 5MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      
      // Check if data URL is too long (rough estimate for GraphQL/DB limits)
      if (dataUrl.length > 1000000) { // ~1MB character limit
        this.showToast('Image is too large. Please select a smaller image.', 'warning');
        return;
      }
      
      this.avatarPreview.set(dataUrl);
      this.form.controls.avatarUrl.setValue(dataUrl);
      this.form.markAsDirty();
      this.statusMessage.set(null);
      
      // Clear any broken URL markers since we have a new valid image
      this.brokenAvatarUrls.set(new Set());
    };
    reader.readAsDataURL(file);
  }

  /**
   * Shows a toast message.
   * 
   * @param message - Message to display
   * @param type - Toast type (error, success, or warning)
   */
  public showToast(message: string, type: 'error' | 'success' | 'warning'): void {
    this.toastMessage.set({ message, type });
    setTimeout(() => this.toastMessage.set(null), 3500);
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
   * Handles image loading errors for avatar URLs.
   * Marks the URL as broken so it falls back to initials.
   *
   * @param avatarUrl - The avatar URL that failed to load
   */
  public onAvatarError(avatarUrl: string | null | undefined): void {
    if (!avatarUrl) {
      return;
    }
    
    this.brokenAvatarUrls.update(broken => {
      const updated = new Set(broken);
      updated.add(avatarUrl);
      return updated;
    });
  }

  /**
   * Checks if an avatar URL should be shown or if we should fall back to initials.
   * Returns true if the URL should be shown (not broken and not empty).
   *
   * @param avatarUrl - The avatar URL to check
   * @returns Whether to show the image
   */
  public shouldShowAvatar(avatarUrl: string | null | undefined): boolean {
    if (!avatarUrl || avatarUrl.trim() === '') {
      return false;
    }
    
    // Check if this URL is marked as broken
    if (this.brokenAvatarUrls().has(avatarUrl)) {
      return false;
    }
    
    return true;
  }

  /**
   * Formats a team date string for display.
   *
   * @param dateString - ISO date string
   * @returns Formatted date
   */
  public formatTeamDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'Unknown date';
    }
  }

  /**
   * Gets a Pokemon by ID.
   *
   * @param id - Pokemon ID
   * @returns Pokemon or undefined
   */
  public getPokemonById(id: number): PokemonListItem | undefined {
    const pokemonState = this.pokemonStore.getSnapshot();
    const pokemon = pokemonState.pokemonById[id];
    
    if (pokemon) {
      // Ensure spriteUrl is set, even if it's null in seed data
      return {
        ...pokemon,
        spriteUrl: pokemon.spriteUrl || this.generateSpriteUrl(id)
      };
    }
    
    // Try to load the Pokemon details if not in store
    this.pokemonStore.loadPokemonDetails(id).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();
    
    return undefined;
  }

  /**
   * Generates a sprite URL for a Pokemon by ID.
   *
   * @param id - Pokemon ID
   * @returns Sprite URL
   */
  private generateSpriteUrl(id: number): string {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
  }

  /**
   * Handles image loading errors for Pokemon sprites.
   * Returns null to trigger the fallback placeholder.
   *
   * @param event - Image error event
   * @returns null to indicate the image failed to load
   */
  public onPokemonSpriteError(event: Event): null {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    
    // Find and show the placeholder
    const parent = img.parentElement;
    if (parent) {
      const placeholder = parent.querySelector('.sprite-placeholder');
      if (placeholder) {
        (placeholder as HTMLElement).style.display = 'flex';
      }
    }
    
    return null;
  }

  /**
   * Gets a stat value from Pokemon stats array.
   *
   * @param stats - Pokemon stats array
   * @param statName - Name of the stat to find
   * @returns The stat value or 0 if not found
   */
  public getStatValue(stats: PokemonStat[], statName: string): number {
    const stat = stats.find(s => s.name === statName);
    return stat ? stat.base_stat : 0;
  }

  /**
   * Opens the team details modal.
   *
   * @param team - Team to show details for
   */
  public openTeamModal(team: Team): void {
    this.selectedTeam.set(team);
    this.showTeamModal.set(true);
  }

  /**
   * Closes the team details modal.
   */
  public closeTeamModal(): void {
    this.showTeamModal.set(false);
    this.selectedTeam.set(null);
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
    
    // Clear broken URLs for the current avatar URL when loading a new trainer
    if (trainer.avatar_url) {
      this.brokenAvatarUrls.update(broken => {
        const updated = new Set(broken);
        updated.delete(trainer.avatar_url!);
        return updated;
      });
    }
    
    // Set avatar preview if avatar_url is a data URL
    if (trainer.avatar_url && trainer.avatar_url.startsWith('data:image/')) {
      this.avatarPreview.set(trainer.avatar_url);
    } else {
      this.avatarPreview.set(null);
    }
  }
}
