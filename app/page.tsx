"use client";

import { useEffect, useMemo, useState } from "react";
import { QUIZ_ITEMS, type QuizLevel, type QuizTopic } from "./quizData";

type Level = "all" | QuizLevel;
type Topic = "all" | QuizTopic;
type Mode = "typing" | "choice" | "listen" | "builder";

type ItemProgress = {
  interval: number;
  ease: number;
  due: number;
  correct: number;
  wrong: number;
};

type GoalState = {
  dailyGoal: number;
  history: Record<string, number>;
  streak: number;
  lastDate: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeAnswer(text: string) {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9' -]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function computeStreak(history: Record<string, number>, goal: number) {
  let streak = 0;
  const start = new Date();
  start.setDate(start.getDate() - 1);
  for (let i = 0; i < 60; i += 1) {
    const key = new Date(start.getTime() - i * DAY_MS);
    const k = `${key.getFullYear()}-${String(key.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(key.getDate()).padStart(2, "0")}`;
    if ((history[k] ?? 0) >= goal) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [level, setLevel] = useState<Level>("all");
  const [topic, setTopic] = useState<Topic>("all");
  const [mode, setMode] = useState<Mode>("typing");
  const [position, setPosition] = useState(0);
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<"idle" | "correct" | "wrong">("idle");
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState({ correct: 0, total: 0, streak: 0 });
  const [progress, setProgress] = useState<Record<number, ItemProgress>>({});
  const [goalState, setGoalState] = useState<GoalState>({
    dailyGoal: 12,
    history: {},
    streak: 0,
    lastDate: "",
  });
  const [choices, setChoices] = useState<string[]>([]);
  const [listenChoices, setListenChoices] = useState<string[]>([]);
  const [builderTiles, setBuilderTiles] = useState<string[]>([]);
  const [builderAnswer, setBuilderAnswer] = useState<string[]>([]);
  const [autoPlay, setAutoPlay] = useState(true);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const topics = useMemo(() => {
    const set = new Set(QUIZ_ITEMS.map((item) => item.topic));
    return ["all", ...Array.from(set).sort()] as Topic[];
  }, []);

  const filtered = useMemo(() => {
    return QUIZ_ITEMS.filter((item) => {
      const levelMatch = level === "all" || item.level === level;
      const topicMatch = topic === "all" || item.topic === topic;
      return levelMatch && topicMatch;
    });
  }, [level, topic]);

  const filteredForMode = useMemo(() => {
    if (mode === "builder") {
      return filtered.filter((item) => item.builder && item.builder.length > 1);
    }
    return filtered;
  }, [filtered, mode]);

  const orderedItems = useMemo(() => {
    const withDue = filteredForMode.map((item) => ({
      item,
      due: progress[item.id]?.due ?? 0,
    }));
    withDue.sort((a, b) => a.due - b.due || a.item.id - b.item.id);
    return withDue.map((entry) => entry.item);
  }, [filteredForMode, progress]);

  const current = orderedItems[position % Math.max(orderedItems.length, 1)];

  useEffect(() => {
    setPosition(0);
    setAnswer("");
    setStatus("idle");
    setRevealed(false);
    setBuilderAnswer([]);
  }, [level, topic, mode]);

  const totalItems = orderedItems.length;

  useEffect(() => {
    const stored = localStorage.getItem("french-quiz-stats");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (
        typeof parsed?.correct === "number" &&
        typeof parsed?.total === "number" &&
        typeof parsed?.streak === "number"
      ) {
        setStats(parsed);
      }
    } catch {
      // Ignore invalid stored stats.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("french-quiz-stats", JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    const stored = localStorage.getItem("french-quiz-progress");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object") {
        setProgress(parsed);
      }
    } catch {
      // Ignore invalid stored progress.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("french-quiz-progress", JSON.stringify(progress));
  }, [progress]);

  useEffect(() => {
    const stored = localStorage.getItem("french-quiz-goals");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (
        typeof parsed?.dailyGoal === "number" &&
        typeof parsed?.history === "object"
      ) {
        setGoalState({
          dailyGoal: parsed.dailyGoal,
          history: parsed.history,
          streak: parsed.streak ?? 0,
          lastDate: parsed.lastDate ?? "",
        });
      }
    } catch {
      // Ignore invalid goal state.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("french-quiz-goals", JSON.stringify(goalState));
  }, [goalState]);

  useEffect(() => {
    setGoalState((prev) => {
      const today = todayKey();
      const updatedHistory = { ...prev.history };
      if (!(today in updatedHistory)) {
        updatedHistory[today] = 0;
      }
      return {
        ...prev,
        history: updatedHistory,
        streak: computeStreak(updatedHistory, prev.dailyGoal),
        lastDate: today,
      };
    });
  }, []);

  useEffect(() => {
    if (!current) {
      setChoices([]);
      setListenChoices([]);
      setBuilderTiles([]);
      return;
    }

    const poolSource = filteredForMode.length >= 4 ? filteredForMode : QUIZ_ITEMS;
    const poolFrench = poolSource
      .filter((item) => item.id !== current.id)
      .map((item) => item.french);
    const frenchSelections = [current.french, ...shuffle(poolFrench).slice(0, 3)];
    setChoices(shuffle(frenchSelections));

    const poolEnglish = poolSource
      .filter((item) => item.id !== current.id)
      .map((item) => item.english);
    const englishSelections = [current.english, ...shuffle(poolEnglish).slice(0, 3)];
    setListenChoices(shuffle(englishSelections));

    if (current.builder && current.builder.length > 1) {
      setBuilderTiles(shuffle(current.builder));
      setBuilderAnswer([]);
    } else {
      setBuilderTiles([]);
      setBuilderAnswer([]);
    }
  }, [current, filteredForMode]);

  useEffect(() => {
    if (!mounted) return;
    const voices = window.speechSynthesis.getVoices();
    if (voices.length) {
      const preferred = voices.find((v) => v.lang.startsWith("fr"));
      if (preferred) setVoice(preferred);
    }
    const handler = () => {
      const updated = window.speechSynthesis.getVoices();
      const preferred = updated.find((v) => v.lang.startsWith("fr"));
      if (preferred) setVoice(preferred);
    };
    window.speechSynthesis.addEventListener("voiceschanged", handler);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted || !autoPlay || mode !== "listen" || !current) return;
    speak(current.french, voice);
  }, [mounted, autoPlay, mode, current, voice]);

  function speak(text: string, selectedVoice: SpeechSynthesisVoice | null) {
    if (!mounted || !text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = selectedVoice?.lang ?? "fr-FR";
    if (selectedVoice) utterance.voice = selectedVoice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function applyResult(isCorrect: boolean) {
    if (!current) return;
    setStatus(isCorrect ? "correct" : "wrong");
    setStats((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
      streak: isCorrect ? prev.streak + 1 : 0,
    }));

    setProgress((prev) => {
      const now = Date.now();
      const existing = prev[current.id] ?? {
        interval: 0,
        ease: 2.5,
        due: now,
        correct: 0,
        wrong: 0,
      };
      if (isCorrect) {
        const interval = existing.interval <= 0 ? 1 : existing.interval * existing.ease;
        const ease = Math.min(3.0, existing.ease + 0.15);
        return {
          ...prev,
          [current.id]: {
            interval,
            ease,
            due: now + interval * DAY_MS,
            correct: existing.correct + 1,
            wrong: existing.wrong,
          },
        };
      }
      const interval = 0.25;
      const ease = Math.max(1.3, existing.ease - 0.2);
      return {
        ...prev,
        [current.id]: {
          interval,
          ease,
          due: now + interval * DAY_MS,
          correct: existing.correct,
          wrong: existing.wrong + 1,
        },
      };
    });

    if (isCorrect) {
      setGoalState((prev) => {
        const today = todayKey();
        const history = { ...prev.history };
        history[today] = (history[today] ?? 0) + 1;
        return {
          ...prev,
          history,
          streak: computeStreak(history, prev.dailyGoal),
          lastDate: today,
        };
      });
    }
  }

  function handleCheck() {
    if (!current) return;
    const normalized = normalizeAnswer(answer);
    const accepted = [current.french, ...(current.accepted ?? [])].map(
      normalizeAnswer
    );
    applyResult(normalized.length > 0 && accepted.includes(normalized));
  }

  function handleChoiceSelect(choice: string) {
    if (!current) return;
    setAnswer(choice);
    const isCorrect =
      normalizeAnswer(choice) === normalizeAnswer(current.french) ||
      (current.accepted ?? [])
        .map(normalizeAnswer)
        .includes(normalizeAnswer(choice));
    applyResult(isCorrect);
  }

  function handleListenSelect(choice: string) {
    if (!current) return;
    setAnswer(choice);
    applyResult(choice === current.english);
  }

  function handleBuilderSelect(token: string, index: number) {
    setBuilderAnswer((prev) => [...prev, token]);
    setBuilderTiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleBuilderUndo() {
    setBuilderAnswer((prev) => {
      if (prev.length === 0) return prev;
      const copy = [...prev];
      const token = copy.pop();
      if (token) {
        setBuilderTiles((tiles) => [...tiles, token]);
      }
      return copy;
    });
  }

  function handleBuilderReset() {
    if (current?.builder) {
      setBuilderTiles(shuffle(current.builder));
      setBuilderAnswer([]);
    }
  }

  function handleBuilderCheck() {
    if (!current) return;
    const attempt = builderAnswer.join(" ");
    const normalized = normalizeAnswer(attempt);
    const accepted = [current.french, ...(current.accepted ?? [])].map(
      normalizeAnswer
    );
    applyResult(normalized.length > 0 && accepted.includes(normalized));
  }

  function handleReveal() {
    setRevealed(true);
    setStatus("idle");
  }

  function handleNext() {
    if (orderedItems.length === 0) return;
    setPosition((prev) => (prev + 1) % orderedItems.length);
    setAnswer("");
    setStatus("idle");
    setRevealed(false);
    setBuilderAnswer([]);
  }

  function handleResetStats() {
    setStats({ correct: 0, total: 0, streak: 0 });
  }

  function handleGoalChange(value: number) {
    setGoalState((prev) => ({
      ...prev,
      dailyGoal: value,
      streak: computeStreak(prev.history, value),
    }));
  }

  const isTypingMode = mode === "typing";
  const isChoiceMode = mode === "choice";
  const isListenMode = mode === "listen";
  const isBuilderMode = mode === "builder";
  const today = todayKey();
  const todayCount = goalState.history[today] ?? 0;
  const goalProgress = Math.min(100, Math.round((todayCount / goalState.dailyGoal) * 100));

  const calendarDays = useMemo(() => {
    const days = [] as { key: string; count: number }[];
    for (let i = 13; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(date.getDate()).padStart(2, "0")}`;
      days.push({ key, count: goalState.history[key] ?? 0 });
    }
    return days;
  }, [goalState.history]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#ffffff,_#f7f4ef_55%,_#f0efe8_100%)] px-6 py-10 text-[#101014]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 rounded-[32px] border border-[#e3ded6] bg-white/80 p-8 shadow-[0_24px_80px_rgba(16,16,20,0.1)]">
          <div className="h-4 w-40 rounded-full bg-[#e7e1d9]" />
          <div className="h-10 w-3/4 rounded-2xl bg-[#eee8df]" />
          <div className="h-4 w-2/3 rounded-full bg-[#eee8df]" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#ffffff,_#f7f4ef_55%,_#f0efe8_100%)] px-4 py-8 text-[#101014] sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-0 top-0 h-full w-12 bg-[#1b3f8b]/90 sm:w-24" />
        <div className="absolute right-0 top-0 h-full w-12 bg-[#c73a3a]/90 sm:w-24" />
        <div className="absolute left-[15%] top-[12%] h-32 w-32 rounded-full border border-[#1b3f8b]/30 bg-white/60" />
        <div className="absolute right-[12%] top-[18%] h-36 w-36 rounded-full border border-[#c73a3a]/30 bg-white/60" />
        <div className="absolute bottom-[10%] left-[30%] h-48 w-48 rounded-full border border-[#c73a3a]/20 bg-white/50" />
        <div className="absolute bottom-[12%] right-[28%] h-40 w-40 rounded-full border border-[#1b3f8b]/20 bg-white/50" />
        <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(90deg,_rgba(27,63,139,0.15),_rgba(255,255,255,0.8),_rgba(199,58,58,0.15))]" />
      </div>
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 sm:gap-10">
        <header className="flex flex-col gap-6 rounded-[28px] border border-[#e3ded6] bg-white/80 p-6 shadow-[0_24px_80px_rgba(16,16,20,0.1)] backdrop-blur sm:rounded-[32px] sm:p-8">
          <div className="flex flex-col gap-4">
            <h1 className="font-display text-3xl leading-tight sm:text-5xl">
              Build your French confidence, one phrase at a time.
            </h1>
            <p className="max-w-2xl text-sm text-[#3b3b45] sm:text-lg">
              Pick a difficulty, type what you remember, and check yourself. The
              quiz keeps your streak and makes space to learn from every miss.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {(["all", "easy", "medium", "hard"] as Level[]).map((option) => (
              <button
                key={option}
                onClick={() => setLevel(option)}
                className={`rounded-full border px-4 py-2 text-xs font-semibold capitalize transition-all sm:px-5 sm:text-sm ${
                  level === option
                    ? "border-[#1b3f8b] bg-[#1b3f8b] text-white shadow-[0_10px_20px_rgba(27,63,139,0.2)]"
                    : "border-[#d7d1c7] bg-white text-[#3b3b45] hover:border-[#1b3f8b]"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {topics.map((option) => (
              <button
                key={option}
                onClick={() => setTopic(option)}
                className={`rounded-full border px-4 py-2 text-xs font-semibold capitalize transition-all sm:px-5 sm:text-sm ${
                  topic === option
                    ? "border-[#c73a3a] bg-[#fff1ef] text-[#a53333] shadow-[0_10px_20px_rgba(199,58,58,0.18)]"
                    : "border-[#d7d1c7] bg-white text-[#3b3b45] hover:border-[#c73a3a]"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {(["typing", "choice", "listen", "builder"] as Mode[]).map(
              (option) => (
                <button
                  key={option}
                  onClick={() => setMode(option)}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold capitalize transition-all sm:px-5 sm:text-sm ${
                    mode === option
                      ? "border-[#101014] bg-[#101014] text-white shadow-[0_10px_20px_rgba(16,16,20,0.2)]"
                      : "border-[#d7d1c7] bg-white text-[#3b3b45] hover:border-[#101014]"
                  }`}
                >
                  {option === "typing"
                    ? "Typing"
                    : option === "choice"
                    ? "Choice"
                    : option === "listen"
                    ? "Listen"
                    : "Builder"}
                </button>
              )
            )}
          </div>
        </header>

        <main className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
          <section className="rounded-[28px] border border-[#e3ded6] bg-white p-6 shadow-[0_24px_60px_rgba(16,16,20,0.1)] sm:rounded-[32px] sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1b3f8b]">
                  {isListenMode ? "Listen prompt" : "Current prompt"}
                </p>
                <h2 className="font-display text-2xl sm:text-3xl">
                  {current ? current.english : "No items"}
                </h2>
                {current && (
                  <p className="mt-2 text-sm text-[#3b3b45]">
                    {current.topic} · {current.level}
                  </p>
                )}
              </div>
              <div className="rounded-2xl bg-[#f7f4ef] px-4 py-3 text-sm">
                <p className="font-semibold text-[#101014]">Queue</p>
                <p className="text-[#3b3b45]">
                  {totalItems === 0 ? "0 / 0" : `${position + 1} / ${totalItems}`}
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-4">
              {!isListenMode && !isBuilderMode && (
                <>
                  <label className="text-sm font-semibold text-[#3b3b45]">
                    Your answer in French
                  </label>
                  <input
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    placeholder="Type your translation here"
                    disabled={!isTypingMode}
                    className="w-full rounded-2xl border border-[#d7d1c7] bg-white px-4 py-3 text-base shadow-[0_10px_30px_rgba(16,16,20,0.06)] focus:border-[#1b3f8b] focus:outline-none disabled:cursor-not-allowed disabled:bg-[#f3efe7]"
                  />
                </>
              )}

              {isListenMode && (
                <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-[#d7d1c7] bg-[#fbf8f2] p-5">
                  <p className="text-sm text-[#3b3b45]">
                    Press play, listen to the French phrase, and pick the correct
                    English meaning.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => current && speak(current.french, voice)}
                      className="rounded-full bg-[#1b3f8b] px-5 py-2 text-sm font-semibold text-white"
                    >
                      Play audio
                    </button>
                    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#3b3b45]">
                      <input
                        type="checkbox"
                        checked={autoPlay}
                        onChange={(event) => setAutoPlay(event.target.checked)}
                        className="h-4 w-4 rounded border-[#d7d1c7]"
                      />
                      Autoplay
                    </label>
                  </div>
                </div>
              )}

              {isChoiceMode && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {choices.map((choice) => (
                    <button
                      key={choice}
                      onClick={() => handleChoiceSelect(choice)}
                      className="rounded-2xl border border-[#d7d1c7] bg-white px-4 py-3 text-left text-sm font-semibold text-[#3b3b45] transition hover:border-[#1b3f8b]"
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              )}

              {isListenMode && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {listenChoices.map((choice) => (
                    <button
                      key={choice}
                      onClick={() => handleListenSelect(choice)}
                      className="rounded-2xl border border-[#d7d1c7] bg-white px-4 py-3 text-left text-sm font-semibold text-[#3b3b45] transition hover:border-[#1b3f8b]"
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              )}

              {isBuilderMode && (
                <div className="flex flex-col gap-4">
                  <div className="rounded-2xl border border-dashed border-[#d7d1c7] bg-[#fbf8f2] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1b3f8b]">
                      Build the sentence
                    </p>
                    <div className="mt-3 flex min-h-[56px] flex-wrap items-center gap-2">
                      {builderAnswer.length === 0 ? (
                        <span className="text-sm text-[#9a948b]">
                          Tap the tiles below to build the phrase.
                        </span>
                      ) : (
                        builderAnswer.map((token, index) => (
                          <span
                            key={`${token}-${index}`}
                            className="rounded-full bg-[#1b3f8b] px-3 py-1 text-xs font-semibold text-white"
                          >
                            {token}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {builderTiles.map((token, index) => (
                      <button
                        key={`${token}-${index}`}
                        onClick={() => handleBuilderSelect(token, index)}
                        className="rounded-full border border-[#d7d1c7] bg-white px-3 py-2 text-xs font-semibold text-[#3b3b45] hover:border-[#1b3f8b]"
                      >
                        {token}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleBuilderUndo}
                      className="rounded-full border border-[#d7d1c7] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#3b3b45]"
                    >
                      Undo
                    </button>
                    <button
                      onClick={handleBuilderReset}
                      className="rounded-full border border-[#d7d1c7] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#3b3b45]"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {isTypingMode && (
                  <button
                    onClick={handleCheck}
                    disabled={!answer.trim() || !current}
                    className="w-full rounded-full bg-[#1b3f8b] px-6 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-[#c6c6c6] sm:w-auto"
                  >
                    Check
                  </button>
                )}
                {isBuilderMode && (
                  <button
                    onClick={handleBuilderCheck}
                    disabled={builderAnswer.length === 0 || !current}
                    className="w-full rounded-full bg-[#1b3f8b] px-6 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-[#c6c6c6] sm:w-auto"
                  >
                    Check
                  </button>
                )}
                <button
                  onClick={handleReveal}
                  className="w-full rounded-full border border-[#d7d1c7] bg-white px-6 py-3 text-sm font-semibold text-[#3b3b45] transition hover:border-[#1b3f8b] sm:w-auto"
                >
                  Reveal
                </button>
                <button
                  onClick={handleNext}
                  className="w-full rounded-full border border-[#c73a3a] bg-[#fff1ef] px-6 py-3 text-sm font-semibold text-[#a53333] transition hover:bg-[#ffe3df] sm:w-auto"
                >
                  Next
                </button>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-dashed border-[#d7d1c7] bg-[#fbf8f2] p-5">
              {status === "correct" && (
                <p className="text-sm font-semibold text-[#2c6e49]">
                  Correct. Keep going!
                </p>
              )}
              {status === "wrong" && (
                <p className="text-sm font-semibold text-[#b23c3c]">
                  Not quite. Try revealing the answer.
                </p>
              )}
              {status === "idle" && !revealed && (
                <p className="text-sm text-[#3b3b45]">
                  {isListenMode
                    ? "Listen, then pick the correct English meaning."
                    : isBuilderMode
                    ? "Build the phrase and check your answer."
                    : "Type your best guess, then check your answer."}
                </p>
              )}
              {revealed && current && (
                <p className="text-sm text-[#101014]">
                  <span className="font-semibold">Answer:</span> {current.french}
                  <span className="text-[#3b3b45]"> — {current.english}</span>
                </p>
              )}
            </div>
          </section>

          <aside className="flex flex-col gap-6">
            <div className="rounded-[28px] border border-[#e3ded6] bg-white p-6 shadow-[0_20px_40px_rgba(16,16,20,0.1)]">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1b3f8b]">
                Daily goal
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {[8, 12, 16, 20].map((value) => (
                  <button
                    key={value}
                    onClick={() => handleGoalChange(value)}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                      goalState.dailyGoal === value
                        ? "border-[#1b3f8b] bg-[#1b3f8b] text-white"
                        : "border-[#d7d1c7] bg-white text-[#3b3b45]"
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-[#3b3b45]">
                  <span>{todayCount} today</span>
                  <span>{goalState.dailyGoal} target</span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-[#f1ece4]">
                  <div
                    className="h-2 rounded-full bg-[#1b3f8b]"
                    style={{ width: `${goalProgress}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-[#3b3b45]">
                  {goalProgress >= 100
                    ? "Goal met — keep the streak alive tomorrow."
                    : "Keep going to lock in your streak."}
                </p>
              </div>
            </div>

            <div className="rounded-[28px] border border-[#e3ded6] bg-white p-6 shadow-[0_20px_40px_rgba(16,16,20,0.1)]">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c73a3a]">
                Streak calendar
              </p>
              <p className="mt-2 text-sm text-[#3b3b45]">
                Current streak: <span className="font-semibold">{goalState.streak}</span> days
              </p>
              <div className="mt-4 grid grid-cols-7 gap-2">
                {calendarDays.map((day) => {
                  const intensity = Math.min(4, Math.floor(day.count / Math.max(1, goalState.dailyGoal / 4)));
                  const colors = [
                    "bg-[#f1ece4]",
                    "bg-[#d9e2f4]",
                    "bg-[#b7c9ef]",
                    "bg-[#7d9fe0]",
                    "bg-[#1b3f8b]",
                  ];
                  return (
                    <div
                      key={day.key}
                      title={`${day.key}: ${day.count}`}
                      className={`h-5 w-full rounded-md ${colors[intensity]}`}
                    />
                  );
                })}
              </div>
            </div>

            <div className="rounded-[28px] border border-[#e3ded6] bg-white p-6 shadow-[0_20px_40px_rgba(16,16,20,0.1)]">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1b3f8b]">
                Session stats
              </p>
              <div className="mt-4 grid gap-4">
                <div className="rounded-2xl bg-[#f7f4ef] p-4">
                  <p className="text-sm text-[#3b3b45]">Correct</p>
                  <p className="font-display text-3xl text-[#101014]">
                    {stats.correct}
                  </p>
                </div>
                <div className="rounded-2xl bg-[#f7f2ea] p-4">
                  <p className="text-sm text-[#3b3b45]">Attempts</p>
                  <p className="font-display text-3xl text-[#101014]">
                    {stats.total}
                  </p>
                </div>
                <div className="rounded-2xl bg-[#f2f5fb] p-4">
                  <p className="text-sm text-[#3b3b45]">Current streak</p>
                  <p className="font-display text-3xl text-[#101014]">
                    {stats.streak}
                  </p>
                </div>
              </div>
              <button
                onClick={handleResetStats}
                className="mt-4 rounded-full border border-[#d7d1c7] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#3b3b45] transition hover:border-[#1b3f8b]"
              >
                Reset stats
              </button>
            </div>

            <div className="rounded-[28px] border border-[#e3ded6] bg-white p-6 shadow-[0_20px_40px_rgba(16,16,20,0.1)]">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c73a3a]">
                Focus tips
              </p>
              <ul className="mt-4 flex flex-col gap-3 text-sm text-[#3b3b45]">
                <li>Say the phrase out loud before typing.</li>
                <li>Accents are optional for checking, but try to include them.</li>
                <li>Mix difficulties to keep your recall sharp.</li>
                <li>Listen mode trains your ear and rhythm.</li>
              </ul>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
