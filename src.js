import './style.css';
import {countDraw} from './performance.js';
let pendingCursorLight=false,cursorX=0,cursorY=0;
import {startBackground} from './shader/background.js';
startBackground(document.querySelector('#shader-background'));
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const asset=p=>new URL(p,document.baseURI).href;
const projects=[{slot:'T1',repo:'MashRoom',title:'MashRoom',description:'You are who you want to be.'},{slot:'T2',repo:'TheChase',title:'The Chase',description:'Run for knowledge.',path:'TheChase/game/'},{slot:'T3',repo:'mrcharacterutilities',title:'MashRoom Control Panel',description:'MashRoom admins only.',sourceOnly:true},{slot:'B1',repo:'EnglishYear1',title:'English Year 1',description:'Materials for Year 1.'},{slot:'B3',repo:'EnglishYear3',title:'English Year 3',description:'Materials for Year 3.'},{slot:'B4',repo:'EnglishYear4',title:'English Year 4',description:'Materials for Year 4'}];
const dialog=document.querySelector('#detail');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let renderer,scene,camera,model,previewRenderer,previewCamera,casePivot,selected,activeButton;
let progress=0,target=0,lastTime=0;
let sceneDirty=true,popupDirty=true,pointerDirty=true;
const objects=new Map(),buttons=new Map(),previewScene=new THREE.Scene();
const fromPosition=new THREE.Vector3(),toPosition=new THREE.Vector3(),flightOrigin=new THREE.Vector3();
const transitionSeconds=0.65;
let finalZoom=1,shelfPivot;
const rotationLimit=THREE.MathUtils.degToRad(15);
const popupCorrection=new THREE.Quaternion();
let drag=null,suppressCaseClick=false;
let hoveredSlot=null;
const caseRestY=new Map(),caseEffects=new Map();
function installCaseEffects(slot,obj){
 obj.updateWorldMatrix(true,true);
 const inverse=new THREE.Matrix4().copy(obj.matrixWorld).invert(),bounds=new THREE.Box3();
 obj.traverse(mesh=>{if(!mesh.isMesh)return;mesh.geometry.computeBoundingBox();bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld)))});
 const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 const group=new THREE.Group();group.position.copy(obj.position);group.quaternion.copy(obj.quaternion);group.scale.copy(obj.scale);obj.parent.add(group);
 const strength={value:0},padding=.045;
 const vertexShader='varying vec2 point;void main(){point=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
 const haloMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{strength,dimensions:{value:new THREE.Vector2(size.x+padding*2,size.y+padding*2)},halfCase:{value:new THREE.Vector2(size.x/2-.003,size.y/2-.003)}},vertexShader,fragmentShader:`
 varying vec2 point;uniform float strength;uniform vec2 dimensions;uniform vec2 halfCase;
 void main(){vec2 q=abs((point-.5)*dimensions)-halfCase;float distanceToCase=length(max(q,0.0))+min(max(q.x,q.y),0.0)-.003;
 float glow=exp(-max(distanceToCase,0.0)*max(distanceToCase,0.0)/.00028);
 gl_FragColor=vec4(.76,.92,1.0,glow*strength*.32);}
 `});
 const halo=new THREE.Mesh(new THREE.PlaneGeometry(size.x+padding*2,size.y+padding*2),haloMaterial);
 halo.position.set(center.x,center.y,bounds.min.z-.002);group.add(halo);
 const shadowMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{strength},vertexShader,fragmentShader:'varying vec2 point;uniform float strength;void main(){vec2 p=(point-.5)*2.0;float soft=exp(-dot(p,p)*4.0)*(1.0-smoothstep(.7,1.0,length(p)));gl_FragColor=vec4(.035,.09,.15,soft*strength*.252);}'});
 const shadow=new THREE.Mesh(new THREE.PlaneGeometry(size.x*1.75,.035),shadowMaterial);
 shadow.position.set(center.x,bounds.min.y-.006,bounds.max.z+.001);group.add(shadow);
 group.visible=false;
 caseEffects.set(slot,{group,halo,shadow,strength,centerY:center.y});
}

