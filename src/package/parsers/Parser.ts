import { HTML2BBCode as H2B } from 'html2bbcode';
import Bitfield from './Bitfield';

const defaultTags = {
  code: 8,
  quote: 0,
  attachment: 12,
  b: 1,
  i: 2,
  url: 3,
  img: 4,
  size: 5,
  color: 6,
  u: 7,
  list: 9,
  email: 10,
  flash: 11,
};

const commonTags = {
  simg: 13,
  youtube: 14,
  font: 16,
  spoiler: 27,
  center: 18,
  right: 19,
  s: 26,
};

class Parser {
  protected codes: { [key: string]: number };
  protected forceAllCodes: boolean;
  protected parser: H2B;

  /**
   * Initializes the parser w/ the bbcode tags from the forms.
   * Given tages should be a port of the bbcode table config,
   *  where the key is the tag sans "=", key value is the bbcode_id.
   * @param bbcodes
   */
  constructor(
    bbcodes: { [key: string]: number } = {},
    forceAllCodes: boolean = false
  ) {
    this.codes = { ...defaultTags, ...commonTags, ...bbcodes };
    this.forceAllCodes = forceAllCodes;
    this.parser = new H2B();
  }

  protected genBitfield(idxs: number[]): string {
    if (!idxs.length) return '';
    const bitField = new Bitfield();
    if (this.forceAllCodes) {
      const maxCode = Math.max(...Object.values(this.codes));
      for (let i = 0; i <= maxCode; i++) bitField.set(i);
    } else {
      [...new Set(idxs)].forEach(i => bitField.set(i));
    }
    return bitField.toBase64();
  }
}

export default Parser;
