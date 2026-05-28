"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Cheltuiala, PnlDataInput, Portofel, Venit } from "./types";
import { buildPeriods, daysInMonth, fmt, matchPeriod, monthShift, periodLabel } from "./utils";

export function usePnlData(input: PnlDataInput) {
  const [venituri, setVenituri] = useState(input.venituri);
  const [cheltuieli, setCheltuieli] = useState(input.cheltuieli);
  const [portofel, setPortofel] = useState(input.portofel);
  const loadedYearsRef = useRef(new Set([input.loadedYear]));
  const [period, setPeriod] = useState(input.initialMonth);

  const periodIsYear = /^\d{4}$/.test(period);
  const periodYear = periodIsYear ? period : period.slice(0, 4);

  useEffect(() => {
    setVenituri(input.venituri);
    setCheltuieli(input.cheltuieli);
    setPortofel(input.portofel);
    loadedYearsRef.current = new Set([input.loadedYear]);
  }, [input.venituri, input.cheltuieli, input.portofel, input.loadedYear]);

  useEffect(() => {
    if (loadedYearsRef.current.has(periodYear)) return;
    let cancelled = false;
    fetch(`/api/pnlpersonal/data?year=${periodYear}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || data.error) return;
        loadedYearsRef.current.add(periodYear);
        setVenituri((prev) => [...prev.filter((v) => !v.data.startsWith(`${periodYear}-`)), ...data.venituri]);
        setCheltuieli((prev) => [...prev.filter((c) => !c.data.startsWith(`${periodYear}-`)), ...data.cheltuieli]);
        setPortofel((prev) => [...prev.filter((p) => !p.data.startsWith(`${periodYear}-`)), ...data.portofel]);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [periodYear]);

  const periods = useMemo(
    () => buildPeriods(input.availableMonths, input.initialMonth),
    [input.availableMonths, input.initialMonth],
  );

  const monthOnlyPeriods = useMemo(() => periods.filter((p) => !p.isYear), [periods]);
  const navIdx = monthOnlyPeriods.findIndex((p) => p.value === period);
  const prevPeriodValue = navIdx >= 0 && navIdx < monthOnlyPeriods.length - 1 ? monthOnlyPeriods[navIdx + 1].value : null;
  const nextPeriodValue = navIdx > 0 ? monthOnlyPeriods[navIdx - 1].value : null;

  const filteredVenituri = useMemo(
    () => venituri.filter((v) => matchPeriod(v.data, period)),
    [venituri, period],
  );
  const filteredCheltuieli = useMemo(
    () => cheltuieli.filter((c) => matchPeriod(c.data, period)),
    [cheltuieli, period],
  );
  const filteredPortofel = useMemo(
    () => portofel.filter((p) => matchPeriod(p.data, period)),
    [portofel, period],
  );

  const totalVenituri = filteredVenituri.reduce((s, v) => s + v.suma, 0);
  const totalCheltuieli = filteredCheltuieli.reduce((s, c) => s + c.suma, 0);
  const profitNet = totalVenituri - totalCheltuieli;
  const marja = totalVenituri > 0 ? Math.round((profitNet / totalVenituri) * 100) : 0;

  const days = periodIsYear ? 0 : daysInMonth(period);
  const medieZilnica = days > 0 ? totalCheltuieli / days : 0;

  const prevMonthLabel = periodIsYear ? "" : periodLabel(monthShift(period, -1));
  const prevC = useMemo(() => {
    if (periodIsYear) return 0;
    const prev = monthShift(period, -1);
    return cheltuieli.filter((c) => c.data.startsWith(prev)).reduce((s, c) => s + c.suma, 0);
  }, [cheltuieli, period, periodIsYear]);

  const diff = prevC > 0 ? ((totalCheltuieli - prevC) / prevC) * 100 : null;
  const diffTxt = diff === null ? "—" : `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`;
  const card4ValueClass = diff === null ? "" : (diff <= 0 ? "green" : "red");
  const card4SubText = prevC > 0 ? `${fmt(prevC)} lei atunci` : "fără date";

  const topCategorii = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of filteredCheltuieli) {
      map.set(c.categorie, (map.get(c.categorie) ?? 0) + c.suma);
    }
    return Array.from(map, ([categorie, suma]) => ({ categorie, suma })).sort((a, b) => b.suma - a.suma);
  }, [filteredCheltuieli]);

  const lastCheltuialaDate = useMemo(() => {
    if (cheltuieli.length === 0) return null;
    return [...cheltuieli].sort((a, b) => b.data.localeCompare(a.data))[0].data;
  }, [cheltuieli]);

  const lastEntryInfo = useMemo(() => {
    if (!lastCheltuialaDate) return null;
    const [y, m, d] = lastCheltuialaDate.split("-").map(Number);
    const entryDt = new Date(y, m - 1, d);
    const todayDt = new Date();
    todayDt.setHours(0, 0, 0, 0);
    const diffZ = Math.round((todayDt.getTime() - entryDt.getTime()) / 86400000);
    const when = diffZ === 0 ? "azi" : diffZ === 1 ? "ieri" : `acum ${diffZ} zile`;
    return { when, stale: diffZ >= 3 };
  }, [lastCheltuialaDate]);

  return {
    period,
    setPeriod,
    periodIsYear,
    periods,
    prevPeriodValue,
    nextPeriodValue,
    venituri,
    cheltuieli,
    portofel,
    filteredVenituri,
    filteredCheltuieli,
    filteredPortofel,
    totalVenituri,
    totalCheltuieli,
    profitNet,
    marja,
    days,
    medieZilnica,
    prevMonthLabel,
    diffTxt,
    card4ValueClass,
    card4SubText,
    topCategorii,
    lastCheltuialaDate,
    lastEntryInfo,
  };
}

export type { Venit, Cheltuiala, Portofel };
