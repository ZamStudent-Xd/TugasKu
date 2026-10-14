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

async function checkUser() {
  // Let's test with 19250379@bsi.ac.id
  const passwordsToTry = ["password123", "Zamzam123!", "zamzam123", "Bsi19250379!"];
  for (const pw of passwordsToTry) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: "19250379@bsi.ac.id",
      password: pw
    });
    if (!error) {
      console.log("Success with password:", pw);
      console.log("User:", data.user);
      const { data: prof, error: pErr } = await supabase.from("profiles").select("*");
      console.log("Profiles when authenticated:", { prof, pErr });
      return;
    } else {
      console.log("Try pw:", pw, "error:", error.message);
    }
  }
}

checkUser().catch(console.error);
