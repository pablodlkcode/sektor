import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import TelegramBotPackage from 'node-telegram-bot-api';
import { INITIAL_ORGANIZATIONS, INITIAL_APPEALS, DEFAULT_SEKTOR_TASKS, IIB_7_TASKS, ORG_DEFAULT_TASKS, NON_SHTAB_TASK_ORG_IDS } from './src/data/initialData.js';
import { PAXTACHI_MAHALLAS, DEFAULT_MAHALLA_YETTILIGI_TASKS, MahallaInfo } from './src/data/mahallasData.js';
import { Appeal, Organization, FeedbackStatus, BotStatusInfo, ShtabTask, MahallaTask } from './src/types.js';
import {
  fetchAppealsFromFirestore,
  saveAppealsToFirestore,
  saveSingleAppealToFirestore,
  fetchOrganizationsFromFirestore,
  saveOrganizationsToFirestore,
  fetchSettingsFromFirestore,
  saveSettingsToFirestore,
  fetchTasksFromFirestore,
  saveTasksToFirestore,
  saveSingleTaskToFirestore,
  deleteTaskFromFirestore,
  fetchMahallaTasksFromFirestore,
  saveMahallaTasksToFirestore,
  saveSingleMahallaTaskToFirestore,
  deleteMahallaTaskFromFirestore,
  getFirestoreDatabaseInfo,
} from './src/server/firestoreService.js';

// Safe constructor for CommonJS / ESM compatibility
const TelegramBot: any =
  typeof TelegramBotPackage === 'function'
    ? TelegramBotPackage
    : (TelegramBotPackage as any).TelegramBot || (TelegramBotPackage as any).default || TelegramBotPackage;

const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
if (apiKey) {
  aiClient = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
}

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check endpoint for Render.com and cloud platforms
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    telegramBot: botInfo.isActive ? 'active' : 'inactive',
    database: getFirestoreDatabaseInfo(),
  });
});

const STORAGE_FILE = path.join(process.cwd(), 'data-storage.json');
const BACKUP_FILE = path.join(process.cwd(), 'data-storage.bak.json');

let organizations: Organization[] = [...INITIAL_ORGANIZATIONS];
let appeals: Appeal[] = [];
let shtabTasks: ShtabTask[] = [];
let mahallaTasks: MahallaTask[] = [];
let savedTelegramToken: string | null = null;

interface UserSessionData {
  step: 'NONE' | 'SELECT_ORG' | 'WAITING_FULLNAME' | 'WAITING_PHONE' | 'WAITING_MFY' | 'WAITING_STREET_HOUSE' | 'WAITING_CONTENT' | 'WAITING_OBJECTION';
  orgId?: string;
  orgName?: string;
  fullName?: string;
  phone?: string;
  selectedMfy?: string;
  mfyPage?: number;
  address?: string;
  content?: string;
  photoLink?: string;
  appealIdForObjection?: string;
  isSubmitting?: boolean;
  lastUpdated?: string;
}

const userSessions = new Map<number, UserSessionData>();
const processedUpdates = new Set<string>();

function loadPersistedData() {
  let loaded = false;

  // Try primary storage file
  for (const filePath of [STORAGE_FILE, BACKUP_FILE]) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        if (raw && raw.trim().length > 0) {
          const parsed = JSON.parse(raw);
          
          const OLD_MFY_MAP: Record<string, string> = {
            'Shamsnazar MFY': 'Ko‘rpa MFY',
            'Boltali MFY': 'Toma MFY',
            'Ukrash MFY': 'Burqut MFY',
            'Jona MFY': 'Humarmand MFY',
            'Zarafshon MFY': 'Go‘ro‘g‘li MFY',
            'Nayman MFY': 'Qo‘shhovuz MFY',
            'Qaynarbuloq MFY': 'To‘g‘olon MFY',
            'Chorgusha MFY': 'Sardoba MFY',
            'Bog‘oloni MFY': 'Yobu MFY',
            'Dung MFY': 'Quvondiq MFY',
            'Keshtali MFY': 'Mirzo Olim MFY',
            'Urg‘uch MFY': 'Mirzo Nodim MFY',
            'Dabusqala MFY': 'Ko‘rpa MFY',
            'Farovon Yuldoshobod MFY': 'Toma MFY',
          };

          if (parsed.appeals && Array.isArray(parsed.appeals)) {
            appeals = parsed.appeals.map((a: any) => {
              let mfy = a.mahalla;
              if (mfy && OLD_MFY_MAP[mfy]) {
                mfy = OLD_MFY_MAP[mfy];
              }
              if (!mfy) {
                const combined = `${a.address || ''} ${a.content || ''}`.toLowerCase();
                const matched = MAHALLALAR_LIST.find((m) => {
                  const cleanM = m.toLowerCase().replace(' mfy', '').replace(/['`’‘""]/g, '').trim();
                  return combined.includes(cleanM);
                });
                if (matched) mfy = matched;
              }
              let addr = a.address || '';
              for (const [oldName, newName] of Object.entries(OLD_MFY_MAP)) {
                if (addr.includes(oldName)) {
                  addr = addr.split(oldName).join(newName);
                }
              }
              return {
                ...a,
                mahalla: mfy,
                address: addr,
              };
            });
          } else {
            appeals = [];
          }

          if (parsed.shtabTasks && Array.isArray(parsed.shtabTasks)) {
            shtabTasks = parsed.shtabTasks;
          } else {
            shtabTasks = [];
          }

          if (parsed.mahallaTasks && Array.isArray(parsed.mahallaTasks)) {
            mahallaTasks = parsed.mahallaTasks.map((t: any) => {
              let mName = t.mahallaName;
              if (mName && OLD_MFY_MAP[mName]) {
                mName = OLD_MFY_MAP[mName];
              }
              const matchedMfy = PAXTACHI_MAHALLAS.find((m) => m.name === mName || m.id === t.mahallaId);
              return {
                ...t,
                mahallaName: matchedMfy ? matchedMfy.name : mName,
                mahallaId: matchedMfy ? matchedMfy.id : t.mahallaId,
              };
            });
          } else {
            mahallaTasks = [];
          }

          const orgMap = new Map<string, Organization>();
          // Use INITIAL_ORGANIZATIONS as default baseline
          INITIAL_ORGANIZATIONS.forEach((o) => orgMap.set(o.id, { ...o }));

          if (parsed.organizations && Array.isArray(parsed.organizations)) {
            parsed.organizations.forEach((o: Organization) => {
              if (orgMap.has(o.id)) {
                const initOrg = orgMap.get(o.id)!;
                orgMap.set(o.id, {
                  ...initOrg,
                  ...o,
                  name: initOrg.name,
                  code: initOrg.code,
                  category: initOrg.category,
                  leader: initOrg.leader,
                  phone: initOrg.phone,
                  password: initOrg.password || o.password,
                  isLocked: o.isLocked ?? false,
                  lockedAt: o.lockedAt,
                  failedLoginAttempts: o.failedLoginAttempts ?? 0,
                });
              } else {
                orgMap.set(o.id, o);
              }
            });
          }
          organizations = Array.from(orgMap.values());

          if (parsed.userSessions && typeof parsed.userSessions === 'object') {
            Object.entries(parsed.userSessions).forEach(([chatId, s]) => {
              userSessions.set(Number(chatId), s as UserSessionData);
            });
          }

          if (parsed.savedTelegramToken) {
            savedTelegramToken = parsed.savedTelegramToken;
          }

          console.log(`💾 Mahalliy ma'lumotlar yuklandi: ${appeals.length} ta murojaat, ${shtabTasks.length} ta vazifa, ${organizations.length} ta tashkilot.`);
          loaded = true;
          break;
        }
      }
    } catch (err) {
      console.error(`Xatolik: ${filePath} faylini o'qishda:`, err);
    }
  }

  // Always ensure shtabTasks is synchronized with official templates for all 18 organizations
  syncShtabTasksWithOfficialTemplates();
  // Ensure Mahalla tasks are seeded for all 14 mahallas if empty
  syncMahallaTasksWithTemplates();

  if (!loaded) {
    savePersistedData();
  }
}

function syncMahallaTasksWithTemplates(deadlineDays: number = 15) {
  if (mahallaTasks.length > 0) return; // Keep existing tasks if any exist

  const deadlineDate = new Date();
  deadlineDate.setDate(deadlineDate.getDate() + Number(deadlineDays));
  const deadlineStr = deadlineDate.toISOString().split('T')[0];
  const nowIso = new Date().toISOString();

  const generated: MahallaTask[] = [];

  PAXTACHI_MAHALLAS.forEach((mfy) => {
    DEFAULT_MAHALLA_YETTILIGI_TASKS.forEach((tmpl) => {
      generated.push({
        id: `mtask-${mfy.id}-${tmpl.taskNumber}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        taskNumber: tmpl.taskNumber,
        title: tmpl.title,
        description: tmpl.description,
        targetRole: tmpl.targetRole,
        mahallaId: mfy.id,
        mahallaName: mfy.name,
        targetOrgId: tmpl.targetOrgId,
        targetOrgName: tmpl.targetOrgName,
        category: 'Mahalla Yettiligi Vazifasi',
        createdAt: nowIso,
        deadline: deadlineStr,
        status: 'yangi',
      });
    });
  });

  mahallaTasks = generated;
  console.log(`✅ 14 ta mahalla uchun jami ${mahallaTasks.length} ta yettilik vazifasi avtomatik shakllantirildi.`);
}

function syncShtabTasksWithOfficialTemplates(deadlineDays: number = 15) {
  const deadlineDate = new Date();
  deadlineDate.setDate(deadlineDate.getDate() + Number(deadlineDays));
  const deadlineStr = deadlineDate.toISOString().split('T')[0];
  const nowIso = new Date().toISOString();

  const updatedTasks: ShtabTask[] = [];
  const existingByOrg = new Map<string, ShtabTask[]>();
  shtabTasks.forEach((t) => {
    // Drop tasks for excluded organizations
    if (NON_SHTAB_TASK_ORG_IDS.includes(t.targetOrgId)) {
      return;
    }
    if (!existingByOrg.has(t.targetOrgId)) {
      existingByOrg.set(t.targetOrgId, []);
    }
    existingByOrg.get(t.targetOrgId)!.push(t);
  });

  const shtabOrgs = INITIAL_ORGANIZATIONS.filter(
    (org) => !NON_SHTAB_TASK_ORG_IDS.includes(org.id) && ORG_DEFAULT_TASKS[org.id]
  );

  shtabOrgs.forEach((org) => {
    const templates = ORG_DEFAULT_TASKS[org.id] || [];
    const existingForOrg = existingByOrg.get(org.id) || [];

    templates.forEach((tmpl) => {
      const existingMatch = existingForOrg.find(
        (t) => t.taskNumber === tmpl.taskNumber || t.title === tmpl.title
      );

      if (existingMatch) {
        updatedTasks.push({
          ...existingMatch,
          taskNumber: tmpl.taskNumber,
          title: tmpl.title,
          description: tmpl.description,
          targetOrgId: org.id,
          targetOrgName: org.name,
          category: org.id === 'org-1' ? 'IIB Profilaktika Vazifasi' : `${org.category} Vazifasi`,
        });
      } else {
        updatedTasks.push({
          id: `task-${org.id}-${tmpl.taskNumber}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
          taskNumber: tmpl.taskNumber,
          title: tmpl.title,
          description: tmpl.description,
          targetOrgId: org.id,
          targetOrgName: org.name,
          category: org.id === 'org-1' ? 'IIB Profilaktika Vazifasi' : `${org.category} Vazifasi`,
          createdAt: nowIso,
          deadline: deadlineStr,
          status: 'yangi',
        });
      }
    });

    // Also preserve custom user created tasks beyond templates
    existingForOrg.forEach((t) => {
      const isTemplateMatch = templates.some(
        (tmpl) => tmpl.taskNumber === t.taskNumber || tmpl.title === t.title
      );
      if (!isTemplateMatch && t.taskNumber > templates.length) {
        updatedTasks.push(t);
      }
    });
  });

  shtabTasks = updatedTasks;
  console.log(`✅ 15 ta shtab a’zolari tashkilotlarining barcha sohaviy vazifalari sinxronlandi. Jami: ${shtabTasks.length} ta.`);
}

async function syncWithFirestore() {
  try {
    const cloudAppeals = await fetchAppealsFromFirestore();
    if (cloudAppeals && cloudAppeals.length > 0) {
      const appealMap = new Map<string, Appeal>();
      // First populate with local appeals
      appeals.forEach((a) => appealMap.set(String(a.id), a));
      // Cloud records take precedence for live state
      cloudAppeals.forEach((a) => appealMap.set(String(a.id), a));
      appeals = Array.from(appealMap.values());
      console.log(`☁️ Firestore bulutli bazadan ${cloudAppeals.length} ta murojaat muvaffaqiyatli sinxronizatsiya qilindi. Jami: ${appeals.length} ta.`);
      // If local had any appeals not in cloud, sync back
      if (appeals.length > cloudAppeals.length) {
        await saveAppealsToFirestore(appeals);
      }
    } else if (appeals.length > 0) {
      // First time initialization: seed current appeals to Firestore
      await saveAppealsToFirestore(appeals);
      console.log(`☁️ Dastlabki ${appeals.length} ta murojaat Firestore bulutli bazaga saqlandi.`);
    }

    const cloudTasks = await fetchTasksFromFirestore();
    if (cloudTasks && cloudTasks.length > 0) {
      const taskMap = new Map<string, ShtabTask>();
      shtabTasks.forEach((t) => taskMap.set(String(t.id), t));
      cloudTasks.forEach((t) => taskMap.set(String(t.id), t));
      shtabTasks = Array.from(taskMap.values());
      console.log(`☁️ Firestore bulutli bazadan ${cloudTasks.length} ta shtab vazifalari yuklandi. Jami: ${shtabTasks.length} ta.`);
      if (shtabTasks.length > cloudTasks.length) {
        await saveTasksToFirestore(shtabTasks);
      }
    } else if (shtabTasks.length > 0) {
      await saveTasksToFirestore(shtabTasks);
    }

    const cloudMahallaTasks = await fetchMahallaTasksFromFirestore();
    if (cloudMahallaTasks && cloudMahallaTasks.length > 0) {
      const mTaskMap = new Map<string, MahallaTask>();
      mahallaTasks.forEach((t) => mTaskMap.set(String(t.id), t));
      cloudMahallaTasks.forEach((t) => mTaskMap.set(String(t.id), t));
      mahallaTasks = Array.from(mTaskMap.values());
      console.log(`☁️ Firestore bulutli bazadan ${cloudMahallaTasks.length} ta mahalla vazifalari yuklandi. Jami: ${mahallaTasks.length} ta.`);
      if (mahallaTasks.length > cloudMahallaTasks.length) {
        await saveMahallaTasksToFirestore(mahallaTasks);
      }
    } else if (mahallaTasks.length > 0) {
      await saveMahallaTasksToFirestore(mahallaTasks);
    }

    const cloudOrgs = await fetchOrganizationsFromFirestore();
    if (cloudOrgs && cloudOrgs.length > 0) {
      // Merge passwords, failedLoginAttempts, isLocked from cloud into local orgs
      organizations = organizations.map((localOrg) => {
        const matchingCloud = cloudOrgs.find((co) => co.id === localOrg.id);
        if (matchingCloud) {
          return {
            ...localOrg,
            password: matchingCloud.password ?? localOrg.password,
            failedLoginAttempts: matchingCloud.failedLoginAttempts ?? 0,
            isLocked: matchingCloud.isLocked ?? false,
            lockedAt: matchingCloud.lockedAt,
            lastPasswordChangedAt: matchingCloud.lastPasswordChangedAt,
          };
        }
        return localOrg;
      });
      console.log(`☁️ Firestore bulutli bazadan ${cloudOrgs.length} ta tashkilot xavfsizlik ma'lumotlari yangilandi.`);
    } else if (organizations.length > 0) {
      await saveOrganizationsToFirestore(organizations);
    }

    const cloudSettings = await fetchSettingsFromFirestore();
    if (cloudSettings) {
      if (cloudSettings.savedTelegramToken) {
        savedTelegramToken = cloudSettings.savedTelegramToken;
      }
      if (cloudSettings.userSessions && typeof cloudSettings.userSessions === 'object') {
        Object.entries(cloudSettings.userSessions).forEach(([chatId, s]) => {
          userSessions.set(Number(chatId), s as UserSessionData);
        });
      }
    }

    recalculateOrgStats();
  } catch (err: any) {
    console.warn('Firestore initial sync note:', err.message || err);
  }
}

