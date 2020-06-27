export class MigrationMaxError extends Error {
  public value: any;

  constructor(m: string, value: any) {
    super(m);
    this.message = m;
    this.value = value;
  }
}

export const DuplicateError = { type: 'duplicate' };
