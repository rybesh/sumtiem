import { SVG, Container } from "@svgdotjs/svg.js"
import { Resource } from "./resource.js"

const CANVAS = { width: 980, height: 1669 } // virtual canvas size
const MARGIN = { top: 50, right: 50, bottom: 50, left: 50 }
const DRAWING = {
  width: CANVAS.width - MARGIN.left - MARGIN.right,
  height: CANVAS.height - MARGIN.top - MARGIN.bottom,
}
const STROKE_WIDTH = 5
const HS = Math.floor(STROKE_WIDTH / 2) // halfstroke
const TICK_LENGTH = 20
const GRAY = "#8D8D8D"
const DARK_GRAY = "#5E5E5E"
const LABEL_WIDTH_PIXELS = 190
const LABEL_WIDTH_CHARS = 14
const LABEL_PADDING = 10
const LABEL_LINE_HEIGHT = 1.1
const BAR_WIDTH = 16
const GRADIENT_OFFSET = 128
const FONT_SIZE = 28
const FONT_FAMILY = "-apple-system"
const DEBUG = false

type EventMap = {
  [key: string]: Event
}

type ExtentMap = {
  [key: string]: Extent
}

function status(scale: number) {
  console.log(`window WxH: ${window.innerWidth}x${window.innerHeight}`)
  console.log(`window DPR: ${window.devicePixelRatio}`)
  console.log(`scale: ${scale}`)
}

function wrap(text: string): string[] {
  let line = 0
  let column = 0
  let wrappedText: string[] = [""]
  let charsRemaining = LABEL_WIDTH_CHARS
  for (let token of text.split(" ")) {
    if (token.length > LABEL_WIDTH_CHARS) {
      token = token.slice(0, LABEL_WIDTH_CHARS - 1) + "…"
    }
    if (column > 0) {
      charsRemaining -= 1
    }
    if (token.length > charsRemaining) {
      line += 1
      column = 0
      wrappedText.push("")
      charsRemaining = LABEL_WIDTH_CHARS
    }
    if (column > 0) {
      wrappedText[line] += " "
      column += 1
      charsRemaining--
    }
    wrappedText[line] += token
    column += token.length
    charsRemaining -= token.length
  }
  return wrappedText
}

class TextBox {
  private _lines: string[]
  private _attributes?: object

  constructor(text: string, attributes?: object) {
    this._lines = wrap(text)
    this._attributes = attributes
  }

  height(): number {
    return Math.floor(this._lines.length * FONT_SIZE * LABEL_LINE_HEIGHT)
  }

  prepend(text: string) {
    this._lines.unshift(text)
  }

  render(x: number, y: number, container: Container, color?: string) {
    const text = container
      .text((add) => {
        this._lines.forEach((line, i) => {
          add
            .tspan(line)
            .attr("x", x)
            .attr("y", y + Math.floor(i * FONT_SIZE * LABEL_LINE_HEIGHT))
        })
      })
      .font({
        fill: color || DARK_GRAY,
        family: FONT_FAMILY,
        size: FONT_SIZE,
      })
    if (this._attributes) {
      text.attr(this._attributes)
    }
  }
}

class Event {
  label: string
  date?: string
  boundedBy?: Extent
  layoutAbove: Set<Event>
  private _textBox: TextBox
  private _y?: number

  constructor(label: string, date: string) {
    this.label = label
    // only use dates with years
    this.date = date == undefined || date.startsWith("XXXX") ? undefined : date
    this._textBox = new TextBox(label, { "text-anchor": "end" })
    if (this.date) {
      this._textBox.prepend(this.date)
    }
    this.layoutAbove = new Set()
  }

  height(): number {
    return (
      Math.floor(FONT_SIZE * LABEL_LINE_HEIGHT) +
      (this.date ? this._textBox.height() : 0)
    )
  }

  render(y: number, ticks: Container, labels: Container): void {
    if (this.date) {
      this._textBox.render(0, y, labels)
      ticks.line(0, y, -TICK_LENGTH, y).stroke({
        color: GRAY,
        width: STROKE_WIDTH,
        linecap: "butt",
      })
    }
    this._y = y
  }

  y(): number {
    if (this._y == undefined) {
      throw new Error("event has not been rendered")
    }
    return this._y
  }

  isEqualTo(e: Event): boolean {
    if (e == undefined) {
      return false
    }
    return e.label == this.label && e.date == this.date
  }

  public toString(): string {
    return `${this.label} (${this.date})`
  }
}

class Extent {
  label: string
  from: Event
  to: Event
  column: number
  private _textBox: TextBox

  static colors = ["#1b9e77", "#d95f02", "#7570b3"]

