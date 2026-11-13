import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  Hand,
  Pencil,
  MoveUpRight,
  Square,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import type { Tool } from "../model.js";

export const toolLabels: Record<Tool, string> = {
  pan: "Move",
  pen: "Pen",
  arrow: "Arrow",
  rect: "Rectangle",
  pin: "Numbered pin",
};
const tools: { key: Tool; shortcut: string; icon: LucideIcon }[] = [
  { key: "pan", shortcut: "V", icon: Hand },
  { key: "pen", shortcut: "P", icon: Pencil },
  { key: "arrow", shortcut: "A", icon: MoveUpRight },
  { key: "rect", shortcut: "R", icon: Square },
  { key: "pin", shortcut: "N", icon: MapPin },
];

export function IconButton({
  label,
  shortcut,
  children,
  className = "",
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title" | "aria-label"> & {
  label: string;
  shortcut?: string;
  children: ReactNode;
}) {
  return (
    <button
      {...props}
      type="button"
      className={`ir-icon-button ${className}`}
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
    >
      {children}
    </button>
  );
}

export function ToolButtons({
  tool,
  disabled,
  onSelect,
  t,
}: {
  tool: Tool;
  disabled: boolean;
  onSelect: (tool: Tool) => void;
  t: (text: string) => string;
}) {
  return (
    <div className="ir-tools" role="group" aria-label={t("Drawing tools")}>
      {tools.map(({ key, shortcut, icon: Icon }) => (
        <IconButton
          key={key}
          label={t(toolLabels[key])}
          shortcut={shortcut}
          disabled={disabled}
          aria-pressed={tool === key}
          onClick={() => onSelect(key)}
        >
          <Icon
            size={20}
            strokeWidth={1.75}
            aria-hidden="true"
            focusable="false"
          />
        </IconButton>
      ))}
    </div>
  );
}
