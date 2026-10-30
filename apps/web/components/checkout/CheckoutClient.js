'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Check,
  ArrowRight,
  ArrowLeft,
  Tag,
  Sparkles,
  Truck,
  CreditCard,
  ShieldCheck,
  MapPin,
  UserCheck,
} from 'lucide-react';
import { cartApi, discountsApi, ordersApi } from '../../lib/api';
import { fetchProfile } from '../../lib/auth-client';
import { formatPrice } from '../../lib/utils';
import { useI18n } from '../../lib/i18n';
import VnAddressSelector, {
  findMatchingProvince,
  findMatchingWard,
  formatVnAddress,
} from '../address/VnAddressSelector';

const STEPS = [
  { id: 1, key: 'information', labelKey: 'checkout.step1Tab' },
  { id: 2, key: 'shipping-address', labelKey: 'checkout.step2Tab' },
  { id: 3, key: 'shipping-method', labelKey: 'checkout.step3Tab' },
  { id: 4, key: 'payment', labelKey: 'checkout.step4Tab' },
  { id: 5, key: 'review', labelKey: 'checkout.step5Tab' },
];

const PAYMENT_OPTIONS = [
  {
    value: 'cod',
    titleKey: 'checkout.codTitle',
    descKey: 'checkout.codDesc',
  },
  {
    value: 'bank_transfer',
    titleKey: 'checkout.bankTransferTitle',
    descKey: 'checkout.bankTransferDesc',
  },
  {
    value: 'card',
    titleKey: 'checkout.cardTitle',
    descKey: 'checkout.cardDesc',
  },
  {
    value: 'momo',
    titleKey: 'checkout.momoTitle',
    descKey: 'checkout.momoDesc',
  },
];

const FREE_SHIPPING_THRESHOLD = 20000000;
const POINT_VALUE = 1000;

function pickDefaultAddress(user) {
  const list = user?.addresses || [];
  return list.find((a) => a.isDefault) || list[0] || null;
}

