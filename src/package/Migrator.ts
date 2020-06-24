import cheerio from 'cheerio';
import md5 from 'md5';
import { Concat } from 'typescript-tuple';

import PHPBBClient from './PHPBBClient';
import { PHPBBCompatibilityUtils } from './Utils';
import PostParser, { Post } from './PHPBBPostParser';

/**
 * An UserRow represents the core information for a single user in a phpbb_user column.
 *
 * [user_id, username, username_clean, user_password]
 */
type UserRow = [number, string, string, string];

/**
 * A TopicRow encapsulates a topic on the forum (i.e. a thread)
 *
 * [topic_id,topic_type,forum_id,topic_title,topic_status]
 */
type TopicRow = [number, number, number, string, number];

/**
 * Information of a post that can be extracted from an html post body.
 *
 * [post_time, post_username, post_edit_time, post_edit_count, post_edit_user, post_subject, post_text, bbcode_uid, bbcode_bitfield, post_edit_reason]
 */
type PostBodyData = [
  number,
  string,
  number,
  number,
  string,
  string,
  string,
  string,
  string,
  string
];

/**
 * A PostRow encapsulates a post on the forum.
 *
 * [post_id, topic_id, forum_id, poster_id, post_time, post_username, post_edit_time, post_edit_count, post_edit_user, post_subject, post_text, bbcode_uid, bbcode_bitfield, post_edit_reason]
 */
type PostRow = Concat<[number, number, number, number], PostBodyData>;

/**
 * A ForumRow encapsulates a subforum within the forum.
 *
 * [forum_id, parent_id, left_id, right_id, forum_name, forum_type]
 */
type ForumRow = [number, number, number, number, string, number];

/**
 * The default configuration for the migration class.
 */
interface MigrationConfig {
  from: string;
  to: string;
  client: PHPBBClient;
  formIds?: number[];
  prefix?: string;
  seed?: number;
  startUserId?: number;
  startTopicId?: number;
  startPostId?: number;
  startForumId?: number;
  rootForumId?: number;
  shouldLog?: boolean;
}

/**
 * The default configuration values for the migration class.
 */
const DefaultConfig: Required<MigrationConfig> = {
  from: '',
  to: '',
  client: null,
  formIds: [],
  prefix: 'phpbb_',
  seed: Math.random() * 12351325,
  startUserId: 1,
  startTopicId: 1,
  startPostId: 1,
  startForumId: 1,
  rootForumId: 0,
  shouldLog: true,
};

class Migrator {
  private client: PHPBBClient;
  private parser: PostParser;
  private shouldLog: boolean;

  private from: string;
  private formIds: number[];
  private seed: number;
  private prefix: string;

  private startPostId: number;
  private startTopicId: number;
  private startForumId: number;
  private rootForumId: number;
  private startUserId: number;

  private users: Map<string, UserRow>;
  private forumRows: ForumRow[];
  private topicRows: TopicRow[];
  private postRows: PostRow[];

  private constructor(config: MigrationConfig) {
    Object.assign(this, { ...DefaultConfig, ...config });
    this.users = new Map();
    this.parser = new PostParser();
    this.forumRows = [];
    this.topicRows = [];
    this.postRows = [];
  }

  private log(str: string) {
    if (this.shouldLog) console.log(`[${Date.now().toLocaleString()}] ${str}`);
  }

  private hashPassword(strSeed: string): string {
    return md5(`${strSeed}${this.seed}`);
  }

  // Creates a user row with the given username & pushes it to this.userRows
  private async createUserRow(username: string): Promise<UserRow> {
    // You can use cheerio to scrape the old page for more information if needbe, and translate that into a user row.
    // const userPage = await this.client.get(
    //   `${this.from}memberlist.php?mode=viewprofile&un=${username}`
    // );
    const clean = PHPBBCompatibilityUtils.cleanUsername(username);
    if (this.users.has(clean)) return this.users.get(clean);
    const uid = this.startUserId + this.users.size;
    this.log(`Creating user ${username} with id ${uid}`);
    const userRow: UserRow = [
      uid,
      username,
      clean,
      `${Math.random() * 100000000}`,
    ];
    this.users.set(clean, userRow);
    return userRow;
  }

  private async loadPosts(
    fid: number,
    tid: number,
    start = 0
  ): Promise<string[]> {
    const qs = `viewtopic.php?f=${fid}&t=${tid}&start=${start}`;
    this.log(`Grabbing posts from ${qs}`);
    const $ = await this.client
      .get(this.from + qs)
      .then(r => cheerio.load(r.data));
    return $('div.post')
      .toArray()
      .map(e => $.html(e));
  }

  private async loadForum(fid: number, start = 0): Promise<CheerioStatic> {
    const qs = `viewforum.php?f=${fid}&start=${start}`;
    this.log(`Grabbing forums/topics from ${qs}`);
    return this.client.get(this.from + qs).then(r => cheerio.load(r.data));
  }

  // Creates a post row under the given topic given the html of a bbcode post.
  private async createPostRow(
    topicId: number,
    forumId: number,
    post: Post
  ): Promise<PostRow> {
    const {
      body: { uidbody, uid, bitfield },
      edits: {
        user: editUser,
        reason: editReason,
        times: editTimes,
        timestamp: editTimestamp,
      },
      info: { user, subject, timestamp },
    } = post;
    const userId = (await this.createUserRow(user))[0];
    const id = this.startPostId + this.postRows.length;

    this.log(`Creating post f=${forumId} t=${topicId} p=${id} by ${userId}`);
    const pr: PostRow = [
      id,
      topicId,
      forumId,
      userId,
      timestamp,
      user,
      editTimestamp,
      editTimes,
      editUser,
      subject,
      uidbody,
      uid,
      bitfield,
      editReason,
    ];
    this.postRows.push(pr);
    return pr;
  }

