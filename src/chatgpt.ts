import OpenAI from "openai";
import { readFile } from "fs/promises";

let BOT_PERSONA: string | null = null;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function loadPersona() {
  if (!BOT_PERSONA) {
    BOT_PERSONA = await readFile("persona.md", "utf-8");
  }

  return BOT_PERSONA;
}

export async function askChatGPT(
  history: Array<{ role: 'user' | 'assistant', content: string }>
): Promise<string> {
  const persona = await loadPersona();
  // Приводим историю к типу OpenAI.ChatCompletionMessageParam[]
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: persona },
    ...history.map(m => ({ role: m.role, content: m.content }))
  ];
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
  });
  return completion.choices[0]?.message?.content ?? '';
}
