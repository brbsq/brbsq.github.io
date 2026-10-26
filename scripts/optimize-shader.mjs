// Keep the exported Figma source and its authored WGSL intact. Only tune the
// host's tessellation and sampling, which are hidden by the background blur.
export function optimizeShader(source){
 const replace=(before,after)=>{
  if(!source.includes(before))throw new Error('Shader performance patch no longer matches: '+before.slice(0,60));
  source=source.replace(before,after);
 };
 replace('const resolution = 112','const resolution = 56');
 replace('const sampleCount = 4','const sampleCount = 1');
 replace('    !s.msaaTexture ||\n','');
 replace('    if (s.msaaTexture) {\n      s.msaaTexture.destroy()\n    }\n','');
 const allocation=/    s\.msaaTexture = device\.createTexture\(\{[\s\S]*?\n    \}\)\n/;
 if(!allocation.test(source))throw new Error('Shader MSAA allocation no longer matches');
 source=source.replace(allocation,'');
 replace('    s.msaaView = s.msaaTexture.createView()\n','');
 replace('      view: s.msaaView,\n      resolveTarget: s.outputView,','      view: s.outputView,');
 replace('      storeOp: "discard",','      storeOp: "store",');
 return source;
}
