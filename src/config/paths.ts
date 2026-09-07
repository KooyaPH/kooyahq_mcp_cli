import path from 'node:path';

export function configPathFor(homeDirectory: string, platform: NodeJS.Platform): string {
  const pathApi = platform === 'win32' ? path.win32 : path.posix;
  return pathApi.join(homeDirectory, '.kooyahq', 'config.json');
}
