import { useState, useEffect } from "react";

const AREAS = {
  job: { label: "Lumeglobal", emoji: "💼", color: "#60a5fa" },
  getfly: { label: "Getfly", emoji: "🚀", color: "#a78bfa" },
  mirai: { label: "Mirai", emoji: "⚡", color: "#34d399" },
  vamoss: { label: "Vamoss", emoji: "🔥", color: "#f97316" },
  fitness: { label: "Fitness", emoji: "💪", color: "#fb7185" },
  personal: { label: "Personal", emoji: "🌱", color: "#fbbf24" },
};

const DEFAULT_SCHEDULE = {
  Mon: { home: "getfly", tasks: [] },
  Tue: { home: "mirai", tasks: [] },
  Wed: { home: "getfly", tasks: [] },
  Thu: { home: "vamoss", tasks: [] },
  Fri: { home: "getfly", tasks: [] },
  Sat: { home: "personal", tasks: [] },
  Sun: { home: "fitness", tasks: [] },
};

const MVD = {
  getfly: "20 min of thinking/planning",
  mirai: "Review one task or push one commit",
  vamoss: "Review one task or push one commit",
  fitness: "15 min walk or stretch",
  personal: "Open the project once",
  job: "Ship one thing",
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function WeeklyPlanner() {
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [activeDay, setActiveDay] = useState(null);
  const [newTask, setNewTask] = useState("");
  const [completed, setCompleted] = useState({});
  const [mvdDone, setMvdDone] = useState({});
  const [reviewAnswers, setReviewAnswers] = useState({ q1: "", q2: "", q3: "" });
  const [tab, setTab] = useState("week"); // week | review
  const [editingHome, setEditingHome] = useState(null);

  const todayIndex = new Date().getDay();
  const todayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][todayIndex];

  useEffect(() => {
    setActiveDay(todayName);
  }, []);

  const addTask = (day) => {
    if (!newTask.trim()) return;
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        tasks: [...prev[day].tasks, { id: Date.now(), text: newTask.trim() }],
      },
    }));
    setNewTask("");
  };

  const toggleTask = (day, id) => {
    const key = `${day}-${id}`;
    setCompleted((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const deleteTask = (day, id) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        tasks: prev[day].tasks.filter((t) => t.id !== id),
      },
    }));
  };

  const totalTasks = Object.entries(schedule).reduce(
    (acc, [day, data]) => acc + data.tasks.length, 0
  );
  const totalDone = Object.values(completed).filter(Boolean).length;
  const mvdCount = Object.values(mvdDone).filter(Boolean).length;

  const activeData = activeDay ? schedule[activeDay] : null;
  const homeArea = activeData ? AREAS[activeData.home] : null;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0c0c0f",
      fontFamily: "'DM Mono', 'Courier New', monospace",
      color: "#e2e8f0",
      padding: "0",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Space+Grotesk:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #1a1a24; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        .day-pill:hover { transform: translateY(-2px); }
        .task-row:hover .del-btn { opacity: 1 !important; }
        .tab-btn { transition: all 0.2s; }
        .area-chip { transition: all 0.15s; }
        .area-chip:hover { transform: scale(1.05); cursor: pointer; }
        input:focus { outline: none; }
        textarea:focus { outline: none; }
        .mvd-card:hover { border-color: #333 !important; }
        .fade-in { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1e1e2e", padding: "20px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "11px", letterSpacing: "3px", color: "#555", textTransform: "uppercase", marginBottom: "4px" }}>Raj's</div>
          <div style={{ fontSize: "22px", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, letterSpacing: "-0.5px" }}>
            Weekly Command Center
          </div>
        </div>
        <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "22px", fontWeight: 700, color: "#a78bfa" }}>{totalDone}/{totalTasks}</div>
            <div style={{ fontSize: "10px", color: "#555", letterSpacing: "1px" }}>TASKS DONE</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "22px", fontWeight: 700, color: "#34d399" }}>{mvdCount}/7</div>
            <div style={{ fontSize: "10px", color: "#555", letterSpacing: "1px" }}>MVD STREAK</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "2px", padding: "16px 28px 0", borderBottom: "1px solid #1e1e2e" }}>
        {[["week", "Weekly View"], ["review", "Sunday Review"]].map(([id, label]) => (
          <button key={id} className="tab-btn" onClick={() => setTab(id)} style={{
            background: tab === id ? "#1e1e2e" : "transparent",
            border: "none", color: tab === id ? "#e2e8f0" : "#555",
            padding: "8px 18px", borderRadius: "8px 8px 0 0", cursor: "pointer",
            fontSize: "12px", letterSpacing: "1px", textTransform: "uppercase",
            fontFamily: "'DM Mono', monospace",
          }}>{label}</button>
        ))}
      </div>

      {tab === "week" && (
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", minHeight: "calc(100vh - 120px)" }}>
          {/* Left: Day selector */}
          <div style={{ borderRight: "1px solid #1e1e2e", padding: "20px 16px" }}>
            <div style={{ fontSize: "10px", letterSpacing: "2px", color: "#444", marginBottom: "14px", paddingLeft: "4px" }}>THIS WEEK</div>
            {DAYS.map((day) => {
              const data = schedule[day];
              const area = AREAS[data.home];
              const isToday = day === todayName;
              const isActive = day === activeDay;
              const doneTasks = data.tasks.filter(t => completed[`${day}-${t.id}`]).length;
              const isMvd = mvdDone[day];

              return (
                <div key={day} className="day-pill" onClick={() => setActiveDay(day)} style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "12px 14px", borderRadius: "10px", marginBottom: "6px",
                  background: isActive ? "#1e1e2e" : "transparent",
                  border: isActive ? `1px solid ${area.color}33` : "1px solid transparent",
                  cursor: "pointer", transition: "all 0.15s",
                }}>
                  <div style={{
                    width: "36px", height: "36px", borderRadius: "8px",
                    background: isActive ? `${area.color}22` : "#1a1a24",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "16px", flexShrink: 0,
                    border: isToday ? `1.5px solid ${area.color}` : "1px solid #222",
                  }}>{area.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 500, color: isActive ? "#fff" : "#aaa" }}>{day}</span>
                      {isToday && <span style={{ fontSize: "9px", background: area.color, color: "#000", borderRadius: "3px", padding: "1px 5px", fontWeight: 700, letterSpacing: "1px" }}>TODAY</span>}
                      {isMvd && <span style={{ fontSize: "12px" }}>✅</span>}
                    </div>
                    <div style={{ fontSize: "11px", color: "#555" }}>{area.label} · {data.tasks.length > 0 ? `${doneTasks}/${data.tasks.length}` : "no tasks"}</div>
                  </div>
                </div>
              );
            })}

            {/* Area legend */}
            <div style={{ marginTop: "24px", paddingLeft: "4px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "2px", color: "#444", marginBottom: "12px" }}>AREAS</div>
              {Object.entries(AREAS).map(([key, area]) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: area.color, flexShrink: 0 }} />
                  <span style={{ fontSize: "11px", color: "#555" }}>{area.emoji} {area.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Day detail */}
          {activeDay && activeData && homeArea && (
            <div className="fade-in" style={{ padding: "24px 28px" }}>
              {/* Day header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px" }}>
                <div>
                  <div style={{ fontSize: "32px", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, letterSpacing: "-1px" }}>{activeDay}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                    <span style={{ fontSize: "13px", color: homeArea.color }}>Home base: {homeArea.emoji} {homeArea.label}</span>
                    {editingHome === activeDay ? (
                      <select onChange={(e) => {
                        setSchedule(prev => ({ ...prev, [activeDay]: { ...prev[activeDay], home: e.target.value } }));
                        setEditingHome(null);
                      }} style={{ background: "#1a1a24", border: "1px solid #333", color: "#e2e8f0", borderRadius: "4px", fontSize: "11px", padding: "2px 6px" }}>
                        {Object.entries(AREAS).map(([k, a]) => (
                          <option key={k} value={k}>{a.emoji} {a.label}</option>
                        ))}
                      </select>
                    ) : (
                      <button onClick={() => setEditingHome(activeDay)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: "11px" }}>change</button>
                    )}
                  </div>
                </div>
                {/* MVD toggle */}
                <div onClick={() => setMvdDone(prev => ({ ...prev, [activeDay]: !prev[activeDay] }))} style={{
                  padding: "10px 16px", borderRadius: "10px", cursor: "pointer",
                  background: mvdDone[activeDay] ? `${homeArea.color}22` : "#1a1a24",
                  border: `1px solid ${mvdDone[activeDay] ? homeArea.color : "#333"}`,
                  textAlign: "center", transition: "all 0.2s",
                }}>
                  <div style={{ fontSize: "18px" }}>{mvdDone[activeDay] ? "✅" : "⬜"}</div>
                  <div style={{ fontSize: "10px", color: "#555", letterSpacing: "1px", marginTop: "4px" }}>MVD</div>
                </div>
              </div>

              {/* MVD hint */}
              <div style={{
                background: `${homeArea.color}11`, border: `1px solid ${homeArea.color}33`,
                borderRadius: "10px", padding: "12px 16px", marginBottom: "24px",
                fontSize: "12px", color: "#aaa",
              }}>
                <span style={{ color: homeArea.color, fontWeight: 500 }}>Minimum Viable Day: </span>
                {MVD[activeData.home] || "Show up for at least 15 mins"}
              </div>

              {/* Tasks */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "10px", letterSpacing: "2px", color: "#444", marginBottom: "14px" }}>TASKS FOR {activeDay.toUpperCase()}</div>
                {activeData.tasks.length === 0 && (
                  <div style={{ color: "#333", fontSize: "13px", padding: "16px 0", fontStyle: "italic" }}>
                    No tasks yet — add one below
                  </div>
                )}
                {activeData.tasks.map((task) => {
                  const key = `${activeDay}-${task.id}`;
                  const done = !!completed[key];
                  return (
                    <div key={task.id} className="task-row" style={{
                      display: "flex", alignItems: "center", gap: "12px",
                      padding: "12px 14px", borderRadius: "8px", marginBottom: "6px",
                      background: done ? "#1a1a24" : "#161620",
                      border: `1px solid ${done ? "#222" : "#2a2a3a"}`,
                      transition: "all 0.15s",
                    }}>
                      <div onClick={() => toggleTask(activeDay, task.id)} style={{
                        width: "18px", height: "18px", borderRadius: "4px", flexShrink: 0,
                        background: done ? homeArea.color : "transparent",
                        border: `2px solid ${done ? homeArea.color : "#444"}`,
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.15s",
                      }}>
                        {done && <span style={{ fontSize: "10px", color: "#000", fontWeight: 700 }}>✓</span>}
                      </div>
                      <span style={{ flex: 1, fontSize: "13px", color: done ? "#444" : "#ccc", textDecoration: done ? "line-through" : "none" }}>{task.text}</span>
                      <button className="del-btn" onClick={() => deleteTask(activeDay, task.id)} style={{
                        opacity: 0, background: "none", border: "none", color: "#555", cursor: "pointer",
                        fontSize: "14px", transition: "opacity 0.2s", padding: "0 4px",
                      }}>×</button>
                    </div>
                  );
                })}
              </div>

              {/* Add task */}
              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTask(activeDay)}
                  placeholder={`Add a task for ${activeDay}...`}
                  style={{
                    flex: 1, background: "#161620", border: "1px solid #2a2a3a",
                    borderRadius: "8px", padding: "11px 14px", color: "#e2e8f0",
                    fontSize: "13px", fontFamily: "'DM Mono', monospace",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={(e) => e.target.style.borderColor = homeArea.color}
                  onBlur={(e) => e.target.style.borderColor = "#2a2a3a"}
                />
                <button onClick={() => addTask(activeDay)} style={{
                  background: homeArea.color, border: "none", borderRadius: "8px",
                  padding: "11px 18px", cursor: "pointer", color: "#000",
                  fontWeight: 700, fontSize: "14px",
                }}>+</button>
              </div>

              {/* Other area chips for cross-work days */}
              <div style={{ marginTop: "32px" }}>
                <div style={{ fontSize: "10px", letterSpacing: "2px", color: "#444", marginBottom: "12px" }}>ALSO WORKING ON</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {Object.entries(AREAS).filter(([k]) => k !== activeData.home).map(([key, area]) => (
                    <div key={key} className="area-chip" style={{
                      padding: "6px 12px", borderRadius: "20px", fontSize: "11px",
                      background: "#1a1a24", border: "1px solid #2a2a3a", color: "#666",
                    }}>
                      {area.emoji} {area.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "review" && (
        <div className="fade-in" style={{ padding: "32px 40px", maxWidth: "680px" }}>
          <div style={{ marginBottom: "32px" }}>
            <div style={{ fontSize: "24px", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>Sunday Review</div>
            <div style={{ fontSize: "12px", color: "#555", marginTop: "6px" }}>10 minutes. Every Sunday. Don't skip it.</div>
          </div>

          {[
            { key: "q1", label: "Q1", question: "What's the most important thing for each area this week?", placeholder: "Getfly: finish MVP feature\nMirai: submit deliverable\nVamoss: client check-in\nFitness: 3x workout..." },
            { key: "q2", label: "Q2", question: "Are any deadlines shifting my default day slots?", placeholder: "e.g. Mirai deadline on Wed, so borrowing Tue + Thu for it..." },
            { key: "q3", label: "Q3", question: "What's my fitness plan for the week?", placeholder: "e.g. Mon/Wed/Fri mornings — 6am, 30 min run + weights..." },
          ].map(({ key, label, question, placeholder }) => (
            <div key={key} style={{ marginBottom: "28px" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "10px" }}>
                <div style={{
                  width: "28px", height: "28px", borderRadius: "6px", background: "#1e1e2e",
                  border: "1px solid #a78bfa44", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "11px", color: "#a78bfa", fontWeight: 700, flexShrink: 0,
                }}>{label}</div>
                <div style={{ fontSize: "14px", color: "#ccc", paddingTop: "4px" }}>{question}</div>
              </div>
              <textarea
                value={reviewAnswers[key]}
                onChange={(e) => setReviewAnswers(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                rows={4}
                style={{
                  width: "100%", background: "#0f0f18", border: "1px solid #2a2a3a",
                  borderRadius: "10px", padding: "14px", color: "#e2e8f0",
                  fontSize: "13px", fontFamily: "'DM Mono', monospace", resize: "vertical",
                  lineHeight: "1.7",
                }}
                onFocus={(e) => e.target.style.borderColor = "#a78bfa"}
                onBlur={(e) => e.target.style.borderColor = "#2a2a3a"}
              />
            </div>
          ))}

          <div style={{
            padding: "16px 20px", background: "#1a1a24", borderRadius: "10px",
            border: "1px solid #2a2a3a", fontSize: "12px", color: "#555", lineHeight: "1.8",
          }}>
            <span style={{ color: "#a78bfa" }}>Remember: </span>
            Showing up small beats not showing up. Your MVD minimum exists for hard days — use it without guilt.
          </div>
        </div>
      )}
    </div>
  );
}
