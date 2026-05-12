import { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import Button from '@/components/common/Button';
import Loader from '@/components/common/Loader';
import { useToast } from '@/components/common/Toast';
import { codingSubmissionApi } from '@/api/codingSubmissionApi';
import { candidateApi } from '@/api/candidateApi';
import { formatDate } from '@/utils/formatters';
import './CodingTestPanel.scss';

const MONACO_LANG = { js: 'javascript', python: 'python', php: 'php' };
const LANG_LABEL = { js: 'JavaScript', python: 'Python', php: 'PHP' };

const tabSwitchClass = (n) => {
  if (n === 0) return 'ct-panel__tabsw--green';
  if (n <= 5) return 'ct-panel__tabsw--amber';
  return 'ct-panel__tabsw--red';
};

export default function CodingTestPanel({ candidate, onRefresh }) {
  const { push } = useToast();
  const [submissions, setSubmissions] = useState(null);
  const [busy, setBusy] = useState(null);
  const [drafts, setDrafts] = useState({});

  const ct = candidate.codingTest;

  useEffect(() => {
    if (!ct?.submittedAt) return;
    codingSubmissionApi.listForCandidate(candidate.id)
      .then((res) => {
        setSubmissions(res.items);
        const init = {};
        res.items.forEach((s) => { init[s.id] = { rating: s.rating || 0, comment: s.reviewComment || '' }; });
        setDrafts(init);
      })
      .catch((err) => push({ type: 'error', message: err.response?.data?.message || 'Failed to load submissions' }));
  }, [ct?.submittedAt, candidate.id, push]);

  if (!ct) return null;

  if (!ct.submittedAt) {
    return (
      <div className="ct-panel">
        <div className="ct-panel__head">
          <div>
            <div className="ct-panel__title">Coding Test</div>
            <div className="ct-panel__meta">
              Sent {formatDate(ct.sentAt)} · {ct.problemCount} problem(s) · {ct.durationMinutes} min · awaiting candidate
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (submissions === null) return <Loader message="Loading submissions…" />;

  const allRated = submissions.every((s) => s.rating != null);

  const onRate = async (sub) => {
    const draft = drafts[sub.id];
    if (!draft?.rating) { push({ type: 'warn', message: 'Pick a star rating first' }); return; }
    setBusy(`rate-${sub.id}`);
    try {
      await codingSubmissionApi.rate(sub.id, { rating: draft.rating, reviewComment: draft.comment });
      push({ type: 'success', message: 'Rating saved' });
      const refreshed = await codingSubmissionApi.listForCandidate(candidate.id);
      setSubmissions(refreshed.items);
    } catch (err) {
      push({ type: 'error', message: err.response?.data?.message || 'Save failed' });
    } finally {
      setBusy(null);
    }
  };

  const onRerun = async (sub) => {
    setBusy(`rerun-${sub.id}`);
    try {
      await codingSubmissionApi.rerun(sub.id);
      push({ type: 'success', message: 'Re-ran tests' });
      const refreshed = await codingSubmissionApi.listForCandidate(candidate.id);
      setSubmissions(refreshed.items);
    } catch (err) {
      push({ type: 'error', message: err.response?.data?.message || 'Re-run failed' });
    } finally {
      setBusy(null);
    }
  };

  const onShortlist = async () => {
    if (!window.confirm('Shortlist this candidate? A shortlist email will be sent.')) return;
    setBusy('shortlist');
    try {
      await candidateApi.codingShortlist(candidate.id);
      push({ type: 'success', message: 'Shortlisted' });
      onRefresh?.();
    } catch (err) {
      push({ type: 'error', message: err.response?.data?.message || 'Shortlist failed' });
    } finally { setBusy(null); }
  };

  const onReject = async () => {
    if (!window.confirm('Reject this candidate? A rejection email will be sent.')) return;
    setBusy('reject');
    try {
      await candidateApi.codingReject(candidate.id);
      push({ type: 'success', message: 'Rejected' });
      onRefresh?.();
    } catch (err) {
      push({ type: 'error', message: err.response?.data?.message || 'Reject failed' });
    } finally { setBusy(null); }
  };

  return (
    <div className="ct-panel">
      <div className="ct-panel__head">
        <div>
          <div className="ct-panel__title">Coding Test</div>
          <div className="ct-panel__meta">
            Sent {formatDate(ct.sentAt)} · Submitted {formatDate(ct.submittedAt)} · {submissions.length} submission(s)
            {' · '}
            <span className={`ct-panel__tabsw ${tabSwitchClass(submissions[0]?.tabSwitches || 0)}`}>
              Tab-switches: {submissions[0]?.tabSwitches || 0}
            </span>
          </div>
        </div>
        {ct.outcome && (
          <div style={{ fontSize: 13, fontWeight: 600, color: ct.outcome === 'shortlisted' ? '#047857' : '#b91c1c' }}>
            {ct.outcome === 'shortlisted' ? 'Shortlisted' : ct.outcome === 'rejected' ? 'Rejected' : 'Pending review'}
          </div>
        )}
      </div>

      {submissions.map((sub) => (
        <div key={sub.id} className="ct-panel__sub">
          <h4>{sub.problem?.title || 'Problem'}</h4>
          <div className="ct-panel__sub-meta">
            Language: {LANG_LABEL[sub.language]} · Passed {sub.passedCount}/{sub.totalCount}
          </div>

          <div className="ct-panel__cases">
            {sub.runs.map((r, i) => (
              <div key={i} className={`ct-panel__case ${r.passed ? 'ct-panel__case--passed' : 'ct-panel__case--failed'}`}>
                <div>{r.passed ? '✓' : '✗'}</div>
                <div>stdin: {JSON.stringify(r.stdin)}</div>
                <div>expected: {JSON.stringify(r.expectedStdout)}</div>
                <div>got: {JSON.stringify(r.actualStdout)} {r.error ? ` [${r.error}]` : ''}</div>
              </div>
            ))}
          </div>

          <div className="ct-panel__code">
            <Editor
              height="280px"
              language={MONACO_LANG[sub.language]}
              value={sub.code}
              options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, automaticLayout: true }}
            />
          </div>

          <div className="ct-panel__rate">
            <div className="ct-panel__stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  className={`ct-panel__star ${n <= (drafts[sub.id]?.rating || 0) ? 'is-on' : ''}`}
                  onClick={() => setDrafts((d) => ({ ...d, [sub.id]: { ...d[sub.id], rating: n } }))}
                >★</span>
              ))}
            </div>
            <textarea
              rows={1}
              className="ct-panel__comment"
              placeholder="Comment (optional)"
              value={drafts[sub.id]?.comment || ''}
              onChange={(e) => setDrafts((d) => ({ ...d, [sub.id]: { ...d[sub.id], comment: e.target.value } }))}
            />
            <Button size="sm" variant="secondary" onClick={() => onRerun(sub)} loading={busy === `rerun-${sub.id}`}>Re-run</Button>
            <Button size="sm" onClick={() => onRate(sub)} loading={busy === `rate-${sub.id}`}>Save rating</Button>
          </div>
        </div>
      ))}

      {!ct.outcome && ct.outcome !== 'shortlisted' && ct.outcome !== 'rejected' && (
        <div className="ct-panel__actions">
          <Button onClick={onShortlist} loading={busy === 'shortlist'} disabled={!allRated}>Shortlist candidate</Button>
          <Button variant="secondary" onClick={onReject} loading={busy === 'reject'} disabled={!allRated}>Reject candidate</Button>
          {!allRated && <span style={{ fontSize: 13, color: '#6b7280', alignSelf: 'center' }}>Rate all problems first</span>}
        </div>
      )}
    </div>
  );
}
