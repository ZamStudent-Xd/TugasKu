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

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log("Testing Supabase auth sign-in...");
  // Let's try signing in with test user or creating one
  const email = "teststudent@bsi.ac.id";
  const password = "password123";

  // Try sign in
  let { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) {
    console.log("Sign in error, trying sign up:", authError.message);
    const signUpRes = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: "Mahasiswa Uji",
          nim: "12345678",
          major: "Teknologi Informasi",
          semester: 3
        }
      }
    });
    console.log("Sign up result:", signUpRes.error ? signUpRes.error : "Sign up success! user id: " + signUpRes.data.user?.id);
    authData = signUpRes.data;
  } else {
    console.log("Signed in successfully! user id:", authData.user?.id);
  }

  // Now test select profiles with this client
  const { data: profiles, error: pErr } = await supabase.from("profiles").select("*");
  console.log("Profiles query:", { count: profiles?.length, error: pErr });

  const { data: courses, error: cErr } = await supabase.from("courses").select("*");
  console.log("Courses query:", { count: courses?.length, error: cErr });

  const { data: tasks, error: tErr } = await supabase.from("tasks").select("*");
  console.log("Tasks query:", { count: tasks?.length, error: tErr });
}

test().catch(console.error);
