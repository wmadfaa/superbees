interface ICapsolverErrorOptions {
  action: string;
  errorCode: string;
  errorDescription: string;
}

export class CapsolverError extends Error {
  action: string;
  code: string;
  name: string = `CapsolverError`;

  constructor({ action, errorCode, errorDescription }: ICapsolverErrorOptions) {
    super(errorDescription);
    this.action = action;
    this.code = errorCode;
  }
}

interface ICapsolverTaskResultError {
  taskId: string;
  status: string;
}

export class CapsolverTaskResultError extends Error {
  taskId: string;
  status: string;
  name: string = `CapsolverTaskResultError`;

  constructor({ status, taskId }: ICapsolverTaskResultError) {
    super(`${status} - ${taskId}`);
    this.taskId = taskId;
    this.status = status;
  }
}
