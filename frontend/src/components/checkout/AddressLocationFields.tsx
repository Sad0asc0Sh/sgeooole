"use client";

import { useMemo } from "react";
import SearchableSelect from "@/components/ui/SearchableSelect";
import {
  cityOptionsForProvince,
  getCityById,
  getCityByName,
  getProvinceById,
  getProvinceByName,
  normalizeIranLocationText,
  provinceOptions,
} from "@/lib/iranLocations";

export interface AddressLocationValue {
  province: string;
  city: string;
  provinceId?: number;
  cityId?: number;
}

interface AddressLocationFieldsProps {
  value: AddressLocationValue;
  onChange: (value: AddressLocationValue) => void;
  className?: string;
}

const toOptionalNumber = (value: string | undefined): number | undefined => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
};

export default function AddressLocationFields({
  value,
  onChange,
  className = "",
}: AddressLocationFieldsProps) {
  const selectedProvince = useMemo(
    () => getProvinceById(value.provinceId) ?? getProvinceByName(value.province),
    [value.province, value.provinceId],
  );

  const selectedCity = useMemo(
    () =>
      getCityById(value.cityId) ??
      getCityByName(value.city, selectedProvince?.id),
    [value.city, value.cityId, selectedProvince?.id],
  );

  const cityOptions = useMemo(
    () => cityOptionsForProvince(selectedProvince?.id),
    [selectedProvince?.id],
  );

  const provinceSelectValue = selectedProvince
    ? String(selectedProvince.id)
    : value.province;
  const citySelectValue = selectedCity ? String(selectedCity.id) : value.city;
  const hasLegacyProvince = Boolean(value.province && !selectedProvince);
  const hasLegacyCity = Boolean(value.city && selectedProvince && !selectedCity);

  const handleProvinceChange = (provinceValue: string) => {
    const province = getProvinceById(toOptionalNumber(provinceValue));
    if (!province) return;

    onChange({
      province: province.name,
      city: "",
      provinceId: province.id,
      cityId: undefined,
    });
  };

  const handleCityChange = (cityValue: string) => {
    const city = getCityById(toOptionalNumber(cityValue));
    if (!city || city.provinceId !== selectedProvince?.id) return;

    onChange({
      province: selectedProvince.name,
      city: city.name,
      provinceId: selectedProvince.id,
      cityId: city.id,
    });
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">
            استان <span className="text-red-500">*</span>
          </label>
          <SearchableSelect
            options={provinceOptions}
            value={provinceSelectValue}
            onChange={handleProvinceChange}
            placeholder="انتخاب استان"
            searchPlaceholder="جست‌وجوی استان..."
            searchNormalizer={normalizeIranLocationText}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1.5">
            شهر <span className="text-red-500">*</span>
          </label>
          <SearchableSelect
            options={cityOptions}
            value={citySelectValue}
            onChange={handleCityChange}
            placeholder={selectedProvince ? "انتخاب شهر" : "ابتدا استان را انتخاب کنید"}
            searchPlaceholder="جست‌وجوی شهر..."
            searchNormalizer={normalizeIranLocationText}
            disabled={!selectedProvince}
          />
        </div>
      </div>

      {(hasLegacyProvince || hasLegacyCity) && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          مقدار ثبت‌شدهٔ قبلی برای حفظ سازگاری نمایش داده شده است. در صورت تمایل، استان و شهر استاندارد را انتخاب کنید؛ تا زمانی که آن‌ها را تغییر ندهید، مقدار قبلی بدون تغییر حفظ می‌شود.
        </p>
      )}
    </div>
  );
}
