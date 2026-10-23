import clipping from 'polygon-clipping';
import earcut from 'earcut';
import type { Point } from '../sim/data/ResourceTypes';
export interface Lot { polygon: Point[]; center: Point; frontage: Point; angle: number; area:number }
export function area(p:Point[]) {let a=0; for(let i=0,j=p.length-1;i<p.length;j=i++)a+=p[j][0]*p[i][1]-p[i][0]*p[j][1]; return Math.abs(a)*.5;}
export function subdivideParcel(points:Point[],width:number):Lot[] {
 if(points.length!==4 || width<8 || width>20 || area(points)<40)return [];
 const [p0,p1]=points,dx=p1[0]-p0[0],dz=p1[1]-p0[1],length=Math.hypot(dx,dz);
 if(length<8)return [];
 const ux=dx/length,uz=dz/length,nx=-uz,nz=ux;
 const local=points.map(p=>[(p[0]-p0[0])*ux+(p[1]-p0[1])*uz,(p[0]-p0[0])*nx+(p[1]-p0[1])*nz] as Point);
 const minY=Math.min(...local.map(p=>p[1])),maxY=Math.max(...local.map(p=>p[1]));
 const count=Math.max(1,Math.floor(length/width)),step=length/count, lots:Lot[]=[];
 for(let i=0;i<count;i++) {
  const a=i===0?Math.min(0,...local.map(p=>p[0])):i*step,b=i===count-1?Math.max(length,...local.map(p=>p[0])):(i+1)*step;
  const result=clipping.intersection([local],[[[a,minY-1],[b,minY-1],[b,maxY+1],[a,maxY+1],[a,minY-1]]]);
  for(const poly of result) {
   const ring=poly[0].slice(0,-1) as Point[];
   const world=ring.map(p=>[p0[0]+p[0]*ux+p[1]*nx,p0[1]+p[0]*uz+p[1]*nz] as Point);
   const size=area(world); if(size<.001)continue;
   const sign=(minY+maxY)>0?1:-1;
   // House center is five metres behind the road-facing edge; yard occupies the remainder.
   const mid=(i+.5)*step,fx=p0[0]+mid*ux,fz=p0[1]+mid*uz;
   lots.push({polygon:world,frontage:[fx,fz],center:[fx+nx*sign*5.6,fz+nz*sign*5.6],angle:-Math.atan2(uz,ux),area:size});
  }
 }
 return lots;
}
export function triangulate(p:Point[]) {return earcut(p.flat(),undefined,2);}
export function validQuadrilateral(p:Point[]) {
 if(p.length!==4 || area(p)<40)return false;
 const cross=(a:Point,b:Point,c:Point)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const intersects=(a:Point,b:Point,c:Point,d:Point)=>cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0;
 return !intersects(p[0],p[1],p[2],p[3])&&!intersects(p[1],p[2],p[3],p[0]);
}
