import { CookieJar } from 'tough-cookie';
import FormData from 'form-data';
import AXIOS, { AxiosResponse, AxiosInstance } from 'axios';
import axiosCookieJarSupport from 'axios-cookiejar-support';

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
    const {
      interceptors: { request, response },
    } = this.axios;
    request.use(async req => {
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
    response.use(async res => {
      this.setCookies(res.config.url, res.headers['set-cookie']);
      return res;
    });
  }

  constructor() {
    this.jar = new CookieJar();
    this.axios = axiosCookieJarSupport(AXIOS.create({ timeout: 60000 }));
    this.configureInterceptors();
  }

  public getSession(baseUrl: string) {
    return this.jar.getCookiesSync(baseUrl).find(c => c.key.indexOf('sid') > -1)
      .value;
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
      throw new Error(`${status} status when trying to log in`);
    if (data.indexOf('class="error"') > -1) {
      const error = data.split('class="error">')[1].split('<')[0];
      throw new Error(`response page contains an error: ${error}`);
    }
  }

  public async get(url: string) {
    return this.axios.get(url);
  }

  public async post(
    url: string,
    data: { [key: string]: any }
  ): Promise<AxiosResponse> {
    const form = new FormData();
    Object.keys(data).forEach(k => k && form.append(k, data[k]));
    return this.axios.post(url, form, { headers: { ...form.getHeaders() } });
  }
}

export default PHPBBClient;
