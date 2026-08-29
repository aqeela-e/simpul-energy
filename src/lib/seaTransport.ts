export interface SeaRoute { id:string; label:string; sailingDays:number[]; vessel:string; transitHours:number; departureHour?:number; originPortId?:string; destinationPortId?:string; }
const DAY_NAMES=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
export const SEA_ROUTES:Record<string,SeaRoute>={
 'jayapura-kupang':{id:'jayapura-kupang',label:'Jayapura → Kupang',sailingDays:[1,4],vessel:'Tol Laut T-15',transitHours:96,departureHour:8,originPortId:'port-jayapura',destinationPortId:'port-kupang'},
 'makassar-ambon':{id:'makassar-ambon',label:'Makassar → Ambon',sailingDays:[2,5],vessel:'Tol Laut T-9',transitHours:48,departureHour:8,originPortId:'port-makassar',destinationPortId:'port-ambon'},
 'makassar-kupang':{id:'makassar-kupang',label:'Makassar → Kupang',sailingDays:[3,6],vessel:'Tol Laut T-11',transitHours:72,departureHour:8,originPortId:'port-makassar',destinationPortId:'port-kupang'},
 'ambon-kupang':{id:'ambon-kupang',label:'Ambon → Kupang',sailingDays:[2],vessel:'Tol Laut T-13',transitHours:72,departureHour:8,originPortId:'port-ambon',destinationPortId:'port-kupang'},
 'balikpapan-kupang':{id:'balikpapan-kupang',label:'Balikpapan → Kupang',sailingDays:[5],vessel:'Tol Laut T-17',transitHours:120,departureHour:8},
 'surabaya-makassar':{id:'surabaya-makassar',label:'Surabaya → Makassar',sailingDays:[1,3,5],vessel:'Tol Laut T-2',transitHours:72,departureHour:8},
 'balikpapan-ambon':{id:'balikpapan-ambon',label:'Balikpapan → Ambon',sailingDays:[4],vessel:'Tol Laut T-18',transitHours:120,departureHour:8},
};
export function routeKeyFor(from:string,to:string){const n=(s:string)=>s.toLowerCase().trim();return Object.keys(SEA_ROUTES).find(k=>{const [a,b]=SEA_ROUTES[k].label.split(' → ');return n(a)===n(from)&&n(b)===n(to)})??null;}
export function nextSailingDate(route:SeaRoute,from:Date){const d=new Date(from);for(let i=0;i<21;i++){const c=new Date(d);c.setDate(d.getDate()+i);c.setHours(route.departureHour??8,0,0,0);if(route.sailingDays.includes(c.getDay())&&c.getTime()-from.getTime()>=6*3600000)return c;}throw new Error(`Tidak ditemukan jendela pelayaran untuk ${route.label}`);}
export function formatSailingDays(route:SeaRoute){return route.sailingDays.map(d=>DAY_NAMES[d]).join(' & ')}
export function formatDateID(d:Date){return new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'}).format(d)}
export function interpolateGeo(from:{lat:number;lng:number},to:{lat:number;lng:number},progress:number){const p=Math.min(1,Math.max(0,progress));return {lat:from.lat+(to.lat-from.lat)*p,lng:from.lng+(to.lng-from.lng)*p};}
export function interpolateRouteGeo(from:{lat:number;lng:number},to:{lat:number;lng:number},progress:number){const p=Math.min(1,Math.max(0,progress));const mlat=(from.lat+to.lat)/2,mlng=(from.lng+to.lng)/2;const dlat=to.lat-from.lat,dlng=to.lng-from.lng,len=Math.hypot(dlat,dlng)||1;const cp={lat:mlat+(-dlng/len)*len*0.18,lng:mlng+(dlat/len)*len*0.18};return {lat:(1-p)*(1-p)*from.lat+2*(1-p)*p*cp.lat+p*p*to.lat,lng:(1-p)*(1-p)*from.lng+2*(1-p)*p*cp.lng+p*p*to.lng};}
export function getShipmentLiveState(shipment:{departure:string;eta:string;delayHours:number;status:string},now=new Date()){
 const dep=new Date(shipment.departure).getTime(), eta=new Date(shipment.eta).getTime(), t=now.getTime();
 const duration=Math.max(1,eta-dep); const progress=t<dep?0:Math.min(1,Math.max(0,(t-dep)/duration));
 const remaining=Math.max(0,eta-t); const timeState=t<dep?'SCHEDULED':t>=eta?'ETA_REACHED':'SAILING';
 return {progress,remainingMs:remaining,elapsedMs:Math.max(0,t-dep),timeState,hasReachedEta:t>=eta};
}
export function getVesselPosition(shipment:{departure:string;eta:string;delayHours:number;status:string},from:{lat:number;lng:number},to:{lat:number;lng:number},now=new Date()){const live=getShipmentLiveState(shipment,now);return {...live,position:interpolateRouteGeo(from,to,live.progress)};}
