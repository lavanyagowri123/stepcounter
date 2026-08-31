import { STEP_METRES } from "./roster";

export const ROUTE = [
  { km: 0, place: "Melbourne" },
  { km: 100, place: "Seymour" },
  { km: 195, place: "Benalla" },
  { km: 235, place: "Wangaratta" },
  { km: 325, place: "Albury" },
  { km: 500, place: "Gundagai" },
  { km: 600, place: "Yass" },
  { km: 680, place: "Goulburn" },
  { km: 790, place: "Mittagong" },
  { km: 880, place: "Sydney" },
] as const;

export const ROUTE_END = ROUTE[ROUTE.length - 1].km;

export const km = (steps: number): number => (steps * STEP_METRES) / 1000;
