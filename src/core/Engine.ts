import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {Terrain} from '../world/Terrain';
import {Environment} from '../world/Environment';
import {createScenario} from '../world/Scenario';
import {heightAt,onLand} from '../world/height';
import {InstanceRegistry,ProceduralBuilding} from '../geometry/ProceduralBuilding';
import {sampleRoad,ribbon,nearestRoad,type SampledRoad} from '../geometry/SplineNetwork';
import {subdivideParcel,validQuadrilateral,triangulate} from '../geometry/ParcelSubdivider';
import {BUILDINGS} from '../sim/data/EraDefinitions';
import type {Building,Point,Road,Parcel,SaveData} from '../sim/data/ResourceTypes';
import {WorkerBridge} from './WorkerBridge';
import {AgentRenderer} from './AgentRenderer';
import {InputManager} from './InputManager';
import {CanvasSceneRenderer} from './CanvasSceneRenderer';
import {useGame,notify} from '../ui/store';
const v=new T.Vector3(),dummy=new T.Object3D();
export class Engine {
 scene=new T.Scene();camera=new T.PerspectiveCamera(40,1,.5,1100);renderer:T.WebGLRenderer|CanvasSceneRenderer;controls:OrbitControls;terrain:Terrain;environment:Environment;input:InputManager;
 batch=new InstanceRegistry();builder=new ProceduralBuilding(this.batch);bridge=new WorkerBridge();agents:AgentRenderer;
 roads:Road[]=[];sampled:SampledRoad[]=[];buildings:Building[]=[];parcels:Parcel[]=[];
 infrastructure=new T.Group();debug=new T.Group();navDebug=new T.Group();preview=new T.Group();selection:T.Mesh;cursor:T.Mesh;draft:Point[]=[];nextId=0;nextRoadId=100;lastTool='select';
 frame=0;lastTime=0;fpsTime=0;frames=0;navPos:number[]=[];navIdx:number[]=[];resizeObserver:ResizeObserver;
 constructor(readonly element:HTMLElement){
  const probe=document.createElement('canvas');const context=probe.getContext('webgl2',{antialias:true});this.renderer=context?new T.WebGLRenderer({canvas:probe,context,antialias:true,alpha:false,powerPreference:'high-performance'}):new CanvasSceneRenderer();this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;element.appendChild(this.renderer.domElement);
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.09;this.controls.maxPolarAngle=Math.PI*.46;this.controls.minPolarAngle=.25;this.controls.minDistance=35;this.controls.maxDistance=430;this.controls.maxTargetRadius=190;this.controls.mouseButtons={LEFT:T.MOUSE.ROTATE,MIDDLE:T.MOUSE.ROTATE,RIGHT:T.MOUSE.PAN};this.home();
  this.terrain=new Terrain(this.scene);this.environment=new Environment(this.scene);this.agents=new AgentRenderer(this.scene);this.scene.add(this.batch.group,this.infrastructure,this.debug,this.preview,this.navDebug);this.debug.visible=false;this.navDebug.visible=false;
  this.selection=new T.Mesh(new T.RingGeometry(8,8.3,64).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:0xded5a8,transparent:true,opacity:.95,depthWrite:false}));this.selection.visible=false;this.selection.userData.dynamic=true;this.scene.add(this.selection);
  this.cursor=new T.Mesh(new T.RingGeometry(3.5,3.7,40).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:0xe2d6a9,depthTest:false,transparent:true,opacity:.9}));this.cursor.visible=false;this.cursor.renderOrder=20;this.cursor.userData.dynamic=true;this.preview.userData.dynamic=true;this.navDebug.userData.dynamic=true;this.debug.userData.dynamic=true;this.scene.add(this.cursor);
  this.createScenario();this.input=new InputManager(this.renderer.domElement,this.camera,this.terrain.mesh,this.controls);this.input.onClick=p=>this.click(p);this.input.onMove=p=>this.hover(p);this.input.onKey=k=>this.key(k);
  this.bridge.onMessage=m=>{if(m.type==='snapshot'){useGame.setState({snapshot:m.snapshot});this.agents.receive(m.snapshot.agents);}if(m.type==='notice')notify(m.message);if(m.type==='built'){this.buildings.push(...m.buildings);if(m.parcel)this.parcels.push(m.parcel);this.rebuild();notify(`${m.buildings.length===1?m.buildings[0].name:m.buildings.length+' worker cottages'} constructed`);}if(m.type==='paid'){this.roads.push(m.road);this.rebuild();this.syncRoads();notify(`${m.road.kind==='rail'?'Railway':m.road.kind==='trench'?'Trench':'Road'} constructed`);}if(m.type==='saved'){try{const save:SaveData={version:1,buildings:this.buildings,roads:this.roads,parcels:this.parcels,sim:m.sim};localStorage.setItem('iron-burgage-save-v1',JSON.stringify(save));notify('Settlement saved in this browser.');}catch{notify('Storage unavailable. Your browser could not save the settlement.');}}if(m.type==='nav'){this.navPos=m.positions;this.navIdx=m.indices;this.refreshNavDebug();}};
  this.bridge.init(this.buildings,this.roadArrays());useGame.setState({command:(a,value)=>this.command(a,value),ready:true,software:this.renderer instanceof CanvasSceneRenderer});
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(element);this.resize();this.frame=requestAnimationFrame(this.animate);
 }
 createScenario(){
  const scenario=createScenario();this.buildings=scenario.buildings;this.roads=scenario.roads;this.parcels=scenario.parcels;this.nextId=scenario.nextId;
  this.rebuild();
 }
 home(){this.camera.position.set(175,175,220);this.controls.target.set(-25,0,0);this.controls.update();}
 resize(){const w=this.element.clientWidth,h=this.element.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
 roadArrays(){return this.sampled.filter(r=>r.road.kind==='road').map(r=>r.samples);}
 syncRoads(){this.bridge.send({type:'roads',roads:this.roadArrays().map(s=>Array.from(s))});}
 disposeGroup(group:T.Group){for(const o of [...group.children]){group.remove(o);o.traverse(c=>{if(c instanceof T.Mesh||c instanceof T.Line){c.geometry.dispose();if(Array.isArray(c.material))c.material.forEach(m=>m.dispose());else c.material.dispose();}});}}
 rebuild(){
  this.batch.clear();this.disposeGroup(this.infrastructure);this.disposeGroup(this.debug);this.sampled=this.roads.map(sampleRoad);
  const roads:T.BufferGeometry[]=[],rails:T.BufferGeometry[]=[],railBed:T.BufferGeometry[]=[],trenches:T.BufferGeometry[]=[];
  for(const rd of this.sampled){const s=rd.samples;if(rd.road.kind==='road'){roads.push(ribbon(s,5));for(let i=0;i<s.length;i+=6)this.terrain.splat.paint(s[i],s[i+2],4,2,.8);}else if(rd.road.kind==='rail'){
    railBed.push(ribbon(s,4));for(const off of [-.8,.8]){const shifted=s.slice();for(let i=0;i<s.length;i+=3){const a=Math.max(0,i-3),b=Math.min(s.length-3,i+3),dx=s[b]-s[a],dz=s[b+2]-s[a+2],l=Math.hypot(dx,dz)||1;shifted[i]+=-dz/l*off;shifted[i+2]+=dx/l*off;}rails.push(ribbon(shifted,.17,.16));}
    for(let i=0;i<s.length-3;i+=3){const angle=-Math.atan2(s[i+5]-s[i+2],s[i+3]-s[i]);this.batch.add('box',s[i],s[i+1]+.03,s[i+2],.28,.2,2.8,0x6a614d,angle);}
   }else{trenches.push(ribbon(s,3,-1));this.terrain.trench(s);for(let i=0;i<s.length;i+=3){this.batch.add('box',s[i],s[i+1]-.7,s[i+2],1.5,.12,2,0x796b4d);this.batch.add('box',s[i]+2,s[i+1]+.3,s[i+2],1,.7,1.5,0x9b9674);}}
   const points:number[]=[];for(let i=0;i<s.length-3;i+=3)points.push(s[i],s[i+1]+.35,s[i+2],s[i+3],s[i+4]+.35,s[i+5]);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));this.debug.add(new T.LineSegments(g,new T.LineBasicMaterial({color:rd.road.kind==='rail'?0xe4a45f:0xd5db7d,depthTest:false})));
  }
  const addMerged=(gs:T.BufferGeometry[],c:number)=>{if(!gs.length)return;const g=mergeGeometries(gs);if(!g)return;const m=new T.Mesh(g,new T.MeshStandardMaterial({color:c,roughness:1,side:T.DoubleSide}));m.receiveShadow=true;this.infrastructure.add(m);gs.forEach(g=>g.dispose());};addMerged(roads,0xa99e80);addMerged(railBed,0x797c6c);addMerged(rails,0x737d76);addMerged(trenches,0x3b3c2f);
  for(const p of this.parcels)for(const lot of subdivideParcel(p.points,p.width)){this.builder.fence(lot.polygon);const vtx=lot.polygon.map(p=>new T.Vector3(p[0],heightAt(...p)+.3,p[1]));vtx.push(vtx[0].clone());this.debug.add(new T.Line(new T.BufferGeometry().setFromPoints(vtx),new T.LineBasicMaterial({color:0xeadb82,depthTest:false})));}
  for(const b of this.buildings){this.builder.building(b);if(['mine','iron','foundry','workshop'].includes(b.kind))this.terrain.splat.paint(b.x,b.z,24,4,.85);}
  this.builder.scenery(this.sampled,this.buildings);this.batch.flush();this.environment.setBuildings(this.buildings);if(this.renderer instanceof CanvasSceneRenderer)this.renderer.invalidate();useGame.setState({buildings:[...this.buildings]});
 }
 refreshNavDebug(){this.disposeGroup(this.navDebug);if(!this.navPos.length)return;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.navPos,3));g.setIndex(this.navIdx);const m=new T.Mesh(g,new T.MeshBasicMaterial({color:0x77d9ce,transparent:true,opacity:.22,wireframe:true,depthTest:false}));m.position.y=.3;this.navDebug.add(m);}
 command(action:string,value?:any){
  const state=useGame.getState();if(action==='tool'){useGame.setState({tool:value,selected:null,step:0});this.draft=[];this.disposeGroup(this.preview);this.controls.mouseButtons.LEFT=value==='select'?T.MOUSE.ROTATE:undefined as unknown as T.MOUSE;return;}
  if(action==='speed'){useGame.setState({speed:value});this.bridge.send({type:'speed',value});}
  if(action==='home')this.home();if(action==='zoom'){this.camera.position.sub(this.controls.target).multiplyScalar(value).add(this.controls.target);this.controls.update();}
  if(action==='debug'){useGame.setState({debug:!state.debug});this.debug.visible=!state.debug;this.navDebug.visible=!state.debug;}
  if(action==='save')this.bridge.send({type:'save'});
  if(action==='load'){try{const raw=localStorage.getItem('iron-burgage-save-v1');if(!raw){notify('No saved settlement found in this browser.');return;}const s=JSON.parse(raw) as SaveData;if(s.version!==1||!Array.isArray(s.buildings)||s.buildings.length>256||!Array.isArray(s.roads)||!s.sim)throw new Error('Invalid save');this.buildings=s.buildings;this.roads=s.roads;this.parcels=s.parcels;this.nextId=Math.max(...this.buildings.map(b=>b.id))+1;this.nextRoadId=Math.max(100,...this.roads.map(r=>r.id))+1;this.draft=[];this.rebuild();this.bridge.init(this.buildings,this.roadArrays(),s.sim);notify('Settlement restored. Freight reservations recalculated.');}catch{notify('This save could not be read.');}}
  if(action==='pause-building'){this.bridge.send({type:'pause-building',id:value});const b=this.buildings.find(b=>b.id===value);if(b){b.active=!b.active;this.environment.setBuildings(this.buildings);useGame.setState({buildings:[...this.buildings]});}}
  if(action==='focus'){const b=this.buildings.find(b=>b.id===value);if(b){const dx=b.x-this.controls.target.x,dz=b.z-this.controls.target.z;this.controls.target.x=b.x;this.controls.target.z=b.z;this.camera.position.x+=dx;this.camera.position.z+=dz;useGame.setState({selected:b.id,overview:false});}}
  if(action==='finish')this.finish();if(action==='cancel'){this.draft=[];this.disposeGroup(this.preview);useGame.setState({step:0});}
 }
 key(k:string){if(!this.element.clientWidth)return;const state=useGame.getState();if(state.help||state.overview)return;if(k==='escape'){this.command('cancel');this.command('tool','select');}if(k==='enter')this.finish();if(k===' ')this.command('speed',state.speed?0:1);if(k==='r')useGame.setState({rotation:state.rotation+Math.PI/4});if(k==='f3')this.command('debug');if(k==='h')this.home();}
 click(p:T.Vector3){const state=useGame.getState(),tool=state.tool,x=p.x,z=p.z;
  if(tool==='select'){let best:Building|undefined,min=Infinity;for(const b of this.buildings){const d=Math.hypot(x-b.x,z-b.z);if(d<BUILDINGS[b.kind].size&&d<min){best=b;min=d;}}useGame.setState({selected:best?.id??null});return;}
  if(!onLand(x,z)&&tool!=='road'&&tool!=='rail'){notify('Choose dry land inside the settlement boundary.');return;}
  if(tool==='parcel'){let point:Point=[x,z];if(this.draft.length<2){const n=nearestRoad(this.sampled,x,z);if(n.distance>14){notify('Place the first two corners along an existing road.');return;}const angle=-n.angle,nx=-Math.sin(angle),nz=Math.cos(angle),side=((x-n.x)*nx+(z-n.z)*nz)>=0?1:-1;point=[n.x+nx*side*4,n.z+nz*side*4];}this.draft.push(point);useGame.setState({step:this.draft.length});if(this.draft.length===4)this.finish();else this.hover(p);return;}
  if(tool==='road'||tool==='rail'||tool==='trench'){let point:Point=[x,z];const n=nearestRoad(this.sampled,x,z,tool==='rail'?'rail':'road');if(n.distance<5)point=[n.x,n.z];if(this.draft.length&&Math.hypot(x-this.draft[this.draft.length-1][0],z-this.draft[this.draft.length-1][1])<4)return;this.draft.push(point);useGame.setState({step:this.draft.length});this.hover(p);return;}
  const def=BUILDINGS[tool];if(!def)return;const n=nearestRoad(this.sampled,x,z);if(n.distance>25){notify('Build within 25 m of a connected road for wagon access.');return;}if(!this.clearance(x,z,def.size)){notify('This site overlaps an existing building.');return;}if(this.nextId>=256){notify('Prototype building limit reached.');return;}
  const b:Building={id:this.nextId++,kind:tool,x,z,rotation:n.angle+state.rotation,name:def.label,active:true};this.bridge.send({type:'build',buildings:[b],cost:def.cost,timber:def.timber});
 }
 clearance(x:number,z:number,size:number){return !this.buildings.some(b=>Math.hypot(x-b.x,z-b.z)<(BUILDINGS[b.kind].size+size)*.5+1);}
 finish(){const state=useGame.getState(),tool=state.tool;
  if(tool==='parcel'){
   if(!validQuadrilateral(this.draft)){notify('Use four corners forming a simple parcel of at least 40 m².');this.command('cancel');return;}const lots=subdivideParcel(this.draft,state.lotWidth),build:Building[]=[];
   for(const l of lots)if(l.area>=40&&onLand(...l.center)&&this.clearance(...l.center,BUILDINGS[state.housingTier].size))build.push({id:this.nextId++,kind:state.housingTier,x:l.center[0],z:l.center[1],rotation:l.angle,name:BUILDINGS[state.housingTier].label,active:true});
   if(!build.length||this.nextId>=256){notify('No clear, road-facing lots fit here. Try a larger empty parcel.');this.command('cancel');return;}
   const housingDef=BUILDINGS[state.housingTier],money=state.snapshot?.money??0,timber=state.snapshot?.totals[2]??0;if(money<build.length*housingDef.cost||timber<build.length*housingDef.timber){notify('Not enough treasury or timber for this parcel.');this.command('cancel');return;}
   this.bridge.send({type:'build',buildings:build,cost:build.length*housingDef.cost,timber:build.length*housingDef.timber,parcel:{points:this.draft.map(p=>[...p] as Point),width:state.lotWidth}});this.draft=[];this.disposeGroup(this.preview);useGame.setState({step:0});return;
  }
  if((tool==='road'||tool==='rail'||tool==='trench')&&this.draft.length>=2){const road:Road={id:this.nextRoadId++,kind:tool,points:this.draft.map(p=>[...p] as Point)},sampled=sampleRoad(road);if(!sampled.valid){notify(sampled.reason);return;}if(sampled.length<8){notify('A route must be at least 8 m long.');return;}this.bridge.send({type:'spend',cost:Math.ceil(sampled.length*(tool==='rail'?5:tool==='trench'?2:1)),road});this.draft=[];this.disposeGroup(this.preview);useGame.setState({step:0});}
 }
 hover(p:T.Vector3){const state=useGame.getState(),tool=state.tool;this.cursor.visible=tool!=='select';this.cursor.position.set(p.x,p.y+.3,p.z);if(tool==='select')return;this.disposeGroup(this.preview);
  const draft=this.draft.concat([[p.x,p.z]]);if(['road','rail','trench'].includes(tool)&&draft.length>=2){const s=sampleRoad({id:-1,kind:tool as Road['kind'],points:draft}),m=new T.Mesh(ribbon(s.samples,tool==='rail'?4:5,.1),new T.MeshBasicMaterial({color:s.valid?0xd9d8a4:0xc9604b,transparent:true,opacity:.7,side:T.DoubleSide,depthTest:false}));this.preview.add(m);}
  if(tool==='parcel'&&draft.length>=2){const ps=draft.map(a=>new T.Vector3(a[0],heightAt(...a)+.4,a[1]));ps.push(ps[0].clone());this.preview.add(new T.Line(new T.BufferGeometry().setFromPoints(ps),new T.LineBasicMaterial({color:0xe5d399,depthTest:false})));if(draft.length===4&&validQuadrilateral(draft)){for(const lot of subdivideParcel(draft,state.lotWidth)){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(lot.polygon.flatMap(p=>[p[0],heightAt(...p)+.25,p[1]]),3));g.setIndex(triangulate(lot.polygon));this.preview.add(new T.Mesh(g,new T.MeshBasicMaterial({color:0xe6d39d,transparent:true,opacity:.35,side:T.DoubleSide,depthTest:false})));}}}
  const def=BUILDINGS[tool as keyof typeof BUILDINGS];if(def&&tool!=='parcel'){const valid=onLand(p.x,p.z)&&this.clearance(p.x,p.z,def.size)&&nearestRoad(this.sampled,p.x,p.z).distance<=25;const m=new T.Mesh(new T.BoxGeometry(def.size,3,def.size),new T.MeshBasicMaterial({color:valid?0xd4d1a2:0xb9634d,wireframe:true,depthTest:false}));m.position.set(p.x,p.y+1.5,p.z);m.rotation.y=state.rotation;this.preview.add(m);}
 }
 animate=(now:number)=>{if(!this.element.clientWidth){this.lastTime=now;this.frame=requestAnimationFrame(this.animate);return;}const dt=Math.min(.05,(now-this.lastTime)/1000||.016);this.lastTime=now;const state=useGame.getState();this.input.update(dt);this.controls.update();this.environment.update(now/1000);this.terrain.waterTime.value=now/1000;const month=(Math.floor((state.snapshot?.time??0)/60)+3)%12;this.terrain.splat.winter.value=month===11?.45:month===0?.35:month===1?.15:0;
  this.agents.update(dt);const b=state.selected===null?undefined:this.buildings.find(b=>b.id===state.selected);this.selection.visible=!!b;if(b){this.selection.position.set(b.x,heightAt(b.x,b.z)+.25,b.z);this.selection.scale.setScalar(BUILDINGS[b.kind].size/9);}
  this.renderer.render(this.scene,this.camera);this.frames++;if(now-this.fpsTime>1000){useGame.setState({fps:Math.round(this.frames*1000/(now-this.fpsTime)),draws:this.renderer.info.render.calls});this.frames=0;this.fpsTime=now;}this.frame=requestAnimationFrame(this.animate);
 };
 dispose(){cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();this.input.dispose();this.controls.dispose();this.bridge.dispose();this.scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});this.renderer.dispose();this.renderer.domElement.remove();}
}
