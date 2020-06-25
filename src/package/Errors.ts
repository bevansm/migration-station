import { UserRow, TopicRow, ForumRow, PostRow } from './SQLRows';

export class MigrationMaxError extends Error {
  private row: UserRow[] | PostRow[] | TopicRow[] | ForumRow[];

  constructor(m: string, row: any[]) {
    super(m);
    this.message = m;
    this.row = row;
  }
}
