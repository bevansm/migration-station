import dotenv from 'dotenv';
import PHPBBClient from './package/PHPBBClient';
import Migrator from './package/Migrator';
import readline from 'readline';
import PMClient, { PrivateMessage } from './package/PMClient';
import path from 'path';
import fs from 'fs';
import PostParser from './package/parsers/PostParser';
import { UserRow } from './package/model/User';

dotenv.config({ path: __dirname + './../.env' });

async function login(): Promise<PHPBBClient> {
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
  return client;
}

async function runner(message?: PrivateMessage) {
  const client = await login();
  const start = new Date();
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
    forceEnableAllCodes: true,
    seed: Number(process.env.SEED),
    tempUsers: true,
    outDir:
      process.env.OUT_DIR && path.resolve(__dirname, '..', process.env.OUT_DIR),
    client,
  });
  const end = new Date();
  migrator.toFiles();
  const { users, posts, forums, topics } = migrator.toJSON();
  const seconds = Math.floor((end.getTime() - start.getTime()) / 1000);
  const minutes = Math.floor(seconds / 60);
  console.log(
    `Started at [${start.toUTCString()}], ended at [${end.toUTCString()}].`
  );
  console.log(
    `Migration took ${minutes} minutes, ${seconds - minutes * 60} seconds.`
  );
  console.log(
    `Created ${forums.length} forums, ${topics.length} topics, ${users.length} users, and ${posts.length} posts.`
  );
}

async function testPM() {
  const client = new PHPBBClient();
  const pmClient = new PMClient(client, process.env.OLD_URL, 1);
  await pmClient.sendPM([process.env.OLD_USERNAME], {
    body: 'Thanks for testing!',
    subject: 'This is a test.',
  });
}

function getMigrationMessage(newUn: string): PrivateMessage {
  return {
    subject: 'VLDR Has a New Home!',
    body: `[i]You are recieving this message because you have posted in VLDR. Please ignore if you no longer wish to be involved with the community.[/i] 
    [center].[/center]

    [center][url=${process.env.NEW_URL}]Did you know that VLDR is moving forums?[/url][/center]

    We got a snazzy domain and a couple of good ol' psychos. Come and check us out!

    [url=${process.env.NEW_URL}memberlist.php?mode=viewprofile&un=${newUn}]We’ve created a copy of your VLDR posts on the new forum under a ghost account[/url]. While this account may share your username, we've set it up so you can create another account with the same name. PHPBB is magic! 

    If you’d like to merge this ghost user with your account on the new forums, please reply to this message with the username you’d like the posts to be associated with. [b]Make sure that you’ve already created an account on the new forum with that name.[/b] We may need more information to verify that the destination account is yours, so please hang tight!
    
    Cheers! We hope to see you soon.`,
  };
}

async function sendPM() {
  const { users = [] as UserRow[] } = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, '..', process.env.OUT_DIR, 'dump.json'),
      'utf8'
    )
  );
  const pmClient = new PMClient(new PHPBBClient(), process.env.OLD_URL, 1);
  try {
    await Promise.all(
      users.map((u: UserRow) =>
        pmClient.sendPM([u[1]], getMigrationMessage(u[2]))
      )
    );
  } catch (e) {
    console.log(
      `Unable to send all PMs. Please check the "sent" folder on ${process.env.OLD_USERNAME} to see what messages sent.`
    );
    throw e;
  }
}

switch (process.argv[2]) {
  case 'test-pm':
    testPM();
    break;
  case 'send-pm':
    sendPM();
    break;
  case 'login':
    login();
    break;
  default:
    runner();
}
