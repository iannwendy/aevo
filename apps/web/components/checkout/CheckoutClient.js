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

const STEPS = [
  { id: 1, key: 'information', label: '1. Information' },
  { id: 2, key: 'shipping-address', label: '2. Address' },
  { id: 3, key: 'shipping-method', label: '3. Shipping' },
  { id: 4, key: 'payment', label: '4. Payment' },
  { id: 5, key: 'review', label: '5. Review' },
];

const PAYMENT_OPTIONS = [
  {
    value: 'cod',
    title: 'Cash on Delivery (COD)',
    description: 'Pay in cash upon hardware inspection and delivery.',
  },
  {
    value: 'bank_transfer',
    title: 'Instant Bank Transfer (VietQR)',
    description: 'Direct interbank transfer with order number reference.',
  },
  {
    value: 'card',
    title: 'Credit / Debit Card',
    description: 'Visa, Mastercard, or JCB with 3D Secure verification.',
  },
  {
    value: 'momo',
    title: 'MoMo E-Wallet',
    description: 'Fast digital wallet payment via MoMo QR.',
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
  const [ward, setWard] = useState(defaultAddr?.ward || '');
  const [district, setDistrict] = useState(defaultAddr?.district || '');
  const [city, setCity] = useState(defaultAddr?.city || 'Ho Chi Minh City');

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
            setSelectedAddressId((prev) => prev || def.id);
            setPhone((prev) => prev || def.phone || '');
            setAddress((prev) => prev || def.address || '');
            setWard((prev) => prev || def.ward || '');
            setDistrict((prev) => prev || def.district || '');
            setCity((prev) => prev || def.city || 'Ho Chi Minh City');
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
    setSelectedAddressId(addr.id);
    setFullName(addr.fullName || user?.fullName || '');
    setPhone(addr.phone || '');
    setAddress(addr.address || '');
    setWard(addr.ward || '');
    setDistrict(addr.district || '');
    setCity(addr.city || 'Ho Chi Minh City');
  };

  // Financial calculations
  const items = cart?.items || [];
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

  const estimatedEarnedPoints = Math.floor(
    Math.max(0, afterDiscount - loyaltyDiscount) / 10000
  );

  // Discount validation handler
  const handleApplyDiscount = async (e) => {
    if (e) e.preventDefault();
    const clean = discountInput.trim().toUpperCase();
    if (!clean) {
      setDiscountFeedback({ type: 'error', message: 'Please enter a 5-character discount code.' });
      return;
    }

    setValidatingDiscount(true);
    setDiscountFeedback(null);
    try {
      const res = await discountsApi.validate(clean, { subtotal });
      setAppliedDiscount(res.data);
      setDiscountFeedback({
        type: 'success',
        message: `Code ${res.data.code} applied (${res.data.remainingUses} uses remaining).`,
      });
    } catch (err) {
      setAppliedDiscount(null);
      const msg = err?.response?.data?.error || 'Invalid discount code.';
      setDiscountFeedback({ type: 'error', message: msg });
    } finally {
      setValidatingDiscount(false);
    }
  };

  // Loyalty points handler
  const handleApplyPoints = (e) => {
    if (e) e.preventDefault();
    if (!user) {
      setPointsFeedback({ type: 'error', message: 'Please sign in to redeem loyalty points.' });
      return;
    }
    const pts = parseInt(pointsInput, 10);
    if (Number.isNaN(pts) || pts < 0) {
      setPointsFeedback({ type: 'error', message: 'Enter a valid number of points.' });
      return;
    }
    const available = user.loyaltyPoints || 0;
    if (pts > available) {
      setPointsFeedback({
        type: 'error',
        message: `You only have ${available} loyalty points available.`,
      });
      return;
    }
    setAppliedPoints(pts);
    setPointsFeedback({
      type: 'success',
      message:
        pts > 0
          ? `Redeemed ${pts} points (-${formatPrice(pts * POINT_VALUE)}).`
          : 'Loyalty points cleared.',
    });
  };

  // Step validation before advancing
  const handleNextStep = () => {
    setStepError(null);
    if (step === 1) {
      if (!email.trim() || !email.includes('@')) {
        setStepError('Please enter a valid contact email address.');
        return;
      }
      if (!fullName.trim()) {
        setStepError('Please enter the recipient full name.');
        return;
      }
      if (!phone.trim()) {
        setStepError('Please enter a contact phone number.');
        return;
      }
    } else if (step === 2) {
      if (!address.trim() || !city.trim()) {
        setStepError('Please enter your street address and city.');
        return;
      }
    }
    setStep((s) => Math.min(5, s + 1));
  };

  const handlePlaceOrder = async () => {
    setStepError(null);
    if (!email.trim() || !fullName.trim() || !phone.trim() || !address.trim()) {
      setStepError('Please complete your contact and shipping address details.');
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
        err?.response?.data?.error || 'Could not place order. Please check your details.';
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
            CART
          </Link>
          <span className="mx-2">/</span>
          <span className="text-ink">CHECKOUT</span>
        </nav>

        <div className="pb-8 border-b border-border flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-h1">Complete your order.</h1>
            <p className="text-body text-secondary mt-1">
              {user
                ? `Signed in as ${user.fullName} (${user.email})`
                : 'Guest checkout — an account will be automatically created or linked for your email.'}
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
                  className={`px-3 py-1.5 rounded-lg text-caption font-mono transition-colors ${
                    isCurrent
                      ? 'bg-ink text-white font-medium'
                      : isCompleted
                      ? 'bg-sage/15 text-sage font-medium'
                      : 'bg-surface border border-border text-secondary'
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {stepError && (
          <div
            data-testid="checkout-error"
            className="mt-6 p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 text-small"
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
                className="bg-surface border border-border rounded-2xl p-6 md:p-8 space-y-5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-caption font-mono uppercase tracking-wider text-secondary">
                      Step 1 of 5
                    </span>
                    <h2 className="text-h2 mt-1">Contact Information</h2>
                  </div>
                  {!user && (
                    <Link
                      href="/login?next=%2Fcheckout"
                      className="text-small font-medium text-ink underline underline-offset-4"
                    >
                      Already have an account? Sign in
                    </Link>
                  )}
                </div>

                {user && (
                  <div
                    data-testid="checkout-logged-in-banner"
                    className="p-3.5 rounded-xl bg-sage/10 border border-sage/30 text-small text-sage flex items-center gap-2.5"
                  >
                    <UserCheck size={17} />
                    <span>
                      Your profile and default delivery address have been pre-filled.
                    </span>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="checkout-email"
                      className="block text-caption font-mono uppercase tracking-wider text-secondary mb-1.5"
                    >
                      Email Address (for order confirmation &amp; tracking) *
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
                        Recipient Full Name *
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
                        Phone Number *
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
                    className="h-12 px-6 rounded-xl bg-ink text-white font-medium text-small hover:bg-ink/90 inline-flex items-center gap-2 transition-colors"
                  >
                    <span>Continue to shipping address</span>
                    <ArrowRight size={17} />
                  </button>
                </div>
              </section>
            )}

            {/* STEP 2: Shipping Address */}
            {step === 2 && (
              <section
                data-testid="checkout-step-2"
                className="bg-surface border border-border rounded-2xl p-6 md:p-8 space-y-5"
              >
                <div>
                  <span className="text-caption font-mono uppercase tracking-wider text-secondary">
                    Step 2 of 5
                  </span>
                  <h2 className="text-h2 mt-1">Shipping Address</h2>
                </div>

                {/* Saved Addresses Selector for Logged-in Users */}
                {user?.addresses?.length > 0 && (
                  <div data-testid="saved-addresses-selector" className="space-y-2.5">
                    <label className="block text-caption font-mono uppercase tracking-wider text-secondary">
                      Saved Delivery Addresses
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
                            className={`p-3.5 rounded-xl border text-left transition-all ${
                              isSelected
                                ? 'border-ink bg-canvas ring-1 ring-ink'
                                : 'border-border bg-surface hover:border-ink/40'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-small font-medium text-ink">
                                {addr.fullName}
                              </span>
                              {addr.isDefault && (
                                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-ink text-white">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="text-caption text-secondary mt-1 truncate">
                              {addr.address}, {addr.city}
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
                      Street Address *
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

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-caption font-mono uppercase tracking-wider text-secondary mb-1.5">
                        Ward
                      </label>
                      <input
                        type="text"
                        value={ward}
                        onChange={(e) => setWard(e.target.value)}
                        placeholder="Ben Thanh"
                        data-testid="checkout-ward-input"
                        className="w-full h-12 px-4 rounded-xl border border-border bg-canvas text-base text-ink focus-ring"
                      />
                    </div>
                    <div>
                      <label className="block text-caption font-mono uppercase tracking-wider text-secondary mb-1.5">
                        District
                      </label>
                      <input
                        type="text"
                        value={district}
                        onChange={(e) => setDistrict(e.target.value)}
                        placeholder="District 1"
                        data-testid="checkout-district-input"
                        className="w-full h-12 px-4 rounded-xl border border-border bg-canvas text-base text-ink focus-ring"
                      />
                    </div>
                    <div>
                      <label className="block text-caption font-mono uppercase tracking-wider text-secondary mb-1.5">
                        City / Province *
                      </label>
                      <input
                        type="text"
                        required
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Ho Chi Minh City"
                        data-testid="checkout-city-input"
                        className="w-full h-12 px-4 rounded-xl border border-border bg-canvas text-base text-ink focus-ring"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="h-11 px-5 rounded-xl border border-border bg-surface text-small font-medium text-ink inline-flex items-center gap-2"
                  >
                    <ArrowLeft size={16} />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    data-testid="checkout-continue-to-method"
                    className="h-12 px-6 rounded-xl bg-ink text-white font-medium text-small hover:bg-ink/90 inline-flex items-center gap-2"
                  >
                    <span>Continue to shipping method</span>
                    <ArrowRight size={17} />
                  </button>
                </div>
              </section>
            )}

            {/* STEP 3: Shipping Method */}
            {step === 3 && (
              <section
                data-testid="checkout-step-3"
                className="bg-surface border border-border rounded-2xl p-6 md:p-8 space-y-5"
              >
                <div>
                  <span className="text-caption font-mono uppercase tracking-wider text-secondary">
                    Step 3 of 5
                  </span>
                  <h2 className="text-h2 mt-1">Shipping Method</h2>
                </div>

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setShippingMethod('standard')}
                    data-testid="shipping-method-standard"
                    className={`w-full p-4 rounded-xl border text-left flex items-center justify-between ${
                      shippingMethod === 'standard'
                        ? 'border-ink bg-canvas ring-1 ring-ink'
                        : 'border-border bg-surface'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Truck size={18} className="text-ink" />
                      <div>
                        <p className="text-small font-medium text-ink">
                          Insured Standard Courier (2–4 business days)
                        </p>
                        <p className="text-caption text-secondary">
                          Signature required upon delivery. Free on orders over 20.000.000 ₫.
                        </p>
                      </div>
                    </div>
                    <span className="text-small font-mono font-medium text-ink">
                      {afterDiscount >= FREE_SHIPPING_THRESHOLD
                        ? 'Free'
                        : formatPrice(30000)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShippingMethod('express')}
                    data-testid="shipping-method-express"
                    className={`w-full p-4 rounded-xl border text-left flex items-center justify-between ${
                      shippingMethod === 'express'
                        ? 'border-ink bg-canvas ring-1 ring-ink'
                        : 'border-border bg-surface'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Truck size={18} className="text-ink" />
                      <div>
                        <p className="text-small font-medium text-ink">
                          Priority Same-Day / Next-Day Air
                        </p>
                        <p className="text-caption text-secondary">
                          Dedicated hardware courier. Free on orders over 20.000.000 ₫.
                        </p>
                      </div>
                    </div>
                    <span className="text-small font-mono font-medium text-ink">
                      {afterDiscount >= FREE_SHIPPING_THRESHOLD
                        ? 'Free'
                        : formatPrice(50000)}
                    </span>
                  </button>
                </div>

                <div className="pt-4 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="h-11 px-5 rounded-xl border border-border bg-surface text-small font-medium text-ink inline-flex items-center gap-2"
                  >
                    <ArrowLeft size={16} />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    data-testid="checkout-continue-to-payment"
                    className="h-12 px-6 rounded-xl bg-ink text-white font-medium text-small hover:bg-ink/90 inline-flex items-center gap-2"
                  >
                    <span>Continue to payment</span>
                    <ArrowRight size={17} />
                  </button>
                </div>
              </section>
            )}

            {/* STEP 4: Payment Method, Discount & Loyalty */}
            {step === 4 && (
              <section
                data-testid="checkout-step-4"
                className="bg-surface border border-border rounded-2xl p-6 md:p-8 space-y-6"
              >
                <div>
                  <span className="text-caption font-mono uppercase tracking-wider text-secondary">
                    Step 4 of 5
                  </span>
                  <h2 className="text-h2 mt-1">Payment Method</h2>
                </div>

                <div className="space-y-3" data-testid="payment-methods-list">
                  {PAYMENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPaymentMethod(opt.value)}
                      data-testid={`payment-method-${opt.value}`}
                      className={`w-full p-4 rounded-xl border text-left flex items-center justify-between ${
                        paymentMethod === opt.value
                          ? 'border-ink bg-canvas ring-1 ring-ink'
                          : 'border-border bg-surface'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <CreditCard size={18} className="text-ink" />
                        <div>
                          <p className="text-small font-medium text-ink">{opt.title}</p>
                          <p className="text-caption text-secondary">{opt.description}</p>
                        </div>
                      </div>
                      <span
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          paymentMethod === opt.value ? 'border-ink bg-ink' : 'border-border'
                        }`}
                      >
                        {paymentMethod === opt.value && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </span>
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-caption font-mono uppercase tracking-wider text-secondary mb-1.5">
                    Delivery Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Gate code, preferred delivery window..."
                    className="w-full p-3.5 rounded-xl border border-border bg-canvas text-small text-ink focus-ring"
                  />
                </div>

                <div className="pt-4 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="h-11 px-5 rounded-xl border border-border bg-surface text-small font-medium text-ink inline-flex items-center gap-2"
                  >
                    <ArrowLeft size={16} />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    data-testid="checkout-continue-to-review"
                    className="h-12 px-6 rounded-xl bg-ink text-white font-medium text-small hover:bg-ink/90 inline-flex items-center gap-2"
                  >
                    <span>Review order</span>
                    <ArrowRight size={17} />
                  </button>
                </div>
              </section>
            )}

            {/* STEP 5: Final Order Review & Place Order */}
            {step === 5 && (
              <section
                data-testid="checkout-step-5"
                className="bg-surface border border-border rounded-2xl p-6 md:p-8 space-y-6"
              >
                <div>
                  <span className="text-caption font-mono uppercase tracking-wider text-secondary">
                    Step 5 of 5
                  </span>
                  <h2 className="text-h2 mt-1">Review &amp; Confirm Order</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-small">
                  <div className="p-4 rounded-xl bg-canvas border border-border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-caption font-mono uppercase text-secondary">
                        Contact &amp; Recipient
                      </span>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="text-caption underline"
                      >
                        Edit
                      </button>
                    </div>
                    <p className="font-medium text-ink">{fullName}</p>
                    <p className="text-secondary">{email}</p>
                    <p className="text-secondary font-mono">{phone}</p>
                  </div>

                  <div className="p-4 rounded-xl bg-canvas border border-border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-caption font-mono uppercase text-secondary">
                        Destination &amp; Payment
                      </span>
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="text-caption underline"
                      >
                        Edit
                      </button>
                    </div>
                    <p className="font-medium text-ink">
                      {[address, ward, district, city].filter(Boolean).join(', ')}
                    </p>
                    <p className="text-secondary mt-1 uppercase font-mono text-caption">
                      Payment: {paymentMethod} · Shipping: {shippingMethod}
                    </p>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="h-11 px-5 rounded-xl border border-border bg-surface text-small font-medium text-ink inline-flex items-center gap-2"
                  >
                    <ArrowLeft size={16} />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePlaceOrder}
                    disabled={placingOrder || items.length === 0}
                    data-testid="place-order-button"
                    className="h-12 px-8 rounded-xl bg-ink text-white font-medium text-small hover:bg-ink/90 disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    <Check size={18} />
                    <span>
                      {placingOrder
                        ? 'Processing order...'
                        : `Place order — ${formatPrice(totalAmount)}`}
                    </span>
                  </button>
                </div>
              </section>
            )}
          </div>

          {/* Right Column: Order Summary + Discount Code + Loyalty Points */}
          <aside className="lg:col-span-5" data-testid="checkout-summary">
            <div className="bg-surface border border-border rounded-2xl p-6 sticky top-24 space-y-6">
              <h2 className="text-h3">Order Summary</h2>

              {/* Items List */}
              {loading ? (
                <div className="h-24 rounded-xl bg-canvas animate-pulse" />
              ) : items.length === 0 ? (
                <p className="text-small text-secondary">Your cart is currently empty.</p>
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
                  <span>Discount Code (5 characters)</span>
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
                    className="h-10 px-4 rounded-xl bg-ink text-white text-caption font-medium hover:bg-ink/90"
                  >
                    Apply
                  </button>
                </form>
                {discountFeedback && (
                  <p
                    data-testid="checkout-discount-feedback"
                    className={`mt-2 text-caption ${
                      discountFeedback.type === 'success'
                        ? 'text-emerald-700'
                        : 'text-red-600'
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
                    <span>Redeem Loyalty Points</span>
                  </label>
                  {user && (
                    <span
                      data-testid="checkout-available-points"
                      className="text-caption font-mono text-sage"
                    >
                      Available: {user.loyaltyPoints || 0} pts
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
                    placeholder={user ? '100 pts = 100.000 ₫' : 'Sign in to use points'}
                    disabled={!user}
                    data-testid="checkout-loyalty-input"
                    className="flex-1 h-10 px-3 rounded-xl border border-border bg-canvas text-small font-mono text-ink disabled:opacity-50 focus-ring"
                  />
                  <button
                    type="submit"
                    disabled={!user}
                    data-testid="checkout-apply-points"
                    className="h-10 px-4 rounded-xl border border-border bg-surface hover:bg-canvas text-caption font-medium text-ink disabled:opacity-50"
                  >
                    Redeem
                  </button>
                </form>
                {pointsFeedback && (
                  <p
                    data-testid="checkout-points-feedback"
                    className={`mt-2 text-caption ${
                      pointsFeedback.type === 'success'
                        ? 'text-emerald-700'
                        : 'text-red-600'
                    }`}
                  >
                    {pointsFeedback.message}
                  </p>
                )}
              </div>

              {/* Totals Breakdown */}
              <dl className="pt-4 border-t border-border space-y-2.5 text-small">
                <div className="flex justify-between">
                  <dt className="text-secondary">Subtotal</dt>
                  <dd data-testid="checkout-subtotal" className="font-mono text-ink">
                    {formatPrice(subtotal)}
                  </dd>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <dt>Discount ({appliedDiscount?.code})</dt>
                    <dd data-testid="checkout-discount-amount" className="font-mono">
                      -{formatPrice(discountAmount)}
                    </dd>
                  </div>
                )}

                <div className="flex justify-between">
                  <dt className="text-secondary">Shipping Fee</dt>
                  <dd data-testid="checkout-shipping" className="font-mono text-ink">
                    {shippingFee === 0 ? 'Free' : formatPrice(shippingFee)}
                  </dd>
                </div>

                <div className="flex justify-between">
                  <dt className="text-secondary">Tax (10% VAT)</dt>
                  <dd data-testid="checkout-tax" className="font-mono text-ink">
                    {formatPrice(taxAmount)}
                  </dd>
                </div>

                {loyaltyDiscount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <dt>Loyalty Points ({appliedPoints} pts)</dt>
                    <dd data-testid="checkout-loyalty-discount" className="font-mono">
                      -{formatPrice(loyaltyDiscount)}
                    </dd>
                  </div>
                )}

                <div className="pt-3 border-t border-border flex items-baseline justify-between">
                  <dt className="text-base font-medium text-ink">Total</dt>
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
                  Points earned on this order:
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
