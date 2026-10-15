import {build} from 'esbuild';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
const result=await build({entryPoints:['workspace.js'],bundle:true,write:false,format:'esm',target:'es2022',minify:true,metafile:true});
const js=result.outputFiles[0].text.replaceAll('</script','<\\/script');
const html=(await readFile('template.html','utf8')).replace('__SCRIPT__',()=>js);
await writeFile('../server/src/apple_music_hybrid/workspace.html',html);
// Preserve complete notices for every npm package actually included in the bundle.
const roots=new Set();
for(const input of Object.keys(result.metafile.inputs)){
  if(!input.startsWith('node_modules/'))continue;
  const marker=input.lastIndexOf('node_modules/');
  const parts=input.slice(marker+'node_modules/'.length).split('/');
  const packageName=parts[0].startsWith('@')?parts.slice(0,2).join('/'):parts[0];
  roots.add(path.resolve(input.slice(0,marker)+'node_modules/'+packageName));
}
const notices=[];
for(const dir of [...roots].sort()){
  const pkg=JSON.parse(await readFile(path.join(dir,'package.json'),'utf8'));
  const files=(await readdir(dir)).filter(name=>/^(license|copying|notice)(?:$|\.)/i.test(name));
  if(!files.length)throw new Error(`Bundled dependency has no license file: ${pkg.name}`);
  for(const name of files)notices.push(`${pkg.name}@${pkg.version} — ${name}\n\n${await readFile(path.join(dir,name),'utf8')}`);
}
await writeFile('../UI_THIRD_PARTY_LICENSES.txt',notices.join('\n\n'+'='.repeat(72)+'\n\n'));
console.log(`Built self-contained MCP App (${html.length} bytes).`);