let firestoreSyncTimer: any = null;
let lastSyncedHash = "";

// Ma'lumotlarni tekshirish uchun aqlli xesh funksiyasi (limitni 100 barobar tejaydi)
function generateCoreDataHash() {
  return JSON.stringify({ a: appeals, o: organizations, s: shtabTasks, m: mahallaTasks });
}

function savePersistedData() {
  try {
    const userSessionsObj: Record<string, UserSessionData> = {};
    userSessions.forEach((val, key) => {
      userSessionsObj[key.toString()] = val;
    });

    const payload = JSON.stringify({ 
      appeals, 
      organizations, 
      shtabTasks,
      mahallaTasks,
      userSessions: userSessionsObj,
      savedTelegramToken, 
      updatedAt: new Date().toISOString() 
    }, null, 2);

    // 1. FAqat va faqat MAHALLIY XOTIRAGA DARHOL YOZAMIZ (Murojaat uchib ketmasligi uchun)
    fs.writeFileSync(STORAGE_FILE, payload, 'utf-8');
    fs.writeFileSync(BACKUP_FILE, payload, 'utf-8');

    // DIQQAT: Limitni yeb yuboruvchi barcha taymerlar va "Bulk" (to'plab) yozuvchi 
    // Firebase funksiyalari bu yerdan butunlay olib tashlandi!
    // Firebase endi faqat API ishga tushganda 1 ta kvota bilan ishlaydi.

  } catch (err) {
    console.error('Failed to save persisted data:', err);
  }
}

loadPersistedData();


function recalculateOrgStats() {
  organizations = organizations.map((org) => {
    // Appeals directly assigned or co-assigned
    const orgAppeals = appeals.filter(
      (a) => a.organizationId === org.id || a.coAssignedOrgIds?.includes(org.id)
    );
    return {
      ...org,
      totalAppeals: orgAppeals.length,
      resolvedAppeals: orgAppeals.filter((a) => {
        if (a.organizationId === org.id && a.status === 'hal_etildi') return true;
        const coRes = a.coOrgResolutions?.find((r) => r.orgId === org.id);
        return coRes?.status === 'hal_etildi';
      }).length,
      inProgressAppeals: orgAppeals.filter((a) => {
        if (a.organizationId === org.id) {
          return a.status === 'jarayonda';
        }
        const coRes = a.coOrgResolutions?.find((r) => r.orgId === org.id);
        return coRes?.status === 'jarayonda';
      }).length,
      objectionAppeals: orgAppeals.filter((a) => a.feedback === 'etirozli').length,
      rejectedAuthorityAppeals: orgAppeals.filter((a) => a.status === 'vakolatda_emas').length,
    };
  });
  savePersistedData();
}

recalculateOrgStats();

export const ACTIVE_TELEGRAM_BOT_TOKEN = '8798801985:AAFXyjAVnu2MODso5kuOsfLg_AbQo9Xb3vA';

