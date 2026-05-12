import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import Button from '@/components/common/Button';
import Loader from '@/components/common/Loader';
import EmptyState from '@/components/common/EmptyState';
import Modal from '@/components/common/Modal';
import { useToast } from '@/components/common/Toast';
import { loadCodingTest, submitCodingTest, clearState } from './codingTestSlice';
import './CodingTestPage.scss';

const LANG_LABEL = { js: 'JavaScript', python: 'Python', php: 'PHP' };
const MONACO_LANG = { js: 'javascript', python: 'python', php: 'php' };

const formatMs = (ms) => {
  if (ms < 0) ms = 0;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export default function CodingTestPage() {
  const { token } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { push } = useToast();
  const { data, status, error, submitting, submitted } = useSelector((s) => s.codingTest);
  const [current, setCurrent] = useState(0);
  const [perProblem, setPerProblem] = useState({});
  const [tabSwitches, setTabSwitches] = useState(0);
  const [warnOpen, setWarnOpen] = useState(false);
  const [remainingMs, setRemainingMs] = useState(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    dispatch(loadCodingTest(token));
    return () => { dispatch(clearState()); };
  }, [dispatch, token]);

  useEffect(() => {
    if (!data?.problems) return;
    setPerProblem((prev) => {
      const next = { ...prev };
      for (const p of data.problems) {
        if (!next[p.id]) {
          const lang = p.supportedLanguages[0];
          next[p.id] = { language: lang, code: p.starterCode?.[lang] || '' };
        }
      }
      return next;
    });
  }, [data]);

  useEffect(() => {
    if (!data || submittedRef.current) return;
    const startedAt = data.firstOpenedAt ? new Date(data.firstOpenedAt).getTime() : Date.now();
    const endsAt = startedAt + data.durationMinutes * 60_000;
    const tick = () => {
      const ms = endsAt - Date.now();
      setRemainingMs(ms);
      if (ms <= 0 && !submittedRef.current) {
        submittedRef.current = true;
        doSubmit(true);
      }
    };
    tick();
    const h = setInterval(tick, 1000);
    return () => clearInterval(h);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!data) return;
    const onVisibility = () => {
      if (document.hidden) {
        setTabSwitches((n) => n + 1);
      } else {
        setWarnOpen(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [data]);

  useEffect(() => {
    const blockEvt = (e) => { e.preventDefault(); push({ type: 'warn', message: 'Disabled during the test.' }); };
    const onKey = (e) => {
      const isPaste = (e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V');
      const isCopy = (e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C');
      if (isPaste || isCopy) blockEvt(e);
    };
    document.addEventListener('paste', blockEvt);
    document.addEventListener('copy', blockEvt);
    document.addEventListener('contextmenu', blockEvt);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('paste', blockEvt);
      document.removeEventListener('copy', blockEvt);
      document.removeEventListener('contextmenu', blockEvt);
      document.removeEventListener('keydown', onKey);
    };
  }, [push]);

  if (status === 'loading' && !data) return <Loader message="Loading coding test…" />;
  if (status === 'failed' || !data) {
    return <EmptyState title="Couldn't load the test" description={error || 'The link may be invalid or expired.'} />;
  }
  if (data.submittedAt || submitted) {
    return <EmptyState title="You've already submitted this test" description="Thanks — the hiring team will be in touch." />;
  }

  const problem = data.problems[current];
  const state = perProblem[problem.id] || { language: problem.supportedLanguages[0], code: '' };

  const setLang = (newLang) => {
    if (state.code.trim() && state.code !== (problem.starterCode?.[state.language] || '')) {
      if (!window.confirm(`Switching to ${LANG_LABEL[newLang]} will replace your current code with the starter code. Continue?`)) return;
    }
    setPerProblem((prev) => ({
      ...prev,
      [problem.id]: { language: newLang, code: problem.starterCode?.[newLang] || '' },
    }));
  };

  const setCode = (code) => {
    setPerProblem((prev) => ({ ...prev, [problem.id]: { ...prev[problem.id], code } }));
  };

  const doSubmit = async (autoSubmitted = false) => {
    if (submittedRef.current && !autoSubmitted) return;
    submittedRef.current = true;
    const submissions = data.problems.map((p) => ({
      problemId: p.id,
      language: perProblem[p.id]?.language || p.supportedLanguages[0],
      code: perProblem[p.id]?.code || '',
    }));
    const action = await dispatch(submitCodingTest({ token, submissions, tabSwitches, autoSubmitted }));
    if (submitCodingTest.fulfilled.match(action)) {
      push({ type: 'success', message: 'Submitted!' });
      navigate(`/coding-test/${token}/submitted`, { replace: true });
    } else {
      push({ type: 'error', message: action.payload?.message || 'Submit failed' });
      submittedRef.current = false;
    }
  };

  const timerWarn = remainingMs !== null && remainingMs < 60_000;

  return (
    <div className="coding-test">
      <div className="coding-test__head">
        <div>
          <div className="coding-test__title">Coding Challenge — {data.candidate?.name || 'Candidate'}</div>
          <div className="coding-test__counter">
            Problem {current + 1} of {data.problems.length} · Tab-switches: {tabSwitches}
          </div>
        </div>
        <div className={`coding-test__timer ${timerWarn ? 'coding-test__timer--warn' : ''}`}>
          ⏱ {remainingMs !== null ? formatMs(remainingMs) : '…'}
        </div>
      </div>

      <div className="coding-test__problem">
        <h2>{problem.title} · {problem.difficulty}</h2>
        <div className="coding-test__problem-desc">{problem.description}</div>
        {problem.sampleCases?.length > 0 && (
          <div className="coding-test__problem-samples">
            {problem.sampleCases.map((tc, i) => (
              <div key={i}>
                <div>Sample input:  {JSON.stringify(tc.stdin)}</div>
                <div>Sample output: {JSON.stringify(tc.expectedStdout)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="coding-test__lang">
        <label>Language:</label>
        <select value={state.language} onChange={(e) => setLang(e.target.value)} style={{ padding: '6px 10px' }}>
          {problem.supportedLanguages.map((l) => (
            <option key={l} value={l}>{LANG_LABEL[l]}</option>
          ))}
        </select>
      </div>

      <div className="coding-test__editor">
        <Editor
          height="380px"
          language={MONACO_LANG[state.language]}
          value={state.code}
          onChange={(v) => setCode(v || '')}
          options={{
            minimap: { enabled: false },
            contextmenu: false,
            fontSize: 13,
            automaticLayout: true,
          }}
          onMount={(editor) => {
            editor.onDidPaste(() => {
              push({ type: 'warn', message: 'Pasting is disabled. Please type your code.' });
            });
          }}
        />
      </div>

      <div className="coding-test__actions">
        <Button variant="secondary" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>Previous</Button>
        {current < data.problems.length - 1 && (
          <Button onClick={() => setCurrent((c) => c + 1)}>Next</Button>
        )}
        {current === data.problems.length - 1 && (
          <Button onClick={() => doSubmit(false)} loading={submitting}>Submit and finish</Button>
        )}
      </div>

      <Modal
        open={warnOpen}
        onClose={() => setWarnOpen(false)}
        title="Tab switch detected"
        footer={<Button onClick={() => setWarnOpen(false)}>OK</Button>}
      >
        <p>
          You left the test tab. Tab switching is monitored. This is switch <strong>#{tabSwitches}</strong>.
          Please stay focused on the test.
        </p>
      </Modal>
    </div>
  );
}
