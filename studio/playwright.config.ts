import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "*.spec.ts",
  use: {
    baseURL: "http://127.0.0.1:8103",
    channel: "chrome",
    headless: true,
    viewport: { width: 1400, height: 860 },
    launchOptions: {
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  workers: 1,
  reporter: "list",
});
