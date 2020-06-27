import he from 'he';
import Parser from './Parser';
import { PHPBBCompatibilityUtils } from '../Utils';

export interface ParsedBBCode {
  bitfield: string;
  uidbody: string;
  bbcbody: string;
  uid: string;
}

class BBCodeParser extends Parser {
  // Returns true if a string ends with a tag in the form [t or [t=***
  private endsWithTag(str: string, t: string): boolean {
    const splitByBracket = str.split('[');
    if (splitByBracket.length === 1) return false;
    const rawTag = splitByBracket.pop();
    return rawTag === t || rawTag.split('=')[0] === t;
  }

  public parseBBCode(bbcbody: string): ParsedBBCode {
    const uid = PHPBBCompatibilityUtils.uid(8);
    const [uidbody, bidxs] = this.addTagUIDs(bbcbody, uid);
    const bitfield = this.genBitfield(bidxs);
    return {
      uid,
      bbcbody,
      uidbody,
      bitfield,
    };
  }

  public parseHTML(body: string): ParsedBBCode {
    return this.parseBBCode(this.parser.feed(body).toString());
  }

  // Returns the string w/all tags replaced w/uuids, and a list of indexes corresponding to the opening tags
  private addTagUIDs(str: string, uid: string): [string, number[]] {
    const tis = new Set<number>();
    return [
      str
        .split(']')
        .map(lb => {
          const codes = Object.keys(this.codes);
          const cs = codes.find(c => this.endsWithTag(lb, `${c}`));
          if (cs) {
            tis.add(this.codes[cs]);
            return `${he.escape(lb)}:${uid}`;
          }
          const ce = codes.find(c => this.endsWithTag(lb, `/${c}`));
          return ce ? `${lb}:${uid}` : lb;
        })
        .join(']'),
      [...tis],
    ];
  }
}

export default BBCodeParser;
