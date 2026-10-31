#!/usr/bin/env node
import { existsSync, lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { runPhiServeDraft, listPhiServeAliases, MAX_PROMPT_BYTES, DraftError } from './adapter.mjs';

// No browser listener, gateway modification or credential in argv.
function parseDraftArgs(args) {
  const allowed = new Set(['--model','--prompt-file','--output-text','--output-receipt','--tokens']);
  const found = new Map();
  let approved = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--approve-local-inference') {
      if (approved) throw new DraftError('DUPLICATE_APPROVAL');
      approved = true;
      continue;
    }
    if (!allowed.has(arg) || found.has(arg) || i + 1 >= args.length) {
      throw new DraftError('DRAFT_ARGUMENTS_INVALID');
    }
    found.set(arg, args[++i]);
  }
  if (!approved) throw new DraftError('OPERATOR_APPROVAL_REQUIRED');
  for (const key of ['--model','--prompt-file','--output-text','--output-receipt']) {
    if (!found.get(key)) throw new DraftError('DRAFT_ARGUMENTS_INCOMPLETE');
  }
  const tokens = found.has('--tokens') ? Number(found.get('--tokens')) : 256;
  if (!Number.isSafeInteger(tokens) || tokens < 1 || tokens > 512) {
    throw new DraftError('TOKEN_CAP_OUT_OF_RANGE');
  }
  const outputText = found.get('--output-text');
  const outputReceipt = found.get('--output-receipt');
  if (outputText === outputReceipt || existsSync(outputText) || existsSync(outputReceipt)) {
    throw new DraftError('OUTPUT_FILES_MUST_BE_NEW_AND_DISTINCT');
  }
  return {
    model: found.get('--model'), promptFile: found.get('--prompt-file'),
    outputText, outputReceipt, tokens,
  };
}
function readPrivatePrompt(path) {
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 ||
        stat.size > MAX_PROMPT_BYTES) throw new Error('size');
    const bytes = readFileSync(path);
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (!text.trim()) throw new Error('blank');
    return text;
  } catch {
    throw new DraftError('PROMPT_FILE_MISSING_OR_INVALID');
  }
}
async function main() {
  const cmd = process.argv[2] ?? 'help';
  if (cmd === 'models' && process.argv.length === 3) {
    const aliases = await listPhiServeAliases({ tokenFile: process.env.PHISERVE_TOKEN_FILE });
    console.log(JSON.stringify({
      source: 'LOCAL_PHISERVE_AUTHENTICATED_CATALOG',
      discovered_not_approved: true, model_aliases: aliases, authority_granted: false,
    }, null, 2));
    return;
  }
  if (cmd === 'draft') {
    const args = parseDraftArgs(process.argv.slice(3));
    const prompt = readPrivatePrompt(args.promptFile);
    const result = await runPhiServeDraft({
      model: args.model, prompt, tokens: args.tokens,
      tokenFile: process.env.PHISERVE_TOKEN_FILE, approved: true,
    });
    writeFileSync(args.outputText, result.text, { flag: 'wx', mode: 0o600 });
    writeFileSync(args.outputReceipt, JSON.stringify(result.receipt, null, 2) + '\n',
      { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({
      status: result.receipt.status, schema: result.receipt.schema,
      model_alias: result.receipt.model_alias, receipt_has_text: false,
      authority_granted: false,
      note: 'Review the private output files before any independently authorized action.',
    }));
    return;
  }
  console.log('Usage: node cli.mjs models | draft --model ALIAS --prompt-file INPUT.txt --output-text NEW.txt --output-receipt NEW.json [--tokens 256] --approve-local-inference');
  if (cmd !== 'help' || process.argv.length > 3) process.exitCode = 2;
}
try { await main(); }
catch (error) {
  console.error(error instanceof DraftError ? error.code : 'OPERATOR_DRAFT_FAILED');
  process.exitCode = 2;
}
