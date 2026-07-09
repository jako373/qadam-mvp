const animatedSelector = [
  ".dashboard-header",
  ".lesson-focus",
  ".adaptive-note",
  ".lesson-flow",
  ".prep-card",
  ".activity-card",
  ".metric-card",
  ".lesson-card",
  ".result-visual",
  ".result-details",
].join(",");

function canAnimate() {
  return (
    typeof window !== "undefined" &&
    "animate" in document.documentElement &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function runPageMotion() {
  if (!canAnimate()) return;
  const elements = [...document.querySelectorAll(animatedSelector)].slice(0, 28);
  elements.forEach((element, index) => {
    element.animate(
      [
        { opacity: 0, transform: "translateY(14px) scale(0.985)" },
        { opacity: 1, transform: "translateY(0) scale(1)" },
      ],
      {
        duration: 460,
        delay: Math.min(index * 42, 420),
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "both",
      },
    );
  });
}