  private async createTopic(
    oldfid: number,
    newfid: number,
    oldtid: number,
    title = '',
    sticky?: boolean,
    locked?: boolean
  ): Promise<TopicRow> {
    const tid = this.topicRows.length + this.startTopicId;

    this.log(`Creating topic f=${newfid} t=${tid}`);
    const tr: TopicRow = [tid, Number(sticky), newfid, title, Number(locked)];
    this.topicRows.push(tr);

    const inc = 25;
    const visitedPosts = new Set();
    let start = 0;
    let posts = await this.loadPosts(oldfid, oldtid, start);
    while (posts.length > 0) {
      const post = this.parser.parseString(posts.pop());
      const {
        info: { id },
      } = post;

      if (visitedPosts.has(id)) break;
      visitedPosts.add(id);

      await this.createPostRow(tid, newfid, post);
      if (posts.length === 0) {
        start += inc;
        posts = await this.loadPosts(oldfid, oldtid, start);
      }
    }

    return tr;
  }

  private getTopics($: CheerioStatic): CheerioElement[] {
    return $('div[class="forumbg"] ul[class="topiclist topics"]')
      .find('li')
      .toArray();
  }

  private getId(str: string): number {
    return Number(str.split('=').pop());
  }

  private async crawlForum(
    oldfid: number,
    fid: number,
    pid: number,
    lid: number,
    rid: number,
    iscat?: boolean
  ): Promise<ForumRow> {
    let start = 0;
    let $ = await this.loadForum(oldfid, start);
    const row: ForumRow = [fid, pid, lid, rid, $('h2').text(), Number(iscat)];
    this.forumRows.push(row);

    const subforums = $('div.forabg').toArray();
    const sfPending: [number, boolean][] = [];
    for (const f of subforums) {
      const catHref = ($(f).find('dt a') || { attr: () => '' }).attr('href');
      catHref
        ? sfPending.push([this.getId(catHref), true])
        : $(f)
            .find('a.forumtitle')
            .toArray()
            .forEach(e =>
              sfPending.push([this.getId($(e).attr('href')), false])
            );
    }
    for (const [ofid, cat] of sfPending) {
      // TODO: figure out the left ids better :(
      await this.crawlForum(
        ofid,
        this.forumRows.slice(-1)[0][0] + 1,
        fid,
        lid,
        lid + 1,
        cat
      );
    }

    let topics = this.getTopics($);
    const visitedTopics = new Set();
    while (topics.length) {
      const t = $(topics.pop());
      const title = t.find('a.topictitle');
      const tid = this.getId(title.attr('href'));

      if (visitedTopics.has(tid)) break;
      visitedTopics.add(tid);

      const iSticky = t.hasClass('sticky');
      const isLocked =
        t.find('dl.icon').attr('style').indexOf('_locked.gif') > -1;
      await this.createTopic(oldfid, fid, tid, title.text(), iSticky, isLocked);
      if (!topics.length) {
        start += 25;
        $ = await this.loadForum(oldfid, start);
        topics = this.getTopics($);
      }
    }

    return row;
  }

  private async init() {
    this.log(`Preparing to parse forums starting from ${this.formIds}`);
    let r = ([this.startForumId] as unknown) as ForumRow;
    for (const id of this.formIds) {
      if (!this.forumRows.find(x => x[0] === id)) {
        const fid = this.forumRows.length
          ? this.forumRows.slice(-1)[0][0] + 1
          : this.startForumId;
        r = await this.crawlForum(id, fid, this.rootForumId, r[0], fid, true);
      }
    }
  }

  public static async GetMigrator(config: MigrationConfig): Promise<Migrator> {
    const migrator = new Migrator(config);
    await migrator.init();
    return migrator;
  }

  private toSQLString(r: any[]): string {
    return `(${r.map(s => (s instanceof Number ? s : `'${s}'`)).join(', ')})`;
  }

  private toSQLValues<T extends any[]>(
    rows: T[],
    f: (v: T) => any[] = x => x
  ): string {
    return rows.map(f).map(this.toSQLString).join(',\n');
  }

  public getUserSQL(): string {
    const userRows = Array.from(this.users.values());
    const users = this.toSQLValues(userRows, u => {
      const tmp: UserRow = u.slice() as UserRow;
      tmp[3] = this.hashPassword(tmp[2]);
      return tmp;
    });
    const groups = this.toSQLValues(userRows, u => [2, u[0], 0]);
    return `INSERT INTO ${this.prefix}users (user_id, username, username_clean, user_password) VALUES ${users}; 
            INSERT INTO ${this.prefix}user_group (group_id, user_id, user_pending) VALUES ${groups};`;
  }

  public getUserPasswords(): string {
    return Array.from(this.users.values())
      .map(r => `${r[1]},${r[3]}`)
      .join('\n');
  }

  // Returns the SQL to create forum structure
  private getForumSQL() {
    const forums = this.toSQLValues(this.forumRows);
    // TODO: some union magic to get this working cleanly
    return this.forumRows.toString();
  }

  // Returns the SQL to create topics
  private getTopicSQL(): string {
    const topics = this.toSQLValues(this.topicRows);
    // TODO:
    return this.topicRows.toString();
  }

  private getPostSQL(): string {
    const posts = this.toSQLValues(this.postRows);
    // TODO:
    return this.postRows.toString();
  }

  public getStructureSQL(): string {
    return `${this.getPostSQL()}
            ${this.getTopicSQL()}
            ${this.getForumSQL()}`;
  }

  public toString(): string {
    return JSON.stringify({
      posts: this.postRows,
      topics: this.topicRows,
      forums: this.forumRows,
      users: this.users.values(),
    });
  }
}

export default Migrator;
