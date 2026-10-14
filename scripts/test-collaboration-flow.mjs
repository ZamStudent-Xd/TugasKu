// Test script to verify collaboration search behavior and isolation flow

const BASE_URL = "http://localhost:3000";

async function runTests() {
  console.log("=== MEMULAI TEST ALUR KOLABORASI & PENCARIAN ===");

  const timestamp = Date.now();
  const userA = {
    id: `user-a-${timestamp}`,
    email: `usera_${timestamp}@bsi.ac.id`,
    fullName: `User A ${timestamp}`,
    nim: `12210001`,
  };

  const userB = {
    id: `user-b-${timestamp}`,
    email: `userb_${timestamp}@bsi.ac.id`,
    fullName: `User B ${timestamp}`,
    nim: `12210002`,
  };

  // 1. Daftarkan User A dan User B ke server DB
  console.log("\n1. Mendaftarkan User A dan User B...");
  await fetch(`${BASE_URL}/api/db/students`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ student: userA }),
  });
  await fetch(`${BASE_URL}/api/db/students`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ student: userB }),
  });
  console.log("-> Mahasiswa A & B terdaftar di DB server.");

  // 2. Test pencarian mahasiswa:
  console.log("\n2. Test pencarian mahasiswa:");
  // Jika query kosong:
  const searchEmptyRes = await fetch(`${BASE_URL}/api/db/students?search=`);
  const searchEmptyData = await searchEmptyRes.json();
  console.log(`-> Hasil pencarian query kosong: ${searchEmptyData.students.length} mahasiswa.`);
  if (searchEmptyData.students.length !== 0) {
    throw new Error("FAIL: Pencarian query kosong mengembalikan mahasiswa padahal seharusnya kosong!");
  }
  console.log("-> [PASS] Kolom pencarian kosong tidak menampilkan mahasiswa apa pun!");

  // Jika query 1 karakter:
  const searchCharRes = await fetch(`${BASE_URL}/api/db/students?search=${userB.fullName[0]}`);
  const searchCharData = await searchCharRes.json();
  const foundUserB = searchCharData.students.some((s) => s.email === userB.email);
  if (!foundUserB) {
    throw new Error("FAIL: Pencarian 1 karakter tidak menemukan user B!");
  }
  console.log(`-> [PASS] Pencarian 1 karakter ('${userB.fullName[0]}') berhasil menemukan ${userB.fullName}!`);

  // 3. User A membuat mata kuliah & tugas kelompok
  console.log("\n3. User A membuat mata kuliah & tugas kelompok...");
  const courseA = {
    id: `course-${timestamp}`,
    name: "Struktur Data & Algoritma",
    lecturer: "Dr. Budi Santoso",
    code: "SDA-101",
    color: "indigo",
    ownerId: userA.id,
    createdAt: new Date().toISOString(),
  };
  await fetch(`${BASE_URL}/api/db/courses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ course: courseA }),
  });

  const taskA = {
    id: `task-${timestamp}`,
    courseId: courseA.id,
    title: "Proyek Sistem Antrian Bank",
    description: "Tugas kelompok kolaboratif",
    taskType: "Kelompok",
    progress: 0,
    points: 100,
    deadline: new Date(Date.now() + 86400000 * 3).toISOString(),
    createdBy: userA.id,
    createdAt: new Date().toISOString(),
    members: [{
      userId: userA.id,
      fullName: userA.fullName,
      role: "owner",
      joinedAt: new Date().toISOString(),
    }],
  };
  await fetch(`${BASE_URL}/api/db/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: taskA }),
  });
  console.log("-> Mata kuliah dan tugas dibuat oleh User A.");

  // 4. Verifikasi bahwa User B BELUM melihat tugas maupun mata kuliah User A
  console.log("\n4. Verifikasi isolasi data User B sebelum di-invite:");
  const tasksBeforeRes = await fetch(`${BASE_URL}/api/db/tasks?email=${encodeURIComponent(userB.email)}`);
  const tasksBefore = await tasksBeforeRes.json();
  const hasTaskBefore = tasksBefore.tasks.some((t) => t.id === taskA.id);

  const coursesBeforeRes = await fetch(`${BASE_URL}/api/db/courses?email=${encodeURIComponent(userB.email)}`);
  const coursesBefore = await coursesBeforeRes.json();
  const hasCourseBefore = coursesBefore.courses.some((c) => c.id === courseA.id);

  if (hasTaskBefore || hasCourseBefore) {
    throw new Error("FAIL: User B sudah melihat data tugas/matakuliah sebelum di-invite!");
  }
  console.log("-> [PASS] User B tidak melihat tugas atau mata kuliah User A.");

  // 5. User A mengundang User B ke tugas kelompok
  console.log("\n5. User A mengirimkan undangan ke User B...");
  const invitation = {
    id: `inv-${timestamp}`,
    taskId: taskA.id,
    taskTitle: taskA.title,
    courseName: courseA.name,
    invitedEmail: userB.email,
    tokenHash: `tk-${taskA.id.slice(-6)}`,
    status: "pending",
    expiresAt: new Date(Date.now() + 86400000 * 7).toISOString(),
    invitedBy: userA.id,
    inviterName: userA.fullName,
    createdAt: new Date().toISOString(),
  };
  await fetch(`${BASE_URL}/api/db/invitations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invitation }),
  });
  console.log("-> Undangan berhasil dikirim.");

  // 6. Verifikasi bahwa setelah di-invite TAPI BELUM DITERIMA, User B MASIH TIDAK melihat tugas atau mata kuliah!
  console.log("\n6. Verifikasi isolasi data User B setelah di-invite (status pending, belum diterima):");
  const tasksPendingRes = await fetch(`${BASE_URL}/api/db/tasks?email=${encodeURIComponent(userB.email)}`);
  const tasksPending = await tasksPendingRes.json();
  const hasTaskPending = tasksPending.tasks.some((t) => t.id === taskA.id);

  const coursesPendingRes = await fetch(`${BASE_URL}/api/db/courses?email=${encodeURIComponent(userB.email)}`);
  const coursesPending = await coursesPendingRes.json();
  const hasCoursePending = coursesPending.courses.some((c) => c.id === courseA.id);

  if (hasTaskPending || hasCoursePending) {
    throw new Error("FAIL: Tugas atau matakuliah bocor ke User B sebelum undangan diterima!");
  }
  console.log("-> [PASS] User B MASIH BELUM memiliki tugas atau mata kuliah sebelum mengklik Terima!");

  // Undangan User B muncul di notifikasi User B
  const invRes = await fetch(`${BASE_URL}/api/db/invitations?email=${encodeURIComponent(userB.email)}`);
  const invData = await invRes.json();
  const foundInv = invData.invitations.find((i) => i.id === invitation.id);
  if (!foundInv || foundInv.status !== "pending") {
    throw new Error("FAIL: Undangan tidak muncul di notifikasi User B!");
  }
  console.log("-> [PASS] Undangan muncul di daftar notifikasi User B.");

  // 7. User B menerima undangan (Accept Invitation)
  console.log("\n7. User B menerima undangan kolaborasi...");
  // Panggil endpoint atomic PUT /api/db/invitations seperti halnya acceptTaskInvitation
  const acceptRes = await fetch(`${BASE_URL}/api/db/invitations`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invitationId: invitation.id, status: "accepted", user: userB }),
  });
  const acceptData = await acceptRes.json();
  if (!acceptData.success || !acceptData.task) {
    throw new Error("FAIL: Server gagal memproses acceptTaskInvitation secara atomik!");
  }
  console.log("-> Undangan diterima, server otomatis menambahkan User B ke anggota tugas dan mengaktifkan mata kuliah.");

  // 8. Verifikasi bahwa SETELAH DITERIMA, User B SEKARANG memiliki tugas dan mata kuliah!
  console.log("\n8. Verifikasi bahwa User B sekarang memiliki tugas dan mata kuliah setelah diterima:");
  const tasksAfterRes = await fetch(`${BASE_URL}/api/db/tasks?email=${encodeURIComponent(userB.email)}`);
  const tasksAfter = await tasksAfterRes.json();
  const hasTaskAfter = tasksAfter.tasks.some((t) => t.id === taskA.id);

  const coursesAfterRes = await fetch(`${BASE_URL}/api/db/courses?email=${encodeURIComponent(userB.email)}`);
  const coursesAfter = await coursesAfterRes.json();
  const hasCourseAfter = coursesAfter.courses.some((c) => c.name.toLowerCase().trim() === courseA.name.toLowerCase().trim());

  if (!hasTaskAfter || !hasCourseAfter) {
    throw new Error("FAIL: Setelah diterima, tugas atau mata kuliah belum muncul di User B!");
  }
  console.log("-> [PASS] Berhasil! Tugas dan mata kuliah sekarang resmi muncul di akun User B setelah diterima.");

  // 9. TEST: Larangan Duplikasi Nama Mata Kuliah
  console.log("\n9. Test larangan duplikasi nama mata kuliah:");
  const duplicateCourseAttempt = {
    id: `course-dup-${timestamp}`,
    name: "  struktur data & ALGORITMA  ",
    lecturer: "Dosen Lain",
    code: "SDA-999",
    color: "pink",
    ownerId: userA.id,
  };
  const dupRes = await fetch(`${BASE_URL}/api/db/courses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ course: duplicateCourseAttempt }),
  });
  const dupData = await dupRes.json();
  if (dupRes.status !== 400 || dupData.success) {
    throw new Error("FAIL: Server mengizinkan pembuatan mata kuliah dengan nama yang sama!");
  }
  console.log(`-> [PASS] Pembuatan nama mata kuliah duplikat berhasil ditolak: "${dupData.error}"`);

  // 10. TEST: Kolaborasi Pengguna yang SUDAH MEMILIKI Mata Kuliah yang Sama
  console.log("\n10. Test kolaborasi dengan pengguna yang sudah memiliki mata kuliah yang sama:");
  const userC = {
    id: `user-c-${timestamp}`,
    email: `userc_${timestamp}@bsi.ac.id`,
    fullName: `User C ${timestamp}`,
    nim: `12210003`,
  };
  await fetch(`${BASE_URL}/api/db/students`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ student: userC }),
  });

  // User C membuat mata kuliah bernama "Struktur Data & Algoritma" sendiri lebih dahulu
  const courseC = {
    id: `course-c-${timestamp}`,
    name: "Struktur Data & Algoritma",
    lecturer: "Prof. Hendra",
    code: "SDA-C",
    color: "violet",
    ownerId: userC.id,
  };
  await fetch(`${BASE_URL}/api/db/courses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ course: courseC }),
  });

  // User A mengundang User C ke taskA
  const invC = {
    id: `inv-c-${timestamp}`,
    taskId: taskA.id,
    taskTitle: taskA.title,
    courseName: courseA.name,
    invitedEmail: userC.email,
    tokenHash: `tk-c-${taskA.id.slice(-6)}`,
    status: "pending",
    expiresAt: new Date(Date.now() + 86400000 * 7).toISOString(),
    invitedBy: userA.id,
    inviterName: userA.fullName,
    createdAt: new Date().toISOString(),
  };
  await fetch(`${BASE_URL}/api/db/invitations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invitation: invC }),
  });

  // User C menerima undangan
  const acceptCRes = await fetch(`${BASE_URL}/api/db/invitations`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invitationId: invC.id, status: "accepted", user: userC }),
  });
  const acceptCData = await acceptCRes.json();
  if (!acceptCData.success) {
    throw new Error("FAIL: User C gagal menerima undangan!");
  }

  // Verifikasi daftar mata kuliah User C: TIDAK BOLEH ADA DUPLIKAT!
  const coursesCRes = await fetch(`${BASE_URL}/api/db/courses?email=${encodeURIComponent(userC.email)}`);
  const coursesCData = await coursesCRes.json();
  const sdaCoursesC = coursesCData.courses.filter((c) => c.name.toLowerCase().trim() === "struktur data & algoritma");
  if (sdaCoursesC.length !== 1) {
    throw new Error(`FAIL: User C memiliki ${sdaCoursesC.length} mata kuliah dengan nama sama, seharusnya tepat 1!`);
  }
  console.log(`-> [PASS] User C hanya memiliki 1 mata kuliah "Struktur Data & Algoritma" (tidak terjadi duplikasi!).`);

  // Verifikasi tugas kolaborasi masuk ke User C
  const tasksCRes = await fetch(`${BASE_URL}/api/db/tasks?email=${encodeURIComponent(userC.email)}`);
  const tasksCData = await tasksCRes.json();
  const taskCFound = tasksCData.tasks.some((t) => t.id === taskA.id);
  if (!taskCFound) {
    throw new Error("FAIL: Tugas kolaborasi tidak masuk ke akun User C!");
  }
  console.log("-> [PASS] Tugas kolaborasi berhasil masuk ke akun User C dan disematkan ke mata kuliah yang sama!");

  // 11. TEST: Pencabutan Kolaborasi (Mata kuliah TIDAK terhapus, hanya tugas kolaborasi yang terhapus)
  console.log("\n11. Test pencabutan kolaborasi oleh pemilik tugas:");
  // Pemilik (User A) mengeluarkan User B dari taskA
  const getTaskLatest = await (await fetch(`${BASE_URL}/api/db/tasks?email=${encodeURIComponent(userA.email)}`)).json();
  const targetTask = getTaskLatest.tasks.find((t) => t.id === taskA.id);
  const updatedMembers = targetTask.members.filter((m) => m.userId !== userB.id);

  const revokeRes = await fetch(`${BASE_URL}/api/db/tasks`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId: taskA.id, updates: { members: updatedMembers } }),
  });
  const revokeData = await revokeRes.json();
  if (!revokeData.success) {
    throw new Error("FAIL: Gagal memperbarui anggota tugas saat pencabutan!");
  }
  console.log("-> User B berhasil dikeluarkan dari kelompok oleh pemilik tugas.");

  // Verifikasi akun User B setelah kolaborasi dicabut:
  // a. Tugas kolaborasi HARUS terhapus dari User B
  const tasksBAfterRevokeRes = await fetch(`${BASE_URL}/api/db/tasks?email=${encodeURIComponent(userB.email)}`);
  const tasksBAfterRevoke = await tasksBAfterRevokeRes.json();
  const isTaskStillInB = tasksBAfterRevoke.tasks.some((t) => t.id === taskA.id);
  if (isTaskStillInB) {
    throw new Error("FAIL: Tugas kolaborasi masih muncul di User B padahal sudah dicabut!");
  }
  console.log("-> [PASS] Tugas kolaborasi berhasil TERHAPUS dari akun User B!");

  // b. Mata kuliah User B TIDAK BOLEH terhapus!
  const coursesBAfterRevokeRes = await fetch(`${BASE_URL}/api/db/courses?email=${encodeURIComponent(userB.email)}`);
  const coursesBAfterRevoke = await coursesBAfterRevokeRes.json();
  const isCourseStillInB = coursesBAfterRevoke.courses.some((c) => c.name.toLowerCase().trim() === "struktur data & algoritma");
  if (!isCourseStillInB) {
    throw new Error("FAIL: Mata kuliah terhapus dari User B saat kolaborasi dicabut, padahal seharusnya tetap ada!");
  }
  console.log("-> [PASS] Mata kuliah 'Struktur Data & Algoritma' TETAP ADA di akun User B (tidak terhapus)!");

  // 12. TEST: Anggota Kolaborasi menghapus mata kuliah yang berisi tugas kolaborasi
  console.log("\n12. Test anggota kolaborasi (User C) menghapus mata kuliah yang berisi tugas kolaborasi:");
  const userCCourse = sdaCoursesC[0];
  const deleteCourseCRes = await fetch(
    `${BASE_URL}/api/db/courses?id=${userCCourse.id}&userId=${encodeURIComponent(userC.id)}&email=${encodeURIComponent(userC.email)}`,
    { method: "DELETE" }
  );
  const deleteCourseCData = await deleteCourseCRes.json();
  if (!deleteCourseCData.success) {
    throw new Error("FAIL: User C gagal menghapus mata kuliah!");
  }
  console.log("-> Mata kuliah User C berhasil dihapus dari server.");

  // Verifikasi akun User C:
  // a. Mata kuliah User C sudah terhapus
  const coursesCAfterDel = await (await fetch(`${BASE_URL}/api/db/courses?email=${encodeURIComponent(userC.email)}`)).json();
  const hasCourseInC = coursesCAfterDel.courses.some((c) => c.id === userCCourse.id);
  if (hasCourseInC) {
    throw new Error("FAIL: Mata kuliah masih ada di akun User C setelah dihapus!");
  }
  console.log("-> [PASS] Mata kuliah berhasil terhapus dari akun User C.");

  // b. Tugas kolaborasi terlepas / terhapus dari akun User C
  const tasksCAfterDel = await (await fetch(`${BASE_URL}/api/db/tasks?email=${encodeURIComponent(userC.email)}`)).json();
  const hasTaskInC = tasksCAfterDel.tasks.some((t) => t.id === taskA.id);
  if (hasTaskInC) {
    throw new Error("FAIL: Tugas kolaborasi masih muncul di User C padahal mata kuliah sudah dihapus!");
  }
  console.log("-> [PASS] Tugas kolaborasi berhasil terlepas dan tidak lagi muncul di akun User C.");

  // c. Tugas kolaborasi TETAP ADA di Ketua Kolaborasi (User A)
  const tasksAAfterDel = await (await fetch(`${BASE_URL}/api/db/tasks?email=${encodeURIComponent(userA.email)}`)).json();
  const taskAStillInA = tasksAAfterDel.tasks.find((t) => t.id === taskA.id);
  if (!taskAStillInA) {
    throw new Error("FAIL: Tugas kolaborasi ikut terhapus di akun Ketua Kolaborasi (User A)!");
  }
  console.log("-> [PASS] Tugas kolaborasi TETAP ADA di akun Ketua Kolaborasi (User A)!");

  // d. User C telah otomatis terlepas dari taskA.members
  const isCStillInMembers = taskAStillInA.members.some((m) => m.userId === userC.id || m.email === userC.email);
  if (isCStillInMembers) {
    throw new Error("FAIL: User C belum terlepas dari task.members!");
  }
  console.log("-> [PASS] User C otomatis terlepas dari daftar anggota kolaborasi di tugas tersebut!");

  console.log("\n=========================================================================");
  console.log("SEMUA PENGUJIAN KOLABORASI, HAPUS MATKUL & ISOLASI DATA 100% SUKSES!");
  console.log("=========================================================================");
}

runTests().catch((err) => {
  console.error("\nTEST GAGAL:", err.message);
  process.exit(1);
});
