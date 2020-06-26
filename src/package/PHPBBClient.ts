import { CookieJar } from 'tough-cookie';
import { FileCookieStore } from 'tough-cookie-file-store';
import FormData from 'form-data';
import cheerio from 'cheerio';
import AXIOS, { AxiosResponse, AxiosInstance } from 'axios';
import axiosCookieJarSupport from 'axios-cookiejar-support';
import Logger, { LogLevel } from './Logger';

interface HiddenInputs {
  form_token?: string;
  last_click?: string;
  status_switch?: number;
  creation_time?: string;
  to?: number[];
  bcc?: number[];
}

/**
 * A wrapper to manage cookies for accessing a PHPBB board.
 */
class PHPBBClient {
  private jar: CookieJar;
  private axios: AxiosInstance;

  private setCookies(baseUrl: string, cookies: string[] = []) {
    cookies.forEach(c => this.jar.setCookieSync(c, baseUrl));
  }

  private configureInterceptors() {
    this.axios.interceptors.request.use(async req => {
      const {
        headers: { common },
      } = req;
      req.jar = this.jar;
      req.withCredentials = true;
      common['User-Agent'] = "Mozilla/5.0 (moon's messing around)";
      common['Accept-Encoding'] = 'gzip, deflate, br';
      common.Accept =
        'text/html,application/xhtml+xml,application/xml,application/json,*/*;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9';
      return req;
    });
    this.axios.interceptors.response.use(async res => {
      this.setCookies(res.config.url, res.headers['set-cookie']);
      return res;
    });
  }

  constructor() {
    // @ts-ignore
    this.jar = new CookieJar(new FileCookieStore('./cookie.jar'));
    this.axios = axiosCookieJarSupport(AXIOS.create());
    this.configureInterceptors();
  }

  public getSession(baseUrl: string) {
    return this.jar.getCookiesSync(baseUrl).find(c => c.key.indexOf('sid') > -1)
      .value;
  }

  private parseAddress(addField: string): number {
    return Number(addField.split('[').pop().split(']')[0]);
  }

  public getHidden(phpbbPage: string): HiddenInputs {
    const $ = cheerio.load(phpbbPage);
    const nameToValue: { [key: string]: any } = $('input[type="hidden"]')
      .toArray()
      .reduce((acc, c) => {
        const key = $(c).attr('name');
        let value: number | string = $(c).attr('value');
        if (!Number.isNaN(Number(value))) value = Number(value);
        acc[key] = value;
        return acc;
      }, {} as any);
    const to = Object.keys(nameToValue)
      .filter(k => nameToValue[k] === 'to')
      .map(this.parseAddress);
    const bcc = Object.keys(nameToValue)
      .filter(k => nameToValue[k] === 'bcc')
      .map(this.parseAddress);
    return { ...nameToValue, to, bcc };
  }

  public async login(
    formUrl: string,
    username: string,
    password: string,
    captcha?: string
  ) {
    const body = {
      username,
      password,
      autologin: 'on',
      login: 'Login',
      'g-recaptcha-response': captcha,
    };
    const { status, data } = await this.post(
      `${formUrl}ucp.php?mode=login`,
      body
    );
    if (status !== 200)
      throw new Error(`Recieved ${status} error when trying to log in`);
    if (data.indexOf('class="error"') > -1) {
      const error = data.split('class="error">')[1].split('<')[0];
      throw new Error(`Response page contains an error: ${error}`);
    }
  }

  public async get(url: string) {
    // arbitrary timeout for spam
    // await new Promise(r => setTimeout(r, 500));
    return this.axios.get(url);
  }

  public async post(
    url: string,
    data: { [key: string]: any } = {}
  ): Promise<AxiosResponse> {
    Logger.get().log({ data, url, method: 'post' }, LogLevel.VV);
    const form = new FormData();
    Object.keys(data).forEach(k => data[k] && form.append(k, data[k]));
    await new Promise(r => setTimeout(r, 5000));
    return this.axios.post(url, form, { headers: { ...form.getHeaders() } });
  }
}

export default PHPBBClient;
