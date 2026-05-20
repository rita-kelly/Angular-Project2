import { Routes } from "@angular/router";

export const routes: Routes = [
  { path: "", pathMatch: "full", redirectTo: "pokedex" },
  {
    path: "pokedex",
    loadComponent: () =>
      import("./features/pokedex/pokedex-page.component").then((m) => m.PokedexPageComponent),
    children: [
      {
        path: ":id",
        loadComponent: () =>
          import("./features/pokedex/pokemon-detail-panel/pokemon-detail-panel.component").then(
            (m) => m.PokemonDetailPanelComponent,
          ),
      },
    ],
  },
  {
    path: "team-builder",
    loadComponent: () =>
      import("./features/team-builder/team-builder-page.component").then((m) => m.TeamBuilderPageComponent),
  },
  {
    path: "battles",
    loadComponent: () =>
      import("./features/battles/battles-page.component").then((m) => m.BattlesPageComponent),
  },
  {
    path: "profile",
    loadComponent: () =>
      import("./features/profile/profile-page.component").then((m) => m.ProfilePageComponent),
  },
  { path: "**", redirectTo: "pokedex" },
];
