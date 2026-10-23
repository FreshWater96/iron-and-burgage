/** Physical stock includes reserved goods until pickup; incoming goods occupy future capacity. */
export const availableStock=(physical:number,outgoing:number)=>Math.max(0,physical-outgoing);
export const freeCapacity=(capacity:number,physical:number,incoming:number)=>Math.max(0,capacity-physical-incoming);
export function reservationAmount(physical:number,outgoing:number,capacity:number,destination:number,incoming:number){return Math.min(10,availableStock(physical,outgoing),freeCapacity(capacity,destination,incoming));}