  constructor(label: string, from: Event, to: Event) {
    this.label = label
    this.from = from
    this.to = to
    this.column = 0
    this._textBox = new TextBox(label)
  }

  render(container: Container): void {
    if (this.column == undefined) {
      throw new Error("must set column before rendering extent")
    }
    const color = Extent.colors[this.column]
    const x =
      LABEL_PADDING +
      this.column *
        (BAR_WIDTH + LABEL_PADDING + LABEL_WIDTH_PIXELS + LABEL_PADDING)
    const height = this.to.y() - this.from.y() + STROKE_WIDTH

    const bar = container.rect(BAR_WIDTH, height).move(x, this.from.y())

    if (this.from.date == undefined && this.to.date == undefined) {
      bar.fill(
        container
          .gradient("linear", (add) => {
            add.stop({ offset: 0, opacity: 0, color })
            add.stop({ offset: FONT_SIZE / height, opacity: 0, color })
            add.stop({ offset: GRADIENT_OFFSET / height, opacity: 1, color })
            add.stop({
              offset: (height - GRADIENT_OFFSET) / height,
              opacity: 1,
              color,
            })
            add.stop({
              offset: (height - FONT_SIZE) / height,
              opacity: 0,
              color,
            })
            add.stop({ offset: 1, opacity: 0, color })
          })
          .from(0, 0)
          .to(0, 1)
      )
    } else if (this.from.date == undefined) {
      bar.fill(
        container
          .gradient("linear", (add) => {
            add.stop({ offset: 0, opacity: 0, color })
            add.stop({ offset: FONT_SIZE / height, opacity: 0, color })
            add.stop({ offset: GRADIENT_OFFSET / height, opacity: 1, color })
            add.stop({ offset: 1, opacity: 1, color })
          })
          .from(0, 0)
          .to(0, 1)
      )
    } else if (this.to.date == undefined) {
      bar.fill(
        container
          .gradient("linear", (add) => {
            add.stop({ offset: 0, opacity: 0, color })
            add.stop({ offset: FONT_SIZE / height, opacity: 0, color })
            add.stop({ offset: GRADIENT_OFFSET / height, opacity: 1, color })
            add.stop({ offset: 1, opacity: 1, color })
          })
          .from(0, 1)
          .to(0, 0)
      )
    } else {
      bar.fill(color)
    }

    if (this.from.date == undefined) {
      container
        .text("?")
        .font({
          size: FONT_SIZE,
          weight: "bold",
          fill: color,
          family: FONT_FAMILY,
        })
        .attr("x", x + 1)
        .attr("y", this.from.y() + FONT_SIZE - 8)
    }

    if (this.to.date == undefined) {
      container
        .text("?")
        .font({
          size: FONT_SIZE,
          weight: "bold",
          fill: color,
          family: FONT_FAMILY,
        })
        .attr("x", x + 1)
        .attr("y", this.from.y() + height)
    }

    this._textBox.render(
      x + BAR_WIDTH + LABEL_PADDING,
      this.from.y() + FONT_SIZE - 8,
      container,
      color
    )
  }

  public toString(): string {
    return `${this.label}
  from: ${this.from}
  to: ${this.to}`
  }
}

type Intervals = {
  extents: Extent[]
  events: Event[]
}

function renderEvents(events: Event[], g: Container): void {
  const labelGroup = g
    .group()
    .translate(0 - LABEL_PADDING - TICK_LENGTH, Math.floor(FONT_SIZE / 2) - 5)
  const tickGroup = g.group()
  const minimumSpacing = Math.floor(FONT_SIZE * LABEL_LINE_HEIGHT)
  const labelsHeight = events
    .map((e) => e.height())
    .reduce((sum, h) => sum + h, 0)
  const numberOfSpaces = events.length - 1
  const spacingHeight = numberOfSpaces * minimumSpacing
  const extraSpace = DRAWING.height - (labelsHeight + spacingHeight)

  let spacing = minimumSpacing

  if (extraSpace > 0) {
    const totalSpace = spacingHeight + extraSpace
    spacing = (totalSpace - (totalSpace % numberOfSpaces)) / numberOfSpaces
  }

  let y = 0

  for (const event of events) {
    event.render(y, tickGroup, labelGroup)
    y += event.height() + spacing
  }
}

function renderAxis(events: Event[], g: Container): void {
  if (
    events.length > 1 &&
    events.filter((e) => e.date != undefined).length > 0
  ) {
    g.line(0, events[0].y(), 0, events[events.length - 1].y()).stroke({
      color: GRAY,
      width: STROKE_WIDTH,
      linecap: "square",
    })
  }
}

function renderExtents(extents: Extent[], g: Container): void {
  const barGroup = g.group().translate(HS + 0.5, -HS - 0.5)

  for (const extent of extents) {
    extent.render(barGroup)
  }
}

