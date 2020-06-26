import Parser from './Parser';

export interface ParsedBBCode {
  bitfield: string;
  uidbody: string;
  bbcbody: string;
  uid: string;
}

class BBCodeParser extends Parser {
  // Returns true if a string in the form of *** ends with t or t=***
  private endsWithTag(str: string, t: string): boolean {
    return (
      str.slice(-t.length) === t ||
      `[${str
        .split('[')
        .pop()
        .slice(0, t.length - 1)}` === t
    );
  }

  public parse(body: string): ParsedBBCode {
    const uid = this.genUID();
    const bbcbody = this.parser.feed(body).toString();
    const [uidbody, bidxs] = this.addTagUIDs(bbcbody, uid);
    const bitfield = this.genBitfield(bidxs);
    console.log(bidxs, bitfield);

    return {
      uid,
      bbcbody,
      uidbody,
      bitfield,
    };
  }

  private genUID() {
    return Math.random().toString(36).substr(2, 8);
  }

  // Returns the string w/all tags replaced w/uuids, and a list of indexes corresponding to the opening tags
  private addTagUIDs(str: string, uid: string): [string, number[]] {
    const tis = new Set<number>();
    return [
      str
        .split(']')
        .map(lb => {
          const codes = Object.keys(this.codes);
          const cs = codes.find(c => this.endsWithTag(lb, `[${c}`));
          if (cs) {
            tis.add(this.codes[cs]);
          } else {
            const ce = codes.find(c => this.endsWithTag(lb, `[/${c}`));
            if (!ce) return lb;
          }
          return `${lb}:${uid}`;
        })
        .join(']'),
      [...tis],
    ];
  }
}

export default BBCodeParser;
