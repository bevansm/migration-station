/**
 * Information of a post that can be extracted from an html post body.
 *
 * [poster_id, post_visibility, post_time, post_username, post_edit_time, post_edit_count, post_edit_user, post_subject, post_text, bbcode_uid, bbcode_bitfield, post_edit_reason]
 */

import { Concat } from 'typescript-tuple';

export type PostBodyData = [
  number,
  number,
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
 * [post_id, topic_id, forum_id, ...PostBodyData]
 */
export type PostRow = Concat<[number, number, number], PostBodyData>;

export interface PostData {
  poster_id: number;
  post_visibility: number;
  post_time: number;
  post_username: string;
  post_edit_time: number;
  post_edit_count: number;
  post_edit_user: string;
  post_subject: string;
  post_text: string;
  bbcode_uid: string;
  bbcode_bitfield: string;
  post_edit_reason: string;
}

export interface Post extends PostData {
  post_id: number;
  topic_id: number;
  forum_id: number;
}

export function postToRow(post: Post): PostRow {
  const {
    post_id,
    topic_id,
    forum_id,
    poster_id,
    post_visibility,
    post_time,
    post_username,
    post_edit_time,
    post_edit_count,
    post_edit_user,
    post_subject,
    post_text,
    bbcode_uid,
    bbcode_bitfield,
    post_edit_reason,
  } = post;
  return [
    post_id,
    topic_id,
    forum_id,
    poster_id,
    post_visibility,
    post_time,
    post_username,
    post_edit_time,
    post_edit_count,
    post_edit_user,
    post_subject,
    post_text,
    bbcode_uid,
    bbcode_bitfield,
    post_edit_reason,
  ];
}

export default Post;
