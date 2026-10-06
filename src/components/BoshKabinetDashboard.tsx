import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ThumbsDown,
  Search,
  Plus,
  Image,
  Eye,
  EyeOff,
  User,
  Phone,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Filter,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Database,
  Download,
  Upload,
  HardDrive,
  Check,
  RefreshCw,
  Repeat,
  Users,
  CheckSquare,
  MessageSquare,
  X,
  Home,
  FileText,
  BarChart3,
  PieChart,
  Bell,
  Headphones,
  MapPin,
  TrendingUp,
  XCircle,
  CheckCircle,
  Calendar,
  Layers,
  Send,
  ExternalLink,
  Bot,
  Key,
  Trash2,
  Printer,
  Copy,
  ArrowRightLeft,
  Inbox,
  CheckCheck,
  Share2,
  KeyRound,
  Lock,
  Unlock,
  Shield,
  Briefcase,
  Award,
  Zap,
  FileCheck2,
  FileQuestion,
  HelpCircle,
  FolderOpen,
  ArrowLeft,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowUp,
  ArrowDown,
  Monitor,
  Sun,
  Moon,
} from 'lucide-react';
import { Organization, Appeal, BotStatusInfo, ShtabTask, MahallaTask } from '../types';
import { PAXTACHI_MAHALLAS, MahallaInfo } from '../data/mahallasData';
import { DEFAULT_SEKTOR_TASKS, IIB_7_TASKS, ORG_DEFAULT_TASKS, NON_SHTAB_TASK_ORG_IDS } from '../data/initialData';
import { MahallaYettiligiSection } from './MahallaYettiligiSection';

interface BoshKabinetDashboardProps {
  organizations: Organization[];
  appeals: Appeal[];
  tasks?: ShtabTask[];
  mahallaTasks?: MahallaTask[];
  onAddOrganization: (orgData: { name: string; code: string; category: string; phone: string; leader: string; password?: string }) => Promise<void>;
  onApproveTransfer: (appealId: string) => Promise<void>;
  onRejectTransfer: (appealId: string, adminNote?: string) => Promise<void>;
  onSeed7Tasks?: (targetOrgId?: string, deadlineDays?: number) => Promise<void>;
  onSeedAllTasks?: (deadlineDays?: number) => Promise<void>;
  onCreateTask?: (taskData: {
    title: string;
    description: string;
    targetOrgId?: string;
    targetOrgIds?: string[];
    deadline?: string;
    category?: string;
  }) => Promise<void>;
  onApproveTask?: (taskId: string, adminFeedback?: string) => Promise<void>;
  onRejectTask?: (taskId: string, adminFeedback?: string) => Promise<void>;
  onDeleteTask?: (taskId: string) => Promise<void>;
  onSendMahallaTask?: (taskData: {
    title: string;
    description: string;
    targetRole: string;
    mahallaId: string;
    targetOrgId?: string;
    targetOrgName?: string;
    deadline?: string;
    category?: string;
  }) => Promise<void>;
  onSeedAllMahallaTasks?: (deadlineDays?: number) => Promise<void>;
  onApproveMahallaTask?: (taskId: string, approverNote?: string) => Promise<void>;
  onRejectMahallaTask?: (taskId: string, approverNote?: string) => Promise<void>;
  onDeleteMahallaTask?: (taskId: string) => Promise<void>;
  isLoading: boolean;
  onRefresh?: () => Promise<void>;
  onLogout?: () => void;
  onOpenMonitor?: () => void;
  botStatus?: BotStatusInfo;
}

type NavTab = 'dashboard' | 'appeals' | 'notifications' | 'tashkilotlar' | 'tasks' | 'mahalla_yettiligi';

