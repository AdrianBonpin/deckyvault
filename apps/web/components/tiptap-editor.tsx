"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  Unlink,
} from "lucide-react"

interface TiptapEditorProps {
  content?: string
  onChange?: (json: Record<string, unknown>) => void
  placeholder?: string
  className?: string
}

export function TiptapEditor({
  content,
  onChange,
  placeholder = "Write your notes here...",
  className = "",
}: TiptapEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
        link: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: content ? JSON.parse(content) : undefined,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON())
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-invert prose-sm max-w-none min-h-[120px] px-4 py-3 outline-none",
      },
    },
  })

  if (!editor) {
    return null
  }

  const toggleLink = () => {
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run()
    } else {
      const url = window.prompt("Enter URL:")
      if (url) {
        editor.chain().focus().setLink({ href: url }).run()
      }
    }
  }

  return (
    <div
      className={`rounded-lg border border-border bg-text/5 overflow-hidden ${className}`}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded hover:bg-text/10 transition-colors cursor-pointer ${
            editor.isActive("bold") ? "bg-text/10 text-primary" : "text-text/50"
          }`}
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded hover:bg-text/10 transition-colors cursor-pointer ${
            editor.isActive("italic") ? "bg-text/10 text-primary" : "text-text/50"
          }`}
        >
          <Italic className="h-4 w-4" />
        </button>
        <div className="w-px h-4 bg-border mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded hover:bg-text/10 transition-colors cursor-pointer ${
            editor.isActive("bulletList") ? "bg-text/10 text-primary" : "text-text/50"
          }`}
        >
          <List className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded hover:bg-text/10 transition-colors cursor-pointer ${
            editor.isActive("orderedList") ? "bg-text/10 text-primary" : "text-text/50"
          }`}
        >
          <ListOrdered className="h-4 w-4" />
        </button>
        <div className="w-px h-4 bg-border mx-1" />
        <button
          type="button"
          onClick={toggleLink}
          className={`p-1.5 rounded hover:bg-text/10 transition-colors cursor-pointer ${
            editor.isActive("link") ? "bg-text/10 text-primary" : "text-text/50"
          }`}
        >
          {editor.isActive("link") ? (
            <Unlink className="h-4 w-4" />
          ) : (
            <LinkIcon className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  )
}
