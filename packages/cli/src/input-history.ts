export class InputHistory {
  private readonly entries: string[] = [];
  private historyIndex = -1;
  private draftBuf = '';

  /** Appends entry to history. Ignores empty strings and consecutive duplicates. */
  push(entry: string): void {
    if (!entry) return;
    if (this.entries.length > 0 && this.entries[this.entries.length - 1] === entry) return;
    this.entries.push(entry);
  }

  /**
   * Navigate backwards (older). On the first call, saves currentBuf as the
   * draft so it can be restored when navigating forward past the newest entry.
   * Returns the entry to display, or undefined if there are no entries or
   * the oldest entry has already been reached.
   */
  navigateBack(currentBuf: string): string | undefined {
    if (this.entries.length === 0) return undefined;
    if (this.historyIndex === -1) {
      this.draftBuf = currentBuf;
    }
    const nextIndex = this.historyIndex + 1;
    if (nextIndex >= this.entries.length) return undefined;
    this.historyIndex = nextIndex;
    return this.entries[this.entries.length - 1 - this.historyIndex];
  }

  /**
   * Navigate forwards (newer). When reaching the live position (index -1),
   * returns the saved draft. Returns undefined when already at the live
   * position with no unsaved draft.
   */
  navigateForward(): string | undefined {
    if (this.historyIndex === -1) return undefined;
    this.historyIndex -= 1;
    if (this.historyIndex === -1) {
      const draft = this.draftBuf;
      this.draftBuf = '';
      return draft;
    }
    return this.entries[this.entries.length - 1 - this.historyIndex];
  }

  /** Resets navigation cursor so the next browse starts from the newest entry. */
  reset(): void {
    this.historyIndex = -1;
    this.draftBuf = '';
  }

  /** True while the user is browsing history; false when at the live input position. */
  get isNavigating(): boolean {
    return this.historyIndex !== -1;
  }
}