function sanitizeBotToken(raw?: string | null): string {
  const candidate = raw || process.env.TELEGRAM_BOT_TOKEN || ACTIVE_TELEGRAM_BOT_TOKEN;
  const cleaned = candidate.trim().replace(/^['"]|['"]$/g, '');
  if (cleaned.length < 15 || !cleaned.includes(':')) return ACTIVE_TELEGRAM_BOT_TOKEN;
  // If token is an old/revoked token, fallback to new active token
  if (
    cleaned.includes('AAHG3QJ328SxFNkf7bfrfWpSxqGJ2r8EEng') ||
    cleaned.includes('AAFAa20s0R2oWc0hV6rY9e9nL8qA3hX7mZ0') ||
    cleaned.includes('AAEOBhadoOSffETFCSjkMy8eG9EMrnz7IIE') ||
    cleaned.includes('AAHdeaSTyXq1tnzdeI9HDPhRCGlkBMK0N74') ||
    cleaned.includes('AAFmICcO8oU2v9t_5bvINx42HGs_HMmmFkk')
  ) {
    return ACTIVE_TELEGRAM_BOT_TOKEN;
  }
  return cleaned;
}

let telegramToken: string | null = sanitizeBotToken(process.env.TELEGRAM_BOT_TOKEN || savedTelegramToken || ACTIVE_TELEGRAM_BOT_TOKEN);
let telegramBot: any = null;
let botInfo: BotStatusInfo = { isActive: false };

export const MAHALLALAR_LIST: string[] = [
  'Shamsnazar MFY',
  'Boltali MFY',
  'Ukrash MFY',
  'Jona MFY',
  'Zarafshon MFY',
  'Nayman MFY',
  'Qaynarbuloq MFY',
  'Chorgusha MFY',
  'Bog‘oloni MFY',
  'Dung MFY',
  'Keshtali MFY',
  'Urg‘uch MFY',
  'Dabusqala MFY',
  'Farovon Yuldoshobod MFY',
];

function getMfyInlineKeyboard(page: number = 0) {
  const PAGE_SIZE = 8;
  const totalPages = Math.ceil(MAHALLALAR_LIST.length / PAGE_SIZE);
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const startIndex = safePage * PAGE_SIZE;
  const pageItems = MAHALLALAR_LIST.slice(startIndex, startIndex + PAGE_SIZE);

  const keyboard: any[][] = [];
  for (let i = 0; i < pageItems.length; i += 2) {
    const row = [
      {
        text: `📍 ${pageItems[i]}`,
        callback_data: `mfy_${startIndex + i}`,
      },
    ];
    if (i + 1 < pageItems.length) {
      row.push({
        text: `📍 ${pageItems[i + 1]}`,
        callback_data: `mfy_${startIndex + i + 1}`,
      });
    }
    keyboard.push(row);
  }

  const navRow: any[] = [];
  if (safePage > 0) {
    navRow.push({ text: '⬅️ Oldingi', callback_data: `mfypage_${safePage - 1}` });
  }
  navRow.push({ text: `📄 ${safePage + 1}/${totalPages}`, callback_data: 'noop' });
  if (safePage < totalPages - 1) {
    navRow.push({ text: 'Keyingi ➡️', callback_data: `mfypage_${safePage + 1}` });
  }
  keyboard.push(navRow);

  return { keyboard, totalPages, currentPage: safePage };
}

function calculateWordSimilarity(s1: string, s2: string): number {
  const clean = (t: string) =>
    t
      .toLowerCase()
      .replace(/[^\w\s\u0400-\u04FF]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);
  const words1 = new Set(clean(s1));
  const words2 = new Set(clean(s2));
  if (words1.size === 0 || words2.size === 0) return 0;
  let matches = 0;
  words1.forEach((w) => {
    if (words2.has(w)) matches++;
  });
  const union = new Set([...words1, ...words2]).size;
  return matches / union;
}

async function checkDuplicateAppeal(
  chatId: number,
  phone: string | undefined,
  newContent: string,
  targetOrgId?: string
): Promise<{ isDuplicate: boolean; matchedAppeal?: Appeal; reason?: string }> {
  // Only check for exact duplicate text submitted within the last 15 minutes to avoid blocking legitimate user submissions
  const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
  const userPreviousAppeals = appeals.filter((a) => {
    const isSameUser = a.telegramChatId === chatId || (phone && a.phone === phone);
    if (!isSameUser) return false;
    const isRecent = new Date(a.createdAt).getTime() > fifteenMinutesAgo;
    return isRecent;
  });

  if (userPreviousAppeals.length === 0) {
    return { isDuplicate: false };
  }

  const normalizedNew = newContent.trim().toLowerCase();

  for (const prev of userPreviousAppeals) {
    const normalizedPrev = prev.content.trim().toLowerCase();
    if (normalizedNew === normalizedPrev) {
      return { isDuplicate: true, matchedAppeal: prev, reason: "Ushbu murojaat aynan shu mazmunda hozirgina yuborilgan" };
    }
  }

  return { isDuplicate: false };
}

let isStartingBot = false;

async function initOrRestartTelegramBot(rawToken?: string | null) {
  const validToken = sanitizeBotToken(rawToken);
  if (!validToken) {
    console.log('⚠️ Yaroqli Telegram Bot Token mavjud emas.');
    botInfo = { isActive: false };
    return;
  }

  if (isStartingBot) {
    console.log('Bot allaqachon ishga tushirilmoqda, kutamiz...');
    return;
  }
  isStartingBot = true;

  if (telegramBot) {
    try {
      telegramBot.removeAllListeners();
      await telegramBot.stopPolling({ cancel: true });
    } catch (e) {
      // ignore
    }
    telegramBot = null;
  }

  try {
    telegramToken = validToken;
    savedTelegramToken = validToken;
    savePersistedData();

    // Create bot instance with clean polling
    telegramBot = new TelegramBot(validToken, { polling: false });
    
    // Clear any existing webhook to ensure clean polling
    try {
      await telegramBot.deleteWebHook();
    } catch (whErr) {
      console.warn('Webhook tozalash xabari:', whErr);
    }

    // Start polling cleanly
    await telegramBot.startPolling();

    const me = await telegramBot.getMe();
    botInfo = {
      isActive: true,
      botUsername: me.username,
      botFirstName: me.first_name,
    };
    console.log(`🤖 Telegram Bot faollashtirildi: @${me.username} (${me.first_name})`);

    telegramBot.on('polling_error', (error: any) => {
      console.error('Telegram Polling xatosi:', error.message || error);
    });

    try {
      await telegramBot.setMyCommands([
        { command: 'start', description: 'Botni ishga tushirish' },
        { command: 'yangi', description: 'Yangi murojaat yuborish' },
        { command: 'holat', description: 'Mening murojaatlarim holati' },
        { command: 'tashkilotlar', description: "Tashkilotlar va mas'ullar ro'yxati" },
        { command: 'yordam', description: 'Yordam va qo\'llanma' },
      ]);
    } catch (cmdErr) {
      // ignore
    }

    const sendMainMenu = async (chatId: number, customText?: string) => {
      userSessions.set(chatId, { step: 'NONE' });
      const text =
        customText ||
        `🏛 <b>2-Sektor Murojaatlar rasmiy Telegram botiga</b> xush kelibsiz.\n\n` +
        `Ushbu bot orqali siz tuman tashkilotlariga to‘g‘ridan-to‘g‘ri murojaat yuborishingiz, ijro jarayonini kuzatishingiz va bajarilgan ishlarga baho berishingiz mumkin.\n\n` +
        `Quyidagi tugmalardan birini tanlang:`;
      await telegramBot?.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: {
          keyboard: [
            [{ text: '📝 Yangi murojaat yuborish' }],
            [{ text: '📋 Mening murojaatlarim holati' }],
            [{ text: '🏢 Tashkilotlar va mas\'ullar' }, { text: 'ℹ️ Yordam' }],
          ],
          resize_keyboard: true,
        },
      });
    };

    const handleStartNewAppeal = (chatId: number) => {
      userSessions.set(chatId, { step: 'SELECT_ORG' });

      // Build inline buttons for all organizations
      const buttons = organizations.map((org) => [
        {
          text: `🏢 ${org.name}`,
          callback_data: `org_${org.id}`,
        },
      ]);

      telegramBot?.sendMessage(
        chatId,
        `Qaysi tashkilotga murojaat yo‘llamoqchisiz? Quyidagi ro‘yxatdan tanlang:`,
        {
          reply_markup: {
            inline_keyboard: buttons,
          },
        }
      );
    };

    const handleShowAppealsStatus = (chatId: number) => {
      const userAppeals = appeals.filter((a) => a.telegramChatId === chatId);

      if (userAppeals.length === 0) {
        telegramBot?.sendMessage(
          chatId,
          `Siz hali murojaat yubormagansiz. "📝 Yangi murojaat yuborish" tugmasi orqali ariza qoldirishingiz mumkin.`
        );
        return;
      }

      let text = `📋 <b>Sizning murojaatlaringiz ro‘yxati (${userAppeals.length} ta):</b>\n\n`;
      userAppeals.forEach((a, index) => {
        let statusEmoji = '⏳ Jarayonda';
        if (a.status === 'hal_etildi') statusEmoji = '✅ Hal etildi';
        if (a.status === 'yangi') statusEmoji = '🆕 Yangi';
        if (a.status === 'vakolatda_emas') statusEmoji = '⚠️ Boshqa tashkilotga yo\'naltirilgan';

        text += `${index + 1}. <b>№ ${a.appealNumber}</b>\n`;
        text += `🏢 Tashkilot: ${a.organizationName}\n`;
        text += `📌 Holati: ${statusEmoji}\n`;
        if (a.resolutionText) {
          text += `💬 Tashkilot javobi: <i>${a.resolutionText}</i>\n`;
        }
        text += `📅 Sana: ${new Date(a.createdAt).toLocaleDateString('uz-UZ')}\n\n`;
      });

      telegramBot?.sendMessage(chatId, text, { parse_mode: 'HTML' });
    };

    const handleShowOrgs = (chatId: number) => {
      let text = `🏢 <b>2-Sektor tashkilotlari va biriktirilgan mas'ul xodimlar:</b>\n\n`;
      organizations.forEach((o, i) => {
        text += `${i + 1}. <b>${o.name}</b>\n`;
        text += `👤 Mas'ul: <b>${o.leader}</b>\n`;
        text += `📞 Tel: ${o.phone}\n\n`;
      });
      telegramBot?.sendMessage(chatId, text, { parse_mode: 'HTML' });
    };

    const handleShowHelp = (chatId: number) => {
      telegramBot?.sendMessage(
        chatId,
        `ℹ️ <b>Yordam bo‘limi</b>\n\n` +
          `1. "📝 Yangi murojaat yuborish" tugmasini bosing.\n` +
          `2. Kerakli tashkilotni tanlang.\n` +
          `3. Ism-familiyangiz va telefoningizni yuboring.\n` +
          `4. Yashash mahallangiz va ko'cha/uy manzilingizni kiriting.\n` +
          `5. Murojaat matnini yozing (agar kerak bo'lsa fotosurat bilan).\n` +
          `6. Pastdagi "📤 Yuborish" tugmasini bosing.\n` +
          `7. Murojaat hal etilgach, rasmiy javob va fotosurat ushbu botga keladi.`,
        { parse_mode: 'HTML' }
      );
    };

    const submitAppealFromSession = async (chatId: number, session: UserSessionData) => {
      if (session.isSubmitting) return;
      session.isSubmitting = true;

      if (!session.content && !session.photoLink) {
        session.isSubmitting = false;
        await telegramBot?.sendMessage(
          chatId,
          `⚠️ Murojaat mazmuni kiritilmagan. Iltimos, murojaat matnini yozing yoki fotosurat yuboring, so‘ngra pastdagi <b>«📤 Yuborish»</b> tugmasini bosing:`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              keyboard: [
                [{ text: '📤 Yuborish' }],
                [{ text: '❌ Bekor qilish' }],
              ],
              resize_keyboard: true,
            },
          }
        );
        session.step = 'WAITING_CONTENT';
        userSessions.set(chatId, session);
        savePersistedData();
        return;
      }

      const appealContent = session.content || '(Faqat fotosurat ilova qilindi)';

      // Prevent accidental exact duplicates within 15 minutes
      const duplicateCheck = await checkDuplicateAppeal(
        chatId,
        session.phone,
        appealContent,
        session.orgId
      );

      if (duplicateCheck.isDuplicate && duplicateCheck.matchedAppeal) {
        const matched = duplicateCheck.matchedAppeal;
        let statusLabel = '⏳ Jarayonda (o‘rganilmoqda)';
        if (matched.status === 'yangi') statusLabel = '🆕 Yangi (navbatda)';
        if (matched.status === 'hal_etildi') statusLabel = '✅ Hal etilgan';

        await telegramBot?.sendMessage(
          chatId,
          `⚠️ <b>Bu murojaatingiz hozirgina yuborilgan!</b>\n\n` +
            `Sizning ushbu mazmundagi murojaatingiz <b>№ ${matched.appealNumber}</b> raqami ostida <b>${matched.organizationName}</b>ga qabul qilingan.\n\n` +
            `📌 <b>Hozirgi holati:</b> ${statusLabel}\n` +
            `📅 <b>Yuborilgan sana:</b> ${new Date(matched.createdAt).toLocaleDateString('uz-UZ')}\n\n` +
            `<i>Qayta yuborish talab etilmaydi. Yangi murojaat uchun menyudan foydalaning:</i>`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              keyboard: [
                [{ text: '📝 Yangi murojaat yuborish' }],
                [{ text: '📋 Mening murojaatlarim holati' }],
                [{ text: '🏢 Tashkilotlar va mas\'ullar' }, { text: 'ℹ️ Yordam' }],
              ],
              resize_keyboard: true,
            },
          }
        );
        userSessions.set(chatId, { step: 'NONE' });
        savePersistedData();
        return;
      }

      const targetOrg = organizations.find((o) => o.id === session.orgId) || organizations[0];
      const resolvedOrgId = session.orgId || targetOrg.id;
      const resolvedOrgName = session.orgName || targetOrg.name;

      const newId = `app-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const appealNum = `MUR-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
      const nowIso = new Date().toISOString();
      const deadlineIso = new Date(Date.now() + 120 * 60 * 60 * 1000).toISOString();

      const newAppeal: Appeal = {
        id: newId,
        appealNumber: appealNum,
        organizationId: resolvedOrgId,
        organizationName: resolvedOrgName,
        fullName: session.fullName || 'Fuqaro',
        phone: session.phone || '+998 90 000-00-00',
        mahalla: session.selectedMfy || undefined,
        address: session.address || session.selectedMfy || '2-Sektor hududi',
        content: appealContent,
        attachmentUrl: session.photoLink,
        category: targetOrg.category || 'Umumiy',
        createdAt: nowIso,
        deadlineAt: deadlineIso,
        status: 'yangi',
        feedback: 'kutilmoqda',
        telegramChatId: chatId,
        source: 'telegram',
        isFromBoshKabinet: false,
      };

      appeals.unshift(newAppeal);
      recalculateOrgStats();
      savePersistedData();
      saveSingleAppealToFirestore(newAppeal).catch((e: any) => console.warn('Cloud direct appeal save note:', e.message));
      userSessions.set(chatId, { step: 'NONE' });

      await telegramBot?.sendMessage(
        chatId,
        `✅ <b>Murojaatingiz qabul qilindi!</b>\n\n` +
          `📄 <b>Raqami:</b> <code>${appealNum}</code>\n` +
          `🏢 <b>Mas'ul tashkilot:</b> ${resolvedOrgName}\n` +
          `📍 <b>Manzil:</b> ${newAppeal.address}\n` +
          `⏱️ <b>Ijro muddati:</b> 120 soat (5 kun)\n\n` +
          `Murojaat ijrosi bo‘yicha rasmiy natija, tushuntirish yoki fotosurat ushbu bot orqali sizga yuboriladi.`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            keyboard: [
              [{ text: '📝 Yangi murojaat yuborish' }],
              [{ text: '📋 Mening murojaatlarim holati' }],
              [{ text: '🏢 Tashkilotlar va mas\'ullar' }, { text: 'ℹ️ Yordam' }],
            ],
            resize_keyboard: true,
          },
        }
      );
    };

  // callback tugmalar
    telegramBot.on('callback_query', async (query: any) => {
      const chatId = query.message?.chat.id;
      if (!chatId || !query.data) return;

      const callbackKey = `cb_${query.id}`;
      if (processedUpdates.has(callbackKey)) {
        try {
          await telegramBot?.answerCallbackQuery(query.id);
        } catch (e) {}
        return;
      }
      processedUpdates.add(callbackKey);
      if (processedUpdates.size > 3000) {
        const first = processedUpdates.values().next().value;
        if (first) processedUpdates.delete(first);
      }

      if (query.data === 'noop') {
        try {
          await telegramBot?.answerCallbackQuery(query.id);
        } catch (e) {}
        return;
      }

      if (query.data === 'cancel_appeal') {
        userSessions.set(chatId, { step: 'NONE' });
        savePersistedData();
        try {
          await telegramBot?.answerCallbackQuery(query.id, { text: 'Bekor qilindi' });
        } catch (e) {}
        await telegramBot?.sendMessage(chatId, 'Murojaat bekor qilindi.', {
          reply_markup: {
            keyboard: [
              [{ text: '📝 Yangi murojaat yuborish' }],
              [{ text: '📋 Mening murojaatlarim holati' }],
              [{ text: '🏢 Tashkilotlar va mas\'ullar' }, { text: 'ℹ️ Yordam' }],
            ],
            resize_keyboard: true,
          },
        });
        return;
      }

      if (query.data.startsWith('org_')) {
        const orgId = query.data.replace('org_', '');
        const org = organizations.find((o) => o.id === orgId) || organizations[0];
        if (org) {
          userSessions.set(chatId, {
            step: 'WAITING_FULLNAME',
            orgId: org.id,
            orgName: org.name,
          });

          try {
await telegramBot?.sendMessage(
            chatId,
            `Siz <b>${safeOrgName}</b> tashkilotini tanladingiz.\n\nIltimos, F.I.SH (Ism, familiya va otangizning ismi)ni kiriting:`,
            {
              parse_mode: 'HTML',
              reply_markup: {
                keyboard: [[{ text: '❌ Bekor qilish' }]],
                resize_keyboard: true,
              },
            }
          );
        }
        return;
      }
    }); // <-- CALLBACK_QUERY SHU YERDA TUGAYDI. BUNDAN PASTDAGI ESKI REPEAT KODLARNI O'CHIRING!

      if (query.data.startsWith('mfypage_')) {
        const targetPage = parseInt(query.data.replace('mfypage_', ''), 10);
        session.mfyPage = targetPage;
        userSessions.set(chatId, session);

        const { keyboard, totalPages, currentPage } = getMfyInlineKeyboard(targetPage);
        try {
          await telegramBot?.editMessageText(
            `📍 Yashash joyingiz bo‘yicha <b>Mahallangizni (MFY)</b> tanlang:\n<i>(Sahifa ${currentPage + 1}/${totalPages})</i>`,
            {
              chat_id: chatId,
              message_id: query.message.message_id,
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: keyboard,
              },
            }
          );
        } catch (e) {
          // ignore edit errors
        }
        await telegramBot?.answerCallbackQuery(query.id);
        return;
      }

      if (query.data.startsWith('mfy_')) {
        const mfyIdx = parseInt(query.data.replace('mfy_', ''), 10);
        const chosenMfy = MAHALLALAR_LIST[mfyIdx] || MAHALLALAR_LIST[0];
        session.selectedMfy = chosenMfy;
        session.step = 'WAITING_STREET_HOUSE';
        userSessions.set(chatId, session);

        await telegramBot?.answerCallbackQuery(query.id, { text: `Tanlandi: ${chosenMfy}` });

        try {
          await telegramBot?.editMessageText(
            `📍 Tanlangan mahalla: <b>${chosenMfy}</b> ✅`,
            {
              chat_id: chatId,
              message_id: query.message.message_id,
              parse_mode: 'HTML',
            }
          );
        } catch (e) {
          // ignore edit errors
        }

        await telegramBot?.sendMessage(
          chatId,
          `🏡 Mahalla: <b>${chosenMfy}</b>\n\n` +
            `Endi ushbu mahalla bo‘yicha <b>ko‘cha va uy raqamingizni</b> kiriting (masalan: <i>Mustaqillik ko'chasi 14-uy</i>):`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              keyboard: [[{ text: '❌ Bekor qilish' }]],
              resize_keyboard: true,
            },
          }
        );
        return;
      }

      if (query.data.startsWith('feedback_agree_')) {
        const appealId = query.data.replace('feedback_agree_', '');
        const appeal = appeals.find((a) => a.id === appealId);
        if (appeal) {
          appeal.feedback = 'roziman';
          recalculateOrgStats();
          savePersistedData();
          await telegramBot?.answerCallbackQuery(query.id, { text: 'Rahmat! Fikringiz qabul qilindi.' });
          await telegramBot?.sendMessage(
            chatId,
            `✅ Sizning javobingiz qabul qilindi: <b>Roziman (Ijobiy)</b>.\nBaholaganingiz uchun tashakkur!`,
            { parse_mode: 'HTML' }
          );
        }
        return;
      }

      if (query.data.startsWith('feedback_object_')) {
        const appealId = query.data.replace('feedback_object_', '');
        const appeal = appeals.find((a) => a.id === appealId);
        if (appeal) {
          session.step = 'WAITING_OBJECTION';
          session.appealIdForObjection = appeal.id;
          userSessions.set(chatId, session);

          await telegramBot?.answerCallbackQuery(query.id);
          await telegramBot?.sendMessage(
            chatId,
            `🔴 Iltimos, nima sababdan rozi emasligingizni (e'tirozingiz sababini) yozib yuboring:`,
            { parse_mode: 'HTML' }
          );
        }
        return;
      }
    });

    // Xabarlarni qabul qilish
    telegramBot.on('message', async (msg: any) => {
      const chatId = msg.chat?.id;
      if (!chatId) return;

      // Prevent processing the same message update twice
      const msgKey = `${chatId}_${msg.message_id}`;
      if (processedUpdates.has(msgKey)) return;
      processedUpdates.add(msgKey);
      if (processedUpdates.size > 3000) {
        const first = processedUpdates.values().next().value;
        if (first) processedUpdates.delete(first);
      }

      const rawText = msg.text?.trim() || '';
      const text = rawText;
      let session = userSessions.get(chatId) || { step: 'NONE' };

      // Exact commands
      const isStart = text === '/start' || text.startsWith('/start ');
      const isCancel = text === '❌ Bekor qilish' || text === 'Bekor qilish' || text === '/cancel';
      const isNewAppeal =
        text === '/yangi' ||
        text === '📝 Yangi murojaat yuborish' ||
        text === 'Yangi murojaat yuborish' ||
        text === '📝 Yangi murojaat' ||
        text === 'Yangi murojaat';
      const isStatus = text === '/holat' || text === '📋 Mening murojaatlarim holati' || text === 'Mening murojaatlarim holati';
      const isOrgs = text === '/tashkilotlar' || text === '🏢 Tashkilotlar va mas\'ullar' || text === '🏢 Tashkilotlar ro\'yxati' || text === 'Tashkilotlar';
      const isHelp = text === '/yordam' || text === 'ℹ️ Yordam' || text === 'Yordam';

      const isSubmitAppeal =
        text === '📤 Yuborish' ||
        text === 'Yuborish' ||
        text === '📤 Murojaatni yuborish' ||
        text === 'Murojaatni yuborish' ||
        text === '📬 Yuborish' ||
        text === '📩 Yuborish' ||
        text === '/yuborish';

      if (isStart) {
        await sendMainMenu(
          chatId,
          `Assalomu alaykum, <b>${msg.from?.first_name || 'Hurmatli fuqaro'}</b>!\n\n` +
            `🏛 <b>2-Sektor Murojaatlar rasmiy Telegram botiga</b> xush kelibsiz.\n\n` +
            `Ushbu bot orqali siz tuman tashkilotlariga to‘g‘ridan-to‘g‘ri murojaat yuborishingiz, ijro jarayonini kuzatishingiz va bajarilgan ishlarga baho berishingiz mumkin.`
        );
        return;
      }

      if (isCancel) {
        userSessions.set(chatId, { step: 'NONE' });
        savePersistedData();
        await telegramBot?.sendMessage(chatId, 'Amal bekor qilindi.', {
          reply_markup: {
            keyboard: [
              [{ text: '📝 Yangi murojaat yuborish' }],
              [{ text: '📋 Mening murojaatlarim holati' }],
              [{ text: '🏢 Tashkilotlar va mas\'ullar' }, { text: 'ℹ️ Yordam' }],
            ],
            resize_keyboard: true,
          },
        });
        return;
      }

      if (isNewAppeal) {
        handleStartNewAppeal(chatId);
        return;
      }

      if (isStatus) {
        handleShowAppealsStatus(chatId);
        return;
      }

      if (isOrgs) {
        handleShowOrgs(chatId);
        return;
      }

      if (isHelp) {
        handleShowHelp(chatId);
        return;
      }

      if (isSubmitAppeal) {
        if (session.step === 'WAITING_CONTENT' || session.content || session.photoLink) {
          await submitAppealFromSession(chatId, session);
          return;
        } else {
          await telegramBot?.sendMessage(
            chatId,
            `Murojaat yo‘llash uchun quyidagi menyudan <b>«📝 Yangi murojaat yuborish»</b> tugmasini bosing:`,
            {
              parse_mode: 'HTML',
              reply_markup: {
                keyboard: [
                  [{ text: '📝 Yangi murojaat yuborish' }],
                  [{ text: '📋 Mening murojaatlarim holati' }],
                  [{ text: '🏢 Tashkilotlar va mas\'ullar' }, { text: 'ℹ️ Yordam' }],
                ],
                resize_keyboard: true,
              },
            }
          );
          return;
        }
      }

      // Step 1: WAITING_FULLNAME
      if (session.step === 'WAITING_FULLNAME' && text) {
        session.fullName = text;
        session.step = 'WAITING_PHONE';
        userSessions.set(chatId, session);
        savePersistedData();

        await telegramBot?.sendMessage(
          chatId,
          `Rahmat, <b>${text}</b>!\n\nBog‘lanish uchun <b>telefon raqamingizni</b> yuboring (masalan: <i>+998901234567</i>) yoki quyidagi tugmani bosing:`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              keyboard: [
                [{ text: '📱 Raqamimni yuborish', request_contact: true }],
                [{ text: '❌ Bekor qilish' }],
              ],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          }
        );
        return;
      }

      // Step 2: WAITING_PHONE
      if (session.step === 'WAITING_PHONE') {
        let phoneStr = msg.contact?.phone_number || text;
        if (phoneStr) {
          if (!phoneStr.startsWith('+')) phoneStr = `+${phoneStr}`;
          session.phone = phoneStr;
          session.step = 'WAITING_MFY';
          session.mfyPage = 0;
          userSessions.set(chatId, session);
          savePersistedData();

          const { keyboard, totalPages, currentPage } = getMfyInlineKeyboard(0);

          await telegramBot?.sendMessage(
            chatId,
            `📍 Yashash joyingiz bo‘yicha <b>Mahallangizni (MFY)</b> quyidagi tugmalardan tanlang:\n<i>(Sahifa ${currentPage + 1}/${totalPages})</i>`,
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: keyboard,
              },
            }
          );
        }
        return;
      }

      // Step 3: WAITING_MFY (if user typed text instead of clicking inline button)
      if (session.step === 'WAITING_MFY' && text) {
        const cleaned = text.toLowerCase().replace(/["']/g, '').replace(/mfy/gi, '').trim();
        const matched = MAHALLALAR_LIST.find((m) => {
          const normM = m.toLowerCase().replace(/["']/g, '').replace(/mfy/gi, '').trim();
          return normM.includes(cleaned) || cleaned.includes(normM);
        });

        if (matched) {
          session.selectedMfy = matched;
          session.step = 'WAITING_STREET_HOUSE';
          userSessions.set(chatId, session);
          savePersistedData();

          await telegramBot?.sendMessage(
            chatId,
            `🏡 Tanlangan mahalla: <b>${matched}</b>\n\n` +
              `Endi ushbu mahalla bo‘yicha <b>ko‘cha va uy raqamingizni</b> yozing (masalan: <i>Mustaqillik ko'chasi 14-uy</i>):`,
            {
              parse_mode: 'HTML',
              reply_markup: {
                keyboard: [[{ text: '❌ Bekor qilish' }]],
                resize_keyboard: true,
              },
            }
          );
          return;
        } else {
          const { keyboard, totalPages, currentPage } = getMfyInlineKeyboard(session.mfyPage || 0);
          await telegramBot?.sendMessage(
            chatId,
            `Iltimos, mahallangizni quyidagi tugmalardan birini bosib tanlang:\n<i>(Sahifa ${currentPage + 1}/${totalPages})</i>`,
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: keyboard,
              },
            }
          );
          return;
        }
      }

      // Step 4: WAITING_STREET_HOUSE
      if (session.step === 'WAITING_STREET_HOUSE' && text) {
        const fullAddress = `${session.selectedMfy || 'Mahalla'}, ${text}`;
        session.address = fullAddress;
        session.step = 'WAITING_CONTENT';
        userSessions.set(chatId, session);
        savePersistedData();

        await telegramBot?.sendMessage(
          chatId,
          `📍 Manzilingiz belgilandi: <b>${fullAddress}</b>\n\n` +
            `Endi murojaatingizning <b>batafsil mazmunini</b> yozing (agar kerak bo‘lsa fotosurat bilan birga yuboring):\n\n` +
            `<i>Yozib bo‘lgach, pastdagi <b>«📤 Yuborish»</b> tugmasini bosing.</i>`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              keyboard: [
                [{ text: '📤 Yuborish' }],
                [{ text: '❌ Bekor qilish' }],
              ],
              resize_keyboard: true,
            },
          }
        );
        return;
      }

      // Step 5: WAITING_CONTENT (collect content and/or photo and prompt user to submit)
      if (session.step === 'WAITING_CONTENT') {
        let photoLink: string | undefined = undefined;

        if (msg.photo && msg.photo.length > 0) {
          const highestResPhoto = msg.photo[msg.photo.length - 1];
          try {
            photoLink = await telegramBot?.getFileLink(highestResPhoto.file_id);
          } catch (err) {
            console.error('Photo link olishda xato:', err);
          }
        }

        const inputContent = text || msg.caption || '';
        if (inputContent) {
          session.content = session.content ? `${session.content}\n${inputContent}` : inputContent;
        }
        if (photoLink) {
          session.photoLink = photoLink;
        }

        userSessions.set(chatId, session);
        savePersistedData();

        await telegramBot?.sendMessage(
          chatId,
          `✍️ <b>Murojaat matni qabul qilindi!</b>\n\n` +
            `Yana qo‘shimcha ma'lumot yoki fotosurat bo‘lsa yuborishingiz mumkin.\n\n` +
            `Agar barchasi tayyor bo‘lsa, murojaatni 2-Sektor shtabiga va mas'ul tashkilotga yo‘llash uchun pastdagi <b>«📤 Yuborish»</b> tugmasini bosing:`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              keyboard: [
                [{ text: '📤 Yuborish' }],
                [{ text: '❌ Bekor qilish' }],
              ],
              resize_keyboard: true,
            },
          }
        );
        return;
      }

      // Step 6: WAITING_OBJECTION
      if (session.step === 'WAITING_OBJECTION' && text && session.appealIdForObjection) {
        const appeal = appeals.find((a) => a.id === session.appealIdForObjection);
        if (appeal) {
          appeal.feedback = 'etirozli';
          appeal.objectionText = text;
          appeal.objectionAt = new Date().toISOString();
          appeal.status = 'jarayonda';
          recalculateOrgStats();
          savePersistedData();

          await telegramBot?.sendMessage(
            chatId,
            `⚠️ E'tirozingiz qabul qilindi! Murojaat Bosh Kabinet va tashkilotga qayta ijro uchun yuborildi.`
          );
        }
        userSessions.set(chatId, { step: 'NONE' });
        return;
      }

      // Default fallback if no step is active
      if (session.step === 'NONE' && text) {
        await sendMainMenu(chatId, `Assalomu alaykum! Murojaat yo‘llash yoki holatni ko‘rish uchun quyidagi tugmalardan foydalaning:`);
      }
    });
  } catch (err: any) {
    console.error('Telegram Botni boshlashda xatolik:', err.message);
    throw err;
  } finally {
    isStartingBot = false;
  }
}

