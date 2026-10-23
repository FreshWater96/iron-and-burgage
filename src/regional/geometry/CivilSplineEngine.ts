import {CatmullRomCurve3,Vector3} from 'three';
import type {XY} from '../types';
const v=new Vector3();
export interface CivilProfile {samples:Float64Array;length:number;maxGrade:number;minRadius:number;valid:boolean;structures:{x:number;z:number;height:number;kind:'embankment'|'viaduct'|'cutting'|'tunnel'}[]}
export function civilProfile(points:XY[],height:(x:number,z:number)=>number,narrow=false,designHeight?:number):CivilProfile{
 const curve=new CatmullRomCurve3(points.map(p=>new Vector3(p[0],0,p[1])),false,'centripetal'),length=curve.getLength(),steps=Math.max(4,Math.ceil(length/150)),samples=new Float64Array((steps+1)*3),structures:CivilProfile['structures']=[];let maxGrade=0,minRadius=Infinity;
 for(let i=0;i<=steps;i++){curve.getPointAt(i/steps,v);const k=i*3,ground=height(v.x,v.z),y=designHeight??Math.max(3,ground);samples[k]=v.x;samples[k+1]=y;samples[k+2]=v.z;const diff=y-ground;if(diff>4)structures.push({x:v.x,z:v.z,height:diff,kind:ground<0||diff>=12?'viaduct':'embankment'});else if(diff< -3)structures.push({x:v.x,z:v.z,height:-diff,kind:-diff>=12?'tunnel':'cutting'});
 if(i){const run=Math.hypot(samples[k]-samples[k-3],samples[k+2]-samples[k-1]);maxGrade=Math.max(maxGrade,Math.abs(y-samples[k-2])/Math.max(.001,run));}if(i>1){const ax=samples[k-3]-samples[k-6],az=samples[k-1]-samples[k-4],bx=samples[k]-samples[k-3],bz=samples[k+2]-samples[k-1],cross=Math.abs(ax*bz-az*bx);if(cross>1e-4)minRadius=Math.min(minRadius,Math.hypot(ax,az)*Math.hypot(bx,bz)*Math.hypot(ax+bx,az+bz)/(2*cross));}}
 return {samples,length,maxGrade,minRadius,valid:maxGrade<=(narrow?.05:.025)&&minRadius>=(narrow?80:300),structures};
}
export function draftClearance(depth:number,tide:number,draft:number,margin=.3){return depth+tide-draft-margin;}
