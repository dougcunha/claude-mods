import type { Host } from './host'

/** The operating systems the mod tells apart for the commands it starts. */
export type Platform = 'windows' | 'mac' | 'linux'

/** `Windows_NT` in `OS` is Windows; otherwise `uname -s` tells macOS (`Darwin`) from Linux. */
export async function platformOf(host: Host): Promise<Platform> {
  if ((await host.env()).os === 'Windows_NT') return 'windows'
  const uname = await host.run(['uname', '-s']).catch(() => ({ exitCode: 1, stdout: '' }))

  return uname.stdout.trim() === 'Darwin' ? 'mac' : 'linux'
}
