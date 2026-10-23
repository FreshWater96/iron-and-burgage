import {createWorld,defineComponent,Types,addEntity,addComponent} from 'bitecs';
import {SCENARIO} from '../scenario';
import {tideLevel,hydroPowerMW} from '../world/Hydrology';
import {draftClearance} from '../geometry/CivilSplineEngine';
import type {RegionScenario,RegionSnapshot,RegionSave,FreightRoute,XY} from '../types';
const Freight=defineComponent({phase:Types.ui8,cargo:Types.ui16,distance:Types.f64,timer:Types.f64});
export class RegionalSim {
 readonly world=createWorld();readonly entities:number[]=[];readonly stock=new Float64Array(8*6);readonly outgoing=new Float64Array(8*6);readonly incoming=new Float64Array(8*6);readonly production=new Float64Array(8);readonly dredged=new Uint8Array(64);readonly lengths:Float64Array[]=[];readonly totalLengths=new Float64Array(64);
 time=0;money=25000;delivered=0;steel=0;shipSteel=0;launches=0;hydroMW=0;focus:XY=[51200,51200];
 constructor(readonly scenario:RegionScenario=SCENARIO){for(const f of scenario.facilities)this.stock.set(f.stock,f.id*6);for(const route of scenario.routes){const id=addEntity(this.world);addComponent(this.world,Freight,id);this.entities.push(id);const lengths=new Float64Array(route.points.length);for(let i=1;i<route.points.length;i++)lengths[i]=lengths[i-1]+Math.hypot(route.points[i][0]-route.points[i-1][0],route.points[i][1]-route.points[i-1][1]);this.lengths.push(lengths);this.totalLengths[route.id]=lengths[lengths.length-1];}}
 clearance(route:FreightRoute){return draftClearance(this.dredged[route.id]?Math.max(6,route.minDepth):route.minDepth,tideLevel(this.time),route.draft);}
 speed(route:FreightRoute){return route.speed/(1+Math.max(0,route.grade)*30*(1+(this.entities[route.id]===undefined?0:Freight.cargo[this.entities[route.id]])/40));}
 tick(dt:number){
  this.time+=dt;
  for(const f of this.scenario.facilities){if(!f.cycle)continue;const base=f.id*6;let ready=true;for(const [r,n] of f.inputs)if(this.stock[base+r]-this.outgoing[base+r]<n)ready=false;for(const [r] of f.outputs)if(this.stock[base+r]>=600)ready=false;if(!ready)continue;
   const hunger=f.kind==='market'&&this.stock[base+4]===0?.4:0;this.production[f.id]+=dt*(1-hunger);
   if(this.production[f.id]>=f.cycle){this.production[f.id]-=f.cycle;for(const [r,n] of f.inputs)this.stock[base+r]-=n;for(const [r,n] of f.outputs){this.stock[base+r]+=n;if(r===3)this.steel+=n;}if(f.kind==='shipyard'){this.shipSteel+=10;if(this.shipSteel>=80){this.shipSteel-=80;this.launches++;this.money+=2400;}}if(f.kind==='market')this.money+=35;}
  }
  for(const r of this.scenario.routes){const e=this.entities[r.id],from=r.from*6+r.resource,to=r.to*6+r.resource;
   if(Freight.phase[e]===0){if(r.mode==='sea'&&this.clearance(r)<0)continue;const n=Math.floor(Math.min(r.capacity,this.stock[from]-this.outgoing[from],240-this.stock[to]-this.incoming[to]));if(n<=0)continue;this.outgoing[from]+=n;this.incoming[to]+=n;Freight.cargo[e]=n;Freight.phase[e]=1;Freight.timer[e]=0;
   }else if(Freight.phase[e]===1){Freight.timer[e]+=dt;if(Freight.timer[e]>=600){const n=Freight.cargo[e];this.stock[from]-=n;this.outgoing[from]-=n;Freight.phase[e]=2;Freight.distance[e]=0;}}
   else if(Freight.phase[e]===2||Freight.phase[e]===4){if(r.mode==='sea'&&this.clearance(r)<0)continue;Freight.distance[e]+=this.speed(r)*dt;if(Freight.distance[e]>=this.totalLengths[r.id]){Freight.distance[e]=this.totalLengths[r.id];if(Freight.phase[e]===2){Freight.phase[e]=3;Freight.timer[e]=0;}else{Freight.phase[e]=0;Freight.distance[e]=0;}}}
   else if(Freight.phase[e]===3){Freight.timer[e]+=dt;if(Freight.timer[e]>=600){const n=Freight.cargo[e];this.stock[to]+=n;this.incoming[to]-=n;this.delivered+=n;Freight.cargo[e]=0;Freight.phase[e]=4;Freight.distance[e]=0;}}
  }
 }
 dredge(routeId:number){const route=this.scenario.routes.find(r=>r.id===routeId);if(!route||route.mode!=='sea')throw new Error('Select a shipping lane to dredge');if(this.dredged[routeId])throw new Error('This lane is already dredged to 6 m');if(this.money<750)throw new Error('Dredging requires £750');this.money-=750;this.dredged[routeId]=1;}
 buildHydro(flow:number,head:number){const power=hydroPowerMW(flow,head);if(this.hydroMW)throw new Error('The demonstration scheme already exists');if(this.money<4000)throw new Error('The demonstration scheme requires £4,000');this.money-=4000;this.hydroMW=power;}
 snapshot():RegionSnapshot{
  const totals=Array(6).fill(0),facilities:RegionSnapshot['facilities']=[];let active=0;
  for(const f of this.scenario.facilities){const k=f.id*6,mode=Math.hypot(f.x-this.focus[0],f.z-this.focus[1])<3000?'micro':'macro';if(mode==='micro')active++;const stock=Array.from(this.stock.subarray(k,k+6));for(let i=0;i<6;i++)totals[i]+=stock[i];facilities.push({id:f.id,stock,outgoing:Array.from(this.outgoing.subarray(k,k+6)),incoming:Array.from(this.incoming.subarray(k,k+6)),progress:f.cycle?this.production[f.id]/f.cycle:0,strike:f.kind==='market'&&stock[4]<4?.4:0,mode});}
  const vehicles=this.scenario.routes.map(r=>{const e=this.entities[r.id],phase=Freight.phase[e],distance=phase===4?this.totalLengths[r.id]-Freight.distance[e]:phase===0||phase===1?0:Freight.distance[e],lens=this.lengths[r.id];let i=1;while(i<lens.length-1&&lens[i]<distance)i++;const a=r.points[i-1],b=r.points[i],t=Math.max(0,Math.min(1,(distance-lens[i-1])/(lens[i]-lens[i-1]))),cargo=Freight.cargo[e];if(phase===2||phase===3)totals[r.resource]+=cargo;return {id:r.id,x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t,angle:Math.atan2(b[1]-a[1],b[0]-a[0])+(phase===4?Math.PI:0),phase,cargo,progress:distance/this.totalLengths[r.id],blocked:r.mode==='sea'&&this.clearance(r)<0,depth:this.dredged[r.id]?6:r.minDepth,speed:this.speed(r)};});
  return {time:this.time,money:this.money,delivered:this.delivered,steel:this.steel,shipSteel:this.shipSteel,launches:this.launches,hydroMW:this.hydroMW,facilities,vehicles,totals,dredged:Array.from(this.dredged),active};
 }
 save():RegionSave{return {version:1,time:this.time,money:this.money,delivered:this.delivered,steel:this.steel,shipSteel:this.shipSteel,launches:this.launches,hydroMW:this.hydroMW,stock:Array.from(this.stock),outgoing:Array.from(this.outgoing),incoming:Array.from(this.incoming),production:Array.from(this.production),dredged:Array.from(this.dredged),phase:this.entities.map(e=>Freight.phase[e]),cargo:this.entities.map(e=>Freight.cargo[e]),distance:this.entities.map(e=>Freight.distance[e]),timer:this.entities.map(e=>Freight.timer[e])};}
 restore(s:RegionSave){if(s.version!==1||s.stock.length!==48||s.phase.length!==this.entities.length)throw new Error('Incompatible regional save');for(const key of ['time','money','delivered','steel','shipSteel','launches','hydroMW'] as const){if(!Number.isFinite(s[key]))throw new Error('Invalid save value');this[key]=s[key];}this.stock.set(s.stock);this.outgoing.set(s.outgoing);this.incoming.set(s.incoming);this.production.set(s.production);this.dredged.set(s.dredged);this.entities.forEach((e,i)=>{Freight.phase[e]=s.phase[i];Freight.cargo[e]=s.cargo[i];Freight.distance[e]=s.distance[i];Freight.timer[e]=s.timer[i];});}
}
