import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { useLocation } from 'react-router';
import { Microphone, Speaker } from '../lib/audio';
import { useBoard } from '../lib/fhir';
import { READINESS_LABEL } from '../lib/model';

/**
 * The global voice surface.
 *
 * Mounted once at the shell, so the agent is reachable from every page and a call keeps
 * running as the clinician navigates. It is context-aware: on a patient page it scopes to
 * that patient; anywhere else it opens as a board-wide concierge that looks up any patient
 * by name. Audio and tool-calling stay server-side — the Deepgram key never reaches the
 * browser and clinical sentences come from the protocol index, not the model.
 */

export type VoiceMode = 'clinician' | 'patient';

interface Turn {
  speaker: 'agent' | 'user';
  text: string;
}

interface Scope {
  mode: VoiceMode;
  subject: string;
  context: string;
  /** What the drawer shows as the focus of the conversation. */
  label: string;
  detail: string;
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

const BOARD_SCOPE: Scope = {
  mode: 'clinician',
  subject: 'the surgery board',
  context:
    'You are helping a clinician who is looking at the perioperative board. No single patient is in focus. When asked about a patient, call lookup_patient_report with their name, then answer from what it returns.',
  label: 'Whole board',
  detail: 'Ask about any patient by name',
};

/** Derive who the agent is talking about from the current route and the loaded board. */
function useScope(): Scope {
  const location = useLocation();
  const { board } = useBoard();

  return useMemo(() => {
    const recovery = /^\/recovery\/(.+)$/.exec(location.pathname);
    if (recovery && board) {
      const item = board.recovery.find((c) => c.patientId === recovery[1]);
      if (item) {
        return {
          mode: 'clinician',
          subject: item.name,
          context: `${item.name}, ${item.procedure}, ${item.side}, post-op day ${item.postOpDay}. ${item.conclusion}`,
          label: item.name,
          detail: `${item.procedure} · post-op day ${item.postOpDay}`,
        };
      }
    }

    const preop = /^\/preop\/(.+)$/.exec(location.pathname);
    if (preop && board) {
      const item = board.preop.find((c) => c.patientId === preop[1]);
      if (item) {
        const uncalled = item.checks.length === 0;
        return {
          mode: uncalled ? 'patient' : 'clinician',
          subject: item.name,
          context: `${item.name}, ${item.procedure}. Readiness: ${READINESS_LABEL[item.readiness]}.${
            item.barrier ? ` Barrier: ${item.barrier}` : ''
          }`,
          label: item.name,
          detail: uncalled ? `${item.procedure} · readiness call` : `${item.procedure} · ${READINESS_LABEL[item.readiness]}`,
        };
      }
    }

    return BOARD_SCOPE;
  }, [location.pathname, board]);
}

function MicIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="5.5" y="1.5" width="5" height="8.5" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.2 7.6a4.8 4.8 0 009.6 0M8 12.4v2.1" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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

function CloseIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function VoiceDock(): JSX.Element {
  const scope = useScope();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<VoiceMode>(scope.mode);
  const [status, setStatus] = useState<Status>('idle');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [toolCount, setToolCount] = useState(0);
  const [typed, setTyped] = useState('');
  /** The scope a live call was started against — frozen so navigating mid-call is not confusing. */
  const [activeScope, setActiveScope] = useState<Scope>();

  const socketRef = useRef<WebSocket>(null);
  const micRef = useRef<Microphone>(null);
  const speakerRef = useRef<Speaker>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const live = status === 'live' || status === 'connecting' || status === 'denied';

  const teardown = useCallback(() => {
    micRef.current?.stop();
    speakerRef.current?.close();
    socketRef.current?.close();
    micRef.current = null;
    speakerRef.current = null;
    socketRef.current = null;
  }, []);

  useEffect(() => teardown, [teardown]);

  // Follow the route while idle; a live call keeps the scope it began with.
  useEffect(() => {
    if (!live) {
      setMode(scope.mode);
    }
  }, [scope, live]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !live) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, live]);

  const start = useCallback(async () => {
    setStatus('connecting');
    setTurns([]);
    setToolCount(0);
    setActiveScope(scope);

    const speaker = new Speaker();
    speakerRef.current = speaker;

    const socket = new WebSocket(AGENT_URL);
    socket.binaryType = 'arraybuffer';
    socketRef.current = socket;

    socket.onopen = () => socket.send(JSON.stringify({ type: 'start', mode, context: scope.context, subject: scope.subject }));

    socket.onmessage = async (event) => {
      if (event.data instanceof ArrayBuffer) {
        speaker.enqueue(event.data);
        return;
      }
      const message = JSON.parse(event.data as string);
      switch (message.type) {
        case 'ready': {
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
  }, [mode, scope]);

  const stop = useCallback(() => {
    teardown();
    setStatus('idle');
    setActiveScope(undefined);
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

  const shown = activeScope ?? scope;

  return (
    <>
      {!open && (
        <button
          type="button"
          className="voice-launcher"
          data-live={live}
          onClick={() => setOpen(true)}
          aria-label="Open the voice agent"
        >
          {live ? <span className="pulse" aria-hidden="true" /> : <MicIcon />}
          {live ? 'In call' : 'Voice agent'}
        </button>
      )}

      {open && <div className="voice-scrim" onClick={() => !live && setOpen(false)} aria-hidden="true" />}

      <aside className={`voice-drawer ${open ? 'is-open' : ''}`} role="dialog" aria-label="Voice agent" aria-hidden={!open}>
        <div className="voice-drawer-head">
          <span className="brand-mark" aria-hidden="true">
            <MicIcon />
          </span>
          <div className="vd-title">
            <strong>Voice agent</strong>
            <span className={`voice-status ${status === 'live' ? 'is-live' : ''}`}>
              {status === 'live' && <span className="pulse" aria-hidden="true" />}
              {STATUS_LABEL[status]}
            </span>
          </div>
          <button type="button" className="vd-close" onClick={() => setOpen(false)} aria-label="Close voice agent">
            <CloseIcon />
          </button>
        </div>

        <div className="voice-drawer-body">
          <div className="vd-scope">
            <span className="vd-scope-k">{live ? 'In call about' : 'Focused on'}</span>
            <span className="vd-scope-v">{shown.label}</span>
            <span className="vd-scope-d">{shown.detail}</span>
          </div>

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
            {live ? 'End session' : mode === 'clinician' ? 'Ask the agent' : 'Start verification call'}
          </button>

          {turns.length > 0 && (
            <div className="transcript" ref={scrollRef}>
              {turns.map((turn, i) => (
                <div key={i} className={`turn ${turn.speaker}`}>
                  <span className="speaker">{turn.speaker === 'agent' ? 'Agent' : mode === 'patient' ? 'Patient' : 'You'}</span>
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
                ? shown === BOARD_SCOPE
                  ? 'Ask about any patient on the board out loud — the agent looks them up and answers from the record.'
                  : 'Ask about this patient out loud. The agent answers from the record and quotes protocol verbatim.'
                : 'The agent reads the report back in plain language and asks whether it matches how the patient feels.'}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
