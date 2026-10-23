import {readdirSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,relative} from 'node:path';
import {zipSync} from 'fflate';
const files={},root=process.cwd(),skip=new Set(['node_modules','.git','.openai','dist','target','.sites-local','downloads']);
function collect(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){if(skip.has(entry.name)||entry.name.endsWith('.tar.gz'))continue;const path=join(dir,entry.name);if(entry.isDirectory())collect(path);else if(entry.isFile())files['clyde-and-crown/'+relative(root,path).replaceAll('\\','/')]=[new Uint8Array(readFileSync(path)),{mtime:new Date('2026-01-01T00:00:00Z')}];}}
collect(root);mkdirSync('public/downloads',{recursive:true});writeFileSync('public/downloads/clyde-crown-source.zip',zipSync(files,{level:6}));
