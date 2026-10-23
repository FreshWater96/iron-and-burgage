import * as T from 'three';
import {heightAt} from '../world/height';
const dummy=new T.Object3D(),col=new T.Color();
/** Rigid-body instancing; no skeletons, per-agent meshes or hot-loop matrices. */
export class AgentRenderer {
 bodies:T.InstancedMesh;wheels:T.InstancedMesh;cargo:T.InstancedMesh;people:T.InstancedMesh;
 target=new Float32Array(40*6);current=new Float32Array(40*6);count=0;
 constructor(scene:T.Scene){
  this.bodies=new T.InstancedMesh(new T.BoxGeometry(2.4,.8,3.8),new T.MeshStandardMaterial({color:0x8b704e,roughness:1}),20);
  this.wheels=new T.InstancedMesh(new T.CylinderGeometry(.65,.65,.25,8).rotateZ(Math.PI/2),new T.MeshStandardMaterial({color:0x434638}),80);
  this.cargo=new T.InstancedMesh(new T.BoxGeometry(1.7,1,2.5),new T.MeshStandardMaterial({roughness:1}),20);
  this.people=new T.InstancedMesh(new T.BoxGeometry(.55,1.3,.5),new T.MeshStandardMaterial({roughness:1}),40);
  for(const m of [this.bodies,this.wheels,this.cargo,this.people]){m.count=0;m.castShadow=true;m.frustumCulled=false;m.userData.dynamic=true;scene.add(m);}
 }
 receive(data:number[]){this.count=Math.min(40,data.length/6);if(!this.current.some(v=>v!==0))this.current.set(data.slice(0,240));this.target.set(data.slice(0,240));}
 update(dt:number){let wagons=0,wheels=0,cargo=0,people=0;const lerp=Math.min(1,dt*12);
  for(let i=0;i<this.count;i++){const k=i*6;this.current[k]+=(this.target[k]-this.current[k])*lerp;this.current[k+1]+=(this.target[k+1]-this.current[k+1])*lerp;const x=this.current[k],z=this.current[k+1],r=this.target[k+2],phase=this.target[k+3],y=heightAt(x,z);dummy.rotation.set(0,r,0);
   if(i<12){dummy.position.set(x,y+1,z);dummy.scale.set(1,1,1);dummy.updateMatrix();this.bodies.setMatrixAt(wagons++,dummy.matrix);
    for(let j=0;j<4;j++){const a=j%2?1.28:-1.28,b=j<2?-1.2:1.2;dummy.position.set(x+a*Math.cos(r)+b*Math.sin(r),y+.65,z-a*Math.sin(r)+b*Math.cos(r));dummy.updateMatrix();this.wheels.setMatrixAt(wheels++,dummy.matrix);}
    if(phase===2){dummy.position.set(x,y+1.75,z);dummy.updateMatrix();this.cargo.setMatrixAt(cargo,dummy.matrix);this.cargo.setColorAt(cargo++,col.setHex([0x3e4641,0x8c7360,0xa89165,0x647477,0xbda56b,0x677c72][this.target[k+4]]));}
   }else{dummy.position.set(x,y+.9,z);dummy.scale.set(1,1,1);dummy.updateMatrix();this.people.setMatrixAt(people,dummy.matrix);this.people.setColorAt(people++,col.setHex(i%3?0x6b7765:0xa38c65));}
  }
  this.bodies.count=wagons;this.wheels.count=wheels;this.cargo.count=cargo;this.people.count=people;for(const m of [this.bodies,this.wheels,this.cargo,this.people]){m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;}
 }
}
