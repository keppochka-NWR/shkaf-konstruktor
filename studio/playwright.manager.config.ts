import {defineConfig} from '@playwright/test';
import rooms from './playwright.rooms.config';
export default defineConfig({...rooms,testMatch:['room-workspace.spec.ts','manager-workflow.spec.ts'],use:{...rooms.use,baseURL:process.env.ROOMS_TEST_URL||'http://127.0.0.1:5188'},timeout:60000});
