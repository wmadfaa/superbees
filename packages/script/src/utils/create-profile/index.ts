import * as fs from "fs";
import * as path from "path";
import { faker } from "@faker-js/faker";

import { STORAGE_PATH } from "@superbees/resources";
import { Country, Firstname, Gender, Nationality, Surnames } from "./types";

export * from "./types";

export interface IOptions {
  genders: Gender[];
  countries: Country[];
  nationalities: Nationality[];
  birthdate: { min?: number; max?: number; mode?: "age" | "year" };
}

const f: Firstname[] = JSON.parse(fs.readFileSync(path.join(STORAGE_PATH, "./firstnames.json"), "utf-8"));
const s: Surnames[] = JSON.parse(fs.readFileSync(path.join(STORAGE_PATH, "./surnames.json"), "utf-8"));

export async function createProfile(options?: Partial<IOptions>) {
  let fl = f.slice();
  let sl = s.slice();

  if (options?.genders) fl = fl.filter((r) => options?.genders?.includes(r.gender));
  if (options?.countries) fl = fl.filter((r) => options?.countries?.some((c) => r.countries.includes(c)));
  if (options?.nationalities) fl = fl.filter((r) => options?.nationalities?.some((n) => r.nationalities.includes(n)));

  if ((!fl.length || !sl.length) && options && Object.values(options)) throw new Error(`there is no names that matches this filter!`);

  const fn = fl[Math.floor(Math.random() * fl.length)];
  sl = sl.filter((r) => fn.nationalities.includes(r.nationality));
  const ln = sl[Math.floor(Math.random() * sl.length)];

  const countries = fn.countries.filter((c) => (options?.countries ? options?.countries.includes(c) : true));

  const firstName = fn.name;
  const lastName = ln.surname;
  const gender = fn.gender;
  const country = countries[Math.floor(Math.random() * countries.length)];
  const birthdate = faker.date.birthdate(options?.birthdate);

  return { firstname: firstName, lastname: lastName, birthdate, gender, country };
}
