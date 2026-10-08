import { probeBrainC, redactBrainCConfig } from './config-probe.mjs';

// Operator-only localhost CLI. No browser, gateway integration, auth credentials or execution.
const allowed=new Set(['probe','--local-names','help']);
const args=process.argv.slice(2);
if(args.some(a=>!allowed.has(a)) || (args[0] && !['probe','help'].includes(args[0]))){
  console.error('Usage: node cli.mjs probe [--local-names]');
  process.exitCode=2;
}else if(args.length===0 || args[0]==='help'){
  console.log('Usage: node cli.mjs probe [--local-names]');
  console.log('Default output redacts model names; --local-names prints operator-private local inventory.');
}else{
  const result=await probeBrainC();
  console.log(JSON.stringify(args.includes('--local-names')?result:redactBrainCConfig(result),null,2));
  if(result.probe_status!=='AVAILABLE') process.exitCode=2;
}
