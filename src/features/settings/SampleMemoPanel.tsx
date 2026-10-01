import { useEffect, useState } from "react";

type State =
  | { status: "idle" }
  | { status: "working" }
  | { status: "ready"; file: File; url: string; ms: number }
  | { status: "error"; message: string };

function canShareFile(file: File): boolean {
  return (
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  );
}

/**
 * Spike A: generates the synthetic sample memo PDF so the export can be
 * checked on the iPad. Removed when the memo editor lands (build step 7).
 */
export function SampleMemoPanel() {
  const [state, setState] = useState<State>({ status: "idle" });

  const readyUrl = state.status === "ready" ? state.url : null;
  useEffect(() => {
    return () => {
      if (readyUrl) URL.revokeObjectURL(readyUrl);
    };
  }, [readyUrl]);

  async function generate() {
    setState({ status: "working" });
    const started = performance.now();
    try {
      const { buildSampleMemoPdf } = await import("../memo/exportSampleMemo");
      const file = await buildSampleMemoPdf();
      setState({
        status: "ready",
        file,
        url: URL.createObjectURL(file),
        ms: Math.round(performance.now() - started),
      });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Sharing runs straight from a tap on a ready file: Safari requires a
  // fresh user gesture, which an awaited PDF build would use up.
  async function share(file: File) {
    try {
      await navigator.share({ files: [file], title: file.name });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setState({
        status: "error",
        message: `Sharing failed: ${String(error)}`,
      });
    }
  }

  return (
    <section className="spike-panel" aria-labelledby="sample-memo-heading">
      <h2 id="sample-memo-heading">Sample memo (Spike A)</h2>
      <p>
        Builds a Site Instruction Memo PDF from synthetic data to check the
        export on this device. Temporary.
      </p>
      <p className="button-row">
        <button
          type="button"
          onClick={() => void generate()}
          disabled={state.status === "working"}
        >
          {state.status === "working" ? "Generating…" : "Generate sample memo"}
        </button>
        {state.status === "ready" && (
          <>
            {canShareFile(state.file) && (
              <button type="button" onClick={() => void share(state.file)}>
                Share PDF
              </button>
            )}
            <a
              className="button-link"
              href={state.url}
              download={state.file.name}
              data-testid="sample-memo-link"
            >
              Download PDF
            </a>
          </>
        )}
      </p>
      {state.status === "ready" && (
        <p data-testid="sample-memo-status">
          {state.file.name}: {Math.round(state.file.size / 1024)} KB in{" "}
          {state.ms} ms
        </p>
      )}
      {state.status === "error" && (
        <p role="alert" className="error">
          Could not generate the memo: {state.message}
        </p>
      )}
    </section>
  );
}
