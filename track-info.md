📚 Resources

Hackathon Resources — Vercel Agent Tracks
==========================================

Everything you need to ship an AI or Agent powered project across our three hackathon tracks. Docs, templates, quickstarts, and pro tips.

---

🔗 General Resources
---------------------

These are your starting points regardless of which track you choose.

| Resource                                    | Link                                                        |
|---------------------------------------------|-------------------------------------------------------------|
| Vercel Docs                                 | https://vercel.com/docs                                     |
| Vercel AI Platform                          | https://vercel.com/ai                                       |
| AI Templates Gallery                        | https://vercel.com/templates/ai                             |
| AI SDK Docs                                 | https://ai-sdk.dev/docs                                     |
| v0 (ask v0 about anything Vercel)           | https://v0.app/                                             |
| AI SDK                                      | https://ai-sdk.dev/                                         |
| Agents Docs                                 | https://ai-sdk.dev/docs/ai-sdk-core/agents                  |
| MCP Docs                                    | https://vercel.com/docs/mcp / https://v0.app/docs/MCP       |
| Integrations                                | https://vercel.com/integrations                              |
| Agent Skills & Resources                    | https://vercel.com/docs/agent-resources                      |
| Vercel Plugin (for coding agents)           | Use this to maximize building on Vercel with best practices  |
| Sandbox                                     | https://vercel.com/docs/functions/sandbox                    |
| Workflow SDK                                | https://useworkflow.dev/                                     |
| AI Gateway & Models                         | https://vercel.com/ai-gateway/models                         |
| AI SDK 6 Announcement                       | https://vercel.com/blog/ai-sdk-6                             |
| llms.txt (feed to your LLM)                | https://ai-sdk.dev/llms.txt                                  |
| vercel/ai GitHub                            | https://github.com/vercel/ai                                 |

🎓 Learning

| Resource                    | Link                                                                       |
|-----------------------------|----------------------------------------------------------------------------|
| Vercel Academy              | https://vercel.com/academy                                                 |
| AI SDK Course               | https://vercel.com/academy/ai-sdk                                          |
| AI Summary App Course       | https://vercel.com/academy/ai-summary-app-with-nextjs                      |
| Building AI Agents Guide    | https://vercel.com/kb/guide/how-to-build-ai-agents-with-vercel-and-the-ai-sdk |

---

Track 1: Vercel Workflow (WDK)
------------------------------

Build long-running, durable async agents with the Workflow Development Kit.

Your agents survive crashes, resume after deploys, and can pause for minutes or months. Use "use workflow" and "use step" directives to make async functions durable. Pair with DurableAgent from @workflow/ai/agent for AI-powered workflows with built-in streaming, retries, and observability.

