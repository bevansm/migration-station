import btoa from 'btoa';

// Bitfield implementation based upon https://www.phpbb.com/support/docs/en/3.2/kb/article/how-to-template-bitfield-and-bbcodes
class Bitfield {
  private data: number[];

  constructor() {
    this.data = new Array(30).fill(0);
  }

  public set(n: number) {
    const i = Math.floor(n / 8);
    const d = n % 8;
    const diff = i + 1 - this.data.length;
    if (diff > 0) this.data = this.data.concat(new Array(diff).fill(0));
    // tslint:disable: no-bitwise
    this.data[i] |= 1 << (7 - d);
  }

  public toBase64() {
    return btoa(
      this.data
        .map(c => String.fromCharCode(c))
        .filter(c => c !== '\x00')
        .join('')
    );
  }
}
export default Bitfield;
