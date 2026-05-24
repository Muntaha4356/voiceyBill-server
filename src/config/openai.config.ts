import OpenAI from "openai";
import { Env } from "./env.config";

export const openai = new OpenAI({
  apiKey: Env.OPENAI_API_KEY,
  baseURL: Env.OPENAI_API_BASE_URL,
});
export const openAIModel = Env.OPENAI_MODEL;
