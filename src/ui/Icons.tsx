import {House,Route,TrainFront,Factory,Pickaxe,Trees,Wheat,Warehouse,Store,Hammer,MapPin,MousePointer2,Shovel} from 'lucide-react';
import type {Tool} from './store';
export const TOOL_ICONS:Record<Tool,typeof House>={select:MousePointer2,house:House,croft:House,tenement:House,parcel:MapPin,road:Route,rail:TrainFront,trench:Shovel,mine:Pickaxe,iron:Pickaxe,lumber:Trees,foundry:Factory,farm:Wheat,depot:Warehouse,market:Store,workshop:Hammer};
