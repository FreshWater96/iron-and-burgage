import * as T from 'three';
import type {Point,Road} from '../sim/data/ResourceTypes';
import {heightAt} from '../world/height';
const scratch = new T.Vector3();
export interface SampledRoad {road:Road; samples:Float32Array; length:number; valid:boolean; reason:string; radius:number; grade:number}
export function sampleRoad(road:Road):SampledRoad {
 const curve=new T.CatmullRomCurve3(road.points.map(p=>new T.Vector3(p[0],0,p[1])),false,'centripetal');
 const length=curve.getLength(),steps=Math.max(8,Math.ceil(length/1.5)),out=new Float32Array((steps+1)*3);
 let maxGrade=0,minRadius=Infinity;
 for(let i=0;i<=steps;i++){curve.getPointAt(i/steps,scratch);const k=i*3;out[k]=scratch.x;out[k+1]=heightAt(scratch.x,scratch.z)+.12;out[k+2]=scratch.z;
  if(i>0){const run=Math.hypot(out[k]-out[k-3],out[k+2]-out[k-1]);maxGrade=Math.max(maxGrade,Math.abs(out[k+1]-out[k-2])/Math.max(.01,run));}
  if(i>1){const ax=out[k-3]-out[k-6],az=out[k-1]-out[k-4],bx=out[k]-out[k-3],bz=out[k+2]-out[k-1];const twiceArea=Math.abs(ax*bz-az*bx);if(twiceArea>1e-5)minRadius=Math.min(minRadius,Math.hypot(ax,az)*Math.hypot(bx,bz)*Math.hypot(ax+bx,az+bz)/(2*twiceArea));}
 }
 const valid=road.kind!=='rail'||maxGrade<=.04&&minRadius>=22;
 return {road,samples:out,length,valid,reason:maxGrade>.04?'Rail grade exceeds 4%':minRadius<22?'Rail curve radius is below 22 m':'',radius:minRadius,grade:maxGrade};
}
export function ribbon(samples:Float32Array,width:number,lift=0) {
 const count=samples.length/3,positions=new Float32Array(count*6),uvs=new Float32Array(count*4),indices:number[]=[];
 for(let i=0;i<count;i++) {const p=i*3,a=Math.max(0,i-1)*3,b=Math.min(count-1,i+1)*3,dx=samples[b]-samples[a],dz=samples[b+2]-samples[a+2],l=Math.hypot(dx,dz)||1,nx=-dz/l*width*.5,nz=dx/l*width*.5;
  positions.set([samples[p]+nx,samples[p+1]+lift,samples[p+2]+nz,samples[p]-nx,samples[p+1]+lift,samples[p+2]-nz],i*6);uvs.set([0,i/4,1,i/4],i*4);
  if(i<count-1){const j=i*2;indices.push(j,j+2,j+1,j+1,j+2,j+3);}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3));g.setAttribute('uv',new T.BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function nearestRoad(roads:SampledRoad[],x:number,z:number,kind='road') {
 let distance=Infinity,rx=x,rz=z,angle=0;
 for(const r of roads){if(r.road.kind!==kind)continue;const s=r.samples;for(let i=0;i<s.length-3;i+=3){const dx=s[i+3]-s[i],dz=s[i+5]-s[i+2],t=Math.max(0,Math.min(1,((x-s[i])*dx+(z-s[i+2])*dz)/(dx*dx+dz*dz))),px=s[i]+dx*t,pz=s[i+2]+dz*t,d=Math.hypot(px-x,pz-z);if(d<distance){distance=d;rx=px;rz=pz;angle=-Math.atan2(dz,dx);}}}
 return {distance,x:rx,z:rz,angle};
}
