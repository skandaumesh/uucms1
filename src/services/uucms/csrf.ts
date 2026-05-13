import * as cheerio from 'cheerio';

export const extractCSRFToken = (html: string): string | null => {
  const $ = cheerio.load(html);
  return $('input[name="__RequestVerificationToken"]').val() as string || null;
};

export const extractAllFormFields = (html: string): Record<string, string> => {
  const $ = cheerio.load(html);
  const fields: Record<string, string> = {};
  $('input[type="hidden"]').each((_, el) => {
    const name = $(el).attr('name');
    const value = $(el).attr('value');
    if (name) fields[name] = value || '';
  });
  return fields;
};
