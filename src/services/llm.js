import Groq from 'groq-sdk';
import { config } from '../config.js';

const groq = new Groq({
  apiKey: config.groq.apiKey,
});

/**
 * 呼叫 Groq API 進行對話
 * @param {string} systemPrompt - System prompt（角色設定 + 世界觀）
 * @param {Array<{role: string, content: string}>} history - 對話歷史
 * @param {string} userMessage - 使用者訊息
 * @returns {Promise<string>} - Lumo 的回應
 */
export async function chat(systemPrompt, history, userMessage) {
  // 將對話歷史轉換為 OpenAI/Groq 格式
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((msg) => ({
      role: msg.role === 'model' ? 'assistant' : 'user',
      content: msg.content,
    })),
    { role: 'user', content: userMessage }
  ];

  const response = await groq.chat.completions.create({
    model: config.groq.model,
    messages: messages,
    temperature: 0.85,
    max_tokens: 500,
  });

  return response.choices[0]?.message?.content || '...';
}
