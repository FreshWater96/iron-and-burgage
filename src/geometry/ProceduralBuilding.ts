import * as T from 'three';
import type { Building,Point } from '../sim/data/ResourceTypes';
import {heightAt,riverX} from '../world/height';
const dummy=new T.Object3D(),color=new T.Color();
export class InstanceRegistry {
 group=new T.Group(); batches=new Map<string,T.InstancedMesh>();
 constructor(){
  const roof=new T.BufferGeometry();roof.setAttribute('position',new T.Float32BufferAttribute([-.5,0,-.5,.5,0,-.5,0,1,-.5, -.5,0,.5,0,1,.5,.5,0,.5, -.5,0,-.5,0,1,-.5,0,1,.5, -.5,0,-.5,0,1,.5,-.5,0,.5, .5,0,-.5,.5,0,.5,0,1,.5, .5,0,-.5,0,1,.5,0,1,-.5],3));roof.scale(-1,1,1);roof.computeVertexNormals();
  for(const [key,g,cap] of [['box',new T.BoxGeometry(1,1,1),30000],['cylinder',new T.CylinderGeometry(.5,.5,1,8),10000],['cone',new T.ConeGeometry(.5,1,7),5000],['roof',roof,3000]] as const){const m=new T.InstancedMesh(g,new T.MeshStandardMaterial({roughness:.94}),cap);m.count=0;m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;this.batches.set(key,m);this.group.add(m);}
 }
 add(shape:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,c:number,ry=0,rz=0){const m=this.batches.get(shape)!;if(m.count>=m.instanceMatrix.count)throw new Error('Scenery capacity reached');dummy.position.set(x,y,z);dummy.rotation.set(0,ry,rz);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();m.setMatrixAt(m.count,dummy.matrix);m.setColorAt(m.count,color.setHex(c));m.count++;}
 clear(){for(const m of this.batches.values())m.count=0;}
 flush(){for(const m of this.batches.values()){m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;}}
}
export class ProceduralBuilding {
 constructor(readonly batch:InstanceRegistry){}
 box(x:number,y:number,z:number,w:number,h:number,d:number,c:number,r=0){this.batch.add('box',x,y,z,w,h,d,c,r);}
 fence(points:Point[],color=0x82755c){for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(len/3),angle=-Math.atan2(b[1]-a[1],b[0]-a[0]);for(let j=0;j<n;j++){const t=(j+.5)/n,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t,y=heightAt(x,z);this.box(x,y+.65,z,len/n,.12,.13,color,angle);this.box(x,y+1.1,z,len/n,.12,.13,color,angle);this.box(x,y+.65,z,.15,1.3,.15,color);}}}
 building(b:Building){
  const {x,z,kind}=b,y=heightAt(x,z),r=b.rotation;
  const local=(a:number,c:number):Point=>[x+a*Math.cos(r)+c*Math.sin(r),z-a*Math.sin(r)+c*Math.cos(r)];
  const box=(a:number,h:number,c:number,w:number,hh:number,d:number,col:number)=>{const p=local(a,c);this.box(p[0],y+h,p[1],w,hh,d,col,r);};
  const roof=(a:number,h:number,c:number,w:number,hh:number,d:number,col=0x485050)=>{const p=local(a,c);this.batch.add('roof',p[0],y+h,p[1],w,hh,d,col,r);};
  const stack=(a:number,c:number,h=15)=>{const p=local(a,c);this.batch.add('cylinder',p[0],y+h*.5,p[1],1.9,h,1.9,0x895b42);this.batch.add('cylinder',p[0],y+h-.2,p[1],2.35,.5,2.35,0x634f3d);};
  if(kind==='croft'){
   box(0,1.8,0,7,3.6,6,0xaaa896);roof(0,3.6,0,7.8,2,6.8,0x4d5759);box(2,5,0,.8,2.8,.9,0x8a8c7e);box(0,1.2,3.03,1.2,2.4,.12,0x627064);for(const a of [-2.3,2.3])box(a,2,3.05,.9,1.1,.1,0x455a59);for(let i=0;i<4;i++)box(-2+i*1.3,.2,-6,.7,.4,4,0x667b4a);return;
  }
  if(kind==='tenement'){
   const stone=b.id%2?0xad795f:0xc0ad8c;box(0,.25,0,10.8,.5,9.6,0x858d7d);box(0,6.7,0,10.2,13,9,stone);roof(0,13.2,0,11,2.8,9.8,0x48565a);for(let floor=0;floor<4;floor++)for(const a of [-3.4,-1.15,1.15,3.4]){box(a,2+floor*3,4.55,1.25,1.75,.12,0x40575a);box(a,1.03+floor*3,4.65,1.5,.18,.35,0xd1bca1);}box(0,1.6,4.65,1.5,3.2,.15,0x4a5750);box(-3.5,15,2,.8,3.5,1,0x92795f);box(3.5,15,2,.8,3.5,1,0x92795f);box(0,1.1,-8,4,2.2,3,0x9c947b);roof(0,2.2,-8,4.5,1.1,3.5);return;
  }
  if(kind==='house'){
   const wall=[0xb59d7c,0xa97654,0xc5b396,0xa69b85][b.id%4];box(0,.25,0,6,.5,7,0x797461);box(0,2.1,0,5.3,3.7,6.2,wall);roof(0,4,0,5.9,1.8,6.8);box(1.4,5,1.4,.65,2.3,.75,0x8c5c41);
   box(0,1.1,3.14,1,2,.13,0x675745);for(const a of [-1.7,1.7]){box(a,2,3.14,.8,1,.15,0x364545);box(a,2,3.24,.08,1,.05,0xceb999);box(a,2,3.25,.8,.08,.05,0xceb999);}box(0,.2,5.5,6,.16,3.4,0x8a795a);
   for(let k=0;k<5;k++)box(-2+k,.3,-6,.35,.3,4,0x647747);
  }else if(kind==='foundry'||kind==='workshop'){
   const w=kind==='foundry'?16:10,d=kind==='foundry'?12:8;box(0,.2,0,w+4,.4,d+5,0x797a65);box(0,3.4,0,w,6.5,d,0x956346);roof(0,6.7,0,w+1,2.1,d+1,0x586060);
   for(let i=-w/2+2;i<w/2;i+=3){box(i,3.5,d/2+.04,1.5,2.2,.16,0x3c5150);box(i,3.5,d/2+.15,.1,2.2,.05,0xb5a281);}box(0,1.8,d/2+.1,2.5,3.6,.1,0x4b5046);stack(-w*.4,-d*.4,kind==='foundry'?22:13);
   box(w*.65,1.5,-2,4,3,5,0x756953);roof(w*.65,3,-2,4.5,1.3,5.5);for(let i=0;i<4;i++)box(w*.6,.35,4+i*.65,4,.55,.4,0x394443);
  }else if(kind==='mine'||kind==='iron'){
   box(0,.2,0,18,.4,15,0x666454);box(0,1.5,0,9,3,8,0x725b42);roof(0,3,0,10,2,9);for(const a of [-2,2])for(const c of [-2,2])box(a,6,c,.45,12,.45,0x554f3c);box(0,10,0,6,.7,6,0x574e3f);box(0,8.5,0,5,.4,5,0x69604d);roof(0,12,0,6,1.5,6);box(-6,1,3,4,2,4,kind==='mine'?0x353a33:0x947352);box(6,.9,4,4,1.8,5,0x4a4f44);
  }else if(kind==='farm'){
   box(0,2,0,8,4,10,0x9b7750);roof(0,4,0,9,3,11,0x71664b);box(0,1.4,5.05,3,2.8,.12,0x514d3c);
   box(15,.04,0,18,.08,26,0x8e8350);for(let i=0;i<12;i++)box(7+i*1.4,.28,0,.65,.5,25,i%3?0xaaa05d:0xb6a464);this.fence([[x+5,z-14],[x+25,z-14],[x+25,z+14],[x+5,z+14]]);
  }else if(kind==='lumber'){
   box(0,1.8,0,11,3.6,8,0x8e7b55);roof(0,3.6,0,12,2,9,0x605e48);for(let k=0;k<10;k++)this.batch.add('cylinder',x+7+(k%3)*1.1,y+.65+Math.floor(k/3)*.8,z,1,7,1,0x8f704a,0,Math.PI/2);
  }else if(kind==='depot'){
   box(0,.4,0,16,.8,12,0x8a8470);box(0,2.8,0,12,4.8,8,0xa79571);roof(0,5.2,0,14,2.4,10,0x535b56);for(let i=-4;i<=4;i+=4)box(i,1.9,4.1,2.4,3,.2,0x615e4e);for(let k=0;k<10;k++)box(-6+k%5*2,1+Math.floor(k/5),7,1.5,1.5,1.5,0x9a8357);
  }else if(kind==='market'){
   box(0,.1,0,17,.2,15,0x99957a);for(let k=0;k<4;k++){const a=k%2*8-4,c=Math.floor(k/2)*8-4;for(const q of [-1.5,1.5])box(a+q,1.1,c,.12,2.2,.12,0x756143);box(a,1,c,3,.9,2,0xa38a5a);roof(a,2.2,c,4,.8,3,k%2?0xb3a373:0x7f8c78);for(let m=0;m<3;m++)box(a-1+m,1.7,c,.65,.5,.9,0x72804c);}box(0,.5,0,1,1,1,0x8d8c76);
  }
 }
 scenery(roads:{samples:Float32Array}[],buildings:Building[]){
  let seed=47123;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<1750;i++){const x=(rnd()-.5)*395,z=(rnd()-.5)*395;if(Math.abs(x-riverX(z))<13)continue;
   let near=false;for(const b of buildings)if(Math.hypot(x-b.x,z-b.z)<(b.kind==='farm'?34:14)){near=true;break;}if(near)continue;
   for(const rd of roads){for(let j=0;j<rd.samples.length;j+=9)if(Math.hypot(x-rd.samples[j],z-rd.samples[j+2])<6){near=true;break;}if(near)break;}if(near)continue;
   const inVillage=x>-115&&x<55&&z>-75&&z<95;if(inVillage&&rnd()>.08)continue;
   const h=6+rnd()*7,y=heightAt(x,z),col=[0x465d39,0x596c40,0x647347,0x757c4d][Math.floor(rnd()*4)];this.batch.add('cylinder',x,y+h*.25,z,.6,h*.5,.6,0x6c6049);
   if(rnd()>.35){this.batch.add('cone',x,y+h*.64,z,h*.63,h*.8,h*.63,col);this.batch.add('cone',x,y+h*.87,z,h*.4,h*.5,h*.4,col);}else{this.batch.add('cone',x,y+h*.65,z,h*.85,h*.8,h*.85,col,0,Math.PI);this.batch.add('cone',x,y+h*.8,z,h*.8,h*.65,h*.8,col);}
  }
  // Village lamp posts, footpaths and the river crossing.
  for(let x=-115;x<60;x+=18){const z=10,y=heightAt(x,z);this.batch.add('cylinder',x,y+2.6,z+5,.18,5.2,.18,0x555a4a);this.box(x,y+5.2,z+5,.6,.65,.6,0xc5b58b);}
  const rx=riverX(10);this.box(rx,0,10,25,.7,7,0x918d77);this.box(rx,.6,6.3,26,.6,.5,0xb4ac91);this.box(rx,.6,13.7,26,.6,.5,0xb4ac91);for(const dx of [-8,0,8])this.box(rx+dx,-1.8,10,2,4,5,0x8b8871);
 }
}
