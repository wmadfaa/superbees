interface I2CaptchaErrorOptions {
  action: string;
  errorId: number;
}

const TwoCaptchaErrorsMap = <const>{
  0: {
    code: "-",
    description: "No errors",
  },
  1: {
    code: "ERROR_KEY_DOES_NOT_EXIST",
    description: "Your API key is incorrect. Make sure you set the key correctly and copied it from the dashboard in Customer or Developer mode",
  },
  2: {
    code: "ERROR_NO_SLOT_AVAILABLE",
    description: "Your bid is too low for the captcha you submit or the queue of your captchas is loo long and we temporary do not accept more captchas from you",
  },
  3: {
    code: "ERROR_ZERO_CAPTCHA_FILESIZE",
    description: "Image size is less than 100 bytes",
  },
  4: {
    code: "ERROR_TOO_BIG_CAPTCHA_FILESIZE",
    description: "Image size is more than 100 kB or image is bigger than 600px on any side",
  },
  10: {
    code: "ERROR_ZERO_BALANCE",
    description: "You don't have funds on your account",
  },
  11: {
    code: "ERROR_IP_NOT_ALLOWED",
    description: "The request is sent from the IP that is not on the list of your trusted IPs",
  },
  12: {
    code: "ERROR_CAPTCHA_UNSOLVABLE",
    description: "We are unable to solve your captcha - three of our workers were unable solve it. The captcha price is automatically returned to your balance",
  },
  13: {
    code: "ERROR_BAD_DUPLICATES",
    description: "The error is returned when 100% accuracy feature is enabled. The error means that max numbers of tries is reached but min number of matches not found",
  },
  14: {
    code: "ERROR_NO_SUCH_METHOD",
    description: "Request made to API with a method that does not exist",
  },
  15: {
    code: "ERROR_IMAGE_TYPE_NOT_SUPPORTED",
    description: "The image can not be processed due to an incorrect format or size, or the image is corrupted. Please check the image in your request payload",
  },
  16: {
    code: "ERROR_NO_SUCH_CAPCHA_ID",
    description: "You've provided incorrect captcha ID in the request",
  },
  21: {
    code: "ERROR_IP_BLOCKED",
    description: "Your IP address is banned due to improper use of the API",
  },
  22: {
    code: "ERROR_TASK_ABSENT",
    description: "task property is missing in your createTask method call",
  },
  23: {
    code: "ERROR_TASK_NOT_SUPPORTED",
    description: "task property in your createTask method call contains the type of task that is not supported by our API or you have an error in type property",
  },
  31: {
    code: "ERROR_RECAPTCHA_INVALID_SITEKEY",
    description: "The sitekey value provided in your request is not valid",
  },
  55: {
    code: "ERROR_ACCOUNT_SUSPENDED",
    description: "Your API access was blocked for improper use of the API. Please contact our support team to resolve the issue",
  },
  110: {
    code: "ERROR_BAD_PARAMETERS",
    description:
      "The required captcha parameters in your request are missing or have incorrect format. Please make sure your request payload has proper format for selected task type",
  },
  115: {
    code: "ERROR_BAD_IMGINSTRUCTIONS",
    description:
      "The error is returned in cases when imgInstructions contains unsupported file type, corrupted file or the size of the image is over the limits. The limits are described in the corresponding task type specification.",
  },
  130: {
    code: "ERROR_BAD_PROXY",
    description: "Incorrect proxy parameters or can not establish connection through the proxy",
  },
};

export class TwoCaptchaError extends Error {
  action: string;
  code: string;
  name: string = `TwoCaptchaError`;

  constructor({ action, errorId }: I2CaptchaErrorOptions) {
    const { code: errorCode, description: errorDescription } = TwoCaptchaErrorsMap[errorId as keyof typeof TwoCaptchaErrorsMap];
    super(errorDescription);
    this.action = action;
    this.code = errorCode;
  }
}

interface I2CaptchaTaskResultError {
  taskId?: string;
  status: string;
}

export class TwoCaptchaTaskResultError extends Error {
  taskId?: string;
  status: string;
  name: string = `TwoCaptchaTaskResultError`;

  constructor({ status, taskId }: I2CaptchaTaskResultError) {
    super(`${status} - ${taskId}`);
    this.taskId = taskId;
    this.status = status;
  }
}
