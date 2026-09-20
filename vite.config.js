import { defineConfig } from "vite";
export default defineConfig({
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
      "https://awloyxboctvggdjnpdji.supabase.co",
    ),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(
      "sb_publishable_2b7t1OjfMsiYKeaMQYldCA_feVYkGhH",
    ),
  },
});
