declare module 'md5hex' {
  export interface MD5HexOptions {
    salt?: string;
    saltPrefix?: string;
    length?: number;
  }

  function md5hex(str: string, options?: MD5HexOptions | number): string;
  export default md5hex;
}
