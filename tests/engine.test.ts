import {test} from 'node:test';
import assert from 'node:assert/strict';
import {subdivideParcel,area,validQuadrilateral} from '../src/geometry/ParcelSubdivider';
import {sampleRoad} from '../src/geometry/SplineNetwork';
import {availableStock,freeCapacity,reservationAmount} from '../src/sim/systems/LogisticsSystem';
import {RoadGraph} from '../src/sim/NavMeshManager';
import {WorldECS} from '../src/sim/WorldECS';
import type {Point,Building} from '../src/sim/data/ResourceTypes';
import {createScenario} from '../src/world/Scenario';
test('parcel slicing conserves area in an oblique quadrilateral',()=>{const p:Point[]=[[0,0],[48,12],[41,37],[-7,25]],lots=subdivideParcel(p,12);assert.ok(lots.length>=3);assert.ok(Math.abs(lots.reduce((n,l)=>n+l.area,0)-area(p))<.001);for(const lot of lots)assert.ok(Number.isFinite(lot.angle));});
test('concave parcels preserve area and self-intersections are rejected',()=>{const p:Point[]=[[0,0],[40,0],[15,10],[0,30]];assert.ok(validQuadrilateral(p));const lots=subdivideParcel(p,10);assert.ok(Math.abs(lots.reduce((n,l)=>n+l.area,0)-area(p))<.001);assert.equal(validQuadrilateral([[0,0],[40,30],[0,30],[40,0]]),false);});
test('rail validation rejects tight curves and steep hills',()=>{const straight=sampleRoad({id:1,kind:'rail',points:[[-50,-5],[50,-5]]});assert.equal(straight.valid,true);const tight=sampleRoad({id:2,kind:'rail',points:[[-40,0],[-20,0],[-20,4],[-40,4]]});assert.equal(tight.valid,false);const hill=sampleRoad({id:3,kind:'rail',points:[[-190,-140],[-155,-140],[-110,-140]]});assert.ok(hill.grade>.04);assert.equal(hill.valid,false);});
test('reservations protect source stock and destination capacity',()=>{assert.equal(availableStock(10,8),2);assert.equal(freeCapacity(20,14,5),1);assert.equal(reservationAmount(10,8,20,14,5),1);assert.equal(availableStock(0,10),0);});
test('road routing joins shared junctions and refuses disconnected networks',()=>{const graph=new RoadGraph();graph.rebuild([sampleRoad({id:0,kind:'road',points:[[-80,0],[0,0],[80,0]]}).samples,sampleRoad({id:1,kind:'road',points:[[0,0],[0,80]]}).samples,sampleRoad({id:2,kind:'road',points:[[150,150],[180,150]]}).samples]);assert.ok(graph.route([-70,0],[0,70]).length>10);assert.equal(graph.route([-70,0],[160,150]).length,0);});
test('concurrent wagons conserve stock through reservation, pickup and delivery',()=>{
 const sim=new WorldECS(),bs:Building[]=[{id:0,kind:'depot',x:0,z:0,rotation:0,name:'source',active:true},{id:1,kind:'foundry',x:45,z:0,rotation:0,name:'destination',active:true}];sim.init(bs,[sampleRoad({id:0,kind:'road',points:[[-20,0],[70,0]]}).samples]);sim.stocks.fill(0);sim.stocks[0]=20;
 for(let i=0;i<800;i++){sim.tick(.05);assert.equal(sim.snapshot().totals[0],20);for(const value of sim.stocks)assert.ok(value>=0);for(const value of sim.outgoing)assert.ok(value>=0);for(const value of sim.incoming)assert.ok(value>=0);}
 assert.equal(sim.stocks[6],20);assert.ok(sim.delivered>=20);assert.ok(sim.outgoing.every(n=>n===0));
});
test('saving in-transit freight restores every physical good without duplication',()=>{const sim=new WorldECS(),bs:Building[]=[{id:0,kind:'depot',x:0,z:0,rotation:0,name:'source',active:true},{id:1,kind:'foundry',x:120,z:0,rotation:0,name:'destination',active:true}],roads=[sampleRoad({id:0,kind:'road',points:[[-20,0],[140,0]]}).samples];sim.init(bs,roads);sim.stocks.fill(0);sim.stocks[0]=20;for(let i=0;i<500;i++){sim.tick(.05);if(sim.save().jobs.some(j=>j.phase===2))break;}const save=sim.save(),before=sim.snapshot().totals;assert.ok(save.jobs.some(j=>j.phase===2));sim.init(bs,roads,save);assert.deepEqual(sim.snapshot().totals,before);assert.ok(sim.incoming.every(n=>n===0));assert.ok(sim.outgoing.every(n=>n===0));});
test('opening settlement delivers inputs, smelts steel, and produces tools',()=>{const scenario=createScenario(),sim=new WorldECS();sim.init(scenario.buildings,scenario.roads.filter(r=>r.kind==='road').map(r=>sampleRoad(r).samples));for(let i=0;i<20*240;i++)sim.tick(.05);assert.ok(sim.produced>=20,`Only ${sim.produced} steel produced`);assert.ok(sim.delivered>=100);assert.ok(sim.snapshot().totals[5]>18);for(const stock of sim.stocks)assert.ok(stock>=0);});
