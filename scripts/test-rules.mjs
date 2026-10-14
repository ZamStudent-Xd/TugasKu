import assert from "node:assert";

// Implementasi self-check mandiri untuk aturan bisnis BR-01 s/d BR-12
function getTaskStatus(task, referenceDate = new Date()) {
  const progress = Math.min(100, Math.max(0, Math.round(task.progress || 0)));
  if (progress === 100) return "completed";
  if (task.deadline) {
    const deadlineTime = new Date(task.deadline).getTime();
    if (!isNaN(deadlineTime) && deadlineTime < referenceDate.getTime()) {
      return "overdue";
    }
  }
  if (progress > 0) return "in_progress";
  return "not_started";
}

function calculateDashboardMetrics(tasks) {
  const total = tasks.length;
  if (total === 0) {
    return { totalTasks: 0, completedTasks: 0, activeTasks: 0, overdueTasks: 0, averageProgress: 0 };
  }
  let completedCount = 0;
  let overdueCount = 0;
  let totalPoints = 0;
  let earnedPoints = 0;

  for (const t of tasks) {
    const status = getTaskStatus(t);
    const taskPoint = t.points ?? 50;
    totalPoints += taskPoint;
    if (status === "completed") {
      completedCount++;
      earnedPoints += taskPoint;
    } else if (status === "overdue") {
      overdueCount++;
    }
  }

  return {
    totalTasks: total,
    completedTasks: completedCount,
    activeTasks: total - completedCount,
    overdueTasks: overdueCount,
    averageProgress: totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0,
  };
}

function calculateAutoTaskPoints(taskId, courseTasks) {
  const count = courseTasks.length;
  if (count <= 1) return 100;
  const base = Math.floor(100 / count);
  const remainder = 100 - base * count;
  const index = courseTasks.findIndex((t) => t.id === taskId);
  if (index >= 0 && index < remainder) {
    return base + 1;
  }
  return base;
}

function syncTasksWithAutoPoints(tasks) {
  const courseGroups = {};
  for (const t of tasks) {
    if (!courseGroups[t.courseId]) {
      courseGroups[t.courseId] = [];
    }
    courseGroups[t.courseId].push(t);
  }

  return tasks.map((task) => {
    const group = courseGroups[task.courseId] || [task];
    const autoPoints = calculateAutoTaskPoints(task.id, group);
    if (task.points === autoPoints) return task;
    return { ...task, points: autoPoints };
  });
}

function calculateCourseProgress(tasks, courseId) {
  const courseTasks = tasks.filter((t) => t.courseId === courseId);
  if (courseTasks.length === 0) return { total: 0, progress: 0, totalPoints: 0, earnedPoints: 0 };
  const totalPoints = courseTasks.reduce(
    (acc, t) => acc + (t.points ?? calculateAutoTaskPoints(t.id, courseTasks)),
    0
  );
  const earnedPoints = courseTasks.reduce((acc, t) => {
    const pt = t.points ?? calculateAutoTaskPoints(t.id, courseTasks);
    return acc + (t.progress === 100 ? pt : 0);
  }, 0);
  return {
    total: courseTasks.length,
    progress: totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0,
    totalPoints,
    earnedPoints,
  };
}

function validateTaskInput(title, progress) {
  if (!title || title.trim().length === 0) return { valid: false, error: "Judul kosong" };
  if (title.length > 150) return { valid: false, error: "Judul terlalu panjang" };
  if (isNaN(progress) || progress < 0 || progress > 100) return { valid: false, error: "Progres di luar rentang" };
  return { valid: true };
}

// === TEST CASES ===
console.log("🧪 Menjalankan uji aturan bisnis TugasKu...");

// 1. BR-04 & BR-05: Progres 100% adalah selesai
assert.strictEqual(getTaskStatus({ progress: 100, deadline: "2020-01-01T00:00:00Z" }), "completed", "100% harus selesai meski deadline lewat");
assert.strictEqual(getTaskStatus({ progress: 0, deadline: "2099-01-01T00:00:00Z" }), "not_started", "0% harus belum dimulai");
assert.strictEqual(getTaskStatus({ progress: 45, deadline: "2099-01-01T00:00:00Z" }), "in_progress", "45% harus sedang dikerjakan");

