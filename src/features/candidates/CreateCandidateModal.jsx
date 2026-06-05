import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import { useToast } from '@/components/common/Toast';
import { createCandidate, uploadCandidateResume } from './candidateSlice';
import { jobDescriptionApi } from '@/api/jobDescriptionApi';
import './CreateCandidateModal.scss';

const RESUME_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const RESUME_MAX_BYTES = 5 * 1024 * 1024;

const initialForm = () => ({ name: '', email: '', jobDescriptionId: '' });

export default function CreateCandidateModal({ open, onClose }) {
  const dispatch = useDispatch();
  const { push } = useToast();
  const [form, setForm] = useState(initialForm);
  const [jds, setJds] = useState([]);
  const [jdsLoading, setJdsLoading] = useState(false);
  const [jdsError, setJdsError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [resumeFile, setResumeFile] = useState(null);
  const [scanPhase, setScanPhase] = useState(null); // 'creating' | 'uploading' | 'scanning' | 'matching'
  const [resumePreviewUrl, setResumePreviewUrl] = useState(null);
  const resumeInputRef = useRef(null);

  // Object URL for previewing the resume during scan.
  useEffect(() => {
    if (!resumeFile) {
      setResumePreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(resumeFile);
    setResumePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [resumeFile]);

  // Load active JDs for the dropdown whenever the modal opens.
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setJdsLoading(true);
    setJdsError(null);
    jobDescriptionApi
      .list({ isActive: true, limit: 100 })
      .then((data) => { if (!cancelled) setJds(data?.items || []); })
      .catch(() => {
        if (!cancelled) setJdsError('Could not load job descriptions — check your connection and try again.');
      })
      .finally(() => { if (!cancelled) setJdsLoading(false); });
    return () => { cancelled = true; };
  }, [open]);

  const reset = () => {
    setForm(initialForm());
    setResumeFile(null);
    if (resumeInputRef.current) resumeInputRef.current.value = '';
  };

  const handleClose = () => { reset(); onClose?.(); };

  const onResumeChange = (e) => {
    const file = e.target.files?.[0] || null;
    if (!file) { setResumeFile(null); return; }
    if (!RESUME_MIME.includes(file.type)) {
      push({ type: 'error', message: 'Resume must be PDF, DOC, or DOCX' });
      e.target.value = '';
      return;
    }
    if (file.size > RESUME_MAX_BYTES) {
      push({ type: 'error', message: 'Resume must be 5 MB or smaller' });
      e.target.value = '';
      return;
    }
    setResumeFile(file);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.jobDescriptionId) {
      push({ type: 'warn', message: 'Name, email and a job description are required' });
      return;
    }
    setBusy(true);
    setScanPhase(resumeFile ? 'creating' : null);

    const action = await dispatch(createCandidate({
      name: form.name,
      email: form.email,
      jobDescriptionId: form.jobDescriptionId,
    }));
    if (!createCandidate.fulfilled.match(action)) {
      setBusy(false);
      setScanPhase(null);
      push({ type: 'error', message: action.payload?.message || 'Failed to create candidate' });
      return;
    }
    const candidate = action.payload.candidate;

    if (resumeFile) {
      setScanPhase('uploading');
      const toScan = setTimeout(() => setScanPhase('scanning'), 600);
      const upload = await dispatch(uploadCandidateResume({ id: candidate.id, file: resumeFile }));
      clearTimeout(toScan);
      setScanPhase('matching');
      await new Promise((r) => setTimeout(r, 500));

      if (uploadCandidateResume.fulfilled.match(upload)) {
        const scr = upload.payload.candidate?.screening;
        const msg =
          scr?.status === 'scored' ? `Candidate created — screening complete (match: ${scr.matchPercent}%)`
          : scr?.status === 'skipped' ? 'Candidate created — no matching JD, screening skipped'
          : scr?.status === 'failed' ? 'Candidate created — AI screening unavailable, review manually'
          : 'Candidate created — resume uploaded';
        push({ type: 'success', message: msg });
      } else {
        push({ type: 'warn', message: upload.payload?.message || 'Candidate created but resume upload failed' });
      }
    } else {
      push({ type: 'success', message: 'Candidate created — upload a resume to start screening' });
    }

    setBusy(false);
    setScanPhase(null);
    handleClose();
  };

  const PHASE_LABELS = {
    creating: { title: 'Creating candidate record…', step: 1 },
    uploading: { title: 'Uploading resume to secure storage…', step: 2 },
    scanning: { title: 'Scanning resume content…', step: 3 },
    matching: { title: 'Matching against the job description…', step: 4 },
  };

  const ScanView = () => {
    const meta = PHASE_LABELS[scanPhase] || PHASE_LABELS.creating;
    const isPdf = resumeFile?.type === 'application/pdf';
    return (
      <div className="resume-scan">
        <div className="resume-scan__doc">
          {isPdf && resumePreviewUrl ? (
            <iframe
              key={resumePreviewUrl}
              src={`${resumePreviewUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
              title="Resume preview"
              className="resume-scan__pdf"
            />
          ) : (
            <div className="resume-scan__paper">
              <div className="resume-scan__file-icon">📄</div>
              <div className="resume-scan__filename">{resumeFile?.name || 'resume'}</div>
              <div className="resume-scan__filesize">
                {resumeFile ? `${(resumeFile.size / 1024).toFixed(0)} KB` : ''}
              </div>
              <div className="resume-scan__line resume-scan__line--title" />
              <div className="resume-scan__line" />
              <div className="resume-scan__line resume-scan__line--short" />
              <div className="resume-scan__line resume-scan__line--medium" />
              <div className="resume-scan__line" />
              <div className="resume-scan__line resume-scan__line--short" />
            </div>
          )}
          <div className="resume-scan__beam" />
          <div className="resume-scan__glow" />
        </div>
        <div className="resume-scan__status">
          <div className="resume-scan__title">{meta.title}</div>
          <div className="resume-scan__steps">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className={`resume-scan__step ${
                  n < meta.step ? 'is-done' : n === meta.step ? 'is-current' : ''
                }`}
              >
                <span className="resume-scan__step-dot">{n < meta.step ? '✓' : n}</span>
                <span className="resume-scan__step-label">
                  {n === 1 && 'Create'}
                  {n === 2 && 'Upload'}
                  {n === 3 && 'Scan'}
                  {n === 4 && 'Match'}
                </span>
              </div>
            ))}
          </div>
          <div className="resume-scan__hint">This usually takes 5–15 seconds. Hang tight.</div>
        </div>
      </div>
    );
  };

  const noJds = !jdsLoading && !jdsError && jds.length === 0;

  return (
    <Modal
      open={open}
      onClose={scanPhase ? () => {} : handleClose}
      title={scanPhase ? 'Processing resume' : 'New candidate'}
      footer={
        scanPhase ? null : (
          <>
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button onClick={submit} loading={busy} disabled={noJds || !!jdsError}>Create candidate</Button>
          </>
        )
      }
    >
      {scanPhase ? <ScanView /> : (
        <form onSubmit={submit} className="create-candidate" noValidate>
          <Input
            label="Full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Jane Doe"
            required
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="jane@example.com"
            required
          />
          <div className="field">
            <label htmlFor="jd-select" className="field__label">Job description</label>
            {jdsError ? (
              <span className="field__hint create-candidate__hint--error">{jdsError}</span>
            ) : noJds ? (
              <span className="field__hint">
                No active job descriptions yet — create one in Job Descriptions first.
              </span>
            ) : (
              <>
                <span className="field__hint">
                  The candidate's tech stack and experience come from the selected JD.
                </span>
                <select
                  id="jd-select"
                  className="create-candidate__select"
                  value={form.jobDescriptionId}
                  onChange={(e) => setForm({ ...form, jobDescriptionId: e.target.value })}
                  disabled={jdsLoading}
                  required
                >
                  <option value="">{jdsLoading ? 'Loading…' : 'Select a job description'}</option>
                  {jds.map((jd) => (
                    <option key={jd.id} value={jd.id}>
                      {jd.title} · {jd.techStack} · {jd.experience}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
          <div className="field">
            <span className="field__label">Resume <span className="field__optional">(optional)</span></span>
            <span className="field__hint">
              PDF, DOC, or DOCX up to 5 MB. Sent to the interviewer when Round 2 is scheduled.
            </span>
            <input
              ref={resumeInputRef}
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={onResumeChange}
              className="create-candidate__file"
            />
            {resumeFile && (
              <div className="create-candidate__file-meta">
                {resumeFile.name} · {(resumeFile.size / 1024).toFixed(0)} KB
                <button
                  type="button"
                  className="create-candidate__file-clear"
                  onClick={() => {
                    setResumeFile(null);
                    if (resumeInputRef.current) resumeInputRef.current.value = '';
                  }}
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
}