function settle(value,target,rate,dt,epsilon=0.00001){
 return reduced.matches||Math.abs(value-target)<epsilon?target:THREE.MathUtils.damp(value,target,rate,dt);
}
function updateCaseHover(dt){
 for(const [slot,obj] of objects){
  const effect=caseEffects.get(slot);
  if(dialog.open&&obj===selected){if(effect&&effect.group.visible){effect.group.visible=false;effect.strength.value=0;sceneDirty=true}continue}
  const lift=(!dialog.open&&!drag?.moved&&slot===hoveredSlot) ? .018 : 0;
  const y=settle(obj.position.y,caseRestY.get(slot)+lift,12,dt);
  if(y!==obj.position.y){obj.position.y=y;sceneDirty=true}
  if(effect){
   effect.halo.position.y=effect.centerY+y-caseRestY.get(slot);
   const strength=settle(effect.strength.value,lift>0?1:0,12,dt,.001);
   if(strength!==effect.strength.value){effect.strength.value=strength;sceneDirty=true}
   effect.group.visible=strength>0;
  }
 }
}
const main=document.querySelector('main');
// Screen-space falloff is applied inside the acrylic material only.
const shelfGlow={pointer:{value:new THREE.Vector2(-10000,-10000)},radius:{value:100},strength:{value:0}};
const hoverPointer=new THREE.Vector2();let pointerOnShelf=false;
const hoverRay=new THREE.Raycaster(),localRay=new THREE.Ray(),localPoint=new THREE.Vector3(),inverseShelf=new THREE.Matrix4();
main.addEventListener('pointermove',e=>{hoverPointer.set(e.clientX,e.clientY);pointerDirty=true;pointerOnShelf=e.pointerType!=='touch'&&!e.target.closest('h1')});
main.addEventListener('pointerleave',()=>{pointerOnShelf=false;pointerDirty=true});
addEventListener('blur',()=>{pointerOnShelf=false;pointerDirty=true});
function installShelfGlow(){
 model.getObjectByName('Shelf_Structure')?.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const enhance=original=>{
   const material=original.clone();
   material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{shelfGlowPointer:shelfGlow.pointer,shelfGlowRadius:shelfGlow.radius,shelfGlowStrength:shelfGlow.strength});
    shader.fragmentShader='uniform vec2 shelfGlowPointer;\nuniform float shelfGlowRadius;\nuniform float shelfGlowStrength;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      float cursorFalloff = exp(-dot(gl_FragCoord.xy-shelfGlowPointer,gl_FragCoord.xy-shelfGlowPointer)/(shelfGlowRadius*shelfGlowRadius));
      float internalGlow = cursorFalloff * shelfGlowStrength;
      outgoingLight += vec3(0.65,0.86,1.0) * internalGlow;
      diffuseColor.a = min(1.0,diffuseColor.a + internalGlow * 0.12);
      #include <opaque_fragment>
    `);
   };
   material.customProgramCacheKey=()=> 'shelf-internal-cursor-glow-v1';return material;
  };
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(enhance):enhance(mesh.material);
 });
}
let shelfGlowTarget=0;
const normalizedPointer=new THREE.Vector2();
function updateShelfGlow(dt){
 if(pointerDirty){
  let inside=false;
  if(pointerOnShelf&&shelfPivot&&!dialog.open){
   normalizedPointer.set(hoverPointer.x/innerWidth*2-1,1-hoverPointer.y/innerHeight*2);
   hoverRay.setFromCamera(normalizedPointer,camera);
   inverseShelf.copy(model.matrixWorld).invert();localRay.copy(hoverRay.ray).applyMatrix4(inverseShelf);
   const hit=localRay.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),0),localPoint);
   inside=!!hit&&Math.abs(localPoint.x)<.68&&localPoint.y>-.015&&localPoint.y<.59;
  }
  const pixelRatio=renderer.getPixelRatio();
  shelfGlow.pointer.value.set(hoverPointer.x*pixelRatio,(innerHeight-hoverPointer.y)*pixelRatio);
  shelfGlow.radius.value=Math.max(65,Math.min(innerWidth,innerHeight)*.15)*pixelRatio;
  shelfGlowTarget=inside?1.10:0;pointerDirty=false;sceneDirty=true;
 }
 const strength=settle(shelfGlow.strength.value,shelfGlowTarget,9,dt,.001);
 if(strength!==shelfGlow.strength.value){shelfGlow.strength.value=strength;sceneDirty=true}
}

main.addEventListener('pointerdown',e=>{
 if(e.button!==0||dialog.open||!shelfPivot||e.target.closest('h1'))return;
 suppressCaseClick=false;
 drag={id:e.pointerId,x:e.clientX,y:e.clientY,pitch:shelfPivot.rotation.x,yaw:shelfPivot.rotation.y,moved:false};
});
main.addEventListener('pointermove',e=>{
 if(!drag||e.pointerId!==drag.id)return;
 const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
 if(!drag.moved&&Math.hypot(dx,dy)<6)return;
 if(!drag.moved){drag.moved=true;main.setPointerCapture(e.pointerId);main.classList.add('dragging')}
 shelfPivot.rotation.set(THREE.MathUtils.clamp(drag.pitch+dy*.003,-rotationLimit,rotationLimit),THREE.MathUtils.clamp(drag.yaw+dx*.003,-rotationLimit,rotationLimit),0,'YXZ');
 shelfPivot.updateMatrixWorld(true);updateHotspots();sceneDirty=true;pointerDirty=true;
});
function finishDrag(e){if(!drag||e.pointerId!==drag.id)return;suppressCaseClick=drag.moved;drag=null;main.classList.remove('dragging');if(main.hasPointerCapture(e.pointerId))main.releasePointerCapture(e.pointerId)}
main.addEventListener('pointerup',finishDrag);main.addEventListener('pointercancel',finishDrag);
main.addEventListener('click',e=>{if(suppressCaseClick&&e.detail>0){e.preventDefault();e.stopImmediatePropagation();suppressCaseClick=false}},true);
function lighting(s){s.add(new THREE.HemisphereLight(0xffffff,0xb0c4de,3));const l=new THREE.DirectionalLight(0xffffff,3);l.position.set(-2,4,5);s.add(l)}
lighting(previewScene);
function close(){target=0;popupDirty=true;dialog.dataset.phase='closing'}
dialog.querySelector('.close').onclick=close;
dialog.addEventListener('cancel',e=>{e.preventDefault();close()});
dialog.addEventListener('click',e=>{if(e.target===dialog||e.target.closest('.copy'))close()});
dialog.addEventListener('close',()=>{if(selected)selected.visible=true;document.body.classList.remove('detail-active');activeButton?.focus();progress=target=0;sceneDirty=true;pointerDirty=true;});
function frameFlight(){
 if(!selected||!dialog.open)return;
 camera.updateMatrixWorld();
 casePivot.position.copy(flightOrigin);casePivot.scale.setScalar(1);casePivot.quaternion.copy(popupCorrection);
 casePivot.updateMatrixWorld(true);
 const size=new THREE.Box3().setFromObject(casePivot).getSize(new THREE.Vector3());
 fromPosition.copy(flightOrigin);
 const vh=camera.top-camera.bottom,vw=camera.right-camera.left,mobile=innerWidth<=600;
 finalZoom=vh*(mobile?.40:.70)/size.y;
 // Move the model center on a straight screen-space line; keep the camera fixed.
 toPosition.set(mobile?0:-vw*.24,camera.position.y+(mobile?vh*.22:0),flightOrigin.z);
 previewCamera.copy(camera);previewCamera.zoom=1;previewCamera.updateProjectionMatrix();
}
function open(p,button){
 if(dialog.open||!objects.has(p.slot))return;
 activeButton=button;selected=objects.get(p.slot);
 dialog.querySelector('h2').textContent=p.title;dialog.querySelector('.copy p').textContent=p.description;
 const launch=document.querySelector('#launch');launch.href=p.sourceOnly?`https://github.com/brbsq/${p.repo}`:`https://brbsq.github.io/${p.path||p.repo+'/'}`;launch.setAttribute('aria-label',`Open ${p.title}`);
 if(casePivot)previewScene.remove(casePivot);
 selected.updateWorldMatrix(true,true);
 const clone=selected.clone(true);selected.matrixWorld.decompose(clone.position,clone.quaternion,clone.scale);
 const center=new THREE.Box3().setFromObject(selected).getCenter(new THREE.Vector3());
 popupCorrection.copy(shelfPivot.quaternion).invert();flightOrigin.copy(center);
 casePivot=new THREE.Group();casePivot.position.copy(center);clone.position.sub(center);casePivot.add(clone);previewScene.add(casePivot);
 dialog.style.setProperty('--reveal',0);dialog.dataset.phase='opening';dialog.showModal();document.body.classList.add('detail-active');selected.visible=false;
 progress=0;target=1;sceneDirty=true;popupDirty=true;pointerDirty=true;resize();frameFlight();
}
for(const p of projects){const button=document.createElement('button');button.setAttribute('aria-label',`Explore ${p.title}`);button.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')hoveredSlot=p.slot});button.addEventListener('pointerleave',()=>{if(hoveredSlot===p.slot)hoveredSlot=null});button.addEventListener('focus',()=>{if(button.matches(':focus-visible'))hoveredSlot=p.slot});button.addEventListener('blur',()=>{if(hoveredSlot===p.slot)hoveredSlot=null});button.onclick=()=>open(p,button);document.querySelector('#projects').append(button);buttons.set(p.slot,button)}
function resize(){
 if(!renderer)return;
 sceneDirty=popupDirty=pointerDirty=true;
 const w=innerWidth,h=innerHeight,aspect=w/h;
 renderer.setSize(w,h);previewRenderer.setSize(w,h);
 const width=Math.max(1.65,1.65*aspect/(16/9)),height=width/aspect;
 Object.assign(camera,{left:-width/2,right:width/2,top:height/2,bottom:-height/2});camera.updateProjectionMatrix();camera.position.set(0,.35,3);camera.lookAt(0,.35,0);camera.updateMatrixWorld();
 updateHotspots();
 if(dialog.open)frameFlight();
}
function updateHotspots(){
 const w=innerWidth,h=innerHeight;
 for(const [slot,obj]of objects){const hoverY=obj.position.y;obj.position.y=caseRestY.get(slot);obj.updateWorldMatrix(true,true);const b=new THREE.Box3().setFromObject(obj);b.union(b.clone().translate(new THREE.Vector3(0,.018,0).applyQuaternion(shelfPivot.quaternion)));obj.position.y=hoverY;obj.updateWorldMatrix(true,true);const min=new THREE.Vector3(Infinity,Infinity,Infinity),max=new THREE.Vector3(-Infinity,-Infinity,-Infinity);for(let i=0;i<8;i++){const v=new THREE.Vector3(i&1?b.max.x:b.min.x,i&2?b.max.y:b.min.y,i&4?b.max.z:b.min.z).project(camera);min.min(v);max.max(v)}const btn=buttons.get(slot);Object.assign(btn.style,{left:(min.x+1)*w/2+'px',top:(1-max.y)*h/2+'px',width:(max.x-min.x)*w/2+'px',height:(max.y-min.y)*h/2+'px'})}
}
const brand=document.querySelector('h1');brand.addEventListener('pointermove',e=>{const b=brand.getBoundingClientRect();brand.style.setProperty('--glow-x',e.clientX-b.left+'px');brand.style.setProperty('--glow-y',e.clientY-b.top+'px')});
try{
 renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0,0);renderer.transmissionResolutionScale=.5;document.querySelector('#scene').append(renderer.domElement);scene=new THREE.Scene();lighting(scene);camera=new THREE.OrthographicCamera();camera.near=.01;camera.far=20;
 previewCamera=new THREE.OrthographicCamera();previewRenderer=new THREE.WebGLRenderer({alpha:true,antialias:true});previewRenderer.setPixelRatio(Math.min(devicePixelRatio,1.5));previewRenderer.transmissionResolutionScale=.5;document.querySelector('#case-preview').append(previewRenderer.domElement);
 new GLTFLoader().load(asset('./models/shelf-with-slots.glb'),g=>{model=g.scene;shelfPivot=new THREE.Group();shelfPivot.position.set(0,.289,0);model.position.y=-.289;shelfPivot.add(model);scene.add(shelfPivot);installShelfGlow();for(const p of projects){const o=model.getObjectByName('Slot_'+p.slot);if(o){objects.set(p.slot,o);caseRestY.set(p.slot,o.position.y);installCaseEffects(p.slot,o)}}document.querySelector('#status').hidden=true;resize()},undefined,()=>{document.querySelector('#status').textContent='The shelf could not load. Please reload to try again.'});
 renderer.setAnimationLoop(time=>{
 const dt=Math.min((time-lastTime)/1000,.1);lastTime=time;
 if(document.hidden)return;
 if(pendingCursorLight){cursorLight.style.transform=`translate3d(${cursorX-120}px,${cursorY-120}px,0)`;cursorLight.classList.add('visible');pendingCursorLight=false}
 updateCaseHover(dt);updateShelfGlow(dt);
 if(dialog.open&&(progress!==target||popupDirty)){
  progress=reduced.matches?target:THREE.MathUtils.clamp(progress+(target?1:-1)*dt/transitionSeconds,0,1);
  const t=progress*progress*progress*(progress*(progress*6-15)+10);
  casePivot.position.lerpVectors(fromPosition,toPosition,t);
  casePivot.scale.setScalar(THREE.MathUtils.lerp(1,finalZoom,t));casePivot.quaternion.copy(popupCorrection);
  dialog.style.setProperty('--reveal',t);document.body.style.setProperty('--reveal',t);
  previewRenderer.render(previewScene,previewCamera);countDraw('popupDraws');popupDirty=false;
  if(progress===0&&target===0){selected.visible=true;dialog.close();sceneDirty=true}else if(progress===1)dialog.dataset.phase='open';
 }
 if(sceneDirty){renderer.render(scene,camera);countDraw('shelfDraws');sceneDirty=false}
 });resize();addEventListener('resize',resize);
}catch(e){document.querySelector('#status').textContent='3D is unavailable in this browser.';document.querySelector('#projects').hidden=true;console.error(e)}

