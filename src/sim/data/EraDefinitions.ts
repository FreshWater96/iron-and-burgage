import type { BuildingKind } from './ResourceTypes';
export interface BuildingDefinition { label: string; detail: string; cost: number; timber: number; size: number; workers: number; output?: [number, number]; input?: [number, number][]; cycle: number }
export const BUILDINGS: Record<BuildingKind, BuildingDefinition> = {
 croft: {label:'Highland croft',detail:'A stone cottage for 4 residents, with a small kale garden.',cost:120,timber:6,size:7,workers:0,cycle:0},
 tenement: {label:'Sandstone tenement',detail:'Four storeys for 24 residents, with a communal backcourt.',cost:420,timber:14,size:10,workers:0,cycle:0},
 house: {label:"Miners’ row",detail:'A home for 6 settlers, with a kitchen garden.',cost:90,timber:6,size:5.2,workers:0,cycle:0},
 mine: {label:'Coal mine',detail:'Extracts coal for the foundry. Wagons collect the output.',cost:280,timber:16,size:11,workers:6,output:[0,8],cycle:12},
 iron: {label:'Iron mine',detail:'Extracts iron ore. Connect to a foundry by road.',cost:280,timber:16,size:10,workers:6,output:[1,8],cycle:12},
 lumber: {label:'Sawmill',detail:'Produces timber for construction and workshops.',cost:180,timber:10,size:10,workers:4,output:[2,6],cycle:15},
 foundry: {label:'Iron foundry',detail:'Smelts 3 ore + 2 coal into 2 steel. Inputs arrive by wagon.',cost:450,timber:22,size:14,workers:10,input:[[0,2],[1,3]],output:[3,2],cycle:10},
 farm: {label:'Smallholding',detail:'Harvests food. Winter slows production by half.',cost:160,timber:8,size:14,workers:4,output:[4,10],cycle:18},
 depot: {label:'Goods depot',detail:'Stores physical goods for wagon pickup and delivery.',cost:220,timber:14,size:12,workers:2,cycle:0},
 market: {label:'Town market',detail:'Consumes 2 rations per cycle to support settlement income.',cost:160,timber:8,size:9,workers:2,input:[[4,2]],cycle:12},
 workshop: {label:'Tool workshop',detail:'Turns 2 steel + 1 timber into 4 tools. Tools earn trade income.',cost:320,timber:16,size:10,workers:6,input:[[3,2],[2,1]],output:[5,4],cycle:15},
};
export const ERAS = [{year:1890,name:'Steam & Soot'},{year:1914,name:'Total War'},{year:1919,name:'Electric Age'},{year:1939,name:'Mechanized World'}];
export const INITIAL_BUILDINGS = [
 {kind:'mine',x:-113,z:-52,name:'Blackwood Colliery'}, {kind:'iron',x:-77,z:-66,name:'Northbank Iron Mine'},
 {kind:'foundry',x:-29,z:-45,name:'Ashford Ironworks'}, {kind:'depot',x:12,z:5,name:'Ashford Goods Depot'},
 {kind:'lumber',x:-105,z:59,name:'Westwood Sawmill'}, {kind:'farm',x:-46,z:81,name:'Willow Farm'},
 {kind:'market',x:-24,z:22,name:'Market Square'}, {kind:'workshop',x:5,z:-45,name:'Whitmore Tool Works'},
].map((b,i)=>({...b,id:i,kind:b.kind as BuildingKind,rotation:0,active:true}));

export function residents(kind:BuildingKind){return kind==='house'?6:kind==='croft'?4:kind==='tenement'?24:0;}
