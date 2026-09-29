import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './api';

// --- Finance Hooks ---

export const useFinanceSummary = () => {
  return useQuery({
    queryKey: ['finance-summary'],
    queryFn: async () => {
      const res = await api.get('/finance/summary');
      return res.data.data;
    }
  });
};

export const useTransactions = (params?: { venture?: string, type?: string }) => {
  return useQuery({
    queryKey: ['transactions', params],
    queryFn: async () => {
      const res = await api.get('/finance/transactions', { params });
      return res.data.data;
    }
  });
};

export const useAddRevenue = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/finance/money-in', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
    }
  });
};

export const useRecordExpense = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/finance/money-out', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
    }
  });
};

export const useTransferFunds = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/finance/transfer', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
    }
  });
};

export const useUpdateTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      const res = await api.patch(`/finance/transactions/${id}`, data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
    }
  });
};

// --- Dashboard Hooks ---

export const useDashboardStats = () => {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await api.get('/dashboard/stats');
      return res.data.data;
    }
  });
};

// --- Venture Hooks ---

export const useVentures = () => {
  return useQuery({
    queryKey: ['ventures'],
    queryFn: async () => {
      const res = await api.get('/ventures');
      return res.data.data;
    }
  });
};

export const useCreateVenture = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/ventures', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ventures'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    }
  });
};

// --- Team Hooks ---

export const useTeams = (params?: { venture?: string; status?: string; search?: string; teamLead?: string }) => {
  return useQuery({
    queryKey: ['teams', params],
    queryFn: async () => {
      const res = await api.get('/teams', { params });
      return res.data.data;
    }
  });
};

export const useVentureTeams = (ventureId?: string) => {
  return useQuery({
    queryKey: ['venture-teams', ventureId],
    queryFn: async () => {
      if (!ventureId) return [];
      const res = await api.get(`/ventures/${ventureId}/teams`);
      return res.data.data;
    },
    enabled: !!ventureId
  });
};

export const useTeamMembers = (teamId?: string) => {
  return useQuery({
    queryKey: ['team-members', teamId],
    queryFn: async () => {
      if (!teamId) return [];
      const res = await api.get(`/teams/${teamId}/members`);
      return res.data.data;
    },
    enabled: !!teamId
  });
};

export const useCreateTeam = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/teams', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    }
  });
};

export const useUpdateTeam = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await api.put(`/teams/${id}`, data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    }
  });
};

export const useDeleteTeam = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/teams/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    }
  });
};

// --- Employee Hooks ---

export const useEmployees = (params?: { venture?: string; team?: string; department?: string; role?: string; status?: string; search?: string }) => {
  return useQuery({
    queryKey: ['employees', params],
    queryFn: async () => {
      const res = await api.get('/employees', { params });
      return res.data.data;
    }
  });
};

export const useCreateEmployee = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/employees', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    }
  });
};

export const useUpdateEmployee = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await api.put(`/employees/${id}`, data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    }
  });
};

export const useDeleteEmployee = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/employees/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    }
  });
};

// --- Project Hooks ---

export const useProjects = (params?: { venture?: string }) => {
  return useQuery({
    queryKey: ['projects', params],
    queryFn: async () => {
      const res = await api.get('/projects', { params });
      return res.data.data;
    }
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/projects', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    }
  });
};

export const useProject = (id?: string) => {
  return useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await api.get(`/projects/${id}`);
      return res.data.data;
    },
    enabled: !!id,
    retry: 1
  });
};

// --- Task Hooks ---

export const useTasks = (params?: { venture?: string; project?: string; assignedTo?: string }) => {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: async () => {
      const res = await api.get('/tasks', { params });
      return res.data.data;
    }
  });
};

export const useTask = (id?: string) => {
  return useQuery({
    queryKey: ['task', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await api.get(`/tasks/${id}`);
      return res.data.data;
    },
    enabled: !!id,
    retry: 1
  });
};

export const useCreateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/tasks', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    }
  });
};

// --- Reward & Leaderboard Hooks ---

export const useRewards = (params?: { employee?: string }) => {
  return useQuery({
    queryKey: ['rewards', params],
    queryFn: async () => {
      const res = await api.get('/rewards', { params });
      return res.data.data;
    }
  });
};

export const useLeaderboard = (params?: { department?: string; search?: string; limit?: number }) => {
  return useQuery({
    queryKey: ['leaderboard', params],
    queryFn: async () => {
      const res = await api.get('/rewards/leaderboard', { params });
      return res.data.data;
    }
  });
};

export const useMyRewards = () => {
  return useQuery({
    queryKey: ['rewards-me'],
    queryFn: async () => {
      const res = await api.get('/rewards/me');
      return res.data.data;
    }
  });
};

