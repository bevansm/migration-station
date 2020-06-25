export class MigrationMaxError extends Error {
  constructor(m: string) {
    super(m);
    this.message = m;
  }
}
