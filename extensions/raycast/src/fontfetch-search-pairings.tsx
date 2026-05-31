/**
 * "Search Font Pairings" — searchable list backed by @fontfetch/registry.
 * Type a family name to find sites that use it, or a tag to find pairings.
 * Selecting an item shows the full pairing (fonts, free alternatives, notes).
 */
import { List, ActionPanel, Action, Detail } from "@raycast/api";
import { allPairings, type Pairing } from "@fontfetch/registry";
import { useMemo, useState } from "react";

export default function Command(): JSX.Element {
  const [search, setSearch] = useState("");
  const pairings = useMemo(() => allPairings(), []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pairings;
    return pairings.filter((p) => {
      if (p.site.toLowerCase().includes(q)) return true;
      if (p.fonts.some((f) => f.family.toLowerCase().includes(q))) return true;
      if ((p.tags ?? []).some((t) => t.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [pairings, search]);

  return (
    <List
      searchBarPlaceholder="Search by site, family, or tag…"
      onSearchTextChange={setSearch}
      throttle
    >
      {filtered.map((p) => (
        <List.Item
          key={p.url}
          title={p.site}
          subtitle={p.fonts.map((f) => f.family).join(" / ")}
          accessories={[{ text: `${p.fonts.length} font${p.fonts.length === 1 ? "" : "s"}` }]}
          actions={
            <ActionPanel>
              <Action.Push title="View Pairing" target={<PairingDetail pairing={p} />} />
              <Action.OpenInBrowser url={p.url} title="Open Site" />
              <Action.CopyToClipboard title="Copy Families" content={p.fonts.map((f) => f.family).join(", ")} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

function PairingDetail({ pairing }: { pairing: Pairing }): JSX.Element {
  const md = [
    `# ${pairing.site}`,
    "",
    `URL: ${pairing.url}`,
    pairing.submitter ? `Submitted by ${pairing.submitter}` : "",
    "",
    "## Fonts",
    "",
  ];
  for (const f of pairing.fonts) {
    const license =
      f.license === "open" ? "✅ open" : f.license === "commercial" ? "⚠ commercial" : "❓ unknown";
    md.push(`### ${f.family} (${f.role}) — ${license}`);
    md.push("");
    if (f.foundry) md.push(`- Foundry: ${f.foundry}`);
    if (f.weights?.length) md.push(`- Weights: ${f.weights.join(", ")}`);
    if (f.free_alternatives?.length) {
      md.push(`- Free alternatives: **${f.free_alternatives.join("**, **")}**`);
    }
    md.push("");
  }
  if (pairing.notes) {
    md.push("## Notes", "", pairing.notes);
  }
  return (
    <Detail
      markdown={md.join("\n")}
      actions={
        <ActionPanel>
          <Action.OpenInBrowser url={pairing.url} title="Open Site" />
          <Action.CopyToClipboard
            title="Copy Free Alternatives"
            content={pairing.fonts.flatMap((f) => f.free_alternatives ?? []).join(", ")}
          />
        </ActionPanel>
      }
    />
  );
}
