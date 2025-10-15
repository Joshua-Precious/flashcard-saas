import { NextResponse } from 'next/server'

export async function GET() {
    try {
        // First check if we have an API key
        if (!process.env.OPENROUTER_API_KEY) {
            throw new Error('OPENROUTER_API_KEY is not set in environment variables');
        }

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
                'X-Title': 'Flashcard Study Buddy'
            },
            body: JSON.stringify({
                model: 'mistralai/mistral-7b-instruct',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful assistant. Respond with "Connection successful!" if you receive this message.'
                    },
                    {
                        role: 'user',
                        content: 'Test connection'
                    }
                ]
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Failed to connect to AI');
        }

        const completion = await response.json();

        return NextResponse.json({
            success: true,
            message: completion.choices[0].message.content
        });
    } catch (error) {
        console.error('Connection test failed:', error);
        return NextResponse.json({
            success: false,
            error: error.message,
            hint: !process.env.OPENROUTER_API_KEY ? 'Make sure you have set up the OPENROUTER_API_KEY in your .env.local file' : undefined
        }, { status: 500 });
    }
} 