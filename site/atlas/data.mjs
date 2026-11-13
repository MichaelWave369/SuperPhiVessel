// Source-reviewed, static operator guide. Not runtime telemetry or an authorization registry.
export const FAMILIES=[
  "All",
  "Chambers",
  "Professor Φ",
  "Genius Atlas",
  "Senses",
  "Compute",
  "Evidence",
  "Research"
];
export const CAPABILITIES=[
  {
    "id": "quick-chat",
    "family": "Chambers",
    "name": "Quick Chat",
    "status": "LIVE",
    "summary": "Everyday questions, planning and bounded research.",
    "where": "Master chamber · QUICK CHAT",
    "boundary": "Provider execution still requires canonical eligibility and authorization.",
    "source": "../manual/#quickchat",
    "tags": [
      "conversation",
      "ask"
    ]
  },
  {
    "id": "dreamer",
    "family": "Chambers",
    "name": "Dreamer",
    "status": "LIVE",
    "summary": "Speculative, symbolic and unconventional ideas.",
    "where": "Master chamber · DREAM",
    "boundary": "A possibility is not automatically a sourced fact.",
    "source": "../manual/#dreamer",
    "tags": [
      "ideation",
      "explore"
    ]
  },
  {
    "id": "translator",
    "family": "Chambers",
    "name": "Translator",
    "status": "LIVE",
    "summary": "Convert selected ideas into explicit mappings and testable bridges.",
    "where": "Master chamber · TRANSLATE",
    "boundary": "Translation cannot self-promote evidence or effects.",
    "source": "../manual/#translator",
    "tags": [
      "mapping",
      "bridge"
    ]
  },
  {
    "id": "builder",
    "family": "Chambers",
    "name": "Builder v2",
    "status": "LIVE",
    "summary": "Produce governed build proposals and test evidence.",
    "where": "Master chamber · BUILD",
    "boundary": "Proposal does not equal installation or deployment.",
    "source": "../manual/#builder",
    "tags": [
      "code",
      "construct"
    ]
  },
  {
    "id": "ledger",
    "family": "Chambers",
    "name": "Reality Ledger",
    "status": "LIVE",
    "summary": "Inspect provenance, conflicts, claims and receipts.",
    "where": "Master chamber · LEDGER",
    "boundary": "Ledger records cannot create authority.",
    "source": "../manual/#ledger",
    "tags": [
      "verify",
      "audit"
    ]
  },
  {
    "id": "teacher",
    "family": "Professor Φ",
    "name": "Teacher",
    "status": "LIVE",
    "summary": "Education and explanatory specialist perspective.",
    "where": "Retro Lab · PROF → Teacher",
    "boundary": "A Professor mode is a cognitive lens, not a separately deployed model.",
    "source": "../manual/#professor",
    "tags": [
      "teach",
      "learn"
    ]
  },
  {
    "id": "math",
    "family": "Professor Φ",
    "name": "Math Temple",
    "status": "LIVE",
    "summary": "Mathematical exploration and structured derivation.",
    "where": "Retro Lab · PROF → Math Temple",
    "boundary": "Calculations and claims still require verification.",
    "source": "../manual/#professor",
    "tags": [
      "math",
      "proof"
    ]
  },
  {
    "id": "inventor",
    "family": "Professor Φ",
    "name": "Inventor Garage",
    "status": "LIVE",
    "summary": "Engineering concepts, mechanisms and invention.",
    "where": "Retro Lab · PROF → Inventor Garage",
    "boundary": "An invention sketch is not a verified build.",
    "source": "../manual/#professor",
    "tags": [
      "engineering",
      "build"
    ]
  },
  {
    "id": "claims",
    "family": "Professor Φ",
    "name": "Claim Court",
    "status": "LIVE",
    "summary": "Critique assumptions, evidence and competing interpretations.",
    "where": "Retro Lab · PROF → Claim Court",
    "boundary": "A specialist objection alone is not external evidence.",
    "source": "../manual/#professor",
    "tags": [
      "research",
      "challenge"
    ]
  },
  {
    "id": "artist",
    "family": "Professor Φ",
    "name": "Artist Studio",
    "status": "LIVE",
    "summary": "Art directions and creative exploration.",
    "where": "Retro Lab · PROF → Artist Studio",
    "boundary": "Creative output carries no execution authority.",
    "source": "../manual/#professor",
    "tags": [
      "design",
      "art"
    ]
  },
  {
    "id": "game",
    "family": "Professor Φ",
    "name": "Game Forge",
    "status": "LIVE",
    "summary": "Game mechanics, worlds and interaction concepts.",
    "where": "Retro Lab · PROF → Game Forge",
    "boundary": "A proposal cannot modify a game repo without a governed action.",
    "source": "../manual/#professor",
    "tags": [
      "game",
      "vr"
    ]
  },
  {
    "id": "comedy",
    "family": "Professor Φ",
    "name": "Comedy Lab",
    "status": "LIVE",
    "summary": "Humor, wordplay and creative ideas.",
    "where": "Retro Lab · PROF → Comedy Lab",
    "boundary": "A playful lens is not an evidence source.",
    "source": "../manual/#professor",
    "tags": [
      "fun",
      "humor"
    ]
  },
  {
    "id": "paladin",
    "family": "Professor Φ",
    "name": "Paladin",
    "status": "LIVE",
    "summary": "Protective critique and values-oriented review.",
    "where": "Retro Lab · PROF → Paladin",
    "boundary": "No mode bypasses human and executor authorization.",
    "source": "../manual/#professor",
    "tags": [
      "safety",
      "care"
    ]
  },
  {
    "id": "trio",
    "family": "Genius Atlas",
    "name": "TRIO",
    "status": "LIVE",
    "summary": "A bounded multi-perspective configuration in the GA108 roster.",
    "where": "Command rail · ATLAS",
    "boundary": "108 logical profiles do not mean 108 running models.",
    "source": "../manual/#atlas",
    "tags": [
      "team",
      "council"
    ]
  },
  {
    "id": "parallax",
    "family": "Genius Atlas",
    "name": "PARALLAX",
    "status": "LIVE",
    "summary": "Contrast perspectives through the Genius Atlas.",
    "where": "Command rail · ATLAS",
    "boundary": "Perspective diversity does not prove independent evidence.",
    "source": "../manual/#atlas",
    "tags": [
      "challenge",
      "perspective"
    ]
  },
  {
    "id": "council",
    "family": "Genius Atlas",
    "name": "COUNCIL",
    "status": "LIVE",
    "summary": "Governed group review using a sparse specialist shortlist.",
    "where": "Command rail · ATLAS",
    "boundary": "Council conclusions cannot authorize model or tool execution.",
    "source": "../manual/#atlas",
    "tags": [
      "reasoning",
      "team"
    ]
  },
  {
    "id": "audit",
    "family": "Genius Atlas",
    "name": "AUDIT + Dissenter",
    "status": "LIVE",
    "summary": "Expose dissent and challenge decisions within the roster.",
    "where": "Command rail · ATLAS",
    "boundary": "Agreement among profiles is not ground truth.",
    "source": "../manual/#atlas",
    "tags": [
      "audit",
      "critical"
    ]
  },
  {
    "id": "soma-eyes",
    "family": "Senses",
    "name": "SOMA Eyes · Screen/Camera",
    "status": "CONDITIONAL",
    "summary": "Operator-started, permission-bound visual observation.",
    "where": "SOMA panel",
    "boundary": "Raw media is ephemeral; image interpretation is still fallible.",
    "source": "../manual/#soma-screen",
    "tags": [
      "vision",
      "screen",
      "camera"
    ]
  },
  {
    "id": "soma-ears",
    "family": "Senses",
    "name": "SOMA Ears",
    "status": "CONDITIONAL",
    "summary": "One-shot speech recognition and bounded microphone sampling.",
    "where": "SOMA panel",
    "boundary": "Browser/device permission and operator start are required.",
    "source": "../manual/#soma-ears",
    "tags": [
      "speech",
      "audio"
    ]
  },
  {
    "id": "soma-voice",
    "family": "Senses",
    "name": "SOMA Voice",
    "status": "CONDITIONAL",
    "summary": "Browser speech synthesis for output.",
    "where": "SOMA panel",
    "boundary": "Speaking does not confer factual or operational authority.",
    "source": "../manual/#soma-voice",
    "tags": [
      "tts",
      "reader"
    ]
  },
  {
    "id": "soma-focus",
    "family": "Senses",
    "name": "SOMA Focus",
    "status": "LIVE",
    "summary": "Session-only focus target with lexical drift indicators.",
    "where": "SOMA panel",
    "boundary": "Does not read anyone's attention or emotions.",
    "source": "../manual/#soma-focus",
    "tags": [
      "focus",
      "drift"
    ]
  },
  {
    "id": "soma-recall",
    "family": "Senses",
    "name": "SOMA Recall",
    "status": "LIVE",
    "summary": "Read-only search of bounded memory and Ledger summaries.",
    "where": "SOMA panel",
    "boundary": "Recall cannot silently write memory or certify truth.",
    "source": "../manual/#soma-recall",
    "tags": [
      "memory",
      "context"
    ]
  },
  {
    "id": "soma-hands",
    "family": "Senses",
    "name": "SOMA Hands",
    "status": "LOCKED",
    "summary": "Reserved action organ for keyboard, mouse, shell and tools.",
    "where": "SOMA kernel",
    "boundary": "LOCKED: no autonomous action path is enabled.",
    "source": "../manual/#soma-hands",
    "tags": [
      "actions",
      "keyboard"
    ]
  },
  {
    "id": "crane",
    "family": "Compute",
    "name": "GPU-Aware Crane Fly",
    "status": "LIVE",
    "summary": "Select eligible local compute with residency, fit and reuse signals.",
    "where": "COMPUTE · local routing",
    "boundary": "Resource optimization does not grant authority.",
    "source": "../manual/#gpucrane",
    "tags": [
      "gpu",
      "model",
      "local"
    ]
  },
  {
    "id": "autofabric",
    "family": "Compute",
    "name": "AutoFabric / Brain Registry",
    "status": "LIVE",
    "summary": "Discover installed local model capabilities and approved role pools.",
    "where": "COMPUTE · Ollama Local Executor Fabric",
    "boundary": "Discoverable does not mean approved or activated.",
    "source": "../manual/#autofabric",
    "tags": [
      "ollama",
      "models"
    ]
  },
  {
    "id": "budget",
    "family": "Compute",
    "name": "BudgetCompute / Credit Governor",
    "status": "LIVE",
    "summary": "Bound difficulty, budget, paid route policy and attempt ceilings.",
    "where": "COMPUTE · broker/credit",
    "boundary": "No unexpected paid fallback or permission expansion.",
    "source": "../manual/#budgetcompute",
    "tags": [
      "cost",
      "budget"
    ]
  },
  {
    "id": "challenger",
    "family": "Evidence",
    "name": "Model Scout / Frozen Challenger Bench",
    "status": "LIVE",
    "summary": "Compare declared model candidates against frozen role fixtures.",
    "where": "COMPUTE · Model Scout → BENCH",
    "boundary": "A promising candidate is not silently promoted.",
    "source": "../manual/#challenger-bench",
    "tags": [
      "evaluation",
      "quality"
    ]
  },
  {
    "id": "packet",
    "family": "Evidence",
    "name": "PhiTurnEnvelope + Packet Bus",
    "status": "LIVE",
    "summary": "Bounded per-attempt routing facts and immutable reference/digest registry.",
    "where": "Runtime spine",
    "boundary": "Evidence transport never transfers authority.",
    "source": "../manual/#packet-bus",
    "tags": [
      "receipt",
      "provenance"
    ]
  },
  {
    "id": "memory",
    "family": "Evidence",
    "name": "PV-MEM / WorkObject",
    "status": "LIVE",
    "summary": "Vessel-scoped continuity, project constraints and memory horizons.",
    "where": "MEMORY and WORK strip",
    "boundary": "Retrieval is context, not verified truth or permission.",
    "source": "../manual/#memory",
    "tags": [
      "memory",
      "project"
    ]
  },
  {
    "id": "sfr",
    "family": "Research",
    "name": "Sparse Frontier Routing (SFR)",
    "status": "UNWIRED",
    "summary": "Deterministic, bounded research gate for whether deeper reasoning is justified.",
    "where": "Extracted package · not canonical",
    "boundary": "Emits shadow advice; cannot trigger a model or alter live thresholds.",
    "source": "https://github.com/MichaelWave369/SuperPhiVessel/blob/main/packages/sparse-frontier-v0.1/README.md",
    "tags": [
      "escalation",
      "routing"
    ]
  },
  {
    "id": "p4",
    "family": "Research",
    "name": "P4 Learned Routing Candidate",
    "status": "UNWIRED",
    "summary": "Shadow-scored model-route proposals with eligibility safeguards.",
    "where": "Extracted P4-A research",
    "boundary": "Learned scores do not replace P1-C static selection.",
    "source": "https://github.com/MichaelWave369/SuperPhiVessel/blob/main/docs/ARCHITECTURE.md",
    "tags": [
      "learning",
      "routing"
    ]
  }
];
export const JOURNEYS={
  "research": {
    "title": "Investigate a claim without promoting speculation",
    "description": "Use read-only observation, challenge the evidence and preserve uncertainty. External source retrieval still needs a real authorized runtime.",
    "steps": [
      {
        "name": "Quick Chat / Direct Research",
        "detail": "Define the claim and gather permitted public observations",
        "href": "../manual/#quickchat"
      },
      {
        "name": "Professor Φ · Claim Court",
        "detail": "Challenge assumptions and propose rival explanations",
        "href": "../manual/#professor"
      },
      {
        "name": "Genius Atlas · AUDIT",
        "detail": "Optional contrasting review, not independent proof",
        "href": "../manual/#atlas"
      },
      {
        "name": "Reality Ledger",
        "detail": "Record provenance, dissent, gaps and unresolved claims",
        "href": "../manual/#ledger"
      }
    ]
  },
  "create": {
    "title": "Move from an idea to a governed build",
    "description": "Use the existing chamber boundaries. Nothing in this illustrative path checks out or modifies a repository.",
    "steps": [
      {
        "name": "Dreamer",
        "detail": "Explore the idea freely and label hypotheses",
        "href": "../manual/#dreamer"
      },
      {
        "name": "Translator",
        "detail": "Turn it into bounded requirements",
        "href": "../manual/#translator"
      },
      {
        "name": "Builder + Inventor Garage",
        "detail": "Prepare a candidate build and checks",
        "href": "../manual/#builder"
      },
      {
        "name": "Tests + Reality Ledger",
        "detail": "Review evidence; installation and deployment remain separately authorized",
        "href": "../manual/#ledger"
      }
    ]
  },
  "learn": {
    "title": "Explore at your own pace",
    "description": "Vessie can provide different cognitive perspectives while preserving their provenance and limits.",
    "steps": [
      {
        "name": "Quick Chat",
        "detail": "Choose an approachable starting question",
        "href": "../manual/#quickchat"
      },
      {
        "name": "Professor Φ · Teacher",
        "detail": "Learn concepts and methods",
        "href": "../manual/#professor"
      },
      {
        "name": "Math Temple or Artist Studio",
        "detail": "Explore the topic with a complementary lens",
        "href": "../manual/#professor"
      },
      {
        "name": "Claim Court",
        "detail": "Distinguish supported results from interesting possibilities",
        "href": "../manual/#professor"
      }
    ]
  },
  "local": {
    "title": "Prefer qualified local compute when it fits",
    "description": "Local-first is a preference among approved, measured options, not a forced model choice. This page does not probe Ollama or route inference.",
    "steps": [
      {
        "name": "Brain Registry / AutoFabric",
        "detail": "Discover installed models and inspect eligibility",
        "href": "../manual/#autofabric"
      },
      {
        "name": "GPU-Aware Crane Fly",
        "detail": "Consider fit, residency, reuse and local routing policy",
        "href": "../manual/#gpucrane"
      },
      {
        "name": "BudgetCompute",
        "detail": "Honor resource, attempt and paid-route boundaries",
        "href": "../manual/#budgetcompute"
      },
      {
        "name": "Executor Authorization",
        "detail": "Only the canonical runtime can approve and perform the model call",
        "href": "https://github.com/MichaelWave369/SuperPhiVessel/blob/main/docs/GOVERNANCE.md"
      }
    ]
  }
};
