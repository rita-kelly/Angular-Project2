import { AbstractControl, AsyncValidatorFn, ValidationErrors } from "@angular/forms";
import { map, Observable, timer } from "rxjs";
import { Team } from "../../api/models";

/**
 * Creates an async validator that checks team-name uniqueness against existing teams.
 *
 * @param teamsProvider - Function returning the current team list
 * @returns Async validator for a team-name control
 */
export function teamNameUniqueValidator(teamsProvider: () => Team[]): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> =>
    timer(300).pipe(
      map(() => {
        const value = String(control.value ?? "").trim().toLowerCase();
        if (!value) {
          return null;
        }

        const exists = teamsProvider().some((team) => team.name.trim().toLowerCase() === value);
        return exists ? { uniqueTeamName: true } : null;
      }),
    );
}

/**
 * Creates a validator that ensures competitive EV spreads do not exceed 510 total.
 *
 * @returns Validator function for an EV FormGroup
 */
export function evTotalValidator(): (control: AbstractControl) => ValidationErrors | null {
  return (control: AbstractControl): ValidationErrors | null => {
    const values = control.value as Record<string, number>;
    const total = Object.values(values).reduce((sum, v) => sum + Number(v ?? 0), 0);
    return total > 510 ? { evBudget: true } : null;
  };
}
