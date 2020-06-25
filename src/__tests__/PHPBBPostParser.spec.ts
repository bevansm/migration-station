import fs from 'fs';
import path from 'path';
import PostParser from '../package/parsers/PostParser';

const readHtml = (name: string) =>
  fs.readFileSync(path.resolve(__dirname, `../../res/${name}.html`)).toString();

const writeJson = (name: string, o: any) =>
  fs.writeFileSync(
    path.resolve(__dirname, `../../res/${name}.json`),
    JSON.stringify(o)
  );

describe('PHPBBPostParser tests', () => {
  const parser = new PostParser();

  it('should correctly parse a post with basic tags', () => {
    const name = 'basic';
    const htmlPost = readHtml(name);
    const post = parser.parseString(htmlPost);
    writeJson(name, post);
    const {
      body: { bitfield },
      info: { id, user },
    } = post;
    expect(user).toBe('user');
    expect(id).toBe(3);
    expect(bitfield).toBe('QQ==');
  });

  it('should correctly parse a post with many tags', () => {
    const name = 'complex';
    const htmlPost = readHtml(name);
    const post = parser.parseString(htmlPost);
    writeJson(name, post);
    const {
      body: { bitfield },
      info: { id, user },
    } = post;
    expect(user).toBe('user');
    expect(bitfield).toBe('4IA=');
  });
});
