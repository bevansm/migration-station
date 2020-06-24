// Bitfield implementation based upon https://www.phpbb.com/support/docs/en/3.2/kb/article/how-to-template-bitfield-and-bbcodes
class Bitfield {
  private data: number[];

  constructor() {
    this.data = new Array(10).fill(0);
  }

  public set(n: number) {
    const i = Math.floor(n / 8);
    const d = n % 8;
    // tslint:disable: no-bitwise
    this.data[i] |= 1 << (7 - d);
  }

  public toBase64() {
    return Buffer.from(
      this.data
        .map(c => String.fromCharCode(c))
        .join('')
        .replace(/\0+$/, '')
    ).toString('base64');
  }
}
export default Bitfield;
