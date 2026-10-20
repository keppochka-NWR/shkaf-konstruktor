import {defineConfig} from '@playwright/test';
import rooms from './playwright.rooms.config';
// Ручная проверка материалов столешницы (19.10.2026): своя сборка vite на своём порту, системный Chrome.
export default defineConfig({...rooms,testMatch:['worktop-materials.spec.ts'],use:{...rooms.use,baseURL:process.env.WT_URL||'http://127.0.0.1:5291'},timeout:90000});
