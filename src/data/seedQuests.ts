import type { Quest } from '../types';

export const REWRITE_CAMPAIGN = 'plain-words';

const seeds: Pick<Quest, 'title' | 'placeName' | 'sourceUrl' | 'sourceLicense' | 'sourceText'>[] = [
  {
    title: 'Rewrite: how to get food help', placeName: 'USA.gov, Food help',
    sourceUrl: 'https://www.usa.gov/food-help', sourceLicense: 'Public domain (US federal work)',
    sourceText: 'The Supplemental Nutrition Assistance Program (SNAP) provides benefits to supplement the food budget of needy families so they can purchase healthy food and move towards self-sufficiency. Eligibility is determined by state agencies in accordance with federal guidelines, and applicants must submit documentation prior to receiving a determination.',
  },
  {
    title: 'Rewrite: who can claim PIP', placeName: 'GOV.UK, Personal Independence Payment',
    sourceUrl: 'https://www.gov.uk/pip/eligibility', sourceLicense: 'Open Government Licence v3.0',
    sourceText: 'You can get Personal Independence Payment (PIP) if you have a long-term physical or mental health condition or disability and you have difficulty doing certain everyday tasks or getting around because of your condition. You must have had these difficulties for 3 months and expect them to continue for at least 9 months, and you must be 16 or over and usually have not reached State Pension age.',
  },
  {
    title: 'Rewrite: what disability means', placeName: 'WHO, Disability and health',
    sourceUrl: 'https://www.who.int/news-room/fact-sheets/detail/disability-and-health', sourceLicense: 'CC BY-NC-SA 3.0 IGO',
    sourceText: 'Disability results from the interaction between individuals with a health condition, such as cerebral palsy, Down syndrome and depression, with personal and environmental factors including negative attitudes, inaccessible transportation and public buildings, and limited social support. An estimated 1.3 billion people experience significant disability.',
  },
  {
    title: 'Rewrite: what assistive technology is', placeName: 'WHO, Assistive technology',
    sourceUrl: 'https://www.who.int/news-room/fact-sheets/detail/assistive-technology', sourceLicense: 'CC BY-NC-SA 3.0 IGO',
    sourceText: "Assistive technology is an umbrella term covering the systems and services related to the delivery of assistive products and services. Assistive products maintain or improve an individual's functioning and independence, thereby promoting their well-being. Approximately 2.5 billion people need one or more assistive products.",
  },
  {
    title: 'Rewrite: Healthy Start eligibility', placeName: 'GOV.UK, Healthy Start',
    sourceUrl: 'https://www.gov.uk/healthy-start', sourceLicense: 'Open Government Licence v3.0',
    sourceText: 'You may be eligible for the Healthy Start scheme if you are at least 10 weeks pregnant or have a child under 4 years old, and you or your family receive certain benefits. If you are under 18 and pregnant, you are eligible even if you do not receive any benefits, provided that you have been resident in the United Kingdom.',
  },
  {
    title: 'Rewrite: what accessibility means', placeName: 'Wikipedia, Accessibility',
    sourceUrl: 'https://en.wikipedia.org/wiki/Accessibility', sourceLicense: 'CC BY-SA 4.0',
    sourceText: "Accessibility is the design of products, devices, services, vehicles, or environments so as to be usable by disabled people. The concept of accessible design and practice of accessible developments ensures both direct access and indirect access, meaning compatibility with a person's assistive technology such as computer screen readers.",
  },
];

export const rewriteSeeds: Quest[] = seeds.map((s, i) => ({
  ...s,
  id: `pr_${i + 1}`,
  type: 'plain-rewrite',
  campaignId: REWRITE_CAMPAIGN,
  estimatedMinutes: 15,
  requiredSkills: ['writing'],
  languages: ['English'],
  remote: true,
  sourceTags: {},
}));