// 2. BR-06: Deadline lewat dan progres < 100% adalah terlambat
const pastDate = new Date(Date.now() - 3600000).toISOString();
assert.strictEqual(getTaskStatus({ progress: 80, deadline: pastDate }), "overdue", "Deadline lewat harus terlambat");

// 3. BR-12: Tanpa deadline tidak boleh otomatis terlambat
assert.strictEqual(getTaskStatus({ progress: 0, deadline: null }), "not_started", "Tanpa deadline tidak boleh terlambat");
assert.strictEqual(getTaskStatus({ progress: 50, deadline: null }), "in_progress", "Tanpa deadline 50% harus sedang dikerjakan");

// 4. Kalkulasi metrik dashboard & bobot poin mata kuliah
const sampleTasks = [
  { courseId: "c1", progress: 100, points: 50, deadline: null },
  { courseId: "c1", progress: 0, points: 50, deadline: "2099-01-01T00:00:00Z" },
  { courseId: "c2", progress: 100, points: 100, deadline: pastDate },
];
const metrics = calculateDashboardMetrics(sampleTasks);
assert.strictEqual(metrics.totalTasks, 3);
assert.strictEqual(metrics.completedTasks, 2);
assert.strictEqual(metrics.overdueTasks, 0); // 100% Selesai walau deadline lewat
assert.strictEqual(metrics.activeTasks, 1);
assert.strictEqual(metrics.averageProgress, 75); // (50 + 100) / 200 = 75%

// 5. Uji kalkulasi progres mata kuliah dengan checkbox (Individu & Kelompok)
const c1Stats = calculateCourseProgress(sampleTasks, "c1");
assert.strictEqual(c1Stats.total, 2);
assert.strictEqual(c1Stats.totalPoints, 100);
assert.strictEqual(c1Stats.earnedPoints, 50);
assert.strictEqual(c1Stats.progress, 50); // 1 tugas centang (50 poin) dari total 100 poin

// Ketika tugas kedua dicentang (progress: 100)
const updatedTasks = sampleTasks.map(t => t.courseId === "c1" ? { ...t, progress: 100 } : t);
const c1StatsFull = calculateCourseProgress(updatedTasks, "c1");
assert.strictEqual(c1StatsFull.progress, 100); // 100 / 100 = 100%

// 6. BR-13: Poin di-generate otomatis oleh sistem
const singleTask = [{ id: "t1", courseId: "c3" }];
const syncedSingle = syncTasksWithAutoPoints(singleTask);
assert.strictEqual(syncedSingle[0].points, 100, "1 tugas dalam matkul harus bernilai 100 poin");

const twoTasks = [
  { id: "t1", courseId: "c4" },
  { id: "t2", courseId: "c4" },
];
const syncedTwo = syncTasksWithAutoPoints(twoTasks);
assert.strictEqual(syncedTwo[0].points, 50, "2 tugas dalam matkul harus masing-masing 50 poin");
assert.strictEqual(syncedTwo[1].points, 50, "2 tugas dalam matkul harus masing-masing 50 poin");

const threeTasks = [
  { id: "t1", courseId: "c5" },
  { id: "t2", courseId: "c5" },
  { id: "t3", courseId: "c5" },
];
const syncedThree = syncTasksWithAutoPoints(threeTasks);
const totalThree = syncedThree.reduce((a, b) => a + b.points, 0);
assert.strictEqual(totalThree, 100, "Total 3 tugas harus tepat 100 poin (34 + 33 + 33)");

// 7. Validasi input
assert.strictEqual(validateTaskInput("", 50).valid, false, "Judul kosong harus ditolak");
assert.strictEqual(validateTaskInput("Judul Valid", -5).valid, false, "Progres negatif harus ditolak");
assert.strictEqual(validateTaskInput("Judul Valid", 105).valid, false, "Progres > 100 harus ditolak");
assert.strictEqual(validateTaskInput("Judul Valid", 50).valid, true, "Input valid harus diterima");

console.log("✅ Semua pengujian aturan bisnis (BR-01 s/d BR-13) LULUS dengan sempurna!");