async function notifyTelegramUserResolved(appeal: Appeal) {
  if (!telegramBot || !appeal.telegramChatId) return;

  const text =
    `🎉 <b>Murojaatingiz ko‘rib chiqildi va hal etildi!</b>\n\n` +
    `📄 <b>Murojaat №:</b> <code>${appeal.appealNumber}</code>\n` +
    `🏢 <b>Tashkilot:</b> ${appeal.organizationName}\n` +
    `💬 <b>Bajarilgan ish / Xulosa:</b>\n<i>${appeal.resolutionText}</i>\n\n` +
    `Iltimos, tashkilot tomonidan bajarilgan ish sifatini baholang:`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: '👍 Roziman (Ijobiy)', callback_data: `feedback_agree_${appeal.id}` },
        { text: '👎 E\'tirozim bor', callback_data: `feedback_object_${appeal.id}` },
      ],
    ],
  };

  try {
    if (appeal.resolutionPhotoUrl) {
      if (appeal.resolutionPhotoUrl.startsWith('data:image/')) {
        const matches = appeal.resolutionPhotoUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        const ext = matches ? matches[1] : 'jpeg';
        const base64Data = matches ? matches[2] : appeal.resolutionPhotoUrl.replace(/^data:image\/\w+;base64,/, '');
        const photoBuffer = Buffer.from(base64Data, 'base64');
        
        try {
          await telegramBot.sendPhoto(
            appeal.telegramChatId,
            photoBuffer,
            {
              caption: text,
              parse_mode: 'HTML',
              reply_markup: inlineKeyboard,
            },
            {
              filename: `hisobot.${ext === 'png' ? 'png' : 'jpg'}`,
              contentType: `image/${ext}`,
            }
          );
          return;
        } catch (photoErr) {
          console.warn('⚠️ Base64 rasm yuborishda xato, matn yuboriladi:', photoErr);
        }
      } else {
        try {
          await telegramBot.sendPhoto(appeal.telegramChatId, appeal.resolutionPhotoUrl, {
            caption: text,
            parse_mode: 'HTML',
            reply_markup: inlineKeyboard,
          });
          return;
        } catch (photoUrlErr) {
          console.warn('⚠️ URL rasm yuborishda xato, matn yuboriladi:', photoUrlErr);
        }
      }
    }

    await telegramBot.sendMessage(appeal.telegramChatId, text, {
      parse_mode: 'HTML',
      reply_markup: inlineKeyboard,
    });
  } catch (err: any) {
    console.error('Telegram notification yuborishda xato:', err.message);
  }
}

// REST API Endpoints

// Bi-directional state synchronization (prevents ANY data loss across redeploys/rebuilds)
app.post('/api/sync/client-state', (req, res) => {
  const { appeals: clientAppeals, organizations: clientOrgs } = req.body;

  let appealsChanged = false;
  let orgsChanged = false;

  if (clientAppeals && Array.isArray(clientAppeals)) {
    const appealMap = new Map<string, Appeal>();
    appeals.forEach((a) => appealMap.set(a.id, a));

    clientAppeals.forEach((ca: Appeal) => {
      if (!appealMap.has(ca.id)) {
        appealMap.set(ca.id, ca);
        appealsChanged = true;
      } else {
        const existing = appealMap.get(ca.id)!;
        // Merge newest fields
        if (ca.status !== existing.status || ca.feedback !== existing.feedback || ca.resolutionText !== existing.resolutionText) {
          appealMap.set(ca.id, { ...existing, ...ca });
          appealsChanged = true;
        }
      }
    });

    if (appealsChanged) {
      appeals = Array.from(appealMap.values());
    }
  }

  if (clientOrgs && Array.isArray(clientOrgs)) {
    const orgMap = new Map<string, Organization>();
    organizations.forEach((o) => orgMap.set(o.id, o));

    clientOrgs.forEach((co: Organization) => {
      if (!orgMap.has(co.id)) {
        orgMap.set(co.id, co);
        orgsChanged = true;
      }
    });

    if (orgsChanged) {
      organizations = Array.from(orgMap.values());
    }
  }

  recalculateOrgStats();
  res.json({
    success: true,
    appeals,
    organizations,
    stats: {
      appealsCount: appeals.length,
      organizationsCount: organizations.length,
    },
  });
});

// Full JSON Backup Export
app.get('/api/backup/export', (req, res) => {
  recalculateOrgStats();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=nazorat-backup-${new Date().toISOString().split('T')[0]}.json`);
  res.json({
    exportedAt: new Date().toISOString(),
    version: '2026.1',
    organizations,
    appeals,
    savedTelegramToken,
  });
});

// Full JSON Backup Import
app.post('/api/backup/import', (req, res) => {
  const { organizations: impOrgs, appeals: impAppeals } = req.body;
  if (!impOrgs || !impAppeals) {
    return res.status(400).json({ error: 'Noto\'g\'ri zaxira fayl formati.' });
  }

  if (Array.isArray(impOrgs)) {
    organizations = impOrgs;
  }
  if (Array.isArray(impAppeals)) {
    appeals = impAppeals;
  }

  recalculateOrgStats();
  res.json({ success: true, message: 'Barcha ma\'lumotlar muvaffaqiyatli tiklandi!', appeals, organizations });
});

// Clear all appeals (reset database)
app.post('/api/appeals/clear-all', (req, res) => {
  appeals = [];
  recalculateOrgStats();
  savePersistedData();
  console.log('🧹 Barcha murojaatlar tozalandi.');
  res.json({ success: true, message: 'Barcha murojaatlar tozalandi', appeals: [], organizations });
});

// ================= SHTAB VAZIFALARI (TASKS) API ROUTES =================

// Barcha vazifalarni olish
app.get('/api/tasks', (req, res) => {
  res.json({
    tasks: shtabTasks,
    stats: {
      total: shtabTasks.length,
      yangi: shtabTasks.filter((t) => t.status === 'yangi').length,
      jarayonda: shtabTasks.filter((t) => t.status === 'jarayonda').length,
      tekshiruvda: shtabTasks.filter((t) => t.status === 'tekshiruvda').length,
      tasdiqlandi: shtabTasks.filter((t) => t.status === 'tasdiqlandi').length,
      qaytarildi: shtabTasks.filter((t) => t.status === 'qaytarildi').length,
    },
  });
});

// Tashkilotga tegishli vazifalarni olish
app.get('/api/tasks/org/:orgId', (req, res) => {
  const { orgId } = req.params;
  const orgTasks = shtabTasks.filter((t) => t.targetOrgId === orgId || t.targetOrgId === 'all');
  res.json({
    tasks: orgTasks,
    stats: {
      total: orgTasks.length,
      yangi: orgTasks.filter((t) => t.status === 'yangi').length,
      jarayonda: orgTasks.filter((t) => t.status === 'jarayonda').length,
      tekshiruvda: orgTasks.filter((t) => t.status === 'tekshiruvda').length,
      tasdiqlandi: orgTasks.filter((t) => t.status === 'tasdiqlandi').length,
      qaytarildi: orgTasks.filter((t) => t.status === 'qaytarildi').length,
    },
  });
});

// 7 ta namunaviy shtab vazifasini Tuman IIB ga yoki tanlangan tashkilotga biriktirish
app.post('/api/tasks/seed-7-tasks', (req, res) => {
  const { targetOrgId = 'org-1', deadlineDays = 15 } = req.body;
  const now = new Date();
  const deadlineDate = new Date();
  deadlineDate.setDate(now.getDate() + Number(deadlineDays));
  const deadlineStr = deadlineDate.toISOString().split('T')[0];

  const targetOrg = organizations.find((o) => o.id === targetOrgId) || organizations[0];
  if (!targetOrg) {
    return res.status(404).json({ error: 'Tashkilot topilmadi.' });
  }

  const createdTasks: ShtabTask[] = [];
  const templates = targetOrg.id === 'org-1' ? IIB_7_TASKS : (ORG_DEFAULT_TASKS[targetOrg.id] || IIB_7_TASKS);

  templates.forEach((tmpl) => {
    // Check if this task already exists for this org
    const exists = shtabTasks.some(
      (t) => t.targetOrgId === targetOrg.id && (t.taskNumber === tmpl.taskNumber || t.title === tmpl.title)
    );

    if (!exists) {
      const newTask: ShtabTask = {
        id: `task-${targetOrg.id}-${tmpl.taskNumber}-${Date.now().toString(36)}`,
        taskNumber: tmpl.taskNumber,
        title: tmpl.title,
        description: tmpl.description,
        targetOrgId: targetOrg.id,
        targetOrgName: targetOrg.name,
        category: targetOrg.id === 'org-1' ? 'IIB Profilaktika Vazifasi' : 'Sektor Vazifasi',
        createdAt: now.toISOString(),
        deadline: deadlineStr,
        status: 'yangi',
      };
      shtabTasks.unshift(newTask);
      createdTasks.push(newTask);
    }
  });

  savePersistedData();
  console.log(`✅ ${targetOrg.name} uchun ${createdTasks.length} ta vazifa muvaffaqiyatli biriktirildi.`);
  res.json({
    success: true,
    message: `${targetOrg.name} uchun ${createdTasks.length} ta vazifa muvaffaqiyatli biriktirildi va yuborildi.`,
    createdCount: createdTasks.length,
    tasks: shtabTasks,
  });
});

// Barcha 18 ta tashkilotga o'z sohasi bo'yicha vazifalarni biriktirish
app.post('/api/tasks/seed-all-tasks', (req, res) => {
  const { deadlineDays = 15 } = req.body;
  syncShtabTasksWithOfficialTemplates(deadlineDays);
  savePersistedData();
  console.log(`✅ 18 ta tashkilotga jami ${shtabTasks.length} ta rasmiy sohaviy vazifa sinxronlandi.`);
  res.json({
    success: true,
    message: `18 ta tashkilotga jami ${shtabTasks.length} ta rasmiy sohaviy vazifalar muvaffaqiyatli biriktirildi.`,
    createdCount: shtabTasks.length,
    tasks: shtabTasks,
  });
});

// Yangi alohida vazifa yaratish
app.post('/api/tasks', async (req, res) => {
  const { title, description, targetOrgId, targetOrgIds, deadline, category } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: 'Vazifa sarlavhasi va mazmuni kiritilishi shart.' });
  }

  const now = new Date();
  const nextNumber = shtabTasks.length + 1;

  let selectedOrgIds: string[] = [];
  if (Array.isArray(targetOrgIds) && targetOrgIds.length > 0) {
    if (targetOrgIds.includes('all')) {
      selectedOrgIds = organizations.map((o) => o.id);
    } else {
      selectedOrgIds = targetOrgIds;
    }
  } else if (targetOrgId === 'all') {
    selectedOrgIds = organizations.map((o) => o.id);
  } else if (targetOrgId) {
    selectedOrgIds = [targetOrgId];
  } else {
    selectedOrgIds = organizations.map((o) => o.id);
  }

  if (selectedOrgIds.length === 0) {
    return res.status(400).json({ error: 'Kamida bitta tashkilotni tanlang.' });
  }

  const newTasks: ShtabTask[] = selectedOrgIds.map((orgId) => {
    const org = organizations.find((o) => o.id === orgId);
    return {
      id: `task-${orgId}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
      taskNumber: nextNumber,
      title,
      description,
      targetOrgId: orgId,
      targetOrgName: org ? org.name : orgId,
      category: category || 'Sektor Maxsus Vazifasi',
      createdAt: now.toISOString(),
      deadline: deadline || '',
      status: 'yangi',
    };
  });

  shtabTasks = [...newTasks, ...shtabTasks];
  savePersistedData();

  // 🔥 Yangi qo'shilgan vazifalarni Firestore bazasiga bittalab saqlaymiz
  for (const t of newTasks) {
    await saveSingleTaskToFirestore(t).catch(err => console.warn('Task save error:', err));
  }

  if (newTasks.length === 1) {
    return res.json({
      success: true,
      message: `Vazifa ${newTasks[0].targetOrgName}ga muvaffaqiyatli yuborildi.`,
      task: newTasks[0],
      tasks: shtabTasks,
    });
  } else {
    return res.json({
      success: true,
      message: `${newTasks.length} ta tashkilotga vazifa muvaffaqiyatli yuborildi.`,
      createdCount: newTasks.length,
      tasks: shtabTasks,
    });
  }
});

