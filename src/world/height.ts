export const WORLD_SIZE = 400;
export function riverX(z:number) { return 105 + 12 * Math.sin(z * .018) + 5 * Math.sin(z * .041); }
export function heightAt(x:number,z:number) {
 const hill = 18*Math.exp(-((x+155)**2+(z+140)**2)/2700)+11*Math.exp(-((x-165)**2+(z-110)**2)/3800);
 const plain = .28*Math.sin(x*.023)*Math.cos(z*.018)+.16*Math.sin(z*.044);
 const d=Math.abs(x-riverX(z));
 return plain+hill-3.3*Math.exp(-d*d/68);
}
export function onLand(x:number,z:number) {return Math.abs(x)<185 && Math.abs(z)<185 && Math.abs(x-riverX(z))>11;}
