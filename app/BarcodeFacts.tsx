import { CloseButton, Popover, UnstyledButton } from "@mantine/core";
import { useHotkeys, useTimeout } from "@mantine/hooks";
import { ExternalLink, Info, Lightbulb } from "lucide-react";
import { useRef, useState } from "react";
import type { BarcodeKind, RenderedBarcode } from "./barcode";
import { getBarcodeFacts } from "./barcode-facts";

export default function BarcodeFacts({ kind, label, encoded, symbol }: {
  kind: BarcodeKind;
  label: string;
  encoded?: string;
  symbol?: RenderedBarcode | null;
}) {
  const facts = getBarcodeFacts(kind, encoded, symbol);
  const [mode, setMode] = useState<"closed" | "peek" | "pinned">("closed");
  const targetRef = useRef<HTMLButtonElement>(null);
  const openTimer = useTimeout(() => setMode((current) => current === "closed" ? "peek" : current), 250);
  const closeTimer = useTimeout(() => setMode((current) => current === "peek" ? "closed" : current), 200);
  const cancelTimers = () => { openTimer.clear(); closeTimer.clear(); };
  const close = () => { cancelTimers(); setMode("closed"); };
  const leave = () => { openTimer.clear(); closeTimer.start(); };
  useHotkeys(mode === "peek" ? [["Escape", close]] : [], []);

  return (
    <Popover opened={mode !== "closed"} onDismiss={close} onChange={(opened) => { if (!opened) close(); }}
      position="bottom-end" width={420} withinPortal radius={0} offset={8} zIndex={400}
      preventPositionChangeWhenVisible={false}
      trapFocus={mode === "pinned"} returnFocus={mode === "pinned"}
      middlewares={{
        flip: { fallbackStrategy: "bestFit" },
        shift: { padding: 12 },
        size: { padding: 12, apply: ({ availableHeight, availableWidth, elements }) => {
          elements.floating.style.maxHeight = `${Math.max(0, Math.min(660, availableHeight))}px`;
          elements.floating.style.maxWidth = `${Math.max(0, Math.min(420, availableWidth))}px`;
        } },
      }}
      transitionProps={{ duration: 100 }} classNames={{ dropdown: "facts-popover" }}>
      <Popover.Target>
        <UnstyledButton ref={targetRef} type="button" className="type-pill facts-trigger" aria-label={`About ${label}`}
          onPointerEnter={(event) => { if (event.pointerType === "mouse") { closeTimer.clear(); openTimer.start(); } }}
          onPointerLeave={leave}
          onKeyDown={(event) => { if (event.key === "Escape") close(); }}
          onClick={() => { cancelTimers(); setMode((current) => current === "pinned" ? "closed" : "pinned"); }}>
          {label}<Info size={15} aria-hidden="true" />
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown onPointerEnter={() => closeTimer.clear()} onPointerLeave={leave}>
        <div className="facts-heading">
          <Lightbulb size={17} aria-hidden="true" />
          <h3>Inside {label}</h3>
          <CloseButton className="facts-close" size={44} aria-label="Close barcode facts" onClick={() => { close(); targetRef.current?.focus(); }} />
        </div>
        <div className="facts-scroll">
          {facts.badge && <p className="facts-badge">{facts.badge}</p>}
          <p className="facts-hook">{facts.hook}</p>
          {facts.segments && (
            <div className="facts-digits" aria-label="Your number, by function">
              {facts.segments.map((segment) => (
                <div key={segment.label} className={`facts-segment ${segment.tone}`} style={{ flexGrow: segment.value.length }}>
                  <code>{segment.value}</code>
                  <span>{segment.label}</span>
                </div>
              ))}
            </div>
          )}
          {facts.insight && (
            <div className="facts-insight">
              <b>{facts.insight.title}</b>
              <p>{facts.insight.text}</p>
            </div>
          )}
          <div className="facts-details">
            <dl>
              {facts.details.map((fact) => (
                <div key={fact.title}><dt>{fact.title}</dt><dd>{fact.text}</dd></div>
              ))}
              {facts.checksum && <div><dt>Your check digit, explained</dt><dd>{facts.checksum}</dd></div>}
            </dl>
            {facts.segments && <p className="facts-registration">This explains the structure. Product registration has not been verified.</p>}
            <div className="facts-sources">
              {facts.sources.map((source) => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label}<ExternalLink size={12} aria-hidden="true" /></a>
              ))}
            </div>
          </div>
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}
