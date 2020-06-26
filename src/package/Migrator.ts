import cheerio from 'cheerio';
import sqlstr from 'sqlstring';
import PHPBBClient from './PHPBBClient';
import { PHPBBCompatibilityUtils } from './Utils';
import PostParser, { Post } from './parsers/PostParser';
import { MigrationMaxError } from './Errors';
import BBCodeParser from './parsers/BBCodeParser';
import {
  UserRow,
  ForumRow,
  TopicRow,
  PostRow,
  TopicStateData,
} from './SQLRows';
import Logger, { LogLevel } from './Logger';

/**
 * The default configuration for the migration class.
 */
export interface MigrationConfig {
  from: string;
  to: string;
  client: PHPBBClient;
  formIds?: number[];
  prefix?: string;
  seed?: number;
  parseUsingQuotePage?: boolean;
  forceEnableAllCodes?: boolean;
  startUserId?: number;
  startTopicId?: number;
  startPostId?: number;
  startForumId?: number;
  rootForumId?: number;
  maxUsers?: number;
  maxPosts?: number;
  maxTopics?: number;
  maxForums?: number;
  tempUsers?: boolean;
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
  seed: Math.floor(Math.random() * 1345),
  startUserId: 1,
  startTopicId: 1,
  startPostId: 1,
  startForumId: 1,
  rootForumId: 0,
  maxUsers: -1,
  maxPosts: -1,
  maxForums: -1,
  maxTopics: -1,
  parseUsingQuotePage: false,
  forceEnableAllCodes: false,
  tempUsers: false,
};

/**
 * A mapping of user group codes to standard permissions for a given forum.
 */
const DefaultForumPermissions: [number, number][] = [
  [1, 17],
  [2, 21],
  [3, 21],
  [4, 14],
  [4, 11],
  [5, 14],
  [5, 10],
  [6, 19],
];

class Migrator {
  private client: PHPBBClient;
  private logger: Logger;
  private postParser: PostParser;
  private bbcodeParser: BBCodeParser;
  private config: Required<MigrationConfig>;

  private users: Map<string, UserRow>;
  private forumRows: ForumRow[];
  private topicRows: TopicRow[];
  private postRows: PostRow[];

  private constructor(config: MigrationConfig) {
    this.config = { ...DefaultConfig, ...config };
    this.logger = Logger.get();
    this.client = config.client;
    this.users = new Map();
    this.postParser = new PostParser({}, this.config.forceEnableAllCodes);
    this.bbcodeParser = new BBCodeParser();
    this.forumRows = [];
    this.topicRows = [];
    this.postRows = [];
  }

  // Creates a user row with the given username & pushes it to this.userRows
  private async createUserRow(username: string): Promise<UserRow> {
    // You can use cheerio to scrape the old page for more information if needbe, and translate that into a user row.
    // const userPage = await this.client.get(
    //   `${this.from}memberlist.php?mode=viewprofile&un=${username}`
    // );
    const clean = PHPBBCompatibilityUtils.cleanUsername(username);
    if (this.users.has(clean)) return this.users.get(clean);
    const uid = this.config.startUserId + this.users.size;
    const { uidbody, uid: bbcuid, bitfield } = this.bbcodeParser.parse(
      `[url=${this.config.from}memberlist.php?mode=viewprofile&un=${clean}]Check me out on my homesite![/url]`
    );
    this.logger.log(`Creating user ${username} with id ${uid}`, LogLevel.VVV);
    const userRow: UserRow = [
      uid,
      username,
      this.config.tempUsers ? clean + this.config.seed : clean,
      PHPBBCompatibilityUtils.uid(),
      3,
      '',
      uidbody,
      bbcuid,
      bitfield,
    ];
    this.users.set(clean, userRow);
    if (!(this.config.maxUsers - this.users.size))
      throw new MigrationMaxError(
        `Reached max users: ${this.config.maxUsers}`,
        userRow
      );
    return userRow;
  }

  private async loadPosts(
    fid: number,
    tid: number,
    start = 0
  ): Promise<string[]> {
    const qs = `viewtopic.php?f=${fid}&t=${tid}&start=${start}`;
    this.logger.log(`Grabbing posts from ${qs}`, LogLevel.VV);
    const $ = await this.client
      .get(this.config.from + qs)
      .then(r => cheerio.load(r.data));
    return $('div.post')
      .toArray()
      .map(e => $.html(e));
  }

