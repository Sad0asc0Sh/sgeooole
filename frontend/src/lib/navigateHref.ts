export type RouterLike = {
  push: (href: string) => void;
};

type NavigateTarget =
  | { kind: "ignore" }
  | { kind: "internal"; href: string }
  | { kind: "external"; href: string };

const isSafeProtocol = (protocol: string) => {
  const normalized = protocol.trim().toLowerCase();
  return (
    normalized === "http:" ||
    normalized === "https:" ||
    normalized === "mailto:" ||
    normalized === "tel:"
  );
};

export const resolveNavigateTarget = (href?: string | null): NavigateTarget => {
  const raw = typeof href === "string" ? href.trim() : "";
  if (!raw || raw === "#") return { kind: "ignore" };

  // Block obvious script/data URLs coming from CMS/admin input.
  if (/^\s*(javascript:|data:)/i.test(raw)) return { kind: "ignore" };

  // Protocol-relative URL (e.g. //example.com)
  if (raw.startsWith("//")) return { kind: "external", href: `https:${raw}` };

  // Absolute URL with scheme (http/https/mailto/tel)
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    try {
      const parsed = new URL(raw);
      if (!isSafeProtocol(parsed.protocol)) return { kind: "ignore" };
      return { kind: "external", href: raw };
    } catch {
      return { kind: "ignore" };
    }
  }

  // Looks like a domain without scheme (e.g. example.com/path, www.example.com)
  if (/^(www\.)/i.test(raw) || /^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(raw)) {
    return { kind: "external", href: `https://${raw}` };
  }

  // Internal routes: normalize to leading slash.
  if (raw.startsWith("/")) return { kind: "internal", href: raw };
  if (raw.startsWith("?")) return { kind: "internal", href: `/${raw}` };
  return { kind: "internal", href: `/${raw}` };
};

export const canNavigateToHref = (href?: string | null) =>
  resolveNavigateTarget(href).kind !== "ignore";

export const navigateHref = (router: RouterLike, href?: string | null) => {
  const target = resolveNavigateTarget(href);
  if (target.kind === "ignore") return;

  if (target.kind === "external") {
    window.location.assign(target.href);
    return;
  }

  router.push(target.href);
};
