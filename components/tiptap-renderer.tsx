"use client"

import React from "react"

interface TiptapNode {
  type: string
  content?: TiptapNode[]
  text?: string
  marks?: { type: string; attrs?: Record<string, string> }[]
  attrs?: Record<string, string>
}

export function TiptapRenderer({ content }: { content: string }) {
  let parsed: TiptapNode
  try {
    parsed = JSON.parse(content)
  } catch {
    // If it's just plain text, wrap it in a paragraph
    return <p className="text-sm text-text/70 whitespace-pre-line leading-relaxed">{content}</p>
  }

  return <div className="text-sm text-text/70 leading-relaxed">{renderNode(parsed)}</div>
}

function renderNode(node: TiptapNode, key?: number): React.ReactNode {
  switch (node.type) {
    case "doc":
      return node.content?.map((child, i) => renderNode(child, i))
    case "paragraph":
      return <p key={key} className="mb-2 last:mb-0">{node.content ? node.content.map((child, i) => renderNode(child, i)) : <br />}</p>
    case "text": {
      let el: React.ReactNode = node.text ?? ""
      node.marks?.forEach((mark) => {
        if (mark.type === "bold") el = <strong key={`${key}-bold`}>{el}</strong>
        if (mark.type === "italic") el = <em key={`${key}-italic`}>{el}</em>
      })
      return <span key={key}>{el}</span>
    }
    case "bulletList":
      return <ul key={key} className="list-disc pl-4 mb-2">{node.content?.map((child, i) => renderNode(child, i))}</ul>
    case "orderedList":
      return <ol key={key} className="list-decimal pl-4 mb-2">{node.content?.map((child, i) => renderNode(child, i))}</ol>
    case "listItem":
      return <li key={key}>{node.content?.map((child, i) => renderNode(child, i))}</li>
    case "link":
      return <a key={key} href={node.attrs?.href} target="_blank" rel="noopener noreferrer" className="text-primary underline">{node.content?.map((child, i) => renderNode(child, i))}</a>
    case "hardBreak":
      return <br key={key} />
    default:
      return node.content?.map((child, i) => renderNode(child, i))
  }
}