export const useCompleteTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, remarks }: { taskId: string; remarks?: string }) => {
      const res = await api.patch(`/tasks/${taskId}/complete`, { remarks });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-task-report'] });
      queryClient.invalidateQueries({ queryKey: ['rewards-me'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['rewards'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    }
  });
};

// --- Task Completion Report Hooks ---

export const useMyTaskReport = (params?: {
  search?: string;
  status?: string;
  priority?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: string;
}) => {
  return useQuery({
    queryKey: ['my-task-report', params],
    queryFn: async () => {
      const res = await api.get('/reports/my-tasks', { params });
      return res.data.data;
    }
  });
};

export const downloadMyTaskReportPDF = async (params?: Record<string, any>) => {
  const res = await api.get('/reports/my-tasks/pdf', {
    params,
    responseType: 'blob'
  });
  const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Thenam_Task_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const downloadMyTaskReportExcel = async (params?: Record<string, any>) => {
  const res = await api.get('/reports/my-tasks/excel', {
    params,
    responseType: 'blob'
  });
  const url = window.URL.createObjectURL(
    new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  );
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Thenam_Task_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// --- Setting Hooks ---

export const useSettings = () => {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await api.get('/settings');
      return res.data.data;
    }
  });
};

export const useUpdateSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await api.put('/settings', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    }
  });
};

// --- User & Auth Hooks ---

export const useUsers = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/auth/users');
      return res.data.data;
    }
  });
};

export const useUpdateProfile = () => {
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await api.put('/auth/profile', data);
      return res.data.data;
    }
  });
};

export const useChangePassword = () => {
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/auth/change-password', data);
      return res.data;
    }
  });
};

export const useForgotPassword = () => {
  return useMutation({
    mutationFn: async (email: string) => {
      const res = await api.post('/auth/forgot-password', { email });
      return res.data;
    }
  });
};

export const useMigrateUsers = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post('/auth/migrate-existing-users');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    }
  });
};

// --- Additional Task & Project Hooks ---

export const useUpdateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await api.put(`/tasks/${id}`, data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    }
  });
};

export const useUpdateTaskStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await api.patch(`/tasks/${id}/status`, { status });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    }
  });
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await api.put(`/projects/${id}`, data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  });
};

// --- Additional Dashboard Hooks ---

export const useDashboardCharts = () => {
  return useQuery({
    queryKey: ['dashboard-charts'],
    queryFn: async () => {
      const res = await api.get('/dashboard/charts');
      return res.data.data;
    }
  });
};

export const useRecentActivities = () => {
  return useQuery({
    queryKey: ['recent-activities'],
    queryFn: async () => {
      const res = await api.get('/dashboard/recent');
      return res.data.data;
    }
  });
};

// --- Notification Hooks ---

export const useNotifications = () => {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get('/notifications');
      return res.data.data;
    }
  });
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch(`/notifications/${id}/read`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/projects/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  });
};

export const useDeleteVenture = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/ventures/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ventures'] });
    }
  });
};

export const useDeleteTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/tasks/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  });
};

export const useUpdateVenture = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await api.put(`/ventures/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ventures'] });
    }
  });
};

// Chat Hooks
export const useChatMessages = (channel?: string, recipientId?: string) => {
  return useQuery({
    queryKey: ['chat-messages', channel ?? 'general', recipientId],
    queryFn: async () => {
      const params: any = {};
      if (recipientId) params.recipientId = recipientId;
      else params.channel = channel ?? 'general';
      const res = await api.get('/chat/messages', { params });
      return res.data.data;
    },
    enabled: !!channel,
    staleTime: 0, // Always fetch fresh data — real-time driven via socket
  });
};

export const useSendMessage = () => {
  // NOTE: We do NOT auto-invalidate here.
  // The caller manages optimistic UI via clientMessageId reconciliation.
  // The socket event 'message:new' drives real-time updates.
  return useMutation({
    mutationFn: async (payload: {
      content: string;
      channel?: string;
      recipientId?: string;
      messageType?: string;
      attachments?: any[];
      text?: string;
      clientMessageId?: string;
    }) => {
      const res = await api.post('/chat/messages', payload);
      return res.data.data;
    }
  });
};

// Announcement Hooks
export const useAnnouncements = () => {
  return useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const res = await api.get('/announcements');
      return res.data.data;
    }
  });
};

// Only active (non-expired, isActive=true) announcements — used by popup
export const useActiveAnnouncements = () => {
  return useQuery({
    queryKey: ['announcements-active'],
    queryFn: async () => {
      const res = await api.get('/announcements/active');
      return res.data.data;
    },
    staleTime: 60_000 // 1 minute cache
  });
};

export const useCreateAnnouncement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      title: string;
      content: string;
      message?: string;
      priority?: string;
      targetAudience?: string;
      department?: string;
      targetUsers?: string[];
      pinned?: boolean;
    }) => {
      const res = await api.post('/announcements', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcements-active'] });
    }
  });
};

export const useDeleteAnnouncement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/announcements/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcements-active'] });
    }
  });
};

// ── Task Approval Hooks ───────────────────────────────────────────────────────

export const useSubmitTaskCompletion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const res = await api.post(`/tasks/${taskId}/submit-completion`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  });
};

export const useApproveTaskCompletion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const res = await api.post(`/tasks/${taskId}/approve-completion`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  });
};

export const useDenyTaskCompletion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, reason }: { taskId: string; reason: string }) => {
      const res = await api.post(`/tasks/${taskId}/deny-completion`, { reason });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  });
};

// --- Workspace Links Hooks ---

export const useWorkspaceLinks = (params?: { workspace?: string; status?: string; type?: string; category?: string; search?: string }) => {
  return useQuery({
    queryKey: ['workspace-links', params],
    queryFn: async () => {
      const res = await api.get('/workspace-links', { params });
      return res.data.data;
    }
  });
};

export const useRecentWorkspaceLinks = (workspace: string) => {
  return useQuery({
    queryKey: ['recent-workspace-links', workspace],
    queryFn: async () => {
      const res = await api.get('/workspace-links/recent', { params: { workspace, limit: 3 } });
      return res.data.data;
    },
    enabled: !!workspace
  });
};

export const useCreateWorkspaceLink = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/workspace-links', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-links'] });
    }
  });
};

export const useUpdateWorkspaceLink = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await api.put(`/workspace-links/${id}`, data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-links'] });
    }
  });
};

export const useTrackWorkspaceLinkOpen = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/workspace-links/${id}/open`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recent-workspace-links'] });
    }
  });
};

