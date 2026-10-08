// In the repository this resolves to the existing governed read-only probe.
// The portable ZIP packager replaces this forwarding module with the actual
// reviewed Ollama-probe source so the ZIP is fully self-contained.
export { discoverOllama } from '../vessie-gateway-v0.1/ollama-probe.mjs';
