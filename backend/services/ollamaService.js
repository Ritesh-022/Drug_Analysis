const axios = require("axios");

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3";
const OLLAMA_TIMEOUT = parseInt(process.env.OLLAMA_TIMEOUT || "60", 10) * 1000;

function buildPrompt(context) {
  if (context.mode === "forensic") {
    return `You are a forensic toxicology expert assisting law enforcement and forensic laboratories. Analyze the following compound prediction data in the context of a forensic case and return a JSON object only — no markdown, no explanation outside the JSON.

Forensic Case Data:
${JSON.stringify(context, null, 2)}

Return this exact JSON structure:
{
  "interpretation": "forensic interpretation of the compound's toxicity and classification",
  "causes": ["possible cause of exposure or presence of this compound"],
  "precautions": ["safety precautions for handling this compound in a forensic setting"],
  "remedies": ["medical countermeasures or antidotes if applicable"],
  "risks": ["legal, health, and public safety risks associated with this compound"],
  "domain_advice": "forensic-specific advice on evidence handling, chain of custody, and legal implications",
  "model_disagreement_note": ""
}`;
  }

  return `You are a pharmaceutical toxicology expert. Analyze the following ML prediction data for a drug compound and return a JSON object only — no markdown, no explanation outside the JSON.

Prediction Data:
${JSON.stringify(context, null, 2)}

Return this exact JSON structure:
{
  "interpretation": "brief overall interpretation",
  "causes": ["cause1", "cause2"],
  "precautions": ["precaution1", "precaution2"],
  "remedies": ["remedy1", "remedy2"],
  "risks": ["risk1", "risk2"],
  "domain_advice": "domain-specific advice",
  "model_disagreement_note": "note if GNN and XGB disagree significantly, else empty string"
}`;
}

function parseOllamaResponse(text) {
  // Strip markdown code fences if present
  const stripped = text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "");
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in Ollama response");
  return JSON.parse(match[0]);
}

async function analyzePrediction(context) {
  const prompt = buildPrompt(context);

  let resp;
  try {
    resp = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      { model: OLLAMA_MODEL, prompt, stream: false },
      { timeout: OLLAMA_TIMEOUT }
    );
  } catch (e) {
    const msg = e.code === "ECONNREFUSED"
      ? `Ollama not running at ${OLLAMA_URL}`
      : e.code === "ETIMEDOUT" || e.code === "ECONNABORTED"
      ? `Ollama timed out after ${OLLAMA_TIMEOUT}ms`
      : `Ollama request failed: ${e.message}`;
    throw new Error(msg);
  }

  const raw = resp.data?.response;
  if (!raw) throw new Error(`Ollama returned empty response. Full body: ${JSON.stringify(resp.data)}`);

  return parseOllamaResponse(raw);
}

module.exports = { analyzePrediction };
