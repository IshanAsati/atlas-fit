import { copyFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Reuse the existing original Atlas logo, not Capacitor's template artwork.
// Android scales PNG drawables to the launcher/adaptive-icon size.
const resources = 'android/app/src/main/res';
for (const folder of readdirSync(resources).filter((name) => /^mipmap-(mdpi|hdpi|xhdpi|xxhdpi|xxxhdpi)$/.test(name))) {
  for (const name of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
    copyFileSync('public/icons/icon-512.png', join(resources, folder, name));
  }
}
console.log('Android launcher icons now use the Atlas Fit logo.');
