import { ENV } from "./env.js";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type MessageContent =
  | string
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file_url"; file_url: { url: string; mime_type?: string } };

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: "none" | "auto" | "required" | { name: string };
  maxTokens?: number;
  responseFormat?: { type: "text" | "json_object" } | {
    type: "json_schema";
    json_schema: { name: string; schema: Record<string, unknown>; strict?: boolean };
  };
};

export type InvokeResult = {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string | null;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

function resolveApiUrl(): string {
  const base = ENV.FORGE_API_URL?.trim().replace(/\/$/, "") ?? "https://forge.manus.im";
  return `${base}/v1/chat/completions`;
}

function getApiKey(): string {
  const key = ENV.BUILT_IN_FORGE_API_KEY ?? ENV.OPENAI_API_KEY;
  if (!key) throw new Error("LLM API key not configured");
  return key;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const apiKey = getApiKey();

  const payload: Record<string, unknown> = {
    model: "gemini-2.5-flash",
    messages: params.messages.map((msg) => {
      const content = Array.isArray(msg.content) ? msg.content : [msg.content];
      const normalizedContent = content.map((c) =>
        typeof c === "string" ? { type: "text", text: c } : c
      );
      return {
        role: msg.role,
        content:
          normalizedContent.length === 1 && normalizedContent[0].type === "text"
            ? (normalizedContent[0] as { text: string }).text
            : normalizedContent,
        ...(msg.name ? { name: msg.name } : {}),
        ...(msg.tool_call_id ? { tool_call_id: msg.tool_call_id } : {}),
      };
    }),
    max_tokens: params.maxTokens ?? 8192,
  };

  if (params.tools && params.tools.length > 0) {
    payload.tools = params.tools;
  }
  if (params.responseFormat) {
    payload.response_format = params.responseFormat;
  }

  const maxRetries = 4;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(resolveApiUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return (await response.json()) as InvokeResult;
    }

    if (response.status === 429 && attempt < maxRetries) {
      const delay = 2000 * Math.pow(2, attempt);
      console.warn(
        `[LLM] Rate limit — aguardando ${delay}ms (tentativa ${attempt + 1}/${maxRetries})`
      );
      await sleep(delay);
      continue;
    }

    const errorText = await response.text();
    throw new Error(`LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`);
  }

  throw new Error("LLM invoke failed: máximo de tentativas atingido");
}

export function extractTextContent(result: InvokeResult): string {
  return result.choices[0]?.message?.content ?? "";
}

export function parseJsonFromLLM<T = unknown>(text: string): T {
  const cleaned = text
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();
  return JSON.parse(cleaned) as T;
}
