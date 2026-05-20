import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { AppComponent } from "./app.component";

describe("AppComponent", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it("creates the app shell", () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    expect(app).toBeTruthy();
    expect(app.navItems().map((item) => item.route)).toEqual([
      "/pokedex",
      "/team-builder",
      "/battles",
      "/profile",
    ]);
  });

  it("toggles the sidebar signal", () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    expect(app.sidebarOpen()).toBeTrue();
    app.toggleSidebar();
    expect(app.sidebarOpen()).toBeFalse();
  });
});