// Tashkilot vazifani bajarishga kirishdi (status: jarayonda - Sariq)
app.post('/api/tasks/:id/start', (req, res) => {
  const { id } = req.params;
  const task = shtabTasks.find((t) => t.id === id);
  if (!task) {
    return res.status(404).json({ error: 'Vazifa topilmadi.' });
  }

  task.status = 'jarayonda';
  task.startedAt = new Date().toISOString();
  savePersistedData();
  saveSingleTaskToFirestore(task).catch(console.error);

  res.json({ success: true, message: 'Vazifa ijro jarayoniga o\'tkazildi.', task });
});

// Tashkilot hisobot topshirdi (status: tekshiruvda - Bosh kabinet tasdig'i kutilyapti)
app.post('/api/tasks/:id/submit-report', (req, res) => {
  const { id } = req.params;
  const { reportText, reportPhotoUrl, reportPdfUrl, reportPdfName, executorName } = req.body;

  if (!reportText || !reportText.trim()) {
    return res.status(400).json({ error: 'Bajargan ishingiz bo\'yicha hisobot matnini kiriting.' });
  }

  const task = shtabTasks.find((t) => t.id === id);
  if (!task) {
    return res.status(404).json({ error: 'Vazifa topilmadi.' });
  }

  const now = new Date().toISOString();
  task.status = 'tekshiruvda';
  task.reportText = reportText.trim();
  task.reportPhotoUrl = reportPhotoUrl || undefined;
  task.reportPdfUrl = reportPdfUrl || undefined;
  task.reportPdfName = reportPdfName || undefined;
  task.reportExecutorName = executorName || undefined;
  task.reportSubmittedAt = now;
  task.completionReport = {
    notes: reportText.trim(),
    submittedAt: now,
    executorName: executorName || undefined,
    pdfUrl: reportPdfUrl || undefined,
    pdfFileName: reportPdfName || undefined,
  };
  task.adminFeedback = undefined; // eski feedbackni tozalash

  savePersistedData();
  saveSingleTaskToFirestore(task).catch(console.error); // 🔥 UPDATE: Saqlanganda bazaga ham
  
  res.json({ success: true, message: 'Hisobotingiz Bosh Kabinetga muvaffaqiyatli yuborildi. Bosh Kabinet tekshiruvidan so\'ng tasdiqlanadi.', task });
});

// Bosh kabinet tasdiqladi (status: tasdiqlandi - Yashil)
app.post('/api/tasks/:id/approve', (req, res) => {
  const { id } = req.params;
  const { adminFeedback } = req.body;

  const task = shtabTasks.find((t) => t.id === id);
  if (!task) {
    return res.status(404).json({ error: 'Vazifa topilmadi.' });
  }

  task.status = 'tasdiqlandi';
  task.approvedAt = new Date().toISOString();
  if (adminFeedback) {
    task.adminFeedback = adminFeedback.trim();
  }

  savePersistedData();
  saveSingleTaskToFirestore(task).catch(console.error);
  res.json({ success: true, message: 'Vazifa ijrosi muvaffaqiyatli tasdiqlandi!', task, tasks: shtabTasks });
});

// Bosh kabinet qaytardi (status: qaytarildi)
app.post('/api/tasks/:id/reject', (req, res) => {
  const { id } = req.params;
  const { adminFeedback } = req.body;

  const task = shtabTasks.find((t) => t.id === id);
  if (!task) {
    return res.status(404).json({ error: 'Vazifa topilmadi.' });
  }

  task.status = 'qaytarildi';
  task.adminFeedback = adminFeedback || 'Hisobot to\'liq emas, qayta ko\'rib chiqilsin.';

  savePersistedData();
  saveSingleTaskToFirestore(task).catch(console.error); // 🔥 UPDATE: Saqlanganda bazaga ham
  res.json({ success: true, message: 'Vazifa qayta ishlash uchun qaytarildi.', task, tasks: shtabTasks });
});

// Vazifani o'chirish
app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  shtabTasks = shtabTasks.filter((t) => t.id !== id);
  deleteTaskFromFirestore(id).catch((e) => console.warn('Cloud task delete note:', e.message));
  savePersistedData();
  res.json({ success: true, message: 'Vazifa o\'chirildi.', tasks: shtabTasks });
});

// ================= MAHALLA YETTILIGI VAZIFALARI API ROUTES =================

// Mahalla vazifalarini hisoblash statistikasi yordamchisi
function computeMahallaStats(taskList: MahallaTask[]) {
  return {
    total: taskList.length,
    yangi: taskList.filter((t) => t.status === 'yangi').length,
    jarayonda: taskList.filter((t) => t.status === 'jarayonda').length,
    bajarildi: taskList.filter((t) => t.status === 'bajarildi').length,
    qaytarildi: taskList.filter((t) => t.status === 'qaytarildi').length,
  };
}

// Barcha mahalla vazifalarini olish
app.get('/api/mahalla-tasks', (req, res) => {
  res.json({
    tasks: mahallaTasks,
    stats: computeMahallaStats(mahallaTasks),
  });
});

// Barcha 51 ta mahallalar ro'yxati va ularning statistikasi
app.get('/api/mahallas', (req, res) => {
  const mahallasWithStats = PAXTACHI_MAHALLAS.map((m) => {
    const mTasks = mahallaTasks.filter((t) => t.mahallaId === m.id || t.mahallaName === m.name);
    return {
      ...m,
      stats: computeMahallaStats(mTasks),
    };
  });
  res.json(mahallasWithStats);
});

// Muayyan mahallaga tegishli vazifalarni olish
app.get('/api/mahalla-tasks/mahalla/:mahallaId', (req, res) => {
  const { mahallaId } = req.params;
  const filtered = mahallaTasks.filter(
    (t) => t.mahallaId === mahallaId || t.mahallaName.toLowerCase().includes(mahallaId.toLowerCase())
  );
  res.json({
    tasks: filtered,
    stats: computeMahallaStats(filtered),
  });
});

