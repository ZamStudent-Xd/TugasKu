import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
let supabaseUrl = "";
let supabaseAnonKey = "";

for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (trimmed.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) {
    supabaseUrl = trimmed.split("=")[1].trim();
  } else if (trimmed.startsWith("NEXT_PUBLIC_SUPABASE_ANON_KEY=")) {
    supabaseAnonKey = trimmed.split("=")[1].trim();
  }
}

console.log("Supabase URL:", supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data: profiles, error: pErr } = await supabase.from("profiles").select("*");
  console.log("Profiles count:", profiles?.length, "Error:", pErr);
  if (profiles?.length) {
    console.log("Profiles in DB:", profiles.map(p => ({ id: p.id, name: p.full_name, email: p.email, nim: p.nim })));
  }

  const { data: courses, error: cErr } = await supabase.from("courses").select("*");
  console.log("Courses count:", courses?.length, "Error:", cErr);
  if (courses?.length) {
    console.log("Courses in DB:", courses.map(c => ({ id: c.id, name: c.name, code: c.code })));
  }

  const { data: tasks, error: tErr } = await supabase.from("tasks").select("*");
  console.log("Tasks count:", tasks?.length, "Error:", tErr);
  if (tasks?.length) {
    console.log("Tasks in DB:", tasks.map(t => ({ id: t.id, title: t.title, progress: t.progress })));
  }

  const { data: taskMembers, error: mErr } = await supabase.from("task_members").select("*");
  console.log("Task members count:", taskMembers?.length, "Error:", mErr);
}

main().catch(console.error);
