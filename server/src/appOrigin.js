// First CORS_ORIGIN entry: the app origin an emailed link must return to.
export const appOrigin = () => String(process.env.CORS_ORIGIN || '').split(',')[0].trim();
