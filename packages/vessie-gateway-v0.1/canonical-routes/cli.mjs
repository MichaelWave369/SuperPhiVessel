import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { projectCanonicalRoute } from './projector.mjs';

const args=process.argv.slice(2);
const usage='Usage: node cli.mjs --input <operator-local-export.json> [--operator-names]';
let input=null,operatorNames=false;
for(let i=0;i<args.length;i++){
  if(args[i]==='--input' && i+1<args.length && input===null) input=args[++i];
  else if(args[i]==='--operator-names')operatorNames=true;
  else {console.error(usage);process.exitCode=2;break;}
}
if(process.exitCode!==2){
  if(!input) {
    console.error(usage);process.exitCode=2;
  }else{
    try{
      const source=readFileSync(resolve(input));
      if(source.length>262144)throw new Error('INPUT_TOO_LARGE');
      const parsed=JSON.parse(source.toString('utf8'));
      const output=projectCanonicalRoute(parsed,{operatorNames});
      console.log(JSON.stringify(output,null,2));
    }catch{
      console.error('CANONICAL_ROUTE_PROJECTION_REFUSED: invalid, inconsistent, or unavailable local evidence');
      process.exitCode=2;
    }
  }
}
