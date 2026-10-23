import {invoke,isTauri} from '@tauri-apps/api/core';
import {SCENARIO} from '../scenario';
import type {RegionSnapshot,RegionSave} from '../types';
export class TauriBridge {
 mode:'native'|'browser'='browser';worker?:Worker;timer?:ReturnType<typeof setInterval>;disposed=false;polling=false;
 onSnapshot:(s:RegionSnapshot)=>void=()=>{};onNotice:(s:string)=>void=()=>{};onSaved:(s:RegionSave)=>void=()=>{};
 async start(){if(isTauri()){try{await invoke('region_init',{scenario:SCENARIO});if(this.disposed)return;this.mode='native';this.timer=setInterval(()=>{if(this.polling||this.disposed)return;this.polling=true;invoke<RegionSnapshot>('region_snapshot').then(s=>this.onSnapshot(s)).catch(e=>this.onNotice(String(e))).finally(()=>{this.polling=false;});},250);return;}catch(err){this.onNotice(`Native simulation could not start: ${String(err)}`);return;}}
  this.worker=new Worker(new URL('../sim/worker.ts',import.meta.url),{type:'module'});this.worker.onmessage=e=>{const m=e.data;if(m.type==='snapshot')this.onSnapshot(m.snapshot);if(m.type==='notice')this.onNotice(m.text);if(m.type==='saved')this.onSaved(m.save);};this.worker.onerror=e=>this.onNotice(e.message);
 }
 send(message:any){if(this.mode==='native'){void invoke('region_command',{command:message}).then(value=>{if(message.type==='save')this.onSaved(value as RegionSave);else if(['dredge','hydro','load','load_disk'].includes(message.type))this.onNotice((message.type==='load'||message.type==='load_disk')?'Regional save restored':message.type==='dredge'?'Shipping lane dredged to 6 metres':'Demonstration hydro scheme commissioned');}).catch(e=>this.onNotice(String(e)));}else this.worker?.postMessage(message);}
 dispose(){this.disposed=true;this.worker?.terminate();if(this.timer)clearInterval(this.timer);}
}
