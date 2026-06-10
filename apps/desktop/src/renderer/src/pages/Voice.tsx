import { useEffect, useRef, useState } from 'react'

/**
 * Voice screen — uses the Web Speech API in the renderer (Chromium-backed
 * Electron supports SpeechRecognition + speechSynthesis). For production
 * accuracy / offline support, swap in a local Whisper binding behind a new
 * IPC channel — the Permission Center still gates `microphone`.
 */
export function VoiceScreen(): JSX.Element {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [reply, setReply] = useState('')
  const recRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    const SR =
      (window as unknown as { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.continuous = false
    rec.interimResults = true
    rec.lang = 'en-IN'
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const text = Array.from(e.results)
        .map((r) => r[0]?.transcript ?? '')
        .join('')
      setTranscript(text)
    }
    rec.onend = () => setListening(false)
    recRef.current = rec
  }, [])

  const start = (): void => {
    if (!recRef.current) {
      setReply('SpeechRecognition is not available in this environment.')
      return
    }
    setTranscript('')
    recRef.current.start()
    setListening(true)
  }

  const speak = (text: string): void => {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-IN'
    window.speechSynthesis.speak(u)
  }

  return (
    <div>
      <h2>Voice</h2>
      <div className="card">
        <p className="muted">
          Voice input/output requires the <strong>microphone</strong> and{' '}
          <strong>speaker</strong> permissions. Web Speech API is used for the MVP;
          a local Whisper-based backend can replace it without UI changes.
        </p>
        <div className="row">
          <button className="primary" onClick={start} disabled={listening}>
            {listening ? 'Listening…' : 'Start listening'}
          </button>
          <button className="secondary" onClick={() => speak(reply || 'Hello, I am your local assistant.')}>
            Speak reply
          </button>
        </div>
      </div>
      <div className="card">
        <h3>Transcript</h3>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{transcript || '—'}</pre>
      </div>
      <div className="card">
        <h3>Reply text</h3>
        <textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type the text to speak…" />
      </div>
    </div>
  )
}
