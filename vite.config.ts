import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  base: '/lit-timesheet/',
  build: {
    lib: {
      entry: "src/lit-timesheet.ts",
      formats: ["es"],
    },
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
      },
    },
  },
});