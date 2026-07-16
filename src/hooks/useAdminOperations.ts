import { useState } from 'react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

interface AdminStats {
  totalUsers: number;
  totalBlogs: number;
  activePrices: number;
  totalSettings: number;
  totalChats: number;
  totalCalls: number;
}

interface UserAnalytics {
  planDistribution: Record<string, number>;
  subscriptionStatus: Record<string, number>;
  newUsersLast30Days: number;
  averageCoinBalance: number;
}

export const useAdminOperations = () => {
  const [loading, setLoading] = useState(false);

  const exportData = async (table: 'blogs' | 'users' | 'prices', format: 'json' | 'csv' = 'json') => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) throw error;

      const result = { data, recordCount: (data || []).length };

      const dataStr = JSON.stringify(result.data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `${table}_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`${table} data exported successfully (${result.recordCount} records)`);
      return result;
    } catch (error) {
      console.error('Export error:', error);
      toast.error(error instanceof Error ? error.message : 'Export failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getStats = async (start_date?: string, end_date?: string): Promise<AdminStats> => {
    setLoading(true);
    try {
      // First try via Edge Function (service role bypasses RLS for admin ops)
      try {
        const { data, error} = await supabase.functions.invoke('admin-operations', {
          body: { action: 'get_stats', start_date, end_date }
        });
        if (error) throw new Error(error.message);
        if ((data as any)?.stats) return (data as any).stats as AdminStats;
      } catch (_ignored) {}

      // Fallback to direct counts (requires admin RLS)
      const [usersCount, blogsCount, pricesCount, settingsCount, chatsCount, callsCount] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('blogs').select('*', { count: 'exact', head: true }),
        supabase.from('prices').select('*', { count: 'exact', head: true }),
        supabase.from('settings').select('*', { count: 'exact', head: true }),
        supabase.from('chat_history').select('*', { count: 'exact', head: true }),
        supabase.from('call_logs').select('*', { count: 'exact', head: true }),
      ]);
      return {
        totalUsers: usersCount.count || 0,
        totalBlogs: blogsCount.count || 0,
        activePrices: pricesCount.count || 0,
        totalSettings: settingsCount.count || 0,
        totalChats: chatsCount.count || 0,
        totalCalls: callsCount.count || 0,
      };
    } catch (error) {
      console.error('Stats error:', error);
      toast.error('Failed to fetch statistics');
      return {
        totalUsers: 0,
        totalBlogs: 0,
        activePrices: 0,
        totalSettings: 0,
        totalChats: 0,
        totalCalls: 0,
      };
    } finally {
      setLoading(false);
    }
  };

  const getUserAnalytics = async (start_date?: string, end_date?: string): Promise<UserAnalytics> => {
    setLoading(true);
    try {
      // Try Edge Function first
      try {
        const { data, error } = await supabase.functions.invoke('admin-operations', {
          body: { action: 'get_user_analytics', start_date, end_date }
        });
        if (error) throw new Error(error.message);
        if ((data as any)?.analytics) return (data as any).analytics as UserAnalytics;
      } catch (_e) {}

      // Fallback: minimal columns to avoid schema mismatches
      const { data: users, error } = await supabase.from('users').select('plan_tier, subscription_status, coin_balance');
      if (error) throw error;

      const analytics = {
        planDistribution: {} as Record<string, number>,
        subscriptionStatus: {} as Record<string, number>,
        newUsersLast30Days: 0,
        averageCoinBalance: 0
      };

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      if (users) {
        users.forEach((user: any) => {
          const planTier = user.plan_tier || 'free';
          analytics.planDistribution[planTier] = (analytics.planDistribution[planTier] || 0) + 1;

          const subStatus = user.subscription_status || 'none';
          analytics.subscriptionStatus[subStatus] = (analytics.subscriptionStatus[subStatus] || 0) + 1;

          // created_at might not exist; skip this metric gracefully
        });

        const totalBalance = users.reduce((sum: number, user: any) => sum + (user.coin_balance || 0), 0);
        analytics.averageCoinBalance = Math.round(totalBalance / users.length);
      }

      return analytics;
    } catch (error) {
      console.error('Analytics error:', error);
      toast.error('Failed to fetch analytics');
      return {
        planDistribution: {},
        subscriptionStatus: {},
        newUsersLast30Days: 0,
        averageCoinBalance: 0
      };
    } finally {
      setLoading(false);
    }
  };

  const bulkUpdateUsers = async (userIds: string[], updates: Record<string, any>) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update(updates)
        .in('id', userIds);

      if (error) throw error;
      toast.success('Users updated successfully');
      return { success: true };
    } catch (error) {
      console.error('Bulk update error:', error);
      toast.error('Failed to update users');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const grantAdminByEmail = async (email: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_admin: true })
        .eq('email', email);

      if (error) throw error;
      toast.success(`Granted admin to ${email}`);
      return { success: true };
    } catch (error) {
      console.error('Grant admin error:', error);
      toast.error('Failed to grant admin access');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    getStats,
    getUserAnalytics,
    bulkUpdateUsers,
    exportData,
    grantAdminByEmail,
  };
};