Quick Start:
1. Scaffold a Next.js app: npx create-next-app@latest --no-src-dir
2. Add WDK: npx workflow@latest
3. Wrap your Next.js config: export default withWorkflow(nextConfig)
4. Create workflow functions with "use workflow" and steps with "use step"
5. Use DurableAgent from @workflow/ai/agent for AI agent workflows
6. Get a Gateway API key from the Vercel AI Gateway (https://vercel.com/ai-gateway)
7. Deploy to Vercel — it auto-provisions queues, persistence, and routing

Key Resources:

| Resource                    | Type       | Link                                                     |
|-----------------------------|------------|----------------------------------------------------------|
| Workflow SDK Docs           | 📘 Docs    | https://useworkflow.dev/                                  |
| Workflow on Vercel          | ☁️ Docs    | https://vercel.com/docs/workflow                          |
| Building Durable AI Agents  | 🛠️ Guide   | https://useworkflow.dev/docs/ai                           |
| vercel/workflow             | ⚙️ Repo    | https://github.com/vercel/workflow                        |
| Introducing WDK             | 📰 Blog    | https://vercel.com/blog/introducing-workflow              |
| Agent Patterns              | 🧩 Patterns| https://www.aisdkagents.com/explore/ai-agent-frameworks   |

---

Track 2: v0 + MCPs
-------------------

Use v0 to rapidly build an AI app or agent that connects to at least one MCP server.

v0 generates React/Next.js code from natural language — describe what you want and iterate in real time. Connect to MCP servers (Vercel MCP, custom-built, or third-party) to give your app access to external data and tools. Examples: a dashboard that reads from GitHub via MCP, an assistant that queries your Vercel deployments, or a support agent wired to a knowledge base.

Quick Start:
1. Open https://v0.app/ and describe the app you want to build
2. Iterate on UI and logic with natural language prompts
3. Add AI features with the AI SDK — v0 scaffolds the integration for you
4. Connect an MCP server (https://v0.app/docs/MCP)
5. Deploy to Vercel with one click
6. To build your own MCP server, see the deployment guide (https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel)

Key Resources:

| Resource                | Type         | Link                                                        |
|-------------------------|--------------|-------------------------------------------------------------|
| v0 by Vercel            | ⚡ Tool       | https://v0.app/                                              |
| MCP on Vercel           | 🔌 Docs      | https://vercel.com/docs/mcp                                  |
| Vercel MCP Server       | 🔑 Docs      | https://vercel.com/docs/agent-resources/vercel-mcp           |
| Deploy MCP Servers      | 🚀 Guide     | https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel     |
| AI SDK MCP Tools        | 🧰 Docs      | https://ai-sdk.dev/docs/ai-sdk-core/mcp                     |
| MCP + AI Templates      | 📦 Templates | https://vercel.com/templates/ai                              |

---

Track 3: ChatSDK Agents
------------------------

Build agents using Vercel AI SDK + AI Gateway + ChatSDK that interface across Slack, Discord, Teams, GitHub, and more.

Write your bot logic once with the Chat SDK (npm i chat), then deploy to every platform via swappable adapters. The SDK handles event routing, streaming, JSX cards, and distributed state. Pair with the AI SDK for LLM reasoning and the AI Gateway for multi-provider access.

Quick Start:
1. Install: npm install chat @chat-adapter/slack @chat-adapter/discord
2. Pick a state adapter: @chat-adapter/state-redis (production) or state-memory (dev)
3. Create a Chat instance with your adapters and state
4. Wire up handlers: bot.onNewMention, bot.onSubscribedMessage, bot.onReaction
5. Add AI — thread.post() accepts AI SDK text streams natively
6. Use the AI Gateway for zero-config access to any model provider
7. Deploy to Vercel — adapters auto-detect credentials from env vars

Key Resources:

| Resource                    | Type         | Link                                                                  |
|-----------------------------|--------------|-----------------------------------------------------------------------|
| Chat SDK Docs               | 💬 Docs      | https://chat-sdk.dev/                                                  |
| vercel/chat                 | 📂 Repo      | https://github.com/vercel/chat                                         |
| ChatSDK Launch Blog         | 📰 Blog      | https://vercel.com/blog/chat-sdk-brings-agents-to-your-users           |
| Knowledge Agent Template    | 🧠 Template  | https://vercel.com/templates/nuxt/chat-sdk-knowledge-agent             |
| Community Agent Template    | 🏘️ Template  | https://github.com/vercel-labs/community-agent-template                |

---

💡 Hackathon Pro Tips
---------------------

- Use the AI Gateway — Skip managing individual API keys. One endpoint for OpenAI, Anthropic, Google, and more with built-in fallbacks. Just pass model strings like 'anthropic/claude-sonnet-4-6'.

- Add the Vercel Plugin + Skills — If you're using a coding agent (Claude Code, Cursor, etc.), add the Vercel plugin skill to your project for best-practice guidance. Run npx skills add vercel/chat for ChatSDK or equivalent for WDK skills.

- Feed llms.txt to your LLM — The full AI SDK docs are available as one Markdown file at ai-sdk.dev/llms.txt. Feed it to your LLM for accurate, up-to-date code generation.

- Start from a template if you are stuck — Clone the Chatbot template, Knowledge Agent template, or a WDK example and customize.

- Use AI SDK DevTools — AI SDK 6 has built-in DevTools for debugging multi-step agent flows. Full visibility into LLM calls, tool use, and trajectories.

- Deploy early, iterate fast — Push to Vercel after your first working feature. Every git push creates a preview deployment you can share with teammates and judges.

---

Happy hacking! Questions? Hit up the Vercel Community (https://community.vercel.com/).
