export const API_BASE = (process.env.NEXT_PUBLIC_PYRAIZ_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export type CurrentUser = {
  id: string;
  email: string;
  role: "student" | "admin";
};
