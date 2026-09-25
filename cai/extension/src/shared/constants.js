export const EXT_VERSION = '0.1.0';
export const SCHEMA_VERSION = 1;
export const MAX_BATCH = 50;
export const DEFAULT_VISIBLE_LIMIT = 100;

export const SOURCES = {
  META: 'META_AD_LIBRARY',
  LINKEDIN: 'LINKEDIN_AD_LIBRARY',
  GOOGLE: 'GOOGLE_ATC',
  TRENDS: 'GOOGLE_TRENDS',
  LANDING: 'LANDING_PAGE',
  MANUAL: 'MANUAL'
};

export const SRC_PREFIX = {
  META_AD_LIBRARY: 'meta',
  LINKEDIN_AD_LIBRARY: 'li',
  GOOGLE_ATC: 'gatc',
  MANUAL: 'man'
};

export const SOURCE_LABEL = {
  META_AD_LIBRARY: 'Meta Ad Library',
  LINKEDIN_AD_LIBRARY: 'LinkedIn Ad Library',
  GOOGLE_ATC: 'Google Ads Transparency',
  GOOGLE_TRENDS: 'Google Trends',
  LANDING_PAGE: 'Landing page',
  MANUAL: 'Nhập tay'
};

export const FORMATS = ['IMAGE', 'VIDEO', 'CAROUSEL', 'TEXT', 'DOCUMENT', 'EVENT', 'MESSAGE', 'SPOTLIGHT', 'DYNAMIC', 'UNKNOWN'];
export const AUDIENCES = ['EMPLOYER', 'CANDIDATE', 'UNKNOWN'];
export const STATUSES = ['ACTIVE', 'INACTIVE', 'UNKNOWN'];
