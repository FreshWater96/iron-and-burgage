export type XY=[number,number];
export type FacilityKind='foundry'|'shipyard'|'port'|'colliery'|'market'|'croft'|'hydro'|'depot';
export interface Facility {id:number;name:string;subtitle:string;kind:FacilityKind;x:number;z:number;population:number;workers:number;stock:number[];inputs:number[][];outputs:number[][];cycle:number}
export interface FreightRoute {id:number;name:string;mode:'rail'|'sea';from:number;to:number;resource:number;capacity:number;draft:number;speed:number;grade:number;minDepth:number;points:XY[]}
export interface RegionScenario {facilities:Facility[];routes:FreightRoute[]}
export interface FacilityState {id:number;stock:number[];outgoing:number[];incoming:number[];progress:number;strike:number;mode:'micro'|'macro'}
export interface VehicleState {id:number;x:number;z:number;angle:number;phase:number;cargo:number;progress:number;blocked:boolean;depth:number;speed:number}
export interface RegionSnapshot {time:number;money:number;delivered:number;steel:number;shipSteel:number;launches:number;hydroMW:number;facilities:FacilityState[];vehicles:VehicleState[];totals:number[];dredged:number[];active:number}
export interface RegionSave {version:1;time:number;money:number;delivered:number;steel:number;shipSteel:number;launches:number;hydroMW:number;stock:number[];outgoing:number[];incoming:number[];production:number[];phase:number[];cargo:number[];distance:number[];timer:number[];dredged:number[]}
