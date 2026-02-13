export const adjectives = [
  "Bahagia",
  "Ceria",
  "Hebat",
  "Keren",
  "Cepat",
  "Pintar",
  "Baik",
  "Berani",
  "Tenang",
  "Ramah",
  "Jago",
  "Gesit",
  "Semangat",
  "Sabar",
  "Unik",
];

export const nouns = [
  "Bintang",
  "Bulan",
  "Matahari",
  "Awan",
  "Langit",
  "Ombak",
  "Daun",
  "Pohon",
  "Bunga",
  "Pelukis",
  "Seniman",
  "Pencipta",
  "Pemimpi",
  "Pejalan",
  "Pelari",
];

export function generateRandomName(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${noun} ${adj}`; // Indonesian usually Noun + Adjective (e.g. Pelukis Hebat)
}
