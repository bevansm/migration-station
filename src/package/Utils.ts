function cleanUsername(str: string): string {
  return str.toLowerCase();
}

function hashBitfield(str: string): string {
  // TODO: dumb hashing :()
  return '';
}

export const PHPBBCompatibilityUtils = {
  hashBitfield,
  cleanUsername,
};

export default { ...PHPBBCompatibilityUtils };
