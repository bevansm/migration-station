import { Concat } from 'typescript-tuple';
/**
 * An UserRow represents the core information for a single user in a phpbb_user column.
 *
 * [user_id, username, username_clean, user_password, group_id, user_permissions, user_sig, user_sig_bbcode_uid, user_sig_bbcode_bitfield]
 */
export type UserRow = [
  number,
  string,
  string,
  string,
  number,
  string,
  string,
  string,
  string
];
/**
 * The state of a given topic, calculated by iterating over the posts.
 *
 * [topic_time, topic_first_post_id, topic_first_poster_name, topic_poster, topic_last_post_id, topic_last_poster_id, topic_last_poster_name, topic_last_post_subject, topic_last_post_time, topic_posts_approved]
 */
export type TopicStateData = [
  number,
  number,
  string,
  number,
  number,
  number,
  string,
  string,
  number,
  number
];
/**
 * A TopicRow encapsulates a topic on the forum (i.e. a thread)
 *
 * [topic_id,topic_type,forum_id,topic_title,topic_status,topic_visibility,...TopicStateData]
 */
export type TopicRow = Concat<
  [number, number, number, string, number, number],
  TopicStateData
>;
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
 * [post_id, topic_id, forum_id, poster_id, post_visibility, ...PostBodyData]
 */
export type PostRow = Concat<
  [number, number, number, number, number],
  PostBodyData
>;
/**
 * Encapsulated form state data.
 *
 * [forum_last_post_id,forum_last_poster_id,forum_last_post_subject,forum_last_post_time,forum_last_poster_name,forum_posts_approved, forum_topics_approved]
 */
type ForumStateData = [number, number, string, number, string, number, number];
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
