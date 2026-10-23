import type {Building,SimSave,Snapshot} from '../sim/data/ResourceTypes';
export class WorkerBridge {
 worker=new Worker(new URL('../sim/worker.ts',import.meta.url),{type:'module'});
 snapshot?:Snapshot; onMessage:(message:any)=>void=()=>{};
 constructor(){this.worker.onmessage=e=>{if(e.data.type==='snapshot')this.snapshot=e.data.snapshot;this.onMessage(e.data);};this.worker.onerror=e=>this.onMessage({type:'notice',message:`Simulation error: ${e.message}`});}
 init(buildings:Building[],roads:Float32Array[],save?:SimSave){this.send({type:'init',buildings,roads:roads.map(s=>Array.from(s)),save});}
 send(message:unknown){this.worker.postMessage(message);}
 dispose(){this.worker.terminate();}
}
