import { useState } from 'react';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import { useToast } from '@/components/common/Toast';
import { candidateApi } from '@/api/candidateApi';

export default function SendCodingTestModal({ open, candidateId, onClose, onSent }) {
  const { push } = useToast();
  const [form, setForm] = useState({ problemCount: 1, durationMinutes: 30, difficulty: 'medium' });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await candidateApi.sendCodingTest(candidateId, {
        problemCount: Number(form.problemCount),
        durationMinutes: Number(form.durationMinutes),
        difficulty: form.difficulty,
      });
      push({ type: 'success', message: 'Coding test sent — candidate will receive an email shortly' });
      onSent?.();
      onClose();
    } catch (err) {
      push({ type: 'error', message: err.response?.data?.message || 'Failed to send coding test' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Send coding test"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={busy}>Send coding test</Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <Input
          label="Number of problems (1–5)"
          type="number" min="1" max="5"
          value={form.problemCount}
          onChange={(e) => setForm({ ...form, problemCount: e.target.value })}
        />
        <Input
          label="Duration (minutes)"
          type="number" min="5" max="240"
          value={form.durationMinutes}
          onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
        />
        <div>
          <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>Difficulty</label>
          <select
            value={form.difficulty}
            onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
            style={{ width: '100%', padding: '8px 10px' }}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}
