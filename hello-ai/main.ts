import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from 'openai';
import prompt from 'prompt-sync';
import { config } from 'dotenv';
config();

const openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY }));
const model = 'gpt-4o';

let fullContext: ChatCompletionRequestMessage[] = [];

function setContext(context: ChatCompletionRequestMessage[]) {
    fullContext = context;
}

function addContext(context: ChatCompletionRequestMessage) {
    fullContext.push(context);
}

async function chat(prompt: string) {
    const userMessage: ChatCompletionRequestMessage = { role: 'user', content: prompt };

    // Add user message to context
    addContext(userMessage);

    const response = await openai.createChatCompletion({
        model,
        messages: fullContext,
        temperature: 0.1, // From docs:  What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.  We generally recommend altering this or `top_p` but not both.
        frequency_penalty: 0.0, // From docs: Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model\'s likelihood to repeat the same line verbatim.  [See more information about frequency and presence penalties.](/docs/api-reference/parameter-details)
        presence_penalty: 0.6, // From docs: Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model\'s likelihood to talk about new topics.  [See more information about frequency and presence penalties.](/docs/api-reference/parameter-details)
    });

    // Add AI response to context
    const aiResponse: ChatCompletionRequestMessage = {
        role: 'assistant',
        content: response.data.choices[0].message?.content || ''
    };
    addContext(aiResponse);

    return aiResponse.content;
}

////////////////////////////////
// Main code starts down here //
////////////////////////////////
(async () => {
    // Set up system prompt
    setContext([
        {
            role: 'system',
            content: `
You are a helpful assistant.
You help architects working on a specification for a construction project. Assume that the user is UK based
and works with modern tools and BIM.
`
        }
    ]);

    while (true) {
        const input = prompt()('You: ');
        const response = await chat(input);
        console.log(`AI: ${response}\n`);
    }
})();
