import md5hex from 'md5hex';
import md5 from 'md5';

function cleanUsername(str: string): string {
  return str.toLowerCase();
}

// returns a uid of at most 16 characters
function uid(len: number = 12): string {
  return Math.random().toString(36).substr(2, len);
}

function hashPassword(password: string): string {
  // Todo: actually re-implement this, since rn it's just bogus
  return md5(password);
}

export const PHPBBCompatibilityUtils = {
  uid,
  hashPassword,
  cleanUsername,
};

export default { ...PHPBBCompatibilityUtils };
