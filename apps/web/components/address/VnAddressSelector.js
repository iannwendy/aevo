'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import {
  MapPin,
  ChevronDown,
  Search,
  Check,
  X,
  Building2,
  Navigation,
} from 'lucide-react';
import vnAdminUnits from '../../lib/vn-admin-units.json';
import { useI18n } from '../../lib/i18n';

const MAJOR_CITY_CODES = new Set(['79', '01', '48', '31', '92', '46']);

function normalizeSearchText(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findMatchingProvince(cityValue) {
  if (!cityValue) return null;
  const norm = normalizeSearchText(cityValue);
  if (!norm) return null;

  // Exact match on full name, English full name, or short name
  const exact = vnAdminUnits.find(
    (p) =>
      normalizeSearchText(p.name) === norm ||
      normalizeSearchText(p.nameEn) === norm ||
      normalizeSearchText(p.shortName) === norm ||
      normalizeSearchText(p.shortNameEn) === norm
  );
  if (exact) return exact;

  // Common aliases
  if (norm === 'hcm' || norm === 'tp hcm' || norm === 'tphcm' || norm === 'sai gon') {
    return vnAdminUnits.find((p) => p.code === '79') || null;
  }
  if (norm === 'hn' || norm === 'tp hn' || norm === 'hanoi') {
    return vnAdminUnits.find((p) => p.code === '01') || null;
  }

  return (
    vnAdminUnits.find(
      (p) =>
        normalizeSearchText(p.name).includes(norm) ||
        normalizeSearchText(p.nameEn).includes(norm) ||
        (norm.length >= 4 && norm.includes(normalizeSearchText(p.shortName)))
    ) || null
  );
}

export function findMatchingWard(province, wardValue) {
  if (!province || !wardValue) return null;
  const norm = normalizeSearchText(wardValue);
  if (!norm) return null;

  const wards = province.wards || [];
  const exact = wards.find(
    (w) =>
      normalizeSearchText(w.name) === norm ||
      normalizeSearchText(w.nameEn) === norm ||
      normalizeSearchText(w.shortName) === norm ||
      normalizeSearchText(w.shortNameEn) === norm
  );
  if (exact) return exact;

  // Only allow substring match if query is at least 3 chars and matches a whole word or prefix
  if (norm.length < 3) return null;
  return (
    wards.find(
      (w) =>
        normalizeSearchText(w.name).includes(norm) ||
        normalizeSearchText(w.nameEn).includes(norm)
    ) || null
  );
}

/**
 * Formats an address object cleanly according to Vietnam's 2-tier administrative model
 * (Street Address, Ward/Commune/Special Zone, Province/City), ignoring abolished district
 * or invalid legacy placeholder strings.
 */
export function formatVnAddress(addr, separator = ', ') {
  if (!addr) return '';
  const street = String(addr.address || '').trim();
  const matchedProvince = findMatchingProvince(addr.city);
  const matchedWard = findMatchingWard(matchedProvince, addr.ward);

  const validWard = matchedWard ? matchedWard.name : '';
  const validCity = matchedProvince
    ? matchedProvince.name
    : String(addr.city || '').trim();

  return [street, validWard, validCity].filter(Boolean).join(separator);
}

/**
 * Reusable Vietnam New Administrative Units (2-Tier: 34 Provinces/Cities & 3,321 Wards/Communes/Special Zones)
 * Popover Selector Component with built-in Search Input + Search Button.
 */
export default function VnAddressSelector({
  city = '',
  ward = '',
  onChange,
  cityTestId = 'address-city-input',
  wardTestId = 'address-ward-input',
  disabled = false,
  className = '',
}) {
  const { locale, t } = useI18n();
  const containerRef = useRef(null);
  const provinceSearchInputRef = useRef(null);
  const wardSearchInputRef = useRef(null);

  // 'province' | 'ward' | null
  const [openDropdown, setOpenDropdown] = useState(null);

  // Search states for Province & Ward dropdowns
  const [provinceQuery, setProvinceQuery] = useState('');
  const [committedProvinceQuery, setCommittedProvinceQuery] = useState('');

  const [wardQuery, setWardQuery] = useState('');
  const [committedWardQuery, setCommittedWardQuery] = useState('');
  const [wardUnitFilter, setWardUnitFilter] = useState('ALL'); // 'ALL' | 'Phường' | 'Xã' | 'Đặc khu'

  const selectedProvince = useMemo(() => findMatchingProvince(city), [city]);
  const selectedWard = useMemo(
    () => findMatchingWard(selectedProvince, ward),
    [selectedProvince, ward]
  );

  // Automatically sanitize legacy/invalid city or ward values when mounted or loaded
  useEffect(() => {
    if (!onChange) return;
    const normalizedCity = selectedProvince ? selectedProvince.name : city;
    const normalizedWard = selectedWard ? selectedWard.name : '';
    if (
      (selectedProvince && city !== normalizedCity) ||
      (ward && !selectedWard)
    ) {
      onChange({
        city: normalizedCity || 'Thành phố Hồ Chí Minh',
        ward: normalizedWard,
        district: '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, ward, selectedProvince, selectedWard]);

  // Elevate ancestor stacking contexts while dropdown is open so sibling cards with animations/transforms never overlap
  useEffect(() => {
    if (!openDropdown || !containerRef.current) return;
    const modifiedAncestors = [];
    let el = containerRef.current.parentElement;
    while (el && el !== document.body) {
      const style = window.getComputedStyle(el);
      if (
        style.transform !== 'none' ||
        style.animationName !== 'none' ||
        el.tagName === 'FORM' ||
        el.tagName === 'SECTION'
      ) {
        modifiedAncestors.push({
          el,
          prevPosition: el.style.position,
          prevZIndex: el.style.zIndex,
        });
        if (style.position === 'static') {
          el.style.position = 'relative';
        }
        el.style.zIndex = '50';
      }
      el = el.parentElement;
    }

    return () => {
      for (const item of modifiedAncestors) {
        item.el.style.position = item.prevPosition;
        item.el.style.zIndex = item.prevZIndex;
      }
    };
  }, [openDropdown]);

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    if (!openDropdown) return;

    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setOpenDropdown(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openDropdown]);

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (openDropdown === 'province') {
      setTimeout(() => {
        provinceSearchInputRef.current?.focus();
      }, 30);
    } else if (openDropdown === 'ward') {
      setTimeout(() => {
        wardSearchInputRef.current?.focus();
      }, 30);
    }
  }, [openDropdown]);

  // Filtered provinces
  const activeProvinceSearch = normalizeSearchText(
    provinceQuery || committedProvinceQuery
  );

  const filteredProvinces = useMemo(() => {
    if (!activeProvinceSearch) return vnAdminUnits;
    return vnAdminUnits.filter((p) => {
      const hay = normalizeSearchText(
        `${p.name} ${p.nameEn} ${p.shortName} ${p.shortNameEn} ${p.code}`
      );
      if (
        (activeProvinceSearch === 'hcm' ||
          activeProvinceSearch === 'tphcm' ||
          activeProvinceSearch === 'sai gon') &&
        p.code === '79'
      ) {
        return true;
      }
      if (activeProvinceSearch === 'hn' && p.code === '01') {
        return true;
      }
      return hay.includes(activeProvinceSearch);
    });
  }, [activeProvinceSearch]);

  // Available wards (either for selected province, or nationwide if no province selected)
  const availableWards = useMemo(() => {
    if (selectedProvince) {
      return (selectedProvince.wards || []).map((w) => ({
        ...w,
        provinceName: selectedProvince.name,
        provinceNameEn: selectedProvince.nameEn,
      }));
    }
    const all = [];
    for (const p of vnAdminUnits) {
      for (const w of p.wards || []) {
        all.push({
          ...w,
          provinceName: p.name,
          provinceNameEn: p.nameEn,
        });
      }
    }
    return all;
  }, [selectedProvince]);

  const activeWardSearch = normalizeSearchText(wardQuery || committedWardQuery);

  const filteredWards = useMemo(() => {
    let list = availableWards;
    if (wardUnitFilter !== 'ALL') {
      list = list.filter((w) => w.unit === wardUnitFilter);
    }
    if (!activeWardSearch) {
      return selectedProvince ? list : list.slice(0, 100);
    }
    const matches = list.filter((w) => {
      const hay = normalizeSearchText(
        `${w.name} ${w.nameEn} ${w.shortName} ${w.shortNameEn} ${w.provinceName || ''}`
      );
      return hay.includes(activeWardSearch);
    });
    return selectedProvince ? matches : matches.slice(0, 120);
  }, [availableWards, wardUnitFilter, activeWardSearch, selectedProvince]);

  const unitCounts = useMemo(() => {
    const wards = selectedProvince?.wards || [];
    return {
      all: wards.length,
      phuong: wards.filter((w) => w.unit === 'Phường').length,
      xa: wards.filter((w) => w.unit === 'Xã').length,
      dacKhu: wards.filter((w) => w.unit === 'Đặc khu').length,
    };
  }, [selectedProvince]);

  const handleSelectProvince = (province) => {
    const isSameProvince = selectedProvince?.code === province.code;
    const nextWard = isSameProvince && selectedWard ? selectedWard.name : '';
    onChange?.({
      city: province.name,
      ward: nextWard,
      district: '',
    });
    setProvinceQuery('');
    setCommittedProvinceQuery('');
    setWardQuery('');
    setCommittedWardQuery('');
    setWardUnitFilter('ALL');
    // Immediately open Ward selector so user can pick their Ward right away
    setOpenDropdown('ward');
  };

  const handleSelectWard = (wardItem) => {
    const nextCity = wardItem.provinceName || selectedProvince?.name || city;
    onChange?.({
      city: nextCity,
      ward: wardItem.name,
      district: '',
    });
    setWardQuery('');
    setCommittedWardQuery('');
    setOpenDropdown(null);
  };

  const handleTriggerProvinceSearch = (e) => {
    if (e) e.preventDefault();
    setCommittedProvinceQuery(provinceQuery);
    provinceSearchInputRef.current?.focus();
  };

  const handleTriggerWardSearch = (e) => {
    if (e) e.preventDefault();
    setCommittedWardQuery(wardQuery);
    wardSearchInputRef.current?.focus();
  };

  // Only show validated administrative unit names so invalid legacy text never appears
  const displayProvinceName = selectedProvince ? selectedProvince.name : '';
  const displayWardName = selectedWard ? selectedWard.name : '';

  return (
    <div
      ref={containerRef}
      className={`relative ${openDropdown ? 'z-50' : 'z-20'} space-y-2 ${className}`}
    >
      {/* Header badge indicating Vietnam 2-tier new administrative units */}
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-secondary">
          <MapPin size={12} className="text-ink shrink-0" />
          <span>{t('vnAddress.newAdminBadge')}</span>
        </span>
        {selectedProvince && (
          <span className="text-[11px] font-mono text-secondary shrink-0">
            {t('vnAddress.wardsCount', { count: selectedProvince.wards?.length || 0 })}
          </span>
        )}
      </div>

      {/* Hidden inputs for programmatic / E2E test compatibility */}
      <input
        type="text"
        tabIndex={-1}
        aria-hidden="true"
        data-testid={cityTestId}
        value={selectedProvince ? selectedProvince.name : city}
        onChange={(e) => {
          const val = e.target.value;
          const matched = findMatchingProvince(val);
          onChange?.({
            city: matched ? matched.name : val,
            ward: selectedWard ? selectedWard.name : '',
            district: '',
          });
        }}
        className="sr-only pointer-events-none"
      />
      <input
        type="text"
        tabIndex={-1}
        aria-hidden="true"
        data-testid={wardTestId}
        value={selectedWard ? selectedWard.name : ''}
        onChange={(e) => {
          const val = e.target.value;
          const matched = findMatchingWard(selectedProvince, val);
          onChange?.({
            city: selectedProvince ? selectedProvince.name : city,
            ward: matched ? matched.name : val,
            district: '',
          });
        }}
        className="sr-only pointer-events-none"
      />

      <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* ==================== 1. PROVINCE / CITY SELECTOR ==================== */}
        <div className="relative sm:static">
          <label className="block text-caption font-mono uppercase tracking-wider text-secondary mb-1.5">
            {t('vnAddress.provinceLabel')}
          </label>

          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              setOpenDropdown((prev) => (prev === 'province' ? null : 'province'))
            }
            data-testid={`${cityTestId}-trigger`}
            aria-expanded={openDropdown === 'province'}
            aria-haspopup="listbox"
            className={`w-full h-12 px-3 rounded-xl border text-left flex items-center justify-between gap-1.5 transition-all duration-150 focus-ring ${
              openDropdown === 'province'
                ? 'border-ink bg-surface ring-1 ring-ink shadow-xs'
                : 'border-border bg-canvas hover:border-ink/40'
            } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Building2
                size={15}
                className={displayProvinceName ? 'text-ink shrink-0' : 'text-secondary shrink-0'}
              />
              <span
                className={`text-[13.5px] truncate ${
                  displayProvinceName ? 'text-ink font-medium' : 'text-secondary'
                }`}
              >
                {displayProvinceName || t('vnAddress.selectProvincePlaceholder')}
              </span>
            </div>
            <ChevronDown
              size={15}
              className={`text-secondary shrink-0 transition-transform duration-200 ${
                openDropdown === 'province' ? 'rotate-180 text-ink' : ''
              }`}
            />
          </button>

          {/* Province Dropdown Popover */}
          {openDropdown === 'province' && (
            <div
              data-testid={`${cityTestId}-dropdown`}
              role="listbox"
              className="
                absolute left-0 right-0 z-[100] mt-2
                w-full
                rounded-2xl border border-border bg-surface shadow-2xl
                overflow-hidden animate-scale-in
              "
            >
              {/* Search Bar + Search Button */}
              <div className="p-3 border-b border-border bg-canvas/70 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Search
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none"
                    />
                    <input
                      ref={provinceSearchInputRef}
                      type="text"
                      value={provinceQuery}
                      onChange={(e) => {
                        setProvinceQuery(e.target.value);
                        setCommittedProvinceQuery(e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleTriggerProvinceSearch();
                          if (filteredProvinces.length === 1) {
                            handleSelectProvince(filteredProvinces[0]);
                          }
                        }
                      }}
                      placeholder={t('vnAddress.searchProvincePlaceholder')}
                      data-testid={`${cityTestId}-search-input`}
                      className="w-full h-10 pl-9 pr-8 rounded-xl border border-border bg-surface text-small text-ink placeholder:text-secondary focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink"
                    />
                    {provinceQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setProvinceQuery('');
                          setCommittedProvinceQuery('');
                          provinceSearchInputRef.current?.focus();
                        }}
                        aria-label={t('vnAddress.clearSearch')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary hover:text-ink"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleTriggerProvinceSearch}
                    data-testid={`${cityTestId}-search-btn`}
                    className="h-10 px-3.5 rounded-xl bg-primary text-primary-foreground text-caption font-medium inline-flex items-center gap-1.5 hover:bg-primary/90 shrink-0 transition-colors"
                  >
                    <Search size={13} />
                    <span>{t('vnAddress.searchBtn')}</span>
                  </button>
                </div>

                {/* Quick select chips for the 6 centrally-run cities when not searching */}
                {!activeProvinceSearch && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {vnAdminUnits
                      .filter((p) => MAJOR_CITY_CODES.has(p.code))
                      .map((p) => {
                        const active = selectedProvince?.code === p.code;
                        return (
                          <button
                            key={p.code}
                            type="button"
                            onClick={() => handleSelectProvince(p)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                              active
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-surface border-border text-ink hover:border-ink/40'
                            }`}
                          >
                            {p.shortName}
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Scrollable List of 34 Provinces */}
              <div className="max-h-64 overflow-y-auto divide-y divide-border/50 bg-surface">
                {filteredProvinces.length === 0 ? (
                  <div className="p-6 text-center text-small text-secondary">
                    {t('vnAddress.noResults')}
                  </div>
                ) : (
                  filteredProvinces.map((p) => {
                    const isSelected = selectedProvince?.code === p.code;
                    return (
                      <button
                        key={p.code}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelectProvince(p)}
                        data-testid={`province-option-${p.code}`}
                        className={`w-full px-4 py-2.5 text-left flex items-center justify-between gap-3 transition-colors ${
                          isSelected
                            ? 'bg-primary/10 text-ink font-medium'
                            : 'hover:bg-canvas text-ink'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-small truncate">{p.name}</div>
                          <div className="text-[11px] font-mono text-secondary">
                            {p.nameEn} · {p.wards?.length || 0} {locale === 'vi' ? 'đơn vị' : 'units'}
                          </div>
                        </div>
                        {isSelected && <Check size={16} className="text-ink shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* ==================== 2. WARD / COMMUNE / SPECIAL ZONE SELECTOR ==================== */}
        <div className="relative sm:static">
          <label className="block text-caption font-mono uppercase tracking-wider text-secondary mb-1.5">
            {t('vnAddress.wardLabel')}
          </label>

          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              setOpenDropdown((prev) => (prev === 'ward' ? null : 'ward'))
            }
            data-testid={`${wardTestId}-trigger`}
            aria-expanded={openDropdown === 'ward'}
            aria-haspopup="listbox"
            className={`w-full h-12 px-3 rounded-xl border text-left flex items-center justify-between gap-1.5 transition-all duration-150 focus-ring ${
              openDropdown === 'ward'
                ? 'border-ink bg-surface ring-1 ring-ink shadow-xs'
                : 'border-border bg-canvas hover:border-ink/40'
            } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Navigation
                size={15}
                className={displayWardName ? 'text-ink shrink-0' : 'text-secondary shrink-0'}
              />
              <span
                className={`text-[13.5px] truncate ${
                  displayWardName ? 'text-ink font-medium' : 'text-secondary'
                }`}
              >
                {displayWardName ||
                  (selectedProvince
                    ? t('vnAddress.selectWardPlaceholder')
                    : t('vnAddress.selectProvinceFirst'))}
              </span>
            </div>
            <ChevronDown
              size={15}
              className={`text-secondary shrink-0 transition-transform duration-200 ${
                openDropdown === 'ward' ? 'rotate-180 text-ink' : ''
              }`}
            />
          </button>

          {/* Ward Dropdown Popover */}
          {openDropdown === 'ward' && (
            <div
              data-testid={`${wardTestId}-dropdown`}
              role="listbox"
              className="
                absolute left-0 right-0 z-[100] mt-2
                w-full
                rounded-2xl border border-border bg-surface shadow-2xl
                overflow-hidden animate-scale-in
              "
            >
              {/* Search Bar + Search Button */}
              <div className="p-3 border-b border-border bg-canvas/70 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Search
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none"
                    />
                    <input
                      ref={wardSearchInputRef}
                      type="text"
                      value={wardQuery}
                      onChange={(e) => {
                        setWardQuery(e.target.value);
                        setCommittedWardQuery(e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleTriggerWardSearch();
                          if (filteredWards.length === 1) {
                            handleSelectWard(filteredWards[0]);
                          }
                        }
                      }}
                      placeholder={t('vnAddress.searchWardPlaceholder')}
                      data-testid={`${wardTestId}-search-input`}
                      className="w-full h-10 pl-9 pr-8 rounded-xl border border-border bg-surface text-small text-ink placeholder:text-secondary focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink"
                    />
                    {wardQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setWardQuery('');
                          setCommittedWardQuery('');
                          wardSearchInputRef.current?.focus();
                        }}
                        aria-label={t('vnAddress.clearSearch')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary hover:text-ink"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleTriggerWardSearch}
                    data-testid={`${wardTestId}-search-btn`}
                    className="h-10 px-3.5 rounded-xl bg-primary text-primary-foreground text-caption font-medium inline-flex items-center gap-1.5 hover:bg-primary/90 shrink-0 transition-colors"
                  >
                    <Search size={13} />
                    <span>{t('vnAddress.searchBtn')}</span>
                  </button>
                </div>

                {/* Unit type filter chips (All / Phường / Xã / Đặc khu) */}
                {selectedProvince && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { key: 'ALL', label: t('vnAddress.allUnits', { count: unitCounts.all }), count: unitCounts.all },
                      { key: 'Phường', label: `${t('vnAddress.wardFilter')} (${unitCounts.phuong})`, count: unitCounts.phuong },
                      { key: 'Xã', label: `${t('vnAddress.communeFilter')} (${unitCounts.xa})`, count: unitCounts.xa },
                      { key: 'Đặc khu', label: `${t('vnAddress.specialZoneFilter')} (${unitCounts.dacKhu})`, count: unitCounts.dacKhu },
                    ]
                      .filter((tab) => tab.key === 'ALL' || tab.count > 0)
                      .map((tab) => {
                        const active = wardUnitFilter === tab.key;
                        return (
                          <button
                            key={tab.key}
                            type="button"
                            onClick={() => setWardUnitFilter(tab.key)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                              active
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-surface border-border text-ink hover:border-ink/40'
                            }`}
                          >
                            {tab.label}
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Scrollable List of Wards / Communes / Special Zones */}
              <div className="max-h-64 overflow-y-auto divide-y divide-border/50 bg-surface">
                {filteredWards.length === 0 ? (
                  <div className="p-6 text-center text-small text-secondary">
                    {t('vnAddress.noResults')}
                  </div>
                ) : (
                  filteredWards.map((w) => {
                    const isSelected = selectedWard?.code === w.code;
                    return (
                      <button
                        key={w.code}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelectWard(w)}
                        data-testid={`ward-option-${w.code}`}
                        className={`w-full px-4 py-2.5 text-left flex items-center justify-between gap-3 transition-colors ${
                          isSelected
                            ? 'bg-primary/10 text-ink font-medium'
                            : 'hover:bg-canvas text-ink'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-small truncate">{w.name}</div>
                          <div className="text-[11px] font-mono text-secondary truncate">
                            {w.nameEn}
                            {!selectedProvince && w.provinceName ? ` · ${w.provinceName}` : ''}
                          </div>
                        </div>
                        {isSelected && <Check size={16} className="text-ink shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
