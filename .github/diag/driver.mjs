import * as pty from '@lydell/node-pty';
import { writeFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const electron = require('electron');
const child = process.argv[2];
const variants = {
  plain: `"${electron}" "${child}"`,
  redirectCON: `"${electron}" "${child}" <CON`,
  redirectCONIN: `"${electron}" "${child}" <CONIN$`,
};
for (const [name, line] of Object.entries(variants)) {
  const cmd = `${process.cwd()}\\${name}.cmd`;
  writeFileSync(cmd, `@echo off\r\nsetlocal\r\nset "ELECTRON_RUN_AS_NODE=1"\r\n${line}\r\n`);
  const out = await new Promise((done) => {
    let buf = '';
    const p = pty.spawn('cmd.exe', ['/d', '/c', cmd], { cols: 200, rows: 40, cwd: process.cwd(), env: process.env });
    p.onData((d) => (buf += d));
    p.onExit(() => done(buf));
    setTimeout(() => { p.kill(); done(buf + '\n<timeout>'); }, 20000);
  });
  console.log(`===== ${name}\n` + out.replace(/\x1b\[[0-9;?]*[ -\/]*[@-~]|\x1b\][^\x07]*\x07/g, '').split('\n').filter((l) => l.includes('DIAG') || l.includes('timeout')).join('\n'));
}
