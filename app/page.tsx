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
  const [level, setLevel] = useState<Level>("all");
  const [topic, setTopic] = useState<Topic>("all");
  const [mode, setMode] = useState<Mode>("typing");
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<"idle" | "correct" | "wrong">("idle");
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState({ correct: 0, total: 0, streak: 0 });
  const [choices, setChoices] = useState<string[]>([]);

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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fef6e8,_#f3efe7_40%,_#e7efe9_100%)] px-6 py-10 text-[#101014]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="flex flex-col gap-6 rounded-3xl border border-[#e7dfd3] bg-white/70 p-8 shadow-[0_20px_60px_rgba(16,16,20,0.08)] backdrop-blur">
          <div className="flex flex-col gap-4">
            <span className="w-fit rounded-full border border-[#ff7a59] bg-[#fff1ec] px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-[#c24f35]">
              French Flow
            </span>
            <h1 className="font-display text-4xl leading-tight sm:text-5xl">
              Build your French confidence, one phrase at a time.
            </h1>
            <p className="max-w-2xl text-base text-[#3b3b45] sm:text-lg">
              Pick a difficulty, type what you remember, and check yourself. The
              quiz keeps your streak and makes space to learn from every miss.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {(["all", "easy", "medium", "hard"] as Level[]).map((option) => (
              <button
                key={option}
                onClick={() => setLevel(option)}
                className={`rounded-full border px-5 py-2 text-sm font-semibold capitalize transition-all ${
                  level === option
                    ? "border-[#101014] bg-[#101014] text-white shadow-[0_10px_20px_rgba(16,16,20,0.2)]"
                    : "border-[#d7d1c7] bg-white text-[#3b3b45] hover:border-[#101014]"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {topics.map((option) => (
              <button
                key={option}
                onClick={() => setTopic(option)}
                className={`rounded-full border px-5 py-2 text-sm font-semibold capitalize transition-all ${
                  topic === option
                    ? "border-[#76805b] bg-[#e7efe9] text-[#3d4b2e] shadow-[0_10px_20px_rgba(61,75,46,0.18)]"
                    : "border-[#d7d1c7] bg-white text-[#3b3b45] hover:border-[#76805b]"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {(["typing", "choice"] as Mode[]).map((option) => (
              <button
                key={option}
                onClick={() => setMode(option)}
                className={`rounded-full border px-5 py-2 text-sm font-semibold capitalize transition-all ${
                  mode === option
                    ? "border-[#ff7a59] bg-[#fff1ec] text-[#c24f35] shadow-[0_10px_20px_rgba(194,79,53,0.18)]"
                    : "border-[#d7d1c7] bg-white text-[#3b3b45] hover:border-[#ff7a59]"
                }`}
              >
                {option === "typing" ? "Typing mode" : "Multiple choice"}
              </button>
            ))}
          </div>
        </header>

        <main className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-[#e7dfd3] bg-white p-8 shadow-[0_20px_50px_rgba(16,16,20,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#76805b]">
                  Current prompt
                </p>
                <h2 className="font-display text-3xl">
                  {current ? current.english : "No items"}
                </h2>
              </div>
              <div className="rounded-2xl bg-[#f3efe7] px-4 py-3 text-sm">
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
                className="rounded-2xl border border-[#d7d1c7] bg-white px-4 py-3 text-base shadow-[0_10px_30px_rgba(16,16,20,0.06)] focus:border-[#101014] focus:outline-none disabled:cursor-not-allowed disabled:bg-[#f3efe7]"
              />

              {mode === "choice" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {choices.map((choice) => (
                    <button
                      key={choice}
                      onClick={() => handleChoiceSelect(choice)}
                      className="rounded-2xl border border-[#d7d1c7] bg-white px-4 py-3 text-left text-sm font-semibold text-[#3b3b45] transition hover:border-[#101014]"
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleCheck}
                  disabled={mode === "choice" || !answer.trim() || !current}
                  className="rounded-full bg-[#101014] px-6 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-[#c6c6c6]"
                >
                  Check
                </button>
                <button
                  onClick={handleReveal}
                  className="rounded-full border border-[#d7d1c7] bg-white px-6 py-3 text-sm font-semibold text-[#3b3b45] transition hover:border-[#101014]"
                >
                  Reveal
                </button>
                <button
                  onClick={handleNext}
                  className="rounded-full border border-[#101014] bg-[#fff1ec] px-6 py-3 text-sm font-semibold text-[#c24f35] transition hover:bg-[#ffe3da]"
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
            <div className="rounded-3xl border border-[#e7dfd3] bg-white p-6 shadow-[0_20px_40px_rgba(16,16,20,0.08)]">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#76805b]">
                Session stats
              </p>
              <div className="mt-4 grid gap-4">
                <div className="rounded-2xl bg-[#f3efe7] p-4">
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
                <div className="rounded-2xl bg-[#e7efe9] p-4">
                  <p className="text-sm text-[#3b3b45]">Current streak</p>
                  <p className="font-display text-3xl text-[#101014]">
                    {stats.streak}
                  </p>
                </div>
              </div>
              <button
                onClick={handleResetStats}
                className="mt-4 rounded-full border border-[#d7d1c7] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#3b3b45] transition hover:border-[#101014]"
              >
                Reset stats
              </button>
            </div>

            <div className="rounded-3xl border border-[#e7dfd3] bg-white p-6 shadow-[0_20px_40px_rgba(16,16,20,0.08)]">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#76805b]">
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
