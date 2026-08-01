import { WebSocket, WebSocketServer } from 'ws';
import { AUDIO, CONFIG, DEEPGRAM_AGENT_URL } from './config.js';
import { initKnowledge, lookupProtocol } from './knowledge.js';
import { FUNCTIONS, greetingFor, promptFor, type VoiceMode } from './prompts.js';
import { initRecord, latestReportFor, listAttention } from './record.js';

/**
 * Voice agent bridge.
 *
 * Browser  --PCM16 16kHz-->  this server  -->  Deepgram Voice Agent
 * Browser  <--PCM16 24kHz--  this server  <--  Deepgram Voice Agent
 *
 * The server sits in the middle for two reasons: the Deepgram key never reaches the
 * browser, and function calls are answered here — against Moss and Medplum — rather
 * than by anything the page could tamper with.
 */

interface StartMessage {
  type: 'start';
  mode: VoiceMode;
  context: string;
  subject: string;
}

function settingsFor(start: StartMessage): unknown {
  return {
    type: 'Settings',
    audio: {
      input: { encoding: 'linear16', sample_rate: AUDIO.inputRate },
      output: { encoding: 'linear16', sample_rate: AUDIO.outputRate, container: 'none' },
    },
    agent: {
      language: 'en',
      listen: { provider: { type: 'deepgram', model: 'nova-3' } },
      think: {
        provider: { type: 'open_ai', model: 'gpt-4o-mini', temperature: 0.3 },
        prompt: promptFor(start.mode, start.context),
        functions: FUNCTIONS,
      },
      speak: { provider: { type: 'deepgram', model: 'aura-2-thalia-en' } },
      greeting: greetingFor(start.mode, start.subject),
    },
  };
}

/** Answer a tool call. Everything the agent is allowed to say clinically comes from here. */
async function runFunction(name: string, args: Record<string, unknown>): Promise<string> {
  if (name === 'lookup_protocol') {
    const grounding = await lookupProtocol(String(args.question ?? ''));
    if (!grounding) {
      return JSON.stringify({
        found: false,
        instruction: 'No approved instruction found. Tell the person you will have their care team confirm.',
      });
    }
    console.log(`  moss: "${String(args.question).slice(0, 48)}" -> ${grounding.rule} (${grounding.latencyMs}ms)`);
    return JSON.stringify({
      found: true,
      say_this_verbatim: grounding.approvedWording,
      severity: grounding.severity,
      rule: grounding.rule,
    });
  }

  if (name === 'list_attention') {
    const entries = await listAttention();
    console.log(`  medplum: ${entries.length} patients needing attention`);
    return JSON.stringify({ count: entries.length, patients: entries });
  }

  if (name === 'lookup_patient_report') {
    const summary = await latestReportFor(String(args.patient_name ?? ''));
    if (!summary) {
      return JSON.stringify({ found: false });
    }
    console.log(`  medplum: report for ${summary.name} (${summary.state})`);
    return JSON.stringify({ found: true, ...summary });
  }

  return JSON.stringify({ error: `Unknown function ${name}` });
}

/** Deepgram has shipped more than one shape for this event; accept both. */
function parseFunctionCalls(message: Record<string, any>): { id: string; name: string; args: Record<string, unknown> }[] {
  const raw = Array.isArray(message.functions) ? message.functions : [message];
  return raw
    .filter((f: any) => f?.name)
    .map((f: any) => ({
      id: String(f.id ?? message.id ?? ''),
      name: String(f.name),
      args: typeof f.arguments === 'string' ? safeParse(f.arguments) : (f.arguments ?? {}),
    }));
}

function safeParse(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function handleSession(client: WebSocket): void {
  let upstream: WebSocket | undefined;
  const pending: Buffer[] = [];
  let upstreamReady = false;

  const send = (payload: unknown): void => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(payload));
    }
  };

  client.on('message', (data, isBinary) => {
    if (isBinary) {
      // Mic audio. Buffer anything that arrives before the agent finished handshaking,
      // otherwise the first words of the call are lost.
      const chunk = data as Buffer;
      if (upstreamReady && upstream?.readyState === WebSocket.OPEN) {
        upstream.send(chunk);
      } else if (pending.length < 200) {
        pending.push(chunk);
      }
      return;
    }

    const message = safeParse(data.toString());

    // Typed input, same conversation. Exists so a dead microphone in a loud room is a
    // degraded demo rather than no demo.
    if (message.type === 'inject' && upstream?.readyState === WebSocket.OPEN) {
      upstream.send(JSON.stringify({ type: 'InjectUserMessage', content: String(message.text ?? '') }));
      return;
    }

    if (message.type !== 'start' || upstream) {
      return;
    }
    const start = message as unknown as StartMessage;
    console.log(`session start: mode=${start.mode} subject=${start.subject}`);

    upstream = new WebSocket(DEEPGRAM_AGENT_URL, {
      headers: { Authorization: `Token ${CONFIG.deepgramKey}` },
    });

    upstream.on('open', () => upstream?.send(JSON.stringify(settingsFor(start))));

    upstream.on('message', async (payload, binary) => {
      if (binary) {
        // Agent speech, straight through to the browser's speaker.
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload as Buffer, { binary: true });
        }
        return;
      }

      const event = safeParse(payload.toString());
      switch (event.type) {
        case 'SettingsApplied': {
          upstreamReady = true;
          for (const chunk of pending.splice(0)) {
            upstream?.send(chunk);
          }
          send({ type: 'ready' });
          break;
        }
        case 'ConversationText': {
          send({ type: 'turn', speaker: event.role === 'assistant' ? 'agent' : 'user', text: event.content });
          break;
        }
        case 'UserStartedSpeaking': {
          // Barge-in: drop whatever we have queued for playback.
          send({ type: 'interrupt' });
          break;
        }
        case 'AgentAudioDone': {
          send({ type: 'agent-done' });
          break;
        }
        case 'FunctionCallRequest': {
          for (const call of parseFunctionCalls(event as Record<string, any>)) {
            const content = await runFunction(call.name, call.args);
            upstream?.send(JSON.stringify({ type: 'FunctionCallResponse', id: call.id, name: call.name, content }));
            // Relay the args too: the dashboard uses lookup_patient_report to open the
            // patient the agent was asked about, so the UI follows the conversation.
            send({ type: 'tool', name: call.name, args: call.args });
          }
          break;
        }
        case 'Error':
        case 'Warning': {
          console.error('deepgram:', payload.toString().slice(0, 300));
          send({ type: 'error', message: String(event.description ?? event.message ?? 'Agent error') });
          break;
        }
        default:
          break;
      }
    });

    upstream.on('error', (err) => {
      console.error('upstream error:', err.message);
      send({ type: 'error', message: err.message });
    });
    upstream.on('close', () => client.close());
  });

  client.on('close', () => upstream?.close());
  client.on('error', () => upstream?.close());
}

async function main(): Promise<void> {
  await Promise.all([initKnowledge(), initRecord()]);

  const server = new WebSocketServer({ port: CONFIG.port, path: '/agent' });
  server.on('connection', handleSession);
  console.log(`Voice agent listening on ws://localhost:${CONFIG.port}/agent`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
