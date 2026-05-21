import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { TrainerStore } from "./state/trainer.store";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private readonly trainerStore = inject(TrainerStore);
  private readonly destroyRef = inject(DestroyRef);

  public readonly sidebarOpen = signal(true);
  public readonly state = toSignal(this.trainerStore.state$, {
    initialValue: this.trainerStore.getSnapshot(),
  });
  public readonly brokenAvatarUrls = signal<Set<string>>(new Set());

  public readonly navItems = computed(() => [
    { label: "Pokedex", icon: "PK", route: "/pokedex" },
    { label: "Team Builder", icon: "TB", route: "/team-builder" },
    { label: "Battles", icon: "BT", route: "/battles" },
    { label: "Profile", icon: "PR", route: "/profile" },
  ]);

  /**
   * Gets the avatar display (initials) for the current trainer.
   */
  public readonly trainerAvatar = computed(() => {
    const trainer = this.state().trainer;
    
    if (!trainer) {
      // If no trainer loaded yet, show loading state
      return '...';
    }

    // Show initials as per requirement:
    // "sign up to retrieve the first letter of the person's first name and last name"
    return this.getInitialsFromName(trainer.name);
  });

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

  constructor() {
    // Load the default trainer (ID 1) when app starts
    // Also load the trainers list first to ensure data is available
    this.trainerStore.loadTrainers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          // After trainers are loaded, load the dashboard for the current trainer
          const currentTrainerId = this.state().currentTrainerId;
          if (currentTrainerId) {
            this.trainerStore.loadTrainerDashboard(currentTrainerId)
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe();
          }
        },
        error: (err) => console.error('Error loading trainers:', err)
      });

    // Clear broken avatar URLs when trainer changes
    effect(() => {
      const trainer = this.state().trainer;
      if (trainer?.avatar_url) {
        this.brokenAvatarUrls.update(broken => {
          const updated = new Set(broken);
          updated.delete(trainer.avatar_url!);
          return updated;
        });
      }
    });
  }

  /**
   * Toggles the sidebar open state.
   */
  public toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }

  /**
   * Extracts initials from a trainer's name.
   * Takes first letter of first name and first letter of last name.
   */
  private getInitialsFromName(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 0) return '...';
    
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    
    // Get first letter of first name and first letter of last name
    const firstInitial = parts[0].charAt(0).toUpperCase();
    const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
    return `${firstInitial}${lastInitial}`;
  }
}
