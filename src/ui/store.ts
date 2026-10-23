import {create} from 'zustand';
import type {Building,BuildingKind,Snapshot} from '../sim/data/ResourceTypes';
export type Tool='select'|'road'|'rail'|'trench'|'parcel'|BuildingKind;
interface GameState {
 localName:string;housingTier:'house'|'croft'|'tenement';tool:Tool;category:string;speed:number;debug:boolean;help:boolean;overview:boolean;selected:number|null;buildings:Building[];snapshot?:Snapshot;toast:string;step:number;lotWidth:number;rotation:number;fps:number;draws:number;ready:boolean;software:boolean;
 command:(action:string,value?:any)=>void;
 set:(patch:Partial<GameState>)=>void;
}
export const useGame=create<GameState>(set=>({localName:'Clydebank',housingTier:'house',tool:'select',category:'Settlement',speed:1,debug:false,help:false,overview:false,selected:null,buildings:[],toast:'Local construction sandbox. Regional goods are tracked separately.',step:0,lotWidth:12,rotation:0,fps:0,draws:0,ready:false,software:false,command:()=>{},set:patch=>set(patch)}));
let toastTimer:ReturnType<typeof setTimeout>;
export function notify(message:string){useGame.setState({toast:message});clearTimeout(toastTimer);toastTimer=setTimeout(()=>useGame.setState({toast:''}),5500);}
