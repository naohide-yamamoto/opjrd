function showJatosStartupError(message: string): void {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (app) {
    app.innerHTML = `<main class="opjrd-status"><p>${message}</p></main>`;
  }
}

function loadJatosScript(): Promise<void> {
  if ((window as Window & { jatos?: unknown }).jatos) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "jatos.js";
    script.async = false;
    script.onload = () => {
      resolve();
    };
    script.onerror = () => {
      reject(new Error("Could not load the JATOS runtime."));
    };
    document.head.append(script);
  });
}

loadJatosScript()
  .then(() => import("./main"))
  .catch((error: unknown) => {
    console.error(error);
    showJatosStartupError("Could not load the JATOS runtime.");
  });
