'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Check,
  Star,
} from 'lucide-react';
import SiteHeader from '../../../components/SiteHeader';
import SiteFooter from '../../../components/SiteFooter';
import { fetchProfile } from '../../../lib/auth-client';
import { addressesApi } from '../../../lib/api';
import { useI18n } from '../../../lib/i18n';

const EMPTY_FORM = {
  fullName: '',
  phone: '',
  address: '',
  ward: '',
  district: '',
  city: 'Ho Chi Minh City',
  isDefault: false,
};

export default function AddressesPage() {
  const { t } = useI18n();
  const [authStatus, setAuthStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const loadAddresses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await addressesApi.getAll();
      setAddresses(Array.isArray(res.data) ? res.data : []);
    } catch {
      setFeedback({ type: 'error', message: t('addresses.loadError') });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    let active = true;
    async function init() {
      const prof = await fetchProfile();
      if (!active) return;
      if (prof.status === 'ok' && prof.user) {
        setUser(prof.user);
        setAuthStatus('ready');
        loadAddresses();
      } else {
        setAuthStatus('signed-out');
        setLoading(false);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, [loadAddresses]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      ...EMPTY_FORM,
      fullName: user?.fullName || '',
      isDefault: addresses.length === 0,
    });
    setShowForm(true);
    setFeedback(null);
  };

  const handleOpenEdit = (addr) => {
    setEditingId(addr.id);
    setFormData({
      fullName: addr.fullName || '',
      phone: addr.phone || '',
      address: addr.address || '',
      ward: addr.ward || '',
      district: addr.district || '',
      city: addr.city || 'Ho Chi Minh City',
      isDefault: Boolean(addr.isDefault),
    });
    setShowForm(true);
    setFeedback(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.phone.trim() || !formData.address.trim()) {
      setFeedback({
        type: 'error',
        message: t('addresses.requiredFieldsError'),
      });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      if (editingId) {
        await addressesApi.update(editingId, formData);
        setShowForm(false);
        setEditingId(null);
        await loadAddresses();
        setFeedback({ type: 'success', message: t('addresses.updatedSuccess') });
      } else {
        await addressesApi.create(formData);
        setShowForm(false);
        setEditingId(null);
        await loadAddresses();
        setFeedback({ type: 'success', message: t('addresses.addedSuccess') });
      }
    } catch (err) {
      const msg = err?.response?.data?.error || t('addresses.saveError');
      setFeedback({ type: 'error', message: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (id) => {
    try {
      await addressesApi.setDefault(id);
      setFeedback({ type: 'success', message: t('addresses.defaultUpdatedSuccess') });
      await loadAddresses();
    } catch {
      setFeedback({ type: 'error', message: t('addresses.defaultUpdateError') });
    }
  };

  const handleDelete = async (id) => {
    try {
      await addressesApi.delete(id);
      setFeedback({ type: 'success', message: t('addresses.deletedSuccess') });
      await loadAddresses();
    } catch {
      setFeedback({ type: 'error', message: t('addresses.deleteError') });
    }
  };

  return (
    <main className="min-h-screen flex flex-col justify-between bg-canvas">
      <SiteHeader />

      <div className="w-full container-main pt-[72px] flex-1" data-testid="addresses-page">
        <div className="pt-6 pb-12 md:pb-16">
          {/* Account Navigation Tabs */}
          <div
            data-testid="account-nav-tabs"
            className="flex flex-wrap items-center gap-2 pb-6 mb-8 border-b border-border"
          >
            <Link
              href="/account/profile"
              className="px-4 py-2 rounded-xl border border-border bg-surface text-small font-medium text-secondary hover:text-ink transition-colors"
            >
              {t('addresses.tabProfileSecurity')}
            </Link>
            <Link
              href="/account/addresses"
              className="px-4 py-2 rounded-xl border border-primary bg-primary text-primary-foreground text-small font-medium transition-colors"
            >
              {t('addresses.tabDeliveryAddresses')}
            </Link>
            <Link
              href="/account/orders"
              className="px-4 py-2 rounded-xl border border-border bg-surface text-small font-medium text-secondary hover:text-ink transition-colors"
            >
              {t('addresses.tabOrderHistory')}
            </Link>
          </div>

        {authStatus === 'signed-out' ? (
          <div className="bg-surface border border-border rounded-2xl p-10 max-w-xl">
            <h1 className="text-h2 mb-2">{t('addresses.signInTitle')}</h1>
            <p className="text-small text-secondary mb-6">{t('addresses.signInDesc')}</p>
            <Link
              href="/login?next=%2Faccount%2Faddresses"
              className="inline-flex items-center px-6 py-3 rounded-xl bg-primary text-primary-foreground text-small font-medium"
            >
              {t('addresses.signInBtn')}
            </Link>
          </div>
        ) : (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <span className="text-caption font-mono uppercase tracking-wider text-secondary">
                  {t('addresses.eyebrow')}
                </span>
                <h1 className="text-h1 mt-1">{t('addresses.title')}</h1>
                <p className="text-small text-secondary mt-1">{t('addresses.subtitle')}</p>
              </div>

              <button
                type="button"
                onClick={handleOpenCreate}
                data-testid="add-address-button"
                className="inline-flex items-center gap-2 px-5 h-11 rounded-xl bg-primary text-primary-foreground text-small font-medium hover:bg-primary/90 btn-interactive self-start sm:self-auto"
              >
                <Plus size={16} />
                <span>{t('addresses.addNewBtn')}</span>
              </button>
            </div>

            {feedback && (
              <div
                data-testid="address-feedback"
                className={`mb-6 p-4 rounded-xl border text-small animate-slide-up ${
                  feedback.type === 'success'
                    ? 'bg-success/10 border-success/30 text-success'
                    : 'bg-danger/10 border-danger/30 text-danger'
                }`}
              >
                {feedback.message}
              </div>
            )}

            {/* Create / Edit Address Form */}
            {showForm && (
              <form
                onSubmit={handleSubmit}
                data-testid="address-form"
                className="bg-surface border border-border rounded-2xl p-6 mb-8 space-y-4 max-w-2xl animate-slide-up shadow-sm"
              >
                <h2 className="text-h3">
                  {editingId ? t('addresses.editFormTitle') : t('addresses.newFormTitle')}
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="address-fullname-input"
                      className="block text-caption font-mono uppercase tracking-wider text-secondary mb-1.5"
                    >
                      {t('addresses.recipientNameLabel')}
                    </label>
                    <input
                      id="address-fullname-input"
                      type="text"
                      required
                      value={formData.fullName}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, fullName: e.target.value }))
                      }
                      data-testid="address-fullname-input"
                      className="w-full h-11 px-3.5 rounded-xl border border-border bg-canvas text-small text-ink focus-ring"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="address-phone-input"
                      className="block text-caption font-mono uppercase tracking-wider text-secondary mb-1.5"
                    >
                      {t('addresses.phoneLabel')}
                    </label>
                    <input
                      id="address-phone-input"
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, phone: e.target.value }))
                      }
                      data-testid="address-phone-input"
                      className="w-full h-11 px-3.5 rounded-xl border border-border bg-canvas text-small text-ink focus-ring"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="address-street-input"
                    className="block text-caption font-mono uppercase tracking-wider text-secondary mb-1.5"
                  >
                    {t('addresses.streetAddressLabel')}
                  </label>
                  <input
                    id="address-street-input"
                    type="text"
                    required
                    value={formData.address}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, address: e.target.value }))
                    }
                    placeholder={t('addresses.streetAddressPlaceholder')}
                    data-testid="address-street-input"
                    className="w-full h-11 px-3.5 rounded-xl border border-border bg-canvas text-small text-ink focus-ring"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label
                      htmlFor="address-ward-input"
                      className="block text-caption font-mono uppercase tracking-wider text-secondary mb-1.5"
                    >
                      {t('addresses.wardLabel')}
                    </label>
                    <input
                      id="address-ward-input"
                      type="text"
                      value={formData.ward}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, ward: e.target.value }))
                      }
                      className="w-full h-11 px-3.5 rounded-xl border border-border bg-canvas text-small text-ink focus-ring"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="address-district-input"
                      className="block text-caption font-mono uppercase tracking-wider text-secondary mb-1.5"
                    >
                      {t('addresses.districtLabel')}
                    </label>
                    <input
                      id="address-district-input"
                      type="text"
                      value={formData.district}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, district: e.target.value }))
                      }
                      className="w-full h-11 px-3.5 rounded-xl border border-border bg-canvas text-small text-ink focus-ring"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="address-city-input"
                      className="block text-caption font-mono uppercase tracking-wider text-secondary mb-1.5"
                    >
                      {t('addresses.cityLabel')}
                    </label>
                    <input
                      id="address-city-input"
                      type="text"
                      required
                      value={formData.city}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, city: e.target.value }))
                      }
                      data-testid="address-city-input"
                      className="w-full h-11 px-3.5 rounded-xl border border-border bg-canvas text-small text-ink focus-ring"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer text-small text-ink pt-1">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, isDefault: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-border text-ink"
                  />
                  <span>{t('addresses.setDefaultCheckbox')}</span>
                </label>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    data-testid="address-save-button"
                    className="px-6 h-11 rounded-xl bg-primary text-primary-foreground text-small font-medium hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saving
                      ? t('addresses.saving')
                      : editingId
                      ? t('addresses.saveChangesBtn')
                      : t('addresses.saveAddressBtn')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingId(null);
                    }}
                    className="px-5 h-11 rounded-xl border border-border bg-surface text-small font-medium text-ink hover:bg-canvas"
                  >
                    {t('addresses.cancelBtn')}
                  </button>
                </div>
              </form>
            )}

            {/* Addresses List */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2].map((n) => (
                  <div
                    key={n}
                    className="h-44 rounded-2xl bg-surface border border-border animate-pulse"
                  />
                ))}
              </div>
            ) : addresses.length === 0 ? (
              <div className="bg-surface border border-border rounded-2xl p-12 text-center">
                <MapPin size={28} className="mx-auto text-secondary mb-3" />
                <h2 className="text-h3 mb-1">{t('addresses.emptyTitle')}</h2>
                <p className="text-small text-secondary mb-6">{t('addresses.emptyDesc')}</p>
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-small font-medium"
                >
                  <Plus size={16} />
                  {t('addresses.addFirstBtn')}
                </button>
              </div>
            ) : (
              <div
                data-testid="addresses-list"
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                {addresses.map((addr) => (
                  <article
                    key={addr.id}
                    data-testid="address-card"
                    className={`bg-surface rounded-2xl border p-6 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-md animate-slide-up ${
                      addr.isDefault ? 'border-ink ring-1 ring-ink/10' : 'border-border hover:border-ink/30'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-display font-medium text-ink">
                            {addr.fullName}
                          </h3>
                          <p className="text-small font-mono text-secondary mt-0.5">
                            {addr.phone}
                          </p>
                        </div>
                        {addr.isDefault && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-[11px] font-mono uppercase tracking-wider">
                            <Check size={11} />
                            {t('addresses.defaultBadge')}
                          </span>
                        )}
                      </div>

                      <p className="text-small text-ink/90 mt-4 leading-relaxed">
                        {[addr.address, addr.ward, addr.district, addr.city]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(addr)}
                          data-testid={`edit-address-${addr.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-caption font-medium text-ink hover:bg-canvas"
                        >
                          <Pencil size={12} />
                          {t('addresses.editBtn')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(addr.id)}
                          data-testid={`delete-address-${addr.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-caption font-medium text-secondary hover:text-danger hover:bg-canvas"
                        >
                          <Trash2 size={12} />
                          {t('addresses.deleteBtn')}
                        </button>
                      </div>

                      {!addr.isDefault && (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(addr.id)}
                          data-testid={`default-address-${addr.id}`}
                          className="inline-flex items-center gap-1 text-caption font-medium text-secondary hover:text-ink"
                        >
                          <Star size={12} />
                          {t('addresses.setDefaultBtn')}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
