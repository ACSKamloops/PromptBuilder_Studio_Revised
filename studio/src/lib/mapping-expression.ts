type Primitive = string | number | boolean | null | undefined;
type Context = Record<string, unknown>;

const FUNCTION_RE = /^([a-zA-Z_][a-zA-Z0-9_]*)\((.*)\)$/;

function resolvePath(path: string, ctx: Context): unknown {
  const segments = path.split(".").map((seg) => seg.trim());
  let current: unknown = ctx;
  for (const segment of segments) {
    if (segment === "") return undefined;
    if (current && typeof current === "object" && segment in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

function parseLiteral(token: string): Primitive | Primitive[] {
  const trimmed = token.trim();
  if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    return trimmed.slice(1, -1);
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (!Number.isNaN(Number(trimmed))) return Number(trimmed);
  return undefined;
}

function splitArgs(args: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let inString = false;
  let stringChar = "";

  for (let i = 0; i < args.length; i += 1) {
    const char = args[i];
    if ((char === "\"" || char === "'") && args[i - 1] !== "\\") {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (stringChar === char) {
        inString = false;
      }
    }

    if (!inString) {
      if (char === "(") depth += 1;
      if (char === ")") depth -= 1;
      if (char === "," && depth === 0) {
        parts.push(current.trim());
        current = "";
        continue;
      }
    }

    current += char;
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

function evaluateFunction(name: string, args: string[], ctx: Context): unknown {
  const values = args.map((arg) => evaluateExpression(arg, ctx));
  switch (name) {
    case "coalesce": {
      return values.find((val) => {
        if (val === null || val === undefined) return false;
        if (typeof val === "string") return val.trim().length > 0;
        if (Array.isArray(val)) return val.length > 0;
        return true;
      });
    }
    case "join": {
      const arr = Array.isArray(values[0]) ? (values[0] as unknown[]) : [];
      const sep = typeof values[1] === "string" ? (values[1] as string) : ", ";
      return arr.join(sep);
    }
    case "upper": {
      const input = values[0];
      return typeof input === "string" ? input.toUpperCase() : "";
    }
    case "lower": {
      const input = values[0];
      return typeof input === "string" ? input.toLowerCase() : "";
    }
    case "pick": {
      const source = values[0];
      if (typeof values[1] !== "string") return undefined;
      if (!source || typeof source !== "object") return undefined;
      return values[1].split(".").reduce<unknown>((current: unknown, key) => {
        if (current && typeof current === "object" && key in (current as Record<string, unknown>)) {
          return (current as Record<string, unknown>)[key];
        }
        return undefined;
      }, source);
    }
    case "sum": {
      const arr = Array.isArray(values[0]) ? (values[0] as unknown[]) : [];
      return arr.reduce<number>(
        (acc, val) => acc + (typeof val === "number" ? val : Number(val) || 0),
        0,
      );
    }
    case "formatDate": {
      const value = values[0];
      if (!value) return "";
      const date = new Date(value as string);
      if (Number.isNaN(date.getTime())) return "";
      const format = typeof values[1] === "string" ? values[1] : "iso";
      if (format === "date") return date.toLocaleDateString();
      if (format === "time") return date.toLocaleTimeString();
      return date.toISOString();
    }
    default:
      return undefined;
  }
}

export function evaluateExpression(expression: string, context: Context): unknown {
  const trimmed = expression.trim();
  const literal = parseLiteral(trimmed);
  if (literal !== undefined) return literal;

  const fnMatch = trimmed.match(FUNCTION_RE);
  if (fnMatch) {
    const [, name, argString] = fnMatch;
    const args = argString.length ? splitArgs(argString) : [];
    return evaluateFunction(name, args, context);
  }

  if (trimmed.includes(".")) {
    return resolvePath(trimmed, context);
  }

  return context[trimmed];
}
