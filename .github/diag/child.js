const fs = require('fs');
const tty = require('tty');
const out = (k, v) => console.log(`DIAG ${k}=${JSON.stringify(v)}`);
out('electron', process.versions.electron);
out('stdin.isTTY', !!process.stdin.isTTY);
out('stdout.isTTY', !!process.stdout.isTTY);
try { const s = fs.fstatSync(0); out('fstat0', { mode: s.mode, size: s.size }); } catch (e) { out('fstat0.err', e.message); }
for (const [name, flags] of [['CONIN$', 'r+'], ['CONIN$', 'r'], ['\\\\.\\CONIN$', 'r+']]) {
  try { const fd = fs.openSync(name, flags); out(`open ${name} ${flags}`, { fd, isatty: tty.isatty(fd) }); fs.closeSync(fd); }
  catch (e) { out(`open ${name} ${flags}.err`, e.code + ' ' + e.message); }
}
