import {init,NavMeshQuery,getNavMeshPositionsAndIndices,type NavMesh} from '@recast-navigation/core';
import {generateSoloNavMesh} from '@recast-navigation/generators';
import type {Building,Point} from './data/ResourceTypes';
import {heightAt,riverX} from '../world/height';
import {BUILDINGS} from './data/EraDefinitions';
/** Pedestrians use Recast; heavy freight follows the independent road graph. */
export class NavMeshManager {
 mesh?:NavMesh; query?:NavMeshQuery;
 async build(buildings:Building[]){
  await init();const positions:number[]=[],indices:number[]=[];
  for(let z=-130;z<130;z+=4)for(let x=-150;x<160;x+=4){
   if(Math.abs(x+2-riverX(z+2))<12)continue;
   let blocked=false;for(const b of buildings){const s=BUILDINGS[b.kind].size*.55;if(Math.abs(x+2-b.x)<s+2&&Math.abs(z+2-b.z)<s+2){blocked=true;break;}}if(blocked)continue;
   const k=positions.length/3;positions.push(x,heightAt(x,z),z,x,heightAt(x,z+4),z+4,x+4,heightAt(x+4,z),z,x+4,heightAt(x+4,z+4),z+4);indices.push(k,k+1,k+2,k+2,k+1,k+3);
  }
  const result=generateSoloNavMesh(positions,indices,{cs:1.5,ch:.3,walkableHeight:2,walkableClimb:2,walkableRadius:1,walkableSlopeAngle:45,minRegionArea:4,mergeRegionArea:20});
  if(!result.success)throw new Error(result.error);
  this.query?.destroy();this.mesh?.destroy();this.mesh=result.navMesh;this.query=new NavMeshQuery(this.mesh);
  return getNavMeshPositionsAndIndices(this.mesh);
 }
 route(a:Point,b:Point):number[]{
  if(!this.query)return [];
  const result=this.query.computePath({x:a[0],y:heightAt(...a),z:a[1]},{x:b[0],y:heightAt(...b),z:b[1]},{halfExtents:{x:10,y:8,z:10}});
  return result.success?result.path.flatMap(p=>[p.x,p.z]):[];
 }
}
export class RoadGraph {
 nodes:Point[]=[];edges:number[][]=[];cache=new Map<string,number[]>();
 rebuild(roads:Float32Array[]){
  this.nodes=[];this.edges=[];this.cache.clear();
  for(const samples of roads){let previous=-1;for(let i=0;i<samples.length;i+=9){let nearest=-1,best=4;const x=samples[i],z=samples[i+2];for(let j=0;j<this.nodes.length;j++){const d=Math.hypot(x-this.nodes[j][0],z-this.nodes[j][1]);if(d<best){nearest=j;best=d;}}
    if(nearest<0){nearest=this.nodes.length;this.nodes.push([x,z]);this.edges.push([]);}if(previous>=0&&previous!==nearest){if(!this.edges[previous].includes(nearest))this.edges[previous].push(nearest);if(!this.edges[nearest].includes(previous))this.edges[nearest].push(previous);}previous=nearest;
  }}
 }
 nearest(p:Point){let n=-1,d=25;for(let i=0;i<this.nodes.length;i++){const k=Math.hypot(p[0]-this.nodes[i][0],p[1]-this.nodes[i][1]);if(k<d){d=k;n=i;}}return n;}
 route(a:Point,b:Point):number[]{
  const start=this.nearest(a),end=this.nearest(b);if(start<0||end<0)return [];
  const key=`${start}:${end}`,cached=this.cache.get(key);if(cached)return cached;
  const cost=new Float32Array(this.nodes.length).fill(Infinity),prev=new Int32Array(this.nodes.length).fill(-1),visited=new Uint8Array(this.nodes.length);cost[start]=0;
  for(let it=0;it<this.nodes.length;it++) {let n=-1,min=Infinity;for(let i=0;i<cost.length;i++)if(!visited[i]&&cost[i]<min){n=i;min=cost[i];}if(n<0||n===end)break;visited[n]=1;for(const j of this.edges[n]){const d=cost[n]+Math.hypot(this.nodes[n][0]-this.nodes[j][0],this.nodes[n][1]-this.nodes[j][1]);if(d<cost[j]){cost[j]=d;prev[j]=n;}}}
  if(!Number.isFinite(cost[end]))return [];
  const ids:number[]=[];for(let n=end;n>=0;n=prev[n]){ids.push(n);if(n===start)break;}ids.reverse();const path=ids.flatMap(n=>this.nodes[n]);this.cache.set(key,path);return path;
 }
}
