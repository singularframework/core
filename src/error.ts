import { Response } from '@singular/common';

export class ServerError {

  public readonly error = true;
  public stack: string;

  constructor(
    public message: string,
    public httpCode: number = 500,
    public code: string = 'UNKOWN_ERROR'
  ) { }

  /**
  * Returns a new ServerError from an Error object.
  * @param error An error object.
  * @param httpCode The HTTP status code to use when responding to requests.
  * @param code An error code to override the error object's code (if any).
  */
  public static from(error: Error, httpCode: number = 500, code?: string): ServerError {

    const serverError = new ServerError(error.message, httpCode || 500, code || (<any>error).code);

    serverError.stack = error.stack;

    return serverError;

  }

  /**
  * Responds to request with current error.
  * @param res An Express response object.
  */
  public respond(res: Response) {

    res.status(this.httpCode).json({
      error: this.error,
      message: this.message,
      code: this.code
    });

  }

}
