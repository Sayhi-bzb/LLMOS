# React + TypeScript + Vite + shadcn/ui

This is a Vite React app with an ANSI-aware ASCII canvas. The current LLM turn can be streamed into the canvas through a LiteLLM proxy.

## LLM setup

Run LiteLLM separately. You can configure the proxy connection from the floating LLM button in the top-right corner of the app. Saving there writes these values to `.env.local`:

```bash
LITELLM_BASE_URL=http://localhost:4000/v1
LITELLM_API_KEY=your-proxy-api-key
LITELLM_MODEL=your-litellm-model-name
```

`LITELLM_BASE_URL` defaults to `http://localhost:4000/v1` when omitted. `LITELLM_API_KEY` and `LITELLM_MODEL` are required before sending prompts.

The config popover does not echo the saved key back to the browser. Leaving the key field empty while saving keeps the existing server key.

You can also set the same values in the shell before starting Vite:

```bash
LITELLM_BASE_URL=http://localhost:4000/v1
LITELLM_API_KEY=your-proxy-api-key
LITELLM_MODEL=your-litellm-model-name
npm run dev
```

The page persists only the System prompt in browser `localStorage`. URL, key, and model are server-side `.env.local` settings.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `src/components` directory.

## Using components

To use components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button"
```
