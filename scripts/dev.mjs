import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const children = [
  spawn(process.execPath, ['--watch', 'backend/src/server.mjs'], { cwd: root, stdio: 'inherit', windowsHide: true }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'frontend/vite.config.ts', '--host', '127.0.0.1', 'frontend'], { cwd: root, stdio: 'inherit', windowsHide: true }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  const running = children.filter(child => child.pid && child.exitCode === null && child.signalCode === null);
  if (process.platform === 'win32') {
    // Node --watch crea un proceso hijo: cerrar solo el padre dejaría el puerto ocupado.
    const terminations = running.map(child => new Promise(resolve => {
      const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      killer.on('exit', resolve); killer.on('error', () => { child.kill(); resolve(); });
    }));
    Promise.all(terminations).then(() => process.exit(code));
  } else {
    running.forEach(child => child.kill());
    setTimeout(() => process.exit(code), 200).unref();
  }
}
children.forEach(child => { child.on('error', error => { console.error(error.message); stop(1); }); child.on('exit', code => stop(code || 0)); });
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
