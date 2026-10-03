import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

/**
 * A textarea that grows to show all its text (never shorter than `rows`),
 * so long prefilled messages can be read without scrolling inside the box.
 */
export function AutoGrowTextarea(
  props: TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      // Hidden (e.g. in a folded row): measure once it is shown.
      if (el.clientWidth === 0) return;
      el.style.height = "auto";
      const border = el.offsetHeight - el.clientHeight;
      el.style.height = `${el.scrollHeight + border}px`;
    };
    fit();
    // Width changes (rotation, side panel) rewrap the text; our own height
    // changes are ignored.
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fit();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [props.value]);

  return <textarea ref={ref} {...props} />;
}
