'use server';
import OpenAI from "openai";

function createOpenAIClient(): OpenAI | null {
    if (typeof window !== 'undefined') {
        throw new Error('OpenAI client must be used from the server (server-side only)');
    }
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    if (!apiKey) {
        // Don't throw here to avoid crashing server actions when the env var isn't set.
        // The calling code should handle a null client and return a safe fallback.
        return null;
    }
    return new OpenAI({ apiKey });
}

export async function getBibleVerseSuggestions(songTitle: string): Promise<string[]> {
    try {
        const openai = createOpenAIClient();
        if (!openai) {
            console.warn('OPENAI_API_KEY not set; skipping AI verse suggestions.');
            return [];
        }
        const prompt = `Sugerează 3-4 versete sau pasaje biblice relevante pentru titlul cântecului "${songTitle}". Include atât referințele, cât și textul versetelor în traducerea română VDC. Poți propune și mai multe versete din același pasaj biblic. Fă fiecare sugestie clară, pe rânduri separate.`;
        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 700,
            temperature: 0.2,
        });
        if (response.choices && response.choices.length > 0 && response.choices[0].message && response.choices[0].message.content) {
            const suggestions = response.choices[0].message.content.trim().split("\n").map(line => line.trim()).filter(line => line);
            if (suggestions.length > 0) return suggestions;

            // Fallback: if the model returned nothing (possible license/content constraints),
            // ask for references only (no verse text).
            const fallbackPrompt = `Dacă nu poți furniza textul versetelor din motive de licență, oferă doar referințele a 3 versete relevante pentru titlul cântecului "${songTitle}". Oferă doar referințele, pe linii separate.`;
            try {
                const fallback = await openai.chat.completions.create({
                    model: "gpt-4",
                    messages: [{ role: "user", content: fallbackPrompt }],
                    max_tokens: 120,
                    temperature: 0,
                });
                if (fallback.choices && fallback.choices.length > 0 && fallback.choices[0].message && fallback.choices[0].message.content) {
                    const fb = fallback.choices[0].message.content.trim().split("\n").map(l => l.trim()).filter(Boolean);
                    return fb;
                }
            } catch (err) {
                console.error("Fallback request failed:", err);
            }

            return suggestions;
        }
        return [];
    } catch (error) {
        console.error("Error fetching Bible verse suggestions:", error);
        return [];
    }
}
