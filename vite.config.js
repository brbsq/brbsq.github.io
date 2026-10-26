import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {optimizeShader} from './scripts/optimize-shader.mjs';
export default defineConfig({
 base:'./',
 resolve:{alias:{'figma:shaders':fileURLToPath(new URL('./shader/figma-properties.js',import.meta.url))}},
 plugins:[{name:'background-gpu-budget',enforce:'pre',transform(source,id){
  if(id.split('?')[0].endsWith('/shader/main.ts'))return {code:optimizeShader(source),map:null};
 }}]
});
