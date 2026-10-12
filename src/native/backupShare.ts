import { Capacitor } from '@capacitor/core';

/** Android downloads use its share sheet; browsers retain their normal download. */
export async function shareNativeBackup(filename: string, json: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ]);
  const file = await Filesystem.writeFile({
    path: filename, data: json, directory: Directory.Cache, encoding: Encoding.UTF8,
  });
  await Share.share({ title: 'Atlas Fit backup', files: [file.uri], dialogTitle: 'Save or share your backup' });
  return true;
}
