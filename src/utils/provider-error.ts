export function extractProviderErrorMessage(error: any): string {
  if (!error) return "Unknown error";

  // Axios-like error from proxies
  if (error.response) {
    const resp = error.response;
    if (resp.data) {
      // common shapes
      if (typeof resp.data === "string") return resp.data;
      if (resp.data.error && typeof resp.data.error === "string") return resp.data.error;
      if (resp.data.error && resp.data.error.message) return resp.data.error.message;
      if (resp.data.message) return resp.data.message;
    }
    if (resp.statusText) return `${resp.status} ${resp.statusText}`;
  }

  // OpenAI / OpenRouter SDK style
  if (error.error && error.error.message) return error.error.message;

  // generic
  if (error.message) return error.message;

  try {
    return JSON.stringify(error).slice(0, 1000);
  } catch {
    return "Unknown error";
  }
}
