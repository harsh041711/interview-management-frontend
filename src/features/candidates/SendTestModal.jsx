import { useEffect, useState } from 'react';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import { useToast } from '@/components/common/Toast';
import { candidateApi } from '@/api/candidateApi';

const MIN_PER_QUESTION = 1.2;
const autoDuration = (count) => Math.max(5, Math.round((Number(count) || 0) * MIN_PER_QUESTION));

export default function SendTestModal({ open, candidate, onClose, onSent }) {
  const { push } = useToast();
  const [questionCount, setQuestionCount] = useState(10);
  const [durationMinutes, setDurationMinutes] = useState(autoDuration(10));
  const [durationManual, setDurationManual] = useState(false);
  const [stack, setStack] = useState([]);
  const [stackInput, setStackInput] = useState('');
  const [busy, setBusy] = useState(false);

  // Seed fields from the candidate (tech stack came from its JD) when opened.
  useEffect(() => {
    if (!open || !candidate) return;
    setQuestionCount(candidate.questionCount || 10);
    setDurationMinutes(candidate.durationMinutes || autoDuration(candidate.questionCount || 10));
    setDurationManual(false);
    setStack(Array.isArray(candidate.techStack) ? [...candidate.techStack] : []);
    setStackInput('');
  }, [open, candidate]);

  const onCountChange = (raw) => {
    const n = Math.max(1, Math.min(50, Number(raw) || 0));
    setQuestionCount(n);
    if (!durationManual) setDurationMinutes(autoDuration(n));
  };

  const onDurationChange = (raw) => {
    const n = Math.max(1, Math.min(240, Number(raw) || 0));
    setDurationMinutes(n);
    setDurationManual(true);
  };

  const addStack = () => {
    const v = stackInput.trim();
    if (!v || stack.includes(v)) { setStackInput(''); return; }
    setStack((prev) => [...prev, v]);
    setStackInput('');
  };

  const removeStack = (s) => setStack((prev) => prev.filter((x) => x !== s));

  const submit = async () => {
    if (stack.length === 0) {
      push({ type: 'warn', message: 'At least one tech stack is required to sample questions' });
      return;
    }
    setBusy(true);
    try {
      await candidateApi.sendTest(candidate.id, {
        questionCount: Number(questionCount) || 10,
        durationMinutes: Number(durationMinutes) || autoDuration(questionCount),
        techStack: stack,
      });
      push({ type: 'success', message: 'Test invitation sent' });
      onSent?.();
      onClose?.();
    } catch (err) {
      push({ type: 'error', message: err.response?.data?.message || 'Could not send test' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Send MCQ test"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={busy}>Send test</Button>
        </>
      }
    >
      <div className="create-candidate">
        <div className="create-candidate__row">
          <Input
            label="Number of questions"
            type="number"
            min="1"
            max="50"
            value={questionCount}
            onChange={(e) => onCountChange(e.target.value)}
            hint="Sampled from the question bank for the chosen tech stack."
          />
          <Input
            label="Duration (minutes)"
            type="number"
            min="1"
            max="240"
            value={durationMinutes}
            onChange={(e) => onDurationChange(e.target.value)}
            hint={durationManual ? 'Manually overridden' : `Auto: ~${MIN_PER_QUESTION} min/question`}
          />
        </div>
        <div className="field">
          <span className="field__label">Tech stack</span>
          <span className="field__hint">Defaulted from the job description — edit if needed.</span>
          <div className="create-candidate__stack-input">
            <input
              value={stackInput}
              onChange={(e) => setStackInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStack(); } }}
              placeholder="Add a stack and press Enter"
            />
            <Button type="button" size="sm" variant="secondary" onClick={addStack}>Add</Button>
          </div>
          {stack.length > 0 && (
            <div className="create-candidate__selected">
              {stack.map((s) => (
                <span key={s} className="chip-toggle is-on" onClick={() => removeStack(s)}>{s} ×</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
