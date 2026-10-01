import fs from 'node:fs/promises';

const sourceUrl = 'https://raw.githubusercontent.com/Hameds/IranCountryDivisions/main/data/1404/iran.json';
const outputDir = new URL('../data/reference/iran-geography/1404/', import.meta.url);
const rows = await (await fetch(sourceUrl)).json();
const byId = new Map(rows.map((row) => [row.Id, row]));
const provinces = rows.filter((row) => row.DivisionType === 1).map((row) => ({ sourceCode: row.Code, name: row.Name, sourceVersion: 'SCI-1404' }));
const provinceById = new Map(rows.filter((row) => row.DivisionType === 1).map((row) => [row.Id, { sourceCode: row.Code, name: row.Name, sourceVersion: 'SCI-1404' }]));
const cities = rows.filter((row) => row.DivisionType === 5).flatMap((row) => {
  let parent = byId.get(row.ParentCountryDivisionId);
  while (parent && parent.DivisionType !== 1) parent = byId.get(parent.ParentCountryDivisionId);
  const province = provinceById.get(parent?.Id);
  return province ? [{ sourceCode: row.Code, name: row.Name, provinceCode: province.sourceCode, sourceVersion: 'SCI-1404' }] : [];
});
await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(new URL('provinces.json', outputDir), `${JSON.stringify(provinces, null, 2)}\n`);
await fs.writeFile(new URL('cities.json', outputDir), `${JSON.stringify(cities, null, 2)}\n`);
await fs.writeFile(new URL('source-info.md', outputDir), `# SCI-1404 Iran Geography Snapshot\n\nUnderlying authority: Statistical Center of Iran.\nSource: Hameds/IranCountryDivisions normalized data/1404/iran.json.\nDivisionType 1 = Province; DivisionType 5 = City; DivisionType 7 urban zones are excluded.\n\nProvince count: ${provinces.length}\nReal city count: ${cities.length}\n`);
console.log(JSON.stringify({ provinces: provinces.length, cities: cities.length }));
