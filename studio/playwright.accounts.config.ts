import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests',testMatch:'accounts.spec.ts',workers:1,timeout:120000,reporter:'list',
  use:{baseURL:'http://127.0.0.1:8186',channel:'chrome',headless:true,viewport:{width:1400,height:1000},launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
  webServer:{command:`"${process.env.STUDIO_PYTHON||'python'}" ../server/studio_ui_fixture.py`,url:'http://127.0.0.1:8186/api/studio/status',reuseExistingServer:false,timeout:90000},
});
