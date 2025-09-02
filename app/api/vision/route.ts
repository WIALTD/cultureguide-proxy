import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const MAX_PAYLOAD_SIZE = 1.7 * 1024 * 1024; // 1.7MB limit for Edge functions

export async function POST(request: NextRequest) {
  try {
    // Check request size
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_SIZE) {
      return NextResponse.json(
        { error: 'Payload too large. Please compress your image.' },
        { status: 413 }
      );
    }

    const body = await request.json();
    const { imageBase64, systemPrompt, model = 'gpt-5-mini', max_tokens = 2000, temperature = 0.3, hints } = body;
    
    if (!imageBase64) {
      return NextResponse.json({ error: "imageBase64 required" }, { status: 400 });
    }
    
    // Check base64 size
    const base64Size = imageBase64.length * 0.75; // Approximate binary size
    if (base64Size > MAX_PAYLOAD_SIZE * 0.8) { // Leave some headroom
      return NextResponse.json(
        { error: 'Image too large. Please compress your image further.' },
        { status: 413 }
      );
    }
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }
    
    // Use the systemPrompt from the client, or fallback to a basic one
    let finalSystemPrompt = systemPrompt || "You are an art historian. Identify artwork in the image and respond with JSON only.";
    
    // Add hints to the system prompt if provided
    if (hints?.museum) {
      finalSystemPrompt += `\n\nMuseum context: This artwork is located at ${hints.museum}.`;
    }
    if (hints?.ocrText) {
      finalSystemPrompt += `\n\nLabel text found: "${hints.ocrText}". Use this information to help identify the artwork.`;
    }
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
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
        max_tokens,
        temperature
      })
    });
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    return NextResponse.json({ content }, {
      headers: { 
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
    
  } catch (error) {
    console.error('Vision API proxy error:', error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Handle CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
