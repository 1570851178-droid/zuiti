// Vercel Serverless Function — AI 生成接口
// API Key 从环境变量读取，不暴露在前端

export const config = { runtime: 'edge' }

const TONE_MAP = {
  '非常委婉': 'very soft and indirect',
  '偏委婉': 'somewhat soft',
  '适中': 'balanced',
  '偏直接': 'fairly direct',
  '非常直接': 'very direct and assertive',
}

const STYLE_MAP = {
  '正式书面': 'formal written Chinese',
  '偏书面': 'slightly formal',
  '适中': 'neutral',
  '偏口语': 'conversational',
  '纯口语': 'casual spoken Chinese',
}

function buildPrompt({ raw, recipient, scene, tone, style, length, context, mode }) {
  const isWork = mode === 'work'
  const expert = isWork
    ? '职场沟通专家，帮助用户将想法转化为得体的职场用语'
    : '人际沟通专家，帮助用户在日常生活中找到自然、得体的表达方式'
  const replyLabel = isWork ? '职场回复' : '回复'
  return `你是一个${expert}。

发送对象：${recipient}
沟通场景：${scene}
语气强度：${tone}
表达风格：${style}
回复长度：${length}
${context ? `背景信息：${context}` : ''}

用户想表达的意思："${raw}"

请生成一段${replyLabel}，要求：
1. 严格按照JSON格式返回，不要输出其他内容
2. 包含 strategy（一句话说明这段回复的措辞策略）和 content（正文）
3. 严格遵守长度要求
4. 语气和风格严格匹配设置
5. 内容自然真实，避免模板化套话

返回格式（只返回JSON）：
{"strategy": "...", "content": "..."}`
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const apiKey = process.env.AI_API_KEY
  const baseUrl = process.env.AI_BASE_URL || 'https://api.siliconflow.cn/v1'
  const model = process.env.AI_MODEL || 'Qwen/Qwen3-8B'

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'AI_API_KEY not configured' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const { raw, recipient, scene, tone, style, length, context, mode } = body

  if (!raw?.trim()) {
    return new Response(JSON.stringify({ error: '请填写你想说的原话' }), { status: 400 })
  }

  const prompt = buildPrompt({ raw, recipient, scene, tone, style, length, context, mode })

  // 调用 OpenAI-compatible API（硅基流动完全兼容）
  const aiRes = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: 'json_object' },
      stream: true,
    }),
  })

  if (!aiRes.ok) {
    const err = await aiRes.text()
    return new Response(
      JSON.stringify({ error: `AI API error ${aiRes.status}: ${err.slice(0, 200)}` }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // 把 OpenAI SSE 流转成我们自己的 SSE 格式透传给前端
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const reader = aiRes.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop()

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              continue
            }
            try {
              const obj = JSON.parse(data)
              const chunk = obj.choices?.[0]?.delta?.content
              if (chunk) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`))
              }
            } catch { /* skip malformed */ }
          }
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
