import { ChangeDetectionStrategy, Component, computed, signal } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  public readonly sidebarOpen = signal(true);

  public readonly navItems = computed(() => [
    { label: "Pokedex", icon: "PK", route: "/pokedex" },
    { label: "Team Builder", icon: "TB", route: "/team-builder" },
    { label: "Battles", icon: "BT", route: "/battles" },
    { label: "Profile", icon: "PR", route: "/profile" },
  ]);

  /**
   * Toggles the sidebar open state.
   */
  public toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }
}
