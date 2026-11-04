import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const buildOutput = resolve(root, 'dist/upload-build');
const uploadOutput = resolve(root, 'dist/upload');
const backendOutput = join(uploadOutput, 'backend');
const angularCli = resolve(root, 'node_modules/@angular/cli/bin/ng.js');

const build = spawnSync(
  process.execPath,
  [
    angularCli,
    'build',
    '--configuration',
    'production',
    '--base-href',
    '/onlyt/',
    '--deploy-url',
    '/onlyt/app/',
    '--output-path',
    buildOutput,
  ],
  { cwd: root, stdio: 'inherit' },
);

if (build.error) {
  throw build.error;
}
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const browserOutput = join(buildOutput, 'browser');
if (!existsSync(join(browserOutput, 'index.html'))) {
  throw new Error(`Angular build did not produce ${join(browserOutput, 'index.html')}`);
}

rmSync(uploadOutput, { recursive: true, force: true });
mkdirSync(join(uploadOutput, 'app'), { recursive: true });
cpSync(join(browserOutput, 'index.html'), join(uploadOutput, 'index.html'));

const publicNames = new Set(readdirSync(join(root, 'public')));
for (const name of readdirSync(browserOutput)) {
  if (name === 'index.html' || publicNames.has(name)) {
    continue;
  }
  cpSync(join(browserOutput, name), join(uploadOutput, 'app', name), { recursive: true });
}

for (const name of publicNames) {
  cpSync(join(root, 'public', name), join(uploadOutput, name), { recursive: true });
}

for (const directory of ['public', 'src']) {
  cpSync(join(root, 'backend', directory), join(backendOutput, directory), { recursive: true });
}
cpSync(join(root, 'backend', 'config.example.php'), join(backendOutput, 'config.example.php'));
mkdirSync(join(backendOutput, 'storage'), { recursive: true });

rmSync(buildOutput, { recursive: true, force: true });
console.log(`Upload package created at ${uploadOutput}`);
