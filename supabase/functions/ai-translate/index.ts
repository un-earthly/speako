import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiKey) {
    return new Response(JSON.stringify({ error: 'OpenAI not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { text, sourceLang, targetLang } = await req.json()

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid text' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const sourceName = sourceLang || 'the source language'
    const targetName = targetLang || 'the target language'

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the user's text from ${sourceName} to ${targetName}. Preserve tone, meaning, and cultural nuance. Respond with ONLY the translated text — no explanations, no quotes, no additional commentary.`,
          },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[OpenAI] API error:', errText)
      return new Response(JSON.stringify({ error: 'Translation service error' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const data = await response.json()
    const translated = data.choices?.[0]?.message?.content?.trim() || ''

    return new Response(
      JSON.stringify({ translated }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      }
    )
  } catch (err: any) {
    console.error('[AI Translate] Error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
})
