import PHPBBClient from './PHPBBClient';
import Logger, { LogLevel } from './Logger';

export interface PrivateMessage {
  body: string;
  subject: string;
}

type PMDestination = 'to' | 'bcc';

class PMClient {
  private client: PHPBBClient;
  private logger: Logger;
  private maxRecipients: number;

  private url: string;

  constructor(
    client: PHPBBClient,
    forumUrl: string,
    maxRecipients: number = 8
  ) {
    this.client = client;
    this.logger = Logger.get();
    this.url = forumUrl;
    this.maxRecipients = maxRecipients;
  }

  private async initToken(): Promise<string> {
    const response = await this.client
      .get(`${this.url}ucp.php?i=pm&mode=compose`)
      .then(r => r.data);
    const hidden = this.client.getHidden(response);
    this.logger.log(response, LogLevel.VVVVV);
    return hidden.form_token;
  }

  private async loadUsers(
    form_token: string,
    recipients: string[]
  ): Promise<{ form_token: string; to: number[] }> {
    const sid = this.client.getSession(this.url);
    const response = await this.client
      .post(`${this.url}ucp.php?i=pm&mode=compose&action=post&sid=${sid}`, {
        form_token,
        status_switch: 0,
        username_list: recipients.join('\n'),
      })
      .then(r => r.data);
    const retVal = {
      to: [],
      form_token: '',
      ...this.client.getHidden(response),
    };
    this.logger.log(response, LogLevel.VVVVV);
    return retVal;
  }

  private mapToAddressList(
    ids: number[],
    dest: PMDestination
  ): { [key: string]: PMDestination } {
    return ids.reduce((p, c) => {
      p[`address_list[u][${c}]`] = dest;
      return p;
    }, {} as any);
  }

  private async send(
    message: PrivateMessage,
    form_token: string,
    to: number[] = [],
    bcc: number[] = []
  ) {
    const { subject, body } = message;
    const sid = this.client.getSession(this.url);
    const requestBody = {
      username_list: '',
      icon: 0,
      subject,
      addbbcode20: 100,
      message: body,
      ...this.mapToAddressList(to, 'to'),
      ...this.mapToAddressList(bcc, 'bcc'),
      status_switch: 556,
      post: 'Submit',
      attach_sig: 'on',
      form_token,
      last_click: Date.now() / 1000,
      creation_time: Date.now() / 1000,
    };
    const response = await this.client
      .post(
        `${this.url}ucp.php?i=pm&mode=compose&action=post&sid=${sid}`,
        requestBody
      )
      .then(r => r.data);
    this.logger.log(response, LogLevel.VVVVV);
    if (response.indexOf('textarea') > -1) {
      this.logger.log(response, LogLevel.VVVV);
      throw new Error('Failed to send message successfully.');
    }
  }

  private async sendPMHelper(recipients: string[], message: PrivateMessage) {
    const initToken = await this.initToken();
    const { form_token, to } = await this.loadUsers(initToken, recipients);
    await this.send(message, form_token, to);
  }

  public async sendPM(recipients: string[], message: PrivateMessage) {
    const requests = [];
    const tmp = [...recipients];
    while (tmp.length)
      requests.push(
        this.sendPMHelper(tmp.splice(0, this.maxRecipients), message)
      );
    await Promise.all(requests);
  }
}

export default PMClient;
