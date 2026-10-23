import {RegionalSim} from './RegionalSim';
const sim=new RegionalSim();let speed=1,ticks=0;
onmessage=e=>{const m=e.data;try{if(m.type==='speed')speed=m.value;if(m.type==='focus')sim.focus=m.point;if(m.type==='dredge')sim.dredge(m.id);if(m.type==='depth'){for(const p of m.depths)sim.scenario.routes[p.id].minDepth=p.depth;}
 if(m.type==='hydro')sim.buildHydro(m.flow,m.head);if(m.type==='save')postMessage({type:'saved',save:sim.save()});if(m.type==='load')sim.restore(m.save);if(['dredge','hydro','load'].includes(m.type))postMessage({type:'notice',text:m.type==='load'?'Regional save restored':m.type==='dredge'?'Shipping lane dredged to 6 metres':'Demonstration hydro scheme commissioned'});
 }catch(err){postMessage({type:'notice',text:err instanceof Error?err.message:'Regional command failed'});}};
setInterval(()=>{for(let i=0;i<speed;i++)sim.tick(6);if(++ticks%5===0)postMessage({type:'snapshot',snapshot:sim.snapshot()});},50);
