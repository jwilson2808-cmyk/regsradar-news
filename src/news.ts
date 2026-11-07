export type Category = 'All' | 'Federal' | 'GSEs' | 'States';
export type Article = {
  id: string;
  agency: string;
  category: Exclude<Category, 'All'>;
  topic: string;
  title: string;
  summary: string;
  impact: string;
  publishedLabel: string;
};
// ALL ARTICLES BELOW ARE FICTIONAL PLACEHOLDERS, NOT VERIFIED REGULATORY NEWS.
export const articles: Article[] = [
  {id:'sample-1',agency:'CFPB',category:'Federal',topic:'Servicing',title:'Sample servicing guidance update',summary:'Illustrative summary demonstrating how an official agency publication would appear in the RegsRadar News mobile experience.',impact:'Review servicing procedures and determine whether a documented assessment is needed.',publishedLabel:'SAMPLE ARTICLE'},
  {id:'sample-2',agency:'Fannie Mae',category:'GSEs',topic:'Origination',title:'Sample Selling Guide announcement',summary:'Illustrative agency update showing concise information on the public news feed and a longer article detail view.',impact:'Confirm whether origination policies, disclosures, or system requirements are affected.',publishedLabel:'SAMPLE ARTICLE'},
  {id:'sample-3',agency:'California DFPI',category:'States',topic:'State regulation',title:'Sample state regulatory bulletin',summary:'Demonstration only. State-level regulatory news can be filtered by the user’s preferred jurisdictions in a future release.',impact:'Check applicability to licensed entities and document implementation responsibilities.',publishedLabel:'SAMPLE ARTICLE'},
  {id:'sample-4',agency:'HUD / FHA',category:'Federal',topic:'FHA',title:'Sample Mortgagee Letter publication',summary:'Illustrative FHA announcement for reviewing article details and the proposed regulatory tracking action.',impact:'Determine effective dates, product scope, and whether procedure updates are required.',publishedLabel:'SAMPLE ARTICLE'}
];
