import cheerio from 'cheerio';
import sqlstr from 'sqlstring';
import PHPBBClient from './PHPBBClient';
import { PHPBBCompatibilityUtils } from './Utils';
import PostParser from './parsers/PostParser';
import { MigrationMaxError, DuplicateError } from './Errors';
import BBCodeParser from './parsers/BBCodeParser';
import fs from 'fs';
import path from 'path';
import Forum, { forumToRow } from './model/Forum';
import Post, { postToRow, PostData } from './model/Post';
import Topic, { topicToRow } from './model/Topic';
import { UserRow, User, userToRow } from './model/User';
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
  outDir?: string;
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
  outDir: '',
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

  private users: Map<string, User>;
  private forums: Forum[];
  private topics: Topic[];
  private posts: Post[];

  private constructor(config: MigrationConfig) {
    this.config = { ...DefaultConfig, ...config };
    this.logger = Logger.get();
    this.client = config.client;
    this.users = new Map();
    this.postParser = new PostParser({}, this.config.forceEnableAllCodes);
    this.bbcodeParser = new BBCodeParser();
    this.forums = [];
    this.topics = [];
    this.posts = [];
  }

  // Creates a user row with the given username & pushes it to this.userRows
  private async createUser(username: string): Promise<User> {
    // You can use cheerio to scrape the old page for more information if needbe, and translate that into a user row.
    // const userPage = await this.client.get(
    //   `${this.from}memberlist.php?mode=viewprofile&un=${username}`
    // );
    const clean = PHPBBCompatibilityUtils.cleanUsername(username);
    if (this.users.has(clean)) return this.users.get(clean);
    const user_id = this.config.startUserId + this.users.size;
    const { uidbody, uid, bitfield } = this.bbcodeParser.parseBBCode(
      `[url=${this.config.from}memberlist.php?mode=viewprofile&un=${clean}]Check me out on my homesite![/url]`
    );
    this.logger.log(
      `Creating user ${username} with id ${user_id}`,
      LogLevel.VV
    );
    const user: User = {
      user_id,
      username,
      username_clean: this.config.tempUsers
        ? `_${clean}_${this.config.seed}`
        : clean,
      user_password: PHPBBCompatibilityUtils.uid(),
      group_id: 3,
      user_sig: uidbody,
      user_permissions: '',
      user_sig_bbcode_bitfield: bitfield,
      user_sig_bbcode_uid: uid,
    };
    this.users.set(clean, user);
    if (!(this.config.maxUsers - this.users.size))
      throw new MigrationMaxError(`Reached max users: ${this.config.maxUsers}`);
    return user;
  }

  private async loadPosts(
    fid: number,
    tid: number,
    start = 0
  ): Promise<string[]> {
    const qs = `viewtopic.php?f=${fid}&t=${tid}&start=${start}`;
    this.logger.log(`Grabbing posts from ${qs}`, LogLevel.VVV);
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

  // Parses the post data under the given topic given the html of a bbcode post.
  private async createPost(strPost: string, oldfid: number): Promise<PostData> {
    const post = this.config.parseUsingQuotePage
      ? await this.postParser.parseStringQuote(
          strPost,
          oldfid,
          this.config.from,
          this.config.client
        )
      : this.postParser.parseString(strPost);
    const {
      body: { uidbody, uid, bitfield },
      edits: {
        user: post_edit_user,
        reason: post_edit_reason,
        times: post_edit_count,
        timestamp: post_edit_time,
      },
      info: { user, subject, timestamp },
    } = post;
    const { user_id, username } = await this.createUser(user);
    return {
      poster_id: user_id,
      post_edit_user,
      post_edit_reason,
      post_edit_count,
      post_edit_time,
      post_visibility: 1,
      post_time: timestamp,
      post_username: username,
      post_subject: subject,
      post_text: uidbody,
      bbcode_bitfield: bitfield,
      bbcode_uid: uid,
    };
  }

  private async createTopic(
    oldfid: number,
    newfid: number,
    oldtid: number,
    newtid: number,
    title = '',
    sticky?: boolean,
    locked?: boolean
  ): Promise<Topic> {
    this.logger.log(`Creating topic f=${newfid} t=${newtid}`, LogLevel.VV);

    const inc = 25;
    let start = 0;
    let posts = await this.loadPosts(oldfid, oldtid, start);
    const processedPosts: Post[] = [];
    const pPostsSet = new Set();

    let tr: Topic;
    try {
      while (posts.length > 0) {
        if (posts.find(p => pPostsSet.has(p))) break;
        posts.forEach(p => pPostsSet.add(p));
        const data = await Promise.all(
          posts.map(p => this.createPost(p, oldfid))
        );
        const mappedPosts: Post[] = data.map((p, i) => ({
          ...p,
          post_id: i + this.posts.length + this.config.startPostId,
          forum_id: newfid,
          topic_id: newtid,
        }));
        this.posts.push(...mappedPosts);
        if (!(this.config.maxPosts - this.posts.length))
          throw new MigrationMaxError(
            `Reached max posts: ${this.config.maxPosts}`
          );
        start += inc;
        posts = await this.loadPosts(oldfid, oldtid, start);
        processedPosts.push(...mappedPosts);
      }
    } catch (e) {
      throw e;
    } finally {
      const sortedVisited = processedPosts.sort(
        (prev, cur) => prev.post_time - cur.post_time
      );
      const {
        post_time: topic_time,
        post_id: topic_first_post_id,
        poster_id: topic_poster,
        post_username: topic_first_poster_name,
      } = sortedVisited[0];
      const {
        post_time: topic_last_post_time,
        post_id: topic_last_post_id,
        poster_id: topic_last_poster_id,
        post_username: topic_last_poster_name,
        post_subject: topic_last_post_subject,
      } = sortedVisited.pop();
      tr = {
        topic_id: newtid,
        forum_id: newfid,
        topic_type: Number(sticky),
        topic_status: Number(locked),
        topic_visibility: 1,
        topic_time,
        topic_first_post_id,
        topic_first_poster_name,
        topic_poster,
        topic_last_post_time,
        topic_last_post_id,
        topic_last_poster_id,
        topic_last_poster_name,
        topic_last_post_subject,
        topic_title: title,
        topic_posts_approved: sortedVisited.length,
      };
      this.topics.push(tr);
      this.toFiles();
    }

    if (!(this.config.maxTopics - this.topics.length))
      throw new MigrationMaxError(`Max topics: ${this.config.maxTopics}`);
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

  private getTopicId(t: CheerioElement, $: CheerioStatic): number {
    return this.getId($(t).find('a.topictitle').attr('href'));
  }

  private async crawlForum(
    oldfid: number,
    fid: number,
    pid: number,
    lid: number,
    rid: number,
    iscat?: boolean
  ): Promise<Forum> {
    let start = 0;
    let $ = await this.loadForum(oldfid, start);
    let topics = this.getTopics($);
    const visitedOldTopics = new Set();
    const visitedTopics: Topic[] = [];
    let row: Forum;

    try {
      while (topics.length) {
        try {
          const pending = topics.map((rt, i) => {
            const t = $(rt);
            const tid = this.getTopicId(rt, $);
            if (visitedOldTopics.has(tid)) throw DuplicateError;
            visitedOldTopics.add(tid);
            return this.createTopic(
              oldfid,
              fid,
              tid,
              this.topics.length + this.config.startTopicId + i,
              t.find('a.topictitle').text(),
              t.hasClass('sticky'),
              t.find('dl.icon').attr('style').indexOf('_locked.gif') > -1
            );
          });
          visitedTopics.push(...(await Promise.all(pending)));
        } catch (e) {
          console.log(e);
          if (e === DuplicateError) break;
          throw e;
        }
        start += 25;
        $ = await this.loadForum(oldfid, start);
        topics = this.getTopics($).filter(
          t => !visitedOldTopics.has(this.getTopicId(t, $))
        );
      }
    } catch (e) {
      throw e;
    } finally {
      const {
        topic_last_post_id: forum_last_post_id,
        topic_last_post_subject: forum_last_post_subject,
        topic_last_post_time: forum_last_post_time,
        topic_last_poster_id: forum_last_poster_id,
        topic_last_poster_name: forum_last_poster_name,
      } = visitedTopics.reduce((pt, ct) =>
        pt.topic_last_post_time < ct.topic_last_post_time ? pt : ct
      );
      row = {
        forum_id: fid,
        parent_id: pid,
        left_id: lid,
        right_id: rid,
        forum_name: $('h2').text(),
        forum_type: Number(iscat),
        forum_desc: '',
        forum_parents: '',
        forum_flags: 48,
        forum_rules: '',
        forum_posts_approved: visitedTopics.reduce(
          (pt, ct) => pt + ct.topic_posts_approved,
          0
        ),
        forum_topics_approved: visitedTopics.length,
        forum_last_post_id,
        forum_last_poster_id,
        forum_last_poster_name,
        forum_last_post_subject,
        forum_last_post_time,
      };
      this.forums.push(row);
    }

    if (!(this.config.maxForums - this.forums.length))
      throw new MigrationMaxError(`Max forums: ${this.config.maxForums}`);

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
        this.forums.slice(-1)[0].forum_id + 1,
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
    let r = ({ forum_id: this.config.startForumId - 1 } as unknown) as Forum;
    try {
      for (const id of this.config.formIds) {
        const fid = r.forum_id + 1;
        r = await this.crawlForum(
          id,
          fid,
          this.config.rootForumId,
          r.forum_id,
          fid + 1,
          true
        );
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
    const userRows = Array.from(this.users.values()).map(userToRow);
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
    const forums = this.toSQLValues(this.forums.map(f => forumToRow(f)));
    return `INSERT INTO ${this.config.prefix}forums (forum_id, parent_id, left_id, right_id, forum_name, forum_type, forum_parents, forum_desc, forum_rules, forum_flags,forum_last_post_id,forum_last_poster_id,forum_last_poster_name,forum_last_post_subject,forum_last_post_time,forum_posts_approved, forum_topics_approved) 
    VALUES ${forums};`;
  }

  // Returns the SQL to create topics
  public getTopicSQL(): string {
    const topics = this.toSQLValues(this.topics.map(t => topicToRow(t)));
    return `INSERT INTO ${this.config.prefix}topics (topic_id,topic_type,forum_id,topic_title,topic_status,topic_visibility,topic_time, topic_first_post_id, topic_first_poster_name, topic_poster, topic_last_post_id, topic_last_poster_id, topic_last_poster_name, topic_last_post_subject, topic_last_post_time, topic_posts_approved)
    VALUES ${topics};`;
  }

  private getPostSQLPart(rows: Post[]): string {
    const posts = this.toSQLValues(rows.map(p => postToRow(p)));
    return `INSERT INTO ${this.config.prefix}posts (post_id,topic_id,forum_id,poster_id,post_visibility,post_time,post_username,post_edit_time,post_edit_count,post_edit_user,post_subject,post_text,bbcode_uid,bbcode_bitfield,post_edit_reason) 
    VALUES ${posts};`;
  }

  public getPostSQLPaginated(n: number = 2500): string[] {
    const prm: Post[][] = [];
    const tmp = [...this.posts];
    while (tmp.length) prm.push(tmp.splice(0, n));
    return prm.map(pr => this.getPostSQLPart(pr));
  }

  public getPostSQL(): string {
    return this.getPostSQLPart(this.posts);
  }

  public getPermissionsSQL(): string {
    const forumPermissions = this.forums
      .map(({ forum_id }) =>
        this.toSQLValues(
          DefaultForumPermissions.map(([gid, pid]) => [
            gid,
            forum_id,
            0,
            pid,
            0,
          ])
        )
      )
      .join(',\n');
    return `INSERT INTO ${this.config.prefix}acl_groups (group_id, forum_id, auth_option_id, auth_role_id, auth_setting) 
    VALUES ${forumPermissions};`;
  }

  public getStructureSQL(): string {
    return `${this.getPostSQL()}\n${this.getTopicSQL()}\n${this.getForumSQL()}\n${this.getPermissionsSQL()}`;
  }

  public toFiles(dir: string = this.config.outDir) {
    if (!dir) return;
    this.logger.log(
      {
        message: 'Saving/caching files...',
        users: this.users.size,
        topics: this.topics.length,
        forums: this.forums.length,
        posts: this.posts.length,
      },
      LogLevel.V
    );
    fs.writeFileSync(
      path.join(dir, 'dump.json'),
      JSON.stringify({ ...this.toJSON(), posts: [] })
    );
    fs.writeFileSync(
      path.join(dir, 'posts.json'),
      JSON.stringify({ posts: this.posts })
    );
    fs.writeFileSync(path.join(dir, 'users.sql'), this.getUserSQL());
    fs.writeFileSync(
      path.join(dir, 'structure.sql'),
      `${this.getForumSQL()}${this.getPermissionsSQL()}\n${this.getTopicSQL()}`
    );
    this.getPostSQLPaginated().forEach((pq, i) =>
      fs.writeFileSync(path.join(dir, `posts-${i + 1}.sql`), pq)
    );
    this.logger.log('Done cache.', LogLevel.V);
  }

  public toJSON(): {
    posts: Post[];
    topics: Topic[];
    forums: Forum[];
    users: User[];
  } {
    return {
      posts: this.posts,
      topics: this.topics,
      forums: this.forums,
      users: [...this.users.values()],
    };
  }

  public toString(): string {
    return JSON.stringify(this.toJSON());
  }
}

export default Migrator;
