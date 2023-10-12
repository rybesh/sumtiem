import { initializeEditor, okToParse } from "./editor.js"
import { executeQuery } from "./query.js"
import { Resource } from "./resource.js"
import { render } from "./visualization.js"
import { EditorView, ViewUpdate } from "@codemirror/view"
import type { Quad } from "@rdfjs/types"
import { Parser } from "n3"

interface N3Data {
  text: string
  quads: Quad[]
}

interface Map {
  [key: string]: N3Data
}

enum Tab {
  data,
  rules,
}

async function fetchAndParse(parser: Parser, path: string): Promise<N3Data> {
  const text = await (await fetch(path)).text()
  const quads = parser.parse(text)
  return { text, quads }
}

async function main(): Promise<void> {
  const dataButton: HTMLButtonElement =
    document.querySelector<HTMLButtonElement>("#data-button")!
  const rulesButton: HTMLButtonElement =
    document.querySelector<HTMLButtonElement>("#rules-button")!
  const textarea: HTMLTextAreaElement =
    document.querySelector<HTMLTextAreaElement>("#editor textarea")!
  const visualization: HTMLElement =
    document.querySelector<HTMLElement>("#visualization")!

  const n3Parser = new Parser({ format: "text/n3" })

  const n3: Map = {
    data: await fetchAndParse(n3Parser, "nonnosus.ttl"),
    rules: await fetchAndParse(n3Parser, "rules.n3"),
    query: await fetchAndParse(n3Parser, "queries/extents.n3"),
  }

  let dataOrRulesChanged = true

  window.setInterval(() => {
    if (dataOrRulesChanged) {
      dataOrRulesChanged = false
      console.log("reasoning and rendering visualization...")
      executeQuery(n3.data.quads.concat(n3.rules.quads), n3.query.quads).then(
        (resources: Resource[]) => {
          render(visualization, resources)
        }
      )
    }
  }, 10)

  let currentTab = Tab.data
  let tabJustSwitched = false
  dataButton.disabled = true
  textarea.value = n3.data.text

  const onViewUpdate = (v: ViewUpdate) => {
    if (tabJustSwitched) {
      tabJustSwitched = false
    } else if (v.docChanged && okToParse(v.state)) {
      try {
        const text = v.state.doc.toString()
        const quads = n3Parser.parse(text)
        n3[Tab[currentTab]] = { text, quads }
        dataOrRulesChanged = true
      } catch (error) {
        console.error(error)
      }
    }
  }

  const view: EditorView = initializeEditor(textarea, onViewUpdate)

  function switchTo(tab: Tab) {
    tabJustSwitched = true
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: n3[Tab[tab]].text,
      },
    })
    currentTab = tab
  }

  dataButton.addEventListener("click", () => {
    dataButton.disabled = true
    switchTo(Tab.data)
    rulesButton.disabled = false
  })

  rulesButton.addEventListener("click", () => {
    rulesButton.disabled = true
    switchTo(Tab.rules)
    dataButton.disabled = false
  })
}

main()

new EventSource("/esbuild").addEventListener("change", () => location.reload())
