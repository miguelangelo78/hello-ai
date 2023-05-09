import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from 'openai';
import prompt from 'prompt-sync';
import { config } from 'dotenv';
config();

export class AI {
    private openai: OpenAIApi;
    private context: string[] = [];
    private model = 'gpt-3.5-turbo';

    public setContext(context: string[]) {
        this.context = context;
    }

    public addContext(context: string) {
        this.context.push(context);
    }

    constructor() {
        this.openai = new OpenAIApi(new Configuration({
            apiKey: process.env.OPENAI_API_KEY,
        }));
    }

    async talk(prompt: string, assimilate = true) {
        const messages: ChatCompletionRequestMessage[] = [{ role: 'user', content: prompt }];

        if (this.context) {
            messages.unshift(...this.context.map((content) => ({ role: 'assistant', content } as ChatCompletionRequestMessage)));
        }

        const tokenLength = messages.reduce((acc, message) => acc + message.content.length, 0);
        console.log('Token length:', tokenLength);

        const response = await this.openai.createChatCompletion({
            model: this.model,
            messages,
            temperature: 1.1,
            frequency_penalty: 0.0,
            presence_penalty: 0.6,
        });

        const result = response.data.choices.map((choice) => choice.message?.content);

        if (assimilate) {
            const previousResponse = result.map((message) => `> ${message}`).join('\n');
            this.addContext(`Your character will assimilate the characteristics described in your past responses. Your previous response was:\n${previousResponse}`);
        }

        return result;
    }
}

(async () => {
    const ai = new AI();
    ai.setContext(['You will act as a 95 year old man named Bob.']);

    while (true) {
        const input = prompt()('You: ');
        const response = await ai.talk(input);
        console.log(`AI: ${response}`);
    }
})();
