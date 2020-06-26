import dotenv from 'dotenv';
import fs from 'fs';
import PHPBBClient from './package/PHPBBClient';
import Migrator from './package/Migrator';
import readline from 'readline';
import PMClient, { PrivateMessage } from './package/PMClient';

dotenv.config({ path: __dirname + './../.env' });

async function runner(message?: PrivateMessage) {
  const client = new PHPBBClient();
  while (true) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    let captcha;
    await new Promise(resolve =>
      rl.question('please provide a captcha token:\n', input => {
        captcha = input;
        rl.close();
        resolve();
      })
    );
    if (!captcha) break;

    try {
      await client.login(
        process.env.OLD_URL,
        process.env.OLD_USERNAME,
        process.env.OLD_PASSWORD,
        captcha
      );
      break;
    } catch (e) {
      console.log(e.message);
    }
  }
  const migrator = await Migrator.GetMigrator({
    from: process.env.OLD_URL,
    to: process.env.NEW_URL,
    rootForumId: Number(process.env.FORUM_ROOT_ID),
    startForumId: Number(process.env.FORUM_START_ID),
    startTopicId: Number(process.env.START_TOPIC_ID),
    startPostId: Number(process.env.POST_START_ID),
    startUserId: Number(process.env.USER_START_ID),
    formIds: process.env.FORUM_IDS.split(' ').map(Number),
    maxTopics: Number(process.env.MAX_TOPICS) || -1,
    maxPosts: Number(process.env.MAX_POSTS) || -1,
    parseUsingQuotePage: true,
    forceEnableAllCodes: false,
    tempUsers: true,
    client,
  });
  fs.writeFileSync('./out/dump.json', migrator.toString());
  fs.writeFileSync('./out/users.sql', migrator.getUserSQL());
  fs.writeFileSync(
    './out/structure.sql',
    `${migrator.getForumSQL()}${migrator.getPermissionsSQL()}\n${migrator.getTopicSQL()}`
  );
  migrator
    .getPostSQLPaginated()
    .forEach((pq, i) => fs.writeFileSync(`./out/posts-${i + 1}.sql`, pq));

  if (message) {
    const pmClient = new PMClient(client, process.env.BASE_URL, 5);
    await pmClient.sendPM(
      migrator.toJSON().users.map(u => u[1]),
      message
    );
  }
}

const message = {
  body: `[i]You are recieving this message because you have posted in VLDR. Please ignore this if you no longer wish to be involved with the community![/i]
  
  [center][url=${process.env.NEW_URL}]VLDR is moving forums![/url][/center]
  
  We got a snazzy domain and a couple of good ol' psychos. Come and check us out!
  
  If you'd like to have your information on the new forum mapped over, please reply to this message with your username on TOS, and your username on the new forums. 
  
  Please note that you will--and should--create an account [url=${process.env.NEW_URL}]on the new site[/url] before replying.`,
  subject: 'VLDR Has a New Home!',
};

async function testPM() {
  const client = new PHPBBClient();
  const pmClient = new PMClient(client, process.env.OLD_URL, 1);
  await pmClient.sendPM([process.env.OLD_USERNAME], {
    body: 'Thanks for testing!',
    subject: 'This is a test.',
  });
}

// testPM();
runner();
