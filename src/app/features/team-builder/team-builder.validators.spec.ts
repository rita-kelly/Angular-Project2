import { FormControl, FormGroup } from "@angular/forms";
import { firstValueFrom, from } from "rxjs";
import { evTotalValidator, teamNameUniqueValidator } from "./team-builder.validators";

describe("team builder validators", () => {
  it("flags duplicate team names asynchronously", async () => {
    const control = new FormControl("Kanto Starters");
    const validator = teamNameUniqueValidator(() => [
      {
        id: 1,
        trainer_id: 1,
        name: "Kanto Starters",
        pokemon_ids: [1, 2, 3],
        created_at: "2024-01-01",
      },
    ]);

    await expectAsync(firstValueFrom(from(validator(control)))).toBeResolvedTo({ uniqueTeamName: true });
  });

  it("flags EV spreads over the 510 competitive budget", () => {
    const group = new FormGroup(
      {
        hp: new FormControl(252),
        attack: new FormControl(252),
        defense: new FormControl(12),
      },
      { validators: [evTotalValidator()] },
    );

    expect(group.hasError("evBudget")).toBeTrue();
  });
});