// A subtle pointer light, independent of the acrylic material highlight.
const cursorLight=document.createElement('div');
cursorLight.className='cursor-light';cursorLight.setAttribute('aria-hidden','true');
document.body.append(cursorLight);
function moveCursorLight(event){
 if(event.pointerType==='touch')return;
 cursorX=event.clientX;cursorY=event.clientY;pendingCursorLight=true;
}
document.addEventListener('pointermove',moveCursorLight);
document.documentElement.addEventListener('pointerleave',()=>cursorLight.classList.remove('visible'));
addEventListener('blur',()=>cursorLight.classList.remove('visible'));
// Modal dialogs occupy the top layer; keep the light in that same layer.
dialog.addEventListener('close',()=>document.body.append(cursorLight));
const syncCursorLight=new MutationObserver(()=>{
 const host=dialog.open?dialog:document.body;
 if(cursorLight.parentElement!==host)host.append(cursorLight);
});
syncCursorLight.observe(dialog,{attributes:true,attributeFilter:['open']});

const launchGlow=document.querySelector('#launch');
launchGlow.addEventListener('pointermove',event=>{
 const bounds=launchGlow.getBoundingClientRect();
 launchGlow.style.setProperty('--glow-x',event.clientX-bounds.left+'px');
 launchGlow.style.setProperty('--glow-y',event.clientY-bounds.top+'px');
});
