import { HTML2BBCode as H2B } from 'html2bbcode';
import cheerio from 'cheerio';
import shortid from 'shortid';
import Bitfield from './Bitfield';

interface PostBody {
  uid: string;
  bitfield: string;
  uidbody: string;
  htmlbody: string;
  bbcbody: string;
}

interface PostEdits {
  user: string;
  times: number;
  timestamp: number;
  reason: string;
}

interface PostInfo {
  subject: string;
  user: string;
  id: number;
  timestamp: number;
}

export interface Post {
  edits: PostEdits;
  info: PostInfo;
  body: PostBody;
}

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

class PostParser {
  private codes: { [key: string]: number };
  private parser: H2B;

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

  private genBitfield(idxs: number[]): string {
    const bitField = new Bitfield();
    [...new Set(idxs)].forEach(i => bitField.set(i));
    return bitField.toBase64();
  }

  private parsePostInfo(post: CheerioElement, $: CheerioStatic): PostInfo {
    const text = $(post).find('.author').text().split('»');
    const id = Number($(post).attr('id').substring(1));
    const user = text[0].trim().split('by').pop().trim();
    const timestamp = Date.parse(text[1].trim()) / 1000;
    const subject = $(post).find(`a[href="#p${id}"]`).text();
    return { id, user, timestamp, subject };
  }

  // Returns true if a string in the form of *** ends with t or t=***
  private endsWithTag(str: string, t: string): boolean {
    return (
      str.slice(-t.length) === t ||
      str.substring(0, str.lastIndexOf('=')).slice(-t.length) === t
    );
  }

  // Returns the string w/all tags replaced w/uuids, and a list of indexes corresponding to the opening tags
  private addTagUIDs(str: string, uid: string): [string, number[]] {
    const tis: number[] = [];
    return [
      str
        .split(']')
        .map(lb => {
          const codes = Object.keys(this.codes);
          const cs = codes.find(c => this.endsWithTag(lb, `[${c}`));
          if (cs) {
            tis.push(this.codes[cs]);
          } else {
            const ce = codes.find(c => this.endsWithTag(lb, `[/${c}`));
            if (!ce) return lb;
          }
          return `${lb}:${uid}`;
        })
        .join(']'),
      tis,
    ];
  }

  private parsePostBody(post: CheerioElement, $: CheerioStatic): PostBody {
    const uid = shortid.generate().toLowerCase().slice(-8);
    const htmlbody = $(post).find('div.content').html();
    const bbcbody = this.parser.feed(htmlbody).toString();
    const [uidbody, bidxs] = this.addTagUIDs(bbcbody, uid);
    const bitfield = this.genBitfield(bidxs);
    return {
      uid,
      htmlbody,
      bbcbody,
      uidbody,
      bitfield,
    };
  }

  private parsePostEdits(post: CheerioElement, $: CheerioStatic): PostEdits {
    const notice = $(post).find('div.notice');
    const user = notice.length ? $(notice).find('a').text() : '0';
    const timestamp = notice.length
      ? Date.parse(notice.text().split(' on ')[1].split(', edited')[0])
      : 0;
    const times = notice.length
      ? Number(notice.text().split(', edited ')[1].split(' ')[0])
      : 0;
    const reason = notice.length
      ? notice
          .text()
          .split('.')
          .slice(1)
          .join('.')
          .split(' ')
          .slice(1)
          .join(' ')
          .trim()
      : '';
    return {
      reason,
      times,
      timestamp,
      user,
    };
  }

  // Parses a raw HTML string w/ the outer post class
  public parseString(strPost: string): Post {
    const $ = cheerio.load(strPost);
    const elems = $('div.post');
    if (!elems.length)
      throw new Error('Given elem does not contain a phpbb post');
    return this.parse(elems[0], $);
  }

  // Parses a cheerio element w/ the wrapping post tag
  public parse(post: CheerioElement, $: CheerioStatic): Post {
    return {
      body: this.parsePostBody(post, $),
      edits: this.parsePostEdits(post, $),
      info: this.parsePostInfo(post, $),
    };
  }
}

export default PostParser;
