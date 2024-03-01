import TwoCaptcha from "./src/2captcha";
import Capsolver from "./src/capsolver";

import type * as TwoCaptchaTypes from "./src/2captcha";
import type * as CapsolverTypes from "./src/capsolver";

export interface ICaptchaSolverOptions {
  twoCaptcha?: TwoCaptchaTypes.I2CaptchaOptions;
  capsolver?: CapsolverTypes.ICapsolverOptions;
}

export enum CaptchaSolverType {
  TWO_CAPTCHA = `2captcha`,
  CAPSOLVER = `capsolver`,
}

export type TCaptchaSolverType = CaptchaSolverType | "2captcha" | "capsolver";

class CaptchaSolver {
  public readonly twoCaptcha: TwoCaptcha | null = null;
  public readonly capsolver: Capsolver | null = null;

  constructor({ twoCaptcha, capsolver }: ICaptchaSolverOptions) {
    if (twoCaptcha) this.twoCaptcha = new TwoCaptcha(twoCaptcha);
    if (capsolver) this.capsolver = new Capsolver(capsolver);

    if (!this.twoCaptcha && !this.capsolver) throw new Error(`You must provide at least one captcha solver`);
  }

  public async funCaptcha(solver: TCaptchaSolverType, props: TwoCaptchaTypes.IFunCaptchaProps | CapsolverTypes.IFunCaptchaProps) {
    switch (solver) {
      case CaptchaSolverType.TWO_CAPTCHA:
        if (!this.twoCaptcha) throw new Error(`You must provide the 2captcha credentials on initialization`);
        return await this.twoCaptcha.funCaptcha(props);
      case CaptchaSolverType.CAPSOLVER:
        if (!this.capsolver) throw new Error(`You must provide the capsolver credentials on initialization`);
        return await this.capsolver.funCaptcha(props);
      default:
        throw new Error(`Invalid captcha solver type`);
    }
  }

  public async reCaptchaV2(solver: TCaptchaSolverType, props: CapsolverTypes.IReCaptchaV2Props) {
    switch (solver) {
      case CaptchaSolverType.TWO_CAPTCHA:
        if (!this.twoCaptcha) throw new Error(`You must provide the 2captcha credentials on initialization`);
        throw new Error(`2captcha/reCaptchaV2 is not implemented`);
      // return await this.twoCaptcha.funCaptcha(props);
      case CaptchaSolverType.CAPSOLVER:
        if (!this.capsolver) throw new Error(`You must provide the capsolver credentials on initialization`);
        return await this.capsolver.reCaptchaV2(props);
      default:
        throw new Error(`Invalid captcha solver type`);
    }
  }

  public async imageToText(solver: TCaptchaSolverType, props: CapsolverTypes.IImageToTextProps | TwoCaptchaTypes.IImageToTextProps) {
    switch (solver) {
      case CaptchaSolverType.TWO_CAPTCHA:
        if (!this.twoCaptcha) throw new Error(`You must provide the 2captcha credentials on initialization`);
        return await this.twoCaptcha.imageToText(props);
      case CaptchaSolverType.CAPSOLVER:
        if (!this.capsolver) throw new Error(`You must provide the capsolver credentials on initialization`);
        return await this.capsolver.imageToText(props);
      default:
        throw new Error(`Invalid captcha solver type`);
    }
  }
}

export default CaptchaSolver;
