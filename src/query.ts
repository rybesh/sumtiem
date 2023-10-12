import type { Quad } from "@rdfjs/types"
import { Writer, Util } from "n3"
import { n3reasoner } from "eyereasoner"
import { Resource } from "./resource.js"

type NamespaceMap = {
  [key: string]: string
}

type Context = {
  [key: string]: string
}

type ReverseContext = {
  [key: string]: string
}

type ResourceMap = {
  [key: string]: Resource
}

const DEBUG = false

const NAMESPACES: NamespaceMap = {
  "": "https://example.org/nonnosus/",
  dc: "http://purl.org/dc/terms/",
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  sum: "http://github.com/rybesh/sumtiem/",
  time: "http://www.w3.org/2006/time#",
}

function printQuads(quads: Quad[]): void {
  const writer = new Writer({ prefixes: NAMESPACES })
  quads.sort((a, b) =>
    a.subject.value < b.subject.value
      ? -1
      : a.subject.value > b.subject.value
      ? 1
      : 0
  )
  writer.addQuads(quads)
  writer.end((err, result) => (err ? console.error(err) : console.log(result)))
}

function expand(qname: string): string {
  const [prefix, local] = qname.split(":")
  return `${NAMESPACES[prefix]}${local}`
}

function reverse(context: Context): ReverseContext {
  const reversed: ReverseContext = {}
  for (const prop in context) {
    reversed[expand(context[prop])] = prop
  }
  return reversed
}

function abbreviate(url: string): string {
  for (const prefix in NAMESPACES) {
    const base = NAMESPACES[prefix]
    if (url.startsWith(base)) {
      return `${prefix}:${url.slice(base.length)}`
    }
  }
  return url
}

function materialize(context: Context, quads: Quad[]): Resource[] {
  if (DEBUG) {
    printQuads(quads)
  }
  const properties = reverse(context)
  const resources: ResourceMap = {}
  for (const quad of quads) {
    if (!(quad.predicate.value in properties)) {
      continue
    }
    if (!(quad.subject.value in resources)) {
      resources[quad.subject.value] = new Resource(quad.subject.value)
    }
    const resource = resources[quad.subject.value]
    const property = properties[quad.predicate.value]
    if (property == "type") {
      resource.types.add(abbreviate(quad.object.value))
    } else if (Util.isLiteral(quad.object)) {
      resource.dataProps.get(property).add(quad.object.value)
    } else {
      if (!(quad.object.value in resources)) {
        resources[quad.object.value] = new Resource(quad.object.value)
      }
      resource.objectProps.get(property).add(resources[quad.object.value])
    }
  }
  return Object.values(resources)
}

export async function executeQuery(
  data: Quad[],
  query: Quad[]
): Promise<Resource[]> {
  return materialize(
    {
      type: "rdf:type",
      label: "rdfs:label",
      date: "dc:date",
      start: "time:intervalStartedBy",
      finish: "time:intervalFinishedBy",
      bounds: "time:intervalIn",
      layoutAbove: "sum:layoutAbove",
      layoutRightOf: "sum:layoutRightOf",
    },
    await n3reasoner(data, query)
  )
}
