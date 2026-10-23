use super::{
    level_of_sim::is_micro,
    rail_maritime::{clearance, tide_level, traction_speed},
};
use crate::world_gen::hydrology::hydro_power_mw;
use hecs::{Entity, World};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Deserialize)]
pub struct Facility {
    pub id: usize,
    pub name: String,
    pub kind: String,
    pub x: f64,
    pub z: f64,
    pub stock: Vec<f64>,
    pub inputs: Vec<[f64; 2]>,
    pub outputs: Vec<[f64; 2]>,
    pub cycle: f64,
}
#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Route {
    pub id: usize,
    pub mode: String,
    pub from: usize,
    pub to: usize,
    pub resource: usize,
    pub capacity: f64,
    pub draft: f64,
    pub speed: f64,
    pub grade: f64,
    pub min_depth: f64,
    pub points: Vec<[f64; 2]>,
}
#[derive(Clone, Deserialize)]
pub struct Scenario {
    pub facilities: Vec<Facility>,
    pub routes: Vec<Route>,
}
#[derive(Default, Clone)]
struct Parish {
    stock: [f64; 6],
    outgoing: [f64; 6],
    incoming: [f64; 6],
    progress: f64,
}
#[derive(Default)]
struct Vehicle {
    phase: u8,
    cargo: f64,
    distance: f64,
    timer: f64,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FacilityState {
    id: usize,
    stock: [f64; 6],
    outgoing: [f64; 6],
    incoming: [f64; 6],
    progress: f64,
    strike: f64,
    mode: &'static str,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VehicleState {
    id: usize,
    x: f64,
    z: f64,
    angle: f64,
    phase: u8,
    cargo: f64,
    progress: f64,
    blocked: bool,
    depth: f64,
    speed: f64,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    time: f64,
    money: f64,
    delivered: f64,
    steel: f64,
    ship_steel: f64,
    launches: u32,
    #[serde(rename = "hydroMW")]
    hydro_mw: f64,
    facilities: Vec<FacilityState>,
    vehicles: Vec<VehicleState>,
    totals: [f64; 6],
    dredged: Vec<u8>,
    active: usize,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Save {
    version: u8,
    time: f64,
    money: f64,
    delivered: f64,
    steel: f64,
    ship_steel: f64,
    launches: u32,
    #[serde(rename = "hydroMW")]
    hydro_mw: f64,
    stock: Vec<f64>,
    outgoing: Vec<f64>,
    incoming: Vec<f64>,
    production: Vec<f64>,
    phase: Vec<u8>,
    cargo: Vec<f64>,
    distance: Vec<f64>,
    timer: Vec<f64>,
    dredged: Vec<u8>,
}
pub struct RegionalEngine {
    pub scenario: Scenario,
    world: World,
    entities: Vec<Entity>,
    parishes: Vec<Parish>,
    lengths: Vec<Vec<f64>>,
    pub speed: u8,
    pub time: f64,
    pub money: f64,
    pub delivered: f64,
    pub steel: f64,
    pub ship_steel: f64,
    pub launches: u32,
    pub hydro_mw: f64,
    pub focus: [f64; 2],
    dredged: Vec<u8>,
}
impl RegionalEngine {
    pub fn new(scenario: Scenario) -> Result<Self, String> {
        if scenario.facilities.len() != 8 || scenario.routes.len() > 64 {
            return Err("Expected eight parishes and at most 64 routes".into());
        }
        for (i, f) in scenario.facilities.iter().enumerate() {
            if f.id != i
                || f.stock.len() != 6
                || f.inputs
                    .iter()
                    .chain(&f.outputs)
                    .any(|v| v[0] < 0. || v[0] > 5. || v[1] < 0.)
            {
                return Err("Invalid facility definition".into());
            }
        }
        let mut world = World::new();
        let mut entities = Vec::new();
        let mut lengths = Vec::new();
        let mut parishes = vec![Parish::default(); 8];
        for f in &scenario.facilities {
            parishes[f.id].stock.copy_from_slice(&f.stock);
        }
        for (i, r) in scenario.routes.iter().enumerate() {
            if r.id != i || r.from >= 8 || r.to >= 8 || r.resource >= 6 || r.points.len() < 2 {
                return Err("Invalid freight route".into());
            }
            entities.push(world.spawn((Vehicle::default(),)));
            let mut lens = vec![0.; r.points.len()];
            for j in 1..r.points.len() {
                lens[j] = lens[j - 1]
                    + (r.points[j][0] - r.points[j - 1][0])
                        .hypot(r.points[j][1] - r.points[j - 1][1]);
            }
            lengths.push(lens);
        }
        Ok(Self {
            scenario,
            world,
            entities,
            parishes,
            lengths,
            speed: 1,
            time: 0.,
            money: 25000.,
            delivered: 0.,
            steel: 0.,
            ship_steel: 0.,
            launches: 0,
            hydro_mw: 0.,
            focus: [51200., 51200.],
            dredged: vec![0; 64],
        })
    }
    pub fn step(&mut self, dt: f64) {
        self.time += dt;
        let (steel, ship, income) = self
            .parishes
            .par_iter_mut()
            .enumerate()
            .map(|(i, p)| {
                let f = &self.scenario.facilities[i];
                if f.cycle <= 0.
                    || f.inputs
                        .iter()
                        .any(|v| p.stock[v[0] as usize] - p.outgoing[v[0] as usize] < v[1])
                    || f.outputs.iter().any(|v| p.stock[v[0] as usize] >= 600.)
                {
                    return (0., 0., 0.);
                }
                p.progress += dt;
                if p.progress < f.cycle {
                    return (0., 0., 0.);
                }
                p.progress -= f.cycle;
                for v in &f.inputs {
                    p.stock[v[0] as usize] -= v[1];
                }
                let mut steel = 0.;
                for v in &f.outputs {
                    p.stock[v[0] as usize] += v[1];
                    if v[0] == 3. {
                        steel += v[1];
                    }
                }
                (
                    steel,
                    if f.kind == "shipyard" { 10. } else { 0. },
                    if f.kind == "market" { 35. } else { 0. },
                )
            })
            .reduce(|| (0., 0., 0.), |a, b| (a.0 + b.0, a.1 + b.1, a.2 + b.2));
        self.steel += steel;
        self.ship_steel += ship;
        self.money += income;
        if self.ship_steel >= 80. {
            self.ship_steel -= 80.;
            self.launches += 1;
            self.money += 2400.;
        }
        for (i, r) in self.scenario.routes.iter().enumerate() {
            let mut v = self.world.get::<&mut Vehicle>(self.entities[i]).unwrap();
            let depth = if self.dredged[i] > 0 {
                6f64.max(r.min_depth)
            } else {
                r.min_depth
            };
            let blocked = r.mode == "sea" && clearance(depth, tide_level(self.time), r.draft) < 0.;
            let length = *self.lengths[i].last().unwrap();
            let res = r.resource;
            match v.phase {
                0 => {
                    if blocked {
                        continue;
                    }
                    let n = r
                        .capacity
                        .min(self.parishes[r.from].stock[res] - self.parishes[r.from].outgoing[res])
                        .min(
                            240. - self.parishes[r.to].stock[res]
                                - self.parishes[r.to].incoming[res],
                        )
                        .floor();
                    if n <= 0. {
                        continue;
                    }
                    self.parishes[r.from].outgoing[res] += n;
                    self.parishes[r.to].incoming[res] += n;
                    v.cargo = n;
                    v.phase = 1;
                    v.timer = 0.;
                }
                1 => {
                    v.timer += dt;
                    if v.timer >= 600. {
                        self.parishes[r.from].stock[res] -= v.cargo;
                        self.parishes[r.from].outgoing[res] -= v.cargo;
                        v.phase = 2;
                        v.distance = 0.;
                    }
                }
                2 | 4 => {
                    if blocked {
                        continue;
                    }
                    v.distance += traction_speed(r.speed, r.grade, v.cargo) * dt;
                    if v.distance >= length {
                        v.distance = length;
                        if v.phase == 2 {
                            v.phase = 3;
                            v.timer = 0.;
                        } else {
                            v.phase = 0;
                            v.distance = 0.;
                        }
                    }
                }
                3 => {
                    v.timer += dt;
                    if v.timer >= 600. {
                        self.parishes[r.to].stock[res] += v.cargo;
                        self.parishes[r.to].incoming[res] -= v.cargo;
                        self.delivered += v.cargo;
                        v.cargo = 0.;
                        v.phase = 4;
                        v.distance = 0.;
                    }
                }
                _ => {}
            }
        }
    }
    pub fn dredge(&mut self, id: usize) -> Result<(), String> {
        if id >= self.scenario.routes.len() || self.scenario.routes[id].mode != "sea" {
            return Err("Select a shipping lane".into());
        }
        if self.dredged[id] > 0 {
            return Err("Lane already dredged".into());
        }
        if self.money < 750. {
            return Err("Dredging requires £750".into());
        }
        self.money -= 750.;
        self.dredged[id] = 1;
        Ok(())
    }
    pub fn build_hydro(&mut self, flow: f64, head: f64) -> Result<(), String> {
        let power = hydro_power_mw(flow, head, 0.88)?;
        if self.hydro_mw > 0. || self.money < 4000. {
            return Err("Hydro demonstration unavailable".into());
        }
        self.money -= 4000.;
        self.hydro_mw = power;
        Ok(())
    }
    pub fn snapshot(&self) -> Snapshot {
        let mut totals = [0.; 6];
        let mut active = 0;
        let facilities = self
            .parishes
            .iter()
            .enumerate()
            .map(|(i, p)| {
                let f = &self.scenario.facilities[i];
                for (j, total) in totals.iter_mut().enumerate() {
                    *total += p.stock[j];
                }
                let micro = is_micro(f.x, f.z, self.focus);
                if micro {
                    active += 1;
                }
                FacilityState {
                    id: i,
                    stock: p.stock,
                    outgoing: p.outgoing,
                    incoming: p.incoming,
                    progress: if f.cycle > 0. {
                        p.progress / f.cycle
                    } else {
                        0.
                    },
                    strike: if f.kind == "market" && p.stock[4] < 4. {
                        0.4
                    } else {
                        0.
                    },
                    mode: if micro { "micro" } else { "macro" },
                }
            })
            .collect();
        let vehicles = self
            .scenario
            .routes
            .iter()
            .enumerate()
            .map(|(i, r)| {
                let v = self.world.get::<&Vehicle>(self.entities[i]).unwrap();
                let lens = &self.lengths[i];
                let length = *lens.last().unwrap();
                let d = if v.phase == 4 {
                    length - v.distance
                } else if v.phase <= 1 {
                    0.
                } else {
                    v.distance
                };
                let mut j = 1;
                while j < lens.len() - 1 && lens[j] < d {
                    j += 1;
                }
                let a = r.points[j - 1];
                let b = r.points[j];
                let t = ((d - lens[j - 1]) / (lens[j] - lens[j - 1])).clamp(0., 1.);
                if v.phase == 2 || v.phase == 3 {
                    totals[r.resource] += v.cargo;
                }
                let depth = if self.dredged[i] > 0 { 6. } else { r.min_depth };
                VehicleState {
                    id: i,
                    x: a[0] + (b[0] - a[0]) * t,
                    z: a[1] + (b[1] - a[1]) * t,
                    angle: (b[1] - a[1]).atan2(b[0] - a[0])
                        + if v.phase == 4 {
                            std::f64::consts::PI
                        } else {
                            0.
                        },
                    phase: v.phase,
                    cargo: v.cargo,
                    progress: d / length,
                    blocked: r.mode == "sea"
                        && clearance(depth, tide_level(self.time), r.draft) < 0.,
                    depth,
                    speed: traction_speed(r.speed, r.grade, v.cargo),
                }
            })
            .collect();
        Snapshot {
            time: self.time,
            money: self.money,
            delivered: self.delivered,
            steel: self.steel,
            ship_steel: self.ship_steel,
            launches: self.launches,
            hydro_mw: self.hydro_mw,
            facilities,
            vehicles,
            totals,
            dredged: self.dredged.clone(),
            active,
        }
    }
    pub fn save(&self) -> Save {
        let vehicles: Vec<_> = self
            .entities
            .iter()
            .map(|e| {
                let v = self.world.get::<&Vehicle>(*e).unwrap();
                (v.phase, v.cargo, v.distance, v.timer)
            })
            .collect();
        Save {
            version: 1,
            time: self.time,
            money: self.money,
            delivered: self.delivered,
            steel: self.steel,
            ship_steel: self.ship_steel,
            launches: self.launches,
            hydro_mw: self.hydro_mw,
            stock: self.parishes.iter().flat_map(|p| p.stock).collect(),
            outgoing: self.parishes.iter().flat_map(|p| p.outgoing).collect(),
            incoming: self.parishes.iter().flat_map(|p| p.incoming).collect(),
            production: self.parishes.iter().map(|p| p.progress).collect(),
            dredged: self.dredged.clone(),
            phase: vehicles.iter().map(|v| v.0).collect(),
            cargo: vehicles.iter().map(|v| v.1).collect(),
            distance: vehicles.iter().map(|v| v.2).collect(),
            timer: vehicles.iter().map(|v| v.3).collect(),
        }
    }
    pub fn restore(&mut self, s: Save) -> Result<(), String> {
        let n = self.entities.len();
        if s.version != 1
            || s.stock.len() != 48
            || s.outgoing.len() != 48
            || s.incoming.len() != 48
            || s.production.len() != 8
            || s.phase.len() != n
            || s.cargo.len() != n
            || s.distance.len() != n
            || s.timer.len() != n
            || s.dredged.len() != 64
        {
            return Err("Invalid regional save".into());
        }
        self.time = s.time;
        self.money = s.money;
        self.delivered = s.delivered;
        self.steel = s.steel;
        self.ship_steel = s.ship_steel;
        self.launches = s.launches;
        self.hydro_mw = s.hydro_mw;
        self.dredged = s.dredged;
        for (i, p) in self.parishes.iter_mut().enumerate() {
            p.stock.copy_from_slice(&s.stock[i * 6..i * 6 + 6]);
            p.outgoing.copy_from_slice(&s.outgoing[i * 6..i * 6 + 6]);
            p.incoming.copy_from_slice(&s.incoming[i * 6..i * 6 + 6]);
            p.progress = s.production[i];
        }
        for (i, e) in self.entities.iter().enumerate() {
            let mut v = self.world.get::<&mut Vehicle>(*e).unwrap();
            v.phase = s.phase[i];
            v.cargo = s.cargo[i];
            v.distance = s.distance[i];
            v.timer = s.timer[i];
        }
        Ok(())
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn game() -> RegionalEngine {
        RegionalEngine::new(
            serde_json::from_str(include_str!("../../../src/data/regional-scenario.json")).unwrap(),
        )
        .unwrap()
    }
    #[test]
    fn physical_freight_and_shipbuilding() {
        let mut g = game();
        g.dredge(4).unwrap();
        for _ in 0..4000 {
            g.step(6.);
        }
        assert!(g.delivered > 100.);
        assert!(g.steel > 0.);
        assert!(g.ship_steel > 0. || g.launches > 0);
        for p in &g.parishes {
            assert!(p.stock.iter().all(|v| *v >= 0.));
        }
    }
    #[test]
    fn transit_save_is_exact() {
        let mut g = game();
        for _ in 0..130 {
            g.step(6.);
        }
        let before = serde_json::to_string(&g.snapshot()).unwrap();
        let save = g.save();
        let mut restored = game();
        restored.restore(save).unwrap();
        assert_eq!(before, serde_json::to_string(&restored.snapshot()).unwrap());
    }
    #[test]
    fn dredging_opens_deep_draft_service() {
        let mut g = game();
        g.step(6.);
        assert!(g.snapshot().vehicles[4].blocked);
        g.dredge(4).unwrap();
        g.step(6.);
        assert!(!g.snapshot().vehicles[4].blocked);
        assert_eq!(g.money, 24250.);
    }
}

#[cfg(test)]
mod browser_parity {
    use super::*;
    #[test]
    fn native_core_matches_browser_reference_after_1000_ticks() {
        let scenario: Scenario =
            serde_json::from_str(include_str!("../../../src/data/regional-scenario.json")).unwrap();
        let mut game = RegionalEngine::new(scenario).unwrap();
        game.dredge(4).unwrap();
        for _ in 0..1000 {
            game.step(6.);
        }
        let expected: serde_json::Value =
            serde_json::from_str(include_str!("../../../tests/fixtures/regional-1000.json"))
                .unwrap();
        let actual = serde_json::to_value(game.snapshot()).unwrap();
        for field in [
            "time",
            "money",
            "delivered",
            "steel",
            "shipSteel",
            "launches",
            "hydroMW",
        ] {
            assert!(
                (expected[field].as_f64().unwrap() - actual[field].as_f64().unwrap()).abs()
                    < 0.000001,
                "Mismatch in {field}"
            );
        }
        for i in 0..6 {
            assert!(
                (expected["totals"][i].as_f64().unwrap() - actual["totals"][i].as_f64().unwrap())
                    .abs()
                    < 0.000001
            );
        }
        for i in 0..5 {
            for field in ["x", "z", "cargo", "phase", "progress"] {
                assert!(
                    (expected["vehicles"][i][field].as_f64().unwrap()
                        - actual["vehicles"][i][field].as_f64().unwrap())
                    .abs()
                        < 0.000001,
                    "Vehicle {i} {field}"
                );
            }
        }
    }
}
