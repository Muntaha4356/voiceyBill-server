import { Env } from "./env.config";

// Default to OpenAI. Use OPENAI_BASE_URL to override for OpenRouter or another compatible proxy.
const OPENAI_BASE_URL = Env.OPENAI_BASE_URL?.replace(/\/$/, "") || "https://api.openai.com/v1";
console.log("[OpenAI Config] Using base URL:", OPENAI_BASE_URL);

const openAIRequest = async (apiKey: string, path: string, body: any) => {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for OpenAI/OpenRouter requests");
  }

  const url = `${OPENAI_BASE_URL}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  let data: any;

  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = { text: responseText };
  }

  if (!response.ok) {
    const error: any = new Error(
      `OpenAI/OpenRouter request failed: ${response.status} ${response.statusText}`
    );
    error.response = { status: response.status, data };
    throw error;
  }

  return data;
};

export const createOpenAIClient = (apiKey: string) => ({
  chat: {
    completions: {
      create: async (params: any) => openAIRequest(apiKey, "/chat/completions", params),
    },
  },
});

export const openai = createOpenAIClient(Env.OPENAI_API_KEY);
export const openAIModel = "gpt-4o";