import { readFile } from 'node:fs/promises';
const data = JSON.parse(await readFile(new URL('./qualitative-corpus-2026-11-25.json', import.meta.url), 'utf8'));
function validate(d){
 const errors=[],warnings=[];const ids=new Set(),priorById=new Map(d.prior_observations.map(x=>[x.id,x]));
 for(const c of d.readouts){
 if(ids.has(c.id))errors.push("duplicate_readout:"+c.id);ids.add(c.id);
 if(!["met","not_met","pending"].includes(c.labels.primary_endpoint_status))errors.push("invalid_label:"+c.id);
 if(!d.sources[c.event.source_id])errors.push("missing_source:"+c.id);
 if(c.labels.primary_endpoint_status==="pending"&&c.inclusion.clinical_binary_label_eligible)errors.push("pending_binary_leak:"+c.id);
 if(!c.prediction_input_snapshot.prior_observation_ids.length)warnings.push("no_allowed_prior:"+c.id);
 for(const id of c.prediction_input_snapshot.prior_observation_ids){
 const p=priorById.get(id);if(!p){errors.push("unknown_prior:"+id);continue;}
 const s=d.sources[p.source_id];
 if(!s)errors.push("missing_prior_source:"+id);
 else if(!s.public_availability_date||s.public_availability_date>=c.event.date)errors.push("temporal_leak:"+c.id+":"+id);
 if(p.family!==c.family_group)errors.push("family_mismatch:"+c.id+":"+id);
 }
 if(c.labels.market_reaction!==null)errors.push("unverified_market_label:"+c.id);
 if(!Object.keys(c.missing_data).length)errors.push("missingness_absent:"+c.id);
 }
 for(const p of d.prior_observations)if(!d.sources[p.source_id])errors.push("prior_missing_source:"+p.id);
 if(new Set(d.prior_observations.map(x=>x.id)).size!==d.prior_observations.length)errors.push("duplicate_prior_ids");
 const counts=d.readouts.reduce((o,c)=>(o[c.labels.primary_endpoint_status]=(o[c.labels.primary_endpoint_status]||0)+1,o),{});
 return {errors,warnings,counts,readouts:d.readouts.length,priors:d.prior_observations.length,families:new Set(d.readouts.map(c=>c.molecule_group)).size,sources:Object.keys(d.sources).length};
}
const report = validate(data);
if (report.errors.length) { console.error(JSON.stringify(report, null, 2)); process.exitCode = 1; } else { console.log(JSON.stringify(report, null, 2)); }
