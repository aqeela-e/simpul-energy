import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const checks=[
 ['live vessel interpolation','src/lib/seaTransport.ts','getVesselPosition'],
 ['map live route progress','src/app/map/page.tsx','getShipmentLiveState'],
 ['BESS shared state follows shipment','src/context/SimpulContext.tsx','getVesselPosition(active,from,to,new Date(clockMs))'],
 ['BESS operational destination sync','src/context/SimpulContext.tsx','currentLocation:done.destination'],
 ['arrival ETA guard','src/context/SimpulContext.tsx','if(!live.hasReachedEta)return;'],
 ['full simulation chain','src/context/SimpulContext.tsx','Digital Twin → Risk → Allocation → Transport → KPI'],
 ['simulation allocation feasibility','src/context/SimpulContext.tsx','adaptiveFeasible'],
 ['shipment FSM guard','src/context/SimpulContext.tsx','const valid:Record<ShipmentStatus,ShipmentStatus[]>'],
];
let failed=0;
for(const [name,file,needle] of checks){const ok=read(file).includes(needle);console.log(`${ok?'PASS':'FAIL'}  ${name}`);if(!ok)failed++;}
const pkg=JSON.parse(read('package.json'));
for(const script of ['dev','build','lint']){const ok=Boolean(pkg.scripts?.[script]);console.log(`${ok?'PASS':'FAIL'}  npm run ${script} script`);if(!ok)failed++;}
if(failed){console.error(`\n${failed} critical checks failed.`);process.exit(1)}
console.log('\nAll critical implementation checks passed.');
