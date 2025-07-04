# hello-ai
A simple app written in typescript that lets you talk with gpt-4o directly on the command line prompt by prompt. 

This is the equivalent of a hello-world but for AI.

# Installation
`npm install`

# Usage
Run `npm start` and the console will prompt you for the first question. The AI will answer and it will wait for your next question.

You can adjust the AI by setting the context using the method `AI.setContext`. Please make sure to limit the token length - if the limit is reached the AI will begin to lose context.

# API Key
Please rename `env.template` to `.env` and replace your OpenAI key.
