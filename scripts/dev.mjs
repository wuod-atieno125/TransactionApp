import { spawn } from 'node:child_process';

const processes = [
  { name: 'client', command: 'npm', args: ['run', 'dev', '--workspace=client'] },
  { name: 'server', command: 'npm', args: ['run', 'dev', '--workspace=server'] }
];

const children = processes.map(({ name, command, args }) => {
  const child = spawn(command, args, { stdio: ['inherit', 'pipe', 'pipe'], shell: process.platform === 'win32' });

  child.stdout.on('data', (data) => process.stdout.write(`[${name}] ${data}`));
  child.stderr.on('data', (data) => process.stderr.write(`[${name}] ${data}`));
  child.on('exit', (code, signal) => {
    if (code !== 0 && signal === null) {
      process.exitCode = code ?? 1;
    }
  });

  return child;
});

const shutdown = () => {
  children.forEach((child) => child.kill('SIGINT'));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