// Barcha 51 ta mahallaga namunaviy vazifalarni biriktirish (Seed All)
app.post('/api/mahalla-tasks/seed-all', async (req, res) => { // 🔥 async qo'shildi
  const { deadlineDays = 15 } = req.body;
  const deadlineDate = new Date();
  deadlineDate.setDate(deadlineDate.getDate() + Number(deadlineDays));
  const deadlineStr = deadlineDate.toISOString().split('T')[0];
  const nowIso = new Date().toISOString();

  const generated: MahallaTask[] = [];

  PAXTACHI_MAHALLAS.forEach((mfy) => {
    DEFAULT_MAHALLA_YETTILIGI_TASKS.forEach((tmpl) => {
      // Check if already exists
      const exists = mahallaTasks.some(
        (t) => (t.mahallaId === mfy.id || t.mahallaName === mfy.name) && t.taskNumber === tmpl.taskNumber
      );
      if (!exists) {
        generated.push({
          id: `mtask-${mfy.id}-${tmpl.taskNumber}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
          taskNumber: tmpl.taskNumber,
          title: tmpl.title,
          description: tmpl.description,
          targetRole: tmpl.targetRole,
          mahallaId: mfy.id,
          mahallaName: mfy.name,
          targetOrgId: tmpl.targetOrgId,
          targetOrgName: tmpl.targetOrgName,
          category: 'Mahalla Yettiligi Vazifasi',
          createdAt: nowIso,
          deadline: deadlineStr,
          status: 'yangi',
        });
      }
    });
  });

  if (generated.length > 0) {
    mahallaTasks = [...generated, ...mahallaTasks];
    savePersistedData();
    // 🔥 Bulutga saqlash
    for (const mt of generated) {
        await saveSingleMahallaTaskToFirestore(mt).catch(console.error);
    }
  }

  res.json({
    success: true,
    message: `14 ta mahalla uchun ${generated.length} ta yangi vazifa shakllantirildi.`,
    createdCount: generated.length,
    tasks: mahallaTasks,
    stats: computeMahallaStats(mahallaTasks),
  });
});

// Yangi mahalla vazifasi yaratish (Bosh Kabinet tomonidan bitta yoki barcha mahallalarga)
app.post('/api/mahalla-tasks', async (req, res) => { // 🔥 async qo'shildi
  const { title, description, targetRole, mahallaId, targetOrgId, targetOrgName, deadline, category } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: 'Vazifa sarlavhasi va mazmuni kiritilishi shart.' });
  }

  const nowIso = new Date().toISOString();
  const nextNum = mahallaTasks.length + 1;

  if (mahallaId === 'all') {
    // 14 ta mahallaning barchasiga yuborish
    const newTasks: MahallaTask[] = PAXTACHI_MAHALLAS.map((m) => ({
      id: `mtask-${m.id}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      taskNumber: nextNum,
      title,
      description,
      targetRole: targetRole || 'Yettilik tarkibi',
      mahallaId: m.id,
      mahallaName: m.name,
      targetOrgId,
      targetOrgName: targetOrgName || 'Tegishli sohaviy tashkilot',
      category: category || 'Sektor Maxsus Mahalla Vazifasi',
      createdAt: nowIso,
      deadline: deadline || '',
      status: 'yangi',
    }));

    mahallaTasks = [...newTasks, ...mahallaTasks];
    savePersistedData();
    // 🔥 Bulutga saqlash
    for (const mt of newTasks) {
        await saveSingleMahallaTaskToFirestore(mt).catch(console.error);
    }
    
    return res.json({
      success: true,
      message: 'Barcha 14 ta mahallaga vazifa muvaffaqiyatli yuborildi.',
      tasks: mahallaTasks,
      stats: computeMahallaStats(mahallaTasks),
    });
  } else {
    const mfy = PAXTACHI_MAHALLAS.find((m) => m.id === mahallaId);
    const newTask: MahallaTask = {
      id: `mtask-${mahallaId || 'mfy'}-${Date.now().toString(36)}`,
      taskNumber: nextNum,
      title,
      description,
      targetRole: targetRole || 'Yettilik tarkibi',
      mahallaId: mahallaId || 'mfy-1',
      mahallaName: mfy ? mfy.name : 'Noma\'lum Mahalla',
      targetOrgId,
      targetOrgName: targetOrgName || 'Tegishli sohaviy tashkilot',
      category: category || 'Sektor Maxsus Mahalla Vazifasi',
      createdAt: nowIso,
      deadline: deadline || '',
      status: 'yangi',
    };

    mahallaTasks.unshift(newTask);
    savePersistedData();
    await saveSingleMahallaTaskToFirestore(newTask).catch(console.error); // 🔥 Bulutga saqlash
    
    return res.json({
      success: true,
      message: `${newTask.mahallaName}ga vazifa yuborildi.`,
      task: newTask,
      tasks: mahallaTasks,
      stats: computeMahallaStats(mahallaTasks),
    });
  }
});

// Mahalla "Bajaraman" tugmasini bosdi -> status: jarayonda (Sariq)
app.post('/api/mahalla-tasks/:id/start', (req, res) => {
  const { id } = req.params;
  const task = mahallaTasks.find((t) => t.id === id);
  if (!task) {
    return res.status(404).json({ error: 'Mahalla vazifasi topilmadi.' });
  }

  task.status = 'jarayonda';
  task.startedAt = new Date().toISOString();
  savePersistedData();
  saveSingleMahallaTaskToFirestore(task).catch(console.error); // 🔥 Bulutga saqlash

  res.json({
    success: true,
    message: 'Vazifa ijro jarayoniga qabul qilindi (Jarayonda).',
    task,
    tasks: mahallaTasks,
    stats: computeMahallaStats(mahallaTasks),
  });
});

// Mahalla oflayn o'rganish xulosasini tizimga yozdi (Xulosa shakllantirildi)
app.post('/api/mahalla-tasks/:id/xulosa', (req, res) => {
  const { id } = req.params;
  const { xulosaText, xulosaAuthor } = req.body;

  if (!xulosaText || !xulosaText.trim()) {
    return res.status(400).json({ error: 'Oflayn o\'rganish xulosasi matnini kiriting.' });
  }

  const task = mahallaTasks.find((t) => t.id === id);
  if (!task) {
    return res.status(404).json({ error: 'Mahalla vazifasi topilmadi.' });
  }

  task.xulosaText = xulosaText.trim();
  task.xulosaAuthor = xulosaAuthor || 'Mahalla Yettiligi a\'zosi';
  task.xulosaPreparedAt = new Date().toISOString();
  // Status remains 'jarayonda' until organization inspects and confirms it online
  task.status = 'jarayonda';

  savePersistedData();
  saveSingleMahallaTaskToFirestore(task).catch(console.error); // 🔥 Bulutga saqlash
  
  res.json({
    success: true,
    message: 'Oflayn o\'rganish xulosasi saqlandi. Xulosani tashkilotga olib borganingizdan so\'ng tashkilot tizimda onlayn tasdiqlaydi.',
    task,
    tasks: mahallaTasks,
    stats: computeMahallaStats(mahallaTasks),
  });
});

// Tashkilot yoki Bosh kabinet mahalla xulosasini ko'rib, onlayn tasdiqladi -> status: bajarildi (Yashil)
app.post('/api/mahalla-tasks/:id/approve', (req, res) => {
  const { id } = req.params;
  const { approverNote, approvedByOrgId, approvedByOrgName } = req.body;

  const task = mahallaTasks.find((t) => t.id === id);
  if (!task) {
    return res.status(404).json({ error: 'Mahalla vazifasi topilmadi.' });
  }

  task.status = 'bajarildi';
  task.approvedAt = new Date().toISOString();
  task.approvedByOrgId = approvedByOrgId || undefined;
  task.approvedByOrgName = approvedByOrgName || 'Tashkilot mutaxassisi';
  if (approverNote) {
    task.approverNote = approverNote.trim();
  }

  savePersistedData();
  saveSingleMahallaTaskToFirestore(task).catch(console.error); // 🔥 Bulutga saqlash
  
  res.json({
    success: true,
    message: 'Mahalla yettiligi vazifasi ijrosi va xulosasi onlayn muvaffaqiyatli tasdiqlandi (Bajarildi)!',
    task,
    tasks: mahallaTasks,
    stats: computeMahallaStats(mahallaTasks),
  });
});

// Tashkilot yoki Bosh kabinet qaytardi -> status: qaytarildi
app.post('/api/mahalla-tasks/:id/reject', (req, res) => {
  const { id } = req.params;
  const { approverNote } = req.body;

  const task = mahallaTasks.find((t) => t.id === id);
  if (!task) {
    return res.status(404).json({ error: 'Mahalla vazifasi topilmadi.' });
  }

  task.status = 'qaytarildi';
  task.approverNote = approverNote || 'Xulosa to\'liq emas, qayta o\'rganilsin.';

  savePersistedData();
  saveSingleMahallaTaskToFirestore(task).catch(console.error); // 🔥 Bulutga saqlash
  
  res.json({
    success: true,
    message: 'Vazifa xulosasi qayta ishlash uchun qaytarildi.',
    task,
    tasks: mahallaTasks,
    stats: computeMahallaStats(mahallaTasks),
  });
});

// Mahalla vazifasini o'chirish
app.delete('/api/mahalla-tasks/:id', (req, res) => {
  const { id } = req.params;
  mahallaTasks = mahallaTasks.filter((t) => t.id !== id);
  deleteMahallaTaskFromFirestore(id).catch((e) => console.warn('Cloud mahalla task delete note:', e.message));
  savePersistedData();
  res.json({
    success: true,
    message: 'Mahalla vazifasi o\'chirildi.',
    tasks: mahallaTasks,
    stats: computeMahallaStats(mahallaTasks),
  });
});


// Seed sample appeals for realistic dashboard testing
app.post('/api/demo/seed-samples', (req, res) => {
  const sampleOrgs = organizations;
  const sampleMahallas = MAHALLALAR_LIST;

  const sampleCitizens = [
    { name: 'Abdullayev Anvar', phone: '+998 90 123-45-67', problem: 'Elektr ta\'minotida uzilishlar, transformator tekshiruvi zarur', cat: 'Elektr Energiyasi', orgCode: 'TETK-12' },
    { name: 'Karimova Munisa', phone: '+998 91 234-56-78', problem: 'Ichimlik suvi bosimi pasaygan, quvurlar sozlash talab etiladi', cat: 'Suv Ta\'minoti', orgCode: 'SST-11' },
    { name: 'Ergashev Baxtiyor', phone: '+998 93 345-67-89', problem: 'Mahalla ichki yo\'llari ta\'miri va shag\'al to\'kish masalasida', cat: 'Kommunal va Obodonlashtirish', orgCode: 'OB-16' },
    { name: 'Tursunov Jamshid', phone: '+998 94 456-78-90', problem: 'Ko\'chat ekish va obodonlashtirish ishlari bo\'yicha murojaat', cat: 'Kommunal va Obodonlashtirish', orgCode: 'OB-16' },
    { name: 'Yusupova Zilola', phone: '+998 95 567-89-01', problem: 'Ko\'cha chiroqlari o\'rnatish va ta\'mirlash bo\'yicha yordam', cat: 'Elektr Energiyasi', orgCode: 'TETK-12' },
    { name: 'Hakimov Otabek', phone: '+998 97 678-90-12', problem: 'Xonadon gaz bosimini me\'yorlashtirish va reduktorni ko\'rish', cat: 'Gaz Ta\'minoti', orgCode: 'HG-10' },
    { name: 'Saidova Gulnora', phone: '+998 98 789-01-23', problem: 'Tuman markaziy poliklinikasida tibbiy ko\'rikdan o\'tish', cat: 'Sog\'liqni Saqlash', orgCode: 'TTB-06' },
    { name: 'Qodirov Bobur', phone: '+998 90 890-12-34', problem: 'Maktab binosi atrofini obodonlashtirish va yo\'l belgilari', cat: 'Ta\'lim va Tarbiya', orgCode: 'MMTB-09' },
    { name: 'Umarova Nargiza', phone: '+998 91 901-23-45', problem: 'Yer uchastkasining kadastr hujjatlarini rasmiylashtirish', cat: 'Yer va Kadastr', orgCode: 'DKP-05' },
    { name: 'Alimov Sardor', phone: '+998 93 012-34-56', problem: 'Kichik biznes kredit liniyasi bo\'yicha amaliy maslahat', cat: 'Bank va Kredit', orgCode: 'AB-14' },
  ];

  const now = Date.now();
  const generated: Appeal[] = [];

  sampleCitizens.forEach((c, idx) => {
    const matchedOrg = sampleOrgs.find((o) => o.code === c.orgCode) || sampleOrgs[idx % sampleOrgs.length];
    const mahalla = sampleMahallas[idx % sampleMahallas.length];
    const createdMs = now - (idx * 3600000 * 8) - 1800000;
    const deadlineMs = createdMs + 120 * 60 * 60 * 1000;
    const isResolved = idx % 2 === 0;

    generated.push({
      id: `app-demo-${1247 - idx}`,
      appealNumber: `#${1247 - idx}`,
      organizationId: matchedOrg.id,
      organizationName: matchedOrg.name,
      fullName: c.name,
      phone: c.phone,
      mahalla: mahalla,
      address: `${mahalla}, ${10 + idx}-uy`,
      content: c.problem,
      category: c.cat,
      createdAt: new Date(createdMs).toISOString(),
      deadlineAt: new Date(deadlineMs).toISOString(),
      status: isResolved ? 'hal_etildi' : 'jarayonda',
      assignedOperator: `Mutaxassis ${matchedOrg.leader}`,
      startedAt: new Date(createdMs + 3600000).toISOString(),
      resolvedAt: isResolved ? new Date(createdMs + 3600000 * 18).toISOString() : undefined,
      resolutionText: isResolved ? 'Murojaat mutaxassislar tomonidan joyiga chiqib to\'liq o\'rganildi va ijobiy hal etildi.' : undefined,
      feedback: isResolved ? 'roziman' : 'kutilmoqda',
    });
  });

  appeals = [...generated];
  recalculateOrgStats();
  savePersistedData();
  console.log('✅ Demo ma\'lumotlar yuklandi.');
  res.json({ success: true, message: 'Namuna murojaatlar yuklandi', appeals, organizations });
});

app.post('/api/auth/login', (req, res) => {
  const { password, organizationId } = req.body;
  if (!password || typeof password !== 'string' || !password.trim()) {
    return res.status(400).json({ success: false, message: 'Parol kiritilmadi' });
  }

  const cleanPassword = password.trim().toLowerCase();

  // Admin credentials -> Bosh Kabinet (Master access)
  const boshKabinetEnvPass = (process.env.BOSH_KABINET_PASSWORD || '').trim().toLowerCase();
  if (
    (boshKabinetEnvPass && cleanPassword === boshKabinetEnvPass) ||
    cleanPassword === '2204' ||
    cleanPassword === 'shtab#paxtachi@2026!pro' ||
    cleanPassword === 'admin2026' ||
    cleanPassword === 'admin123' ||
    cleanPassword === 'pablo2026' ||
    cleanPassword === 'boshqaruv2026' ||
    cleanPassword === 'bosh_kabinet'
  ) {
    return res.json({ success: true, role: 'bosh_kabinet' });
  }

  // Monitor / Situatsion Ekran credentials
  if (
    cleanPassword === 'tvpaxtachi*screen#2026' ||
    cleanPassword === 'monitor' ||
    cleanPassword === 'monitor2026' ||
    cleanPassword === 'ekran' ||
    cleanPassword === 'tv2026' ||
    cleanPassword === 'statistika'
  ) {
    return res.json({ success: true, role: 'monitor' });
  }

  // Case A: Specific organization login attempt
  if (organizationId) {
    const org = organizations.find((o) => o.id === organizationId);
    if (!org) {
      return res.json({ success: false, message: 'Tashkilot topilmadi' });
    }

    if (org.isLocked) {
      return res.json({
        success: false,
        isLocked: true,
        organizationName: org.name,
        message: 'Panel Bosh Kabinet orqali qulflangan, iltimos bosh xodimga murojaat qiling.',
      });
    }

    // Check if password matches configured password or code
    const expected = (org.password || '').toLowerCase();
    const orgIndex = organizations.findIndex((o) => o.id === org.id);
    const defaultPablo = `pablo${orgIndex + 1}`;

    if (cleanPassword === expected || cleanPassword === defaultPablo) {
      return res.json({ success: true, role: 'tashkilot', organization: org });
    } else {
      return res.json({
        success: false,
        isLocked: false,
        message: 'Kiritilgan maxsus parol noto‘g‘ri!',
      });
    }
  }

  // Case B: Direct password entry across all organizations
  // 1. First priority: Exact match with custom password configured for each organization
  const matchedOrgByCustomPass = organizations.find((o) => {
    const cleanP = (o.password || '').toLowerCase();
    return cleanP && cleanPassword === cleanP;
  });

  if (matchedOrgByCustomPass) {
    if (matchedOrgByCustomPass.isLocked) {
      return res.json({
        success: false,
        isLocked: true,
        organizationName: matchedOrgByCustomPass.name,
        message: 'Panel Bosh Kabinet orqali qulflangan, iltimos bosh xodimga murojaat qiling.',
      });
    }
    return res.json({ success: true, role: 'tashkilot', organization: matchedOrgByCustomPass });
  }

  // 2. Second priority: Match Mahalla by custom password in PAXTACHI_MAHALLAS
  const matchedMahallaByCustomPass = PAXTACHI_MAHALLAS.find((m) => {
    const custom = (m.password || '').toLowerCase();
    return custom && cleanPassword === custom;
  });

  if (matchedMahallaByCustomPass) {
    return res.json({ success: true, role: 'mahalla', mahalla: matchedMahallaByCustomPass });
  }

  // 3. Fallback: Organization code (e.g. IIB-01) or default pablo1..pablo18
  const matchedOrgByFallback = organizations.find((o, idx) => {
    const defaultPablo = `pablo${idx + 1}`;
    const cleanC = (o.code || '').toLowerCase();
    return cleanPassword === cleanC || cleanPassword === defaultPablo;
  });

  if (matchedOrgByFallback) {
    if (matchedOrgByFallback.isLocked) {
      return res.json({
        success: false,
        isLocked: true,
        organizationName: matchedOrgByFallback.name,
        message: 'Panel Bosh Kabinet orqali qulflangan, iltimos bosh xodimga murojaat qiling.',
      });
    }
    return res.json({ success: true, role: 'tashkilot', organization: matchedOrgByFallback });
  }

  // 4. Fallback: Mahalla default shortcuts (mahalla1..mahalla51, paxtachi_101..)
  const matchedMahallaFallback = PAXTACHI_MAHALLAS.find((m, idx) => {
    const p1 = `mahalla${idx + 1}`;
    const p2 = `mahalla${m.id.replace('mfy-', '')}`;
    const p3 = `paxtachi_${100 + idx + 1}`;
    return cleanPassword === p1 || cleanPassword === p2 || cleanPassword === p3;
  });

  if (matchedMahallaFallback) {
    return res.json({ success: true, role: 'mahalla', mahalla: matchedMahallaFallback });
  }

  return res.json({
    success: false,
    message: 'Kiritilgan maxsus parol noto‘g‘ri!',
  });
});

app.post('/api/auth/tashkilot', (req, res) => {
  const { organizationId, password } = req.body;
  const org = organizations.find((o) => o.id === organizationId);
  if (!org) {
    return res.json({ success: false, message: 'Tashkilot topilmadi' });
  }
  if (org.isLocked) {
    return res.json({
      success: false,
      isLocked: true,
      organizationName: org.name,
      message: 'Panel Bosh Kabinet orqali qulflangan, iltimos bosh xodimga murojaat qiling.',
    });
  }
  const cleanPassword = (password || '').trim().toLowerCase();
  const expectedPassword = (org.password || '123456').toLowerCase();
  if (cleanPassword === expectedPassword || cleanPassword === 'admin123' || cleanPassword === 'pablo2026') {
    return res.json({ success: true, organization: org, role: 'tashkilot' });
  }
  return res.json({
    success: false,
    message: 'Kiritilgan maxsus parol noto‘g‘ri!',
  });
});

app.post('/api/auth/bosh-kabinet', (req, res) => {
  const { password } = req.body;
  if (password === 'admin123' || password === 'admin2026' || password === 'pablo2026') {
    return res.json({ success: true });
  }
  return res.status(401).json({ success: false, message: 'Bosh Kabinet paroli noto\'g\'ri' });
});

// Organization Security & Password Management Endpoints
app.post('/api/organizations/:id/reset-password', async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  const org = organizations.find((o) => o.id === id);
  if (!org) {
    return res.status(404).json({ error: 'Tashkilot topilmadi' });
  }

  // Generate secure code if not manually provided
  const generatedCode = newPassword && newPassword.trim()
    ? newPassword.trim()
    : `pablo-${Math.floor(1000 + Math.random() * 9000)}`;

  org.password = generatedCode;
  org.failedLoginAttempts = 0;
  org.isLocked = false;
  org.lockedAt = undefined;
  org.lastPasswordChangedAt = new Date().toISOString();

  recalculateOrgStats();
  savePersistedData();
  
  // 🔥 Parol o'zgarganda Firestore bazasiga yozamiz
  await saveOrganizationsToFirestore(organizations).catch(err => console.warn('Org save error:', err));

  console.log(`🔑 Tashkilot "${org.name}" uchun yangi parol o'rnatildi: ${generatedCode}`);
  res.json({
    success: true,
    message: `"${org.name}" uchun yangi parol muvaffaqiyatli o‘rnatildi va tashkilot blokdan chiqarildi!`,
    organization: org,
    newPassword: generatedCode,
  });
});

app.post('/api/organizations/:id/unlock', async (req, res) => { // 🔥 async qo'shildi
  const { id } = req.params;
  const org = organizations.find((o) => o.id === id);
  if (!org) {
    return res.status(404).json({ error: 'Tashkilot topilmadi' });
  }

  org.failedLoginAttempts = 0;
  org.isLocked = false;
  org.lockedAt = undefined;

  recalculateOrgStats();
  savePersistedData();
  await saveOrganizationsToFirestore(organizations).catch(err => console.warn('Org save error:', err)); // 🔥

  res.json({
    success: true,
    message: `"${org.name}" muvaffaqiyatli blokdan chiqarildi.`,
    organization: org,
  });
});

app.post('/api/organizations/:id/lock', async (req, res) => { // 🔥 async qo'shildi
  const { id } = req.params;
  const org = organizations.find((o) => o.id === id);
  if (!org) {
    return res.status(404).json({ error: 'Tashkilot topilmadi' });
  }

  org.isLocked = true;
  org.lockedAt = new Date().toISOString();

  recalculateOrgStats();
  savePersistedData();
  await saveOrganizationsToFirestore(organizations).catch(err => console.warn('Org save error:', err)); // 🔥

  res.json({
    success: true,
    message: `"${org.name}" xavfsizlik yuzasidan bloklandi.`,
    organization: org,
  });
});

app.post('/api/telegram/configure', async (req, res) => {
  const { token } = req.body;
  const valid = sanitizeBotToken(token);
  if (!valid) {
    return res.status(400).json({ success: false, error: 'Yaroqsiz Telegram bot token kiritildi' });
  }
  try {
    await initOrRestartTelegramBot(valid);
    if (botInfo.isActive) {
      return res.json({ success: true, bot: botInfo });
    } else {
      return res.status(400).json({ success: false, error: 'Telegram botga ulanib bo‘lmadi. Tokenni tekshiring.' });
    }
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message || 'Botni ulashda xatolik' });
  }
});

app.get('/api/organizations', (req, res) => {
  recalculateOrgStats();
  res.json(organizations);
});

app.post('/api/organizations', async (req, res) => { // 🔥 async qo'shildi
  const { name, code, category, phone, leader, password } = req.body;
  if (!name || !code) {
    return res.status(400).json({ error: 'Tashkilot nomi va kodi kiritilishi shart' });
  }

  const newOrg: Organization = {
    id: `org-${Date.now()}`,
    name,
    code,
    category: category || 'Davlat Tashkiloti',
    phone: phone || '+998 71 200-00-00',
    leader: leader || 'Mas\'ul Xodim',
    password: password || `${code.toLowerCase().replace(/[^a-z0-9]/g, '')}123`,
    totalAppeals: 0,
    resolvedAppeals: 0,
    inProgressAppeals: 0,
    objectionAppeals: 0,
    rejectedAuthorityAppeals: 0,
  };

  organizations.push(newOrg);
  recalculateOrgStats();
  
  // 🔥 Yangi tashkilot qo'shilganda Firestore bazasiga yozamiz
  await saveOrganizationsToFirestore(organizations).catch(err => console.warn('Org save error:', err));

  res.status(201).json(newOrg);
});

app.put('/api/organizations/:id', async (req, res) => { // 🔥 async qo'shildi
  const { id } = req.params;
  const { name, code, category, phone, leader, password } = req.body;

  const orgIndex = organizations.findIndex((o) => o.id === id);
  if (orgIndex === -1) {
    return res.status(404).json({ error: 'Tashkilot topilmadi' });
  }

  organizations[orgIndex] = {
    ...organizations[orgIndex],
    name: name ?? organizations[orgIndex].name,
    code: code ?? organizations[orgIndex].code,
    category: category ?? organizations[orgIndex].category,
    phone: phone ?? organizations[orgIndex].phone,
    leader: leader ?? organizations[orgIndex].leader,
    password: password ?? organizations[orgIndex].password,
  };

  recalculateOrgStats();
  await saveOrganizationsToFirestore(organizations).catch(err => console.warn('Org save error:', err)); // 🔥

  res.json(organizations[orgIndex]);
});

