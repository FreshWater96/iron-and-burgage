export const RESOURCES = ['Coal', 'Iron ore', 'Timber', 'Steel', 'Rations', 'Tools'] as const;
export const R = { Coal: 0, Ore: 1, Timber: 2, Steel: 3, Rations: 4, Tools: 5 } as const;
export type Point = [number, number];
export type BuildingKind = 'house' | 'croft' | 'tenement' | 'mine' | 'iron' | 'lumber' | 'foundry' | 'farm' | 'depot' | 'market' | 'workshop';
export interface Building { id: number; kind: BuildingKind; x: number; z: number; rotation: number; name: string; active: boolean }
export interface Road { id: number; kind: 'road' | 'rail' | 'trench'; points: Point[] }
export interface Parcel { points: Point[]; width: number }
export interface SaveData { version: 1; buildings: Building[]; roads: Road[]; parcels: Parcel[]; sim?: SimSave }
export interface SimSave { stocks: number[]; money: number; time: number; delivered: number; produced: number; jobs: JobSave[]; progress: number[] }
export interface JobSave { vehicle: number; from: number; to: number; resource: number; amount: number; phase: number; progress: number; path: number[] }
export interface BuildingState { id: number; stock: number[]; reserved: number[]; incoming: number[]; progress: number; status: string }
export interface Snapshot { time: number; money: number; totals: number[]; population: number; workers: number; jobs: number; delivered: number; produced: number; buildings: BuildingState[]; agents: number[]; nav: string }
export const MAX_BUILDINGS = 256;
export const MAX_AGENTS = 40;
export const RESOURCE_COUNT = 6;
