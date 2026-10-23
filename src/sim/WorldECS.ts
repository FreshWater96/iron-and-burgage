import {createWorld,defineComponent,Types,addEntity,addComponent,defineQuery} from 'bitecs';
import {BUILDINGS,residents} from './data/EraDefinitions';
import {MAX_BUILDINGS,MAX_AGENTS,RESOURCE_COUNT as N,type Building,type Snapshot,type SimSave,type JobSave} from './data/ResourceTypes';
import {RoadGraph} from './NavMeshManager';
import {reservationAmount} from './systems/LogisticsSystem';
export const Position=defineComponent({x:Types.f32,z:Types.f32,angle:Types.f32});
export const Transport=defineComponent({phase:Types.ui8,from:Types.ui16,to:Types.ui16,res:Types.ui8,amount:Types.ui8,node:Types.ui16});
const vehiclesQuery=defineQuery([Position,Transport]);
export class WorldECS {
 world=createWorld(); buildings:Building[]=[]; graph=new RoadGraph();
 stocks=new Float32Array(MAX_BUILDINGS*N); outgoing=new Float32Array(MAX_BUILDINGS*N);incoming=new Float32Array(MAX_BUILDINGS*N);progress=new Float32Array(MAX_BUILDINGS);
 paths:(number[]|undefined)[]=[]; vehicles:number[]=[]; money=6400;time=0;delivered=0;produced=0;nav='Baking walkable terrain';
 constructor(){for(let i=0;i<12;i++){const e=addEntity(this.world);addComponent(this.world,Position,e);addComponent(this.world,Transport,e);this.vehicles.push(e);Position.x[e]=12;Position.z[e]=14;}}
 init(buildings:Building[],roadSamples:Float32Array[],save?:SimSave){
  this.buildings=buildings;this.graph.rebuild(roadSamples);this.stocks.fill(0);this.incoming.fill(0);this.outgoing.fill(0);this.progress.fill(0);
  for(const e of this.vehicles){Transport.phase[e]=0;Transport.amount[e]=0;Position.x[e]=12;Position.z[e]=14;}
  if(save){this.stocks.set(save.stocks);this.money=save.money;this.time=save.time;this.delivered=save.delivered;this.produced=save.produced;this.progress.set(save.progress);
   // Jobs are returned to their physical source on restore; no cargo is discarded or duplicated.
   for(const j of save.jobs)if(j.phase===2)this.stocks[j.from*N+j.resource]+=j.amount;
  }else{const depot=buildings.find(b=>b.kind==='depot')!;this.stocks[depot.id*N+2]=120;this.stocks[depot.id*N+4]=140;this.stocks[depot.id*N+0]=28;this.stocks[depot.id*N+5]=18;}
 }
 spend(cost:number,timber=0){let total=0;for(const b of this.buildings)total+=Math.max(0,this.stocks[b.id*N+2]-this.outgoing[b.id*N+2]);if(this.money<cost||total<timber)return false;this.money-=cost;for(const b of this.buildings){const k=b.id*N+2,n=Math.min(timber,Math.max(0,this.stocks[k]-this.outgoing[k]));this.stocks[k]-=n;timber-=n;if(timber<=0)break;}return true;}
 tick(dt:number){
  this.time+=dt;const month=(Math.floor(this.time/60)+3)%12,winter=month===11||month<2;
  let population=0,required=0;for(const b of this.buildings){if(residents(b.kind))population+=residents(b.kind);else if(b.active)required+=BUILDINGS[b.kind].workers;}
  const staffed=Math.min(1,Math.max(.2,population*.65/Math.max(1,required)));
  for(const b of this.buildings){const def=BUILDINGS[b.kind],base=b.id*N;if(!b.active||!def.cycle)continue;let ready=true;if(def.input)for(const [r,n] of def.input)if(this.stocks[base+r]-this.outgoing[base+r]<n)ready=false;if(def.output&&this.stocks[base+def.output[0]]>=180)ready=false;if(!ready)continue;
   this.progress[b.id]+=dt*staffed*(b.kind==='farm'&&winter?.5:1);
   if(this.progress[b.id]>=def.cycle){this.progress[b.id]-=def.cycle;if(def.input)for(const [r,n] of def.input)this.stocks[base+r]-=n;if(def.output){this.stocks[base+def.output[0]]+=def.output[1];if(b.kind==='foundry')this.produced+=def.output[1];if(b.kind==='workshop')this.money+=12;}if(b.kind==='market')this.money+=Math.max(4,population*.6);}
  }
  const ids=vehiclesQuery(this.world);
  for(let i=0;i<ids.length;i++){const e=ids[i];if(Transport.phase[e]===0){if(Math.floor(this.time*20)%10===0)this.assign(e);continue;}const path=this.paths[e];if(!path||path.length<2)continue;
   const n=Transport.node[e],dx=path[n]-Position.x[e],dz=path[n+1]-Position.z[e],dist=Math.hypot(dx,dz),mud=month===2||month===9||month===10,speed=(mud?4.2:6.8)*dt;
   Position.angle[e]=Math.atan2(dx,dz);
   if(dist<=speed){Position.x[e]=path[n];Position.z[e]=path[n+1];Transport.node[e]+=2;if(Transport.node[e]>=path.length)this.arrive(e);}else{Position.x[e]+=dx/dist*speed;Position.z[e]+=dz/dist*speed;}
  }
 }
 assign(e:number){
  for(const dest of this.buildings){if(!dest.active)continue;const inputs=BUILDINGS[dest.kind].input;if(!inputs)continue;for(const [r] of inputs)if(this.findJob(e,dest,r,24))return;}
  for(const depot of this.buildings)if(depot.kind==='depot')for(let r=0;r<N;r++)if(this.findJob(e,depot,r,150,true))return;
 }
 findJob(e:number,dest:Building,r:number,cap:number,producersOnly=false){
  const dk=dest.id*N+r;if(this.stocks[dk]+this.incoming[dk]>=cap)return false;
  let source:Building|undefined,best=Infinity,amount=0;
  for(const b of this.buildings){if(b.id===dest.id||producersOnly&&BUILDINGS[b.kind].output?.[0]!==r)continue;const k=b.id*N+r,n=reservationAmount(this.stocks[k],this.outgoing[k],cap,this.stocks[dk],this.incoming[dk]);if(n<1)continue;const dist=Math.hypot(b.x-dest.x,b.z-dest.z);if(dist<best&&this.graph.route([b.x,b.z],[dest.x,dest.z]).length){best=dist;source=b;amount=Math.floor(n);}}
  if(!source)return false;const pickup=this.graph.route([Position.x[e],Position.z[e]],[source.x,source.z]);if(pickup.length<2)return false;
  this.outgoing[source.id*N+r]+=amount;this.incoming[dk]+=amount;Transport.from[e]=source.id;Transport.to[e]=dest.id;Transport.res[e]=r;Transport.amount[e]=amount;Transport.phase[e]=1;Transport.node[e]=0;this.paths[e]=pickup;return true;
 }
 arrive(e:number){const r=Transport.res[e],n=Transport.amount[e],from=Transport.from[e],to=Transport.to[e];
  if(Transport.phase[e]===1){this.stocks[from*N+r]-=n;this.outgoing[from*N+r]-=n;Transport.phase[e]=2;const a=this.buildings.find(b=>b.id===from)!,b=this.buildings.find(b=>b.id===to)!;this.paths[e]=this.graph.route([a.x,a.z],[b.x,b.z]);Transport.node[e]=0;
   if(!this.paths[e]?.length){this.stocks[from*N+r]+=n;this.incoming[to*N+r]-=n;Transport.phase[e]=0;Transport.amount[e]=0;}
  }else{this.stocks[to*N+r]+=n;this.incoming[to*N+r]-=n;this.delivered+=n;Transport.phase[e]=0;Transport.amount[e]=0;}
 }
 snapshot():Snapshot {
  const totals=Array(N).fill(0),agents:number[]=[],bs:Snapshot['buildings']=[];let population=0,workers=0,jobs=0;
  for(const b of this.buildings){const stock=Array.from(this.stocks.subarray(b.id*N,b.id*N+N));for(let r=0;r<N;r++)totals[r]+=stock[r];if(residents(b.kind))population+=residents(b.kind);workers+=b.active?BUILDINGS[b.kind].workers:0;
   const def=BUILDINGS[b.kind];let status=b.active?'Operating':'Paused';if(b.active&&def.input?.some(([r,n])=>this.stocks[b.id*N+r]<n))status='Awaiting supplies';if(b.active&&def.output&&this.stocks[b.id*N+def.output[0]]>=180)status='Storage full';
   bs.push({id:b.id,stock,reserved:Array.from(this.outgoing.subarray(b.id*N,b.id*N+N)),incoming:Array.from(this.incoming.subarray(b.id*N,b.id*N+N)),progress:def.cycle?this.progress[b.id]/def.cycle:0,status});}
  for(const e of this.vehicles){agents.push(Position.x[e],Position.z[e],Position.angle[e],Transport.phase[e],Transport.res[e],Transport.amount[e]);if(Transport.phase[e])jobs++;if(Transport.phase[e]===2)totals[Transport.res[e]]+=Transport.amount[e];}
  return {time:this.time,money:this.money,totals,population,workers:Math.min(Math.floor(population*.65),workers),jobs,delivered:this.delivered,produced:this.produced,buildings:bs,agents,nav:this.nav};
 }
 save():SimSave{const jobs:JobSave[]=[];for(const e of this.vehicles)if(Transport.phase[e])jobs.push({vehicle:e,from:Transport.from[e],to:Transport.to[e],resource:Transport.res[e],amount:Transport.amount[e],phase:Transport.phase[e],progress:0,path:[]});return {stocks:Array.from(this.stocks),money:this.money,time:this.time,delivered:this.delivered,produced:this.produced,jobs,progress:Array.from(this.progress)};}
}
