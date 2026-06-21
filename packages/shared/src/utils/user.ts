import { adjectives, colors, uniqueNamesGenerator } from 'unique-names-generator';

export function getRandomName() {
  return uniqueNamesGenerator({
    dictionaries: [adjectives, colors],
    length: 2,
    style: 'capital',
    separator: ' ',
  });
}
