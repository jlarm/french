"use client";

import { useEffect, useMemo, useState } from "react";
import { QUIZ_ITEMS, type QuizLevel, type QuizTopic } from "./quizData";

type Level = "all" | QuizLevel;
type Topic = "all" | QuizTopic;
type Mode = "typing" | "choice";

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

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [level, setLevel] = useState<Level>("all");
  const [topic, setTopic] = useState<Topic>("all");
  const [mode, setMode] = useState<Mode>("typing");
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<"idle" | "correct" | "wrong">("idle");
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState({ correct: 0, total: 0, streak: 0 });
  const [choices, setChoices] = useState<string[]>([]);

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

  const current = filtered[index % Math.max(filtered.length, 1)];

  useEffect(() => {
    setIndex(0);
    setAnswer("");
    setStatus("idle");
    setRevealed(false);
  }, [level, topic]);

  const totalItems = filtered.length;

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

  function handleCheck() {
    if (!current) return;
    const normalized = normalizeAnswer(answer);
    const accepted = [
      current.french,
      ...(current.accepted ?? []),
    ].map(normalizeAnswer);
    const isCorrect = normalized.length > 0 && accepted.includes(normalized);

    setStatus(isCorrect ? "correct" : "wrong");
    setStats((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
      streak: isCorrect ? prev.streak + 1 : 0,
    }));
  }

  function handleChoiceSelect(choice: string) {
    if (!current) return;
    setAnswer(choice);
    const isCorrect =
      normalizeAnswer(choice) === normalizeAnswer(current.french) ||
      (current.accepted ?? [])
        .map(normalizeAnswer)
        .includes(normalizeAnswer(choice));
    setStatus(isCorrect ? "correct" : "wrong");
    setStats((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
      streak: isCorrect ? prev.streak + 1 : 0,
    }));
  }

  function handleReveal() {
    setRevealed(true);
    setStatus("idle");
  }

  function handleNext() {
    if (filtered.length === 0) return;
    setIndex((prev) => (prev + 1) % filtered.length);
    setAnswer("");
    setStatus("idle");
    setRevealed(false);
  }

  function handleResetStats() {
    setStats({ correct: 0, total: 0, streak: 0 });
  }

  useEffect(() => {
    if (!current) {
      setChoices([]);
      return;
    }
    const poolSource = filtered.length >= 4 ? filtered : QUIZ_ITEMS;
    const pool = poolSource
      .filter((item) => item.id !== current.id)
      .map((item) => item.french);
    const selections: string[] = [current.french];
    while (selections.length < 4 && pool.length > 0) {
      const pickIndex = Math.floor(Math.random() * pool.length);
      selections.push(pool.splice(pickIndex, 1)[0]);
    }
    setChoices(selections.sort(() => Math.random() - 0.5));
  }, [current]);

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
            {(["typing", "choice"] as Mode[]).map((option) => (
              <button
                key={option}
                onClick={() => setMode(option)}
                className={`rounded-full border px-4 py-2 text-xs font-semibold capitalize transition-all sm:px-5 sm:text-sm ${
                  mode === option
                    ? "border-[#101014] bg-[#101014] text-white shadow-[0_10px_20px_rgba(16,16,20,0.2)]"
                    : "border-[#d7d1c7] bg-white text-[#3b3b45] hover:border-[#101014]"
                }`}
              >
                {option === "typing" ? "Typing mode" : "Multiple choice"}
              </button>
            ))}
          </div>
        </header>

        <main className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
          <section className="rounded-[28px] border border-[#e3ded6] bg-white p-6 shadow-[0_24px_60px_rgba(16,16,20,0.1)] sm:rounded-[32px] sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1b3f8b]">
                  Current prompt
                </p>
                <h2 className="font-display text-2xl sm:text-3xl">
                  {current ? current.english : "No items"}
                </h2>
              </div>
              <div className="rounded-2xl bg-[#f7f4ef] px-4 py-3 text-sm">
                <p className="font-semibold text-[#101014]">Progress</p>
                <p className="text-[#3b3b45]">
                  {totalItems === 0
                    ? "0 / 0"
                    : `${index + 1} / ${totalItems}`}
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-4">
              <label className="text-sm font-semibold text-[#3b3b45]">
                Your answer in French
              </label>
              <input
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="Type your translation here"
                disabled={mode === "choice"}
                className="w-full rounded-2xl border border-[#d7d1c7] bg-white px-4 py-3 text-base shadow-[0_10px_30px_rgba(16,16,20,0.06)] focus:border-[#1b3f8b] focus:outline-none disabled:cursor-not-allowed disabled:bg-[#f3efe7]"
              />

              {mode === "choice" && (
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

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  onClick={handleCheck}
                  disabled={mode === "choice" || !answer.trim() || !current}
                  className="w-full rounded-full bg-[#1b3f8b] px-6 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-[#c6c6c6] sm:w-auto"
                >
                  Check
                </button>
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
                  Type your best guess, then check your answer.
                </p>
              )}
              {revealed && current && (
                <p className="text-sm text-[#101014]">
                  <span className="font-semibold">Answer:</span> {current.french}
                </p>
              )}
            </div>
          </section>

          <aside className="flex flex-col gap-6">
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
              </ul>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
