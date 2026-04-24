import React from "react";
import { Text, View, StyleSheet } from "@react-pdf/renderer";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Root, RootContent, PhrasingContent, ListItem, TableRow } from "mdast";

const ms = StyleSheet.create({
  para:        { fontSize: 10, lineHeight: 1.4, flexDirection: "row", flexWrap: "wrap", marginBottom: 2 },
  bold:        { fontFamily: "Helvetica-Bold", fontSize: 10 },
  italic:      { fontFamily: "Helvetica-Oblique", fontSize: 10 },
  plain:       { fontSize: 10 },
  inlineCode:  { fontFamily: "Courier", fontSize: 9 },
  codeBlock:   { fontFamily: "Courier", fontSize: 8.5, backgroundColor: "#f5f5f5", padding: 4, marginBottom: 4 },
  listItem:    { flexDirection: "row", marginBottom: 1 },
  listBullet:  { width: 14, fontSize: 10, lineHeight: 1.4 },
  listContent: { flex: 1, fontSize: 10, lineHeight: 1.4 },
  table:       { marginBottom: 4, flexDirection: "column" },
  tableRow:    { flexDirection: "row" },
  tableHeader: { backgroundColor: "#eeeeee" },
  tableCell:   { flex: 1, border: "0.5pt solid #aaaaaa", padding: "2pt 3pt", fontSize: 9 },
});

function flattenInlineText(nodes: PhrasingContent[]): string {
  return nodes.map((n) => {
    if (n.type === "text" || n.type === "inlineCode") return n.value;
    if ("children" in n) return flattenInlineText(n.children as PhrasingContent[]);
    return "";
  }).join("");
}

function renderInline(nodes: PhrasingContent[], key = 0): React.ReactNode[] {
  return nodes.map((node, i) => {
    const k = key * 100 + i;
    switch (node.type) {
      case "text":
        return <Text key={k} style={ms.plain}>{node.value}</Text>;
      case "strong":
        return <Text key={k} style={ms.bold}>{flattenInlineText(node.children as PhrasingContent[])}</Text>;
      case "emphasis":
        return <Text key={k} style={ms.italic}>{flattenInlineText(node.children as PhrasingContent[])}</Text>;
      case "inlineCode":
        return <Text key={k} style={ms.inlineCode}>{node.value}</Text>;
      case "break":
        return <Text key={k}>{"\n"}</Text>;
      default:
        if ("children" in node) return renderInline(node.children as PhrasingContent[], k);
        return null;
    }
  });
}

function renderListItem(item: ListItem, bullet: string, key: number): React.ReactElement {
  const children = item.children.map((child, i) => {
    if (child.type === "paragraph") {
      return <Text key={i} style={ms.listContent}>{renderInline(child.children)}</Text>;
    }
    return null;
  });
  return (
    <View key={key} style={ms.listItem}>
      <Text style={ms.listBullet}>{bullet}</Text>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

function renderTableRow(row: TableRow, isHeader: boolean, key: number): React.ReactElement {
  return (
    <View key={key} style={[ms.tableRow, isHeader ? ms.tableHeader : {}]}>
      {row.children.map((cell, ci) => (
        <View key={ci} style={ms.tableCell}>
          <Text>{flattenInlineText(cell.children as PhrasingContent[])}</Text>
        </View>
      ))}
    </View>
  );
}

function renderBlock(node: RootContent, key: number): React.ReactElement | null {
  switch (node.type) {
    case "paragraph":
      return (
        <View key={key} style={ms.para}>
          {renderInline(node.children)}
        </View>
      );
    case "list": {
      const ordered = node.ordered ?? false;
      const start = node.start ?? 1;
      return (
        <View key={key} style={{ marginBottom: 2 }}>
          {node.children.map((item, i) => {
            const bullet = ordered ? `${start + i}.` : "•";
            return renderListItem(item, bullet, i);
          })}
        </View>
      );
    }
    case "code":
      return <View key={key} style={ms.codeBlock}><Text>{node.value}</Text></View>;
    case "table":
      return (
        <View key={key} style={ms.table}>
          {node.children.map((row, ri) => renderTableRow(row, ri === 0, ri))}
        </View>
      );
    case "heading":
      return (
        <View key={key} style={{ marginBottom: 2 }}>
          <Text style={ms.bold}>{flattenInlineText(node.children as PhrasingContent[])}</Text>
        </View>
      );
    default:
      return null;
  }
}

const parser = unified().use(remarkParse).use(remarkGfm);

export function MarkdownStatement({ text }: { text: string }) {
  const tree = parser.parse(text) as Root;
  const blocks = tree.children.map((n, i) => renderBlock(n, i)).filter(Boolean);
  return <View style={{ flex: 1 }}>{blocks}</View>;
}

export function estimateMarkdownH(text: string, charsPerLine: number, lineH = 14): number {
  const tree = parser.parse(text) as Root;
  let h = 0;
  for (const node of tree.children) {
    switch (node.type) {
      case "paragraph": {
        const len = flattenInlineText(node.children).length;
        h += Math.max(1, Math.ceil(len / charsPerLine)) * lineH;
        break;
      }
      case "list":
        h += node.children.length * lineH;
        break;
      case "code":
        h += (node.value.split("\n").length + 1) * 12;
        break;
      case "table":
        h += node.children.length * 20;
        break;
      case "heading":
        h += lineH;
        break;
      default:
        h += lineH;
    }
  }
  return Math.max(lineH, h) + 4;
}
