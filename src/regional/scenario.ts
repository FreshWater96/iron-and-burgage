import raw from '../data/regional-scenario.json';
import type {RegionScenario} from './types';
export const REGION_SIZE=102400;
export const REGION_ORIGIN={easting:180000,northing:722400};
export const SCENARIO=raw as RegionScenario;
export const REGION_RESOURCES=['Coal','Ironstone','Timber','Steel plate','Rations','Tools'];
export const RESOURCE_COLORS=['#53594b','#a58067','#9e936d','#b6c7bf','#c6b77b','#7c9a93'];