export const useArchiveWorkspaceLink = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/workspace-links/${id}/archive`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-links'] });
    }
  });
};

export const useRestoreWorkspaceLink = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/workspace-links/${id}/restore`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-links'] });
    }
  });
};

export const useDeleteWorkspaceLink = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/workspace-links/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-links'] });
      queryClient.invalidateQueries({ queryKey: ['recent-workspace-links'] });
    }
  });
};

// --- Upload Hooks ---

export const useUploadFirebaseImage = () => {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await api.post('/upload/firebase-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return res.data.data;
    }
  });
};

// --- Communication Hooks ---

export const useDirectUsers = () => {
  return useQuery({
    queryKey: ['direct-users'],
    queryFn: async () => {
      const res = await api.get('/communication/direct-users');
      return res.data.data;
    }
  });
};

export const useDirectConversation = (userId?: string) => {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['direct-conversation', userId],
    queryFn: async () => {
      if (!userId) return null;
      const res = await api.get(`/communication/direct/${userId}`);
      return res.data.data;
    },
    enabled: !!userId
  });
};

export const useSendDirectMessage = (userId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      text: string;
      content?: string;
      messageType?: string;
      attachments?: any[];
      clientMessageId?: string;  // idempotency key
    }) => {
      const res = await api.post(`/communication/direct/${userId}/messages`, payload);
      return res.data.data;
    },
    // Layer 1: Cancel any in-flight refetches so they don't race our mutation.
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['direct-messages', userId] });
    },
    // Layer 2: On success, invalidate to pull the single authoritative server list.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['direct-messages', userId] });
      queryClient.invalidateQueries({ queryKey: ['direct-users'] });
    }
  });
};

export const useDirectMessages = (userId?: string) => {
  return useQuery({
    queryKey: ['direct-messages', userId],
    queryFn: async () => {
      if (!userId) return [];
      const res = await api.get(`/communication/direct/${userId}/messages`);
      return res.data.data;
    },
    enabled: !!userId,
    staleTime: 0,
  });
};

export const useMarkMessageRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: string) => {
      const res = await api.post(`/communication/messages/${messageId}/read`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['direct-users'] });
    }
  });
};

export const useDirectRevertTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await api.post(`/finance/transactions/${id}/revert`, { reason });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    }
  });
};

export const useCreateRevertRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await api.post(`/finance/transactions/${id}/revert-request`, { reason });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revert-requests'] });
    }
  });
};

export const useRevertRequests = (status?: string) => {
  return useQuery({
    queryKey: ['revert-requests', status],
    queryFn: async () => {
      const res = await api.get('/finance/revert-requests', { params: { status } });
      return res.data.data;
    }
  });
};

export const useApproveRevertRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/finance/revert-requests/${id}/approve`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revert-requests'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    }
  });
};

export const useDenyRevertRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, denialReason }: { id: string; denialReason: string }) => {
      const res = await api.post(`/finance/revert-requests/${id}/deny`, { denialReason });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revert-requests'] });
    }
  });
};



