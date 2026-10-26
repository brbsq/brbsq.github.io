import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('model-parts/manifest.json',root),'utf8'));
const output=new URL('public/models/shelf-with-slots.glb',root);
const hash=data=>createHash('sha256').update(data).digest('hex');
try{if(hash(await readFile(output))===manifest.sha256)process.exit(0)}catch(error){if(error.code!=='ENOENT')throw error}
const parts=await Promise.all(manifest.parts.map(name=>readFile(new URL('model-parts/'+name,root))));
const combined=Buffer.concat(parts);
if(combined.length!==manifest.bytes||hash(combined)!==manifest.sha256)throw new Error('Shelf model integrity check failed');
await mkdir(new URL('public/models/',root),{recursive:true});
await writeFile(output,combined);
console.log('Restored original shelf model; SHA-256 verified.');