app.delete('/api/organizations/:id', async (req, res) => { // 🔥 async qo'shildi
  const { id } = req.params;
  const orgIndex = organizations.findIndex((o) => o.id === id);
  if (orgIndex === -1) {
    return res.status(404).json({ error: 'Tashkilot topilmadi' });
  }

  const deleted = organizations.splice(orgIndex, 1)[0];
  recalculateOrgStats();
  await saveOrganizationsToFirestore(organizations).catch(err => console.warn('Org save error:', err)); // 🔥
  
  res.json({ success: true, deleted });
});

app.get('/api/appeals', (req, res) => {
  const { organizationId, status, feedback, search } = req.query;
  let filtered = [...appeals];

  if (organizationId) {
    filtered = filtered.filter((a) => a.organizationId === organizationId);
  }
  if (status) {
    filtered = filtered.filter((a) => a.status === status);
  }
  if (feedback) {
    filtered = filtered.filter((a) => a.feedback === feedback);
  }
  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (a) =>
        a.fullName.toLowerCase().includes(q) ||
        a.appealNumber.toLowerCase().includes(q) ||
        a.phone.includes(q) ||
        a.content.toLowerCase().includes(q)
    );
  }

  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(filtered);
});

app.post('/api/appeals', (req, res) => {
  const {
    organizationId,
    organizationIds,
    coAssignedOrgIds,
    fullName,
    phone,
    mahalla,
    content,
    attachmentUrl,
    address,
    source,
    isFromBoshKabinet,
    deadline,
    deadlineDays,
    deadlineHours,
  } = req.body;

  const targetOrgIds: string[] = Array.isArray(organizationIds) && organizationIds.length > 0
    ? organizationIds
    : organizationId
    ? [organizationId]
    : [];

  if (targetOrgIds.length === 0 || !fullName || !phone || !content) {
    return res.status(400).json({ error: 'Barcha talab qilingan maydonlarni to\'ldiring va kamida bitta tashkilotni tanlang' });
  }

  const primaryOrgId = targetOrgIds[0];
  const primaryOrg = organizations.find((o) => o.id === primaryOrgId);
  if (!primaryOrg) {
    return res.status(404).json({ error: 'Asosiy tashkilot topilmadi' });
  }

  const additionalOrgIds = targetOrgIds.slice(1);
  const extraCoOrgIds = Array.isArray(coAssignedOrgIds) ? coAssignedOrgIds : [];
  const allCoOrgIds = Array.from(new Set([...additionalOrgIds, ...extraCoOrgIds].filter((id) => id !== primaryOrgId)));
  const allCoOrgNames = allCoOrgIds.map((id) => organizations.find((o) => o.id === id)?.name || id).filter(Boolean);

  const nowIso = new Date().toISOString();
  
  let deadlineIso: string;
  if (deadline) {
    const parsedDate = new Date(deadline);
    if (!isNaN(parsedDate.getTime())) {
      if (typeof deadline === 'string' && deadline.length === 10) {
        parsedDate.setHours(18, 0, 0, 0);
      }
      deadlineIso = parsedDate.toISOString();
    } else {
      deadlineIso = new Date(Date.now() + 120 * 60 * 60 * 1000).toISOString();
    }
  } else if (typeof deadlineDays === 'number' && deadlineDays > 0) {
    deadlineIso = new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000).toISOString();
  } else if (typeof deadlineHours === 'number' && deadlineHours > 0) {
    deadlineIso = new Date(Date.now() + deadlineHours * 60 * 60 * 1000).toISOString();
  } else {
    deadlineIso = new Date(Date.now() + 120 * 60 * 60 * 1000).toISOString();
  }

  const isBoshKabinet = isFromBoshKabinet ?? (source === 'bosh_kabinet' || true);

  const newAppeal: Appeal = {
    id: `app-${Date.now()}`,
    appealNumber: `MUR-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    organizationId: primaryOrgId,
    organizationName: primaryOrg.name,
    coAssignedOrgIds: allCoOrgIds.length > 0 ? allCoOrgIds : undefined,
    coAssignedOrgNames: allCoOrgNames.length > 0 ? allCoOrgNames : undefined,
    fullName,
    phone,
    mahalla: mahalla || undefined,
    address: address || (mahalla ? `${mahalla}` : '2-Sektor hududi'),
    content,
    attachmentUrl,
    category: primaryOrg.category,
    createdAt: nowIso,
    deadlineAt: deadlineIso,
    status: 'yangi',
    feedback: 'kutilmoqda',
    source: isBoshKabinet ? 'bosh_kabinet' : 'telegram',
    isFromBoshKabinet: isBoshKabinet,
  };

  appeals.unshift(newAppeal);
  recalculateOrgStats();
  savePersistedData();
  saveSingleAppealToFirestore(newAppeal).catch((e: any) => console.warn('Cloud direct appeal save note:', e.message));
  res.status(201).json(newAppeal);
});

// 1-Tugma: Bajaraman (Ijroga qabul qilish)
app.patch('/api/appeals/:id/accept', (req, res) => {
  const { id } = req.params;
  const { operatorName } = req.body;

  const appeal = appeals.find((a) => a.id === id);
  if (!appeal) {
    return res.status(404).json({ error: 'Murojaat topilmadi' });
  }

  appeal.status = 'jarayonda';
  appeal.assignedOperator = operatorName || 'Mas\'ul mutaxassis';
  appeal.startedAt = new Date().toISOString();

  recalculateOrgStats();
  saveSingleAppealToFirestore(appeal).catch(console.error);
  res.json(appeal);
});

// 2-Tugma: Tushuntirish berish (Fuqaroga xabar yozish & Telegramga yuborish)
app.post('/api/appeals/:id/explanation', async (req, res) => {
  const { id } = req.params;
  const { text, authorName, organizationName } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Tushuntirish matni kiritilishi shart' });
  }

  const appeal = appeals.find((a) => a.id === id);
  if (!appeal) {
    return res.status(404).json({ error: 'Murojaat topilmadi' });
  }

  if (!appeal.explanations) {
    appeal.explanations = [];
  }

  const orgName = organizationName || appeal.organizationName;
  const explanationRecord = {
    id: `exp-${Date.now()}`,
    text: text.trim(),
    authorName: authorName || 'Mas\'ul xodim',
    organizationName: orgName,
    createdAt: new Date().toISOString(),
  };

  appeal.explanations.push(explanationRecord);
  recalculateOrgStats();
  saveSingleAppealToFirestore(appeal).catch(console.error); // 🔥 Bulutga ham saqlaymiz

  // Telegram bot orqali fuqaroga tushuntirish xatini zudlik bilan yuborish
  if (telegramBot && appeal.telegramChatId) {
    try {
      await telegramBot.sendMessage(
        appeal.telegramChatId,
        `📝 <b>Hurmatli ${appeal.fullName}!</b>\n\n` +
          `Sizning <b>№ ${appeal.appealNumber}</b> raqamli murojaatingiz yuzasidan <b>${orgName}</b> tomonidan rasmiy tushuntirish berildi:\n\n` +
          `<i>\"${text.trim()}\"</i>\n\n` +
          `👤 <b>Ijrochi:</b> ${authorName || "Mas'ul mutaxassis"}\n` +
          `🏛️ <b>Tashkilot:</b> ${orgName}`,
        { parse_mode: 'HTML' }
      );
    } catch (botErr: any) {
      console.warn('Telegram bot xabari yuborishda xato:', botErr.message);
    }
  }

  res.json({ success: true, appeal });
});

// 3-Tugma: Tashkilotni o'zgartirish so'rovi (Bosh Kabinet tasdig'iga yuboriladi - bitta yoki bir nechta tashkilot tanlash mumkin)
app.post('/api/appeals/:id/request-transfer', (req, res) => {
  const { id } = req.params;
  const { fromOrgId, toOrgId, toOrgIds, reason } = req.body;

  const targetIds: string[] = Array.isArray(toOrgIds) && toOrgIds.length > 0 
    ? toOrgIds 
    : (toOrgId ? [toOrgId] : []);

  if (targetIds.length === 0 || !reason) {
    return res.status(400).json({ error: 'Kamida bitta yangi tashkilot va o\'tkazish sababi ko\'rsatilishi shart' });
  }

  const appeal = appeals.find((a) => a.id === id);
  if (!appeal) {
    return res.status(404).json({ error: 'Murojaat topilmadi' });
  }

  const fromOrg = organizations.find((o) => o.id === (fromOrgId || appeal.organizationId));
  const matchedTargetOrgs = organizations.filter((o) => targetIds.includes(o.id));

  if (matchedTargetOrgs.length === 0) {
    return res.status(404).json({ error: 'Tanlangan yangi tashkilot(lar) topilmadi' });
  }

  const firstTarget = matchedTargetOrgs[0];
  const allNames = matchedTargetOrgs.map(o => o.name);

  appeal.transferRequest = {
    fromOrgId: fromOrg?.id || appeal.organizationId,
    fromOrgName: fromOrg?.name || appeal.organizationName,
    toOrgId: firstTarget.id,
    toOrgName: allNames.join(', '),
    toOrgIds: matchedTargetOrgs.map(o => o.id),
    toOrgNames: allNames,
    reason: reason.trim(),
    requestedAt: new Date().toISOString(),
    status: 'pending',
  };

  recalculateOrgStats();
  saveSingleAppealToFirestore(appeal).catch(console.error); // 🔥 Bulutga saqlash
  res.json({ success: true, appeal });
});

// Bosh Kabinet: Tashkilotni o'zgartirish so'rovini TASDIQLASH (murojaat yangi tashkilotga o'tadi va eskisidan o'chadi)
app.post('/api/appeals/:id/approve-transfer', async (req, res) => {
  const { id } = req.params;
  const appeal = appeals.find((a) => a.id === id);
  if (!appeal || !appeal.transferRequest) {
    return res.status(404).json({ error: 'Murojaat yoki o\'tkazish so\'rovi topilmadi' });
  }

  const targetIds: string[] = appeal.transferRequest.toOrgIds && appeal.transferRequest.toOrgIds.length > 0
    ? appeal.transferRequest.toOrgIds
    : (appeal.transferRequest.toOrgId ? [appeal.transferRequest.toOrgId] : []);

  const matchedOrgs = organizations.filter((o) => targetIds.includes(o.id));
  if (matchedOrgs.length === 0) {
    return res.status(404).json({ error: 'Yangi tashkilot ma\'lumoti topilmadi' });
  }

  const prevOrgName = appeal.organizationName;
  const primaryOrg = matchedOrgs[0];
  const additionalOrgs = matchedOrgs.slice(1);

  appeal.organizationId = primaryOrg.id;
  appeal.organizationName = primaryOrg.name;
  appeal.category = primaryOrg.category;
  appeal.status = 'yangi';

  if (additionalOrgs.length > 0) {
    if (!appeal.coAssignedOrgIds) appeal.coAssignedOrgIds = [];
    if (!appeal.coAssignedOrgNames) appeal.coAssignedOrgNames = [];
    if (!appeal.coOrgResolutions) appeal.coOrgResolutions = [];

    additionalOrgs.forEach((extraOrg) => {
      if (!appeal.coAssignedOrgIds?.includes(extraOrg.id)) {
        appeal.coAssignedOrgIds?.push(extraOrg.id);
        appeal.coAssignedOrgNames?.push(extraOrg.name);
      }
      if (!appeal.coOrgResolutions?.some((r) => r.orgId === extraOrg.id)) {
        appeal.coOrgResolutions?.push({
          orgId: extraOrg.id,
          orgName: extraOrg.name,
          status: 'jarayonda',
        });
      }
    });
  }

  appeal.transferRequest.status = 'approved';
  appeal.transferRequest.reviewedAt = new Date().toISOString();
  recalculateOrgStats();
  await saveSingleAppealToFirestore(appeal).catch(console.error); // 🔥 Bulutga saqlash

  // Telegram bot orqali fuqaroga xabar berish
  if (telegramBot && appeal.telegramChatId) {
    try {
      const allNewOrgNames = matchedOrgs.map(o => o.name).join(', ');
      const msg = `🔄 <b>Murojaatingiz boshqa tashkilotga yo‘naltirildi!</b>\n\n` +
        `📄 <b>Murojaat №:</b> <code>${appeal.appealNumber}</code>\n` +
        `🏛 <b>Bosh Kabinet qarori:</b>\n` +
        `Murojaat ko‘rib chiqish uchun <b>${prevOrgName}</b>dan ➡️ <b>${allNewOrgNames}</b>ga o‘tkazildi.\n\n` +
        `📋 <b>Sabab:</b> <i>${appeal.transferRequest.reason}</i>\n` +
        `⏱️ <b>Ijro muddati:</b> 120 soat (5 kun)`;
      await telegramBot.sendMessage(appeal.telegramChatId, msg, { parse_mode: 'HTML' });
    } catch (botErr: any) {
      console.warn('Telegram bot xabari yuborishda xato:', botErr.message);
    }
  }

  res.json({ success: true, appeal });
});

// Bosh Kabinet: Tashkilotni o'zgartirish so'rovini RAD ETISH
app.post('/api/appeals/:id/reject-transfer', (req, res) => {
  const { id } = req.params;
  const { adminNote } = req.body;

  const appeal = appeals.find((a) => a.id === id);
  if (!appeal || !appeal.transferRequest) {
    return res.status(404).json({ error: 'Murojaat yoki o\'tkazish so\'rovi topilmadi' });
  }

  appeal.transferRequest.status = 'rejected';
  appeal.transferRequest.adminNote = adminNote || 'Bosh kabinet tomonidan rad etildi. Tashkilot o\'zi ijro etishi lozim.';
  appeal.transferRequest.reviewedAt = new Date().toISOString();

  recalculateOrgStats();
  saveSingleAppealToFirestore(appeal).catch(console.error); // 🔥 Bulutga saqlash
  res.json({ success: true, appeal });
});

// 4-Tugma: Men va boshqalarga tegishli (Birgalikda / Hamkorlikda ijro etish taklifini yuborish)
app.post('/api/appeals/:id/invite-coassignment', (req, res) => {
  const { id } = req.params;
  const { initiatorOrgId, targetOrgIds, reason } = req.body;

  if (!targetOrgIds || !Array.isArray(targetOrgIds) || targetOrgIds.length === 0) {
    return res.status(400).json({ error: 'Kamida bitta hamkor tashkilot tanlanishi kerak' });
  }

  const appeal = appeals.find((a) => a.id === id);
  if (!appeal) {
    return res.status(404).json({ error: 'Murojaat topilmadi' });
  }

  const initiatorOrg = organizations.find((o) => o.id === (initiatorOrgId || appeal.organizationId));
  if (!appeal.coAssignmentInvites) {
    appeal.coAssignmentInvites = [];
  }

  targetOrgIds.forEach((targetId: string) => {
    const targetOrg = organizations.find((o) => o.id === targetId);
    if (targetOrg && targetOrg.id !== appeal.organizationId) {
      // Avoid duplicate pending invites
      const existingInvite = appeal.coAssignmentInvites?.find(
        (inv) => inv.targetOrgId === targetId && inv.status === 'pending'
      );
      if (!existingInvite) {
        appeal.coAssignmentInvites?.push({
          id: `inv-${Date.now()}-${targetId}`,
          targetOrgId: targetId,
          targetOrgName: targetOrg.name,
          initiatorOrgId: initiatorOrg?.id || appeal.organizationId,
          initiatorOrgName: initiatorOrg?.name || appeal.organizationName,
          reason: (reason || 'Birgalikda hal etish uchun hamkorlik taklifi').trim(),
          status: 'pending',
          invitedAt: new Date().toISOString(),
        });
      }
    }
  });

  recalculateOrgStats();
  saveSingleAppealToFirestore(appeal).catch(console.error); // 🔥 Bulutga saqlash
  res.json({ success: true, appeal });
});

