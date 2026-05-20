import { pickSpriteUrl, sortStatsForRadar, totalBaseStats } from "./pokeapi.util";

describe("pokeapi utilities", () => {
  it("computes base-stat totals and radar stat order", () => {
    const stats = [
      { name: "speed", base_stat: 90 },
      { name: "hp", base_stat: 40 },
      { name: "attack", base_stat: 55 },
      { name: "defense", base_stat: 50 },
      { name: "special-attack", base_stat: 65 },
      { name: "special-defense", base_stat: 70 },
    ];

    expect(totalBaseStats(stats)).toBe(370);
    expect(sortStatsForRadar(stats).map((stat) => stat.name)).toEqual([
      "hp",
      "attack",
      "defense",
      "special-attack",
      "special-defense",
      "speed",
    ]);
  });

  it("prefers official artwork when extracting sprites", () => {
    const sprites = JSON.stringify({
      front_default: "front.png",
      other: { "official-artwork": { front_default: "official.png" } },
    });

    expect(pickSpriteUrl(sprites)).toBe("official.png");
  });
});
