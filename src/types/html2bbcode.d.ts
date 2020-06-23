declare module 'html2bbcode' {
  export interface HTML2BBCodeOptions {
    // enable image scale, default: false
    imagescale?: boolean;
    // enable transform pixel size to size 1-7, default: false
    transsize?: boolean;
    // disable list <ul> <ol> <li> support, default: false
    nolist?: boolean;
    // disable text-align center support, default: false
    noalign?: boolean;
    // disable HTML headings support, transform to size, default: false
    noheadings?: boolean;
  }

  export class HTML2BBCode {
    constructor(options?: HTML2BBCodeOptions);
    public feed(data: string): { toString: () => string };
  }
}
