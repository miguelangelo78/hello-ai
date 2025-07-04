import OpenAI from 'openai';
import { ChatCompletionChunk, ChatCompletionMessageParam } from 'openai/resources/chat';
import prompt from 'prompt-sync';
import { config } from 'dotenv';
import axios from 'axios';
import * as fs from 'fs';
config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = 'gpt-4o';

let fullContext: ChatCompletionMessageParam[] = [];

function setContext(context: ChatCompletionMessageParam[]) {
    fullContext = context;
}

function addContext(context: ChatCompletionMessageParam) {
    fullContext.push(context);
}

async function getWeather({ location }: { location: string }) {
    const url = `https://wttr.in/${encodeURIComponent(location)}?format=3`;
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        return `Failed to retrieve weather for ${location}: ${error}`;
    }
}

async function searchWeb({ query }: { query: string }) {
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/113.0.0.0 Safari/537.36',
        'Accept-Language': 'en-GB,en;q=0.9',
    };

    try {
        const response = await axios.get(searchUrl, { headers });
        return response.data;
    } catch (error) {
        return `Failed to fetch search results: ${error}`;
    }
}

async function convertCurrency({ amount, from, to }: { amount: number, from: string, to: string }) {
    try {
        const response = await axios.get(`https://api.exchangerate.host/convert?from=${from}&to=${to}&amount=${amount}`);
        const result = response.data;
        if (!result.success) return `Currency conversion failed.`;
        return `${amount} ${from} = ${result.result} ${to}`;
    } catch (err) {
        return `Failed to convert currency: ${err}`;
    }
}

function readFile({ path }: { path: string }) {
    try {
        return fs.readFileSync(path, 'utf-8');
    } catch (err) {
        return `Error reading file at ${path}: ${err}`;
    }
}

function writeFile({ path, content }: { path: string, content: string }) {
    try {
        fs.writeFileSync(path, content, 'utf-8');
        return `Successfully wrote to ${path}`;
    } catch (err) {
        return `Error writing to file at ${path}: ${err}`;
    }
}

function deleteFile({ path }: { path: string }) {
    try {
        fs.unlinkSync(path);
        return `Successfully deleted ${path}`;
    } catch (err) {
        return `Error deleting file at ${path}: ${err}`;
    }
}

const functions = [
    {
        name: "getWeather",
        description: "Get the current weather for a given location",
        parameters: {
            type: "object",
            properties: {
                location: {
                    type: "string",
                    description: "The city and country, e.g. 'London, UK'"
                }
            },
            required: ["location"]
        }
    },
    {
        name: "searchWeb",
        description: "Perform a web search for a given query",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "The search query to run on Bing"
                },
                url: {
                    type: "string",
                    description: "The URL to search, defaults to Bing if not provided"
                }
            },
            required: ["query"]
        }
    },
    {
        name: "convertCurrency",
        description: "Convert an amount from one currency to another",
        parameters: {
            type: "object",
            properties: {
                amount: { type: "number", description: "The amount of money to convert" },
                from: { type: "string", description: "The currency code to convert from (e.g. 'USD')" },
                to: { type: "string", description: "The currency code to convert to (e.g. 'EUR')" }
            },
            required: ["amount", "from", "to"]
        }
    },
    {
        name: "readFile",
        description: "Read a local file from disk",
        parameters: {
            type: "object",
            properties: {
                path: {
                    type: "string",
                    description: "Path to the file to read"
                }
            },
            required: ["path"]
        }
    },
    {
        name: "writeFile",
        description: "Write content to a file on disk",
        parameters: {
            type: "object",
            properties: {
                path: {
                    type: "string",
                    description: "Path to the file to write"
                },
                content: {
                    type: "string",
                    description: "Content to write into the file"
                }
            },
            required: ["path", "content"]
        }
    },
    {
        name: "deleteFile",
        description: "Delete a local file from disk",
        parameters: {
            type: "object",
            properties: {
                path: {
                    type: "string",
                    description: "Path to the file to delete"
                }
            },
            required: ["path"]
        }
    }
];

async function handleFunctionCall(name: string, args: any): Promise<string> {
    switch (name) {
        case "getWeather":
            return await getWeather(args);
        case "searchWeb":
            return await searchWeb(args);
        case "convertCurrency":
            return await convertCurrency(args);
        case "readFile":
            return readFile(args);
        case "writeFile":
            return writeFile(args);
        case "deleteFile":
            return deleteFile(args);
        default:
            return `Unknown function: ${name}`;
    }
}

async function processStreamChunks(stream: AsyncIterable<ChatCompletionChunk>) {
    let fullMessage = '';
    let functionCallData: any = null;

    for await (const part of stream) {
        const delta = part.choices?.[0]?.delta;

        if (delta?.function_call) {
            functionCallData = functionCallData || { name: '', arguments: '' };
            if (delta.function_call.name) functionCallData.name += delta.function_call.name;
            if (delta.function_call.arguments) functionCallData.arguments += delta.function_call.arguments;
        } else if (delta?.content) {
            if (fullMessage.length === 0) {
                process.stdout.write('AI: ');
            }
            process.stdout.write(delta.content);
            fullMessage += delta.content;
        }
    }

    return { fullMessage, functionCallData };
}

async function chat(promptInput: string) {
    const userMessage: ChatCompletionMessageParam = { role: 'user', content: promptInput };
    addContext(userMessage);

    let loopCount = 0;

    while (true) {
        const stream = await openai.chat.completions.create({
            model,
            messages: fullContext,
            temperature: 0.1,
            frequency_penalty: 0.0,
            presence_penalty: 0.6,
            functions,
            function_call: "auto",
            stream: true
        });

        const { fullMessage, functionCallData } = await processStreamChunks(stream);

        if (functionCallData) {
            const { name, arguments: argsString } = functionCallData;
            let args;
            try {
                args = JSON.parse(argsString || '{}');
            } catch (err) {
                throw new Error(`Failed to parse arguments for function ${name}: ${argsString}`);
            }

            const result = await handleFunctionCall(name, args);

            addContext({
                role: "assistant",
                content: null,
                function_call: functionCallData
            });

            addContext({
                role: "function",
                name,
                content: result
            });

            loopCount++;
            if (loopCount > 5) throw new Error("Too many function call loops. Possible runaway.");
        } else {
            addContext({
                role: "assistant",
                content: fullMessage
            });
            console.log('\n');
            return fullMessage;
        }
    }
}

(async () => {
    setContext([
        {
            role: 'system',
            content: `
You are a helpful assistant.
You help architects working on a specification for a construction project. Assume that the user is UK based
and works with modern tools and BIM.
You can browse websites to find information.
`
        }
    ]);

    while (true) {
        const input = prompt()('You: ');
        await chat(input);
    }
})();
