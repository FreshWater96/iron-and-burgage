import {INITIAL_BUILDINGS} from '../sim/data/EraDefinitions';
import type {Road,Parcel,Point} from '../sim/data/ResourceTypes';
import {subdivideParcel} from '../geometry/ParcelSubdivider';
export function createScenario(){
  let buildings=INITIAL_BUILDINGS.map(b=>({...b}));let nextId=8;
  const roads:Road[]=[{id:0,kind:'road',points:[[-180,14],[-120,10],[-60,12],[-5,10],[55,8],[105,10],[175,12]]},{id:1,kind:'road',points:[[-128,-40],[-90,-41],[-48,-28],[15,-28],[24,-5],[20,10]]},{id:2,kind:'road',points:[[-120,57],[-76,54],[-28,55],[25,54],[32,30],[20,10]]},{id:3,kind:'road',points:[[-72,12],[-73,-12],[-76,-40]]},{id:4,kind:'road',points:[[-52,12],[-42,33],[-40,55]]},{id:5,kind:'road',points:[[-110,10],[-126,-12],[-125,-40]]},{id:7,kind:'road',points:[[-90,-41],[-80,-53],[-77,-58]]},{id:6,kind:'rail',points:[[-180,-88],[-125,-91],[-70,-90],[-12,-83],[45,-72],[100,-65],[175,-64]]}];
  const ps:Point[][]=[[[ -102,17],[-61,17],[-57,36],[-104,36]],[[-107,49],[-60,48],[-61,32],[-110,33]],[[-29,59],[20,58],[23,80],[-25,81]],[[-105,62],[-70,60],[-67,81],[-104,82]]];
  const parcels:Parcel[]=ps.map(points=>({points,width:9}));for(const p of parcels)for(const lot of subdivideParcel(p.points,p.width))buildings.push({id:nextId++,kind:'house',x:lot.center[0],z:lot.center[1],rotation:lot.angle,name:`Worker Cottage ${nextId-8}`,active:true});
  return {buildings,roads,parcels,nextId};
}