export const BoshKabinetDashboard: React.FC<BoshKabinetDashboardProps> = ({
  organizations,
  appeals,
  tasks = [],
  mahallaTasks = [],
  onAddOrganization,
  onApproveTransfer,
  onRejectTransfer,
  onSeed7Tasks,
  onSeedAllTasks,
  onCreateTask,
  onApproveTask,
  onRejectTask,
  onDeleteTask,
  onSendMahallaTask,
  onSeedAllMahallaTasks,
  onApproveMahallaTask,
  onRejectMahallaTask,
  onDeleteMahallaTask,
  isLoading,
  onRefresh,
  onLogout,
  onOpenMonitor,
  botStatus = { isActive: true, botUsername: 'sektor_murojaatlar_bot' },
}) => {
  // Navigation tab
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  // Sidebar collapsible state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Dark / Light Theme state - Default to Dark Mode
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('nazorat_theme_bk') || localStorage.getItem('nazorat_global_theme');
      return saved !== 'light';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('nazorat_theme_bk', next ? 'dark' : 'light');
        localStorage.setItem('nazorat_global_theme', next ? 'dark' : 'light');
      } catch {}
      return next;
    });
  };

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string>('all');
  const [selectedMahallaFilter, setSelectedMahallaFilter] = useState<string>('all');

  // Tasks Filter & State - 18 ta Tashkilot Drill-Down Ko'rinishi
  const [selectedOrgForTasks, setSelectedOrgForTasks] = useState<Organization | null>(null);
  const [taskStatusFilter, setTaskStatusFilter] = useState<'all' | 'yangi' | 'jarayonda' | 'tekshiruvda' | 'tasdiqlandi' | 'qaytarildi'>('all');
  const [taskOrgFilter, setTaskOrgFilter] = useState<string>('all');
  const [taskSearch, setTaskSearch] = useState('');
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<ShtabTask | null>(null);
  const [taskAdminFeedback, setTaskAdminFeedback] = useState('');
  const [isSeedingTasks, setIsSeedingTasks] = useState(false);

  // New Custom Task Form State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskTargetOrgIds, setNewTaskTargetOrgIds] = useState<string[]>(['all']);
  const [newTaskOrgSearch, setNewTaskOrgSearch] = useState('');
  const [newTaskDeadlineType, setNewTaskDeadlineType] = useState<'preset' | 'custom'>('preset');
  const [newTaskDeadlineDays, setNewTaskDeadlineDays] = useState<number>(15);
  const [newTaskDeadline, setNewTaskDeadline] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState('Sektor Maxsus Vazifasi');

  // Notifications Search & Filter
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'pending' | 'bk_resolved' | 'transfers' | 'coassignments' | 'resolved'>('all');
  const [notificationSearch, setNotificationSearch] = useState('');

  // Tashkilotlar & Security Filter & Search
  const [securityFilter, setSecurityFilter] = useState<'all' | 'locked' | 'warning' | 'clean'>('all');
  const [securitySearch, setSecuritySearch] = useState('');
  const [securityCategoryFilter, setSecurityCategoryFilter] = useState('all');

  // Reset Password Modal
  const [resetPasswordModalOrg, setResetPasswordModalOrg] = useState<Organization | null>(null);
  const [customNewPassword, setCustomNewPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Pagination for Dashboard Recent Table
  const [dashboardPage, setDashboardPage] = useState(1);
  const [appealsPage, setAppealsPage] = useState(1);

  // Selected Appeal for Detail Modal
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);

  // Sorting order for Appeals: 'newest' (newest first, desc) | 'oldest' (oldest first, asc)
  const [appealSortOrder, setAppealSortOrder] = useState<'newest' | 'oldest'>('newest');

  // Modals & Drawers
  const [showAddAppealModal, setShowAddAppealModal] = useState(false);
  const [showAddOrgModal, setShowAddOrgModal] = useState(false);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);

  // All Mahallas & All Organizations Interactive Modals
  const [showAllMahallasModal, setShowAllMahallasModal] = useState(false);
  const [showAllOrganizationsModal, setShowAllOrganizationsModal] = useState(false);
  const [mahallaModalSearch, setMahallaModalSearch] = useState('');
  const [orgModalSearch, setOrgModalSearch] = useState('');
  const [orgModalCategoryFilter, setOrgModalCategoryFilter] = useState('all');
  const [copiedOrgPasswordId, setCopiedOrgPasswordId] = useState<string | null>(null);

  // Transfer rejection modal state
  const [rejectTransferAppealId, setRejectTransferAppealId] = useState<string | null>(null);
  const [rejectTransferNote, setRejectTransferNote] = useState('');
  const [isProcessingTransfer, setIsProcessingTransfer] = useState(false);

  // Password visibility map for organizations
  const [visiblePasswords, setVisiblePasswords] = useState<{ [id: string]: boolean }>({});

  // New Organization Form
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgCode, setNewOrgCode] = useState('');
  const [newOrgCategory, setNewOrgCategory] = useState('Davlat Boshqaruvi');
  const [newOrgPhone, setNewOrgPhone] = useState('+998 71 200-');
  const [newOrgLeader, setNewOrgLeader] = useState('');
  const [newOrgPassword, setNewOrgPassword] = useState('');

  // New Appeal Form
  const [newAppCitizenName, setNewAppCitizenName] = useState('');
  const [newAppPhone, setNewAppPhone] = useState('+998 90 ');
  const [newAppMahalla, setNewAppMahalla] = useState(PAXTACHI_MAHALLAS[0].name);
  const [newAppAddress, setNewAppAddress] = useState('');
  const [newAppOrgIds, setNewAppOrgIds] = useState<string[]>(organizations[0]?.id ? [organizations[0].id] : []);
  const [newAppOrgSearch, setNewAppOrgSearch] = useState('');
  const [newAppContent, setNewAppContent] = useState('');
  const [newAppDeadlineType, setNewAppDeadlineType] = useState<'preset' | 'custom'>('preset');
  const [newAppDeadlineDays, setNewAppDeadlineDays] = useState<number>(5);
  const [newAppCustomDeadline, setNewAppCustomDeadline] = useState('');

  // Telegram Token Config state
  const [customToken, setCustomToken] = useState('8798801985:AAGQ2Jq5Nw-TkqP_XXIzNJvmk9RAsE62OUM');
  const [tokenSaveMsg, setTokenSaveMsg] = useState('');

  // 120-Hour SLA Helper
  const isAppealOverdue = (a: Appeal) => {
    if (a.status === 'hal_etildi') return false;
    const deadlineMs = a.deadlineAt
      ? new Date(a.deadlineAt).getTime()
      : new Date(a.createdAt).getTime() + 120 * 60 * 60 * 1000;
    return Date.now() > deadlineMs;
  };

  const getSlaInfo = (createdAt: string, deadlineAt?: string, status?: string) => {
    if (status === 'hal_etildi') {
      return { isOverdue: false, text: '✅ Hal etildi', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }

    const deadlineMs = deadlineAt
      ? new Date(deadlineAt).getTime()
      : new Date(createdAt).getTime() + 120 * 60 * 60 * 1000;

    const diffMs = deadlineMs - Date.now();

    if (diffMs <= 0) {
      return { isOverdue: true, text: '🚨 Muddati o\'tgan (120s+)', className: 'bg-rose-50 text-rose-700 border-rose-200 font-bold' };
    }

    const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(totalHours / 24);
    const remainingHours = totalHours % 24;

    return {
      isOverdue: false,
      text: `⏱️ ${days}k ${remainingHours}s qoldi`,
      className: totalHours < 24 ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-50 text-slate-700 border-slate-200',
    };
  };

  // 100% REAL ACCURATE METRICS CALCULATED FROM APPEALS
  const totalAppeals = appeals.length;
  const newAppeals = appeals.filter((a) => a.status === 'yangi').length;
  const inProgressAppeals = appeals.filter((a) => a.status === 'jarayonda').length;
  const resolvedAppeals = appeals.filter((a) => a.status === 'hal_etildi').length;
  const overdueAppeals = appeals.filter(isAppealOverdue).length;
  const rejectedAppeals = appeals.filter((a) => a.status === 'vakolatda_emas' || a.feedback === 'etirozli').length;

  const newPercent = totalAppeals > 0 ? ((newAppeals / totalAppeals) * 100).toFixed(1) : '0';
  const inProgressPercent = totalAppeals > 0 ? ((inProgressAppeals / totalAppeals) * 100).toFixed(1) : '0';
  const resolvedPercent = totalAppeals > 0 ? ((resolvedAppeals / totalAppeals) * 100).toFixed(1) : '0';
  const overduePercent = totalAppeals > 0 ? ((overdueAppeals / totalAppeals) * 100).toFixed(1) : '0';
  const rejectedPercent = totalAppeals > 0 ? ((rejectedAppeals / totalAppeals) * 100).toFixed(1) : '0';

  // Circle circumference for Radius 36
  const CIRCLE_C = 2 * Math.PI * 36; // ~226.195
  const resolvedDash = totalAppeals > 0 ? (resolvedAppeals / totalAppeals) * CIRCLE_C : 0;
  const inProgressDash = totalAppeals > 0 ? (inProgressAppeals / totalAppeals) * CIRCLE_C : 0;
  const newDash = totalAppeals > 0 ? (newAppeals / totalAppeals) * CIRCLE_C : 0;
  const overdueDash = totalAppeals > 0 ? (overdueAppeals / totalAppeals) * CIRCLE_C : 0;

  // Transfer Notifications
  const transferAppeals = useMemo(() => appeals.filter((a) => !!a.transferRequest), [appeals]);
  const pendingTransferAppeals = useMemo(
    () => transferAppeals.filter((a) => a.transferRequest?.status === 'pending'),
    [transferAppeals]
  );
  const approvedTransferAppeals = useMemo(
    () => transferAppeals.filter((a) => a.transferRequest?.status === 'approved'),
    [transferAppeals]
  );
  const rejectedTransferAppeals = useMemo(
    () => transferAppeals.filter((a) => a.transferRequest?.status === 'rejected'),
    [transferAppeals]
  );

  // Bosh Kabinet yuborgan va tashkilot tomonidan bajarilgan/javob berilgan murojaatlar
  const boshKabinetResolvedAppeals = useMemo(
    () =>
      appeals.filter(
        (a) =>
          (a.isFromBoshKabinet || a.source === 'bosh_kabinet') &&
          (a.status === 'hal_etildi' || !!a.resolutionText || (a.explanations && a.explanations.length > 0))
      ),
    [appeals]
  );

  // Co-Assignment Notifications
  const coAssignedAppeals = useMemo(
    () =>
      appeals.filter(
        (a) =>
          (a.coAssignedOrgNames && a.coAssignedOrgNames.length > 0) ||
          (a.coAssignmentInvites && a.coAssignmentInvites.length > 0) ||
          (a.coOrgResolutions && a.coOrgResolutions.length > 0)
      ),
    [appeals]
  );

  const coResolutionsCount = useMemo(
    () => coAssignedAppeals.reduce((sum, a) => sum + (a.coOrgResolutions ? a.coOrgResolutions.length : 0), 0),
    [coAssignedAppeals]
  );

  // Total Unread / Actionable Notifications count (Pending transfer requests + new resolved BK appeals)
  const unreadNotificationsCount = pendingTransferAppeals.length + boshKabinetResolvedAppeals.length;

  // Filtered Notifications List
  const filteredNotifications = useMemo(() => {
    let list: Array<{
      type: 'transfer' | 'coassignment' | 'bk_resolved';
      appeal: Appeal;
      date: string;
    }> = [];

    // Add transfer requests: In active feed, show pending & rejected requests.
    // If user explicitly chooses 'transfers' or 'resolved' or search, approved ones can be seen under resolved
    transferAppeals.forEach((a) => {
      // If notification filter is 'all', show pending transfer requests (approved ones have already taken effect and left the active inbox)
      if (notificationFilter === 'all') {
        if (a.transferRequest?.status === 'pending') {
          list.push({
            type: 'transfer',
            appeal: a,
            date: a.transferRequest?.requestedAt || a.createdAt,
          });
        }
      } else {
        list.push({
          type: 'transfer',
          appeal: a,
          date: a.transferRequest?.requestedAt || a.createdAt,
        });
      }
    });

    // Add co-assignments (Hamkorlikdagi barcha murojaatlar va xulosalar saqlanadi)
    coAssignedAppeals.forEach((a) => {
      const lastActionDate = a.coOrgResolutions?.[0]?.resolvedAt || a.coAssignmentInvites?.[0]?.invitedAt || a.createdAt;
      list.push({
        type: 'coassignment',
        appeal: a,
        date: lastActionDate,
      });
    });

    // Add Bosh Kabinet yuborgan va tashkilot tomonidan bajarilgan murojaatlar (Xulosa, biriktirilgan fayllar, tushuntirishlar)
    boshKabinetResolvedAppeals.forEach((a) => {
      const resolvedDate = a.resolvedAt || a.explanations?.[0]?.createdAt || a.createdAt;
      list.push({
        type: 'bk_resolved',
        appeal: a,
        date: resolvedDate,
      });
    });

    // Apply notification category filter
    if (notificationFilter === 'pending') {
      list = list.filter(
        (item) => item.type === 'transfer' && item.appeal.transferRequest?.status === 'pending'
      );
    } else if (notificationFilter === 'transfers') {
      list = list.filter((item) => item.type === 'transfer');
    } else if (notificationFilter === 'coassignments') {
      list = list.filter((item) => item.type === 'coassignment');
    } else if (notificationFilter === 'bk_resolved' as any) {
      list = list.filter((item) => item.type === 'bk_resolved');
    } else if (notificationFilter === 'resolved') {
      list = list.filter(
        (item) =>
          item.type === 'bk_resolved' ||
          (item.type === 'transfer' && item.appeal.transferRequest?.status === 'approved') ||
          (item.type === 'coassignment' && item.appeal.status === 'hal_etildi')
      );
    }

    // Apply notification text search
    if (notificationSearch.trim()) {
      const q = notificationSearch.toLowerCase();
      list = list.filter((item) => {
        const a = item.appeal;
        return (
          a.appealNumber.toLowerCase().includes(q) ||
          a.fullName.toLowerCase().includes(q) ||
          a.organizationName.toLowerCase().includes(q) ||
          a.content.toLowerCase().includes(q) ||
          (a.resolutionText || '').toLowerCase().includes(q) ||
          (a.transferRequest?.fromOrgName || '').toLowerCase().includes(q) ||
          (a.transferRequest?.toOrgName || '').toLowerCase().includes(q) ||
          (a.transferRequest?.reason || '').toLowerCase().includes(q) ||
          (a.coAssignedOrgNames || []).some((n) => n.toLowerCase().includes(q))
        );
      });
    }

    // Sort by latest date descending
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transferAppeals, coAssignedAppeals, boshKabinetResolvedAppeals, notificationFilter, notificationSearch]);

  // Full Mahallas List with Live Appeal Statistics
  const mahallasWithStats = useMemo(() => {
    const normalize = (txt: string) =>
      (txt || '')
        .toLowerCase()
        .replace(/['`’‘"“”]/g, '')
        .replace(/oʻ|o'|o‘|o`/g, 'o')
        .replace(/gʻ|g'|g‘|g`/g, 'g')
        .replace(/\s+mfy\b/g, '')
        .trim();

    return PAXTACHI_MAHALLAS.map((m) => {
      const coreName = normalize(m.name);
      const mahallaAppeals = appeals.filter((a) => {
        if (a.mahalla) {
          const aMfy = normalize(a.mahalla);
          if (aMfy === coreName || aMfy.includes(coreName) || coreName.includes(aMfy)) {
            return true;
          }
        }
        const cleanAddress = normalize(a.address || '');
        if (cleanAddress.includes(coreName)) return true;
        const cleanContent = normalize(a.content || '');
        return cleanContent.includes(coreName);
      });

      const total = mahallaAppeals.length;
      const resolved = mahallaAppeals.filter((a) => a.status === 'hal_etildi').length;
      const inProgress = mahallaAppeals.filter((a) => a.status === 'jarayonda' || a.status === 'yangi').length;
      const objection = mahallaAppeals.filter((a) => a.feedback === 'etirozli').length;
      const rejected = mahallaAppeals.filter((a) => a.status === 'vakolatda_emas').length;

      return {
        ...m,
        totalAppeals: total,
        resolvedAppeals: resolved,
        inProgressAppeals: inProgress,
        objectionAppeals: objection,
        rejectedAppeals: rejected,
        resolvedPercent: total > 0 ? Math.round((resolved / total) * 100) : 0,
      };
    });
  }, [appeals]);

  // Top Mahallas Ranking Calculation (100% Real from appeals across the 14 Mahallas)
  const topMahallas = useMemo(() => {
    return [...mahallasWithStats]
      .sort((a, b) => b.totalAppeals - a.totalAppeals)
      .slice(0, 5)
      .map((m) => ({
        name: m.name,
        count: m.totalAppeals,
        resolved: m.resolvedAppeals,
        inProgress: m.inProgressAppeals,
        objection: m.objectionAppeals,
      }));
  }, [mahallasWithStats]);

  const maxMahallaCount = Math.max(...topMahallas.map((m) => m.count), 1);

  // Top Organizations Ranking Calculation (100% Real from appeals)
const topOrganizations = useMemo(() => {
    const orgMap: { [key: string]: { id: string; name: string; category: string; count: number; resolved: number } } = {};
    
    // 1. Avval barcha tashkilotlarni 0 qiymat bilan ro'yxatga qo'shamiz
    organizations.forEach((org) => {
      orgMap[org.id] = { id: org.id, name: org.name, category: org.category, count: 0, resolved: 0 };
    });

    // 2. Tushgan va hal etilgan murojaatlarni sanaymiz
    appeals.forEach((a) => {
      const found = organizations.find((o) => o.name === a.organizationName || o.id === a.organizationId);
      if (found && orgMap[found.id]) {
        orgMap[found.id].count += 1;
        if (a.status === 'hal_etildi') {
          orgMap[found.id].resolved += 1;
        }
      }
    });
    
    // 3. Tartiblash: Eng ko'p hal qilganlar yuqoriga chiqadi
    return Object.values(orgMap)
      .sort((a, b) => b.resolved - a.resolved || b.count - a.count)
      .slice(0, 5);
  }, [appeals, organizations]);
  const maxOrgCount = Math.max(...topOrganizations.map((o) => o.count), 1);


// Top Shtab Tasks Ranking Calculation (100% Real from tasks)
  const topTasksStats = useMemo(() => {
    const orgTaskMap: { [orgId: string]: { id: string; name: string; total: number; approved: number; inProgress: number; underReview: number } } = {};
    
    organizations.forEach((org) => {
      orgTaskMap[org.id] = { id: org.id, name: org.name, total: 0, approved: 0, inProgress: 0, underReview: 0 };
    });

    tasks.forEach((t) => {
      if (t.targetOrgId === 'all') {
        organizations.forEach((org) => {
          if (orgTaskMap[org.id]) {
            orgTaskMap[org.id].total += 1;
            // 🔥 Hisobot topshirganlarni ham "bajarildi" deb hisoblaymiz
            if (t.status === 'tasdiqlandi' || t.status === 'tekshiruvda') orgTaskMap[org.id].approved += 1;
            else if (t.status === 'jarayonda') orgTaskMap[org.id].inProgress += 1;
          }
        });
      } else if (orgTaskMap[t.targetOrgId]) {
        orgTaskMap[t.targetOrgId].total += 1;
        // 🔥 Hisobot topshirganlarni ham "bajarildi" deb hisoblaymiz
        if (t.status === 'tasdiqlandi' || t.status === 'tekshiruvda') orgTaskMap[t.targetOrgId].approved += 1;
        else if (t.status === 'jarayonda') orgTaskMap[t.targetOrgId].inProgress += 1;
      }
    });

    return Object.values(orgTaskMap)
      // 🔥 Reytingni birinchi o'rinda BAJARILGANLAR soniga qarab tuzish
      .sort((a, b) => b.approved - a.approved || b.total - a.total)
      .slice(0, 5);
  }, [tasks, organizations]);
  const maxTaskCount = Math.max(...topTasksStats.map((t) => t.total), 1);

  // Top Mahalla Yettiligi Tasks Ranking Calculation (100% Real from mahallaTasks)
  const topMahallaYettiligiStats = useMemo(() => {
    const mahallaTaskMap: { [mId: string]: { id: string; name: string; total: number; completed: number; inProgress: number; yangi: number } } = {};

    PAXTACHI_MAHALLAS.forEach((m) => {
      mahallaTaskMap[m.id] = { id: m.id, name: m.name, total: 0, completed: 0, inProgress: 0, yangi: 0 };
    });

    mahallaTasks.forEach((mt) => {
      if (mahallaTaskMap[mt.mahallaId]) {
        mahallaTaskMap[mt.mahallaId].total += 1;
        if (mt.status === 'bajarildi') mahallaTaskMap[mt.mahallaId].completed += 1;
        else if (mt.status === 'jarayonda') mahallaTaskMap[mt.mahallaId].inProgress += 1;
        else mahallaTaskMap[mt.mahallaId].yangi += 1;
      }
    });

    return Object.values(mahallaTaskMap)
      .sort((a, b) => b.total - a.total || b.completed - a.completed)
      .slice(0, 5);
  }, [mahallaTasks]);

  const maxMahallaTaskCount = Math.max(...topMahallaYettiligiStats.map((m) => m.total), 1);

  const filteredMahallasModalList = useMemo(() => {
    if (!mahallaModalSearch.trim()) return mahallasWithStats;
    const q = mahallaModalSearch.toLowerCase();
    return mahallasWithStats.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.chairman.toLowerCase().includes(q) ||
        m.phone.includes(q) ||
        m.id.toLowerCase().includes(q)
    );
  }, [mahallasWithStats, mahallaModalSearch]);

  // Full Organizations List with Live Appeal Statistics
  const organizationsWithStats = useMemo(() => {
    return organizations.map((org) => {
      const orgAppeals = appeals.filter(
        (a) => a.organizationId === org.id || a.coAssignedOrgIds?.includes(org.id)
      );
      const total = orgAppeals.length;
      const resolved = orgAppeals.filter((a) => {
        if (a.organizationId === org.id && a.status === 'hal_etildi') return true;
        const coRes = a.coOrgResolutions?.find((r) => r.orgId === org.id);
        return coRes?.status === 'hal_etildi';
      }).length;
      const inProgress = orgAppeals.filter((a) => {
        if (a.organizationId === org.id) return a.status === 'jarayonda' || a.status === 'yangi';
        const coRes = a.coOrgResolutions?.find((r) => r.orgId === org.id);
        return coRes?.status === 'jarayonda';
      }).length;
      const objection = orgAppeals.filter((a) => a.feedback === 'etirozli').length;
      const rejected = orgAppeals.filter((a) => a.status === 'vakolatda_emas').length;

      return {
        ...org,
        calculatedTotal: total,
        calculatedResolved: resolved,
        calculatedInProgress: inProgress,
        calculatedObjection: objection,
        calculatedRejected: rejected,
        resolvedPercent: total > 0 ? Math.round((resolved / total) * 100) : 0,
      };
    });
  }, [organizations, appeals]);

  const orgCategories = useMemo(() => {
    const set = new Set<string>();
    organizations.forEach((o) => {
      if (o.category) set.add(o.category);
    });
    return Array.from(set);
  }, [organizations]);

  const filteredOrganizationsModalList = useMemo(() => {
    let list = organizationsWithStats;
    if (orgModalCategoryFilter !== 'all') {
      list = list.filter((o) => o.category === orgModalCategoryFilter);
    }
    if (orgModalSearch.trim()) {
      const q = orgModalSearch.toLowerCase();
      list = list.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          (o.code && o.code.toLowerCase().includes(q)) ||
          (o.leader && o.leader.toLowerCase().includes(q)) ||
          (o.phone && o.phone.includes(q)) ||
          (o.category && o.category.toLowerCase().includes(q))
      );
    }
    return list;
  }, [organizationsWithStats, orgModalCategoryFilter, orgModalSearch]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleCopyOrgPassword = (orgId: string, pass: string) => {
    navigator.clipboard.writeText(pass);
    setCopiedOrgPasswordId(orgId);
    showToast(`📋 Parol nusxalandi: ${pass}`);
    setTimeout(() => {
      setCopiedOrgPasswordId(null);
    }, 2500);
  };

  const handleResetOrgPassword = async (org: Organization, customPass?: string) => {
    setIsResettingPassword(true);
    try {
      const res = await fetch(`/api/organizations/${org.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: customPass }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        navigator.clipboard.writeText(data.newPassword);
        showToast(`🔑 "${org.name}" uchun yangi parol o‘rnatildi va nusxalandi: ${data.newPassword}`);
        setResetPasswordModalOrg(null);
        setCustomNewPassword('');
        if (onRefresh) await onRefresh();
      } else {
        alert(data.error || 'Parolni yangilashda xatolik yuz berdi');
      }
    } catch (e: any) {
      alert('Server bilan bog‘lanishda xatolik: ' + e.message);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleUnlockOrg = async (org: Organization) => {
    try {
      showToast(`🔓 "${org.name}" blokdan chiqarilmoqda...`);
      const res = await fetch(`/api/organizations/${org.id}/unlock`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`🔓 "${org.name}" muvaffaqiyatli blokdan chiqarildi`);
        if (onRefresh) await onRefresh();
      } else {
        showToast(`⚠️ Xatolik: ${data.error || 'Blokdan chiqarishda xatolik'}`);
      }
    } catch (e: any) {
      showToast(`⚠️ Server bilan bog‘lanishda xatolik: ${e.message}`);
    }
  };

  const handleLockOrg = async (org: Organization) => {
    try {
      showToast(`🔒 "${org.name}" bloklanmoqda...`);
      const res = await fetch(`/api/organizations/${org.id}/lock`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`🔒 "${org.name}" xavfsizlik yuzasidan bloklandi`);
        if (onRefresh) await onRefresh();
      } else {
        showToast(`⚠️ Xatolik: ${data.error || 'Bloklashda xatolik'}`);
      }
    } catch (e: any) {
      showToast(`⚠️ Server bilan bog‘lanishda xatolik: ${e.message}`);
    }
  };

  const lockedOrgsCount = useMemo(() => organizations.filter((o) => o.isLocked).length, [organizations]);
  const warningOrgsCount = useMemo(() => organizations.filter((o) => !o.isLocked && (o.failedLoginAttempts || 0) > 0).length, [organizations]);
  const safeOrgsCount = useMemo(() => organizations.filter((o) => !o.isLocked && (o.failedLoginAttempts || 0) === 0).length, [organizations]);

  const filteredSecurityOrgs = useMemo(() => {
    let list = organizationsWithStats;

    if (securityFilter === 'locked') {
      list = list.filter((o) => o.isLocked);
    } else if (securityFilter === 'warning') {
      list = list.filter((o) => !o.isLocked && (o.failedLoginAttempts || 0) > 0);
    } else if (securityFilter === 'clean') {
      list = list.filter((o) => !o.isLocked && (o.failedLoginAttempts || 0) === 0);
    }

    if (securityCategoryFilter !== 'all') {
      list = list.filter((o) => o.category === securityCategoryFilter);
    }

    if (securitySearch.trim()) {
      const q = securitySearch.toLowerCase();
      list = list.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          (o.code && o.code.toLowerCase().includes(q)) ||
          (o.leader && o.leader.toLowerCase().includes(q)) ||
          (o.phone && o.phone.includes(q)) ||
          (o.password && o.password.toLowerCase().includes(q))
      );
    }

    return list;
  }, [organizationsWithStats, securityFilter, securityCategoryFilter, securitySearch]);

  // Shtab a'zolari tashkilotlari (15 ta rasmiy shtab a'zosi)
  const shtabOrganizations = useMemo(
    () => organizations.filter((org) => !NON_SHTAB_TASK_ORG_IDS.includes(org.id)),
    [organizations]
  );

  // Tasks (Vazifalar) Metrics & Filtering
  const totalTasksCount = tasks.length;
  const newTasksCount = tasks.filter((t) => t.status === 'yangi').length;
  const inProgressTasksCount = tasks.filter((t) => t.status === 'jarayonda').length;
  const underReviewTasksCount = tasks.filter((t) => t.status === 'tekshiruvda').length;
  const approvedTasksCount = tasks.filter((t) => t.status === 'tasdiqlandi').length;
  const rejectedTasksCount = tasks.filter((t) => t.status === 'qaytarildi').length;

  const filteredTasks = useMemo(() => {
    let list = [...tasks];

    if (taskStatusFilter !== 'all') {
      list = list.filter((t) => t.status === taskStatusFilter);
    }

    if (taskOrgFilter !== 'all') {
      list = list.filter((t) => t.targetOrgId === taskOrgFilter);
    }

    if (taskSearch.trim()) {
      const q = taskSearch.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.targetOrgName.toLowerCase().includes(q) ||
          (t.category && t.category.toLowerCase().includes(q)) ||
          (t.completionReport?.notes && t.completionReport.notes.toLowerCase().includes(q))
      );
    }

    return list;
  }, [tasks, taskStatusFilter, taskOrgFilter, taskSearch]);

  // Appeals table filtering
  const filteredAppeals = useMemo(() => {
    let list = [...appeals];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.fullName.toLowerCase().includes(q) ||
          a.appealNumber.toLowerCase().includes(q) ||
          a.organizationName.toLowerCase().includes(q) ||
          a.phone.includes(q) ||
          a.content.toLowerCase().includes(q) ||
          (a.address && a.address.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'overdue') {
        list = list.filter(isAppealOverdue);
      } else if (statusFilter === 'etirozli') {
        list = list.filter((a) => a.feedback === 'etirozli');
      } else {
        list = list.filter((a) => a.status === statusFilter);
      }
    }

    if (selectedOrgFilter !== 'all') {
      list = list.filter((a) => a.organizationId === selectedOrgFilter);
    }

    if (selectedMahallaFilter !== 'all') {
      list = list.filter((a) => a.address?.includes(selectedMahallaFilter) || a.content.includes(selectedMahallaFilter));
    }

    // Sort by creation time / appeal number according to appealSortOrder
    list.sort((a, b) => {
      const parseNum = (str?: string) => {
        if (!str) return 0;
        const n = parseInt(str.replace(/[^0-9]/g, ''), 10);
        return isNaN(n) ? 0 : n;
      };
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;

      if (timeA && timeB && timeA !== timeB) {
        return appealSortOrder === 'newest' ? timeB - timeA : timeA - timeB;
      }
      const numA = parseNum(a.appealNumber);
      const numB = parseNum(b.appealNumber);
      return appealSortOrder === 'newest' ? numB - numA : numA - numB;
    });

    return list;
  }, [appeals, searchQuery, statusFilter, selectedOrgFilter, selectedMahallaFilter, appealSortOrder]);

  // Demo Appeals for display if database is clean
  const displayRecentAppeals = useMemo(() => {
    if (appeals.length > 0) {
      return appeals.slice(0, 10);
    }
    // Baseline sample table items matching screenshot aesthetic
    return [
      {
        id: 'app-1247',
        appealNumber: '#1247',
        fullName: 'Abdullayev A.',
        address: '"Toshko\'prik" MFY, 14-uy',
        organizationName: 'Elektr tarmoqlari',
        organizationId: 'org-7',
        category: 'Elektr Energiyasi',
        content: 'Elektr uzilishlari va transformatordagi kuchlanish pasayishi bo\'yicha amaliy yordam',
        status: 'jarayonda' as const,
        feedback: 'kutilmoqda' as const,
        createdAt: '2024-05-20T10:30:00.000Z',
        phone: '+998 90 123-45-67',
      },
      {
        id: 'app-1246',
        appealNumber: '#1246',
        fullName: 'Karimova M.',
        address: '"Guliston" MFY, 28-uy',
        organizationName: 'Suv ta\'minoti',
        organizationId: 'org-6',
        category: 'Suv Ta\'minoti',
        content: 'Ichimlik suvi muammosi va yangi tarmoqqa ulash',
        status: 'hal_etildi' as const,
        feedback: 'roziman' as const,
        createdAt: '2024-05-20T09:45:00.000Z',
        phone: '+998 91 234-56-78',
      },
      {
        id: 'app-1245',
        appealNumber: '#1245',
        fullName: 'Ergashev B.',
        address: '"Ko‘rpa" MFY, 4-uy',
        organizationName: 'Yo\'l xo\'jaligi',
        organizationId: 'org-1',
        category: 'Obodonlashtirish',
        content: 'Ichki yo\'llarni ta\'mirlash va shag\'allashtirish',
        status: 'jarayonda' as const,
        feedback: 'kutilmoqda' as const,
        createdAt: '2024-05-19T18:20:00.000Z',
        phone: '+998 93 345-67-89',
      },
      {
        id: 'app-1244',
        appealNumber: '#1244',
        fullName: 'Tursunov J.',
        address: '"Mirzo Ulug\'bek" MFY, 19-uy',
        organizationName: 'Ko\'kalamzorlashtirish',
        organizationId: 'org-10',
        category: 'Obodonlashtirish',
        content: 'Ko\'chat ekish va ariqlarni tozalash ishlari',
        status: 'hal_etildi' as const,
        feedback: 'roziman' as const,
        createdAt: '2024-05-19T16:10:00.000Z',
        phone: '+998 94 456-78-90',
      },
      {
        id: 'app-1243',
        appealNumber: '#1243',
        fullName: 'Yusupova Z.',
        address: '"Amirobod" MFY, 33-uy',
        organizationName: 'Yoritish xizmati',
        organizationId: 'org-7',
        category: 'Elektr Energiyasi',
        content: 'Ko\'cha chiroqlari o\'rnatish va simyog\'och almashtirish',
        status: 'vakolatda_emas' as const,
        feedback: 'etirozli' as const,
        createdAt: '2024-05-19T14:05:00.000Z',
        phone: '+998 95 567-89-01',
      },
    ];
  }, [appeals]);

  // Add Organization Handler
  const handleOpenAddOrgModal = () => {
    setNewOrgPassword(`pablo${2204 + organizations.length}`);
    setShowAddOrgModal(true);
  };

  const handleCreateOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName || !newOrgCode) return;
    await onAddOrganization({
      name: newOrgName,
      code: newOrgCode,
      category: newOrgCategory,
      phone: newOrgPhone,
      leader: newOrgLeader,
      password: newOrgPassword,
    });
    setShowAddOrgModal(false);
    setNewOrgName('');
    setNewOrgCode('');
    setNewOrgLeader('');
  };

  // Helper to format ISO date string from days
  const formatDeadlineDatePreview = (days: number) => {
    const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return d.toLocaleDateString('uz-UZ', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  // Add Appeal Manually Handler
  const handleCreateAppealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppCitizenName || !newAppPhone || !newAppContent || newAppOrgIds.length === 0) {
      alert("Iltimos, barcha maydonlarni to'ldiring va kamida bitta mas'ul tashkilotni tanlang.");
      return;
    }

    const calculatedDeadline = newAppDeadlineType === 'custom' && newAppCustomDeadline
      ? newAppCustomDeadline
      : new Date(Date.now() + newAppDeadlineDays * 24 * 60 * 60 * 1000).toISOString();

    try {
      const res = await fetch('/api/appeals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: newAppCitizenName,
          phone: newAppPhone,
          mahalla: newAppMahalla,
          address: newAppAddress ? `${newAppMahalla}, ${newAppAddress}` : newAppMahalla,
          organizationIds: newAppOrgIds,
          organizationId: newAppOrgIds[0],
          deadline: calculatedDeadline,
          deadlineDays: newAppDeadlineDays,
          content: newAppContent,
        }),
      });
      if (res.ok) {
        setShowAddAppealModal(false);
        setNewAppCitizenName('');
        setNewAppAddress('');
        setNewAppContent('');
        setNewAppOrgIds(organizations[0]?.id ? [organizations[0].id] : []);
        setNewAppOrgSearch('');
        setNewAppDeadlineDays(5);
        setNewAppCustomDeadline('');
        setNewAppDeadlineType('preset');
        setToastMessage("✅ Yangi murojaat muvaffaqiyatli ro'yxatga olindi!");
        if (onRefresh) await onRefresh();
      }
    } catch (err) {
      console.error('Error creating appeal:', err);
    }
  };

  // Clear all appeals
  const handleClearAllAppeals = async () => {
    setIsClearing(true);
    try {
      const res = await fetch('/api/appeals/clear-all', { method: 'POST' });
      if (res.ok) {
        localStorage.removeItem('nazorat_appeals_cache');
        if (onRefresh) await onRefresh();
        setShowClearConfirmModal(false);
      }
    } catch (err) {
      console.error('Error clearing:', err);
    } finally {
      setIsClearing(false);
    }
  };

  // Seed realistic sample appeals
  const handleSeedSamples = async () => {
    try {
      const res = await fetch('/api/demo/seed-samples', { method: 'POST' });
      if (res.ok && onRefresh) {
        await onRefresh();
        alert('Namuna murojaatlar muvaffaqiyatli yuklandi!');
      }
    } catch (err) {
      console.error('Error seeding demo:', err);
    }
  };

  // Save custom telegram token
  const handleSaveTelegramToken = async () => {
    try {
      const res = await fetch('/api/telegram/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: customToken }),
      });
      const data = await res.json();
      if (res.ok) {
        setTokenSaveMsg('✅ Telegram bot muvaffaqiyatli ulandi!');
        setTimeout(() => setShowTelegramModal(false), 1500);
      } else {
        setTokenSaveMsg(`❌ Xatolik: ${data.error}`);
      }
    } catch (err: any) {
      setTokenSaveMsg(`❌ Xatolik: ${err.message}`);
    }
  };

  // Transfer Actions
  const handleApproveTransferClick = async (appealId: string) => {
    setIsProcessingTransfer(true);
    try {
      if (onApproveTransfer) {
        await onApproveTransfer(appealId);
      } else {
        await fetch(`/api/appeals/${appealId}/approve-transfer`, { method: 'POST' });
        if (onRefresh) await onRefresh();
      }
    } catch (err) {
      console.error('Error approving transfer:', err);
    } finally {
      setIsProcessingTransfer(false);
    }
  };

  const handleOpenRejectTransferModal = (appealId: string) => {
    setRejectTransferAppealId(appealId);
    setRejectTransferNote('');
  };

  const handleConfirmRejectTransfer = async () => {
    if (!rejectTransferAppealId) return;
    setIsProcessingTransfer(true);
    try {
      if (onRejectTransfer) {
        await onRejectTransfer(rejectTransferAppealId, rejectTransferNote);
      } else {
        await fetch(`/api/appeals/${rejectTransferAppealId}/reject-transfer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminNote: rejectTransferNote }),
        });
        if (onRefresh) await onRefresh();
      }
      setRejectTransferAppealId(null);
      setRejectTransferNote('');
    } catch (err) {
      console.error('Error rejecting transfer:', err);
    } finally {
      setIsProcessingTransfer(false);
    }
  };

  // Export appeals to CSV
  const handleExportCSV = () => {
    const dataToExport = filteredAppeals.length > 0 ? filteredAppeals : displayRecentAppeals;
    const headers = ['ID', 'Murojaat raqami', 'Fuqaro', 'Telefon', 'Mahalla / Manzil', 'Tashkilot', 'Sohasi', 'Holati', 'Sana', 'Mazmuni'];
    const rows = dataToExport.map((a) => [
      a.id,
      a.appealNumber,
      `"${a.fullName}"`,
      `"${a.phone}"`,
      `"${a.address || ''}"`,
      `"${a.organizationName}"`,
      `"${a.category}"`,
      a.status,
      new Date(a.createdAt).toLocaleString('uz-UZ'),
      `"${a.content.replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `paxtachi_murojaatlar_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Status badge styling helper
  const getStatusBadge = (status: string, feedback?: string) => {
    if (status === 'hal_etildi') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
          Hal etilgan
        </span>
      );
    }
    if (status === 'jarayonda' || status === 'yangi') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200">
          Jarayonda
        </span>
      );
    }
    if (status === 'vakolatda_emas' || feedback === 'etirozli') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200">
          Rad etilgan
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200">
        Yangi
      </span>
    );
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-slate-950 text-slate-100 dark' : 'bg-[#f8fafc] text-slate-800'} flex flex-col lg:flex-row antialiased font-sans transition-colors duration-200`}>
      {/* ================= LEFT SIDEBAR (Dark Navy Theme) ================= */}
      {isSidebarOpen && (
        <aside className="w-full lg:w-64 bg-[#0a1426] text-slate-300 flex-shrink-0 flex flex-col justify-between border-r border-slate-800/80 shadow-2xl z-30 transition-all duration-300">
          <div>
            {/* Brand Header */}
            <div className="p-5 flex items-center justify-between border-b border-slate-800/60">
              <div className="flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 ring-2 ring-blue-400/30">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-blue-400 tracking-wider">murojaatlar</div>
                  <div className="text-base font-extrabold text-white tracking-tight leading-tight">Murojaatlari</div>
                </div>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                title="Menyuni yashirish"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
              >
                <PanelLeftClose className="w-5 h-5" />
              </button>
            </div>

          {/* Navigation Menu */}
          <nav className="p-3 space-y-1.5 mt-2">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Home className="w-5 h-5" />
              <span>Bosh sahifa</span>
            </button>

            <button
              onClick={() => setActiveTab('appeals')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'appeals'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center space-x-3">
                <MessageSquare className="w-5 h-5" />
                <span>Murojaatlar</span>
              </div>
              {appeals.length > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-blue-500/20 text-blue-300">
                  {appeals.length}
                </span>
              )}
            </button>

            {/* TASHKILOTLAR & PAROLLAR TAB */}
            <button
              onClick={() => setActiveTab('tashkilotlar')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'tashkilotlar'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center space-x-3">
                <KeyRound className="w-5 h-5" />
                <span>Tashkilotlar & Kodlar</span>
              </div>
              {lockedOrgsCount > 0 ? (
                <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-rose-500 text-white animate-pulse">
                  {lockedOrgsCount} bloklangan
                </span>
              ) : warningOrgsCount > 0 ? (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/30 text-amber-300">
                  {warningOrgsCount} ogoh
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-slate-800 text-slate-400">
                  {organizations.length}
                </span>
              )}
            </button>

            {/* NEW NOTIFICATIONS TAB */}
            <button
              onClick={() => setActiveTab('notifications')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'notifications'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Bell className="w-5 h-5" />
                <span>Bildirishnomalar</span>
              </div>
              {unreadNotificationsCount > 0 ? (
                <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-amber-500 text-slate-950 animate-pulse">
                  {unreadNotificationsCount} ta yangi
                </span>
              ) : coAssignedAppeals.length > 0 || transferAppeals.length > 0 ? (
                <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-slate-800 text-slate-400">
                  {transferAppeals.length + coAssignedAppeals.length}
                </span>
              ) : null}
            </button>

            <button
              onClick={() => setActiveTab('tasks')}
              className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'tasks'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <CheckSquare className="w-5 h-5" />
              <span>Vazifalar</span>
            </button>

            <button
              onClick={() => setActiveTab('mahalla_yettiligi')}
              className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'mahalla_yettiligi'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Users className="w-5 h-5" />
              <span>Mahalla yettiligi</span>
            </button>

            {onOpenMonitor && (
              <button
                onClick={onOpenMonitor}
                className="w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl text-sm font-bold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 border border-emerald-500/30 transition-all cursor-pointer mt-3 shadow-md"
              >
                <Monitor className="w-5 h-5 text-emerald-400 animate-pulse" />
                <span>Situatsion Monitor (TV)</span>
              </button>
            )}
          </nav>
        </div>

        {/* Bottom Support Widget */}
        <div className="p-3.5 border-t border-slate-800/60">
          <div
            onClick={() => setShowHelpModal(true)}
            className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/60 to-slate-900 border border-blue-900/40 hover:border-blue-700/60 transition-all cursor-pointer group flex items-center space-x-3"
          >
            <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Yordam markazi</div>
              <div className="text-[11px] text-slate-400">murojaatlar shtabi</div>
            </div>
          </div>
        </div>
      </aside>
      )}

      {/* ================= MAIN CONTENT WRAPPER ================= */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header Navbar */}
        <header className={`${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200/80 text-slate-900'} px-4 sm:px-6 py-3.5 sticky top-0 z-20 shadow-xs flex items-center justify-between transition-colors duration-200`}>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title={isSidebarOpen ? "Menyuni yashirish" : "Menyuni ko‘rsatish"}
              className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center space-x-1.5 shadow-xs ${
                isDarkMode
                  ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300'
                  : 'border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-slate-700 hover:text-blue-600'
              }`}
            >
              <Menu className="w-5 h-5" />
              {!isSidebarOpen && <span className="text-xs font-bold hidden sm:inline">Menyu</span>}
            </button>
            <h1 className={`text-xl sm:text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {activeTab === 'dashboard' && 'Bosh sahifa'}
              {activeTab === 'appeals' && 'Sektor murojaatlari'}
              {activeTab === 'tashkilotlar' && 'Tashkilotlar & Kirish Parollari Boshqaruvi'}
              {activeTab === 'notifications' && 'Bildirishnomalar & So‘rovlar'}
              {activeTab === 'tasks' && 'Vazifalar'}
              {activeTab === 'mahalla_yettiligi' && 'Mahalla yettiligi'}
            </h1>
          </div>

          {/* Right Header Action Items */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* TUN VA KUN (DARK / LIGHT MODE) TOGGLE BUTTON */}
            <button
              onClick={toggleDarkMode}
              title={isDarkMode ? 'Kunduzgi (Yorug‘) rejimga o‘tish' : 'Tungi (Qorong‘u) rejimga o‘tish'}
              className={`p-2 sm:px-3 sm:py-2 rounded-2xl border transition-all cursor-pointer flex items-center space-x-1.5 ${
                isDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-400 shadow-md shadow-amber-500/10'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 shadow-xs'
              }`}
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-amber-400 animate-pulse" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600" />
              )}
              <span className="text-xs font-bold hidden md:inline">
                {isDarkMode ? 'Kun' : 'Tun'}
              </span>
            </button>

            {/* Direct Notifications Bell Button */}
            <button
              onClick={() => setActiveTab('notifications')}
              title="Bildirishnomalar markazi"
              className={`relative p-2 rounded-xl border transition-all cursor-pointer ${
                activeTab === 'notifications'
                  ? isDarkMode ? 'bg-blue-900/60 border-blue-700 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-600'
                  : isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-slate-950 text-[10px] font-black rounded-full flex items-center justify-center shadow-xs animate-bounce">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            {/* Quick Action Button */}
            <button
              onClick={() => setShowAddAppealModal(true)}
              className="hidden sm:flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Yangi murojaat</span>
            </button>

            {/* Live Monitor TV Button */}
            {onOpenMonitor && (
              <button
                onClick={onOpenMonitor}
                title="Katta ekran / TV uchun jonli statistika monitoringi"
                className="hidden lg:flex items-center space-x-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm shadow-emerald-500/20 transition-all cursor-pointer"
              >
                <Monitor className="w-4 h-4" />
                <span>Live Monitor (TV)</span>
              </button>
            )}

            {/* Telegram Bot Direct Link */}
            {botStatus.botUsername && (
              <a
                href={`https://t.me/${botStatus.botUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Telegram botga o'tish"
                className={`hidden md:flex items-center space-x-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-all border ${
                  isDarkMode
                    ? 'bg-sky-950/40 hover:bg-sky-900/60 text-sky-300 border-sky-800/60'
                    : 'bg-sky-50 hover:bg-sky-100 text-sky-700 border-sky-200'
                }`}
              >
                <Bot className="w-3.5 h-3.5 text-sky-500" />
                <span>@{botStatus.botUsername}</span>
              </a>
            )}

            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              disabled={isLoading}
              title="Yangilash"
              className={`p-2 rounded-xl transition-all cursor-pointer border ${
                isDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-500' : ''}`} />
            </button>

            {/* Profile Avatar / Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className={`flex items-center space-x-3 p-1.5 pr-2.5 rounded-2xl border transition-all cursor-pointer ${
                  isDarkMode
                    ? 'hover:bg-slate-800 border-slate-800 text-slate-200'
                    : 'hover:bg-slate-100 border-transparent hover:border-slate-200'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                  <User className="w-5 h-5" />
                </div>
                <div className="text-left hidden sm:block">
                  <div className={`text-xs font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>murojaatlar</div>
                  <div className="text-[11px] text-slate-400 font-medium">Bosh Administrator</div>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {/* Profile Dropdown Menu */}
              {showProfileDropdown && (
                <div className={`absolute right-0 mt-2 w-64 rounded-2xl shadow-2xl border py-2 z-50 animate-in fade-in slide-in-from-top-2 ${
                  isDarkMode
                    ? 'bg-slate-900 border-slate-800 text-slate-200'
                    : 'bg-white border-slate-200/90 text-slate-900'
                }`}>
                  <div className={`px-4 py-2.5 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                    <div className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>murojaatlar Rahbariyati</div>
                    <div className="text-[11px] text-slate-400">murojaatlar Shtabi</div>
                  </div>

                  <div className="py-1">
                    {/* Theme Mode Option */}
                    <button
                      onClick={toggleDarkMode}
                      className={`w-full flex items-center justify-between px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                        isDarkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
                        <span>Rejim: {isDarkMode ? 'Tungi (Qorong‘u)' : 'Kunduzgi (Yorug‘)'}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isDarkMode ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {isDarkMode ? 'Tun' : 'Kun'}
                      </span>
                    </button>
                    <div className="text-xs font-bold text-slate-900">murojaatlar Rahbariyati</div>
                    <div className="text-[11px] text-slate-500">murojaatlar Shtabi</div>
                  </div>

                  <div className="py-1">
                    {onOpenMonitor && (
                      <button
                        onClick={() => {
                          onOpenMonitor();
                          setShowProfileDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 flex items-center space-x-2 cursor-pointer border-b border-slate-100"
                      >
                        <Monitor className="w-4 h-4 text-emerald-600" />
                        <span>🖥️ Situatsion Monitor (TV)</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setShowTelegramModal(true);
                        setShowProfileDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-2 cursor-pointer"
                    >
                      <Bot className="w-4 h-4 text-sky-600" />
                      <span>Telegram Bot Sozlamalari</span>
                    </button>

                    <button
                      onClick={() => {
                        handleSeedSamples();
                        setShowProfileDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-2 cursor-pointer"
                    >
                      <Database className="w-4 h-4 text-indigo-600" />
                      <span>Namuna Murojaatlarni Yuklash</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowClearConfirmModal(true);
                        setShowProfileDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 flex items-center space-x-2 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 text-rose-600" />
                      <span>Barcha Murojaatlarni Tozalash</span>
                    </button>
                  </div>

                  <div className="border-t border-slate-100 pt-1">
                    <button
                      onClick={() => {
                        if (onLogout) onLogout();
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center space-x-2 cursor-pointer"
                    >
                      <XCircle className="w-4 h-4 text-rose-500" />
                      <span>Tizimdan Chiqish</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ================= PAGE VIEWS ROUTING ================= */}
        <main className="p-6 space-y-6">
          {/* ================= VIEW 1: BOSH SAHIFA (DASHBOARD) ================= */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* ACTIONABLE NOTIFICATION ALERT BANNER */}
              {pendingTransferAppeals.length > 0 && (
                <div className="bg-gradient-to-r from-amber-500/10 via-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
                  <div className="flex items-start space-x-3.5">
                    <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl shadow-xs animate-pulse flex-shrink-0">
                      <ArrowRightLeft className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">Tasdiq talab etiladi</span>
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-800 text-[11px] font-black rounded-full">
                          {pendingTransferAppeals.length} ta yangi so'rov
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">
                        Tashkilotlar tomonidan murojaatni boshqa tashkilotga o‘tkazish bo‘yicha so‘rovlar tushgan.
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Bosh Kabinet qarori bilan murojaat yangi tashkilot hisobiga ko‘chiriladi yoki rad etiladi.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setNotificationFilter('pending');
                      setActiveTab('notifications');
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs shadow-sm transition-all flex items-center justify-center space-x-2 flex-shrink-0 cursor-pointer"
                  >
                    <span>So‘rovlarni ko‘rib chiqish</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* TOP 5 STAT METRIC CARDS (CLICKABLE INTERACTIVE SHORTCUTS) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* 1. Jami murojaatlar */}
                <div
                  onClick={() => {
                    setStatusFilter('all');
                    setSelectedOrgFilter('all');
                    setSelectedMahallaFilter('all');
                    setSearchQuery('');
                    setActiveTab('appeals');
                  }}
                  className="bg-white dark:bg-[#0c1628] rounded-2xl p-4.5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs dark:shadow-md dark:shadow-black/20 relative overflow-hidden flex flex-col justify-between hover:shadow-md hover:border-slate-400 dark:hover:border-slate-700 transition-all cursor-pointer group active:scale-[0.99]"
                  title="Barcha murojaatlar ro'yxatini ko'rish uchun bosing"
                >
                  <div className="flex items-start space-x-3">
                    <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 flex items-center justify-center flex-shrink-0 group-hover:bg-slate-900 group-hover:text-white dark:group-hover:bg-slate-700 transition-colors">
                      <Inbox className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Jami murojaatlar</div>
                      <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                        {totalAppeals.toLocaleString('ru-RU')}
                      </div>
                      <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-0.5 flex items-center space-x-1">
                        <span>Barcha tushganlar</span>
                        <ChevronRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                  {/* Sparkline */}
                  <div className="w-full h-7 mt-3">
                    <svg viewBox="0 0 200 40" className="w-full h-full stroke-slate-400 dark:stroke-slate-500 fill-none" preserveAspectRatio="none">
                      <path
                        d="M0 28 Q 20 20, 40 24 T 80 18 T 120 26 T 160 14 T 200 20"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>

                {/* 2. Yangi murojaatlar (Kutishda) */}
                <div
                  onClick={() => {
                    setStatusFilter('yangi');
                    setSelectedOrgFilter('all');
                    setSelectedMahallaFilter('all');
                    setSearchQuery('');
                    setActiveTab('appeals');
                  }}
                  className="bg-white dark:bg-[#0c1628] rounded-2xl p-4.5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs dark:shadow-md dark:shadow-black/20 relative overflow-hidden flex flex-col justify-between hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500/60 transition-all cursor-pointer group active:scale-[0.99]"
                  title="Yangi (tashkilot qabul qilmagan) murojaatlar ro'yxatini ko'rish uchun bosing"
                >
                  <div className="flex items-start space-x-3">
                    <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Yangi murojaat</div>
                      <div className="text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight mt-0.5">
                        {newAppeals.toLocaleString('ru-RU')}
                      </div>
                      <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 mt-0.5 flex items-center space-x-1">
                        <span>{newPercent}% kutishda</span>
                        <ChevronRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                  {/* Blue Sparkline */}
                  <div className="w-full h-7 mt-3">
                    <svg viewBox="0 0 200 40" className="w-full h-full stroke-blue-500 fill-none" preserveAspectRatio="none">
                      <path
                        d="M0 32 Q 20 25, 40 28 T 80 20 T 120 15 T 160 22 T 200 18"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>

                {/* 3. Ijro jarayonida */}
                <div
                  onClick={() => {
                    setStatusFilter('jarayonda');
                    setSelectedOrgFilter('all');
                    setSelectedMahallaFilter('all');
                    setSearchQuery('');
                    setActiveTab('appeals');
                  }}
                  className="bg-white dark:bg-[#0c1628] rounded-2xl p-4.5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs dark:shadow-md dark:shadow-black/20 relative overflow-hidden flex flex-col justify-between hover:shadow-md hover:border-amber-400 dark:hover:border-amber-500/60 transition-all cursor-pointer group active:scale-[0.99]"
                  title="Tashkilot qabul qilgan (ijrodagi) murojaatlar ro'yxatini ko'rish uchun bosing"
                >
                  <div className="flex items-start space-x-3">
                    <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Jarayonda</div>
                      <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                        {inProgressAppeals.toLocaleString('ru-RU')}
                      </div>
                      <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-0.5 flex items-center space-x-1">
                        <span>{inProgressPercent}% tashkilot olgan</span>
                        <ChevronRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                  {/* Amber Sparkline */}
                  <div className="w-full h-7 mt-3">
                    <svg viewBox="0 0 200 40" className="w-full h-full stroke-amber-500 fill-none" preserveAspectRatio="none">
                      <path
                        d="M0 25 Q 20 28, 40 22 T 80 16 T 120 24 T 160 18 T 200 20"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>

                {/* 4. Hal etilgan */}
                <div
                  onClick={() => {
                    setStatusFilter('hal_etildi');
                    setSelectedOrgFilter('all');
                    setSelectedMahallaFilter('all');
                    setSearchQuery('');
                    setActiveTab('appeals');
                  }}
                  className="bg-white dark:bg-[#0c1628] rounded-2xl p-4.5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs dark:shadow-md dark:shadow-black/20 relative overflow-hidden flex flex-col justify-between hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-500/60 transition-all cursor-pointer group active:scale-[0.99]"
                  title="Hal etilgan murojaatlar ro'yxatini ko'rish uchun bosing"
                >
                  <div className="flex items-start space-x-3">
                    <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Hal etilgan</div>
                      <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                        {resolvedAppeals.toLocaleString('ru-RU')}
                      </div>
                      <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center space-x-1">
                        <span>{resolvedPercent}% ijobiy yakun</span>
                        <ChevronRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                  {/* Green Sparkline */}
                  <div className="w-full h-7 mt-3">
                    <svg viewBox="0 0 200 40" className="w-full h-full stroke-emerald-500 fill-none" preserveAspectRatio="none">
                      <path
                        d="M0 30 Q 20 22, 40 16 T 80 25 T 120 18 T 160 22 T 200 15"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>

                {/* 5. Muddati o'tgan */}
                <div
                  onClick={() => {
                    setStatusFilter('overdue');
                    setSelectedOrgFilter('all');
                    setSelectedMahallaFilter('all');
                    setSearchQuery('');
                    setActiveTab('appeals');
                  }}
                  className="bg-white dark:bg-[#0c1628] rounded-2xl p-4.5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs dark:shadow-md dark:shadow-black/20 relative overflow-hidden flex flex-col justify-between hover:shadow-md hover:border-rose-400 dark:hover:border-rose-500/60 transition-all cursor-pointer group active:scale-[0.99]"
                  title="Muddati o'tgan murojaatlar ro'yxatini ko'rish uchun bosing"
                >
                  <div className="flex items-start space-x-3">
                    <div className="w-11 h-11 rounded-xl bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Muddati o‘tgan</div>
                      <div className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight mt-0.5">
                        {overdueAppeals.toLocaleString('ru-RU')}
                      </div>
                      <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-0.5 flex items-center space-x-1">
                        <span>{overduePercent}% kechikkan</span>
                        <ChevronRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                  {/* Red Sparkline */}
                  <div className="w-full h-7 mt-3">
                    <svg viewBox="0 0 200 40" className="w-full h-full stroke-rose-500 fill-none" preserveAspectRatio="none">
                      <path
                        d="M0 20 Q 20 16, 40 24 T 80 18 T 120 14 T 160 26 T 200 22"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* MIDDLE ROW: 3 ANALYTICAL CARDS (Murojaatlar holati + TOP Mahallalar + TOP Tashkilotlar) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* 1. Murojaatlar holati (ulush) Donut Chart - 4 Cols */}
                <div className="lg:col-span-4 bg-white dark:bg-[#0c1628] rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs dark:shadow-md dark:shadow-black/20 flex flex-col justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">Murojaatlar holati (ulush)</h2>
                    <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">Haqiqiy murojaatlar nisbati</p>
                  </div>

                  <div className="flex flex-col items-center justify-center my-4">
                    <div className="relative w-40 h-40 flex items-center justify-center">
                      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                        {/* Background circle */}
                        <circle
                          cx="50"
                          cy="50"
                          r="36"
                          fill="transparent"
                          stroke={isDarkMode ? '#131f37' : '#f1f5f9'}
                          strokeWidth="16"
                        />
                        {/* Hal etilgan (Green) */}
                        {resolvedDash > 0 && (
                          <circle
                            cx="50"
                            cy="50"
                            r="36"
                            fill="transparent"
                            stroke="#16a34a"
                            strokeWidth="16"
                            strokeDasharray={`${resolvedDash} ${CIRCLE_C}`}
                            strokeDashoffset="0"
                          />
                        )}
                        {/* Jarayonda (Orange) */}
                        {inProgressDash > 0 && (
                          <circle
                            cx="50"
                            cy="50"
                            r="36"
                            fill="transparent"
                            stroke="#f97316"
                            strokeWidth="16"
                            strokeDasharray={`${inProgressDash} ${CIRCLE_C}`}
                            strokeDashoffset={`${-resolvedDash}`}
                          />
                        )}
                        {/* Yangi (Blue) */}
                        {newDash > 0 && (
                          <circle
                            cx="50"
                            cy="50"
                            r="36"
                            fill="transparent"
                            stroke="#3b82f6"
                            strokeWidth="16"
                            strokeDasharray={`${newDash} ${CIRCLE_C}`}
                            strokeDashoffset={`${-(resolvedDash + inProgressDash)}`}
                          />
                        )}
                        {/* Muddati o'tgan (Red) */}
                        {overdueDash > 0 && (
                          <circle
                            cx="50"
                            cy="50"
                            r="36"
                            fill="transparent"
                            stroke="#ef4444"
                            strokeWidth="16"
                            strokeDasharray={`${overdueDash} ${CIRCLE_C}`}
                            strokeDashoffset={`${-(resolvedDash + inProgressDash + newDash)}`}
                          />
                        )}
                      </svg>
                      {/* Center Total Count */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-2xl font-black text-slate-900 dark:text-white leading-none">
                          {totalAppeals.toLocaleString('ru-RU')}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 mt-0.5">Jami</span>
                      </div>
                    </div>
                  </div>

                  {/* Donut Legend */}
                  <div className="space-y-2 text-xs font-semibold pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <div 
                      onClick={() => {
                        setStatusFilter('yangi');
                        setActiveTab('appeals');
                      }}
                      className="flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 p-1.5 rounded-lg transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                        <span className="text-slate-700 dark:text-slate-300">Yangi (Kutishda)</span>
                      </div>
                      <span className="text-slate-900 dark:text-white font-bold">
                        {newAppeals} ({newPercent}%)
                      </span>
                    </div>

                    <div 
                      onClick={() => {
                        setStatusFilter('jarayonda');
                        setActiveTab('appeals');
                      }}
                      className="flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 p-1.5 rounded-lg transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                        <span className="text-slate-700 dark:text-slate-300">Jarayonda (Ijroda)</span>
                      </div>
                      <span className="text-slate-900 dark:text-white font-bold">
                        {inProgressAppeals} ({inProgressPercent}%)
                      </span>
                    </div>

                    <div 
                      onClick={() => {
                        setStatusFilter('hal_etildi');
                        setActiveTab('appeals');
                      }}
                      className="flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 p-1.5 rounded-lg transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                        <span className="text-slate-700 dark:text-slate-300">Hal etilgan</span>
                      </div>
                      <span className="text-slate-900 dark:text-white font-bold">
                        {resolvedAppeals} ({resolvedPercent}%)
                      </span>
                    </div>

                    <div 
                      onClick={() => {
                        setStatusFilter('overdue');
                        setActiveTab('appeals');
                      }}
                      className="flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 p-1.5 rounded-lg transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                        <span className="text-slate-700 dark:text-slate-300">Muddati o‘tgan</span>
                      </div>
                      <span className="text-rose-600 dark:text-rose-400 font-bold">
                        {overdueAppeals} ({overduePercent}%)
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Murojaatlar bo'yicha TOP mahallalar - 4 Cols */}
                <div className="lg:col-span-4 bg-white dark:bg-[#0c1628] rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs dark:shadow-md dark:shadow-black/20 flex flex-col justify-between hover:border-blue-300 dark:hover:border-blue-500/50 transition-all">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">Murojaatlar bo'yicha TOP mahallalar</h2>
                        <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">Eng ko'p murojaat kelgan hududlar</p>
                      </div>
                      <button
                        onClick={() => setShowAllMahallasModal(true)}
                        className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[11px] font-bold rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
                        title="Barcha mahallalar ro'yxatini ochish"
                      >
                        <span>Barchasi</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Progress Bar List */}
                    <div className="space-y-4">
                      {topMahallas.map((item, idx) => {
                        const pct = maxMahallaCount > 0 ? Math.round((item.count / maxMahallaCount) * 100) : 0;
                        return (
                          <div
                            key={item.name}
                            onClick={() => {
                              setSearchQuery(item.name);
                              setActiveTab('appeals');
                            }}
                            className="space-y-1.5 cursor-pointer group"
                            title={`${item.name} murojaatlarini ko'rish`}
                          >
                            <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              <span className="truncate max-w-[200px]">
                                {idx + 1}. {item.name}
                              </span>
                              <span className="text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">{item.count} ta</span>
                            </div>
                            {/* Blue Progress Bar */}
                            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800/80 overflow-hidden">
                              <div
                                className="h-full bg-blue-600 rounded-full transition-all duration-500 group-hover:bg-blue-500"
                                style={{ width: `${Math.max(pct, item.count > 0 ? 5 : 0)}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <button
                      onClick={() => setShowAllMahallasModal(true)}
                      className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 font-bold transition-colors cursor-pointer flex items-center space-x-1 group"
                    >
                      <span>{PAXTACHI_MAHALLAS.length} ta mahalla kesimida</span>
                      <ChevronRight className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                    <span className="text-blue-600 dark:text-blue-400 font-bold">murojaatlar</span>
                  </div>
                </div>

                {/* 3. Murojaatlar bo'yicha TOP tashkilotlar - 4 Cols */}
                <div className="lg:col-span-4 bg-white dark:bg-[#0c1628] rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs dark:shadow-md dark:shadow-black/20 flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">Murojaatlar bo'yicha TOP tashkilotlar</h2>
                        <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">Ijrochi korxona va tashkilotlar</p>
                      </div>
                      <button
                        onClick={() => setShowAllOrganizationsModal(true)}
                        className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
                        title="Barcha tashkilotlar ro'yxatini ochish"
                      >
                        <span>Barchasi</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Progress Bar List */}
                    <div className="space-y-4">
                      {topOrganizations.map((item, idx) => {
                        const pct = maxOrgCount > 0 ? Math.round((item.count / maxOrgCount) * 100) : 0;
                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              setSelectedOrgFilter(item.id);
                              setActiveTab('appeals');
                            }}
                            className="space-y-1.5 cursor-pointer group"
                            title={`${item.name} murojaatlarini ko'rish`}
                          >
                            <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              <span className="truncate max-w-[200px]">
                                {idx + 1}. {item.name}
                              </span>
                              <span className="text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                {item.count} ta <span className="text-emerald-600 dark:text-emerald-400 font-normal text-[11px]">({item.resolved} hal)</span>
                              </span>
                            </div>
                            {/* Indigo Progress Bar */}
                            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800/80 overflow-hidden">
                              <div
                                className="h-full bg-indigo-600 rounded-full transition-all duration-500 group-hover:bg-indigo-500"
                                style={{ width: `${Math.max(pct, item.count > 0 ? 5 : 0)}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <button
                      onClick={() => setShowAllOrganizationsModal(true)}
                      className="text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold transition-colors cursor-pointer flex items-center space-x-1 group"
                    >
                      <span>{organizations.length} ta biriktirilgan tashkilot</span>
                      <ChevronRight className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">Ijro monitoringi</span>
                  </div>
                </div>
              </div>

              {/* BOTTOM ROW: 2 ANALYTICAL CARDS (TOP Vazifalar ijrosi + TOP Mahalla Yettiligi faoliyati) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* 1. Vazifalar bo'yicha TOP tashkilotlar */}
                <div className="bg-white dark:bg-[#0c1628] rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs dark:shadow-md dark:shadow-black/20 flex flex-col justify-between hover:border-violet-300 dark:hover:border-violet-500/50 transition-all">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">Vazifalar bo'yicha TOP tashkilotlar</h2>
                        <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">Sektor shtabi topshiriqlari ijrosi</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('tasks')}
                        className="px-2.5 py-1 bg-violet-50 dark:bg-violet-950/60 hover:bg-violet-100 dark:hover:bg-violet-900/60 text-violet-700 dark:text-violet-300 text-[11px] font-bold rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
                        title="Barcha vazifalarni ko'rish"
                      >
                        <span>Barchasi</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Progress Bar List */}
       <div className="space-y-4">
                {topTasksStats.map((item: any, idx: number) => {
                  // Chiziqlar uzunligini hisoblash uchun eng ko'p vazifasi bor tashkilotni topamiz
                  const currentMax = Math.max(...topTasksStats.map((t: any) => t.total), 1);
                  const pct = Math.round((item.total / currentMax) * 100);

                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedOrgFilter(item.id);
                        setActiveTab('tasks');
                      }}
                      className="space-y-1.5 cursor-pointer group"
                      title={`${item.name} vazifalarini ko'rish`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        <span className="truncate pr-2">
                          {idx + 1}. {item.name}
                        </span>
                        <span className="text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">
                          {item.total} ta <span className="text-emerald-600 dark:text-emerald-400 font-normal text-[11px]">({item.approved} bajarildi)</span>
                        </span>
                      </div>
                      {/* Binafsha rangli dinamik chiziq */}
                      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800/80 overflow-hidden">
                        <div
                          className="h-full bg-purple-600 rounded-full transition-all duration-500 group-hover:bg-purple-500"
                          style={{ width: `${item.total > 0 ? Math.max(pct, 2) : 0}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between mt-4">
                    <button
                      onClick={() => setActiveTab('tasks')}
                      className="text-slate-600 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 font-bold transition-colors cursor-pointer flex items-center space-x-1 group"
                    >
                      <span>{tasks.length} ta umumiy vazifa nazoratda</span>
                      <ChevronRight className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                    <span className="text-violet-600 dark:text-violet-400 font-bold">Shtab topshiriqlari</span>
                  </div>
                </div>

                {/* 2. Mahalla Yettiligi bo'yicha TOP mahallalar */}
                <div className="bg-white dark:bg-[#0c1628] rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs dark:shadow-md dark:shadow-black/20 flex flex-col justify-between hover:border-emerald-300 dark:hover:border-emerald-500/50 transition-all">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">Mahalla Yettiligi bo'yicha TOP mahallalar</h2>
                        <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">Yettilik faoliyati va topshiriqlar ijrosi</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('mahalla_yettiligi')}
                        className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
                        title="Mahalla yettiligi bo'limiga o'tish"
                      >
                        <span>Barchasi</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Progress Bar List */}
                    <div className="space-y-4">
                      {topMahallaYettiligiStats.map((item, idx) => {
                        const pct = maxMahallaTaskCount > 0 ? Math.round((item.total / maxMahallaTaskCount) * 100) : 0;
                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              setActiveTab('mahalla_yettiligi');
                            }}
                            className="space-y-1.5 cursor-pointer group"
                            title={`${item.name} yettiligi vazifalarini ko'rish`}
                          >
                            <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                              <span className="truncate max-w-[220px]">
                                {idx + 1}. {item.name}
                              </span>
                              <span className="text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                                {item.total} ta <span className="text-emerald-600 dark:text-emerald-400 font-normal text-[11px]">({item.completed} bajarildi)</span>
                              </span>
                            </div>
                            {/* Emerald Progress Bar */}
                            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800/80 overflow-hidden">
                              <div
                                className="h-full bg-emerald-600 rounded-full transition-all duration-500 group-hover:bg-emerald-500"
                                style={{ width: `${Math.max(pct, item.total > 0 ? 5 : 0)}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between mt-4">
                    <button
                      onClick={() => setActiveTab('mahalla_yettiligi')}
                      className="text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 font-bold transition-colors cursor-pointer flex items-center space-x-1 group"
                    >
                      <span>14 ta mahalla yettiligi</span>
                      <ChevronRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">Yettilik monitoringi</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= VIEW 2: MUROJAATLAR TO'LIQ RO'YXATI ================= */}
          {activeTab === 'appeals' && (
            <div className="space-y-5">
              {/* Filter Toolbar */}
              <div className="bg-white dark:bg-[#0c1628] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-wrap items-center justify-between gap-3 transition-colors">
                <div className="flex items-center space-x-2 flex-1 min-w-[240px]">
                  <div className="relative w-full">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Murojaatchi, telefon, raqam yoki matn bo'yicha qidirish..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2.5 flex-wrap">
                  {/* Status filter */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                  >
                    <option value="all">Barcha holatlar</option>
                    <option value="yangi">Yangi</option>
                    <option value="jarayonda">Jarayonda</option>
                    <option value="hal_etildi">Hal etilgan</option>
                    <option value="overdue">120 soat o'tgan (Muddati buzilgan)</option>
                    <option value="etirozli">E'tirozli</option>
                  </select>

                  {/* Organization filter */}
                  <select
                    value={selectedOrgFilter}
                    onChange={(e) => setSelectedOrgFilter(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200 outline-none cursor-pointer max-w-[200px]"
                  >
                    <option value="all">Barcha tashkilotlar</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>

                  {/* Clear All Appeals */}
                  <button
                    onClick={() => setShowClearConfirmModal(true)}
                    title="Barcha murojaatlarni tozalash"
                    className="flex items-center space-x-1.5 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    <span>Tozalash</span>
                  </button>

                  {/* Add Appeal */}
                  <button
                    onClick={() => setShowAddAppealModal(true)}
                    className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Qo'shish</span>
                  </button>
                </div>
              </div>

              {/* Appeals Table */}
              <div className="bg-white dark:bg-[#0c1628] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden transition-colors">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                        <th className="p-3.5">ID / Raqami</th>
                        <th className="p-3.5">Fuqaro & Telefon</th>
                        <th className="p-3.5">Mahalla & Manzil</th>
                        <th className="p-3.5">Biriktirilgan Tashkilot</th>
                        <th className="p-3.5 max-w-xs">Murojaat Mazmuni</th>
                        <th className="p-3.5">120 Soatlik SLA</th>
                        <th className="p-3.5">
                          <div className="inline-flex items-center space-x-2">
                            <span>Holati</span>
                            <div className="inline-flex items-center bg-slate-200/80 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-300/60 dark:border-slate-700 shadow-2xs">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAppealSortOrder('newest');
                                }}
                                title="Yangi murojaatlar yuqorida (Yangi ➡️ Eski)"
                                className={`p-1 rounded-md transition-all cursor-pointer ${
                                  appealSortOrder === 'newest'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-300/60 dark:hover:bg-slate-700'
                                }`}
                              >
                                <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAppealSortOrder('oldest');
                                }}
                                title="Eski murojaatlar yuqorida (Eski ➡️ Yangi)"
                                className={`p-1 rounded-md transition-all cursor-pointer ${
                                  appealSortOrder === 'oldest'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-300/60 dark:hover:bg-slate-700'
                                }`}
                              >
                                <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
                              </button>
                            </div>
                          </div>
                        </th>
                        <th className="p-3.5 text-right">Amal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {filteredAppeals.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-12 text-center text-slate-400">
                            <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-40 text-slate-500 dark:text-slate-400" />
                            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Murojaatlar topilmadi</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                              Telegram bot orqali murojaat yuborilganda bu yerda avtomatik paydo bo'ladi.
                            </p>
                            <button
                              onClick={handleSeedSamples}
                              className="mt-4 px-4 py-2 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-xl border border-blue-200 dark:border-blue-800 cursor-pointer"
                            >
                              Namuna murojaatlarni yuklash
                            </button>
                          </td>
                        </tr>
                      ) : (
                        filteredAppeals.map((appeal) => {
                          const sla = getSlaInfo(appeal.createdAt, appeal.deadlineAt, appeal.status);
                          return (
                            <tr
                              key={appeal.id}
                              onClick={() => setSelectedAppeal(appeal)}
                              className="hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                            >
                              <td className="p-3.5 font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                                {appeal.appealNumber}
                              </td>
                              <td className="p-3.5 whitespace-nowrap">
                                <div className="font-bold text-slate-900 dark:text-white">{appeal.fullName}</div>
                                <div className="text-slate-400 dark:text-slate-400 text-[11px]">{appeal.phone}</div>
                              </td>
                              <td className="p-3.5 text-slate-600 dark:text-slate-300">
                                {appeal.address || 'Paxtachi tumani'}
                              </td>
                              <td className="p-3.5 text-slate-700 dark:text-slate-200 font-semibold">
                                {appeal.organizationName}
                              </td>
                              <td className="p-3.5 text-slate-600 dark:text-slate-300 max-w-sm">
                                <p
                                  className="line-clamp-2 text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                  title={appeal.content}
                                >
                                  {appeal.content}
                                </p>
                                {appeal.content && appeal.content.length > 70 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedAppeal(appeal);
                                    }}
                                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-bold mt-0.5 inline-flex items-center space-x-0.5 cursor-pointer"
                                  >
                                    <span>Batafsil o‘qish</span>
                                    <ChevronRight className="w-3 h-3" />
                                  </button>
                                )}
                                {appeal.attachmentUrl && (
                                  <div className="mt-1">
                                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 rounded-md text-[10px] font-bold">
                                      <Image className="w-3 h-3" />
                                      <span>Foto ilova</span>
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="p-3.5 whitespace-nowrap">
                                <span className={`px-2 py-1 rounded-md text-[11px] border ${sla.className}`}>
                                  {sla.text}
                                </span>
                              </td>
                              <td className="p-3.5 whitespace-nowrap">
                                {getStatusBadge(appeal.status, appeal.feedback)}
                              </td>
                              <td className="p-3.5 text-right whitespace-nowrap">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedAppeal(appeal);
                                  }}
                                  className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                                >
                                  Ko'rish
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================= VIEW: BILDIRISHNOMALAR & SO'ROVLAR ================= */}
          {activeTab === 'notifications' && (
            <div className="space-y-6 animate-in fade-in">
              {/* Header Overview Card */}
              <div className="bg-white dark:bg-[#0c1628] rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-xs transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
                  <div className="flex items-center space-x-3.5">
                    <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-md shadow-blue-600/20">
                      <Bell className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                        Bildirishnomalar & So‘rovlar Markazi
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Tashkilotlar o‘rtasida murojaatni boshqasiga o‘tkazish so‘rovlari va hamkorlikdagi ijro hisobotlari
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={onRefresh}
                      disabled={isLoading}
                      className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer border border-transparent dark:border-slate-700"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
                      <span>Yangilash</span>
                    </button>
                  </div>
                </div>

                {/* 4 Summary Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5">
                  <div className="bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60 rounded-2xl p-3.5">
                    <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300">Kutilayotgan so‘rovlar</div>
                    <div className="text-2xl font-black text-amber-950 dark:text-amber-100 mt-1">
                      {pendingTransferAppeals.length}
                    </div>
                    <div className="text-[10px] text-amber-700 dark:text-amber-400 font-medium mt-0.5">Bosh Kabinet tasdig‘i kutilmoqda</div>
                  </div>

                  <div className="bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 rounded-2xl p-3.5">
                    <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">Bosh Kabinet ijro javoblari</div>
                    <div className="text-2xl font-black text-emerald-950 dark:text-emerald-100 mt-1">
                      {boshKabinetResolvedAppeals.length}
                    </div>
                    <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium mt-0.5">Tashkilotlar bajargan / xulosa</div>
                  </div>

                  <div className="bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 rounded-2xl p-3.5">
                    <div className="text-[11px] font-bold text-indigo-800 dark:text-indigo-300">Hamkorlikdagi ijrolar</div>
                    <div className="text-2xl font-black text-indigo-950 dark:text-indigo-100 mt-1">
                      {coAssignedAppeals.length}
                    </div>
                    <div className="text-[10px] text-indigo-700 dark:text-indigo-400 font-medium mt-0.5">{coResolutionsCount} ta xulosa topshirilgan</div>
                  </div>

                  <div className="bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/60 rounded-2xl p-3.5">
                    <div className="text-[11px] font-bold text-blue-800 dark:text-blue-300">Tasdiqlangan ko‘chirishlar</div>
                    <div className="text-2xl font-black text-blue-950 dark:text-blue-100 mt-1">
                      {approvedTransferAppeals.length}
                    </div>
                    <div className="text-[10px] text-blue-700 dark:text-blue-400 font-medium mt-0.5">Yangi tashkilotga o‘tkazildi</div>
                  </div>
                </div>
              </div>

              {/* Filters & Search Controls */}
              <div className="bg-white dark:bg-[#0c1628] rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors">
                {/* Filter Tabs */}
                <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                  <button
                    onClick={() => setNotificationFilter('all')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      notificationFilter === 'all'
                        ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Barchasi ({pendingTransferAppeals.length + coAssignedAppeals.length + boshKabinetResolvedAppeals.length})
                  </button>

                  <button
                    onClick={() => setNotificationFilter('pending')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center space-x-1.5 cursor-pointer ${
                      notificationFilter === 'pending'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200/60 dark:border-amber-800/60'
                    }`}
                  >
                    <span>Kutilayotgan so‘rovlar</span>
                    {pendingTransferAppeals.length > 0 && (
                      <span className="px-1.5 py-0.2 bg-amber-900 text-white rounded-full text-[10px] font-black">
                        {pendingTransferAppeals.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setNotificationFilter('bk_resolved')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center space-x-1.5 cursor-pointer ${
                      notificationFilter === 'bk_resolved'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200/60 dark:border-emerald-800/60'
                    }`}
                  >
                    <span>Bosh Kabinet ijro javoblari</span>
                    {boshKabinetResolvedAppeals.length > 0 && (
                      <span className="px-1.5 py-0.2 bg-emerald-900 text-white rounded-full text-[10px] font-black">
                        {boshKabinetResolvedAppeals.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setNotificationFilter('coassignments')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      notificationFilter === 'coassignments'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200/60 dark:border-indigo-800/60'
                    }`}
                  >
                    Hamkorlikdagi ijro ({coAssignedAppeals.length})
                  </button>

                  <button
                    onClick={() => setNotificationFilter('transfers')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      notificationFilter === 'transfers'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200/60 dark:border-blue-800/60'
                    }`}
                  >
                    Tashkilot o‘tkazish ({transferAppeals.length})
                  </button>

                  <button
                    onClick={() => setNotificationFilter('resolved')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      notificationFilter === 'resolved'
                        ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-800'
                    }`}
                  >
                    Barcha hal etilganlar
                  </button>
                </div>

                {/* Text Search */}
                <div className="relative w-full md:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={notificationSearch}
                    onChange={(e) => setNotificationSearch(e.target.value)}
                    placeholder="Qidiruv (F.I.Sh, tashkilot, sabab)..."
                    className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
                  />
                  {notificationSearch && (
                    <button
                      onClick={() => setNotificationSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Notifications Feed */}
              <div className="space-y-4">
                {filteredNotifications.length === 0 ? (
                  <div className="bg-white dark:bg-[#0c1628] rounded-3xl p-12 border border-slate-200/80 dark:border-slate-800/80 text-center space-y-3 transition-colors">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                      <Inbox className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">Bildirishnomalar topilmadi</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                        {notificationSearch || notificationFilter !== 'all'
                          ? 'Belgilangan qidiruv yoki filter bo‘yicha hech qanday bildirishnoma mavjud emas.'
                          : 'Hozircha tashkilotlar tomonidan o‘tkazish so‘rovlari yoki hamkorlikdagi yangilanishlar yo‘q.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  filteredNotifications.map((item) => {
                    const { type, appeal, date } = item;
                    const isTransfer = type === 'transfer';
                    const isBkResolved = type === 'bk_resolved';
                    const tr = appeal.transferRequest;

                    return (
                      <div
                        key={`${type}-${appeal.id}`}
                        className={`bg-white dark:bg-[#0c1628] rounded-2xl border transition-all shadow-xs hover:shadow-md p-5 space-y-4 ${
                          isTransfer && tr?.status === 'pending'
                            ? 'border-amber-300 dark:border-amber-600/60 ring-2 ring-amber-500/10'
                            : isBkResolved
                            ? 'border-emerald-200 dark:border-emerald-700/60 ring-1 ring-emerald-500/20'
                            : 'border-slate-200/90 dark:border-slate-800'
                        }`}
                      >
                        {/* Card Header Top Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                          <div className="flex items-center space-x-2.5">
                            {isTransfer ? (
                              <span className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex-shrink-0">
                                <ArrowRightLeft className="w-4 h-4" />
                              </span>
                            ) : isBkResolved ? (
                              <span className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex-shrink-0">
                                <CheckCheck className="w-4 h-4" />
                              </span>
                            ) : (
                              <span className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex-shrink-0">
                                <Share2 className="w-4 h-4" />
                              </span>
                            )}
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-black text-slate-900 dark:text-white">
                                  {isTransfer
                                    ? 'Tashkilot almashtirish so‘rovi'
                                    : isBkResolved
                                    ? 'Bosh Kabinet murojaatining ijro xulosasi'
                                    : 'Hamkorlikdagi birgalikda ijro'}
                                </span>
                                <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                                  {appeal.appealNumber}
                                </span>
                                {isBkResolved && (
                                  <span className="px-2 py-0.5 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-md font-bold text-[10px]">
                                    🏛️ Bosh Kabinet murojaati
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 dark:text-slate-400 mt-0.5">
                                Sana: {new Date(date).toLocaleString('ru-RU')}
                              </div>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className="flex items-center space-x-2">
                            {isTransfer && tr && (
                              <>
                                {tr.status === 'pending' && (
                                  <span className="px-3 py-1 bg-amber-500/15 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-300 font-black text-xs rounded-full flex items-center space-x-1.5 animate-pulse">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>Bosh Kabinet tasdig‘i kutilmoqda</span>
                                  </span>
                                )}
                                {tr.status === 'approved' && (
                                  <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold text-xs rounded-full flex items-center space-x-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>O‘tkazish tasdiqlangan</span>
                                  </span>
                                )}
                                {tr.status === 'rejected' && (
                                  <span className="px-3 py-1 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold text-xs rounded-full flex items-center space-x-1.5">
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>O‘tkazish rad etilgan</span>
                                  </span>
                                )}
                              </>
                            )}

                            {isBkResolved && (
                              <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold text-xs rounded-full flex items-center space-x-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>Tashkilot ijroni yakunladi</span>
                              </span>
                            )}

                            {!isTransfer && !isBkResolved && (
                              <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold text-xs rounded-full flex items-center space-x-1.5">
                                <Users className="w-3.5 h-3.5" />
                                <span>
                                  {appeal.coOrgResolutions && appeal.coOrgResolutions.length > 0
                                    ? `${appeal.coOrgResolutions.length} ta xulosa kiritilgan`
                                    : 'Ijro jarayonida'}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Citizen info & Content Preview */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50/80 dark:bg-slate-900/80 p-3.5 rounded-xl text-xs border border-transparent dark:border-slate-800">
                          <div>
                            <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">Fuqaro:</span>
                            <span className="font-bold text-slate-900 dark:text-white">{appeal.fullName}</span>
                            <span className="text-slate-500 dark:text-slate-400 block text-[11px]">{appeal.phone}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">Mahalla / Manzil:</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{appeal.mahalla || 'Paxtachi tumani'}</span>
                            <span className="text-slate-500 dark:text-slate-400 block text-[11px] truncate">{appeal.address || '—'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">Murojaat matni:</span>
                            <p className="text-slate-700 dark:text-slate-300 line-clamp-2 italic">"{appeal.content}"</p>
                          </div>
                        </div>

                        {/* DETAIL BODY FOR BOSH KABINET RESOLVED APPEAL */}
                        {isBkResolved && (
                          <div className="space-y-3">
                            <div className="bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 p-4 rounded-2xl space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-100 dark:border-emerald-800/60 pb-2.5">
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">Mas'ul Ijrochi Tashkilot:</span>
                                  <span className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300 font-black rounded-lg text-xs">
                                    🏢 {appeal.organizationName}
                                  </span>
                                </div>
                                {appeal.resolvedAt && (
                                  <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                                    Bajarilgan vaqt: {new Date(appeal.resolvedAt).toLocaleString('ru-RU')}
                                  </span>
                                )}
                              </div>

                              {appeal.resolutionText && (
                                <div className="space-y-1">
                                  <span className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300 uppercase">Tashkilot javobi va ijro xulosasi:</span>
                                  <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-900/60 text-slate-800 dark:text-slate-200 text-xs leading-relaxed font-medium">
                                    {appeal.resolutionText}
                                  </div>
                                </div>
                              )}

                              {appeal.resolutionFiles && appeal.resolutionFiles.length > 0 && (
                                <div className="space-y-1.5 pt-1">
                                  <span className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300 uppercase flex items-center space-x-1">
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>Biriktirilgan ijro hujjatlari / fayllari ({appeal.resolutionFiles.length} ta):</span>
                                  </span>
                                  <div className="flex flex-wrap gap-2">
                                    {appeal.resolutionFiles.map((file, fIdx) => (
                                      <a
                                        key={fIdx}
                                        href={file.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center space-x-2 px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-emerald-100/50 dark:hover:bg-slate-800 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300 rounded-xl text-xs font-bold transition-all shadow-2xs"
                                      >
                                        <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                        <span className="truncate max-w-[200px]">{file.name}</span>
                                        {file.size && (
                                          <span className="text-[10px] text-slate-400">
                                            ({(file.size / 1024).toFixed(0)} KB)
                                          </span>
                                        )}
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {appeal.explanations && appeal.explanations.length > 0 && (
                                <div className="space-y-2 pt-1 border-t border-emerald-100 dark:border-emerald-800/60">
                                  <span className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300 uppercase">
                                    Qo‘shimcha tushuntirish va ma'lumotlar:
                                  </span>
                                  {appeal.explanations.map((exp) => (
                                    <div key={exp.id} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/60 text-xs space-y-1">
                                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                                        <span className="font-bold text-slate-700 dark:text-slate-300">{exp.organizationName} ({exp.authorName})</span>
                                        <span>{new Date(exp.createdAt).toLocaleString('ru-RU')}</span>
                                      </div>
                                      <p className="text-slate-800 dark:text-slate-200">{exp.text}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="pt-1 flex items-center justify-between">
                              <button
                                onClick={() => setSelectedAppeal(appeal)}
                                className="px-3.5 py-2 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold rounded-xl text-xs transition-colors flex items-center space-x-1.5 cursor-pointer border border-blue-200 dark:border-blue-800"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Murojaatni to‘liq ochish</span>
                              </button>

                              <span className="text-xs text-slate-400">
                                Umumiy holat: {getStatusBadge(appeal.status, appeal.feedback)}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* DETAIL BODY FOR TRANSFER REQUEST */}
                        {isTransfer && tr && (
                          <div className="space-y-3">
                            {/* Transfer Route Highlight Box */}
                            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm border border-slate-700">
                              <div className="flex items-center space-x-3 w-full sm:w-auto">
                                <div className="p-2.5 bg-rose-500/20 text-rose-300 rounded-xl border border-rose-500/30">
                                  <div className="text-[10px] text-rose-300 font-bold uppercase">Chiqaruvchi tashkilot</div>
                                  <div className="font-black text-sm text-white">{tr.fromOrgName}</div>
                                </div>

                                <div className="p-2 rounded-full bg-white/10 text-white flex-shrink-0">
                                  <ArrowRight className="w-4 h-4" />
                                </div>

                                <div className="p-2.5 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-500/30">
                                  <div className="text-[10px] text-emerald-300 font-bold uppercase">Yangi mas'ul tashkilot(lar)</div>
                                  <div className="font-black text-sm text-white">
                                    {tr.toOrgNames && tr.toOrgNames.length > 0
                                      ? tr.toOrgNames.join(', ')
                                      : tr.toOrgName}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right text-xs text-slate-300">
                                <div>So‘ralgan vaqt: <span className="font-semibold text-white">{new Date(tr.requestedAt).toLocaleString('ru-RU')}</span></div>
                              </div>
                            </div>

                            {/* Transfer Reason & Evidence */}
                            <div className="bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 p-3.5 rounded-xl text-xs space-y-1">
                              <div className="font-bold text-amber-900 dark:text-amber-300 flex items-center space-x-1.5">
                                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                <span>Tashkilot ko‘rsatgan o‘tkazish asosi / sababi:</span>
                              </div>
                              <p className="text-slate-800 dark:text-slate-200 font-medium pl-5 leading-relaxed">
                                {tr.reason}
                              </p>
                            </div>

                            {/* Rejection Note if Rejected */}
                            {tr.status === 'rejected' && tr.adminNote && (
                              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 p-3 rounded-xl text-xs space-y-1">
                                <div className="font-bold text-rose-900 dark:text-rose-300">Bosh Kabinet rad etish izohi:</div>
                                <p className="text-rose-800 dark:text-rose-200">{tr.adminNote}</p>
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800">
                              <button
                                onClick={() => setSelectedAppeal(appeal)}
                                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition-colors flex items-center space-x-1.5 cursor-pointer border border-transparent dark:border-slate-700"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Murojaatni to‘liq ko‘rish</span>
                              </button>

                              {tr.status === 'pending' && (
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => handleOpenRejectTransferModal(appeal.id)}
                                    disabled={isProcessingTransfer}
                                    className="px-4 py-2 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold rounded-xl text-xs transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                                  >
                                    <XCircle className="w-4 h-4" />
                                    <span>Rad etish (O‘zida qoldirish)</span>
                                  </button>

                                  <button
                                    onClick={() => handleApproveTransferClick(appeal.id)}
                                    disabled={isProcessingTransfer}
                                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow-md shadow-emerald-600/30 transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                                  >
                                    <CheckCheck className="w-4 h-4" />
                                    <span>Tasdiqlash & Yangi tashkilotga o‘tkazish</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* DETAIL BODY FOR CO-ASSIGNMENT */}
                        {!isTransfer && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/60 p-3 rounded-xl text-xs">
                                <span className="text-blue-900 dark:text-blue-300 font-bold block mb-1">Bosh Mas'ul Tashkilot:</span>
                                <span className="font-black text-slate-900 dark:text-white text-sm">{appeal.organizationName}</span>
                              </div>

                              <div className="bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 p-3 rounded-xl text-xs">
                                <span className="text-indigo-900 dark:text-indigo-300 font-bold block mb-1">Hamkor Tashkilotlar:</span>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {(appeal.coAssignedOrgNames && appeal.coAssignedOrgNames.length > 0) ? (
                                    appeal.coAssignedOrgNames.map((name, idx) => (
                                      <span
                                        key={idx}
                                        className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-300 font-bold rounded-lg text-[11px] shadow-2xs flex items-center space-x-1"
                                      >
                                        <Users className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                        <span>{name}</span>
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-slate-400 italic">Hamkorlar taklif qilinmoqda</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Submitted Co-Resolutions */}
                            {appeal.coOrgResolutions && appeal.coOrgResolutions.length > 0 && (
                              <div className="bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 p-3.5 rounded-xl text-xs space-y-2">
                                <div className="font-bold text-emerald-950 dark:text-emerald-200 flex items-center space-x-1.5">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                  <span>Hamkor tashkilotlar tomonidan kiritilgan xulosalar:</span>
                                </div>
                                <div className="space-y-2 pl-2">
                                  {appeal.coOrgResolutions.map((res, rIdx) => (
                                    <div key={rIdx} className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/60 shadow-2xs space-y-1">
                                      <div className="flex items-center justify-between text-[11px]">
                                        <span className="font-bold text-emerald-900 dark:text-emerald-300">{res.orgName}</span>
                                        <span className="text-slate-400">{new Date(res.resolvedAt).toLocaleString('ru-RU')}</span>
                                      </div>
                                      <p className="text-slate-800 dark:text-slate-200 text-xs">{res.resolutionText}</p>
                                      {res.operatorName && (
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Mas'ul: {res.operatorName}</div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                              <button
                                onClick={() => setSelectedAppeal(appeal)}
                                className="px-3.5 py-2 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold rounded-xl text-xs transition-colors flex items-center space-x-1.5 cursor-pointer border border-blue-200 dark:border-blue-800"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Murojaatni to‘liq ochish</span>
                              </button>

                              <span className="text-xs text-slate-400">
                                Umumiy holat: {getStatusBadge(appeal.status, appeal.feedback)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ================= VIEW 2.5: TASHKILOTLAR VA PAROLLAR XAVFSIZLIGI ================= */}
          {activeTab === 'tashkilotlar' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Header Title Banner */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-indigo-900/50">
                <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-2 max-w-2xl">
                    <div className="inline-flex items-center space-x-2 px-3 py-1 bg-indigo-500/20 border border-indigo-400/30 rounded-full text-xs font-bold text-indigo-300">
                      <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                      <span>murojaatlar Xavfsizlik & Kirish Kodlari Markazi</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                      Tashkilotlar Kirish Kodlari va Xavfsizlik Nazorati
                    </h2>
                    <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                      Sektor tarkibidagi barcha 18 ta mas'ul tashkilotning maxsus kirish parollari, xato urinishlar monitoringi, avtomatik bloklanish holati va yangi parol berish tizimi.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 flex-shrink-0">
                    <button
                      onClick={() => setShowAddOrgModal(true)}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-black flex items-center space-x-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Yangi Tashkilot Qo'shish</span>
                    </button>
                    {onRefresh && (
                      <button
                        onClick={onRefresh}
                        className="px-3.5 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-2xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer border border-slate-700"
                        title="Ma'lumotlarni yangilash"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>Yangilash</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 4 Key Security Status Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-[#0c1628] border border-slate-200/80 dark:border-slate-800/80 p-5 rounded-3xl shadow-xs transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Jami Tashkilotlar</span>
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl">
                      <Building2 className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">{organizations.length} ta</div>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold mt-1 block">murojaatlar mas'ul idoralari</span>
                </div>

                <div className="bg-white dark:bg-[#0c1628] border border-emerald-200/70 dark:border-emerald-800/60 p-5 rounded-3xl shadow-xs transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Faol & Xavfsiz</span>
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-emerald-950 dark:text-emerald-200">{safeOrgsCount} ta</div>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 block">Hech qanday xato urinishsiz</span>
                </div>

                <div className="bg-white dark:bg-[#0c1628] border border-amber-200/70 dark:border-amber-800/60 p-5 rounded-3xl shadow-xs transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-amber-800 dark:text-amber-300">Ogohlantirish (Urinishlar)</span>
                    <div className="p-2 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 rounded-xl">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-amber-950 dark:text-amber-200">{warningOrgsCount} ta</div>
                  <span className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold mt-1 block">1 yoki 2 marta xato kiritilgan</span>
                </div>

                <div className="bg-white dark:bg-[#0c1628] border border-rose-200/80 dark:border-rose-800/60 p-5 rounded-3xl shadow-xs transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-rose-700 dark:text-rose-400">Bloklangan Tashkilotlar</span>
                    <div className="p-2 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl">
                      <Lock className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-rose-950 dark:text-rose-200">{lockedOrgsCount} ta</div>
                  <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-1 block">
                    {lockedOrgsCount > 0 ? '🚨 Yangi parol berish kerak' : 'Hozircha bloklanganlar yo‘q'}
                  </span>
                </div>
              </div>

              {/* Urgent Alert Banner if any Org is locked */}
              {lockedOrgsCount > 0 && (
                <div className="bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-3xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-top duration-300">
                  <div className="flex items-center space-x-3.5">
                    <div className="p-3 bg-white/20 rounded-2xl flex-shrink-0">
                      <Lock className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-base font-black">
                        Diqqat: {lockedOrgsCount} ta tashkilot bloklangan holatda!
                      </h3>
                      <p className="text-xs text-rose-100 mt-0.5">
                        Ularning tizimga kirishi to‘xtatilgan. Bosh Kabinet orqali blokdan chiqarishingiz yoki yangi parol berishingiz mumkin.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSecurityFilter('locked')}
                    className="px-4 py-2 bg-white text-rose-700 hover:bg-rose-50 font-black rounded-xl text-xs flex-shrink-0 shadow-sm transition-all cursor-pointer"
                  >
                    Bloklanganlarni ko‘rish
                  </button>
                </div>
              )}

              {/* Filters & Search Toolbar */}
              <div className="bg-white dark:bg-[#0c1628] rounded-3xl p-4 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col md:flex-row items-center gap-3 justify-between transition-colors">
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <button
                    onClick={() => setSecurityFilter('all')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      securityFilter === 'all'
                        ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Barchasi ({organizations.length})
                  </button>

                  <button
                    onClick={() => setSecurityFilter('locked')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                      securityFilter === 'locked'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-transparent dark:border-rose-800/50'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Bloklanganlar ({lockedOrgsCount})</span>
                  </button>

                  <button
                    onClick={() => setSecurityFilter('warning')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                      securityFilter === 'warning'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-transparent dark:border-amber-800/50'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Urinish borlar ({warningOrgsCount})</span>
                  </button>

                  <button
                    onClick={() => setSecurityFilter('clean')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                      securityFilter === 'clean'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-transparent dark:border-emerald-800/50'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Xavfsiz ({safeOrgsCount})</span>
                  </button>
                </div>

                <div className="flex items-center space-x-2.5 w-full md:w-auto">
                  <div className="relative flex-1 md:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={securitySearch}
                      onChange={(e) => setSecuritySearch(e.target.value)}
                      placeholder="Tashkilot nomi, kodi, rahbari..."
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
                    />
                  </div>

                  <select
                    value={securityCategoryFilter}
                    onChange={(e) => setSecurityCategoryFilter(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="all">Barcha sohalar</option>
                    {orgCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Organizations Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredSecurityOrgs.length === 0 ? (
                  <div className="col-span-full bg-white dark:bg-[#0c1628] rounded-3xl p-12 text-center border border-dashed border-slate-200 dark:border-slate-800">
                    <Building2 className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Hech qanday tashkilot topilmadi</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Qidiruv yoki filtr mezonlarini o‘zgartiring</p>
                  </div>
                ) : (
                  filteredSecurityOrgs.map((org, idx) => {
                    const isPassVisible = !!visiblePasswords[org.id];
                    const isCopied = copiedOrgPasswordId === org.id;
                    const attempts = org.failedLoginAttempts || 0;

                    return (
                      <div
                        key={org.id}
                        className={`bg-white dark:bg-[#0c1628] rounded-3xl p-5 border transition-all shadow-xs hover:shadow-md flex flex-col justify-between space-y-4 ${
                          org.isLocked
                            ? 'border-rose-300 dark:border-rose-700 ring-2 ring-rose-500/20 bg-rose-50/20 dark:bg-rose-950/20'
                            : attempts > 0
                            ? 'border-amber-300 dark:border-amber-700 ring-2 ring-amber-500/20'
                            : 'border-slate-200/80 dark:border-slate-800/90 hover:border-blue-300 dark:hover:border-blue-700'
                        }`}
                      >
                        <div>
                          {/* Top: Name & Category */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="w-5 h-5 rounded-full bg-slate-900 dark:bg-blue-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0">
                                  {idx + 1}
                                </span>
                                <h3 className="font-black text-slate-900 dark:text-white text-sm truncate leading-snug">
                                  {org.name}
                                </h3>
                              </div>
                              <div className="flex items-center space-x-2 mt-1.5">
                                <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-extrabold rounded-md font-mono border border-slate-200 dark:border-slate-700">
                                  {org.code}
                                </span>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{org.category}</span>
                              </div>
                            </div>

                            {/* Security Status Pill */}
                            {org.isLocked ? (
                              <span className="px-2.5 py-1 bg-rose-500 text-white text-[10px] font-black rounded-xl shadow-xs flex items-center space-x-1 flex-shrink-0 animate-pulse">
                                <Lock className="w-3.5 h-3.5" />
                                <span>BLOKLANGAN</span>
                              </span>
                            ) : attempts > 0 ? (
                              <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700 text-[10px] font-black rounded-xl flex items-center space-x-1 flex-shrink-0">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                                <span>{attempts}/3 ta xato</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-black rounded-xl flex items-center space-x-1 flex-shrink-0">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>Xavfsiz</span>
                              </span>
                            )}
                          </div>

                          {/* Security Notice Message if locked or attempts */}
                          {org.isLocked && (
                            <div className="mt-3 p-2.5 bg-rose-100/70 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 rounded-xl text-xs space-y-1">
                              <div className="font-extrabold flex items-center space-x-1">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                                <span>Kirish 3 ta xato sababli bloklangan</span>
                              </div>
                              <p className="text-[11px] text-rose-800 dark:text-rose-300 leading-tight">
                                Tashkilot mas'uli Bosh Kabinetga murojaat qilishi kerak. Yangi parol bering yoki qulfdan chiqaring.
                              </p>
                            </div>
                          )}

                          {attempts > 0 && !org.isLocked && (
                            <div className="mt-3 p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-xl text-xs space-y-0.5">
                              <span className="font-bold">⚠️ {attempts} marta xato parol terildi</span>
                              <p className="text-[11px] text-amber-800 dark:text-amber-300">
                                Yana {3 - attempts} marta xato kiritilsa, tizim avtomatik bloklanadi.
                              </p>
                            </div>
                          )}

                          {/* Details: Leader & Phone */}
                          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-bold">Mas'ul Rahbar:</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                                {org.leader || 'Tayinlanmagan'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-bold">Telefon:</span>
                              <a href={`tel:${org.phone}`} className="font-bold text-blue-600 dark:text-blue-400 hover:underline block truncate mt-0.5">
                                {org.phone || '+998 66 403-11-22'}
                              </a>
                            </div>
                          </div>

                          {/* Password Box */}
                          <div className="mt-3 bg-slate-50 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-2.5">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                                <Key className="w-3 h-3 text-amber-500" />
                                <span>Maxsus Kirish Paroli:</span>
                              </span>
                              <div className="flex items-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setVisiblePasswords((prev) => ({
                                      ...prev,
                                      [org.id]: !prev[org.id],
                                    }))
                                  }
                                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                  title={isPassVisible ? 'Parolni yashirish' : "Parolni ko'rsatish"}
                                >
                                  {isPassVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCopyOrgPassword(org.id, org.password)}
                                  className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-md hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                  title="Paroldan nusxa olish"
                                >
                                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-sm font-black text-slate-900 dark:text-white tracking-wider">
                                {isPassVisible ? org.password : '••••••••••••'}
                              </span>
                              <button
                                onClick={() => handleCopyOrgPassword(org.id, org.password)}
                                className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors cursor-pointer"
                              >
                                {isCopied ? 'Nusxalandi!' : 'Nusxalash'}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons Toolbar */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                          <button
                            onClick={() => {
                              setResetPasswordModalOrg(org);
                              setCustomNewPassword(`pablo-${Math.floor(1000 + Math.random() * 9000)}`);
                            }}
                            className="flex-1 py-2 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-600 hover:text-white text-blue-700 dark:text-blue-300 font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer border border-blue-200 dark:border-blue-800/80"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Yangi Parol Berish</span>
                          </button>

                          {org.isLocked || attempts > 0 ? (
                            <button
                              onClick={() => handleUnlockOrg(org)}
                              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer"
                              title="Qulfdan chiqarish va urinishlarni nolga tushirish"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              <span>Blokdan Chiqarish</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleLockOrg(org)}
                              className="px-3 py-2 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-600 hover:text-white text-rose-700 dark:text-rose-300 font-bold rounded-xl text-xs border border-rose-200 dark:border-rose-800 flex items-center space-x-1.5 transition-all cursor-pointer"
                              title="Xavfsizlik yuzasidan kirishni to‘xtatib turish (bloklash)"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>Bloklash</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setSelectedOrgFilter(org.id);
                              setActiveTab('appeals');
                            }}
                            className="px-2.5 py-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs transition-colors cursor-pointer"
                            title="Murojaatlarini ko‘rish"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ================= VIEW 3: VAZIFALAR (18 TA TASHKILOT & SHTAB VAZIFALARI) ================= */}
          {activeTab === 'tasks' && (
            <div className="space-y-6">
              {/* If no organization is selected -> Show All 18 Organizations Overview */}
              {selectedOrgForTasks === null ? (
                <>
                  {/* Header Banner with Actions */}
                  <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                    <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                      <div className="space-y-2 max-w-2xl">
                        <div className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-500/20 border border-blue-400/30 rounded-full text-xs font-bold text-blue-200">
                          <Briefcase className="w-3.5 h-3.5" />
                          <span>murojaatlar Shtab A'zolari & 15 ta Tashkilot</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                          15 ta Shtab A'zosi Tashkilotlari Vazifalari & Ijro Intizomi
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                          Har bir shtab a'zosi o‘z sohasiga oid maxsus tasdiqlangan vazifalarga ega. Kerakli tashkilot ustiga bosib, uning barcha vazifalari, muddatlari va hisobotlarini ko‘rishingiz hamda boshqarishingiz mumkin.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          onClick={async () => {
                            if (onSeedAllTasks) {
                              if (
                                !window.confirm(
                                  "Barcha 15 ta shtab a'zosi tashkilotiga o‘z sohasiga mos tasdiqlangan topshiriqlarni biriktirib yuborishni tasdiqlaysizmi?"
                                )
                              )
                                return;
                              setIsSeedingTasks(true);
                              try {
                                await onSeedAllTasks();
                                showToast("✅ Barcha 15 ta shtab a'zosi tashkilotiga sohaviy vazifalar muvaffaqiyatli yuborildi!");
                              } catch (err: any) {
                                alert("Xatolik: " + err.message);
                              } finally {
                                setIsSeedingTasks(false);
                              }
                            } else if (onSeed7Tasks) {
                              setIsSeedingTasks(true);
                              try {
                                await onSeed7Tasks();
                                showToast("✅ 15 ta tashkilotga vazifalar muvaffaqiyatli yuborildi!");
                              } catch (err: any) {
                                alert("Xatolik: " + err.message);
                              } finally {
                                setIsSeedingTasks(false);
                              }
                            }
                          }}
                          disabled={isSeedingTasks}
                          className="px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-lg shadow-emerald-900/30 transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                          title="Barcha 15 ta shtab a'zosi tashkilotiga sohaviy vazifalarni biriktirish"
                        >
                          <Zap className="w-4 h-4 text-emerald-200" />
                          <span>{isSeedingTasks ? "Yuborilmoqda..." : "15 ta Shtab A'zosiga Vazifalarni Yuborish"}</span>
                        </button>

                        <button
                          onClick={() => setShowCreateTaskModal(true)}
                          className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl text-xs sm:text-sm border border-white/20 backdrop-blur-xs transition-all flex items-center space-x-2 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Yangi Topshiriq</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Tasks 4 Main Status Section Buttons */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    <button
                      type="button"
                      onClick={() => setTaskStatusFilter(taskStatusFilter === 'jarayonda' ? 'all' : 'jarayonda')}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                        taskStatusFilter === 'jarayonda'
                          ? 'bg-amber-500 text-white border-amber-500 shadow-md ring-2 ring-amber-300 dark:ring-amber-700'
                          : 'bg-white dark:bg-[#0c1628] text-slate-800 dark:text-slate-200 border-slate-200/80 dark:border-slate-800/80 hover:border-amber-400 hover:bg-amber-50/40 dark:hover:bg-amber-950/20 shadow-xs'
                      }`}
                    >
                      <div className={`text-xs font-bold ${taskStatusFilter === 'jarayonda' ? 'text-white' : 'text-amber-600 dark:text-amber-400'}`}>
                        ⏱️ Jarayonda (Ijroda)
                      </div>
                      <div className="text-2xl font-black mt-1 text-slate-900 dark:text-white">{inProgressTasksCount}</div>
                      <div className={`text-[10px] mt-0.5 ${taskStatusFilter === 'jarayonda' ? 'text-amber-100' : 'text-slate-400 dark:text-slate-500'}`}>
                        Ijro etilayotgan topshiriqlar
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTaskStatusFilter(taskStatusFilter === 'tekshiruvda' ? 'all' : 'tekshiruvda')}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative ${
                        taskStatusFilter === 'tekshiruvda'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-300 dark:ring-purple-700'
                          : underReviewTasksCount > 0
                          ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 border-purple-300 dark:border-purple-800 shadow-xs hover:border-purple-400'
                          : 'bg-white dark:bg-[#0c1628] text-slate-800 dark:text-slate-200 border-slate-200/80 dark:border-slate-800/80 hover:border-purple-300 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${taskStatusFilter === 'tekshiruvda' ? 'text-white' : 'text-purple-700 dark:text-purple-400'}`}>
                          📝 Tekshiruvda (Hisobot)
                        </span>
                        {underReviewTasksCount > 0 && (
                          <span className="flex h-2.5 w-2.5 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-600"></span>
                          </span>
                        )}
                      </div>
                      <div className={`text-2xl font-black mt-1 ${taskStatusFilter === 'tekshiruvda' ? 'text-white' : 'text-purple-900 dark:text-purple-200'}`}>
                        {underReviewTasksCount}
                      </div>
                      <div className={`text-[10px] mt-0.5 ${taskStatusFilter === 'tekshiruvda' ? 'text-purple-100' : 'text-purple-600 dark:text-purple-400'}`}>
                        {underReviewTasksCount > 0 ? "Tasdiqlash kutilmoqda" : "Hozircha hisobot yo‘q"}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTaskStatusFilter(taskStatusFilter === 'tasdiqlandi' ? 'all' : 'tasdiqlandi')}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                        taskStatusFilter === 'tasdiqlandi'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-300 dark:ring-emerald-700'
                          : 'bg-white dark:bg-[#0c1628] text-slate-800 dark:text-slate-200 border-slate-200/80 dark:border-slate-800/80 hover:border-emerald-400 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 shadow-xs'
                      }`}
                    >
                      <div className={`text-xs font-bold ${taskStatusFilter === 'tasdiqlandi' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        ✅ Tasdiqlangan (Bajarildi)
                      </div>
                      <div className={`text-2xl font-black mt-1 ${taskStatusFilter === 'tasdiqlandi' ? 'text-white' : 'text-emerald-700 dark:text-emerald-300'}`}>
                        {approvedTasksCount}
                      </div>
                      <div className={`text-[10px] mt-0.5 ${taskStatusFilter === 'tasdiqlandi' ? 'text-emerald-100' : 'text-slate-400 dark:text-slate-500'}`}>
                        Muvaffaqiyatli qabul qilingan
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTaskStatusFilter(taskStatusFilter === 'qaytarildi' ? 'all' : 'qaytarildi')}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                        taskStatusFilter === 'qaytarildi'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-300 dark:ring-rose-700'
                          : 'bg-white dark:bg-[#0c1628] text-slate-800 dark:text-slate-200 border-slate-200/80 dark:border-slate-800/80 hover:border-rose-400 hover:bg-rose-50/40 dark:hover:bg-rose-950/20 shadow-xs'
                      }`}
                    >
                      <div className={`text-xs font-bold ${taskStatusFilter === 'qaytarildi' ? 'text-white' : 'text-rose-600 dark:text-rose-400'}`}>
                        ⚠️ Qaytarilgan (E'tiroz)
                      </div>
                      <div className={`text-2xl font-black mt-1 ${taskStatusFilter === 'qaytarildi' ? 'text-white' : 'text-rose-700 dark:text-rose-300'}`}>
                        {rejectedTasksCount}
                      </div>
                      <div className={`text-[10px] mt-0.5 ${taskStatusFilter === 'qaytarildi' ? 'text-rose-100' : 'text-slate-400 dark:text-slate-500'}`}>
                        Qayta ishlashga jo'natilgan
                      </div>
                    </button>
                  </div>

                  {/* Search Bar for 15 Shtab Organizations */}
                  <div className="bg-white dark:bg-[#0c1628] rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 transition-colors">
                    <div className="relative w-full sm:w-96">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={taskSearch}
                        onChange={(e) => setTaskSearch(e.target.value)}
                        placeholder="15 ta shtab a'zosi tashkiloti bo‘yicha qidiruv..."
                        className="w-full pl-9.5 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {taskSearch && (
                        <button
                          onClick={() => setTaskSearch('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center space-x-3 text-xs font-bold">
                      {taskStatusFilter !== 'all' && (
                        <button
                          onClick={() => setTaskStatusFilter('all')}
                          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-colors cursor-pointer flex items-center space-x-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Filtrni tozalash</span>
                        </button>
                      )}
                      <span className="text-slate-500 dark:text-slate-400">
                        Jami: <span className="text-slate-900 dark:text-white font-extrabold">{shtabOrganizations.length} ta shtab a'zosi</span>
                      </span>
                    </div>
                  </div>

                  {/* ACTIVE FILTERED TASKS DIRECT VIEW (When clicking any of the 4 buttons like Tekshiruvda) */}
                  {taskStatusFilter !== 'all' && (
                    <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-800/80 pb-3">
                        <div className="flex items-center space-x-2.5">
                          <div
                            className={`p-2 rounded-xl text-white font-bold text-xs ${
                              taskStatusFilter === 'tekshiruvda'
                                ? 'bg-purple-600'
                                : taskStatusFilter === 'jarayonda'
                                ? 'bg-amber-500'
                                : taskStatusFilter === 'tasdiqlandi'
                                ? 'bg-emerald-600'
                                : 'bg-rose-600'
                            }`}
                          >
                            {taskStatusFilter === 'tekshiruvda' && '📝 TEKSHIRUVDA (HISOBOT)'}
                            {taskStatusFilter === 'jarayonda' && '⏱️ JARAYONDA (IJRODA)'}
                            {taskStatusFilter === 'tasdiqlandi' && '✅ TASDIQLANGAN'}
                            {taskStatusFilter === 'qaytarildi' && '⚠️ QAYTARILGAN'}
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-slate-900 dark:text-white">
                              {taskStatusFilter === 'tekshiruvda' && 'Tashkilotlar Tomonidan Topshirilgan Hisobotlar Ro‘yxati'}
                              {taskStatusFilter === 'jarayonda' && 'Hozirda Ijro Jarayonidagi Vazifalar'}
                              {taskStatusFilter === 'tasdiqlandi' && 'Muvaffaqiyatli Bajarilgan & Tasdiqlangan Vazifalar'}
                              {taskStatusFilter === 'qaytarildi' && 'Qayta Ishlashga Qaytarilgan Vazifalar'}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Ushbu holatdagi jami:{' '}
                              <b className="text-slate-800 dark:text-slate-200">
                                {tasks.filter((t) => t.status === taskStatusFilter).length} ta topshiriq
                              </b>
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => setTaskStatusFilter('all')}
                          className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer self-start sm:self-auto"
                        >
                          Barcha tashkilotlar bo‘yicha ko‘rish →
                        </button>
                      </div>

                      {(() => {
                        const filteredList = tasks.filter((t) => t.status === taskStatusFilter);
                        if (filteredList.length === 0) {
                          return (
                            <div className="bg-white dark:bg-[#0c1628] rounded-2xl p-8 text-center text-slate-500 dark:text-slate-400 text-xs font-medium border border-slate-200 dark:border-slate-800">
                              Ushbu bo‘limda hozircha hech qanday topshiriq mavjud emas.
                            </div>
                          );
                        }

                        return (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredList.map((t) => {
                              const org = organizations.find((o) => o.id === t.targetOrgId);
                              const orgName = org ? org.name : t.targetOrgName || 'Tashkilot';

                              return (
                                <div
                                  key={t.id}
                                  className="bg-white dark:bg-[#0c1628] rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3.5 hover:shadow-md transition-all"
                                >
                                  <div className="space-y-2.5">
                                    <div className="flex items-center justify-between">
                                      <span className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold text-[11px] truncate max-w-[200px]">
                                        🏢 {orgName}
                                      </span>
                                      <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 font-bold">
                                        #{t.taskNumber || '•'}
                                      </span>
                                    </div>

                                    <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white leading-snug">
                                      {t.title}
                                    </h4>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                                      {t.description}
                                    </p>

                                    {/* Task Completion Report & PDF Preview */}
                                    {(t.completionReport || t.reportText) && (
                                      <div className="bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800 rounded-xl p-3 space-y-2">
                                        <div className="flex items-center justify-between text-[11px] font-black text-purple-900 dark:text-purple-200">
                                          <span className="flex items-center space-x-1">
                                            <FileCheck2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                                            <span>Yuborilgan Xulosa / Hisobot:</span>
                                          </span>
                                        </div>
                                        <p className="text-xs text-slate-800 dark:text-slate-200 italic bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-purple-100 dark:border-purple-900/60 line-clamp-3">
                                          "{t.completionReport?.notes || t.reportText}"
                                        </p>

                                        {(t.completionReport?.pdfUrl || t.reportPdfUrl) && (
                                          <a
                                            href={t.completionReport?.pdfUrl || t.reportPdfUrl}
                                            download={
                                              t.completionReport?.pdfFileName ||
                                              t.reportPdfName ||
                                              'hisobot.pdf'
                                            }
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-xs"
                                          >
                                            <Download className="w-3.5 h-3.5" />
                                            <span className="truncate max-w-[200px]">
                                              PDF: {t.completionReport?.pdfFileName || t.reportPdfName || 'Hujjat.pdf'}
                                            </span>
                                          </a>
                                        )}

                                        <div className="text-[10px] text-purple-700 dark:text-purple-400 font-semibold flex items-center justify-between">
                                          <span>
                                            Mas'ul:{' '}
                                            {t.completionReport?.executorName ||
                                              t.reportExecutorName ||
                                              org?.leader ||
                                              'Xodim'}
                                          </span>
                                          <span>
                                            {new Date(
                                              t.completionReport?.submittedAt ||
                                                t.reportSubmittedAt ||
                                                t.createdAt
                                            ).toLocaleDateString('uz-UZ')}
                                          </span>
                                        </div>
                                      </div>
                                    )}

                                    {t.status === 'qaytarildi' && t.adminFeedback && (
                                      <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-800 rounded-xl p-2.5 text-xs text-rose-800 dark:text-rose-300">
                                        <span className="font-bold">E'tiroz sababi: </span>
                                        <span>{t.adminFeedback}</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Actions */}
                                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                                    <button
                                      onClick={() => {
                                        setSelectedTaskForDetail(t);
                                        setTaskAdminFeedback(t.adminFeedback || '');
                                      }}
                                      className="flex-1 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                                    >
                                      <span>Batafsil</span>
                                      <ChevronRight className="w-3.5 h-3.5" />
                                    </button>

                                    {t.status === 'tekshiruvda' && (
                                      <button
                                        onClick={async () => {
                                          if (!onApproveTask) return;
                                          try {
                                            await onApproveTask(
                                              t.id,
                                              'Bosh Kabinet tomonidan qabul qilindi va tasdiqlandi.'
                                            );
                                            showToast('✅ Vazifa hisoboti tasdiqlandi!');
                                          } catch (e: any) {
                                            alert('Xatolik: ' + e.message);
                                          }
                                        }}
                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center space-x-1 cursor-pointer shadow-xs"
                                        title="Hisobotni tasdiqlash"
                                      >
                                        <CheckCircle className="w-3.5 h-3.5" />
                                        <span>Tasdiqlash</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* 15 Shtab Organizations Interactive Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {shtabOrganizations
                      .filter((org) => {
                        if (!taskSearch) return true;
                        const q = taskSearch.toLowerCase();
                        return (
                          org.name.toLowerCase().includes(q) ||
                          org.code.toLowerCase().includes(q) ||
                          org.leader.toLowerCase().includes(q) ||
                          org.category.toLowerCase().includes(q)
                        );
                      })
                    .map((org) => {
                        const orgTasks = tasks.filter((t) => t.targetOrgId === org.id);
                        const orgProg = orgTasks.filter((t) => t.status === 'jarayonda').length;
                        const orgReview = orgTasks.filter((t) => t.status === 'tekshiruvda').length;
                        const orgDone = orgTasks.filter((t) => t.status === 'tasdiqlandi' || t.status === 'tekshiruvda').length;

                        const isIIB = org.code === 'IIB-01' || org.id === 'org-1' || org.name.toLowerCase().includes('iib');
                        return (
                          <div
                            key={org.id}
                            className={`bg-white dark:bg-[#0c1628] rounded-3xl p-6 border transition-all duration-200 flex flex-col justify-between space-y-4 hover:shadow-lg ${
                              orgReview > 0
                                ? 'border-purple-300 dark:border-purple-700 ring-2 ring-purple-100 dark:ring-purple-900/30'
                                : 'border-slate-200/80 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700'
                            }`}
                          >
                            <div className="space-y-3">
                              {/* Top Bar: Code & Category */}
                              <div className="flex items-center justify-between">
                                <span className="px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-blue-600 text-white font-mono text-[11px] font-black tracking-wider">
                                  {org.code}
                                </span>
                                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full">
                                  {org.category}
                                </span>
                              </div>

                              {/* Org Name */}
                              <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug line-clamp-2">
                                  {org.name}
                                </h3>
                              </div>

                              {/* Task Status Mini Badges */}
                              <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800 rounded-2xl p-3 space-y-2">
                                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                                  <span>Biriktirilgan Vazifalar:</span>
                                  <span className="text-sm font-black text-slate-900 dark:text-white">{orgTasks.length} ta</span>
                                </div>
                                <div className="grid grid-cols-4 gap-1 text-center">
                                  <div className="bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800/60 rounded-xl p-1.5">
                                    <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400">Soni</div>
                                    <div className="text-xs font-black text-blue-800 dark:text-blue-200">{orgTasks.length}</div>
                                  </div>
                                  <div className="bg-amber-50/80 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-800/60 rounded-xl p-1.5">
                                    <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Ijroda</div>
                                    <div className="text-xs font-black text-amber-800 dark:text-amber-200">{orgProg}</div>
                                  </div>
                                  <div className={`rounded-xl p-1.5 border ${orgReview > 0 ? 'bg-purple-100 dark:bg-purple-900/50 border-purple-300 dark:border-purple-700 animate-pulse' : 'bg-purple-50/80 dark:bg-purple-950/40 border-purple-100 dark:border-purple-800/60'}`}>
                                    <div className="text-[10px] font-bold text-purple-700 dark:text-purple-400">Hisobot</div>
                                    <div className="text-xs font-black text-purple-900 dark:text-purple-200">{orgReview}</div>
                                  </div>
                                  <div className="bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/60 rounded-xl p-1.5">
                                    <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Bajarildi</div>
                                    <div className="text-xs font-black text-emerald-800 dark:text-emerald-200">{orgDone}</div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Actions Toolbar */}
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                              <button
                                onClick={() => {
                                  setSelectedOrgForTasks(org);
                                  setTaskOrgFilter(org.id);
                                  setTaskStatusFilter('all');
                                }}
                                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 shadow-xs hover:shadow-md transition-all cursor-pointer"
                              >
                                <FolderOpen className="w-4 h-4" />
                                <span>Vazifalarni Ko‘rish va Boshqarish ({orgTasks.length})</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>

                              {orgTasks.length === 0 && (
                                <button
                                  onClick={async () => {
                                    if (!onSeed7Tasks) return;
                                    setIsSeedingTasks(true);
                                    try {
                                      await onSeed7Tasks(org.id);
                                      showToast(`✅ ${org.name} ga maxsus vazifalar biriktirildi!`);
                                    } catch (e: any) {
                                      alert("Xatolik: " + e.message);
                                    } finally {
                                      setIsSeedingTasks(false);
                                    }
                                  }}
                                  disabled={isSeedingTasks}
                                  className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-[11px] flex items-center justify-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                                  <span>{isIIB ? "IIB 7 ta Profilaktika Vazifasini Biriktirish" : "Sohaviy Namunaviy Vazifalarni Biriktirish"}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </>
              ) : (
                /* Drill-Down Single Organization Task View */
                <div className="space-y-6">
                  {/* Back to 18 Organizations Button */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setSelectedOrgForTasks(null)}
                      className="px-4 py-2 bg-white dark:bg-[#0c1628] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold rounded-2xl text-xs border border-slate-200 dark:border-slate-800 shadow-xs transition-all flex items-center space-x-2 cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>18 ta Tashkilot Ro'yxatiga Qaytish</span>
                    </button>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setNewTaskTargetOrgIds([selectedOrgForTasks.id]);
                          setShowCreateTaskModal(true);
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs shadow-xs transition-all flex items-center space-x-2 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Ushbu Tashkilotga Yangi Topshiriq</span>
                      </button>
                    </div>
                  </div>

                  {/* Selected Org Detailed Banner */}
                  <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <span className="px-2.5 py-0.5 rounded-lg bg-blue-500 text-white font-mono text-xs font-black">
                            {selectedOrgForTasks.code}
                          </span>
                          <span className="text-xs font-bold text-blue-200 bg-white/10 px-3 py-0.5 rounded-full">
                            {selectedOrgForTasks.category}
                          </span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                          {selectedOrgForTasks.name}
                        </h2>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1">
                          <span className="flex items-center space-x-1">
                            <User className="w-3.5 h-3.5 text-blue-400" />
                            <span>Rahbar: <b>{selectedOrgForTasks.leader}</b></span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <Phone className="w-3.5 h-3.5 text-blue-400" />
                            <span>Tel: <b>{selectedOrgForTasks.phone}</b></span>
                          </span>
                        </div>
                      </div>

                      {/* Quick Seed Button for this org */}
                      <button
                        onClick={async () => {
                          if (!onSeed7Tasks) return;
                          setIsSeedingTasks(true);
                          try {
                            await onSeed7Tasks(selectedOrgForTasks.id);
                            showToast(`✅ ${selectedOrgForTasks.name} ga maxsus vazifalar muvaffaqiyatli biriktirildi!`);
                          } catch (err: any) {
                            alert("Xatolik: " + err.message);
                          } finally {
                            setIsSeedingTasks(false);
                          }
                        }}
                        disabled={isSeedingTasks}
                        className="px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-md transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                      >
                        <Zap className="w-4 h-4" />
                        <span>
                          {selectedOrgForTasks.code === 'IIB-01' || selectedOrgForTasks.name.toLowerCase().includes('iib')
                            ? "7 ta Profilaktika Vazifasini Biriktirish"
                            : "Sohaviy Namunaviy Vazifalarni Biriktirish"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Tasks Filters & Search Toolbar for Selected Org */}
                  <div className="bg-white dark:bg-[#0c1628] rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 transition-colors">
                    <div className="relative w-full md:w-80">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={taskSearch}
                        onChange={(e) => setTaskSearch(e.target.value)}
                        placeholder="Vazifa nomi bo‘yicha qidiruv..."
                        className="w-full pl-9.5 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {taskSearch && (
                        <button
                          onClick={() => setTaskSearch('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <Filter className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      <select
                        value={taskStatusFilter}
                        onChange={(e) => setTaskStatusFilter(e.target.value as any)}
                        className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                      >
                        <option value="all">Barcha Holatlar</option>
                        <option value="yangi">Yangi berilgan</option>
                        <option value="jarayonda">Jarayonda (Ijroda)</option>
                        <option value="tekshiruvda">Hisobot topshirilgan (Tekshiruvda)</option>
                        <option value="tasdiqlandi">Tasdiqlangan</option>
                        <option value="qaytarildi">Qaytarilgan</option>
                      </select>
                    </div>
                  </div>

                  {/* Tasks List for Selected Org */}
                  {(() => {
                    const orgTasks = tasks
                      .filter((t) => t.targetOrgId === selectedOrgForTasks.id)
                      .filter((t) => {
                        if (taskStatusFilter !== 'all' && t.status !== taskStatusFilter) return false;
                        if (taskSearch) {
                          const q = taskSearch.toLowerCase();
                          return t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
                        }
                        return true;
                      });

                    if (orgTasks.length === 0) {
                      return (
                        <div className="bg-white dark:bg-[#0c1628] rounded-3xl p-12 border border-slate-200/80 dark:border-slate-800 shadow-xs text-center space-y-4 max-w-xl mx-auto">
                          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                            <Briefcase className="w-8 h-8" />
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Ushbu tashkilotda vazifalar yo‘q</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              {selectedOrgForTasks.name} ga hali vazifa biriktirilmagan yoki qidiruv bo‘yicha topilmadi.
                            </p>
                          </div>
                          <div className="flex items-center justify-center gap-3 pt-2">
                            <button
                              onClick={async () => {
                                if (!onSeed7Tasks) return;
                                setIsSeedingTasks(true);
                                try {
                                  await onSeed7Tasks(selectedOrgForTasks.id);
                                  showToast(`✅ ${selectedOrgForTasks.name} ga vazifalar biriktirildi!`);
                                } catch (e: any) {
                                  alert("Xatolik: " + e.message);
                                } finally {
                                  setIsSeedingTasks(false);
                                }
                              }}
                              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs inline-flex items-center space-x-2 cursor-pointer"
                            >
                              <Zap className="w-4 h-4" />
                              <span>Namunaviy Vazifalarni Biriktirish</span>
                            </button>
                            <button
                              onClick={() => {
                                setNewTaskTargetOrgIds([selectedOrgForTasks.id]);
                                setShowCreateTaskModal(true);
                              }}
                              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs inline-flex items-center space-x-2 cursor-pointer"
                            >
                              <Plus className="w-4 h-4" />
                              <span>Yangi Topshiriq</span>
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {orgTasks.map((t) => {
                          const statusBg =
                            t.status === 'tasdiqlandi'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : t.status === 'tekshiruvda'
                              ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 animate-pulse'
                              : t.status === 'jarayonda'
                              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                              : t.status === 'qaytarildi'
                              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                              : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';

                          const statusLabel =
                            t.status === 'tasdiqlandi'
                              ? '✅ Tasdiqlangan'
                              : t.status === 'tekshiruvda'
                              ? '📝 Hisobot topshirilgan'
                              : t.status === 'jarayonda'
                              ? '⏱️ Jarayonda'
                              : t.status === 'qaytarildi'
                              ? '⚠️ Qaytarilgan'
                              : '🔵 Yangi topshiriq';

                          return (
                            <div
                              key={t.id}
                              className="bg-white dark:bg-[#0c1628] rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                            >
                              <div className="space-y-3">
                                {/* Top Tag & Status */}
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center space-x-1.5">
                                    <span className="w-6 h-6 rounded-lg bg-slate-900 dark:bg-blue-600 text-white text-[11px] font-black flex items-center justify-center">
                                      #{t.taskNumber || '•'}
                                    </span>
                                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate max-w-[160px]">
                                      {t.category || 'Shtab Vazifasi'}
                                    </span>
                                  </div>
                                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusBg}`}>
                                    {statusLabel}
                                  </span>
                                </div>

                                {/* Task Title & Description */}
                                <div>
                                  <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug">
                                    {t.title}
                                  </h4>
                                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 line-clamp-4 leading-relaxed">
                                    {t.description}
                                  </p>
                                </div>

                                {/* Completion Report Preview if available */}
                                {t.completionReport && (
                                  <div className="bg-purple-50/60 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-800 rounded-xl p-3 space-y-1.5">
                                    <div className="flex items-center justify-between text-[11px] font-bold text-purple-900 dark:text-purple-200">
                                      <span className="flex items-center space-x-1">
                                        <FileCheck2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                                        <span>Tashkilot hisoboti:</span>
                                      </span>
                                      <span className="text-purple-600 dark:text-purple-400 text-[10px]">
                                        {new Date(t.completionReport.submittedAt).toLocaleDateString('uz-UZ')}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2 italic">
                                      "{t.completionReport.notes}"
                                    </p>
                                  </div>
                                )}

                                {/* Admin Feedback note if rejected */}
                                {t.status === 'qaytarildi' && t.adminFeedback && (
                                  <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-800 rounded-xl p-2.5 text-xs text-rose-800 dark:text-rose-300">
                                    <span className="font-bold">Bosh Kabinet e'tirozi: </span>
                                    <span>{t.adminFeedback}</span>
                                  </div>
                                )}
                              </div>

                              {/* Bottom Actions Toolbar */}
                              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedTaskForDetail(t);
                                    setTaskAdminFeedback(t.adminFeedback || '');
                                  }}
                                  className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                                >
                                  <span>Tafsilotlar & Hisobot</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>

                                {t.status === 'tekshiruvda' && (
                                  <button
                                    onClick={async () => {
                                      if (!onApproveTask) return;
                                      try {
                                        await onApproveTask(t.id, "Bosh Kabinet tomonidan qabul qilindi va tasdiqlandi.");
                                        showToast("✅ Vazifa hisoboti tasdiqlandi!");
                                      } catch (e: any) {
                                        alert("Xatolik: " + e.message);
                                      }
                                    }}
                                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center space-x-1 cursor-pointer"
                                    title="Hisobotni to‘g‘ridan-to‘g‘ri tasdiqlash"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    <span>Tasdiqlash</span>
                                  </button>
                                )}

                                <button
                                  onClick={async () => {
                                    if (!window.confirm("Ushbu topshiriqni o‘chirishni tasdiqlaysizmi?")) return;
                                    if (onDeleteTask) await onDeleteTask(t.id);
                                  }}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors cursor-pointer"
                                  title="Vazifani o‘chirish"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ================= VIEW 4: MAHALLA YETTILIGI ================= */}
          {activeTab === 'mahalla_yettiligi' && (
            <MahallaYettiligiSection
              mahallaTasks={mahallaTasks}
              organizations={organizations}
              onSendMahallaTask={onSendMahallaTask || (async () => {})}
              onSeedAllMahallaTasks={onSeedAllMahallaTasks || (async () => {})}
              onApproveMahallaTask={onApproveMahallaTask || (async () => {})}
              onRejectMahallaTask={onRejectMahallaTask || (async () => {})}
              onDeleteMahallaTask={onDeleteMahallaTask || (async () => {})}
              isLoading={isLoading}
            />
          )}
        </main>
      </div>

      {/* ================= MODALS & DRAWERS ================= */}

      {/* 1. APPEAL DETAIL MODAL */}
      {selectedAppeal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-[#0c1628] rounded-3xl max-w-3xl w-full p-6 space-y-5 shadow-2xl border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <div className="text-xs font-bold text-blue-600 dark:text-blue-400">{selectedAppeal.appealNumber}</div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{selectedAppeal.fullName}</h3>
                <p className="text-xs text-slate-400 dark:text-slate-400">{selectedAppeal.phone} • {selectedAppeal.address || 'Paxtachi tumani'}</p>
              </div>
              <button
                onClick={() => setSelectedAppeal(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800 p-4 rounded-2xl space-y-1.5">
                <div className="font-bold text-slate-500 dark:text-slate-400">Murojaat Mazmuni:</div>
                <p className="text-slate-800 dark:text-slate-200 text-sm leading-relaxed whitespace-pre-wrap break-words max-h-72 overflow-y-auto">{selectedAppeal.content}</p>
              </div>

              {/* Biriktirilgan fotosurat (faqat rasm mavjud bo'lsa ko'rinadi) */}
              {selectedAppeal.attachmentUrl && (
                <div className="bg-sky-50/70 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-800/60 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sky-950 dark:text-sky-300 flex items-center space-x-1.5 text-xs">
                      <Image className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                      <span>Fuqaro biriktirgan fotosurat:</span>
                    </span>
                    <span className="px-2 py-0.5 bg-sky-200 dark:bg-sky-900 text-sky-800 dark:text-sky-200 rounded-full font-bold text-[10px]">
                      📷 Ilova qilingan
                    </span>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-sky-100 dark:border-sky-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <img
                        src={selectedAppeal.attachmentUrl}
                        alt="Murojaat fotosurati"
                        className="w-16 h-16 object-cover rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(selectedAppeal.attachmentUrl, '_blank')}
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Murojaat fotosurati</div>
                        <div className="text-[11px] text-slate-400">Tekshirish va yuklab olish uchun</div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 w-full sm:w-auto">
                      <a
                        href={selectedAppeal.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Rasmni ko‘rish</span>
                      </a>
                      <a
                        href={selectedAppeal.attachmentUrl}
                        download={`Murojaat_${selectedAppeal.appealNumber}_rasm.jpg`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Yuklab olish</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800 p-3 rounded-xl">
                  <div className="text-slate-400 font-bold">Bosh Mas'ul Tashkilot:</div>
                  <div className="font-bold text-slate-900 dark:text-slate-100">{selectedAppeal.organizationName}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800 p-3 rounded-xl">
                  <div className="text-slate-400 font-bold">Holati:</div>
                  <div>{getStatusBadge(selectedAppeal.status, selectedAppeal.feedback)}</div>
                </div>
              </div>

              {/* Transfer Request Details in Modal */}
              {selectedAppeal.transferRequest && (
                <div className="bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-800/60 p-4 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-950 dark:text-amber-300 flex items-center space-x-1.5">
                      <ArrowRightLeft className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>Tashkilot o‘tkazish so‘rovi:</span>
                    </span>
                    {selectedAppeal.transferRequest.status === 'pending' && (
                      <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-900 dark:text-amber-300 rounded-full font-bold text-[10px]">
                        Tasdiq kutilmoqda
                      </span>
                    )}
                    {selectedAppeal.transferRequest.status === 'approved' && (
                      <span className="px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded-full font-bold text-[10px]">
                        O‘tkazilgan
                      </span>
                    )}
                    {selectedAppeal.transferRequest.status === 'rejected' && (
                      <span className="px-2.5 py-0.5 bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 rounded-full font-bold text-[10px]">
                        Rad etilgan
                      </span>
                    )}
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-amber-200/60 dark:border-amber-900/60 text-xs space-y-1.5">
                    <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-200 font-semibold">
                      <span className="text-rose-600 dark:text-rose-400">{selectedAppeal.transferRequest.fromOrgName}</span>
                      <span>➡️</span>
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold">{selectedAppeal.transferRequest.toOrgName}</span>
                    </div>
                    <div className="text-slate-700 dark:text-slate-300 pt-1">
                      <span className="text-slate-400 font-bold">Sabab: </span>
                      {selectedAppeal.transferRequest.reason}
                    </div>
                    {selectedAppeal.transferRequest.adminNote && (
                      <div className="text-rose-700 dark:text-rose-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span className="font-bold">Bosh Kabinet izohi: </span>
                        {selectedAppeal.transferRequest.adminNote}
                      </div>
                    )}
                  </div>

                  {selectedAppeal.transferRequest.status === 'pending' && (
                    <div className="flex items-center justify-end space-x-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          handleOpenRejectTransferModal(selectedAppeal.id);
                          setSelectedAppeal(null);
                        }}
                        className="px-3.5 py-1.5 bg-rose-100 dark:bg-rose-950/60 hover:bg-rose-200 text-rose-800 dark:text-rose-300 rounded-lg font-bold text-xs cursor-pointer"
                      >
                        Rad etish
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await handleApproveTransferClick(selectedAppeal.id);
                          setSelectedAppeal(null);
                        }}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs cursor-pointer"
                      >
                        Tasdiqlash & Ko‘chirish
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Co-Assigned Partner Orgs & Resolutions */}
              {((selectedAppeal.coAssignedOrgNames && selectedAppeal.coAssignedOrgNames.length > 0) ||
                (selectedAppeal.coOrgResolutions && selectedAppeal.coOrgResolutions.length > 0)) && (
                <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 p-4 rounded-2xl space-y-2.5">
                  <div className="font-bold text-indigo-950 dark:text-indigo-300 flex items-center space-x-1.5">
                    <Share2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Hamkor tashkilotlar va xulosalar:</span>
                  </div>

                  {selectedAppeal.coAssignedOrgNames && selectedAppeal.coAssignedOrgNames.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedAppeal.coAssignedOrgNames.map((name, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 font-bold rounded-lg text-[11px]"
                        >
                          👥 {name}
                        </span>
                      ))}
                    </div>
                  )}

                  {selectedAppeal.coOrgResolutions && selectedAppeal.coOrgResolutions.length > 0 && (
                    <div className="space-y-2 pt-1">
                      {selectedAppeal.coOrgResolutions.map((res, rIdx) => (
                        <div key={rIdx} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/60 space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-indigo-950 dark:text-indigo-300">{res.orgName}</span>
                            <span className="text-slate-400">{new Date(res.resolvedAt).toLocaleString('ru-RU')}</span>
                          </div>
                          <p className="text-slate-800 dark:text-slate-200 text-xs">{res.resolutionText}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Official Explanations */}
              {selectedAppeal.explanations && selectedAppeal.explanations.length > 0 && (
                <div className="bg-sky-50/70 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 p-4 rounded-2xl space-y-2">
                  <div className="font-bold text-sky-950 dark:text-sky-300">Berilgan tushuntirish xatlari:</div>
                  <div className="space-y-2">
                    {selectedAppeal.explanations.map((exp) => (
                      <div key={exp.id} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-sky-100 dark:border-sky-900/60 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-sky-900 dark:text-sky-300">{exp.organizationName} ({exp.authorName})</span>
                          <span className="text-slate-400">{new Date(exp.createdAt).toLocaleString('ru-RU')}</span>
                        </div>
                        <p className="text-slate-800 dark:text-slate-200 text-xs">{exp.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

{selectedAppeal.resolutionText && (
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 p-4 rounded-2xl space-y-1.5">
                  <div className="font-bold text-emerald-900 dark:text-emerald-300">Bosh Tashkilot Ijro Xulosasi:</div>
                  <p className="text-emerald-800 dark:text-emerald-200">{selectedAppeal.resolutionText}</p>
                </div>
              )}

              {/* MUDDATNI UZAYTIRISH VA BOTGA YUBORISH BLOKI */}
              <div className="bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 p-4 rounded-2xl space-y-3">
                <div className="font-bold text-blue-900 dark:text-blue-300 flex items-center space-x-1.5 text-xs">
                  <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Ijro muddatini o'zgartirish va botga izoh yuborish</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Yangi sana:</label>
                    <input
                      type="date"
                      id="customExtendedDeadline"
                      defaultValue={selectedAppeal.deadlineAt ? selectedAppeal.deadlineAt.split('T')[0] : ''}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Fuqaroga yuboriladigan izoh:</label>
                    <input
                      type="text"
                      id="extendedDeadlineNote"
                      placeholder="Masalan: Qo'shimcha o'rganish talab etiladi..."
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      const dateInput = (document.getElementById('customExtendedDeadline') as HTMLInputElement)?.value;
                      const noteInput = (document.getElementById('extendedDeadlineNote') as HTMLInputElement)?.value;

                      if (!dateInput) {
                        alert('Iltimos, yangi sanani tanlang');
                        return;
                      }

                      try {
                        const res = await fetch(`/api/appeals/${selectedAppeal.id}/extend-deadline`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ newDeadline: dateInput, adminNote: noteInput }),
                        });
                        const data = await res.json();
                        if (res.ok && data.success) {
                          showToast('✅ Murojaat muddati uzaytirildi va bot orqali fuqaroga xabar yuborildi!');
                          setSelectedAppeal(null);
                          if (onRefresh) await onRefresh();
                        } else {
                          alert(data.error || 'Xatolik yuz berdi');
                        }
                      } catch (err: any) {
                        alert('Server xatosi: ' + err.message);
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center space-x-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Muddatni uzaytirish va yuborish</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedAppeal(null)}
                className="px-5 py-2.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 2. ADD NEW APPEAL MODAL */}
      {showAddAppealModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <form
            onSubmit={handleCreateAppealSubmit}
            className="bg-white dark:bg-[#0c1628] rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-100 dark:border-slate-800 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl ring-4 ring-blue-50/50 dark:ring-blue-950/40">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Yangi Murojaat Qo'shish</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Fuqaro murojaatini mas'ul va hamkor tashkilotlarga yo'llash</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddAppealModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Fuqaro F.I.Sh *:</label>
                  <input
                    type="text"
                    required
                    placeholder="Masalan: Abdullayev Anvar"
                    value={newAppCitizenName}
                    onChange={(e) => setNewAppCitizenName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Telefon Raqami *:</label>
                  <input
                    type="text"
                    required
                    value={newAppPhone}
                    onChange={(e) => setNewAppPhone(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Mahalla *:</label>
                  <select
                    value={newAppMahalla}
                    onChange={(e) => setNewAppMahalla(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {PAXTACHI_MAHALLAS.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Manzil (Ko'cha, uy raqami):</label>
                  <input
                    type="text"
                    placeholder="Mustaqillik ko'chasi 14-uy"
                    value={newAppAddress}
                    onChange={(e) => setNewAppAddress(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Multi-Organization Selection for Appeal */}
              <div className="bg-slate-50 dark:bg-slate-900/80 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center space-x-1.5">
                      <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Mas'ul Tashkilotlar *</span>
                      <span className="ml-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-full text-[10px] font-black">
                        {newAppOrgIds.length} ta tanlandi
                      </span>
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Bir nechta tashkilot tanlansa, 1-tashkilot asosiy ijrochi, qolganlari hamkor tashkilot bo'ladi.
                    </p>
                  </div>
                  <div className="flex items-center space-x-1.5 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setNewAppOrgIds(organizations.map((o) => o.id))}
                      className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      Barchasi ({organizations.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewAppOrgIds(organizations[0]?.id ? [organizations[0].id] : [])}
                      className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      Faqat 1-si
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewAppOrgIds([])}
                      className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg text-[11px] font-bold text-red-600 dark:text-red-400 cursor-pointer"
                    >
                      Tozalash
                    </button>
                  </div>
                </div>

                {/* Search input for organizations */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Tashkilot nomi yoki sohasi bo'yicha qidirish..."
                    value={newAppOrgSearch}
                    onChange={(e) => setNewAppOrgSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Org Checkboxes Scroll List */}
                <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                  {organizations
                    .filter((org) => {
                      if (!newAppOrgSearch.trim()) return true;
                      const q = newAppOrgSearch.toLowerCase();
                      return org.name.toLowerCase().includes(q) || org.category.toLowerCase().includes(q) || org.code.toLowerCase().includes(q);
                    })
                    .map((org) => {
                      const isChecked = newAppOrgIds.includes(org.id);
                      const isPrimary = newAppOrgIds[0] === org.id;
                      const isCoAssigned = isChecked && !isPrimary;

                      return (
                        <div
                          key={org.id}
                          onClick={() => {
                            if (isChecked) {
                              setNewAppOrgIds(newAppOrgIds.filter((id) => id !== org.id));
                            } else {
                              setNewAppOrgIds([...newAppOrgIds, org.id]);
                            }
                          }}
                          className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-blue-50/80 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700 text-blue-950 dark:text-blue-200 shadow-xs'
                              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 pointer-events-none"
                            />
                            <div>
                              <span className="font-bold text-xs">{org.name}</span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-1.5">({org.category})</span>
                            </div>
                          </div>
                          <div>
                            {isPrimary && (
                              <span className="px-2 py-0.5 bg-blue-600 text-white font-bold text-[10px] rounded-md">
                                Asosiy mas'ul
                              </span>
                            )}
                            {isCoAssigned && (
                              <span className="px-2 py-0.5 bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 font-bold text-[10px] rounded-md">
                                Hamkor tashkilot
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Deadline (Muddat Qo'shish) for Appeal */}
              <div className="bg-slate-50 dark:bg-slate-900/80 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center space-x-1.5">
                    <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Ijro Muddati (Muddat belgilash) *</span>
                  </label>
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                    {newAppDeadlineType === 'preset'
                      ? `${newAppDeadlineDays} kun (${newAppDeadlineDays * 24} soat)`
                      : 'Aniq kalendar sanasi'}
                  </span>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: '⚡ 120 soat (5 kun)', days: 5 },
                    { label: '3 kun', days: 3 },
                    { label: '7 kun', days: 7 },
                    { label: '10 kun', days: 10 },
                    { label: '15 kun', days: 15 },
                    { label: '30 kun', days: 30 },
                  ].map((preset) => {
                    const isSelected = newAppDeadlineType === 'preset' && newAppDeadlineDays === preset.days;
                    return (
                      <button
                        key={preset.days}
                        type="button"
                        onClick={() => {
                          setNewAppDeadlineType('preset');
                          setNewAppDeadlineDays(preset.days);
                        }}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setNewAppDeadlineType('custom');
                      if (!newAppCustomDeadline) {
                        const d = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
                        setNewAppCustomDeadline(d.toISOString().split('T')[0]);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                      newAppDeadlineType === 'custom'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    📅 Boshqa sana
                  </button>
                </div>

                {newAppDeadlineType === 'custom' && (
                  <div className="pt-1">
                    <input
                      type="date"
                      value={newAppCustomDeadline}
                      onChange={(e) => setNewAppCustomDeadline(e.target.value)}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-1.5 pt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Belgilangan ijro muddati:{' '}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {newAppDeadlineType === 'custom' && newAppCustomDeadline
                        ? new Date(newAppCustomDeadline).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'long', year: 'numeric' })
                        : formatDeadlineDatePreview(newAppDeadlineDays)}
                    </strong>
                  </span>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Murojaat Mazmuni *:</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Fuqaroning muammosi yoki so'rovi batafsil..."
                  value={newAppContent}
                  onChange={(e) => setNewAppContent(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowAddAppealModal(false)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 transition-all cursor-pointer flex items-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Murojaatni Saqlash ({newAppOrgIds.length} ta tashkilotga)</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. ADD NEW ORGANIZATION MODAL */}
      {showAddOrgModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <form
            onSubmit={handleCreateOrgSubmit}
            className="bg-white dark:bg-[#0c1628] rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-100 dark:border-slate-800"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white">Yangi Tashkilot Qo'shish</h3>
              <button
                type="button"
                onClick={() => setShowAddOrgModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Tashkilot Nomi:</label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: Tuman obodonlashtirish boshqarmasi"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Qisqa Kod:</label>
                  <input
                    type="text"
                    required
                    placeholder="OB-12"
                    value={newOrgCode}
                    onChange={(e) => setNewOrgCode(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Sohasi / Kategoriya:</label>
                  <input
                    type="text"
                    value={newOrgCategory}
                    onChange={(e) => setNewOrgCategory(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Rahbar / Mas'ul F.I.Sh:</label>
                  <input
                    type="text"
                    placeholder="A. Rustamov"
                    value={newOrgLeader}
                    onChange={(e) => setNewOrgLeader(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Telefon:</label>
                  <input
                    type="text"
                    value={newOrgPhone}
                    onChange={(e) => setNewOrgPhone(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Maxsus Kirish Paroli:</label>
                <input
                  type="text"
                  required
                  value={newOrgPassword}
                  onChange={(e) => setNewOrgPassword(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowAddOrgModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/20"
              >
                Tashkilotni Saqlash
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. TELEGRAM BOT SETTINGS MODAL */}
      {showTelegramModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-[#0c1628] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Bot className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">Telegram Bot Sozlamalari</h3>
              </div>
              <button
                onClick={() => setShowTelegramModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Telegram Bot Token:</label>
                <input
                  type="text"
                  value={customToken}
                  onChange={(e) => setCustomToken(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {tokenSaveMsg && (
                <div
                  className={`p-2.5 rounded-xl font-bold ${
                    tokenSaveMsg.startsWith('✅') ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {tokenSaveMsg}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
              <button
                onClick={() => setShowTelegramModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
              >
                Yopish
              </button>
              <button
                onClick={handleSaveTelegramToken}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold"
              >
                Tokenni Saqlash & Ulanish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. HELP / SUPPORT MODAL */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-[#0c1628] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Headphones className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">Yordam va Qo'llab-quvvatlash</h3>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <p>
                Paxtachi tumani hokimligi fuqarolar murojaatlari va tashkilotlar monitoringi tizimi bo'yicha texnik ko'mak:
              </p>

              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-3.5 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Ishonch telefoni:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">+998 66 403-12-34</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Telegram Bot:</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400">@{botStatus.botUsername}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Ish vaqti:</span>
                  <span>Dushanba - Shanba (08:00 - 20:00)</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-5 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
              >
                Tushunarli
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5.5 REJECT TRANSFER MODAL */}
      {rejectTransferAppealId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-[#0c1628] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="p-2.5 bg-rose-100 dark:bg-rose-950/60 rounded-2xl">
                <XCircle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">O‘tkazish so‘rovini rad etish</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Murojaat joriy tashkilot ijrosida qoldiriladi</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600 dark:text-slate-300">
                Ushbu murojaatni boshqa tashkilotga o‘tkazishni rad etish sababini yoki Bosh Kabinet ko‘rsatmasini kiriting:
              </p>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Rad etish asosi / Izoh:</label>
                <textarea
                  rows={3}
                  value={rejectTransferNote}
                  onChange={(e) => setRejectTransferNote(e.target.value)}
                  placeholder="Masalan: Murojaat mazmuni bevosita sizning tashkilot vakolatiga kiradi. 5 kun ichida hal etilsin."
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500 text-xs"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
              <button
                type="button"
                disabled={isProcessingTransfer}
                onClick={() => {
                  setRejectTransferAppealId(null);
                  setRejectTransferNote('');
                }}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                disabled={isProcessingTransfer}
                onClick={handleConfirmRejectTransfer}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 transition-all cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
              >
                {isProcessingTransfer ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saqlanmoqda...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Rad etishni tasdiqlash</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. CLEAR ALL APPEALS CONFIRMATION MODAL */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-[#0c1628] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
              <div className="p-3 bg-rose-100 dark:bg-rose-950/60 rounded-2xl">
                <Trash2 className="w-6 h-6 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Barcha murojaatlarni tozalash</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Ushbu amal qaytarilmas hisoblanadi</p>
              </div>
            </div>

            <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/60 rounded-2xl p-4 text-xs text-rose-800 dark:text-rose-300 space-y-1.5">
              <p className="font-bold">Diqqat! Barcha murojaatlar bazadan to‘liq o‘chiriladi:</p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-rose-700 dark:text-rose-300">
                <li>Barcha tushgan fuqaro murojaatlari o‘chiriladi</li>
                <li>Tashkilotlar va statistika hisoblagichlari 0 ga tushiriladi</li>
                <li>Telegram bot yangi murojaatlarni qabul qilishga toza holatda tayyor bo‘ladi</li>
              </ul>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-3">
              <button
                type="button"
                disabled={isClearing}
                onClick={() => setShowClearConfirmModal(false)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                disabled={isClearing}
                onClick={handleClearAllAppeals}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-600/30 transition-all cursor-pointer flex items-center space-x-2 disabled:opacity-50"
              >
                {isClearing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Tozalanmoqda...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Ha, barchasini tozalash</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. ALL MAHALLAS LIST MODAL */}
      {showAllMahallasModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-[#0c1628] rounded-3xl max-w-4xl w-full p-6 space-y-4 shadow-2xl border border-slate-100 dark:border-slate-800 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 rounded-2xl">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      murojaatlar Barcha Mahallalari ({PAXTACHI_MAHALLAS.length} ta MFY)
                    </h3>
                    <span className="px-2.5 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 text-[11px] font-extrabold rounded-full">
                      murojaatlar hududi
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Mahallalar kesimida jami murojaatlar, hal etilgan, jarayondagi va e'tirozli holatlar monitoringi
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAllMahallasModal(false)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Summary Metrics (Jami, Hal etilgan, Jarayonda, E'tirozli) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 p-3.5 rounded-2xl">
                <div className="text-[11px] font-bold text-blue-700 dark:text-blue-300">Jami Murojaatlar</div>
                <div className="text-2xl font-black text-blue-950 dark:text-blue-100 mt-0.5">
                  {mahallasWithStats.reduce((acc, m) => acc + m.totalAppeals, 0)} ta
                </div>
                <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold mt-0.5">
                  {PAXTACHI_MAHALLAS.length} ta mahalla bo‘yicha
                </div>
              </div>

              <div className="bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 p-3.5 rounded-2xl">
                <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">Hal Etilgan</div>
                <div className="text-2xl font-black text-emerald-950 dark:text-emerald-100 mt-0.5">
                  {mahallasWithStats.reduce((acc, m) => acc + m.resolvedAppeals, 0)} ta
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">Ijobiy yakunlangan</div>
              </div>

              <div className="bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 p-3.5 rounded-2xl">
                <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300">Jarayonda</div>
                <div className="text-2xl font-black text-amber-950 dark:text-amber-100 mt-0.5">
                  {mahallasWithStats.reduce((acc, m) => acc + m.inProgressAppeals, 0)} ta
                </div>
                <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">Ko‘rib chiqilmoqda</div>
              </div>

              <div className="bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/60 p-3.5 rounded-2xl">
                <div className="text-[11px] font-bold text-rose-700 dark:text-rose-300">E'tirozli Holatlar</div>
                <div className="text-2xl font-black text-rose-950 dark:text-rose-100 mt-0.5">
                  {mahallasWithStats.reduce((acc, m) => acc + m.objectionAppeals, 0)} ta
                </div>
                <div className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold mt-0.5">Qoniqarsiz baholangan</div>
              </div>
            </div>

            {/* Search Box */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-slate-400" />
              </div>
              <input
                type="text"
                value={mahallaModalSearch}
                onChange={(e) => setMahallaModalSearch(e.target.value)}
                placeholder="Mahalla nomi, raisi yoki telefon raqami bo'yicha qidirish..."
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
              />
            </div>

            {/* Scrollable Mahallas Grid */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-3 max-h-[50vh]">
              {filteredMahallasModalList.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <MapPin className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Qidiruv bo'yicha mahalla topilmadi</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredMahallasModalList.map((m, idx) => {
                    // Determine Status Badge & Theme
                    let statusLabel = "Murojaat yo'q";
                    let statusClass = "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700";

                    if (m.objectionAppeals > 0) {
                      statusLabel = `${m.objectionAppeals} ta e'tiroz mavjud`;
                      statusClass = "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800";
                    } else if (m.totalAppeals > 0 && m.resolvedAppeals === m.totalAppeals) {
                      statusLabel = "100% to‘liq hal etilgan";
                      statusClass = "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
                    } else if (m.inProgressAppeals > 0) {
                      statusLabel = `${m.inProgressAppeals} ta ijroda (${m.resolvedPercent}% hal)`;
                      statusClass = "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800";
                    } else if (m.totalAppeals > 0) {
                      statusLabel = `${m.resolvedPercent}% ijro etilgan`;
                      statusClass = "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
                    }

                    return (
                      <div
                        key={m.id}
                        className="bg-slate-50/70 dark:bg-slate-900/70 hover:bg-white dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 rounded-2xl p-4 transition-all shadow-xs hover:shadow-md flex flex-col justify-between space-y-3 group"
                      >
                        <div>
                          {/* Top: Name & Status */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0">
                                  {idx + 1}
                                </span>
                                <h4 className="font-extrabold text-slate-900 dark:text-white text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                                  {m.name}
                                </h4>
                              </div>
                            </div>
                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border flex-shrink-0 ${statusClass}`}>
                              {statusLabel}
                            </span>
                          </div>

                          {/* Middle: Rais & Telefon */}
                          <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 dark:border-slate-800 grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-bold">MFY Raisi:</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">{m.chairman}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-bold">Aloqa:</span>
                              <a href={`tel:${m.phone}`} className="font-bold text-blue-600 dark:text-blue-400 hover:underline block truncate">
                                {m.phone}
                              </a>
                            </div>
                          </div>

                          {/* Murojaatlar Stats: Jami, Hal etilgan, Jarayonda, E'tirozli */}
                          <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
                            <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl p-2">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-bold">Jami</span>
                              <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block">{m.totalAppeals}</span>
                            </div>
                            <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/70 dark:border-emerald-800 rounded-xl p-2">
                              <span className="text-[10px] text-emerald-700 dark:text-emerald-300 block font-bold">Hal etildi</span>
                              <span className="text-sm font-black text-emerald-900 dark:text-emerald-100 mt-0.5 block">{m.resolvedAppeals}</span>
                            </div>
                            <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200/70 dark:border-amber-800 rounded-xl p-2">
                              <span className="text-[10px] text-amber-700 dark:text-amber-300 block font-bold">Jarayonda</span>
                              <span className="text-sm font-black text-amber-900 dark:text-amber-100 mt-0.5 block">{m.inProgressAppeals}</span>
                            </div>
                            <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200/70 dark:border-rose-800 rounded-xl p-2">
                              <span className="text-[10px] text-rose-700 dark:text-rose-300 block font-bold">E'tirozli</span>
                              <span className="text-sm font-black text-rose-900 dark:text-rose-100 mt-0.5 block">{m.objectionAppeals}</span>
                            </div>
                          </div>
                        </div>

                        {/* Action Button */}
                        <button
                          onClick={() => {
                            setSearchQuery(m.name);
                            setActiveTab('appeals');
                            setShowAllMahallasModal(false);
                          }}
                          className="w-full py-2 bg-blue-50 dark:bg-blue-950/60 group-hover:bg-blue-600 group-hover:text-white text-blue-700 dark:text-blue-300 font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                        >
                          <span>Murojaatlarini ko‘rish ({m.totalAppeals})</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Ko'rsatilmoqda: <strong>{filteredMahallasModalList.length}</strong> / {PAXTACHI_MAHALLAS.length} ta mahalla
              </span>
              <button
                onClick={() => setShowAllMahallasModal(false)}
                className="px-5 py-2.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. ALL ORGANIZATIONS LIST MODAL */}
      {showAllOrganizationsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-[#0c1628] rounded-3xl max-w-4xl w-full p-6 space-y-4 shadow-2xl border border-slate-100 dark:border-slate-800 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 rounded-2xl">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      murojaatlar Barcha Mas'ul Tashkilotlari ({organizations.length} ta)
                    </h3>
                    <span className="px-2.5 py-0.5 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 text-[11px] font-extrabold rounded-full">
                      Ijro monitoringi
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Biriktirilgan korxona va muassasalar, ularning mas'ul rahbarlari, kirish parollari hamda ijro ko'rsatkichlari
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAllOrganizationsModal(false)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Summary Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-3 rounded-2xl">
                <div className="text-[11px] font-bold text-slate-400">Jami Tashkilotlar</div>
                <div className="text-lg font-black text-slate-900 dark:text-white">{organizations.length} ta idora</div>
              </div>
              <div className="bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/60 p-3 rounded-2xl">
                <div className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">Jami Murojaatlar</div>
                <div className="text-lg font-black text-indigo-950 dark:text-indigo-100">
                  {organizationsWithStats.reduce((acc, o) => acc + o.calculatedTotal, 0)} ta
                </div>
              </div>
              <div className="bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/60 p-3 rounded-2xl">
                <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">Hal Etilgan</div>
                <div className="text-lg font-black text-emerald-950 dark:text-emerald-100">
                  {organizationsWithStats.reduce((acc, o) => acc + o.calculatedResolved, 0)} ta
                </div>
              </div>
              <div className="bg-amber-50/60 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-800/60 p-3 rounded-2xl">
                <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300">Jarayonda</div>
                <div className="text-lg font-black text-amber-950 dark:text-amber-100">
                  {organizationsWithStats.reduce((acc, o) => acc + o.calculatedInProgress, 0)} ta
                </div>
              </div>
            </div>

            {/* Search & Filter Controls */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <div className="relative flex-1 w-full">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={orgModalSearch}
                  onChange={(e) => setOrgModalSearch(e.target.value)}
                  placeholder="Tashkilot nomi, kodi, rahbari yoki sohasi bo'yicha qidiruv..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
                />
              </div>

              <select
                value={orgModalCategoryFilter}
                onChange={(e) => setOrgModalCategoryFilter(e.target.value)}
                className="w-full sm:w-auto bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
              >
                <option value="all">Barcha sohalar ({organizations.length})</option>
                {orgCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <button
                onClick={() => {
                  setShowAllOrganizationsModal(false);
                  setShowAddOrgModal(true);
                }}
                className="w-full sm:w-auto px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm transition-all flex-shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Yangi Qo'shish</span>
              </button>
            </div>

            {/* Scrollable Organizations Grid */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-3 max-h-[50vh]">
              {filteredOrganizationsModalList.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <Building2 className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Qidiruv bo'yicha tashkilot topilmadi</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredOrganizationsModalList.map((org, idx) => {
                    const isPassVisible = !!visiblePasswords[org.id];
                    const isCopied = copiedOrgPasswordId === org.id;

                    return (
                      <div
                        key={org.id}
                        className="bg-slate-50/70 dark:bg-slate-900/70 hover:bg-white dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-2xl p-4 transition-all shadow-xs hover:shadow-md flex flex-col justify-between space-y-3 group"
                      >
                        <div>
                          {/* Top: Name & Badges */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2">
                                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0">
                                  {idx + 1}
                                </span>
                                <h4 className="font-extrabold text-slate-900 dark:text-white text-sm truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                  {org.name}
                                </h4>
                              </div>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className="px-2 py-0.5 bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded-md font-mono">
                                  {org.code}
                                </span>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                  {org.category}
                                </span>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className="text-xs font-black text-indigo-700 dark:text-indigo-400">
                                {org.resolvedPercent}%
                              </span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-semibold">ijro</span>
                            </div>
                          </div>

                          {/* Middle: Rahbar & Phone & Password */}
                          <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 dark:border-slate-800 space-y-2 text-[11px]">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-bold">Mas'ul Rahbar:</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                                  {org.leader || "Tayinlanmagan"}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-bold">Telefon:</span>
                                <a href={`tel:${org.phone}`} className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline block truncate">
                                  {org.phone || "+998 66 403-11-22"}
                                </a>
                              </div>
                            </div>

                            {/* Password pill with eye toggle & copy */}
                            <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl p-2 flex items-center justify-between">
                              <div className="flex items-center space-x-2 min-w-0">
                                <Key className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">Kirish paroli:</span>
                                <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                                  {isPassVisible ? org.password : '••••••••'}
                                </span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setVisiblePasswords((prev) => ({
                                      ...prev,
                                      [org.id]: !prev[org.id],
                                    }))
                                  }
                                  className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                  title={isPassVisible ? "Parolni berkitish" : "Parolni ko'rsatish"}
                                >
                                  {isPassVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCopyOrgPassword(org.id, org.password)}
                                  className="p-1 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                  title="Paroldan nusxa olish"
                                >
                                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Stats Grid */}
                          <div className="mt-2.5 grid grid-cols-4 gap-1.5 text-center">
                            <div className="bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 rounded-xl p-1.5">
                              <span className="text-[9px] text-slate-400 dark:text-slate-500 block font-bold">Jami</span>
                              <span className="text-xs font-black text-slate-900 dark:text-white">{org.calculatedTotal}</span>
                            </div>
                            <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-800 rounded-xl p-1.5">
                              <span className="text-[9px] text-emerald-600 dark:text-emerald-300 block font-bold">Hal</span>
                              <span className="text-xs font-black text-emerald-800 dark:text-emerald-200">{org.calculatedResolved}</span>
                            </div>
                            <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-800 rounded-xl p-1.5">
                              <span className="text-[9px] text-amber-600 dark:text-amber-300 block font-bold">Jarayonda</span>
                              <span className="text-xs font-black text-amber-800 dark:text-amber-200">{org.calculatedInProgress}</span>
                            </div>
                            <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-800 rounded-xl p-1.5">
                              <span className="text-[9px] text-rose-600 dark:text-rose-300 block font-bold">E'tirozli</span>
                              <span className="text-xs font-black text-rose-800 dark:text-rose-200">{org.calculatedObjection}</span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons in Org Modal */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                          <button
                            onClick={() => {
                              setShowAllOrganizationsModal(false);
                              setResetPasswordModalOrg(org);
                              setCustomNewPassword(`pablo-${Math.floor(1000 + Math.random() * 9000)}`);
                            }}
                            className="flex-1 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-600 hover:text-white text-indigo-700 dark:text-indigo-300 font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Yangi Parol Berish</span>
                          </button>

                          {org.isLocked ? (
                            <button
                              onClick={() => handleUnlockOrg(org)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1 shadow-xs transition-all cursor-pointer"
                              title="Blokdan chiqarish"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              <span>Blokdan Chiqarish</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleLockOrg(org)}
                              className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-600 hover:text-white text-rose-700 dark:text-rose-300 font-bold rounded-xl text-xs border border-rose-200 dark:border-rose-800 flex items-center space-x-1 transition-all cursor-pointer"
                              title="Tashkilotni bloklash"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>Bloklash</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setSelectedOrgFilter(org.id);
                              setActiveTab('appeals');
                              setShowAllOrganizationsModal(false);
                            }}
                            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs flex items-center space-x-1 transition-all cursor-pointer"
                          >
                            <span>Murojaatlari</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Ko'rsatilmoqda: <strong>{filteredOrganizationsModalList.length}</strong> / {organizations.length} ta tashkilot
              </span>
              <button
                onClick={() => setShowAllOrganizationsModal(false)}
                className="px-5 py-2.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. RESET PASSWORD MODAL FOR BOSH KABINET ADMIN */}
      {resetPasswordModalOrg && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-[#0c1628] rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-2xl ring-4 ring-amber-50/50 dark:ring-amber-950/30">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Yangi Kirish Paroli Berish</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{resetPasswordModalOrg.name}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setResetPasswordModalOrg(null);
                  setCustomNewPassword('');
                }}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Org Info Banner */}
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-bold">Tashkilot kodi:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  {resetPasswordModalOrg.code}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-bold">Mas'ul rahbar:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{resetPasswordModalOrg.leader || 'Tayinlanmagan'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-bold">Telefon raqami:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{resetPasswordModalOrg.phone || '+998 66 403-11-22'}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 font-bold">Hozirgi paroli:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  {resetPasswordModalOrg.password}
                </span>
              </div>
              {resetPasswordModalOrg.isLocked && (
                <div className="pt-2 border-t border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 font-bold flex items-center space-x-1.5 text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                  <span>Tashkilot hozirda 3 ta xato urinish tufayli bloklangan holatda. Yangi parol berilgach avtomatik blokdan chiqariladi.</span>
                </div>
              )}
            </div>

            {/* Password Input & Generator */}
            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Yangi Maxsus Kirish Paroli:
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={customNewPassword}
                  onChange={(e) => setCustomNewPassword(e.target.value)}
                  placeholder="Masalan: pablo-7821"
                  className="flex-1 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-mono text-sm font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setCustomNewPassword(`pablo-${Math.floor(1000 + Math.random() * 9000)}`)}
                  className="px-3 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold transition-colors cursor-pointer flex-shrink-0"
                  title="Tasodifiy yangi kod yaratish"
                >
                  🎲 Generatsiya
                </button>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Ushbu yangi parolni tashkilot rahbariga Telegram yoki SMS orqali yuborishingiz mumkin.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-2.5">
              <button
                type="button"
                onClick={() => {
                  setResetPasswordModalOrg(null);
                  setCustomNewPassword('');
                }}
                disabled={isResettingPassword}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={() => handleResetOrgPassword(resetPasswordModalOrg, customNewPassword)}
                disabled={isResettingPassword || !customNewPassword.trim()}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-600/30 transition-all cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
              >
                <KeyRound className="w-4 h-4" />
                <span>{isResettingPassword ? 'Saqlanmoqda...' : 'Saqlash & Nusxalash'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. CREATE NEW TASK MODAL */}
      {showCreateTaskModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-[#0c1628] rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl ring-4 ring-blue-50/50 dark:ring-blue-950/30">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Yangi Topshiriq / Vazifa Biriktirish</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">murojaatlar shtab a'zolari va tashkilotlar uchun (bir yoki bir nechta tashkilotga)</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateTaskModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newTaskTitle.trim() || !newTaskDescription.trim()) {
                  alert("Iltimos, vazifa sarlavhasi va tavsifini kiriting");
                  return;
                }
                if (newTaskTargetOrgIds.length === 0) {
                  alert("Iltimos, kamida bitta ijrochi tashkilotni tanlang");
                  return;
                }
                if (!onCreateTask) return;

                const calculatedDeadline = newTaskDeadlineType === 'custom' && newTaskDeadline
                  ? newTaskDeadline
                  : new Date(Date.now() + newTaskDeadlineDays * 24 * 60 * 60 * 1000).toISOString();

                try {
                  await onCreateTask({
                    title: newTaskTitle,
                    description: newTaskDescription,
                    targetOrgIds: newTaskTargetOrgIds.includes('all') ? ['all'] : newTaskTargetOrgIds,
                    targetOrgId: newTaskTargetOrgIds.includes('all') ? 'all' : newTaskTargetOrgIds[0],
                    deadline: calculatedDeadline,
                    category: newTaskCategory,
                  });
                  setToastMessage("✅ Yangi topshiriq tanlangan tashkilotlarga muvaffaqiyatli biriktirildi!");
                  setShowCreateTaskModal(false);
                  setNewTaskTitle('');
                  setNewTaskDescription('');
                  setNewTaskTargetOrgIds(['all']);
                  setNewTaskDeadline('');
                  setNewTaskDeadlineType('preset');
                  setNewTaskDeadlineDays(15);
                  if (onRefresh) await onRefresh();
                } catch (err: any) {
                  alert("Xatolik: " + err.message);
                }
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Topshiriq Sarlavhasi *
                </label>
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Masalan: Yoshlar bandligi va profilaktika tadbirlari"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Vazifa Toifasi
                  </label>
                  <select
                    value={newTaskCategory}
                    onChange={(e) => setNewTaskCategory(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Sektor Maxsus Vazifasi">Sektor Maxsus Vazifasi</option>
                    <option value="Yoshlar bilan ishlash">Yoshlar bilan ishlash</option>
                    <option value="Bandlik va kambag'allik">Bandlik va kambag'allik</option>
                    <option value="Huquqbuzarliklar profilaktikasi">Huquqbuzarliklar profilaktikasi</option>
                    <option value="Ijtimoiy himoya">Ijtimoiy himoya</option>
                    <option value="Ta'lim va tarbiya">Ta'lim va tarbiya</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tezkor Biriktirish
                  </label>
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => setNewTaskTargetOrgIds(['all'])}
                      className={`flex-1 py-2 px-2 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer text-center ${
                        newTaskTargetOrgIds.includes('all')
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      🌐 Barchasiga (18 ta)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewTaskTargetOrgIds(shtabOrganizations.map((o) => o.id))}
                      className={`flex-1 py-2 px-2 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer text-center ${
                        !newTaskTargetOrgIds.includes('all') &&
                        newTaskTargetOrgIds.length === shtabOrganizations.length &&
                        shtabOrganizations.every((o) => newTaskTargetOrgIds.includes(o.id))
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      ⭐ Shtab (15 ta)
                    </button>
                  </div>
                </div>
              </div>

              {/* Multi-Select Organization Checkbox Section for Tasks */}
              <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center space-x-1.5">
                      <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Ijrochi Tashkilotlar *</span>
                      <span className="ml-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-full text-[10px] font-black">
                        {newTaskTargetOrgIds.includes('all')
                          ? 'Barcha 18 ta tashkilot'
                          : `${newTaskTargetOrgIds.length} ta tanlandi`}
                      </span>
                    </label>
                  </div>
                  <div className="flex items-center space-x-1.5 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setNewTaskTargetOrgIds(organizations.map((o) => o.id))}
                      className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      Barchasini tanlash
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewTaskTargetOrgIds([])}
                      className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg text-[11px] font-bold text-red-600 dark:text-red-400 cursor-pointer"
                    >
                      Tozalash
                    </button>
                  </div>
                </div>

                {/* Search input for task orgs */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Tashkilot qidirish..."
                    value={newTaskOrgSearch}
                    onChange={(e) => setNewTaskOrgSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Organization Checkbox List for Tasks */}
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {organizations
                    .filter((org) => {
                      if (!newTaskOrgSearch.trim()) return true;
                      const q = newTaskOrgSearch.toLowerCase();
                      return org.name.toLowerCase().includes(q) || org.category.toLowerCase().includes(q) || org.code.toLowerCase().includes(q);
                    })
                    .map((org) => {
                      const isAll = newTaskTargetOrgIds.includes('all');
                      const isChecked = isAll || newTaskTargetOrgIds.includes(org.id);

                      return (
                        <div
                          key={org.id}
                          onClick={() => {
                            if (newTaskTargetOrgIds.includes('all')) {
                              // If 'all' was active, unchecking one means selecting all EXCEPT this one
                              setNewTaskTargetOrgIds(organizations.map((o) => o.id).filter((id) => id !== org.id));
                            } else if (newTaskTargetOrgIds.includes(org.id)) {
                              setNewTaskTargetOrgIds(newTaskTargetOrgIds.filter((id) => id !== org.id));
                            } else {
                              setNewTaskTargetOrgIds([...newTaskTargetOrgIds, org.id]);
                            }
                          }}
                          className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-blue-50/80 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-950 dark:text-blue-100 shadow-xs'
                              : 'bg-white dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 pointer-events-none"
                            />
                            <div>
                              <span className="font-bold text-xs">{org.name}</span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-1.5">({org.category})</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                            {org.code}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Deadline (Muddat Qo'shish) for Tasks */}
              <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center space-x-1.5">
                    <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Ijro Muddati (Muddat belgilash)</span>
                  </label>
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                    {newTaskDeadlineType === 'preset'
                      ? `${newTaskDeadlineDays} kun muddat`
                      : 'Aniq kalendar sanasi'}
                  </span>
                </div>

                {/* Quick Presets for task deadline */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: '3 kun', days: 3 },
                    { label: '7 kun', days: 7 },
                    { label: '15 kun (Standart)', days: 15 },
                    { label: '30 kun', days: 30 },
                    { label: '45 kun', days: 45 },
                  ].map((preset) => {
                    const isSelected = newTaskDeadlineType === 'preset' && newTaskDeadlineDays === preset.days;
                    return (
                      <button
                        key={preset.days}
                        type="button"
                        onClick={() => {
                          setNewTaskDeadlineType('preset');
                          setNewTaskDeadlineDays(preset.days);
                        }}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setNewTaskDeadlineType('custom');
                      if (!newTaskDeadline) {
                        const d = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
                        setNewTaskDeadline(d.toISOString().split('T')[0]);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                      newTaskDeadlineType === 'custom'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    📅 Boshqa sana
                  </button>
                </div>

                {newTaskDeadlineType === 'custom' && (
                  <div className="pt-1">
                    <input
                      type="date"
                      value={newTaskDeadline}
                      onChange={(e) => setNewTaskDeadline(e.target.value)}
                      className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-1.5 pt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Belgilangan ijro muddati:{' '}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {newTaskDeadlineType === 'custom' && newTaskDeadline
                        ? new Date(newTaskDeadline).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'long', year: 'numeric' })
                        : formatDeadlineDatePreview(newTaskDeadlineDays)}
                    </strong>
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Vazifa Tavsifi & Aniqlashtiruvchi Ko‘rsatmalar *
                </label>
                <textarea
                  rows={3}
                  value={newTaskDescription}
                  onChange={(e) => setNewTaskDescription(e.target.value)}
                  placeholder="Vazifa bo‘yicha amalga oshirilishi lozim bo‘lgan chora-tadbirlar, kutilayotgan natijalar va hisobot shakli..."
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateTaskModal(false)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-all cursor-pointer flex items-center space-x-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    Topshiriqni Yuborish ({newTaskTargetOrgIds.includes('all') ? '18 ta' : `${newTaskTargetOrgIds.length} ta`} tashkilotga)
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 11. TASK DETAIL & APPROVAL / REJECTION MODAL */}
      {selectedTaskForDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-[#0c1628] rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-sm">
                  #{selectedTaskForDetail.taskNumber || '•'}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">{selectedTaskForDetail.title}</h3>
                  <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    <span className="font-semibold">{selectedTaskForDetail.category || 'Sektor Vazifasi'}</span>
                    <span>•</span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold">{selectedTaskForDetail.targetOrgName}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedTaskForDetail(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Task Details Card */}
            <div className="space-y-3">
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Vazifa Mazmuni:
                </div>
                <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap font-normal">
                  {selectedTaskForDetail.description}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3">
                  <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-bold">Holat:</span>
                  <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">
                    {selectedTaskForDetail.status === 'tasdiqlandi'
                      ? '✅ Bajarilgan va Tasdiqlangan'
                      : selectedTaskForDetail.status === 'tekshiruvda'
                      ? '📝 Hisobot topshirilgan (Tekshiruvda)'
                      : selectedTaskForDetail.status === 'jarayonda'
                      ? '⏱️ Ijro jarayonida'
                      : selectedTaskForDetail.status === 'qaytarildi'
                      ? '⚠️ Qaytarilgan'
                      : '🔵 Yangi topshiriq'}
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3">
                  <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-bold">Yuborilgan sana:</span>
                  <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">
                    {new Date(selectedTaskForDetail.createdAt).toLocaleDateString('uz-UZ')}
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3">
                  <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-bold">Ijro muddati:</span>
                  <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">
                    {selectedTaskForDetail.deadline
                      ? new Date(selectedTaskForDetail.deadline).toLocaleDateString('uz-UZ')
                      : '15 kunlik reja'}
                  </span>
                </div>
              </div>

              {/* Completion Report Section */}
              {selectedTaskForDetail.completionReport ? (
                <div className="bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs font-black text-purple-900 dark:text-purple-200">
                      <FileCheck2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span>Tashkilotning Bajarilgan Ishlar Bo‘yicha Hisoboti:</span>
                    </div>
                    <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/60 px-2.5 py-0.5 rounded-full">
                      {new Date(selectedTaskForDetail.completionReport.submittedAt).toLocaleDateString('uz-UZ')}
                    </span>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-purple-100 dark:border-purple-800/60 rounded-xl p-3.5 text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {selectedTaskForDetail.completionReport.notes}
                  </div>

                  {(selectedTaskForDetail.completionReport.pdfUrl || selectedTaskForDetail.reportPdfUrl) && (
                    <div className="pt-1">
                      <a
                        href={selectedTaskForDetail.completionReport.pdfUrl || selectedTaskForDetail.reportPdfUrl}
                        download={
                          selectedTaskForDetail.completionReport.pdfFileName ||
                          selectedTaskForDetail.reportPdfName ||
                          'tashkilot_hisoboti.pdf'
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-2 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                      >
                        <Download className="w-4 h-4" />
                        <span>
                          Yuklangan PDF Hisobotni Ko‘rish / Yuklab Olish (
                          {selectedTaskForDetail.completionReport.pdfFileName ||
                            selectedTaskForDetail.reportPdfName ||
                            'Hujjat.pdf'}
                          )
                        </span>
                      </a>
                    </div>
                  )}

                  {selectedTaskForDetail.completionReport.executorName && (
                    <div className="text-[11px] text-purple-800 dark:text-purple-300">
                      <strong>Hisobot topshiruvchi mas'ul:</strong> {selectedTaskForDetail.completionReport.executorName}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 text-xs text-amber-800 dark:text-amber-300 flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <span>
                    Tashkilot hozircha ushbu vazifa bo‘yicha yakuniy hisobotni topshirmagan. Tashkilot kabinetida "Vazifani Boshlash" va "Hisobot Topshirish" tugmalari mavjud.
                  </span>
                </div>
              )}

              {/* Bosh Kabinet Feedback Input & Actions */}
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Bosh Kabinet Xulosasi / Izohi:
                </label>
                <textarea
                  rows={2}
                  value={taskAdminFeedback}
                  onChange={(e) => setTaskAdminFeedback(e.target.value)}
                  placeholder="Agar hisobot qoniqarli bo‘lsa tasdiqlang yoki kamchiliklar bo‘yicha ko‘rsatma yozib qaytaring..."
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => setSelectedTaskForDetail(null)}
                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Yopish
                  </button>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={async () => {
                        if (!onRejectTask) return;
                        if (!taskAdminFeedback.trim()) {
                          alert("Iltimos, qaytarish sababi yoki kamchiliklarni ko‘rsatma sifatida yozing");
                          return;
                        }
                        try {
                          await onRejectTask(selectedTaskForDetail.id, taskAdminFeedback);
                          showToast("⚠️ Vazifa qayta ishlash uchun qaytarildi");
                          setSelectedTaskForDetail(null);
                        } catch (e: any) {
                          alert("Xatolik: " + e.message);
                        }
                      }}
                      className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-600 hover:text-white text-rose-700 dark:text-rose-300 font-bold rounded-xl text-xs border border-rose-200 dark:border-rose-800 transition-all cursor-pointer flex items-center space-x-1.5"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Qayta Ishlashga Qaytarish</span>
                    </button>

                    <button
                      onClick={async () => {
                        if (!onApproveTask) return;
                        try {
                          await onApproveTask(
                            selectedTaskForDetail.id,
                            taskAdminFeedback.trim() || "Bosh Kabinet tomonidan qabul qilindi va tasdiqlandi."
                          );
                          showToast("✅ Vazifa muvaffaqiyatli tasdiqlandi!");
                          setSelectedTaskForDetail(null);
                        } catch (e: any) {
                          alert("Xatolik: " + e.message);
                        }
                      }}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer flex items-center space-x-1.5"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Hisobotni Tasdiqlash</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-800 flex items-center space-x-3 text-xs font-bold animate-in slide-in-from-bottom duration-300">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
