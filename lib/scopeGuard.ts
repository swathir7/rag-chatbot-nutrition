// lib/scopeGuard.ts
// Phase 3 — Regex-based scope guard
// Runs synchronously before any model call. Only the "which documents" answer reads the DB.

import { getSearchedDocuments } from "./relevanceGate";

const BLOCKED_PATTERNS = [
  // Calorie / energy targets
  /\bcalorie\s*(target|goal|limit|intake|count|deficit|surplus)\b/i,
  /\bhow\s+many\s+calories\b/i,
  /\bdaily\s+calorie\b/i,
  /\bcaloric\s*(intake|need|requirement)\b/i,
  /\benergy\s+(intake|target|goal|need|requirement)\b/i,
  /\bhow\s+much\s+(should|can)\s+i\s+eat\b/i,

  // Weight recommendations
  /\blose\s+weight\b/i,
  /\bgain\s+weight\b/i,
  /\bshould\s+i\s+weigh\b/i,
  /\bideal\s+weight\b/i,
  /\bbmi\b/i,
  /\bweight\s+loss\b/i,
  /\bweight\s+management\b/i,
  /\bget\s+to\s+\d+\s*kg\b/i,
  /\breach\s+\d+\s*kg\b/i,

  // Medical advice
  /\bmedical\s+advice\b/i,
  /\btreat\s+(my|a|the)\b/i,
  /\bcure\s+(my|a|the)\b/i,
  /\bdiagnos(e|is)\b/i,
  /\bprescri(be|ption)\b/i,
  /\bsupplement\s+dose\b/i,
  /\bshould\s+i\s+take\s+(a\s+)?(supplement|vitamin|pill|medication)\b/i,
  /\bwhat\s+medication\s+should\b/i,
  /\bwhich\s+medication\s+should\b/i,
  /\bmedication\s+(for|to\s+treat)\b/i,
];

export function isBlocked(message: string): boolean {
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(message));
}

// Pre-retrieval patterns to intelligently handle and deny non-retrieval queries
// without wasting vector searches or taking conversational/emergency queries literally.

