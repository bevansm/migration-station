-- This SQL query merges the second user with the first.
-- This will only update unique things associated with the user (posts, topics), not their bookmarks
-- It will also update view logs and the like.
-- We keep the permissions of the destination account, so please keep that in mind.
DELIMITER
//
CREATE PROCEDURE merge_users(
    new_id int,
    old_id int)
BEGIN
    SET @new_unc = '';
    SET @new_un = '';
    SET @new_clr = '';

    SELECT username_clean, username, user_colour
    INTO
@new_unc, @new_un, @new_clr
FROM phpbb_users
WHERE user_id = new_id;

UPDATE phpbb_attachments SET poster_id = new_id WHERE poster_id = old_id;
UPDATE phpbb_forums 
    SET forum_last_poster_id = new_id,
        forum_last_poster_name = @new_un,
        forum_last_poster_colour = @t_clr
    WHERE forum_last_poster_id = old_id;

UPDATE phpbb_forums_access SET user_id = new_id WHERE user_id = old_id;
UPDATE phpbb_login_attempts 
    SET user_id = new_id, 
        username = @new_un,
        username_clean = @new_unc
    WHERE user_id = old_id;

DELETE FROM phpbb_poll_votes WHERE vote_user_id = old_id
    AND (SELECT COUNT(*)
    FROM phpbb_poll_votes
    WHERE vote_user_id = new_id) = 1;
UPDATE phpbb_poll_votes SET vote_user_id = new_id WHERE vote_user_id = old_id;

UPDATE phpbb_posts SET poster_id = new_id, post_username = @new_un WHERE poster_id = old_id;
UPDATE phpbb_topics
    SET topic_poster = new_id, 
        topic_first_poster_name = @new_un,
        topic_first_poster_colour = @t_clr
    WHERE topic_poster = old_id;
UPDATE phpbb_topics
    SET topic_last_poster_id = new_id,
        topic_last_poster_name = @new_un,
        topic_last_poster_colour = @t_clr
    WHERE topic_last_poster_id = old_id;

UPDATE phpbb_topics_posted SET user_id = new_id WHERE user_id = old_id;
UPDATE phpbb_warnings SET user_id = new_id WHERE user_id = old_id;

DELETE FROM phpbb_users WHERE user_id = old_id;
END
//
DELIMITER ;