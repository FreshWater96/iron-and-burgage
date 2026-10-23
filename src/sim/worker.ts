import {WorldECS} from './WorldECS';
import {NavMeshManager} from './NavMeshManager';
import type {Building,SimSave} from './data/ResourceTypes';
const sim=new WorldECS(),nav=new NavMeshManager();let speed=1,ready=false,ticks=0,navVersion=0;
let walkers:number[][]=[],walkIndex=new Uint16Array(18),walkX=new Float32Array(18),walkZ=new Float32Array(18),walkAngle=new Float32Array(18);
async function rebuildNav(){const version=++navVersion;try{const [positions,indices]=await nav.build(sim.buildings);if(version!==navVersion)return;sim.nav='Recast navmesh ready';postMessage({type:'nav',positions,indices});walkers=[];for(let i=0;i<18;i++){const a=sim.buildings[(i*3)%sim.buildings.length],b=sim.buildings[(i*7+4)%sim.buildings.length];const path=nav.route([a.x,a.z+9],[b.x,b.z+9]);walkers.push(path);walkX[i]=path[0]??a.x;walkZ[i]=path[1]??a.z;walkIndex[i]=2;}}catch(err){sim.nav='Road freight active · pedestrian navmesh unavailable';postMessage({type:'notice',message:sim.nav});}}
onmessage=event=>{const m=event.data;
 if(m.type==='init'){sim.init(m.buildings,m.roads.map((s:number[])=>new Float32Array(s)),m.save as SimSave|undefined);ready=true;void rebuildNav();}
 if(m.type==='roads')sim.graph.rebuild(m.roads.map((s:number[])=>new Float32Array(s)));
 if(m.type==='speed')speed=m.value;
 if(m.type==='pause-building'){const b=sim.buildings.find(b=>b.id===m.id);if(b)b.active=!b.active;}
 if(m.type==='build'){const bs=m.buildings as Building[];if(sim.spend(m.cost,m.timber)){sim.buildings.push(...bs);postMessage({type:'built',buildings:bs,parcel:m.parcel});void rebuildNav();}else postMessage({type:'notice',message:'Not enough treasury or unreserved timber.'});}
 if(m.type==='spend'){if(sim.spend(m.cost))postMessage({type:'paid',road:m.road});else postMessage({type:'notice',message:'Not enough funds to construct this route.'});}
 if(m.type==='save')postMessage({type:'saved',sim:sim.save()});
};
setInterval(()=>{
 if(!ready)return;if(speed){for(let i=0;i<speed;i++){sim.tick(.05);for(let j=0;j<walkers.length;j++){const p=walkers[j],idx=walkIndex[j];if(!p||p.length<4)continue;const dx=p[idx]-walkX[j],dz=p[idx+1]-walkZ[j],d=Math.hypot(dx,dz),step=.075;walkAngle[j]=Math.atan2(dx,dz);if(d<step){walkX[j]=p[idx];walkZ[j]=p[idx+1];walkIndex[j]=(idx+2)%p.length;}else{walkX[j]+=dx/d*step;walkZ[j]+=dz/d*step;}}}}
 if(++ticks%5===0){const snapshot=sim.snapshot();for(let j=0;j<walkers.length;j++)snapshot.agents.push(walkX[j],walkZ[j],walkAngle[j],3,0,0);postMessage({type:'snapshot',snapshot});}
},50);
