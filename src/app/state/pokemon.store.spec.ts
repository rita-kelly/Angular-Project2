import { TestBed } from "@angular/core/testing";
import { firstValueFrom } from "rxjs";
import { PokemonStore } from "./pokemon.store";

describe("PokemonStore", () => {
  it("selectPokemonList returns the seeded cache in id order", async () => {
    TestBed.configureTestingModule({});
    const store = TestBed.inject(PokemonStore);

    const list = await firstValueFrom(store.selectPokemonList());

    expect(list.length).toBeGreaterThanOrEqual(20);
    expect(list[0].id).toBe(1);
    expect(list[0].name).toBe("bulbasaur");
  });
});
