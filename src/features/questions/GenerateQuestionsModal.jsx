import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import { useToast } from '@/components/common/Toast';
import { generateQuestions } from './questionSlice';
import './GenerateQuestionsModal.scss';

const TYPES = [
  { value: 'mcq', label: 'MCQ' },
  { value: 'multi_select', label: 'Multi-select' },
  { value: 'one_line', label: 'One-line' },
  { value: 'descriptive', label: 'Descriptive' },
];

const PHASES = [
  'Analyzing the tech stack…',
  'Drafting questions…',
  'Refining answers & options…',
  'Saving to the question bank…',
];

export default function GenerateQuestionsModal({ open, onClose }) {
  const dispatch = useDispatch();
  const { push } = useToast();
  const [techStack, setTechStack] = useState('');
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState('');
  const [types, setTypes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState(0);

  // Advance the "generating" status messages while a request is in flight.
  useEffect(() => {
    if (!busy) { setPhase(0); return undefined; }
    setPhase(0);
    const id = setInterval(() => setPhase((p) => Math.min(p + 1, PHASES.length - 1)), 1800);
    return () => clearInterval(id);
  }, [busy]);

  const typesLabel = types.length
    ? types.map((v) => TYPES.find((t) => t.value === v)?.label || v).join(' / ')
    : 'mixed';

  const toggleType = (t) => {
    setTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!techStack.trim()) {
      push({ type: 'warn', message: 'Tech stack is required' });
      return;
    }
    setBusy(true);
    const payload = { techStack: techStack.trim(), count: Number(count) || 10, persist: true };
    if (difficulty) payload.difficulty = difficulty;
    if (types.length) payload.types = types;
    const action = await dispatch(generateQuestions(payload));
    setBusy(false);
    if (generateQuestions.fulfilled.match(action)) {
      const { questions, provider, model, source, aiError } = action.payload;
      const n = questions?.length || 0;
      if (source === 'manual_fallback') {
        push({
          type: 'warn',
          message: `AI unavailable — showing ${n} HR-curated question${n === 1 ? '' : 's'} for "${techStack.trim()}"`,
          duration: 6000,
        });
      } else {
        const via = provider ? `${provider}${model ? ` (${model})` : ''}` : 'AI';
        push({ type: 'success', message: `Generated ${n} questions via ${via}` });
      }
      if (aiError) console.warn('AI degraded:', aiError);
      onClose?.();
    } else {
      push({ type: 'error', message: action.payload?.message || 'Generation failed' });
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={busy ? 'Generating questions' : 'Generate questions with AI'}
      footer={busy ? null : (
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={busy}>✨ Generate</Button>
        </>
      )}
    >
      {busy ? (
        <div className="genq">
          <div className="genq__orb">✨</div>
          <div className="genq__title">{PHASES[phase]}</div>
          <div className="genq__sub">
            Generating {Number(count) || 10} {typesLabel} question{(Number(count) || 10) === 1 ? '' : 's'} for “{techStack.trim()}”.
          </div>
          <div className="genq__bar"><span /></div>
          <div className="genq__dots">
            {PHASES.map((_, i) => (
              <i key={i} className={i < phase ? 'is-done' : i === phase ? 'is-active' : ''} />
            ))}
          </div>
          <div className="genq__hint">Usually 5–15 seconds. Please keep this window open.</div>
        </div>
      ) : (
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Input
          label="Tech stack"
          value={techStack}
          onChange={(e) => setTechStack(e.target.value)}
          placeholder="React, Node.js, MERN, Python…"
          required
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Count" type="number" min="1" max="20" value={count} onChange={(e) => setCount(e.target.value)} />
          <Input as="select" label="Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="">Mixed</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </Input>
        </div>
        <div className="field">
          <span className="field__label">Question types (optional — leave empty for mix)</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {TYPES.map((t) => (
              <button
                type="button"
                key={t.value}
                onClick={() => toggleType(t.value)}
                className={`chip-toggle ${types.includes(t.value) ? 'is-on' : ''}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <p style={{ color: 'var(--muted, #5b6372)', fontSize: 13 }}>
          Uses Gemini (primary) and Grok (fallback). Generated questions are saved to the question bank.
        </p>
      </form>
      )}
    </Modal>
  );
}