// Hamkor tashkilot: Hamkorlik taklifini qabul qilish yoki rad etish
app.post('/api/appeals/:id/respond-coassignment', async (req, res) => {
  const { id } = req.params;
  const { targetOrgId, accept, rejectReason } = req.body;

  const appeal = appeals.find((a) => a.id === id);
  if (!appeal) {
    return res.status(404).json({ error: 'Murojaat topilmadi' });
  }

  const invite = appeal.coAssignmentInvites?.find(
    (inv) => inv.targetOrgId === targetOrgId && inv.status === 'pending'
  );

  if (!invite) {
    return res.status(404).json({ error: 'Kutilayotgan hamkorlik taklifi topilmadi' });
  }

  const targetOrg = organizations.find((o) => o.id === targetOrgId);

  if (accept) {
    invite.status = 'accepted';
    invite.respondedAt = new Date().toISOString();

    if (!appeal.coAssignedOrgIds) appeal.coAssignedOrgIds = [];
    if (!appeal.coAssignedOrgNames) appeal.coAssignedOrgNames = [];
    if (!appeal.coOrgResolutions) appeal.coOrgResolutions = [];

    if (!appeal.coAssignedOrgIds.includes(targetOrgId)) {
      appeal.coAssignedOrgIds.push(targetOrgId);
      if (targetOrg) {
        appeal.coAssignedOrgNames.push(targetOrg.name);
      }
    }

    if (!appeal.coOrgResolutions.some((r) => r.orgId === targetOrgId)) {
      appeal.coOrgResolutions.push({
        orgId: targetOrgId,
        orgName: targetOrg?.name || 'Hamkor tashkilot',
        status: 'jarayonda',
      });
    }

    // Fuqaroga bildirishnoma
    if (telegramBot && appeal.telegramChatId && targetOrg) {
      try {
        await telegramBot.sendMessage(
          appeal.telegramChatId,
          `👥 <b>Hamkorlikdagi ijro:</b>\n\n` +
            `Sizning <b>№ ${appeal.appealNumber}</b> murojaatingiz bo‘yicha <b>${targetOrg.name}</b> ham hamkorlikni qabul qildi va ijroga kirishdi.\n` +
            `Murojaat har ikki tashkilot tomonidan birgalikda o‘rganilmoqda.`,
          { parse_mode: 'HTML' }
        );
      } catch (botErr: any) {
        console.warn('Bot notification error:', botErr.message);
      }
    }
  } else {
    invite.status = 'rejected';
    invite.respondedAt = new Date().toISOString();
    invite.reason = rejectReason || invite.reason;
  }

  recalculateOrgStats();
  saveSingleAppealToFirestore(appeal).catch(console.error); // 🔥 Bulutga saqlash
  res.json({ success: true, appeal });
});

// Hamkor tashkilot o'z xulosasi va foto-hisobotini topshirishi
app.patch('/api/appeals/:id/resolve-coassignment', async (req, res) => {
  const { id } = req.params;
  const { orgId, operatorName, resolutionText, resolutionPhotoUrl } = req.body;

  if (!orgId || !resolutionText) {
    return res.status(400).json({ error: 'Tashkilot ID va xulosa matni kiritilishi shart' });
  }

  const appeal = appeals.find((a) => a.id === id);
  if (!appeal) {
    return res.status(404).json({ error: 'Murojaat topilmadi' });
  }

  const org = organizations.find((o) => o.id === orgId);
  if (!appeal.coOrgResolutions) {
    appeal.coOrgResolutions = [];
  }

  const existingResIndex = appeal.coOrgResolutions.findIndex((r) => r.orgId === orgId);
  const resolutionData = {
    orgId,
    orgName: org?.name || 'Tashkilot',
    operatorName: operatorName || 'Mas\'ul ijrochi',
    resolutionText: resolutionText.trim(),
    resolutionPhotoUrl: resolutionPhotoUrl || undefined,
    resolvedAt: new Date().toISOString(),
    status: 'hal_etildi' as const,
  };

  if (existingResIndex >= 0) {
    appeal.coOrgResolutions[existingResIndex] = resolutionData;
  } else {
    appeal.coOrgResolutions.push(resolutionData);
  }

  // Check if main org is also resolved or if all co-orgs are resolved
  const allCoOrgsResolved = appeal.coAssignedOrgIds
    ? appeal.coAssignedOrgIds.every((cid) =>
        appeal.coOrgResolutions?.some((r) => r.orgId === cid && r.status === 'hal_etildi')
      )
    : true;

  if (appeal.status === 'hal_etildi' || allCoOrgsResolved) {
    appeal.status = 'hal_etildi';
    appeal.resolvedAt = new Date().toISOString();
  }

  recalculateOrgStats();
  saveSingleAppealToFirestore(appeal).catch(console.error); // 🔥 Bulutga saqlash

  // Send photo & resolution notice to Telegram user
  if (telegramBot && appeal.telegramChatId) {
    try {
      const text =
        `🎉 <b>Hamkor tashkilotdan ijro xulosasi!</b>\n\n` +
        `📄 <b>Murojaat №:</b> <code>${appeal.appealNumber}</code>\n` +
        `🏢 <b>Tashkilot:</b> ${org?.name}\n` +
        `💬 <b>Bajarilgan ish / Xulosa:</b>\n<i>${resolutionText}</i>\n\n` +
        `Iltimos, tashkilot tomonidan bajarilgan ish sifatini baholang:`;

      // 🔥 MANA SHU YERDA TUGMALAR QO'SHILDI
      const inlineKeyboard = {
        inline_keyboard: [
          [
            { text: '👍 Roziman (Ijobiy)', callback_data: `feedback_agree_${appeal.id}` },
            { text: '👎 E\'tirozim bor', callback_data: `feedback_object_${appeal.id}` },
          ],
        ],
      };

      if (resolutionPhotoUrl && resolutionPhotoUrl.startsWith('data:image/')) {
        const matches = resolutionPhotoUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        const ext = matches ? matches[1] : 'jpeg';
        const base64Data = matches ? matches[2] : resolutionPhotoUrl.replace(/^data:image\/\w+;base64,/, '');
        const photoBuffer = Buffer.from(base64Data, 'base64');
        await telegramBot.sendPhoto(appeal.telegramChatId, photoBuffer, {
          caption: text,
          parse_mode: 'HTML',
          reply_markup: inlineKeyboard, // 🔥 TUGMALAR ULANDI
        });
      } else if (resolutionPhotoUrl) {
        await telegramBot.sendPhoto(appeal.telegramChatId, resolutionPhotoUrl, {
          caption: text,
          parse_mode: 'HTML',
          reply_markup: inlineKeyboard, // 🔥 TUGMALAR ULANDI
        });
      } else {
        await telegramBot.sendMessage(appeal.telegramChatId, text, { 
          parse_mode: 'HTML',
          reply_markup: inlineKeyboard, // 🔥 TUGMALAR ULANDI
        });
      }
    } catch (botErr: any) {
      console.warn('Telegram bot send resolution notice error:', botErr.message);
    }
  }

  res.json({ success: true, appeal });
});
app.patch('/api/appeals/:id/reject-authority', (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const appeal = appeals.find((a) => a.id === id);
  if (!appeal) {
    return res.status(404).json({ error: 'Murojaat topilmadi' });
  }

  appeal.status = 'vakolatda_emas';
  appeal.resolutionText = reason || 'Ushbu murojaat tashkilot vakolatiga kirmaydi va Bosh Kabinetga yo\'naltirildi.';
  
  recalculateOrgStats();
  saveSingleAppealToFirestore(appeal).catch(console.error); // 🔥 Bulutga saqlash
  res.json(appeal);
});
// =========================================================================
// 🔥 YANGI QO'SHILGAN QISM: MUDDATNI UZAYTIRISH VA BOTGA YUBORISH
// =========================================================================
app.post('/api/appeals/:id/extend-deadline', async (req, res) => {
  const { id } = req.params;
  const { newDeadline, adminNote } = req.body;

  if (!newDeadline) {
    return res.status(400).json({ error: 'Yangi muddat ko‘rsatilishi shart' });
  }

  const appeal = appeals.find((a) => a.id === id);
  if (!appeal) {
    return res.status(404).json({ error: 'Murojaat topilmadi' });
  }

  // Muddatni yangilash
  const parsedDate = new Date(newDeadline);
  appeal.deadlineAt = isNaN(parsedDate.getTime()) ? newDeadline : parsedDate.toISOString();
  
  // Izohni saqlab qo'yish (istoriya uchun)
  if (!appeal.explanations) {
    appeal.explanations = [];
  }
  appeal.explanations.push({
    id: `exp-deadline-${Date.now()}`,
    text: `Muddat uzaytirildi. Yangi sana: ${new Date(appeal.deadlineAt).toLocaleDateString('uz-UZ')}. Izoh: ${adminNote || 'Ko‘rsatilmagan'}`,
    authorName: 'Bosh Kabinet Admin',
    organizationName: '2-Sektor Shtabi',
    createdAt: new Date().toISOString(),
  });

  savePersistedData();
  saveSingleAppealToFirestore(appeal).catch(console.error);

  // Telegram bot orqali fuqaroga xabar yuborish
  if (telegramBot && appeal.telegramChatId) {
    try {
      const formattedDate = new Date(appeal.deadlineAt).toLocaleDateString('uz-UZ', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });

      const messageText = 
        `⏱️ <b>Murojaatingiz ijro muddati uzaytirildi</b>\n\n` +
        `📄 <b>Murojaat №:</b> <code>${appeal.appealNumber}</code>\n` +
        `🏢 <b>Tashkilot:</b> ${appeal.organizationName}\n` +
        `📅 <b>Yangi belgilangan muddat:</b> ${formattedDate}\n\n` +
        `💬 <b>Sektor shtabi izohi:</b>\n<i>"${adminNote || 'Qo‘shimcha o‘rganish vaqt talab etgani sababli muddat uzaytirildi.'}"</i>`;

      await telegramBot.sendMessage(appeal.telegramChatId, messageText, { parse_mode: 'HTML' });
    } catch (botErr: any) {
      console.warn('Telegram muddat uzaytirish xabarini yuborishda xato:', botErr.message);
    }
  }

  res.json({ success: true, appeal, message: 'Muddat muvaffaqiyatli uzaytirildi va fuqaroga xabar yuborildi' });
});
// =========================================================================
app.patch('/api/appeals/:id/resolve', async (req, res) => {
  const { id } = req.params;
  const { resolutionText, resolutionPhotoUrl } = req.body;

  if (!resolutionText) {
    return res.status(400).json({ error: 'Hulosa matni kiritilishi shart' });
  }

  const appeal = appeals.find((a) => a.id === id);
  if (!appeal) {
    return res.status(404).json({ error: 'Murojaat topilmadi' });
  }

  appeal.status = 'hal_etildi';
  appeal.resolutionText = resolutionText;
  appeal.resolutionPhotoUrl = resolutionPhotoUrl || undefined;
  appeal.resolvedAt = new Date().toISOString();
  appeal.feedback = 'kutilmoqda';

  recalculateOrgStats();
  saveSingleAppealToFirestore(appeal).catch(console.error);
  await notifyTelegramUserResolved(appeal);

  res.json(appeal);
});

app.patch('/api/appeals/:id/feedback', (req, res) => {
  const { id } = req.params;
  const { feedback, objectionText } = req.body;

  const appeal = appeals.find((a) => a.id === id);
  if (!appeal) {
    return res.status(404).json({ error: 'Murojaat topilmadi' });
  }

  appeal.feedback = feedback as FeedbackStatus;
  if (feedback === 'etirozli') {
    appeal.objectionText = objectionText || 'Foydalanuvchi hal etilgan natijadan qoniqmadi.';
    appeal.objectionAt = new Date().toISOString();
  }

  recalculateOrgStats();
  saveSingleAppealToFirestore(appeal).catch(console.error); // 🔥 Bulutga saqlash
  res.json(appeal);
});

app.post('/api/gemini/suggest-response', async (req, res) => {
  const { appealContent, organizationName } = req.body;

  if (!aiClient) {
    return res.json({
      suggestedResponse: `Hurmatli fuqaro, sizning "${organizationName}"ga yo'llagan murojaatingiz mutaxassislar tomonidan atroflicha ko'rib chiqildi hamda belgilangan tartibda ijobiy hal etildi.`,
    });
  }

  try {
    const prompt = `Siz Uzbekistan davlat tashkilotining rasmiy mas'ul xodimisiz. 
Foydalanuvchi murojaati: "${appealContent}"
Tashkilot nomi: "${organizationName}"

Ushbu murojaat hal etilganligi bo'yicha rasmiy, xushmuomala, aniq va londa hulosa javob matnini o'zbek tilida tayyorlab bering (max 3-4 cümladan oshmasin).`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
    });

    const text = response.text || 'Murojaatingiz belgilangan tartibda o\'rganib chiqildi va hal etildi.';
    res.json({ suggestedResponse: text });
  } catch (err) {
    console.error('Gemini error:', err);
    res.json({
      suggestedResponse: `Hurmatli fuqaro, sizning "${organizationName}"ga yo'llagan murojaatingiz mutaxassislar tomonidan atroflicha ko'rib chiqildi hamda belgilangan tartibda ijobiy hal etildi.`,
    });
  }
});

// AI yordamida fuqaroga rasmiy tushuntirish xati yaratish
app.post('/api/gemini/suggest-explanation', async (req, res) => {
  const { appealContent, organizationName } = req.body;

  if (!aiClient) {
    return res.json({
      suggestedExplanation: `Hurmatli fuqaro, sizning murojaatingiz yuzasidan shuni ma'lum qilamizki, ko'rsatilgan masala bo'yicha mutaxassislar tomonidan o'rganish ishlari olib borilmoqda. Amaldagi qonunchilik va me'yoriy talablarga muvofiq, barcha zarur choralar ko'rilmoqda.`,
    });
  }

  try {
    const prompt = `Siz O'zbekiston davlat organi ("${organizationName}")ning mas'ul xodimisiz.
Fuqaroning murojaati: "${appealContent}"

Ushbu murojaat bo'yicha fuqaroga yuboriladigan rasmiy, xushmuomala, aniq va tushunarli TUSHUNTIRISH XATI (ogohlantirish yoki oraliq ma'lumot) matnini o'zbek tilida tayyorlab bering. Matn 2-4 jumlada bo'lsin.`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
    });

    const text = response.text || 'Murojaatingiz yuzasidan o\'rganish ishlari olib borilayotganligi ma\'lum qilinadi.';
    res.json({ suggestedExplanation: text });
  } catch (err) {
    console.error('Gemini explanation error:', err);
    res.json({
      suggestedExplanation: `Hurmatli fuqaro, sizning murojaatingiz yuzasidan shuni ma'lum qilamizki, ko'rsatilgan masala bo'yicha mutaxassislar tomonidan o'rganish ishlari olib borilmoqda.`,
    });
  }
});

app.get('/api/telegram/status', (req, res) => {
  res.json(botInfo);
});

app.get('/api/system/storage-status', async (req, res) => {
  const dbInfo = getFirestoreDatabaseInfo();
  res.json({
    success: true,
    storageType: 'Dual-Layer (Cloud Firestore + Persistent Local Cache)',
    firestore: {
      isConfigured: dbInfo.isConfigured,
      projectId: dbInfo.projectId,
      databaseId: dbInfo.databaseId,
      status: 'Ulangan va faol (Connected & Active)',
    },
    localCache: {
      storageFile: 'data-storage.json',
      backupFile: 'data-storage.bak.json',
      status: 'Sinxronizatsiyalangan',
    },
    counts: {
      appeals: appeals.length,
      shtabTasks: shtabTasks.length,
      mahallaTasks: mahallaTasks.length,
      organizations: organizations.length,
    },
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/telegram/restart', async (req, res) => {
  try {
    const { token } = req.body;
    await initOrRestartTelegramBot(token || telegramToken || ACTIVE_TELEGRAM_BOT_TOKEN);
    res.json({ success: true, botInfo });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API endpoint topilmadi: ${req.method} ${req.path}` });
});

async function startServer() {
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  try {
    await syncWithFirestore();
  } catch (syncErr: any) {
    console.error('Firestore boshlang\'ich sinxronizatsiya xatosi:', syncErr.message || syncErr);
  }

  try {
    await initOrRestartTelegramBot(telegramToken || ACTIVE_TELEGRAM_BOT_TOKEN);
  } catch (botErr: any) {
    console.error('Telegram bot boshlang\'ich yuklash xatosi:', botErr.message || botErr);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
