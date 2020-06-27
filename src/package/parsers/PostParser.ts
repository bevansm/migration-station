import cheerio from 'cheerio';
import PHPBBClient from '../PHPBBClient';
import Parser from './Parser';
import BBCodeParser, { ParsedBBCode } from './BBCodeParser';

type PostBody = {
  htmlbody: string;
} & ParsedBBCode;

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

class PostParser extends Parser {
  private bbcodeParser: BBCodeParser;

  constructor(
    bbcodes: { [key: string]: number } = {},
    forceAllCodes?: boolean
  ) {
    super(bbcodes);
    this.bbcodeParser = new BBCodeParser(bbcodes, forceAllCodes);
  }

  private parsePostInfo(post: CheerioElement, $: CheerioStatic): PostInfo {
    const text = $(post).find('.author').text().split('»');
    const id = Number($(post).attr('id').substring(1));
    const user = text[0].trim().split(' ').pop().trim();
    const timestamp = Date.parse(text[1].trim()) / 1000;
    const subject = $(post).find(`a[href="#p${id}"]`).text();
    return { id, user, timestamp, subject };
  }

  private parsePostBody(post: CheerioElement, $: CheerioStatic): PostBody {
    const htmlbody = $(post).find('div.content').html();
    return {
      htmlbody,
      ...this.bbcodeParser.parseHTML(htmlbody),
    };
  }

  private parseFromTextArea(page: string): PostBody {
    const textarea = cheerio.load(page)('textarea').text();
    const body = textarea.slice(textarea.indexOf(']') + 1).slice(0, -9);
    return {
      htmlbody: body,
      ...this.bbcodeParser.parseBBCode(body),
    };
  }

  private parsePostEdits(post: CheerioElement, $: CheerioStatic): PostEdits {
    const notice = $(post).find('div.notice');
    const user = '0';
    const timestamp = notice.length
      ? Date.parse(notice.text().split(' on ')[1].split(', edited')[0]) / 1000
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

  private async getAndParseQuoteBody(
    id: number,
    fid: number,
    baseUrl: string,
    client: PHPBBClient
  ): Promise<PostBody> {
    const quotePage: string = await client
      .get(`${baseUrl}posting.php?mode=quote&f=${fid}&p=${id}`)
      .then(r => r.data);
    return (
      quotePage.indexOf('<h2>Information</h2>') === -1 &&
      this.parseFromTextArea(quotePage)
    );
  }

  // Parses the given string & calls out to query the raw bbcode of the post for ultimate bbcode compatabilitiy
  public async parseStringQuote(
    strPost: string,
    fid: number,
    baseUrl: string,
    client: PHPBBClient
  ): Promise<Post> {
    const $ = cheerio.load(strPost);
    const elems = $('div.post');
    if (!elems.length)
      throw new Error('Given elem does not contain a phpbb post');
    const info = this.parsePostInfo(elems[0], $);
    const edits = this.parsePostEdits(elems[0], $);
    return {
      info,
      edits,
      body:
        (await this.getAndParseQuoteBody(info.id, fid, baseUrl, client)) ||
        this.parsePostBody(elems[0], $),
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
