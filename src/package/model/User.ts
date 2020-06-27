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

export interface User {
  user_id: number;
  username: string;
  username_clean: string;
  user_password: string;
  group_id: number;
  user_permissions: string;
  user_sig: string;
  user_sig_bbcode_uid: string;
  user_sig_bbcode_bitfield: string;
}

export function userToRow(user: User): UserRow {
  const {
    user_id,
    username,
    username_clean,
    user_password,
    group_id,
    user_permissions,
    user_sig,
    user_sig_bbcode_bitfield,
    user_sig_bbcode_uid,
  } = user;
  return [
    user_id,
    username,
    username_clean,
    user_password,
    group_id,
    user_permissions,
    user_sig,
    user_sig_bbcode_uid,
    user_sig_bbcode_bitfield,
  ];
}

export default User;