export default function CheckoutClient({ initialUser = null, initialCart = null }) {
  const router = useRouter();
  const { t } = useI18n();
  const defaultAddr = pickDefaultAddress(initialUser);

  const [step, setStep] = useState(1);
  const [user, setUser] = useState(initialUser);
  const [cart, setCart] = useState(
    initialCart || { items: [], subtotal: 0, shippingFee: 0, taxAmount: 0, total: 0 }
  );
  const [loading, setLoading] = useState(!initialCart);

  // Step 1 & Step 2 fields (pre-filled if initialUser is provided)
  const [email, setEmail] = useState(initialUser?.email || '');
  const [fullName, setFullName] = useState(
    defaultAddr?.fullName || initialUser?.fullName || ''
  );
  const [phone, setPhone] = useState(defaultAddr?.phone || '');

  const [selectedAddressId, setSelectedAddressId] = useState(defaultAddr?.id || '');
  const [address, setAddress] = useState(defaultAddr?.address || '');
  const [ward, setWard] = useState(defaultAddr?.ward || 'Phường Bến Thành');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState(defaultAddr?.city || 'Thành phố Hồ Chí Minh');

  // Step 3: Shipping Method
  const [shippingMethod, setShippingMethod] = useState('standard');

  // Step 4: Payment, Discount Code, Loyalty Points
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [notes, setNotes] = useState('');

  const [discountInput, setDiscountInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [discountFeedback, setDiscountFeedback] = useState(null);
  const [validatingDiscount, setValidatingDiscount] = useState(false);

  const [pointsInput, setPointsInput] = useState('');
  const [appliedPoints, setAppliedPoints] = useState(0);
  const [pointsFeedback, setPointsFeedback] = useState(null);

  // Submission state
  const [stepError, setStepError] = useState(null);
  const [placingOrder, setPlacingOrder] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadCheckoutState() {
      try {
        const [profRes, cartRes] = await Promise.all([
          fetchProfile(),
          cartApi.getCart(),
        ]);
        if (!active) return;

        if (profRes.status === 'ok' && profRes.user) {
          const u = profRes.user;
          setUser(u);
          const def = pickDefaultAddress(u);
          setEmail((prev) => prev || u.email || '');
          setFullName((prev) => prev || def?.fullName || u.fullName || '');
          if (def) {
            const matchedProv = findMatchingProvince(def.city || 'Thành phố Hồ Chí Minh');
            const matchedW = findMatchingWard(matchedProv, def.ward);
            setSelectedAddressId((prev) => prev || def.id);
            setPhone((prev) => prev || def.phone || '');
            setAddress((prev) => prev || def.address || '');
            setWard((prev) => (matchedW ? matchedW.name : prev || 'Phường Bến Thành'));
            setDistrict('');
            setCity((prev) => (matchedProv ? matchedProv.name : prev || 'Thành phố Hồ Chí Minh'));
          }
        }

        if (cartRes?.data) {
          setCart(cartRes.data);
        }
      } catch (err) {
        console.error('Failed to initialize checkout:', err);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadCheckoutState();
    return () => {
      active = false;
    };
  }, []);

  const handleSelectSavedAddress = (addr) => {
    const matchedProv = findMatchingProvince(addr.city || 'Thành phố Hồ Chí Minh');
    const matchedW = findMatchingWard(matchedProv, addr.ward);
    setSelectedAddressId(addr.id);
    setFullName(addr.fullName || user?.fullName || '');
    setPhone(addr.phone || '');
    setAddress(addr.address || '');
    setWard(matchedW ? matchedW.name : 'Phường Bến Thành');
    setDistrict('');
    setCity(matchedProv ? matchedProv.name : 'Thành phố Hồ Chí Minh');
  };

  // Financial calculations
  const items = useMemo(
    () =>
      [...(cart?.items || [])].sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      ),
    [cart?.items]
  );
  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + (i.variant?.price || 0) * i.quantity, 0),
    [items]
  );

  const discountAmount = useMemo(() => {
    if (!appliedDiscount || subtotal <= 0) return 0;
    if (appliedDiscount.discountType === 'percentage') {
      return Math.round(subtotal * (appliedDiscount.discountValue / 100));
    }
    return Math.min(appliedDiscount.discountValue, subtotal);
  }, [appliedDiscount, subtotal]);

  const afterDiscount = Math.max(0, subtotal - discountAmount);

  const shippingFee = useMemo(() => {
    if (subtotal === 0) return 0;
    if (afterDiscount >= FREE_SHIPPING_THRESHOLD) return 0;
    return shippingMethod === 'express' ? 50000 : 30000;
  }, [subtotal, afterDiscount, shippingMethod]);

  const taxAmount = Math.round(afterDiscount * 0.1);

  const loyaltyDiscount = useMemo(() => {
    if (!appliedPoints || appliedPoints <= 0) return 0;
    return Math.min(appliedPoints * POINT_VALUE, afterDiscount + shippingFee + taxAmount);
  }, [appliedPoints, afterDiscount, shippingFee, taxAmount]);

  const totalAmount = Math.max(
    0,
    afterDiscount + shippingFee + taxAmount - loyaltyDiscount
  );

  const estimatedEarnedPoints = Math.floor(Math.max(0, totalAmount) / 10000);

  // Discount validation handler
  const handleApplyDiscount = async (e) => {
    if (e) e.preventDefault();
    const clean = discountInput.trim().toUpperCase();
    if (!clean) {
      setDiscountFeedback({ type: 'error', message: t('checkout.enterDiscountError') });
      return;
    }

    setValidatingDiscount(true);
    setDiscountFeedback(null);
    try {
      const res = await discountsApi.validate(clean, { subtotal });
      setAppliedDiscount(res.data);
      setDiscountFeedback({
        type: 'success',
        message: t('checkout.discountAppliedMsg', {
          code: res.data.code,
          remaining: res.data.remainingUses,
        }),
      });
    } catch (err) {
      setAppliedDiscount(null);
      const msg = err?.response?.data?.error || t('checkout.invalidDiscountError');
      setDiscountFeedback({ type: 'error', message: msg });
    } finally {
      setValidatingDiscount(false);
    }
  };

  // Loyalty points handler
  const handleApplyPoints = (e) => {
    if (e) e.preventDefault();
    if (!user) {
      setPointsFeedback({ type: 'error', message: t('checkout.signInToRedeemError') });
      return;
    }
    const pts = parseInt(pointsInput, 10);
    if (Number.isNaN(pts) || pts < 0) {
      setPointsFeedback({ type: 'error', message: t('checkout.validPointsError') });
      return;
    }
    const available = user.loyaltyPoints || 0;
    if (pts > available) {
      setPointsFeedback({
        type: 'error',
        message: t('checkout.insufficientPointsError', { available }),
      });
      return;
    }
    setAppliedPoints(pts);
    setPointsFeedback({
      type: 'success',
      message:
        pts > 0
          ? t('checkout.redeemedPointsMsg', {
              points: pts,
              amount: formatPrice(pts * POINT_VALUE),
            })
          : t('checkout.pointsClearedMsg'),
    });
  };

  // Step validation before advancing
  const handleNextStep = () => {
    setStepError(null);
    if (step === 1) {
      if (!email.trim() || !email.includes('@')) {
        setStepError(t('checkout.validEmailError'));
        return;
      }
      if (!fullName.trim()) {
        setStepError(t('checkout.recipientNameError'));
        return;
      }
      if (!phone.trim()) {
        setStepError(t('checkout.phoneError'));
        return;
      }
    } else if (step === 2) {
      if (!address.trim() || !city.trim()) {
        setStepError(t('checkout.addressCityError'));
        return;
      }
    }
    setStep((s) => Math.min(5, s + 1));
  };

  const handlePlaceOrder = async () => {
    setStepError(null);
    if (!email.trim() || !fullName.trim() || !phone.trim() || !address.trim()) {
      setStepError(t('checkout.completeDetailsError'));
      return;
    }

    setPlacingOrder(true);
    try {
      const payload = {
        shippingAddress: {
          email: email.trim(),
          fullName: fullName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          ward: ward.trim() || null,
          district: district.trim() || null,
          city: city.trim() || 'Ho Chi Minh City',
        },
        addressId: selectedAddressId || undefined,
        shippingMethod,
        paymentMethod,
        discountCode: appliedDiscount?.code || undefined,
        usedLoyaltyPoints: appliedPoints || 0,
        notes: notes.trim() || undefined,
      };

      const res = await ordersApi.create(payload);
      const createdOrder = res.data;

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('aevo:cart-updated', { detail: { count: 0 } })
        );
      }

      router.push(
        `/checkout/success?orderNumber=${encodeURIComponent(createdOrder.orderNumber)}`
      );
    } catch (err) {
      const msg =
        err?.response?.data?.error || t('checkout.placeOrderError');
      setStepError(msg);
      setPlacingOrder(false);
    }
  };

  return (
    <div className="pt-[72px]" data-testid="checkout-page">
      <div className="container-main py-10 md:py-14">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="text-caption font-mono uppercase tracking-wider text-secondary mb-4"
        >
          <Link href="/cart" className="hover:text-ink transition-colors">
            {t('checkout.breadcrumbCart')}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-ink">{t('checkout.breadcrumbCheckout')}</span>
        </nav>

        <div className="pb-8 border-b border-border flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-h1">{t('checkout.title')}</h1>
            <p className="text-body text-secondary mt-1">
              {user
                ? t('checkout.signedInAs', { name: user.fullName, email: user.email })
                : t('checkout.guestNotice')}
            </p>
          </div>

          {/* 5-Step Progress Indicator */}
          <div
            data-testid="checkout-steps-indicator"
            className="flex flex-wrap items-center gap-1.5"
          >
            {STEPS.map((s) => {
              const isCurrent = step === s.id;
              const isCompleted = step > s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    if (s.id <= step) setStep(s.id);
                  }}
                  data-testid={`checkout-step-tab-${s.id}`}
                  className={`px-3 py-1.5 rounded-lg text-caption font-mono transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${
                    isCurrent
                      ? 'bg-primary text-primary-foreground font-medium shadow-xs'
                      : isCompleted
                      ? 'bg-sage/15 text-sage font-medium'
                      : 'bg-surface border border-border text-secondary'
                  }`}
                >
                  {t(s.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        {stepError && (
          <div
            data-testid="checkout-error"
            className="mt-6 p-4 rounded-xl border border-danger/30 bg-danger/10 text-danger text-small animate-slide-up"
          >
            {stepError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pt-8">
          {/* Left Column: Multi-Step Checkout Forms */}
          <div className="lg:col-span-7 space-y-6">
            {/* STEP 1: Contact Information */}
            {step === 1 && (
              <section
                data-testid="checkout-step-1"
                className="bg-surface border border-border rounded-2xl p-6 md:p-8 space-y-5 animate-slide-up"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-caption font-mono uppercase tracking-wider text-secondary">
                      {t('checkout.stepOf', { step: 1 })}
                    </span>
                    <h2 className="text-h2 mt-1">{t('checkout.contactInfoTitle')}</h2>
                  </div>
                  {!user && (
                    <Link
                      href="/login?next=%2Fcheckout"
                      className="text-small font-medium text-ink underline underline-offset-4"
                    >
                      {t('checkout.alreadyHaveAccountSignIn')}
                    </Link>
                  )}
                </div>

                {user && (
                  <div
                    data-testid="checkout-logged-in-banner"
                    className="p-3.5 rounded-xl bg-sage/10 border border-sage/30 text-small text-sage flex items-center gap-2.5"
                  >
                    <UserCheck size={17} />
                    <span>{t('checkout.preFilledNotice')}</span>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="checkout-email"
                      className="block text-caption font-mono uppercase tracking-wider text-secondary mb-1.5"
                    >
                      {t('checkout.emailLabel')}
                    </label>
                    <input
                      id="checkout-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      data-testid="checkout-email-input"
                      className="w-full h-12 px-4 rounded-xl border border-border bg-canvas text-base text-ink focus-ring"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="checkout-fullname"
                        className="block text-caption font-mono uppercase tracking-wider text-secondary mb-1.5"
                      >
                        {t('checkout.recipientNameLabel')}
                      </label>
                      <input
                        id="checkout-fullname"
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Nguyen Van A"
                        data-testid="checkout-fullname-input"
                        className="w-full h-12 px-4 rounded-xl border border-border bg-canvas text-base text-ink focus-ring"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="checkout-phone"
                        className="block text-caption font-mono uppercase tracking-wider text-secondary mb-1.5"
                      >
                        {t('checkout.phoneLabel')}
                      </label>
                      <input
                        id="checkout-phone"
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="0901234567"
                        data-testid="checkout-phone-input"
                        className="w-full h-12 px-4 rounded-xl border border-border bg-canvas text-base text-ink focus-ring"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleNextStep}
                    data-testid="checkout-continue-to-shipping"
                    className="group h-12 px-6 rounded-xl bg-primary text-primary-foreground font-medium text-small hover:bg-primary/90 inline-flex items-center gap-2 btn-interactive"
                  >
                    <span>{t('checkout.continueToAddressBtn')}</span>
                    <ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-1" />
                  </button>
                </div>
              </section>
            )}

            {/* STEP 2: Shipping Address */}
            {step === 2 && (
              <section
                data-testid="checkout-step-2"
                className="relative z-30 bg-surface border border-border rounded-2xl p-6 md:p-8 space-y-5 animate-slide-up"
              >
                <div>
                  <span className="text-caption font-mono uppercase tracking-wider text-secondary">
                    {t('checkout.stepOf', { step: 2 })}
                  </span>
                  <h2 className="text-h2 mt-1">{t('checkout.shippingAddressTitle')}</h2>
                </div>

                {/* Saved Addresses Selector for Logged-in Users */}
                {user?.addresses?.length > 0 && (
                  <div data-testid="saved-addresses-selector" className="space-y-2.5">
                    <label className="block text-caption font-mono uppercase tracking-wider text-secondary">
                      {t('checkout.savedAddressesLabel')}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {user.addresses.map((addr) => {
                        const isSelected = selectedAddressId === addr.id;
                        return (
                          <button
                            key={addr.id}
                            type="button"
                            onClick={() => handleSelectSavedAddress(addr)}
                            data-testid={`select-saved-address-${addr.id}`}
                            className={`p-3.5 rounded-xl border text-left transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] ${
                              isSelected
                                ? 'border-ink bg-canvas ring-1 ring-ink shadow-xs'
                                : 'border-border bg-surface hover:border-ink/40'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-small font-medium text-ink">
                                {addr.fullName}
                              </span>
                              {addr.isDefault && (
                                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                                  {t('checkout.defaultBadge')}
                                </span>
                              )}
                            </div>
                            <p className="text-caption text-secondary mt-1 truncate">
                              {formatVnAddress(addr)}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="checkout-address"
                      className="block text-caption font-mono uppercase tracking-wider text-secondary mb-1.5"
                    >
                      {t('checkout.streetAddressLabel')}
                    </label>
                    <input
                      id="checkout-address"
                      type="text"
                      required
                      value={address}
                      onChange={(e) => {
                        setAddress(e.target.value);
                        setSelectedAddressId('');
                      }}
                      placeholder="123 Nguyen Trai"
                      data-testid="checkout-address-input"
                      className="w-full h-12 px-4 rounded-xl border border-border bg-canvas text-base text-ink focus-ring"
                    />
                  </div>

                  <VnAddressSelector
                    city={city}
                    ward={ward}
                    cityTestId="checkout-city-input"
                    wardTestId="checkout-ward-input"
                    onChange={({ city: nextCity, ward: nextWard }) => {
                      setCity(nextCity);
                      setWard(nextWard);
                      setDistrict('');
                      setSelectedAddressId('');
                    }}
                  />
                </div>

                <div className="pt-4 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="h-11 px-5 rounded-xl border border-border bg-surface text-small font-medium text-ink inline-flex items-center gap-2 btn-interactive"
                  >
                    <ArrowLeft size={16} />
                    <span>{t('checkout.backBtn')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    data-testid="checkout-continue-to-method"
                    className="group h-12 px-6 rounded-xl bg-primary text-primary-foreground font-medium text-small hover:bg-primary/90 inline-flex items-center gap-2 btn-interactive"
                  >
                    <span>{t('checkout.continueToMethodBtn')}</span>
                    <ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-1" />
                  </button>
                </div>
              </section>
            )}

            {/* STEP 3: Shipping Method */}
            {step === 3 && (
              <section
                data-testid="checkout-step-3"
                className="bg-surface border border-border rounded-2xl p-6 md:p-8 space-y-5 animate-slide-up"
              >
                <div>
                  <span className="text-caption font-mono uppercase tracking-wider text-secondary">
                    {t('checkout.stepOf', { step: 3 })}
                  </span>
                  <h2 className="text-h2 mt-1">{t('checkout.shippingMethodTitle')}</h2>
                </div>

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setShippingMethod('standard')}
                    data-testid="shipping-method-standard"
                    className={`w-full p-4 rounded-xl border text-left flex items-center justify-between transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] ${
                      shippingMethod === 'standard'
                        ? 'border-ink bg-canvas ring-1 ring-ink shadow-xs'
                        : 'border-border bg-surface hover:border-ink/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Truck size={18} className="text-ink" />
                      <div>
                        <p className="text-small font-medium text-ink">
                          {t('checkout.standardCourierTitle')}
                        </p>
                        <p className="text-caption text-secondary">
                          {t('checkout.standardCourierDesc')}
                        </p>
                      </div>
                    </div>
                    <span className="text-small font-mono font-medium text-ink">
                      {afterDiscount >= FREE_SHIPPING_THRESHOLD
                        ? t('checkout.free')
                        : formatPrice(30000)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShippingMethod('express')}
                    data-testid="shipping-method-express"
                    className={`w-full p-4 rounded-xl border text-left flex items-center justify-between transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] ${
                      shippingMethod === 'express'
                        ? 'border-ink bg-canvas ring-1 ring-ink shadow-xs'
                        : 'border-border bg-surface hover:border-ink/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Truck size={18} className="text-ink" />
                      <div>
                        <p className="text-small font-medium text-ink">
                          {t('checkout.expressCourierTitle')}
                        </p>
                        <p className="text-caption text-secondary">
                          {t('checkout.expressCourierDesc')}
                        </p>
                      </div>
                    </div>
                    <span className="text-small font-mono font-medium text-ink">
                      {afterDiscount >= FREE_SHIPPING_THRESHOLD
                        ? t('checkout.free')
                        : formatPrice(50000)}
                    </span>
                  </button>
                </div>

                <div className="pt-4 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="h-11 px-5 rounded-xl border border-border bg-surface text-small font-medium text-ink inline-flex items-center gap-2 btn-interactive"
                  >
                    <ArrowLeft size={16} />
                    <span>{t('checkout.backBtn')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    data-testid="checkout-continue-to-payment"
                    className="group h-12 px-6 rounded-xl bg-primary text-primary-foreground font-medium text-small hover:bg-primary/90 inline-flex items-center gap-2 btn-interactive"
                  >
                    <span>{t('checkout.continueToPaymentBtn')}</span>
                    <ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-1" />
                  </button>
                </div>
              </section>
            )}

            {/* STEP 4: Payment Method, Discount & Loyalty */}
            {step === 4 && (
              <section
                data-testid="checkout-step-4"
                className="bg-surface border border-border rounded-2xl p-6 md:p-8 space-y-6 animate-slide-up"
              >
                <div>
                  <span className="text-caption font-mono uppercase tracking-wider text-secondary">
                    {t('checkout.stepOf', { step: 4 })}
                  </span>
                  <h2 className="text-h2 mt-1">{t('checkout.paymentMethodTitle')}</h2>
                </div>

                <div className="space-y-3" data-testid="payment-methods-list">
                  {PAYMENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPaymentMethod(opt.value)}
                      data-testid={`payment-method-${opt.value}`}
                      className={`w-full p-4 rounded-xl border text-left flex items-center justify-between transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] ${
                        paymentMethod === opt.value
                          ? 'border-ink bg-canvas ring-1 ring-ink shadow-xs'
                          : 'border-border bg-surface hover:border-ink/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <CreditCard size={18} className="text-ink" />
                        <div>
                          <p className="text-small font-medium text-ink">{t(opt.titleKey)}</p>
                          <p className="text-caption text-secondary">{t(opt.descKey)}</p>
                        </div>
                      </div>
                      <span
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          paymentMethod === opt.value ? 'border-primary bg-primary' : 'border-border'
                        }`}
                      >
                        {paymentMethod === opt.value && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground animate-scale-in" />
                        )}
                      </span>
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-caption font-mono uppercase tracking-wider text-secondary mb-1.5">
                    {t('checkout.deliveryNotesLabel')}
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('checkout.deliveryNotesPlaceholder')}
                    className="w-full p-3.5 rounded-xl border border-border bg-canvas text-small text-ink focus-ring"
                  />
                </div>

                <div className="pt-4 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="h-11 px-5 rounded-xl border border-border bg-surface text-small font-medium text-ink inline-flex items-center gap-2 btn-interactive"
                  >
                    <ArrowLeft size={16} />
                    <span>{t('checkout.backBtn')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    data-testid="checkout-continue-to-review"
                    className="group h-12 px-6 rounded-xl bg-primary text-primary-foreground font-medium text-small hover:bg-primary/90 inline-flex items-center gap-2 btn-interactive"
                  >
                    <span>{t('checkout.reviewOrderBtn')}</span>
                    <ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-1" />
                  </button>
                </div>
              </section>
            )}

            {/* STEP 5: Final Order Review & Place Order */}
            {step === 5 && (
              <section
                data-testid="checkout-step-5"
                className="bg-surface border border-border rounded-2xl p-6 md:p-8 space-y-6 animate-slide-up"
              >
                <div>
                  <span className="text-caption font-mono uppercase tracking-wider text-secondary">
                    {t('checkout.stepOf', { step: 5 })}
                  </span>
                  <h2 className="text-h2 mt-1">{t('checkout.reviewConfirmTitle')}</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-small">
                  <div className="p-4 rounded-xl bg-canvas border border-border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-caption font-mono uppercase text-secondary">
                        {t('checkout.contactAndRecipient')}
                      </span>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="text-caption underline hover:text-ink transition-colors"
                      >
                        {t('checkout.editBtn')}
                      </button>
                    </div>
                    <p className="font-medium text-ink">{fullName}</p>
                    <p className="text-secondary">{email}</p>
                    <p className="text-secondary font-mono">{phone}</p>
                  </div>

                  <div className="p-4 rounded-xl bg-canvas border border-border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-caption font-mono uppercase text-secondary">
                        {t('checkout.destinationAndPayment')}
                      </span>
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="text-caption underline hover:text-ink transition-colors"
                      >
                        {t('checkout.editBtn')}
                      </button>
                    </div>
                    <p className="font-medium text-ink">
                      {formatVnAddress({ address, ward, city })}
                    </p>
                    <p className="text-secondary mt-1 uppercase font-mono text-caption">
                      {t('checkout.paymentSummaryLine', {
                        payment: paymentMethod,
                        shipping: shippingMethod,
                      })}
                    </p>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="h-11 px-5 rounded-xl border border-border bg-surface text-small font-medium text-ink inline-flex items-center gap-2 btn-interactive"
                  >
                    <ArrowLeft size={16} />
                    <span>{t('checkout.backBtn')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePlaceOrder}
                    disabled={placingOrder || items.length === 0}
                    data-testid="place-order-button"
                    className="h-12 px-8 rounded-xl bg-primary text-primary-foreground font-medium text-small hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2 btn-interactive"
                  >
                    <Check size={18} />
                    <span>
                      {placingOrder
                        ? t('checkout.processingOrder')
                        : t('checkout.placeOrderPrice', { price: formatPrice(totalAmount) })}
                    </span>
                  </button>
                </div>
              </section>
            )}
          </div>

          {/* Right Column: Order Summary + Discount Code + Loyalty Points */}
          <aside className="lg:col-span-5" data-testid="checkout-summary">
            <div className="bg-surface border border-border rounded-2xl p-6 sticky top-24 space-y-6">
              <h2 className="text-h3">{t('checkout.orderSummaryTitle')}</h2>

              {/* Items List */}
              {loading ? (
                <div className="h-24 rounded-xl bg-canvas animate-pulse" />
              ) : items.length === 0 ? (
                <p className="text-small text-secondary">{t('checkout.emptyCartNotice')}</p>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1 divide-y divide-border/60">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="pt-3 first:pt-0 flex items-center justify-between gap-3 text-small"
                    >
                      <div>
                        <p className="font-medium text-ink">
                          {item.variant?.product?.name}
                        </p>
                        <p className="text-caption text-secondary">
                          {item.variant?.name} × {item.quantity}
                        </p>
                      </div>
                      <span className="font-mono text-ink shrink-0">
                        {formatPrice((item.variant?.price || 0) * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Discount Code Input (5-char alphanumeric) */}
              <div className="pt-4 border-t border-border">
                <label
                  htmlFor="checkout-discount-input"
                  className="flex items-center gap-1.5 text-caption font-mono uppercase tracking-wider text-secondary mb-2"
                >
                  <Tag size={12} />
                  <span>{t('checkout.discountCodeLabel')}</span>
                </label>
                <form onSubmit={handleApplyDiscount} className="flex gap-2">
                  <input
                    id="checkout-discount-input"
                    type="text"
                    maxLength={5}
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value.toUpperCase())}
                    placeholder="e.g., AEV10"
                    data-testid="checkout-discount-input"
                    className="flex-1 h-10 px-3 rounded-xl border border-border bg-canvas text-small font-mono uppercase text-ink focus-ring"
                  />
                  <button
                    type="submit"
                    disabled={validatingDiscount}
                    data-testid="checkout-apply-discount"
                    className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-caption font-medium hover:bg-primary/90 btn-interactive"
                  >
                    {t('checkout.applyBtn')}
                  </button>
                </form>
                {discountFeedback && (
                  <p
                    data-testid="checkout-discount-feedback"
                    className={`mt-2 text-caption animate-slide-up ${
                      discountFeedback.type === 'success'
                        ? 'text-success'
                        : 'text-danger'
                    }`}
                  >
                    {discountFeedback.message}
                  </p>
                )}
              </div>

              {/* Loyalty Points Input (100 points = 100,000 VND) */}
              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="checkout-loyalty-input"
                    className="flex items-center gap-1.5 text-caption font-mono uppercase tracking-wider text-secondary"
                  >
                    <Sparkles size={12} />
                    <span>{t('checkout.redeemLoyaltyLabel')}</span>
                  </label>
                  {user && (
                    <span
                      data-testid="checkout-available-points"
                      className="text-caption font-mono text-sage"
                    >
                      {t('checkout.availablePts', { points: user.loyaltyPoints || 0 })}
                    </span>
                  )}
                </div>
                <form onSubmit={handleApplyPoints} className="flex gap-2">
                  <input
                    id="checkout-loyalty-input"
                    type="number"
                    min="0"
                    step="10"
                    value={pointsInput}
                    onChange={(e) => setPointsInput(e.target.value)}
                    placeholder={
                      user
                        ? t('checkout.pointsPlaceholderUser')
                        : t('checkout.pointsPlaceholderGuest')
                    }
                    disabled={!user}
                    data-testid="checkout-loyalty-input"
                    className="flex-1 h-10 px-3 rounded-xl border border-border bg-canvas text-small font-mono text-ink disabled:opacity-50 focus-ring"
                  />
                  <button
                    type="submit"
                    disabled={!user}
                    data-testid="checkout-apply-points"
                    className="h-10 px-4 rounded-xl border border-border bg-surface hover:bg-canvas text-caption font-medium text-ink disabled:opacity-50 btn-interactive"
                  >
                    {t('checkout.redeemBtn')}
                  </button>
                </form>
                {pointsFeedback && (
                  <p
                    data-testid="checkout-points-feedback"
                    className={`mt-2 text-caption animate-slide-up ${
                      pointsFeedback.type === 'success'
                        ? 'text-success'
                        : 'text-danger'
                    }`}
                  >
                    {pointsFeedback.message}
                  </p>
                )}
              </div>

              {/* Totals Breakdown */}
              <dl className="pt-4 border-t border-border space-y-2.5 text-small">
                <div className="flex justify-between">
                  <dt className="text-secondary">{t('checkout.subtotal')}</dt>
                  <dd data-testid="checkout-subtotal" className="font-mono text-ink">
                    {formatPrice(subtotal)}
                  </dd>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-success">
                    <dt>{t('checkout.discountWithCode', { code: appliedDiscount?.code })}</dt>
                    <dd data-testid="checkout-discount-amount" className="font-mono">
                      -{formatPrice(discountAmount)}
                    </dd>
                  </div>
                )}

                <div className="flex justify-between">
                  <dt className="text-secondary">{t('checkout.shippingFee')}</dt>
                  <dd data-testid="checkout-shipping" className="font-mono text-ink">
                    {shippingFee === 0 ? t('checkout.free') : formatPrice(shippingFee)}
                  </dd>
                </div>

                <div className="flex justify-between">
                  <dt className="text-secondary">{t('checkout.taxVat')}</dt>
                  <dd data-testid="checkout-tax" className="font-mono text-ink">
                    {formatPrice(taxAmount)}
                  </dd>
                </div>

                {loyaltyDiscount > 0 && (
                  <div className="flex justify-between text-success">
                    <dt>{t('checkout.loyaltyPointsWithCount', { points: appliedPoints })}</dt>
                    <dd data-testid="checkout-loyalty-discount" className="font-mono">
                      -{formatPrice(loyaltyDiscount)}
                    </dd>
                  </div>
                )}

                <div className="pt-3 border-t border-border flex items-baseline justify-between">
                  <dt className="text-base font-medium text-ink">{t('checkout.total')}</dt>
                  <dd
                    data-testid="checkout-total"
                    className="text-2xl font-display font-medium text-ink"
                  >
                    {formatPrice(totalAmount)}
                  </dd>
                </div>
              </dl>

              <div className="p-3 rounded-xl bg-canvas border border-border text-caption text-secondary flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-ink" />
                  {t('checkout.pointsEarnedNotice')}
                </span>
                <strong className="font-mono text-ink">+{estimatedEarnedPoints} pts</strong>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
