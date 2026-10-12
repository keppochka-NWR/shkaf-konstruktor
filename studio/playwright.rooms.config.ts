import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests',testMatch:'room-workspace.spec.ts',workers:1,reporter:'list',
  use:{baseURL:process.env.ROOMS_TEST_URL || 'http://127.0.0.1:5185',channel:'chrome',headless:true,viewport:{width:1600,height:1000},
    launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']},screenshot:'only-on-failure'},
});
