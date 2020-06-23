// Bitfield implementation based upon https://www.phpbb.com/support/docs/en/3.2/kb/article/how-to-template-bitfield-and-bbcodes
class Bitfield {
  private data: number[];

  constructor() {
    this.data = new Array<number>(10);
  }

  public set(n: number) {
    const i = Math.floor(n / 8);
    // tslint:disable: no-bitwise
    this.data[i] = this.data[i] | (1 << (7 - (n % 8)));
  }

  public toBase64() {
    const i = this.data.reverse().findIndex(Boolean);
    const arr = i === -1 ? [] : this.data.slice(0, this.data.length - i);
    return btoa(arr.join(''));
  }
}
