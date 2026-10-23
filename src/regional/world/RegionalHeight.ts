import {REGION_SIZE} from '../scenario';
const coast=[[0,12000],[15000,16000],[30000,23000],[40000,35000],[45000,45000],[50000,50000],[60000,57000],[70000,49000],[80000,48000],[90000,52000],[102400,45000]];
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
export function coastX(z:number){for(let i=1;i<coast.length;i++)if(z<coast[i][0]){const a=coast[i-1],b=coast[i],t=(z-a[0])/(b[0]-a[0]);return a[1]+(b[1]-a[1])*t;}return 45000;}
function islandDistance(x:number,z:number,cx:number,cz:number,rx:number,rz:number){return (1-Math.hypot((x-cx)/rx,(z-cz)/rz))*Math.min(rx,rz);}
export function syntheticElevation(x:number,z:number){
 let d=Math.max(x-coastX(z),islandDistance(x,z,24000,58000,8000,15500),islandDistance(x,z,20000,88000,12500,18000),islandDistance(x,z,2500,79000,7000,29000));
 const hill=980*Math.exp(-((x-62500)**2+(z-12500)**2)/340e6)+640*Math.exp(-((x-30000)**2+(z-21000)**2)/160e6)+770*Math.exp(-((x-19000)**2+(z-85500)**2)/85e6)+120*Math.exp(-((x-93000)**2+(z-85000)**2)/350e6);
 let h=d<0?-Math.min(100,2.4+Math.abs(d)*.003):4+clamp(d/3000)*(hill+12+Math.sin(x*.0004)*Math.sin(z*.00032)*12);
 // Synthetic estuary channel, following the lower Clyde towards Glasgow.
 const path=[[45400,47500],[57000,49000],[69000,51400],[79000,57400]];
 let river=Infinity;for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz));river=Math.min(river,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));}if(river<450)h=Math.min(h,-(2.4+(1-river/450)*5));
 const lake=Math.hypot((x-66000)/1700,(z-21000)/11500);if(lake<1)h=24;
 return h;
}
export interface RasterLayer {data:Float32Array;width:number;height:number;minE:number;maxN:number;stepE:number;stepN:number;name:string;kind:'elevation'|'bathymetry';noData:number|null}
export class RegionalHeight {
 layers:RasterLayer[]=[];revision=0;
 sample(x:number,z:number){const imported=this.sampleLayer(x,z,'elevation');return imported??syntheticElevation(x,z);}
 depth(x:number,z:number){const d=this.sampleLayer(x,z,'bathymetry');return d===undefined?Math.max(0,-syntheticElevation(x,z)):Math.max(0,-d);}
 sampleLayer(x:number,z:number,kind:RasterLayer['kind']){const e=180000+x,n=722400-z;for(let k=this.layers.length-1;k>=0;k--){const l=this.layers[k];if(l.kind!==kind)continue;const u=(e-l.minE)/l.stepE,v=(l.maxN-n)/l.stepN;if(u<0||v<0||u>l.width-1||v>l.height-1)continue;const i=Math.floor(u),j=Math.floor(v),i1=Math.min(l.width-1,i+1),j1=Math.min(l.height-1,j+1),fx=u-i,fz=v-j;const a=l.data[j*l.width+i],b=l.data[j*l.width+i1],c=l.data[j1*l.width+i],d=l.data[j1*l.width+i1];if([a,b,c,d].some(v=>!Number.isFinite(v)||v===l.noData))return undefined;return (a+(b-a)*fx)*(1-fz)+(c+(d-c)*fx)*fz;}return undefined;}
 add(layer:RasterLayer){if(layer.width*layer.height!==layer.data.length)throw new Error('Raster dimensions do not match the elevation buffer');this.layers.push(layer);this.revision++;}
 get provenance(){return this.layers.length?`${this.layers.length} imported raster layer${this.layers.length===1?'':'s'} · procedural outside coverage`:'Procedural terrain · geographic layout approximate';}
}
export class FloatingOrigin {
 readonly global=new Float64Array(3);readonly offset=new Float64Array(3);readonly local=new Float32Array(3);
 update(x:number,y:number,z:number){this.global[0]=x;this.global[1]=y;this.global[2]=z;if(Math.hypot(x-this.offset[0],z-this.offset[2])>2048){this.offset[0]=Math.floor(x/1024)*1024;this.offset[2]=Math.floor(z/1024)*1024;}this.local[0]=x-this.offset[0];this.local[1]=y-this.offset[1];this.local[2]=z-this.offset[2];return this.local;}
}
export function regionClamp(v:number){return Math.max(0,Math.min(REGION_SIZE,v));}
