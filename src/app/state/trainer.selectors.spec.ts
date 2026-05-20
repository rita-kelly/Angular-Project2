import { firstValueFrom, of } from "rxjs";
import { Battle } from "../api/models";
import { battleResultsPerMonth$, teamStats$, winRate$ } from "./trainer.selectors";

describe("trainer selectors", () => {
  const battles: Battle[] = [
    {
      id: 1,
      trainer_id: 1,
      opponent_name: "Gary",
      team_id: 1,
      result: "win",
      date: "2024-06-01",
      score_trainer: 3,
      score_opponent: 1,
    },
    {
      id: 2,
      trainer_id: 1,
      opponent_name: "Cynthia",
      team_id: 1,
      result: "loss",
      date: "2024-06-15",
      score_trainer: 1,
      score_opponent: 3,
    },
    {
      id: 3,
      trainer_id: 1,
      opponent_name: "Lance",
      team_id: 2,
      result: "win",
      date: "2024-07-01",
      score_trainer: 3,
      score_opponent: 2,
    },
  ];

  it("computes win-rate and monthly battle results", async () => {
    await expectAsync(firstValueFrom(winRate$(of(battles)))).toBeResolvedTo({
      wins: 2,
      losses: 1,
      total: 3,
      winRate: 2 / 3,
    });

    await expectAsync(firstValueFrom(battleResultsPerMonth$(of(battles)))).toBeResolvedTo({
      labels: ["2024-06", "2024-07"],
      wins: [1, 1],
      losses: [1, 0],
    });
  });

  it("computes team count and average size", async () => {
    await expectAsync(
      firstValueFrom(
        teamStats$(
          of([
            { id: 1, trainer_id: 1, name: "A", pokemon_ids: [1, 2, 3], created_at: "2024-01-01" },
            { id: 2, trainer_id: 1, name: "B", pokemon_ids: [4, 5], created_at: "2024-01-02" },
          ]),
        ),
      ),
    ).toBeResolvedTo({ teamCount: 2, averageTeamSize: 2.5 });
  });
});
