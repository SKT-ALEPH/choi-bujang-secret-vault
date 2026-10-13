import {initializeTestPolicy,previewTestPolicy,applyTestPolicy} from '../src/recovery-policy.mjs';
import {fileURLToPath} from 'node:url';

// The path is fixed to the local test directory; this never writes operational policy.
const directory = fileURLToPath(new URL('../.local/stage10-policy/',import.meta.url));
const command = process.argv[2] ?? 'preview';
if (command === 'init') {await initializeTestPolicy(directory);console.log(JSON.stringify(await previewTestPolicy(directory),null,2));}
else if (command === 'preview') console.log(JSON.stringify(await previewTestPolicy(directory),null,2));
else if (command === 'apply') console.log(JSON.stringify(await applyTestPolicy(directory,process.argv[3]),null,2));
else throw Error('Use init, preview or apply with the preview confirmation hash.');
