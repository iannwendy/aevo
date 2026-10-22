'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Search,
  ShieldCheck,
  Ban,
  CheckCircle2,
  AlertCircle,
  Edit3,
  X,
  Save,
} from 'lucide-react';
import AdminShell from '../../../components/admin/AdminShell';
import Pagination from '../../../components/product/Pagination';
import { usersApi } from '../../../lib/api';
import { formatPrice } from '../../../lib/utils';
import { useI18n } from '../../../lib/i18n';

export default function AdminUsersPage() {
  const { t, locale } = useI18n();

  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [selectedUser, setSelectedUser] = useState(null);
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState('CUSTOMER');
  const [feedback, setFeedback] = useState(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (searchQuery) params.search = searchQuery;
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.status = statusFilter;

      const res = await usersApi.getAll(params);
      if (res.data) {
        setUsers(res.data.users || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      }
    } catch {
      // Keep default state when unauthenticated
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, roleFilter, statusFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearchQuery(searchInput.trim());
  };

  const handleToggleBan = async (user) => {
    setFeedback(null);
    try {
      if (user.isActive) {
        await usersApi.ban(user.id);
        setFeedback({
          type: 'success',
          message: `Account ${user.email} has been banned (isActive = false).`,
        });
      } else {
        await usersApi.unban(user.id);
        setFeedback({
          type: 'success',
          message: `Account ${user.email} has been unbanned (isActive = true).`,
        });
      }
      loadUsers();
      if (selectedUser?.id === user.id) {
        const detail = await usersApi.getById(user.id);
        setSelectedUser(detail.data);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Could not update user status.',
      });
    }
  };

  const handleOpenEditUser = async (user) => {
    setEditFullName(user.fullName || '');
    setEditRole(user.role || 'CUSTOMER');
    setSelectedUser(user);
    try {
      const res = await usersApi.getById(user.id);
      if (res.data) {
        setSelectedUser(res.data);
        setEditFullName(res.data.fullName || '');
        setEditRole(res.data.role || 'CUSTOMER');
      }
    } catch {
      // ignore
    }
  };

  const handleSaveUserChanges = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    setFeedback(null);
    try {
      const res = await usersApi.update(selectedUser.id, {
        fullName: editFullName.trim(),
        role: editRole,
      });
      setFeedback({
        type: 'success',
        message: `Updated profile for ${res.data.email}.`,
      });
      setSelectedUser((prev) => (prev ? { ...prev, ...res.data } : null));
      loadUsers();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Failed to update user information.',
      });
    }
  };

  return (
    <AdminShell>
      <div className="space-y-8" data-testid="admin-users-page">
        {/* Header */}
        <div className="border-b border-border pb-6">
          <p className="text-caption font-mono uppercase tracking-widest text-secondary">
            {t('admin.usersEyebrow')}
          </p>
          <h1 className="text-h1 font-display mt-1">{t('admin.usersTitle')}</h1>
          <p className="text-body text-secondary mt-1">{t('admin.usersSubtitle')}</p>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 rounded-xl border flex items-center gap-3 text-small ${
              feedback.type === 'success'
                ? 'border-success/40 bg-success/10 text-success'
                : 'border-danger/40 bg-danger/10 text-danger'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Search & Filters */}
        <div className="surface-card p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary"
              />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search users by name or email…"
                data-testid="admin-user-search-input"
                className="input-field h-10 pl-10 text-small"
              />
            </div>
            <button type="submit" className="btn-primary h-10 px-4 text-small">
              Search
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="input-field h-10 text-small w-auto min-w-[140px]"
            >
              <option value="">All Roles</option>
              <option value="CUSTOMER">Customer</option>
              <option value="ADMIN">Admin</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="input-field h-10 text-small w-auto min-w-[140px]"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="banned">Banned</option>
            </select>
          </div>
        </div>

        {/* Users Data Table */}
        <div className="surface-card overflow-hidden" data-testid="admin-users-table">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-caption font-mono uppercase text-secondary">
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4 text-right">Loyalty Points</th>
                  <th className="py-3.5 px-4 text-right">Orders</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Joined</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-small">
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="table-row-interactive"
                    data-testid={`admin-user-row-${user.id}`}
                  >
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-ink">{user.fullName}</p>
                      <p className="text-caption font-mono text-secondary">{user.email}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-pill border text-[11px] font-mono uppercase ${
                          user.role === 'ADMIN'
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-surface-muted text-secondary border-border'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-caption tabular-nums text-ink">
                      {(user.loyaltyPoints || 0).toLocaleString()} pts
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-caption tabular-nums text-secondary">
                      {user._count?.orders ?? 0}
                    </td>
                    <td className="py-3.5 px-4">
                      {user.isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill border border-success/30 bg-success/10 text-success text-[11px] font-mono uppercase">
                          <ShieldCheck size={12} />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill border border-danger/30 bg-danger/10 text-danger text-[11px] font-mono uppercase">
                          <Ban size={12} />
                          <span>Banned</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-caption text-secondary">
                      {user.createdAt
                        ? new Date(user.createdAt).toLocaleDateString(
                            locale === 'vi' ? 'vi-VN' : 'en-US'
                          )
                        : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEditUser(user)}
                          data-testid={`edit-user-btn-${user.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-surface text-caption font-medium text-ink hover:bg-surface-muted"
                        >
                          <Edit3 size={13} />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleBan(user)}
                          data-testid={`toggle-ban-btn-${user.id}`}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-caption font-medium transition-colors ${
                            user.isActive
                              ? 'border-danger/30 bg-danger/10 text-danger hover:bg-danger/20'
                              : 'border-success/30 bg-success/10 text-success hover:bg-success/20'
                          }`}
                        >
                          {user.isActive ? (
                            <>
                              <Ban size={13} />
                              <span>Ban</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck size={13} />
                              <span>Unban</span>
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!loading && users.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-secondary">
                      No matching users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* User Edit / Detail Drawer Card */}
        {selectedUser && (
          <div className="surface-card p-6 space-y-5" data-testid="admin-user-detail-panel">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <p className="text-caption font-mono uppercase text-secondary">
                  User Account Inspector
                </p>
                <h2 className="text-h3 font-display font-medium text-ink">
                  {selectedUser.fullName} ({selectedUser.email})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="p-2 rounded-lg border border-border text-secondary hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={handleSaveUserChanges}
              className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end"
            >
              <div>
                <label className="block text-caption font-mono uppercase text-secondary mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="input-field h-10 text-small"
                />
              </div>

              <div>
                <label className="block text-caption font-mono uppercase text-secondary mb-1.5">
                  Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="input-field h-10 text-small"
                >
                  <option value="CUSTOMER">CUSTOMER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>

              <button type="submit" className="btn-primary h-10 text-small">
                <Save size={15} className="mr-1.5" />
                Save User Changes
              </button>
            </form>

            {selectedUser.orders?.length > 0 && (
              <div className="pt-4 border-t border-border">
                <p className="text-caption font-mono uppercase text-secondary mb-2">
                  Recent Orders ({selectedUser.orders.length})
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {selectedUser.orders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-3 rounded-xl bg-surface-muted border border-border flex items-center justify-between text-caption font-mono"
                    >
                      <span className="text-ink font-medium">{ord.orderNumber}</span>
                      <span className="text-secondary">{ord.status}</span>
                      <span className="text-ink">{formatPrice(ord.totalAmount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit}
          onPageChange={(nextPage) => setPage(nextPage)}
          ariaLabel="Admin Users Pagination"
        />
      </div>
    </AdminShell>
  );
}
