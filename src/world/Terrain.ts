import * as T from 'three';
import {computeBoundsTree,disposeBoundsTree,acceleratedRaycast} from 'three-mesh-bvh';
import {heightAt,riverX} from './height';
import {SplatmapController} from './SplatmapController';
T.BufferGeometry.prototype.computeBoundsTree=computeBoundsTree;
T.BufferGeometry.prototype.disposeBoundsTree=disposeBoundsTree;
T.Mesh.prototype.raycast=acceleratedRaycast;
export class Terrain {
 splat=new SplatmapController(); mesh:T.Mesh<T.PlaneGeometry,T.MeshStandardMaterial>; water:T.Mesh;
 waterTime={value:0};
 constructor(scene:T.Scene){
  const g=new T.PlaneGeometry(400,400,192,192);g.rotateX(-Math.PI/2);const p=g.getAttribute('position');
  for(let i=0;i<p.count;i++)p.setY(i,heightAt(p.getX(i),p.getZ(i)));g.computeVertexNormals();g.computeBoundsTree();
  this.mesh=new T.Mesh(g,this.splat.material());this.mesh.receiveShadow=true;this.mesh.userData.terrain=true;scene.add(this.mesh);
  const wg=new T.BufferGeometry(),pos:number[]=[],indices:number[]=[];
  for(let i=0;i<=160;i++){const z=-200+i*2.5,x=riverX(z);pos.push(x-6.7,-1.5,z,x+6.7,-1.5,z);if(i<160){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}}
  wg.setAttribute('position',new T.Float32BufferAttribute(pos,3));wg.setIndex(indices);wg.computeVertexNormals();
  const mat=new T.ShaderMaterial({uniforms:{uTime:this.waterTime},vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 vP;uniform float uTime;void main(){float r=sin(vP.z*2.8+vP.x*1.5+uTime*.6)*sin(vP.z*.4-vP.x*2.);vec3 c=mix(vec3(.23,.39,.38),vec3(.46,.58,.52),r*.5+.5);gl_FragColor=vec4(c,1.);}',side:T.DoubleSide});
  this.water=new T.Mesh(wg,mat);scene.add(this.water);
  // A soil cut around the map gives the landscape a diorama edge.
  const edge=new T.Mesh(new T.BoxGeometry(400,7,400),new T.MeshStandardMaterial({color:0x514536,roughness:1}));edge.position.y=-6.7;edge.receiveShadow=true;edge.userData.skipSoftware=true;scene.add(edge);
 }
 trench(samples:Float32Array){const p=this.mesh.geometry.getAttribute('position');for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);let d=Infinity;for(let j=0;j<samples.length;j+=3)d=Math.min(d,Math.hypot(x-samples[j],z-samples[j+2]));if(d<3)p.setY(i,heightAt(x,z)-1.8*(1-d/3));}p.needsUpdate=true;this.mesh.geometry.computeVertexNormals();this.mesh.geometry.disposeBoundsTree();this.mesh.geometry.computeBoundsTree();}
}
