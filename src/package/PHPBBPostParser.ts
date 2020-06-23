import { HTML2BBCode as H2B } from 'html2bbcode';
import cheerio from 'cheerio';
import shortid from 'shortid';

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

interface Post {
  edits: PostEdits;
  info: PostInfo;
  body: PostBody;
}

const defaultTags = [
  'quote',
  'b',
  'i',
  'url',
  'img',
  'size',
  'color',
  'u',
  'code',
  'list',
  'email',
  'flash',
  'attachment',
];

class PostParser {
  private codes: string[];
  private parser: H2B;

  constructor(bbcodes: string[] = defaultTags) {
    this.codes = Object.keys(bbcodes);
    this.parser = new H2B();
  }

  private replaceTag(s: string, tagContents: string, newContents = '') {
    const newStart = newContents ? `[${newContents}` : newContents;
    const newEnd = newContents ? `[/${newContents}` : newContents;
    return s
      .replace(`[${tagContents}`, newStart)
      .replace(`[/${tagContents}`, newEnd);
  }

  private genBitfield(s: string): string {
    const bitField = new Bitfield();
    this.codes.forEach((c, i) => s.indexOf(`[${c}]`) > -1 && bitField.set(i));
    return bitField.toBase64();
  }

  private parsePostInfo(post: CheerioElement, $: CheerioStatic): PostInfo {
    const text = $(post).find('.author').text().split('»');
    const id = Number($(post).attr('id').substring(1));
    const user = text[0].trim().split('by').pop().trim();
    const timestamp = Date.parse(text[1].trim());
    const subject = $(post).find(`a[href="#p${id}"]`).text();
    return { id, user, timestamp, subject };
  }

  private parsePostBody(post: CheerioElement, $: CheerioStatic): PostBody {
    const uid = shortid.generate().toLowerCase();
    const htmlbody = $(post).find('div.content').html();
    const bbcbody = this.parser
      .feed(this.codes.reduce((s, c) => this.replaceTag(s, c), htmlbody))
      .toString();
    const uidbody = this.codes.reduce(
      (s, c) => this.replaceTag(s, c, `${c}:${uid}`),
      bbcbody
    );
    return {
      uid,
      htmlbody,
      bbcbody,
      uidbody,
      bitfield: this.genBitfield(bbcbody),
    };
  }

  private parsePostEdits(post: CheerioElement, $: CheerioStatic): PostEdits {
    const notice = $(post).find('div.notice');
    const user = notice.length ? $(notice).find('a').text() : '';
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
