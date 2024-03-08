const PROTON_ACCOUNT_CACHEABLE_REGEX = /^http(s?):\/\/account\.proton\.me(?!(\/.*\/api\/)|(\/api\/)|(\/auth)|(\/.*\/auth)).*/;
const PROTON_MAIL_CACHEABLE_REGEX = /^http(s?):\/\/mail\.proton\.me(?!(\/.*\/api\/)|(\/api\/)).*/;
const TUTANOTA_CACHEABLE_REGEX = /^http(s?):\/\/app\.tuta\.com\/(?!rest).*/;
const ARKOSELABS_CACHEABLE_REGEX = /^http(s?):\/\/client-api\.arkoselabs\.com\/cdn\/.*/;
const TWITTER_APP_CACHEABLE_REGEX = /^http(s?):\/\/twitter\.com(?!(\/.*\/api\/)|(\/api\/)|(\/settings\/)).*/;
const TWIMG_CACHEABLE_REGEX = /^http(s?):\/\/.*\.twimg\.com.*/;

export const CACHEABLE_REGEX = {
  PROTON_ACCOUNT_CACHEABLE_REGEX,
  PROTON_MAIL_CACHEABLE_REGEX,
  TUTANOTA_CACHEABLE_REGEX,
  ARKOSELABS_CACHEABLE_REGEX,
  TWITTER_APP_CACHEABLE_REGEX,
  TWIMG_CACHEABLE_REGEX,
};
