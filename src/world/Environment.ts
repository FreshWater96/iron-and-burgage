import * as T from 'three';
import {heightAt} from './height';
import type {Building} from '../sim/data/ResourceTypes';
const dummy=new T.Object3D();
export class Environment {
 smoke:T.InstancedMesh; sources:number[]=[]; sun:T.DirectionalLight;
 constructor(scene:T.Scene){
  scene.background=new T.Color(0xc5ccba);scene.fog=new T.FogExp2(0xc5ccba,.0018);
  scene.add(new T.HemisphereLight(0xe7ead8,0x77775c,2.2));this.sun=new T.DirectionalLight(0xffe2ae,3.1);this.sun.position.set(-100,170,80);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-230,right:230,top:230,bottom:-230,near:1,far:500});this.sun.shadow.bias=-.0005;this.sun.shadow.normalBias=.5;scene.add(this.sun);
  this.smoke=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),new T.MeshBasicMaterial({color:0x8c8e7f,transparent:true,opacity:.14,depthWrite:false}),240);this.smoke.count=0;this.smoke.frustumCulled=false;this.smoke.userData.dynamic=true;this.smoke.userData.smoke=true;scene.add(this.smoke);
 }
 setBuildings(bs:Building[]){this.sources=[];for(const b of bs)if(b.active&&(b.kind==='foundry'||b.kind==='workshop'))this.sources.push(b.x-(b.kind==='foundry'?6.4:4),heightAt(b.x,b.z)+(b.kind==='foundry'?22:13),b.z-(b.kind==='foundry'?4.8:3.2));}
 update(time:number){let count=0;for(let s=0;s<this.sources.length;s+=3)for(let i=0;i<22;i++){const t=(time*.065+i/22)%1,scale=1+t*4;dummy.position.set(this.sources[s]+t*15+Math.sin(i*4)*t*2,this.sources[s+1]+t*22,this.sources[s+2]+t*6);dummy.scale.set(scale,scale*.8,scale);dummy.rotation.set(t,0,t);dummy.updateMatrix();this.smoke.setMatrixAt(count++,dummy.matrix);}this.smoke.count=count;this.smoke.instanceMatrix.needsUpdate=true;}
}