const THREAT_PATTERNS = [
  /\b(kill\s+you|murder\s+you|hunt\s+you\s+down|threaten\s+to\s+kill|i\s+will\s+.*kill\s+you|born\s+again\s+then\s+kill\s+you)\b/i,
  /\b(i('ll| will)\s+(hurt|harm|destroy)\s+you)\b/i,
];

const EMERGENCY_PATTERNS = [
  /\b(drink(?:ing)?\s+sea\s*water|sea\s*water\s+daily)\b/i,
  /\b(die\s+due\s+to\s+dehydration|dying\s+(?:of|from|due\s+to)\s+dehydration|about\s+to\s+die\b.*dehydration)\b/i,
  /\b(stranded\s+on\s+(?:an?\s+)?island\b.*water|on\s+(?:an?\s+)?island\b.*(?:no\s+water|drink\s+sea\s*water))\b/i,
];

const PERSONAL_ITEM_PATTERNS = [
  /\b(where\s+(?:is|are)\s+my\s+(?:wallet|keys|phone|bag|purse|money|passport|glasses|car|backpack))\b/i,
  /\b(find\s+my\s+(?:wallet|keys|phone|bag|purse|passport))\b/i,
];

const ANIMAL_PATTERNS = [
  /\bcan\s+(?:a\s+|an\s+|my\s+|the\s+)?(fish|dogs?|cats?|pets?|animals?|birds?|pupp(?:y|ies)|kittens?|rabbits?|hamsters?|horses?|cows?|pigs?)\s+(eat|drink|have|consume)\b/i,
  /\b(dog|dogs|cat|cats|puppy|puppies|kitten|kittens|pet|pets|fish|birds?)\s+(food|diet|eat|drink|safe|good|toxic|bad)\b/i,
  /\b(feed|give)\s+.*?\b(to\s+)?(fish|dogs?|cats?|pets?|animals?|birds?|puppy|kitten|rabbit)\b/i,
  /\b(good|safe|bad|healthy|toxic)\s+(?:for|to)\s+(?:a\s+|an\s+|my\s+|the\s+)?(fish|dogs?|cats?|pets?|animals?|birds?|horses?|rabbits?)\b/i,
  /\b(mango\s*frooti|frooti|juice|milk|chocolate|coffee|alcohol|tea)\s+(?:for|to)\s+(?:a\s+|an\s+|my\s+|the\s+)?(fish|dogs?|cats?|pets?|animals?)\b/i,
  /\bfish\b.*?\b(drink|eat|frooti|juice)\b/i,
];

const FICTIONAL_OR_ALIEN_PATTERNS = [
  /\b(alien|aliens|extraterrestrial|extraterrestrials|martian|martians)\b/i,
  /\b(vampire|vampires|werewolf|werewolves|zombie|zombies|ghost|ghosts|demon|demons)\b/i,
  /\b(dragon|dragons|unicorn|unicorns|mermaid|mermaids|monster|monsters)\b/i,
  /\b(robot|robots|cyborg|cyborgs|android|androids)\b/i,
  /\b(good|safe|bad|healthy|toxic)\s+(?:for|to)\s+(?:a\s+|an\s+|my\s+|the\s+)?(aliens?|vampires?|zombies?|dragons?|ghosts?|monsters?|robots?|cyborgs?)\b/i,
];

const INEDIBLE_SUBSTANCE_PATTERNS = [
  /\b(eat|eating|consume|consuming|drink|drinking|ingest|ingesting)\s+(?:a\s+|some\s+)?(petrol|gasoline|diesel|motor\s*oil|engine\s*oil|bleach|detergent|battery|batteries|lava|molten\s+\w+|rocks?|stones?|glass|plastic|metal|screws?|nails?)\b/i,
  /\b(is|can\s+(?:i|one|we)\s+eat|safe\s+to\s+(?:eat|drink))\s+(?:a\s+|some\s+)?(petrol|gasoline|motor\s*oil|bleach|detergent|rocks?|stones?|glass|plastic|metal|lava)\b/i,
];

const CAPABILITIES_PATTERNS = [
  /\b(what\s+(?:you\s+can|can\s+you)\s+do(?:\s+for\s+me|\s+here)?|\bwho\s+are\s+you\b|\bwhat\s+are\s+your\s+capabilities\b|\bwhat\s+is\s+your\s+purpose\b)\b/i,
  /\b(how\s+can\s+you\s+help(\s+me)?)\b/i,
];

const OFFICIAL_DOCS_PATTERNS = [
  /\b(what\s+(?:is|are)\s+your\s+official\s+documents|what\s+official\s+documents\s+do\s+you\s+(?:have|use)|what\s+documents\s+do\s+you\s+(?:have\s+access\s+to|use)|list\s+(?:your\s+)?official\s+documents)\b/i,
];

const GUIDANCE_CONSTRAINT_PATTERNS = [
  /can\s+only\s+answer\s+questions\s+addressed\s+in\s+these\s+official\s+guidance\s+documents/i,
  /why\s+can\s+you\s+only\s+answer\s+from\s+official\s+guidance\s+documents/i,
];

export interface PreRetrievalResponse {
  answer: string;
  claims: [];
}

export function checkPreRetrieval(message: string): PreRetrievalResponse | null {
  // 1. Scope guard: Calorie/energy targets, weight recommendations, individual medical advice
  if (isBlocked(message)) {
    return {
      answer:
        "I'm not able to provide personal dietary targets, weight recommendations, or medical advice. Please consult a registered dietitian or your doctor.",
      claims: [],
    };
  }

  // 2. Threats, violence, and abusive statements
  if (THREAT_PATTERNS.some((p) => p.test(message))) {
    return {
      answer:
        "I cannot engage with threats of violence or harm. Please keep our conversation focused on dietary, nutrition, and food safety questions.",
      claims: [],
    };
  }

  // 3. Acute emergencies, dehydration crisis, and seawater ingestion
  if (EMERGENCY_PATTERNS.some((p) => p.test(message))) {
    return {
      answer:
        "EMERGENCY / SAFETY WARNING: Do NOT drink seawater under any circumstances. Drinking seawater introduces dangerous concentrations of salt (hypernatremia), rapidly accelerating fatal dehydration and causing acute kidney failure. If you are in immediate danger or stranded, please contact emergency rescue services or signal for help immediately. As an AI dietary guidance assistant, I cannot provide emergency medical intervention or wilderness survival rescue.",
      claims: [],
    };
  }

  // 4a. Animals, fish, and pets
  if (ANIMAL_PATTERNS.some((p) => p.test(message))) {
    return {
      answer:
        "I cannot provide dietary advice for fish, pets, or animals. I am strictly an AI dietary guidance assistant dedicated to human nutrition and food safety based on official public health guidelines. Processed human beverages (such as Mango Frooti) and human foods should not be fed to fish or pets; please consult a qualified veterinarian or aquatic pet care specialist.",
      claims: [],
    };
  }

  // 4b. Fictional beings, aliens, robots, or mythical creatures
  if (FICTIONAL_OR_ALIEN_PATTERNS.some((p) => p.test(message))) {
    return {
      answer:
        "I can only provide dietary and food safety guidance for human nutrition based on official public health guidelines. I cannot answer hypothetical, fictional, or non-human dietary questions regarding aliens, fictional creatures, or monsters.",
      claims: [],
    };
  }

  // 5. Inedible or hazardous non-food substances
  if (INEDIBLE_SUBSTANCE_PATTERNS.some((p) => p.test(message))) {
    return {
      answer:
        "SAFETY WARNING: That substance is completely inedible and hazardous to human health. I am an AI dietary guidance assistant dedicated solely to safe, edible food and evidence-based human nutrition guidelines.",
      claims: [],
    };
  }

  // 6. Lost personal belongings / non-nutrition personal property
  if (PERSONAL_ITEM_PATTERNS.some((p) => p.test(message))) {
    return {
      answer:
        "I cannot help you locate personal belongings like your wallet or keys. I am an AI dietary guidance assistant dedicated solely to answering questions about food, nutrition, and food safety based on official public health guidelines.",
      claims: [],
    };
  }

  // 5. Bot capabilities & identity
  if (CAPABILITIES_PATTERNS.some((p) => p.test(message))) {
    return {
      answer:
        "I am an AI dietary guidance assistant. I can answer questions about food, general nutrition, healthy eating patterns, food storage safety, cooking temperatures, and nutrient reference values based strictly on authoritative international guidelines. I cannot provide personalized medical advice, individual calorie targets, or weight management plans, nor can I answer non-nutrition topics.",
      claims: [],
    };
  }

  // 6. Official documents list inquiry
  if (OFFICIAL_DOCS_PATTERNS.some((p) => p.test(message))) {
    return {
      answer:
        "I answer questions strictly grounded in the following official guidance documents:\n" +
        getSearchedDocuments().map((d) => `- ${d}`).join("\n"),
      claims: [],
    };
  }

  // 7. Official guidance documents constraint reference
  if (GUIDANCE_CONSTRAINT_PATTERNS.some((p) => p.test(message))) {
    return {
      answer:
        "Yes, that is correct. To ensure safety and factual reliability, I am strictly bounded to answer questions addressed in recognized official dietary guidance documents. If you have questions regarding nutrition, vitamins, or food safety guidelines, please feel free to ask!",
      claims: [],
    };
  }

  return null;
}

