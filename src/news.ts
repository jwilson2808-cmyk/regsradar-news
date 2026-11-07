import edition from './data/weekly-news.json';

export type Category = 'All' | 'Federal' | 'GSEs' | 'States';
export type Article = {
  id: string;
  agency: string;
  category: Exclude<Category, 'All'>;
  topic: string;
  updateType: string;
  mortgageRelevance: string;
  title: string;
  summary: string;
  publishedDate: string;
  sourceName: string;
  sourceUrl: string;
  whatChanged?: string;
  whyItMatters?: string;
  affectedArea?: string;
  effectiveDate?: string;
  documentReference?: string | null;
  materialUpdatedDate?: string;
  materialUpdateVerified?: boolean;
  state?: string;
  verifiedAt?: string;
};
export const feed = edition;
export const articles = edition.articles as Article[];
export function formatPublicationDate(value: string): string {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', {year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'});
}
