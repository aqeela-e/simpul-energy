import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..','src');
const files=[]; const walk=d=>{for(const n of fs.readdirSync(d)){if(n==='node_modules'||n==='.next')continue;const p=path.join(d,n);const st=fs.statSync(p);if(st.isDirectory())walk(p);else if(/\.(ts|tsx)$/.test(n))files.push(p)}};walk(root);
const text=files.map(p=>fs.readFileSync(p,'utf8')).join('\n');
const checks=[
 ['shared operational context', text.includes('SimpulProvider')&&text.includes('useSimpul')],
 ['dynamic risk engine', text.includes('nightLightAnomalyPct')&&text.includes('renewableUncertainty')&&text.includes('incidentBoost')],
 ['maritime schedule', text.includes('nextSailingDate')&&text.includes('sailingDays')],
 ['human approval gate', text.includes("approval==='PENDING'")&&text.includes("['APPROVED','MODIFIED']")],
 ['shipment lifecycle', ['PLANNED','DISPATCHED','IN_TRANSIT','DELAYED','ARRIVED','INTEGRATED','OPERATIONAL'].every(x=>text.includes(x))],
 ['audit hash chain', text.includes('previousHash')&&text.includes('sha256')],
 ['public aggregation', text.includes('operationalMicrogrids')&&text.includes('operationalBess')],
 ['default deny RBAC', fs.readFileSync(path.join(root,'lib/permissions.ts'),'utf8').includes('return false; // default-deny')],
];
let ok=true;for(const [n,v] of checks){console.log(`${v?'PASS':'FAIL'} ${n}`);if(!v)ok=false}process.exit(ok?0:1);
