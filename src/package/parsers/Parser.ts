import { HTML2BBCode as H2B } from 'html2bbcode';
import Bitfield from '../Bitfield';

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

class Parser {
  protected codes: { [key: string]: number };
  protected parser: H2B;

  /**
   * Initializes the parser w/ the bbcode tags from the forms.
   * Given tages should be a port of the bbcode table config,
   *  where the key is the tag sans "=", key value is the bbcode_id.
   * @param bbcodes
   */
  constructor(bbcodes: { [key: string]: number } = {}) {
    this.codes = { ...defaultTags, ...bbcodes };
    this.parser = new H2B();
  }

  protected genBitfield(idxs: number[]): string {
    const bitField = new Bitfield();
    [...new Set(idxs)].forEach(i => bitField.set(i));
    return bitField.toBase64();
  }
}

export default Parser;
