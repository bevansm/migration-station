import { ForumRow } from './model/Forum';
import { PostRow } from "./model/Post";
import { TopicRow } from "./model/Topic";
import { UserRow } from "./model/User";

export class MigrationMaxError extends Error {
  public row: UserRow[] | PostRow[] | TopicRow[] | ForumRow[];
  constructor(m: string, row: any[] = []) {
    super(m);
    this.message = m;
    this.row = row;
  }
}

export const DuplicateError = { type: 'duplicate' };
