import { Course, Task, UserProfile } from "@/types";

export const initialUser: UserProfile = {
  id: "user-empty",
  fullName: "Mahasiswa BSI",
  email: "mahasiswa@bsi.ac.id",
  nim: "",
  major: "Teknologi Informasi",
  semester: 1,
  campus: "Universitas BSI (Bina Sarana Informatika)",
  avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
};

export const initialCourses: Course[] = [];

export const initialTasks: Task[] = [];
