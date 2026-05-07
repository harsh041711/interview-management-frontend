import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/authSlice';
import candidateReducer from '@/features/candidates/candidateSlice';
import questionReducer from '@/features/questions/questionSlice';
import submissionReducer from '@/features/submissions/submissionSlice';
import testReducer from '@/features/test/testSlice';
import interviewerReducer from '@/features/interviewers/interviewerSlice';
import interviewReducer from '@/features/interviews/interviewSlice';
import interviewViewReducer from '@/features/interviewView/interviewViewSlice';
import accountSetupReducer from '@/features/accountSetup/accountSetupSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    candidates: candidateReducer,
    questions: questionReducer,
    submissions: submissionReducer,
    test: testReducer,
    interviewers: interviewerReducer,
    interviews: interviewReducer,
    interviewView: interviewViewReducer,
    accountSetup: accountSetupReducer,
  },
  middleware: (getDefault) =>
    getDefault({
      serializableCheck: {
        ignoredActions: ['test/uploadPhoto/pending', 'test/uploadPhoto/fulfilled'],
        ignoredPaths: ['test.photoBlob'],
      },
    }),
});
