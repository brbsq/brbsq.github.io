import {setup,render} from './main.ts';
// Exact layer parameters from Figma node 2:3, rather than library defaults.
export const params={
 intensity:3.0899999141693115,
 gradient:{stops:[
  {position:0,color:{r:.6174624562263489,g:.895582914352417,b:.8677708506584167,a:1}},
  {position:.5,color:{r:0,g:.6666666269302368,b:1,a:1}},
  {position:.9615384340286255,color:{r:1,g:.5925105214118958,b:.6807999014854431,a:1}}
 ]},
 gradientBalance:15,material:0,morphSpeed:3.740000009536743,detail:2.3299999237060547,
 twist:1.6799999475479126,zoom:35,gradientMethod:0,warp:.7999999523162842,rotationSpeed:35
};
export async function startBackground(canvas){
 const note=document.querySelector('#shader-status');
 let device,context,stopped=false;
 function unavailable(message){canvas.dataset.state='unavailable';note.textContent=message;note.hidden=false;console.warn(message)}
 if(!navigator.gpu){unavailable('Animated background requires a browser with WebGPU support.');return}
 try{
  const adapter=await navigator.gpu.requestAdapter();
  if(!adapter)throw new Error('No WebGPU adapter available');
  device=await adapter.requestDevice();context=canvas.getContext('webgpu');
  if(!context)throw new Error('WebGPU canvas is unavailable');
  const format=navigator.gpu.getPreferredCanvasFormat();
  context.configure({device,format,alphaMode:'opaque'});
  const frame={state:{},params,time:0,output:null};
  device.pushErrorScope('validation');
  setup(device,frame);
  const info=await frame.state.shaderModule.getCompilationInfo();
  const errors=info.messages.filter(m=>m.type==='error');
  if(errors.length)throw new Error(errors.map(m=>m.message).join('\n'));
  const setupError=await device.popErrorScope();if(setupError)throw setupError;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function resize(){const ratio=Math.min(devicePixelRatio,1.5);canvas.width=Math.max(1,Math.round(innerWidth*ratio));canvas.height=Math.max(1,Math.round(innerHeight*ratio))}
  resize();addEventListener('resize',resize);
  device.addEventListener('uncapturederror',event=>{stopped=true;unavailable('Animated background could not render on this device.');console.error(event.error)});
  device.lost.then(info=>{stopped=true;unavailable('Animated background lost GPU access. Reload to retry.');console.warn(info.message)});
  const randomSpeed=()=>0.50+Math.random()*0.20;
  let lastTime=performance.now(),shaderTime=0;
  let speedFrom=randomSpeed(),speedTo=randomSpeed(),speedElapsed=0;
  let speedDuration=8000+Math.random()*6000;
  function draw(time){
   if(stopped)return;
   const elapsed=Math.min(Math.max(time-lastTime,0),100);lastTime=time;
   if(!document.hidden){
    if(!reduced.matches){
     speedElapsed=Math.min(speedElapsed+elapsed,speedDuration);
     const phase=speedElapsed/speedDuration;
     const blend=phase*phase*(3-2*phase);
     const speed=speedFrom+(speedTo-speedFrom)*blend;
     // Integrate the clock so speed changes never jump the shader's position.
     shaderTime+=elapsed*speed;
     if(phase===1){speedFrom=speedTo;speedTo=randomSpeed();speedElapsed=0;speedDuration=8000+Math.random()*6000}
    }
    frame.time=reduced.matches?0:shaderTime;
    frame.output=context.getCurrentTexture();render(device,frame);canvas.dataset.state='rendering';
   }
   requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
 }catch(error){stopped=true;unavailable('Animated background could not start on this device.');console.error(error)}
}
