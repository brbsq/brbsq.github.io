import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
export default defineConfig({base:'./',resolve:{alias:{'figma:shaders':fileURLToPath(new URL('./shader/figma-properties.js',import.meta.url))}}});
