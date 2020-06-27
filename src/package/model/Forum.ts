import { Concat } from 'typescript-tuple';

/**
 * Encapsulated form state data.
 *
 * [forum_last_post_id,forum_last_poster_id,forum_last_poster_name,forum_last_post_subject,forum_last_post_time,forum_posts_approved, forum_topics_approved]
 */
type ForumStateData = [number, number, string, string, number, number, number];
/**
 * A ForumRow encapsulates a subforum within the forum.
 *
 * [forum_id, parent_id, left_id, right_id, forum_name, forum_type, forum_parents, forum_desc, forum_rules, forum_flags, ...ForumStateData]
 */
export type ForumRow = Concat<
  [
    number,
    number,
    number,
    number,
    string,
    number,
    string,
    string,
    string,
    number
  ],
  ForumStateData
>;

export interface Forum {
  forum_id: number;
  parent_id: number;
  left_id: number;
  right_id: number;
  forum_name: string;
  forum_type: number;
  forum_parents: string;
  forum_desc: string;
  forum_rules: string;
  forum_flags: number;
  forum_last_post_id: number;
  forum_last_poster_id: number;
  forum_last_poster_name: string;
  forum_last_post_subject: string;
  forum_last_post_time: number;
  forum_posts_approved: number;
  forum_topics_approved: number;
}

export function forumToRow(forum: Forum): ForumRow {
  const {
    forum_id,
    parent_id,
    left_id,
    right_id,
    forum_name,
    forum_type,
    forum_parents,
    forum_desc,
    forum_rules,
    forum_flags,
    forum_last_post_id,
    forum_last_poster_id,
    forum_last_poster_name,
    forum_last_post_subject,
    forum_last_post_time,
    forum_posts_approved,
    forum_topics_approved,
  } = forum;
  return [
    forum_id,
    parent_id,
    left_id,
    right_id,
    forum_name,
    forum_type,
    forum_parents,
    forum_desc,
    forum_rules,
    forum_flags,
    forum_last_post_id,
    forum_last_poster_id,
    forum_last_poster_name,
    forum_last_post_subject,
    forum_last_post_time,
    forum_posts_approved,
    forum_topics_approved,
  ];
}

export default Forum;
