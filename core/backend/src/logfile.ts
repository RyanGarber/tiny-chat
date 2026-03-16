import { tmpdir } from 'os';
import { resolve } from 'path';
import { appendFile, existsSync } from 'fs';

// get date of app start
const APP_START = new Date().getTime() - process.uptime() * 1000;

const LOG_LOCATION = resolve(tmpdir(), `${APP_START}.tiny-chat.log`);
if (!existsSync(LOG_LOCATION)) console.log('Logging to', LOG_LOCATION);

export default function logfile(...data: unknown[]) {
  console.log(...data);

  const time = new Date().getTime() - APP_START;
  const formattedTime = time.toString().padStart(6, '0');
  const formattedDate = new Date().toISOString();

  const formattedData = data.map((d) => {
    if (typeof d === 'object' && d !== null) {
      return JSON.stringify(d);
    }
    return d;
  });

  const logString = `${formattedDate} [${formattedTime}] ${formattedData.join(' ')}`;

  appendFile(LOG_LOCATION, logString + '\n', (err) => {
    if (err) {
      console.error('Failed to write to log file:', err);
    }
  });
}
