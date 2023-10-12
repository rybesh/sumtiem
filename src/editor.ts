import { Tree } from "@lezer/common"
import {
  EditorView,
  ViewUpdate,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view"
import { EditorState, Prec } from "@codemirror/state"
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting,
  syntaxTree,
} from "@codemirror/language"
import {
  defaultKeymap,
  history,
  historyKeymap,
  toggleComment,
  toggleLineComment,
  toggleBlockCommentByLine,
  CommentTokens,
} from "@codemirror/commands"
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search"
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete"
import { linter, lintGutter, lintKeymap } from "@codemirror/lint"
import { notation3 } from "codemirror-lang-notation3"

function positionOfFirstError(tree: Tree): number | null {
  let pos: number | null = null
  tree.iterate({
    enter: (n) => {
      if (pos == null && n.type.isError) {
        pos = n.from
        return false
      }
    },
  })
  return pos
}

export function okToParse(state: EditorState): boolean {
  const tree = syntaxTree(state)
  if (tree.length === state.doc.length) {
    if (positionOfFirstError(tree) === null) {
      // no errors
      return true
    }
  }
  return false
}

function simpleLezerLinter() {
  return linter((view) => {
    const { state } = view
    const tree = syntaxTree(state)

    if (tree.length === state.doc.length) {
      const pos = positionOfFirstError(tree)
      if (pos != null)
        return [
          {
            from: pos,
            to: pos + 1,
            severity: "error",
            message: "syntax error",
          },
        ]
    }
    return []
  })
}

function getConfig(state: EditorState, pos: number) {
  let data = state.languageDataAt<CommentTokens>("commentTokens", pos)
  return data.length ? data[0] : {}
}

export function initializeEditor(
  textarea: HTMLTextAreaElement,
  onViewUpdate: (v: ViewUpdate) => void
): EditorView {
  textarea.style.display = "none"

  const view = new EditorView({
    doc: textarea.value,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      notation3(),
      simpleLezerLinter(),
      lintGutter(),
      Prec.highest(
        keymap.of([
          {
            key: "Mod-/",
            run: (target: EditorView) => {
              let { state } = target,
                line = state.doc.lineAt(state.selection.main.from),
                config = getConfig(target.state, line.from)
              console.log(config)
              return config.line
                ? toggleLineComment(target)
                : config.block
                ? toggleBlockCommentByLine(target)
                : false
            },
          },
        ])
      ),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        ...lintKeymap,
      ]),
      EditorView.updateListener.of(onViewUpdate),
    ],
  })

  textarea.insertAdjacentElement("afterend", view.dom)

  return view
}
