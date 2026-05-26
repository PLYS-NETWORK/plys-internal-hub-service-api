export interface ITaskCodeAllocation {
  /** Per-project monotonically-increasing counter (never reused). */
  codeSeq: number;
  /** Human form `<projectCode>-<codeSeq>`. */
  code: string;
}

export interface ITaskCodeService {
  /**
   * Allocates the next `(code_seq, code)` pair for a project, atomically.
   * Implementation must hold a per-project advisory lock so concurrent
   * allocations on the same project serialise and never collide.
   *
   * @param projectId   The project to allocate within.
   * @param projectCode The owning project's `code` — used to format the human
   *                    form. Caller passes it instead of letting the service
   *                    re-read the project so this stays a single SQL trip.
   * @returns The next `codeSeq` and the formatted `code`.
   */
  next(projectId: string, projectCode: string): Promise<ITaskCodeAllocation>;
}