  private async loadForum(fid: number, start = 0): Promise<CheerioStatic> {
    const qs = `viewforum.php?f=${fid}&start=${start}`;
    this.logger.log(`Grabbing forums/topics from ${qs}`, LogLevel.V);
    return this.client
      .get(this.config.from + qs)
      .then(r => cheerio.load(r.data));
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

    let userId;
    let pr: PostRow;

    try {
      userId = (await this.createUserRow(user))[0];
    } catch (e) {
      throw e;
    } finally {
      const id = this.config.startPostId + this.postRows.length;
      this.logger.log(
        `Creating post f=${forumId} t=${topicId} p=${id} by ${userId}`,
        LogLevel.VVVV
      );
      pr = [
        id,
        topicId,
        forumId,
        userId,
        1,
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
    }

    if (!(this.config.maxPosts - this.postRows.length))
      throw new MigrationMaxError(
        `Reached max posts: ${this.config.maxPosts}`,
        pr
      );
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
    const tid = this.topicRows.length + this.config.startTopicId;

    this.logger.log(`Creating topic f=${newfid} t=${tid}`, LogLevel.VV);

    const inc = 25;
    const visitedPosts = new Set();
    let start = 0;
    let posts = await this.loadPosts(oldfid, oldtid, start);
    const postState = [];
    const startPostIdx = this.postRows.length;
    let tr: TopicRow;

    try {
      while (posts.length > 0) {
        const strPost = posts.pop();
        const post = this.config.parseUsingQuotePage
          ? await this.postParser.parseStringQuote(
              strPost,
              oldfid,
              this.config.from,
              this.config.client
            )
          : this.postParser.parseString(strPost);
        const {
          info: { id },
        } = post;

        if (visitedPosts.has(id)) break;
        visitedPosts.add(id);

        const tmpLastPost = await this.createPostRow(tid, newfid, post);
        if (startPostIdx === this.postRows.length - 1) {
          postState.push(
            tmpLastPost[5],
            tmpLastPost[0],
            tmpLastPost[6],
            tmpLastPost[3]
          );
        }
        if (posts.length === 0) {
          start += inc;
          posts = await this.loadPosts(oldfid, oldtid, start);
        }
      }
    } catch (e) {
      throw e;
    } finally {
      const lastPost = this.postRows.slice(-1)[0];
      postState.push(
        lastPost[0],
        lastPost[3],
        lastPost[6],
        lastPost[10],
        lastPost[5],
        this.postRows.length - startPostIdx
      );
      tr = [
        tid,
        Number(sticky),
        newfid,
        title,
        Number(locked),
        1,
        ...(postState as TopicStateData),
      ];
      this.topicRows.push(tr);
    }

    if (!(this.config.maxTopics - this.topicRows.length))
      throw new MigrationMaxError(
        `Reached max topics: ${this.config.maxTopics}`,
        tr
      );
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

    let topics = this.getTopics($);
    const visitedTopics = new Set();
    const prevPostIdx = this.postRows.length;
    let row: ForumRow;

    try {
      while (topics.length) {
        const t = $(topics.pop());
        const title = t.find('a.topictitle');
        const tid = this.getId(title.attr('href'));

        if (visitedTopics.has(tid)) break;
        visitedTopics.add(tid);

        const iSticky = t.hasClass('sticky');
        const isLocked =
          t.find('dl.icon').attr('style').indexOf('_locked.gif') > -1;
        await this.createTopic(
          oldfid,
          fid,
          tid,
          title.text(),
          iSticky,
          isLocked
        );
        if (!topics.length) {
          start += 25;
          $ = await this.loadForum(oldfid, start);
          topics = this.getTopics($);
        }
      }
    } catch (e) {
      throw e;
    } finally {
      const lastPost = this.postRows.slice(-1)[0];
      row = [
        fid,
        pid,
        lid,
        rid,
        $('h2').text(),
        Number(iscat),
        '',
        '',
        '',
        48,
        lastPost[0],
        lastPost[3],
        lastPost[10],
        lastPost[5],
        lastPost[6],
        this.postRows.length - prevPostIdx,
        visitedTopics.size,
      ];
      this.forumRows.push(row);
    }

    if (!(this.config.maxForums - this.forumRows.length))
      throw new MigrationMaxError(
        `Reached max forums: ${this.config.maxForums}`,
        row
      );

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
    // NOTE: This likely needs to be fixed (i.e. r/l logic) moving forwards.
    for (const [ofid, cat] of sfPending) {
      await this.crawlForum(
        ofid,
        this.forumRows.slice(-1)[0][0] + 1,
        fid,
        lid,
        lid + 1,
        cat
      );
    }

    return row;
  }

  private async init() {
    this.logger.log(
      `Preparing to parse forums starting from ${this.config.formIds}`,
      LogLevel.V
    );
    let r = ([this.config.startForumId - 1] as unknown[]) as ForumRow;
    try {
      for (const id of this.config.formIds) {
        if (!this.forumRows.find(x => x[0] === id)) {
          const fid = r[0] + 1;
          r = await this.crawlForum(
            id,
            fid,
            this.config.rootForumId,
            r[0],
            fid + 1,
            true
          );
        }
      }
    } catch (e) {
      this.logger.log(e.message, LogLevel.ALWAYS);
      if (!(e instanceof MigrationMaxError)) throw e;
    }
  }

  public static async GetMigrator(config: MigrationConfig): Promise<Migrator> {
    const migrator = new Migrator(config);
    await migrator.init();
    return migrator;
  }

  private toSQLValues<T extends any[]>(
    rows: T[],
    f: (v: T) => any[] = x => x
  ): string {
    return rows
      .map(f)
      .map(r => `(${sqlstr.escape(r)})`)
      .join(',\n');
  }

  public getUserSQL(): string {
    const userRows = Array.from(this.users.values());
    const users = this.toSQLValues(userRows, u => {
      const tmp: UserRow = u.slice() as UserRow;
      tmp[3] = PHPBBCompatibilityUtils.hashPassword(tmp[2]);
      return tmp;
    });
    const groups = this.toSQLValues(userRows, u => [2, u[0], 0]);
    const { prefix } = this.config;
    return `INSERT INTO ${prefix}users (user_id, username, username_clean, user_password, group_id, user_permissions, user_sig, user_sig_bbcode_uid, user_sig_bbcode_bitfield) VALUES ${users}; 
            INSERT INTO ${prefix}user_group (group_id, user_id, user_pending) VALUES ${groups};`;
  }

  public getUserPasswords(): string {
    throw new Error(
      'This feature has not been implemented, as we are not correctly hashing user passwords. Cheers!'
    );
  }

  // Returns the SQL to create forum structure
  public getForumSQL() {
    const forums = this.toSQLValues(this.forumRows);
    return `INSERT INTO ${this.config.prefix}forums (forum_id, parent_id, left_id, right_id, forum_name, forum_type, forum_parents, forum_desc, forum_rules, forum_flags,forum_last_post_id,forum_last_poster_id,forum_last_post_subject,forum_last_post_time,forum_last_poster_name,forum_posts_approved, forum_topics_approved) 
    VALUES ${forums};`;
  }

  // Returns the SQL to create topics
  public getTopicSQL(): string {
    const topics = this.toSQLValues(this.topicRows);
    return `INSERT INTO ${this.config.prefix}topics (topic_id,topic_type,forum_id,topic_title,topic_status,topic_visibility,topic_time, topic_first_post_id, topic_first_poster_name, topic_poster, topic_last_post_id, topic_last_poster_id, topic_last_poster_name, topic_last_post_subject, topic_last_post_time, topic_posts_approved)
    VALUES ${topics};`;
  }

  private getPostSQLPart(rows: PostRow[]): string {
    const posts = this.toSQLValues(rows);
    return `INSERT INTO ${this.config.prefix}posts (post_id,topic_id,forum_id,poster_id,post_visibility,post_time,post_username,post_edit_time,post_edit_count,post_edit_user,post_subject,post_text,bbcode_uid,bbcode_bitfield,post_edit_reason) 
    VALUES ${posts};`;
  }

  public getPostSQLPaginated(n: number = 2500): string[] {
    const prm: PostRow[][] = [];
    const tmp = [...this.postRows];
    while (tmp.length) prm.push(tmp.splice(0, n));
    return prm.map(pr => this.getPostSQLPart(pr));
  }

  public getPostSQL(): string {
    return this.getPostSQLPart(this.postRows);
  }

  public getPermissionsSQL(): string {
    const forumPermissions = this.forumRows
      .map(f =>
        this.toSQLValues(
          DefaultForumPermissions.map(([gid, pid]) => [gid, f[0], 0, pid, 0])
        )
      )
      .join(',\n');
    return `INSERT INTO ${this.config.prefix}acl_groups (group_id, forum_id, auth_option_id, auth_role_id, auth_setting) 
    VALUES ${forumPermissions};`;
  }

  public getStructureSQL(): string {
    return `${this.getPostSQL()}\n${this.getTopicSQL()}\n${this.getForumSQL()}\n${this.getPermissionsSQL()}`;
  }

  public toJSON(): {
    posts: PostRow[];
    topics: TopicRow[];
    forums: ForumRow[];
    users: UserRow[];
  } {
    return {
      posts: this.postRows,
      topics: this.topicRows,
      forums: this.forumRows,
      users: [...this.users.values()],
    };
  }

  public toString(): string {
    return JSON.stringify(this.toJSON());
  }
}

export default Migrator;
