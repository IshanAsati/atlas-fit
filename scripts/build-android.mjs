import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!sdk && !existsSync('android/local.properties')) {
  console.error('Android SDK not configured. Set ANDROID_HOME or open android/ in Android Studio, then run npm run android:apk.');
  process.exit(1);
}

const windows = process.platform === 'win32';
const result = spawnSync(windows ? 'cmd.exe' : 'sh', windows
  ? ['/d', '/s', '/c', 'gradlew.bat assembleDebug']
  : ['gradlew', 'assembleDebug'], {
  cwd: 'android', stdio: 'inherit',
});
if (result.error) console.error(result.error.message);
if (result.status !== 0) process.exit(result.status ?? 1);

mkdirSync('artifacts', { recursive: true });
const output = join('artifacts', 'atlas-fit-debug.apk');
copyFileSync(join('android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'), output);
console.log(`Installable debug APK: ${output}`);
