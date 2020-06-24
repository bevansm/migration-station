import dotenv from 'dotenv';
import fs from 'fs';
import PHPBBClient from './package/PHPBBClient';
import Migrator from './package/Migrator';
import readline from 'readline';

dotenv.config({ path: __dirname + './../.env' });

async function runner() {
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
    formIds: process.env.FORUM_IDS.split(' ').map(Number),
    client,
  });
  fs.writeFileSync('./dump.json', migrator.toString());
}

runner();
