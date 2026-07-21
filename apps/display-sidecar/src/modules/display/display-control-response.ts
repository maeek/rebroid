import { HttpException } from "@nestjs/common";

export const displayControlError = (error: unknown) => {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (response && typeof response === "object") {
      const detail = response as { code?: unknown; message?: unknown };
      return {
        ok: false as const,
        code:
          typeof detail.code === "string" ? detail.code : "execution_failed",
        message:
          typeof detail.message === "string"
            ? detail.message
            : "The display control could not be executed.",
      };
    }
  }
  return {
    ok: false as const,
    code: "execution_failed",
    message: "The display control could not be executed.",
  };
};
