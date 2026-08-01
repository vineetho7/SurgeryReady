import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { Microphone, Speaker } from '../lib/audio';

/**
 * The voice surface. Two modes, because the same grounded record serves two people:
 *
 *  - Clinician: ask about a patient, get an answer read from the stored report.
 *  - Patient:   the agent reads the report back and asks whether it matches how they feel.
 *
 * Audio and tool-calling live server-side — the Deepgram key never reaches the browser,
 * and the agent's clinical sentences come from the protocol index, not the model.
 */

export type VoiceMode = 'clinician' | 'patient';

interface Turn {
  speaker: 'agent' | 'user';
  text: string;
}

const AGENT_URL = import.meta.env.VITE_AGENT_URL ?? 'ws://localhost:8080/agent';

type Status = 'idle' | 'connecting' | 'live' | 'offline' | 'denied';

const STATUS_LABEL: Record<Status, string> = {
  idle: 'Ready',
  connecting: 'Connecting',
  live: 'Listening',
  offline: 'Agent offline',
  denied: 'Microphone blocked',
};

function MicIcon(): JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="5.5" y="1.5" width="5" height="8.5" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3.2 7.6a4.8 4.8 0 009.6 0M8 12.4v2.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StopIcon(): JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export function VoicePanel({
  mode: initialMode,
  context,
  subject,
}: {
  mode: VoiceMode;
  context: string;
  subject: string;
}): JSX.Element {
  const [mode, setMode] = useState<VoiceMode>(initialMode);
  const [status, setStatus] = useState<Status>('idle');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [toolCount, setToolCount] = useState(0);
  const [typed, setTyped] = useState('');

  const socketRef = useRef<WebSocket>(null);
  const micRef = useRef<Microphone>(null);
  const speakerRef = useRef<Speaker>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const teardown = useCallback(() => {
    micRef.current?.stop();
    speakerRef.current?.close();
    socketRef.current?.close();
    micRef.current = null;
    speakerRef.current = null;
    socketRef.current = null;
  }, []);

  useEffect(() => teardown, [teardown]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  const start = useCallback(async () => {
    setStatus('connecting');
    setTurns([]);
    setToolCount(0);

    const speaker = new Speaker();
    speakerRef.current = speaker;

    const socket = new WebSocket(AGENT_URL);
    socket.binaryType = 'arraybuffer';
    socketRef.current = socket;

    socket.onopen = () => socket.send(JSON.stringify({ type: 'start', mode, context, subject }));

    socket.onmessage = async (event) => {
      if (event.data instanceof ArrayBuffer) {
        speaker.enqueue(event.data);
        return;
      }
      const message = JSON.parse(event.data as string);
      switch (message.type) {
        case 'ready': {
          // Only open the mic once the agent is actually listening, so the browser's
          // permission prompt is not competing with the greeting.
          const mic = new Microphone();
          micRef.current = mic;
          try {
            await mic.start((pcm) => socket.readyState === WebSocket.OPEN && socket.send(pcm));
            setStatus('live');
          } catch {
            setStatus('denied');
          }
          break;
        }
        case 'turn':
          setTurns((prev) => [...prev, { speaker: message.speaker, text: message.text }]);
          break;
        case 'tool':
          setToolCount((n) => n + 1);
          break;
        case 'interrupt':
          speaker.clear();
          break;
        case 'error':
          setStatus('offline');
          break;
        default:
          break;
      }
    };

    socket.onerror = () => setStatus('offline');
    socket.onclose = () => {
      micRef.current?.stop();
      setStatus((current) => (current === 'connecting' ? 'offline' : 'idle'));
    };
  }, [mode, context, subject]);

  const stop = useCallback(() => {
    teardown();
    setStatus('idle');
  }, [teardown]);

  function sendTyped(event: React.FormEvent): void {
    event.preventDefault();
    const text = typed.trim();
    if (!text || socketRef.current?.readyState !== WebSocket.OPEN) {
      return;
    }
    socketRef.current.send(JSON.stringify({ type: 'inject', text }));
    setTyped('');
  }

  const live = status === 'live' || status === 'connecting' || status === 'denied';

  return (
    <div className="card voice">
      <div className="card-head">
        <h2>Voice</h2>
        <span className={`voice-status ${status === 'live' ? 'is-live' : ''}`}>
          {status === 'live' && <span className="pulse" aria-hidden="true" />}
          {STATUS_LABEL[status]}
        </span>
      </div>
      <div className="card-body">
        <div className="mode-switch" role="group" aria-label="Voice mode">
          <button type="button" aria-pressed={mode === 'clinician'} onClick={() => setMode('clinician')} disabled={live}>
            Clinician
          </button>
          <button type="button" aria-pressed={mode === 'patient'} onClick={() => setMode('patient')} disabled={live}>
            Patient call
          </button>
        </div>

        <button type="button" className="mic" data-live={live} onClick={live ? stop : start}>
          {live ? <StopIcon /> : <MicIcon />}
          {live ? 'End session' : mode === 'clinician' ? 'Ask about this patient' : 'Start verification call'}
        </button>

        {turns.length > 0 && (
          <div className="transcript" ref={scrollRef}>
            {turns.map((turn, i) => (
              <div key={i} className={`turn ${turn.speaker}`}>
                <span className="speaker">
                  {turn.speaker === 'agent' ? 'Agent' : mode === 'patient' ? 'Patient' : 'You'}
                </span>
                <span className="body">{turn.text}</span>
              </div>
            ))}
          </div>
        )}

        {live && (
          <form className="typed" onSubmit={sendTyped}>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Or type instead of speaking"
              aria-label="Type a message to the agent"
            />
            <button type="submit" disabled={!typed.trim()}>
              Send
            </button>
          </form>
        )}

        {toolCount > 0 && (
          <p className="grounded">
            {toolCount} grounded {toolCount === 1 ? 'lookup' : 'lookups'} — every clinical sentence came from the
            protocol index, not the model.
          </p>
        )}

        {status === 'offline' && (
          <div className="hint-box">
            The voice agent is not reachable. Start it with <code>npm start</code> in <code>server/</code>, then try
            again.
          </div>
        )}

        {status === 'denied' && (
          <div className="hint-box">
            The browser blocked the microphone. Allow it for this site, or type below to continue the conversation.
          </div>
        )}

        {status === 'idle' && turns.length === 0 && (
          <div className="hint-box">
            {mode === 'clinician'
              ? 'Ask about this patient out loud. The agent answers from the record and quotes protocol verbatim.'
              : 'The agent reads the report back in plain language and asks whether it matches how the patient feels.'}
          </div>
        )}
      </div>
    </div>
  );
}
