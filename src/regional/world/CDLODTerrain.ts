import * as T from 'three';
import {REGION_SIZE} from '../scenario';
import {RegionalHeight} from './RegionalHeight';
import {terrainNodeMaterial} from './SplatmapShaderTSL';
export interface TerrainPatch{x:number;z:number;size:number;depth:number;key:string;distance:number}
/** 64×64 cells (65×65 vertices), selected through a bounded quadtree. */
export function selectPatches(x:number,y:number,z:number,maxDepth=7):TerrainPatch[]{const out:TerrainPatch[]=[];function visit(px:number,pz:number,size:number,depth:number){const dx=Math.max(px-x,0,x-px-size),dz=Math.max(pz-z,0,z-pz-size),distance=Math.hypot(dx,dz,y);if(depth<maxDepth&&distance<size*1.8){const s=size/2;visit(px,pz,s,depth+1);visit(px+s,pz,s,depth+1);visit(px,pz+s,s,depth+1);visit(px+s,pz+s,s,depth+1);}else out.push({x:px,z:pz,size,depth,key:`${depth}:${px}:${pz}`,distance});}visit(0,0,REGION_SIZE,0);return out;}
export class CDLODTerrain {
 group=new T.Group();patches=new Map<string,{mesh:T.Mesh;node:ReturnType<typeof terrainNodeMaterial>}>();revision=-1;count=0;
 constructor(readonly height:RegionalHeight){}
 update(x:number,y:number,z:number,ox:number,oz:number){
  if(this.revision!==this.height.revision){this.dispose();this.revision=this.height.revision;}
  const selected=selectPatches(x,y,z),keys=new Set(selected.map(p=>p.key));
  for(const [key,p] of this.patches)if(!keys.has(key)){this.group.remove(p.mesh);p.mesh.geometry.dispose();p.node.material.dispose();this.patches.delete(key);}
  for(const p of selected){let entry=this.patches.get(p.key);if(!entry){entry=this.create(p);this.patches.set(p.key,entry);this.group.add(entry.mesh);}entry.mesh.position.set(p.x+p.size/2-ox,0,p.z+p.size/2-oz);entry.node.morph.value=Math.max(0,Math.min(1,(p.distance/p.size-1.2)/.6));}
  this.count=selected.length;
 }
 private create(p:TerrainPatch){const n=64,g=new T.PlaneGeometry(p.size,p.size,n,n);g.rotateX(-Math.PI/2);const pos=g.getAttribute('position'),parent=new Float32Array(pos.count),a=new Float32Array(pos.count*4),b=new Float32Array(pos.count*4),step=p.size/n;
  for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){const k=j*(n+1)+i,x=p.x+i*step,z=p.z+j*step,h=this.height.sample(x,z);pos.setY(k,h);const u=Math.floor(i/2)*2,v=Math.floor(j/2)*2,fx=(i-u)/2,fz=(j-v)/2;const h00=this.height.sample(p.x+u*step,p.z+v*step),h10=this.height.sample(p.x+(u+2)*step,p.z+v*step),h01=this.height.sample(p.x+u*step,p.z+(v+2)*step),h11=this.height.sample(p.x+(u+2)*step,p.z+(v+2)*step);parent[k]=(h00*(1-fx)+h10*fx)*(1-fz)+(h01*(1-fx)+h11*fx)*fz;const slope=Math.abs(h-this.height.sample(x+step,z))/step;a.set([1,Math.max(0,Math.min(.6,(h-180)/700)),h<80?.15:0,h<10?.3:0],k*4);b.set([0,0,Math.min(.8,slope*3),Math.max(0,Math.min(1,(h-850)/400))],k*4);}
  // Duplicate the perimeter to form vertical skirts without moving the terrain edge.
  const edge:number[]=[];for(let i=0;i<=n;i++)edge.push(i);for(let j=1;j<=n;j++)edge.push(j*(n+1)+n);for(let i=n-1;i>=0;i--)edge.push(n*(n+1)+i);for(let j=n-1;j>0;j--)edge.push(j*(n+1));
  const base=pos.count,total=base+edge.length,xyz=new Float32Array(total*3),ph=new Float32Array(total),aa=new Float32Array(total*4),bb=new Float32Array(total*4);xyz.set(pos.array);ph.set(parent);aa.set(a);bb.set(b);const indices=Array.from(g.index!.array);
  edge.forEach((id,j)=>{const k=base+j;xyz.set([pos.getX(id),pos.getY(id)-Math.max(5,p.size/100),pos.getZ(id)],k*3);ph[k]=parent[id]-Math.max(5,p.size/100);aa.set(a.subarray(id*4,id*4+4),k*4);bb.set(b.subarray(id*4,id*4+4),k*4);const next=(j+1)%edge.length;indices.push(id,edge[next],k,edge[next],base+next,k);});
  g.setAttribute('position',new T.BufferAttribute(xyz,3));g.deleteAttribute('uv');g.deleteAttribute('normal');g.setIndex(indices);g.setAttribute('parentHeight',new T.BufferAttribute(ph,1));g.setAttribute('splatA',new T.BufferAttribute(aa,4));g.setAttribute('splatB',new T.BufferAttribute(bb,4));g.computeVertexNormals();const node=terrainNodeMaterial(),mesh=new T.Mesh(g,node.material);mesh.receiveShadow=true;return {mesh,node};
 }
 dispose(){for(const p of this.patches.values()){p.mesh.geometry.dispose();p.node.material.dispose();}this.patches.clear();this.group.clear();}
}
