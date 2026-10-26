import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {optimizeShader} from './optimize-shader.mjs';
const original=await readFile(new URL('../shader/main.ts',import.meta.url),'utf8');
const optimized=optimizeShader(original);
const shaderText=source=>source.match(/code: `([\s\S]*?)`/)[1];
test('performance adaptation preserves the authored GPU shader exactly',()=>{
 assert.equal(shaderText(optimized),shaderText(original));
});
test('single-sample renderer stores its output and reuses depth resources',async()=>{
 globalThis.GPUBufferUsage={VERTEX:1,INDEX:2,UNIFORM:4,COPY_DST:8};
 globalThis.GPUTextureUsage={RENDER_ATTACHMENT:16};
 const textures=[],pipelines=[],passes=[];
 const device={
  createShaderModule:()=>({}),
  createBuffer:({size})=>({getMappedRange:()=>new ArrayBuffer(size),unmap(){}}),
  createTexture:descriptor=>{textures.push(descriptor);return {createView:()=>({}),destroy(){}}},
  createRenderPipeline:descriptor=>{pipelines.push(descriptor);return {getBindGroupLayout:()=>({})}},
  createBindGroup:()=>({}),
  queue:{writeBuffer(){},submit(){}},
  createCommandEncoder:()=>({beginRenderPass:descriptor=>{passes.push(descriptor);return {setPipeline(){},setBindGroup(){},draw(){},setVertexBuffer(){},setIndexBuffer(){},drawIndexed(){},end(){}}},finish:()=>({})})
 };
 const source=optimized.replace('import { defineProperties } from "figma:shaders"','const defineProperties=()=>{};');
 const module=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const frame={state:{},params:{},time:0,output:{width:640,height:360,format:'bgra8unorm',createView:()=>({})}};
 module.setup(device,frame);module.render(device,frame);
 const allocations=textures.length;
 module.render(device,{...frame,time:16.667});
 assert.equal(textures.length,allocations,'steady frames must reuse GPU attachments');
 assert.equal(textures.length,1,'only the depth attachment should be allocated');
 for(const pipeline of pipelines)assert.equal(pipeline.multisample.count,1);
 for(const pass of passes){assert.equal(pass.colorAttachments[0].storeOp,'store');assert.equal(pass.colorAttachments[0].resolveTarget,undefined)}
 assert.ok(frame.state.indexCount/3<40000,'background geometry stays within its GPU budget');
});
