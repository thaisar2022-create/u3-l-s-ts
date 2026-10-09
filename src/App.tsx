/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  words,
  sentences,
  unit3GrammarPatterns,
  schoolPhonetics,
  qaLessons,
  rearrangeLessons,
  quizQuestions,
  blanks,
  fillVocabulary,
  WordItem,
  SentenceItem
} from './data';

type Page = 'home' | 'learn' | 'practice' | 'flash' | 'settings';
type LearnTab = 'Words' | 'Sentences' | 'Q & A' | 'Grammar';
type PracticeTab = 'quiz' | 'blank' | 'rearrange';

interface QuizResponse {
  index: number;
  choice: number;
  correct: boolean;
}

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [learnTab, setLearnTab] = useState<LearnTab>('Words');
  const [learnIndex, setLearnIndex] = useState<number>(0);
  const [qaIndex, setQaIndex] = useState<number>(0);
  const [flashIndex, setFlashIndex] = useState<number>(0);
  const [flashBack, setFlashBack] = useState<boolean>(false);

  // Practice state
  const [practice, setPractice] = useState<PracticeTab>('quiz');
  const [questionIndex, setQuestionIndex] = useState<number>(0);
  const [fillChoice, setFillChoice] = useState<number | null>(null);
  const [fillChecked, setFillChecked] = useState<boolean>(false);
  const [quizScore, setQuizScore] = useState<number>(0);
  const [quizResponses, setQuizResponses] = useState<QuizResponse[]>([]);

  // Rearrange state
  const [reorderIndex, setReorderIndex] = useState<number>(0);
  const [reorderPicked, setReorderPicked] = useState<number[]>([]);
  const [reorderChecked, setReorderChecked] = useState<boolean>(false);

  // Grammar accordion state (first pattern open by default)
  const [openGrammar, setOpenGrammar] = useState<number[]>([0]);

  // Voice & progress state
  const [speed, setSpeed] = useState<number>(() => {
    return parseFloat(localStorage.getItem('thaiSpeed') || '0.85');
  });
  const [done, setDone] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('thaiDoneUnit3V4') || '[]');
    } catch {
      return [];
    }
  });
  const [statusText, setStatusText] = useState<string>('');
  const [voiceListInfo, setVoiceListInfo] = useState<string>('Checking Thai voices...');

  // Audio recording state
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [audioURLs, setAudioURLs] = useState<Record<string, string>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Calculate progress percentage
  const totalActivities =
    words.length +
    sentences.length +
    qaLessons.length +
    rearrangeLessons.length +
    quizQuestions.length +
    blanks.length;
  const progressPct = Math.min(100, Math.round((done.length / Math.max(1, totalActivities)) * 100));

  const markDone = (key: string) => {
    setDone((prev) => {
      if (prev.includes(key)) return prev;
      const next = [...prev, key];
      localStorage.setItem('thaiDoneUnit3V4', JSON.stringify(next));
      return next;
    });
  };

  // Voice synthesizer
  const speak = (text: string, customSpeed?: number) => {
    if (!('speechSynthesis' in window)) {
      alert('ဤဖုန်းတွင် စာသားမှ အသံဖတ်သည့်စနစ် မရရှိပါ။');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'th-TH';
    utterance.rate = customSpeed || speed;

    const voices = window.speechSynthesis.getVoices();
    const thaiVoice =
      voices.find((v) => v.lang.toLowerCase() === 'th-th') ||
      voices.find((v) => v.lang.toLowerCase().startsWith('th'));

    if (thaiVoice) {
      utterance.voice = thaiVoice;
    } else {
      setStatusText(
        'Thai voice not found on device. Your phone may use a fallback voice. For accurate Thai tones, use recorded audio in production.'
      );
    }
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if ('speechSynthesis' in window) {
      const updateVoices = () => {
        const vs = window.speechSynthesis.getVoices();
        const thaiVoices = vs.filter((x) => x.lang.toLowerCase().startsWith('th'));
        if (thaiVoices.length > 0) {
          setVoiceListInfo(thaiVoices.map((x) => `${x.name} (${x.lang})`).join(', '));
        } else {
          setVoiceListInfo('No dedicated Thai voice detected on this device yet.');
        }
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  const navigateTo = (p: Page) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Audio recording toggle
  const toggleRecord = async (id: string) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setRecordingId(null);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      alert('Recording requires microphone permissions and HTTPS (or localhost).');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        const url = URL.createObjectURL(audioBlob);
        setAudioURLs((prev) => {
          if (prev[id]) URL.revokeObjectURL(prev[id]);
          return { ...prev, [id]: url };
        });
        setRecordingId(null);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordingId(id);
    } catch (err: any) {
      alert('Microphone permission unavailable: ' + (err?.message || err));
    }
  };

  // Rearrange order
  const getRearrangeBank = (lessonIdx: number) => {
    const lesson = rearrangeLessons[lessonIdx];
    const n = lesson.parts.length;
    return Array.from({ length: n }, (_, i) => n - 1 - i).filter((id) => !reorderPicked.includes(id));
  };

  // Navigation handlers for Learn
  const stepLearn = (delta: number) => {
    const arr = learnTab === 'Words' ? words : sentences;
    markDone(`learn-${learnTab}-${learnIndex}`);
    setLearnIndex((prev) => (prev + delta + arr.length) % arr.length);
  };

  const stepQA = (delta: number) => {
    markDone(`learn-qa-${qaIndex}`);
    setQaIndex((prev) => (prev + delta + qaLessons.length) % qaLessons.length);
  };

  const handleNextFlash = (delta: number) => {
    setFlashIndex((prev) => (prev + delta + words.length) % words.length);
    setFlashBack(false);
  };

  const renderActionBar = (thaiText: string, recId: string, withRecord = true) => {
    const isThisRecording = recordingId === recId;
    return (
      <>
        <div className="controls">
          <button type="button" className="btn" onClick={() => speak(thaiText)}>
            🔊 နားထောင်ပါ
          </button>
          <button type="button" className="btn secondary" onClick={() => speak(thaiText, 0.7)}>
            🐢 Slow
          </button>
          {withRecord && (
            <button
              type="button"
              className={`btn ghost ${isThisRecording ? 'recording' : ''}`}
              onClick={() => toggleRecord(recId)}
            >
              {isThisRecording ? '⏹️ Stop recording' : '🎙️ အသံသွင်းပါ'}
            </button>
          )}
        </div>
        {withRecord && audioURLs[recId] && (
          <div style={{ marginTop: '10px' }}>
            <p className="muted">သင့်အသံကို ပြန်နားထောင်ပါ</p>
            <audio controls src={audioURLs[recId]} />
          </div>
        )}
      </>
    );
  };

  return (
    <div className="app">
      {/* Top Hero Header */}
      <header className="hero">
        <div className="top">
          <div className="brandwrap">
            <img
              className="school-logo"
              src="/school-logo.png"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.src.endsWith('.svg')) {
                  target.src = '/school-logo.svg';
                }
              }}
              alt="ThaiSar school logo"
            />
            <div>
              <div className="brand-title">THAISAR</div>
              <div className="logo-label">Thai · Myanmar Speaking School</div>
            </div>
          </div>
          <div className="pill">🇹🇭 + 🇲🇲</div>
        </div>
        <h1>အခန်း (၃) · ကိန်းဂဏန်းများ</h1>
        <p>Unit 3 · Listening & Speaking · Beginner</p>
        <div className="progress">
          <span style={{ width: `${progressPct}%` }}></span>
        </div>
        <div className="small" style={{ marginTop: '7px', color: '#e2f9f0' }}>
          သင်ယူမှု တိုးတက်မှု · {progressPct}% ({done.length} activities)
        </div>
      </header>

      {/* Main Content Area */}
      <main className="content">
        {/* PAGE 1: HOME */}
        {page === 'home' && (
          <div>
            <div className="section-head">
              <h2>စတင်လေ့လာပါ 🌼</h2>
              <span className="muted">အခန်း ၃</span>
            </div>
            <div className="notice">
              အသံကို နားထောင်ပါ → လိုက်ပြောပါ → စာကြောင်းကို လေ့ကျင့်ပါ။ ထိုင်းအက္ခရာ အရင်ကျက်ရန် မလိုပါ။
            </div>
            <div className="rows" style={{ marginTop: '14px' }}>
              <button
                type="button"
                className="tile"
                onClick={() => {
                  setLearnTab('Words');
                  navigateTo('learn');
                }}
              >
                <span className="emoji">📖</span>
                <strong>စကားလုံးများ</strong>
                <small>Vocabulary · {words.length} items</small>
              </button>
              <button
                type="button"
                className="tile"
                onClick={() => {
                  setLearnTab('Sentences');
                  navigateTo('learn');
                }}
              >
                <span className="emoji">🎧</span>
                <strong>ဝါကျများ</strong>
                <small>Listen & repeat · {sentences.length}</small>
              </button>
              <button
                type="button"
                className="tile"
                onClick={() => {
                  setLearnTab('Grammar');
                  navigateTo('learn');
                }}
              >
                <span className="emoji">🧩</span>
                <strong>သဒ္ဒါ</strong>
                <small>Tap to see examples</small>
              </button>
              <button
                type="button"
                className="tile"
                onClick={() => {
                  setLearnTab('Q & A');
                  navigateTo('learn');
                }}
              >
                <span className="emoji">💬</span>
                <strong>အမေး / အဖြေ</strong>
                <small>10 listen & repeat pairs</small>
              </button>
              <button
                type="button"
                className="tile"
                onClick={() => {
                  setPractice('quiz');
                  navigateTo('practice');
                }}
              >
                <span className="emoji">📝</span>
                <strong>Unit 3 Quiz</strong>
                <small>12 comprehension questions</small>
              </button>
            </div>

            <h3 style={{ marginTop: '24px' }}>ဒီနေ့ လေ့လာမယ့် ဝါကျ</h3>
            <div className="card">
              <span className="tag">Listen & repeat</span>
              <div className="thai" lang="th">
                {sentences[0][0]}
              </div>
              <div className="phonetic">{sentences[0][1]}</div>
              <div className="mm" lang="my">
                {sentences[0][2]}
              </div>
              <div className="controls">
                <button type="button" className="btn" onClick={() => speak(sentences[0][0])}>
                  🔊 နားထောင်ပါ
                </button>
                <button type="button" className="btn secondary" onClick={() => speak(sentences[0][0], 0.7)}>
                  🐢 Slow
                </button>
              </div>
            </div>

            <button type="button" className="btn wide" onClick={() => navigateTo('learn')}>
              သင်ခန်းစာ စတင်ရန် →
            </button>
          </div>
        )}

        {/* PAGE 2: LEARN */}
        {page === 'learn' && (
          <div>
            {/* Learn Subtabs Header */}
            <div className="controls" style={{ marginBottom: '14px', marginTop: '0' }}>
              {(['Words', 'Sentences', 'Q & A', 'Grammar'] as LearnTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`btn ${learnTab === tab ? '' : 'secondary'}`}
                  onClick={() => {
                    setLearnTab(tab);
                    setLearnIndex(0);
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* TAB: Q & A */}
            {learnTab === 'Q & A' && (
              <div>
                <div className="section-head">
                  <h2>မေးခွန်းနှင့် အဖြေ · Q & A</h2>
                  <span className="counter">
                    {qaIndex + 1} / {qaLessons.length}
                  </span>
                </div>
                <p className="section-intro">
                  မေးခွန်းနှင့် အဖြေကို တစ်ကြောင်းချင်း နားထောင်၍ လိုက်ပြောပါ။ ဖြေရန် မလိုပါ။
                </p>
                <div className="card">
                  {/* Question */}
                  <div className="qa-item">
                    <span className="tag">Q · မေးခွန်း</span>
                    <div className="thai" lang="th">
                      {qaLessons[qaIndex][0]}
                    </div>
                    <div className="phonetic">{schoolPhonetics[qaLessons[qaIndex][0]] || ''}</div>
                    <div className="mm" lang="my">
                      {qaLessons[qaIndex][2]}
                    </div>
                    {renderActionBar(qaLessons[qaIndex][0], `qa-q-${qaIndex}`, true)}
                  </div>
                  <div className="qa-divider">↓ Answer · အဖြေ</div>
                  {/* Answer */}
                  <div className="qa-item">
                    <span className="tag">A · အဖြေ</span>
                    <div className="thai" lang="th">
                      {qaLessons[qaIndex][1]}
                    </div>
                    <div className="phonetic">{schoolPhonetics[qaLessons[qaIndex][1]] || ''}</div>
                    <div className="mm" lang="my">
                      {qaLessons[qaIndex][3]}
                    </div>
                    {renderActionBar(qaLessons[qaIndex][1], `qa-a-${qaIndex}`, true)}
                  </div>
                </div>
                <div className="controls">
                  <button type="button" className="btn secondary" onClick={() => stepQA(-1)}>
                    ← အရင်တစ်ခု
                  </button>
                  <button type="button" className="btn" onClick={() => stepQA(1)}>
                    နောက်တစ်ခု →
                  </button>
                </div>
                {statusText && <p className="footnote">{statusText}</p>}
              </div>
            )}

            {/* TAB: GRAMMAR */}
            {learnTab === 'Grammar' && (
              <div>
                <div className="section-head">
                  <h2>သဒ္ဒါ · Grammar</h2>
                  <span className="counter">{unit3GrammarPatterns.length} patterns</span>
                </div>
                <p className="section-intro">
                  အခန်း (၃) စာအုပ်မှ ဝါကျများတွင် ပါဝင်သော သဒ္ဒါပုံစံများကို စုစည်းထားပါသည်။ ခေါင်းစဉ်ကို နှိပ်ပြီး
                  ထိုင်းစာ၊ အသံထွက်နှင့် မြန်မာအဓိပ္ပာယ်ကို လေ့လာပါ။
                </p>
                {unit3GrammarPatterns.map((g, j) => {
                  const examples = g.examples
                    .map((t) => sentences.find((s) => s[0] === t) || words.find((w) => w[0] === t))
                    .filter(Boolean) as (WordItem | SentenceItem)[];

                  return (
                    <details key={j} className="grammar-accordion" open={openGrammar.includes(j)}>
                      <summary
                        onClick={(e) => {
                          e.preventDefault();
                          setOpenGrammar((prev) =>
                            prev.includes(j) ? prev.filter((idx) => idx !== j) : [...prev, j]
                          );
                        }}
                      >
                        {j + 1}. {g.title}
                      </summary>
                      <div className="grammar-body">
                        <h3 style={{ marginTop: '15px' }}>{g.formula}</h3>
                        <p className="muted">{g.explain}</p>
                        {examples.map((ex, exIdx) => (
                          <div key={exIdx} style={{ padding: '15px 0', borderTop: '1px solid #efe7f1' }}>
                            <div className="thai" style={{ fontSize: '23px' }} lang="th">
                              {ex[0]}
                            </div>
                            <div className="phonetic">{ex[1]}</div>
                            <div className="mm" lang="my">
                              {ex[2]}
                            </div>
                            {renderActionBar(ex[0], `grammar-${j}-${exIdx}`, false)}
                          </div>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}

            {/* TAB: WORDS or SENTENCES */}
            {(learnTab === 'Words' || learnTab === 'Sentences') && (
              <div>
                {(() => {
                  const arr = learnTab === 'Words' ? words : sentences;
                  const item = arr[learnIndex] || arr[0];
                  return (
                    <>
                      <div className="section-head">
                        <h2>နားထောင်ပြီး လိုက်ပြောပါ</h2>
                        <span className="counter">
                          {learnIndex + 1} / {arr.length}
                        </span>
                      </div>
                      <div className="card">
                        <span className="tag">{item[3]}</span>
                        <div className="thai" lang="th">
                          {item[0]}
                        </div>
                        <div className="phonetic">{item[1]}</div>
                        <div className="mm" lang="my">
                          {item[2]}
                        </div>
                        {renderActionBar(item[0], `learn-${learnTab}-${learnIndex}`, true)}
                      </div>
                      <div className="controls">
                        <button type="button" className="btn secondary" onClick={() => stepLearn(-1)}>
                          ← ရှေ့သို့
                        </button>
                        <button type="button" className="btn" onClick={() => stepLearn(1)}>
                          သိပြီ · Next →
                        </button>
                      </div>
                      {statusText && <p className="footnote">{statusText}</p>}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* PAGE 3: PRACTICE */}
        {page === 'practice' && (
          <div>
            <div className="section-head">
              <h2>Practice · လေ့ကျင့်ခန်း</h2>
            </div>
            <div className="rows practice-tiles">
              <button
                type="button"
                className="tile"
                onClick={() => {
                  setPractice('quiz');
                  setQuestionIndex(0);
                  setQuizScore(0);
                  setQuizResponses([]);
                }}
              >
                <span className="emoji">📝</span>
                <strong>Unit 3 Quiz</strong>
                <small>သင်ယူထားသည်ကို စမ်းစစ်ပါ</small>
              </button>
              <button
                type="button"
                className="tile"
                onClick={() => {
                  setPractice('blank');
                  setQuestionIndex(0);
                  setFillChoice(null);
                  setFillChecked(false);
                }}
              >
                <span className="emoji">🎧</span>
                <strong>Listen & Fill</strong>
                <small>နားထောင်ပြီး ဖြည့်ပါ</small>
              </button>
              <button
                type="button"
                className="tile"
                onClick={() => {
                  setPractice('rearrange');
                  setReorderIndex(0);
                  setReorderPicked([]);
                  setReorderChecked(false);
                }}
              >
                <span className="emoji">🧩</span>
                <strong>Rearrange Sentence</strong>
                <small>စကားလုံးများကို အစီအစဉ်မှန် စီပါ</small>
              </button>
            </div>

            {/* PRACTICE SUBMODE: QUIZ */}
            {practice === 'quiz' && (
              <div id="exercise" style={{ marginTop: '14px' }}>
                {questionIndex >= quizQuestions.length ? (
                  <div className="card quiz-finish">
                    <div className="bigscore">
                      {Math.round((quizScore / quizQuestions.length) * 100)}%
                    </div>
                    <h2>Unit 3 Quiz ပြီးပါပြီ!</h2>
                    <p className="mm">
                      {quizScore} / {quizQuestions.length} မှန်ပါတယ်။
                    </p>
                    <p className="muted">မှားခဲ့သော မေးခွန်းများကို ပြန်ကြည့်ပြီး နောက်တစ်ကြိမ် စမ်းကြည့်နိုင်ပါတယ်။</p>
                    {quizResponses
                      .filter((x) => !x.correct)
                      .map((resp) => {
                        const qObj = quizQuestions[resp.index];
                        return (
                          <div key={resp.index} className="quiz-review">
                            <strong>{qObj.q}</strong>
                            <p className="muted">{qObj.why}</p>
                          </div>
                        );
                      })}
                    <button
                      type="button"
                      className="btn wide"
                      onClick={() => {
                        setQuestionIndex(0);
                        setQuizScore(0);
                        setQuizResponses([]);
                      }}
                    >
                      🔄 Quiz ပြန်ဖြေရန်
                    </button>
                  </div>
                ) : (
                  (() => {
                    const q = quizQuestions[questionIndex];
                    const pickedResp = quizResponses.find((x) => x.index === questionIndex);

                    const chooseQuiz = (choiceIdx: number) => {
                      if (pickedResp) return;
                      const correct = choiceIdx === q.correct;
                      setQuizResponses((prev) => [
                        ...prev,
                        { index: questionIndex, choice: choiceIdx, correct }
                      ]);
                      if (correct) setQuizScore((prev) => prev + 1);
                    };

                    const handleNextQuiz = () => {
                      const next = questionIndex + 1;
                      setQuestionIndex(next);
                      if (next >= quizQuestions.length) {
                        markDone('unit3-quiz-completed');
                      }
                    };

                    return (
                      <div className="card">
                        <span className="tag">
                          Unit 3 Quiz · {questionIndex + 1} / {quizQuestions.length}
                        </span>
                        <div className="quiz-progress">
                          <span style={{ width: `${(100 * questionIndex) / quizQuestions.length}%` }}></span>
                        </div>
                        <h3 className="quiz-question">{q.q}</h3>
                        {q.audio && (
                          <div className="controls">
                            <button type="button" className="btn" onClick={() => speak(q.audio!)}>
                              🔊 အသံနားထောင်ပါ
                            </button>
                            <button
                              type="button"
                              className="btn secondary"
                              onClick={() => speak(q.audio!, 0.7)}
                            >
                              🐢 Slow
                            </button>
                          </div>
                        )}
                        <div className="stack" style={{ marginTop: '17px' }}>
                          {q.choices.map((opt, optIdx) => {
                            let stateClass = '';
                            if (pickedResp) {
                              if (optIdx === q.correct) stateClass = 'correct';
                              else if (optIdx === pickedResp.choice) stateClass = 'incorrect';
                            }
                            return (
                              <button
                                key={optIdx}
                                type="button"
                                className={`quiz-option ${stateClass}`}
                                disabled={Boolean(pickedResp)}
                                onClick={() => chooseQuiz(optIdx)}
                              >
                                {String.fromCharCode(65 + optIdx)}. {opt}
                              </button>
                            );
                          })}
                        </div>
                        {pickedResp ? (
                          <>
                            <div className="quiz-feedback">
                              <strong>
                                {pickedResp.correct ? '✅ မှန်ပါတယ်!' : '❌ လေ့လာပြီး ထပ်စမ်းကြည့်ပါ။'}
                              </strong>
                              <p>{q.why}</p>
                            </div>
                            <button type="button" className="btn wide" onClick={handleNextQuiz}>
                              {questionIndex === quizQuestions.length - 1
                                ? 'ရလဒ် ကြည့်ရန် →'
                                : 'နောက်မေးခွန်း →'}
                            </button>
                          </>
                        ) : (
                          <p className="muted" style={{ marginTop: '12px' }}>
                            အဖြေတစ်ခုကို ရွေးပါ။
                          </p>
                        )}
                      </div>
                    );
                  })()
                )}
              </div>
            )}

            {/* PRACTICE SUBMODE: LISTEN & FILL */}
            {practice === 'blank' && (
              <div id="exercise" style={{ marginTop: '14px' }}>
                {(() => {
                  const q = blanks[questionIndex % blanks.length];
                  const correctIdx = q.choices.indexOf(q.answer);

                  const handleSelectChoice = (j: number) => {
                    if (fillChecked) return;
                    setFillChoice(j);
                  };

                  const handleCheckBlank = () => {
                    if (fillChecked || fillChoice === null) return;
                    setFillChecked(true);
                    if (q.choices[fillChoice] === q.answer) {
                      markDone(`blank-${questionIndex}`);
                    }
                  };

                  const handleRetry = () => {
                    setFillChoice(null);
                    setFillChecked(false);
                  };

                  const handleComplete = () => {
                    if (fillChecked && fillChoice !== null && q.choices[fillChoice] === q.answer) {
                      markDone(`blank-${questionIndex}`);
                    }
                    setQuestionIndex((prev) => (prev + 1) % blanks.length);
                    setFillChoice(null);
                    setFillChecked(false);
                  };

                  const isCorrect = fillChoice === correctIdx;

                  return (
                    <div className="card fill-card">
                      <span className="tag">
                        🎧 Listen & Fill · {(questionIndex % blanks.length) + 1} / {blanks.length}
                      </span>
                      <p className="section-intro">
                        အသံကို နားထောင်ပြီး အဖြေမှန်ကို ရွေးပါ။ <strong>ထိုင်းစာဖတ်တတ်ရန် မလိုပါ။</strong>{' '}
                        ကတ်တစ်ခုစီတွင် ထိုင်းစာ၊ စာအုပ်သုံး phonetic၊ မြန်မာအသံထွက်နှင့် မြန်မာအဓိပ္ပာယ် ပါရှိသည်။
                      </p>
                      <div className="fill-prompt">
                        <span className="fill-prompt-label">မြန်မာအဓိပ္ပာယ်</span>
                        <div className="mm" lang="my">
                          {q.meaning}
                        </div>
                        <div className="fill-blank-line" lang="th">
                          {q.blank}
                        </div>
                      </div>
                      <div className="controls">
                        <button type="button" className="btn" onClick={() => speak(q.full)}>
                          🔊 နားထောင်ပါ
                        </button>
                        <button type="button" className="btn secondary" onClick={() => speak(q.full, 0.7)}>
                          🐢 ဖြည်းဖြည်း
                        </button>
                      </div>

                      <h3 className="fill-heading">အဖြေတစ်ခုကို ရွေးပါ။</h3>
                      <div className="fill-options" role="group" aria-label="Listen and Fill multiple choices">
                        {q.choices.map((choiceWord, j) => {
                          const vocab = fillVocabulary[choiceWord] || ['//', '', ''];
                          let stateClass = '';
                          if (fillChecked) {
                            if (j === correctIdx) stateClass = ' is-correct';
                            else if (j === fillChoice) stateClass = ' is-wrong';
                          } else if (fillChoice === j) {
                            stateClass = ' is-selected';
                          }

                          return (
                            <button
                              key={j}
                              type="button"
                              className={`fill-choice${stateClass}`}
                              onClick={() => handleSelectChoice(j)}
                              disabled={fillChecked}
                              aria-pressed={fillChoice === j}
                              aria-label={`${choiceWord} · ${vocab[2]}`}
                            >
                              <span className="fill-number">{String.fromCharCode(65 + j)}</span>
                              <span className="fill-lines">
                                <span className="fill-thai" lang="th">
                                  {choiceWord}
                                </span>
                                <span className="fill-phonetic">{vocab[0]}</span>
                                <span className="fill-pronunciation" lang="my">
                                  {vocab[1]}
                                </span>
                                <span className="fill-meaning" lang="my">
                                  {vocab[2]}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {!fillChecked && (
                        <button
                          type="button"
                          className="btn wide"
                          onClick={handleCheckBlank}
                          disabled={fillChoice === null}
                        >
                          အဖြေစစ်ဆေးပါ
                        </button>
                      )}

                      {fillChecked && (
                        <>
                          <div className={`fill-feedback ${isCorrect ? 'good' : 'retry'}`} role="status">
                            <strong>{isCorrect ? '✅ မှန်ပါတယ်!' : '📖 အဖြေမှန်ကို လေ့လာပါ။'}</strong>
                            <p>
                              {isCorrect
                                ? 'အသံကို မှန်ကန်စွာ ရွေးချယ်နိုင်ပါတယ်။'
                                : 'မှားသောအဖြေကို ပြထားပြီး အဖြေမှန်ကို အစိမ်းရောင်ဖြင့် ပြထားပါတယ်။'}
                            </p>
                            <div className="fill-fully">
                              <div className="thai" lang="th">
                                {q.full}
                              </div>
                              <div className="phonetic">{schoolPhonetics[q.full] || ''}</div>
                              <div className="mm" lang="my">
                                {q.meaning}
                              </div>
                            </div>
                          </div>
                          <div className="controls">
                            <button type="button" className="btn secondary" onClick={handleRetry}>
                              ↺ ပြန်လေ့ကျင့်ရန်
                            </button>
                            <button type="button" className="btn" onClick={handleComplete}>
                              {questionIndex % blanks.length === blanks.length - 1
                                ? 'အစက ပြန်လေ့ကျင့်ရန်'
                                : 'နောက်မေးခွန်း →'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* PRACTICE SUBMODE: REARRANGE */}
            {practice === 'rearrange' && (
              <div id="exercise" style={{ marginTop: '14px' }}>
                {(() => {
                  const lesson = rearrangeLessons[reorderIndex];
                  const available = getRearrangeBank(reorderIndex);
                  const isComplete = reorderPicked.length === lesson.parts.length;
                  const isCorrect =
                    reorderChecked && isComplete && reorderPicked.every((id, j) => id === j);

                  const pickToken = (id: number) => {
                    if (reorderPicked.includes(id) || reorderPicked.length >= lesson.parts.length) return;
                    setReorderPicked((prev) => [...prev, id]);
                    setReorderChecked(false);
                  };

                  const removeToken = (id: number) => {
                    setReorderPicked((prev) => prev.filter((x) => x !== id));
                    setReorderChecked(false);
                  };

                  const checkAnswer = () => {
                    if (!isComplete) return;
                    setReorderChecked(true);
                    if (reorderPicked.every((id, j) => id === j)) {
                      markDone(`rearrange-${reorderIndex}`);
                    }
                  };

                  const resetRearrange = () => {
                    setReorderPicked([]);
                    setReorderChecked(false);
                  };

                  const nextRearrange = () => {
                    setReorderIndex((prev) => (prev + 1) % rearrangeLessons.length);
                    resetRearrange();
                  };

                  const fullThai = lesson.parts.map((p) => p[0]).join('');
                  const fullPhon = `/${lesson.parts.map((p) => p[1].replaceAll('/', '')).join('-')}/`;

                  return (
                    <div className="card">
                      <span className="tag">
                        Rearrange Sentence · {reorderIndex + 1} / {rearrangeLessons.length}
                      </span>
                      <p className="section-intro">
                        မြန်မာအဓိပ္ပာယ်ကို ဖတ်ပြီး ထိုင်းစကားလုံးများကို အစီအစဉ်မှန် စီပါ။ ကတ်တစ်ခုစီတွင်
                        ထိုင်းစာ၊ စာအုပ်သုံး phonetic နှင့် မြန်မာအသံထွက် ပါရှိသည်။
                      </p>
                      <div className="reorder-prompt">
                        <strong>မြန်မာအဓိပ္ပာယ်</strong>
                        <div className="mm">{lesson.meaning}</div>
                      </div>
                      <div className="controls">
                        <button type="button" className="btn secondary" onClick={() => speak(fullThai)}>
                          🔊 နားထောင်ပါ
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => speak(fullThai, 0.7)}
                        >
                          🐢 အနှေးအသံ
                        </button>
                      </div>

                      {/* Area 1: Picked */}
                      <div className="reorder-area">
                        <h4>၁။ စီထားသော စကားလုံးများ (နှိပ်၍ ပြန်ဖြုတ်နိုင်ပါသည်)</h4>
                        <div className="reorder-tiles">
                          {reorderPicked.length === 0 ? (
                            <div className="reorder-empty">အောက်က ကတ်များကို အစဉ်လိုက် နှိပ်ပါ။</div>
                          ) : (
                            reorderPicked.map((partId) => {
                              const part = lesson.parts[partId];
                              return (
                                <button
                                  key={partId}
                                  type="button"
                                  className="reorder-token selected"
                                  onClick={() => removeToken(partId)}
                                  aria-label={`Remove ${part[0]}`}
                                >
                                  <span className="reorder-thai" lang="th">
                                    {part[0]}
                                  </span>
                                  <span className="reorder-phon">{part[1]}</span>
                                  <span className="reorder-my" lang="my">
                                    {part[2]}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Area 2: Available bank */}
                      <div className="reorder-bank">
                        <h4>၂။ စကားလုံးကတ်များ</h4>
                        <div className="reorder-tiles">
                          {available.length === 0 ? (
                            <span className="muted">စကားလုံးအားလုံး စီပြီးပါပြီ။</span>
                          ) : (
                            available.map((partId) => {
                              const part = lesson.parts[partId];
                              return (
                                <button
                                  key={partId}
                                  type="button"
                                  className="reorder-token"
                                  onClick={() => pickToken(partId)}
                                  aria-label={`Choose ${part[0]}`}
                                >
                                  <span className="reorder-thai" lang="th">
                                    {part[0]}
                                  </span>
                                  <span className="reorder-phon">{part[1]}</span>
                                  <span className="reorder-my" lang="my">
                                    {part[2]}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Status & Feedback */}
                      {reorderChecked && (
                        <>
                          {isCorrect ? (
                            <>
                              <div className="reorder-status good" role="status">
                                <strong>✅ မှန်ပါတယ်!</strong> စာကြောင်းကို မှန်ကန်စွာ စီထားပါတယ်။
                              </div>
                              <div className="reorder-complete">
                                <div className="thai" lang="th">
                                  {fullThai}
                                </div>
                                <div className="phonetic">{fullPhon}</div>
                                <div className="mm">{lesson.meaning}</div>
                              </div>
                            </>
                          ) : (
                            <div className="reorder-status try" role="status">
                              အစီအစဉ် မမှန်သေးပါ။ စကားလုံးကို နှိပ်ပြီး ပြန်ရွှေ့နိုင်ပါတယ်။
                            </div>
                          )}
                        </>
                      )}

                      <div className="reorder-controls">
                        <button type="button" className="btn secondary" onClick={resetRearrange}>
                          ↺ ပြန်စီရန်
                        </button>
                        {isCorrect ? (
                          <button type="button" className="btn" onClick={nextRearrange}>
                            {reorderIndex === rearrangeLessons.length - 1
                              ? 'နောက်တစ်ကြိမ် လေ့ကျင့်ရန်'
                              : 'နောက်ဝါကျ →'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn"
                            onClick={checkAnswer}
                            disabled={!isComplete}
                          >
                            ✓ အဖြေစစ်ရန်
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* PAGE 4: FLASHCARDS */}
        {page === 'flash' && (
          <div>
            {(() => {
              const w = words[flashIndex];
              const flipCard = () => {
                setFlashBack((prev) => !prev);
                markDone(`card-${flashIndex}`);
              };

              return (
                <>
                  <div className="section-head">
                    <h2>Flashcards · မှတ်ဉာဏ်လေ့ကျင့်</h2>
                    <span className="counter">
                      {flashIndex + 1} / {words.length}
                    </span>
                  </div>
                  <div
                    className="card"
                    style={{
                      textAlign: 'center',
                      minHeight: '310px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                    onClick={flipCard}
                  >
                    <span className="tag">{flashBack ? 'Meaning' : 'Thai word'}</span>
                    {flashBack ? (
                      <div className="mm" style={{ fontSize: '26px' }}>
                        {w[2]}
                      </div>
                    ) : (
                      <>
                        <div className="thai">{w[0]}</div>
                        <div className="phonetic">{w[1]}</div>
                      </>
                    )}
                    <p className="muted" style={{ marginTop: '16px' }}>
                      ကတ်ကိုနှိပ်ပြီး လှန်ကြည့်ပါ
                    </p>
                  </div>
                  <div className="controls">
                    <button type="button" className="btn secondary" onClick={() => speak(w[0])}>
                      🔊 နားထောင်ပါ
                    </button>
                    <button type="button" className="btn ghost" onClick={() => handleNextFlash(-1)}>
                      ← ရှေ့သို့
                    </button>
                    <button type="button" className="btn" onClick={() => handleNextFlash(1)}>
                      နောက်တစ်ခု →
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* PAGE 5: SETTINGS */}
        {page === 'settings' && (
          <div>
            <h2>⚙️ အသံနှင့် app settings</h2>
            <div className="card">
              <h3>Thai voice · အသံ</h3>
              <p className="muted">Thai voice selection depends on the browser and operating system.</p>
              <div className="notice" style={{ margin: '10px 0' }}>
                {voiceListInfo}
              </div>
              <label htmlFor="rate" style={{ display: 'block', margin: '14px 0 6px', fontWeight: 600 }}>
                Audio speed · <span>{speed.toFixed(2)}</span>×
              </label>
              <input
                id="rate"
                type="range"
                min="0.5"
                max="1.1"
                step="0.05"
                value={speed}
                style={{ width: '100%' }}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setSpeed(val);
                  localStorage.setItem('thaiSpeed', String(val));
                }}
              />
              <div className="controls" style={{ marginTop: '14px' }}>
                <button type="button" className="btn" onClick={() => speak('สวัสดีครับ')}>
                  🔊 Test Thai voice
                </button>
              </div>
            </div>

            <div className="card">
              <h3>Install on phone</h3>
              <p className="muted">
                Open in Chrome on Android or Safari on iPhone, then tap <strong>Add to Home Screen</strong> or{' '}
                <strong>Install App</strong>.
              </p>
              <p className="small" style={{ marginTop: '8px', color: '#65766d' }}>
                Full PWA offline caching is registered via Service Worker (sw.js). Works seamlessly on all modern
                touch screens.
              </p>
            </div>

            <div className="card">
              <h3>Student progress</h3>
              <p className="muted">Saved on this device, not synchronized with a school account.</p>
              <button
                type="button"
                className="btn secondary"
                style={{ marginTop: '10px' }}
                onClick={() => {
                  if (window.confirm('Reset your progress?')) {
                    setDone([]);
                    localStorage.removeItem('thaiDoneUnit3V4');
                  }
                }}
              >
                Reset progress
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Fixed Bottom Navigation */}
      <nav className="nav" id="nav">
        <button
          type="button"
          data-page="home"
          className={page === 'home' ? 'active' : ''}
          onClick={() => navigateTo('home')}
        >
          <span className="ico">⌂</span>ပင်မ
        </button>
        <button
          type="button"
          data-page="learn"
          className={page === 'learn' ? 'active' : ''}
          onClick={() => navigateTo('learn')}
        >
          <span className="ico">◉</span>လေ့လာ
        </button>
        <button
          type="button"
          data-page="practice"
          className={page === 'practice' ? 'active' : ''}
          onClick={() => navigateTo('practice')}
        >
          <span className="ico">✦</span>လေ့ကျင့်
        </button>
        <button
          type="button"
          data-page="flash"
          className={page === 'flash' ? 'active' : ''}
          onClick={() => navigateTo('flash')}
        >
          <span className="ico">▣</span>ကတ်များ
        </button>
        <button
          type="button"
          data-page="settings"
          className={page === 'settings' ? 'active' : ''}
          onClick={() => navigateTo('settings')}
        >
          <span className="ico">⚙</span>ချိန်ညှိ
        </button>
      </nav>
    </div>
  );
}