function renderVisualization(
  element: HTMLElement,
  { extents, events }: Intervals
) {
  element.innerHTML = ""

  const scale = window.innerHeight / CANVAS.height

  if (DEBUG) {
    status(scale)
  }

  const svg = SVG()
    .addTo(element)
    .size(Math.floor(window.innerWidth / 2), window.innerHeight)
    .group()
    .scale(scale)
    .translate(Math.floor(MARGIN.left * scale), Math.floor(MARGIN.top * scale))

  const g = svg
    .group()
    .translate(
      LABEL_WIDTH_PIXELS + LABEL_PADDING + TICK_LENGTH + HS,
      Math.floor(FONT_SIZE / 2)
    )

  renderEvents(events, g)
  renderAxis(events, g)
  renderExtents(extents, g)
}

function layoutExtentsAndEvents(resources: Resource[]): Intervals {
  const extentsByID: ExtentMap = {}
  const eventsByID: EventMap = {}

  function resolveEvent(r: Resource): Event {
    if (!r.types.has("sum:Event")) {
      throw new Error("expected ${r} to have the type sum:Event")
    }
    if (!(r.id in eventsByID)) {
      if (r.dataProps.get("label").size > 1) {
        console.warn(`${r.id} has multiple labels`)
      }
      if (r.dataProps.get("date").size > 1) {
        console.warn(`${r.id} has multiple dates`)
      }
      eventsByID[r.id] = new Event(
        r.dataProps.get("label").values().next().value,
        r.dataProps.get("date").values().next().value
      )
    }
    return eventsByID[r.id]
  }

  // create extents and their events
  for (const r of resources) {
    if (r.types.has("sum:Extent")) {
      if (r.objectProps.get("start").size > 1) {
        console.warn(`${r.id} has multiple starts`)
      }
      if (r.objectProps.get("finish").size > 1) {
        console.warn(`${r.id} has multiple finishes`)
      }
      if (r.dataProps.get("label").size > 1) {
        console.warn(`${r.id} has multiple labels`)
      }
      const start = resolveEvent(
        r.objectProps.get("start").values().next().value
      )
      const finish = resolveEvent(
        r.objectProps.get("finish").values().next().value
      )
      extentsByID[r.id] = new Extent(
        r.dataProps.get("label").values().next().value,
        start,
        finish
      )
    }
  }

  // link events to their bounding extents
  for (const r of resources) {
    if (r.types.has("sum:Event") && r.objectProps.has("bounds")) {
      if (r.objectProps.get("bounds").size > 1) {
        console.warn(`${r.id} has multiple bounds`)
      }
      const event = eventsByID[r.id]
      event.boundedBy =
        extentsByID[r.objectProps.get("bounds").values().next().value.id]
    }
  }

  // set layout order on events
  for (const r of resources) {
    if (r.types.has("sum:Event") && r.objectProps.has("layoutAbove")) {
      for (const other_r of r.objectProps.get("layoutAbove")) {
        eventsByID[r.id].layoutAbove.add(eventsByID[other_r.id])
      }
    }
  }

  // set layout column on extents
  let columnsChanged = true
  while (columnsChanged) {
    columnsChanged = false
    for (const r of resources) {
      if (r.types.has("sum:Extent") && r.objectProps.has("layoutRightOf")) {
        const extent = extentsByID[r.id]
        const column =
          Math.max(
            ...Array.from(r.objectProps.get("layoutRightOf")).map(
              (r) => extentsByID[r.id].column
            )
          ) + 1
        if (extent.column != column) {
          extent.column = column
          columnsChanged = true
        }
      }
    }
  }

  const extents = Object.values(extentsByID)

  // resolve start and finish events for extents
  for (const e of extents) {
    if (e.from.boundedBy) {
      e.from = e.from.boundedBy.from
    }
    if (e.to.boundedBy) {
      e.to = e.to.boundedBy.to
    }
  }

  // collect start and finish events for extents
  const events: Event[] = Array.from(
    extents.reduce((events, extent) => {
      events.add(extent.from)
      events.add(extent.to)
      return events
    }, new Set<Event>())
  )

  // sort events using layout order
  function sortEvents(a: Event, b: Event): number {
    if (a.layoutAbove.has(b)) {
      return -1
    } else if (b.layoutAbove.has(a)) {
      return 1
    } else {
      return 0
    }
  }
  events.sort(sortEvents)

  if (DEBUG) {
    for (const e of extents) {
      console.log(e.toString())
    }
    for (const e of events) {
      console.log(e.toString())
    }
  }

  return { extents, events }
}

export function render(element: HTMLElement, resources: Resource[]): void {
  renderVisualization(element, layoutExtentsAndEvents(resources))
}
