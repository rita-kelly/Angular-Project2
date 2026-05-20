import { DestroyRef, Injectable, inject } from "@angular/core";
import {
  BehaviorSubject,
  catchError,
  finalize,
  interval,
  map,
  Observable,
  of,
  scan,
  startWith,
  switchMap,
  tap,
} from "rxjs";
import { TrainerApiService } from "../api/trainer-api.service";
import { Battle, BattleLogEntry, Team, Trainer } from "../api/models";

export interface TrainerState {
  trainers: Trainer[];
  currentTrainerId: number | null;
  trainer: Trainer | null;
  teams: Team[];
  battles: Battle[];
  battleLogs: BattleLogEntry[];
  liveBattleFeed: BattleLogEntry[];
  loading: boolean;
  mutating: boolean;
  error: string | null;
}

const INITIAL_STATE: TrainerState = {
  trainers: [],
  currentTrainerId: 1,
  trainer: null,
  teams: [],
  battles: [],
  battleLogs: [],
  liveBattleFeed: [],
  loading: false,
  mutating: false,
  error: null,
};

/**
 * BehaviorSubject-based store for trainer profile, teams, battles, and battle logs.
 * Also owns the polling-based "subscription simulation" feed.
 */
@Injectable({ providedIn: "root" })
export class TrainerStore {
  private readonly api = inject(TrainerApiService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly stateSubject = new BehaviorSubject<TrainerState>(INITIAL_STATE);

  /**
   * Observable stream of the entire TrainerState.
   */
  public readonly state$ = this.stateSubject.asObservable();

  /**
   * Returns the current snapshot value of the store (read-only usage).
   *
   * @returns TrainerState
   */
  public getSnapshot(): TrainerState {
    return this.stateSubject.getValue();
  }

  /**
   * Loads the available trainers list.
   *
   * @returns Observable<Trainer[]> - Stream of trainers
   */
  public loadTrainers(): Observable<Trainer[]> {
    this.patchState({ loading: true, error: null });
    return this.api.getTrainers().pipe(
      tap((trainers) => this.patchState({ trainers })),
      finalize(() => this.patchState({ loading: false })),
      catchError((err) => {
        this.patchState({ error: this.toErrorMessage(err) });
        return of([]);
      }),
    );
  }

  /**
   * Sets the active trainer id in state.
   *
   * @param trainerId - Trainer id
   */
  public setCurrentTrainerId(trainerId: number): void {
    this.patchState({ currentTrainerId: trainerId });
  }

  /**
   * Loads trainer profile + teams + battles in parallel for the current trainer.
   *
   * @param trainerId - Trainer id
   * @returns Observable<void> - Completion stream
   */
  public loadTrainerDashboard(trainerId: number): Observable<void> {
    this.patchState({ loading: true, error: null, currentTrainerId: trainerId });

    return this.api.getTrainer(trainerId).pipe(
      tap((trainer) => this.patchState({ trainer })),
      switchMap(() => this.api.getTeams(trainerId)),
      tap((teams) => this.patchState({ teams })),
      switchMap(() => this.api.getBattles(trainerId)),
      tap((battles) => this.patchState({ battles })),
      finalize(() => this.patchState({ loading: false })),
      map(() => void 0),
      catchError((err) => {
        this.patchState({ error: this.toErrorMessage(err), loading: false });
        return of(void 0);
      }),
    );
  }

  /**
   * Creates a team with an optimistic UI update (required).
   * If the mutation fails, the store rolls back to the previous teams list.
   *
   * @param team - Team input (excluding id)
   * @returns Observable<Team> - Stream of the created team
   */
  public createTeamOptimistic(team: Omit<Team, "id">): Observable<Team> {
    const prevTeams = this.getSnapshot().teams;
    const tempId = -Math.floor(Date.now() / 1000);
    const optimisticTeam: Team = { ...team, id: tempId };

    this.patchState({ teams: [optimisticTeam, ...prevTeams], mutating: true, error: null });

    return this.api.createTeam(team).pipe(
      tap((created) => {
        const current = this.getSnapshot().teams;
        this.patchState({
          teams: current.map((t) => (t.id === tempId ? created : t)),
        });
      }),
      finalize(() => this.patchState({ mutating: false })),
      catchError((err) => {
        this.patchState({ teams: prevTeams, mutating: false, error: this.toErrorMessage(err) });
        return of(null as unknown as Team);
      }),
    );
  }

  /**
   * Updates a team in the local backend and store.
   *
   * @param id - Team id
   * @param patch - Team patch (name/pokemon_ids/etc.)
   * @returns Observable<Team> - Stream of updated team
   */
  public updateTeam(id: number, patch: Partial<Omit<Team, "id">>): Observable<Team> {
    const prevTeams = this.getSnapshot().teams;
    const nextTeams = prevTeams.map((t) => (t.id === id ? ({ ...t, ...patch } as Team) : t));

    this.patchState({ teams: nextTeams, mutating: true, error: null });

    return this.api.updateTeam(id, patch).pipe(
      tap((updated) => {
        const current = this.getSnapshot().teams;
        this.patchState({ teams: current.map((t) => (t.id === id ? updated : t)) });
      }),
      finalize(() => this.patchState({ mutating: false })),
      catchError((err) => {
        this.patchState({ teams: prevTeams, mutating: false, error: this.toErrorMessage(err) });
        return of(null as unknown as Team);
      }),
    );
  }

  /**
   * Deletes a team from the backend and removes it from state.
   *
   * @param id - Team id
   * @returns Observable<boolean> - Stream of deletion success
   */
  public deleteTeam(id: number): Observable<boolean> {
    const prevTeams = this.getSnapshot().teams;
    this.patchState({ teams: prevTeams.filter((t) => t.id !== id), mutating: true, error: null });

    return this.api.deleteTeam(id).pipe(
      finalize(() => this.patchState({ mutating: false })),
      catchError((err) => {
        this.patchState({ teams: prevTeams, mutating: false, error: this.toErrorMessage(err) });
        return of(false);
      }),
    );
  }

  /**
   * Updates the current trainer profile in the backend and state.
   *
   * @param id - Trainer id
   * @param patch - Trainer patch
   * @returns Observable<Trainer> - Stream of updated trainer
   */
  public updateTrainer(id: number, patch: Partial<Omit<Trainer, "id">>): Observable<Trainer> {
    const prevTrainer = this.getSnapshot().trainer;
    this.patchState({
      trainer: prevTrainer ? ({ ...prevTrainer, ...patch } as Trainer) : prevTrainer,
      mutating: true,
      error: null,
    });

    return this.api.updateTrainer(id, patch).pipe(
      tap((updated) => this.patchState({ trainer: updated })),
      finalize(() => this.patchState({ mutating: false })),
      catchError((err) => {
        this.patchState({ trainer: prevTrainer, mutating: false, error: this.toErrorMessage(err) });
        return of(null as unknown as Trainer);
      }),
    );
  }

  /**
   * Logs a new battle result and appends it into state.
   *
   * @param battle - Battle input (excluding id)
   * @returns Observable<Battle> - Stream of created battle
   */
  public logBattle(battle: Omit<Battle, "id">): Observable<Battle> {
    this.patchState({ mutating: true, error: null });
    return this.api.logBattle(battle).pipe(
      tap((created) => this.patchState({ battles: [created, ...this.getSnapshot().battles] })),
      finalize(() => this.patchState({ mutating: false })),
      catchError((err) => {
        this.patchState({ mutating: false, error: this.toErrorMessage(err) });
        return of(null as unknown as Battle);
      }),
    );
  }

  /**
   * Simulates a live battle log subscription feed by polling.
   *
   * Why polling (instead of real GraphQL WebSocket subscriptions)?
   * The assessment's local mock server (json-graphql-server) does not provide
   * a WebSocket subscription transport, so we simulate "real-time" updates via polling.
   *
   * Implementation requirement:
   * interval(5000) + switchMap(...) and emit only new log entries.
   *
   * @param pollMs - Poll interval in milliseconds
   * @returns Observable<BattleLogEntry[]> - Stream of only the new entries since last poll
   */
  public connectLiveBattleLogFeed(pollMs: number = 5000): Observable<BattleLogEntry[]> {
    return interval(pollMs).pipe(
      startWith(0),
      switchMap(() => this.api.getBattleLogs()),
      tap((allLogs) => this.patchState({ battleLogs: allLogs })),
      scan(
        (acc, allLogs) => {
          const sorted = [...allLogs].sort((a, b) => a.id - b.id);
          const maxId = sorted.length ? sorted[sorted.length - 1]!.id : acc.lastId;
          const newEntries = sorted.filter((e) => e.id > acc.lastId);
          return { lastId: maxId, newEntries };
        },
        { lastId: 0, newEntries: [] as BattleLogEntry[] },
      ),
      map((x) => x.newEntries),
      tap((newEntries) => {
        if (!newEntries.length) return;
        const current = this.getSnapshot().liveBattleFeed;
        const next = [...current, ...newEntries].slice(-200);
        this.patchState({ liveBattleFeed: next });
      }),
    );
  }

  /**
   * Patches the store state.
   *
   * @param patch - Partial state patch
   */
  private patchState(patch: Partial<TrainerState>): void {
    this.stateSubject.next({ ...this.stateSubject.getValue(), ...patch });
  }

  /**
   * Converts unknown errors into a user-friendly message.
   *
   * @param err - Unknown error
   * @returns String message
   */
  private toErrorMessage(err: unknown): string {
    if (err instanceof Error) {
      return err.message;
    }
    return "Unknown error";
  }
}

