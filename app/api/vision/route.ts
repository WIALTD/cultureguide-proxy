import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageBase64, systemPrompt } = body;
    
    if (!imageBase64) {
      return NextResponse.json({ error: "imageBase64 required" }, { status: 400 });
    }
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }
    
    // Use the systemPrompt from the client, or fallback to a basic one
    const finalSystemPrompt = systemPrompt || "You are an art historian. Identify artwork in the image and respond with JSON only.";
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: finalSystemPrompt
          },
          {
            role: "user",
            content: [{ type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }]
          }
        ],
        max_tokens: 2000
      })
    });
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    return NextResponse.json({ content }, {
      headers: { "Access-Control-Allow-Origin": "*" }
    });
    
  } catch (error) {
    console.error('Vision API proxy error:', error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
