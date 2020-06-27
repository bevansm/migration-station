import { Concat } from 'typescript-tuple';

export interface Topic {
  topic_id: number;
  topic_type: number;
  forum_id: number;
  topic_title: string;
  topic_status: number;
  topic_visibility: number;
  topic_time: number;
  topic_first_post_id: number;
  topic_first_poster_name: string;
  topic_poster: number;
  topic_last_post_id: number;
  topic_last_poster_id: number;
  topic_last_poster_name: string;
  topic_last_post_subject: string;
  topic_last_post_time: number;
  topic_posts_approved: number;
}
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

export function topicToRow(topic: Topic): TopicRow {
  const {
    topic_id,
    topic_type,
    forum_id,
    topic_title,
    topic_status,
    topic_visibility,
    topic_time,
    topic_first_post_id,
    topic_first_poster_name,
    topic_poster,
    topic_last_post_id,
    topic_last_poster_id,
    topic_last_poster_name,
    topic_last_post_subject,
    topic_last_post_time,
    topic_posts_approved,
  } = topic;
  return [
    topic_id,
    topic_type,
    forum_id,
    topic_title,
    topic_status,
    topic_visibility,
    topic_time,
    topic_first_post_id,
    topic_first_poster_name,
    topic_poster,
    topic_last_post_id,
    topic_last_poster_id,
    topic_last_poster_name,
    topic_last_post_subject,
    topic_last_post_time,
    topic_posts_approved,
  ];
}

export default Topic;
